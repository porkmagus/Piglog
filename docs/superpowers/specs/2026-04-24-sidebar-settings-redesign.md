# Sidebar & Settings Redesign

## Date
2026-04-24

## Status
Approved

## Problem

The current sidebar and settings navigation has several issues:

1. **Workspace dropdown is dead UI** — always shows a single workspace with no way to create more, making the dropdown affordance misleading
2. **Settings mixes account and workspace concerns** — Account settings (email, password) are account-level but live inside workspace-scoped settings
3. **Ingestion/Sources/Integrations are flat** — Ingestion is a concept page explaining the model, but Sources and Integrations sit at the same level instead of being nested under it
4. **Team page is non-functional** — references invite codes and roles but has no UI for the invite code, no member list, no role management
5. **Too many settings items** — 7 sub-nav items for a product that's still finding product-market fit

## Constraints

- Workspace-scoped design is core to Piglog — logs, sources, alerts belong to a workspace
- Account-level settings (email, password) are separate from workspace concerns
- The invite code system exists in the DB (`workspace.inviteCode`) with a join endpoint, but has no UI
- Team roles (OWNER/ADMIN/MEMBER/GUEST) exist in the DB but have no UI for management

## Design

### Sidebar Structure

```
┌─────────────────────┐
│ 🐖 piglog 🐖...     │ ← Glitch marquee branding
├─────────────────────┤
│                     │
│  Dashboard          │ ← Workspace: see log overview
│  Streams            │ ← Workspace: browse log streams
│  ▼ Ingestion        │ ← Expandable section
│    Sources          │ ←   HTTP/Syslog/Splunk sources
│    Integrations     │ ←   Vendor connections (NextDNS)
│  Settings           │ ← Opens settings page with sub-nav
│                     │
├─────────────────────┤
│  demo@piglog ⚙ →    │ ← Click → Account Settings (email, password)
└─────────────────────┘
```

### What Changed

| Before | After |
|--------|-------|
| Workspace dropdown (always 1 item) | Removed |
| Settings → Account | Moved to bottom user area only |
| Settings → Workspace | Kept in settings sub-nav |
| Settings → Ingestion | Moved to sidebar as expandable section |
| Settings → Sources | Nested under Ingestion in sidebar |
| Settings → Integrations | Nested under Ingestion in sidebar |
| Settings → Alerts | Kept in settings sub-nav |
| Settings → Team | Removed (non-functional) |

### Ingestion Sidebar Section

- Default state: collapsed, shows "Ingestion" with right-pointing chevron
- Expanded state: chevron points down, "Sources" and "Integrations" appear indented below
- State persisted in localStorage key `sidebar-ingestion-expanded`
- Clicking "Ingestion" toggles; clicking "Sources" or "Integrations" navigates

### Settings Page Sub-Nav

Trimmed to 2 items:
- **Workspace** — name edit, invite code + copy, members list, delete
- **Alerts** — alert rules (existing)

### Workspace Settings Page

Gets new content:
- **Name** — editable text input with save
- **Invite Code** — monospace display with copy button, tooltip "Share this code to invite others"
- **Members** — simple list showing email + role from `workspaceMember` table
- **Delete Workspace** — existing destructive action (unchanged)

### Account Settings

No changes to the page itself. Only the navigation path changes:
- Was: Sidebar → Settings → Account
- Now: Sidebar bottom → click username/gear → Account Settings

## Files Affected

- `apps/web/app/routes/_layout.tsx` — sidebar structure, Ingestion expandable section, remove workspace dropdown
- `apps/web/app/routes/_layout.settings.tsx` — trim sub-nav to Workspace + Alerts
- `apps/web/app/routes/_layout.settings.workspace.tsx` — add invite code display, members list
- `apps/web/app/routes/_layout.settings.sources.tsx` — no changes (already exists)
- `apps/web/app/routes/_layout.settings.integrations.tsx` — no changes (already exists)
- `apps/web/app/routes/_layout.settings.alerts.tsx` — no changes (already exists)
- `apps/web/app/routes/_layout.settings.account.tsx` — no changes (already exists)
- `apps/web/app/routes/_layout.settings.team.tsx` — delete
- `apps/api/src/modules/workspaces/workspaces.routes.ts` — add GET members endpoint

## Out of Scope

- Role-based access control enforcement (roles exist in DB but aren't enforced anywhere)
- Team management UI beyond a simple members list
- Email-based invitations (invite code is shared manually)
- Workspace creation after onboarding
