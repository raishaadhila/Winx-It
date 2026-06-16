"""Tiny in-memory rate limiter for the public /api/anon endpoints.

We need to throttle unauthenticated LLM calls (5/10min per IP) to keep
NVIDIA costs bounded. The authed endpoints don't need this — Supabase
auth + per-user LLM cost are the natural brakes.

We avoid slowapi's @limiter.limit() decorator because it interferes
with FastAPI's body parameter introspection in some setups. A small
sliding-window dict is plenty for this scale.
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from typing import Deque, Dict


class SlidingWindowLimiter:
    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window = window_seconds
        self._buckets: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str) -> bool:
        """Returns True if the request is allowed, False if rate-limited."""
        now = time.monotonic()
        cutoff = now - self.window
        with self._lock:
            bucket = self._buckets[key]
            # Drop expired entries
            while bucket and bucket[0] < cutoff:
                bucket.popleft()
            if len(bucket) >= self.max_requests:
                return False
            bucket.append(now)
            return True


# 5 anon plan generations per 10 minutes per IP.
anon_plans_limiter = SlidingWindowLimiter(max_requests=5, window_seconds=600)
