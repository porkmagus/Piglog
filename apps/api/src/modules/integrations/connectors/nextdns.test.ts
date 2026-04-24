import { describe, expect, it } from 'vitest';
import { mapNextDnsEventToPiglogLog } from './nextdns.js';

describe('mapNextDnsEventToPiglogLog', () => {
  it('maps blocked dns events to WARN logs', () => {
    const result = mapNextDnsEventToPiglogLog({
      timestamp: '2026-04-24T12:00:00.000Z',
      status: 'blocked',
      query: 'facebook.com',
      deviceName: 'MacBook Pro',
    });

    expect(result.level).toBe('WARN');
    expect(result.service).toBe('nextdns');
    expect(result.message).toContain('facebook.com');
  });

  it('maps error dns events to ERROR logs', () => {
    const result = mapNextDnsEventToPiglogLog({
      timestamp: '2026-04-24T12:00:00.000Z',
      status: 'error',
      query: 'example.com',
    });

    expect(result.level).toBe('ERROR');
  });

  it('maps normal dns events to INFO logs', () => {
    const result = mapNextDnsEventToPiglogLog({
      timestamp: '2026-04-24T12:00:00.000Z',
      status: 'resolved',
      query: 'google.com',
      clientIp: '192.168.1.1',
    });

    expect(result.level).toBe('INFO');
    expect(result.host).toBe('192.168.1.1');
  });
});
