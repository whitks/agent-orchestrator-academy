import os
from pathlib import Path
from typing import Any, List, Optional
from app.agents.base import BaseAgent
from app.schemas import AgentResult
from app.rag.retriever import retrieve
from app.tools import registry

PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "academic_prompt.txt"

class AcademicAgent(BaseAgent):
    def __init__(self):
        self.name = "AcademicAgent"
        with open(PROMPT_PATH, "r", encoding="utf-8") as f:
            self.system_prompt = f.read()
        self.tools = registry.get_tools_for_agent(["deadline_lookup"])
        
    async def run(self, query: str, memory: Any = None, tenant_id: str = "apex_university", tenant_config: Optional[dict] = None) -> AgentResult:
        rag_results = retrieve("academics", query, tenant_id=tenant_id)
        
        context = ""
        sources = []
        if rag_results:
            context = "\n".join([f"[{c['source_file']}] {c['text']}" for c in rag_results])
            sources = list(set([c['source_file'] for c in rag_results]))
            
        tool_calls = []
        deadline_keywords = ["deadline", "due", "last date", "late fee", "exam form", "fee payment", "study list", "add/drop"]
        if any(kw in query.lower() for kw in deadline_keywords) and self.tools:
            try:
                dtype = "exam_form"
                if "fee" in query.lower():
                    dtype = "fee_payment"
                elif "study" in query.lower() or "add" in query.lower():
                    dtype = "study_list"
                elif "tripos" in query.lower():
                    dtype = "tripos_entry"
                tool_res, trace = self.tools[0].run(self.name, {"deadline_type": dtype, "tenant_id": tenant_id})
                if tool_res and tool_res.data:
                    context += f"\n\nOfficial Deadlines Tool Record:\n{tool_res.data}"
                    tool_calls.append(trace.model_dump())
                    sources.append("deadlines.json")
            except Exception:
                pass

        custom_prompt = self.system_prompt
        if tenant_config and "name" in tenant_config:
            custom_prompt = f"You are the Academic Advisor for {tenant_config['name']}.\n" + custom_prompt

        return await self._call_llm(query, context, sources, tool_calls=tool_calls, custom_prompt=custom_prompt)
        
    async def _call_llm(self, query: str, context: str, sources: List[str], tool_calls: List[dict], custom_prompt: Optional[str] = None) -> AgentResult:
        from app.llm import call_agent_llm
        prompt = custom_prompt or self.system_prompt
        return await call_agent_llm(self.name, prompt, query, context, sources, tool_calls)
