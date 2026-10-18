# How to Run Agent College Platform

This project is a multi-tenant AI campus orchestrator and administrative platform built with FastAPI, LangGraph/LangChain, ChromaDB, and React (Vite + TypeScript).

---

## 1. Prerequisites

- **Python**: 3.10 or 3.11+
- **Node.js**: v18+ and npm
- **Gemini API Key**: Set as an environment variable (`GEMINI_API_KEY`)

---

## 2. Quick Setup

### A. Environment Configuration

In the `backend/` directory, create or edit `.env`:

```env
GEMINI_API_KEY="your-google-gemini-api-key"
```

---

### B. Backend Setup (FastAPI & Vector DB)

1. Open a terminal and navigate to `backend/`:
   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:
   - **Windows (PowerShell)**:
     ```powershell
     python -m venv venv
     .\venv\Scripts\activate
     ```
   - **macOS / Linux**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. Install required packages:
   ```bash
   pip install -r requirements.txt
   ```

4. *(Optional - only needed if building vectors from scratch)*:
   ```bash
   python -m app.indexer
   ```

5. Start the backend server:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

Backend will be active at: `http://localhost:8000`  
API Swagger Documentation: `http://localhost:8000/docs`

---

### C. Frontend Setup (React + Vite)

1. Open a second terminal and navigate to `frontend/`:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Launch the development server:
   ```bash
   npm run dev
   ```

Frontend will be active at: `http://localhost:5173`

---

## 3. URLs & Testing Interfaces

| Interface | URL | Description |
| :--- | :--- | :--- |
| **Main Portal** | `http://localhost:5173/` | Multi-tenant student assistant and entry point |
| **Admin Portal** | `http://localhost:5173/admin` | College Admin panel (documents, deadlines, escalations) |
| **SuperAdmin Dashboard** | `http://localhost:5173/superadmin` | Global fleet analytics and tenant provisioning |
| **Stanford Test Website** | `http://localhost:8000/test/` | Standalone campus website embedding the chatbot widget |

---

## 4. Default Test Credentials

| Role | Email | Password | Tenant ID |
| :--- | :--- | :--- | :--- |
| **Platform SuperAdmin** | `superadmin@agentcollege.ai` | `superadmin123` | *Global* |
| **Stanford Admin** | `admin@stanford.edu` | `admin123` | `stanford_global` |
| **Apex University Admin** | `admin@apex.edu` | `admin123` | `apex_university` |
| **Cambridge Tech Admin** | `admin@cambridge.ac.uk` | `admin123` | `cambridge_tech` |
| **Any Newly Provisioned Campus** | *Your provisioned email* | `admin123` | *Assigned slug* |

*(Quick test buttons are also available directly on the Sign-In modal in the web UI.)*

---

## 5. Standalone Widget Integration

To integrate the bot into any college website, embed the script as demonstrated in `test/index.html`:

```html
<!-- College Chatbot Widget -->
<script 
  src="http://localhost:8000/static/widget.js" 
  data-tenant="stanford_global"
  data-api-url="http://localhost:8000"
  data-primary-color="#8C1D40"
  data-title="Stanford Assistant"
  data-greeting="Hi! I am the Stanford Campus Assistant. How can I help you today?">
</script>
```
