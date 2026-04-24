import { nextDnsConnector } from './nextdns.js';
import type { IntegrationConnector } from './types.js';

export const connectors: Record<string, IntegrationConnector> = {
  nextdns: nextDnsConnector,
};

export function getConnector(provider: string): IntegrationConnector | undefined {
  return connectors[provider];
}
