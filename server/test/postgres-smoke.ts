import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import pino from 'pino';
import { createApp } from '../src/app.js';
import { getConfig } from '../src/config.js';
import { createPool } from '../src/db.js';
import { Repository } from '../src/repository.js';
const config = getConfig();
const pool = createPool(config);
const server = createApp(
  new Repository(pool),
  config,
  pino({ level: 'silent' }),
).listen(0, '127.0.0.1');
let userId: string | undefined;
try {
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = 'http://127.0.0.1:' + address.port;
  const registration = await fetch(base + '/api/auth/register', {
    method: 'POST',
    headers: { Origin: config.origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Integration Demo',
      email: 'smoke-' + randomUUID() + '@example.test',
      password: 'a temporary integration passphrase',
    }),
  });
  assert.equal(registration.status, 201);
  const account = (await registration.json()) as { user: { id: string } };
  userId = account.user.id;
  const cookie = registration.headers.get('set-cookie')?.split(';')[0];
  assert(cookie);
  const headers = {
    Origin: config.origin,
    'Content-Type': 'application/json',
    Cookie: cookie,
  };
  const created = await fetch(base + '/api/notes', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: 'PostgreSQL smoke note',
      content: '<p><strong>Persisted</strong> over TCP</p>',
    }),
  });
  assert.equal(created.status, 201);
  const { note } = (await created.json()) as { note: { id: string } };
  const list = await fetch(base + '/api/notes', { headers });
  assert.equal(list.status, 200);
  assert.equal(((await list.json()) as { notes: unknown[] }).notes.length, 1);
  const updated = await fetch(base + '/api/notes/' + note.id, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      title: 'Updated smoke note',
      content: '<p>Updated</p>',
    }),
  });
  assert.equal(updated.status, 200);
  const deleted = await fetch(base + '/api/notes/' + note.id, {
    method: 'DELETE',
    headers,
  });
  assert.equal(deleted.status, 204);
  const logout = await fetch(base + '/api/auth/logout', {
    method: 'POST',
    headers,
  });
  assert.equal(logout.status, 204);
  assert.equal((await fetch(base + '/api/auth/me', { headers })).status, 401);
  console.log(
    'PostgreSQL TCP smoke check passed: authentication, CRUD, and logout.',
  );
} finally {
  if (userId) await pool.query('DELETE FROM users WHERE id=$1', [userId]);
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await pool.end();
}
