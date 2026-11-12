import { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  ArrowLeft,
  Bold,
  Italic,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Undo2,
  Redo2,
  Check,
} from 'lucide-react';
import type { Note, NoteInput } from './types';
export function NoteEditor({
  note,
  onSave,
  onCancel,
}: {
  note: Note | null;
  onSave: (input: NoteInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(note?.title ?? '');
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: { openOnClick: false } })],
    content: note?.content ?? '<p></p>',
    editorProps: {
      attributes: {
        class: 'rich-editor',
        role: 'textbox',
        'aria-label': 'Note content',
        'aria-multiline': 'true',
      },
    },
    onUpdate: () => setChanged(true),
    shouldRerenderOnTransaction: true,
  });
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (changed) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [changed]);
  function cancel() {
    if (!changed || window.confirm('Discard your unsaved changes?')) onCancel();
  }
  async function save() {
    if (!editor || !title.trim()) return;
    setSaving(true);
    editor.setEditable(false);
    try {
      await onSave({ title: title.trim(), content: editor.getHTML() });
    } finally {
      if (!editor.isDestroyed) editor.setEditable(true);
      setSaving(false);
    }
  }
  const tools = editor
    ? [
        {
          label: 'Bold',
          icon: Bold,
          active: editor.isActive('bold'),
          action: () => editor.chain().focus().toggleBold().run(),
        },
        {
          label: 'Italic',
          icon: Italic,
          active: editor.isActive('italic'),
          action: () => editor.chain().focus().toggleItalic().run(),
        },
        {
          label: 'Heading',
          icon: Heading2,
          active: editor.isActive('heading', { level: 2 }),
          action: () =>
            editor.chain().focus().toggleHeading({ level: 2 }).run(),
        },
        {
          label: 'Bullet list',
          icon: List,
          active: editor.isActive('bulletList'),
          action: () => editor.chain().focus().toggleBulletList().run(),
        },
        {
          label: 'Numbered list',
          icon: ListOrdered,
          active: editor.isActive('orderedList'),
          action: () => editor.chain().focus().toggleOrderedList().run(),
        },
        {
          label: 'Quote',
          icon: Quote,
          active: editor.isActive('blockquote'),
          action: () => editor.chain().focus().toggleBlockquote().run(),
        },
        {
          label: 'Undo',
          icon: Undo2,
          active: false,
          action: () => editor.chain().focus().undo().run(),
        },
        {
          label: 'Redo',
          icon: Redo2,
          active: false,
          action: () => editor.chain().focus().redo().run(),
        },
      ]
    : [];
  return (
    <section className="editor-section">
      <div className="editor-top">
        <button className="back-button" onClick={cancel} disabled={saving}>
          <ArrowLeft size={16} /> All notes
        </button>
        <span className="editor-status">
          {changed ? 'Unsaved changes' : note ? 'Saved note' : 'A fresh page'}
        </span>
      </div>
      <div className="editor-paper">
        <label className="sr-only" htmlFor="note-title">
          Note title
        </label>
        <input
          id="note-title"
          disabled={saving}
          className="title-input"
          autoFocus
          placeholder="Give your thought a title…"
          maxLength={200}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setChanged(true);
          }}
        />
        <div
          className="editor-toolbar"
          role="toolbar"
          aria-label="Text formatting"
        >
          {tools.map((tool) => (
            <button
              key={tool.label}
              type="button"
              aria-label={tool.label}
              title={tool.label}
              aria-pressed={tool.active}
              onClick={tool.action}
              disabled={saving}
            >
              <tool.icon size={18} />
            </button>
          ))}
        </div>
        <EditorContent editor={editor} />
        <div className="editor-bottom">
          <span>Make it a thought worth keeping.</span>
          <span>{editor?.getText().length ?? 0} characters</span>
        </div>
      </div>
      <div className="editor-actions">
        <button className="button secondary" onClick={cancel} disabled={saving}>
          Cancel
        </button>
        <button
          className="button primary"
          onClick={() => void save()}
          disabled={saving || !editor || !title.trim()}
        >
          <Check size={17} />
          {saving ? 'Saving…' : 'Save note'}
        </button>
      </div>
    </section>
  );
}
