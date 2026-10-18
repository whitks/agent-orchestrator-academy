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
    tenant_id: Optional[str] = Field("apex_university", description="College tenant identifier")

class EventLookupTool(BaseTool):
    name = "event_lookup"
    description = "Search for college events by date range or category."
    input_schema = EventLookupInput
    
    def run_impl(self, date_range: Optional[str] = None, category: Optional[str] = None, tenant_id: str = "apex_university"):
        tenant_mock = DATA_DIR / "tenants" / tenant_id / "mock" / "events.json"
        mock_file = tenant_mock if tenant_mock.exists() else MOCK_FILE

        if not mock_file.exists():
            return {"events": [], "error": f"Mock file not found"}
            
        with open(mock_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        events = data.get("events", [])
        
        if category:
            events = [e for e in events if e.get("category", "").lower() == category.lower()]
            
        if date_range:
            events = [e for e in events if date_range.lower() in e.get("date", "").lower()]
            
        return {"events": events, "count": len(events), "tenant_id": tenant_id}

registry.register(EventLookupTool())
