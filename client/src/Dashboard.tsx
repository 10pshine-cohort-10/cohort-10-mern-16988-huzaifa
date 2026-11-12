import { useEffect, useMemo, useRef, useState } from 'react';
import {
  NotebookPen,
  Files,
  Plus,
  Search,
  LogOut,
  ArrowUpRight,
  Trash2,
  FileText,
  Sprout,
  LockKeyhole,
  X,
} from 'lucide-react';
import { api, ApiError } from './api';
import { AuthForm } from './AuthForm';
import type { User, Note, NoteInput } from './types';
import { NoteEditor } from './NoteEditor';
function plainText(html: string) {
  return (
    new DOMParser().parseFromString(html, 'text/html').body.textContent ?? ''
  );
}
function date(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}
export function Dashboard({
  user,
  onLogout,
}: {
  user: User;
  onLogout: () => void;
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('updated');
  const [editing, setEditing] = useState<Note | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [reauthOpen, setReauthOpen] = useState(false);
  const reauthDialog = useRef<HTMLDialogElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  function recoverSession(cause: unknown) {
    if (cause instanceof ApiError && cause.status === 401) {
      setNeedsAuth(true);
      setReauthOpen(true);
    }
  }
  useEffect(() => {
    if (reauthOpen) reauthDialog.current?.showModal();
    else reauthDialog.current?.close();
  }, [reauthOpen]);
  const loadVersion = useRef(0);
  async function load() {
    const version = ++loadVersion.current;
    setLoading(true);
    setError('');
    try {
      const result = await api.listNotes();
      if (version === loadVersion.current) setNotes(result.notes);
    } catch (cause) {
      if (version !== loadVersion.current) return;
      recoverSession(cause);
      setError(
        cause instanceof Error ? cause.message : 'Unable to load your notes.',
      );
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (deleting) dialog.current?.showModal();
    else dialog.current?.close();
  }, [deleting]);
  const visible = useMemo(
    () =>
      notes
        .filter((note) =>
          (note.title + ' ' + plainText(note.content))
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          sort === 'title'
            ? a.title.localeCompare(b.title)
            : Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
        ),
    [notes, query, sort],
  );
  function open(note: Note | null) {
    setError('');
    setEditing(note);
  }
  async function save(input: NoteInput) {
    if (needsAuth) {
      setReauthOpen(true);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = editing
        ? await api.updateNote(editing.id, input)
        : await api.createNote(input);
      setNotes((current) => [
        result.note,
        ...current.filter((note) => note.id !== result.note.id),
      ]);
      setEditing(undefined);
    } catch (cause) {
      recoverSession(cause);
      setError(
        cause instanceof Error ? cause.message : 'Unable to save your note.',
      );
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setError('');
    try {
      await api.deleteNote(deleting.id);
      setNotes((current) => current.filter((note) => note.id !== deleting.id));
      setDeleting(null);
    } catch (cause) {
      recoverSession(cause);
      setDeleting(null);
      setError(
        cause instanceof Error ? cause.message : 'Unable to delete your note.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    if (
      editing !== undefined &&
      !window.confirm('Sign out and discard this draft?')
    )
      return;
    setBusy(true);
    setError('');
    try {
      await api.logout();
      onLogout();
    } catch (cause) {
      recoverSession(cause);
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to sign out. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  const initials = user.name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className="workspace">
      <aside className="sidebar">
        <a className="brand" href="/">
          <span className="brand-icon">
            <NotebookPen size={22} />
          </span>
          shine<span className="brand-light">notes</span>
        </a>
        <div className="workspace-label">PERSONAL WORKSPACE</div>
        <button
          className="nav-item active"
          disabled={saving}
          aria-current="page"
          onClick={() => {
            if (editing === undefined) return;
            if (
              window.confirm(
                'Leave the editor? Unsaved changes will be discarded.',
              )
            )
              setEditing(undefined);
          }}
        >
          <Files size={18} />
          <span>All notes</span>
          <span className="nav-count">{notes.length}</span>
        </button>
        <div className="sidebar-tip">
          <Sprout size={26} strokeWidth={1.4} />
          <h3>A place to think.</h3>
          <p>
            Big plans. Small reminders.
            <br />
            Start wherever you are.
          </p>
        </div>
        <div className="sidebar-profile">
          <span className="avatar">{initials}</span>
          <div>
            <strong>{user.name}</strong>
            <span title={user.email}>{user.email}</span>
          </div>
          <button
            aria-label="Sign out"
            title="Sign out"
            disabled={busy || saving}
            onClick={() => void logout()}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main className="workspace-main">
        <header className="topbar">
          <span>
            My workspace <span className="breadcrumb-slash">/</span>{' '}
            <strong>
              {editing !== undefined ? 'Note editor' : 'All notes'}
            </strong>
          </span>
          <span className="private-badge">
            <LockKeyhole size={13} /> Only you
          </span>
        </header>
        <div className="main-content">
          {error && (
            <div className="error-message" role="alert">
              {error}
              {needsAuth && (
                <button
                  className="text-button"
                  onClick={() => setReauthOpen(true)}
                >
                  Sign in again
                </button>
              )}
              {!needsAuth && editing === undefined && (
                <button className="text-button" onClick={() => void load()}>
                  Try again
                </button>
              )}
            </div>
          )}
          {editing !== undefined ? (
            <NoteEditor
              key={editing?.id ?? 'new'}
              note={editing}
              onSave={save}
              onCancel={() => {
                setEditing(undefined);
                setError('');
              }}
            />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <span className="small-label">
                    CAPTURE A THOUGHT. KEEP IT CLOSE.
                  </span>
                  <h1>
                    Your notes
                    <span className="heading-dot" aria-hidden="true">
                      .
                    </span>
                  </h1>
                  <p className="muted">
                    A home for your ideas, and a little clarity for your day.
                  </p>
                </div>
                <button
                  className="button primary"
                  disabled={loading}
                  onClick={() => open(null)}
                >
                  <Plus size={18} /> New note
                </button>
              </div>
              <div className="notes-toolbar">
                <div className="search-field">
                  <Search size={18} />
                  <input
                    type="search"
                    aria-label="Search notes"
                    placeholder="Search your notes…"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  {query && (
                    <button
                      aria-label="Clear search"
                      onClick={() => setQuery('')}
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
                <div className="sort-field">
                  <span>
                    {visible.length} {visible.length === 1 ? 'note' : 'notes'}
                  </span>
                  <label className="sr-only" htmlFor="sort-notes">
                    Sort notes
                  </label>
                  <select
                    id="sort-notes"
                    value={sort}
                    onChange={(event) => setSort(event.target.value)}
                  >
                    <option value="updated">Last edited</option>
                    <option value="title">Title A–Z</option>
                  </select>
                </div>
              </div>
              {loading ? (
                <div className="empty-state" role="status">
                  Gathering your thoughts…
                </div>
              ) : visible.length ? (
                <div className="notes-grid">
                  {visible.map((note, index) => (
                    <article className="note-card" key={note.id}>
                      <button className="note-open" onClick={() => open(note)}>
                        <div className="note-card-top">
                          <span className={'note-symbol tone-' + (index % 3)}>
                            <FileText size={19} />
                          </span>
                          <span className="note-date">
                            {date(note.updatedAt)}
                          </span>
                        </div>
                        <h2>{note.title}</h2>
                        <p>
                          {plainText(note.content) ||
                            'An open page, ready for more.'}
                        </p>
                        <div className="note-card-bottom">
                          <span>Open note</span>
                          <ArrowUpRight size={17} />
                        </div>
                      </button>
                      <button
                        className="delete-note"
                        aria-label={'Delete ' + note.title}
                        onClick={() => setDeleting(note)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <span className="empty-icon">
                    <NotebookPen size={33} strokeWidth={1.3} />
                  </span>
                  <h2>
                    {query
                      ? 'No matching notes'
                      : 'A little space for your next idea'}
                  </h2>
                  <p>
                    {query
                      ? 'Try a different word or clear your search.'
                      : 'A fleeting thought, a fresh plan, a list for tomorrow. Give it a home.'}
                  </p>
                  {!query && (
                    <button
                      className="button secondary"
                      onClick={() => open(null)}
                    >
                      <Plus size={16} /> Write your first note
                    </button>
                  )}
                </div>
              )}
              <footer className="workspace-footer">
                <span>
                  <span className="status-dot" /> Your space. Your pace.
                </span>
                <span>SHINE NOTES</span>
              </footer>
            </>
          )}
        </div>
      </main>
      <dialog
        ref={dialog}
        className="confirm-dialog"
        onCancel={(event) => {
          if (busy) event.preventDefault();
          else setDeleting(null);
        }}
        aria-labelledby="delete-title"
      >
        <div className="dialog-icon">
          <Trash2 size={22} />
        </div>
        <h2 id="delete-title">Delete this note?</h2>
        <p>
          “{deleting?.title}” will be permanently deleted. This cannot be
          undone.
        </p>
        <div className="dialog-actions">
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => setDeleting(null)}
          >
            Keep note
          </button>
          <button
            className="button danger"
            disabled={busy}
            onClick={() => void remove()}
          >
            {busy ? 'Deleting…' : 'Delete note'}
          </button>
        </div>
      </dialog>
      <dialog
        ref={reauthDialog}
        className="reauth-dialog"
        aria-label="Sign in again"
        onCancel={() => setReauthOpen(false)}
      >
        {reauthOpen && (
          <>
            <AuthForm
              reauthEmail={user.email}
              onAuthenticated={(restored) => {
                if (restored.id !== user.id)
                  throw new Error(
                    'Use your original account to restore this draft.',
                  );
                setNeedsAuth(false);
                setReauthOpen(false);
                setError('');
                if (editing === undefined) void load();
              }}
            />
            <button
              className="button secondary"
              onClick={() => setReauthOpen(false)}
            >
              Keep editing
            </button>
          </>
        )}
      </dialog>
    </div>
  );
}
