# 백엔드 컨텍스트 및 인수인계 문서

> 새 Codex 세션이나 새 백엔드 개발자가 현재 백엔드의 구조와 판단 맥락을 복구하기 위한 기준 문서다.
>
> 마지막 코드 점검: 2026-09-09 (기록 도메인 중심 재점검)  
> 점검 기준 커밋: `beba479`, 작성 중 HEAD `195474f`  
> 점검 범위: `app/`, `alembic/`, `tests/`, 환경 설정, Docker 구성, 현재 기획 문서

## 0-A. 2026-10-06 기획 대조 — 정적 확인

- 썸네일 생성은 app/core/images.py와 app/diaries/photo_service.py에 구현 코드가 있다. 아래 9월 9일 미구현 진단은 과거 상태다. HEIC·손상·비효율 이미지의 원본 대체는 유지한다.
- 카카오 검색·주소/역지오코딩·SchedulePlace.address_detail 코드가 있다. 공급자 설정과 실제 연결 검증은 코드 존재와 구분한다.
- S3FileStorage는 여전히 NotImplementedError다 → **2026-10-14 구현됨**(`S3FileStorage`, `tests/test_s3_storage.py`). AWS 설정은 DEPLOYMENT_CHECKLIST.md 1.1. 이번 작업에서는 백엔드 테스트·DB 마이그레이션을 실행하지 않았다.
- 최신 기획 정합성은 PLANNING_RECONCILIATION_2026-10-06.md, 공간 확정 정책은 SPACE_COLLABORATION_UI_SPEC.md와 API_SPEC.md를 함께 읽는다.

## 0. 2026-09-09 재점검 — 아래 과거 상태보다 우선

- 일기 본문·공용 사진·타임라인 CRUD와 기록 피드가 구현되고 `app/api/router.py`에 등록돼 있다. 아래 ‘일기 API 없음’ 진단은 해소됐다.
- `app/schedules/service.py`의 `has_diary`는 이제 본문·사진·타임라인을 합산한 `content.has_any`다. 사진·타임라인 누락 진단은 해소됐다.
- `experience_phase`, `record_summary`, 커서 페이지네이션, 서버 연월 필터, 사진 재정렬·대표 지정 API가 존재한다.
- `app/core/storage.py`는 로컬 저장을 구현했지만 S3는 아직 NotImplementedError다. 사진 썸네일도 생성하지 않는다. → 둘 다 해소: 썸네일 구현(0-A), S3 2026-10-14 구현.
- 첫 기록 저장 시 자동 완료는 기획 요구와 달리 미구현이다. 당일 사진 추가가 전체 일정 완료를 유발할지 정책 정리가 필요하다.
- 파일 기준 migration head는 `c3e81d47a9f2`이며 `05bedffbec2c` 다음에 기록 메뉴를 활성화한다. 작성 중 `195474f`에 커밋됐다. DB 적용 여부는 확인하지 않았다.
- 테스트는 정적 집계 247개 함수다. 이번 `.venv/Scripts/python.exe -m pytest --collect-only -q` 및 Alembic 실행은 가상환경의 원래 Python 3.10 실행 파일이 없어 실패했다. 과거 247개 통과 보고는 `UX_BACKEND_HANDOFF.md`의 2026-09-07 기록이며 이번 통과 결과가 아니다.
- 우선순위: 모바일 하루 상세·기록 API 연결과 수용 검증 → 상태 전이 계약 정리 → 썸네일·S3 → 지도·푸시 별도 MVP 과제. 상세 명세는 [MOBILE_DAY_RECORD_SPEC.md](MOBILE_DAY_RECORD_SPEC.md)를 읽는다.
- 모바일 상세·사진 선택·기록 편집 코드가 이번 문서 작성 중 별도 작업에서 추가됐다. 미완성 여부를 기존 파일 부재만으로 판단하지 말고 현행 작업 트리와 명세의 체크리스트를 대조한다.

1–19절은 2026-09-02의 구조 설명과 당시 진단을 보존한 자료다. 특히 5·8·9·12–15절의 구현 상태·테스트 수·우선순위는 위 재점검 내용을 우선하며, 재점검하지 않은 권한·운영 위험은 해결 완료로 간주하지 않는다.

## 1. 새 세션 복구 순서

1. 루트 `AGENTS.md`를 읽어 제품과 협업 역할을 확인한다.
2. 이 문서 `docs/BACKEND_OVERVIEW.md`를 끝까지 읽는다.
3. 제품 방향이 필요한 작업이면 `docs/PRODUCT_SPEC.md`, `docs/DEVELOPMENT_BRIEF.md`, `docs/API_SPEC.md`, `docs/SPACE_MODEL_SPEC.md`, `docs/UX_BACKEND_HANDOFF.md`를 확인한다.
4. 이 문서와 코드가 다르면 **현재 코드와 최신 Alembic 마이그레이션을 우선**하고 차이를 이 문서에 반영한다.
5. 기능 구현 전 `git status --short`로 사용자의 기존 변경을 확인하고 보존한다.
6. 가능하면 `pytest -q`와 `alembic heads`를 실행해 검증 상태를 갱신한다.

이 문서는 모델의 영구 학습을 대신하는 인수인계 자료다. 대화 기억에 의존하지 말고 여기서 현재 상태를 복구한다.

## 2. 제품 맥락과 백엔드의 역할

제품명은 `나의 일기(내일)`이며 정체성은 **장소 기반 데이북**이다.

사용자는 다음 흐름을 경험해야 한다.

1. 앞으로 보낼 하루를 일정과 장소의 순서로 계획한다.
2. 개인 또는 공유 스페이스에서 함께 계획한다.
3. 하루를 실제로 보낸 뒤 일정을 완료한다.
4. 완료된 하루에 공용 사진과 실제 방문 타임라인을 남긴다.
5. 같은 하루를 보낸 사람마다 자기 관점의 일기 본문을 하나씩 남긴다.
6. 기록 화면에서 날짜뿐 아니라 장소와 이동 흐름을 중심으로 지난 하루를 다시 본다.

백엔드의 CRUD 자체는 일반 일정 앱과 유사하지만 다음 데이터 관계가 제품 정체성을 만든다.

- `Space -> Schedule -> ordered SchedulePlace`
- `Schedule -> completed_at`
- `Schedule -> shared DiaryPhoto[]`
- `Schedule -> shared DiaryTimelineItem[]`
- `Schedule -> per-author DiaryEntry[]`

새 기능을 설계할 때 일기를 독립 메모로 보지 말고, **한 일정이 계획에서 완료된 하루 기록으로 전환되는 과정**으로 본다.

## 3. 기술 스택과 실행 구조

| 영역 | 현재 선택 |
|---|---|
| API | FastAPI `0.115.12` |
| ORM | SQLAlchemy `2.0.41`, 동기식 `Session` |
| DB | PostgreSQL 16 기준 |
| 마이그레이션 | Alembic `1.16.2` |
| 모바일 인증 | PyJWT 기반 access/refresh JWT |
| 웹 인증 | Redis 세션 + httpOnly 쿠키 |
| 비밀번호 | `bcrypt 5.0.0` 직접 사용 |
| 설정 | `pydantic-settings 2.9.1` |
| 테스트 | pytest + FastAPI TestClient + 별도 PostgreSQL/Redis |
| 서버 | Uvicorn |

FastAPI 진입점은 `app/main.py`다. 기동 과정은 다음과 같다.

1. `app.models`를 import해 모든 SQLAlchemy 모델을 레지스트리에 등록한다.
2. 로깅을 초기화한다.
3. lifespan 시작 시 PostgreSQL과 Redis 연결을 확인하고 결과를 기록한다.
4. CORS와 공통 오류 핸들러를 등록한다.
5. `/api/v1` 아래에 도메인 라우터를 연결한다.
6. 종료 시 SQLAlchemy 엔진의 커넥션 풀을 정리한다.

DB 또는 Redis 연결 확인이 실패해도 서버 프로세스 자체는 죽이지 않는다. DB 장애는 실제 DB 요청에서, Redis 장애는 웹 로그인 및 세션 인증에서 다시 드러난다.

## 4. 환경 설정

`app/core/config.py`는 OS 환경변수 `APP_ENV`를 import 시점에 읽는다. 기본값은 `local`이다.

- 공통: `.env`
- 로컬: `.env.local`
- 테스트: `.env.test`
- 운영: `.env.production`

공통 파일을 먼저 읽고 환경별 파일이 덮어쓴다. `APP_ENV`는 어느 파일을 읽을지 결정하므로 프로세스 환경변수로 지정해야 한다.

필수 설정:

- `DATABASE_URL`
- `JWT_SECRET_KEY`

주요 선택 설정:

- `REDIS_URL`
- `CORS_ORIGINS`
- `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` (기본 30분)
- `JWT_REFRESH_TOKEN_EXPIRE_DAYS` (기본 15일)
- `SESSION_EXPIRE_DAYS` (기본 15일, sliding expiration)
- `SESSION_COOKIE_NAME` (기본 `nailgi_session`)
- `SESSION_COOKIE_SECURE` (운영에서는 반드시 `true`)
- `SERVICE_TIMEZONE` (기본 `Asia/Seoul`)
- `PLACE_SEARCH_PROVIDER` (현재 기본 `mock`)
- `STORAGE_BACKEND` (`local` 또는 `s3`)
- `UPLOAD_DIR`, `MEDIA_BASE_URL`

SQLAlchemy 커넥션 풀은 기본 10개, overflow 20개로 최대 30개 연결을 사용한다. 모든 `datetime` 타입 힌트는 공통 `Base`에서 timezone-aware `TIMESTAMPTZ`로 매핑한다.

## 5. 코드 구조와 책임 경계

기능별 디렉터리는 대체로 다음 계층을 따른다.

```text
router.py        HTTP 경로, Depends 조합, 요청/응답 연결
schemas.py       Pydantic 요청/응답 모델과 입력 검증
dependencies.py 인증 이후 도메인 접근 권한 확인
service.py       비즈니스 규칙과 트랜잭션
models.py        SQLAlchemy 모델, DB 제약과 관계
errors.py        고정 오류 코드와 사용자용 메시지
```

| 도메인 | 모델 | API/서비스 | 테스트 | 상태 |
|---|---:|---:|---:|---|
| core/health | 해당 없음 | 있음 | 있음 | 구현됨 |
| auth | 있음 | 앱 JWT + 웹 세션 | 있음 | 구현됨 |
| users | 있음 | 기본 스페이스 변경 | auth/space 테스트에 포함 | 부분 구현 |
| spaces | 있음 | CRUD, 참여, 멤버, 소유권 | 있음 | 구현됨 |
| schedules | 있음 | CRUD, 완료 처리 | 있음 | 구현됨 |
| places | 있음 | 일정 장소 CRUD/정렬/검색 | 있음 | 검색 공급자는 mock |
| diaries | 본문/사진/타임라인 모델 | **없음** | **없음** | 데이터 기반만 구현 |
| menus | 있음 | 권한별 메뉴 트리 조회 | 있음 | 조회 구현됨 |
| audit | 있음 | 인증/스페이스/일정 일부 기록 | 있음 | 부분 구현 |
| share links | 모델만 있음 | 없음 | 없음 | P2/미구현 |
| schedule participants | 모델만 있음 | 없음 | 없음 | P2/미사용 |

`app/models.py`는 모델 등록의 단일 진입점이다. 새 모델을 추가하면 반드시 이 파일에도 import를 추가한다. 현재 `DiaryTimelineItem`은 `app.diaries.models` 모듈 import 과정에서 등록되지만 `app/models.py`의 명시적 import와 `__all__`에는 빠져 있다.

## 6. 인증 구조

### 6.1 모바일 앱

- 경로: `/api/v1/auth/*`
- access token: 기본 30분
- refresh token: 기본 15일
- 전달: `Authorization: Bearer {access_token}`
- refresh 시 access와 refresh를 모두 새로 발급한다.
- JWT는 서버에 저장하지 않는 무상태 방식이다.
- 앱 로그아웃 API는 감사 로그만 남기며 실제 로그아웃은 클라이언트가 토큰을 삭제해야 완료된다.
- 이미 발급된 JWT를 서버에서 즉시 폐기하는 denylist는 없다.

### 6.2 웹

- 경로: `/api/v1/auth/web/*`
- Redis 키:
  - `session:{session_id}`: 사용자와 접속 정보
  - `user_sessions:{user_id}`: 사용자별 세션 ID 집합
- 세션 ID는 32바이트 암호학적 난수로 생성한다.
- 쿠키는 httpOnly, SameSite=Lax이며 운영에서 Secure가 필요하다.
- 요청할 때마다 세션과 사용자별 역색인의 TTL을 연장한다.
- 단일 로그아웃, 모든 기기 로그아웃, 접속 기기 목록을 지원한다.

### 6.3 공통 인증 의존성

`app/auth/dependencies.py:get_current_user`가 보호 API의 공통 진입점이다.

1. 세션 쿠키가 유효하면 웹 사용자로 인증한다.
2. 유효한 세션이 없고 Bearer 토큰이 있으면 JWT access token을 검사한다.
3. 사용자 ID를 얻은 후 DB에 실제 사용자가 남아 있는지 다시 확인한다.
4. 실패 원인은 구분하지 않고 `UNAUTHORIZED` 401로 통일한다.

라우터는 `CurrentUser`, `DbSession`, `RedisClient` 타입 별칭을 사용한다.

## 7. 권한 모델

권한의 중심은 일정 작성자가 아니라 `SpaceMember`다.

- 스페이스를 조회하거나 콘텐츠를 생성·수정하려면 `status=active` 멤버여야 한다.
- 스페이스 설정 변경, 보관, 멤버 제거, 참여 번호 재발급은 owner만 가능하다.
- 일정 조회와 수정은 해당 스페이스의 모든 활성 멤버가 할 수 있다.
- 일정 삭제는 스페이스 owner 또는 일정 최초 작성자만 가능하다.
- 일정의 `created_by`는 표시와 삭제 권한에 사용하며 일반 조회 권한에는 사용하지 않는다.
- `ScheduleParticipant`는 향후 실제 참석 여부용이며 접근 제어에 사용하지 않는다.
- 존재하지 않는 리소스와 권한 없는 리소스는 같은 404를 반환해 ID 탐색을 어렵게 한다.
- 외부에 노출되는 스페이스 식별자는 순차 정수 ID가 아니라 UUID다.

개인 스페이스는 회원가입 트랜잭션에서 사용자, owner 멤버십, 기본 스페이스 지정과 함께 생성된다. 개인 스페이스는 참여, 나가기, 보관이 불가능하다.

공유 스페이스의 최대 활성 멤버 수는 현재 20명이다. 참여 번호는 혼동 문자를 제외한 8자리 대문자/숫자이며 공백, 하이픈, 대소문자 차이는 서버가 정규화한다.

나간(`left`) 사용자가 같은 참여 번호를 다시 입력하면 기존 멤버십 행을 `active/member`로 되살린다. 제거된(`removed`) 사용자도 현재 구현상 같은 방식으로 다시 참여할 수 있다. 이것이 의도한 정책인지 제품 결정이 필요하다.

## 8. 핵심 데이터 모델

모든 실제 테이블명은 `nl_` 접두사를 사용한다.

### 8.1 사용자와 스페이스

```text
User
 ├─ default_space_id -> Space (SET NULL)
 └─ SpaceMember[]

Space
 ├─ owner_id -> User
 ├─ SpaceMember[]
 └─ Schedule[]
```

- `User.role`: `0=master`, `1=user`. 크기 비교용 등급이 아니라 코드 값이다.
- `Space.type`: `personal | shared`
- `Space.archived_at`: 소프트 삭제 시각
- `SpaceMember.role`: `owner | member`
- `SpaceMember.status`: `active | left | removed`
- `(space_id, user_id)`는 유일하다.

### 8.2 일정과 장소

```text
Schedule
 ├─ space_id -> Space
 ├─ created_by -> User
 ├─ SchedulePlace[] -> Place
 ├─ DiaryEntry[]
 ├─ DiaryPhoto[]
 ├─ DiaryTimelineItem[]
 ├─ ScheduleParticipant[]   (MVP 미사용)
 └─ ShareLink[]             (미구현)
```

- `Schedule.status`: `planned | completed | canceled`
- `end_at >= start_at`을 Pydantic/서비스/DB 제약으로 방어한다.
- 계획 생성 UI의 날짜는 시작일–종료일 범위다. 클라이언트는 서비스 시간대에서 첫날의
  시작 시간과 마지막 날의 종료 시간을 결합해 기존 `start_at`, `end_at` UTC 값으로
  보낸다. 별도 날짜 컬럼은 추가하지 않는다.
- `completed_at`은 실제 완료 버튼을 누른 시각이며 단순히 종료 시간이 지났다고 자동 생성하지 않는다.
- 완료 API는 멱등적이다. 재호출해도 최초 `completed_at`을 유지한다.
- 기간 조회는 일정 시작점만 보는 것이 아니라 조회 범위와 겹치는 일정을 포함한다.
- 날짜 쿼리 `from`, `to`는 Asia/Seoul 하루로 해석한 뒤 UTC 범위로 변환한다.
- `SchedulePlace.sort_order`가 사용자 정의 방문 순서다.
- 외부 장소는 `(provider, provider_place_id)`로 재사용하고 manual 장소는 이름이 같아도 합치지 않는다.
- 장소 재정렬 API는 해당 일정의 모든 `schedule_place_id`를 중복 없이 보내야 한다.

### 8.3 일기: 확정된 공동 하루 구조

한 일정의 일기는 다음 세 데이터의 합이다.

```text
Schedule (함께 보낸 하루)
 ├─ DiaryEntry[]         작성자별 본문: (schedule_id, author_id)당 1개
 ├─ DiaryPhoto[]         하루 공용 사진
 └─ DiaryTimelineItem[]  하루 공용 실제 방문 흐름
```

정책:

- 공유 스페이스에서도 공동 본문 하나를 같이 수정하지 않는다.
- 각 활성 멤버는 한 일정에 자기 본문을 최대 하나 작성한다.
- 작성자별 본문이라는 뜻은 비공개라는 뜻이 아니다. 같은 스페이스의 활성 멤버는 서로의 본문을 본다.
- 사진은 작성자 본문이 아니라 일정에 직접 연결한다.
- 사진 업로더는 `uploader_id`로 보존한다.
- 사진은 `storage_key`와 선택적인 `thumbnail_key`를 저장하고 전체 URL은 응답 생성 시 `MEDIA_BASE_URL`과 결합한다.
- 대표 사진은 일정당 최대 한 장이며 PostgreSQL 부분 유니크 인덱스로 보장한다.
- 대표 지정이 없으면 가장 앞선 `sort_order` 사진을 대표로 사용하는 정책이다.
- 타임라인은 위치 자동수집이 아니라 사용자가 직접 추가·수정할 수 있어야 한다.
- 타임라인의 `schedule_place_id`는 선택 사항이다. 일정에 없던 장소나 “점심 먹기” 같은 활동도 기록할 수 있다.
- 연결된 일정 장소가 삭제되면 타임라인 자체는 남고 `schedule_place_id`만 NULL이 된다.
- 사진만 있거나 타임라인만 있는 하루도 유효한 기록이다. 본문 행이 반드시 필요한 것은 아니다.

현재 구현 경계:

- 세 모델과 Alembic 마이그레이션은 존재한다.
- `app/diaries/router.py`, `schemas.py`, `service.py`, 저장소 어댑터, 업로드 처리, 테스트는 아직 없다.
- API 라우터에도 diaries 라우터가 등록되어 있지 않다.
- 프론트엔드가 현재 일기 본문·사진·타임라인을 서버에 저장할 방법은 없다.

## 9. 현재 API 목록

모든 경로의 공통 접두사는 `/api/v1`이다.

### 공개/인증

| Method | Path | 설명 |
|---|---|---|
| GET | `/health` | 상태 확인 |
| POST | `/auth/register` | 앱 회원가입 + 개인 스페이스 + JWT |
| POST | `/auth/login` | 앱 로그인 |
| POST | `/auth/refresh` | JWT 토큰 쌍 재발급 |
| POST | `/auth/logout` | 앱 로그아웃 이력 기록 |
| GET | `/auth/me` | 내 정보 |
| POST | `/auth/web/register` | 웹 회원가입 + Redis 세션 |
| POST | `/auth/web/login` | 웹 로그인 |
| POST | `/auth/web/logout` | 현재 웹 세션 종료 |
| POST | `/auth/web/logout-all` | 모든 웹 세션 종료 |
| GET | `/auth/web/sessions` | 접속 기기 목록 |

### 스페이스/사용자

| Method | Path | 설명 |
|---|---|---|
| GET | `/spaces` | 내 활성·미보관 스페이스 목록 |
| POST | `/spaces` | 공유 스페이스 생성 |
| POST | `/spaces/join` | 참여 번호로 참여 |
| GET | `/spaces/{space_id}` | 스페이스 상세 |
| PATCH | `/spaces/{space_id}` | owner가 이름/아이콘 수정 |
| DELETE | `/spaces/{space_id}` | owner가 공유 스페이스 보관 |
| POST | `/spaces/{space_id}/join-code/regenerate` | 참여 번호 재발급 |
| GET | `/spaces/{space_id}/members` | 활성 멤버 목록 |
| DELETE | `/spaces/{space_id}/members/{user_id}` | owner가 멤버 제거 |
| POST | `/spaces/{space_id}/leave` | 공유 스페이스 나가기 |
| POST | `/spaces/{space_id}/transfer-ownership` | 소유권 이전 |
| PUT | `/users/me/default-space` | 기본 스페이스 변경 |

### 일정/장소

| Method | Path | 설명 |
|---|---|---|
| GET | `/spaces/{space_id}/schedules` | 기간·상태별 일정 목록 |
| POST | `/spaces/{space_id}/schedules` | 일정 생성 |
| GET | `/schedules/{schedule_id}` | 일정 상세 |
| PATCH | `/schedules/{schedule_id}` | 일정 부분 수정 |
| POST | `/schedules/{schedule_id}/complete` | 완료 상태와 완료 시각 기록 |
| DELETE | `/schedules/{schedule_id}` | 일정 삭제 |
| GET | `/schedules/{schedule_id}/places` | 방문 순서별 장소 목록 |
| POST | `/schedules/{schedule_id}/places` | 장소를 맨 뒤에 추가 |
| PATCH | `/schedules/{schedule_id}/places/reorder` | 장소 순서 일괄 변경 |
| PATCH | `/schedules/{schedule_id}/places/{schedule_place_id}` | 메모·예정시각·방문 여부 수정 |
| DELETE | `/schedules/{schedule_id}/places/{schedule_place_id}` | 일정에서 장소 제거 |
| GET | `/places/search?query=...` | 장소 공급자 검색; 현재 mock |
| GET | `/menus?scope=app|admin` | 권한에 맞는 메뉴 트리 |

일기, 사진 업로드, 타임라인, 기록 목록 전용 API는 아직 없다.

## 10. 오류 응답 원칙

모든 오류는 `app/core/errors.py`에서 다음 형태로 통일한다.

```json
{
  "code": "INVALID_JOIN_CODE",
  "message": "참여 번호를 확인해 주세요.",
  "field": "join_code"
}
```

- `code`: 프론트엔드 분기용 불변 코드
- `message`: 사용자에게 바로 보여줄 수 있는 한국어 문구
- `field`: 특정 입력 필드와 관련 없으면 `null`

Pydantic 검증 오류, `AppError`, FastAPI/Starlette HTTP 오류, 예상하지 못한 예외를 같은 외형으로 변환한다. 운영 환경에서는 예상하지 못한 예외의 내부 정보를 노출하지 않는다.

## 11. 감사 로그

`nl_audit_logs`는 append-only 이력이다. 사용자 삭제 후에도 이력을 보존하기 위해 `user_id`에 외래키를 걸지 않고 당시 이메일을 `actor_email`에 스냅샷으로 남긴다.

현재 기록되는 주요 행위:

- 회원가입
- 로그인 성공/실패
- 앱/웹 로그아웃, 웹 전체 로그아웃
- 스페이스 생성/수정/보관/참여/나가기
- 멤버 제거, 소유권 이전, 참여 번호 재발급
- 일정 생성/수정/삭제

일정 완료와 향후 일기·사진·타임라인 변경은 현재 감사 이벤트가 없다. 개인정보 및 공동 콘텐츠 수정 추적 정책을 정한 뒤 필요한 이벤트를 추가해야 한다.

주의: 여러 서비스는 도메인 변경을 먼저 commit하고 라우터에서 감사 로그를 별도 commit한다. 따라서 도메인 변경과 감사 기록이 하나의 원자적 트랜잭션은 아니다. 감사 기록 실패 시 실제 변경은 끝났는데 요청은 실패로 보일 가능성이 있다.

## 12. 마이그레이션 상태

현재 Alembic 체인은 하나이며 head는 파일 기준 `05bedffbec2c`다.

```text
1287a7b788d8
 -> 343f93b240d6
 -> 187f5272ce29
 -> e54f6232e325
 -> 10cae1a9cf19
 -> b88e93a35d0c
 -> 32aa082cae06
 -> b3c32666bfc6
 -> d7f9c2a1e4b6
 -> f1a4c7d92e58
 -> fb61fefe3cae
 -> 05bedffbec2c (head)
```

마지막 마이그레이션은 다음을 수행한다.

- 일기 본문 유일 제약을 `schedule_id`에서 `(schedule_id, author_id)`로 변경
- 사진 연결을 `diary_entry_id`에서 `schedule_id`로 변경
- URL 컬럼을 저장 키 컬럼으로 교체
- 대표 사진 필드와 부분 유니크 인덱스 추가
- 공용 타임라인 테이블 추가

이 마이그레이션은 “일기 API가 없어 기존 사진 데이터가 0건”이라는 전제를 코드 주석에 명시하고 NOT NULL 컬럼을 바로 추가한다. 실제 환경에 기존 `nl_diary_photos` 행이 있다면 적용 전에 데이터 존재 여부를 확인하고 별도 이관 절차를 만들어야 한다. downgrade 역시 새 사진 데이터를 보존하지 못하므로 실데이터 생성 후 사용하면 안 된다.

## 13. 테스트 구조와 마지막 검증 결과

테스트는 SQLite가 아니라 PostgreSQL을 사용한다. PostgreSQL 전용 UUID, JSONB, INET, 부분 인덱스를 사용하기 때문이다.

`tests/conftest.py`의 안전장치:

- `APP_ENV=test`를 앱 import 전에 설정한다.
- DB 이름이 `_test`로 끝나지 않으면 중단한다.
- 테스트 Redis DB가 0번이면 중단한다.
- 테스트 세션 시작 시 PostgreSQL 테스트 DB와 스키마를 준비한다.
- 각 테스트 후 모든 테이블을 truncate하고 시퀀스를 초기화한다.
- FastAPI의 DB/Redis 의존성을 테스트 저장소로 교체한다.

현재 로컬에 존재하는 테스트는 총 **165개**다.

| 파일 | 테스트 수 | 범위 |
|---|---:|---|
| `test_health.py` | 2 | 루트/헬스 |
| `test_auth.py` | 24 | 앱 인증, 개인 스페이스 |
| `test_auth_web.py` | 15 | Redis 세션 |
| `test_audit.py` | 12 | 감사 로그 |
| `test_menus.py` | 11 | 메뉴/권한 |
| `test_spaces.py` | 37 | 스페이스/멤버/소유권 |
| `test_schedules.py` | 39 | 일정/기간/완료/권한 |
| `test_places.py` | 25 | 장소/정렬/검색 |

**2026-09-02 검증 결과:** 테스트를 실행하지 못했다.

- `py --version`: 기본 Python을 찾지 못함
- `.venv/Scripts/python.exe`: `C:\Users\hong9\AppData\Local\Programs\Python\Python310\python.exe`가 없어 실행 불가
- Docker: 현재 Codex 실행 권한에서는 Docker named pipe 접근 거부

따라서 테스트 파일 165개의 존재는 확인했지만 현재 모두 통과한다는 결론은 내리지 않는다. Python 가상환경을 다시 만든 뒤 PostgreSQL과 Redis를 실행하고 `pytest -q`로 검증해야 한다.

## 14. 현재 확인된 불일치와 위험

아래 항목은 코드 재점검에서 확인한 사실이다. 수정 전에는 각각 테스트를 먼저 추가한다.

### P0 — 일기 API가 없음

데이터 모델과 마이그레이션은 있지만 프론트엔드가 저장·조회할 엔드포인트가 없다. 장소 기반 데이북의 핵심 사용자 흐름이 서버 관점에서는 아직 완성되지 않았다.

필요한 최소 범위:

1. 완료된 하루 상세 조회
2. 내 본문 PUT/DELETE
3. 공용 사진 업로드/삭제/순서/대표 지정
4. 공용 타임라인 CRUD/정렬
5. 완료 기록 목록과 대표 사진 응답
6. 활성 멤버 권한 및 업로더/작성자 삭제 정책
7. API/서비스/저장소 테스트

### P0 — `has_diary`가 사진·타임라인을 무시함

`app/schedules/service.py:_has_diary_column()`은 `DiaryEntry` 존재 여부만 검사한다. 그러나 확정 정책상 사진만 또는 타임라인만 있는 하루도 유효한 기록이다. 현재 상태에서는 그런 일정의 `has_diary`가 `false`가 된다. 일기 API 구현 시 세 데이터 중 하나라도 존재하면 참이 되도록 수정하거나 필드명을 더 정확하게 바꿔야 한다.

### P1 — 보관된 스페이스에 직접 접근 가능

스페이스 목록과 기본 스페이스 변경은 `archived_at IS NULL`을 검사하지만 `require_member`와 일정 접근 의존성은 활성 멤버십만 보고 보관 여부를 검사하지 않는다. UUID나 일정 ID를 알고 있는 기존 멤버는 보관된 스페이스 상세, 일정, 일부 변경 API에 직접 접근할 수 있다. 보관의 의미를 읽기 전용 보존으로 할지 완전 접근 차단으로 할지 확정하고 의존성에서 일관되게 처리해야 한다.

### P1 — 다른 멤버의 기본 스페이스가 보관 상태를 가리킬 수 있음

owner가 공유 스페이스를 보관할 때 현재 요청자인 owner의 `default_space_id`만 검사한다. 다른 멤버가 그 공유 스페이스를 기본값으로 지정했다면 보관 후에도 그 사용자의 기본값은 보관된 스페이스를 가리킬 수 있다. 보관 시 모든 멤버의 기본값을 개인 스페이스로 되돌리거나 기본 지정자가 한 명이라도 있으면 보관을 막는 정책이 필요하다.

### P1 — 제거된 멤버의 재참여 정책이 열려 있음

현재 `join_by_code`는 `left`와 `removed`를 구분하지 않고 모두 활성화한다. owner가 내보낸 사람도 참여 번호만 알면 즉시 다시 들어올 수 있다. 제품 의도가 “번호를 아는 사람은 재참여 가능”이면 유지하고, 강제 제거가 차단 의미라면 `removed` 재참여를 금지하거나 별도 차단 정책이 필요하다.

### P1 — 핵심 문서와 일부 테스트가 Git에서 제외됨

점검 당시 `.gitignore`는 `docs/` 전체와 `/tests/`를 제외하고 있었다. 이미 Git에 들어간 테스트는 계속 추적되지만 로컬에서 나중에 만들어진 `test_spaces.py`, `test_schedules.py`, `test_places.py`는 깨끗한 clone에 포함되지 않을 수 있다. 이 문서는 예외 규칙으로 추적되게 변경했지만 나머지 기획 문서와 신규 테스트의 저장 정책은 별도로 정리해야 한다.

### P2 — 실제 장소 검색 공급자가 없음

`PLACE_SEARCH_PROVIDER=mock`만 동작한다. 카카오 이름은 스키마에 정의되어 있지만 어댑터와 키 설정, 오류/쿼터 처리, 약관 검토는 미구현이다. → **해소:** 카카오 어댑터(`app/places/providers.py`)가 구현돼 있고 실서버 템플릿도 `kakao`다(2026-10-14 확인).

### P2 — 감사 로그와 도메인 변경이 비원자적임

여러 라우터에서 서비스 commit 후 감사 로그를 별도 commit한다. 필수 감사 대상 작업은 하나의 트랜잭션 경계를 갖도록 서비스 계층으로 합칠지 검토한다.

### P2 — 모델 등록 목록 누락

`DiaryTimelineItem`은 실행상 등록되지만 `app/models.py`에 명시되어 있지 않다. 새 개발자가 등록 지점만 보고 모델 목록을 판단할 때 빠뜨릴 수 있으므로 명시적으로 추가하는 편이 안전하다.

## 15. 다음 백엔드 개발 우선순위

1. Python 가상환경을 재생성하고 PostgreSQL/Redis를 실행해 기존 165개 테스트를 먼저 통과시킨다.
2. 마지막 일기 구조 마이그레이션을 빈 DB와 실제 로컬 DB 양쪽에서 검증한다.
3. P1 권한/기본 스페이스 정책을 제품 담당자와 확정하고 회귀 테스트를 추가한다.
4. `has_diary` 의미를 확정된 복합 일기 구조와 맞춘다.
5. 일기 상세 및 작성자별 본문 API부터 구현한다.
6. 사진 저장소 인터페이스와 로컬 업로드를 구현한 뒤 S3 어댑터를 붙인다.
7. 공용 타임라인 API와 기록 목록 API를 구현한다.
8. 실제 지도 검색 공급자를 연결한다.
9. 감사 로그 트랜잭션과 일기 변경 감사 정책을 정리한다.

## 16. 구현 시 유지해야 할 원칙

- HTTP 처리는 router, 비즈니스 규칙은 service, 접근 권한은 dependency에 둔다.
- 새 오류는 `AppError` 하위 타입과 고정 `code`를 사용한다.
- 날짜만 받는 일정 조회는 서비스 시간대의 하루로 해석하고 DB 시각은 UTC로 유지한다.
- 공유 콘텐츠 접근 권한은 작성자가 아니라 활성 스페이스 멤버십으로 판단한다.
- 일정 장소는 반드시 사용자 정의 순서대로 응답한다.
- 외부 장소 공급자의 원본 응답과 오류를 프론트엔드에 노출하지 않는다.
- 사진 DB 값에는 전체 URL이 아니라 저장 키를 저장한다.
- 작성자별 본문과 공용 사진/타임라인의 경계를 무너뜨리지 않는다.
- 모델 변경 시 모델, `app/models.py`, Alembic, API 스키마, 테스트, 이 문서를 함께 갱신한다.
- 기능마다 성공 사례와 권한/검증 실패 사례를 테스트한다.
- 사용자의 기존 worktree 변경을 덮어쓰지 않는다.

## 17. 자주 쓰는 명령

```powershell
# 가상환경 재생성
py -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt

# 인프라
docker compose up -d db redis pgadmin

# 마이그레이션
alembic heads
alembic current
alembic upgrade head

# API
uvicorn app.main:app --reload

# 테스트
pytest -q
```

Swagger UI는 `http://127.0.0.1:8000/docs`, health check는 `http://127.0.0.1:8000/api/v1/health`다.

## 18. 핵심 소스 지도

새 세션에서 세부 구현을 재검증할 때 우선 읽을 파일:

- 앱 조립과 라우터 순서: `app/main.py`, `app/api/router.py`
- 설정과 저장소 연결: `app/core/config.py`, `app/core/database.py`, `app/core/redis_client.py`
- 공통 오류: `app/core/errors.py`
- 인증 흐름: `app/auth/dependencies.py`, `app/auth/service.py`, `app/auth/session.py`
- 스페이스 권한과 정책: `app/spaces/dependencies.py`, `app/spaces/service.py`, `app/spaces/models.py`
- 일정 권한과 기간 처리: `app/schedules/dependencies.py`, `app/schedules/service.py`, `app/schedules/models.py`
- 장소 순서와 공급자: `app/places/service.py`, `app/places/providers.py`, `app/places/models.py`
- 확정된 일기 데이터 구조: `app/diaries/models.py`
- 전체 모델 등록: `app/models.py`
- 최신 일기 마이그레이션: `alembic/versions/05bedffbec2c_restructure_diary_into_per_author_notes_.py`
- 테스트 환경과 안전장치: `tests/conftest.py`

## 19. 문서 유지 규칙

다음 변화가 있을 때 같은 작업 안에서 이 문서를 갱신한다.

- 새 도메인/라우터/테이블 추가
- 인증·권한 정책 변경
- 일기 구조 또는 기록 화면의 API 계약 변경
- 마이그레이션 head 변경
- 테스트 수나 실행 조건의 중요한 변경
- 알려진 위험 해결 또는 새 위험 발견
- 외부 지도/스토리지 공급자 도입

갱신할 때 상단의 점검 날짜와 기준 커밋도 함께 바꾼다. 아직 검증하지 못한 내용은 완료된 사실처럼 쓰지 않고 반드시 “미검증”으로 표시한다.
