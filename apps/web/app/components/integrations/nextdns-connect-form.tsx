import { useState } from 'react';
import { useWorkspace } from '~/lib/workspace';
import { fetchApi } from '~/lib/api';

export function NextDnsConnectForm({ onConnected }: { onConnected?: () => void }) {
  const { activeWorkspace } = useWorkspace();
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(new Set());

  async function handleDiscover(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !apiKey.trim() || !activeWorkspace) return;

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const data = await fetchApi(`/workspaces/${activeWorkspace.id}/integrations/discover`, {
        method: 'POST',
        body: JSON.stringify({
          provider: 'nextdns',
          secret: apiKey,
        }),
      });
      const entities = data?.entities || [];
      setProfiles(entities);
      setSelectedProfiles(new Set(entities.map((p: { id: string }) => p.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discovery failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    if (loading || selectedProfiles.size === 0 || !activeWorkspace) return;

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await fetchApi(`/workspaces/${activeWorkspace.id}/integrations`, {
        method: 'POST',
        body: JSON.stringify({
          provider: 'nextdns',
          name,
          secret: apiKey,
          config: {
            profileIds: Array.from(selectedProfiles),
            backfillHours: 24,
          },
        }),
      });
      setName('');
      setApiKey('');
      setProfiles([]);
      setSelectedProfiles(new Set());
      setSuccessMessage('Integration connected. Profiles will start syncing shortly.');
      onConnected?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setLoading(false);
    }
  }

  if (profiles.length > 0) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-[#8A8F98]">
          Found {profiles.length} profile{profiles.length > 1 ? 's' : ''}. Select which to sync:
        </div>
        <div className="space-y-2">
          {profiles.map((profile) => (
            <label
              key={profile.id}
              className="flex items-center gap-3 px-3 py-2 rounded-md border border-[#2A2A2A] cursor-pointer hover:bg-[#1a1a1a]"
            >
              <input
                type="checkbox"
                checked={selectedProfiles.has(profile.id)}
                onChange={(e) => {
                  const next = new Set(selectedProfiles);
                  if (e.target.checked) next.add(profile.id);
                  else next.delete(profile.id);
                  setSelectedProfiles(next);
                }}
                className="rounded border-[#2A2A2A] bg-[#0D0D0D] text-[#5E6AD2] focus:ring-[#5E6AD2]"
              />
              <span className="text-sm">{profile.name || profile.id}</span>
            </label>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleConnect}
            disabled={loading || selectedProfiles.size === 0}
            className="rounded-md bg-[#5E6AD2] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? 'Connecting...' : `Connect ${selectedProfiles.size} Profile${selectedProfiles.size > 1 ? 's' : ''}`}
          </button>
          <button
            type="button"
            onClick={() => {
              setProfiles([]);
              setSelectedProfiles(new Set());
            }}
            className="px-3 py-2 text-sm text-[#8A8F98] hover:text-gray-200"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleDiscover} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Integration Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. My NextDNS"
          className="w-full rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">NextDNS API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter your NextDNS API key"
          className="w-full rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
          required
        />
      </div>
      {error && <div className="text-sm text-red-400">{error}</div>}
      {successMessage && <div className="text-sm text-green-400">{successMessage}</div>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-[#5E6AD2] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? 'Discovering...' : 'Discover Profiles'}
      </button>
    </form>
  );
}
