import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import ChatPage from './pages/ChatPage';
import AdminPage from './pages/AdminPage';
import SuperAdminPage from './pages/SuperAdminPage';
import AuthModal from './components/AuthModal';
import { Shield, Building, LogIn, LogOut } from 'lucide-react';
import type { UserProfile } from './api/client';

const DEFAULT_STUDENT: UserProfile = {
  id: 'usr_student_public',
  email: 'student@campus.edu',
  name: 'krish sharma',
  role: 'student',
  tenant_id: 'apex_university'
};

function TopNavigation({
  currentUser,
  onOpenAuth,
  onLogout
}: {
  currentUser: UserProfile;
  onOpenAuth: () => void;
  onLogout: () => void;
}) {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-40 bg-[#FBFBFD]/85 backdrop-blur-md border-b border-slate-200/60">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shadow-indigo-200/70 shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
              <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-[14.5px] tracking-tight text-slate-900">Agent College</span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
              {currentUser.role === 'superadmin' ? 'SuperAdmin Console' : currentUser.role === 'college_admin' ? 'College Portal' : 'Student Assistant'}
            </span>
          </div>
        </Link>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/60 text-xs">
          <Link
            to="/"
            className={`px-3 py-1 font-semibold rounded-lg transition-all ${
              location.pathname === '/'
                ? 'text-slate-900 bg-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Chat
          </Link>

          {(currentUser.role === 'college_admin' || currentUser.role === 'superadmin') && (
            <Link
              to="/admin"
              className={`px-3 py-1 font-semibold rounded-lg transition-all ${
                location.pathname === '/admin'
                  ? 'text-slate-900 bg-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              College Admin
            </Link>
          )}

          {currentUser.role === 'superadmin' && (
            <Link
              to="/superadmin"
              className={`px-3 py-1 font-semibold rounded-lg transition-all ${
                location.pathname === '/superadmin'
                  ? 'text-slate-900 bg-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Platform SuperAdmin
            </Link>
          )}
        </nav>

        {/* User Pill & Auth Action */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full bg-white border border-slate-200/80 shadow-xs">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
              currentUser.role === 'superadmin' 
                ? 'bg-purple-100 text-purple-700' 
                : currentUser.role === 'college_admin'
                ? 'bg-rose-100 text-rose-700'
                : 'bg-indigo-100 text-indigo-700'
            }`}>
              {currentUser.role === 'superadmin' ? <Shield size={10} /> : currentUser.role === 'college_admin' ? <Building size={10} /> : 'KS'}
            </div>
            <span className="text-xs font-medium text-slate-700 truncate max-w-[120px] sm:max-w-none">
              {currentUser.name} <span className="text-slate-400 font-normal hidden sm:inline">• {currentUser.role === 'superadmin' ? 'SuperAdmin' : currentUser.role === 'college_admin' ? 'Admin' : 'Student'}</span>
            </span>
          </div>

          {currentUser.role === 'student' ? (
            <button
              onClick={onOpenAuth}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <LogIn size={12} />
              <span>Sign In</span>
            </button>
          ) : (
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 text-xs font-medium border border-slate-200 transition-colors cursor-pointer"
              title="Sign out to Public Student view"
            >
              <LogOut size={12} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('agent_college_user');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return DEFAULT_STUDENT;
  });

  const [authModalOpen, setAuthModalOpen] = useState(false);

  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    localStorage.setItem('agent_college_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(DEFAULT_STUDENT);
    localStorage.removeItem('agent_college_user');
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#FBFBFD] text-slate-800 flex flex-col font-sans selection:bg-indigo-50 selection:text-indigo-700">
        <TopNavigation 
          currentUser={currentUser}
          onOpenAuth={() => setAuthModalOpen(true)}
          onLogout={handleLogout}
        />
        <div className="flex-1 flex flex-col">
          <Routes>
            <Route path="/" element={<ChatPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/superadmin" element={<SuperAdminPage />} />
          </Routes>
        </div>

        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onLoginSuccess={handleLoginSuccess}
        />
      </div>
    </BrowserRouter>
  );
}

export default App;
