"""Server-managed government snapshots and optional cached KASI refreshes."""

import json
import threading
import time
from datetime import date, datetime, timezone
from functools import lru_cache
from pathlib import Path
from urllib.parse import unquote, urlencode
from urllib.request import urlopen

from app.calendar.schemas import CalendarHolidays, HolidayDay, HolidayMonth

KASI_URL = "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo"
_cache: dict[tuple[int, str], tuple[float, CalendarHolidays]] = {}
_lock = threading.Lock()


@lru_cache
def _snapshot() -> dict:
    return json.loads(Path(__file__).with_name("holidays.json").read_text(encoding="utf-8"))


def normalize_days(year: int, rows: list[dict]) -> list[HolidayDay]:
    """Retain overlapping names, excluding ordinary weekends and observances."""
    days: dict[date, HolidayDay] = {}
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("Invalid holiday record")
        name = str(row.get("dateName", "")).strip()
        if row.get("isHoliday") != "Y" or not name or name in {"일요일", "토요일"}:
            continue
        parsed = datetime.strptime(str(row["locdate"]), "%Y%m%d").date()
        if parsed.year != year:
            raise ValueError("Holiday record belongs to a different year")
        kind = "public"
        if "대체공휴일" in name:
            kind = "substitute"
        elif "선거" in name:
            kind = "election"
        elif "임시공휴일" in name:
            kind = "temporary"
        if parsed in days:
            if name not in days[parsed].names:
                days[parsed].names.append(name)
        else:
            days[parsed] = HolidayDay(date=parsed, names=[name], kind=kind)
    return sorted(days.values(), key=lambda item: item.date)


def _kasi_days(year: int, service_key: str) -> list[HolidayDay]:
    query = urlencode({
        "serviceKey": unquote(service_key), "solYear": year,
        "numOfRows": 100, "_type": "json",
    })
    # Unlike an HTTP client with request logging, urllib will not log the secret URL.
    with urlopen(f"{KASI_URL}?{query}", timeout=5) as response:
        payload = json.load(response)["response"]
    if payload["header"]["resultCode"] != "00":
        raise ValueError("Holiday provider rejected the request")
    body = payload["body"]
    if not isinstance(body.get("totalCount"), int) or body["totalCount"] <= 0:
        raise ValueError("Holiday year has not been published")
    items = body.get("items")
    if not isinstance(items, dict):
        raise ValueError("Invalid holiday response")
    records = items.get("item", [])
    records = records if isinstance(records, list) else [records]
    if len(records) != body["totalCount"]:
        raise ValueError("Incomplete holiday response")
    days = normalize_days(year, records)
    if len(days) < 10:
        raise ValueError("Incomplete holiday year")
    return days


def _snapshot_days(year: int, entries: list) -> list[HolidayDay]:
    return [HolidayDay(
        date=f"{year}-{row[0]}", names=row[1],
        kind=row[2] if len(row) > 2 else "public",
    ) for row in entries]


def get_holidays(year: int, service_key: str = "") -> CalendarHolidays:
    """Cache a complete year for 24h; uncovered years have null monthly counts."""
    cache_key = (year, service_key)
    with _lock:
        cached = _cache.get(cache_key)
        if cached and time.monotonic() - cached[0] < 86400:
            return cached[1].model_copy(deep=True)
        snapshot = _snapshot()
        entries = snapshot["years"].get(str(year))
        days = _snapshot_days(year, entries or [])
        source = "KASI_GOVERNMENT_SNAPSHOT" if entries is not None else "unavailable"
        updated_at = snapshot["updated_at"] if entries is not None else None
        stale = False
        if service_key:
            try:
                days = _kasi_days(year, service_key)
                # Include subsequent official announcements absent from an older upstream release.
                by_date = {item.date: item for item in days}
                for item in _snapshot_days(year, entries or []):
                    if item.date not in by_date:
                        by_date[item.date] = item
                    else:
                        by_date[item.date].names = list(dict.fromkeys(
                            by_date[item.date].names + item.names
                        ))
                days = sorted(by_date.values(), key=lambda item: item.date)
                source = "KASI_SPCDE"
                updated_at = datetime.now(timezone.utc)
            except (OSError, ValueError, KeyError, TypeError):
                stale = entries is not None
        available = source != "unavailable"
        result = CalendarHolidays(
            year=year, coverage="complete" if available else "unavailable",
            updated_at=updated_at, source=source,
            source_urls=snapshot["source_urls"] if available else [],
            is_stale=stale, days=days,
            months=[HolidayMonth(
                month=month,
                count=sum(day.date.month == month for day in days) if available else None,
                status="ready" if available else "unavailable",
            ) for month in range(1, 13)],
        )
        if len(_cache) >= 32:
            _cache.pop(next(iter(_cache)))
        _cache[cache_key] = (time.monotonic(), result)
        return result.model_copy(deep=True)
