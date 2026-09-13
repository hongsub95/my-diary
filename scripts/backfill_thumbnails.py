"""이미 올라간 사진의 썸네일을 만든다.

프로젝트 루트에서 실행한다.

    python -m scripts.backfill_thumbnails --dry-run   # 무엇을 만들지만 확인
    python -m scripts.backfill_thumbnails             # 실제로 만들고 DB에 기록

썸네일 생성이 붙기 전에 올라간 사진은 `thumbnail_key`가 비어 있어서 목록이 원본을
그대로 내려받는다. 이 스크립트는 그 행들만 찾아 썸네일을 만들어 채운다.

**여러 번 돌려도 안전하다.** 이미 채워진 행은 건너뛰고, 만들지 못한 행은 다음 실행에서
다시 시도한다. 원본은 읽기만 한다.
"""

import argparse

from sqlalchemy import select

# 모델을 전부 불러와야 SQLAlchemy가 관계를 해석할 수 있다. DiaryPhoto만 import하면
# 다른 모델을 가리키는 relationship이 이름을 찾지 못해 매퍼 초기화가 실패한다.
# alembic/env.py도 같은 이유로 이 모듈을 부른다.
from app import models as _models  # noqa: F401
from app.core.database import SessionLocal
from app.core.images import make_thumbnail, thumbnail_key_for
from app.core.storage import get_storage
from app.diaries.models import DiaryPhoto


def main() -> int:
    parser = argparse.ArgumentParser(description="기존 사진의 썸네일을 생성한다.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="실제로 저장하지 않고 대상 수만 센다.",
    )
    args = parser.parse_args()

    storage = get_storage()
    created = skipped = failed = 0

    with SessionLocal() as db:
        photos = list(
            db.scalars(
                select(DiaryPhoto).where(DiaryPhoto.thumbnail_key.is_(None)).order_by(DiaryPhoto.id)
            ).all()
        )
        print(f"대상 {len(photos)}장")

        for photo in photos:
            # 파일이 사라진 사진이 있을 수 있다. 한 장 때문에 전체가 멈추면 안 되므로
            # 실패를 세고 다음으로 넘어간다.
            try:
                content = storage.read(photo.storage_key)
            except (OSError, NotImplementedError) as error:
                print(f"  #{photo.id} 원본을 읽지 못함: {error}")
                failed += 1
                continue

            thumbnail = make_thumbnail(content)
            if thumbnail is None:
                # HEIC이거나 이미 충분히 작은 사진이다. 원본으로 계속 쓰면 되므로
                # 실패가 아니다.
                skipped += 1
                continue

            key = thumbnail_key_for(photo.storage_key)
            if args.dry_run:
                print(f"  #{photo.id} → {key} ({len(content):,} → {len(thumbnail):,} 바이트)")
                created += 1
                continue

            storage.save(key, thumbnail)
            photo.thumbnail_key = key
            created += 1

        if not args.dry_run:
            # 한 번에 커밋한다. 중간에 끊기면 파일만 남고 DB는 비어 있는데, 다시 돌리면
            # 같은 키로 덮어쓰므로 상태가 어긋나지 않는다.
            db.commit()

    label = "만들 예정" if args.dry_run else "생성"
    print(f"{label} {created}장 / 건너뜀 {skipped}장 / 실패 {failed}장")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
