@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0.."

echo ===================================================
echo        Prisma - Create & Apply Migration
echo ===================================================
echo.

if not exist ".env" (
    echo [!] .env file missing. Run setup.bat first.
    pause
    exit /b 1
)

:: Check if homenet-service container is running
docker compose ps | findstr /i "homenet-service" >nul 2>&1
if errorlevel 1 (
    echo Docker container is not running. Starting stack...
    docker compose up -d
)

:GET_NAME
set "MIG_NAME="
set /p MIG_NAME="Enter migration name (e.g. add_user_role): "

if "%MIG_NAME%"=="" (
    echo [!] Migration name cannot be empty. Please try again.
    goto GET_NAME
)

echo.
echo Running: npx prisma migrate dev --name %MIG_NAME%
docker compose exec homenet-service npx prisma migrate dev --name %MIG_NAME%

echo.
echo Done! Don't forget to commit the new files in prisma/migrations/ to Git.
pause
