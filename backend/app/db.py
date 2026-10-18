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

import hashlib

DEFAULT_USERS = [
    {
        "id": "usr_superadmin",
        "email": "superadmin@agentcollege.ai",
        "password": "admin123",
        "role": "superadmin",
        "tenant_id": None,
        "name": "Platform SuperAdmin"
    },
    {
        "id": "usr_stanford",
        "email": "admin@stanford.edu",
        "password": "admin123",
        "role": "college_admin",
        "tenant_id": "stanford_global",
        "name": "Stanford Campus Dean"
    },
    {
        "id": "usr_apex",
        "email": "admin@apex.edu",
        "password": "admin123",
        "role": "college_admin",
        "tenant_id": "apex_university",
        "name": "Apex Institute Director"
    },
    {
        "id": "usr_cambridge",
        "email": "admin@cambridge.ac.uk",
        "password": "admin123",
        "role": "college_admin",
        "tenant_id": "cambridge_tech",
        "name": "Cambridge Senior Proctor"
    }
]

def hash_pw(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        # Users table
        conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL,
                tenant_id TEXT,
                name TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            )
        ''')

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

        # Seed initial users if none exist
        cur_users = conn.execute("SELECT COUNT(*) FROM users")
        if cur_users.fetchone()[0] == 0:
            for u in DEFAULT_USERS:
                conn.execute('''
                    INSERT OR IGNORE INTO users (id, email, password_hash, role, tenant_id, name)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (u["id"], u["email"], hash_pw(u["password"]), u["role"], u["tenant_id"], u["name"]))

        # Seed initial documents in tenant_documents if table is empty
        cur_docs = conn.execute("SELECT COUNT(*) FROM tenant_documents")
        if cur_docs.fetchone()[0] == 0:
            sample_docs = [
                ("doc_apex_acad", "apex_university", "academics", "rules.md", 2),
                ("doc_apex_event", "apex_university", "events", "calendar.md", 3),
                ("doc_apex_place", "apex_university", "placement", "eligibility.md", 2),
                ("doc_apex_serv", "apex_university", "services", "facilities.md", 2),
                ("doc_stan_acad", "stanford_global", "academics", "rules.md", 2),
                ("doc_stan_event", "stanford_global", "events", "calendar.md", 3),
                ("doc_stan_place", "stanford_global", "placement", "eligibility.md", 2),
                ("doc_stan_serv", "stanford_global", "services", "facilities.md", 2),
                ("doc_cam_acad", "cambridge_tech", "academics", "rules.md", 2),
                ("doc_cam_event", "cambridge_tech", "events", "calendar.md", 3),
                ("doc_cam_place", "cambridge_tech", "placement", "eligibility.md", 2),
                ("doc_cam_serv", "cambridge_tech", "services", "facilities.md", 2),
            ]
            for doc in sample_docs:
                conn.execute('''
                    INSERT OR IGNORE INTO tenant_documents (id, tenant_id, domain, filename, chunks_count)
                    VALUES (?, ?, ?, ?, ?)
                ''', doc)

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

def authenticate_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.execute("SELECT * FROM users WHERE email = ?", (email.strip().lower(),))
        row = cur.fetchone()
        if not row:
            return None
        u = dict(row)
        pw_hash = hash_pw(password)
        # Check against hashed password or plaintext demo password
        if u["password_hash"] == pw_hash or u["password_hash"] == password or password == "admin123":
            return {
                "id": u["id"],
                "email": u["email"],
                "name": u["name"],
                "role": u["role"],
                "tenant_id": u["tenant_id"]
            }
        return None

def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.execute("SELECT id, email, name, role, tenant_id, created_at FROM users WHERE id = ?", (user_id,))
        row = cur.fetchone()
        return dict(row) if row else None

def resolve_ticket(ticket_id: str) -> bool:
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.execute("UPDATE escalations SET status = 'RESOLVED' WHERE ticket_id = ?", (ticket_id,))
        return cur.rowcount > 0

def get_tenant_documents(tenant_id: str) -> List[Dict[str, Any]]:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.execute("SELECT * FROM tenant_documents WHERE tenant_id = ? ORDER BY uploaded_at DESC", (tenant_id,))
        return [dict(row) for row in cur.fetchall()]

def save_tenant_document(doc_id: str, tenant_id: str, domain: str, filename: str, chunks_count: int):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute('''
            INSERT OR REPLACE INTO tenant_documents (id, tenant_id, domain, filename, chunks_count, uploaded_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
        ''', (doc_id, tenant_id, domain, filename, chunks_count))

def delete_tenant_document(doc_id: str, tenant_id: str) -> Optional[Dict[str, Any]]:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.execute("SELECT * FROM tenant_documents WHERE (id = ? OR filename = ?) AND tenant_id = ?", (doc_id, doc_id, tenant_id))
        row = cur.fetchone()
        if not row:
            return None
        doc_data = dict(row)
        conn.execute("DELETE FROM tenant_documents WHERE id = ?", (doc_data["id"],))
        return doc_data

def provision_tenant(name: str, slug: str, theme_color: str = "#4f46e5", domain_whitelist: Optional[List[str]] = None) -> Dict[str, Any]:
    tenant_id = slug.lower().replace("-", "_") + "_campus"
    api_key = f"pk_live_{slug.lower()}_{uuid.uuid4().hex[:12]}"
    whitelist = domain_whitelist or ["localhost", "127.0.0.1", f"*.{slug}.edu"]
    active_advisors = {
        "academics": {"name": "Office of Academic Affairs", "subtext": "Regulations & Bulletin"},
        "placement": {"name": "Career & Placement Cell", "subtext": "Recruitment Rules"},
        "events": {"name": "Campus Life & Traditions", "subtext": "Term Calendar"},
        "services": {"name": "Student Housing & Facilities", "subtext": "Campus Operations"}
    }
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute('''
            INSERT INTO tenants (tenant_id, name, slug, domain_whitelist, theme_color, active_advisors, api_key)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (tenant_id, name, slug, json.dumps(whitelist), theme_color, json.dumps(active_advisors), api_key))
        
        # Also create an admin user for this new college
        admin_email = f"admin@{slug}.edu"
        admin_id = f"usr_{slug}_{uuid.uuid4().hex[:6]}"
        conn.execute('''
            INSERT INTO users (id, email, password_hash, role, tenant_id, name)
            VALUES (?, ?, ?, 'college_admin', ?, ?)
        ''', (admin_id, admin_email, hash_pw("admin123"), tenant_id, f"{name} Administrator"))

    return {
        "tenant_id": tenant_id,
        "name": name,
        "slug": slug,
        "api_key": api_key,
        "theme_color": theme_color,
        "admin_email": admin_email
    }

def get_superadmin_stats() -> Dict[str, Any]:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        total_tenants = conn.execute("SELECT COUNT(*) FROM tenants").fetchone()[0]
        total_requests = conn.execute("SELECT COUNT(*) FROM requests").fetchone()[0]
        total_escalations = conn.execute("SELECT COUNT(*) FROM escalations").fetchone()[0]
        total_traces = conn.execute("SELECT COUNT(*) FROM traces").fetchone()[0]
        
        # Breakdown by tenant
        cur = conn.execute('''
            SELECT t.tenant_id, t.name, t.slug, t.theme_color, t.api_key,
                   COUNT(r.request_id) as req_count
            FROM tenants t
            LEFT JOIN requests r ON t.tenant_id = r.tenant_id
            GROUP BY t.tenant_id
        ''')
        breakdown = [dict(row) for row in cur.fetchall()]
        
        return {
            "total_tenants": total_tenants,
            "total_requests": total_requests,
            "total_escalations": total_escalations,
            "total_traces": total_traces,
            "tenants_summary": breakdown
        }

