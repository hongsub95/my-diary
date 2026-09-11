"""사용자 설정 API의 요청 스키마.

응답은 인증 쪽 `UserResponse`를 그대로 쓴다. 같은 사용자를 두 가지 형태로 내보내면
클라이언트가 화면마다 다른 모양을 다뤄야 한다.
"""

from pydantic import BaseModel, Field, field_validator

from app.auth.schemas import (
    MAX_NICKNAME_LENGTH,
    MIN_NICKNAME_LENGTH,
    validate_nickname_rules,
    validate_password_rules,
)
from app.users.models import SUPPORTED_THEME_KEYS


class ProfileUpdateRequest(BaseModel):
    """프로필 수정 요청. **보낸 필드만 변경된다.**

    이메일은 로그인 수단이라 바꾸려면 본인 확인 절차가 따로 필요하고, 그 절차가
    정해지기 전까지는 열지 않는다.

    두 필드를 모두 선택으로 둔 이유: 테마는 프로필 화면이 아니라 테마 화면에서 바꾸고,
    닉네임은 프로필 화면에서 바꾼다. 서로 다른 화면이 같은 엔드포인트를 쓰는데 한쪽이
    필수면, 테마만 바꾸려는 요청이 닉네임을 같이 실어 보내야 한다. 그러면 그 사이 다른
    기기에서 바꾼 닉네임을 옛 값으로 덮어쓰게 된다.
    """

    nickname: str | None = Field(
        default=None,
        description=f"{MIN_NICKNAME_LENGTH}~{MAX_NICKNAME_LENGTH}자. 앞뒤 공백은 서버가 제거한다",
    )
    theme_key: str | None = Field(
        default=None,
        description=f"테마 색상 키. {', '.join(SUPPORTED_THEME_KEYS)} 중 하나",
    )

    @field_validator("nickname")
    @classmethod
    def validate_nickname(cls, value: str | None) -> str | None:
        """닉네임이 회원가입과 같은 규칙을 지키는지 본다.

        :param value: 사용자가 입력한 닉네임. 보내지 않았으면 None
        :raises ValueError: 규칙을 어겼을 때. 문구는 화면에 그대로 노출된다

        규칙을 회원가입과 공유한다. 여기만 느슨하면 가입 때 막혔던 닉네임이 수정으로는
        통과한다. 비밀번호도 같은 이유로 규칙을 공유한다.
        """
        if value is None:
            return None
        return validate_nickname_rules(value)

    @field_validator("theme_key")
    @classmethod
    def validate_theme_key(cls, value: str | None) -> str | None:
        """지원하는 테마 키인지 본다.

        :param value: 고른 테마 키. 보내지 않았으면 None
        :raises ValueError: 지원하지 않는 키일 때

        조회할 때(normalize_theme_key)는 모르는 키를 조용히 기본값으로 바꾸지만, 저장할
        때는 거절한다. 오타나 낡은 클라이언트가 보낸 값을 소리 없이 다른 값으로 바꿔
        저장하면, 사용자는 고른 것과 다른 색을 보면서 이유를 알 수 없다.
        """
        if value is None:
            return None
        if value not in SUPPORTED_THEME_KEYS:
            raise ValueError("지원하지 않는 테마입니다.")
        return value


class PasswordChangeRequest(BaseModel):
    """비밀번호 변경 요청.

    현재 비밀번호를 함께 받는 이유: 로그인한 기기를 잠깐 빌린 사람이 비밀번호를 바꿔
    계정을 통째로 가져가는 것을 막는다. 토큰이나 세션만으로는 "지금 이 사람이 주인인지"를
    확인할 수 없다.
    """

    current_password: str
    new_password: str = Field(description="회원가입과 같은 규칙을 따른다")

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        """새 비밀번호가 가입 때와 같은 규칙을 지키는지 본다.

        :param value: 새 비밀번호 평문
        :raises ValueError: 규칙을 어겼을 때. 문구는 화면에 그대로 노출된다

        규칙을 회원가입과 공유한다. 여기만 느슨하면 가입은 막혔던 비밀번호가 변경으로는
        통과해, 정책이 있으나 마나 한 상태가 된다.
        """
        return validate_password_rules(value)


class AccountDeleteRequest(BaseModel):
    """계정 탈퇴 요청.

    비밀번호를 받는 이유는 비밀번호 변경과 같다. 로그인된 기기를 잠깐 빌린 사람이
    계정을 지워버리는 것을 막는다. 되돌리기 어려운 동작일수록 재인증이 필요하다
    (docs/BOTTOM_NAVIGATION_SPEC.md 6.5절).

    새 비밀번호와 달리 규칙 검사를 하지 않는다. 여기 오는 값은 이미 저장된 비밀번호와
    맞는지만 보면 되고, 규칙이 바뀌기 전에 만든 계정은 지금 규칙을 통과하지 못할 수도
    있다. 그런 계정이 탈퇴조차 못 하게 되면 안 된다.
    """

    current_password: str
