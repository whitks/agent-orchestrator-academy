import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import ChatPage from './pages/ChatPage';
import AdminPage from './pages/AdminPage';

function App() {
  return (
    <BrowserRouter>
      <div className="h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col font-sans">
        <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-6 py-4 flex justify-between items-center shrink-0">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
            College Operations Assistant
          </h1>
          <nav className="space-x-4">
            <Link to="/" className="text-sm font-medium hover:text-blue-500 transition-colors">Chat</Link>
            <Link to="/admin" className="text-sm font-medium hover:text-blue-500 transition-colors">Admin</Link>
          </nav>
        </header>
        <main className="flex-1 flex overflow-hidden">
          <Routes>
            <Route path="/" element={<ChatPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
export default App;
