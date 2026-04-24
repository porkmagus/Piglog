import { Link } from 'react-router';
import { RequireAuth } from '~/lib/auth-client';

export default function IngestionPage() {
  return (
    <RequireAuth>
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold">Ingestion</h1>
          <p className="text-sm text-[#8A8F98]">
            Sources are systems that send logs to Piglog. Integrations are services Piglog connects to and syncs from.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-lg border border-[#2A2A2A] bg-[#151515] p-4">
            <h2 className="text-sm font-medium">Sources</h2>
            <p className="mt-2 text-sm text-[#8A8F98]">Examples: HTTP JSON, Syslog, Vector.</p>
            <Link to="/settings/sources" className="mt-4 inline-flex rounded-md bg-[#5E6AD2] px-3 py-2 text-sm text-white">
              Add Source
            </Link>
          </section>
          <section className="rounded-lg border border-[#2A2A2A] bg-[#151515] p-4">
            <h2 className="text-sm font-medium">Integrations</h2>
            <p className="mt-2 text-sm text-[#8A8F98]">Examples: NextDNS, Cloudflare, Tailscale.</p>
            <Link to="/settings/integrations" className="mt-4 inline-flex rounded-md border border-[#2A2A2A] px-3 py-2 text-sm">
              Add Integration
            </Link>
          </section>
        </div>
      </div>
    </RequireAuth>
  );
}
