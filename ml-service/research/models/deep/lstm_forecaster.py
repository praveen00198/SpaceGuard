"""LSTM-based time-series forecasting anomaly detector with zero-copy streaming."""

from pathlib import Path
from typing import Any, Dict, Optional
import json
import joblib
import numpy as np

try:
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False

from research.models.base import BaseAnomalyDetector
from research.models.deep.dataset import TimeSeriesSequenceDataset


if HAS_TORCH:
    class _LSTMForecasterNet(nn.Module):
        """PyTorch neural network for next-step continuous telemetry forecasting."""

        def __init__(
            self,
            input_dim: int,
            hidden_dim: int = 32,
            num_layers: int = 1,
            dropout: float = 0.1,
        ) -> None:
            super().__init__()
            self.lstm = nn.LSTM(
                input_size=input_dim,
                hidden_size=hidden_dim,
                num_layers=num_layers,
                batch_first=True,
                dropout=dropout if num_layers > 1 else 0.0,
            )
            self.head = nn.Linear(hidden_dim, 1)

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            # x shape: (batch_size, window_size, input_dim)
            out, _ = self.lstm(x)
            last_hidden = out[:, -1, :]
            pred = self.head(last_hidden)
            return pred


class LSTMForecaster(BaseAnomalyDetector):
    """LSTM sequence forecaster for residual-based anomaly detection.
    
    Predicts next continuous telemetry value from past window [x_{t-W}, ..., x_{t-1}].
    Anomaly score is the normalized absolute prediction residual |y_t - ŷ_t|.
    Uses zero-copy streaming evaluation to strictly bound memory consumption.
    """

    def __init__(
        self,
        window_size: int = 50,
        hidden_dim: int = 32,
        num_layers: int = 1,
        epochs: int = 3,
        batch_size: int = 512,
        lr: float = 1e-3,
        random_seed: int = 42,
        target_channel: int = 0,
    ) -> None:
        super().__init__(model_name=f"LSTMForecaster_W{window_size}_H{hidden_dim}", model_version="0.1.0")
        self.window_size = window_size
        self.hidden_dim = hidden_dim
        self.num_layers = num_layers
        self.epochs = epochs
        self.batch_size = batch_size
        self.lr = lr
        self.random_seed = random_seed
        self.target_channel = target_channel
        self.net: Optional[Any] = None
        self.residual_mean_ = 0.0
        self.residual_std_ = 1.0

    def fit(self, X: np.ndarray, split_name: str = "train") -> "LSTMForecaster":
        """Fit LSTM on nominal training data only."""
        if not HAS_TORCH:
            raise ImportError("PyTorch is required for LSTMForecaster.")

        if split_name != "train":
            raise ValueError(f"Training must strictly use split_name='train', got: {split_name}")

        torch.manual_seed(self.random_seed)
        np.random.seed(self.random_seed)

        input_dim = X.shape[1]
        self.net = _LSTMForecasterNet(
            input_dim=input_dim,
            hidden_dim=self.hidden_dim,
            num_layers=self.num_layers,
        )

        total_samples = max(0, len(X) - self.window_size)
        if total_samples <= 0:
            raise ValueError(f"Input length {len(X)} too short for window {self.window_size}")

        val_samples = int(total_samples * 0.20)
        train_samples = total_samples - val_samples

        train_X = X[: train_samples + self.window_size]
        val_X = X[train_samples :]

        train_ds = TimeSeriesSequenceDataset(train_X, window_size=self.window_size, target_idx=self.target_channel)
        val_ds = TimeSeriesSequenceDataset(val_X, window_size=self.window_size, target_idx=self.target_channel)

        loader = DataLoader(train_ds, batch_size=self.batch_size, shuffle=True)
        val_loader = DataLoader(val_ds, batch_size=self.batch_size, shuffle=False)

        optimizer = torch.optim.Adam(self.net.parameters(), lr=self.lr, weight_decay=1e-5)
        loss_fn = nn.SmoothL1Loss()

        self.net.train()
        best_val_loss = float("inf")
        best_state = None

        for epoch in range(self.epochs):
            for batch_x, batch_y in loader:
                optimizer.zero_grad()
                pred = self.net(batch_x)
                loss = loss_fn(pred, batch_y)
                loss.backward()
                optimizer.step()

            # Validation loss check
            self.net.eval()
            val_losses = []
            with torch.no_grad():
                for v_x, v_y in val_loader:
                    v_pred = self.net(v_x)
                    val_losses.append(loss_fn(v_pred, v_y).item())
            val_loss = float(np.mean(val_losses)) if val_losses else 0.0

            if val_loss < best_val_loss:
                best_val_loss = val_loss
                best_state = {k: v.cpu().clone() for k, v in self.net.state_dict().items()}
            self.net.train()

        if best_state is not None:
            self.net.load_state_dict(best_state)

        # Compute baseline nominal residual statistics using full train dataset loader
        full_ds = TimeSeriesSequenceDataset(X, window_size=self.window_size, target_idx=self.target_channel)
        full_loader = DataLoader(full_ds, batch_size=self.batch_size, shuffle=False)

        self.net.eval()
        residuals_list = []
        with torch.no_grad():
            for b_x, b_y in full_loader:
                preds = self.net(b_x).numpy()
                targets = b_y.numpy()
                res = np.abs(targets - preds)
                residuals_list.append(res)

        all_res = np.vstack(residuals_list)
        self.residual_mean_ = float(np.mean(all_res))
        self.residual_std_ = float(np.std(all_res))
        if self.residual_std_ < 1e-6:
            self.residual_std_ = 1.0

        self.is_fitted_ = True
        self.fit_metadata_ = {
            "window_size": self.window_size,
            "hidden_dim": self.hidden_dim,
            "num_layers": self.num_layers,
            "best_val_loss": float(best_val_loss),
            "residual_mean": self.residual_mean_,
            "residual_std": self.residual_std_,
            "random_seed": self.random_seed,
            "num_training_samples": len(X),
        }
        return self

    def compute_scores(self, X: np.ndarray) -> np.ndarray:
        """Compute normalized absolute prediction residual as anomaly score."""
        if not self.is_fitted_ or self.net is None:
            raise RuntimeError("Model must be fitted before computing scores.")

        N, D = X.shape
        scores = np.zeros(N, dtype=np.float32)
        if N <= self.window_size:
            return scores

        ds = TimeSeriesSequenceDataset(X, window_size=self.window_size, target_idx=self.target_channel)
        loader = DataLoader(ds, batch_size=self.batch_size, shuffle=False)

        self.net.eval()
        preds_list = []
        with torch.no_grad():
            for b_x, _ in loader:
                pred = self.net(b_x).numpy()
                preds_list.append(pred)

        preds = np.vstack(preds_list).flatten()
        targets = X[self.window_size :, self.target_channel]
        raw_residuals = np.abs(targets - preds)

        norm_scores = (raw_residuals - self.residual_mean_) / self.residual_std_
        norm_scores = np.clip(norm_scores, 0.0, None)

        scores[self.window_size :] = norm_scores
        if len(norm_scores) > 0:
            scores[: self.window_size] = norm_scores[0]

        return scores
