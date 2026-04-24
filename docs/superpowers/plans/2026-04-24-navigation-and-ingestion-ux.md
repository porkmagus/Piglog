# Navigation And Ingestion UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up the workspace shell so the sidebar, settings, account entry, and ingestion entry points match the approved product model.

**Architecture:** Keep the current React Router app structure, but simplify the sidebar semantics and add an `Ingestion` landing page under Settings. This phase intentionally does not add vendor integrations yet; it creates the UI and routing structure they will live in.

**Tech Stack:** React 19, React Router 7, TypeScript, Tailwind CSS, Vitest, Testing Library

---

## File Structure

### Existing files to modify

- `apps/web/package.json`
  - add test dependencies and scripts for the web app
- `apps/web/app/root.tsx`
  - keep provider composition stable while routing and settings views change
- `apps/web/app/routes.ts`
  - add Account Settings and Ingestion routes
- `apps/web/app/routes/_layout.tsx`
  - fix the top sidebar workspace control and bottom-left account entry
- `apps/web/app/routes/_layout.dashboard.tsx`
  - add dashboard quick actions for source and integration setup
- `apps/web/app/routes/_layout.settings.tsx`
  - replace the misleading `API Keys` nav item with `Ingestion`
- `apps/web/app/routes/_layout.settings.sources.tsx`
  - make Sources fit under the new Ingestion concept and keep source key handling here

### New files to create

- `apps/web/vitest.config.ts`
  - Vitest config for the web workspace
- `apps/web/app/test/setup.ts`
  - jsdom and Testing Library setup
- `apps/web/app/test/render.tsx`
  - shared render helper with providers
- `apps/web/app/routes/_layout.settings.account.tsx`
  - new Account Settings page
- `apps/web/app/routes/_layout.settings.ingestion.tsx`
  - new Ingestion landing page with Sources vs Integrations explainer
- `apps/web/app/routes/_layout.settings.ingestion.test.tsx`
  - route-level tests for the new Ingestion page
- `apps/web/app/routes/_layout.test.tsx`
  - sidebar/account navigation tests
- `apps/web/app/routes/_layout.dashboard.test.tsx`
  - dashboard quick-action tests

## Task 1: Add A Real Web Test Harness

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/app/test/setup.ts`
- Create: `apps/web/app/test/render.tsx`

- [ ] **Step 1: Write the failing config test by adding a no-op route test file**

```tsx
// apps/web/app/routes/_layout.test.tsx
import { describe, expect, it } from 'vitest';

describe('web test harness', () => {
  it('runs a basic assertion', () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails because Vitest is not configured**

Run: `npm --workspace @piglog/web exec vitest run apps/web/app/routes/_layout.test.tsx`

Expected: FAIL with a command-not-found or missing config/dependency error.

- [ ] **Step 3: Add the minimal test infrastructure**

```json
// apps/web/package.json
{
  "scripts": {
    "dev": "react-router dev",
    "build": "react-router build",
    "start": "react-router-serve ./build/server/index.js",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "jsdom": "^26.1.0",
    "vitest": "^3.2.4"
  }
}
```

```ts
// apps/web/vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./app/test/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './app'),
    },
  },
});
```

```ts
// apps/web/app/test/setup.ts
import '@testing-library/jest-dom/vitest';
```

```tsx
// apps/web/app/test/render.tsx
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';

export function renderRoute(ui: ReactElement) {
  return render(ui);
}
```

- [ ] **Step 4: Run test to verify the harness passes**

Run: `npm install && npm --workspace @piglog/web run test -- apps/web/app/routes/_layout.test.tsx`

Expected: PASS with `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/vitest.config.ts apps/web/app/test/setup.ts apps/web/app/test/render.tsx apps/web/app/routes/_layout.test.tsx package-lock.json
git commit -m "test: add web vitest harness"
```

## Task 2: Fix Sidebar Semantics And Add Account Settings Navigation

**Files:**
- Modify: `apps/web/app/routes.ts`
- Modify: `apps/web/app/routes/_layout.tsx`
- Create: `apps/web/app/routes/_layout.settings.account.tsx`
- Test: `apps/web/app/routes/_layout.test.tsx`

- [ ] **Step 1: Write the failing sidebar tests**

```tsx
// apps/web/app/routes/_layout.test.tsx
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';
import AppLayout from './_layout';
import { renderRoute } from '../test/render';

describe('AppLayout', () => {
  it('shows a workspace switcher without a fake chevron-only action', () => {
    renderRoute(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    );

    expect(screen.getByText('Piglog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /workspace/i })).toBeInTheDocument();
  });

  it('renders the user account area as a link to account settings', () => {
    renderRoute(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /account settings/i })).toHaveAttribute('href', '/settings/account');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm --workspace @piglog/web run test -- apps/web/app/routes/_layout.test.tsx`

Expected: FAIL because the current layout has no account settings route and the workspace control semantics do not match.

- [ ] **Step 3: Add the route and minimal page**

```ts
// apps/web/app/routes.ts
layout("routes/_layout.tsx", [
  route("dashboard", "routes/_layout.dashboard.tsx"),
  route("settings", "routes/_layout.settings.tsx", [
    index("routes/_layout.settings._index.tsx"),
    route("account", "routes/_layout.settings.account.tsx"),
    route("workspace", "routes/_layout.settings.workspace.tsx"),
    route("ingestion", "routes/_layout.settings.ingestion.tsx"),
    route("sources", "routes/_layout.settings.sources.tsx"),
    route("alerts", "routes/_layout.settings.alerts.tsx"),
    route("team", "routes/_layout.settings.team.tsx"),
  ]),
  route("streams", "routes/_layout.streams._index.tsx"),
  route("streams/:streamId", "routes/_layout.streams.$streamId.tsx"),
]),
```

```tsx
// apps/web/app/routes/_layout.settings.account.tsx
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
```

- [ ] **Step 4: Update the sidebar layout**

```tsx
// apps/web/app/routes/_layout.tsx
<div className="px-3 py-2 border-b border-[#2A2A2A]">
  <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-[#8A8F98]">
    Workspace
  </div>
  <button
    type="button"
    onClick={() => setShowWorkspaceMenu((value) => !value)}
    aria-label="Workspace switcher"
    className="mt-1 flex items-center justify-between w-full px-2 py-1.5 rounded-md text-sm hover:bg-[#151515] transition-colors"
  >
    <span className="truncate font-medium">{activeWorkspace?.name || 'No workspace selected'}</span>
    <ChevronDown className="w-3.5 h-3.5 text-[#8A8F98]" />
  </button>
</div>

<Link
  to="/settings/account"
  aria-label="Account settings"
  className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-[#151515]"
>
  <span className="text-sm truncate">{user?.email}</span>
  <Settings className="w-4 h-4 text-[#8A8F98]" />
</Link>
```

- [ ] **Step 5: Run the tests and typecheck**

Run: `npm --workspace @piglog/web run test -- apps/web/app/routes/_layout.test.tsx && npm --workspace @piglog/web run typecheck`

Expected: PASS, then no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/routes.ts apps/web/app/routes/_layout.tsx apps/web/app/routes/_layout.settings.account.tsx apps/web/app/routes/_layout.test.tsx
git commit -m "feat: add account settings and clean sidebar semantics"
```

## Task 3: Replace Dead API Keys Navigation With Ingestion

**Files:**
- Modify: `apps/web/app/routes/_layout.settings.tsx`
- Create: `apps/web/app/routes/_layout.settings.ingestion.tsx`
- Test: `apps/web/app/routes/_layout.settings.ingestion.test.tsx`

- [ ] **Step 1: Write the failing ingestion page tests**

```tsx
// apps/web/app/routes/_layout.settings.ingestion.test.tsx
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import IngestionPage from './_layout.settings.ingestion';
import { renderRoute } from '../test/render';

describe('IngestionPage', () => {
  it('explains the difference between sources and integrations', () => {
    renderRoute(<IngestionPage />);

    expect(screen.getByText(/systems that send logs to piglog/i)).toBeInTheDocument();
    expect(screen.getByText(/services piglog connects to and syncs from/i)).toBeInTheDocument();
  });

  it('renders add source and add integration actions', () => {
    renderRoute(<IngestionPage />);

    expect(screen.getByRole('link', { name: /add source/i })).toHaveAttribute('href', '/settings/sources');
    expect(screen.getByRole('link', { name: /add integration/i })).toHaveAttribute('href', '/settings/integrations');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm --workspace @piglog/web run test -- apps/web/app/routes/_layout.settings.ingestion.test.tsx`

Expected: FAIL because the route and page do not exist yet.

- [ ] **Step 3: Replace the settings nav item and create the ingestion page**

```tsx
// apps/web/app/routes/_layout.settings.tsx
const navItems = [
  { to: '/settings/account', label: 'Account', icon: UserCircle2 },
  { to: '/settings/workspace', label: 'Workspace', icon: Settings },
  { to: '/settings/ingestion', label: 'Ingestion', icon: Inbox },
  { to: '/settings/alerts', label: 'Alerts', icon: Bell },
  { to: '/settings/team', label: 'Team', icon: Users },
];
```

```tsx
// apps/web/app/routes/_layout.settings.ingestion.tsx
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
```

- [ ] **Step 4: Run tests to verify the page behavior and settings nav**

Run: `npm --workspace @piglog/web run test -- apps/web/app/routes/_layout.settings.ingestion.test.tsx`

Expected: PASS with both assertions green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/routes/_layout.settings.tsx apps/web/app/routes/_layout.settings.ingestion.tsx apps/web/app/routes/_layout.settings.ingestion.test.tsx
git commit -m "feat: add ingestion settings landing page"
```

## Task 4: Add Placeholder Integrations Route And Update Sources Copy

**Files:**
- Modify: `apps/web/app/routes.ts`
- Create: `apps/web/app/routes/_layout.settings.integrations.tsx`
- Modify: `apps/web/app/routes/_layout.settings.sources.tsx`

- [ ] **Step 1: Write the failing route smoke test**

```tsx
// apps/web/app/routes/_layout.settings.ingestion.test.tsx
it('links to an integrations page', () => {
  renderRoute(<IngestionPage />);
  expect(screen.getByRole('link', { name: /add integration/i })).toHaveAttribute('href', '/settings/integrations');
});
```

- [ ] **Step 2: Run the test and confirm it fails if the route is missing**

Run: `npm --workspace @piglog/web run test -- apps/web/app/routes/_layout.settings.ingestion.test.tsx`

Expected: FAIL once the link target is unresolved in the route tree.

- [ ] **Step 3: Add the placeholder route and adjust Sources copy**

```ts
// apps/web/app/routes.ts
route("settings", "routes/_layout.settings.tsx", [
  index("routes/_layout.settings._index.tsx"),
  route("account", "routes/_layout.settings.account.tsx"),
  route("workspace", "routes/_layout.settings.workspace.tsx"),
  route("ingestion", "routes/_layout.settings.ingestion.tsx"),
  route("sources", "routes/_layout.settings.sources.tsx"),
  route("integrations", "routes/_layout.settings.integrations.tsx"),
  route("alerts", "routes/_layout.settings.alerts.tsx"),
  route("team", "routes/_layout.settings.team.tsx"),
]),
```

```tsx
// apps/web/app/routes/_layout.settings.integrations.tsx
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
```

```tsx
// apps/web/app/routes/_layout.settings.sources.tsx
<p className="text-sm text-[#8A8F98]">Sources are push-style ingestion endpoints such as HTTP JSON, Syslog, Vector, and Filebeat.</p>
```

- [ ] **Step 4: Run the relevant tests and build**

Run: `npm --workspace @piglog/web run test -- apps/web/app/routes/_layout.settings.ingestion.test.tsx && npm --workspace @piglog/web run build`

Expected: PASS, then a successful production build.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/routes.ts apps/web/app/routes/_layout.settings.integrations.tsx apps/web/app/routes/_layout.settings.sources.tsx
git commit -m "feat: add integrations route scaffold"
```

## Task 5: Add Dashboard Quick Actions For Source And Integration Setup

**Files:**
- Modify: `apps/web/app/routes/_layout.dashboard.tsx`
- Test: `apps/web/app/routes/_layout.dashboard.test.tsx`

- [ ] **Step 1: Write the failing dashboard test**

```tsx
// apps/web/app/routes/_layout.dashboard.test.tsx
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DashboardPage from './_layout.dashboard';
import { renderRoute } from '../test/render';

describe('DashboardPage empty state', () => {
  it('offers add source and add integration actions', () => {
    renderRoute(<DashboardPage />);

    expect(screen.getByRole('button', { name: /add source/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add integration/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the dashboard test and verify it fails**

Run: `npm --workspace @piglog/web run test -- apps/web/app/routes/_layout.dashboard.test.tsx`

Expected: FAIL because the current empty state only exposes source-related navigation.

- [ ] **Step 3: Update the empty state UI**

```tsx
// apps/web/app/routes/_layout.dashboard.tsx
<div className="rounded-lg border border-[#2A2A2A] bg-[#151515] p-8 text-center">
  <p className="text-sm text-[#8A8F98]">No log data in the last 24 hours.</p>
  <div className="mt-4 flex items-center justify-center gap-3">
    <button
      onClick={() => navigate('/settings/sources')}
      className="rounded-md bg-[#5E6AD2] px-3 py-2 text-sm font-medium text-white"
    >
      Add Source
    </button>
    <button
      onClick={() => navigate('/settings/integrations')}
      className="rounded-md border border-[#2A2A2A] px-3 py-2 text-sm font-medium text-gray-200"
    >
      Add Integration
    </button>
  </div>
</div>
```

- [ ] **Step 4: Run the dashboard test and a full web verification pass**

Run: `npm --workspace @piglog/web run test -- apps/web/app/routes/_layout.dashboard.test.tsx && npm --workspace @piglog/web run typecheck && npm --workspace @piglog/web run build`

Expected: PASS, no type errors, successful build.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/routes/_layout.dashboard.tsx apps/web/app/routes/_layout.dashboard.test.tsx
git commit -m "feat: add dashboard ingestion quick actions"
```

## Task 6: Final Verification

**Files:**
- Modify: none
- Test: route and build checks only

- [ ] **Step 1: Run the full web test suite**

Run: `npm --workspace @piglog/web run test`

Expected: PASS across sidebar, ingestion, and dashboard tests.

- [ ] **Step 2: Run production verification**

Run: `npm --workspace @piglog/web run typecheck && npm --workspace @piglog/web run build`

Expected: PASS, no TypeScript errors, successful production build.

- [ ] **Step 3: Commit the verification checkpoint**

```bash
git add -A
git commit -m "chore: verify navigation and ingestion ux changes"
```
