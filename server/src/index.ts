import { createApp } from './app.js';
import { getConfig } from './config.js';
import { createPool } from './db.js';
import { createLogger } from './logger.js';
import { Repository } from './repository.js';
const config = getConfig();
const logger = createLogger(config.logLevel);
const pool = createPool(config);
pool.on('error', () => {
  logger.error('Unexpected idle database connection error');
});
try {
  await pool.query('SELECT 1');
  const server = createApp(new Repository(pool), config, logger).listen(
    config.port,
    () => logger.info({ port: config.port }, 'Shine Notes is ready'),
  );
  const shutdown = () => {
    const force = setTimeout(() => {
      logger.error('Shutdown timed out');
      process.exit(1);
    }, 10000).unref();
    server.close(() => {
      void pool
        .end()
        .then(() => {
          clearTimeout(force);
          process.exit(0);
        })
        .catch(() => process.exit(1));
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch {
  logger.fatal(
    'Unable to connect to the database. Check DATABASE_URL and run the migration.',
  );
  await pool.end();
  process.exitCode = 1;
}
