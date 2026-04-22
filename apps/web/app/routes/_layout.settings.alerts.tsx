import { useState, useEffect } from 'react';
import { RequireAuth } from '~/lib/auth-client';
import { useWorkspace } from '~/lib/workspace';
import { fetchApi } from '~/lib/api';
import { Plus, Trash2, Pause, Play, Bell, AlertTriangle } from 'lucide-react';

interface AlertRule {
  id: string;
  name: string;
  description: string | null;
  service: string;
  level: string | null;
  operator: string;
  threshold: number;
  windowMinutes: number;
  status: 'ACTIVE' | 'PAUSED' | 'DISABLED';
  webhookUrl: string | null;
  lastTriggeredAt: string | null;
  createdAt: string;
}

export default function AlertsPage() {
  const { activeWorkspace } = useWorkspace();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    description: '',
    service: '',
    level: '',
    operator: 'GREATER_THAN',
    threshold: 10,
    windowMinutes: 5,
    webhookUrl: '',
  });

  useEffect(() => {
    if (activeWorkspace) loadRules();
  }, [activeWorkspace]);

  async function loadRules() {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const data = await fetchApi(`/workspaces/${activeWorkspace.id}/alerts`);
      setRules(data);
    } catch {
      setRules([]);
    } finally {
      setLoading(false);
    }
  }

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspace) return;
    try {
      await fetchApi(`/workspaces/${activeWorkspace.id}/alerts`, {
        method: 'POST',
        body: JSON.stringify({
          ...newRule,
          level: newRule.level || undefined,
          webhookUrl: newRule.webhookUrl || undefined,
        }),
      });
      setNewRule({
        name: '',
        description: '',
        service: '',
        level: '',
        operator: 'GREATER_THAN',
        threshold: 10,
        windowMinutes: 5,
        webhookUrl: '',
      });
      setShowCreate(false);
      loadRules();
    } catch {
      alert('Failed to create alert rule');
    }
  }

  async function toggleStatus(rule: AlertRule) {
    if (!activeWorkspace) return;
    const newStatus = rule.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      await fetchApi(`/workspaces/${activeWorkspace.id}/alerts/${rule.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      loadRules();
    } catch {
      alert('Failed to update rule');
    }
  }

  async function deleteRule(id: string) {
    if (!activeWorkspace) return;
    if (!confirm('Delete this alert rule?')) return;
    try {
      await fetchApi(`/workspaces/${activeWorkspace.id}/alerts/${id}`, { method: 'DELETE' });
      loadRules();
    } catch {
      alert('Failed to delete rule');
    }
  }

  return (
    <RequireAuth>
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold">Alerts</h1>
            <p className="text-sm text-[#8A8F98]">Monitor your logs for anomalies</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#5E6AD2] text-white text-sm font-medium hover:bg-[#4f5ab8] transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Rule
          </button>
        </div>

        {showCreate && (
          <form
            onSubmit={createRule}
            className="mb-6 rounded-lg border border-[#2A2A2A] bg-[#151515] p-4 space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  placeholder="e.g. High error rate"
                  className="w-full rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Service</label>
                <input
                  value={newRule.service}
                  onChange={(e) => setNewRule({ ...newRule, service: e.target.value })}
                  placeholder="e.g. api"
                  className="w-full rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Level</label>
                <select
                  value={newRule.level}
                  onChange={(e) => setNewRule({ ...newRule, level: e.target.value })}
                  className="w-full rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
                >
                  <option value="">Any</option>
                  <option value="DEBUG">DEBUG</option>
                  <option value="INFO">INFO</option>
                  <option value="WARN">WARN</option>
                  <option value="ERROR">ERROR</option>
                  <option value="FATAL">FATAL</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Operator</label>
                <select
                  value={newRule.operator}
                  onChange={(e) => setNewRule({ ...newRule, operator: e.target.value })}
                  className="w-full rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
                >
                  <option value="GREATER_THAN">Greater than</option>
                  <option value="LESS_THAN">Less than</option>
                  <option value="EQUALS">Equals</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Threshold</label>
                <input
                  type="number"
                  min={1}
                  value={newRule.threshold}
                  onChange={(e) => setNewRule({ ...newRule, threshold: parseInt(e.target.value) })}
                  className="w-full rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Window (minutes)</label>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={newRule.windowMinutes}
                  onChange={(e) => setNewRule({ ...newRule, windowMinutes: parseInt(e.target.value) })}
                  className="w-full rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Webhook URL</label>
                <input
                  type="url"
                  value={newRule.webhookUrl}
                  onChange={(e) => setNewRule({ ...newRule, webhookUrl: e.target.value })}
                  placeholder="https://hooks.slack.com/..."
                  className="w-full rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-3 py-1.5 rounded-md bg-[#5E6AD2] text-white text-sm font-medium hover:bg-[#4f5ab8] transition-colors"
              >
                Create Rule
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-3 py-1.5 rounded-md text-sm text-[#8A8F98] hover:text-gray-200"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-sm text-[#8A8F98]">Loading rules...</div>
        ) : rules.length === 0 ? (
          <div className="rounded-lg border border-[#2A2A2A] bg-[#151515] p-8 text-center">
            <Bell className="w-8 h-8 text-[#2A2A2A] mx-auto mb-3" />
            <p className="text-sm text-[#8A8F98]">No alert rules yet. Create one to monitor your logs.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-[#2A2A2A] bg-[#151515] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2A2A2A] text-[#8A8F98]">
                  <th className="text-left font-medium px-4 py-2">Rule</th>
                  <th className="text-left font-medium px-4 py-2">Condition</th>
                  <th className="text-left font-medium px-4 py-2">Status</th>
                  <th className="text-left font-medium px-4 py-2">Last Triggered</th>
                  <th className="text-right font-medium px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr
                    key={rule.id}
                    className="border-b border-[#2A2A2A]/50 hover:bg-[#1a1a1a] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{rule.name}</div>
                      {rule.description && (
                        <div className="text-xs text-[#8A8F98]">{rule.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#8A8F98]">
                      <span className="capitalize">{rule.operator.replace('_', ' ').toLowerCase()}</span>{' '}
                      <span className="text-gray-300">{rule.threshold}</span>{' '}
                      <span className="text-xs">({rule.windowMinutes}m)</span>
                      <div className="text-xs">
                        {rule.service}
                        {rule.level && ` / ${rule.level}`}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${
                          rule.status === 'ACTIVE'
                            ? 'bg-green-500/10 text-green-400'
                            : rule.status === 'PAUSED'
                            ? 'bg-yellow-500/10 text-yellow-400'
                            : 'bg-gray-500/10 text-gray-400'
                        }`}
                      >
                        {rule.status.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#8A8F98]">
                      {rule.lastTriggeredAt
                        ? new Date(rule.lastTriggeredAt).toLocaleString()
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => toggleStatus(rule)}
                          className="p-1.5 rounded hover:bg-[#2A2A2A] text-[#8A8F98]"
                          title={rule.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                        >
                          {rule.status === 'ACTIVE' ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => deleteRule(rule.id)}
                          className="p-1.5 rounded hover:bg-red-500/10 text-[#8A8F98] hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </RequireAuth>
  );
}
