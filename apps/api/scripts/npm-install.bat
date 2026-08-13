@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0.."

echo ===================================================
echo        npm - Install Package in Container
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

:GET_PKG
set "PKG_NAME="
set /p PKG_NAME="Enter package name to install (e.g. axios): "

if "%PKG_NAME%"=="" (
    echo [!] Package name cannot be empty.
    goto GET_PKG
)

set /p IS_DEV="Install as dev dependency? (y/n) [n]: "

if /i "%IS_DEV%"=="y" (
    echo Running: npm install --save-dev %PKG_NAME% inside container...
    docker compose exec homenet-service npm install --save-dev %PKG_NAME%
) else (
    echo Running: npm install %PKG_NAME% inside container...
    docker compose exec homenet-service npm install %PKG_NAME%
)

echo.
set /p REBUILD="Rebuild container to bake new lockfile into Docker image? (y/n) [y]: "
if /i "%REBUILD%"=="n" (
    echo Skipping rebuild.
) else (
    echo Rebuilding container...
    docker compose down
    docker compose up --build -d
)

echo.
echo Done! Remember to commit package.json and package-lock.json to Git.
pause
