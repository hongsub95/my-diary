"""일기 사진 로직.

사진은 작성자별 본문이 아니라 **일정에 직접 달린다.** 같이 보낸 하루의 사진은 공용이고,
그날을 어떻게 느꼈는지만 각자 쓴다 (docs/API_SPEC.md 7장).

접근 권한은 이 모듈이 판단하지 않는다. 라우터가 일정 단위로 이미 확인한다. 예외는
삭제 권한 하나뿐이다.
"""

import uuid as uuid_module

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.storage import get_storage
from app.diaries.errors import (
    FileTooLargeError,
    InvalidPhotoReorderError,
    PhotoDeleteForbiddenError,
    PhotoLimitExceededError,
    UnsupportedFileTypeError,
)
from app.diaries.models import DiaryPhoto
from app.schedules.models import Schedule
from app.spaces.models import SPACE_ROLE_OWNER, SpaceMember
from app.users.models import User

# 제한값. docs/API_SPEC.md 7장의 표와 같아야 한다.
MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_FILES_PER_REQUEST = 10
MAX_PHOTOS_PER_SCHEDULE = 30
# 파일 앞부분의 시그니처로 실제 형식을 판별한다. Content-Type 헤더는 클라이언트가
# 그대로 지어 보낼 수 있어서, 헤더만 믿으면 이미지가 아닌 파일이 저장된다.
#
# 바이트열을 이스케이프 문자 대신 hex로 적는다. 눈으로 확인하기 쉽고 편집 중에
# 이스케이프가 깨질 여지가 없다.
_JPEG_PREFIX = bytes.fromhex("ffd8ff")
_PNG_PREFIX = bytes.fromhex("89504e470d0a1a0a")

# heic 컨테이너의 브랜드 값. 아이폰 사진이 여기에 해당한다.
_HEIC_BRANDS = (b"heic", b"heix", b"hevc", b"mif1")


def _detect_extension(content: bytes) -> str | None:
    """파일 내용으로 확장자를 알아낸다. 지원하지 않는 형식이면 None.

    :param content: 업로드된 파일의 전체 바이트

    webp와 heic는 앞 4바이트만으로는 알 수 없고 컨테이너 안쪽을 봐야 한다.
    - webp: "RIFF" + 4바이트 크기 + "WEBP"
    - heic: 4바이트 크기 + "ftyp" + 브랜드
    """
    if content.startswith(_JPEG_PREFIX):
        return "jpg"
    if content.startswith(_PNG_PREFIX):
        return "png"
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "webp"
    if content[4:8] == b"ftyp" and content[8:12] in _HEIC_BRANDS:
        return "heic"
    return None

def _next_sort_order(db: Session, schedule: Schedule) -> int:
    """새 사진이 붙을 자리. 항상 맨 뒤다."""
    last = db.scalar(
        select(func.max(DiaryPhoto.sort_order)).where(DiaryPhoto.schedule_id == schedule.id)
    )
    return 0 if last is None else last + 1


def count_photos(db: Session, schedule: Schedule) -> int:
    """이 일정에 담긴 사진 수."""
    return db.scalar(
        select(func.count(DiaryPhoto.id)).where(DiaryPhoto.schedule_id == schedule.id)
    ) or 0


def add_photos(
    db: Session, schedule: Schedule, user: User, files: list[tuple[str | None, bytes]]
) -> list[DiaryPhoto]:
    """사진을 저장하고 DB에 등록한다.

    :param files: (원본 파일명, 내용) 목록. 파일명은 로그용이며 저장 키에는 쓰지 않는다
    :raises PhotoLimitExceededError: 1회 또는 하루 총 장수 제한 초과
    :raises FileTooLargeError: 장당 크기 초과
    :raises UnsupportedFileTypeError: 이미지가 아니거나 지원하지 않는 형식

    검사를 모두 끝낸 뒤에 저장을 시작한다. 한 장씩 검사하며 저장하면, 마지막 장이
    형식 위반일 때 앞의 몇 장만 올라간 어중간한 상태가 남는다.

    본문이 없어도 사진만 올릴 수 있다. 사진은 일정에 직접 달리므로 빈 본문 행을 미리
    만들 필요가 없다.
    """
    if len(files) > MAX_FILES_PER_REQUEST:
        raise PhotoLimitExceededError(f"한 번에 최대 {MAX_FILES_PER_REQUEST}장까지 올릴 수 있습니다.")

    already = count_photos(db, schedule)
    if already + len(files) > MAX_PHOTOS_PER_SCHEDULE:
        raise PhotoLimitExceededError(
            f"하루에 최대 {MAX_PHOTOS_PER_SCHEDULE}장까지 담을 수 있습니다. "
            f"현재 {already}장이 있습니다."
        )

    prepared: list[tuple[str, bytes]] = []
    for _, content in files:
        if len(content) > MAX_FILE_BYTES:
            raise FileTooLargeError(MAX_FILE_BYTES)
        extension = _detect_extension(content)
        if extension is None:
            raise UnsupportedFileTypeError()
        # 저장 키에 원본 파일명을 쓰지 않는다. 한글·공백·경로 문자가 들어오면 저장소마다
        # 다르게 처리되고, 같은 이름을 올리면 덮어쓰게 된다.
        prepared.append((f"diaries/{schedule.id}/{uuid_module.uuid4().hex}.{extension}", content))

    storage = get_storage()
    sort_order = _next_sort_order(db, schedule)
    saved: list[DiaryPhoto] = []

    for index, (key, content) in enumerate(prepared):
        storage.save(key, content)
        photo = DiaryPhoto(
            schedule_id=schedule.id,
            uploader_id=user.id,
            storage_key=key,
            # 썸네일은 아직 만들지 않는다. 화면은 이 값이 비어 있으면 원본을 쓴다.
            thumbnail_key=None,
            sort_order=sort_order + index,
        )
        db.add(photo)
        saved.append(photo)

    db.commit()
    for photo in saved:
        db.refresh(photo)
    return saved


def ensure_can_delete(photo: DiaryPhoto, membership: SpaceMember, user: User) -> None:
    """사진을 지울 권한이 있는지 확인한다.

    :raises PhotoDeleteForbiddenError: 남이 올린 사진을 일반 멤버가 지우려 할 때

    업로더와 스페이스 owner만 지울 수 있다 (docs/UX_BACKEND_HANDOFF.md 7절).
    일정 삭제 권한과 같은 규칙이다.
    """
    if membership.role == SPACE_ROLE_OWNER:
        return
    if photo.uploader_id == user.id:
        return
    raise PhotoDeleteForbiddenError()


def delete_photo(db: Session, photo: DiaryPhoto) -> None:
    """사진을 지운다. DB 행을 먼저 지우고 파일을 지운다.

    순서를 이렇게 두는 이유: 파일을 먼저 지우고 DB 커밋이 실패하면 "행은 있는데 파일이
    없는" 상태가 되어 화면에 깨진 이미지가 남는다. 반대 순서면 최악의 경우 주인 없는
    파일이 남을 뿐이라 사용자에게 보이지 않는다.
    """
    key = photo.storage_key
    db.delete(photo)
    db.commit()
    get_storage().delete(key)


def list_photos(db: Session, schedule: Schedule) -> list[DiaryPhoto]:
    """이 일정의 사진을 표시 순서대로 돌려준다."""
    return list(
        db.scalars(
            select(DiaryPhoto)
            .where(DiaryPhoto.schedule_id == schedule.id)
            # sort_order가 같으면(동시 업로드) id로 안정적으로 정렬한다.
            .order_by(DiaryPhoto.sort_order, DiaryPhoto.id)
        ).all()
    )


def reorder_photos(
    db: Session, schedule: Schedule, photo_ids: list[int], cover_photo_id: int | None
) -> list[DiaryPhoto]:
    """사진 순서를 한 번에 바꾸고 대표 사진을 정한다.

    :param photo_ids: 이 일정의 사진 **전체**를 원하는 순서대로 담은 목록
    :param cover_photo_id: 대표로 쓸 사진. None이면 지정을 없애고 맨 앞 사진이 대표가 된다
    :raises InvalidPhotoReorderError: 목록이 이 일정의 사진 전체와 일치하지 않을 때
    """
    photos = {photo.id: photo for photo in list_photos(db, schedule)}

    if set(photo_ids) != set(photos) or len(photo_ids) != len(photos):
        raise InvalidPhotoReorderError("이 일정의 사진 전체를 한 번에 보내야 합니다.")
    if cover_photo_id is not None and cover_photo_id not in photos:
        raise InvalidPhotoReorderError("대표 사진이 이 일정의 사진이 아닙니다.")

    for index, photo_id in enumerate(photo_ids):
        photo = photos[photo_id]
        photo.sort_order = index
        # 대표는 하루에 하나뿐이다. DB에도 부분 유니크 인덱스가 걸려 있어, 여기서 전부
        # 내렸다 하나만 올리지 않으면 무결성 오류가 난다.
        photo.is_cover = photo.id == cover_photo_id

    db.commit()
    return list_photos(db, schedule)
