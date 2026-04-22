import { Worker } from 'bullmq';
import { eq, and, gte, sql, count } from 'drizzle-orm';
import { db, logEntry, alertRule, alertRuleStatusEnum } from '@piglog/db';
import { redisConnection, webhookNotifyQueue } from '../queues/index.js';

const alertWorker = new Worker(
  'alert-evaluate',
  async (job) => {
    const { workspaceId, service, level, windowMinutes = 5, ruleId } = job.data;

    // If a specific ruleId is provided, evaluate just that rule
    if (ruleId) {
      const rule = await db.query.alertRule.findFirst({
        where: eq(alertRule.id, ruleId),
      });
      if (!rule || rule.status !== alertRuleStatusEnum.enumValues[0]) return;

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
        case 'GREATER_THAN': triggered = actualCount > rule.threshold; break;
        case 'LESS_THAN': triggered = actualCount < rule.threshold; break;
        case 'EQUALS': triggered = actualCount === rule.threshold; break;
      }

      if (triggered) {
        if (rule.webhookUrl) {
          await webhookNotifyQueue.add('send', {
            url: rule.webhookUrl,
            payload: {
              text: `Alert: ${rule.name}`,
              description: `${rule.service} has ${actualCount} ${rule.level || ''} logs in the last ${rule.windowMinutes} minutes`,
              ruleName: rule.name,
              threshold: rule.threshold,
              actual: actualCount,
              operator: rule.operator,
            },
          });
        }
        await db
          .update(alertRule)
          .set({ lastTriggeredAt: new Date() })
          .where(eq(alertRule.id, rule.id));
      }
      return;
    }

    // Otherwise evaluate all matching rules for the service/level
    const rules = await db.query.alertRule.findMany({
      where: and(
        eq(alertRule.workspaceId, workspaceId),
        eq(alertRule.service, service),
        level ? eq(alertRule.level, level) : undefined,
        eq(alertRule.status, alertRuleStatusEnum.enumValues[0])
      ),
    });

    for (const rule of rules) {
      const windowStart = new Date(Date.now() - (rule.windowMinutes || 5) * 60 * 1000);
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(logEntry)
        .where(
          and(
            eq(logEntry.workspaceId, workspaceId),
            eq(logEntry.service, service),
            rule.level ? eq(logEntry.level, rule.level) : undefined,
            gte(logEntry.timestamp, windowStart)
          )
        );

      const actualCount = Number(countResult[0]?.count || 0);
      let triggered = false;
      switch (rule.operator) {
        case 'GREATER_THAN': triggered = actualCount > rule.threshold; break;
        case 'LESS_THAN': triggered = actualCount < rule.threshold; break;
        case 'EQUALS': triggered = actualCount === rule.threshold; break;
      }

      if (triggered) {
        if (rule.webhookUrl) {
          await webhookNotifyQueue.add('send', {
            url: rule.webhookUrl,
            payload: {
              text: `Alert: ${rule.name}`,
              description: `${rule.service} has ${actualCount} ${rule.level || ''} logs in the last ${rule.windowMinutes} minutes`,
              ruleName: rule.name,
              threshold: rule.threshold,
              actual: actualCount,
              operator: rule.operator,
            },
          });
        }
        await db
          .update(alertRule)
          .set({ lastTriggeredAt: new Date() })
          .where(eq(alertRule.id, rule.id));
      }
    }
  },
  { connection: redisConnection }
);

alertWorker.on('failed', (job, err) => {
  console.error(`Alert job ${job?.id} failed:`, err);
});
