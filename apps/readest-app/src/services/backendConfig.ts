import type { CustomBackendConfig } from '@/types/settings';

export class BackendConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackendConfigError';
  }
}

/**
 * Returns true when `url` refers to a loopback address that is acceptable for
 * plain HTTP (e.g. local development). All other origins must use HTTPS.
 */
const isLocalhost = (url: URL) =>
  url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';

/**
 * Fetch client-safe configuration from a self-hosted Readest backend.
 *
 * The endpoint returns the Supabase anon key and public URLs. While the anon
 * key is a *public* JWT by Supabase design (already embedded in client
 * bundles), it must still only travel over an encrypted connection. HTTP is
 * therefore rejected for all non-localhost origins.
 *
 * @param backendUrl  Base URL of the self-hosted server. Trailing slashes are
 *                    stripped automatically, so both `https://host` and
 *                    `https://host/` are accepted.
 * @returns           Resolved `CustomBackendConfig` on success.
 * @throws            `BackendConfigError` if the URL uses plain HTTP (non-localhost),
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

  if (parsed.protocol === 'http:' && !isLocalhost(parsed)) {
    throw new BackendConfigError(
      'Backend URL must use HTTPS to protect credentials in transit. ' +
        'Plain HTTP is only allowed for localhost.',
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
