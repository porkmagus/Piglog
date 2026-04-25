# NextDNS Multi-Profile Sync Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the issue where only the first NextDNS profile is synced, ensuring all enabled profiles are processed.

**Architecture:** The `runIntegrationSyncJob` iterates through `integrationSource` records. We will add detailed logging to track the progress of this loop and the individual `connector.sync` calls. We will also investigate if the `do...while` loop in the NextDNS connector is causing timeouts or excessive resource usage.

**Tech Stack:** Fastify, Drizzle ORM, BullMQ, NextDNS API.

---

## File Structure

- **Modify:** `apps/api/src/modules/integrations/integrations.service.ts`
  - Add logging to `runIntegrationSyncJob` to track which source is being processed and how many logs were accepted per source.
- **Modify:** `apps/api/src/modules/integrations/connectors/nextdns.ts`
  - Add logging inside the `sync` loop to track page fetches and cursor progression.
- **Modify:** `apps/api/src/workers/integration-sync.worker.ts`
  - Ensure worker logs are sufficient to diagnose crashes.

---

## Tasks

### Task 1: Enhance Sync Observability

**Files:**
- Modify: `apps/api/src/modules/integrations/integrations.service.ts`
- Modify: `apps/api/src/modules/integrations/connectors/nextdns.ts`

- [ ] **Step 1: Add logging to `runIntegrationSyncJob`**
  - Log the start of the job with the total number of sources found.
  - Log the start of each source sync: `Syncing source ${is.sourceId} (${is.externalName})`.
  - Log the result of each source sync: `Source ${is.sourceId} synced: ${result.accepted} logs accepted`.
  - Log any errors caught in the `catch (sourceErr)` block with full stack traces.

- [ ] **Step 2: Add logging to `nextdns.sync`**
  - Log the start of the sync for a specific `profileId`.
  - Inside the `do...while` loop, log each page fetch: `Fetching page for ${profileId} (cursor: ${pageCursor})`.
  - Log the number of logs received per page.

- [ ] **Step 3: Deploy and verify logs**
  - Run the sync job and check the logs to see if the loop ever reaches the second and third profiles.

### Task 2: Analyze and Fix Sync Bottlenecks

**Files:**
- Modify: `apps/api/src/modules/integrations/connectors/nextdns.ts`

- [ ] **Step 1: Check for potential infinite loops or timeouts**
  - Based on logs from Task 1, determine if the first profile is taking an excessive amount of time.
  - If the `do...while` loop is too long, consider implementing a maximum page limit per sync cycle to prevent worker timeouts.

- [ ] **Step 2: Verify cursor persistence**
  - Ensure that `nextState` is being correctly returned and persisted in `integrations.service.ts`.
  - Verify that the `cursor` is actually advancing in the logs.

### Task 3: Regression Testing

**Files:**
- Modify: `apps/api/src/modules/integrations/integrations.service.test.ts`

- [ ] **Step 1: Create a test case with multiple enabled sources**
  - Mock a NextDNS integration with 3 enabled sources.
  - Mock the connector to return different results for each source.
  - Verify that `connector.sync` is called exactly 3 times.
  - Verify that the final `integration` status is `CONNECTED` and `lastSyncedAt` is updated.

- [ ] **Step 2: Run tests and verify**
  - Run: `npm --workspace @piglog/api run test -- apps/api/src/modules/integrations/integrations.service.test.ts`
