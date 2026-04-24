import { useState, useEffect } from 'react';
import { fetchApi } from '~/lib/api';
import { useWorkspace } from '~/lib/workspace';
import { Trash2, AlertCircle, CheckCircle2, Loader2, Pause } from 'lucide-react';

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

  useEffect(() => {
    if (activeWorkspace) loadIntegrations();
  }, [activeWorkspace]);

  async function loadIntegrations() {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const data = await fetchApi(`/workspaces/${activeWorkspace.id}/integrations`);
      setIntegrations(data || []);
    } catch {
      setIntegrations([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!activeWorkspace || !confirm('Delete this integration? Hidden sources will be removed.')) return;
    try {
      await fetchApi(`/workspaces/${activeWorkspace.id}/integrations/${id}`, { method: 'DELETE' });
      loadIntegrations();
    } catch {
      alert('Failed to delete integration');
    }
  }

  async function handleDisable(id: string) {
    if (!activeWorkspace || !confirm('Disable this integration?')) return;
    try {
      await fetchApi(`/workspaces/${activeWorkspace.id}/integrations/${id}/disable`, { method: 'PATCH' });
      loadIntegrations();
    } catch {
      alert('Failed to disable integration');
    }
  }

  if (loading) {
    return <div className="text-sm text-[#8A8F98]">Loading integrations...</div>;
  }

  if (integrations.length === 0) {
    return null;
  }

  return (
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
                  {int.lastSyncedAt ? new Date(int.lastSyncedAt).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {int.status !== 'DISABLED' && (
                      <button
                        onClick={() => handleDisable(int.id)}
                        className="p-1.5 rounded hover:bg-[#2A2A2A] text-[#8A8F98] hover:text-gray-200 transition-colors"
                        title="Disable"
                      >
                        <Pause className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(int.id)}
                      className="p-1.5 rounded hover:bg-red-500/10 text-[#8A8F98] hover:text-red-400 transition-colors"
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
  );
}
