Write-Host "Starting PostgreSQL + Redis + pgAdmin..." -ForegroundColor Cyan
# Redis는 웹 세션 저장소다. 없으면 웹 로그인이 동작하지 않는다.
docker compose up -d db redis pgadmin

Write-Host "Activating virtual environment..." -ForegroundColor Cyan
.venv\Scripts\Activate.ps1

Write-Host "Applying database migrations..." -ForegroundColor Cyan
alembic upgrade head

Write-Host "Ready. Starting FastAPI server..." -ForegroundColor Green
uvicorn app.main:app --reload
