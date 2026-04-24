import { useState } from 'react';
import { RequireAuth } from '~/lib/auth-client';
import { useAuth } from '~/lib/auth-client';
import { fetchApi } from '~/lib/api';

export default function AccountSettingsPage() {
  const { user, logout } = useAuth();
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState(user?.email || '');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (passwords.new !== passwords.confirm) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (passwords.new.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    try {
      await fetchApi('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: passwords.current,
          newPassword: passwords.new,
        }),
      });
      setPasswordSuccess('Password updated successfully');
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password');
    }
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    setEmailSuccess(null);

    if (newEmail === user?.email) {
      setEmailError('Enter a different email');
      return;
    }

    try {
      await fetchApi('/auth/change-email', {
        method: 'POST',
        body: JSON.stringify({ email: newEmail }),
      });
      setEmailSuccess('Email updated successfully');
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Failed to change email');
    }
  }

  return (
    <RequireAuth>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-lg font-semibold">Account</h1>
          <p className="text-sm text-[#8A8F98]">Manage your profile and sign-in settings.</p>
        </div>

        <section className="rounded-lg border border-[#2A2A2A] bg-[#151515] p-4 space-y-4">
          <h2 className="text-sm font-medium">Email</h2>
          <form onSubmit={handleChangeEmail} className="space-y-3">
            <div>
              <label className="block text-sm text-[#8A8F98] mb-1">Current</label>
              <div className="text-sm text-[#8A8F98]">{user?.email}</div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">New Email</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
                required
              />
            </div>
            {emailError && <div className="text-sm text-red-400">{emailError}</div>}
            {emailSuccess && <div className="text-sm text-green-400">{emailSuccess}</div>}
            <button
              type="submit"
              className="px-3 py-1.5 rounded-md bg-[#5E6AD2] text-white text-sm font-medium hover:bg-[#4f5ab8] transition-colors"
            >
              Update Email
            </button>
          </form>
        </section>

        <section className="rounded-lg border border-[#2A2A2A] bg-[#151515] p-4 space-y-4">
          <h2 className="text-sm font-medium">Password</h2>
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Current Password</label>
              <input
                type="password"
                value={passwords.current}
                onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                className="w-full rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">New Password</label>
              <input
                type="password"
                value={passwords.new}
                onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                className="w-full rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
                required
                minLength={8}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Confirm New Password</label>
              <input
                type="password"
                value={passwords.confirm}
                onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                className="w-full rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
                required
                minLength={8}
              />
            </div>
            {passwordError && <div className="text-sm text-red-400">{passwordError}</div>}
            {passwordSuccess && <div className="text-sm text-green-400">{passwordSuccess}</div>}
            <button
              type="submit"
              className="px-3 py-1.5 rounded-md bg-[#5E6AD2] text-white text-sm font-medium hover:bg-[#4f5ab8] transition-colors"
            >
              Change Password
            </button>
          </form>
        </section>

        <div className="pt-4 border-t border-[#2A2A2A]">
          <button
            onClick={() => void logout()}
            className="rounded-md border border-[#2A2A2A] px-3 py-2 text-sm font-medium text-[#8A8F98] hover:text-gray-200 hover:bg-[#151515] transition-colors"
          >
            Log out
          </button>
        </div>
      </div>
    </RequireAuth>
  );
}
