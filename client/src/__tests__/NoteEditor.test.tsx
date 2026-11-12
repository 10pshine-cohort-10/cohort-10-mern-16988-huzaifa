import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NoteEditor } from '../NoteEditor';
import type { Note } from '../types';
const note: Note = {
  id: 'n',
  title: 'Saved thought',
  content: '<p>Original content</p>',
  createdAt: '2026-11-13T10:00:00Z',
  updatedAt: '2026-11-13T10:00:00Z',
};
test('locks the whole draft while a save is pending so later edits cannot be lost', async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  render(<NoteEditor note={note} onSave={() => pending} onCancel={() => {}} />);
  await screen.findByRole('textbox', { name: 'Note content' });
  await userEvent.click(screen.getByRole('button', { name: 'Save note' }));
  expect(screen.getByLabelText('Note title')).toBeDisabled();
  expect(screen.getByRole('textbox', { name: 'Note content' })).toHaveAttribute(
    'contenteditable',
    'false',
  );
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  await act(async () => {
    finish();
    await pending;
  });
  await waitFor(() =>
    expect(screen.getByLabelText('Note title')).toBeEnabled(),
  );
});
test('disables saving an empty title and returns the existing rich text when saved', async () => {
  const save = jest.fn().mockResolvedValue(undefined);
  render(<NoteEditor note={note} onSave={save} onCancel={() => {}} />);
  await screen.findByRole('textbox', { name: 'Note content' });
  await userEvent.click(screen.getByRole('button', { name: 'Save note' }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith({
      title: note.title,
      content: note.content,
    }),
  );
  await userEvent.clear(screen.getByLabelText('Note title'));
  expect(screen.getByRole('button', { name: 'Save note' })).toBeDisabled();
});
