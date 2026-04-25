import { Link } from 'react-router';
import {
  Activity,
  Zap,
  Shield,
  Terminal,
  ArrowRight,
  Radio,
  Clock,
  Bell,
  Database,
  FileUp,
  Wifi,
  Server,
} from 'lucide-react';

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-[#2A2A2A] bg-[#111111] p-5 transition-colors hover:border-[#F09040]/30">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-[#F09040]/10">
        <Icon className="h-4.5 w-4.5 text-[#F09040]" />
      </div>
      <h3 className="mb-1 text-sm font-medium text-gray-200">{title}</h3>
      <p className="text-sm leading-relaxed text-[#8A8F98]">{description}</p>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0D0D0D] text-gray-100">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[#2A2A2A]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#F09040]" />
          <span className="font-semibold text-sm tracking-tight">Piglog</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="text-sm text-[#8A8F98] hover:text-gray-200 transition-colors"
          >
            Sign in
          </Link>
          <Link
            to="/login"
            className="rounded-md bg-[#F09040] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#D87830] transition-colors"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-20 pb-16 text-center">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#2A2A2A] bg-[#111111] px-3 py-1 text-xs text-[#8A8F98]">
            <Zap className="h-3 w-3 text-[#F09040]" />
            Built on TimescaleDB for serious throughput
          </div>
          <h1 className="mb-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            Log aggregation for{' '}
            <span className="text-[#F09040]">hackers</span>
          </h1>
          <p className="mb-8 text-lg text-[#8A8F98] leading-relaxed">
            Ingest from HTTP, Syslog, or file uploads. Query with token-based
            search. Get alerted on spikes. No enterprise bloat — just logs done
            right.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-md bg-[#F09040] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#D87830] transition-colors"
            >
              Start logging free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="https://github.com/porkmagus/piglog"
              className="inline-flex items-center gap-2 rounded-md border border-[#2A2A2A] bg-[#111111] px-5 py-2.5 text-sm font-medium text-gray-300 hover:bg-[#151515] transition-colors"
            >
              <Terminal className="h-4 w-4" />
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Ingestion methods */}
      <section className="border-y border-[#2A2A2A] bg-[#0A0A0A] px-6 py-12">
        <div className="mx-auto max-w-4xl">
          <p className="mb-8 text-center text-xs font-medium uppercase tracking-wider text-[#8A8F98]">
            Ingest from anywhere
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-lg border border-[#2A2A2A] bg-[#111111] px-4 py-3">
              <Wifi className="h-5 w-5 text-[#F09040]" />
              <div>
                <div className="text-sm font-medium">HTTP API</div>
                <div className="text-xs text-[#8A8F98]">
                  POST JSON batches with your API key
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-[#2A2A2A] bg-[#111111] px-4 py-3">
              <Server className="h-5 w-5 text-[#F09040]" />
              <div>
                <div className="text-sm font-medium">Syslog</div>
                <div className="text-xs text-[#8A8F98]">
                  UDP/TCP syslog endpoint per source
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-[#2A2A2A] bg-[#111111] px-4 py-3">
              <FileUp className="h-5 w-5 text-[#F09040]" />
              <div>
                <div className="text-sm font-medium">File Upload</div>
                <div className="text-xs text-[#8A8F98]">
                  Drop NDJSON or log files up to 50MB
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-2 text-center text-xl font-semibold">
            Everything you need, nothing you don't
          </h2>
          <p className="mb-10 text-center text-sm text-[#8A8F98]">
            A focused tool for people who actually read logs.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={Radio}
              title="Live Tail"
              description="SSE stream of incoming logs in real-time. Filter by service, level, or source as they arrive."
            />
            <FeatureCard
              icon={Terminal}
              title="Token Search"
              description="service:api level:error host:prod-01 — compose filters fast without clicking through dropdowns."
            />
            <FeatureCard
              icon={Bell}
              title="Alert Rules"
              description="Trigger on log volume thresholds over sliding windows. Webhook notifications to Slack, PagerDuty, or any URL."
            />
            <FeatureCard
              icon={Database}
              title="TimescaleDB Hypertables"
              description="Automatic time-based partitioning, 7-day compression, 90-day retention. Handles high cardinality without sweat."
            />
            <FeatureCard
              icon={Clock}
              title="Continuous Aggregates"
              description="Pre-rolled 1-minute buckets for dashboards and sparklines. Instant load times for historical overviews."
            />
            <FeatureCard
              icon={Shield}
              title="Workspace Isolation"
              description="Multi-tenant by design. Teams, roles, and API keys scoped per workspace. Invite links with configurable roles."
            />
          </div>
        </div>
      </section>

      {/* Code snippet */}
      <section className="border-y border-[#2A2A2A] bg-[#0A0A0A] px-6 py-12">
        <div className="mx-auto max-w-2xl">
          <p className="mb-4 text-center text-xs font-medium uppercase tracking-wider text-[#8A8F98]">
            Ingest in seconds
          </p>
          <div className="overflow-x-auto rounded-lg border border-[#2A2A2A] bg-[#111111]">
            <pre className="p-4 text-sm text-[#8A8F98]">
              <code>
                <span className="text-[#F09040]">curl</span>{' '}
                <span className="text-gray-400">-X POST</span>{' '}
                <span className="text-gray-300">
                  https://api.piglog.dev/ingest
                </span>{' '}
                {'\n'}
                {'  '}<span className="text-gray-400">-H</span>{' '}
                <span className="text-green-400/80">
                  "X-API-Key: pl_xxxxxxxx"
                </span>{' '}
                {'\n'}
                {'  '}<span className="text-gray-400">-H</span>{' '}
                <span className="text-green-400/80">
                  "Content-Type: application/json"
                </span>{' '}
                {'\n'}
                {'  '}<span className="text-gray-400">-d</span>{' '}
                <span className="text-gray-300">{`'{\n    "logs": [{\n      "service": "api",\n      "level": "ERROR",\n      "message": "Connection refused to db:5432"\n    }]\n  }'`}</span>
              </code>
            </pre>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="px-6 py-16 text-center">
        <div className="mx-auto max-w-xl">
          <h2 className="mb-3 text-2xl font-semibold">
            Stop grep-ing through files
          </h2>
          <p className="mb-6 text-sm text-[#8A8F98]">
            Piglog is free for solo developers. No credit card required.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-md bg-[#F09040] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#D87830] transition-colors"
          >
            Create your workspace
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#2A2A2A] px-6 py-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#F09040]" />
            <span className="text-xs text-[#8A8F98]">Piglog</span>
          </div>
          <span className="text-xs text-[#8A8F98]">
            Built for hackers. Free first, monetize later.
          </span>
        </div>
      </footer>
    </div>
  );
}
