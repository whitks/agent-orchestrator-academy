const API_URL = 'http://localhost:8000';

export interface TraceEvent {
  timestamp: string;
  step: string;
  agent: string;
  input: any;
  output: any;
  latency_ms: number;
  tenant_id?: string;
  tokens_used?: number;
}

export interface EscalationDetails {
  ticket_id: string;
  suggested_contact: string;
}

export interface ChatResponse {
  final_answer: string;
  agents_used: string[];
  sources: string[];
  trace: TraceEvent[];
  escalated: boolean;
  escalation_details?: EscalationDetails;
  tenant_id?: string;
}

export interface Tenant {
  tenant_id: string;
  name: string;
  slug: string;
  domain_whitelist: string[];
  theme_color: string;
  active_advisors: Record<string, { name: string; subtext: string }>;
  api_key?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'college_admin' | 'superadmin';
  tenant_id?: string | null;
}

export interface TenantDocument {
  id: string;
  tenant_id: string;
  domain: string;
  filename: string;
  chunks_count: number;
  uploaded_at: string;
}

export const api = {
  getTenants: async (): Promise<{ tenants: Tenant[] }> => {
    const res = await fetch(`${API_URL}/api/tenants`);
    if (!res.ok) throw new Error("API Error fetching tenants");
    return res.json();
  },

  getTenantConfig: async (tenantId: string): Promise<Tenant> => {
    const res = await fetch(`${API_URL}/api/tenants/${tenantId}`);
    if (!res.ok) throw new Error("API Error fetching tenant config");
    return res.json();
  },

  getMetrics: async (tenantId?: string) => {
    const url = tenantId ? `${API_URL}/metrics?tenant_id=${tenantId}` : `${API_URL}/metrics`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("API Error");
    return res.json();
  },
  
  getEscalations: async (tenantId?: string) => {
    const url = tenantId ? `${API_URL}/admin/escalations?tenant_id=${tenantId}` : `${API_URL}/admin/escalations`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("API Error");
    return res.json();
  },
  
  clearSession: async (sessionId: string) => {
    const res = await fetch(`${API_URL}/session/${sessionId}`, { method: 'DELETE' });
    return res.json();
  },

  // Auth
  login: async (payload: { email?: string; password?: string; role?: string; tenant_id?: string }): Promise<{ token: string; user: UserProfile }> => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Authentication failed");
    }
    return res.json();
  },

  // Documents / Knowledge Base
  getDocuments: async (tenantId: string): Promise<{ documents: TenantDocument[] }> => {
    const res = await fetch(`${API_URL}/api/admin/documents?tenant_id=${tenantId}`);
    if (!res.ok) throw new Error("Failed to load documents");
    return res.json();
  },

  uploadDocument: async (tenantId: string, domain: string, filename: string, content: string) => {
    const res = await fetch(`${API_URL}/api/admin/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, domain, filename, content })
    });
    if (!res.ok) throw new Error("Failed to index document");
    return res.json();
  },

  deleteDocument: async (docId: string, tenantId: string) => {
    const res = await fetch(`${API_URL}/api/admin/documents/${docId}?tenant_id=${tenantId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error("Failed to delete document");
    return res.json();
  },

  // Operational Rules (Events & Deadlines)
  getRules: async (tenantId: string) => {
    const res = await fetch(`${API_URL}/api/admin/rules?tenant_id=${tenantId}`);
    if (!res.ok) throw new Error("Failed to load rules");
    return res.json();
  },

  saveRules: async (tenantId: string, ruleType: 'events' | 'deadlines', data: any) => {
    const res = await fetch(`${API_URL}/api/admin/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, rule_type: ruleType, data })
    });
    if (!res.ok) throw new Error("Failed to save rules");
    return res.json();
  },

  // Ticket Resolution
  resolveTicket: async (ticketId: string) => {
    const res = await fetch(`${API_URL}/api/admin/tickets/${ticketId}/resolve`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error("Failed to resolve ticket");
    return res.json();
  },

  // SuperAdmin
  getSuperadminStats: async () => {
    const res = await fetch(`${API_URL}/api/superadmin/stats`);
    if (!res.ok) throw new Error("Failed to fetch superadmin stats");
    return res.json();
  },

  provisionTenant: async (payload: { name: string; slug: string; theme_color?: string; domain_whitelist?: string[] }) => {
    const res = await fetch(`${API_URL}/api/superadmin/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("Failed to provision tenant");
    return res.json();
  }
};
