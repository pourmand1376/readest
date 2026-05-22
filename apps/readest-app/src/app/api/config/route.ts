import { NextResponse } from 'next/server';
import { getServerRuntimeConfig } from '@/services/runtimeConfig';

export const dynamic = 'force-dynamic';

/**
 * Public endpoint that returns the client-safe backend configuration for
 * native (Tauri) apps connecting to a self-hosted Readest server.
 *
 * Security notes:
 * - The Supabase "anon key" is a public JWT by design — it is already embedded
 *   in every web client bundle (NEXT_PUBLIC_SUPABASE_ANON_KEY) and is not a
 *   secret. Its sole purpose is to identify the project; actual access control
 *   is enforced by Supabase Row Level Security policies.
 * - The service/admin key (SUPABASE_ADMIN_KEY) is never returned here.
 * - This endpoint MUST be served over HTTPS in production. The native client
 *   enforces this: plain-HTTP connections to non-localhost origins are rejected
 *   in fetchBackendConfig().
 */
export function GET() {
  const config = getServerRuntimeConfig();
  return NextResponse.json({
    supabaseUrl: config.supabaseUrl ?? '',
    supabaseAnonKey: config.supabaseAnonKey ?? '',
    apiBaseUrl: config.apiBaseUrl ?? '',
  });
}
