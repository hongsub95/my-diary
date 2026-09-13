from datetime import datetime, time
from decimal import Decimal

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Place(Base):
    """지도상의 장소 하나. 여러 일정(Schedule)이 같은 Place를 재사용할 수 있다."""

    __tablename__ = "nl_places"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[str | None] = mapped_column(String(500))
    latitude: Mapped[Decimal | None] = mapped_column()
    longitude: Mapped[Decimal | None] = mapped_column()
    # 장소 출처: 사용자가 직접 입력했는지(manual) 외부 지도 API로 검색했는지 구분.
    provider: Mapped[str] = mapped_column(String(20), nullable=False, server_default="manual")
    provider_place_id: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    __table_args__ = (
        CheckConstraint("provider IN ('manual', 'kakao', 'naver', 'google')", name="ck_places_provider"),
        # 외부 지도 API에서 가져온 장소는 같은 곳을 여러 사용자가 추가해도 한 행만 유지한다.
        # 이 제약이 없으면 인기 있는 카페 하나가 사용자 수만큼 중복 저장되고,
        # 나중에 "이 장소를 방문한 기록 모아보기" 같은 기능을 만들 수 없다.
        # 사용자가 직접 입력한 manual 장소는 provider_place_id가 NULL이라 이 제약에 걸리지 않는다
        # (PostgreSQL은 NULL을 서로 다른 값으로 취급하므로 중복 허용).
        UniqueConstraint("provider", "provider_place_id", name="uq_places_provider_place"),
    )


class SchedulePlace(Base):
    """일정(Schedule)에 담긴 장소 하나. Schedule과 Place의 다대다 관계를 풀어주는 연결 테이블이며,
    방문 순서(sort_order)와 방문 여부(visited) 같은 일정별 상태를 함께 갖는다."""

    __tablename__ = "nl_schedule_places"

    id: Mapped[int] = mapped_column(primary_key=True)
    schedule_id: Mapped[int] = mapped_column(ForeignKey("nl_schedules.id", ondelete="CASCADE"), nullable=False)
    place_id: Mapped[int] = mapped_column(ForeignKey("nl_places.id", ondelete="CASCADE"), nullable=False)
    # 같은 일정 안에서 장소를 방문할 순서. 값이 작을수록 먼저 방문.
    sort_order: Mapped[int] = mapped_column(nullable=False, server_default="0")
    planned_time: Mapped[time | None] = mapped_column()
    memo: Mapped[str | None] = mapped_column(Text)
    address_detail: Mapped[str | None] = mapped_column(String(200))
    visited: Mapped[bool] = mapped_column(nullable=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        # 일정 상세 화면이 매번 "이 일정의 장소 목록"을 조회하므로 가장 자주 쓰이는 인덱스다.
        # sort_order를 함께 묶어 정렬까지 인덱스로 처리한다.
        Index("ix_nl_schedule_places_schedule_order", "schedule_id", "sort_order"),
        # 장소가 삭제될 때 이를 참조하는 행을 찾는 데 쓴다. PostgreSQL은 외래키에
        # 인덱스를 자동으로 만들지 않아서, 없으면 부모 삭제 시 전체 스캔이 일어난다.
        Index("ix_nl_schedule_places_place_id", "place_id"),
    )

    schedule: Mapped["Schedule"] = relationship(back_populates="places")
    place: Mapped["Place"] = relationship()
