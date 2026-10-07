import uuid
import time
import json
import logging
from typing import List
from app.schemas import TraceEvent
from app.db import save_trace, save_request_metrics

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            "time": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "message": record.getMessage()
        }
        if hasattr(record, "trace_event"):
            log_record["trace_event"] = record.trace_event
        return json.dumps(log_record)

logger = logging.getLogger("tracer")
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
handler.setFormatter(JSONFormatter())
logger.addHandler(handler)
logger.propagate = False

class Tracer:
    def __init__(self, session_id: str):
        self.request_id = str(uuid.uuid4())
        self.session_id = session_id
        self.traces: List[TraceEvent] = []
        self.start_time = time.time()
        self.route_domains = []
        self.escalated = False
        self.fallback_triggered = False

    def add_trace(self, trace: TraceEvent):
        trace.request_id = self.request_id
        self.traces.append(trace)
        save_trace(trace.model_dump())
        logger.info(f"Trace recorded: {trace.step} ({trace.agent})", extra={"trace_event": trace.model_dump()})

    def close(self):
        total_latency = (time.time() - self.start_time) * 1000
        metrics = {
            "request_id": self.request_id,
            "session_id": self.session_id,
            "escalated": self.escalated,
            "fallback_triggered": self.fallback_triggered,
            "route_domains": self.route_domains,
            "total_latency": total_latency
        }
        save_request_metrics(metrics)
        logger.info(f"Request {self.request_id} completed", extra={"trace_event": metrics})
