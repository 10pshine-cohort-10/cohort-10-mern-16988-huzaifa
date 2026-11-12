import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import pino from 'pino';
import { createApp } from '../src/app.js';
import { Repository } from '../src/repository.js';
import { getConfig } from '../src/config.js';
const database = new PGlite();
await database.exec(
  await readFile(new URL('../src/schema.sql', import.meta.url), 'utf8'),
);
const repo = new Repository({
  query: (sql: string, values?: unknown[]) =>
    database.query<Record<string, unknown>>(sql, values),
});
const server = createApp(
  repo,
  getConfig({
    DATABASE_URL: 'postgresql://test:test@localhost/test',
    NODE_ENV: 'test',
    APP_ORIGIN: 'http://localhost:4179',
    PORT: '4179',
  }),
  pino({ level: 'silent' }),
).listen(4179);
const stop = () =>
  server.close(() => {
    void database.close().then(() => process.exit(0));
  });
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
