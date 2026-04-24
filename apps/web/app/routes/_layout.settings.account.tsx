import { RequireAuth } from '~/lib/auth-client';
import { useAuth } from '~/lib/auth-client';

export default function AccountSettingsPage() {
  const { user, logout } = useAuth();

  return (
    <RequireAuth>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-lg font-semibold">Account</h1>
          <p className="text-sm text-[#8A8F98]">Manage your profile and sign-in settings.</p>
        </div>
        <section className="rounded-lg border border-[#2A2A2A] bg-[#151515] p-4">
          <div className="text-sm font-medium">Email</div>
          <div className="mt-1 text-sm text-[#8A8F98]">{user?.email}</div>
        </section>
        <button
          onClick={() => void logout()}
          className="rounded-md bg-[#5E6AD2] px-3 py-2 text-sm font-medium text-white"
        >
          Log out
        </button>
      </div>
    </RequireAuth>
  );
}
