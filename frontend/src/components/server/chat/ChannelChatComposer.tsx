import { useState, useRef, useEffect } from 'react';
import { Loader2, Send, Smile } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { EmojiPicker } from '@/components/chat/EmojiPicker';
import { getIdenticonDataUrl } from '@/lib/avatar';
import { MediaImg } from '@/components/ui/media-img';
import { cn } from '@/lib/cn';
import type { ServerMemberDto } from '@/queries/members';

interface ChannelChatComposerProps {
  channelLabel: string;
  disabled?: boolean;
  onSend: (body: string) => void;
  members: ServerMemberDto[];
}

export function ChannelChatComposer({
  channelLabel,
  disabled,
  onSend,
  members,
}: ChannelChatComposerProps): React.JSX.Element {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  // Autocomplete state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIdx, setMentionStartIdx] = useState(-1);
  const [activeIndex, setActiveIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSend(): void {
    const body = draft.trim();
    if (!body || sending || disabled) return;
    setSending(true);
    onSend(body);
    setDraft('');
    setSending(false);
    setShowSuggestions(false);
  }

  // Grow the input with its content up to a cap (Discord-style), then scroll.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [draft]);

  function insertEmoji(emoji: string): void {
    const textarea = textareaRef.current;
    if (!textarea) {
      setDraft((prev) => prev + emoji);
      return;
    }
    const start = textarea.selectionStart ?? draft.length;
    const end = textarea.selectionEnd ?? draft.length;
    setDraft(draft.slice(0, start) + emoji + draft.slice(end));
    const nextPos = start + emoji.length;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(nextPos, nextPos);
    }, 0);
  }

  // Handle autocomplete matching when input changes
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const selectionStart = textarea.selectionStart;
    const textBeforeCursor = draft.slice(0, selectionStart);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const isWordStart = lastAtIndex === 0 || /\s/.test(textBeforeCursor[lastAtIndex - 1]);
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      const hasSpaces = /\s/.test(textAfterAt);

      if (isWordStart && !hasSpaces) {
        setShowSuggestions(true);
        setMentionQuery(textAfterAt);
        setMentionStartIdx(lastAtIndex);
        setActiveIndex(0);
        return;
      }
    }

    setShowSuggestions(false);
  }, [draft]);

  const filteredMembers = members.filter((m) => {
    const search = mentionQuery.toLowerCase();
    return (
      m.user.username.toLowerCase().includes(search) ||
      (m.user.displayName && m.user.displayName.toLowerCase().includes(search))
    );
  });

  function selectMember(member: ServerMemberDto): void {
    const textarea = textareaRef.current;
    if (!textarea || mentionStartIdx === -1) return;

    const beforeMention = draft.slice(0, mentionStartIdx);
    const afterMention = draft.slice(textarea.selectionStart);
    const completedText = `${beforeMention}@${member.user.username} ${afterMention}`;

    setDraft(completedText);
    setShowSuggestions(false);

    // Reposition cursor after the autocomplete insertion
    const nextCursorPos = mentionStartIdx + member.user.username.length + 2; // +1 for '@', +1 for trailing space
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursorPos, nextCursorPos);
    }, 0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (showSuggestions && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % filteredMembers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + filteredMembers.length) % filteredMembers.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        selectMember(filteredMembers[activeIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSuggestions(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="border-glass-border relative shrink-0 border-t px-4 py-3">
      {showSuggestions && filteredMembers.length > 0 && (
        <div className="bg-glass-surface-2 border-glass-border absolute bottom-full left-4 z-50 mb-2 max-h-48 w-64 overflow-y-auto rounded-lg border p-1 shadow-lg backdrop-blur-md">
          {filteredMembers.map((member, idx) => (
            <button
              key={member.id}
              onClick={() => selectMember(member)}
              className={cn(
                'text-ink hover:bg-surface-hover/60 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                idx === activeIndex && 'bg-surface-hover/80 font-medium',
              )}
            >
              <MediaImg
                src={member.user.avatarUrl || getIdenticonDataUrl(member.userId)}
                alt=""
                className="size-6 rounded-full object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {member.user.displayName || member.user.username}
                </div>
                {member.user.displayName && (
                  <div className="text-ink-subtle truncate text-xs">@{member.user.username}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="bg-surface-composer flex items-end gap-1 rounded-lg px-2">
        <Textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message #${channelLabel}`}
          disabled={disabled || sending}
          rows={1}
          className="text-body max-h-40 min-h-11 flex-1 resize-none border-0 bg-transparent px-1 py-3 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          aria-label={`Message #${channelLabel}`}
        />
        <div className="flex shrink-0 items-center gap-0.5 self-end pb-2">
          <EmojiPicker
            onSelect={insertEmoji}
            trigger={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Insert emoji"
                disabled={disabled || sending}
                className="text-ink-muted hover:text-ink size-8 rounded-md"
              >
                <Smile className="size-5" aria-hidden />
              </Button>
            }
          />
          {draft.trim().length > 0 && (
            <Button
              type="button"
              size="icon"
              aria-label="Send message"
              disabled={disabled || sending}
              onClick={handleSend}
              className="size-8 rounded-md"
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Send className="size-4" aria-hidden />
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
