import calendar
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from .config import settings

UTC = timezone.utc


def gym_tz() -> ZoneInfo:
    return ZoneInfo(settings.app_timezone)


def utcnow() -> datetime:
    return datetime.now(UTC)


def gym_today() -> date:
    return utcnow().astimezone(gym_tz()).date()


def local_midnight(d: date) -> datetime:
    return datetime.combine(d, time.min, tzinfo=gym_tz()).astimezone(UTC)


def end_of_local_day(dt: datetime) -> datetime:
    local = dt.astimezone(gym_tz())
    return datetime.combine(local.date(), time(23, 59, 59), tzinfo=gym_tz()).astimezone(UTC)


def add_months(dt: datetime, months: int) -> datetime:
    """Calendar-month arithmetic in the gym's timezone; Jan 31 + 1mo clamps to Feb 28/29."""
    local = dt.astimezone(gym_tz())
    total = local.month - 1 + months
    year, month = local.year + total // 12, total % 12 + 1
    day = min(local.day, calendar.monthrange(year, month)[1])
    return local.replace(year=year, month=month, day=day).astimezone(UTC)


def add_days(dt: datetime, days: int) -> datetime:
    return dt + timedelta(days=days)
