"""Small, process-local rate limiter and cost guard.

This is intentionally simple and suitable for a single-process portfolio
deployment. Multi-instance production deployments require a shared store such
as Redis; that limitation is documented in docs/security/DEPLOYMENT.md.
"""

from __future__ import annotations

import math
import threading
import time
from collections import deque
from dataclasses import dataclass
from datetime import UTC, datetime


@dataclass(frozen=True)
class RateLimitDecision:
    allowed: bool
    retry_after_seconds: int = 0
    reason: str | None = None


class RateLimiter:
    def __init__(
        self,
        per_minute: int,
        per_hour: int,
        daily_cap: int,
        clock=time.monotonic,
        utcnow=lambda: datetime.now(UTC),
    ) -> None:
        self.per_minute = per_minute
        self.per_hour = per_hour
        self.daily_cap = daily_cap
        self._clock = clock
        self._utcnow = utcnow
        self._buckets: dict[str, deque[float]] = {}
        self._lock = threading.Lock()
        self._daily_key = self._utcnow().date().isoformat()
        self._daily_count = 0
        self._last_cleanup = 0.0

    def check(self, key: str) -> RateLimitDecision:
        now = self._clock()
        with self._lock:
            self._roll_daily_window()
            self._cleanup(now)

            if self._daily_count >= self.daily_cap:
                return RateLimitDecision(
                    allowed=False,
                    retry_after_seconds=self._seconds_until_utc_midnight(),
                    reason="daily_cap",
                )

            bucket = self._buckets.setdefault(key, deque())
            self._prune(bucket, now)

            minute_bucket = [stamp for stamp in bucket if stamp > now - 60.0]
            if len(minute_bucket) >= self.per_minute:
                retry_after = math.ceil(minute_bucket[0] + 60.0 - now)
                return RateLimitDecision(
                    allowed=False,
                    retry_after_seconds=max(1, retry_after),
                    reason="per_minute",
                )

            hour_bucket = [stamp for stamp in bucket if stamp > now - 3600.0]
            if len(hour_bucket) >= self.per_hour:
                retry_after = math.ceil(hour_bucket[0] + 3600.0 - now)
                return RateLimitDecision(
                    allowed=False,
                    retry_after_seconds=max(1, retry_after),
                    reason="per_hour",
                )

            bucket.append(now)
            self._daily_count += 1
            return RateLimitDecision(allowed=True)

    def _prune(self, bucket: deque[float], now: float) -> None:
        while bucket and bucket[0] <= now - 3600.0:
            bucket.popleft()

    def _cleanup(self, now: float) -> None:
        if now - self._last_cleanup < 60.0:
            return
        self._last_cleanup = now
        stale_keys = [
            key for key, bucket in self._buckets.items() if not bucket or bucket[-1] <= now - 3600.0
        ]
        for key in stale_keys:
            del self._buckets[key]

    def _roll_daily_window(self) -> None:
        current_key = self._utcnow().date().isoformat()
        if current_key != self._daily_key:
            self._daily_key = current_key
            self._daily_count = 0

    def _seconds_until_utc_midnight(self) -> int:
        now = self._utcnow()
        tomorrow = now.replace(hour=0, minute=0, second=0, microsecond=0)
        seconds = (tomorrow.timestamp() + 86_400) - now.timestamp()
        return max(1, math.ceil(seconds))

    def reset(self) -> None:
        with self._lock:
            self._buckets.clear()
            self._daily_key = self._utcnow().date().isoformat()
            self._daily_count = 0
            self._last_cleanup = 0.0
