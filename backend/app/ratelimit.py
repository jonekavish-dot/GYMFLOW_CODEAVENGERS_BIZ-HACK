import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException


class FailureLimiter:
    """Sliding-window cap on *failed* attempts per key (in-memory, so per process).

    Guards the two guessable secrets in this app: passwords at login and the 6-digit
    check-in code. Successful attempts clear the counter.
    """

    def __init__(self, max_failures: int, window_seconds: int):
        self.max_failures = max_failures
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def _prune(self, key: str, now: float) -> deque[float]:
        q = self._hits[key]
        while q and now - q[0] > self.window:
            q.popleft()
        return q

    def check(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            if len(self._prune(key, now)) >= self.max_failures:
                raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in a few minutes.")

    def fail(self, key: str) -> None:
        with self._lock:
            self._hits[key].append(time.monotonic())

    def clear(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)

    def reset_all(self) -> None:
        with self._lock:
            self._hits.clear()


login_limiter = FailureLimiter(max_failures=8, window_seconds=15 * 60)
checkin_limiter = FailureLimiter(max_failures=10, window_seconds=5 * 60)
