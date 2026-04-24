const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function fetchApi(path: string, options?: RequestInit) {
  const hasBody = options?.body !== undefined;
  const headers: Record<string, string> = {
    ...options?.headers as Record<string, string>,
  };
  if (hasBody && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error');
    let message = text;
    try {
      const parsed = JSON.parse(text);
      message = parsed.error || text;
    } catch {
      message = text || `HTTP ${response.status}`;
    }
    throw new Error(message);
  }

  const contentType = response.headers.get('content-type');
  if (response.status === 204 || !contentType || !contentType.includes('application/json')) {
    return null;
  }

  return response.json();
}
