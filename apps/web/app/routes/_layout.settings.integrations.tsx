import { RequireAuth } from '~/lib/auth-client';

export default function IntegrationsPage() {
  return (
    <RequireAuth>
      <div className="space-y-2">
        <h1 className="text-lg font-semibold">Integrations</h1>
        <p className="text-sm text-[#8A8F98]">
          Integrations let Piglog connect to external services and sync logs into your workspace.
        </p>
      </div>
    </RequireAuth>
  );
}
