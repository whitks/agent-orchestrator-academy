import { useEffect, useState } from 'react';
import { api, type Tenant } from '../api/client';
import { Building, Plus, RefreshCw } from 'lucide-react';

export default function SuperAdminPage() {
  const [stats, setStats] = useState<any>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Provisioning Modal State
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [themeColor, setThemeColor] = useState('#2563eb');
  const [creating, setCreating] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.getSuperadminStats().then(setStats).catch(() => {}),
      api.getTenants().then(res => setTenants(res.tenants || [])).catch(() => {})
    ]).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug) return;
    setCreating(true);
    try {
      await api.provisionTenant({
        name,
        slug,
        theme_color: themeColor,
        domain_whitelist: ["localhost", "127.0.0.1", `*.${slug}.edu`]
      });
      setSuccessMsg(`Successfully provisioned ${name}! Initialized handbook and API key.`);
      setName('');
      setSlug('');
      setShowModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to provision college");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-8 max-w-6xl mx-auto w-full space-y-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/80 text-[10.5px] font-bold uppercase tracking-wider">
              SaaS Control Center
            </span>
            <span className="text-xs text-slate-400">• Multi-Institution Fleet</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">Platform SuperAdmin Console</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Global institution provisioning, cross-college query metrics, and API keys fleet management
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Plus size={14} />
            <span>Provision New College</span>
          </button>

          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin text-indigo-600' : 'text-slate-500'} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800 font-bold">✕</button>
        </div>
      )}

      {/* Global KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-xs">
          <span className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Registered Colleges</span>
          <div className="text-3xl font-extrabold text-slate-900">{stats?.total_tenants ?? tenants.length}</div>
          <p className="text-[11px] text-slate-400 mt-1.5">Active institutional tenants</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-xs">
          <span className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Global Query Volume</span>
          <div className="text-3xl font-extrabold text-slate-900">{stats?.total_requests ?? 0}</div>
          <p className="text-[11px] text-slate-400 mt-1.5">Total student inquiries served</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-xs">
          <span className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Global Escalations</span>
          <div className="text-3xl font-extrabold text-rose-600">{stats?.total_escalations ?? 0}</div>
          <p className="text-[11px] text-slate-400 mt-1.5">Staff human-in-the-loop tickets</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-xs">
          <span className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Agent Traces Logged</span>
          <div className="text-3xl font-extrabold text-indigo-600">{stats?.total_traces ?? 0}</div>
          <p className="text-[11px] text-slate-400 mt-1.5">DAG execution telemetry steps</p>
        </div>
      </div>

      {/* College Directory Table */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Building size={15} />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Provisioned College Tenants</h3>
              <p className="text-[11px] text-slate-400">All institutions with active RAG partitions and API keys</p>
            </div>
          </div>
          <span className="text-xs font-medium text-slate-500">{tenants.length} Colleges Active</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider text-[10.5px]">
              <tr>
                <th className="py-3 px-4">Institution Name</th>
                <th className="py-3 px-4">Tenant Identifier</th>
                <th className="py-3 px-4">Brand Accent</th>
                <th className="py-3 px-4">Whitelisted Origins</th>
                <th className="py-3 px-4">Publishable API Key</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tenants.map(t => (
                <tr key={t.tenant_id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-slate-900 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.theme_color || '#4f46e5' }}></span>
                    <span>{t.name}</span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                    {t.tenant_id}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                    {t.theme_color}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">
                    {t.domain_whitelist?.join(', ') || 'localhost, *.edu'}
                  </td>
                  <td className="py-3.5 px-4">
                    <code className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-mono text-slate-800">
                      {t.api_key || `pk_live_${t.slug}_demo`}
                    </code>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      ACTIVE
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provisioning Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 sm:p-7 relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <Building size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Provision College</h3>
                  <p className="text-[11px] text-slate-500">Register new university on the platform</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleCreateTenant} className="space-y-3.5 mt-4">
              <div>
                <label className="block text-slate-700 text-xs font-semibold mb-1">University / College Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Massachusetts Institute of Technology"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 text-xs font-semibold mb-1">Slug / Identifier</label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                  placeholder="e.g. mit"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Tenant ID will be generated as {slug ? `${slug}_campus` : '[slug]_campus'}</span>
              </div>

              <div>
                <label className="block text-slate-700 text-xs font-semibold mb-1">Brand Theme Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="flex-1 text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all"
                >
                  {creating ? 'Provisioning...' : 'Provision College'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
