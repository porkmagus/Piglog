import { useState, useEffect } from 'react';
import { RequireAuth } from '~/lib/auth-client';
import { useWorkspace } from '~/lib/workspace';
import { fetchApi } from '~/lib/api';
import { Plus, Copy, Trash2, RefreshCw, Radio, FileUp, Globe, Network } from 'lucide-react';

interface Source {
  id: string;
  name: string;
  type: string;
  apiKey: string;
  createdAt: string;
  volume24h: number;
  lastSeen: string | null;
  isInternal: boolean;
}

function TypeIcon({ type }: { type: string }) {
  if (type === 'syslog' || type === 'snmp') return <Radio className="w-4 h-4" />;
  if (type === 'filebeat' || type === 'vector') return <FileUp className="w-4 h-4" />;
  return <Globe className="w-4 h-4" />;
}

export default function SourcesPage() {
  const { activeWorkspace } = useWorkspace();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('http');
  const [snmpConfig, setSnmpConfig] = useState({
    version: 'v2c',
    community: 'public',
    username: '',
    authProtocol: 'SHA',
    authPassphrase: '',
    privacyProtocol: 'AES',
    privacyPassphrase: '',
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeWorkspace) loadSources();
  }, [activeWorkspace]);

  async function loadSources() {
    if (!activeWorkspace) return;
    setLoading(true);
    setError(null);
    try {
      const data = (await fetchApi(`/workspaces/${activeWorkspace.id}/sources`)) || [];
      setSources(data);
    } catch (err) {
      setSources([]);
      setError(err instanceof Error ? err.message : 'Failed to load sources');
    } finally {
      setLoading(false);
    }
  }

  async function createSource(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !activeWorkspace) return;
    setError(null);
    setCreating(true);
    const body: Record<string, unknown> = { name: newName, type: newType };
    if (newType === 'snmp') {
      body.config = {
        version: snmpConfig.version,
        ...(snmpConfig.version === 'v1' || snmpConfig.version === 'v2c'
          ? { community: snmpConfig.community }
          : {
              username: snmpConfig.username,
              authProtocol: snmpConfig.authProtocol,
              authPassphrase: snmpConfig.authPassphrase,
              privacyProtocol: snmpConfig.privacyProtocol,
              privacyPassphrase: snmpConfig.privacyPassphrase,
            }),
      };
    }
    try {
      await fetchApi(`/workspaces/${activeWorkspace.id}/sources`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setNewName('');
      setShowCreate(false);
      loadSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create source');
    } finally {
      setCreating(false);
    }
  }

  async function deleteSource(id: string) {
    if (!activeWorkspace) return;
    if (!window.confirm('Delete this source? Logs will be retained.')) return;
    setError(null);
    try {
      await fetchApi(`/workspaces/${activeWorkspace.id}/sources/${id}`, { method: 'DELETE' });
      loadSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete source');
    }
  }

  async function regenerateKey(id: string) {
    if (!activeWorkspace) return;
    setError(null);
    try {
      await fetchApi(`/workspaces/${activeWorkspace.id}/sources/${id}/regenerate-key`, { method: 'POST' });
      loadSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate key');
    }
  }

  function copyKey(key: string, id: string) {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <RequireAuth>
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold">Sources</h1>
            <p className="text-sm text-[#8A8F98]">Sources are push-style ingestion endpoints such as HTTP JSON, Syslog, Vector, and Filebeat.</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#5E6AD2] text-white text-sm font-medium hover:bg-[#4f5ab8] transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Source
          </button>
        </div>

        {showCreate && (
          <form
            onSubmit={createSource}
            className="mb-6 rounded-lg border border-[#2A2A2A] bg-[#151515] p-4"
          >
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. production-api"
                  className="w-full rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
                >
                  <option value="http">HTTP JSON</option>
                  <option value="syslog">Syslog</option>
                  <option value="vector">Vector</option>
                  <option value="filebeat">Filebeat</option>
                  <option value="snmp">SNMP Trap</option>
                </select>
              </div>
            </div>
            {newType === 'snmp' && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">SNMP Version</label>
                  <select
                    value={snmpConfig.version}
                    onChange={(e) => setSnmpConfig({ ...snmpConfig, version: e.target.value })}
                    className="w-full rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
                  >
                    <option value="v1">v1</option>
                    <option value="v2c">v2c</option>
                    <option value="v3">v3</option>
                  </select>
                </div>
                {(snmpConfig.version === 'v1' || snmpConfig.version === 'v2c') ? (
                  <div>
                    <label className="block text-sm font-medium mb-1">Community</label>
                    <input
                      value={snmpConfig.community}
                      onChange={(e) => setSnmpConfig({ ...snmpConfig, community: e.target.value })}
                      placeholder="public"
                      className="w-full rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium mb-1">Username</label>
                    <input
                      value={snmpConfig.username}
                      onChange={(e) => setSnmpConfig({ ...snmpConfig, username: e.target.value })}
                      placeholder="SNMP user"
                      className="w-full rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
                    />
                  </div>
                )}
                {snmpConfig.version === 'v3' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1">Auth Protocol</label>
                      <select
                        value={snmpConfig.authProtocol}
                        onChange={(e) => setSnmpConfig({ ...snmpConfig, authProtocol: e.target.value })}
                        className="w-full rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
                      >
                        <option value="SHA">SHA</option>
                        <option value="MD5">MD5</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Auth Passphrase</label>
                      <input
                        type="password"
                        value={snmpConfig.authPassphrase}
                        onChange={(e) => setSnmpConfig({ ...snmpConfig, authPassphrase: e.target.value })}
                        placeholder="••••••••"
                        className="w-full rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Privacy Protocol</label>
                      <select
                        value={snmpConfig.privacyProtocol}
                        onChange={(e) => setSnmpConfig({ ...snmpConfig, privacyProtocol: e.target.value })}
                        className="w-full rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
                      >
                        <option value="AES">AES</option>
                        <option value="DES">DES</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Privacy Passphrase</label>
                      <input
                        type="password"
                        value={snmpConfig.privacyPassphrase}
                        onChange={(e) => setSnmpConfig({ ...snmpConfig, privacyPassphrase: e.target.value })}
                        placeholder="••••••••"
                        className="w-full rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={creating}
                className="px-3 py-1.5 rounded-md bg-[#5E6AD2] text-white text-sm font-medium hover:bg-[#4f5ab8] transition-colors disabled:opacity-50"
              >
                Create
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

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">{error}</div>
        )}
        {loading ? (
          <div className="text-sm text-[#8A8F98]">Loading sources...</div>
        ) : sources.filter(s => s.isInternal).length > 0 && sources.filter(s => !s.isInternal).length === 0 ? (
          <div className="rounded-lg border border-[#2A2A2A] bg-[#151515] p-8 text-center">
            <Network className="w-8 h-8 text-[#2A2A2A] mx-auto mb-3" />
            <p className="text-sm text-[#8A8F98]">No user-managed sources yet. Integration-managed sources are shown in the Integrations page.</p>
          </div>
        ) : sources.length === 0 ? (
          <div className="rounded-lg border border-[#2A2A2A] bg-[#151515] p-8 text-center">
            <Radio className="w-8 h-8 text-[#2A2A2A] mx-auto mb-3" />
            <p className="text-sm text-[#8A8F98]">No sources yet. Create one to start ingesting logs.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-[#2A2A2A] bg-[#151515] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2A2A2A] text-[#8A8F98]">
                  <th className="text-left font-medium px-4 py-2">Source</th>
                  <th className="text-left font-medium px-4 py-2">Type</th>
                  <th className="text-left font-medium px-4 py-2">API Key</th>
                  <th className="text-right font-medium px-4 py-2">24h Volume</th>
                  <th className="text-right font-medium px-4 py-2">Last Seen</th>
                  <th className="text-right font-medium px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {sources.filter(s => !s.isInternal).map((source) => (
                  <tr
                    key={source.id}
                    className="border-b border-[#2A2A2A]/50 hover:bg-[#1a1a1a] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{source.name}</div>
                      <div className="text-xs text-[#8A8F98]">{source.id.slice(0, 8)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-[#8A8F98]">
                        <TypeIcon type={source.type} />
                        <span className="capitalize">{source.type}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-[#0D0D0D] px-1.5 py-0.5 rounded">
                          {source.apiKey.slice(0, 16)}...
                        </code>
                        <button
                          onClick={() => copyKey(source.apiKey, source.id)}
                          className="p-1 rounded hover:bg-[#2A2A2A] text-[#8A8F98]"
                          title="Copy key"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => regenerateKey(source.id)}
                          className="p-1 rounded hover:bg-[#2A2A2A] text-[#8A8F98]"
                          title="Regenerate key"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        {copiedId === source.id && (
                          <span className="text-xs text-green-400">Copied</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-[#8A8F98]">
                      {source.volume24h.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-[#8A8F98]">
                      {source.lastSeen
                        ? new Date(source.lastSeen).toLocaleTimeString()
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => deleteSource(source.id)}
                        className="p-1.5 rounded hover:bg-red-500/10 text-[#8A8F98] hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 rounded-lg border border-[#2A2A2A] bg-[#151515] p-4">
          <h3 className="text-sm font-medium mb-3">Ingestion Examples</h3>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-[#8A8F98] mb-1">cURL</div>
              <pre className="text-xs bg-[#0D0D0D] rounded p-3 overflow-x-auto text-gray-300">
{`curl -X POST https://api.piglog.dev/logs/ingest \\
  -H "X-API-Key: YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"logs":[{"timestamp":"2026-04-21T20:00:00Z","level":"ERROR","service":"api","message":"It broke"}]}'`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </RequireAuth>
  );
}
