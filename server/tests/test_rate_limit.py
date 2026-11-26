from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.rate_limit import RateLimiter


class FakeClock:
    def __init__(self) -> None:
        self.seconds = 0.0

    def monotonic(self) -> float:
        return self.seconds

    def utcnow(self) -> datetime:
        return datetime(2026, 1, 1, tzinfo=UTC) + timedelta(seconds=self.seconds)


def test_per_minute_limit_and_recovery():
    clock = FakeClock()
    limiter = RateLimiter(2, 10, 100, clock=clock.monotonic, utcnow=clock.utcnow)

    assert limiter.check("1.2.3.4").allowed is True
    assert limiter.check("1.2.3.4").allowed is True

    denied = limiter.check("1.2.3.4")
    assert denied.allowed is False
    assert denied.reason == "per_minute"
    assert denied.retry_after_seconds == 60

    assert limiter.check("5.6.7.8").allowed is True

    clock.seconds = 61
    assert limiter.check("1.2.3.4").allowed is True


def test_per_hour_limit_is_separate_from_per_minute():
    clock = FakeClock()
    limiter = RateLimiter(10, 2, 100, clock=clock.monotonic, utcnow=clock.utcnow)

    assert limiter.check("1.2.3.4").allowed is True
    assert limiter.check("1.2.3.4").allowed is True

    denied = limiter.check("1.2.3.4")
    assert denied.allowed is False
    assert denied.reason == "per_hour"
    assert denied.retry_after_seconds == 3600


def test_global_daily_cap_denies_all_callers():
    clock = FakeClock()
    limiter = RateLimiter(10, 100, 2, clock=clock.monotonic, utcnow=clock.utcnow)

    assert limiter.check("1.2.3.4").allowed is True
    assert limiter.check("5.6.7.8").allowed is True

    denied = limiter.check("9.9.9.9")
    assert denied.allowed is False
    assert denied.reason == "daily_cap"
    assert denied.retry_after_seconds > 0


def test_daily_window_rolls_at_utc_midnight():
    clock = FakeClock()
    limiter = RateLimiter(10, 100, 1, clock=clock.monotonic, utcnow=clock.utcnow)

    assert limiter.check("1.2.3.4").allowed is True
    assert limiter.check("1.2.3.4").reason == "daily_cap"

    clock.seconds = 86_401
    assert limiter.check("1.2.3.4").allowed is True


def test_reset_clears_all_state():
    clock = FakeClock()
    limiter = RateLimiter(10, 100, 1, clock=clock.monotonic, utcnow=clock.utcnow)

    assert limiter.check("1.2.3.4").allowed is True
    assert limiter.check("1.2.3.4").reason == "daily_cap"

    limiter.reset()

    assert limiter.check("1.2.3.4").allowed is True
