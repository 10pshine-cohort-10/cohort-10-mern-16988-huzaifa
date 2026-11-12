import pino from 'pino';
export function createLogger(level: string = 'info') {
  return pino({
    level,
    redact: {
      paths: [
        'password',
        'passwordHash',
        'token',
        'req.headers.cookie',
        'req.headers.authorization',
        'res.headers.set-cookie',
      ],
      remove: true,
    },
  });
}
