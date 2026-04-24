import { useEffect, useState } from 'react';
import { RequireAuth } from '~/lib/auth-client';
import { useWorkspace } from '~/lib/workspace';
import { fetchApi } from '~/lib/api';
import { useNavigate } from 'react-router';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';

interface DashboardData {
  volume: Array<{ bucket: string; count: number }>;
  levels: Array<{ level: string; count: number }>;
  services: Array<{ service: string; count: number }>;
  hosts: Array<{ host: string; count: number }>;
  total24h: number;
}

const LEVEL_COLORS: Record<string, string> = {
  DEBUG: '#6b7280',
  INFO: '#60a5fa',
  WARN: '#facc15',
  ERROR: '#f87171',
  FATAL: '#ef4444',
};

export default function DashboardPage() {
  const { activeWorkspace } = useWorkspace();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (activeWorkspace) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [activeWorkspace]);

  async function loadData() {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const result = await fetchApi(`/workspaces/${activeWorkspace.id}/analytics/overview`);
      setData(result);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }

  if (!activeWorkspace) {
    return (
      <RequireAuth>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <p className="text-sm text-[#8A8F98]">No workspace selected.</p>
          <button
            onClick={() => navigate('/onboarding')}
            className="rounded-md bg-[#5E6AD2] px-4 py-2 text-sm font-medium text-white hover:bg-[#4f5ab8] transition-colors"
          >
            Create a workspace
          </button>
        </div>
      </RequireAuth>
    );
  }

  if (loading) {
    return (
      <RequireAuth>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#2A2A2A] border-t-[#5E6AD2]" />
        </div>
      </RequireAuth>
    );
  }

  if (!data || data.total24h === 0) {
    return (
      <RequireAuth>
        <div className="p-6">
          <h1 className="text-xl font-semibold mb-4">Dashboard</h1>
          <div className="rounded-lg border border-[#2A2A2A] bg-[#151515] p-8 text-center">
            <p className="text-sm text-[#8A8F98]">No log data in the last 24 hours.</p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                onClick={() => navigate('/settings/sources')}
                className="rounded-md bg-[#5E6AD2] px-3 py-2 text-sm font-medium text-white"
              >
                Add Source
              </button>
              <button
                onClick={() => navigate('/settings/integrations')}
                className="rounded-md border border-[#2A2A2A] px-3 py-2 text-sm font-medium text-gray-200"
              >
                Add Integration
              </button>
            </div>
          </div>
        </div>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-[#8A8F98]">
            {data.total24h.toLocaleString()} logs in the last 24 hours
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Volume Chart */}
          <div className="rounded-lg border border-[#2A2A2A] bg-[#151515] p-4">
            <h2 className="text-sm font-medium mb-4">Volume (24h)</h2>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.volume}>
                  <defs>
                    <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5E6AD2" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#5E6AD2" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="bucket"
                    tickFormatter={(v) => new Date(v).toLocaleTimeString([], { hour: '2-digit' })}
                    stroke="#2A2A2A"
                    tick={{ fill: '#8A8F98', fontSize: 11 }}
                  />
                  <YAxis
                    stroke="#2A2A2A"
                    tick={{ fill: '#8A8F98', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#151515',
                      border: '1px solid #2A2A2A',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                    labelFormatter={(v) => new Date(v).toLocaleString()}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#5E6AD2"
                    fill="url(#volumeGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Level Breakdown */}
          <div className="rounded-lg border border-[#2A2A2A] bg-[#151515] p-4">
            <h2 className="text-sm font-medium mb-4">Level Breakdown</h2>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.levels}>
                  <XAxis
                    dataKey="level"
                    stroke="#2A2A2A"
                    tick={{ fill: '#8A8F98', fontSize: 11 }}
                  />
                  <YAxis
                    stroke="#2A2A2A"
                    tick={{ fill: '#8A8F98', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#151515',
                      border: '1px solid #2A2A2A',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {data.levels.map((entry) => (
                      <Cell key={entry.level} fill={LEVEL_COLORS[entry.level] || '#8A8F98'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Services */}
          <div className="rounded-lg border border-[#2A2A2A] bg-[#151515] p-4">
            <h2 className="text-sm font-medium mb-4">Top Services</h2>
            <div className="space-y-2">
              {data.services.map((s) => (
                <div key={s.service} className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">{s.service}</span>
                  <span className="text-[#8A8F98]">{s.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Hosts */}
          <div className="rounded-lg border border-[#2A2A2A] bg-[#151515] p-4">
            <h2 className="text-sm font-medium mb-4">Top Hosts</h2>
            <div className="space-y-2">
              {data.hosts.length === 0 ? (
                <p className="text-sm text-[#8A8F98]">No host data available</p>
              ) : (
                data.hosts.map((h) => (
                  <div key={h.host} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">{h.host}</span>
                    <span className="text-[#8A8F98]">{h.count.toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </RequireAuth>
  );
}
