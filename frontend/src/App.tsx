import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import ChatPage from './pages/ChatPage';
import AdminPage from './pages/AdminPage';

function TopNavigation() {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-40 bg-[#FBFBFD]/85 backdrop-blur-md border-b border-slate-200/60">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shadow-indigo-200/70 shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
              <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-[14.5px] tracking-tight text-slate-900">Agent College</span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
              Student Assistant
            </span>
          </div>
        </div>

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
          <Link
            to="/admin"
            className={`px-3 py-1 font-semibold rounded-lg transition-all ${
              location.pathname === '/admin'
                ? 'text-slate-900 bg-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Admin Dashboard
          </Link>
        </nav>

        {/* Right Status / User Pill */}
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Support Online</span>
          </div>
          <div className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full bg-white border border-slate-200/80 shadow-sm">
            <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-semibold text-[10px] flex items-center justify-center">
              KS
            </div>
            <span className="text-xs font-medium text-slate-700">
              krish sharma <span className="text-slate-400 font-normal hidden sm:inline">• Student</span>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#FBFBFD] text-slate-800 flex flex-col font-sans selection:bg-indigo-50 selection:text-indigo-700">
        <TopNavigation />
        <div className="flex-1 flex flex-col">
          <Routes>
            <Route path="/" element={<ChatPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
