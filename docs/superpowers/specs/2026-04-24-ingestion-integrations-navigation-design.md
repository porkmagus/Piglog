# Piglog Ingestion, Integrations, and Navigation Design

## Summary

This design introduces a clearer product model for Piglog by separating push-style ingestion from pull-style vendor connections without splitting the underlying log pipeline. The user-facing product will distinguish `Sources` from `Integrations`, while the backend will continue to ingest everything through the existing source-oriented pipeline.

The design also cleans up two immediate UX problems:

- the sidebar workspace area currently implies collapse behavior that does not exist
- the bottom-left user account area looks interactive but has no account settings destination

The result should feel more intentional and easier to understand for both new users and future integration work.

## Goals

- Make ingestion concepts understandable to users without requiring infrastructure knowledge
- Keep the internal ingestion pipeline unified
- Add a first-class home for pull-based vendor integrations such as NextDNS
- Preserve clean code organization as integrations grow
- Remove misleading or dead UI affordances in navigation and settings
- Keep the dashboard useful as an onboarding surface with direct ingestion actions

## Non-Goals

- Building a large marketplace of third-party connectors in v1
- Implementing org-level or shared integrations in v1
- Reworking the dashboard layout system itself
- Designing a full credentials vault or enterprise secret-management model
- Shipping user personal access tokens in this phase

## Product Model

### Sources

`Sources` are push-style ingestion endpoints or agents. They represent ways external systems send logs into Piglog.

Examples:

- HTTP JSON
- Syslog
- Vector
- Filebeat
- SNMP trap

Users should think of Sources as transport-oriented ingestion methods.

### Integrations

`Integrations` are pull-style or vendor-aware connections where Piglog connects outward, syncs data, and converts it into logs.

Examples:

- NextDNS
- future vendor connectors such as Cloudflare or Tailscale

Users should think of Integrations as “connect this service to Piglog.”

### Internal Relationship Between Sources and Integrations

Integrations are first-class in the UI and data model, but they should ingest through sources under the hood.

That means:

- a workspace owns one or more integrations
- an integration may discover child entities from the vendor
- each selected child entity can create one hidden internal source
- logs from those sources flow through the existing log ingestion, querying, live tail, and analytics systems

This avoids forking the ingestion pipeline while keeping the product UX clean.

## Navigation Design

### Sidebar

The main sidebar remains workspace-focused and simple:

- Dashboard
- Streams
- Settings

At the top of the sidebar:

- `Piglog` remains the static application brand
- beneath it is a real workspace switcher

The workspace switcher must only switch workspaces. It should not imply nav collapse behavior and should not present a fake expandable control if the only content is the current workspace.

### User Account Entry

The bottom-left user area should navigate to a basic `Account Settings` page.

This is preferable to a placeholder button or a dead dropdown because it gives the user area a clear and stable destination.

## Settings Information Architecture

`Settings` remains the home for workspace configuration.

Inside Settings, add an `Ingestion` area that contains:

- Sources
- Integrations

This can be implemented as either:

- a Settings subnav group named `Ingestion`, or
- a single `Ingestion` page with two linked sections

For v1, the user-facing structure should emphasize one parent concept: ingestion.

## Ingestion UX

### Ingestion Landing Page

The recommended v1 shape is an `Ingestion` page that explains the distinction between Sources and Integrations and links the user into the appropriate workflows.

The page should include:

- a short explainer describing the difference between Sources and Integrations
- examples for each category
- quick actions for `Add Source` and `Add Integration`
- separate lists for configured Sources and configured Integrations, or clear links to those lists

This page should teach the model instead of making the user infer it from raw object names.

### Explainer Copy Intent

The copy should make the distinction explicit:

- Sources: systems that send logs to Piglog
- Integrations: services Piglog connects to and syncs from

Example framing:

- Source examples: HTTP JSON, Syslog, Vector
- Integration examples: NextDNS, Cloudflare, Tailscale

### Dashboard Quick Actions

The workspace dashboard should include obvious empty-state and quick-action entry points:

- Add Source
- Add Integration

These actions should deep-link into the relevant ingestion settings flows.

This keeps the dashboard useful during onboarding and helps users recover from an empty workspace without hunting through Settings.

## Integration Data Model

### Scope

In v1, integrations belong to a single workspace.

This is the least surprising model because workspaces are already the boundary for:

- logs
- sources
- dashboards
- access
- configuration

If one business manages three distinct workspace-level environments, it should create three integrations, one per workspace.

### Child Entity Discovery

One integration may discover many child entities.

For NextDNS, a single account integration can discover multiple profiles. Piglog should let the user choose which profiles to enable, then create one hidden internal source per selected profile.

The initial selection flow should be:

- connect account
- discover child entities
- show all discovered entities preselected by default
- let the user deselect any unwanted entities
- confirm creation

This keeps setup fast without silently creating noisy or unwanted sources.

### Visibility

Integration-created sources should be hidden or clearly marked internal in normal source-management views.

Users should manage vendor behavior from the Integration UX, not by directly editing low-level hidden sources.

If those internal sources are visible anywhere operationally, they should be labeled as integration-managed and read-only for vendor-owned fields.

## Code Organization

Each integration should follow a consistent internal template so the codebase stays readable as more connectors are added.

Recommended per-integration responsibilities:

- config schema
- credential handling
- connection test
- discovery of child entities
- backfill/poll sync logic
- optional live stream logic
- normalization into Piglog log events
- health/status reporting

The shared framework should be thin. It should provide lifecycle hooks and scheduling primitives, not try to flatten every vendor into one giant abstraction.

This preserves clarity while still enforcing a recognizable structure.

## Credentials And API Keys

### API Keys Page

Do not expand a standalone `API Keys` settings page in this phase.

Reasons:

- source ingestion keys already belong naturally on Sources
- integration credentials belong on the integration setup and detail screens
- a separate page would mostly duplicate information without a strong user need

If Piglog later needs a consolidated credential inventory, it should likely be framed as `Credentials`, not `API Keys`.

### Secret Reveal Behavior

Stored integration secrets may be revealable in the UI in v1, because the desired product behavior is to let users reveal and copy the credentials they entered.

The interaction should still be deliberate:

- hidden by default
- explicit reveal action
- explicit copy action

Piglog can later add stronger safeguards such as re-auth before reveal.

## Account Settings

Add a basic `Account Settings` page for the current user.

Initial scope:

- profile basics
- email
- password or auth controls
- logout

This should be intentionally small. The goal is to give the user area a real destination, not to design a large account-management surface yet.

## Backfill Strategy For Integrations

V1 should not default to unlimited historical backfill.

The safer product posture is:

- integrations start with a bounded backfill window by default
- examples: last 24 hours or last 7 days
- future iterations may allow custom historical import ranges

This avoids surprising users with huge sync jobs and reduces risk for integrations that expose very large histories.

The exact default window can be decided during implementation, but it should be finite and clearly communicated.

## Error Handling And Status

Integrations should surface status in user-friendly terms:

- connected
- sync in progress
- degraded
- failed

Errors should be tied to the integration record, not buried only in background worker logs.

Expected user-visible failure cases:

- invalid credentials
- vendor API unavailable
- discovery failed
- partial child entity creation
- sync paused or rate-limited

The product should distinguish setup failures from ongoing sync failures.

## Testing Strategy

### Product / UX

- verify sidebar no longer implies fake collapse behavior
- verify account entry navigates to Account Settings
- verify dashboard quick actions link to ingestion setup correctly
- verify Ingestion page clearly distinguishes Sources and Integrations

### Integration Model

- verify integrations are workspace-scoped
- verify one integration can create multiple internal sources
- verify child entity selection is respected
- verify internal sources remain hidden or appropriately labeled

### Backend

- verify integration-managed logs still use the normal ingestion/query/live-tail pipeline
- verify discovery, sync, and normalization remain isolated per integration module
- verify bounded backfill defaults are enforced

## Implementation Notes

The implementation should proceed in layers:

1. clean up navigation and dead settings affordances
2. introduce Ingestion IA and routing
3. add the workspace-scoped integration model
4. implement the first integration using the shared template

This sequencing improves the UX immediately while keeping the bigger integration system grounded in a cleaner product structure.
