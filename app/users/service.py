"""사용자 설정 로직.

로그인한 사람이 자기 계정을 바꾸는 일만 다룬다. 로그인·회원가입은 app/auth가 담당한다.
"""

import redis
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import security, session as session_store
from app.auth.service import NicknameAlreadyExistsError
from app.spaces.models import (
    SPACE_MEMBER_STATUS_ACTIVE,
    SPACE_MEMBER_STATUS_LEFT,
    SPACE_ROLE_OWNER,
    Space,
    SpaceMember,
)
from app.users.errors import InvalidCurrentPasswordError, SamePasswordError
from app.users.models import USER_NOT_IN_USE, User


def update_profile(
    db: Session,
    user: User,
    nickname: str | None = None,
    theme_key: str | None = None,
) -> User:
    """프로필을 수정한다. None인 필드는 건드리지 않는다.

    :param nickname: 새 닉네임. 스키마에서 형식 검증 완료
    :param theme_key: 새 테마 색상 키. 스키마에서 허용 값 검증 완료
    :raises NicknameAlreadyExistsError: 다른 사람이 이미 쓰는 닉네임일 때 (409)

    자기 닉네임을 그대로 다시 저장하는 것은 막지 않는다. 화면에서 다른 값을 고치다가
    닉네임을 건드리지 않고 저장하는 경우가 흔하다.

    닉네임 중복은 여기서 보지만 경합까지 막지는 못한다. 두 사람이 같은 닉네임으로 동시에
    저장하면 둘 다 검사를 통과하고 뒤에 커밋한 쪽이 DB의 UNIQUE 제약에 걸린다. 지금은
    닉네임을 바꾸는 빈도가 낮아 그대로 두지만, 여기서 409가 아니라 500이 날 수 있다는
    뜻이다.
    """
    if nickname is not None and nickname != user.nickname:
        taken = db.scalar(select(User.id).where(User.nickname == nickname))
        if taken is not None:
            raise NicknameAlreadyExistsError()

    if nickname is not None:
        user.nickname = nickname
    if theme_key is not None:
        user.theme_key = theme_key

    db.commit()
    db.refresh(user)
    return user


def change_password(
    db: Session,
    redis_client: redis.Redis,
    user: User,
    current_password: str,
    new_password: str,
    keep_session_id: str | None,
) -> int:
    """비밀번호를 바꾸고, 지금 쓰는 기기를 뺀 나머지 웹 세션을 끊는다.

    :param keep_session_id: 유지할 세션 ID. 지금 요청이 웹 세션으로 들어왔으면 그 값,
        앱(JWT)이면 None
    :raises InvalidCurrentPasswordError: 현재 비밀번호가 틀릴 때
    :raises SamePasswordError: 새 비밀번호가 기존과 같을 때
    :return: 끊어낸 다른 세션 수

    **다른 세션을 끊는 이유**: 비밀번호를 바꾸는 상황은 대개 "누가 내 계정을 보고 있는 것
    같다"이다. 그때 이미 로그인된 남의 기기가 그대로 살아 있으면 바꾼 의미가 없다.
    지금 기기까지 끊으면 사용자가 방금 바꾸고 로그아웃되므로 그것만 남긴다.

    **앱(JWT)은 이 호출로 끊기지 않는다.** 무상태라 서버가 회수할 수 없고, 토큰이 만료될
    때까지 유효하다. 강제 로그아웃이 필요해지면 refresh token을 저장소에 두는 방식으로
    바꿔야 한다(docs/DEVELOPMENT_BRIEF.md 12절의 열린 결정).
    """
    if not security.verify_password(current_password, user.password_hash):
        raise InvalidCurrentPasswordError()
    if security.verify_password(new_password, user.password_hash):
        raise SamePasswordError()

    user.password_hash = security.hash_password(new_password)
    db.commit()

    removed = 0
    for item in session_store.list_user_sessions(redis_client, user.id):
        session_id = item["session_id"]
        if session_id == keep_session_id:
            continue
        session_store.delete_session(redis_client, session_id)
        removed += 1
    return removed


def delete_account(
    db: Session,
    redis_client: redis.Redis,
    user: User,
    current_password: str,
) -> dict[str, int]:
    """계정을 탈퇴 처리한다.

    :param current_password: 재인증용 비밀번호. 화면에서 확인 절차를 거쳤더라도
        서버가 다시 본인인지 확인한다
    :raises InvalidCurrentPasswordError: 비밀번호가 틀릴 때 (422)
    :return: 감사 로그에 남길 처리 건수
        (`archived_spaces`, `left_spaces`, `revoked_sessions`)

    **행을 지우지 않는다.** `use`를 0으로 내리고 `deleted_at`을 남긴다. 지워버리면
    그 사람이 남긴 일기·사진·일정의 작성자를 되짚을 수 없고, "탈퇴한 작성자의 항목은
    읽기 전용으로 보존한다"는 정책(docs/SPACE_MODEL_SPEC.md 13절)을 지킬 수 없다.

    **이메일과 닉네임은 계속 점유된다.** 행이 남아 있어 UNIQUE 제약이 그대로 걸리기
    때문이다. 같은 이메일로 다시 가입하려 하면 409가 난다. 되살리기(복구) 기능이
    생긴다면 이 점이 오히려 전제가 된다.

    **소유한 스페이스는 함께 보관된다.** 남은 멤버가 있어도 마찬가지다
    (같은 문서 7.4절). 그래서 탈퇴 화면은 무엇이 사라지는지 먼저 경고해야 한다.
    """
    if not security.verify_password(current_password, user.password_hash):
        raise InvalidCurrentPasswordError()

    archived_spaces = 0
    left_spaces = 0

    memberships = db.scalars(
        select(SpaceMember).where(
            SpaceMember.user_id == user.id,
            SpaceMember.status == SPACE_MEMBER_STATUS_ACTIVE,
        )
    ).all()

    for membership in memberships:
        if membership.role == SPACE_ROLE_OWNER:
            space = db.get(Space, membership.space_id)
            # 이미 보관된 스페이스를 다시 건드리면 보관 시각이 지금으로 밀린다.
            if space is not None and space.archived_at is None:
                space.archived_at = func.now()
                archived_spaces += 1
        else:
            left_spaces += 1

        # owner든 아니든 본인 멤버십은 정리한다. 스페이스가 나중에 복구되더라도
        # 탈퇴한 사람이 멤버로 되살아나면 안 된다.
        membership.status = SPACE_MEMBER_STATUS_LEFT
        membership.left_at = func.now()

    user.use = USER_NOT_IN_USE
    user.deleted_at = func.now()
    # 기본 스페이스는 방금 보관됐다. 값을 남겨두면 "삭제된 스페이스를 가리키는 기본값"이
    # 되어, 복구 기능을 만들 때 열 수 없는 곳을 가리키는 상태로 되살아난다.
    user.default_space_id = None

    db.commit()

    # 세션은 DB 커밋이 끝난 뒤에 지운다. 순서를 뒤집으면 커밋이 실패했을 때 멀쩡한
    # 계정의 로그인만 끊어진다. 여기는 지금 쓰는 세션까지 전부 지운다 —
    # 비밀번호 변경과 달리 남겨둘 세션이 없다.
    revoked_sessions = session_store.delete_all_user_sessions(redis_client, user.id)

    return {
        "archived_spaces": archived_spaces,
        "left_spaces": left_spaces,
        "revoked_sessions": revoked_sessions,
    }
