import os
from pathlib import Path
from typing import Any, List, Optional
from app.agents.base import BaseAgent
from app.schemas import AgentResult
from app.rag.retriever import retrieve
from app.tools import registry

PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "events_prompt.txt"

class EventsAgent(BaseAgent):
    def __init__(self):
        self.name = "EventsAgent"
        with open(PROMPT_PATH, "r", encoding="utf-8") as f:
            self.system_prompt = f.read()
        self.tools = registry.get_tools_for_agent(["event_lookup"])
        
    async def run(self, query: str, memory: Any = None, tenant_id: str = "apex_university", tenant_config: Optional[dict] = None) -> AgentResult:
        tool = self.tools[0]
        tool_res, trace = tool.run(self.name, {"tenant_id": tenant_id})
        
        rag_results = retrieve("events", query, tenant_id=tenant_id)
        rag_context = ""
        sources = ["events.json"]
        if rag_results:
            rag_context = "\n".join([f"[{c['source_file']}] {c['text']}" for c in rag_results])
            sources.extend(list(set([c['source_file'] for c in rag_results])))
            
        context = f"Events Tool Output: {tool_res.data}\n\nCampus Calendar Documentation:\n{rag_context}"
        custom_prompt = self.system_prompt
        if tenant_config and "name" in tenant_config:
            custom_prompt = f"You are the Student Activities Advisor for {tenant_config['name']}.\n" + custom_prompt
            
        return await self._call_llm(query, context, sources=sources, tool_calls=[trace.model_dump()], custom_prompt=custom_prompt)
        
    async def _call_llm(self, query: str, context: str, sources: List[str], tool_calls: List[dict], custom_prompt: Optional[str] = None) -> AgentResult:
        from app.llm import call_agent_llm
        prompt = custom_prompt or self.system_prompt
        return await call_agent_llm(self.name, prompt, query, context, sources, tool_calls)
