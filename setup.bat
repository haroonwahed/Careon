@echo off
SETLOCAL ENABLEEXTENSIONS
SETLOCAL ENABLEDELAYEDEXPANSION

echo =============================
echo 🛠️ Setting up environment...
echo =============================

:: Ensure Python 3.11 is installed
python --version | findstr "3.11" >nul || (
    echo ❌ Python 3.11 is required.
    python --version
    pause
    exit /b 1
)

:: Create virtual environment if it doesn't exist
IF NOT EXIST venv (
    echo 📦 Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate.bat

:: Upgrade pip & install dependencies
echo 📦 Installing dependencies...
python -m pip install --upgrade pip --no-cache-dir
pip install -r requirements.txt --no-cache-dir

echo ✅ Setup complete.
ENDLOCAL
pause
