import { useState, useEffect } from 'react';
import { fetchApi } from '~/lib/api';
import { useWorkspace } from '~/lib/workspace';
import { Trash2, AlertCircle, CheckCircle2, Loader2, Pause, Play, Eye, EyeOff, Copy, ChevronDown, ChevronRight } from 'lucide-react';

interface IntegrationSource {
  id: string;
  sourceId: string;
  externalId: string;
  externalName: string;
  status: string;
  isEnabled: boolean;
}

interface Integration {
  id: string;
  provider: string;
  name: string;
  status: string;
  config: Record<string, unknown>;
  errorMessage: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  sources: IntegrationSource[];
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  CONNECTED: { label: 'Connected', icon: CheckCircle2, color: 'text-green-400' },
  SYNCING: { label: 'Syncing', icon: Loader2, color: 'text-blue-400' },
  ERROR: { label: 'Error', icon: AlertCircle, color: 'text-red-400' },
  PENDING: { label: 'Pending', icon: Loader2, color: 'text-yellow-400' },
  DISABLED: { label: 'Disabled', icon: Pause, color: 'text-[#8A8F98]' },
};

export function IntegrationList({ refreshKey = 0 }: { refreshKey?: number }) {
  const { activeWorkspace } = useWorkspace();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());
  const [expandedIntegrations, setExpandedIntegrations] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (activeWorkspace) loadIntegrations();
  }, [activeWorkspace, refreshKey]);

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
    setPendingAction(id);
    try {
      await fetchApi(`/workspaces/${activeWorkspace.id}/integrations/${id}`, { method: 'DELETE' });
      loadIntegrations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete integration');
    } finally {
      setPendingAction(null);
      setDeleteConfirmId(null);
    }
  }

  function toggleReveal(id: string) {
    setRevealedSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function copySecret(secret: string) {
    navigator.clipboard.writeText(secret);
  }

  function toggleExpand(id: string) {
    setExpandedIntegrations((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
              <th className="text-left font-medium px-4 py-2"></th>
              <th className="text-left font-medium px-4 py-2">Name</th>
              <th className="text-left font-medium px-4 py-2">Provider</th>
              <th className="text-left font-medium px-4 py-2">Status</th>
              <th className="text-left font-medium px-4 py-2">Secret</th>
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
                const isRevealed = revealedSecrets.has(int.id);
                const apiKey = int.config?.secrets?.apiKey as string | undefined;
                const isDeleteConfirming = deleteConfirmId === int.id;
                const isExpanded = expandedIntegrations.has(int.id);
                const hasSources = int.sources && int.sources.length > 0;
                return (
                  <>
                  <tr key={int.id} className="border-b border-[#2A2A2A]/50 hover:bg-[#1a1a1a] transition-colors">
                    <td className="px-4 py-3">
                      {hasSources && (
                        <button onClick={() => toggleExpand(int.id)} className="p-1 rounded hover:bg-[#2A2A2A] text-[#8A8F98]" title="Toggle sources">
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {int.name}
                      {int.errorMessage && (
                        <div className="text-xs text-red-400 mt-0.5">{int.errorMessage}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 capitalize text-[#8A8F98]">{int.provider}</td>
                    <td className="px-4 py-3">
                      <div className={`flex items-center gap-1.5 ${status.color}`}>
                        <StatusIcon className={`w-4 h-4 ${int.status === 'SYNCING' ? 'animate-spin' : ''}`} />
                        <span>{status.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {apiKey ? (
                        <div className="flex items-center gap-1.5">
                          <code className="text-xs bg-[#0D0D0D] px-1.5 py-0.5 rounded">
                            {isRevealed ? `${apiKey.slice(0, 8)}...` : '••••••••'}
                          </code>
                          <button onClick={() => toggleReveal(int.id)} className="p-1 rounded hover:bg-[#2A2A2A] text-[#8A8F98]" title={isRevealed ? 'Hide' : 'Reveal'}>
                            {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          {isRevealed && (
                            <button onClick={() => copySecret(apiKey)} className="p-1 rounded hover:bg-[#2A2A2A] text-[#8A8F98]" title="Copy">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-[#8A8F98]">—</span>
                      )}
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
                        {isDeleteConfirming ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-red-400">Sure?</span>
                            <button onClick={() => handleDelete(int.id)} className="px-2 py-0.5 rounded bg-red-500/10 text-xs text-red-400">Yes</button>
                            <button onClick={() => setDeleteConfirmId(null)} className="px-2 py-0.5 rounded text-xs text-[#8A8F98] hover:text-gray-200">No</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(int.id)}
                            disabled={isActionPending}
                            className="p-1.5 rounded hover:bg-red-500/10 text-[#8A8F98] hover:text-red-400 transition-colors disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && hasSources && (
                    <tr key={`${int.id}-sources`}>
                      <td colSpan={7} className="px-6 py-3 bg-[#0D0D0D]">
                        <div className="text-xs text-[#8A8F98] mb-2 font-medium">Sources</div>
                        <div className="space-y-1.5">
                          {int.sources.map((src) => {
                            const srcStatus = STATUS_CONFIG[src.status] || STATUS_CONFIG.PENDING;
                            const SrcIcon = srcStatus.icon;
                            return (
                              <div key={src.id} className="flex items-center gap-2 text-sm">
                                <SrcIcon className={`w-3.5 h-3.5 ${srcStatus.color}`} />
                                <span className="font-medium">{src.externalName}</span>
                                <span className="text-[#8A8F98]">({src.externalId.slice(0, 8)})</span>
                                <span className={`text-xs ${srcStatus.color}`}>{srcStatus.label}</span>
                                {src.isEnabled === false && <span className="text-xs text-[#8A8F98]">(disabled)</span>}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                  </>
                );
              })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
