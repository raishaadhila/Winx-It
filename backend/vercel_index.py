"""Vercel Python serverless entry point.

Vercel routes requests to this file via the `@vercel/python` builder
(see vercel.json). The `handler` symbol below is the contract — Vercel
invokes it as a standard AWS-Lambda-compatible handler and Mangum
translates the event into ASGI scope for the FastAPI app.

Why Mangum? FastAPI is an ASGI framework; Vercel's Python runtime is
essentially AWS Lambda. Mangum is the canonical adapter. We disable
the lifespan handler (lifespan="off") because serverless functions
are stateless — there's no startup/shutdown to manage.
"""
from __future__ import annotations

import os
import sys

# Make the `app` package importable. Vercel puts the entry file at the
# build root, so we add the directory containing this file (which is
# `backend/`) to sys.path. After that, `from app.main import app` works.
_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

from mangum import Mangum  # noqa: E402  (import after sys.path tweak)

from app.main import app  # noqa: E402

# Vercel forwards the full URL path to the function (e.g. /api/me),
# and our FastAPI routers are registered with the /api prefix intact,
# so we do NOT strip the prefix here — Mangum passes the path through
# unchanged. (Setting api_gateway_base_path="/api" would strip it and
# break the /api/* route registration.)
handler = Mangum(app, lifespan="off")
