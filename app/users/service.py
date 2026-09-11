"""사용자 설정 로직.

로그인한 사람이 자기 계정을 바꾸는 일만 다룬다. 로그인·회원가입은 app/auth가 담당한다.
"""

import redis
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import security, session as session_store
from app.auth.service import NicknameAlreadyExistsError
from app.users.errors import InvalidCurrentPasswordError, SamePasswordError
from app.users.models import User


def update_profile(db: Session, user: User, nickname: str) -> User:
    """닉네임을 바꾼다.

    :raises NicknameAlreadyExistsError: 다른 사람이 이미 쓰는 닉네임일 때 (409)

    자기 닉네임을 그대로 다시 저장하는 것은 막지 않는다. 화면에서 다른 값을 고치다가
    닉네임을 건드리지 않고 저장하는 경우가 흔하다.
    """
    if nickname != user.nickname:
        taken = db.scalar(select(User.id).where(User.nickname == nickname))
        if taken is not None:
            raise NicknameAlreadyExistsError()

    user.nickname = nickname
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
