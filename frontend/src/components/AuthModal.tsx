import { useState } from 'react';
import { Shield, Building, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { api, type UserProfile } from '../api/client';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserProfile) => void;
}

export default function AuthModal({ isOpen, onClose, onLoginSuccess }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<'college' | 'superadmin'>('college');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedTenant, setSelectedTenant] = useState('stanford_global');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStandardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.login({ email, password });
      onLoginSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async (role: 'college_admin' | 'superadmin', tenantId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.login({ role, tenant_id: tenantId });
      onLoginSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl max-w-md w-full overflow-hidden p-6 sm:p-7 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shadow-indigo-200">
              <Lock size={16} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Institutional Portal</h3>
              <p className="text-[11.5px] text-slate-500">Sign in to manage your campus assistant</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex bg-slate-100/80 p-1 rounded-xl mt-5 mb-5 text-xs font-semibold">
          <button
            onClick={() => { setActiveTab('college'); setError(null); }}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'college'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building size={14} className={activeTab === 'college' ? 'text-indigo-600' : ''} />
            <span>College Admin</span>
          </button>
          <button
            onClick={() => { setActiveTab('superadmin'); setError(null); }}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'superadmin'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield size={14} className={activeTab === 'superadmin' ? 'text-indigo-600' : ''} />
            <span>Platform SuperAdmin</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}

        {/* 1-Click Demo Buttons */}
        <div className="space-y-2 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              1-Click Demo Sign-in
            </span>
            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
              <CheckCircle2 size={10} /> Instant Test Access
            </span>
          </div>

          {activeTab === 'college' ? (
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickDemoLogin('college_admin', 'stanford_global')}
                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-rose-200/80 bg-rose-50/50 hover:bg-rose-50 text-slate-800 text-xs font-semibold transition-all group cursor-pointer text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
                  <div>
                    <div className="font-bold text-slate-900">Stanford Global Campus</div>
                    <div className="text-[10.5px] text-slate-500 font-normal">admin@stanford.edu</div>
                  </div>
                </div>
                <ArrowRight size={14} className="text-rose-500 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickDemoLogin('college_admin', 'apex_university')}
                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-indigo-200/80 bg-indigo-50/50 hover:bg-indigo-50 text-slate-800 text-xs font-semibold transition-all group cursor-pointer text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                  <div>
                    <div className="font-bold text-slate-900">Apex Institute of Technology</div>
                    <div className="text-[10.5px] text-slate-500 font-normal">admin@apex.edu</div>
                  </div>
                </div>
                <ArrowRight size={14} className="text-indigo-500 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickDemoLogin('college_admin', 'cambridge_tech')}
                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-teal-200/80 bg-teal-50/50 hover:bg-teal-50 text-slate-800 text-xs font-semibold transition-all group cursor-pointer text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-600"></span>
                  <div>
                    <div className="font-bold text-slate-900">Cambridge Institute of Science</div>
                    <div className="text-[10.5px] text-slate-500 font-normal">admin@cambridge.ac.uk</div>
                  </div>
                </div>
                <ArrowRight size={14} className="text-teal-500 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={() => handleQuickDemoLogin('superadmin')}
              className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl border border-purple-200/80 bg-purple-50/60 hover:bg-purple-50 text-slate-800 text-xs font-semibold transition-all group cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                <div>
                  <div className="font-bold text-slate-900">Platform SuperAdmin (Global SaaS)</div>
                  <div className="text-[10.5px] text-slate-500 font-normal">superadmin@agentcollege.ai</div>
                </div>
              </div>
              <ArrowRight size={14} className="text-purple-600 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-slate-200"></div>
          <span className="flex-shrink mx-3 text-slate-400 text-[10.5px] uppercase font-bold tracking-wider">or password</span>
          <div className="flex-grow border-t border-slate-200"></div>
        </div>

        {/* Form Login */}
        <form onSubmit={handleStandardSubmit} className="space-y-3 mt-2">
          {activeTab === 'college' && (
            <div>
              <label className="block text-slate-700 text-xs font-semibold mb-1">Select College</label>
              <select
                value={selectedTenant}
                onChange={(e) => setSelectedTenant(e.target.value)}
                className="w-full text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="stanford_global">Stanford Global Campus</option>
                <option value="apex_university">Apex Institute of Technology</option>
                <option value="cambridge_tech">Cambridge Institute of Science</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-slate-700 text-xs font-semibold mb-1">Institutional Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={activeTab === 'college' ? 'admin@stanford.edu' : 'superadmin@agentcollege.ai'}
              className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 text-xs font-semibold mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* Public Student Switch */}
        <div className="mt-4 pt-3 border-t border-slate-100 text-center">
          <button
            type="button"
            onClick={() => {
              onLoginSuccess({
                id: 'usr_student_public',
                email: 'student@campus.edu',
                name: 'krish sharma',
                role: 'student',
                tenant_id: 'apex_university'
              });
              onClose();
            }}
            className="text-[11px] text-slate-500 hover:text-indigo-600 font-medium transition-colors"
          >
            Continue as Public Student (krish sharma)
          </button>
        </div>
      </div>
    </div>
  );
}
