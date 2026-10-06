"""Command interaction features for operational spacecraft telemetry."""

from typing import List, Tuple
import numpy as np


class CommandInteractionFeatures:
    """Computes bounded operational context features between continuous telemetry and command indicators.
    
    Avoids O(N^2) pairwise interaction explosion by summarizing command states into
    operational activity masks and conditional telemetry values.
    """

    def __init__(
        self,
        aggregate_count: bool = True,
        continuous_interaction: bool = True,
        delta_interaction: bool = True,
    ) -> None:
        self.aggregate_count = aggregate_count
        self.continuous_interaction = continuous_interaction
        self.delta_interaction = delta_interaction

    def transform(
        self,
        continuous_val: np.ndarray,
        discrete_commands: np.ndarray,
        continuous_delta: np.ndarray | None = None,
    ) -> Tuple[np.ndarray, List[str]]:
        """Extract command interaction features.
        
        Args:
            continuous_val: (N,) continuous telemetry reading
            discrete_commands: (N, C_cmd) binary command indicator channels
            continuous_delta: Optional (N,) first-order continuous delta
        """
        n = len(continuous_val)
        cols: List[np.ndarray] = []
        names: List[str] = []

        if discrete_commands.shape[1] == 0:
            # No discrete command channels available
            return np.empty((n, 0), dtype=np.float32), []

        # Count active commands at time t
        cmd_count = np.sum(discrete_commands != 0, axis=1).astype(np.float32)
        cmd_active_mask = (cmd_count > 0.0).astype(np.float32)

        if self.aggregate_count:
            cols.append(cmd_count)
            names.append("active_command_count")

        if self.continuous_interaction:
            # Continuous telemetry value conditioned on whether any command is active
            c_when_cmd = (continuous_val.ravel() * cmd_active_mask).astype(np.float32)
            cols.append(c_when_cmd)
            names.append("continuous_val_when_command_active")

        if self.delta_interaction:
            if continuous_delta is None:
                diff = np.empty(n, dtype=np.float32)
                diff[0] = 0.0
                diff[1:] = continuous_val.ravel()[1:] - continuous_val.ravel()[:-1]
                continuous_delta = diff
            d_when_cmd = (continuous_delta.ravel() * cmd_active_mask).astype(np.float32)
            cols.append(d_when_cmd)
            names.append("continuous_delta_when_command_active")

        res = np.column_stack(cols) if cols else np.empty((n, 0), dtype=np.float32)
        return res, names
