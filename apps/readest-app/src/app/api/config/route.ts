import { NextResponse } from 'next/server';
import { getServerRuntimeConfig } from '@/services/runtimeConfig';

export const dynamic = 'force-dynamic';

/**
 * Public endpoint that returns the client-safe backend configuration.
 * Native (Tauri) apps connecting to a self-hosted Readest backend call this
 * endpoint to discover the Supabase URL/key and API base URL without the user
 * needing to know those details.
 *
 * This route is intentionally unauthenticated — it only exposes values that
 * are already public (anon key, public URLs).
 */
export function GET() {
  const config = getServerRuntimeConfig();
  return NextResponse.json({
    supabaseUrl: config.supabaseUrl ?? '',
    supabaseAnonKey: config.supabaseAnonKey ?? '',
    apiBaseUrl: config.apiBaseUrl ?? '',
  });
}
