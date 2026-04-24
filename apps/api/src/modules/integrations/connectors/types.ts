export interface DiscoveredIntegrationEntity {
  id: string;
  name: string;
}

export interface IntegrationConnector {
  provider: string;
  discoverEntities(config: Record<string, unknown>, secret: string): Promise<DiscoveredIntegrationEntity[]>;
  testConnection(config: Record<string, unknown>, secret: string): Promise<void>;
  sync(params: {
    workspaceId: string;
    integrationId: string;
    sourceId: string;
    config: Record<string, unknown>;
    secret: string;
    state: Record<string, unknown>;
  }): Promise<{ nextState: Record<string, unknown>; accepted: number }>;
}
