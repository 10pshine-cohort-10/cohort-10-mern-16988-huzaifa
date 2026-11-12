import { readFile } from 'node:fs/promises';
import { createPool } from './db.js';
import { getConfig } from './config.js';
import { createLogger } from './logger.js';
const config = getConfig();
const logger = createLogger(config.logLevel);
const pool = createPool(config);
try {
  await pool.query(
    await readFile(new URL('./schema.sql', import.meta.url), 'utf8'),
  );
  logger.info('Database schema is ready');
} catch {
  logger.error('Database migration failed. Check the database connection.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
