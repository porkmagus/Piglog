import { describe, expect, it } from 'vitest';
import { getGlobalRateLimitKey, shouldBypassGlobalRateLimit } from './rate-limit.js';

describe('shouldBypassGlobalRateLimit', () => {
  it('bypasses auth session checks', () => {
    expect(shouldBypassGlobalRateLimit({ method: 'GET', url: '/auth/get-session' })).toBe(true);
  });

  it('bypasses workspace bootstrap fetches used by the app shell', () => {
    expect(shouldBypassGlobalRateLimit({ method: 'GET', url: '/workspaces' })).toBe(true);
  });

  it('does not bypass normal application routes', () => {
    expect(shouldBypassGlobalRateLimit({ method: 'POST', url: '/auth/sign-in/email' })).toBe(false);
    expect(shouldBypassGlobalRateLimit({ method: 'POST', url: '/workspaces' })).toBe(false);
    expect(shouldBypassGlobalRateLimit({ method: 'GET', url: '/workspaces/123/analytics/overview' })).toBe(false);
  });
});

describe('getGlobalRateLimitKey', () => {
  it('uses auth session cookie when present', () => {
    expect(
      getGlobalRateLimitKey({
        ip: '127.0.0.1',
        headers: {
          cookie: 'foo=bar; better-auth.session_token=token-123; another=value',
        },
      })
    ).toBe('session:token-123');
  });

  it('falls back to request ip when auth cookie is missing', () => {
    expect(getGlobalRateLimitKey({ ip: '127.0.0.1', headers: {} })).toBe('ip:127.0.0.1');
  });
});
