import os
import json
from pathlib import Path
from typing import Optional
from pydantic import BaseModel, Field
from .base import BaseTool, registry

DATA_DIR = Path(os.getenv("DATA_DIR", "../data")).resolve()
MOCK_FILE = DATA_DIR / "mock" / "deadlines.json"

class DeadlineLookupInput(BaseModel):
    deadline_type: str = Field(..., description="Type of deadline (e.g., 'exam_form', 'fee_payment', 'study_list')")
    tenant_id: Optional[str] = Field("apex_university", description="College tenant identifier")

class DeadlineLookupTool(BaseTool):
    name = "deadline_lookup"
    description = "Look up important academic or administrative deadlines."
    input_schema = DeadlineLookupInput
    
    def run_impl(self, deadline_type: str, tenant_id: str = "apex_university"):
        tenant_mock = DATA_DIR / "tenants" / tenant_id / "mock" / "deadlines.json"
        mock_file = tenant_mock if tenant_mock.exists() else MOCK_FILE

        if not mock_file.exists():
            return {"deadline_type": deadline_type, "error": "Mock deadlines file not found"}
            
        with open(mock_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        deadlines = data.get("deadlines", {})
        result = deadlines.get(deadline_type)
        if result:
            return {"deadline_type": deadline_type, "details": result, "tenant_id": tenant_id}
            
        # Return all available deadlines for this tenant if exact type not matched
        return {
            "deadline_type": deadline_type,
            "message": "Specific deadline type not found, here are available deadlines:",
            "available_deadlines": deadlines,
            "tenant_id": tenant_id
        }

registry.register(DeadlineLookupTool())
