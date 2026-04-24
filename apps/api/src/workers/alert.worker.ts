import { Worker } from 'bullmq';
import { eq, and, gte, sql } from 'drizzle-orm';
import { db, logEntry, alertRule } from '@piglog/db';
import { evaluateAlertRule } from '../modules/alerts/alerts.service.js';
import { redisConnection, webhookNotifyQueue } from '../queues/index.js';

const alertWorker = new Worker(
  'alert-evaluate',
  async (job) => {
    const { workspaceId, service, level, ruleId } = job.data;

    // If a specific ruleId is provided, evaluate just that rule
    if (ruleId) {
      const result = await evaluateAlertRule(ruleId);
      if (!result || !result.triggered) return;
      const { rule, actualCount } = result;

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
        }, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        });
      }
      return;
    }

    // Otherwise evaluate all matching rules for the service/level
    const ruleConditions = [
      eq(alertRule.workspaceId, workspaceId),
      eq(alertRule.service, service),
      eq(alertRule.status, 'ACTIVE'),
    ];
    if (level) ruleConditions.push(eq(alertRule.level, level));

    const rules = await db.query.alertRule.findMany({
      where: and(...ruleConditions),
    });

    for (const rule of rules) {
      const result = await evaluateAlertRule(rule.id);
      if (!result || !result.triggered) continue;
      const { actualCount } = result;

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
        }, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        });
      }
    }
  },
  { connection: redisConnection }
);

alertWorker.on('failed', (job, err) => {
  console.error(`Alert job ${job?.id} failed:`, err);
});

export { alertWorker };
