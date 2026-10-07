import unittest
from unittest.mock import patch, AsyncMock
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.orchestrator import Orchestrator
from app.schemas import RouteDecision, AgentResult

class TestMemoryFlow(unittest.IsolatedAsyncioTestCase):
    async def mock_llm_rewrite(self, history, summary, query):
        if "when is it?" in query.lower():
            return "When is the TechNova festival?"
        return query

    async def mock_llm_route(self, query, memory_context):
        q = query.lower()
        if "technova" in q:
            return RouteDecision(domains=["events"], reasoning="tech fest", is_multi_domain=False)
        return RouteDecision(domains=["academics"], reasoning="default", is_multi_domain=False)

    async def mock_llm_synthesize(self, valid_results, failed_results):
        return valid_results[0].answer, valid_results[0].sources
        
    async def mock_run_agent(self, query, memory=None):
        return AgentResult(
            agent_name="EventsAgent" if "technova" in query.lower() else "AcademicAgent",
            answer=f"Simulated answer for: {query}",
            sources=[],
            confidence=0.9,
            status="ok"
        )

    @patch('app.agents.AcademicAgent.run', new_callable=AsyncMock)
    @patch('app.agents.PlacementAgent.run', new_callable=AsyncMock)
    @patch('app.agents.EventsAgent.run', new_callable=AsyncMock)
    @patch('app.agents.ServicesAgent.run', new_callable=AsyncMock)
    async def test_3_turn_conversation(self, mock_serv, mock_events, mock_place, mock_acad):
        # Setup common mock response logic
        async def side_effect_acad(q, memory=None): return await self.mock_run_agent(q, memory)
        async def side_effect_events(q, memory=None): return await self.mock_run_agent(q, memory)
        
        mock_acad.side_effect = side_effect_acad
        mock_events.side_effect = side_effect_events
        
        orch = Orchestrator()
        # Patch the LLMs
        orch.memory._llm_rewrite = self.mock_llm_rewrite
        orch._llm_route = self.mock_llm_route
        orch._llm_synthesize = self.mock_llm_synthesize
        
        # Turn 1
        res1 = await orch.handle("sess_mem", "Tell me about the TechNova festival.")
        self.assertIn("Simulated answer for: Tell me about the TechNova festival.", res1.final_answer)
        
        # Turn 2
        res2 = await orch.handle("sess_mem", "What is the attendance rule?")
        self.assertIn("Simulated answer for: What is the attendance rule?", res2.final_answer)
        
        # Turn 3 (Depends on Turn 1)
        res3 = await orch.handle("sess_mem", "When is it?")
        # The rewrite changes "When is it?" to "When is the TechNova festival?"
        self.assertIn("Simulated answer for: When is the TechNova festival?", res3.final_answer)
        
        # Check Memory limits (max_turns=2 means 4 items in history array)
        context = orch.memory.get_context("sess_mem")
        self.assertEqual(len(context["history"]), 4) 
        # Check if the summary was updated with the oldest turn (Turn 1)
        self.assertIn("TechNova", context["summary"])

if __name__ == "__main__":
    unittest.main()
