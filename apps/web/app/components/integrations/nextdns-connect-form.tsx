import { useState } from 'react';

export function NextDnsConnectForm() {
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(new Set());

  async function handleDiscover(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !apiKey.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const ws = localStorage.getItem('piglog:activeWorkspace');
      const res = await fetch(`${API_URL}/workspaces/${ws}/integrations/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          provider: 'nextdns',
          name,
          secret: apiKey,
          config: { profileIds: [''], backfillHours: 24 },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Discovery failed');
      }

      const data = await res.json();
      setProfiles(data.entities);
      setSelectedProfiles(new Set(data.entities.map((p: { id: string }) => p.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discovery failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    if (selectedProfiles.size === 0) return;

    setLoading(true);
    setError(null);

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const ws = localStorage.getItem('piglog:activeWorkspace');
      const res = await fetch(`${API_URL}/workspaces/${ws}/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Connection failed');
      }

      window.location.reload();
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
            onClick={handleConnect}
            disabled={loading || selectedProfiles.size === 0}
            className="rounded-md bg-[#5E6AD2] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? 'Connecting...' : `Connect ${selectedProfiles.size} Profile${selectedProfiles.size > 1 ? 's' : ''}`}
          </button>
          <button
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
          placeholder="sk_..."
          className="w-full rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
          required
        />
      </div>
      {error && <div className="text-sm text-red-400">{error}</div>}
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
