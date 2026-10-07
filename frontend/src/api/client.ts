const API_URL = 'http://localhost:8000';

export interface TraceEvent {
  timestamp: string;
  step: string;
  agent: string;
  input: any;
  output: any;
  latency_ms: number;
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
}

export const api = {
  getMetrics: async () => {
    const res = await fetch(`${API_URL}/metrics`);
    if (!res.ok) throw new Error("API Error");
    return res.json();
  },
  
  getEscalations: async () => {
    const res = await fetch(`${API_URL}/admin/escalations`);
    if (!res.ok) throw new Error("API Error");
    return res.json();
  },
  
  clearSession: async (sessionId: string) => {
    const res = await fetch(`${API_URL}/session/${sessionId}`, { method: 'DELETE' });
    return res.json();
  }
};
