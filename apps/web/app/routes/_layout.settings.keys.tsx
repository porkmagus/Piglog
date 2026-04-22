import { RequireAuth } from '~/lib/auth-client';

export default function KeysPage() {
  return (
    <RequireAuth>
      <div>
        <h1 className="text-lg font-semibold mb-4">API Keys</h1>
        <div className="rounded-lg border border-[#2A2A2A] bg-[#151515] p-8 text-center">
          <p className="text-sm text-[#8A8F98]">API key management coming soon.</p>
        </div>
      </div>
    </RequireAuth>
  );
}
