function splitAndTrim(value?: string): string[] {
  return value
    ?.split(',')
    .map((entry) => entry.trim())
    .filter(Boolean) ?? [];
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function withHttp(origin: string) {
  return stripTrailingSlash(origin.startsWith('http') ? origin : `http://${origin}`);
}

function getOriginAliases(origin: string) {
  const normalized = withHttp(origin);

  try {
    const url = new URL(normalized);
    const aliases = new Set<string>([stripTrailingSlash(url.origin)]);

    if (!url.port && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      if (url.hostname.startsWith('www.')) {
        const apexHostname = url.hostname.slice(4);
        const apexUrl = new URL(url.origin);
        apexUrl.hostname = apexHostname;
        aliases.add(stripTrailingSlash(apexUrl.origin));
      } else if (url.hostname.includes('.')) {
        const wwwUrl = new URL(url.origin);
        wwwUrl.hostname = `www.${url.hostname}`;
        aliases.add(stripTrailingSlash(wwwUrl.origin));
      }
    }

    return [...aliases];
  } catch {
    return [normalized];
  }
}

function getAppSubdomainAlias(origin: string): string | undefined {
  try {
    const url = new URL(withHttp(origin));
    if (url.hostname.startsWith('api.')) {
      url.hostname = `app.${url.hostname.slice(4)}`;
      return stripTrailingSlash(url.origin);
    }
  } catch {
    // ignore
  }
  return undefined;
}

function createPortRange(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, index) => String(start + index));
}

function requireInProduction(name: string, value?: string) {
  if (process.env.NODE_ENV === 'production' && !value) {
    throw new Error(`${name} must be set in production`);
  }
  return value;
}

export function getTrustedOrigins() {
  if (process.env.NODE_ENV !== 'production') {
    const configured = splitAndTrim(process.env.APP_URL).flatMap(getOriginAliases);
    const ports = [...createPortRange(5173, 5199), '4173', '3000'];
    const hosts = ['localhost', '127.0.0.1'];
    const origins = new Set(configured);

    for (const host of hosts) {
      for (const port of ports) {
        origins.add(`http://${host}:${port}`);
      }
    }

    return [...origins];
  }

  const appOrigins = splitAndTrim(requireInProduction('APP_URL', process.env.APP_URL)).flatMap(getOriginAliases);
  const frontendOrigins = splitAndTrim(process.env.FRONTEND_URL || '').flatMap(getOriginAliases);
  const apiOrigins = splitAndTrim(process.env.API_URL || process.env.BETTER_AUTH_URL || '').flatMap(getOriginAliases);
  const inferredAppOrigins = apiOrigins
    .map(getAppSubdomainAlias)
    .filter((o): o is string => Boolean(o));
  const origins = [...new Set([...appOrigins, ...frontendOrigins, ...apiOrigins, ...inferredAppOrigins])];
  if (origins.length === 0) {
    throw new Error('APP_URL must include at least one origin in production');
  }

  return origins;
}

export function getPrimaryAppUrl() {
  return getTrustedOrigins()[0] || 'http://localhost:5173';
}

export function getApiBaseUrl() {
  const configuredValue = process.env.BETTER_AUTH_URL || process.env.API_URL;
  const configured = configuredValue ? stripTrailingSlash(configuredValue) : undefined;
  const fallback = process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:3001';

  return requireInProduction('BETTER_AUTH_URL or API_URL', configured) || fallback;
}

export function getAuthSecret() {
  const secret = process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET;
  const fallback = process.env.NODE_ENV === 'production'
    ? undefined
    : 'dev_secret_not_secure_but_fine_for_local_development';

  return requireInProduction('BETTER_AUTH_SECRET', secret) || fallback;
}
