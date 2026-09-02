from fastapi import APIRouter

from app.api.v1.health import router as health_router
from app.auth.router import router as auth_router
from app.auth.web_router import router as auth_web_router
from app.diaries.photo_router import (
    photos_router as diary_photos_router,
    schedule_photos_router,
)
from app.diaries.router import router as diaries_router
from app.menus.router import router as menus_router
from app.places.router import (
    places_router,
    schedule_places_router,
)
from app.schedules.router import (
    schedules_router,
    space_schedules_router,
)
from app.spaces.router import router as spaces_router
from app.users.router import router as users_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health_router)
# 앱용(JWT) 라우터가 /auth, 웹용(세션) 라우터가 /auth/web을 담당한다.
api_router.include_router(auth_router)
api_router.include_router(auth_web_router)
api_router.include_router(menus_router)
api_router.include_router(spaces_router)
# 일정은 경로가 두 갈래다. /spaces/{space_id}/schedules 는 spaces_router 뒤에 등록해야
# /spaces/join 같은 고정 경로가 {space_id}로 먼저 잡히지 않는다.
api_router.include_router(space_schedules_router)
# /schedules/{id}/places 는 schedules_router보다 먼저 등록해야
# /schedules/{schedule_id} 상세 경로에 흡수되지 않는다.
api_router.include_router(schedule_places_router)
api_router.include_router(schedules_router)
api_router.include_router(places_router)
# 일기도 /schedules/{id} 아래에 붙는다. 장소와 마찬가지로 경로가 겹치지 않아 순서에
# 민감하지 않지만, 일정 상세(/schedules/{schedule_id})보다 뒤에 둔다.
api_router.include_router(diaries_router)
api_router.include_router(schedule_photos_router)
api_router.include_router(diary_photos_router)
api_router.include_router(users_router)
