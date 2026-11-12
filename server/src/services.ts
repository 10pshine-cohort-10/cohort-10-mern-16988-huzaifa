import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';
import { AppError } from './errors.js';
import { Repository, type NoteInput, type User } from './repository.js';
const derive = promisify(scrypt);
const email = z.string().trim().toLowerCase().email().max(254);
const loginInput = z.object({ email, password: z.string().min(1).max(128) });
const registrationInput = loginInput.extend({
  name: z.string().trim().min(1).max(80),
  password: z.string().min(12, 'Use at least 12 characters.').max(128),
});
const noteInput = z.object({
  title: z.string().trim().min(1, 'Enter a title.').max(200),
  content: z.string().max(100000),
});
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = (await derive(password, salt, 64)) as Buffer;
  return salt + ':' + key.toString('hex');
}
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash || !/^[a-f0-9]{128}$/.test(hash)) return false;
  const key = (await derive(password, salt, 64)) as Buffer;
  return timingSafeEqual(key, Buffer.from(hash, 'hex'));
}
export function parseNote(value: unknown): NoteInput {
  const input = noteInput.parse(value);
  return {
    ...input,
    content: sanitizeHtml(input.content, {
      allowedTags: [
        'p',
        'br',
        'strong',
        'em',
        's',
        'h1',
        'h2',
        'h3',
        'ul',
        'ol',
        'li',
        'blockquote',
        'pre',
        'code',
        'hr',
        'a',
      ],
      allowedAttributes: { a: ['href', 'title'] },
      allowedSchemes: ['http', 'https', 'mailto'],
      allowProtocolRelative: false,
    }),
  };
}
export function parseId(value: unknown): string {
  return z.string().uuid().parse(value);
}
export class AuthService {
  private readonly dummy = hashPassword(randomBytes(24).toString('hex'));
  constructor(
    private readonly repo: Repository,
    private readonly sessionHours: number,
  ) {}
  async register(value: unknown): Promise<{ user: User; token: string }> {
    const input = registrationInput.parse(value);
    let user: User;
    try {
      user = await this.repo.createUser(
        input.name,
        input.email,
        await hashPassword(input.password),
      );
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      )
        throw new AppError(409, 'An account with this email already exists.');
      throw error;
    }
    return this.session(user);
  }
  async login(value: unknown): Promise<{ user: User; token: string }> {
    const input = loginInput.parse(value);
    const found = await this.repo.findUser(input.email);
    const valid = await verifyPassword(
      input.password,
      found?.passwordHash ?? (await this.dummy),
    );
    if (!found || !valid)
      throw new AppError(401, 'Email or password is incorrect.');
    return this.session({ id: found.id, name: found.name, email: found.email });
  }
  private async session(user: User): Promise<{ user: User; token: string }> {
    const token = randomBytes(32).toString('hex');
    await this.repo.createSession(
      hashToken(token),
      user.id,
      new Date(Date.now() + this.sessionHours * 3600000),
    );
    return { user, token };
  }
  async authenticate(token: unknown): Promise<User> {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token))
      throw new AppError(401, 'Sign in to continue.');
    const user = await this.repo.sessionUser(hashToken(token));
    if (!user)
      throw new AppError(401, 'Your session has expired. Sign in again.');
    return user;
  }
  async logout(token: string): Promise<void> {
    await this.repo.deleteSession(hashToken(token));
  }
}
