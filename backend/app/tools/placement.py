from typing import Optional
from pydantic import BaseModel, Field
from .base import BaseTool, registry

class CGPAEligibilityInput(BaseModel):
    cgpa: float = Field(..., description="Student's CGPA or GPA")
    backlogs: int = Field(..., description="Number of active backlogs")
    company_tier: int = Field(..., description="Company tier (1, 2, or 3)")
    tenant_id: Optional[str] = Field("apex_university", description="College tenant identifier")

class CGPAEligibilityTool(BaseTool):
    name = "cgpa_eligibility_check"
    description = "Check if a student is eligible for a specific company tier based on CGPA and backlogs."
    input_schema = CGPAEligibilityInput
    
    def run_impl(self, cgpa: float, backlogs: int, company_tier: int, tenant_id: str = "apex_university"):
        if backlogs > 0:
            return {"eligible": False, "reason": "Active backlogs or academic holds are not allowed.", "tenant_id": tenant_id}
            
        if tenant_id == "stanford_global":
            # 4.0 GPA scale (3.2 for premier tech / finance)
            req = 3.2 if company_tier == 1 else 2.8
            # If user entered 10-point CGPA, normalize
            effective_gpa = (cgpa / 10.0) * 4.0 if cgpa > 4.3 else cgpa
            if effective_gpa >= req:
                return {"eligible": True, "reason": f"Meets Stanford BEAM tier {company_tier} criteria (GPA {effective_gpa:.2f} >= {req}).", "tenant_id": tenant_id}
            return {"eligible": False, "reason": f"GPA {effective_gpa:.2f} is below Stanford BEAM minimum {req} for tier {company_tier}.", "tenant_id": tenant_id}
            
        elif tenant_id == "cambridge_tech":
            # First Class (70%+) or Upper Second 2:1 (60%+)
            req = 7.0 if company_tier == 1 else 6.0
            if cgpa >= req:
                return {"eligible": True, "reason": f"Meets Cambridge Careers Service criteria for tier {company_tier} (predicted First / 2:1 Honours).", "tenant_id": tenant_id}
            return {"eligible": False, "reason": f"Academic standing {cgpa} does not meet Cambridge 2:1 minimum for tier {company_tier}.", "tenant_id": tenant_id}
            
        # Default apex_university
        if company_tier == 1 and cgpa >= 7.0:
            return {"eligible": True, "reason": "Meets Apex Tier 1 criteria (CGPA >= 7.0).", "tenant_id": tenant_id}
        elif company_tier in [2, 3] and cgpa >= 6.0:
            return {"eligible": True, "reason": f"Meets Apex Tier {company_tier} criteria (CGPA >= 6.0).", "tenant_id": tenant_id}
            
        return {"eligible": False, "reason": f"CGPA {cgpa} is too low for tier {company_tier}.", "tenant_id": tenant_id}

registry.register(CGPAEligibilityTool())
