"""사용자 설정 API의 오류 정의."""

from fastapi import status

from app.core.errors import AppError


class InvalidCurrentPasswordError(AppError):
    """비밀번호 변경 시 현재 비밀번호가 틀린 경우.

    401이 아니라 422를 쓴다. 요청자는 이미 로그인해 있으므로 "인증이 안 됐다"는 뜻이
    아니고, 클라이언트의 401 처리(토큰 재발급 후 재시도, 실패하면 로그아웃)가 엉뚱하게
    돌면 비밀번호를 잘못 친 사용자가 로그아웃된다. field로 어느 칸이 틀렸는지 알려준다.
    """

    def __init__(self) -> None:
        super().__init__(
            code="INVALID_CURRENT_PASSWORD",
            message="현재 비밀번호가 올바르지 않습니다.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            field="current_password",
        )


class SamePasswordError(AppError):
    """새 비밀번호가 기존과 같은 경우.

    막는 이유: 바꿨다고 생각했는데 아무것도 바뀌지 않는 상황을 방지한다. 다른 세션을
    끊는 부작용만 일어나고 보안상 나아지는 것이 없다.
    """

    def __init__(self) -> None:
        super().__init__(
            code="SAME_PASSWORD",
            message="기존과 다른 비밀번호를 입력해 주세요.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            field="new_password",
        )
