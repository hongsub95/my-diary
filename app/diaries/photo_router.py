"""일기 사진 엔드포인트.

경로가 두 갈래다.

- `/schedules/{schedule_id}/diary/photos` — 업로드·목록. 어느 하루인지 경로가 말해준다.
- `/diary-photos/...` — 개별 사진 삭제와 순서 변경. 사진 id만으로 찾는다.

뒤쪽 경로에는 일정이 드러나지 않아 권한 검사를 여기서 직접 한다. 사진 → 일정 →
스페이스 멤버십 순으로 거슬러 올라가며, 볼 수 없는 사진은 없는 것과 같은 404를 준다.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, File, Path, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.auth.dependencies import CurrentUser, DbSession
from app.diaries import photo_service
from app.diaries.errors import DiaryPhotoNotFoundError
from app.diaries.models import DiaryPhoto
from app.diaries.schemas import (
    DiaryPhotoListResponse,
    DiaryPhotoReorderRequest,
    DiaryPhotoResponse,
)
from app.schedules.dependencies import ScheduleMemberContext
from app.schedules.models import Schedule
from app.spaces.dependencies import get_active_membership

schedule_photos_router = APIRouter(prefix="/schedules/{schedule_id}/diary", tags=["diary-photos"])
photos_router = APIRouter(prefix="/diary-photos", tags=["diary-photos"])


class PhotoContext:
    """권한 검사를 통과한 요청의 사진 정보 묶음."""

    def __init__(self, photo: DiaryPhoto, membership) -> None:
        self.photo = photo
        self.membership = membership


def require_photo_member(
    photo_id: Annotated[int, Path(description="사진 id")],
    current_user: CurrentUser,
    db: DbSession,
) -> PhotoContext:
    """사진을 찾고 요청자가 그 일정이 속한 스페이스의 활성 멤버인지 확인한다.

    :raises DiaryPhotoNotFoundError: 없거나 볼 수 없을 때 (둘을 구분하지 않는다)
    """
    photo = db.scalar(
        select(DiaryPhoto)
        .options(joinedload(DiaryPhoto.uploader), joinedload(DiaryPhoto.schedule).joinedload(Schedule.space))
        .where(DiaryPhoto.id == photo_id)
    )
    if photo is None:
        raise DiaryPhotoNotFoundError()

    membership = get_active_membership(db, photo.schedule.space, current_user.id)
    if membership is None:
        raise DiaryPhotoNotFoundError()

    return PhotoContext(photo, membership)


PhotoMemberContext = Annotated[PhotoContext, Depends(require_photo_member)]


@schedule_photos_router.post(
    "/photos",
    response_model=DiaryPhotoListResponse,
    status_code=status.HTTP_201_CREATED,
    summary="사진 업로드",
    description=(
        "`multipart/form-data`로 사진을 올린다. 필드명은 `files`이며 여러 장을 한 번에 "
        "보낼 수 있다. 일기 본문이 없어도 사진만 올릴 수 있다. "
        "응답은 이번에 올린 사진만 담는다."
    ),
)
def upload_photos(
    context: ScheduleMemberContext,
    current_user: CurrentUser,
    db: DbSession,
    files: Annotated[list[UploadFile], File(description="이미지 파일. 여러 장 가능")],
) -> DiaryPhotoListResponse:
    """사진 업로드. 크기·형식·장수 검사를 모두 통과해야 한 장이라도 저장된다."""
    # 파일을 미리 읽어 서비스에 넘긴다. 서비스가 UploadFile을 몰라야 저장소 교체나
    # 테스트에서 다루기 쉽다.
    payload = [(file.filename, file.file.read()) for file in files]
    saved = photo_service.add_photos(db, context.schedule, current_user, payload)
    return DiaryPhotoListResponse(photos=[DiaryPhotoResponse.from_photo(photo) for photo in saved])


@schedule_photos_router.get(
    "/photos",
    response_model=DiaryPhotoListResponse,
    summary="사진 목록",
    description="이 하루의 사진을 표시 순서대로 돌려준다. 작성자 구분 없이 공용이다.",
)
def list_photos(context: ScheduleMemberContext, db: DbSession) -> DiaryPhotoListResponse:
    """사진 목록 조회."""
    photos = photo_service.list_photos(db, context.schedule)
    return DiaryPhotoListResponse(photos=[DiaryPhotoResponse.from_photo(photo) for photo in photos])


@photos_router.patch(
    "/reorder",
    response_model=DiaryPhotoListResponse,
    summary="사진 순서 변경과 대표 사진 지정",
    description=(
        "그 일정의 사진 **전체**를 원하는 순서대로 보낸다. 부분 목록은 422다. "
        "`cover_photo_id`로 대표 사진을 정하며, null이면 지정을 없애고 맨 앞 사진이 대표가 된다."
    ),
)
def reorder_photos(
    payload: DiaryPhotoReorderRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> DiaryPhotoListResponse:
    """사진 순서 변경. 대상 일정은 본문의 schedule_id로 지정한다."""
    # 이 경로에는 일정이 드러나지 않아 본문으로 받는다. 권한은 일정 기준으로 검사한다.
    schedule = db.scalar(
        select(Schedule).options(joinedload(Schedule.space)).where(Schedule.id == payload.schedule_id)
    )
    if schedule is None or get_active_membership(db, schedule.space, current_user.id) is None:
        raise DiaryPhotoNotFoundError()

    photos = photo_service.reorder_photos(db, schedule, payload.photo_ids, payload.cover_photo_id)
    return DiaryPhotoListResponse(photos=[DiaryPhotoResponse.from_photo(photo) for photo in photos])


@photos_router.delete(
    "/{photo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="사진 삭제",
    description="업로더와 스페이스 owner만 지울 수 있다. 그 외에는 403이다.",
)
def delete_photo(context: PhotoMemberContext, current_user: CurrentUser, db: DbSession) -> None:
    """사진 삭제."""
    photo_service.ensure_can_delete(context.photo, context.membership, current_user)
    photo_service.delete_photo(db, context.photo)
    return None
