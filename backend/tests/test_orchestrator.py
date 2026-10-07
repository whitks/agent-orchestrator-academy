import unittest
from unittest.mock import patch, AsyncMock
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.orchestrator import Orchestrator
from app.schemas import RouteDecision, AgentResult

class TestOrchestrator(unittest.IsolatedAsyncioTestCase):
    async def mock_llm_route(self, query, memory_context):
        q = query.lower()
        if "weather" in q:
            return RouteDecision(domains=[], reasoning="Out of scope", is_multi_domain=False)
        elif "placement" in q and "fest" in q:
            return RouteDecision(domains=["placement", "events"], reasoning="Two domains", is_multi_domain=True)
        else:
            return RouteDecision(domains=["academics"], reasoning="Single domain", is_multi_domain=False)
            
    async def mock_llm_synthesize(self, valid_results, failed_results):
        answer = " | ".join([r.answer for r in valid_results])
        sources = []
        for r in valid_results:
            sources.extend(r.sources)
        return answer, list(set(sources))
        
    async def mock_agent_run(self, query, memory=None):
        return AgentResult(
            agent_name="MockAgent",
            answer=f"Answer for {query}",
            sources=["mock.md"],
            confidence=0.9,
            status="ok"
        )
        
    async def mock_llm_rewrite(self, history, summary, query):
        return query
        
    @patch('app.agents.AcademicAgent.run', new_callable=AsyncMock)
    @patch('app.agents.PlacementAgent.run', new_callable=AsyncMock)
    @patch('app.agents.EventsAgent.run', new_callable=AsyncMock)
    async def test_single_domain(self, mock_events, mock_placement, mock_academic):
        res = await self.mock_agent_run("academics")
        res.agent_name = "AcademicAgent"
        mock_academic.return_value = res
        orch = Orchestrator()
        
        with patch.object(orch, '_llm_route', new=self.mock_llm_route), \
             patch.object(orch, '_llm_synthesize', new=self.mock_llm_synthesize), \
             patch.object(orch.memory, '_llm_rewrite', new=self.mock_llm_rewrite):
             
             resp = await orch.handle("session1", "What is the attendance rule?")
             
             self.assertIn("AcademicAgent", resp.agents_used)
             self.assertEqual(len(resp.agents_used), 1)
             self.assertIn("mock.md", resp.sources)
             self.assertFalse(resp.escalated)
             
    @patch('app.agents.AcademicAgent.run', new_callable=AsyncMock)
    @patch('app.agents.PlacementAgent.run', new_callable=AsyncMock)
    @patch('app.agents.EventsAgent.run', new_callable=AsyncMock)
    async def test_multi_domain(self, mock_events, mock_placement, mock_academic):
        mock_events_res = await self.mock_agent_run("events")
        mock_events_res.agent_name = "EventsAgent"
        mock_placement_res = await self.mock_agent_run("placement")
        mock_placement_res.agent_name = "PlacementAgent"
        
        mock_placement.return_value = mock_placement_res
        mock_events.return_value = mock_events_res
        
        orch = Orchestrator()
        
        with patch.object(orch, '_llm_route', new=self.mock_llm_route), \
             patch.object(orch, '_llm_synthesize', new=self.mock_llm_synthesize), \
             patch.object(orch.memory, '_llm_rewrite', new=self.mock_llm_rewrite):
             
             resp = await orch.handle("session2", "Am I eligible for placements and when is the next tech fest?")
             
             self.assertIn("PlacementAgent", resp.agents_used)
             self.assertIn("EventsAgent", resp.agents_used)
             self.assertEqual(len(resp.agents_used), 2)
             
    async def test_unroutable(self):
        orch = Orchestrator()
        with patch.object(orch, '_llm_route', new=self.mock_llm_route), \
             patch.object(orch.memory, '_llm_rewrite', new=self.mock_llm_rewrite):
             resp = await orch.handle("session3", "what's the weather?")
             
             self.assertEqual(len(resp.agents_used), 0)
             self.assertTrue(resp.escalated)
             self.assertIn("I cannot answer this query", resp.final_answer)

if __name__ == "__main__":
    unittest.main()
