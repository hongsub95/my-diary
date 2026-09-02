"""업로드 파일 저장소 어댑터.

로컬 개발은 서버 디스크, 실서버는 S3를 쓴다. 어느 쪽이든 **API 응답 형태는 같아야
하므로** 저장 위치를 아는 코드를 이 파일에 가둔다 (docs/API_SPEC.md 7장).

DB에는 전체 URL이 아니라 **저장 키**만 담는다. 전체 URL을 넣으면 S3로 옮기는 순간
기존 사진 행이 전부 잘못된 주소를 가리키게 된다. 키만 저장하고 응답을 만들 때 현재
저장소의 base URL을 붙이면 DB는 손댈 필요가 없다.

업로드는 클라이언트 → 백엔드 → 저장소 순서로 서버를 경유한다. S3 presigned URL로
직접 올리면 로컬과 실서버의 프론트엔드 흐름이 달라져(URL 발급 → 직접 업로드 2단계)
개발용과 실서버용 코드를 따로 관리해야 한다.
"""

from pathlib import Path
from typing import Protocol

from app.core.config import get_settings

settings = get_settings()


class FileStorage(Protocol):
    """저장소가 만족해야 하는 인터페이스."""

    def save(self, key: str, content: bytes) -> None:
        """키에 해당하는 위치에 파일을 쓴다. 같은 키가 있으면 덮어쓴다."""
        ...

    def delete(self, key: str) -> None:
        """파일을 지운다. 이미 없으면 조용히 넘어간다.

        없는 파일에 오류를 내지 않는 이유: DB 행은 지웠는데 파일 삭제만 실패하면
        사용자에게는 "지웠는데 오류"로 보인다. 재시도해도 같은 상태가 되어야 한다.
        """
        ...


class LocalFileStorage:
    """서버 디스크에 저장한다. 로컬 개발용이다."""

    def __init__(self, base_dir: str) -> None:
        self._base = Path(base_dir)

    def _path(self, key: str) -> Path:
        return self._base / key

    def save(self, key: str, content: bytes) -> None:
        path = self._path(key)
        # 키에 하위 경로(diaries/12/…)가 들어 있으므로 디렉터리를 먼저 만든다.
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)


class S3FileStorage:
    """AWS S3에 저장한다. 실서버용이며 아직 구현하지 않았다.

    붙일 때 할 일: boto3를 requirements에 추가하고 save/delete를 put_object/delete_object로
    구현한다. 라우터와 서비스는 이 인터페이스만 알고 있어 고칠 필요가 없다.
    """

    def save(self, key: str, content: bytes) -> None:
        raise NotImplementedError("S3 저장소는 아직 구현되지 않았습니다. STORAGE_BACKEND=local을 사용하세요.")

    def delete(self, key: str) -> None:
        raise NotImplementedError("S3 저장소는 아직 구현되지 않았습니다. STORAGE_BACKEND=local을 사용하세요.")


def get_storage() -> FileStorage:
    """설정값에 맞는 저장소를 돌려준다.

    매번 새로 만들어도 되는 가벼운 객체라 캐시하지 않는다. 테스트가 설정을 바꿔 끼울
    때도 이전 인스턴스가 남지 않는다.
    """
    if settings.is_local_storage:
        return LocalFileStorage(settings.upload_dir)
    return S3FileStorage()


def build_media_url(key: str | None) -> str | None:
    """저장 키를 클라이언트가 바로 쓸 수 있는 URL로 바꾼다.

    :param key: DB에 저장된 키. 썸네일처럼 아직 없는 값이면 None
    :return: 전체 URL. key가 None이면 None

    None을 그대로 돌려주는 이유: 썸네일은 아직 생성하지 않아 항상 비어 있다. 화면은
    thumbnail_url이 null이면 원본(file_url)을 대신 쓰기로 되어 있다.
    """
    if key is None:
        return None
    return f"{settings.media_base_url.rstrip('/')}/{key}"
