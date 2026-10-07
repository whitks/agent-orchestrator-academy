from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import asyncio
import json

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.schemas import ChatRequest, ChatResponse
from app.orchestrator import Orchestrator
from app.db import init_db, get_all_tickets, get_traces, get_metrics

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Multi-Agent College Operations Assistant",
    description="API for routing and resolving college operation queries.",
    version="1.0.0"
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

@app.on_event("startup")
async def startup():
    init_db()

@app.post("/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
async def chat(request: Request, req: ChatRequest):
    return await orchestrator.handle(req.session_id, req.message)

@app.get("/chat/stream")
@limiter.limit("20/minute")
async def chat_stream(request: Request, session_id: str, message: str):
    async def event_generator():
        async for chunk in orchestrator.stream_handle(session_id, message):
            yield f"data: {json.dumps(chunk)}\n\n"
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/session/{session_id}/history")
async def get_history(session_id: str):
    return orchestrator.memory.get_context(session_id)

@app.delete("/session/{session_id}")
async def delete_session(session_id: str):
    orchestrator.memory.clear_session(session_id)
    return {"status": "success", "message": f"Session {session_id} cleared"}

@app.get("/admin/escalations")
async def list_escalations():
    return {"tickets": get_all_tickets()}

@app.get("/traces/{request_id}")
async def fetch_traces(request_id: str):
    return {"traces": get_traces(request_id)}

@app.get("/metrics")
async def fetch_metrics():
    return get_metrics()
