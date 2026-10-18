Write-Host "Starting Agent College (Backend + Frontend)..." -ForegroundColor Cyan

# Launch backend in a separate terminal process
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; .\venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

# Launch frontend in current window
Set-Location frontend
npm run dev
