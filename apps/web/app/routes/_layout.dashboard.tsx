import { useEffect, useState } from 'react';
import { RequireAuth } from '~/lib/auth-client';
import { useWorkspace } from '~/lib/workspace';
import { fetchApi } from '~/lib/api';
import { DashboardGrid } from '~/components/dashboard/dashboard-grid';
import type { DashboardWidgetData } from '~/components/dashboard/types';

export default function DashboardPage() {
  const { activeWorkspace } = useWorkspace();
  const [widgets, setWidgets] = useState<DashboardWidgetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeWorkspace) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const result = await fetchApi(`/workspaces/${activeWorkspace.id}/dashboard/layout`);
        setWidgets(result?.widgets || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    })();
  }, [activeWorkspace]);

  const handleSave = async (newWidgets: DashboardWidgetData[], hiddenIds: string[]) => {
    if (!activeWorkspace) return;
    try {
      await fetchApi(`/workspaces/${activeWorkspace.id}/dashboard/layout`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgets: newWidgets, hiddenIds }),
      });
      setWidgets(newWidgets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save dashboard');
    }
  };

  if (!activeWorkspace) {
    return (
      <RequireAuth>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <p className="text-sm text-[#8A8F98]">No workspace selected.</p>
        </div>
      </RequireAuth>
    );
  }

  if (loading) {
    return (
      <RequireAuth>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#2A2A2A] border-t-[#F09040]" />
        </div>
      </RequireAuth>
    );
  }

  if (error && widgets.length === 0) {
    return (
      <RequireAuth>
        <div className="p-6">
          <h1 className="text-xl font-semibold mb-4">Dashboard</h1>
          <div className="rounded-lg border border-red-500/30 bg-[#151515] p-8 text-center">
            <p className="text-sm text-red-400">{error}</p>
            <button onClick={() => window.location.reload()} className="mt-4 rounded-md bg-[#F09040] px-3 py-2 text-sm font-medium text-white hover:bg-[#D87830]">Retry</button>
          </div>
        </div>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <DashboardGrid
        widgets={widgets}
        workspaceId={activeWorkspace.id}
        onSave={handleSave}
      />
    </RequireAuth>
  );
}
