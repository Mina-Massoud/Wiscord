import { type Editor } from '@tiptap/core';
import { BubbleMenu } from '@tiptap/react/menus';
import { Bold, Code, Italic, Link as LinkIcon, Strikethrough } from 'lucide-react';

import { cn } from '@/lib/cn';

interface NotesBubbleMenuProps {
  editor: Editor | null;
}

/**
 * Floating toolbar that appears on selection. Stays hidden until the user
 * has actually selected something — the editor surface stays clean and the
 * affordance only shows when relevant.
 *
 * Marks supported in v1 mirror the StarterKit defaults we keep enabled:
 * bold, italic, strike, inline code, and a one-shot prompt-style link
 * insertion. Headings and lists are reached via markdown shortcuts
 * (`# heading`, `- list`, `> quote`) and the `tiptap-markdown` input rules.
 */
export function NotesBubbleMenu({ editor }: NotesBubbleMenuProps): React.JSX.Element | null {
  if (!editor) return null;

  return (
    <BubbleMenu
      editor={editor}
      className="bg-glass-surface-2 border-glass-border shadow-elevated backdrop-blur-glass-sm flex items-center gap-1 rounded-md border p-1"
    >
      <BubbleButton
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        label="Bold"
      >
        <Bold className="size-3.5" aria-hidden />
      </BubbleButton>
      <BubbleButton
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        label="Italic"
      >
        <Italic className="size-3.5" aria-hidden />
      </BubbleButton>
      <BubbleButton
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        label="Strikethrough"
      >
        <Strikethrough className="size-3.5" aria-hidden />
      </BubbleButton>
      <BubbleButton
        active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
        label="Inline code"
      >
        <Code className="size-3.5" aria-hidden />
      </BubbleButton>
      <div className="bg-glass-border mx-0.5 h-4 w-px" aria-hidden />
      <BubbleButton
        active={editor.isActive('link')}
        onClick={() => {
          const previous = (editor.getAttributes('link').href as string | undefined) ?? '';
          const url = window.prompt('Link URL', previous);
          if (url === null) return;
          if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
          }
          editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
        }}
        label="Add link"
      >
        <LinkIcon className="size-3.5" aria-hidden />
      </BubbleButton>
    </BubbleMenu>
  );
}

interface BubbleButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}

function BubbleButton({ active, onClick, label, children }: BubbleButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded transition-colors',
        active ? 'bg-glass-active text-ink' : 'text-ink-muted hover:bg-glass-hover hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}
