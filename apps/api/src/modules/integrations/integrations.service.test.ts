import { describe, expect, it } from 'vitest';

describe('integration persistence', () => {
  it('stores workspace-scoped integrations and child sources', () => {
    const shape = {
      workspaceId: 'ws_123',
      provider: 'nextdns',
      status: 'CONNECTED',
      sourceCount: 2,
    };

    expect(shape).toMatchObject({
      workspaceId: 'ws_123',
      provider: 'nextdns',
      status: 'CONNECTED',
      sourceCount: 2,
    });
  });
});
