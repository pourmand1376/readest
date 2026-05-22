import type { CustomBackendConfig } from '@/types/settings';

export class BackendConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackendConfigError';
  }
}

/**
 * Returns true when `url` refers to a loopback or private-network address
 * that is acceptable for plain HTTP (e.g. local development or a self-hosted
 * server on a home/office LAN). Remote public addresses must use HTTPS.
 *
 * Allowed ranges:
 *  - loopback:          127.x.x.x, ::1, localhost
 *  - link-local:        169.254.x.x, fe80::/10
 *  - private class A:   10.x.x.x
 *  - private class B:   172.16.x.x – 172.31.x.x
 *  - private class C:   192.168.x.x
 *  - mDNS / local DNS:  *.local, *.lan, *.internal
 */
const isLocalAddress = (url: URL): boolean => {
  const h = url.hostname;

  // Named loopback / mDNS suffixes
  if (h === 'localhost') return true;
  if (h.endsWith('.local') || h.endsWith('.lan') || h.endsWith('.internal')) return true;

  // IPv6 loopback / link-local
  if (h === '::1') return true;
  if (/^fe[89ab][0-9a-f]:/i.test(h)) return true; // fe80::/10

  // IPv4 – parse octets once
  const parts = h.split('.');
  if (parts.length === 4) {
    const [o1, o2] = parts.map(Number);
    if (o1 === 127) return true; // 127.0.0.0/8 loopback
    if (o1 === 10) return true; // 10.0.0.0/8
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true; // 172.16.0.0/12
    if (o1 === 192 && o2 === 168) return true; // 192.168.0.0/16
    if (o1 === 169 && o2 === 254) return true; // 169.254.0.0/16 link-local
  }

  return false;
};

/**
 * Fetch client-safe configuration from a self-hosted Readest backend.
 *
 * The endpoint returns the Supabase anon key and public URLs. While the anon
 * key is a *public* JWT by Supabase design (already embedded in client
 * bundles), it must still only travel over an encrypted connection. HTTP is
 * therefore rejected for public (non-private-network) addresses.
 *
 * @param backendUrl  Base URL of the self-hosted server. Trailing slashes are
 *                    stripped automatically, so both `https://host` and
 *                    `https://host/` are accepted.
 * @returns           Resolved `CustomBackendConfig` on success.
 * @throws            `BackendConfigError` if the URL uses plain HTTP on a public address,
 *                    if the request fails, or if the response is invalid.
 */
export const fetchBackendConfig = async (backendUrl: string): Promise<CustomBackendConfig> => {
  const base = backendUrl.replace(/\/+$/, '');

  let parsed: URL;
  try {
    parsed = new URL(base);
  } catch {
    throw new BackendConfigError(`Invalid URL: ${base}`);
  }

  if (parsed.protocol === 'http:' && !isLocalAddress(parsed)) {
    throw new BackendConfigError(
      'Backend URL must use HTTPS to protect credentials in transit. ' +
        'Plain HTTP is only allowed for local/private network addresses.',
    );
  }

  let response: Response;
  try {
    response = await fetch(`${base}/api/config`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    throw new BackendConfigError(
      `Unable to reach ${base}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!response.ok) {
    throw new BackendConfigError(`Backend returned HTTP ${response.status}`);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new BackendConfigError('Backend returned invalid JSON');
  }

  const cfg = json as Record<string, unknown>;
  if (
    typeof cfg['supabaseUrl'] !== 'string' ||
    typeof cfg['supabaseAnonKey'] !== 'string' ||
    typeof cfg['apiBaseUrl'] !== 'string'
  ) {
    throw new BackendConfigError('Backend config is missing required fields');
  }
  if (!cfg['supabaseUrl'] || !cfg['supabaseAnonKey'] || !cfg['apiBaseUrl']) {
    throw new BackendConfigError(
      'Backend config contains empty values — the server may not be fully configured',
    );
  }

  return {
    supabaseUrl: cfg['supabaseUrl'],
    supabaseAnonKey: cfg['supabaseAnonKey'],
    apiBaseUrl: cfg['apiBaseUrl'],
  };
};
