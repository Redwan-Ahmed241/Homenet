@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0.."

echo ===================================================
echo        Prisma - Apply Pending Migrations
echo ===================================================
echo.

if not exist ".env" (
    echo [!] .env file missing. Run setup.bat first.
    pause
    exit /b 1
)

docker compose ps | findstr /i "homenet-service" >nul 2>&1
if errorlevel 1 (
    echo Docker container is not running. Starting stack...
    docker compose up -d
)

echo Applying pending migrations...
docker compose exec homenet-service npx prisma migrate dev

echo.
pause
