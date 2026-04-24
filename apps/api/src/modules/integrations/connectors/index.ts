import { nextDnsConnector } from './nextdns.js';
import type { IntegrationConnector } from './types.js';

const connectors: Record<'nextdns', IntegrationConnector> = {
  nextdns: nextDnsConnector,
};

type ProviderName = keyof typeof connectors;

export function getConnector(provider: string): IntegrationConnector | undefined {
  return (provider as ProviderName) in connectors ? connectors[provider as ProviderName] : undefined;
}

export { connectors };
