@echo off
setlocal enabledelayedexpansion

:: Navigate to project root
cd /d "%~dp0.."

echo ===================================================
echo        Homenet API - Docker Setup Script
echo ===================================================
echo.

:: Step 1: Check .env file
if not exist ".env" (
    echo [1/4] .env file not found. Creating .env from .env.example...
    copy ".env.example" ".env" >nul
    if errorlevel 1 (
        echo [ERROR] Failed to copy .env.example to .env.
        pause
        exit /b 1
    )
    echo.
    echo ================================================================
    echo [ACTION REQUIRED] .env file created!
    echo Please open the .env file and set your credentials (JWT secret, Cloudinary, etc.).
    echo ================================================================
    echo.
    pause
) else (
    echo [1/4] .env file exists.
)

echo.
echo [2/4] Checking Docker status...
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running. Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo.
echo [3/4] Building and starting Docker containers...
docker compose up --build -d
if errorlevel 1 (
    echo [ERROR] Failed to start Docker compose stack.
    pause
    exit /b 1
)

echo.
echo [4/4] Applying Prisma migrations and seeding database...
echo Running migrations...
docker compose exec homenet-service npx prisma migrate dev
if errorlevel 1 (
    echo [WARNING] Migration command exited with errors.
)

echo Running database seed...
docker compose exec homenet-service npx prisma db seed
if errorlevel 1 (
    echo [WARNING] Seed command exited with errors.
)

echo.
echo ===================================================
echo [SUCCESS] Setup complete!
echo API is running at: http://localhost:3000
echo Swagger Docs:      http://localhost:3000/api/docs
echo ===================================================
echo.
pause
