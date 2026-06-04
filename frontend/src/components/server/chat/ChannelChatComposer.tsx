import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface ChannelChatComposerProps {
  channelLabel: string;
  disabled?: boolean;
  onSend: (body: string) => void;
}

export function ChannelChatComposer({
  channelLabel,
  disabled,
  onSend,
}: ChannelChatComposerProps): React.JSX.Element {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  function handleSend(): void {
    const body = draft.trim();
    if (!body || sending || disabled) return;
    setSending(true);
    onSend(body);
    setDraft('');
    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="border-glass-border shrink-0 border-t px-4 py-3">
      <div className="flex items-end gap-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message #${channelLabel}`}
          disabled={disabled || sending}
          rows={1}
          className="max-h-40 min-h-10 resize-none py-2.5"
          aria-label={`Message #${channelLabel}`}
        />
        <Button
          type="button"
          size="icon"
          aria-label="Send message"
          disabled={disabled || sending || draft.trim().length === 0}
          onClick={handleSend}
          className="shrink-0"
        >
          {sending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Send className="size-4" aria-hidden />
          )}
        </Button>
      </div>
    </div>
  );
}
