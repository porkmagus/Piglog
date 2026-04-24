import { eq, and, isNull } from 'drizzle-orm';
import { db, dashboardLayout } from '@piglog/db';
import { randomUUID } from 'crypto';

export interface DashboardWidget {
  id: string;
  type: string;
  col: number;
  row: number;
  w: number;
  h: number;
  config: Record<string, unknown>;
}

const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: 'default-volume', type: 'volume', col: 0, row: 0, w: 12, h: 1, config: { timeRange: '24h' } },
  { id: 'default-levels', type: 'levels', col: 0, row: 1, w: 6, h: 1, config: { timeRange: '24h' } },
  { id: 'default-services', type: 'services', col: 6, row: 1, w: 6, h: 1, config: { limit: 10 } },
  { id: 'default-hosts', type: 'hosts', col: 0, row: 2, w: 6, h: 1, config: { limit: 10 } },
];

export async function getMergedLayout(workspaceId: string, userId: string | null): Promise<{ widgets: DashboardWidget[]; isPersonal: boolean }> {
  const [workspaceDefault] = await db
    .select()
    .from(dashboardLayout)
    .where(and(
      eq(dashboardLayout.workspaceId, workspaceId),
      isNull(dashboardLayout.userId),
    ));

  let defaultWidgets: DashboardWidget[] = DEFAULT_WIDGETS;
  if (workspaceDefault) {
    defaultWidgets = (workspaceDefault.layout as DashboardWidget[]) || DEFAULT_WIDGETS;
  }

  if (!userId) {
    return { widgets: defaultWidgets, isPersonal: false };
  }

  const [personal] = await db
    .select()
    .from(dashboardLayout)
    .where(and(
      eq(dashboardLayout.workspaceId, workspaceId),
      eq(dashboardLayout.userId, userId),
    ));

  if (!personal) {
    return { widgets: defaultWidgets, isPersonal: false };
  }

  const personalData = (personal.layout as { widgets?: DashboardWidget[]; hiddenIds?: string[] }) || {};

  const personalWidgets = personalData.widgets || [];
  const hiddenIds = personalData.hiddenIds || [];

  const visibleDefaults = defaultWidgets.filter(w => !hiddenIds.includes(w.id));
  const widgets = [...visibleDefaults, ...personalWidgets];

  return { widgets, isPersonal: true };
}

export async function savePersonalLayout(
  workspaceId: string,
  userId: string,
  widgets: DashboardWidget[],
  hiddenIds: string[],
): Promise<void> {
  const layout = JSON.stringify({ widgets, hiddenIds });

  const [existing] = await db
    .select({ id: dashboardLayout.id })
    .from(dashboardLayout)
    .where(and(
      eq(dashboardLayout.workspaceId, workspaceId),
      eq(dashboardLayout.userId, userId),
    ));

  if (existing) {
    await db
      .update(dashboardLayout)
      .set({ layout, updatedAt: new Date() })
      .where(eq(dashboardLayout.id, existing.id));
  } else {
    await db.insert(dashboardLayout).values({
      id: randomUUID(),
      workspaceId,
      userId,
      layout,
    });
  }
}

export async function deletePersonalLayout(workspaceId: string, userId: string): Promise<void> {
  await db
    .delete(dashboardLayout)
    .where(and(
      eq(dashboardLayout.workspaceId, workspaceId),
      eq(dashboardLayout.userId, userId),
    ));
}
