import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchApi } from '~/lib/api';
import type { DashboardWidgetData } from '../types';

interface Props {
  widget: DashboardWidgetData;
  workspaceId: string;
}

export default function VolumeWidget({ widget, workspaceId }: Props) {
  const [data, setData] = useState<Array<{ bucket: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const result = await fetchApi(`/workspaces/${workspaceId}/analytics/overview`);
        setData(result?.volume || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [workspaceId, widget.config.timeRange]);

  const timeRange = (widget.config.timeRange as string) || '24h';

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium mb-1">Log Volume</h3>
      <p className="text-xs text-[#8A8F98] mb-4">Logs ingested per hour — last {timeRange}</p>

      {loading && <div className="h-40 flex items-center justify-center"><div className="animate-spin rounded-full h-5 w-5 border-2 border-[#2A2A2A] border-t-[#F09040]" /></div>}
      {error && <div className="h-40 flex flex-col items-center justify-center gap-2"><p className="text-xs text-red-400">{error}</p><button onClick={() => window.location.reload()} className="text-xs text-[#F09040] hover:text-[#D87830]">Retry</button></div>}
      {!loading && !error && data.length === 0 && <div className="h-40 flex items-center justify-center"><p className="text-xs text-[#8A8F98]">No log data — add logs to see volume</p></div>}
      {!loading && !error && data.length > 0 && (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id={`volGrad-${widget.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F09040" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F09040" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="bucket" tickFormatter={(v: string) => new Date(v).toLocaleTimeString([], { hour: '2-digit' })} stroke="#2A2A2A" tick={{ fill: '#8A8F98', fontSize: 11 }} />
              <YAxis stroke="#2A2A2A" tick={{ fill: '#8A8F98', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#151515', border: '1px solid #2A2A2A', borderRadius: '6px', fontSize: '12px' }} labelFormatter={(v: string) => new Date(v).toLocaleString()} formatter={(value: number) => [`${value.toLocaleString()} logs`, 'Count']} />
              <Area type="monotone" dataKey="count" stroke="#F09040" fill={`url(#volGrad-${widget.id})`} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
