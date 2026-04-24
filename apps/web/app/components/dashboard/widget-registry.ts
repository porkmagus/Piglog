import type { WidgetRegistryEntry } from './types';

const registry: Record<string, WidgetRegistryEntry> = {};

export function registerWidget(entry: WidgetRegistryEntry): void {
  registry[entry.type] = entry;
}

export function getWidgetEntry(type: string): WidgetRegistryEntry | undefined {
  return registry[type];
}

export function getAvailableWidgets(): WidgetRegistryEntry[] {
  return Object.values(registry);
}

export const WIDGET_METADATA: Record<string, { title: string; subtitle: string; defaultW: number; defaultH: number; configSchema: Record<string, string> }> = {
  volume: { title: 'Log Volume', subtitle: 'Logs ingested per hour', defaultW: 12, defaultH: 1, configSchema: { timeRange: 'timeRange' } },
  levels: { title: 'Level Breakdown', subtitle: 'Logs by severity level', defaultW: 6, defaultH: 1, configSchema: { timeRange: 'timeRange' } },
  services: { title: 'Top Services', subtitle: 'Services with most logs', defaultW: 6, defaultH: 1, configSchema: { limit: 'limit' } },
  hosts: { title: 'Top Hosts', subtitle: 'Hosts with most logs', defaultW: 6, defaultH: 1, configSchema: { limit: 'limit' } },
  sources: { title: 'Top Sources', subtitle: 'Sources with most logs', defaultW: 6, defaultH: 1, configSchema: { limit: 'limit' } },
  errors: { title: 'Error Rate', subtitle: 'Errors vs total logs over time', defaultW: 12, defaultH: 1, configSchema: { timeRange: 'timeRange' } },
  alerts: { title: 'Recent Alerts', subtitle: 'Recently fired alert rules', defaultW: 6, defaultH: 1, configSchema: { limit: 'limit' } },
  custom_sql: { title: 'Custom Query', subtitle: 'Run your own SQL query', defaultW: 12, defaultH: 2, configSchema: { sql: 'sql', chartType: 'chartType', xAxis: 'xAxis', yAxis: 'yAxis', groupBy: 'groupBy', timeRange: 'timeRange' } },
};
