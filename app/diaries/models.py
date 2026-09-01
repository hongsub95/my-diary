"""일기 모델.

하루의 일기는 이 파일의 행 하나가 아니라 **같은 일정에 달린 세 가지의 합**이다.

- `DiaryEntry`      작성자별 본문. 한 일정에 여러 명이 각자 하나씩 쓴다
- `DiaryPhoto`      하루 공용 사진
- `DiaryTimelineItem` 하루 공용 방문 타임라인

사진과 타임라인을 본문이 아니라 **일정에 직접 매단 이유**: 본문에 매달면 두 사람이
올린 사진이 두 묶음으로 갈려서, 완료 상세의 대표 사진 한 장과 기록 목록의 썸네일을
누구 것에서 고를지 화면마다 다시 정해야 한다. 방문 타임라인도 하루에 하나여야 하는데
작성자 수만큼 생긴다. 같이 보낸 하루의 사진과 동선은 공용이고, 그날을 어떻게 느꼈는지만
각자 쓴다 (docs/API_SPEC.md 7장).

작성자별이라는 말은 비공개라는 뜻이 아니다. 같은 스페이스의 활성 멤버는 서로의 본문을
모두 볼 수 있다 (docs/SPACE_MODEL_SPEC.md 16절).
"""

from datetime import datetime

from sqlalchemy import ForeignKey, Index, String, Text, UniqueConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class DiaryEntry(Base):
    """한 사람이 그 하루에 남긴 본문.

    본문 항목은 글이 있을 때만 존재하므로 content는 NOT NULL이다. 사진만 남긴 하루는
    이 표에 행이 없고 DiaryPhoto만 있는 상태이며, 그것도 정상적인 일기다.
    """

    __tablename__ = "nl_diary_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    schedule_id: Mapped[int] = mapped_column(ForeignKey("nl_schedules.id", ondelete="CASCADE"), nullable=False)
    author_id: Mapped[int] = mapped_column(ForeignKey("nl_users.id", ondelete="CASCADE"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    mood: Mapped[str | None] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        # 한 사람은 한 일정에 본문 하나만 가진다. 그래서 API가 PUT 하나로 생성·수정을
        # 받을 수 있고, 클라이언트가 "내가 이미 썼나"를 먼저 확인하지 않아도 된다.
        UniqueConstraint("schedule_id", "author_id", name="uq_diary_schedule_author"),
        # "내가 쓴 일기 모아보기"와 사용자 탈퇴 처리에 쓴다.
        Index("ix_nl_diary_entries_author_id", "author_id"),
    )

    schedule: Mapped["Schedule"] = relationship(back_populates="diary_entries")
    author: Mapped["User"] = relationship()


class DiaryPhoto(Base):
    """하루에 남긴 사진 한 장. 본문이 아니라 일정에 직접 달린다."""

    __tablename__ = "nl_diary_photos"

    id: Mapped[int] = mapped_column(primary_key=True)
    schedule_id: Mapped[int] = mapped_column(ForeignKey("nl_schedules.id", ondelete="CASCADE"), nullable=False)
    # 누가 올렸는지는 보존한다. 삭제 권한 판단과 "내가 올린 사진" 조회에 쓴다.
    uploader_id: Mapped[int] = mapped_column(ForeignKey("nl_users.id", ondelete="CASCADE"), nullable=False)
    # 전체 URL이 아니라 저장 키만 담는다. 로컬 디스크에서 S3로 옮겨도 이 값은 그대로이며,
    # 응답을 만들 때 현재 저장소의 base URL을 붙인다 (docs/API_SPEC.md 7장).
    # 컬럼 이름을 file_url이 아니라 storage_key로 둔 이유: URL이 아닌 값이 들어 있는데
    # 이름이 url이면 그대로 <img src>에 넣는 실수가 난다.
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    # 썸네일은 생성 전이거나 실패했을 수 있어 nullable이다.
    thumbnail_key: Mapped[str | None] = mapped_column(String(500))
    sort_order: Mapped[int] = mapped_column(nullable=False, server_default="0")
    # 대표 사진 여부. 지정이 없으면 sort_order가 가장 앞선 사진을 대표로 쓴다.
    # 이 컬럼이 없으면 "첫 번째 사진"이라는 암묵 규칙만 남아, 사용자가 대표를 고를 수
    # 없고 순서를 바꿀 때마다 대표가 따라 움직인다.
    is_cover: Mapped[bool] = mapped_column(nullable=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    __table_args__ = (
        # 일기를 열 때마다 그 일정의 사진을 순서대로 가져오므로 정렬까지 인덱스로 처리한다.
        Index("ix_nl_diary_photos_schedule_order", "schedule_id", "sort_order"),
        # 사용자 탈퇴 시 업로드한 사진을 찾는 데 쓴다.
        Index("ix_nl_diary_photos_uploader_id", "uploader_id"),
        # 대표 사진은 하루에 하나뿐이다. 애플리케이션에서만 지키면 동시 요청에 둘이 될 수
        # 있어 부분 유니크 인덱스로 DB가 보장한다.
        Index(
            "uq_nl_diary_photos_cover",
            "schedule_id",
            unique=True,
            postgresql_where=text("is_cover"),
        ),
    )

    schedule: Mapped["Schedule"] = relationship(back_populates="diary_photos")
    uploader: Mapped["User"] = relationship()


class DiaryTimelineItem(Base):
    """실제로 어디를 언제 다녀왔는지 사용자가 직접 남기는 항목.

    위치 권한 없이 만들고 고칠 수 있어야 하며, 일정에 등록하지 않은 장소나 장소가 아닌
    활동("점심 먹기")도 남길 수 있어야 한다. 그래서 schedule_place_id가 nullable이고
    title을 따로 받는다 (docs/DEVELOPMENT_BRIEF.md 9절).
    """

    __tablename__ = "nl_diary_timeline"

    id: Mapped[int] = mapped_column(primary_key=True)
    schedule_id: Mapped[int] = mapped_column(ForeignKey("nl_schedules.id", ondelete="CASCADE"), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(nullable=False)
    # 일정에 담아둔 장소와 연결됐으면 그 항목을 가리킨다. 나중에 그 장소를 일정에서 빼도
    # "그날 거기 갔다"는 사실은 남아야 하므로 SET NULL이다.
    schedule_place_id: Mapped[int | None] = mapped_column(
        ForeignKey("nl_schedule_places.id", ondelete="SET NULL")
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    memo: Mapped[str | None] = mapped_column(Text)
    # 같은 시각의 항목이 여럿일 때 순서를 안정적으로 유지한다.
    sort_order: Mapped[int] = mapped_column(nullable=False, server_default="0")
    created_by: Mapped[int] = mapped_column(ForeignKey("nl_users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        # 하루의 타임라인을 시간순으로 읽는 것이 유일한 주 질의다.
        Index("ix_nl_diary_timeline_schedule_time", "schedule_id", "occurred_at", "sort_order"),
        Index("ix_nl_diary_timeline_created_by", "created_by"),
    )

    schedule: Mapped["Schedule"] = relationship(back_populates="diary_timeline")
    schedule_place: Mapped["SchedulePlace | None"] = relationship()
    created_by_user: Mapped["User"] = relationship()
