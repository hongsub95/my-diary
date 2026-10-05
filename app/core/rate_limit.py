"""사용자별 호출 횟수 제한.

외부 API를 여러 번 부르는 엔드포인트(코스 추천 미리보기 등)가 쿼터를 다 써 버리지 않게
막는다. **화면의 버튼 비활성화로는 부족하다.** 화면이 막는 것은 "요청이 도는 동안 또
누르기"뿐이다. 결과가 나올 때마다 다시 누르는 것은 화면 입장에선 정상이고, 화면을 거치지
않고 API를 직접 부르면 화면 쪽 장치는 아무 소용이 없다. 서버가 스스로 지키는 마지막 줄이다.

방식은 1분 단위 고정 창(fixed window)이다. 키에 "몇 번째 분인지"를 넣어 분마다 새 키를
쓴다. 처음 셀 때만 만료 시간을 거는 방식은, 그 사이 서버가 죽으면 만료 없는 키가 남아
그 사용자가 영원히 막힌다. 분마다 새 키에 매번 만료를 걸면 그런 키가 생길 수 없다.

고정 창은 창 경계에서 최대 두 배까지 통과시킨다(59초에 10번, 61초에 10번). 쿼터를 지키는
목적에는 이 정도 오차면 충분하고, 더 정확한 방식(슬라이딩 창)은 Redis 명령이 늘어난다.
"""

import logging
import time
from typing import Callable

import redis
from fastapi import status

from app.core.errors import AppError

logger = logging.getLogger(__name__)

WINDOW_SECONDS = 60


class RateLimitedError(AppError):
    """짧은 시간에 너무 많이 부른 경우.

    남은 시간은 알려주지 않는다. 로그인 잠금과 같은 방침이다 — 언제 풀리는지 알려주면
    자동화된 호출이 정확히 그 시각에 맞춰 다시 몰려온다.
    """

    def __init__(self) -> None:
        super().__init__(
            code="TOO_MANY_REQUESTS",
            message="요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.",
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        )


def enforce(
    client: redis.Redis,
    scope: str,
    subject: int | str,
    limit: int,
    clock: Callable[[], float] = time.time,
) -> None:
    """이번 호출을 센다. 이번 분의 한도를 넘었으면 거절한다.

    :param client: Redis 클라이언트
    :param scope: 무엇을 세는지. 엔드포인트마다 따로 센다 (예: "course-preview")
    :param subject: 누구의 호출인지. 사용자 id, 또는 IP처럼 계정 밖의 단위도 된다.
        같은 scope 안에서 사용자와 IP를 함께 셀 때는 scope에 구분을 붙인다
        (예: "space-join:user", "space-join:ip") — 사용자 id 7과 IP가 같은 키를 쓰면 안 된다
    :param limit: 1분에 허용할 횟수
    :param clock: 현재 시각(초). 테스트에서 분을 넘기려고 바꿔 끼운다
    :raises RateLimitedError: 한도를 넘었을 때

    **Redis에 닿지 못하면 막지 않고 통과시킨다.** 이 제한은 쿼터를 지키는 보호막이지 기능의
    일부가 아니다. 앱(JWT) 사용자는 원래 Redis 없이도 쓸 수 있는데, 보호막이 고장 났다고
    추천 기능 자체를 멈추면 주객이 바뀐다. 대신 경고를 남겨 고장을 알 수 있게 한다.
    """
    window = int(clock() // WINDOW_SECONDS)
    key = f"rate:{scope}:{subject}:{window}"
    try:
        pipe = client.pipeline()
        pipe.incr(key)
        # 창 길이의 두 배로 둔다. 창이 끝나자마자 지우지 않아도 되고, 시계가 조금 어긋나도
        # 세던 키가 도중에 사라지지 않는다.
        pipe.expire(key, WINDOW_SECONDS * 2)
        count, _ = pipe.execute()
    except redis.RedisError as error:
        logger.warning("Rate limit check skipped (redis unavailable): %s", error)
        return

    if count > limit:
        raise RateLimitedError()
