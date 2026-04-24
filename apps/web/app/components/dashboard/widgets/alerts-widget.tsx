import { useEffect, useState } from 'react';
import { fetchApi } from '~/lib/api';
import type { DashboardWidgetData } from '../types';

interface AlertData {
  id: string;
  ruleName: string;
  status: string;
  actualCount: number;
  threshold: number;
  triggeredAt: string;
  resolvedAt: string | null;
}

export default function AlertsWidget({ widget, workspaceId }: { widget: DashboardWidgetData; workspaceId: string }) {
  const [data, setData] = useState<AlertData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const result = await fetchApi(`/workspaces/${workspaceId}/analytics/alerts?limit=${widget.config.limit || 10}`);
        setData(result || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [workspaceId, widget.config.limit]);

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium mb-1">Recent Alerts</h3>
      <p className="text-xs text-[#8A8F98] mb-4">Recently fired alert rules</p>

      {loading && <div className="h-40 flex items-center justify-center"><div className="animate-spin rounded-full h-5 w-5 border-2 border-[#2A2A2A] border-t-[#F09040]" /></div>}
      {error && <div className="h-40 flex flex-col items-center justify-center gap-2"><p className="text-xs text-red-400">{error}</p><button onClick={() => window.location.reload()} className="text-xs text-[#F09040] hover:text-[#D87830]">Retry</button></div>}
      {!loading && !error && data.length === 0 && <div className="h-40 flex items-center justify-center"><p className="text-xs text-[#8A8F98]">No alerts fired yet — create alert rules to get started</p></div>}
      {!loading && !error && data.length > 0 && (
        <div className="space-y-2">
          {data.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${a.status === 'FIRED' ? 'bg-red-400' : 'bg-green-400'}`} />
                <span className="text-gray-300 truncate">{a.ruleName}</span>
              </div>
              <div className="text-right">
                <span className="text-[#8A8F98] text-xs">{a.actualCount}/{a.threshold}</span>
                <span className="text-[#8A8F98] text-xs ml-2">{new Date(a.triggeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
