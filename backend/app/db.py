import sqlite3
import uuid
import os
import json
from pathlib import Path
from typing import List, Dict, Any, Optional

DB_PATH = Path(os.getenv("DB_PATH", "../data/college.db")).resolve()

DEFAULT_TENANTS = [
    {
        "tenant_id": "apex_university",
        "name": "Apex Institute of Technology",
        "slug": "apex",
        "domain_whitelist": json.dumps(["localhost", "127.0.0.1", "*.apex.edu"]),
        "theme_color": "#4f46e5",
        "active_advisors": json.dumps({
            "academics": {"name": "Academic Regulations", "subtext": "Handbook 2024"},
            "placement": {"name": "Career Development Cell", "subtext": "Placement Rules"},
            "events": {"name": "Student Activities & Fests", "subtext": "Campus Calendar"},
            "services": {"name": "Housing & Campus Facilities", "subtext": "Campus Operations"}
        })
    },
    {
        "tenant_id": "stanford_global",
        "name": "Stanford Global Campus",
        "slug": "stanford",
        "domain_whitelist": json.dumps(["localhost", "127.0.0.1", "*.stanford.edu"]),
        "theme_color": "#b91c1c",
        "active_advisors": json.dumps({
            "academics": {"name": "Office of the University Registrar", "subtext": "Bulletin 2025"},
            "placement": {"name": "Stanford BEAM Career Center", "subtext": "Career & Internships"},
            "events": {"name": "Student Life & Traditions", "subtext": "Quarterly Calendar"},
            "services": {"name": "Residential & Dining Enterprises", "subtext": "Campus Housing"}
        })
    },
    {
        "tenant_id": "cambridge_tech",
        "name": "Cambridge Institute of Science",
        "slug": "cambridge",
        "domain_whitelist": json.dumps(["localhost", "127.0.0.1", "*.cambridge.ac.uk"]),
        "theme_color": "#0d9488",
        "active_advisors": json.dumps({
            "academics": {"name": "Board of Examinations", "subtext": "Statutes & Ordinances"},
            "placement": {"name": "University Careers Service", "subtext": "Employer Engagement"},
            "events": {"name": "Cambridge Union & Societies", "subtext": "Term Card"},
            "services": {"name": "Collegiate Estates & Library", "subtext": "Facilities & Lodgings"}
        })
    }
]

def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        # Tenants table
        conn.execute('''
            CREATE TABLE IF NOT EXISTS tenants (
                tenant_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                domain_whitelist TEXT,
                theme_color TEXT DEFAULT '#4f46e5',
                active_advisors TEXT,
                api_key TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            )
        ''')

        # Escalations with tenant_id
        conn.execute('''
            CREATE TABLE IF NOT EXISTS escalations (
                ticket_id TEXT PRIMARY KEY,
                tenant_id TEXT DEFAULT 'apex_university',
                session_id TEXT,
                query TEXT,
                status TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            )
        ''')

        # Traces with tenant_id
        conn.execute('''
            CREATE TABLE IF NOT EXISTS traces (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id TEXT DEFAULT 'apex_university',
                request_id TEXT,
                step TEXT,
                agent TEXT,
                input TEXT,
                output TEXT,
                latency_ms REAL,
                tokens_used INTEGER,
                timestamp TEXT
            )
        ''')

        # Requests metrics with tenant_id
        conn.execute('''
            CREATE TABLE IF NOT EXISTS requests (
                request_id TEXT PRIMARY KEY,
                tenant_id TEXT DEFAULT 'apex_university',
                session_id TEXT,
                escalated BOOLEAN,
                fallback_triggered BOOLEAN,
                route_domains TEXT,
                total_latency REAL,
                created_at TEXT DEFAULT (datetime('now'))
            )
        ''')

        # Knowledge documents table for tracking uploaded handbooks per tenant
        conn.execute('''
            CREATE TABLE IF NOT EXISTS tenant_documents (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                domain TEXT NOT NULL,
                filename TEXT NOT NULL,
                chunks_count INTEGER DEFAULT 0,
                uploaded_at TEXT DEFAULT (datetime('now'))
            )
        ''')

        # Auto-migrate existing tables if missing tenant_id column
        for table in ["traces", "requests", "escalations"]:
            try:
                cur = conn.execute(f"PRAGMA table_info({table})")
                cols = [c[1] for c in cur.fetchall()]
                if cols and "tenant_id" not in cols:
                    conn.execute(f"ALTER TABLE {table} ADD COLUMN tenant_id TEXT DEFAULT 'apex_university'")
            except Exception as e:
                print(f"[DB MIGRATION WARNING] Failed to migrate table {table}: {e}")

        # Seed initial tenants if none exist
        cursor = conn.execute("SELECT COUNT(*) FROM tenants")
        if cursor.fetchone()[0] == 0:
            for t in DEFAULT_TENANTS:
                api_key = f"pk_live_{t['slug']}_{uuid.uuid4().hex[:12]}"
                conn.execute('''
                    INSERT INTO tenants (tenant_id, name, slug, domain_whitelist, theme_color, active_advisors, api_key)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (t["tenant_id"], t["name"], t["slug"], t["domain_whitelist"], t["theme_color"], t["active_advisors"], api_key))

def get_tenants() -> List[Dict[str, Any]]:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.execute("SELECT * FROM tenants ORDER BY name ASC")
        tenants = []
        for row in cur.fetchall():
            d = dict(row)
            d["domain_whitelist"] = json.loads(d["domain_whitelist"] or "[]")
            d["active_advisors"] = json.loads(d["active_advisors"] or "{}")
            tenants.append(d)
        return tenants

def get_tenant(tenant_id: str) -> Optional[Dict[str, Any]]:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.execute("SELECT * FROM tenants WHERE tenant_id = ? OR slug = ?", (tenant_id, tenant_id))
        row = cur.fetchone()
        if not row:
            # Fallback to default tenant
            cur = conn.execute("SELECT * FROM tenants WHERE tenant_id = 'apex_university'")
            row = cur.fetchone()
            if not row:
                return None
        d = dict(row)
        d["domain_whitelist"] = json.loads(d["domain_whitelist"] or "[]")
        d["active_advisors"] = json.loads(d["active_advisors"] or "{}")
        return d

def get_tenant_by_api_key(api_key: str) -> Optional[Dict[str, Any]]:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.execute("SELECT * FROM tenants WHERE api_key = ?", (api_key,))
        row = cur.fetchone()
        if not row:
            return None
        d = dict(row)
        d["domain_whitelist"] = json.loads(d["domain_whitelist"] or "[]")
        d["active_advisors"] = json.loads(d["active_advisors"] or "{}")
        return d

def create_ticket(session_id: str, query: str, tenant_id: str = "apex_university") -> str:
    ticket_id = f"TCK-{uuid.uuid4().hex[:8].upper()}"
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute('''
            INSERT INTO escalations (ticket_id, tenant_id, session_id, query, status, created_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
        ''', (ticket_id, tenant_id, session_id, query, "OPEN"))
    return ticket_id

def get_all_tickets(tenant_id: Optional[str] = None):
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        if tenant_id:
            cursor = conn.execute('SELECT * FROM escalations WHERE tenant_id = ? ORDER BY created_at DESC', (tenant_id,))
        else:
            cursor = conn.execute('SELECT * FROM escalations ORDER BY created_at DESC')
        return [dict(row) for row in cursor.fetchall()]

def save_trace(trace: dict):
    tenant_id = trace.get('tenant_id', 'apex_university')
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute('''
            INSERT INTO traces (tenant_id, request_id, step, agent, input, output, latency_ms, tokens_used, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            tenant_id,
            trace.get('request_id'), trace.get('step'), trace.get('agent'),
            json.dumps(trace.get('input', {})), json.dumps(trace.get('output', {})),
            trace.get('latency_ms', 0), trace.get('tokens_used', 0), trace.get('timestamp')
        ))

def save_request_metrics(req_metrics: dict):
    tenant_id = req_metrics.get('tenant_id', 'apex_university')
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute('''
            INSERT INTO requests (request_id, tenant_id, session_id, escalated, fallback_triggered, route_domains, total_latency, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ''', (
            req_metrics['request_id'],
            tenant_id,
            req_metrics['session_id'],
            req_metrics['escalated'], req_metrics['fallback_triggered'],
            json.dumps(req_metrics.get('route_domains', [])),
            req_metrics['total_latency']
        ))

def get_traces(request_id: str):
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.execute('SELECT * FROM traces WHERE request_id = ? ORDER BY id ASC', (request_id,))
        results = []
        for row in cursor.fetchall():
            d = dict(row)
            d['input'] = json.loads(d['input'])
            d['output'] = json.loads(d['output'])
            results.append(d)
        return results

def get_metrics(tenant_id: Optional[str] = None):
    with sqlite3.connect(DB_PATH) as conn:
        where_clause = "WHERE tenant_id = ?" if tenant_id else ""
        params = (tenant_id,) if tenant_id else ()

        # Avg latency per agent
        cur1 = conn.execute(f"SELECT agent, AVG(latency_ms) as avg_latency FROM traces {where_clause} GROUP BY agent", params)
        avg_latency_per_agent = {row[0]: row[1] for row in cur1.fetchall() if row[0]}
        
        # Route distribution and fallback rate
        cur2 = conn.execute(f"SELECT COUNT(*) FROM requests {where_clause}", params)
        total_reqs = cur2.fetchone()[0] or 1
        
        fallback_query = f"SELECT COUNT(*) FROM requests WHERE fallback_triggered = 1 {'AND tenant_id = ?' if tenant_id else ''}"
        cur3 = conn.execute(fallback_query, params)
        fallbacks = cur3.fetchone()[0]
        fallback_rate = fallbacks / total_reqs
        
        cur4 = conn.execute(f"SELECT route_domains FROM requests {where_clause}", params)
        domains_count = {}
        for row in cur4.fetchall():
            try:
                domains = json.loads(row[0])
                for d in domains:
                    domains_count[d] = domains_count.get(d, 0) + 1
            except:
                pass
                
        return {
            "avg_latency_per_agent": avg_latency_per_agent,
            "route_distribution": domains_count,
            "fallback_rate": fallback_rate,
            "total_requests": total_reqs
        }
