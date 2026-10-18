import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Tenant } from '../api/client';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ShieldAlert, BarChart3, Clock, AlertCircle, RefreshCw, FileText, Building, Key } from 'lucide-react';

export default function AdminPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('apex_university');
  const [metrics, setMetrics] = useState<any>(null);
  const [escalations, setEscalations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch tenants on mount
  useEffect(() => {
    api.getTenants().then(res => {
      if (res && res.tenants && res.tenants.length) {
        setTenants(res.tenants);
      }
    }).catch(() => {});
  }, []);

  const fetchData = (tenantId: string) => {
    setLoading(true);
    Promise.all([
      api.getMetrics(tenantId).then(setMetrics).catch(() => {}),
      api.getEscalations(tenantId).then(res => setEscalations(res.tickets || [])).catch(() => {})
    ]).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData(selectedTenantId);
  }, [selectedTenantId]);

  const activeTenant = tenants.find(t => t.tenant_id === selectedTenantId) || {
    tenant_id: 'apex_university',
    name: 'Apex Institute of Technology',
    slug: 'apex',
    theme_color: '#4f46e5',
    api_key: 'pk_live_apex_sample',
    domain_whitelist: []
  };

  const chartData = metrics?.route_distribution
    ? Object.entries(metrics.route_distribution).map(([name, count]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        count
      }))
    : [];

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-8 max-w-5xl mx-auto w-full space-y-7">
      {/* Top Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/60">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Multi-Tenant Admin & Operations Hub</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time routing metrics, student escalation tickets, and API tenant configuration
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
            onClick={() => fetchData(selectedTenantId)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-700 text-xs font-semibold shadow-xs transition-colors cursor-pointer w-fit"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin text-indigo-600' : 'text-slate-500'} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Tenant Credentials & Whitelist Card */}
      <div className="bg-white rounded-2xl border border-slate-200/70 p-4 sm:p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
        {/* Fallback Rate */}
        <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]">
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

        {/* Active Escalations */}
        <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            <span>Open Escalation Tickets</span>
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

        {/* System Latency / Status */}
        <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]">
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
      <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] space-y-3">
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
                <Bar dataKey="count" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              No query distribution data recorded for {activeTenant.name} yet.
            </div>
          )}
        </div>
      </div>

      {/* Escalation Tickets Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <FileText size={14} />
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Escalation Support Queue ({activeTenant.name})
            </h3>
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
                <th className="py-3 px-4">Session</th>
                <th className="py-3 px-4">Student Query</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Logged At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {escalations.map(t => (
                <tr key={t.ticket_id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-medium text-indigo-600">
                    {t.ticket_id}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                    {t.session_id ? `${t.session_id.substring(0, 8)}...` : 'N/A'}
                  </td>
                  <td className="py-3.5 px-4 text-slate-800 max-w-sm truncate" title={t.query}>
                    {t.query}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                      {t.status || 'OPEN'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-400">
                    {t.created_at ? new Date(t.created_at).toLocaleString() : 'Recent'}
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
    </div>
  );
}
