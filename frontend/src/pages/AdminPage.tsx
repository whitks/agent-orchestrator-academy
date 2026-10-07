import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function AdminPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [escalations, setEscalations] = useState<any[]>([]);

  useEffect(() => {
    api.getMetrics().then(setMetrics).catch(() => {});
    api.getEscalations().then(res => setEscalations(res.tickets)).catch(() => {});
  }, []);

  const chartData = metrics?.route_distribution 
    ? Object.entries(metrics.route_distribution).map(([name, count]) => ({ name, count })) 
    : [];

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-gray-50 dark:bg-gray-900 h-full">
      <h2 className="text-2xl font-bold mb-6">Admin Dashboard</h2>
      
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-950 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <h3 className="text-gray-500 text-sm font-semibold mb-2">Fallback Rate</h3>
            <p className="text-4xl font-bold text-red-500">{(metrics.fallback_rate * 100).toFixed(1)}%</p>
          </div>
          <div className="bg-white dark:bg-gray-950 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm md:col-span-2">
            <h3 className="text-gray-500 text-sm font-semibold mb-4">Route Distribution</h3>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" stroke="#888" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      <h3 className="text-lg font-bold mb-4">Escalation Tickets</h3>
      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500">
            <tr>
              <th className="p-3 font-semibold">Ticket ID</th>
              <th className="p-3 font-semibold">Session</th>
              <th className="p-3 font-semibold">Query</th>
              <th className="p-3 font-semibold">Status</th>
              <th className="p-3 font-semibold">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {escalations.map(t => (
              <tr key={t.ticket_id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                <td className="p-3 font-mono text-blue-500">{t.ticket_id}</td>
                <td className="p-3 text-gray-500">{t.session_id.substring(0,8)}...</td>
                <td className="p-3 max-w-xs truncate" title={t.query}>{t.query}</td>
                <td className="p-3"><span className="px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full text-xs font-semibold">{t.status}</span></td>
                <td className="p-3 text-gray-500">{new Date(t.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {escalations.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500">No escalations found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
