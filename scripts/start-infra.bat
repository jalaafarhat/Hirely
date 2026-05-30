@echo off
echo Starting Hirely infrastructure...
docker info >nul 2>&1
if errorlevel 1 (
  echo.
  echo ERROR: Docker Desktop is not running.
  echo 1. Open Docker Desktop and wait until it says "Engine running"
  echo 2. Run this script again
  exit /b 1
)

docker compose up -d postgres redis
if errorlevel 1 exit /b 1

echo.
echo Waiting for PostgreSQL...
timeout /t 5 /nobreak >nul

echo.
echo Infrastructure ready.
echo   PostgreSQL: localhost:5433
echo   Redis:      localhost:6380
echo.
echo Next: cd backend && npm run start:dev
echo       cd frontend && npm start
