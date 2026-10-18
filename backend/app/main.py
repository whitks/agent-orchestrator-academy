from fastapi import FastAPI, Request, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import asyncio
import json
import os
from typing import Optional
from pathlib import Path

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.schemas import ChatRequest, ChatResponse
from app.orchestrator import Orchestrator
from app.db import (
    init_db, 
    get_all_tickets, 
    get_traces, 
    get_metrics, 
    get_tenants, 
    get_tenant, 
    get_tenant_by_api_key,
    authenticate_user,
    resolve_ticket,
    get_tenant_documents,
    save_tenant_document,
    delete_tenant_document,
    provision_tenant,
    get_superadmin_stats
)

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Multi-Agent College Operations Assistant (Multi-Tenant SaaS)",
    description="Multi-tenant API for college operations, embeddable widget, and admin playground.",
    version="2.0.0"
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

orchestrator = Orchestrator()

# Mount static files for embeddable widget
WIDGET_DIR = Path(__file__).parent / "static"
WIDGET_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(WIDGET_DIR)), name="static")

# Mount test external site directory for one-click testing
TEST_DIR = Path(__file__).resolve().parent.parent.parent / "test"
if TEST_DIR.exists():
    app.mount("/test", StaticFiles(directory=str(TEST_DIR), html=True), name="test")

@app.on_event("startup")
async def startup():
    init_db()

# Resolve tenant helper (from query, header, or API key)
def resolve_tenant(tenant_id: Optional[str] = None, api_key: Optional[str] = None) -> dict:
    if api_key and isinstance(api_key, str):
        tenant = get_tenant_by_api_key(api_key)
        if tenant:
            return tenant
    t_id = tenant_id or "apex_university"
    tenant = get_tenant(t_id)
    if not tenant:
        tenant = get_tenant("apex_university")
    return tenant or {"tenant_id": "apex_university", "name": "Apex Institute of Technology", "theme_color": "#4f46e5"}

# --- Multi-Tenant Public & College Endpoints ---

@app.get("/api/tenants")
async def list_tenants():
    """List all registered colleges and institutions for the playground switcher."""
    return {"tenants": get_tenants()}

@app.get("/api/tenants/{tenant_id}")
async def get_tenant_config(tenant_id: str):
    """Fetch public configuration for a specific tenant (for the embeddable widget)."""
    tenant = get_tenant(tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return {
        "tenant_id": tenant["tenant_id"],
        "name": tenant["name"],
        "slug": tenant["slug"],
        "theme_color": tenant.get("theme_color", "#4f46e5"),
        "active_advisors": tenant.get("active_advisors", {}),
        "api_key": tenant.get("api_key")
    }

@app.post("/chat", response_model=ChatResponse)
@limiter.limit("30/minute")
async def chat(request: Request, req: ChatRequest, x_api_key: Optional[str] = Header(None)):
    tenant = resolve_tenant(req.tenant_id, api_key=x_api_key)
    return await orchestrator.handle(req.session_id, req.message, tenant_id=tenant["tenant_id"])

@app.get("/chat/stream")
@limiter.limit("30/minute")
async def chat_stream(request: Request, session_id: str, message: str, tenant_id: Optional[str] = "apex_university", x_api_key: Optional[str] = Header(None)):
    tenant = resolve_tenant(tenant_id, api_key=x_api_key)
    t_id = tenant["tenant_id"]

    # Security Origin Guardrail
    origin = request.headers.get("origin")
    if origin and tenant.get("domain_whitelist"):
        whitelist = tenant["domain_whitelist"]
        allowed = any(w in origin or w == "*" for w in whitelist)
        if not allowed and "localhost" not in origin and "127.0.0.1" not in origin:
            async def denied():
                yield f"data: {json.dumps({'event': 'final_answer_tokens', 'data': 'Domain not authorized for this college widget.'})}\n\n"
                yield f"data: {json.dumps({'event': 'done', 'escalated': True})}\n\n"
            return StreamingResponse(denied(), media_type="text/event-stream")

    async def event_generator():
        async for chunk in orchestrator.stream_handle(session_id, message, tenant_id=t_id):
            yield f"data: {json.dumps(chunk)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/widget.js")
async def serve_widget():
    """Serves the standalone embeddable widget bundle."""
    widget_path = WIDGET_DIR / "widget.js"
    if widget_path.exists():
        return FileResponse(widget_path, media_type="application/javascript")
    raise HTTPException(status_code=404, detail="widget.js not compiled yet")

# --- Session & Admin Management ---

@app.get("/session/{session_id}/history")
async def get_history(session_id: str):
    return orchestrator.memory.get_context(session_id)

@app.delete("/session/{session_id}")
async def delete_session(session_id: str):
    orchestrator.memory.clear_session(session_id)
    return {"status": "success", "message": f"Session {session_id} cleared"}

@app.get("/admin/escalations")
async def list_escalations(tenant_id: Optional[str] = None):
    return {"tickets": get_all_tickets(tenant_id)}

@app.get("/traces/{request_id}")
async def fetch_traces(request_id: str):
    return {"traces": get_traces(request_id)}

@app.get("/metrics")
async def fetch_metrics(tenant_id: Optional[str] = None):
    return get_metrics(tenant_id)

# --- Authentication Endpoints ---

@app.post("/api/auth/login")
async def login(payload: dict):
    email = payload.get("email", "")
    password = payload.get("password", "")
    role = payload.get("role")
    tenant_id = payload.get("tenant_id")

    # Quick demo switch option
    if role:
        if role == "superadmin":
            user = {
                "id": "usr_superadmin",
                "email": "superadmin@agentcollege.ai",
                "name": "Platform SuperAdmin",
                "role": "superadmin",
                "tenant_id": None
            }
        else:
            t_id = tenant_id or "apex_university"
            tenant_info = get_tenant(t_id) or {"name": "College Admin"}
            user = {
                "id": f"usr_{t_id}",
                "email": f"admin@{t_id.split('_')[0]}.edu",
                "name": f"{tenant_info.get('name', 'College')} Admin",
                "role": "college_admin",
                "tenant_id": t_id
            }
        return {
            "token": f"jwt_mock_{user['id']}_{user['role']}",
            "user": user
        }

    # Standard credential authentication
    user = authenticate_user(email, password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid institutional email or password")
    
    return {
        "token": f"jwt_mock_{user['id']}_{user['role']}",
        "user": user
    }

@app.get("/api/auth/me")
async def get_me(authorization: Optional[str] = Header(None)):
    if not authorization:
        # Default public student user
        return {
            "user": {
                "id": "usr_student_public",
                "email": "student@campus.edu",
                "name": "krish sharma",
                "role": "student",
                "tenant_id": "apex_university"
            }
        }
    return {
        "user": {
            "id": "usr_active",
            "role": "college_admin",
            "name": "Campus Administrator"
        }
    }

# --- Document & Knowledge Base Management ---

@app.get("/api/admin/documents")
async def list_documents(tenant_id: str):
    docs = get_tenant_documents(tenant_id)
    return {"documents": docs, "tenant_id": tenant_id}

@app.post("/api/admin/documents")
async def upload_document(payload: dict):
    tenant_id = payload.get("tenant_id", "apex_university")
    domain = payload.get("domain", "academics")
    filename = payload.get("filename", "policy.md")
    content = payload.get("content", "")
    
    if not filename.endswith((".md", ".txt")):
        filename = f"{filename}.md"
        
    doc_id = f"doc_{tenant_id}_{domain}_{uuid.uuid4().hex[:6]}"
    
    # 1. Save to tenant directory
    target_dir = Path("../data/tenants") / tenant_id / domain
    target_dir.mkdir(parents=True, exist_ok=True)
    target_file = target_dir / filename
    with open(target_file, "w", encoding="utf-8") as f:
        f.write(content)
        
    # 2. Chunk and upsert into Chroma collection
    from app.rag.ingest import chunk_text, get_chroma_client
    chunks = chunk_text(content, filename)
    chunk_count = len(chunks)
    
    if chunks:
        client = get_chroma_client()
        col = client.get_or_create_collection(name=domain)
        ids = [f"{tenant_id}_{domain}_{filename}_{i}" for i in range(len(chunks))]
        docs = [c["text"] for c in chunks]
        metas = [{**c["metadata"], "tenant_id": tenant_id, "domain": domain, "document_id": doc_id} for c in chunks]
        col.upsert(documents=docs, metadatas=metas, ids=ids)
        
    # 3. Save relational document record in SQLite
    save_tenant_document(doc_id, tenant_id, domain, filename, chunk_count)
    
    return {
        "success": True,
        "document_id": doc_id,
        "filename": filename,
        "chunks_indexed": chunk_count,
        "message": f"Successfully indexed {chunk_count} chunk(s) into '{domain}' for {tenant_id}."
    }

@app.delete("/api/admin/documents/{doc_id}")
async def delete_document(doc_id: str, tenant_id: str):
    doc = delete_tenant_document(doc_id, tenant_id)
    domain = doc.get("domain") if doc else None
    filename = doc.get("filename") if doc else None
    
    # Purge vectors from Chroma collection
    purged_count = 0
    if domain:
        try:
            from app.rag.ingest import get_chroma_client
            client = get_chroma_client()
            col = client.get_collection(name=domain)
            # Find and delete chunks
            res = col.get(where={"tenant_id": tenant_id})
            ids_to_delete = []
            if res and res.get("ids") and res.get("metadatas"):
                for idx, meta in enumerate(res["metadatas"]):
                    if meta.get("source_file") == filename or meta.get("document_id") == doc_id:
                        ids_to_delete.append(res["ids"][idx])
            if ids_to_delete:
                col.delete(ids=ids_to_delete)
                purged_count = len(ids_to_delete)
        except Exception as e:
            print(f"[CHROMA PURGE WARNING] {e}")
            
    # Remove file from disk
    if domain and filename:
        file_on_disk = Path("../data/tenants") / tenant_id / domain / filename
        if file_on_disk.exists():
            file_on_disk.unlink()
            
    return {
        "success": True,
        "document_id": doc_id,
        "purged_vectors": purged_count,
        "message": f"Document {doc_id} and {purged_count} vectors permanently purged."
    }

# --- Operational Rules Editor (Events & Deadlines) ---

@app.get("/api/admin/rules")
async def get_rules(tenant_id: str):
    events_file = Path("../data/tenants") / tenant_id / "mock" / "events.json"
    deadlines_file = Path("../data/tenants") / tenant_id / "mock" / "deadlines.json"
    
    events_data = {}
    deadlines_data = {}
    if events_file.exists():
        with open(events_file, "r", encoding="utf-8") as f:
            events_data = json.load(f)
    if deadlines_file.exists():
        with open(deadlines_file, "r", encoding="utf-8") as f:
            deadlines_data = json.load(f)
            
    return {
        "tenant_id": tenant_id,
        "events": events_data.get("events", []),
        "deadlines": deadlines_data.get("deadlines", {})
    }

@app.post("/api/admin/rules")
async def update_rules(payload: dict):
    tenant_id = payload.get("tenant_id", "apex_university")
    rule_type = payload.get("rule_type", "events") # 'events' | 'deadlines'
    data = payload.get("data", {})
    
    mock_dir = Path("../data/tenants") / tenant_id / "mock"
    mock_dir.mkdir(parents=True, exist_ok=True)
    
    if rule_type == "events":
        target = mock_dir / "events.json"
        with open(target, "w", encoding="utf-8") as f:
            json.dump({"events": data.get("events", [])}, f, indent=4)
    elif rule_type == "deadlines":
        target = mock_dir / "deadlines.json"
        with open(target, "w", encoding="utf-8") as f:
            json.dump({"deadlines": data.get("deadlines", {})}, f, indent=4)
            
    return {"success": True, "tenant_id": tenant_id, "rule_type": rule_type}

# --- Ticket Escalation Resolution ---

@app.post("/api/admin/tickets/{ticket_id}/resolve")
async def mark_ticket_resolved(ticket_id: str):
    ok = resolve_ticket(ticket_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {"success": True, "ticket_id": ticket_id, "status": "RESOLVED"}

# --- Platform SuperAdmin Management ---

@app.get("/api/superadmin/stats")
async def superadmin_stats():
    return get_superadmin_stats()

@app.post("/api/superadmin/tenants")
async def create_college_tenant(payload: dict):
    name = payload.get("name")
    slug = payload.get("slug")
    theme_color = payload.get("theme_color", "#4f46e5")
    whitelist = payload.get("domain_whitelist", [])
    if not name or not slug:
        raise HTTPException(status_code=400, detail="Name and slug are required")
        
    created = provision_tenant(name, slug, theme_color, whitelist)
    
    # Initialize basic starter handbook for new college
    t_id = created["tenant_id"]
    from app.rag.ingest import chunk_text, get_chroma_client
    starter_dir = Path("../data/tenants") / t_id / "academics"
    starter_dir.mkdir(parents=True, exist_ok=True)
    starter_file = starter_dir / "rules.md"
    starter_text = f"# {name} Regulations\n\n## Attendance Policy\nMinimum 75% attendance is required in all registered courses.\n"
    with open(starter_file, "w", encoding="utf-8") as f:
        f.write(starter_text)
    save_tenant_document(f"doc_{t_id}_rules", t_id, "academics", "rules.md", 1)
    
    # Ingest into Chroma
    chunks = chunk_text(starter_text, "rules.md")
    client = get_chroma_client()
    col = client.get_or_create_collection(name="academics")
    col.upsert(
        documents=[c["text"] for c in chunks],
        metadatas=[{**c["metadata"], "tenant_id": t_id, "domain": "academics"} for c in chunks],
        ids=[f"{t_id}_academics_rules_0"]
    )
    
    return {"success": True, "tenant": created}

