@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0.."

echo ===================================================
echo        Wipe Database & Fresh Start
echo ===================================================
echo.
echo [WARNING] This will completely delete the PostgreSQL database volume
echo and all stored data!
echo.
set /p CONFIRM="Are you sure you want to proceed? (y/n): "

if /i not "%CONFIRM%"=="y" (
    echo Operation cancelled.
    pause
    exit /b 0
)

echo.
echo [1/3] Stopping stack and removing database volume...
docker compose down -v

echo.
echo [2/3] Starting stack...
docker compose up -d

echo.
echo [3/3] Running migrations and seeding fresh database...
docker compose exec homenet-service npx prisma migrate dev
docker compose exec homenet-service npx prisma db seed

echo.
echo ===================================================
echo [SUCCESS] Database wiped and re-seeded successfully!
echo ===================================================
pause
