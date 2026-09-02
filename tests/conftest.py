"""pytest 공용 설정.

테스트는 개발용 DB(nailgi)가 아니라 별도의 테스트 DB(nailgi_test)를 사용한다.
테스트가 개발 중인 데이터를 지우거나 더럽히지 않게 하기 위해서다.

SQLite를 쓰지 않는 이유: 스키마가 PostgreSQL 전용 기능(UUID 타입, gen_random_uuid())을
쓰기 때문에 SQLite에서는 테이블 생성 자체가 실패한다. 운영과 같은 DB로 테스트해야
방언 차이로 인한 버그도 잡을 수 있다.
"""

import os
import shutil
from pathlib import Path

# app.core.config 를 import 하기 전에 APP_ENV를 설정해야 한다.
# config 모듈이 import 시점에 APP_ENV를 읽어 어느 .env 파일을 쓸지 정하기 때문에,
# 나중에 바꾸면 이미 .env.local 을 읽은 뒤라 소용이 없다.
os.environ.setdefault("APP_ENV", "test")

from collections.abc import Generator  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402

import redis as redis_lib  # noqa: E402

from app import models as _models  # noqa: F401,E402  (모든 모델을 메타데이터에 등록)
from app.core.config import get_settings  # noqa: E402
from app.core.database import Base, get_db  # noqa: E402
from app.core.redis_client import get_redis  # noqa: E402
from app.main import app  # noqa: E402


def _test_database_url() -> str:
    """테스트가 사용할 DB 접속 문자열.

    .env.test 의 DATABASE_URL을 그대로 쓴다. 개발용 DB를 실수로 지우는 일이 없도록
    이름이 개발 DB와 다른지 여기서 한 번 더 확인한다.
    """
    url = get_settings().database_url
    if not url.rsplit("/", 1)[-1].endswith("_test"):
        raise RuntimeError(
            f"테스트 DB 이름이 '_test'로 끝나지 않습니다: {url}\n"
            ".env.test 의 DATABASE_URL을 확인하세요. 개발용 DB를 지우는 사고를 막기 위한 검사입니다."
        )
    return url


@pytest.fixture(scope="session")
def test_engine():
    """테스트 세션 전체에서 쓸 엔진. 테스트 DB와 테이블을 만들어 둔다."""
    test_url = _test_database_url()
    test_db_name = test_url.rsplit("/", 1)[-1]

    # CREATE DATABASE는 트랜잭션 안에서 실행할 수 없어 AUTOCOMMIT이 필요하다.
    # 또한 자기 자신에 접속한 채로는 만들 수 없으므로 기본 postgres DB에 붙어서 만든다.
    admin_url = test_url.rpartition("/")[0] + "/postgres"
    admin_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    with admin_engine.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": test_db_name}
        ).scalar()
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{test_db_name}"'))
    admin_engine.dispose()

    engine = create_engine(test_url)
    # 테스트는 alembic을 거치지 않고 모델 메타데이터에서 바로 만든다. 마이그레이션 순서와
    # 무관하게 "현재 모델이 의도한 스키마"를 검증하기 위해서다.
    #
    # drop_all이 아니라 스키마를 통째로 지우는 이유: drop_all은 현재 모델이 아는 테이블만
    # 지우므로, 테이블 이름을 바꾸면 옛 이름의 테이블이 남아 제약조건 이름이 충돌한다.
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    Base.metadata.create_all(bind=engine)

    yield engine

    engine.dispose()


@pytest.fixture
def db_session(test_engine) -> Generator[Session, None, None]:
    """테스트 하나마다 깨끗한 DB 상태를 보장하는 세션.

    각 테스트가 끝나면 모든 테이블을 비운다. 앞 테스트가 만든 사용자가 남아 있으면
    "중복 이메일" 같은 검사가 엉뚱하게 실패하기 때문이다.
    """
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = session_factory()

    yield session

    session.close()
    with test_engine.begin() as conn:
        # RESTART IDENTITY로 id 시퀀스도 1부터 다시 시작시켜 테스트 간 id를 예측 가능하게 만든다.
        table_names = ", ".join(f'"{table}"' for table in reversed(Base.metadata.sorted_tables))
        conn.execute(text(f"TRUNCATE {table_names} RESTART IDENTITY CASCADE"))


@pytest.fixture
def redis_client() -> Generator[redis_lib.Redis, None, None]:
    """테스트용 Redis 클라이언트.

    .env.test가 개발용(0번)과 다른 1번 DB를 가리키므로, 테스트 중 개발하며 로그인해둔
    세션이 지워지지 않는다. 각 테스트 전후로 비워 이전 테스트의 세션이 남지 않게 한다.
    """
    client = redis_lib.Redis.from_url(get_settings().redis_url, decode_responses=True)

    # 개발용 DB를 실수로 비우는 사고를 막는 안전장치.
    if client.connection_pool.connection_kwargs.get("db") == 0:
        raise RuntimeError(
            "테스트가 0번 Redis DB를 가리키고 있습니다. .env.test의 REDIS_URL을 확인하세요.\n"
            "개발 중인 로그인 세션이 모두 지워지는 것을 막기 위한 검사입니다."
        )

    client.flushdb()
    yield client
    client.flushdb()
    client.close()


@pytest.fixture
def client(db_session: Session, redis_client: redis_lib.Redis) -> Generator[TestClient, None, None]:
    """테스트 DB와 테스트 Redis를 바라보는 API 클라이언트.

    앱이 쓰는 get_db / get_redis 의존성을 테스트용으로 갈아끼워, 라우터가 개발용
    저장소 대신 테스트 저장소를 쓰게 만든다.
    """

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    def override_get_redis() -> redis_lib.Redis:
        return redis_client

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_redis] = override_get_redis

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def clean_uploads() -> Generator[None, None, None]:
    """테스트가 올린 파일을 매번 지운다.

    사진 업로드 테스트는 실제 디스크에 파일을 쓴다. 치우지 않으면 uploads_test/에
    계속 쌓이고, "이 파일이 방금 테스트가 만든 것인지" 알 수 없게 된다.

    개발용 uploads/를 실수로 지우지 않도록 디렉터리 이름을 한 번 더 확인한다.
    .env.test 가 UPLOAD_DIR=uploads_test 로 두기 때문에 평소에는 통과한다.
    """
    upload_dir = Path(get_settings().upload_dir)
    if not upload_dir.name.endswith("_test"):
        raise RuntimeError(
            f"테스트 업로드 디렉터리 이름이 '_test'로 끝나지 않습니다: {upload_dir}. "
            ".env.test 의 UPLOAD_DIR을 확인하세요. 개발용 파일을 지우는 사고를 막기 위한 검사입니다."
        )

    yield

    if upload_dir.exists():
        shutil.rmtree(upload_dir, ignore_errors=True)
