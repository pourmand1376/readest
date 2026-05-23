/**
 * Next.js instrumentation hook – runs once when the server process starts.
 *
 * When POSTGRES_URL is present (self-hosted Docker deployments) this applies
 * every SQL migration file found in docker/volumes/db/migrations/ directly
 * against the database using the postgres superuser connection.
 *
 * All migration files are idempotent (IF NOT EXISTS / CREATE OR REPLACE /
 * DROP CONSTRAINT IF EXISTS), so re-running them on an already-migrated
 * database is safe.
 */

export async function register() {
  if (process.env['NEXT_RUNTIME'] !== 'nodejs') return;

  const postgresUrl = process.env['POSTGRES_URL'];
  if (!postgresUrl) return;

  const { Client } = await import('pg');
  const fs = await import('node:fs');
  const path = await import('node:path');

  // docker/volumes/db/migrations/ relative to the repo root, which is two
  // levels above the Next.js app working directory (/app/apps/readest-app).
  const migrationsDir = path.resolve(process.cwd(), '../../docker/volumes/db/migrations');

  if (!fs.existsSync(migrationsDir)) {
    console.warn('[db-migrate] Migrations directory not found, skipping:', migrationsDir);
    return;
  }

  // Retry until the database is ready (it may still be starting up).
  let client: InstanceType<typeof Client> | null = null;
  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      client = new Client({ connectionString: postgresUrl });
      await client.connect();
      break;
    } catch {
      client = null;
      if (attempt < 30) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else {
        console.error(
          '[db-migrate] Could not connect to database after 30 attempts – skipping migrations.',
        );
        return;
      }
    }
  }

  if (!client) return;

  try {
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      try {
        await client.query(sql);
        console.log('[db-migrate] Applied:', file);
      } catch (err) {
        // Log but continue – a previously applied migration may produce
        // a benign error (e.g., duplicate object) even with IF NOT EXISTS.
        console.warn('[db-migrate] Warning while applying', file, '–', (err as Error).message);
      }
    }
  } finally {
    await client.end();
  }
}
