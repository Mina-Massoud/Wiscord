import { type Editor } from '@tiptap/core';
import { BubbleMenu } from '@tiptap/react/menus';
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Type,
} from 'lucide-react';

import { BubbleButton } from './NotesBubbleMenuBubbleButton';

interface NotesBubbleMenuProps {
  editor: Editor | null;
}

/**
 * Floating toolbar that appears on selection. Stays hidden until the user
 * has actually selected something — the editor surface stays clean and the
 * affordance only shows when relevant.
 *
 * Three groups separated by hairline dividers:
 *  1. Block kind — paragraph / h1-h3 / bullet list / ordered list / blockquote.
 *     Heading levels are clamped to h1-h3 to match what `notes-prose.css`
 *     styles (h4+ has no styling) AND what the markdown-to-ydoc parser
 *     coerces AI-generated headings to. One block-kind set across both
 *     entry surfaces (human typing, AI generation) keeps the rendering
 *     consistent.
 *  2. Inline marks — bold, italic, strike, inline code.
 *  3. Link — prompt-based one-shot insertion / removal.
 */
export function NotesBubbleMenu({ editor }: NotesBubbleMenuProps): React.JSX.Element | null {
  if (!editor) return null;

  return (
    <BubbleMenu
      editor={editor}
      className="bg-glass-surface-2 border-glass-border shadow-elevated backdrop-blur-glass-sm flex items-center gap-1 rounded-md border p-1"
    >
      <BubbleButton
        active={
          editor.isActive('paragraph') &&
          !editor.isActive('heading') &&
          !editor.isActive('bulletList') &&
          !editor.isActive('orderedList') &&
          !editor.isActive('blockquote')
        }
        onClick={() => editor.chain().focus().setParagraph().run()}
        label="Paragraph"
      >
        <Type className="size-3.5" aria-hidden />
      </BubbleButton>
      <BubbleButton
        active={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        label="Heading 1"
      >
        <Heading1 className="size-3.5" aria-hidden />
      </BubbleButton>
      <BubbleButton
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        label="Heading 2"
      >
        <Heading2 className="size-3.5" aria-hidden />
      </BubbleButton>
      <BubbleButton
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        label="Heading 3"
      >
        <Heading3 className="size-3.5" aria-hidden />
      </BubbleButton>
      <BubbleButton
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        label="Bullet list"
      >
        <List className="size-3.5" aria-hidden />
      </BubbleButton>
      <BubbleButton
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        label="Numbered list"
      >
        <ListOrdered className="size-3.5" aria-hidden />
      </BubbleButton>
      <BubbleButton
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        label="Blockquote"
      >
        <Quote className="size-3.5" aria-hidden />
      </BubbleButton>

      <div className="bg-glass-border mx-0.5 h-4 w-px" aria-hidden />

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
