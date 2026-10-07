from pydantic import BaseModel, Field
from typing import List, Literal, Dict, Any, Optional

class ChatRequest(BaseModel):
    session_id: str
    message: str

class EscalationDetails(BaseModel):
    ticket_id: str
    suggested_contact: str

class AgentResult(BaseModel):
    agent_name: str
    answer: str
    sources: List[str] = Field(default_factory=list)
    tool_calls: List[Dict[str, Any]] = Field(default_factory=list)
    confidence: float = Field(ge=0, le=1)
    status: Literal["ok", "insufficient_evidence", "error"]

class RouteDecision(BaseModel):
    domains: List[str]
    reasoning: str
    is_multi_domain: bool
    confidence: float = 1.0

class TraceEvent(BaseModel):
    timestamp: str
    step: str
    agent: str
    input: Any
    output: Any
    latency_ms: float
    request_id: Optional[str] = None
    tokens_used: Optional[int] = 0

class ChatResponse(BaseModel):
    final_answer: str
    agents_used: List[str] = Field(default_factory=list)
    sources: List[str] = Field(default_factory=list)
    trace: List[TraceEvent] = Field(default_factory=list)
    escalated: bool
    escalation_details: Optional[EscalationDetails] = None
