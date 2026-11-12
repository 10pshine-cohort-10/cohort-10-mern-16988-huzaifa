import { Writable } from 'node:stream';
import { expect } from 'chai';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import pino from 'pino';
import { createApp } from '../src/app.js';
import { Repository } from '../src/repository.js';
import { getConfig } from '../src/config.js';

const origin = 'http://localhost:5173';
const credentials = {
  name: 'Demo Writer',
  email: 'writer@example.test',
  password: 'a long test password 123!',
};

describe('Notes API with PostgreSQL', function () {
  this.timeout(30000);
  let database: PGlite;
  let app: ReturnType<typeof createApp>;
  let repo: Repository;
  const config = getConfig({
    NODE_ENV: 'test',
    APP_ORIGIN: origin,
    DATABASE_URL: 'postgres://test:test@localhost/test',
  });
  before(async () => {
    database = new PGlite();
    await database.exec(
      await readFile(new URL('../src/schema.sql', import.meta.url), 'utf8'),
    );
    repo = new Repository({
      query: async (sql: string, values?: unknown[]) =>
        database.query<Record<string, unknown>>(sql, values),
    });
    app = createApp(repo, config, pino({ level: 'silent' }));
  });
  after(async () => {
    if (database) await database.close();
  });
  beforeEach(async () => {
    await database.exec('TRUNCATE sessions, notes, users CASCADE');
  });
  const register = (email = credentials.email) =>
    request
      .agent(app)
      .post('/api/auth/register')
      .set('Origin', origin)
      .send({ ...credentials, email });
  async function signedIn(email = credentials.email) {
    const agent = request.agent(app);
    await agent
      .post('/api/auth/register')
      .set('Origin', origin)
      .send({ ...credentials, email })
      .expect(201);
    return agent;
  }
  it('registers without returning passwords, persists a session, and revokes logout', async () => {
    const agent = request.agent(app);
    const response = await agent
      .post('/api/auth/register')
      .set('Origin', origin)
      .send(credentials)
      .expect(201);
    expect(response.body.user).to.include({
      name: credentials.name,
      email: credentials.email,
    });
    expect(Object.keys(response.body.user)).to.have.members([
      'id',
      'name',
      'email',
    ]);
    const cookie = response.headers['set-cookie'][0];
    expect(cookie).to.include('HttpOnly').and.include('SameSite=Lax');
    await agent.get('/api/auth/me').expect(200);
    await agent.post('/api/auth/logout').set('Origin', origin).expect(204);
    await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie.split(';')[0])
      .expect(401);
    const rows = await database.query<{ password_hash: string }>(
      'SELECT password_hash FROM users',
    );
    expect(rows.rows[0].password_hash).not.to.equal(credentials.password);
  });
  it('allows login with normalized email and rejects wrong credentials', async () => {
    await register().expect(201);
    await request(app)
      .post('/api/auth/login')
      .set('Origin', origin)
      .send({ email: ' WRITER@EXAMPLE.TEST ', password: credentials.password })
      .expect(200);
    const bad = await request(app)
      .post('/api/auth/login')
      .set('Origin', origin)
      .send({ email: credentials.email, password: 'wrong password' })
      .expect(401);
    expect(bad.body.error).to.equal('Email or password is incorrect.');
  });
  it('rejects duplicate accounts and invalid input', async () => {
    await register().expect(201);
    await register().expect(409);
    await request(app)
      .post('/api/auth/register')
      .set('Origin', origin)
      .send({ ...credentials, email: 'invalid', password: 'short' })
      .expect(400);
  });
  it('requires a session and a matching origin for changes', async () => {
    await request(app).get('/api/notes').expect(401);
    await request(app).post('/api/auth/register').send(credentials).expect(403);
    await request(app)
      .post('/api/auth/register')
      .set('Origin', 'https://evil.example')
      .send(credentials)
      .expect(403);
  });
  it('creates, reads, updates and deletes sanitized rich text notes', async () => {
    const agent = await signedIn();
    const created = await agent
      .post('/api/notes')
      .set('Origin', origin)
      .send({
        title: 'First note',
        content:
          '<h2>Hello</h2><p><strong>World</strong><script>alert(1)</script><img src=x onerror=alert(2)><a href="javascript:alert(3)">link</a></p>',
      })
      .expect(201);
    const id = created.body.note.id;
    expect(created.body.note.content)
      .to.include('<strong>World</strong>')
      .and.not.include('<script')
      .and.not.include('onerror')
      .and.not.include('javascript:');
    const list = await agent.get('/api/notes').expect(200);
    expect(list.body.notes).to.have.length(1);
    await agent.get('/api/notes/' + id).expect(200);
    const updated = await agent
      .put('/api/notes/' + id)
      .set('Origin', origin)
      .send({ title: 'Updated', content: '<p>new text</p>' })
      .expect(200);
    expect(updated.body.note.title).to.equal('Updated');
    await agent
      .delete('/api/notes/' + id)
      .set('Origin', origin)
      .expect(204);
    await agent.get('/api/notes/' + id).expect(404);
  });
  it('prevents another user from listing, reading, editing, or deleting a note', async () => {
    const owner = await signedIn();
    const created = await owner
      .post('/api/notes')
      .set('Origin', origin)
      .send({ title: 'Private', content: '<p>Secret</p>' })
      .expect(201);
    const other = await signedIn('other@example.test');
    expect(
      (await other.get('/api/notes').expect(200)).body.notes,
    ).to.deep.equal([]);
    const url = '/api/notes/' + created.body.note.id;
    await other.get(url).expect(404);
    await other
      .put(url)
      .set('Origin', origin)
      .send({ title: 'Stolen', content: '<p>no</p>' })
      .expect(404);
    await other.delete(url).set('Origin', origin).expect(404);
    expect((await owner.get(url).expect(200)).body.note.title).to.equal(
      'Private',
    );
  });
  it('rejects expired sessions and malformed note identifiers', async () => {
    const agent = await signedIn();
    await agent.get('/api/notes/not-an-id').expect(400);
    await database.exec(
      "UPDATE sessions SET expires_at = NOW() - INTERVAL '1 second'",
    );
    await agent.get('/api/notes').expect(401);
  });
  it('rejects blank and oversized notes, malformed JSON, and oversized bodies', async () => {
    const agent = await signedIn();
    await agent
      .post('/api/notes')
      .set('Origin', origin)
      .send({ title: ' ', content: '<p></p>' })
      .expect(400);
    await agent
      .post('/api/notes')
      .set('Origin', origin)
      .send({ title: 'x'.repeat(201), content: '<p>text</p>' })
      .expect(400);
    await agent
      .post('/api/notes')
      .set('Origin', origin)
      .set('Content-Type', 'application/json')
      .send('{bad')
      .expect(400);
    await agent
      .post('/api/notes')
      .set('Origin', origin)
      .send({ title: 'Long', content: 'x'.repeat(300000) })
      .expect(413);
  });
  it('hides internal failures and exposes a request identifier', async () => {
    const broken = new Repository({
      query: async () => {
        throw new Error('private database credentials');
      },
    });
    const failing = createApp(broken, config, pino({ level: 'silent' }));
    const response = await request(failing)
      .post('/api/auth/login')
      .set('Origin', origin)
      .send(credentials)
      .expect(500);
    expect(response.body.error).to.equal(
      'Something went wrong. Please try again.',
    );
    expect(response.body.requestId).to.be.a('string');
    expect(JSON.stringify(response.body)).not.to.include('credentials');
  });
  it('keeps SQL parameters separate from attacker-controlled note text', async () => {
    const agent = await signedIn();
    const title = "'; DROP TABLE users; --";
    await agent
      .post('/api/notes')
      .set('Origin', origin)
      .send({ title, content: '<p>safe</p>' })
      .expect(201);
    expect((await agent.get('/api/notes')).body.notes[0].title).to.equal(title);
    expect((await database.query('SELECT id FROM users')).rows).to.have.length(
      1,
    );
  });
  it('allows clearing an expired session on logout', async () => {
    const agent = await signedIn();
    await database.exec(
      "UPDATE sessions SET expires_at=NOW()-INTERVAL '1 second'",
    );
    await agent.post('/api/auth/logout').set('Origin', origin).expect(204);
    await agent.get('/api/auth/me').expect(401);
  });
  it('applies changed origins and production cookie settings at the HTTP boundary', async () => {
    const origin = 'https://notes.example';
    const production = createApp(
      repo,
      getConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://demo:demo@localhost/custom',
        APP_ORIGIN: origin,
        SESSION_HOURS: '8',
        PORT: '4321',
      }),
      pino({ level: 'silent' }),
    );
    await request(production)
      .post('/api/auth/register')
      .set('Origin', 'http://localhost:5173')
      .send(credentials)
      .expect(403);
    const response = await request(production)
      .post('/api/auth/register')
      .set('Origin', origin)
      .send(credentials)
      .expect(201);
    const cookie = response.headers['set-cookie'][0];
    expect(cookie)
      .to.include('__Host-shine_session=')
      .and.include('Secure')
      .and.include('HttpOnly')
      .and.include('Max-Age=28800')
      .and.include('Path=/');
  });
  it('logs request, response and user events without credentials or note contents', async () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, done) {
        lines.push(chunk.toString());
        done();
      },
    });
    const loggingApp = createApp(repo, config, pino({ level: 'info' }, stream));
    const agent = request.agent(loggingApp);
    const registration = await agent
      .post('/api/auth/register')
      .set('Origin', origin)
      .send(credentials)
      .expect(201);
    await agent
      .post('/api/notes')
      .set('Origin', origin)
      .send({
        title: 'private-title-marker',
        content: '<p>private-content-marker</p>',
      })
      .expect(201);
    const output = lines.join('');
    expect(output)
      .to.include('user_registered')
      .and.include('note_created')
      .and.include('statusCode')
      .and.include('request completed');
    expect(output)
      .not.to.include(credentials.password)
      .and.not.include('private-title-marker')
      .and.not.include('private-content-marker');
    const token = registration.headers['set-cookie'][0]
      .split(';')[0]
      .split('=')[1];
    expect(output).not.to.include(token);
  });
});
