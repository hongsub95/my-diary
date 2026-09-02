"""일기 API의 요청/응답 스키마."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.storage import build_media_url
from app.diaries.models import DiaryPhoto

# 기분은 짧은 라벨이나 이모지를 상정한다. 모델의 String(20)과 같은 값이어야 한다.
MAX_MOOD_LENGTH = 20


class DiaryEntryUpsertRequest(BaseModel):
    """본문 작성/수정 요청.

    생성과 수정을 나누지 않고 PUT 하나로 받는다. 작성자당 본문이 하나뿐이라
    클라이언트가 "내가 이미 썼나"를 먼저 확인할 필요가 없다 (docs/API_SPEC.md 7장).
    """

    content: str = Field(min_length=1)
    mood: str | None = Field(default=None, max_length=MAX_MOOD_LENGTH)

    @field_validator("content")
    @classmethod
    def validate_content_not_blank(cls, value: str) -> str:
        """공백만 있는 본문을 거르고 앞뒤 공백을 제거한다.

        본문 항목은 글이 있을 때만 존재해야 한다. 공백만 저장하면 화면에는 빈 일기가
        보이는데 "기록이 있는 하루"로 집계돼, 사진만 남긴 하루와 구분되지 않는다.
        """
        stripped = value.strip()
        if not stripped:
            raise ValueError("일기 내용을 입력해 주세요.")
        return stripped

    @field_validator("mood")
    @classmethod
    def validate_mood_not_blank(cls, value: str | None) -> str | None:
        """공백만 보낸 기분은 비운 것으로 본다."""
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class DiaryAuthorResponse(BaseModel):
    """일기 작성자 표시용 최소 정보. 이메일은 담지 않는다.

    같은 스페이스 멤버라도 서로의 이메일을 알 필요는 없다 (일정 응답과 같은 규칙).
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    nickname: str


class DiaryEntryResponse(BaseModel):
    """작성자 한 사람의 본문."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    schedule_id: int
    author: DiaryAuthorResponse
    content: str
    mood: str | None
    created_at: datetime
    updated_at: datetime


class DiaryEntryListResponse(BaseModel):
    """한 일정에 달린 작성자별 본문 전체.

    다인 스페이스에서는 같이 보낸 하루를 각자 쓴 글이 나란히 놓인다. 활성 멤버는 서로의
    본문을 모두 볼 수 있다 (docs/SPACE_MODEL_SPEC.md 16절).
    """

    items: list[DiaryEntryResponse]


class DiaryPhotoResponse(BaseModel):
    """사진 한 장.

    DB에는 저장 키만 있고 응답에는 전체 URL을 담는다. 클라이언트는 저장소가 로컬인지
    S3인지 알 필요가 없다 (docs/API_SPEC.md 7장).
    """

    id: int
    schedule_id: int
    uploader: DiaryAuthorResponse
    file_url: str
    # 아직 썸네일을 만들지 않아 항상 null이다. 화면은 이 값이 없으면 file_url을 쓴다.
    thumbnail_url: str | None
    sort_order: int
    is_cover: bool
    created_at: datetime

    @classmethod
    def from_photo(cls, photo: DiaryPhoto) -> "DiaryPhotoResponse":
        """DiaryPhoto 모델을 응답으로 바꾼다.

        :param photo: uploader가 로드된 사진

        model_validate를 그대로 쓰지 않는 이유: 저장 키를 URL로 바꾸는 변환이 필요하고,
        그 규칙을 화면마다 반복하지 않도록 한곳에 모은다.
        """
        return cls(
            id=photo.id,
            schedule_id=photo.schedule_id,
            uploader=DiaryAuthorResponse.model_validate(photo.uploader),
            file_url=build_media_url(photo.storage_key),
            thumbnail_url=build_media_url(photo.thumbnail_key),
            sort_order=photo.sort_order,
            is_cover=photo.is_cover,
            created_at=photo.created_at,
        )


class DiaryPhotoListResponse(BaseModel):
    """일정의 사진 목록. sort_order 오름차순이다."""

    photos: list[DiaryPhotoResponse]


class DiaryPhotoReorderRequest(BaseModel):
    """사진 순서 일괄 변경과 대표 사진 지정.

    개별 sort_order를 하나씩 보내면 중간 상태가 꼬이므로 전체를 한 번에 받는다.
    장소 순서 변경과 같은 규칙이다 (docs/API_SPEC.md 6.4절).
    """

    schedule_id: int
    photo_ids: list[int] = Field(min_length=1)
    # 대표 사진. null이면 지정을 없애고 맨 앞 사진이 대표가 된다.
    cover_photo_id: int | None = None
