import { randomUUID } from 'node:crypto';
export interface Database {
  query(
    sql: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }>;
}
export interface User {
  id: string;
  name: string;
  email: string;
}
export interface StoredUser extends User {
  passwordHash: string;
}
export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}
export interface NoteInput {
  title: string;
  content: string;
}
function user(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
  };
}
function note(row: Record<string, unknown>): Note {
  return {
    id: String(row.id),
    title: String(row.title),
    content: String(row.content),
    createdAt: new Date(row.created_at as string | Date).toISOString(),
    updatedAt: new Date(row.updated_at as string | Date).toISOString(),
  };
}
export class Repository {
  constructor(private readonly db: Database) {}
  async createUser(
    name: string,
    email: string,
    passwordHash: string,
  ): Promise<User> {
    const result = await this.db.query(
      'INSERT INTO users (id,name,email,password_hash) VALUES ($1,$2,$3,$4) RETURNING id,name,email',
      [randomUUID(), name, email, passwordHash],
    );
    return user(result.rows[0]);
  }
  async findUser(email: string): Promise<StoredUser | null> {
    const { rows } = await this.db.query(
      'SELECT id,name,email,password_hash FROM users WHERE email=$1',
      [email],
    );
    return rows[0]
      ? { ...user(rows[0]), passwordHash: String(rows[0].password_hash) }
      : null;
  }
  async createSession(
    tokenHash: string,
    userId: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.db.query('DELETE FROM sessions WHERE expires_at <= NOW()');
    await this.db.query(
      'INSERT INTO sessions (token_hash,user_id,expires_at) VALUES ($1,$2,$3)',
      [tokenHash, userId, expiresAt],
    );
  }
  async sessionUser(tokenHash: string): Promise<User | null> {
    const { rows } = await this.db.query(
      'SELECT u.id,u.name,u.email FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>NOW()',
      [tokenHash],
    );
    return rows[0] ? user(rows[0]) : null;
  }
  async deleteSession(tokenHash: string): Promise<void> {
    await this.db.query('DELETE FROM sessions WHERE token_hash=$1', [
      tokenHash,
    ]);
  }
  async listNotes(userId: string): Promise<Note[]> {
    const { rows } = await this.db.query(
      'SELECT id,title,content,created_at,updated_at FROM notes WHERE user_id=$1 ORDER BY updated_at DESC,id',
      [userId],
    );
    return rows.map(note);
  }
  async getNote(userId: string, id: string): Promise<Note | null> {
    const { rows } = await this.db.query(
      'SELECT id,title,content,created_at,updated_at FROM notes WHERE user_id=$1 AND id=$2',
      [userId, id],
    );
    return rows[0] ? note(rows[0]) : null;
  }
  async createNote(userId: string, input: NoteInput): Promise<Note> {
    const { rows } = await this.db.query(
      'INSERT INTO notes (id,user_id,title,content) VALUES ($1,$2,$3,$4) RETURNING id,title,content,created_at,updated_at',
      [randomUUID(), userId, input.title, input.content],
    );
    return note(rows[0]);
  }
  async updateNote(
    userId: string,
    id: string,
    input: NoteInput,
  ): Promise<Note | null> {
    const { rows } = await this.db.query(
      'UPDATE notes SET title=$3,content=$4,updated_at=NOW() WHERE user_id=$1 AND id=$2 RETURNING id,title,content,created_at,updated_at',
      [userId, id, input.title, input.content],
    );
    return rows[0] ? note(rows[0]) : null;
  }
  async deleteNote(userId: string, id: string): Promise<boolean> {
    const { rows } = await this.db.query(
      'DELETE FROM notes WHERE user_id=$1 AND id=$2 RETURNING id',
      [userId, id],
    );
    return rows.length === 1;
  }
}
