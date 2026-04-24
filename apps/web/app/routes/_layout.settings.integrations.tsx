import { RequireAuth } from '~/lib/auth-client';
import { NextDnsConnectForm } from '~/components/integrations/nextdns-connect-form';
import { IntegrationList } from '~/components/integrations/integration-list';

export default function IntegrationsPage() {
  return (
    <RequireAuth>
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold">Integrations</h1>
          <p className="text-sm text-[#8A8F98]">
            Piglog connects to external services and syncs logs into your workspace.
          </p>
        </div>
        <IntegrationList />
        <section className="rounded-lg border border-[#2A2A2A] bg-[#151515] p-4">
          <h2 className="text-sm font-medium mb-3">Connect NextDNS</h2>
          <NextDnsConnectForm />
        </section>
      </div>
    </RequireAuth>
  );
}
