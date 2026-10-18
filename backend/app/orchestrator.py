import time
import asyncio
from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime

from app.schemas import RouteDecision, TraceEvent, ChatResponse, AgentResult, EscalationDetails
from app.agents.academic import AcademicAgent
from app.agents.placement import PlacementAgent
from app.agents.events import EventsAgent
from app.agents.services import ServicesAgent
from app.memory import MemoryStore
from app.db import create_ticket, get_tenant
from app.tracing import Tracer

class Orchestrator:
    def __init__(self):
        self.agents = {
            "academics": AcademicAgent(),
            "placement": PlacementAgent(),
            "events": EventsAgent(),
            "services": ServicesAgent()
        }
        self.memory = MemoryStore(max_turns=2)
        self.max_retries = 2
        
    async def route(self, query: str, memory_context: Dict[str, Any], tenant_config: Optional[dict] = None) -> Tuple[RouteDecision, TraceEvent]:
        start_time = time.time()
        
        decision = None
        last_error = None
        for attempt in range(self.max_retries + 1):
            try:
                decision = await self._llm_route(query, memory_context)
                break
            except Exception as e:
                last_error = str(e)
                print(f"[ROUTER ERROR] Attempt {attempt+1} failed: {last_error}")
                await asyncio.sleep(0.5)
                
        if not decision:
            decision = RouteDecision(domains=[], reasoning=f"Error: {last_error}", is_multi_domain=False, confidence=0.0)
            
        latency = (time.time() - start_time) * 1000
        trace = TraceEvent(
            timestamp=datetime.utcnow().isoformat(), step="Router", agent="System",
            input={"query": query, "memory": memory_context}, output=decision.model_dump(), latency_ms=latency, tokens_used=50
        )
        return decision, trace
        
    async def _llm_route(self, query: str, memory_context: Dict[str, Any]) -> RouteDecision:
        from app.llm import call_router
        return await call_router(query, memory_context)
        
    async def synthesize(self, valid_results: List[AgentResult], failed_results: List[AgentResult]) -> Tuple[str, List[str], TraceEvent]:
        start_time = time.time()
        
        final_answer = None
        combined_sources = []
        last_error = None
        
        for attempt in range(self.max_retries + 1):
            try:
                final_answer, combined_sources = await self._llm_synthesize(valid_results, failed_results)
                break
            except Exception as e:
                last_error = str(e)
                print(f"[SYNTHESIZER ERROR] Attempt {attempt+1} failed: {last_error}")
                await asyncio.sleep(0.5)
                
        if not final_answer:
            final_answer = "Encountered an error while synthesizing the response."
            combined_sources = []

        latency = (time.time() - start_time) * 1000
        
        trace = TraceEvent(
            timestamp=datetime.utcnow().isoformat(), step="Synthesizer", agent="System",
            input={"valid_results": [r.model_dump() for r in valid_results], "failed_results": [r.model_dump() for r in failed_results]},
            output={"final_answer": final_answer, "sources": combined_sources}, latency_ms=latency, tokens_used=120
        )
        return final_answer, combined_sources, trace
        
    async def _llm_synthesize(self, valid_results: List[AgentResult], failed_results: List[AgentResult]) -> Tuple[str, List[str]]:
        from app.llm import call_synthesizer
        return await call_synthesizer(valid_results, failed_results)

    async def _run_agent_with_timeout(self, agent_name: str, query: str, memory_context: Dict[str, Any], tenant_id: str = "apex_university", tenant_config: Optional[dict] = None, timeout: float = 12.0) -> Tuple[Optional[AgentResult], TraceEvent]:
        agent = self.agents.get(agent_name)
        if not agent:
            raise ValueError(f"Agent {agent_name} not found")
            
        start_time = time.time()
        result = None
        error = None
        
        for attempt in range(self.max_retries + 1):
            try:
                result = await asyncio.wait_for(agent.run(query, memory=memory_context, tenant_id=tenant_id, tenant_config=tenant_config), timeout=timeout)
                error = None
                if result.status == "ok":
                    break
            except asyncio.TimeoutError:
                error = "Timeout"
                print(f"[AGENT ERROR] {agent_name} timed out on attempt {attempt+1}")
                result = AgentResult(agent_name=agent.name, answer="Agent timed out.", status="error", confidence=0.0)
            except Exception as e:
                error = str(e)
                print(f"[AGENT ERROR] {agent_name} exception on attempt {attempt+1}: {error}")
                result = AgentResult(agent_name=agent.name, answer=f"Agent error: {error}", status="error", confidence=0.0)
            await asyncio.sleep(0.5)
            
        latency = (time.time() - start_time) * 1000
        trace = TraceEvent(
            timestamp=datetime.utcnow().isoformat(), step=f"Execute:{agent_name}", agent=agent.name,
            input={"query": query, "memory": memory_context, "tenant_id": tenant_id}, output=result.model_dump() if not error else {"error": error},
            latency_ms=latency, tenant_id=tenant_id, tokens_used=80
        )
        return result, trace

    async def handle(self, session_id: str, message: str, tenant_id: str = "apex_university") -> ChatResponse:
        tracer = Tracer(session_id, tenant_id=tenant_id)
        tenant_config = get_tenant(tenant_id)
        
        # 1. Query Rewrite
        start_time = time.time()
        rewritten_query = message
        try:
            for attempt in range(self.max_retries + 1):
                try:
                    rewritten_query = await self.memory.rewrite_query(session_id, message)
                    break
                except Exception as e:
                    print(f"[REWRITE ERROR] Attempt {attempt+1} failed: {str(e)}")
                    await asyncio.sleep(0.5)
        except:
            pass
            
        latency = (time.time() - start_time) * 1000
        tracer.add_trace(TraceEvent(
            timestamp=datetime.utcnow().isoformat(), step="QueryRewrite", agent="System",
            input={"query": message}, output={"rewritten_query": rewritten_query}, latency_ms=latency, tenant_id=tenant_id, tokens_used=15
        ))
        
        memory_context = self.memory.get_context(session_id)
        
        # 2. Router Call
        decision, route_trace = await self.route(rewritten_query, memory_context, tenant_config)
        tracer.route_domains = decision.domains
        tracer.add_trace(route_trace)
        
        # Low Confidence Fallback
        if decision.confidence < 0.6:
            tracer.fallback_triggered = True
            tracer.close()
            response = ChatResponse(
                final_answer="I'm not completely sure what you mean. Could you clarify your question?",
                agents_used=[], sources=[], trace=tracer.traces, escalated=False, tenant_id=tenant_id
            )
            self.memory.add_turn(session_id, message, response.final_answer)
            return response
            
        if not decision.domains:
            tracer.fallback_triggered = True
            tracer.close()
            response = ChatResponse(
                final_answer="I cannot answer this query as it falls outside my supported domains.",
                agents_used=[], sources=[], trace=tracer.traces, escalated=True, tenant_id=tenant_id
            )
            self.memory.add_turn(session_id, message, response.final_answer)
            return response
            
        # 3. Execution (Concurrent)
        tasks = [self._run_agent_with_timeout(d, rewritten_query, memory_context, tenant_id=tenant_id, tenant_config=tenant_config) for d in decision.domains if d in self.agents]
        agent_outputs = await asyncio.gather(*tasks)
        
        valid_results = []
        failed_results = []
        agents_used = []
        
        for result, trace in agent_outputs:
            tracer.add_trace(trace)
            if result:
                agents_used.append(result.agent_name)
                if result.status == "ok" or (result.status == "insufficient_evidence" and result.sources and result.confidence >= 0.5):
                    valid_results.append(result)
                else:
                    failed_results.append(result)
                
        # 4. Fallback Logic for Execution
        if not valid_results and failed_results:
            ticket_id = create_ticket(session_id, rewritten_query, tenant_id=tenant_id)
            tracer.escalated = True
            tracer.fallback_triggered = True
            tracer.close()
            response = ChatResponse(
                final_answer="I couldn't find this in official college records.",
                agents_used=agents_used,
                sources=[],
                trace=tracer.traces,
                escalated=True,
                tenant_id=tenant_id,
                escalation_details=EscalationDetails(
                    ticket_id=ticket_id,
                    suggested_contact="support@college.edu"
                )
            )
            self.memory.add_turn(session_id, message, response.final_answer)
            return response
            
        # 5. Synthesizer Call
        final_answer, combined_sources, synth_trace = await self.synthesize(valid_results, failed_results)
        tracer.add_trace(synth_trace)
        
        tracer.escalated = len(failed_results) > 0 and len(valid_results) == 0
        tracer.close()
        
        response = ChatResponse(
            final_answer=final_answer,
            agents_used=agents_used,
            sources=combined_sources,
            trace=tracer.traces,
            escalated=tracer.escalated,
            tenant_id=tenant_id,
            escalation_details=None
        )
        
        self.memory.add_turn(session_id, message, response.final_answer)
        return response

    async def stream_handle(self, session_id: str, message: str, tenant_id: str = "apex_university"):
        tracer = Tracer(session_id, tenant_id=tenant_id)
        tenant_config = get_tenant(tenant_id) or {"name": "Campus Assistant", "theme_color": "#4f46e5"}
        college_name = tenant_config.get("name", "Campus Assistant")
        start_time = time.time()
        
        yield {"event": "progress", "step": "rewrite", "message": f"Analyzing query for {college_name}..."}
        
        # 1. Query Rewrite
        rewritten_query = message
        try:
            for attempt in range(self.max_retries + 1):
                try:
                    rewritten_query = await self.memory.rewrite_query(session_id, message)
                    break
                except Exception as e:
                    await asyncio.sleep(0.3)
        except:
            rewritten_query = message
            
        memory_context = self.memory.get_context(session_id)
        tracer.add_trace(TraceEvent(
            timestamp=datetime.utcnow().isoformat(), step="QueryRewrite", agent="System",
            input={"query": message}, output={"rewritten_query": rewritten_query}, latency_ms=(time.time() - start_time) * 1000, tenant_id=tenant_id, tokens_used=15
        ))
        
        yield {"event": "progress", "step": "routing", "message": f"Classifying query intent: '{rewritten_query}'"}
        
        # 2. Router Call
        decision, route_trace = await self.route(rewritten_query, memory_context, tenant_config)
        tracer.route_domains = decision.domains
        tracer.add_trace(route_trace)
        
        yield {
            "event": "router_decision",
            "domains": decision.domains,
            "reasoning": decision.reasoning,
            "is_multi_domain": decision.is_multi_domain,
            "confidence": decision.confidence,
            "tenant_id": tenant_id
        }
        
        if decision.confidence < 0.6:
            tracer.fallback_triggered = True
            tracer.close()
            msg = "I'm not completely sure what you mean. Could you clarify your question?"
            self.memory.add_turn(session_id, message, msg)
            yield {"event": "final_answer_tokens", "data": msg}
            yield {"event": "done", "message": "Stream completed", "agents": [], "sources": [], "escalated": False, "tenant_id": tenant_id, "traces": [t.model_dump() for t in tracer.traces]}
            return
            
        if not decision.domains:
            tracer.fallback_triggered = True
            tracer.close()
            msg = "I cannot answer this query as it falls outside my supported domains."
            self.memory.add_turn(session_id, message, msg)
            yield {"event": "final_answer_tokens", "data": msg}
            yield {"event": "done", "message": "Stream completed", "agents": [], "sources": [], "escalated": True, "tenant_id": tenant_id, "traces": [t.model_dump() for t in tracer.traces]}
            return
            
        yield {"event": "progress", "step": "execution", "message": f"Dispatching query to domain agents: {', '.join(decision.domains)}"}
        
        # 3. Execution (Concurrent)
        tasks = [self._run_agent_with_timeout(d, rewritten_query, memory_context, tenant_id=tenant_id, tenant_config=tenant_config) for d in decision.domains if d in self.agents]
        agent_outputs = await asyncio.gather(*tasks)
        
        valid_results = []
        failed_results = []
        agents_used = []
        
        for result, trace in agent_outputs:
            tracer.add_trace(trace)
            if result:
                agents_used.append(result.agent_name)
                if result.status == "ok" or (result.status == "insufficient_evidence" and result.sources and result.confidence >= 0.5):
                    valid_results.append(result)
                else:
                    failed_results.append(result)
                    
            yield {
                "event": "agent_completed",
                "agent_name": result.agent_name if result else "Unknown",
                "status": result.status if result else "error",
                "confidence": result.confidence if result else 0.0,
                "sources": result.sources if result else [],
                "tenant_id": tenant_id,
                "answer_preview": (result.answer[:120] + "...") if result and len(result.answer) > 120 else (result.answer if result else "")
            }
                    
        if not valid_results and failed_results:
            ticket_id = create_ticket(session_id, rewritten_query, tenant_id=tenant_id)
            tracer.escalated = True
            tracer.fallback_triggered = True
            tracer.close()
            fallback_msg = f"I couldn't find this in official {college_name} records. A support ticket has been opened."
            self.memory.add_turn(session_id, message, fallback_msg)
            yield {"event": "final_answer_tokens", "data": fallback_msg}
            yield {"event": "done", "message": "Stream completed", "agents": agents_used, "sources": [], "escalated": True, "ticket_id": ticket_id, "tenant_id": tenant_id, "traces": [t.model_dump() for t in tracer.traces]}
            return
            
        yield {"event": "progress", "step": "synthesis", "message": "Synthesizing cohesive multi-domain response..."}
        
        # 4. Synthesizer Call
        final_answer, combined_sources, synth_trace = await self.synthesize(valid_results, failed_results)
        tracer.add_trace(synth_trace)
        tracer.escalated = len(failed_results) > 0 and len(valid_results) == 0
        tracer.close()
        
        self.memory.add_turn(session_id, message, final_answer)
        
        # Emit final answer
        yield {"event": "final_answer_tokens", "data": final_answer}
        yield {
            "event": "done",
            "message": "Stream completed",
            "agents": agents_used,
            "sources": combined_sources,
            "escalated": tracer.escalated,
            "tenant_id": tenant_id,
            "traces": [t.model_dump() for t in tracer.traces]
        }
