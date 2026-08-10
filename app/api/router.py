from fastapi import APIRouter

from app.api.v1.health import router as health_router
from app.auth.router import router as auth_router
from app.auth.web_router import router as auth_web_router
from app.menus.router import router as menus_router
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
api_router.include_router(schedules_router)
api_router.include_router(users_router)
