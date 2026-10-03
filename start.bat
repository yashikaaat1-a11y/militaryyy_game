@echo off
REM TactiComm one-click launcher: installs dependencies, starts backend + frontend, opens the browser.
cd /d "%~dp0"

where python >nul 2>nul || (echo Python not found. Install it from python.org and tick "Add python.exe to PATH". & pause & exit /b 1)
where npm >nul 2>nul || (echo Node.js not found. Install the LTS version from nodejs.org. & pause & exit /b 1)

echo [1/3] Installing backend packages...
python -m pip install -q -r backend\requirements.txt

echo [2/3] Installing frontend packages...
pushd frontend
call npm install --no-audit --no-fund
popd

echo [3/3] Starting TactiComm...
start "TactiComm backend" /D "%~dp0backend" cmd /k python -m uvicorn main:app --port 8000
start "TactiComm frontend" /D "%~dp0frontend" cmd /k npm run dev -- --port 5173 --strictPort

timeout /t 8 /nobreak >nul
start http://localhost:5173
echo TactiComm is running. Close the two server windows to stop it.
