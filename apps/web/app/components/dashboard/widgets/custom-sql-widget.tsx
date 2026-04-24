import { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, LineChart, Line, defs, linearGradient, stop } from 'recharts';
import { fetchApi } from '~/lib/api';
import type { DashboardWidgetData } from '../types';

interface QueryResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
}

export default function CustomSqlWidget({ widget, workspaceId }: { widget: DashboardWidgetData; workspaceId: string }) {
  const [data, setData] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sql = (widget.config.sql as string) || '';
  const chartType = (widget.config.chartType as string) || 'table';
  const xAxis = (widget.config.xAxis as string) || '';
  const yAxis = (widget.config.yAxis as string) || '';
  const timeRange = (widget.config.timeRange as string) || '24h';

  const loadData = useCallback(async () => {
    if (!sql.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchApi(`/workspaces/${workspaceId}/analytics/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql, timeRange }),
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query failed');
    } finally {
      setLoading(false);
    }
  }, [sql, timeRange, workspaceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const chartData = data?.rows.map((row) => {
    const obj: Record<string, unknown> = {};
    data.columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  }) || [];

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium mb-1">Custom Query</h3>
      <p className="text-xs text-[#8A8F98] mb-2">
        <code className="text-[#F09040]">{sql || 'No query set'}</code>
      </p>
      <p className="text-xs text-[#8A8F98] mb-4">Time range: {timeRange} | Chart: {chartType}</p>

      {loading && <div className="h-48 flex items-center justify-center"><div className="animate-spin rounded-full h-5 w-5 border-2 border-[#2A2A2A] border-t-[#F09040]" /></div>}
      {error && <div className="h-48 flex flex-col items-center justify-center gap-2"><p className="text-xs text-red-400">{error}</p><button onClick={loadData} className="text-xs text-[#F09040] hover:text-[#D87830]">Retry</button></div>}
      {!sql.trim() && !loading && !error && <div className="h-48 flex items-center justify-center"><p className="text-xs text-[#8A8F98]">Configure a SQL query in widget settings</p></div>}

      {!loading && !error && sql.trim() && chartType === 'table' && data && data.rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>{data.columns.map((col) => (<th key={col} className="text-left p-2 text-[#8A8F98] border-b border-[#2A2A2A]">{col}</th>))}</tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (<tr key={i}>{row.map((cell, j) => (<td key={j} className="p-2 text-gray-300 border-b border-[#2A2A2A]">{String(cell)}</td>))}</tr>))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && sql.trim() && chartType !== 'table' && data && data.rows.length > 0 && (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'bar' && (
              <BarChart data={chartData}>
                <XAxis dataKey={xAxis} stroke="#2A2A2A" tick={{ fill: '#8A8F98', fontSize: 11 }} />
                <YAxis stroke="#2A2A2A" tick={{ fill: '#8A8F98', fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#151515', border: '1px solid #2A2A2A', borderRadius: '6px', fontSize: '12px' }} />
                <Bar dataKey={yAxis} fill="#F09040" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
            {chartType === 'area' && (
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="customGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F09040" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#F09040" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey={xAxis} stroke="#2A2A2A" tick={{ fill: '#8A8F98', fontSize: 11 }} />
                <YAxis stroke="#2A2A2A" tick={{ fill: '#8A8F98', fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#151515', border: '1px solid #2A2A2A', borderRadius: '6px', fontSize: '12px' }} />
                <Area type="monotone" dataKey={yAxis} stroke="#F09040" fill="url(#customGrad)" strokeWidth={2} />
              </AreaChart>
            )}
            {chartType === 'line' && (
              <LineChart data={chartData}>
                <XAxis dataKey={xAxis} stroke="#2A2A2A" tick={{ fill: '#8A8F98', fontSize: 11 }} />
                <YAxis stroke="#2A2A2A" tick={{ fill: '#8A8F98', fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#151515', border: '1px solid #2A2A2A', borderRadius: '6px', fontSize: '12px' }} />
                <Line type="monotone" dataKey={yAxis} stroke="#F09040" strokeWidth={2} dot={false} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
