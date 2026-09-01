from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Schedule(Base):
    """약속/일정 하나. 캘린더·리스트·지도 화면의 중심 엔티티이며, 장소(SchedulePlace)와
    일기(본문·사진·타임라인)가 여기에 매달린다.

    일정은 반드시 하나의 스페이스에 속한다. 조회·수정 권한은 created_by가 아니라
    space_id에 대한 활성 SpaceMember 여부로 판단한다 (docs/SPACE_MODEL_SPEC.md 11절)."""

    __tablename__ = "nl_schedules"

    id: Mapped[int] = mapped_column(primary_key=True)
    space_id: Mapped[int] = mapped_column(ForeignKey("nl_spaces.id", ondelete="CASCADE"), nullable=False)
    # 최초 작성자. 표시용이며 접근 제어에는 쓰지 않는다(삭제 권한 판단에만 사용).
    created_by: Mapped[int] = mapped_column(ForeignKey("nl_users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    start_at: Mapped[datetime] = mapped_column(nullable=False)
    end_at: Mapped[datetime] = mapped_column(nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="planned")
    # 실제로 완료 처리된 시각. status와 따로 두는 이유: 기록 목록을 "다녀온 순서"로
    # 정렬해야 하는데 status는 언제 바뀌었는지를 알려주지 않는다. end_at으로 대신하면
    # 지난 일정을 뒤늦게 완료한 경우 목록 맨 앞에 와야 할 하루가 아래로 묻힌다.
    # 종료 시각이 지났다는 이유만으로는 채우지 않는다 (docs/UX_BACKEND_HANDOFF.md 4절).
    completed_at: Mapped[datetime | None] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("status IN ('planned', 'completed', 'canceled')", name="ck_schedules_status"),
        # 종료 시각이 시작 시각보다 앞설 수 없다는 불변식을 DB 레벨에서도 강제.
        CheckConstraint("end_at >= start_at", name="ck_schedules_time_range"),
        # 캘린더와 일정 목록의 주 질의는 "이 스페이스의 이 기간 일정"이다.
        # 두 컬럼을 묶은 복합 인덱스라야 기간 조건까지 인덱스로 걸러진다.
        # space_id가 맨 앞이므로 space_id 단독 조회도 이 인덱스가 함께 처리한다.
        Index("ix_nl_schedules_space_start", "space_id", "start_at"),
        # 사용자 탈퇴 시 작성한 일정을 찾거나 "내가 만든 일정"을 조회할 때 쓴다.
        Index("ix_nl_schedules_created_by", "created_by"),
    )

    space: Mapped["Space"] = relationship(back_populates="schedules")
    created_by_user: Mapped["User"] = relationship(back_populates="created_schedules", foreign_keys=[created_by])
    places: Mapped[list["SchedulePlace"]] = relationship(
        back_populates="schedule", order_by="SchedulePlace.sort_order", passive_deletes=True
    )
    participants: Mapped[list["ScheduleParticipant"]] = relationship(back_populates="schedule", passive_deletes=True)
    # 하루의 일기는 세 갈래로 나뉜다. 본문만 작성자별이고 사진·타임라인은 공용이다.
    diary_entries: Mapped[list["DiaryEntry"]] = relationship(back_populates="schedule", passive_deletes=True)
    diary_photos: Mapped[list["DiaryPhoto"]] = relationship(
        back_populates="schedule", order_by="DiaryPhoto.sort_order", passive_deletes=True
    )
    diary_timeline: Mapped[list["DiaryTimelineItem"]] = relationship(
        back_populates="schedule",
        order_by="DiaryTimelineItem.occurred_at, DiaryTimelineItem.sort_order",
        passive_deletes=True,
    )
    share_links: Mapped[list["ShareLink"]] = relationship(back_populates="schedule", passive_deletes=True)


class ScheduleParticipant(Base):
    """일정별 참석자 (MVP 미사용).

    주의: 접근 제어에 사용하지 않는다. 스페이스 모델 도입으로 "누가 이 일정을 볼 수 있는가"는
    SpaceMember가 판단하고, 이 테이블은 향후 "누가 실제로 참석하는가"를 다루기 위해 남겨둔다
    (docs/SPACE_MODEL_SPEC.md 10절, P2 범위)."""

    __tablename__ = "nl_schedule_participants"

    id: Mapped[int] = mapped_column(primary_key=True)
    schedule_id: Mapped[int] = mapped_column(ForeignKey("nl_schedules.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("nl_users.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, server_default="viewer")
    invited_at: Mapped[datetime] = mapped_column(server_default=func.now())
    accepted_at: Mapped[datetime | None] = mapped_column()

    __table_args__ = (
        CheckConstraint("role IN ('owner', 'editor', 'viewer')", name="ck_participants_role"),
        UniqueConstraint("schedule_id", "user_id", name="uq_participants_schedule_user"),
        # (schedule_id, user_id) 고유 제약이 schedule_id로 시작하므로 그 방향 조회는 커버되지만,
        # user_id만으로 찾는 경우(사용자 탈퇴 처리 등)는 별도 인덱스가 필요하다.
        Index("ix_nl_schedule_participants_user_id", "user_id"),
    )

    schedule: Mapped["Schedule"] = relationship(back_populates="participants")
    user: Mapped["User"] = relationship()


class ShareLink(Base):
    """일정을 초대 없이 링크만으로 공유하기 위한 토큰. permission으로 열람/편집 권한을 구분하고,
    expires_at으로 만료 시점을 둘 수 있다."""

    __tablename__ = "nl_share_links"

    id: Mapped[int] = mapped_column(primary_key=True)
    schedule_id: Mapped[int] = mapped_column(ForeignKey("nl_schedules.id", ondelete="CASCADE"), nullable=False)
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    permission: Mapped[str] = mapped_column(String(10), nullable=False, server_default="view")
    expires_at: Mapped[datetime | None] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    __table_args__ = (
        CheckConstraint("permission IN ('view', 'edit')", name="ck_share_links_permission"),
        # 일정 삭제 시 딸린 공유 링크를 찾아 정리할 때 쓴다.
        Index("ix_nl_share_links_schedule_id", "schedule_id"),
    )

    schedule: Mapped["Schedule"] = relationship(back_populates="share_links")
