"""agent.py - a general-purpose Q&A agent running on Groq via LangChain.

Usage:
    python agent.py                 # interactive chat
    python agent.py "your question" # single-shot question
"""

from __future__ import annotations

import ast
import json
import math
import operator
import os
import sys
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain.tools import tool
from langchain_groq import ChatGroq
from langgraph.checkpoint.memory import InMemorySaver
from rich.console import Console

load_dotenv()

DEFAULT_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
THREAD_ID = "agent-college-main"
CONSOLE = Console()

SYSTEM_PROMPT = """You are a precise, general-purpose question-answering assistant.

Rules:
- Use the available tools whenever they improve accuracy (dates, arithmetic, web lookups).
- Never fabricate facts, URLs, quotes or citations. If you are unsure, say so plainly.
- Keep answers concise and well structured; use short paragraphs or lists.
- Distinguish clearly between what a tool told you and what you know from training.
"""


# --------------------------------------------------------------------------
# Safe calculator (no eval)
# --------------------------------------------------------------------------

_BIN_OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
}
_UNARY_OPS = {ast.USub: operator.neg, ast.UAdd: operator.pos}
_FUNCS = {
    "sqrt": math.sqrt,
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "log": math.log,
    "log2": math.log2,
    "log10": math.log10,
    "exp": math.exp,
    "ceil": math.ceil,
    "floor": math.floor,
    "abs": abs,
    "round": round,
}


def _eval_node(node: ast.AST) -> float:
    if isinstance(node, ast.Expression):
        return _eval_node(node.body)

    if isinstance(node, ast.Constant):
        if isinstance(node.value, bool) or not isinstance(node.value, (int, float)):
            raise ValueError("only numbers are allowed")
        return node.value

    if isinstance(node, ast.BinOp):
        if isinstance(node.op, ast.Pow):
            base, exp = _eval_node(node.left), _eval_node(node.right)
            if abs(exp) > 1000 or (abs(base) > 1 and abs(exp) > 64):
                raise ValueError("exponent too large")
            return base**exp
        op = _BIN_OPS.get(type(node.op))
        if op is None:
            raise ValueError(f"operator {type(node.op).__name__} is not allowed")
        return op(_eval_node(node.left), _eval_node(node.right))

    if isinstance(node, ast.UnaryOp):
        op = _UNARY_OPS.get(type(node.op))
        if op is None:
            raise ValueError(f"operator {type(node.op).__name__} is not allowed")
        return op(_eval_node(node.operand))

    if isinstance(node, ast.Call):
        if not isinstance(node.func, ast.Name) or node.func.id not in _FUNCS:
            raise ValueError("only whitelisted math functions may be called")
        if node.keywords:
            raise ValueError("keyword arguments are not allowed")
        return _FUNCS[node.func.id](*( _eval_node(a) for a in node.args ))

    raise ValueError(f"unsupported syntax: {type(node).__name__}")


@tool
def calculate(expression: str) -> str:
    """Evaluate an arithmetic expression, e.g. "2 + 2" or "sqrt(144) * 3".
    Supports + - * / // % ** and the functions sqrt, sin, cos, tan, log,
    log2, log10, exp, ceil, floor, abs, round."""
    expression = expression.strip()
    if not expression:
        return "Error: empty expression"
    if len(expression) > 200:
        return "Error: expression too long"
    try:
        tree = ast.parse(expression, mode="eval")
    except SyntaxError as exc:
        return f"Error: invalid expression ({exc.msg})"
    try:
        result = _eval_node(tree)
    except ZeroDivisionError:
        return "Error: division by zero"
    except (ValueError, OverflowError) as exc:
        return f"Error: {exc}"
    if isinstance(result, float) and (math.isnan(result) or math.isinf(result)):
        return f"Error: result is {result}"
    return repr(result)


@tool
def current_datetime() -> str:
    """Return today's date and the current time in UTC.
    Use this whenever the user asks about 'today', dates, deadlines or timing."""
    now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%d %H:%M:%S UTC (%A)")


# --------------------------------------------------------------------------
# Optional web search (registered only when TAVILY_API_KEY is set)
# --------------------------------------------------------------------------

def _web_search_tool():
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        return None

    @tool
    def web_search(query: str) -> str:
        """Search the web for current information. Returns the top results
        as a readable list of titles, URLs and snippets."""
        try:
            resp = requests.post(
                "https://api.tavily.com/search",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={"query": query, "max_results": 5, "search_depth": "basic"},
                timeout=20,
            )
            resp.raise_for_status()
            results = resp.json().get("results", [])
        except Exception as exc:  # noqa: BLE001 - surface the failure to the model
            return f"Search failed: {exc}"
        if not results:
            return "No results found."
        return "\n\n".join(
            f"{r.get('title', '')}\n{r.get('url', '')}\n{r.get('content', '')}"
            for r in results
        )

    return web_search


# --------------------------------------------------------------------------
# Agent
# --------------------------------------------------------------------------

def build_agent(model: str | None = None):
    """Build the Groq-backed agent. Returns a compiled LangGraph agent."""
    model = model or DEFAULT_MODEL
    extra: dict = {}
    if "gpt-oss" in model:
        # Keep reasoning out of the visible answer for reasoning models.
        extra["reasoning_format"] = "parsed"

    llm = ChatGroq(model_name=model, temperature=0.2, max_retries=2, **extra)

    tools = [calculate, current_datetime]
    if (search := _web_search_tool()) is not None:
        tools.append(search)

    return create_agent(
        model=llm,
        tools=tools,
        system_prompt=SYSTEM_PROMPT,
        checkpointer=InMemorySaver(),
    )


def ask(agent, question: str, thread_id: str = THREAD_ID) -> str:
    """Stream one turn of conversation and return the final answer."""
    config = {"configurable": {"thread_id": thread_id}}
    run = agent.stream_events(
        {"messages": [{"role": "user", "content": question}]},
        config=config,
        version="v3",
    )

    printed = False
    for kind, item in run.interleave("messages", "tool_calls"):
        if kind == "messages":
            for token in item.text:
                if token:
                    sys.stdout.write(token)
                    sys.stdout.flush()
                    printed = True
            if printed:
                sys.stdout.write("\n")
                sys.stdout.flush()
        elif kind == "tool_calls":
            args = json.dumps(item.input, ensure_ascii=False) if item.input else ""
            CONSOLE.print(f"[dim]-> {item.tool_name}({args})[/dim]")
            try:
                for delta in item.output_deltas:
                    if delta:
                        CONSOLE.print(str(delta), style="dim", highlight=False)
            except Exception:  # noqa: BLE001 - delta streaming is best-effort
                pass
            if item.error:
                CONSOLE.print(f"[red]tool error: {item.error}[/red]")

    try:
        state = run.output
        messages = state["messages"] if isinstance(state, dict) else getattr(state, "messages", [])
        final = messages[-1]
        text = final.text if hasattr(final, "text") else str(final.content)
    except Exception as exc:  # noqa: BLE001
        CONSOLE.print(f"[red]Agent failed: {exc}[/red]")
        return ""

    if not printed and text:
        CONSOLE.print(text)
    return text


def main() -> int:
    if not os.getenv("GROQ_API_KEY"):
        CONSOLE.print(
            "[red]GROQ_API_KEY is not set.[/red] "
            "Add it to .env (see .env.example), then try again."
        )
        return 1

    agent = build_agent()

    if len(sys.argv) > 1:
        ask(agent, " ".join(sys.argv[1:]))
        return 0

    CONSOLE.print(
        f"[bold]Groq agent ready[/bold] [dim](model: {DEFAULT_MODEL}, "
        "type /reset to clear memory, /quit to exit)[/dim]\n"
    )
    while True:
        try:
            question = CONSOLE.input("[bold blue]>[/bold blue] ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not question:
            continue
        if question.lower() in {"/quit", "/exit", "quit", "exit", "q"}:
            break
        if question.lower() == "/reset":
            globals()["THREAD_ID"] = f"agent-college-{os.urandom(4).hex()}"
            CONSOLE.print("[green]Memory cleared.[/green]\n")
            continue
        try:
            ask(agent, question)
        except KeyboardInterrupt:
            CONSOLE.print("\n[yellow]Interrupted.[/yellow]")
        except Exception as exc:  # noqa: BLE001
            CONSOLE.print(f"[red]Error: {exc}[/red]")
        print()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
