from pydantic import BaseModel, Field
from .base import BaseTool, registry

class CGPAEligibilityInput(BaseModel):
    cgpa: float = Field(..., description="Student's CGPA")
    backlogs: int = Field(..., description="Number of active backlogs")
    company_tier: int = Field(..., description="Company tier (1, 2, or 3)")

class CGPAEligibilityTool(BaseTool):
    name = "cgpa_eligibility_check"
    description = "Check if a student is eligible for a specific company tier based on CGPA and backlogs."
    input_schema = CGPAEligibilityInput
    
    def run_impl(self, cgpa: float, backlogs: int, company_tier: int):
        if backlogs > 0:
            return {"eligible": False, "reason": "Active backlogs are not allowed."}
            
        if company_tier == 1 and cgpa >= 7.0:
            return {"eligible": True, "reason": "Meets tier 1 criteria."}
        elif company_tier in [2, 3] and cgpa >= 6.0:
            return {"eligible": True, "reason": f"Meets tier {company_tier} criteria."}
            
        return {"eligible": False, "reason": f"CGPA {cgpa} is too low for tier {company_tier}."}

registry.register(CGPAEligibilityTool())
