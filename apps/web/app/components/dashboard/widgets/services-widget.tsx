import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { fetchApi } from '~/lib/api';
import type { DashboardWidgetData } from '../types';

export default function ServicesWidget({ widget, workspaceId }: { widget: DashboardWidgetData; workspaceId: string }) {
  const [data, setData] = useState<Array<{ service: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const result = await fetchApi(`/workspaces/${workspaceId}/analytics/overview`);
        setData(result?.services || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [workspaceId, widget.config.limit]);

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium mb-1">Top Services</h3>
      <p className="text-xs text-[#8A8F98] mb-4">Services with most log volume</p>

      {loading && <div className="h-40 flex items-center justify-center"><div className="animate-spin rounded-full h-5 w-5 border-2 border-[#2A2A2A] border-t-[#F09040]" /></div>}
      {error && <div className="h-40 flex flex-col items-center justify-center gap-2"><p className="text-xs text-red-400">{error}</p><button onClick={() => window.location.reload()} className="text-xs text-[#F09040] hover:text-[#D87830]">Retry</button></div>}
      {!loading && !error && data.length === 0 && <div className="h-40 flex items-center justify-center"><p className="text-xs text-[#8A8F98]">No log data — add logs to see top services</p></div>}
      {!loading && !error && data.length > 0 && (
        <div className="space-y-2">
          {data.map((s) => (
            <button
              key={s.service}
              onClick={() => navigate(`/streams?search=service:${encodeURIComponent(s.service)}`)}
              className="flex items-center justify-between text-sm w-full text-left hover:text-[#F09040] transition-colors"
            >
              <span className="text-gray-300 truncate">{s.service}</span>
              <span className="text-[#8A8F98] ml-2">{s.count.toLocaleString()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
