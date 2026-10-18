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
  }
};
