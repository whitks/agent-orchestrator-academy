import { useState, useEffect, useRef } from 'react';
import { Send, AlertTriangle, Loader2, Bot, User } from 'lucide-react';
import type { TraceEvent } from '../api/client';

const API_URL = 'http://localhost:8000';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agents: string[];
  sources: string[];
  traces: TraceEvent[];
  escalated?: boolean;
  ticket_id?: string;
  isStreaming?: boolean;
};

const STARTERS = [
  "What is the attendance rule?",
  "What is the CGPA cutoff for Tier 1 companies?",
  "When is the next cultural fest?",
  "Am I eligible for placements and when is the next tech fest?"
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [session] = useState(`sess-${Math.random().toString(36).substr(2, 6)}`);
  const [liveTraces, setLiveTraces] = useState<any[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, liveTraces]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, agents: [], sources: [], traces: [] };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLiveTraces([]);
    
    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: assistantId, role: 'assistant', content: '', agents: [], sources: [], traces: [], isStreaming: true
    }]);

    const es = new EventSource(`${API_URL}/chat/stream?session_id=${session}&message=${encodeURIComponent(text)}`);
    
    let finalAnswer = "";
    
    es.onmessage = (e) => {
      const parsed = JSON.parse(e.data);
      if (parsed.event === 'progress') {
        setLiveTraces(prev => [...prev, parsed]);
      } else if (parsed.event === 'final_answer_tokens') {
        finalAnswer += parsed.data;
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: finalAnswer } : m));
      } else if (parsed.event === 'done') {
        es.close();
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, isStreaming: false } : m));
      }
    };
    es.onerror = () => {
      es.close();
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: finalAnswer || "An error occurred.", isStreaming: false, escalated: true } : m));
    };
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-950 relative border-r border-gray-200 dark:border-gray-800">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
              <Bot className="w-16 h-16 text-blue-500 opacity-80" />
              <h2 className="text-2xl font-semibold">How can I help you today?</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl w-full">
                {STARTERS.map(s => (
                  <button key={s} onClick={() => sendMessage(s)} className="p-4 border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map(m => (
              <div key={m.id} className={`flex gap-4 max-w-4xl mx-auto ${m.role === 'user' ? 'justify-end' : ''}`}>
                {m.role === 'assistant' && <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0"><Bot size={18} className="text-blue-600 dark:text-blue-400" /></div>}
                
                <div className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} max-w-[80%]`}>
                  <div className={`p-4 rounded-2xl ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-100 dark:bg-gray-900 rounded-bl-none'}`}>
                    <p className="whitespace-pre-wrap leading-relaxed text-sm">{m.content}</p>
                    {m.isStreaming && <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1" />}
                  </div>
                  
                  {m.escalated && (
                    <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg flex gap-3 text-red-800 dark:text-red-300 w-full">
                      <AlertTriangle size={18} className="shrink-0" />
                      <div className="text-sm font-medium">
                        This issue was escalated to support.
                      </div>
                    </div>
                  )}
                </div>
                
                {m.role === 'user' && <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center shrink-0"><User size={18} /></div>}
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>
        
        <div className="p-4 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800">
          <div className="max-w-4xl mx-auto flex gap-2 relative">
            <input 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
              placeholder="Ask a question..."
              className="flex-1 bg-gray-100 dark:bg-gray-900 border-none rounded-full px-6 py-4 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button onClick={() => sendMessage(input)} className="absolute right-2 top-2 bottom-2 bg-blue-600 text-white rounded-full p-3 hover:bg-blue-700 transition">
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="w-80 bg-gray-50 dark:bg-gray-900/50 flex flex-col h-full border-l border-gray-200 dark:border-gray-800 hidden md:flex">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 font-semibold text-xs uppercase tracking-wider text-gray-500">
          Live Agent Trace
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {liveTraces.map((t, i) => (
            <div key={i} className="text-sm p-3 rounded-lg bg-white dark:bg-gray-950 shadow-sm border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2 mb-1">
                {t.step === 'synthesis' ? <span className="w-2 h-2 rounded-full bg-green-500" /> : <Loader2 size={12} className="animate-spin text-blue-500" />}
                <span className="font-semibold capitalize text-gray-700 dark:text-gray-300 text-xs">{t.step}</span>
              </div>
              <p className="text-gray-600 dark:text-gray-400 font-mono text-xs mt-2 break-all">{t.message}</p>
            </div>
          ))}
          {liveTraces.length === 0 && <p className="text-xs text-gray-400 text-center mt-10">No active traces</p>}
        </div>
      </div>
    </div>
  );
}
