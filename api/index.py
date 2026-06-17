"""Vercel Python serverless entry point.

Vercel auto-detects `api/*.py` as Python serverless functions. This
file re-exports the FastAPI `handler` built in `backend/vercel_index.py`.
"""
from __future__ import annotations

import os
import sys

_BACKEND = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

from vercel_index import handler  # noqa: E402,F401
