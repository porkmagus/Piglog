import { eq, and, isNull } from 'drizzle-orm';
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

  await db.insert(integration).values({
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

  const createdSources: Array<{ integrationId: string; sourceId: string; externalId: string; externalName: string }> = [];

  for (const profileId of config.profileIds) {
    const entity = entities.find((e) => e.id === profileId);
    const sourceName = `nextdns-${entity?.name || profileId}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/g, '');

    const sourceId = randomUUID();
    const sourceKey = randomUUID();

    await db.insert(logSource).values({
      id: sourceId,
      workspaceId,
      name: sourceName,
      type: 'http',
      apiKey: sourceKey,
      config: { integrationManaged: true, integrationId },
    });

    await db.insert(integrationSource).values({
      id: randomUUID(),
      integrationId,
      sourceId,
      externalId: profileId,
      externalName: entity?.name || profileId,
      isEnabled: true,
    });

    createdSources.push({
      integrationId,
      sourceId,
      externalId: profileId,
      externalName: entity?.name || profileId,
    });
  }

  await db
    .update(integration)
    .set({ status: 'CONNECTED' })
    .where(eq(integration.id, integrationId));

  const [created] = await db
    .select()
    .from(integration)
    .where(eq(integration.id, integrationId));

  return { ...created, sources: createdSources };
}

export async function runIntegrationSyncJob(integrationId: string): Promise<void> {
  const [int] = await db
    .select()
    .from(integration)
    .where(eq(integration.id, integrationId));

  if (!int) return;

  const connector = getConnector(int.provider);
  if (!connector) return;

  const sources = await db
    .select()
    .from(integrationSource)
    .where(
      and(
        eq(integrationSource.integrationId, integrationId),
        eq(integrationSource.isEnabled, true),
      )
    );

  for (const is of sources) {
    const cfg = (int.config && typeof int.config === 'object') ? int.config : {};
    await connector.sync({
      workspaceId: int.workspaceId,
      integrationId: int.id,
      sourceId: is.sourceId,
      config: { ...cfg, profileId: is.externalId },
      secret: int.secret || '',
      state: {},
    });
  }

  await db
    .update(integration)
    .set({ lastSyncedAt: new Date() })
    .where(eq(integration.id, integrationId));
}
