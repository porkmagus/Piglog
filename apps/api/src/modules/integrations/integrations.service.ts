import { eq, and } from 'drizzle-orm';
import { db, integration, integrationSource, logSource } from '@piglog/db';
import { randomUUID } from 'crypto';
import { getConnector } from './connectors/index.js';
import type { CreateIntegrationInput } from './integrations.schemas.js';

export async function listIntegrations(workspaceId: string) {
  return db
    .select()
    .from(integration)
    .where(eq(integration.workspaceId, workspaceId));
}

export async function createIntegrationWithSources(input: CreateIntegrationInput & { workspaceId: string }) {
  const { workspaceId, provider, name, config, secret } = input;

  const integrationId = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(integration).values({
      id: integrationId,
      workspaceId,
      provider,
      name,
      status: 'PENDING',
      config: { profileIds: config.profileIds, backfillHours: config.backfillHours },
      secret,
    });

    const connector = getConnector(provider);
    if (!connector) {
      throw new Error(`Unknown integration provider: ${provider}`);
    }

    const entities = await connector.discoverEntities({}, secret);

    for (const profileId of config.profileIds) {
      const entity = entities.find((e) => e.id === profileId);
      const sourceName = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/g, '')}-${entity?.name || profileId}`
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 64);

      const sourceId = randomUUID();
      const sourceKey = randomUUID();

      await tx.insert(logSource).values({
        id: sourceId,
        workspaceId,
        name: sourceName,
        type: 'http',
        apiKey: sourceKey,
        config: { integrationManaged: true, integrationId },
      });

      await tx.insert(integrationSource).values({
        id: randomUUID(),
        integrationId,
        sourceId,
        externalId: profileId,
        externalName: entity?.name || profileId,
        isEnabled: true,
      });
    }

    await tx
      .update(integration)
      .set({ status: 'CONNECTED' })
      .where(eq(integration.id, integrationId));
  });

  const [created] = await db
    .select()
    .from(integration)
    .where(eq(integration.id, integrationId));

  const sources = await db
    .select()
    .from(integrationSource)
    .where(eq(integrationSource.integrationId, integrationId));

  return {
    ...created,
    sources: sources.map((s) => ({
      integrationId: s.integrationId,
      sourceId: s.sourceId,
      externalId: s.externalId,
      externalName: s.externalName,
    })),
  };
}

export async function runIntegrationSyncJob(integrationId: string): Promise<void> {
  const [int] = await db
    .select()
    .from(integration)
    .where(eq(integration.id, integrationId));

  if (!int) return;

  const connector = getConnector(int.provider);
  if (!connector) {
    await db
      .update(integration)
      .set({ status: 'ERROR' })
      .where(eq(integration.id, integrationId));
    return;
  }

  await db
    .update(integration)
    .set({ status: 'SYNCING' })
    .where(eq(integration.id, integrationId));

  try {
    const sources = await db
      .select()
      .from(integrationSource)
      .where(
        and(
          eq(integrationSource.integrationId, integrationId),
          eq(integrationSource.isEnabled, true),
        )
      );

    let totalAccepted = 0;

    for (const is of sources) {
      const cfg = (int.config && typeof int.config === 'object') ? (int.config as Record<string, unknown>) : {};
      const result = await connector.sync({
        workspaceId: int.workspaceId,
        integrationId: int.id,
        sourceId: is.sourceId,
        config: { ...cfg, profileId: is.externalId },
        secret: int.secret || '',
        state: {},
      });
      totalAccepted += result.accepted;
    }

    await db
      .update(integration)
      .set({
        status: 'CONNECTED',
        lastSyncedAt: new Date(),
      })
      .where(eq(integration.id, integrationId));
  } catch (err) {
    await db
      .update(integration)
      .set({ status: 'ERROR' })
      .where(eq(integration.id, integrationId));

    console.error(`Integration sync failed for ${integrationId}:`, err);
    throw err;
  }
}

export async function disableIntegration(integrationId: string): Promise<void> {
  const [int] = await db
    .select()
    .from(integration)
    .where(eq(integration.id, integrationId));

  if (!int) {
    throw new Error('Integration not found');
  }

  await db
    .update(integration)
    .set({ status: 'DISABLED' })
    .where(eq(integration.id, integrationId));

  await db
    .update(integrationSource)
    .set({ isEnabled: false })
    .where(eq(integrationSource.integrationId, integrationId));
}

export async function deleteIntegration(integrationId: string): Promise<void> {
  const sources = await db
    .select({ sourceId: integrationSource.sourceId })
    .from(integrationSource)
    .where(eq(integrationSource.integrationId, integrationId));

  for (const s of sources) {
    await db
      .update(logSource)
      .set({ deletedAt: new Date() })
      .where(eq(logSource.id, s.sourceId));
  }

  await db
    .delete(integration)
    .where(eq(integration.id, integrationId));
}
