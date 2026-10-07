import sqlite3
import uuid
import os
import json
from pathlib import Path

DB_PATH = Path(os.getenv("DB_PATH", "../data/college.db")).resolve()

def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS escalations (
                ticket_id TEXT PRIMARY KEY,
                session_id TEXT,
                query TEXT,
                status TEXT,
                created_at TEXT
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS traces (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        conn.execute('''
            CREATE TABLE IF NOT EXISTS requests (
                request_id TEXT PRIMARY KEY,
                session_id TEXT,
                escalated BOOLEAN,
                fallback_triggered BOOLEAN,
                route_domains TEXT,
                total_latency REAL,
                created_at TEXT
            )
        ''')

def create_ticket(session_id: str, query: str) -> str:
    ticket_id = f"TCK-{uuid.uuid4().hex[:8].upper()}"
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute('''
            INSERT INTO escalations (ticket_id, session_id, query, status, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))
        ''', (ticket_id, session_id, query, "OPEN"))
    return ticket_id

def get_all_tickets():
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.execute('SELECT * FROM escalations ORDER BY created_at DESC')
        return [dict(row) for row in cursor.fetchall()]

def save_trace(trace: dict):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute('''
            INSERT INTO traces (request_id, step, agent, input, output, latency_ms, tokens_used, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            trace.get('request_id'), trace.get('step'), trace.get('agent'),
            json.dumps(trace.get('input', {})), json.dumps(trace.get('output', {})),
            trace.get('latency_ms', 0), trace.get('tokens_used', 0), trace.get('timestamp')
        ))

def save_request_metrics(req_metrics: dict):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute('''
            INSERT INTO requests (request_id, session_id, escalated, fallback_triggered, route_domains, total_latency, created_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        ''', (
            req_metrics['request_id'], req_metrics['session_id'],
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

def get_metrics():
    with sqlite3.connect(DB_PATH) as conn:
        # Avg latency per agent
        cur1 = conn.execute("SELECT agent, AVG(latency_ms) as avg_latency FROM traces GROUP BY agent")
        avg_latency_per_agent = {row[0]: row[1] for row in cur1.fetchall() if row[0]}
        
        # Route distribution and fallback rate
        cur2 = conn.execute("SELECT COUNT(*) FROM requests")
        total_reqs = cur2.fetchone()[0] or 1
        
        cur3 = conn.execute("SELECT COUNT(*) FROM requests WHERE fallback_triggered = 1")
        fallbacks = cur3.fetchone()[0]
        fallback_rate = fallbacks / total_reqs
        
        cur4 = conn.execute("SELECT route_domains FROM requests")
        domains_count = {}
        for row in cur4.fetchall():
            domains = json.loads(row[0])
            for d in domains:
                domains_count[d] = domains_count.get(d, 0) + 1
                
        return {
            "avg_latency_per_agent": avg_latency_per_agent,
            "route_distribution": domains_count,
            "fallback_rate": fallback_rate
        }
