"""업로드 사진의 썸네일 생성.

목록 화면은 카드 크기로 줄여 보여주는데, 썸네일이 없으면 응답이 원본 URL을 대신
담는다(app/schedules/service.py). 그러면 기록 탭을 넘길 때마다 폰 카메라 원본을
그대로 내려받게 된다. 장당 수 MB라 한 화면에 수십 MB가 나간다.

여기서 만든 썸네일은 **원본을 대체하지 않는다.** 원본은 그대로 두고 목록용 사본을
하나 더 둘 뿐이다. 사진을 크게 볼 때는 원본이 필요하다.
"""

import io

from PIL import Image, ImageOps, UnidentifiedImageError

# 긴 변 기준 최대 길이. 기록 카드와 상세 그리드가 쓰는 크기의 2배쯤이라
# 고해상도 화면에서도 뭉개지지 않는다.
THUMBNAIL_MAX_EDGE = 640

# JPEG 품질. 80 아래로는 사진의 하늘·피부 같은 완만한 영역에 띠가 보이기 시작한다.
THUMBNAIL_QUALITY = 80

# 썸네일은 항상 JPEG으로 만든다. 원본이 PNG든 WEBP든 상관없다.
# 목록용 사진에 투명 배경이 필요한 경우가 없고, JPEG이 모든 기기에서 열린다.
THUMBNAIL_EXTENSION = "jpg"


def thumbnail_key_for(storage_key: str) -> str:
    """원본 키에서 썸네일 키를 만든다.

    :param storage_key: 원본 저장 키 (`diaries/12/abc.jpg`)
    :return: 썸네일 저장 키 (`diaries/12/abc_thumb.jpg`)

    원본 옆에 나란히 두면 일정별 폴더 하나만 지워도 둘 다 정리된다. 이름만 보고
    어느 원본의 썸네일인지 알 수 있어야 나중에 백필이나 정리 작업이 쉽다.
    """
    base = storage_key.rsplit(".", 1)[0]
    return f"{base}_thumb.{THUMBNAIL_EXTENSION}"


def make_thumbnail(content: bytes) -> bytes | None:
    """사진 바이트에서 썸네일 JPEG을 만든다.

    :param content: 업로드된 원본 바이트
    :return: 썸네일 JPEG 바이트. 만들 수 없으면 None

    **실패를 예외로 올리지 않고 None을 돌려준다.** 썸네일은 있으면 빠른 부가 기능이지,
    없다고 업로드가 실패해야 할 이유가 없다. 호출하는 쪽은 None이면 `thumbnail_key`를
    비워 두고, 응답은 원본 URL로 대신한다 — 썸네일이 붙기 전과 똑같이 동작한다.

    None이 되는 경우는 셋이다.

    1. **HEIC** — 아이폰 원본 형식이다. Pillow가 기본 설치로는 못 읽는다. 업로드는
       계속 받으므로 사진이 사라지지는 않고, 목록에서 원본을 쓸 뿐이다.
    2. **손상된 파일** — 앞부분 시그니처는 맞는데 내용이 깨진 경우
    3. **지나치게 큰 이미지** — Pillow가 압축 폭탄으로 판단해 거절한다. 픽셀 수만
       키운 파일로 서버 메모리를 고갈시키는 공격을 막는 기본 방어다
    """
    try:
        with Image.open(io.BytesIO(content)) as image:
            # EXIF의 회전 정보를 픽셀에 실제로 반영한다. 이걸 빼면 폰으로 세로로 찍은
            # 사진이 목록에서 눕는다 — 원본 뷰어는 EXIF를 읽지만 썸네일에는 그 정보를
            # 남기지 않기 때문이다.
            image = ImageOps.exif_transpose(image)

            # JPEG은 알파 채널과 팔레트 모드를 저장할 수 없다. PNG·WEBP 원본이
            # 그대로 들어오면 저장 단계에서 터진다.
            if image.mode not in ("RGB", "L"):
                image = image.convert("RGB")

            # 비율을 유지하며 긴 변을 맞춘다. 원본이 이미 더 작으면 그대로 둔다.
            image.thumbnail((THUMBNAIL_MAX_EDGE, THUMBNAIL_MAX_EDGE), Image.LANCZOS)

            buffer = io.BytesIO()
            # EXIF를 일부러 옮기지 않는다. 촬영 위치·기기 정보가 목록 썸네일까지
            # 따라다닐 이유가 없다. 회전은 위에서 이미 픽셀에 반영했다.
            image.save(buffer, format="JPEG", quality=THUMBNAIL_QUALITY, optimize=True)
            thumbnail = buffer.getvalue()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        return None

    # 작은 원본은 썸네일이 더 커질 수 있다. 그때는 만들지 않는다. 저장 공간과 요청이
    # 하나씩 늘기만 하고 얻는 게 없다.
    if len(thumbnail) >= len(content):
        return None

    return thumbnail
