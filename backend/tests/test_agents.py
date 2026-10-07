import unittest
from unittest.mock import patch
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.schemas import AgentResult
from app.agents.academic import AcademicAgent
from app.agents.placement import PlacementAgent
from app.agents.events import EventsAgent
from app.agents.services import ServicesAgent

class TestDomainAgents(unittest.IsolatedAsyncioTestCase):
    async def mock_call_llm(self, query, context, sources, tool_calls):
        if not context and not tool_calls:
            return AgentResult(
                agent_name="MockAgent",
                answer="I don't have enough information.",
                sources=[],
                confidence=0.1,
                status="insufficient_evidence"
            )
        return AgentResult(
            agent_name="MockAgent",
            answer="Here is the answer based on context.",
            sources=sources,
            tool_calls=tool_calls,
            confidence=0.9,
            status="ok"
        )

    # 1. Academic Agent
    async def test_academic_agent_good(self):
        agent = AcademicAgent()
        with patch.object(agent, '_call_llm', new=self.mock_call_llm):
            result = await agent.run("What is the attendance rule?")
            self.assertEqual(result.status, "ok")
            self.assertIn("rules.md", result.sources)

    async def test_academic_agent_out_of_scope(self):
        agent = AcademicAgent()
        with patch.object(agent, '_call_llm', new=self.mock_call_llm):
            result = await agent.run("Tell me about quantum mechanics")
            self.assertEqual(result.status, "insufficient_evidence")

    # 2. Placement Agent
    async def test_placement_agent_good(self):
        agent = PlacementAgent()
        with patch.object(agent, '_call_llm', new=self.mock_call_llm):
            result = await agent.run("What is the CGPA for Tier 1?")
            self.assertEqual(result.status, "ok")
            self.assertIn("eligibility.md", result.sources)

    async def test_placement_agent_out_of_scope(self):
        agent = PlacementAgent()
        with patch.object(agent, '_call_llm', new=self.mock_call_llm):
            result = await agent.run("Where is the chemistry lab?")
            self.assertEqual(result.status, "insufficient_evidence")

    # 3. Events Agent
    async def test_events_agent_good(self):
        agent = EventsAgent()
        with patch.object(agent, '_call_llm', new=self.mock_call_llm):
            result = await agent.run("When is the cultural fest?")
            self.assertEqual(result.status, "ok")
            self.assertTrue(len(result.tool_calls) > 0)
            self.assertEqual(result.tool_calls[0]['step'], "ToolCall:event_lookup")

    async def test_events_agent_out_of_scope(self):
        agent = EventsAgent()
        async def mock_llm_out_of_scope(*args, **kwargs):
            return AgentResult(
                agent_name="EventsAgent",
                answer="Not found in events data.",
                sources=[],
                confidence=0.1,
                status="insufficient_evidence"
            )
        with patch.object(agent, '_call_llm', new=mock_llm_out_of_scope):
            result = await agent.run("Tell me about string theory")
            self.assertEqual(result.status, "insufficient_evidence")

    # 4. Services Agent
    async def test_services_agent_good(self):
        agent = ServicesAgent()
        with patch.object(agent, '_call_llm', new=self.mock_call_llm):
            result = await agent.run("What are the hostel timings?")
            self.assertEqual(result.status, "ok")
            self.assertIn("facilities.md", result.sources)

    async def test_services_agent_out_of_scope(self):
        agent = ServicesAgent()
        with patch.object(agent, '_call_llm', new=self.mock_call_llm):
            result = await agent.run("Who is the prime minister?")
            self.assertEqual(result.status, "insufficient_evidence")

if __name__ == "__main__":
    unittest.main()
