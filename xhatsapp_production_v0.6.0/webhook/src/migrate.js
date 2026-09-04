import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from './db.js';

const directory = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = join(directory, '..', 'migrations');
const files = (await readdir(migrationsDirectory))
  .filter((name) => /^\d+_[a-z0-9_]+\.sql$/i.test(name))
  .sort();
const client = await pool.connect();

try {
  await client.query('SELECT pg_advisory_lock(984_271_001)');
  await client.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`,
  );

  for (const file of files) {
    const version = file.replace(/\.sql$/, '');
    const applied = await client.query(
      'SELECT 1 FROM schema_migrations WHERE version = $1',
      [version],
    );
    if (applied.rowCount === 1) continue;

    const migration = await readFile(join(migrationsDirectory, file), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(migration);
      await client.query(
        'INSERT INTO schema_migrations (version) VALUES ($1)',
        [version],
      );
      await client.query('COMMIT');
      console.log('Database migration complete', { version });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} catch (error) {
  throw error;
} finally {
  await client.query('SELECT pg_advisory_unlock(984_271_001)');
  client.release();
  await pool.end();
}
