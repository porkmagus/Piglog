export interface DashboardWidgetData {
  id: string;
  type: string;
  col: number;
  row: number;
  w: number;
  h: number;
  config: Record<string, unknown>;
}

export interface WidgetRegistryEntry {
  type: string;
  title: string;
  subtitle: string;
  defaultW: number;
  defaultH: number;
  configSchema: Record<string, string>;
  component: React.ComponentType<{ widget: DashboardWidgetData; workspaceId: string }>;
}

export type WidgetType = 'volume' | 'levels' | 'services' | 'hosts' | 'sources' | 'errors' | 'alerts' | 'custom_sql';
