"""스페이스 접근 권한을 확인하는 FastAPI 의존성.

앞으로 만들 일정·장소·일기 API도 전부 이 의존성을 거친다. 접근 판정 규칙을 한 곳에
모아두지 않으면 엔드포인트마다 조금씩 다르게 검사하게 되고, 그 틈으로 권한 구멍이 생긴다.

핵심 규칙 (docs/SPACE_MODEL_SPEC.md 11절):
**"이 일정을 만든 사람인가"가 아니라 "이 스페이스의 활성 멤버인가"로 판단한다.**
"""

import uuid as uuid_module
from typing import Annotated

from fastapi import Depends, Path
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUser, DbSession
from app.spaces.errors import SpaceForbiddenError, SpaceNotFoundError
from app.spaces.models import (
    SPACE_MEMBER_STATUS_ACTIVE,
    SPACE_ROLE_OWNER,
    Space,
    SpaceMember,
)
from app.users.models import User


def get_active_membership(db: Session, space: Space, user_id: int) -> SpaceMember | None:
    """사용자가 그 스페이스의 활성 멤버인지 확인하고 멤버십을 돌려준다.

    나갔거나(left) 제거된(removed) 멤버십은 행이 남아 있어도 접근 권한이 없으므로
    status를 반드시 함께 확인한다.

    :return: 활성 멤버십. 아니면 None
    """
    return db.scalar(
        select(SpaceMember).where(
            SpaceMember.space_id == space.id,
            SpaceMember.user_id == user_id,
            SpaceMember.status == SPACE_MEMBER_STATUS_ACTIVE,
        )
    )


def _load_space_for_member(db: Session, space_uuid: uuid_module.UUID, user: User) -> tuple[Space, SpaceMember]:
    """UUID로 스페이스를 찾고 요청자가 활성 멤버인지 확인한다.

    스페이스가 없을 때와 멤버가 아닐 때 모두 같은 404를 낸다. 구분하면 UUID를
    바꿔가며 찔러보는 것만으로 스페이스의 실재 여부를 알아낼 수 있기 때문이다.

    :raises SpaceNotFoundError: 없거나 멤버가 아닐 때
    """
    space = db.scalar(select(Space).where(Space.uuid == space_uuid))
    if space is None:
        raise SpaceNotFoundError()

    membership = get_active_membership(db, space, user.id)
    if membership is None:
        raise SpaceNotFoundError()

    return space, membership


class SpaceContext:
    """권한 검사를 통과한 요청의 스페이스 정보 묶음.

    라우터가 space와 membership을 각각 다시 조회하지 않도록 함께 전달한다.
    """

    def __init__(self, space: Space, membership: SpaceMember) -> None:
        self.space = space
        self.membership = membership

    @property
    def is_owner(self) -> bool:
        """요청자가 이 스페이스의 owner인지."""
        return self.membership.role == SPACE_ROLE_OWNER


def require_member(
    space_id: Annotated[uuid_module.UUID, Path(description="스페이스 UUID")],
    current_user: CurrentUser,
    db: DbSession,
) -> SpaceContext:
    """활성 멤버이기만 하면 통과시킨다. 조회·콘텐츠 생성 API에서 사용한다."""
    space, membership = _load_space_for_member(db, space_id, current_user)
    return SpaceContext(space, membership)


def require_owner(
    space_id: Annotated[uuid_module.UUID, Path(description="스페이스 UUID")],
    current_user: CurrentUser,
    db: DbSession,
) -> SpaceContext:
    """owner만 통과시킨다. 설정 변경·멤버 제거·삭제 API에서 사용한다.

    멤버가 아니면 404(존재를 숨김), 멤버지만 owner가 아니면 403을 낸다.
    후자는 이미 스페이스의 존재를 아는 상태라 숨길 것이 없다.
    """
    space, membership = _load_space_for_member(db, space_id, current_user)
    context = SpaceContext(space, membership)
    if not context.is_owner:
        raise SpaceForbiddenError("공간 주인만 할 수 있는 작업입니다.")
    return context


# 라우터에서 반복해 쓰는 타입 별칭.
MemberContext = Annotated[SpaceContext, Depends(require_member)]
OwnerContext = Annotated[SpaceContext, Depends(require_owner)]
