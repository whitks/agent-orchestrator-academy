from abc import ABC, abstractmethod
from typing import Any
from app.schemas import AgentResult

class BaseAgent(ABC):
    @abstractmethod
    async def run(self, query: str, memory: Any) -> AgentResult:
        """
        Run the agent with the given query and memory.
        """
        pass
