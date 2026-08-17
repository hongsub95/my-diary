# 나의 일기(내일)

`나의 일기(내일)`은 앞으로 할 일을 정하고, 지나간 하루를 사진과 글로 남기는 장소 기반 일기 및 일정 앱입니다.

이 저장소는 FastAPI 백엔드와 React(Vite) 프론트엔드로 구성되어 있습니다.

## 문서

- [제품 기획서](./docs/PRODUCT_SPEC.md)
- [개발 인수인계 문서](./docs/DEVELOPMENT_BRIEF.md)
- [데이트 코스 추천·일정 최적화 명세](./docs/COURSE_RECOMMENDATION_SPEC.md)
- [스페이스 모델 명세](./docs/SPACE_MODEL_SPEC.md)
- [화면 디자인 명세](./docs/DESIGN_SPEC.md)
- **[API 명세 (프론트엔드 연동용)](./docs/API_SPEC.md)**
- [AI 도구 이해 노트](./docs/AI_WORKFLOW_NOTES.md)

백엔드 개발자는 기획서와 인수인계 문서를 먼저 읽고, 지도·추천 기능을 개발할 때는
[데이트 코스 추천·일정 최적화 명세](./docs/COURSE_RECOMMENDATION_SPEC.md)를 함께
확인합니다. **프론트엔드 개발자는 [API 명세](./docs/API_SPEC.md)부터 읽으면 됩니다.**

## 프로젝트 구조

```text
app/        FastAPI backend
tests/      Backend tests
frontend/   React web frontend
mobile/     React Native (Expo) app  — 프론트엔드 담당자가 생성 예정
docs/       Product and development documents
```

모바일 앱은 React Native(Expo)로 만들며 같은 저장소의 `mobile/`에 둡니다. 프로젝트
생성 방법과 백엔드 연결 설정은 [개발 인수인계 문서](./docs/DEVELOPMENT_BRIEF.md)의
"모바일 프로젝트 시작 안내"를 참고하세요.

## 백엔드 실행

PostgreSQL이 먼저 떠 있어야 합니다. 아래 과정을 한 번에 실행하려면 `.\dev.ps1`을 쓰세요.

```powershell
# 1) 컨테이너 실행 (PostgreSQL + Redis + pgAdmin)
#    Redis는 웹 세션 저장소입니다. 없으면 웹 로그인이 동작하지 않습니다.
docker compose up -d db redis pgadmin

# 2) 가상환경 준비
py -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt

# 3) .env 준비 (.env.example을 복사한 뒤 값을 채웁니다)
copy .env.example .env
# 로컬 개발용 설정은 .env.local 에 별도로 둡니다 (아래 "환경 설정" 참고)

# 4) DB 스키마 반영
alembic upgrade head

# 5) 서버 실행
uvicorn app.main:app --reload
```

| 용도 | 주소 |
|---|---|
| API | `http://127.0.0.1:8000` |
| Swagger UI (호출 테스트) | `http://127.0.0.1:8000/docs` |
| ReDoc (읽기용 문서) | `http://127.0.0.1:8000/redoc` |
| OpenAPI JSON (클라이언트 생성용) | `http://127.0.0.1:8000/openapi.json` |
| Health check | `http://127.0.0.1:8000/api/v1/health` |
| pgAdmin | `http://127.0.0.1:5050` |

## 로그

로그는 표준 출력(터미널)으로 나옵니다. 서버에 올렸을 때 Docker나 systemd가 수집하도록
파일 경로를 직접 관리하지 않습니다.

서버를 켜면 DB·Redis 연결 결과를 먼저 확인해 알려줍니다.

```text
2026-08-02 23:43:03 | INFO  | app.startup | 서버 시작 | env=local
2026-08-02 23:43:03 | INFO  | app.db      | DB 커넥션 생성 | 사용중=1 대기=0 최대=10+20
2026-08-02 23:43:03 | INFO  | app.startup | DB 연결 성공 | localhost:5432/nailgi | PostgreSQL 16.14
2026-08-02 23:43:03 | INFO  | app.startup | Redis 연결 성공 | redis://localhost:6379/0
```

`.env.local`로 상세도를 조절합니다.

| 설정 | 기본값 | 설명 |
|---|---|---|
| `LOG_LEVEL` | `INFO` | `DEBUG`로 바꾸면 커넥션 대여/반납까지 표시 |
| `DB_ECHO` | `false` | `true`면 실행되는 SQL 전문을 모두 기록 |
| `DB_LOG_CONNECTIONS` | `true` | DB 커넥션 생성/종료 로그 |

커넥션 풀은 연결을 재사용하므로 **생성(connect)** 과 **대여(checkout)** 가 다릅니다.
생성은 드물게 일어나 `INFO`로, 대여는 요청마다 일어나 로그가 폭주하므로 `DEBUG`로만
남깁니다. 쿼리를 직접 확인하려면 `DB_ECHO=true`로 켜세요.

## 인증 구조

플랫폼별로 인증 방식이 다릅니다. 로그인 이후 호출하는 API는 동일합니다.

| | 웹 | 모바일 앱 |
|---|---|---|
| 방식 | Redis 세션 + httpOnly 쿠키 | JWT Bearer 토큰 |
| 엔드포인트 | `/api/v1/auth/web/*` | `/api/v1/auth/*` |
| 강제 로그아웃 | 가능 (세션 삭제) | 불가 (만료까지) |

웹에 세션을 쓰는 이유는 서버가 로그인 상태를 보관해야 강제 로그아웃과 접속 기기 관리가
가능하기 때문입니다. `app/auth/dependencies.py`의 `get_current_user`가 쿠키를 먼저 보고
없으면 `Authorization` 헤더를 확인하므로, 각 라우터는 어느 쪽으로 로그인했는지 신경 쓸
필요가 없습니다.

**로컬에서 웹 프론트를 붙일 때는 API를 `127.0.0.1`이 아니라 `localhost`로 호출해야
쿠키가 전송됩니다.** 자세한 내용은 [API 명세 3.0절](./docs/API_SPEC.md)을 참고하세요.

## 환경 설정

환경변수는 공통 파일과 환경별 파일로 나뉩니다. `.env`를 먼저 읽고 그 위에
`.env.{APP_ENV}`가 덮어씁니다.

| 파일 | 용도 | 커밋 |
|---|---|---|
| `.env` | 공통 기본값 + Docker Compose 전용 변수(`DB_*`, `PGADMIN_*`, `REDIS_PORT`) | ❌ |
| `.env.local` | 로컬 개발 (기본값) | ❌ |
| `.env.test` | 테스트 (`nailgi_test` DB 사용) | ❌ |
| `.env.production` | 실서버 | ❌ |
| `.env.example`, `.env.production.example` | 템플릿 | ✅ |

어떤 환경으로 뜰지는 OS 환경변수 `APP_ENV`로 정합니다. 지정하지 않으면 `local`입니다.

```powershell
uvicorn app.main:app --reload            # .env + .env.local
$env:APP_ENV="production"; uvicorn ...   # .env + .env.production
```

`docker-compose.yml`은 `.env`만 읽고 `.env.local`은 읽지 않으므로, DB 접속 정보는
반드시 `.env`에 있어야 컨테이너가 뜹니다.

**사진 저장소 전환**

로컬은 서버 디스크(`uploads/`), 실서버는 AWS S3에 저장합니다. `STORAGE_BACKEND`
값(`local` / `s3`) 하나로만 갈리고 API 응답 형태는 동일합니다. DB에는 전체 URL이 아니라
저장 키(`diaries/7/abc.jpg`)만 넣고 응답을 만들 때 `MEDIA_BASE_URL`을 앞에 붙이므로,
저장소를 바꿔도 기존 데이터를 고칠 필요가 없습니다.

## 백엔드 테스트

테스트는 개발용 저장소를 건드리지 않습니다. DB는 별도의 `nailgi_test`를 자동 생성해
쓰고, Redis도 개발용(0번)과 분리된 1번 DB를 씁니다. 컨테이너(`db`, `redis`)가 실행
중이어야 합니다.

```powershell
pytest -q
```

## DB 마이그레이션

모델을 수정한 뒤에는 마이그레이션을 만들어 적용합니다.

```powershell
# 모델 변경사항 감지해서 마이그레이션 파일 생성
alembic revision --autogenerate -m "변경 내용 설명"

# 적용
alembic upgrade head

# 되돌리기 (한 단계)
alembic downgrade -1
```

새 모델을 추가하면 `app/models.py`에도 등록해야 마이그레이션에 잡힙니다.

## 프론트엔드 실행

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

PowerShell 실행 정책 때문에 `npm`이 막히면 `npm.cmd`를 사용하세요.

## 프론트엔드 빌드

```powershell
cd frontend
npm.cmd run build
```

## Docker 실행

```powershell
docker compose up --build
```
