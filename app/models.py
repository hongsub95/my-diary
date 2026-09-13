"""모든 SQLAlchemy 모델을 한 번에 불러오는 등록 지점.

SQLAlchemy는 relationship()에 적힌 "Schedule" 같은 문자열을 실제 클래스로 바꿀 때
자신의 레지스트리에서 찾는다. 그런데 클래스는 해당 모듈이 import될 때 비로소
레지스트리에 등록되므로, 일부 모델만 import된 상태에서는 관계 해석이 실패한다.

예를 들어 인증 API만 호출해도 Space -> Schedule 관계를 해석해야 하는데, auth 쪽에서
Schedule을 import할 이유가 없어 "failed to locate a name ('Schedule')" 오류가 난다.

그래서 이 모듈이 모든 모델을 한 번에 import하고, 앱 시작 지점과 alembic이 이 모듈만
불러오면 되도록 만든다. 새 모델을 추가하면 여기에도 추가해야 한다.
"""

from app.audit.models import AuditLog
from app.diaries.models import DiaryEntry, DiaryPhoto
from app.legal.models import UserConsent
from app.menus.models import Menu
from app.places.models import Place, SchedulePlace
from app.schedules.models import Schedule, ScheduleParticipant, ShareLink
from app.spaces.models import Space, SpaceMember
from app.users.models import User

__all__ = [
    "AuditLog",
    "DiaryEntry",
    "DiaryPhoto",
    "Menu",
    "Place",
    "Schedule",
    "SchedulePlace",
    "ScheduleParticipant",
    "ShareLink",
    "Space",
    "SpaceMember",
    "User",
    "UserConsent",
]
