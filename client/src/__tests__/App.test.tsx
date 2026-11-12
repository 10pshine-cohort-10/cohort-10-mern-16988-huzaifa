import { StrictMode } from 'react';
import { act } from '@testing-library/react';
import { Dashboard } from '../Dashboard';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { api, ApiError } from '../api';
import type { Note } from '../types';

jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  api: {
    me: jest.fn(),
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    listNotes: jest.fn(),
    createNote: jest.fn(),
    updateNote: jest.fn(),
    deleteNote: jest.fn(),
  },
}));
jest.mock('../NoteEditor', () => ({
  NoteEditor: ({
    note,
    onSave,
    onCancel,
  }: {
    note: Note | null;
    onSave: (value: { title: string; content: string }) => Promise<void>;
    onCancel: () => void;
  }) => (
    <div>
      <input aria-label="Note title" defaultValue={note?.title || 'Draft'} />
      <button
        onClick={() =>
          void onSave({ title: 'Saved title', content: '<p>Saved body</p>' })
        }
      >
        Save note
      </button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));
const mocked = jest.mocked(api);
const user = { id: 'user-1', name: 'Demo Writer', email: 'demo@example.test' };
const note: Note = {
  id: 'note-1',
  title: 'Research ideas',
  content: '<p>A quiet place to think</p>',
  createdAt: '2026-11-13T10:00:00Z',
  updatedAt: '2026-11-13T10:00:00Z',
};
beforeEach(() => {
  jest.resetAllMocks();
  mocked.me.mockResolvedValue({ user });
  mocked.listNotes.mockResolvedValue({ notes: [note] });
});

test('shows login and preserves actionable authentication errors', async () => {
  mocked.me.mockRejectedValue(new Error('Sign in required.'));
  mocked.login.mockRejectedValue(new Error('Email or password is incorrect.'));
  render(<App />);
  await userEvent.type(
    await screen.findByLabelText('Email address'),
    'demo@example.test',
  );
  await userEvent.type(screen.getByLabelText('Password'), 'wrong password');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Email or password is incorrect.',
  );
  expect(screen.getByLabelText('Email address')).toHaveValue(
    'demo@example.test',
  );
});
test('registers an account and opens the notes dashboard', async () => {
  mocked.me.mockRejectedValue(new Error('Sign in required.'));
  mocked.register.mockResolvedValue({ user });
  render(<App />);
  await userEvent.click(
    await screen.findByRole('button', { name: 'Create an account' }),
  );
  await userEvent.type(screen.getByLabelText('Your name'), 'Demo Writer');
  await userEvent.type(
    screen.getByLabelText('Email address'),
    'demo@example.test',
  );
  await userEvent.type(
    screen.getByLabelText('Password'),
    'a long test password',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(
    await screen.findByRole('heading', { name: 'Your notes' }),
  ).toBeInTheDocument();
  expect(mocked.register).toHaveBeenCalledWith({
    name: 'Demo Writer',
    email: 'demo@example.test',
    password: 'a long test password',
  });
});
test('shows saved notes and filters by text', async () => {
  render(<App />);
  expect(await screen.findByText('Research ideas')).toBeInTheDocument();
  await userEvent.type(screen.getByRole('searchbox'), 'missing');
  expect(screen.getByText('No matching notes')).toBeInTheDocument();
  await userEvent.clear(screen.getByRole('searchbox'));
  expect(screen.getByText('Research ideas')).toBeInTheDocument();
});
test('saves a new note and refreshes the dashboard', async () => {
  mocked.createNote.mockResolvedValue({
    note: { ...note, title: 'Saved title' },
  });
  render(<App />);
  await userEvent.click(
    await screen.findByRole('button', { name: 'New note' }),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Save note' }));
  expect(await screen.findByText('Saved title')).toBeInTheDocument();
  expect(mocked.createNote).toHaveBeenCalledWith({
    title: 'Saved title',
    content: '<p>Saved body</p>',
  });
});
test('keeps the editor open when saving fails', async () => {
  mocked.createNote.mockRejectedValue(new Error('Unable to save. Try again.'));
  render(<App />);
  await userEvent.click(
    await screen.findByRole('button', { name: 'New note' }),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Save note' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Unable to save. Try again.',
  );
  expect(screen.getByLabelText('Note title')).toBeInTheDocument();
});
test('cancel does not modify a saved note', async () => {
  render(<App />);
  await userEvent.click(await screen.findByText('Research ideas'));
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByText('Research ideas')).toBeInTheDocument();
  expect(mocked.updateNote).not.toHaveBeenCalled();
});
test('confirms a deletion before removing a note', async () => {
  mocked.deleteNote.mockResolvedValue(undefined);
  render(<App />);
  await userEvent.click(
    await screen.findByRole('button', { name: 'Delete Research ideas' }),
  );
  expect(mocked.deleteNote).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Delete note' }));
  expect(
    await screen.findByText('A little space for your next idea'),
  ).toBeInTheDocument();
  expect(mocked.deleteNote).toHaveBeenCalledWith('note-1');
});
test('logs out only after the server revokes the session', async () => {
  mocked.logout.mockResolvedValue(undefined);
  render(<App />);
  await userEvent.click(
    await screen.findByRole('button', { name: 'Sign out' }),
  );
  await waitFor(() => expect(mocked.logout).toHaveBeenCalled());
  expect(
    await screen.findByRole('button', { name: 'Sign in' }),
  ).toBeInTheDocument();
});
test('offers retry when loading notes fails', async () => {
  mocked.listNotes.mockRejectedValueOnce(new Error('Connection lost.'));
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Connection lost.',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Research ideas')).toBeInTheDocument();
});

test('keeps the draft through session expiry and reauthentication', async () => {
  mocked.createNote
    .mockRejectedValueOnce(
      new ApiError('Your session has expired. Sign in again.', 401),
    )
    .mockResolvedValueOnce({ note: { ...note, title: 'Saved title' } });
  mocked.login.mockResolvedValue({ user });
  render(<App />);
  await userEvent.click(
    await screen.findByRole('button', { name: 'New note' }),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Save note' }));
  expect(
    await screen.findByRole('button', { name: 'Sign in' }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText('Note title')).toBeInTheDocument();
  expect(screen.getByLabelText('Email address')).toHaveValue(user.email);
  await userEvent.type(
    screen.getByLabelText('Password'),
    'a long test password',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() =>
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument(),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Save note' }));
  expect(await screen.findByText('Saved title')).toBeInTheDocument();
});
test('blocks navigation and logout while a save is pending', async () => {
  let finish!: (value: { note: Note }) => void;
  mocked.createNote.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  render(<App />);
  await userEvent.click(
    await screen.findByRole('button', { name: 'New note' }),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Save note' }));
  expect(screen.getByRole('button', { name: /All notes/ })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeDisabled();
  finish({ note });
  await screen.findByText('Research ideas');
});
test('blocks creation until the initial list has loaded', async () => {
  let finish!: (value: { notes: Note[] }) => void;
  mocked.listNotes.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  render(<App />);
  expect(
    await screen.findByRole('button', { name: 'New note' }),
  ).toBeDisabled();
  finish({ notes: [] });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'New note' })).toBeEnabled(),
  );
});

test('ignores a superseded list response after a note has been saved', async () => {
  let first!: (value: { notes: Note[] }) => void;
  let latest!: (value: { notes: Note[] }) => void;
  mocked.listNotes
    .mockReturnValueOnce(
      new Promise((resolve) => {
        first = resolve;
      }),
    )
    .mockReturnValueOnce(
      new Promise((resolve) => {
        latest = resolve;
      }),
    );
  mocked.createNote.mockResolvedValue({
    note: { ...note, title: 'Saved title' },
  });
  render(
    <StrictMode>
      <Dashboard user={user} onLogout={() => {}} />
    </StrictMode>,
  );
  await act(async () => {
    latest({ notes: [] });
  });
  await userEvent.click(screen.getByRole('button', { name: 'New note' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save note' }));
  await screen.findByText('Saved title');
  await act(async () => {
    first({ notes: [] });
  });
  expect(screen.getByText('Saved title')).toBeInTheDocument();
});
