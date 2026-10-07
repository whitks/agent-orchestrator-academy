import os
import json
from pathlib import Path
from pydantic import BaseModel, Field
from .base import BaseTool, registry

DATA_DIR = Path(os.getenv("DATA_DIR", "../data")).resolve()
MOCK_FILE = DATA_DIR / "mock" / "deadlines.json"

class DeadlineLookupInput(BaseModel):
    deadline_type: str = Field(..., description="Type of deadline (e.g., 'exam_form', 'fee_payment')")

class DeadlineLookupTool(BaseTool):
    name = "deadline_lookup"
    description = "Look up important academic or administrative deadlines."
    input_schema = DeadlineLookupInput
    
    def run_impl(self, deadline_type: str):
        if not MOCK_FILE.exists():
            return {"deadline_type": deadline_type, "error": f"Mock file not found at {MOCK_FILE}"}
            
        with open(MOCK_FILE, "r") as f:
            data = json.load(f)
            
        deadlines = data.get("deadlines", {})
        result = deadlines.get(deadline_type)
        if result:
            return {"deadline_type": deadline_type, "details": result}
        return {"deadline_type": deadline_type, "error": "Deadline type not found"}

registry.register(DeadlineLookupTool())
