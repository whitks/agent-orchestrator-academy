import { useEffect, useState } from 'react';
import { api, type Tenant, type TenantDocument } from '../api/client';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  ShieldAlert, BarChart3, Clock, AlertCircle, RefreshCw, FileText, 
  Building, Key, Upload, Trash2, Calendar, CheckCircle2, Plus
} from 'lucide-react';

export default function AdminPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('stanford_global');
  const [activeTab, setActiveTab] = useState<'analytics' | 'documents' | 'rules' | 'escalations'>('analytics');
  
  // Data states
  const [metrics, setMetrics] = useState<any>(null);
  const [escalations, setEscalations] = useState<any[]>([]);
  const [documents, setDocuments] = useState<TenantDocument[]>([]);
  const [rules, setRules] = useState<{ events: any[]; deadlines: any }>({ events: [], deadlines: {} });
  const [loading, setLoading] = useState(true);

  // New Document Modal State
  const [showDocModal, setShowDocModal] = useState(false);
  const [docDomain, setDocDomain] = useState('academics');
  const [docFilename, setDocFilename] = useState('');
  const [docContent, setDocContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Fetch tenants on mount
  useEffect(() => {
    api.getTenants().then(res => {
      if (res && res.tenants && res.tenants.length) {
        setTenants(res.tenants);
      }
    }).catch(() => {});
  }, []);

  const fetchTenantData = (tenantId: string) => {
    setLoading(true);
    Promise.all([
      api.getMetrics(tenantId).then(setMetrics).catch(() => {}),
      api.getEscalations(tenantId).then(res => setEscalations(res.tickets || [])).catch(() => {}),
      api.getDocuments(tenantId).then(res => setDocuments(res.documents || [])).catch(() => {}),
      api.getRules(tenantId).then(setRules).catch(() => {})
    ]).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTenantData(selectedTenantId);
  }, [selectedTenantId]);

  const activeTenant = tenants.find(t => t.tenant_id === selectedTenantId) || {
    tenant_id: 'stanford_global',
    name: 'Stanford Global Campus',
    slug: 'stanford',
    theme_color: '#b91c1c',
    api_key: 'pk_live_stanford_demo',
    domain_whitelist: []
  };

  // Upload new policy document
  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFilename || !docContent) return;
    setUploading(true);
    try {
      const res = await api.uploadDocument(selectedTenantId, docDomain, docFilename, docContent);
      setNotice(`Indexed ${res.filename} with ${res.chunks_indexed} vectors into ChromaDB!`);
      setShowDocModal(false);
      setDocFilename('');
      setDocContent('');
      api.getDocuments(selectedTenantId).then(r => setDocuments(r.documents || []));
    } catch (err: any) {
      alert(err.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  // Delete policy document & cascade purge vectors
  const handleDeleteDocument = async (docId: string, filename: string) => {
    if (!window.confirm(`Permanently delete "${filename}" and purge all its vectors from ChromaDB?`)) return;
    try {
      const res = await api.deleteDocument(docId, selectedTenantId);
      setNotice(`Deleted ${filename} and purged ${res.purged_vectors} vectors from memory.`);
      api.getDocuments(selectedTenantId).then(r => setDocuments(r.documents || []));
    } catch (err: any) {
      alert(err.message || "Failed to delete document");
    }
  };

  // Resolve escalation ticket
  const handleResolveTicket = async (ticketId: string) => {
    try {
      await api.resolveTicket(ticketId);
      setNotice(`Ticket ${ticketId} marked as RESOLVED.`);
      api.getEscalations(selectedTenantId).then(r => setEscalations(r.tickets || []));
    } catch (err: any) {
      alert(err.message || "Failed to resolve ticket");
    }
  };

  const chartData = metrics?.route_distribution
    ? Object.entries(metrics.route_distribution).map(([name, count]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        count
      }))
    : [];

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-8 max-w-5xl mx-auto w-full space-y-6">
      {/* Top Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/60">
        <div>
          <div className="flex items-center gap-2">
            <span 
              className="w-2.5 h-2.5 rounded-full" 
              style={{ backgroundColor: activeTenant.theme_color || '#4f46e5' }}
            ></span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Institutional Admin Portal
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 mt-0.5">
            {activeTenant.name} Operations Hub
          </h2>
          <p className="text-xs text-slate-500">
            Self-service policy knowledge base, live mock event rules, and escalation triage
          </p>
        </div>

        {/* Tenant Filter Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200/90 rounded-xl px-2.5 py-1.5 shadow-2xs">
            <Building size={14} className="text-indigo-600 shrink-0" />
            <select
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
            >
              {tenants.map(t => (
                <option key={t.tenant_id} value={t.tenant_id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => fetchTenantData(selectedTenantId)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-700 text-xs font-semibold shadow-xs transition-colors cursor-pointer w-fit"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin text-indigo-600' : 'text-slate-500'} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-emerald-600 hover:text-emerald-800 font-bold ml-2">✕</button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex bg-slate-100/80 p-1 rounded-xl text-xs font-semibold border border-slate-200/50">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'analytics' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 size={13} />
          <span>Analytics & Routing</span>
        </button>

        <button
          onClick={() => setActiveTab('documents')}
          className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'documents' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText size={13} />
          <span>Knowledge Handbooks ({documents.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('rules')}
          className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'rules' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar size={13} />
          <span>Fests & Deadlines</span>
        </button>

        <button
          onClick={() => setActiveTab('escalations')}
          className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'escalations' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <AlertCircle size={13} />
          <span>Escalations ({escalations.length})</span>
        </button>
      </div>

      {/* --- TAB 1: ANALYTICS & ROUTING --- */}
      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Tenant Credentials & Whitelist Card */}
          <div className="bg-white rounded-2xl border border-slate-200/70 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Public Embed API Key</span>
              <div className="flex items-center gap-2 mt-1">
                <Key size={14} className="text-indigo-600" />
                <code className="text-xs font-mono font-bold text-slate-800 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                  {activeTenant.api_key || `pk_live_${activeTenant.slug}_demo`}
                </code>
              </div>
            </div>

            <div className="text-xs text-slate-500 sm:text-right">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Whitelisted Domains</span>
              <span className="font-medium text-slate-700">
                {activeTenant.domain_whitelist && activeTenant.domain_whitelist.length
                  ? activeTenant.domain_whitelist.join(', ')
                  : 'localhost, 127.0.0.1, *.edu'}
              </span>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-xs">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                <span>Fallback Rate</span>
                <ShieldAlert size={16} className="text-amber-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight text-slate-900">
                  {metrics ? `${(metrics.fallback_rate * 100).toFixed(1)}%` : '0.0%'}
                </span>
                <span className="text-xs text-slate-400">of queries</span>
              </div>
              <p className="text-[11.5px] text-slate-400 mt-2">
                Queries requiring fallback escalation or human-in-the-loop triage
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-xs">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                <span>Open Tickets</span>
                <AlertCircle size={16} className="text-rose-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight text-slate-900">
                  {escalations.length}
                </span>
                <span className="text-xs text-slate-400">tickets</span>
              </div>
              <p className="text-[11.5px] text-slate-400 mt-2">
                Awaiting {activeTenant.name} staff review or office resolution
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-xs">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                <span>Advisor Latency</span>
                <Clock size={16} className="text-indigo-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight text-slate-900">
                  {metrics?.avg_latency_per_agent && Object.keys(metrics.avg_latency_per_agent).length
                    ? `${Math.round(
                        Object.values(metrics.avg_latency_per_agent as Record<string, number>).reduce(
                          (a, b) => a + b,
                          0
                        ) / Object.keys(metrics.avg_latency_per_agent).length
                      )}ms`
                    : '180ms'}
                </span>
                <span className="text-xs text-emerald-600 font-medium">Optimal</span>
              </div>
              <p className="text-[11.5px] text-slate-400 mt-2">
                Average response time per specialized domain agent
              </p>
            </div>
          </div>

          {/* Route Distribution Chart */}
          <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <BarChart3 size={14} />
                </div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Routing Distribution for {activeTenant.name}
                </h3>
              </div>
              <span className="text-xs text-slate-400">Total Queries Dispatched: {metrics?.total_requests || 0}</span>
            </div>

            <div className="h-48 pt-2">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#e2e8f0',
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                        fontSize: '12px'
                      }}
                    />
                    <Bar dataKey="count" fill={activeTenant.theme_color || '#4f46e5'} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  No query distribution data recorded for {activeTenant.name} yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: KNOWLEDGE BASE & POLICIES --- */}
      {activeTab === 'documents' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/70 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Institutional Handbooks & Policies</h3>
              <p className="text-xs text-slate-500">
                Uploaded documents are vectorized into ChromaDB under partition <code className="font-mono text-indigo-600">[{selectedTenantId}]</code>
              </p>
            </div>
            <button
              onClick={() => setShowDocModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>Add Document</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase text-[10.5px]">
                <tr>
                  <th className="py-3 px-4">Document File</th>
                  <th className="py-3 px-4">Domain Collection</th>
                  <th className="py-3 px-4">Chroma Vectors</th>
                  <th className="py-3 px-4">Indexed Timestamp</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.map(d => (
                  <tr key={d.id || d.filename} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-800 flex items-center gap-2">
                      <FileText size={15} className="text-slate-400" />
                      <span>{d.filename}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-slate-100 text-slate-700 uppercase">
                        {d.domain}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-indigo-600">
                      {d.chunks_count} chunk{d.chunks_count !== 1 ? 's' : ''}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString() : 'Active'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleDeleteDocument(d.id, d.filename)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete policy and purge Chroma vectors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {documents.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                      No custom documents indexed yet. Click "+ Add Document" above to upload handbooks.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB 3: OPERATIONAL RULES (EVENTS & DEADLINES) --- */}
      {activeTab === 'rules' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Events Section */}
          <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Campus Events & Annual Festivals</h3>
                <p className="text-xs text-slate-400">Live operational data queried by the EventsAgent</p>
              </div>
              <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                {rules.events.length} Scheduled
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {rules.events.map((ev: any, idx: number) => (
                <div key={idx} className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs">{ev.name}</span>
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                      {ev.category}
                    </span>
                  </div>
                  <div className="text-[11.5px] text-slate-500 flex items-center gap-1.5">
                    <Calendar size={12} className="text-slate-400" />
                    <span>{ev.date}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    Venue: {ev.location}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Deadlines Section */}
          <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Academic Deadlines & Cutoffs</h3>
                <p className="text-xs text-slate-400">Structured cutoff data queried by the AcademicAgent</p>
              </div>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                {Object.keys(rules.deadlines).length} Cutoffs Active
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(rules.deadlines).map(([key, val]: any) => (
                <div key={key} className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-1">
                  <div className="font-bold text-slate-900 text-xs capitalize">{key.replace('_', ' ')}</div>
                  <div className="text-xs text-indigo-700 font-semibold font-mono">
                    Deadline: {val.date || 'TBD'}
                  </div>
                  {val.late_fee_amount && (
                    <div className="text-[11px] text-slate-400">
                      Late Fee Surcharge: ₹{val.late_fee_amount} (till {val.late_fee_date})
                    </div>
                  )}
                  {val.description && (
                    <div className="text-[11px] text-slate-500">
                      {val.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 4: ESCALATIONS SUPPORT QUEUE --- */}
      {activeTab === 'escalations' && (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xs overflow-hidden animate-in fade-in">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Escalation Support Queue ({activeTenant.name})
              </h3>
              <p className="text-[11px] text-slate-400">Inquiries requiring college staff clarification</p>
            </div>
            <span className="text-xs text-slate-400">
              {escalations.length} Active Case{escalations.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider text-[10.5px]">
                <tr>
                  <th className="py-3 px-4">Ticket ID</th>
                  <th className="py-3 px-4">Student Query</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Logged At</th>
                  <th className="py-3 px-4 text-right">Triage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {escalations.map(t => (
                  <tr key={t.ticket_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium text-indigo-600">
                      {t.ticket_id}
                    </td>
                    <td className="py-3.5 px-4 text-slate-800 max-w-sm" title={t.query}>
                      {t.query}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold ${
                        t.status === 'RESOLVED' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${t.status === 'RESOLVED' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                        {t.status || 'OPEN'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {t.created_at ? new Date(t.created_at).toLocaleString() : 'Recent'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {t.status !== 'RESOLVED' ? (
                        <button
                          onClick={() => handleResolveTicket(t.ticket_id)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-[11px] transition-colors cursor-pointer"
                        >
                          Resolve
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Closed</span>
                      )}
                    </td>
                  </tr>
                ))}
                {escalations.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                      No active escalations for this college. All multi-agent queries resolved successfully.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- ADD POLICY MODAL --- */}
      {showDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-7 relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <Upload size={15} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add Policy Document</h3>
                  <p className="text-[11px] text-slate-500">Indexes directly into ChromaDB vector storage</p>
                </div>
              </div>
              <button onClick={() => setShowDocModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleUploadDocument} className="space-y-3.5 mt-4">
              <div>
                <label className="block text-slate-700 text-xs font-semibold mb-1">Domain Advisor</label>
                <select
                  value={docDomain}
                  onChange={(e) => setDocDomain(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="academics">Academics (Rules, Grading, Attendance)</option>
                  <option value="placement">Placement (CDC, CGPA, Backlogs)</option>
                  <option value="events">Events (Fests, Activities, Calendar)</option>
                  <option value="services">Services (Hostels, Dining, Facilities)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 text-xs font-semibold mb-1">Document Filename</label>
                <input
                  type="text"
                  value={docFilename}
                  onChange={(e) => setDocFilename(e.target.value)}
                  placeholder="e.g. spring_2027_regulations.md"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 text-xs font-semibold mb-1">Policy Content (Markdown)</label>
                <textarea
                  rows={6}
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                  placeholder="# Attendance Rules&#10;Students must maintain 80% attendance..."
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDocModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all"
                >
                  {uploading ? 'Vectorizing...' : 'Index Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
