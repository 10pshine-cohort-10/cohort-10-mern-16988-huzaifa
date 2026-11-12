import type { User, Note, NoteInput } from './types';
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
async function send<T>(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api' + path, {
      method,
      credentials: 'same-origin',
      ...(body === undefined
        ? {}
        : {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }),
    });
  } catch {
    throw new ApiError(
      'Unable to connect. Check your connection and try again.',
      0,
    );
  }
  if (response.status === 204) return undefined as T;
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      'The server returned an unexpected response. Try again.',
      response.status,
    );
  }
  if (!response.ok) {
    const message =
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof data.error === 'string'
        ? data.error
        : 'The request failed. Try again.';
    throw new ApiError(message, response.status);
  }
  return data as T;
}
export const api = {
  me: () => send<{ user: User }>('/auth/me'),
  login: (input: { email: string; password: string }) =>
    send<{ user: User }>('/auth/login', 'POST', input),
  register: (input: { name: string; email: string; password: string }) =>
    send<{ user: User }>('/auth/register', 'POST', input),
  logout: () => send<void>('/auth/logout', 'POST'),
  listNotes: () => send<{ notes: Note[] }>('/notes'),
  createNote: (input: NoteInput) =>
    send<{ note: Note }>('/notes', 'POST', input),
  updateNote: (id: string, input: NoteInput) =>
    send<{ note: Note }>('/notes/' + encodeURIComponent(id), 'PUT', input),
  deleteNote: (id: string) =>
    send<void>('/notes/' + encodeURIComponent(id), 'DELETE'),
};
