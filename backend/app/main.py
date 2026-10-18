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
    get_tenant_by_api_key
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

@app.on_event("startup")
async def startup():
    init_db()

# Resolve tenant helper (from query, header, or API key)
def resolve_tenant(tenant_id: Optional[str] = None, x_api_key: Optional[str] = Header(None)) -> dict:
    if x_api_key:
        tenant = get_tenant_by_api_key(x_api_key)
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
async def chat(request: Request, req: ChatRequest):
    tenant = resolve_tenant(req.tenant_id)
    return await orchestrator.handle(req.session_id, req.message, tenant_id=tenant["tenant_id"])

@app.get("/chat/stream")
@limiter.limit("30/minute")
async def chat_stream(request: Request, session_id: str, message: str, tenant_id: Optional[str] = "apex_university"):
    tenant = resolve_tenant(tenant_id)
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
