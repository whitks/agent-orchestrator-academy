import { useState, useEffect, useRef } from 'react';
import { 
  AlertTriangle, 
  FileText, 
  ChevronDown, 
  ChevronRight, 
  Send, 
  Paperclip, 
  Mic, 
  ShieldCheck, 
  GraduationCap, 
  MessageSquare, 
  ThumbsUp, 
  ThumbsDown, 
  Bot, 
  Building, 
  Code
} from 'lucide-react';
import type { TraceEvent, Tenant } from '../api/client';
import { api } from '../api/client';
import { AgentFlowchart } from '../components/AgentFlowchart';
import type { FlowchartState } from '../components/AgentFlowchart';
import { EmbedModal } from '../components/EmbedModal';

const API_URL = 'http://localhost:8000';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  agents: string[];
  sources: string[];
  traces: TraceEvent[];
  escalated?: boolean;
  ticket_id?: string;
  isStreaming?: boolean;
};

const SUGGESTIONS = [
  "What is the attendance rule?",
  "What is the CGPA cutoff for Tier 1 companies?",
  "When is the next cultural fest?",
  "Am I eligible for placements and when is the next tech fest?"
];

const INITIAL_FLOWCHART: FlowchartState = {
  rewrite: { status: 'idle' },
  router: { status: 'idle', domains: [] },
  agents: {
    academics: { status: 'idle' },
    placement: { status: 'idle' },
    events: { status: 'idle' },
    services: { status: 'idle' },
  },
  synthesizer: { status: 'idle' },
};

export default function ChatPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('apex_university');
  const [showEmbedModal, setShowEmbedModal] = useState<boolean>(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [session, setSession] = useState(`sess-${Math.random().toString(36).substr(2, 6)}`);
  const [activeFlowchart, setActiveFlowchart] = useState<FlowchartState>(INITIAL_FLOWCHART);
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Load tenants on mount
  useEffect(() => {
    api.getTenants().then(res => {
      if (res && res.tenants && res.tenants.length) {
        setTenants(res.tenants);
      }
    }).catch(() => {});
  }, []);

  const activeTenant = tenants.find(t => t.tenant_id === selectedTenantId) || {
    tenant_id: 'apex_university',
    name: 'Apex Institute of Technology',
    slug: 'apex',
    theme_color: '#4f46e5',
    domain_whitelist: [],
    active_advisors: {}
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeFlowchart]);

  const handleTenantChange = (newTenantId: string) => {
    setSelectedTenantId(newTenantId);
    setSession(`sess-${Math.random().toString(36).substr(2, 6)}`);
    setMessages([]);
    setActiveFlowchart(INITIAL_FLOWCHART);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: timeString,
      agents: [],
      sources: [],
      traces: []
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // Reset flowchart for this query
    const newFlow: FlowchartState = {
      rewrite: { status: 'running', text },
      router: { status: 'idle', domains: [] },
      agents: {
        academics: { status: 'idle' },
        placement: { status: 'idle' },
        events: { status: 'idle' },
        services: { status: 'idle' },
      },
      synthesizer: { status: 'idle' },
    };
    setActiveFlowchart(newFlow);

    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [
      ...prev,
      {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: timeString,
        agents: [],
        sources: [],
        traces: [],
        isStreaming: true
      }
    ]);

    const es = new EventSource(`${API_URL}/chat/stream?session_id=${session}&message=${encodeURIComponent(text)}&tenant_id=${encodeURIComponent(selectedTenantId)}`);

    let finalAnswer = '';
    let activeAgents: string[] = [];
    let messageSources: string[] = [];
    let messageTraces: TraceEvent[] = [];
    let isEscalated = false;
    let ticketId: string | undefined = undefined;

    es.onmessage = (e) => {
      const parsed = JSON.parse(e.data);

      if (parsed.event === 'progress') {
        if (parsed.step === 'rewrite') {
          setActiveFlowchart(prev => ({
            ...prev,
            rewrite: { status: 'running', text: parsed.message }
          }));
        } else if (parsed.step === 'routing') {
          setActiveFlowchart(prev => ({
            ...prev,
            rewrite: { status: 'completed' },
            router: { ...prev.router, status: 'running' }
          }));
        } else if (parsed.step === 'execution') {
          setActiveFlowchart(prev => ({
            ...prev,
            router: { ...prev.router, status: 'completed' }
          }));
        } else if (parsed.step === 'synthesis') {
          setActiveFlowchart(prev => ({
            ...prev,
            synthesizer: { status: 'running' }
          }));
        }
      } else if (parsed.event === 'router_decision') {
        const domains: string[] = parsed.domains || [];
        setActiveFlowchart(prev => {
          const updatedAgents = { ...prev.agents };
          domains.forEach((d: string) => {
            if (d in updatedAgents) {
              updatedAgents[d as keyof typeof updatedAgents] = { status: 'running' };
            }
          });
          return {
            ...prev,
            rewrite: { status: 'completed' },
            router: { status: 'completed', domains, reasoning: parsed.reasoning, confidence: parsed.confidence },
            agents: updatedAgents
          };
        });
      } else if (parsed.event === 'agent_completed') {
        const agentName: string = parsed.agent_name || '';
        const domainKey = agentName.toLowerCase().replace('agent', '');

        setActiveFlowchart(prev => {
          const updatedAgents = { ...prev.agents };
          if (domainKey in updatedAgents) {
            updatedAgents[domainKey as keyof typeof updatedAgents] = {
              status: parsed.status === 'ok' ? 'completed' : 'failed',
              confidence: parsed.confidence,
              preview: parsed.answer_preview
            };
          }
          return { ...prev, agents: updatedAgents };
        });

        if (!activeAgents.includes(agentName)) {
          activeAgents.push(agentName);
        }
        if (parsed.sources && Array.isArray(parsed.sources)) {
          parsed.sources.forEach((s: string) => {
            if (!messageSources.includes(s)) messageSources.push(s);
          });
        }
      } else if (parsed.event === 'final_answer_tokens') {
        finalAnswer += parsed.data;
        setMessages(prev => prev.map(m => m.id === assistantId ? {
          ...m,
          content: finalAnswer,
          agents: [...activeAgents],
          sources: [...messageSources]
        } : m));
      } else if (parsed.event === 'done') {
        es.close();
        if (parsed.agents && Array.isArray(parsed.agents)) {
          activeAgents = parsed.agents;
        }
        if (parsed.sources && Array.isArray(parsed.sources)) {
          messageSources = parsed.sources;
        }
        if (parsed.traces) {
          messageTraces = parsed.traces;
        }
        isEscalated = !!parsed.escalated;
        ticketId = parsed.ticket_id;

        setActiveFlowchart(prev => ({
          ...prev,
          synthesizer: { status: 'completed' }
        }));

        setMessages(prev => prev.map(m => m.id === assistantId ? {
          ...m,
          content: finalAnswer,
          agents: activeAgents,
          sources: messageSources,
          traces: messageTraces,
          isStreaming: false,
          escalated: isEscalated,
          ticket_id: ticketId
        } : m));
      }
    };

    es.onerror = () => {
      es.close();
      setActiveFlowchart(prev => ({
        ...prev,
        synthesizer: { status: 'failed' }
      }));
      setMessages(prev => prev.map(m => m.id === assistantId ? {
        ...m,
        content: finalAnswer || "An error occurred while contacting agents.",
        isStreaming: false,
        escalated: true
      } : m));
    };
  };

  return (
    <div className="flex-1 flex flex-col relative min-h-0">
      {/* Multi-Tenant Playground Control Bar */}
      <div className="bg-white border-b border-slate-200/60 px-4 sm:px-6 py-2.5 shrink-0">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500 uppercase tracking-wider text-[11px] flex items-center gap-1">
              <Building size={13} className="text-indigo-600" />
              Active Institution Playground:
            </span>
            <select
              value={selectedTenantId}
              onChange={(e) => handleTenantChange(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-800 font-semibold rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer text-xs"
            >
              {tenants.map(t => (
                <option key={t.tenant_id} value={t.tenant_id}>
                  {t.name} ({t.slug})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEmbedModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold border border-indigo-200/60 shadow-2xs transition-colors cursor-pointer"
            >
              <Code size={13} />
              <span>Get Embed Snippet</span>
            </button>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Session: <code className="font-mono text-slate-500">{session}</code>
            </span>
          </div>
        </div>
      </div>

      {/* Scrollable Chat Area */}
      <div className="flex-1 overflow-y-auto">
        <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 pt-6 pb-40 space-y-6">
          {/* Connected Advisors Card (Ambient Routing) */}
          <AgentFlowchart state={activeFlowchart} />

          {/* Empty State when no messages */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-10 px-4 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
                <Bot size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                  {activeTenant.name} Assistant Sandbox
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Test questions across academics, placements, events, and campus facilities. Queries are isolated to {activeTenant.name} handbooks.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-xl w-full pt-2">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="p-3 text-left bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-700 hover:text-slate-900 transition-all shadow-2xs cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat Flow Stack */}
          <div className="space-y-6">
            {messages.map(m => (
              <div key={m.id} className="space-y-3">
                {m.role === 'user' ? (
                  /* Student Query */
                  <div className="flex justify-end items-start gap-3">
                    <div className="max-w-2xl bg-white rounded-2xl rounded-tr-sm px-5 py-4 border border-slate-200/80 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)] text-slate-900">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 gap-4">
                        <span className="font-medium text-slate-500">krish sharma</span>
                        <span>{m.timestamp || 'Just now'}</span>
                      </div>
                      <p className="text-[14.5px] leading-relaxed text-slate-800 font-normal">
                        {m.content}
                      </p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-semibold shrink-0 mt-1">
                      KS
                    </div>
                  </div>
                ) : (
                  /* Assistant Response */
                  <div className="flex items-start gap-3.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-1 shadow-sm">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                        <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
                      </svg>
                    </div>
                    <div className="flex-1 bg-white rounded-3xl rounded-tl-sm p-6 sm:p-7 border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] space-y-6">
                      {/* Header badge */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-medium text-indigo-700">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100">
                            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                            Verified Policy • {activeTenant.name}
                          </span>
                          <span className="text-slate-400">• Fall 2024 / 2025</span>
                          {m.agents && m.agents.length > 0 && (
                            <span className="text-slate-400 hidden sm:inline">
                              • Handled by {m.agents.join(' & ')}
                            </span>
                          )}
                        </div>

                        {/* Main Message Content */}
                        <div className="text-[14.5px] leading-relaxed text-slate-700 whitespace-pre-wrap">
                          {m.content}
                          {m.isStreaming && <span className="inline-block w-2 h-4 bg-indigo-500 animate-pulse ml-1 align-middle" />}
                        </div>
                      </div>

                      {/* Escalation Alert Card if applicable */}
                      {m.escalated && (
                        <div className="bg-amber-50/70 border border-amber-200/70 rounded-2xl p-4 sm:p-4.5 flex items-start gap-3.5">
                          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                            <AlertTriangle className="w-4 h-4 text-amber-700" />
                          </div>
                          <div className="space-y-0.5">
                            <h3 className="text-sm font-semibold text-amber-900">
                              Support Notification {m.ticket_id ? `(Ticket ${m.ticket_id})` : ''}
                            </h3>
                            <p className="text-xs sm:text-[13px] text-amber-800 leading-relaxed">
                              A portion of this query requires manual review by {activeTenant.name} staff. An automated support request has been logged.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Verified Sources */}
                      {m.sources && m.sources.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 space-y-2">
                          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Official Policy References
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            {m.sources.map((src, i) => (
                              <a
                                key={i}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/70 text-slate-700 text-xs font-medium transition-colors"
                                href="#"
                                onClick={(e) => e.preventDefault()}
                              >
                                <FileText className="w-3.5 h-3.5 text-rose-500" />
                                <span>{src}</span>
                                <span className="text-slate-400 text-[10px]">↗</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Observability Traces Accordion */}
                      {m.traces && m.traces.length > 0 && (
                        <div className="pt-2 border-t border-slate-100">
                          <button
                            onClick={() => setExpandedTraceId(expandedTraceId === m.id ? null : m.id)}
                            className="text-xs font-medium text-slate-500 hover:text-indigo-600 flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            {expandedTraceId === m.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <span>{expandedTraceId === m.id ? 'Hide Multi-Agent Traces' : `View ${m.traces.length} Advisor Execution Traces`}</span>
                          </button>

                          {expandedTraceId === m.id && (
                            <div className="mt-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2 text-xs font-mono">
                              {m.traces.map((tr, idx) => (
                                <div key={idx} className="p-2.5 bg-white rounded-lg border border-slate-200/60 shadow-2xs">
                                  <div className="flex justify-between items-center text-slate-700 font-semibold mb-1">
                                    <span className="text-indigo-600 font-sans">{tr.step} ({tr.agent})</span>
                                    <span className="text-[10px] text-slate-400">{tr.latency_ms.toFixed(1)} ms</span>
                                  </div>
                                  {tr.output && (
                                    <pre className="mt-1 text-[11px] text-slate-600 bg-slate-50 p-2 rounded overflow-x-auto max-h-32">
                                      {typeof tr.output === 'string' ? tr.output : JSON.stringify(tr.output, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Primary Actions & Feedback */}
                      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <button
                            onClick={() => sendMessage("Can you assist me with filing an official request for this?")}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                          >
                            <GraduationCap className="w-4 h-4" />
                            <span>File Student Request</span>
                          </button>
                          <button
                            onClick={() => sendMessage("Connect me with academic advisor")}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/70 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                            <span>Talk to Academic Advisor</span>
                          </button>
                        </div>
                        <div className="flex items-center gap-1 text-slate-400">
                          <button className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 cursor-pointer" title="Helpful answer">
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                          <button className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 cursor-pointer" title="Not helpful">
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={endRef} />
          </div>
        </main>
      </div>

      {/* Solid White Pinned Floating Input Dock */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] py-4 px-4">
        <div className="max-w-3xl mx-auto space-y-2">
          {/* Input Box */}
          <div className="bg-slate-50 rounded-2xl sm:rounded-3xl p-1.5 sm:p-2 border border-slate-200/90 shadow-2xs flex items-center gap-2">
            <button
              className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors shrink-0 cursor-pointer"
              title="Attach document"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
              className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none text-slate-800 text-[14px] placeholder:text-slate-400 px-1 py-1"
              placeholder={`Ask ${activeTenant.name} about policies, exams, placement rules...`}
              type="text"
            />
            <button
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors shrink-0 cursor-pointer"
              title="Voice Input"
            >
              <Mic className="w-4 h-4" />
            </button>
            <button
              onClick={() => sendMessage(input)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shrink-0 shadow-sm transition-colors cursor-pointer"
              title="Send Question"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Suggestions */}
          <div className="hidden sm:flex items-center justify-center gap-1.5 text-xs text-slate-500">
            <span className="text-slate-400 text-[11px] mr-1">Suggestions:</span>
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200/70 border border-slate-200/70 text-slate-600 hover:text-slate-900 transition-all text-xs cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Embed Code Modal */}
      <EmbedModal
        tenantId={activeTenant.tenant_id}
        tenantName={activeTenant.name}
        themeColor={activeTenant.theme_color || '#4f46e5'}
        isOpen={showEmbedModal}
        onClose={() => setShowEmbedModal(false)}
      />
    </div>
  );
}
