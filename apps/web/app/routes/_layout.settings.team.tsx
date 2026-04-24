import { useState, useEffect } from 'react';
import { RequireAuth } from '~/lib/auth-client';
import { useWorkspace } from '~/lib/workspace';
import { fetchApi } from '~/lib/api';
import { Users, Mail, Copy, Trash2, Shield, User } from 'lucide-react';

interface Member {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  joinedAt: string;
}

interface Invite {
  id: string;
  email: string;
  role: string;
  status: string;
  invitedBy: { name: string | null; email: string | null };
  expiresAt: string;
  createdAt: string;
}

export default function TeamPage() {
  const { activeWorkspace } = useWorkspace();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (activeWorkspace) {
      loadMembers();
      loadInvites();
    }
  }, [activeWorkspace]);

  async function loadMembers() {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const data = await fetchApi(`/workspaces/${activeWorkspace.id}/members`);
      setMembers(data);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadInvites() {
    if (!activeWorkspace) return;
    try {
      const data = await fetchApi(`/workspaces/${activeWorkspace.id}/invitations`);
      setInvites(data);
    } catch {
      setInvites([]);
    }
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspace || !inviteEmail) return;
    try {
      await fetchApi(`/workspaces/${activeWorkspace.id}/invitations`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      setInviteEmail('');
      setShowInviteForm(false);
      loadInvites();
    } catch (err: any) {
      alert(err?.message || 'Failed to send invitation');
    }
  }

  async function cancelInvite(id: string) {
    if (!activeWorkspace) return;
    if (!confirm('Cancel this invitation?')) return;
    try {
      await fetchApi(`/workspaces/${activeWorkspace.id}/invitations/${id}`, { method: 'DELETE' });
      loadInvites();
    } catch {
      alert('Failed to cancel invitation');
    }
  }

  function copyInviteCode() {
    if (!activeWorkspace?.inviteCode) return;
    navigator.clipboard.writeText(activeWorkspace.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const roleIcon = (role: string) => {
    switch (role) {
      case 'OWNER':
        return <Shield className="w-3.5 h-3.5 text-yellow-400" />;
      case 'ADMIN':
        return <Shield className="w-3.5 h-3.5 text-[#5E6AD2]" />;
      default:
        return <User className="w-3.5 h-3.5 text-[#8A8F98]" />;
    }
  };

  const roleLabel = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'Owner';
      case 'ADMIN':
        return 'Admin';
      case 'MEMBER':
        return 'Member';
      case 'GUEST':
        return 'Guest';
      default:
        return role;
    }
  };

  return (
    <RequireAuth>
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold">Team</h1>
            <p className="text-sm text-[#8A8F98]">Manage workspace members and invitations</p>
          </div>
          <button
            onClick={() => setShowInviteForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#5E6AD2] text-white text-sm font-medium hover:bg-[#4f5ab8] transition-colors"
          >
            <Mail className="w-4 h-4" />
            Invite
          </button>
        </div>

        {showInviteForm && (
          <form
            onSubmit={sendInvite}
            className="mb-6 rounded-lg border border-[#2A2A2A] bg-[#151515] p-4 space-y-3"
          >
            <div className="flex gap-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="flex-1 rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
                required
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
              >
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
                <option value="GUEST">Guest</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-3 py-1.5 rounded-md bg-[#5E6AD2] text-white text-sm font-medium hover:bg-[#4f5ab8] transition-colors"
              >
                Send Invitation
              </button>
              <button
                type="button"
                onClick={() => setShowInviteForm(false)}
                className="px-3 py-1.5 rounded-md text-sm text-[#8A8F98] hover:text-gray-200"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {activeWorkspace?.inviteCode && (
          <div className="mb-6 rounded-lg border border-[#2A2A2A] bg-[#151515] p-4">
            <label className="block text-sm font-medium mb-1.5">Invite Code</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-[#0D0D0D] px-3 py-2 text-sm text-[#8A8F98] font-mono">
                {activeWorkspace.inviteCode}
              </code>
              <button
                onClick={copyInviteCode}
                className="flex items-center gap-1 px-3 py-2 rounded-md border border-[#2A2A2A] text-sm text-[#8A8F98] hover:text-gray-200 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-[#8A8F98] mt-1.5">
              Anyone with this code can join this workspace.
            </p>
          </div>
        )}

        <h2 className="text-sm font-medium text-[#8A8F98] uppercase tracking-wider mb-3">Members</h2>
        {loading ? (
          <div className="text-sm text-[#8A8F98]">Loading members...</div>
        ) : members.length === 0 ? (
          <div className="rounded-lg border border-[#2A2A2A] bg-[#151515] p-8 text-center">
            <Users className="w-8 h-8 text-[#2A2A2A] mx-auto mb-3" />
            <p className="text-sm text-[#8A8F98]">No members yet.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-[#2A2A2A] bg-[#151515] overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2A2A2A] text-[#8A8F98]">
                  <th className="text-left font-medium px-4 py-2">User</th>
                  <th className="text-left font-medium px-4 py-2">Role</th>
                  <th className="text-left font-medium px-4 py-2">Joined</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr
                    key={member.id}
                    className="border-b border-[#2A2A2A]/50 hover:bg-[#1a1a1a] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {member.image ? (
                          <img src={member.image} alt="" className="w-6 h-6 rounded-full" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-[#2A2A2A] flex items-center justify-center text-xs text-[#8A8F98]">
                            {(member.name || member.email || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{member.name || 'Unnamed'}</div>
                          <div className="text-xs text-[#8A8F98]">{member.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase bg-[#2A2A2A] text-gray-300">
                        {roleIcon(member.role)}
                        {roleLabel(member.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#8A8F98]">
                      {new Date(member.joinedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {invites.length > 0 && (
          <>
            <h2 className="text-sm font-medium text-[#8A8F98] uppercase tracking-wider mb-3">Pending Invitations</h2>
            <div className="rounded-lg border border-[#2A2A2A] bg-[#151515] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2A2A2A] text-[#8A8F98]">
                    <th className="text-left font-medium px-4 py-2">Email</th>
                    <th className="text-left font-medium px-4 py-2">Role</th>
                    <th className="text-left font-medium px-4 py-2">Invited By</th>
                    <th className="text-left font-medium px-4 py-2">Expires</th>
                    <th className="text-right font-medium px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((invite) => (
                    <tr
                      key={invite.id}
                      className="border-b border-[#2A2A2A]/50 hover:bg-[#1a1a1a] transition-colors"
                    >
                      <td className="px-4 py-3 font-medium">{invite.email}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase bg-[#2A2A2A] text-gray-300">
                          {roleIcon(invite.role)}
                          {roleLabel(invite.role)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#8A8F98]">
                        {invite.invitedBy?.name || invite.invitedBy?.email}
                      </td>
                      <td className="px-4 py-3 text-[#8A8F98]">
                        {new Date(invite.expiresAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => cancelInvite(invite.id)}
                          className="p-1.5 rounded hover:bg-red-500/10 text-[#8A8F98] hover:text-red-400 transition-colors"
                          title="Cancel invitation"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </RequireAuth>
  );
}
