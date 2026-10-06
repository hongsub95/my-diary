"""스페이스 API의 요청/응답 스키마."""

import uuid as uuid_module
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.spaces.models import JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH


class SpaceCreateRequest(BaseModel):
    """공유 스페이스 생성 요청."""

    # 명세 7.1: 공백 제거 후 1~30자
    name: str = Field(min_length=1, max_length=30)
    icon: str | None = Field(default=None, max_length=50)

    @field_validator("name")
    @classmethod
    def validate_name_not_blank(cls, value: str) -> str:
        """공백만 입력한 이름을 거르고 앞뒤 공백을 제거한다."""
        stripped = value.strip()
        if not stripped:
            raise ValueError("공간 이름은 공백일 수 없습니다.")
        return stripped


class SpaceUpdateRequest(BaseModel):
    """스페이스 이름·아이콘 수정 요청. 보낸 필드만 변경된다."""

    name: str | None = Field(default=None, min_length=1, max_length=30)
    icon: str | None = Field(default=None, max_length=50)

    @field_validator("name")
    @classmethod
    def validate_name_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("공간 이름은 공백일 수 없습니다.")
        return stripped


class SpaceJoinRequest(BaseModel):
    """참여 번호로 스페이스에 참여하는 요청."""

    join_code: str

    @field_validator("join_code")
    @classmethod
    def normalize_join_code(cls, value: str) -> str:
        """사용자가 눈으로 보고 입력하는 값이라 흔한 입력 편차를 서버에서 흡수한다.

        - 대소문자 구분 없이 받아 대문자로 통일
        - 붙여넣기 과정에서 섞이는 공백과 하이픈 제거

        길이나 문자 집합이 맞지 않아도 여기서 막지 않는다. 형식 오류와 존재하지 않는
        번호를 구분해 응답하면, 그 차이만으로 유효한 형식을 좁혀갈 수 있기 때문이다.
        둘 다 동일하게 INVALID_JOIN_CODE(404)로 응답한다.
        """
        return value.replace("-", "").replace(" ", "").strip().upper()


class TransferOwnershipRequest(BaseModel):
    """소유권 이전 요청."""

    # 넘겨받을 사람의 사용자 id
    user_id: int


class DefaultSpaceUpdateRequest(BaseModel):
    """앱 실행 시 열 기본 스페이스 변경 요청."""

    space_id: uuid_module.UUID


class SpaceResponse(BaseModel):
    """스페이스 응답.

    id는 내부 정수가 아니라 UUID다. 순차 정수를 노출하면 번호를 순서대로 찍어보며
    남의 스페이스를 탐색할 수 있다.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid_module.UUID
    type: str
    name: str
    icon: str | None
    # 개인 스페이스는 초대가 불가능하므로 항상 null이다.
    join_code: str | None
    # 앱 실행 시 열리는 스페이스인지
    is_default: bool
    member_count: int
    # 요청자의 역할: owner | member
    my_role: str
    created_at: datetime


class SpaceListResponse(BaseModel):
    """내가 속한 스페이스 목록."""

    spaces: list[SpaceResponse]


class SpaceMemberResponse(BaseModel):
    """스페이스 멤버 한 명."""

    model_config = ConfigDict(from_attributes=True)

    user_id: int
    nickname: str
    email: EmailStr
    role: str
    joined_at: datetime


class SpaceMemberListResponse(BaseModel):
    """멤버 목록."""

    members: list[SpaceMemberResponse]


class JoinCodeResponse(BaseModel):
    """참여 번호 재발급 응답."""

    join_code: str


# 프론트엔드가 입력 폼에 안내를 띄울 수 있도록 참여 번호 규칙을 함께 노출한다.
JOIN_CODE_RULE = {
    "length": JOIN_CODE_LENGTH,
    "alphabet": JOIN_CODE_ALPHABET,
}
