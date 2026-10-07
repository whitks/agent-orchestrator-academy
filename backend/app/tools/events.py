import os
import json
from pathlib import Path
from typing import Optional
from pydantic import BaseModel, Field
from .base import BaseTool, registry

DATA_DIR = Path(os.getenv("DATA_DIR", "../data")).resolve()
MOCK_FILE = DATA_DIR / "mock" / "events.json"

class EventLookupInput(BaseModel):
    date_range: Optional[str] = Field(None, description="e.g., 'October' or '2026-10'")
    category: Optional[str] = Field(None, description="e.g., 'cultural', 'technical'")

class EventLookupTool(BaseTool):
    name = "event_lookup"
    description = "Search for college events by date range or category."
    input_schema = EventLookupInput
    
    def run_impl(self, date_range: Optional[str] = None, category: Optional[str] = None):
        if not MOCK_FILE.exists():
            return {"events": [], "error": f"Mock file not found at {MOCK_FILE}"}
            
        with open(MOCK_FILE, "r") as f:
            data = json.load(f)
            
        events = data.get("events", [])
        
        if category:
            events = [e for e in events if e.get("category", "").lower() == category.lower()]
            
        if date_range:
            events = [e for e in events if date_range.lower() in e.get("date", "").lower()]
            
        return {"events": events, "count": len(events)}

registry.register(EventLookupTool())
