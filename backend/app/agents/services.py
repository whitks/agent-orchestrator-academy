import os
from pathlib import Path
from typing import Any, List
from app.agents.base import BaseAgent
from app.schemas import AgentResult
from app.rag.retriever import retrieve

PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "services_prompt.txt"

class ServicesAgent(BaseAgent):
    def __init__(self):
        self.name = "ServicesAgent"
        with open(PROMPT_PATH, "r", encoding="utf-8") as f:
            self.system_prompt = f.read()
        self.tools = [] # No specific tools for services yet
        
    async def run(self, query: str, memory: Any = None) -> AgentResult:
        rag_results = retrieve("services", query)
        
        context = ""
        sources = []
        if rag_results:
            context = "\n".join([f"[{c['source_file']}] {c['text']}" for c in rag_results])
            sources = list(set([c['source_file'] for c in rag_results]))
            
        return await self._call_llm(query, context, sources, tool_calls=[])
        
    async def _call_llm(self, query: str, context: str, sources: List[str], tool_calls: List[dict]) -> AgentResult:
        from app.llm import call_agent_llm
        return await call_agent_llm(self.name, self.system_prompt, query, context, sources, tool_calls)
