import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const driver = (process.env.DB_DRIVER || (process.env.DATABASE_URL ? 'postgres' : 'pglite')).toLowerCase();

function normalizeResult(result) {
  return { ...result, rows: result.rows || [], rowCount: result.rowCount ?? result.affectedRows ?? 0 };
}

async function createPGlitePool() {
  const { PGlite } = await import('@electric-sql/pglite');
  const dataDir = resolve(process.env.PGLITE_DATA_DIR || fileURLToPath(new URL('../../.data/pglite', import.meta.url)));
  await mkdir(dirname(dataDir), { recursive: true });
  const db = await PGlite.create(dataDir);
  let queue = Promise.resolve();

  const acquire = async () => {
    const previous = queue;
    let release;
    queue = new Promise(resolve => { release = resolve; });
    await previous;
    return release;
  };
  const rawQuery = async (sql, params = []) => normalizeResult(await db.query(sql, params));

  return {
    driver: 'pglite',
    dataDir,
    async query(sql, params = []) {
      const release = await acquire();
      try { return await rawQuery(sql, params); } finally { release(); }
    },
    async exec(sql) {
      const release = await acquire();
      try { return await db.exec(sql); } finally { release(); }
    },
    async connect() {
      const release = await acquire();
      let released = false;
      return {
        query: rawQuery,
        release() {
          if (!released) { released = true; release(); }
        }
      };
    },
    on() {},
    async end() { await queue; await db.close(); }
  };
}

async function createPostgresPool() {
  const { default: pg } = await import('pg');
  const { Pool } = pg;
  const cloudSqlConfig = process.env.INSTANCE_UNIX_SOCKET ? {
    host: process.env.INSTANCE_UNIX_SOCKET,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    max: Number(process.env.DB_POOL_MAX || 5),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  } : null;
  const postgresPool = new Pool(cloudSqlConfig || {
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DB_POOL_MAX || 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });
  postgresPool.driver = 'postgres';
  postgresPool.exec = sql => postgresPool.query(sql);
  postgresPool.on('error', error => console.error('Unexpected database pool error:', error.message));
  return postgresPool;
}

if (!['pglite', 'postgres'].includes(driver)) {
  throw new Error(`Unsupported DB_DRIVER "${driver}". Use "pglite" or "postgres".`);
}

export const pool = driver === 'pglite' ? await createPGlitePool() : await createPostgresPool();
