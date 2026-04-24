import { useState } from 'react';
import { useNavigate } from 'react-router';
import { RequireAuth } from '~/lib/auth-client';
import { useWorkspace } from '~/lib/workspace';
import { fetchApi } from '~/lib/api';
import { Trash2, Save } from 'lucide-react';

export default function WorkspaceSettingsPage() {
  const { activeWorkspace, refreshWorkspaces } = useWorkspace();
  const navigate = useNavigate();
  const [name, setName] = useState(activeWorkspace?.name || '');
  const [slug, setSlug] = useState(activeWorkspace?.slug || '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function saveWorkspace(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspace) return;
    setSaving(true);
    setSaveError(null);
    try {
      await fetchApi(`/workspaces/${activeWorkspace.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, slug }),
      });
      await refreshWorkspaces();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to update workspace');
    } finally {
      setSaving(false);
    }
  }

  async function deleteWorkspace() {
    if (!activeWorkspace) return;
    if (!confirm(`Delete "${activeWorkspace.name}"? This will permanently remove all logs, sources, and settings.`)) return;
    setDeleteError(null);
    try {
      await fetchApi(`/workspaces/${activeWorkspace.id}`, { method: 'DELETE' });
      await refreshWorkspaces();
      navigate('/onboarding');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete workspace');
    }
  }

  return (
    <RequireAuth>
      <div>
        <div className="mb-6">
          <h1 className="text-lg font-semibold">Workspace</h1>
          <p className="text-sm text-[#8A8F98]">Manage your workspace settings</p>
        </div>

        <form onSubmit={saveWorkspace} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Slug</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
              required
            />
            <p className="text-xs text-[#8A8F98] mt-1">Used in URLs and API requests.</p>
          </div>
          {saveError && <div className="text-sm text-red-400">{saveError}</div>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#5E6AD2] text-white text-sm font-medium hover:bg-[#4f5ab8] transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>

        <div className="mt-10 pt-6 border-t border-[#2A2A2A]">
          <h2 className="text-sm font-medium text-red-400 mb-2">Danger Zone</h2>
          <p className="text-sm text-[#8A8F98] mb-3">
            Deleting a workspace will permanently remove all logs, sources, and settings.
          </p>
          {deleteError && <div className="mb-3 text-sm text-red-400">{deleteError}</div>}
          <button
            onClick={deleteWorkspace}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete Workspace
          </button>
        </div>
      </div>
    </RequireAuth>
  );
}
