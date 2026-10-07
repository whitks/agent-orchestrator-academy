import os
from pathlib import Path
from typing import Any, List
from app.agents.base import BaseAgent
from app.schemas import AgentResult
from app.tools import registry

PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "events_prompt.txt"

class EventsAgent(BaseAgent):
    def __init__(self):
        self.name = "EventsAgent"
        with open(PROMPT_PATH, "r", encoding="utf-8") as f:
            self.system_prompt = f.read()
        # Mainly relies on tool calling, no RAG needed
        self.tools = registry.get_tools_for_agent(["event_lookup"])
        
    async def run(self, query: str, memory: Any = None) -> AgentResult:
        # Simulate an LLM electing to call the tool
        tool = self.tools[0]
        tool_res, trace = tool.run(self.name, {}) # Empty kwargs searches all
        
        context = f"Events Tool Output: {tool_res.data}"
        
        return await self._call_llm(query, context, sources=["events.json"], tool_calls=[trace.model_dump()])
        
    async def _call_llm(self, query: str, context: str, sources: List[str], tool_calls: List[dict]) -> AgentResult:
        from app.llm import call_agent_llm
        return await call_agent_llm(self.name, self.system_prompt, query, context, sources, tool_calls)
