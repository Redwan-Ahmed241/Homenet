@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0.."

echo ===================================================
echo        Homenet API - Start Docker Stack
echo ===================================================
echo.

if not exist ".env" (
    echo [!] .env file not found. Creating .env from .env.example...
    copy ".env.example" ".env" >nul
    echo.
    echo Please update your .env file and press ENTER to continue.
    pause
)

echo Select start mode:
echo   1. Background mode (docker compose up -d) [Default]
echo   2. Foreground mode with live logs (docker compose up)
echo   3. Rebuild containers and start (docker compose up --build -d)
echo.
set /p CHOICE="Enter choice (1-3) [1]: "

if "%CHOICE%"=="2" (
    docker compose up
) else if "%CHOICE%"=="3" (
    docker compose up --build -d
) else (
    docker compose up -d
)

echo.
pause
