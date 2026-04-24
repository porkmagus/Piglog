import { useEffect, useState } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchApi } from '~/lib/api';
import type { DashboardWidgetData } from '../types';

const LEVEL_COLORS: Record<string, string> = {
  DEBUG: '#6b7280', INFO: '#60a5fa', WARN: '#facc15', ERROR: '#f87171', FATAL: '#ef4444',
};

export default function LevelsWidget({ widget, workspaceId }: { widget: DashboardWidgetData; workspaceId: string }) {
  const [data, setData] = useState<Array<{ level: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const result = await fetchApi(`/workspaces/${workspaceId}/analytics/overview`);
        setData(result?.levels || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [workspaceId, widget.config.timeRange]);

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium mb-1">Level Breakdown</h3>
      <p className="text-xs text-[#8A8F98] mb-4">Logs by severity level</p>

      {loading && <div className="h-40 flex items-center justify-center"><div className="animate-spin rounded-full h-5 w-5 border-2 border-[#2A2A2A] border-t-[#F09040]" /></div>}
      {error && <div className="h-40 flex flex-col items-center justify-center gap-2"><p className="text-xs text-red-400">{error}</p><button onClick={() => window.location.reload()} className="text-xs text-[#F09040] hover:text-[#D87830]">Retry</button></div>}
      {!loading && !error && data.length === 0 && <div className="h-40 flex items-center justify-center"><p className="text-xs text-[#8A8F98]">No log data — add logs to see level breakdown</p></div>}
      {!loading && !error && data.length > 0 && (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis dataKey="level" stroke="#2A2A2A" tick={{ fill: '#8A8F98', fontSize: 11 }} />
              <YAxis stroke="#2A2A2A" tick={{ fill: '#8A8F98', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#151515', border: '1px solid #2A2A2A', borderRadius: '6px', fontSize: '12px' }} formatter={(value: number) => [`${value.toLocaleString()} logs`, 'Count']} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.map((entry) => (<Cell key={entry.level} fill={LEVEL_COLORS[entry.level] || '#8A8F98'} />))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
