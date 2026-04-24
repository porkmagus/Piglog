import { useState, useEffect } from 'react';
import { fetchApi } from '~/lib/api';
import { useWorkspace } from '~/lib/workspace';
import { Trash2, AlertCircle, CheckCircle2, Loader2, Pause, Play } from 'lucide-react';

interface Integration {
  id: string;
  provider: string;
  name: string;
  status: string;
  config: Record<string, unknown>;
  lastSyncedAt: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  CONNECTED: { label: 'Connected', icon: CheckCircle2, color: 'text-green-400' },
  SYNCING: { label: 'Syncing', icon: Loader2, color: 'text-blue-400' },
  ERROR: { label: 'Error', icon: AlertCircle, color: 'text-red-400' },
  PENDING: { label: 'Pending', icon: Loader2, color: 'text-yellow-400' },
  DISABLED: { label: 'Disabled', icon: Pause, color: 'text-[#8A8F98]' },
};

export function IntegrationList() {
  const { activeWorkspace } = useWorkspace();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  useEffect(() => {
    if (activeWorkspace) loadIntegrations();
  }, [activeWorkspace]);

  async function loadIntegrations() {
    if (!activeWorkspace) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApi(`/workspaces/${activeWorkspace.id}/integrations`);
      setIntegrations(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load integrations');
      setIntegrations([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!activeWorkspace) return;
    const int = integrations.find((i) => i.id === id);
    if (!int || !window.confirm(`Delete "${int.name}"? Hidden sources will be removed.`)) return;

    setPendingAction(id);
    try {
      await fetchApi(`/workspaces/${activeWorkspace.id}/integrations/${id}`, { method: 'DELETE' });
      loadIntegrations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete integration');
    } finally {
      setPendingAction(null);
    }
  }

  async function handleToggleDisable(id: string, currentlyDisabled: boolean) {
    if (!activeWorkspace) return;
    setPendingAction(id);
    try {
      if (currentlyDisabled) {
        await fetchApi(`/workspaces/${activeWorkspace.id}/integrations/${id}/enable`, { method: 'PATCH' });
      } else {
        await fetchApi(`/workspaces/${activeWorkspace.id}/integrations/${id}/disable`, { method: 'PATCH' });
      }
      loadIntegrations();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${currentlyDisabled ? 'enable' : 'disable'} integration`);
    } finally {
      setPendingAction(null);
    }
  }

  if (loading) {
    return <div className="text-sm text-[#8A8F98]">Loading integrations...</div>;
  }

  if (integrations.length === 0 && !error) {
    return (
      <div className="rounded-lg border border-[#2A2A2A] bg-[#151515] px-6 py-8 text-center">
        <p className="text-sm text-[#8A8F98]">No integrations yet. Connect a service below to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <div className="text-sm text-red-400">{error}</div>}
      <section className="rounded-lg border border-[#2A2A2A] bg-[#151515] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2A2A2A] text-[#8A8F98]">
              <th className="text-left font-medium px-4 py-2">Name</th>
              <th className="text-left font-medium px-4 py-2">Provider</th>
              <th className="text-left font-medium px-4 py-2">Status</th>
              <th className="text-right font-medium px-4 py-2">Last Synced</th>
              <th className="text-right font-medium px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {integrations.map((int) => {
              const status = STATUS_CONFIG[int.status] || STATUS_CONFIG.PENDING;
              const StatusIcon = status.icon;
              const isDisabled = int.status === 'DISABLED';
              const isActionPending = pendingAction === int.id;
              return (
                <tr key={int.id} className="border-b border-[#2A2A2A]/50 hover:bg-[#1a1a1a] transition-colors">
                  <td className="px-4 py-3 font-medium">{int.name}</td>
                  <td className="px-4 py-3 capitalize text-[#8A8F98]">{int.provider}</td>
                  <td className="px-4 py-3">
                    <div className={`flex items-center gap-1.5 ${status.color}`}>
                      <StatusIcon className={`w-4 h-4 ${int.status === 'SYNCING' ? 'animate-spin' : ''}`} />
                      <span>{status.label}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-[#8A8F98]">
                    {int.lastSyncedAt ? new Date(int.lastSyncedAt).toLocaleString() : '\u2014'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleToggleDisable(int.id, isDisabled)}
                        disabled={isActionPending}
                        className="p-1.5 rounded hover:bg-[#2A2A2A] text-[#8A8F98] hover:text-gray-200 transition-colors disabled:opacity-50"
                        title={isDisabled ? 'Enable' : 'Disable'}
                      >
                        {isDisabled ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDelete(int.id)}
                        disabled={isActionPending}
                        className="p-1.5 rounded hover:bg-red-500/10 text-[#8A8F98] hover:text-red-400 transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
