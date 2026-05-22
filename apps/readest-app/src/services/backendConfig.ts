import type { CustomBackendConfig } from '@/types/settings';

export class BackendConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackendConfigError';
  }
}

/**
 * Fetch client-safe configuration from a self-hosted Readest backend.
 *
 * @param backendUrl  Base URL of the self-hosted server (trailing slash optional).
 * @returns           Resolved `CustomBackendConfig` on success.
 * @throws            `BackendConfigError` if the request fails or the response is invalid.
 */
export const fetchBackendConfig = async (backendUrl: string): Promise<CustomBackendConfig> => {
  const base = backendUrl.replace(/\/+$/, '');
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
