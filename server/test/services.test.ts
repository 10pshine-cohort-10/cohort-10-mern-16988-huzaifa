import { expect } from 'chai';
import {
  hashPassword,
  verifyPassword,
  hashToken,
  parseNote,
} from '../src/services.js';
describe('authentication and note services', () => {
  it('salts password hashes and validates only the right password', async () => {
    const password = 'a long unique passphrase';
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    expect(first).not.to.equal(second);
    expect(await verifyPassword(password, first)).to.equal(true);
    expect(await verifyPassword('incorrect', first)).to.equal(false);
    expect(await verifyPassword(password, 'invalid')).to.equal(false);
  });
  it('hashes opaque session tokens without storing their raw value', () => {
    expect(hashToken('example-token')).to.match(/^[a-f0-9]{64}$/);
    expect(hashToken('example-token')).not.to.equal(hashToken('other-token'));
  });
  it('removes executable markup while preserving supported formatting', () => {
    const note = parseNote({
      title: '  My note  ',
      content:
        '<p style="color:red" onclick="alert(1)"><em>Hello</em><iframe src="https://evil.example"></iframe><a href="//evil.example">link</a></p>',
    });
    expect(note.title).to.equal('My note');
    expect(note.content)
      .to.include('<em>Hello</em>')
      .and.not.include('onclick')
      .and.not.include('style=')
      .and.not.include('iframe')
      .and.not.include('href=');
  });
});
