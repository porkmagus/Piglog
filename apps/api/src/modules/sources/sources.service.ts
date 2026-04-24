import { eq, and, isNull, count, sql, inArray, gte } from 'drizzle-orm';
import { db, logSource, logEntry } from '@piglog/db';
import crypto from 'node:crypto';

function generateApiKey(): string {
  return `pl_${crypto.randomBytes(32).toString('hex')}`;
}

export async function createSource(workspaceId: string, data: { name: string; type: string; config?: Record<string, unknown> }) {
  const id = crypto.randomUUID();
  const apiKey = generateApiKey();

  await db.insert(logSource).values({
    id,
    workspaceId,
    name: data.name,
    type: data.type,
    apiKey,
    config: data.config || {},
  });

  return db.query.logSource.findFirst({
    where: eq(logSource.id, id),
  });
}

export async function listSources(workspaceId: string) {
  const sources = await db.query.logSource.findMany({
    where: and(eq(logSource.workspaceId, workspaceId), isNull(logSource.deletedAt)),
  });

  // Get volume stats for each source
  const sourceIds = sources.map((s) => s.id);
  if (sourceIds.length === 0) return [];

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const stats = await db
    .select({
      sourceId: logEntry.sourceId,
      count: count(),
      latest: sql<Date>`max(${logEntry.timestamp})`,
    })
    .from(logEntry)
    .where(and(inArray(logEntry.sourceId, sourceIds), gte(logEntry.timestamp, dayAgo)))
    .groupBy(logEntry.sourceId);

  const statsMap = new Map(stats.map((s) => [s.sourceId, s]));

  return sources.map((s) => ({
    ...s,
    volume24h: statsMap.get(s.id)?.count || 0,
    lastSeen: statsMap.get(s.id)?.latest || null,
  }));
}

export async function getSource(workspaceId: string, sourceId: string) {
  return db.query.logSource.findFirst({
    where: and(eq(logSource.id, sourceId), eq(logSource.workspaceId, workspaceId), isNull(logSource.deletedAt)),
  });
}

export async function regenerateApiKey(workspaceId: string, sourceId: string) {
  const newKey = generateApiKey();
  const result = await db
    .update(logSource)
    .set({ apiKey: newKey })
    .where(and(eq(logSource.id, sourceId), eq(logSource.workspaceId, workspaceId)))
    .returning();
  return result[0] || null;
}

export async function deleteSource(workspaceId: string, sourceId: string) {
  await db
    .update(logSource)
    .set({ deletedAt: new Date() })
    .where(and(eq(logSource.id, sourceId), eq(logSource.workspaceId, workspaceId)));
}
