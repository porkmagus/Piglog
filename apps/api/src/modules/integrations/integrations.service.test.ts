import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('./connectors/index.js', () => ({
  getConnector: vi.fn(),
}));

vi.mock('../../queues/index.js', () => ({
  integrationSyncQueue: {
    add: vi.fn().mockResolvedValue({ id: 'job_123' }),
    removeRepeatableByKey: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('@piglog/db', () => {
  const selectResult = [{
    id: 'int_123',
    workspaceId: 'ws_123',
    provider: 'nextdns',
    name: 'Test Integration',
    status: 'CONNECTED',
    config: {},
    secret: 'sk_test',
    createdAt: new Date(),
    updatedAt: new Date(),
  }];
  const sourceResult = [
    { integrationId: 'int_123', sourceId: 'src_1', externalId: 'profile_a', externalName: 'Home', isEnabled: true },
    { integrationId: 'int_123', sourceId: 'src_2', externalId: 'profile_b', externalName: 'Office', isEnabled: true },
  ];
  let selectMode = 'integration';

  const mockDb = {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([]),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockImplementation((table) => {
      const tableStr = String(table);
      if (tableStr.includes('integrationSource') || tableStr.includes('integration_source')) {
        selectMode = 'source';
      } else {
        selectMode = 'integration';
      }
      return mockDb;
    }),
    where: vi.fn().mockImplementation(() => {
      if (selectMode === 'source') return Promise.resolve(sourceResult);
      if (selectMode === 'integration') return Promise.resolve(selectResult);
      return Promise.resolve([]);
    }),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockResolvedValue([]),
    })),
    delete: vi.fn().mockReturnThis(),
    transaction: vi.fn().mockImplementation(async (fn) => {
      const tx = {
        insert: mockDb.insert,
        values: mockDb.values,
        update: mockDb.update,
        set: mockDb.set,
        where: mockDb.where,
      };
      await fn(tx);
    }),
  };

  return {
    db: mockDb,
    integration: { toString: () => 'integration' },
    integrationSource: { toString: () => 'integrationSource' },
    logSource: { toString: () => 'logSource' },
    eq: vi.fn().mockReturnValue({}),
  };
});

vi.mock('../../logs/logs.service.js', () => ({
  ingestLogs: vi.fn().mockResolvedValue({ accepted: 5 }),
}));

import * as connectorIndex from './connectors/index.js';
import { createIntegrationWithSources, runIntegrationSyncJob } from './integrations.service.js';

const mockDiscoverEntities = vi.fn().mockResolvedValue([
  { id: 'profile_a', name: 'Home' },
  { id: 'profile_b', name: 'Office' },
]);

describe('createIntegrationWithSources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDiscoverEntities.mockResolvedValue([
      { id: 'profile_a', name: 'Home' },
      { id: 'profile_b', name: 'Office' },
    ]);
    vi.mocked(connectorIndex.getConnector).mockReturnValue({
      provider: 'nextdns',
      discoverEntities: mockDiscoverEntities,
    } as any);
  });

  it('creates integration with hidden sources for selected profiles', async () => {
    const result = await createIntegrationWithSources({
      workspaceId: 'ws_123',
      provider: 'nextdns',
      name: 'My NextDNS',
      config: { profileIds: ['profile_a', 'profile_b'], backfillHours: 24 },
      secret: 'sk_test',
    });

    expect(mockDiscoverEntities).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('throws on unknown provider', async () => {
    vi.mocked(connectorIndex.getConnector).mockReturnValue(undefined);

    await expect(createIntegrationWithSources({
      workspaceId: 'ws_123',
      provider: 'nextdns',
      name: 'Test',
      config: { profileIds: ['p1'], backfillHours: 24 },
      secret: 'sk_test',
    })).rejects.toThrow('Unknown integration provider');
  });
});

describe('runIntegrationSyncJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    const mockSync = vi.fn().mockResolvedValue({
      nextState: { cursor: 'next_cursor' },
      accepted: 10,
    });

    vi.mocked(connectorIndex.getConnector).mockReturnValue({
      provider: 'nextdns',
      sync: mockSync,
    } as any);
  });

  it('syncs all enabled sources for an integration', async () => {
    const connector = connectorIndex.getConnector('nextdns');
    const mockSync = vi.fn().mockResolvedValue({
      nextState: { cursor: 'next_cursor' },
      accepted: 10,
    });
    
    vi.mocked(connectorIndex.getConnector).mockReturnValue({
      provider: 'nextdns',
      sync: mockSync,
    } as any);

    await runIntegrationSyncJob('int_123');

    expect(mockSync).toHaveBeenCalledTimes(2);
    expect(mockSync).toHaveBeenCalledWith(expect.objectContaining({
      sourceId: 'src_1',
      config: expect.objectContaining({ profileId: 'profile_a' }),
    }));
    expect(mockSync).toHaveBeenCalledWith(expect.objectContaining({
      sourceId: 'src_2',
      config: expect.objectContaining({ profileId: 'profile_b' }),
    }));
  });
});
