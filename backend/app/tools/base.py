from typing import Any, Callable, Dict, Type, Optional, List, Tuple
from pydantic import BaseModel, ValidationError
from abc import ABC, abstractmethod
import traceback
import time
from datetime import datetime
from app.schemas import TraceEvent

class ToolResult(BaseModel):
    success: bool
    data: Any
    error: Optional[str] = None
    
class BaseTool(ABC):
    name: str
    description: str
    input_schema: Type[BaseModel]
    
    @abstractmethod
    def run_impl(self, **kwargs) -> Any:
        pass
        
    def run(self, agent_name: str, input_data: Dict[str, Any]) -> Tuple[ToolResult, TraceEvent]:
        start_time = time.time()
        try:
            validated_input = self.input_schema(**input_data)
            output = self.run_impl(**validated_input.model_dump())
            result = ToolResult(success=True, data=output)
        except ValidationError as e:
            result = ToolResult(success=False, data=None, error=f"Validation Error: {str(e)}")
        except Exception as e:
            result = ToolResult(success=False, data=None, error=f"Execution Error: {str(e)}\n{traceback.format_exc()}")
            
        latency = (time.time() - start_time) * 1000
        
        trace = TraceEvent(
            timestamp=datetime.utcnow().isoformat(),
            step=f"ToolCall:{self.name}",
            agent=agent_name,
            input=input_data,
            output=result.model_dump(),
            latency_ms=latency
        )
        return result, trace

class ToolRegistry:
    def __init__(self):
        self._tools: Dict[str, BaseTool] = {}
        
    def register(self, tool: BaseTool):
        self._tools[tool.name] = tool
        
    def get_tool(self, name: str) -> Optional[BaseTool]:
        return self._tools.get(name)
        
    def get_tools_for_agent(self, tool_names: List[str]) -> List[BaseTool]:
        return [self._tools[name] for name in tool_names if name in self._tools]

# Singleton registry
registry = ToolRegistry()
