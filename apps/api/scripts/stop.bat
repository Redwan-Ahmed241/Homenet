@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0.."

echo ===================================================
echo        Homenet API - Stop Docker Stack
echo ===================================================
echo.
echo Select stop option:
echo   1. Stop stack (preserve database data) [Default]
echo   2. Stop stack AND wipe database volume (fresh start)
echo.
set /p CHOICE="Enter choice (1-2) [1]: "

if "%CHOICE%"=="2" (
    echo Stopping containers and deleting pgdata volume...
    docker compose down -v
) else (
    echo Stopping containers...
    docker compose down
)

echo.
pause
