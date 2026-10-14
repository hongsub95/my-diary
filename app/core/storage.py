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

from functools import lru_cache
from pathlib import Path
from typing import Protocol

import boto3
from botocore.client import BaseClient

from app.core.config import get_settings

settings = get_settings()


class FileStorage(Protocol):
    """저장소가 만족해야 하는 인터페이스."""

    def save(self, key: str, content: bytes) -> None:
        """키에 해당하는 위치에 파일을 쓴다. 같은 키가 있으면 덮어쓴다."""
        ...

    def read(self, key: str) -> bytes:
        """저장된 파일을 읽는다. 없으면 FileNotFoundError.

        업로드 경로에는 필요 없다. 이미 올라간 사진에서 썸네일을 만드는 백필
        (scripts/backfill_thumbnails.py)처럼 저장된 원본을 다시 봐야 할 때 쓴다.
        """
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

    def read(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)


class S3FileStorage:
    """AWS S3에 저장한다. 실서버용이다.

    :param bucket: 버킷 이름
    :param client: boto3 S3 클라이언트. 테스트는 botocore Stubber를 붙인 클라이언트를 넣는다

    사진은 버킷에서 바로 내려받는다(MEDIA_BASE_URL이 버킷 또는 CloudFront 주소).
    읽기 공개 설정은 코드가 아니라 버킷 정책·CloudFront가 맡는다
    (docs/DEPLOYMENT_CHECKLIST.md 1.1).
    """

    def __init__(self, bucket: str, client: BaseClient) -> None:
        self._bucket = bucket
        self._client = client

    def save(self, key: str, content: bytes) -> None:
        self._client.put_object(
            Bucket=self._bucket,
            Key=key,
            Body=content,
            # 지정하지 않으면 S3는 application/octet-stream으로 내보내고, 브라우저가 주소를
            # 직접 열 때 사진을 보여주는 대신 파일로 내려받는다.
            ContentType=_content_type(key),
            # 키에 uuid가 들어 있어 같은 키에 다른 내용이 올라오는 일이 없다. 그래서 한 번
            # 받은 사진은 다시 확인하지 않고 캐시를 써도 된다 — 목록을 넘길 때마다 같은
            # 사진을 다시 받지 않는다.
            CacheControl="public, max-age=31536000, immutable",
        )

    def read(self, key: str) -> bytes:
        try:
            response = self._client.get_object(Bucket=self._bucket, Key=key)
        except self._client.exceptions.NoSuchKey as error:
            # 로컬 저장소와 같은 예외로 맞춘다. 백필 스크립트가 저장소 종류를 모르고
            # FileNotFoundError만 잡는다.
            raise FileNotFoundError(key) from error
        return response["Body"].read()

    def delete(self, key: str) -> None:
        # S3의 delete_object는 없는 키여도 성공한다. 인터페이스가 요구하는 "이미 없으면
        # 조용히 넘어간다"를 따로 처리하지 않아도 된다.
        self._client.delete_object(Bucket=self._bucket, Key=key)


# 확장자 → Content-Type. 업로드가 허용하는 형식(photo_service._detect_extension)과
# 썸네일(jpg)만 있으면 된다. mimetypes 모듈은 OS마다 등록된 표가 달라 heic를 모를 수 있다.
_CONTENT_TYPES = {
    "jpg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
    "heic": "image/heic",
}


def _content_type(key: str) -> str:
    """저장 키의 확장자로 Content-Type을 정한다. 모르는 확장자면 octet-stream."""
    extension = key.rsplit(".", 1)[-1].lower()
    return _CONTENT_TYPES.get(extension, "application/octet-stream")


@lru_cache
def _s3_client() -> BaseClient:
    """S3 클라이언트를 한 번만 만든다.

    저장소 객체와 달리 클라이언트는 캐시한다. 만들 때 서비스 정의를 읽고 연결 풀을
    준비해서, 사진 요청마다 새로 만들면 요청이 눈에 띄게 느려진다.

    접근 키가 비어 있으면 boto3 기본 경로(EC2 IAM 역할 등)로 자격 증명을 찾는다.
    서버에 키를 파일로 두지 않는 쪽이 안전해서 실서버는 IAM 역할을 권장한다.
    """
    credentials = {}
    if settings.aws_access_key_id:
        credentials = {
            "aws_access_key_id": settings.aws_access_key_id,
            "aws_secret_access_key": settings.aws_secret_access_key.get_secret_value(),
        }
    return boto3.client("s3", region_name=settings.aws_region, **credentials)


def get_storage() -> FileStorage:
    """설정값에 맞는 저장소를 돌려준다.

    저장소 객체는 가벼워서 캐시하지 않는다. 테스트가 설정을 바꿔 끼울 때도 이전
    인스턴스가 남지 않는다. 무거운 S3 클라이언트만 따로 캐시한다.
    """
    if settings.is_local_storage:
        return LocalFileStorage(settings.upload_dir)
    return S3FileStorage(settings.aws_s3_bucket_name, _s3_client())


def build_media_url(key: str | None) -> str | None:
    """저장 키를 클라이언트가 바로 쓸 수 있는 URL로 바꾼다.

    :param key: DB에 저장된 키. 썸네일을 만들지 못한 사진이면 None
    :return: 전체 URL. key가 None이면 None

    None을 그대로 돌려주는 이유: 썸네일은 만들 수 없는 경우가 있다(HEIC 등,
    app/core/images.py 참고). 화면은 thumbnail_url이 null이면 원본(file_url)을
    대신 쓰기로 되어 있다.
    """
    if key is None:
        return None
    return f"{settings.media_base_url.rstrip('/')}/{key}"
