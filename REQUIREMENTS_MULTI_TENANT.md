# Architectural Requirements & Multi-Tenant Specification
## Agent College SaaS Platform & Embeddable Assistant

---

## 1. Executive Summary & Product Vision
**Agent College** is evolving from a standalone single-college prototype into a **B2B Multi-Tenant Campus Intelligence Platform (SaaS)**. 

### Core Capabilities:
1. **Multi-Tenant Serving:** Multiple institutions (e.g., Stanford, MIT, IIT Delhi) can register, upload their institutional handbooks, and isolate their operational data.
2. **Embeddable Web Widget:** A lightweight, drop-in `<script>` snippet or iframe that any college can embed on their public website, student portal, or Learning Management System (LMS).
3. **Current Frontend as a "Playground / Sandbox":** The current web application will serve as a **Developer & College Administrator Playground** where admins can test prompts, inspect live multi-agent DAG execution, test multi-domain routing, review logs, and manage escalations before deploying to production.
4. **Hierarchical Agent Orchestration:** Domain-specific advisors (`Academics`, `Placements`, `Events`, `Campus Services`, and future dynamic custom domains) that answer independently or synthesize multi-domain inquiries with strict guardrails and provenance.

---

## 2. What We Might Be Forgetting (Critical Production Considerations)

Before locking requirements, here are high-impact items often missed when going multi-tenant:

1. **Document Freshness & Version Invalidation (Academic Term Cycles):**
   - Policies change every semester/academic year. The system must support document archiving and version tags (`Fall 2024`, `Spring 2025`). Old document chunks must be superseded without re-ingesting the whole database.
2. **Per-College API Quotas & Rate-Limiting:**
   - LLMs and embedding APIs cost money. A rogue bot scraper on College A's public admissions site must not exhaust College B's API quota or cause system-wide denial of service.
3. **FERPA / Student Privacy & PII Scrubbing:**
   - Students frequently paste personal data into chat (Student IDs, medical certificates, phone numbers). The system needs an automatic PII redaction layer before queries hit LLMs or vector logs.
4. **Customizable Office Names & Agent Personas:**
   - College A calls it *"CDC (Career Development Centre)"*; College B calls it *"T&P Cell (Training & Placement)"*. The system must allow white-labeling agent names, logos, and descriptions per tenant.
5. **Human-in-the-Loop Hand-off / Webhooks:**
   - When a query escalates (`escalated: true`), simply writing to SQLite is insufficient for third-party colleges. They need webhooks or integrations (Zendesk, Freshdesk, Email, or Slack) to notify their actual student affairs staff.
6. **Iframe / Widget Isolation (CSS Pollution):**
   - Colleges often use antiquated CMS portals with global CSS that can break modern Tailwind styles. The embeddable widget must run inside an isolated **Shadow DOM** or **sandboxed Iframe**.

---

## 3. System Architecture & High-Level Topology

```
┌────────────────────────────────────────────────────────────────────────┐
│                        COLLEGE DIGITAL ECOSYSTEM                       │
│                                                                        │
│   College Public Website           Student Intranet / Canvas LMS       │
│   ┌───────────────────────┐       ┌───────────────────────────────┐    │
│   │ <script embed.js>     │       │ Embedded Authenticated Widget │    │
│   │ (Public Inquiries)    │       │ (SSO-signed Student JWT)      │    │
│   └───────────┬───────────┘       └───────────────┬───────────────┘    │
└───────────────┼───────────────────────────────────┼────────────────────┘
                │ Origin Whitelist                  │ Tenant API Key + JWT
                ▼                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     AGENT COLLEGE API GATEWAY                          │
│  - Tenant Resolver (maps domain/API key -> tenant_id)                  │
│  - Rate Limiter & Token Quota Guard                                    │
│  - PII Masking & Prompt Injection Firewall                             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                 ┌──────────────────┴──────────────────┐
                 ▼                                     ▼
┌─────────────────────────────────┐   ┌──────────────────────────────────┐
│ MULTI-AGENT ORCHESTRATION CORE  │   │ ADMIN & PLAYGROUND PLATFORM      │
│ - Intent Router                 │   │ (Current Frontend Extended)      │
│ - Domain Agents (Concurrent)    │   │ - Interactive Prompt Sandbox     │
│ - Deterministic Fallback Engine │   │ - Live Telemetry & DAG Viewer    │
│ - Response Synthesizer          │   │ - Document Upload & Chunker      │
│ - Hallucination Guardrail       │   │ - Escalation Ticket Queue        │
└───────────────┬─────────────────┘   └────────────────┬─────────────────┘
                │                                      │
                ▼                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      STORAGE & DATA ISOLATION LAYER                     │
│                                                                        │
│  PostgreSQL (Relational)          Vector Store (pgvector / Qdrant)     │
│  - Tenants & API Keys             - Chunk Embeddings                   │
│  - Custom Agent Configs           - Strict Partition:                  │
│  - Traces & Analytics               WHERE tenant_id = 'col_xyz'        │
│  - Escalation Tickets                                                  │
│                                   Cloud Object Storage (S3 / R2)       │
│                                   - Raw PDFs, Markdown, Handbooks      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Key Functional Modules & Requirements

### 4.1. Embeddable Widget (`widget.js`)
* **Distribution:** Hosted on a Global CDN (e.g. Cloudflare / AWS CloudFront).
* **Footprint:** Single bundle `< 60 KB` gzipped. Zero external CSS dependencies.
* **Embed Code Specification:**
  ```html
  <script 
    src="https://cdn.agentcollege.ai/v1/widget.js"
    data-tenant-id="col_mit_942"
    data-theme="light"
    data-position="bottom-right"
    defer>
  </script>
  ```
* **Capabilities:**
  - Floating launcher badge with unread pulse.
  - Expands to responsive mobile-friendly chat overlay.
  - Real-time Server-Sent Events (SSE) streaming.
  - Renders live advisor routing status and source citations.
  - Cross-origin message passing (`postMessage`) for host page communications.

---

### 4.2. Developer & College Admin Playground (Current Frontend)
The existing React/Vite application transforms into the **Operations & Testing Console**:
* **Live Sandbox Mode:**
  - Allows university administrators and developers to select any registered College profile from a switcher.
  - Test complex multi-domain queries and inspect which sub-agents fire.
  - Real-time DAG visualizer showing `Intent Router -> [Parallel Agents] -> Synthesizer` states.
* **Knowledge Base Manager:**
  - Drag-and-drop file uploader for institutional documents (`.pdf`, `.md`, `.txt`).
  - Automatic section chunking and vector indexation.
* **Observability & Analytics Hub:**
  - Fallback rates, token costs per query, agent latency histograms.
  - Escalation management: review open tickets, inspect student queries, assign resolution notes.

---

### 4.3. Multi-Tenant Storage & Isolation Architecture

#### A. Relational Data (PostgreSQL)
All records must be partitioned by `tenant_id`:
* `tenants`: Primary metadata (college name, slug, domain whitelist, plan tier, monthly token quota).
* `api_keys`: Public embed keys (`pk_live_...`) and Admin Secret keys (`sk_live_...`).
* `agents_config`: Dynamically enabled domains, custom display names, custom prompt addendums.
* `escalations`: Support tickets generated during fallback or unhandled queries.
* `traces`: Detailed step-by-step telemetry for query performance auditing.

#### B. Vector Database (Strict Metadata Partitioning)
* Store embeddings in PostgreSQL via `pgvector` or managed Qdrant/Pinecone.
* Every chunk metadata contains:
  ```json
  {
    "tenant_id": "col_mit_942",
    "domain": "academics",
    "source_file": "handbook_2024.pdf",
    "section": "Grading Policy",
    "academic_year": "2024-2025"
  }
  ```
* **Retrieval Query Constraint:**
  ```sql
  SELECT document, distance 
  FROM document_embeddings 
  WHERE tenant_id = :tenant_id AND domain = :domain
  ORDER BY embedding <=> :query_vector LIMIT 5;
  ```

---

### 4.4. Security, Auth, & Guardrails Architecture

1. **Origin Verification (CORS Guardrail):**
   - The API Gateway checks the `Origin` and `Referer` headers on incoming widget streams. If the request originates from `unauthorized-site.com`, the connection is immediately terminated (`403 Forbidden`).
2. **Student Authentication (Optional SSO Handshake):**
   - For colleges exposing sensitive/personalized student data, the parent portal issues an HMAC-SHA256 signature or signed JWT containing the student's ID/email.
3. **In-Flight Guardrails:**
   - **Scope Check:** Router detects off-topic queries (e.g. general coding, creative writing) and rejects early without querying domain databases.
   - **Partial Answer Resilience:** Dual queries across multiple domains (e.g. *Placements + Events*) allow each specialized agent to return partial answers with `status="ok"` rather than aborting.
   - **Deterministic Fallback Synthesizer:** If LLM synthesis encounters errors, clean rule-based mergers prevent blank or broken responses.

---

## 5. Architectural Changes Required in Current Codebase

| Component | Current State | Required Multi-Tenant State |
| :--- | :--- | :--- |
| **Vector DB** | Local directory ChromaDB instance (`data/vector_db`) | Managed vector database (`pgvector` / Qdrant) with `tenant_id` namespace filters. |
| **Database** | Single local SQLite file (`data/college.db`) | Central PostgreSQL database with schema migrations and foreign key constraints. |
| **Agent Configuration** | Hardcoded prompts in `backend/app/prompts/*.txt` | Dynamic prompt compilation combining base system prompts with tenant-specific overrides from DB. |
| **API Endpoints** | Parameterized only by `session_id` and `message` | Accepts `tenant_id` or resolved via `Authorization: Bearer <tenant_key>` header. |
| **Frontend App** | Single chat page with hardcoded student name | Multifunctional console: **Playground / Simulator** + **Embed Code Generator** + **Admin Analytics**. |
| **Widget** | Entire page rendered as full web app | Standalone web component/iframe package generated via separate build pipeline (`frontend/widget`). |

---

## 6. Implementation Roadmap

### Phase 1: Multi-Tenant Data Foundations
* Migrate SQLite schema to PostgreSQL with `tenant_id` columns.
* Parameterize vector retriever with required `tenant_id` filter.
* Implement Tenant API Key generation and middleware validation.

### Phase 2: Dynamic Agent Configuration
* Move agent definitions from static files to database records.
* Support per-college document ingestion pipeline with status tracking.
* Expand the Orchestrator to load tenant-specific active agents dynamically.

### Phase 3: Embeddable Widget Pipeline
* Create lightweight widget bundle build target in Vite.
* Implement cross-origin iframe / shadow-DOM mounting.
* Add theme customization (primary colors, avatar, title) loaded via tenant config.

### Phase 4: Playground & Admin Portal
* Convert current frontend into an administrative console.
* Add Tenant Switcher dropdown to test different colleges live.
* Add an "Embed Snippet" modal allowing admins to copy their customized `<script>` tag.
