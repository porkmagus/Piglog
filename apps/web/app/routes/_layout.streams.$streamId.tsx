import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { RequireAuth } from '~/lib/auth-client';
import { useWorkspace } from '~/lib/workspace';
import { useLiveLogs } from '~/hooks/use-live-logs';
import LogTable from '~/components/log-table';
import SearchBar from '~/components/search-bar';
import TimeRangePicker, { type TimeRange } from '~/components/time-range-picker';
import { Loader2, Square } from 'lucide-react';

function parseTimeRange(searchParams: URLSearchParams): TimeRange | null {
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (!from || !to) return null;
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) return null;
  return { label: 'custom', from: fromDate, to: toDate };
}

function getDefaultTimeRange(): TimeRange {
  const to = new Date();
  const from = new Date(to.getTime() - 15 * 60 * 1000);
  return { label: '15m', from, to };
}

export default function StreamPage() {
  const { activeWorkspace } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [timeRange, setTimeRange] = useState<TimeRange | null>(() =>
    parseTimeRange(searchParams) ?? getDefaultTimeRange()
  );
  const [liveMode, setLiveMode] = useState(false);

  // Parse search tokens for live log filtering
  const liveService = search?.includes('service:') ? search.match(/service:(\S+)/)?.[1] : undefined;
  const liveLevel = search?.includes('level:') ? search.match(/level:(\S+)/)?.[1] : undefined;

  const { logs: liveLogs, connected } = useLiveLogs({
    workspaceId: activeWorkspace?.id || null,
    service: liveService,
    level: liveLevel,
    enabled: liveMode,
  });

  const updateSearch = useCallback(
    (value: string) => {
      setSearch(value);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set('q', value);
        else next.delete('q');
        return next;
      });
    },
    [setSearchParams]
  );

  const updateTimeRange = useCallback(
    (range: TimeRange | null) => {
      setTimeRange(range);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (range) {
          next.set('from', range.from.toISOString());
          next.set('to', range.to.toISOString());
        } else {
          next.delete('from');
          next.delete('to');
        }
        return next;
      });
    },
    [setSearchParams]
  );

  useEffect(() => {
    setSearch(searchParams.get('q') || '');
    const parsed = parseTimeRange(searchParams);
    if (parsed) {
      setTimeRange(parsed);
    }
  }, [searchParams]);

  return (
    <RequireAuth>
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 h-12 border-b border-[#2A2A2A]">
          <SearchBar value={search} onChange={updateSearch} />
          <TimeRangePicker value={timeRange} onChange={updateTimeRange} />
          <button
            onClick={() => setLiveMode((p) => !p)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              liveMode
                ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                : 'border border-[#2A2A2A] text-[#8A8F98] hover:text-gray-200 hover:bg-[#151515]'
            }`}
            title={liveMode ? 'Stop live tail' : 'Start live tail'}
          >
            {liveMode && connected ? (
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            ) : liveMode ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Square className="w-3 h-3" />
            )}
            {liveMode ? 'Live' : 'Live'}
          </button>
        </div>
        {liveMode ? (
          <LiveLogView logs={liveLogs} connected={connected} />
        ) : (
          <LogTable searchQuery={search} timeRange={timeRange} />
        )}
      </div>
    </RequireAuth>
  );
}

function LiveLogView({ logs, connected }: { logs: Array<{ timestamp: string; level: string; service: string; host: string | null; message: string }>; connected: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!paused && containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [logs.length, paused]);

  if (logs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          {!connected ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-[#8A8F98] mx-auto mb-2" />
              <p className="text-sm text-[#8A8F98]">Connecting to live stream...</p>
            </>
          ) : (
            <p className="text-sm text-[#8A8F98]">Waiting for logs...</p>
          )}
        </div>
      </div>
    );
  }

  const LEVEL_COLORS: Record<string, string> = {
    DEBUG: 'text-gray-500',
    INFO: 'text-blue-400',
    WARN: 'text-yellow-400',
    ERROR: 'text-red-400',
    FATAL: 'text-red-500',
  };

  return (
    <div className="flex flex-col flex-1">
      <div className="flex items-center justify-between px-4 h-8 border-b border-[#2A2A2A] text-xs text-[#8A8F98]">
        <div className="flex items-center gap-3">
          <span>{logs.length} events</span>
          <span className={connected ? 'text-green-400' : 'text-red-400'}>
            {connected ? '● connected' : '● disconnected'}
          </span>
        </div>
        <button
          onClick={() => setPaused((p) => !p)}
          className="hover:text-gray-200"
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
      </div>
      <div ref={containerRef} className="flex-1 overflow-auto font-mono text-xs">
        {logs.map((log, i) => (
          <div key={`${log.timestamp}-${i}`} className="flex items-start gap-3 px-4 py-1 border-b border-[#2A2A2A]/20 hover:bg-[#151515]">
            <span className="text-[#8A8F98] flex-shrink-0 w-28">{new Date(log.timestamp).toLocaleTimeString()}</span>
            <span className={`flex-shrink-0 w-12 font-medium uppercase ${LEVEL_COLORS[log.level] || 'text-gray-400'}`}>{log.level}</span>
            <span className="text-[#8A8F98] flex-shrink-0 w-24 truncate">{log.service}</span>
            <span className="flex-1 truncate text-gray-300">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
