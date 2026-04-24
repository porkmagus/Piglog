import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '~/lib/auth-client';
import { useWorkspace } from '~/lib/workspace';
import { fetchApi } from '~/lib/api';

export default function OnboardingPage() {
  const { user } = useAuth();
  const { refreshWorkspaces } = useWorkspace();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function createWorkspace(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const ws = await fetchApi('/workspaces', {
        method: 'POST',
        body: JSON.stringify({
          name: workspaceName,
          slug: workspaceSlug || workspaceName.toLowerCase().replace(/\s+/g, '-'),
        }),
      });
      await refreshWorkspaces();
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Failed to create workspace');
    } finally {
      setLoading(false);
    }
  }

  async function createSource(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // We need to get the workspace first
      const workspaces = await fetchApi('/workspaces');
      if (workspaces.length === 0) {
        setError('No workspace found');
        setLoading(false);
        return;
      }
      const ws = workspaces[0];
      const source = await fetchApi(`/workspaces/${ws.id}/sources`, {
        method: 'POST',
        body: JSON.stringify({ name: sourceName, type: 'http' }),
      });
      setApiKey(source.apiKey);
      setStep(3);
    } catch (err: any) {
      setError(err.message || 'Failed to create source');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to Piglog</h1>
          <p className="text-sm text-[#8A8F98]">
            {step === 1 && "Let's set up your workspace."}
            {step === 2 && "Create your first log source."}
            {step === 3 && "You're ready to start shipping logs."}
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {step === 1 && (
          <form onSubmit={createWorkspace} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Workspace Name</label>
              <input
                value={workspaceName}
                onChange={(e) => {
                  setWorkspaceName(e.target.value);
                  setWorkspaceSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                }}
                placeholder="My Team"
                className="w-full rounded-md border border-[#2A2A2A] bg-[#151515] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Slug</label>
              <input
                value={workspaceSlug}
                onChange={(e) => setWorkspaceSlug(e.target.value)}
                placeholder="my-team"
                className="w-full rounded-md border border-[#2A2A2A] bg-[#151515] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-[#5E6AD2] px-3 py-2 text-sm font-medium text-white hover:bg-[#4f5ab8] disabled:opacity-50 transition-colors"
            >
              {loading ? 'Creating...' : 'Create Workspace'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={createSource} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Source Name</label>
              <input
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="production-api"
                className="w-full rounded-md border border-[#2A2A2A] bg-[#151515] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-[#5E6AD2] px-3 py-2 text-sm font-medium text-white hover:bg-[#4f5ab8] disabled:opacity-50 transition-colors"
            >
              {loading ? 'Creating...' : 'Create Source'}
            </button>
          </form>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-[#2A2A2A] bg-[#151515] p-4 space-y-3">
              <div>
                <div className="text-xs text-[#8A8F98] mb-1">Your API Key</div>
                <code className="block text-xs bg-[#0D0D0D] rounded p-2 break-all">
                  {apiKey}
                </code>
              </div>
              <div>
                <div className="text-xs text-[#8A8F98] mb-1">Test with curl</div>
                <pre className="text-xs bg-[#0D0D0D] rounded p-2 overflow-x-auto text-gray-300">
{`curl -X POST ${import.meta.env.VITE_API_URL || 'https://api.piglog.dev'}/logs/ingest \\
  -H "X-API-Key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"logs":[{"timestamp":"${new Date().toISOString()}","level":"INFO","service":"test","message":"Hello from Piglog"}]}'`}
                </pre>
              </div>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full rounded-md bg-[#5E6AD2] px-3 py-2 text-sm font-medium text-white hover:bg-[#4f5ab8] transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
