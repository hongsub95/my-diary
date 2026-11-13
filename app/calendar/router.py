from typing import Annotated, Literal

from fastapi import APIRouter, Query

from app.auth.dependencies import CurrentUser
from app.calendar.schemas import CalendarHolidays
from app.calendar.service import get_holidays
from app.core.config import get_settings

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/holidays", response_model=CalendarHolidays)
def holidays(
    _current_user: CurrentUser,
    year: Annotated[int, Query(ge=1900, le=2100)],
    country: Literal["KR"] = "KR",
) -> CalendarHolidays:
    return get_holidays(year, get_settings().kasi_service_key.get_secret_value())
