@echo off
echo Starting Agent College (Backend + Frontend)...

:: Start Backend FastAPI server in background window
start "Agent College Backend" cmd /k "cd /d %~dp0backend && .\venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

:: Start Frontend Vite dev server
cd /d %~dp0frontend
npm run dev
