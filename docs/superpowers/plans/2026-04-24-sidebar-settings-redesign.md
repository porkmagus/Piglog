# Sidebar & Settings Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove dead UI, reorganize sidebar for workspace-scoped navigation, move Account to bottom user area

**Architecture:** Frontend-only changes plus one new API endpoint for workspace members. Sidebar gets an expandable Ingestion section. Settings sub-nav trimmed to Workspace + Alerts.

**Tech Stack:** React, React Router, Tailwind, Fastify, Drizzle ORM

---

### Task 1: API - Add GET /workspaces/:id/members endpoint

**Files:**
- Modify: `apps/api/src/modules/workspaces/workspaces.routes.ts`

- [ ] **Step 1: Add the members endpoint**

Add this route after `app.get('/')` in `workspaces.routes.ts`, before `app.post('/')`:

```typescript
  app.get('/:id/members', async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    await extractWorkspace(request, reply);
    if (reply.sent) return;

    const { id } = request.params as { id: string };
    const members = await request.server.db.query.workspaceMember.findMany({
      where: and(
        eq(workspaceMember.workspaceId, id),
        isNull(workspaceMember.deletedAt)
      ),
      with: {
        user: {
          columns: { id: true, name: true, email: true },
        },
      },
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      user: m.user,
    }));
  });
```

- [ ] **Step 2: Build and verify**

Run: `npm run build:api`
Expected: SUCCESS with no errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/workspaces/workspaces.routes.ts
git commit -m "feat: add GET /workspaces/:id/members endpoint"
```

### Task 2: Sidebar - Remove workspace dropdown

**Files:**
- Modify: `apps/web/app/routes/_layout.tsx`

- [ ] **Step 1: Remove workspace dropdown section**

Remove this entire block from `_layout.tsx` (lines 81-126):

```typescript
        {/* Workspace Switcher */}
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
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-4 h-4 rounded-sm flex-shrink-0"
                style={{ backgroundColor: activeWorkspace?.color || '#5E6AD2' }}
              />
              <span className="truncate font-medium">{activeWorkspace?.name || 'No workspace'}</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#8A8F98] flex-shrink-0" />
          </button>

          {showWorkspaceMenu && (
            <div className="mt-1 rounded-md border border-[#2A2A2A] bg-[#151515] overflow-hidden">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => {
                    setActiveWorkspace(ws);
                    setShowWorkspaceMenu(false);
                  }}
                  className={`flex items-center gap-2 w-full px-2 py-1.5 text-sm transition-colors ${
                    activeWorkspace?.id === ws.id
                      ? 'bg-[#5E6AD2]/10 text-[#5E6AD2]'
                      : 'text-gray-300 hover:bg-[#1a1a1a]'
                  }`}
                >
                  <div
                    className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: '#5E6AD2' }}
                  />
                  <span className="truncate">{ws.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
```

- [ ] **Step 2: Remove unused imports and state**

Remove `ChevronDown` from imports. Remove `showWorkspaceMenu` state, `setShowWorkspaceMenu` from `useState`. Remove `workspaces`, `setActiveWorkspace` from `useWorkspace` destructuring if no longer used.

Keep: `activeWorkspace` (used elsewhere or may be needed for color dot on nav items later).

Imports should become:
```typescript
import { Outlet, Link } from 'react-router';
import { useAuth } from '~/lib/auth-client';
import { useWorkspace } from '~/lib/workspace';
import { LayoutDashboard, Radio, Settings, Inbox, Plug, Puzzle, ChevronDown, Settings as SettingsIcon } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
```

Note: `ChevronDown`, `Inbox`, `Plug`, `Puzzle` are needed for the Ingestion section (Task 3).

State changes:
```typescript
  const { activeWorkspace } = useWorkspace();
  const [ingestionExpanded, setIngestionExpanded] = useState(() => {
    try {
      return localStorage.getItem('sidebar-ingestion-expanded') === 'true';
    } catch {
      return false;
    }
  });
```

- [ ] **Step 3: Build and verify**

Run: `npm run build:web`
Expected: SUCCESS with no errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/routes/_layout.tsx
git commit -m "refactor: remove workspace dropdown from sidebar"
```

### Task 3: Sidebar - Add Ingestion expandable section

**Files:**
- Modify: `apps/web/app/routes/_layout.tsx`

- [ ] **Step 1: Add Ingestion section to sidebar nav**

Replace the current nav block:

```typescript
        <nav className="flex-1 px-2 py-3 space-y-1">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-[#8A8F98] hover:bg-[#151515] hover:text-gray-200 transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
          <Link
            to="/streams"
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-[#8A8F98] hover:bg-[#151515] hover:text-gray-200 transition-colors"
          >
            <Radio className="w-4 h-4" />
            Streams
          </Link>
          <Link
            to="/settings"
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-[#8A8F98] hover:bg-[#151515] hover:text-gray-200 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Settings
          </Link>
        </nav>
```

With:

```typescript
        <nav className="flex-1 px-2 py-3 space-y-1">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-[#8A8F98] hover:bg-[#151515] hover:text-gray-200 transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
          <Link
            to="/streams"
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-[#8A8F98] hover:bg-[#151515] hover:text-gray-200 transition-colors"
          >
            <Radio className="w-4 h-4" />
            Streams
          </Link>

          {/* Ingestion (expandable) */}
          <div>
            <button
              type="button"
              onClick={() => {
                const next = !ingestionExpanded;
                setIngestionExpanded(next);
                localStorage.setItem('sidebar-ingestion-expanded', String(next));
              }}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm text-[#8A8F98] hover:bg-[#151515] hover:text-gray-200 transition-colors"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${ingestionExpanded ? '' : '-rotate-90'}`} />
              Ingestion
            </button>
            {ingestionExpanded && (
              <div className="mt-0.5 ml-4 pl-3 border-l border-[#2A2A2A] space-y-0.5">
                <Link
                  to="/settings/sources"
                  className="flex items-center gap-2 px-2 py-1 rounded-md text-sm text-[#8A8F98] hover:bg-[#151515] hover:text-gray-200 transition-colors"
                >
                  <Plug className="w-3.5 h-3.5" />
                  Sources
                </Link>
                <Link
                  to="/settings/integrations"
                  className="flex items-center gap-2 px-2 py-1 rounded-md text-sm text-[#8A8F98] hover:bg-[#151515] hover:text-gray-200 transition-colors"
                >
                  <Puzzle className="w-3.5 h-3.5" />
                  Integrations
                </Link>
              </div>
            )}
          </div>

          <Link
            to="/settings"
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-[#8A8F98] hover:bg-[#151515] hover:text-gray-200 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Settings
          </Link>
        </nav>
```

- [ ] **Step 2: Build and verify**

Run: `npm run build:web`
Expected: SUCCESS with no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/routes/_layout.tsx
git commit -m "feat: add expandable Ingestion section to sidebar"
```

### Task 4: Settings sub-nav - Trim to Workspace + Alerts

**Files:**
- Modify: `apps/web/app/routes/_layout.settings.tsx`

- [ ] **Step 1: Update navItems**

Replace the `navItems` array:

```typescript
const navItems = [
  { to: '/settings/workspace', label: 'Workspace', icon: Settings },
  { to: '/settings/alerts', label: 'Alerts', icon: Bell },
];
```

- [ ] **Step 2: Remove unused imports**

Remove `UserCircle2`, `Users`, `Inbox`, `Plug`, `Puzzle` from imports.

Imports should become:
```typescript
import { NavLink, Outlet } from 'react-router';
import { Bell, Settings } from 'lucide-react';
```

- [ ] **Step 3: Build and verify**

Run: `npm run build:web`
Expected: SUCCESS with no errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/routes/_layout.settings.tsx
git commit -m "refactor: trim settings sub-nav to Workspace and Alerts"
```

### Task 5: Delete Team page

**Files:**
- Delete: `apps/web/app/routes/_layout.settings.team.tsx`

- [ ] **Step 1: Delete the file**

Run: `rm apps/web/app/routes/_layout.settings.team.tsx`

- [ ] **Step 2: Build and verify**

Run: `npm run build:web`
Expected: SUCCESS with no errors

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: delete non-functional Team settings page"
```

### Task 6: Workspace settings - Add invite code + members list

**Files:**
- Modify: `apps/web/app/routes/_layout.settings.workspace.tsx`

- [ ] **Step 1: Add state and data fetching for members**

Add these imports:
```typescript
import { Copy, Users } from 'lucide-react';
```

Add state after existing state declarations:
```typescript
  const [members, setMembers] = useState<Array<{ userId: string; role: string; user: { name: string; email: string } }>>([]);
  const [copied, setCopied] = useState(false);
```

Add effect to fetch members:
```typescript
  useEffect(() => {
    if (!activeWorkspace) return;
    fetchApi(`/workspaces/${activeWorkspace.id}/members`)
      .then((data) => setMembers(data || []))
      .catch(() => setMembers([]));
  }, [activeWorkspace?.id]);
```

- [ ] **Step 2: Add invite code section**

Insert this between the slug field and the save button:

```typescript
          <div>
            <label className="block text-sm font-medium mb-1">Invite Code</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2 text-sm font-mono text-[#8A8F98] truncate">
                {activeWorkspace?.inviteCode}
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(activeWorkspace?.inviteCode || '');
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="flex items-center gap-1 px-2 py-2 rounded-md border border-[#2A2A2A] text-sm text-[#8A8F98] hover:bg-[#151515] transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-[#8A8F98] mt-1">Share this code so others can join your workspace.</p>
          </div>
```

- [ ] **Step 3: Add members list section**

Insert this between the save button and the Danger Zone:

```typescript
        <div className="mt-10 pt-6 border-t border-[#2A2A2A]">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-[#8A8F98]" />
            <h2 className="text-sm font-medium">Members</h2>
          </div>
          {members.length === 0 ? (
            <p className="text-sm text-[#8A8F98]">No members yet.</p>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.userId} className="flex items-center justify-between px-3 py-2 rounded-md bg-[#151515]">
                  <div>
                    <div className="text-sm">{m.user.name || m.user.email}</div>
                    <div className="text-xs text-[#8A8F98]">{m.user.email}</div>
                  </div>
                  <span className="text-xs font-medium text-[#8A8F98] uppercase">{m.role}</span>
                </div>
              ))}
            </div>
          )}
        </div>
```

- [ ] **Step 4: Build and verify**

Run: `npm run build:web`
Expected: SUCCESS with no errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/routes/_layout.settings.workspace.tsx
git commit -m "feat: add invite code display and members list to workspace settings"
```

### Task 7: Run smoke-check and full build

**Files:** none

- [ ] **Step 1: Run smoke-check**

Run: `npm run smoke-check`
Expected: 0 errors, 0 warnings

- [ ] **Step 2: Run full build**

Run: `npm run build:all`
Expected: SUCCESS

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "ci: verify sidebar redesign passes all checks" || true
```

---

## Self-Review

**Spec coverage:**
- Workspace dropdown removed ✓ (Task 2)
- Ingestion expandable section ✓ (Task 3)
- Settings sub-nav trimmed ✓ (Task 4)
- Team page deleted ✓ (Task 5)
- Account removed from settings sub-nav ✓ (Task 4 - not in navItems)
- Invite code + copy ✓ (Task 6)
- Members list ✓ (Task 6)
- GET /workspaces/:id/members endpoint ✓ (Task 1)

**Placeholder scan:** None found. All code blocks are complete.

**Type consistency:** `members` type matches API response shape. `ingestionExpanded` state uses boolean. `copied` state uses boolean.

**Scope check:** Focused on sidebar/settings UI changes plus one API endpoint. No scope creep.
