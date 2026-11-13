from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel


class HolidayDay(BaseModel):
    date: date
    names: list[str]
    kind: Literal["public", "substitute", "temporary", "election"] = "public"


class HolidayMonth(BaseModel):
    month: int
    count: int | None
    status: Literal["ready", "unavailable"]


class CalendarHolidays(BaseModel):
    country: Literal["KR"] = "KR"
    year: int
    coverage: Literal["complete", "unavailable"]
    updated_at: datetime | None
    source: str
    source_urls: list[str]
    is_stale: bool = False
    days: list[HolidayDay]
    months: list[HolidayMonth]
