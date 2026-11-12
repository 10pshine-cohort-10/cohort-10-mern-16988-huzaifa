import express, { type ErrorRequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { ZodError } from 'zod';
import type { Logger } from 'pino';
import type { Config } from './config.js';
import type { Repository, User } from './repository.js';
import { AuthService, parseId, parseNote } from './services.js';
import { AppError } from './errors.js';

export function createApp(repo: Repository, config: Config, logger: Logger) {
  const app = express();
  const auth = new AuthService(repo, config.sessionHours);
  const cookieName = config.production
    ? '__Host-shine_session'
    : 'shine_session';
  const cookieOptions = {
    httpOnly: true,
    secure: config.production,
    sameSite: 'lax' as const,
    path: '/',
  };
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    pinoHttp({
      logger,
      genReqId: () => randomUUID(),
      serializers: {
        req: (req) => ({
          id: req.id,
          method: req.method,
          path: req.url?.split('?')[0],
        }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use((req, res, next) => {
    res.setHeader('X-Request-Id', String(req.id));
    next();
  });
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', (req, _res, next) => {
    if (
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
      req.get('Origin') !== config.origin
    )
      throw new AppError(403, 'Request origin is not allowed.');
    next();
  });
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many sign-in attempts. Try again later.' },
  });
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.post('/api/auth/register', authLimiter, async (req, res) => {
    const result = await auth.register(req.body);
    res.cookie(cookieName, result.token, {
      ...cookieOptions,
      maxAge: config.sessionHours * 3600000,
    });
    req.log.info(
      { event: 'user_registered', userId: result.user.id },
      'User registered',
    );
    res.status(201).json({ user: result.user });
  });
  app.post('/api/auth/login', authLimiter, async (req, res) => {
    const result = await auth.login(req.body);
    res.cookie(cookieName, result.token, {
      ...cookieOptions,
      maxAge: config.sessionHours * 3600000,
    });
    req.log.info(
      { event: 'user_logged_in', userId: result.user.id },
      'User signed in',
    );
    res.json({ user: result.user });
  });
  app.post('/api/auth/logout', async (req, res) => {
    const token: unknown = req.cookies[cookieName];
    if (typeof token === 'string' && /^[a-f0-9]{64}$/.test(token))
      await auth.logout(token);
    res.clearCookie(cookieName, cookieOptions);
    req.log.info({ event: 'user_logged_out' }, 'User signed out');
    res.sendStatus(204);
  });
  app.use('/api', async (req, res, next) => {
    res.locals.user = await auth.authenticate(req.cookies[cookieName]);
    next();
  });
  app.get('/api/auth/me', (_req, res) => {
    res.json({ user: res.locals.user as User });
  });
  app.get('/api/notes', async (_req, res) => {
    res.json({ notes: await repo.listNotes((res.locals.user as User).id) });
  });
  app.post('/api/notes', async (req, res) => {
    const note = await repo.createNote(
      (res.locals.user as User).id,
      parseNote(req.body),
    );
    req.log.info(
      {
        event: 'note_created',
        userId: (res.locals.user as User).id,
        noteId: note.id,
      },
      'Note created',
    );
    res.status(201).json({ note });
  });
  app.get('/api/notes/:id', async (req, res) => {
    const note = await repo.getNote(
      (res.locals.user as User).id,
      parseId(req.params.id),
    );
    if (!note) throw new AppError(404, 'Note not found.');
    res.json({ note });
  });
  app.put('/api/notes/:id', async (req, res) => {
    const note = await repo.updateNote(
      (res.locals.user as User).id,
      parseId(req.params.id),
      parseNote(req.body),
    );
    if (!note) throw new AppError(404, 'Note not found.');
    req.log.info(
      {
        event: 'note_updated',
        userId: (res.locals.user as User).id,
        noteId: note.id,
      },
      'Note updated',
    );
    res.json({ note });
  });
  app.delete('/api/notes/:id', async (req, res) => {
    const id = parseId(req.params.id);
    if (!(await repo.deleteNote((res.locals.user as User).id, id)))
      throw new AppError(404, 'Note not found.');
    req.log.info(
      {
        event: 'note_deleted',
        userId: (res.locals.user as User).id,
        noteId: id,
      },
      'Note deleted',
    );
    res.sendStatus(204);
  });
  app.use('/api', () => {
    throw new AppError(404, 'Endpoint not found.');
  });
  const clientDist = fileURLToPath(
    new URL('../../client/dist/', import.meta.url),
  );
  if (existsSync(clientDist)) app.use(express.static(clientDist));
  app.use((_req, res) => {
    res.status(404).json({ error: 'Page not found.' });
  });
  const handleError: ErrorRequestHandler = (
    error: unknown,
    req,
    res,
    _next,
  ) => {
    let status = 500;
    let message = 'Something went wrong. Please try again.';
    if (error instanceof AppError) {
      status = error.status;
      message = error.message;
    } else if (error instanceof ZodError) {
      status = 400;
      message = error.issues[0]?.message ?? 'Check your input.';
    } else if (typeof error === 'object' && error !== null && 'type' in error) {
      if (error.type === 'entity.parse.failed') {
        status = 400;
        message = 'Request body must be valid JSON.';
      }
      if (error.type === 'entity.too.large') {
        status = 413;
        message = 'This note is too large.';
      }
    }
    const detail = {
      event: 'request_failed',
      status,
      errorType: error instanceof Error ? error.name : 'UnknownError',
    };
    if (status >= 500) req.log.error(detail, 'Request failed');
    else req.log.warn(detail, message);
    res.status(status).json({ error: message, requestId: String(req.id) });
  };
  app.use(handleError);
  return app;
}
