interface RateLimitRequestLike {
  method: string;
  url: string;
  ip: string;
  headers: {
    cookie?: string;
  };
}

function getCookieValue(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (rawName === name) {
      return rawValue.join('=');
    }
  }

  return null;
}

export function shouldBypassGlobalRateLimit(req: Pick<RateLimitRequestLike, 'method' | 'url'>) {
  return req.method === 'GET' && (req.url === '/auth/get-session' || req.url === '/workspaces');
}

export function getGlobalRateLimitKey(req: Pick<RateLimitRequestLike, 'ip' | 'headers'>) {
  const sessionToken = getCookieValue(req.headers.cookie, 'better-auth.session_token');
  if (sessionToken) {
    return `session:${sessionToken}`;
  }

  return `ip:${req.ip}`;
}
