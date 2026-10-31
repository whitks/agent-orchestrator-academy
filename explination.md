# Agent College: Architecture & Project Technical Guide

## 1. Executive Summary

**Agent College** is an enterprise-grade, multi-tenant AI operations and advising platform built for higher education institutions. Rather than relying on a generic, single-prompt chatbot that hallucinates rules or conflates institutional policies, Agent College implements a **Hierarchical Multi-Agent Supervisor-Worker Pattern** combined with **strict multi-tenant vector & relational data isolation**.

Institutions can self-onboard, manage their domain handbooks across four functional verticals, and embed a customizable, low-latency AI advisor into their student portals and LMS with a single `<script>` tag.

---

## 2. Core Architectural Principles

```
                                  [ Student / Web User / Embed Widget ]
                                                   │
                                      HTTP / SSE (Streaming)
                                                   ▼
                                       ┌──────────────────────┐
                                       │ FastAPI API Gateway  │
                                       │  - CORS Middleware   │
                                       │  - Rate Limiter      │
                                       │  - Tenant Resolver   │
                                       └──────────┬───────────┘
                                                  │
                                                  ▼
                                      ┌───────────────────────┐
                                      │  Query Rewrite Node   │
                                      │ (Conversation History)│
                                      └───────────┬───────────┘
                                                  │
                                                  ▼
                                      ┌───────────────────────┐
                                      │ Supervisor / Router   │
                                      │ Intent Classification │
                                      └─────┬───┬───┬───┬─────┘
                                            │   │   │   │
                  ┌─────────────────────────┘   │   │   └─────────────────────────┐
                  ▼                             ▼   ▼                             ▼
       ┌─────────────────────┐        ┌───────────────┐        ┌─────────────────────┐
       │   Academic Agent    │        │Placement Agent│        │   Services Agent    │
       │ (Grades/Attendance) │        │(Eligibility)  │        │ (Hostel/Facilities) │
       └──────────┬──────────┘        └───────┬───────┘        └──────────┬──────────┘
                  │                           │                           │
                  └───────────────────►       │       ◄───────────────────┘
                                              ▼
                                     ┌─────────────────┐
                                     │  Events Agent   │
                                     │ (Fests/Dates)   │
                                     └────────┬────────┘
                                              │
                         ┌────────────────────┴────────────────────┐
                         ▼                                         ▼
           ┌────────────────────────────┐            ┌────────────────────────────┐
           │ ChromaDB Vector Store      │            │ SQLite Relational DB       │
           │ where={"tenant_id": ...}   │            │ (tenants, audit traces,    │
           │ 4 Domain Collections       │            │  users, escalations)       │
           └─────────────┬──────────────┘            └────────────────────────────┘
                         │
                         ▼
           ┌────────────────────────────┐
           │ Synthesis & Guardrail Node │
           │ - Ground truth enforcement │
           │ - Citation injection       │
           │ - Escalation triggering    │
           └─────────────┬──────────────┘
                         │
                         ▼
               [ Streamed Response ]
```

---

## 3. Multi-Agent Orchestration Engine

The application orchestrates specialized agents using a directed state graph:

### A. Query Rewrite Node
- Resolves contextual references, ambiguous pronouns, and multi-turn student follow-ups (e.g., *"What about for first-year students?"* $\rightarrow$ *"What is the attendance policy for first-year students at Apex University?"*).

### B. Supervisor / Router Agent
- Analyzes the rewritten query and determines which domain or domains are required to fulfill the answer.
- Supports **compound queries** (e.g., *"When is the tech fest and what CGPA do I need for placements?"*). In such cases, it invokes both the **Events Agent** and the **Placement Agent** simultaneously.

### C. Domain-Specialized Worker Agents
1. **Academic Agent**: Interprets official grading rubrics, attendance thresholds, medical waivers, credit transfer criteria, and course drops.
2. **Placement Agent**: Checks minimum GPA/CGPA cutoffs, tier-1 company recruiting guidelines, resume approval workflows, and NPTEL course requirements.
3. **Events Agent**: Manages cultural festivals, hackathons, guest lectures, club schedules, and academic calendar dates.
4. **Services Agent**: Covers student life operations including hostel curfews, mess timings, library hours, IT support, and transport.

### D. Response Synthesizer & Fact-Checking Guardrail
- Gathers the raw findings and confidence scores from active worker agents.
- Enforces strict factual fidelity: if none of the agents find evidence in the tenant's handbooks, the system returns `insufficient_evidence` and creates an **advisor escalation ticket** rather than fabricating information.
- Injects official source document citations (`rules.md`, `placement-guidelines.md`).

---

## 4. Multi-Tenant Data Isolation Model

Data belonging to College A must never leak into College B. Agent College achieves this using a **two-tier isolation model**:

### 1. Vector Database Tier (ChromaDB)
- **Directory**: `data/vector_db/`
- All institution documents are partitioned into four persistent collections: `academics`, `placement`, `events`, and `services`.
- When chunks are upserted, metadata includes:
  ```json
  {
    "tenant_id": "stanford_global",
    "domain": "academics",
    "document_id": "doc_stanford_global_academics_98a72b",
    "filename": "bulletin.md"
  }
  ```
- **Invariant Query Filter**: During vector similarity retrieval, the query vector is paired with a mandatory metadata constraint:
  ```python
  collection.query(
      query_texts=[query],
      n_results=4,
      where={"tenant_id": active_tenant_id}
  )
  ```
  Even with shared vector indices, cross-tenant vector retrieval is mathematically impossible.

### 2. Relational Database Tier (SQLite)
- **Directory**: `data/college.db`
- Maintains structured system entities partitioned by `tenant_id`:
  - `tenants`: Primary metadata, slugs, theme hex colors, allowed domain whitelists, and live API keys (`api_key`).
  - `users`: User profiles, role-based access control (RBAC), and tenant associations.
  - `documents`: Document registry, domain associations, chunk counts, and upload timestamps.
  - `escalations`: Open student support tickets requiring human advisor review.
  - `traces` & `requests`: Complete audit trail of agent decisions, execution durations, and latency metrics.

---

## 5. Security & Role-Based Access Control (RBAC)

The platform supports three distinct user personas:

| Persona | Scope | Capabilities |
| :--- | :--- | :--- |
| **Public User / Student** | Public Access | Asks questions via the chat playground or external embed widget; views execution traces; files human advisor escalations. |
| **College Admin** | Tenant-Scoped | Bound exclusively to their provisioned college (`tenant_id`). Can upload, index, and delete policy documents; configure deadline rules; resolve escalation tickets. Cannot see other colleges. |
| **Platform SuperAdmin** | System-Wide | Global fleet administration; audits multi-tenant query distributions; provisions new college tenants with isolated API keys. |

---

## 6. Real-Time Execution Tracing (Glass-Box AI)

Unlike opaque chatbots, Agent College implements **real-time visual observability**:
- **Live SSE Event Stream**: As requests are processed, the server yields events (`rewrite`, `routing`, `agent_active`, `agent_completed`, `final_answer_tokens`).
- **Interactive Flowchart**: The frontend displays a live status visualizer highlighting the exact execution path from router to worker agents to final synthesis.
- **Trace Inspector**: Users and administrators can expand **Advisor Execution Traces** beneath every message to view:
  - Exact similarity confidence percentages
  - Retrieved policy chunks
  - Execution runtime in milliseconds
  - Triggered escalations (if any)

---

## 7. Drop-In Embeddable Widget Integration

Any college can embed their customized AI campus assistant into their website, student ERP, or LMS with a single `<script>` tag:

```html
<!-- College Campus Assistant Widget -->
<script 
  src="http://localhost:8000/widget.js" 
  data-tenant-id="stanford_global"
  data-api-url="http://localhost:8000"
  data-theme-color="#8C1515"
  defer>
</script>
```

### Technical Implementation:
- **Shadow DOM Isolation**: The widget attaches to `#agent-college-widget-root` using a closed/open Shadow Root. This prevents host website CSS from breaking the chat UI and prevents chat styles from leaking into the university website.
- **Dynamic Theming**: The floating launcher pill, header, and buttons automatically inherit the brand color defined in `data-theme-color`.
- **Domain Whitelist Protection**: The API Gateway verifies the request's `Origin` header against the college's configured whitelist in `data/college.db` to prevent unauthorized domain embedding.

---

## 8. Directory & File Organization

```
agent-college/
├── backend/                        # FastAPI Backend & Orchestration Service
│   ├── app/
│   │   ├── main.py                 # API Gateway, SSE Streaming, & CORS handlers
│   │   ├── orchestrator.py         # Multi-Agent StateGraph & supervisor router
│   │   ├── db.py                   # Relational DB CRUD & schema initialization
│   │   ├── schemas.py              # Pydantic request/response models
│   │   ├── rag/
│   │   │   ├── ingest.py           # Text chunking & ChromaDB upsert utilities
│   │   │   └── retriever.py        # Metadata-scoped similarity retrieval
│   │   ├── prompts/                # Domain-specific prompt templates
│   │   └── static/
│   │       └── widget.js           # Production embeddable client widget
│   └── requirements.txt            # Python dependencies
├── frontend/                       # Vite + React + TypeScript Dashboard
│   ├── src/
│   │   ├── pages/
│   │   │   ├── ChatPage.tsx        # Multi-tenant student assistant playground
│   │   │   ├── AdminPage.tsx       # Scoped College Administrator portal
│   │   │   └── SuperAdminPage.tsx  # Global SaaS fleet console
│   │   ├── components/             # Reusable UI elements (Flowchart, Auth, Embed Modal)
│   │   └── api/client.ts           # Type-safe Axios/fetch client
│   ├── package.json
│   └── vite.config.ts
├── data/                           # Persistent Multi-Tenant Storage
│   ├── college.db                  # Relational SQLite database
│   ├── vector_db/                  # ChromaDB vector collection storage
│   └── tenants/                    # Tenant raw handbook markdown repositories
│       ├── stanford_global/
│       ├── apex_university/
│       └── skit_campus/
├── test/                           # Stanford University Reference Embed Portal
│   ├── index.html                  # Sample campus website embedding the widget
│   ├── style.css                   # University styling
│   └── script.js                   # Interactive client-side trigger bridge
├── howtorun.md                     # Step-by-step setup and operational runbook
└── explination.md                  # Comprehensive architecture and technical breakdown
```

---

## 9. Technology Stack Summary

- **Backend Framework**: FastAPI (Asynchronous Python 3.11+)
- **LLM Engine**: Google Gemini API (`gemini-2.5-flash` via LangChain)
- **Vector Database**: ChromaDB (Persistent client with collection-level metadata filtering)
- **Relational Storage**: SQLite3 (ACID-compliant storage for users, tickets, and configurations)
- **Frontend Engine**: React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons, Recharts
- **Streaming Protocol**: Server-Sent Events (SSE) for token-by-token streaming & pipeline progress updates
