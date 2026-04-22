import { eq, and, gte, sql, count } from 'drizzle-orm';
import { db, alertRule, alertRuleStatusEnum, logEntry } from '@piglog/db';
import type { LogLevel } from '@piglog/db';

export async function createAlertRule(
  workspaceId: string,
  data: {
    name: string;
    description?: string;
    service: string;
    level?: LogLevel;
    operator: 'GREATER_THAN' | 'LESS_THAN' | 'EQUALS';
    threshold: number;
    windowMinutes?: number;
    webhookUrl?: string;
  }
) {
  const id = crypto.randomUUID();
  await db.insert(alertRule).values({
    id,
    workspaceId,
    name: data.name,
    description: data.description || null,
    service: data.service,
    level: data.level || null,
    operator: data.operator,
    threshold: data.threshold,
    windowMinutes: data.windowMinutes || 5,
    webhookUrl: data.webhookUrl || null,
  });
  return db.query.alertRule.findFirst({ where: eq(alertRule.id, id) });
}

export async function listAlertRules(workspaceId: string) {
  return db.query.alertRule.findMany({
    where: eq(alertRule.workspaceId, workspaceId),
    orderBy: (rule, { desc }) => [desc(rule.createdAt)],
  });
}

export async function getAlertRule(workspaceId: string, ruleId: string) {
  return db.query.alertRule.findFirst({
    where: and(eq(alertRule.id, ruleId), eq(alertRule.workspaceId, workspaceId)),
  });
}

export async function updateAlertRule(
  workspaceId: string,
  ruleId: string,
  data: Partial<{
    name: string;
    description: string;
    service: string;
    level: LogLevel | null;
    operator: 'GREATER_THAN' | 'LESS_THAN' | 'EQUALS';
    threshold: number;
    windowMinutes: number;
    status: 'ACTIVE' | 'PAUSED' | 'DISABLED';
    webhookUrl: string | null;
  }>
) {
  await db
    .update(alertRule)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(alertRule.id, ruleId), eq(alertRule.workspaceId, workspaceId)));
  return getAlertRule(workspaceId, ruleId);
}

export async function deleteAlertRule(workspaceId: string, ruleId: string) {
  await db
    .delete(alertRule)
    .where(and(eq(alertRule.id, ruleId), eq(alertRule.workspaceId, workspaceId)));
}

export async function evaluateAlertRule(ruleId: string) {
  const rule = await db.query.alertRule.findFirst({
    where: eq(alertRule.id, ruleId),
  });
  if (!rule || rule.status !== alertRuleStatusEnum.enumValues[0]) return null; // ACTIVE

  const windowStart = new Date(Date.now() - (rule.windowMinutes || 5) * 60 * 1000);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(logEntry)
    .where(
      and(
        eq(logEntry.workspaceId, rule.workspaceId),
        eq(logEntry.service, rule.service),
        rule.level ? eq(logEntry.level, rule.level) : undefined,
        gte(logEntry.timestamp, windowStart)
      )
    );

  const actualCount = Number(countResult[0]?.count || 0);

  let triggered = false;
  switch (rule.operator) {
    case 'GREATER_THAN':
      triggered = actualCount > rule.threshold;
      break;
    case 'LESS_THAN':
      triggered = actualCount < rule.threshold;
      break;
    case 'EQUALS':
      triggered = actualCount === rule.threshold;
      break;
  }

  if (triggered) {
    await db
      .update(alertRule)
      .set({ lastTriggeredAt: new Date(), updatedAt: new Date() })
      .where(eq(alertRule.id, ruleId));
  }

  return { rule, triggered, actualCount };
}
