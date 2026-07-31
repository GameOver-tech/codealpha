"""Shared fixtures for the test suite."""
import os
import sys
from pathlib import Path

# Make the backend package importable regardless of CWD.
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("APP_ENV", "test")
