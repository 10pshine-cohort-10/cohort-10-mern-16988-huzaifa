import pg from 'pg';
import type { Config } from './config.js';
export function createPool(config: Config): pg.Pool {
  return new pg.Pool({
    connectionString: config.databaseUrl,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });
}
