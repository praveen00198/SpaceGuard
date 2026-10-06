"""Pytest configuration ensuring ml-service root is in sys.path."""

import sys
from pathlib import Path

ml_service_dir = Path(__file__).resolve().parent.parent
if str(ml_service_dir) not in sys.path:
    sys.path.insert(0, str(ml_service_dir))
