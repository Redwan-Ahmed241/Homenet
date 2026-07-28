@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0.."

echo ===================================================
echo        View Docker Logs
echo ===================================================
echo.
echo Select service to log:
echo   1. All services (docker compose logs -f) [Default]
echo   2. NestJS API service (homenet-service)
echo   3. PostgreSQL Database service (homenet-postgres-db)
echo.
set /p CHOICE="Enter choice (1-3) [1]: "

if "%CHOICE%"=="2" (
    docker compose logs -f homenet-service
) else if "%CHOICE%"=="3" (
    docker compose logs -f homenet-postgres-db
) else (
    docker compose logs -f
)

pause
