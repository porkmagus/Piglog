import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { RequireAuth } from '~/lib/auth-client';
import LogTable from '~/components/log-table';
import SearchBar from '~/components/search-bar';
import TimeRangePicker, { type TimeRange } from '~/components/time-range-picker';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [timeRange, setTimeRange] = useState<TimeRange | null>(() =>
    parseTimeRange(searchParams) ?? getDefaultTimeRange()
  );

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

  // Sync from URL on back/forward — but don't override an explicit "all time" (null)
  // with the default. Only default on initial mount when no params exist.
  useEffect(() => {
    setSearch(searchParams.get('q') || '');
    const parsed = parseTimeRange(searchParams);
    if (parsed) {
      setTimeRange(parsed);
    }
    // If no time range in URL and current state is null (user cleared it), keep null.
    // Otherwise let the initial mount default handle it.
  }, [searchParams]);

  return (
    <RequireAuth>
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 h-12 border-b border-[#2A2A2A]">
          <SearchBar value={search} onChange={updateSearch} />
          <TimeRangePicker value={timeRange} onChange={updateTimeRange} />
        </div>
        <LogTable searchQuery={search} timeRange={timeRange} />
      </div>
    </RequireAuth>
  );
}
