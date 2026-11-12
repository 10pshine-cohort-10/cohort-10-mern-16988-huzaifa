import { expect } from 'chai';
import { getConfig } from '../src/config.js';
describe('environment configuration', () => {
  it('uses defaults and preserves changed deployment values', () => {
    expect(
      getConfig({ DATABASE_URL: 'postgres://a:b@localhost/notes' }),
    ).to.include({
      port: 3001,
      origin: 'http://localhost:5173',
      production: false,
    });
    expect(
      getConfig({
        DATABASE_URL: 'postgres://a:b@db/custom',
        PORT: '4321',
        APP_ORIGIN: 'https://notes.example',
        NODE_ENV: 'production',
        SESSION_HOURS: '8',
      }),
    ).to.include({
      port: 4321,
      origin: 'https://notes.example',
      production: true,
      sessionHours: 8,
      databaseUrl: 'postgres://a:b@db/custom',
    });
  });
  it('rejects missing database configuration, invalid ports, and insecure production origins', () => {
    expect(() => getConfig({})).to.throw();
    expect(() =>
      getConfig({ DATABASE_URL: 'postgres://a:b@db/notes', PORT: 'NaN' }),
    ).to.throw();
    expect(() =>
      getConfig({
        DATABASE_URL: 'postgres://a:b@db/notes',
        APP_ORIGIN: 'http://notes.example',
        NODE_ENV: 'production',
      }),
    ).to.throw();
  });
});
