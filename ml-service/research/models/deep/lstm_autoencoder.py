"""LSTM-based time-series autoencoder anomaly detector with zero-copy streaming."""

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
    class _LSTMEncoder(nn.Module):
        """Encoder: compresses input window to latent bottleneck representation."""

        def __init__(self, input_dim: int, hidden_dim: int = 32, latent_dim: int = 16) -> None:
            super().__init__()
            self.lstm = nn.LSTM(input_size=input_dim, hidden_size=hidden_dim, batch_first=True)
            self.fc_latent = nn.Linear(hidden_dim, latent_dim)

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            _, (h_n, _) = self.lstm(x)
            latent = self.fc_latent(h_n.squeeze(0))
            return latent

    class _LSTMDecoder(nn.Module):
        """Decoder: unrolls latent representation back to input window dimensions."""

        def __init__(self, output_dim: int, window_size: int, hidden_dim: int = 32, latent_dim: int = 16) -> None:
            super().__init__()
            self.window_size = window_size
            self.fc_unroll = nn.Linear(latent_dim, hidden_dim)
            self.lstm = nn.LSTM(input_size=hidden_dim, hidden_size=hidden_dim, batch_first=True)
            self.fc_out = nn.Linear(hidden_dim, output_dim)

        def forward(self, z: torch.Tensor) -> torch.Tensor:
            unrolled = self.fc_unroll(z).unsqueeze(1).repeat(1, self.window_size, 1)
            out, _ = self.lstm(unrolled)
            reconstructed = self.fc_out(out)
            return reconstructed

    class _LSTMAutoencoderNet(nn.Module):
        """Full Seq2Seq LSTM Autoencoder network."""

        def __init__(self, input_dim: int, window_size: int, hidden_dim: int = 32, latent_dim: int = 16) -> None:
            super().__init__()
            self.encoder = _LSTMEncoder(input_dim=input_dim, hidden_dim=hidden_dim, latent_dim=latent_dim)
            self.decoder = _LSTMDecoder(
                output_dim=input_dim,
                window_size=window_size,
                hidden_dim=hidden_dim,
                latent_dim=latent_dim,
            )

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            z = self.encoder(x)
            recon = self.decoder(z)
            return recon


class LSTMAutoencoder(BaseAnomalyDetector):
    """LSTM Sequence Autoencoder for reconstruction-based anomaly detection.
    
    Reconstructs entire temporal sequence window.
    Anomaly score is the normalized Mean Squared Reconstruction Error across all channels.
    Uses zero-copy streaming evaluation to strictly bound memory consumption.
    """

    def __init__(
        self,
        window_size: int = 50,
        hidden_dim: int = 32,
        latent_dim: int = 16,
        epochs: int = 3,
        batch_size: int = 512,
        lr: float = 1e-3,
        random_seed: int = 42,
    ) -> None:
        super().__init__(model_name=f"LSTMAutoencoder_W{window_size}_L{latent_dim}", model_version="0.1.0")
        self.window_size = window_size
        self.hidden_dim = hidden_dim
        self.latent_dim = latent_dim
        self.epochs = epochs
        self.batch_size = batch_size
        self.lr = lr
        self.random_seed = random_seed
        self.net: Optional[Any] = None
        self.recon_mean_ = 0.0
        self.recon_std_ = 1.0

    def fit(self, X: np.ndarray, split_name: str = "train") -> "LSTMAutoencoder":
        """Fit Autoencoder on nominal training data only."""
        if not HAS_TORCH:
            raise ImportError("PyTorch is required for LSTMAutoencoder.")

        if split_name != "train":
            raise ValueError(f"Training must strictly use split_name='train', got: {split_name}")

        torch.manual_seed(self.random_seed)
        np.random.seed(self.random_seed)

        input_dim = X.shape[1]
        self.net = _LSTMAutoencoderNet(
            input_dim=input_dim,
            window_size=self.window_size,
            hidden_dim=self.hidden_dim,
            latent_dim=self.latent_dim,
        )

        total_samples = max(0, len(X) - self.window_size + 1)
        if total_samples <= 0:
            raise ValueError(f"Input length {len(X)} too short for window {self.window_size}")

        val_samples = int(total_samples * 0.20)
        train_samples = total_samples - val_samples

        train_X = X[: train_samples + self.window_size - 1]
        val_X = X[train_samples :]

        train_ds = TimeSeriesSequenceDataset(train_X, window_size=self.window_size, is_autoencoder=True)
        val_ds = TimeSeriesSequenceDataset(val_X, window_size=self.window_size, is_autoencoder=True)

        loader = DataLoader(train_ds, batch_size=self.batch_size, shuffle=True)
        val_loader = DataLoader(val_ds, batch_size=self.batch_size, shuffle=False)

        optimizer = torch.optim.Adam(self.net.parameters(), lr=self.lr, weight_decay=1e-5)
        loss_fn = nn.MSELoss()

        self.net.train()
        best_val_loss = float("inf")
        best_state = None

        for epoch in range(self.epochs):
            for batch_x, _ in loader:
                optimizer.zero_grad()
                recon = self.net(batch_x)
                loss = loss_fn(recon, batch_x)
                loss.backward()
                optimizer.step()

            # Validation loss check
            self.net.eval()
            val_losses = []
            with torch.no_grad():
                for v_x, _ in val_loader:
                    v_recon = self.net(v_x)
                    val_losses.append(loss_fn(v_recon, v_x).item())
            val_loss = float(np.mean(val_losses)) if val_losses else 0.0

            if val_loss < best_val_loss:
                best_val_loss = val_loss
                best_state = {k: v.cpu().clone() for k, v in self.net.state_dict().items()}
            self.net.train()

        if best_state is not None:
            self.net.load_state_dict(best_state)

        # Baseline reconstruction statistics
        full_ds = TimeSeriesSequenceDataset(X, window_size=self.window_size, is_autoencoder=True)
        full_loader = DataLoader(full_ds, batch_size=self.batch_size, shuffle=False)

        self.net.eval()
        recon_errors = []
        with torch.no_grad():
            for b_x, _ in full_loader:
                r = self.net(b_x)
                err = torch.mean((b_x - r) ** 2, dim=(1, 2)).numpy()
                recon_errors.append(err)
        all_errs = np.concatenate(recon_errors)
        self.recon_mean_ = float(np.mean(all_errs))
        self.recon_std_ = float(np.std(all_errs))
        if self.recon_std_ < 1e-6:
            self.recon_std_ = 1.0

        self.is_fitted_ = True
        self.fit_metadata_ = {
            "window_size": self.window_size,
            "hidden_dim": self.hidden_dim,
            "latent_dim": self.latent_dim,
            "best_val_loss": float(best_val_loss),
            "recon_mean": self.recon_mean_,
            "recon_std": self.recon_std_,
            "random_seed": self.random_seed,
            "num_training_samples": len(X),
        }
        return self

    def compute_scores(self, X: np.ndarray) -> np.ndarray:
        """Compute normalized reconstruction error as anomaly score."""
        if not self.is_fitted_ or self.net is None:
            raise RuntimeError("Model must be fitted before computing scores.")

        N, D = X.shape
        scores = np.zeros(N, dtype=np.float32)
        if N < self.window_size:
            return scores

        ds = TimeSeriesSequenceDataset(X, window_size=self.window_size, is_autoencoder=True)
        loader = DataLoader(ds, batch_size=self.batch_size, shuffle=False)

        self.net.eval()
        recon_errors = []
        with torch.no_grad():
            for b_x, _ in loader:
                r = self.net(b_x)
                err = torch.mean((b_x - r) ** 2, dim=(1, 2)).numpy()
                recon_errors.append(err)
        all_errs = np.concatenate(recon_errors)

        # Normalize score
        norm_scores = (all_errs - self.recon_mean_) / self.recon_std_
        norm_scores = np.clip(norm_scores, 0.0, None)

        scores[self.window_size - 1 :] = norm_scores
        if len(norm_scores) > 0:
            scores[: self.window_size - 1] = norm_scores[0]

        return scores
