"""스페이스 비즈니스 로직.

권한 검사는 dependencies.py가 라우터 진입 전에 끝내므로, 여기서는 "권한은 있는데
규칙상 안 되는 경우"(개인 스페이스 삭제, 정원 초과 등)만 판단한다.
"""

import uuid as uuid_module

from sqlalchemy import case, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.spaces.errors import (
    AlreadyMemberError,
    DefaultSpaceCannotBeDeletedError,
    InvalidJoinCodeError,
    MemberNotFoundError,
    OwnerMustTransferError,
    PersonalSpaceError,
    SpaceArchivedError,
    SpaceMemberLimitError,
    SpaceNotFoundError,
)
from app.spaces.models import (
    SHARED_SPACE_MAX_MEMBERS,
    SPACE_MEMBER_STATUS_ACTIVE,
    SPACE_MEMBER_STATUS_LEFT,
    SPACE_MEMBER_STATUS_REMOVED,
    SPACE_ROLE_MEMBER,
    SPACE_ROLE_OWNER,
    SPACE_TYPE_PERSONAL,
    SPACE_TYPE_SHARED,
    Space,
    SpaceMember,
    generate_join_code,
)
from app.spaces.schemas import SpaceMemberResponse, SpaceResponse
from app.users.models import User

# 참여 번호 입력을 1분에 몇 번까지 받을지(API_SPEC 4.5). 참여 번호는 남이 추측해 볼 수
# 있는 값이라, 무작위로 넣어 보며 남의 스페이스에 들어가는 시도를 막아야 한다.
#
# - 계정당 10회: 로그인해야 부를 수 있어 위조할 수 없는, 믿을 수 있는 제한이다. 사람이
#   번호를 잘못 넣어 고쳐 치는 정도로는 닿지 않는다.
# - IP당 30회: 한 컴퓨터에서 계정을 여러 개 만들어 돌리는 것을 막는 보조막이다. 회사나
#   학교처럼 여러 사람이 IP 하나를 함께 쓰는 경우를 생각해 넉넉히 둔다.
JOIN_ATTEMPTS_PER_MINUTE_PER_USER = 10
JOIN_ATTEMPTS_PER_MINUTE_PER_IP = 30

# 참여 번호 생성 재시도 횟수. 8자리 조합이 31^8(약 8.5조)이라 충돌은 사실상 없지만,
# 무한 루프를 막기 위해 상한을 둔다.
JOIN_CODE_MAX_ATTEMPTS = 5


def _count_active_members(db: Session, space_id: int) -> int:
    """스페이스의 활성 멤버 수를 센다."""
    return db.scalar(
        select(func.count())
        .select_from(SpaceMember)
        .where(
            SpaceMember.space_id == space_id,
            SpaceMember.status == SPACE_MEMBER_STATUS_ACTIVE,
        )
    ) or 0


def to_response(db: Session, space: Space, user: User, role: str) -> SpaceResponse:
    """Space 모델을 API 응답 형태로 바꾼다.

    :param role: 요청자의 역할. 이미 알고 있으면 재조회하지 않도록 인자로 받는다.
    """
    return SpaceResponse(
        id=space.uuid,
        type=space.type,
        name=space.name,
        icon=space.icon,
        join_code=space.join_code,
        is_default=user.default_space_id == space.id,
        member_count=_count_active_members(db, space.id),
        my_role=role,
        created_at=space.created_at,
    )


def list_my_spaces(db: Session, user: User) -> list[SpaceResponse]:
    """내가 활성 멤버인 스페이스 목록. 보관된 스페이스는 제외한다.

    개인 스페이스가 항상 먼저 오도록 정렬해, 앱 목록에서 위치가 흔들리지 않게 한다.
    """
    rows = db.execute(
        select(Space, SpaceMember.role)
        .join(SpaceMember, SpaceMember.space_id == Space.id)
        .where(
            SpaceMember.user_id == user.id,
            SpaceMember.status == SPACE_MEMBER_STATUS_ACTIVE,
            Space.archived_at.is_(None),
        )
        # 개인 스페이스를 항상 맨 위에 고정한다. 알파벳 순서에 기대지 않고 명시적으로
        # 지정하는 이유: type 값이 바뀌면 정렬이 조용히 뒤집히기 때문이다.
        .order_by(case((Space.type == SPACE_TYPE_PERSONAL, 0), else_=1), Space.created_at)
    ).all()

    return [to_response(db, space, user, role) for space, role in rows]


def create_shared_space(db: Session, user: User, name: str, icon: str | None) -> SpaceResponse:
    """공유 스페이스를 만들고 생성자를 owner 멤버로 등록한다.

    스페이스만 만들고 멤버십을 빠뜨리면 만든 사람조차 접근할 수 없다. 모든 권한 검사가
    SpaceMember를 보기 때문이다. 그래서 한 트랜잭션으로 묶는다.
    """
    space = Space(
        type=SPACE_TYPE_SHARED,
        name=name,
        icon=icon,
        owner_id=user.id,
        join_code=_generate_unique_join_code(db),
    )
    db.add(space)
    db.flush()

    db.add(
        SpaceMember(
            space_id=space.id,
            user_id=user.id,
            role=SPACE_ROLE_OWNER,
            status=SPACE_MEMBER_STATUS_ACTIVE,
        )
    )
    db.commit()
    db.refresh(space)

    return to_response(db, space, user, SPACE_ROLE_OWNER)


def _generate_unique_join_code(db: Session) -> str:
    """DB에 없는 참여 번호를 만든다.

    UNIQUE 제약이 걸려 있어 충돌 시 INSERT가 실패하므로 미리 확인한다.
    """
    for _ in range(JOIN_CODE_MAX_ATTEMPTS):
        code = generate_join_code()
        exists = db.scalar(select(Space.id).where(Space.join_code == code))
        if exists is None:
            return code
    # 여기 도달하면 난수 생성기나 데이터에 이상이 있는 상황이다.
    raise RuntimeError("참여 번호 생성에 반복 실패했습니다.")


def update_space(db: Session, space: Space, name: str | None, icon: str | None) -> Space:
    """스페이스 이름·아이콘을 수정한다. None인 필드는 건드리지 않는다."""
    if name is not None:
        space.name = name
    if icon is not None:
        space.icon = icon
    db.commit()
    db.refresh(space)
    return space


def archive_space(db: Session, space: Space, user: User) -> None:
    """스페이스를 보관한다(소프트 삭제).

    실제로 지우지 않는 이유: 멤버들이 함께 쌓은 일정·일기·사진이 함께 사라지면
    되돌릴 수 없다. archived_at만 기록해 목록에서 감춘다 (명세 7.4).

    :raises PersonalSpaceError: 개인 스페이스는 탈퇴 전까지 삭제할 수 없다
    :raises DefaultSpaceCannotBeDeletedError: 기본 스페이스로 지정된 경우
    """
    if space.type == SPACE_TYPE_PERSONAL:
        raise PersonalSpaceError("개인 공간은 삭제할 수 없습니다.")

    # 기본 스페이스를 지우면 앱 실행 시 열 곳이 사라진다. 먼저 다른 곳으로 바꾸게 한다.
    if user.default_space_id == space.id:
        raise DefaultSpaceCannotBeDeletedError()

    space.archived_at = func.now()
    reset_defaults_to_personal(db, space.id)
    db.commit()


def reset_defaults_to_personal(db: Session, space_id: int) -> None:
    """이 스페이스를 기본으로 둔 모든 사용자를 각자의 개인 스페이스로 되돌린다.

    :param space_id: 보관되는 스페이스의 내부 id

    스페이스가 보관되는 모든 길에서 부른다 — owner의 삭제(archive_space)와 owner의 계정
    탈퇴(app/users/service.py). 둘 다 다른 멤버가 남아 있어도 보관된다. owner는 남의 기본값을
    바꿀 수 없어서 미리 막을 방법이 없으니, 막는 대신 정리한다. 그대로 두면 그 멤버는 앱을
    열 때 보관된 스페이스를 열려다 실패한다.

    owner가 혼자 남아 나가는 경우(leave_space)는 부르지 않는다. 남은 멤버가 없고, 예전에
    나가거나 내보내진 사람의 기본값은 그때 이미 정리됐다.

    한 스페이스의 멤버는 최대 20명이라 한 명씩 되돌려도 비용이 작다.
    """
    users = db.scalars(select(User).where(User.default_space_id == space_id)).all()
    for affected in users:
        affected.default_space_id = _find_personal_space_id(db, affected.id)


def join_by_code(db: Session, user: User, join_code: str) -> SpaceResponse:
    """참여 번호로 스페이스에 참여한다.

    :raises InvalidJoinCodeError: 없는 번호
    :raises SpaceArchivedError: 보관된 스페이스
    :raises AlreadyMemberError: 이미 활성 멤버
    :raises SpaceMemberLimitError: 정원 초과
    """
    space = db.scalar(select(Space).where(Space.join_code == join_code))
    if space is None:
        raise InvalidJoinCodeError()

    if space.archived_at is not None:
        raise SpaceArchivedError()

    existing = db.scalar(
        select(SpaceMember).where(
            SpaceMember.space_id == space.id,
            SpaceMember.user_id == user.id,
        )
    )
    if existing is not None and existing.status == SPACE_MEMBER_STATUS_ACTIVE:
        raise AlreadyMemberError()

    if _count_active_members(db, space.id) >= SHARED_SPACE_MAX_MEMBERS:
        raise SpaceMemberLimitError(SHARED_SPACE_MAX_MEMBERS)

    if existing is not None:
        # 나갔거나 제거된 이력이 있는 사용자다. (space_id, user_id) UNIQUE 제약 때문에
        # 새 행을 만들 수 없으므로 기존 행을 되살린다.
        existing.status = SPACE_MEMBER_STATUS_ACTIVE
        existing.role = SPACE_ROLE_MEMBER
        existing.left_at = None
    else:
        db.add(
            SpaceMember(
                space_id=space.id,
                user_id=user.id,
                role=SPACE_ROLE_MEMBER,
                status=SPACE_MEMBER_STATUS_ACTIVE,
            )
        )

    try:
        db.commit()
    except IntegrityError:
        # 같은 사용자가 동시에 두 번 참여를 눌러 UNIQUE 제약에 걸린 경우.
        # 결과적으로 이미 멤버이므로 그렇게 응답한다 (명세 12절 동시성 엣지 케이스).
        db.rollback()
        raise AlreadyMemberError()

    db.refresh(space)
    return to_response(db, space, user, SPACE_ROLE_MEMBER)


def regenerate_join_code(db: Session, space: Space) -> str:
    """참여 번호를 새로 발급한다. 이전 번호는 즉시 무효가 된다.

    번호가 외부에 유출됐을 때 쓰는 기능이다 (명세 0절).

    :raises PersonalSpaceError: 개인 스페이스는 참여 번호 자체가 없다
    """
    if space.type == SPACE_TYPE_PERSONAL:
        raise PersonalSpaceError("개인 공간에는 참여 번호가 없습니다.")

    space.join_code = _generate_unique_join_code(db)
    db.commit()
    db.refresh(space)
    return space.join_code


def list_members(db: Session, space: Space) -> list[SpaceMemberResponse]:
    """스페이스의 활성 멤버 목록. owner가 먼저 오도록 정렬한다."""
    rows = db.execute(
        select(SpaceMember, User)
        .join(User, User.id == SpaceMember.user_id)
        .where(
            SpaceMember.space_id == space.id,
            SpaceMember.status == SPACE_MEMBER_STATUS_ACTIVE,
        )
        # owner를 맨 위에 고정한다. role 문자열의 알파벳 순서에 기대지 않는다.
        .order_by(case((SpaceMember.role == SPACE_ROLE_OWNER, 0), else_=1), SpaceMember.joined_at)
    ).all()

    return [
        SpaceMemberResponse(
            user_id=user.id,
            nickname=user.nickname,
            email=user.email,
            role=member.role,
            joined_at=member.joined_at,
        )
        for member, user in rows
    ]


def remove_member(db: Session, space: Space, target_user_id: int, owner_id: int) -> None:
    """owner가 멤버를 내보낸다.

    행을 지우지 않고 status만 바꾸는 이유: 그 사람이 남긴 일정·일기의 작성자 표시가
    깨지지 않게 하기 위해서다 (명세 7.4).

    :raises PersonalSpaceError: 개인 스페이스에는 다른 멤버가 없다
    :raises MemberNotFoundError: 대상이 활성 멤버가 아님
    """
    if space.type == SPACE_TYPE_PERSONAL:
        raise PersonalSpaceError("개인 공간에는 다른 멤버가 없습니다.")

    if target_user_id == owner_id:
        # 자기 자신을 제거하려는 것은 "나가기"에 해당한다. 그쪽 규칙(소유권 이전 확인)을
        # 우회하지 못하도록 여기서 막는다.
        raise OwnerMustTransferError()

    member = db.scalar(
        select(SpaceMember).where(
            SpaceMember.space_id == space.id,
            SpaceMember.user_id == target_user_id,
            SpaceMember.status == SPACE_MEMBER_STATUS_ACTIVE,
        )
    )
    if member is None:
        raise MemberNotFoundError()

    member.status = SPACE_MEMBER_STATUS_REMOVED
    member.left_at = func.now()
    _clear_default_space_if_needed(db, target_user_id, space.id)
    db.commit()


def leave_space(db: Session, space: Space, membership: SpaceMember, user: User) -> bool:
    """스페이스에서 나간다.

    owner일 때의 규칙 (명세 0절 확정):
    - 혼자 남아 있으면 스페이스를 보관하고 나간다
    - 다른 멤버가 있으면 소유권을 먼저 넘겨야 한다

    :raises PersonalSpaceError: 개인 스페이스는 나갈 수 없다
    :raises OwnerMustTransferError: owner인데 다른 멤버가 남아 있음
    :return: 스페이스가 함께 보관됐으면 True
    """
    if space.type == SPACE_TYPE_PERSONAL:
        raise PersonalSpaceError("개인 공간은 나갈 수 없습니다.")

    archived = False
    if membership.role == SPACE_ROLE_OWNER:
        if _count_active_members(db, space.id) > 1:
            raise OwnerMustTransferError()
        # 마지막 멤버이자 owner다. 남는 사람이 없으므로 스페이스도 함께 보관한다.
        space.archived_at = func.now()
        archived = True

    membership.status = SPACE_MEMBER_STATUS_LEFT
    membership.left_at = func.now()
    _clear_default_space_if_needed(db, user.id, space.id)
    db.commit()
    return archived


def transfer_ownership(db: Session, space: Space, current_owner_id: int, new_owner_id: int) -> None:
    """소유권을 다른 활성 멤버에게 넘긴다. 기존 owner는 일반 멤버가 된다.

    :raises MemberNotFoundError: 대상이 활성 멤버가 아님
    """
    if new_owner_id == current_owner_id:
        raise MemberNotFoundError()

    new_owner = db.scalar(
        select(SpaceMember).where(
            SpaceMember.space_id == space.id,
            SpaceMember.user_id == new_owner_id,
            SpaceMember.status == SPACE_MEMBER_STATUS_ACTIVE,
        )
    )
    if new_owner is None:
        raise MemberNotFoundError()

    current_owner = db.scalar(
        select(SpaceMember).where(
            SpaceMember.space_id == space.id,
            SpaceMember.user_id == current_owner_id,
        )
    )

    new_owner.role = SPACE_ROLE_OWNER
    if current_owner is not None:
        current_owner.role = SPACE_ROLE_MEMBER
    # spaces.owner_id도 함께 갱신해야 "사용자 탈퇴 시 그가 소유한 스페이스" 조회가 맞는다.
    space.owner_id = new_owner_id
    db.commit()


def _clear_default_space_if_needed(db: Session, user_id: int, space_id: int) -> None:
    """나가거나 제거된 스페이스가 그 사용자의 기본 스페이스였다면 해제한다.

    그대로 두면 앱 실행 시 접근할 수 없는 스페이스를 열려다 실패한다.
    """
    user = db.get(User, user_id)
    if user is not None and user.default_space_id == space_id:
        user.default_space_id = _find_personal_space_id(db, user_id)


def _find_personal_space_id(db: Session, user_id: int) -> int | None:
    """그 사용자의 개인 스페이스 id. 기본 스페이스를 되돌릴 안전한 기본값이다."""
    return db.scalar(
        select(Space.id).where(
            Space.owner_id == user_id,
            Space.type == SPACE_TYPE_PERSONAL,
        )
    )


def set_default_space(db: Session, user: User, space_uuid: uuid_module.UUID) -> SpaceResponse:
    """앱 실행 시 열 기본 스페이스를 바꾼다.

    자기가 멤버가 아닌 스페이스를 기본값으로 지정하지 못하도록 멤버십을 확인한다.

    :raises SpaceNotFoundError: 없거나 활성 멤버가 아님
    """
    row = db.execute(
        select(Space, SpaceMember.role)
        .join(SpaceMember, SpaceMember.space_id == Space.id)
        .where(
            Space.uuid == space_uuid,
            SpaceMember.user_id == user.id,
            SpaceMember.status == SPACE_MEMBER_STATUS_ACTIVE,
            Space.archived_at.is_(None),
        )
    ).first()

    if row is None:
        raise SpaceNotFoundError()

    space, role = row
    user.default_space_id = space.id
    db.commit()
    db.refresh(user)

    return to_response(db, space, user, role)
