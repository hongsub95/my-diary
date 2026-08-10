import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

# 어떤 환경으로 띄울지는 OS 환경변수 APP_ENV로 정한다.
# .env 파일 안에 적을 수 없는 이유: "어느 .env를 읽을지"를 정하는 값이라 파일을 읽기
# 전에 알아야 하기 때문이다. 지정하지 않으면 로컬 개발로 간주한다.
#
#   로컬 개발:  (설정 안 함)            -> .env.local
#   테스트:     APP_ENV=test            -> .env.test
#   실서버:     APP_ENV=production      -> .env.production
APP_ENV = os.getenv("APP_ENV", "local")

# 공통 .env를 먼저 읽고 환경별 파일로 덮어쓴다. 뒤에 오는 파일이 우선이므로
# 공통값은 .env에 두고 환경마다 다른 값만 .env.{환경}에 적으면 된다.
# 파일이 없어도 오류가 아니며, 실서버처럼 OS 환경변수로 직접 주입하는 경우도 지원된다.
ENV_FILES = (".env", f".env.{APP_ENV}")

STORAGE_BACKEND_LOCAL = "local"
STORAGE_BACKEND_S3 = "s3"


class Settings(BaseSettings):
    """환경변수와 `.env` 파일에서 읽어오는 앱 설정.

    database_url과 jwt_secret_key는 기본값을 두지 않는다. 소스코드에 실제 비밀번호를
    남기지 않기 위해서이고, 설정이 없으면 앱이 조용히 잘못된 값으로 뜨는 대신
    시작 시점에 바로 에러를 내게 하려는 의도다.
    """

    app_name: str = "나의 일기(내일) API"
    app_version: str = "0.1.0"
    app_env: str = APP_ENV

    # Database
    database_url: str

    # ── 로깅 ───────────────────────────────────────
    # DEBUG / INFO / WARNING / ERROR 중 하나. 실서버는 INFO 이상을 권장한다.
    log_level: str = "INFO"

    # True면 SQLAlchemy가 실행하는 SQL 전문을 모두 로그로 남긴다.
    # 쿼리를 눈으로 확인할 때만 켠다. 켜두면 로그가 매우 길어진다.
    db_echo: bool = False

    # DB 커넥션이 새로 만들어지거나 끊길 때 로그를 남길지.
    # 풀에서 빌려 쓰는(checkout) 건 요청마다 일어나 시끄러우므로 DEBUG 레벨로만 남긴다.
    db_log_connections: bool = True

    # CORS: 브라우저에서 이 API를 호출할 수 있는 프론트엔드 출처 목록.
    # 콤마로 구분해 적는다 (예: http://localhost:5173,https://내도메인.com).
    cors_origins: str = "http://localhost:5173"

    # ── JWT (모바일 앱 인증) ───────────────────────
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    # 15일은 "마지막 사용 후 15일"이다. 앱을 열어 토큰을 갱신할 때마다 새 refresh token이
    # 발급되면서 기간이 다시 시작되므로, 그 안에 한 번이라도 쓰면 로그아웃되지 않는다.
    jwt_refresh_token_expire_days: int = 15

    # ── 세션 (웹 인증) ─────────────────────────────
    # 웹은 JWT 대신 Redis 세션을 쓴다. 서버가 로그인 상태를 들고 있어서
    # 강제 로그아웃과 접속 기기 목록이 가능하다.
    redis_url: str = "redis://localhost:6379/0"

    # 세션 유효기간. JWT의 refresh token과 같은 15일로 맞춘다.
    # 요청이 올 때마다 갱신되므로 "마지막 사용 후 15일"이다.
    session_expire_days: int = 15

    # 브라우저에 심을 쿠키 이름
    session_cookie_name: str = "nailgi_session"

    # HTTPS에서만 쿠키를 보내게 할지. 로컬은 http라 False여야 하고,
    # 실서버(.env.production)에서는 반드시 True로 둔다.
    session_cookie_secure: bool = False

    # 쿠키를 보낼 도메인 범위. 로컬은 비워두면 현재 호스트에만 적용된다.
    session_cookie_domain: str | None = None

    # ── 사진 저장소 ────────────────────────────────
    # local: 서버 디스크에 저장 (개발용) / s3: AWS S3에 저장 (실서버용)
    # 어느 쪽이든 API 응답 형태는 같고, 이 값 하나로만 갈린다.
    storage_backend: str = STORAGE_BACKEND_LOCAL

    # storage_backend=local일 때 파일을 저장할 디렉터리 (프로젝트 루트 기준 상대경로)
    upload_dir: str = "uploads"

    # 저장된 파일에 접근하는 주소의 앞부분. DB에는 키(diaries/7/abc.jpg)만 저장하고
    # 응답을 만들 때 이 값을 앞에 붙여 완전한 URL로 만든다. 저장소를 바꿔도
    # 이 값만 바꾸면 되고 DB는 손대지 않는다.
    media_base_url: str = "http://127.0.0.1:8000/uploads"

    # ── AWS S3 (storage_backend=s3일 때만 사용) ────
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_s3_bucket_name: str = ""
    aws_region: str = "ap-northeast-2"

    # ── 서비스 기준 시간대 ─────────────────────────
    # 시각은 전부 UTC로 저장하지만, `?from=2026-08-01` 처럼 **날짜만** 오는 조회
    # 파라미터는 어느 시간대의 하루인지 정해야 UTC 범위로 바꿀 수 있다.
    # UTC로 해석하면 한국 시간 오전 0~9시 약속이 달력의 달 경계에서 빠져버린다.
    # 해외 사용자를 받게 되면 이 고정 가정을 다시 검토해야 한다.
    service_timezone: str = "Asia/Seoul"

    model_config = SettingsConfigDict(
        env_file=ENV_FILES,
        env_file_encoding="utf-8",
        case_sensitive=False,
        # .env에는 docker-compose 전용 변수(DB_HOST, PGADMIN_EMAIL 등)도 함께 들어 있다.
        # 여기서 선언하지 않은 값은 무시해야 앱이 뜬다.
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        """콤마로 구분된 cors_origins 문자열을 리스트로 바꾼다.

        CORSMiddleware는 리스트를 요구하는데 .env는 문자열만 담을 수 있어 여기서 변환한다.
        """
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_local_storage(self) -> bool:
        """사진을 서버 디스크에 저장하는 환경인지."""
        return self.storage_backend == STORAGE_BACKEND_LOCAL

    @property
    def is_production(self) -> bool:
        """실서버 환경인지. 디버그 정보 노출 여부 등을 가를 때 쓴다."""
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    """설정 객체를 한 번만 만들어 재사용한다(.env 파일을 매번 다시 읽지 않도록 캐싱)."""
    return Settings()
