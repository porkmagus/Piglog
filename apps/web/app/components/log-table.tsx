import { useRef, useState, useEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useWorkspace } from '~/lib/workspace';
import { useLiveLogs } from '~/hooks/use-live-logs';
import { fetchApi } from '~/lib/api';

interface LogEntry {
  id: number;
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  service: string;
  host: string | null;
  message: string;
  metadata: Record<string, unknown> | null;
  traceId: string | null;
  sourceId: string;
  workspaceId: string;
}

const LEVEL_COLORS: Record<string, string> = {
  DEBUG: 'text-gray-500',
  INFO: 'text-blue-400',
  WARN: 'text-yellow-400',
  ERROR: 'text-red-400',
  FATAL: 'text-red-500',
};

const LEVEL_BG: Record<string, string> = {
  DEBUG: 'bg-gray-500/10',
  INFO: 'bg-blue-400/10',
  WARN: 'bg-yellow-400/10',
  ERROR: 'bg-red-400/10',
  FATAL: 'bg-red-500/10',
};

const ROW_HEIGHT = 32;

interface LogTableProps {
  searchQuery?: string;
}

export default function LogTable({ searchQuery = '' }: LogTableProps) {
  const { activeWorkspace } = useWorkspace();
  const [historicalLogs, setHistoricalLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [liveMode, setLiveMode] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);
  const isUserScrolled = useRef(false);

  const { logs: liveLogs, connected, paused, setPaused } = useLiveLogs({
    workspaceId: activeWorkspace?.id || null,
    enabled: liveMode,
  });

  const logs = liveMode ? liveLogs : historicalLogs;

  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  async function loadLogs() {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        workspaceId: activeWorkspace.id,
        limit: '500',
      });
      if (searchQuery) params.set('search', searchQuery);

      const data = await fetchApi(`/logs/query?${params.toString()}`);
      setHistoricalLogs(data);
      if (data.length > 0 && selectedIndex === -1) {
        setSelectedIndex(0);
      }
    } catch (err) {
      console.error('Failed to load logs:', err);
      setHistoricalLogs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, [activeWorkspace, searchQuery]);

  // Auto-scroll in live mode
  useEffect(() => {
    if (liveMode && logs.length > 0 && !paused && !isUserScrolled.current) {
      virtualizer.scrollToIndex(0, { align: 'start' });
    }
  }, [liveLogs.length, liveMode, paused, virtualizer]);

  // Detect user scroll
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;

    function handleScroll() {
      if (!el) return;
      isUserScrolled.current = el.scrollTop > 10;
      if (isUserScrolled.current && liveMode && !paused) {
        setPaused(true);
      }
    }

    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [liveMode, paused]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = Math.min(prev + 1, logs.length - 1);
          virtualizer.scrollToIndex(next, { align: 'center' });
          return next;
        });
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = Math.max(prev - 1, 0);
          virtualizer.scrollToIndex(next, { align: 'center' });
          return next;
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex >= 0) {
          const log = logs[selectedIndex];
          setExpandedId((prev) => (prev === log.id ? null : log.id));
        }
      } else if (e.key === 'Escape') {
        setExpandedId(null);
      } else if (e.key === 't') {
        setLiveMode((prev) => !prev);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [logs, selectedIndex, virtualizer]);

  const toggleExpand = useCallback((id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  if (loading && !liveMode) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#2A2A2A] border-t-[#5E6AD2]" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-[#8A8F98]">No logs found.</p>
          <p className="text-xs text-[#8A8F98] mt-1">
            {searchQuery ? 'Try adjusting your search.' : 'Configure a source in Settings → Sources to start ingesting.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center px-4 h-8 border-b border-[#2A2A2A] text-xs text-[#8A8F98] select-none">
        <div className="w-36 flex-shrink-0">Timestamp</div>
        <div className="w-16 flex-shrink-0">Level</div>
        <div className="w-32 flex-shrink-0">Service</div>
        <div className="w-32 flex-shrink-0">Host</div>
        <div className="flex-1 min-w-0">Message</div>
      </div>

      {/* Virtualized list */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const log = logs[virtualItem.index];
            const isSelected = selectedIndex === virtualItem.index;
            const isExpanded = expandedId === log.id;

            return (
              <div
                key={`${liveMode ? 'live' : 'hist'}-${log.id}`}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                onClick={() => {
                  setSelectedIndex(virtualItem.index);
                  toggleExpand(log.id);
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                className={`border-b border-[#2A2A2A]/30 cursor-pointer transition-colors ${
                  isSelected ? 'bg-[#5E6AD2]/10' : 'hover:bg-[#151515]'
                }`}
              >
                <div
                  className="flex items-center px-4 text-sm"
                  style={{ minHeight: ROW_HEIGHT }}
                >
                  <div className="w-36 flex-shrink-0 text-[#8A8F98] text-xs tabular-nums">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="w-16 flex-shrink-0">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${LEVEL_BG[log.level]} ${LEVEL_COLORS[log.level]}`}
                    >
                      {log.level}
                    </span>
                  </div>
                  <div className="w-32 flex-shrink-0 truncate text-[#8A8F98]">
                    {log.service}
                  </div>
                  <div className="w-32 flex-shrink-0 truncate text-[#8A8F98]">
                    {log.host || '—'}
                  </div>
                  <div className="flex-1 min-w-0 truncate text-gray-300">
                    {log.message}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-3 pl-[340px]">
                    <div className="rounded-md bg-[#0D0D0D] border border-[#2A2A2A] p-3">
                      {log.traceId && (
                        <div className="text-xs text-[#8A8F98] mb-2">
                          Trace ID:{' '}
                          <span className="text-[#5E6AD2]">{log.traceId}</span>
                        </div>
                      )}
                      {log.metadata ? (
                        <pre className="text-xs text-gray-400 overflow-auto">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      ) : (
                        <div className="text-xs text-[#8A8F98]">No metadata</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 h-8 border-t border-[#2A2A2A] text-xs text-[#8A8F98]">
        <div>
          {logs.length.toLocaleString()} logs
          {liveMode && connected && <span className="ml-2 text-green-400">● live</span>}
          {liveMode && !connected && <span className="ml-2 text-red-400">● disconnected</span>}
        </div>
        <div className="flex items-center gap-3">
          {liveMode && paused && (
            <button
              onClick={() => {
                setPaused(false);
                isUserScrolled.current = false;
              }}
              className="text-yellow-400 hover:text-yellow-300 transition-colors"
            >
              Paused — Click to resume
            </button>
          )}
          <button
            onClick={() => {
              setLiveMode((prev) => !prev);
              isUserScrolled.current = false;
            }}
            className={`hover:text-gray-200 transition-colors ${liveMode ? 'text-green-400' : ''}`}
          >
            {liveMode ? 'Stop Live' : 'Live Tail (t)'}
          </button>
          {!liveMode && (
            <button
              onClick={loadLogs}
              className="hover:text-gray-200 transition-colors"
            >
              Refresh
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
