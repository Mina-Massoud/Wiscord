import React, { useRef, useState } from 'react';
import { useSendMessage } from '@/queries/messages';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SendHorizontal } from 'lucide-react';

interface ChatComposerProps {
  channelId: string;
}

export function ChatComposer({ channelId }: ChatComposerProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const { mutate: sendMessage, isPending } = useSendMessage();
  const { emitTyping } = useTypingIndicator(channelId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (content.trim() && !isPending) {
      sendMessage({ channelId, content: content.trim() });
      setContent('');
      // Reset height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    
    // Auto-resize
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }

    if (user) {
      emitTyping(user.username);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit}
      className="bg-glass-surface-2 border border-glass-border mx-4 mb-4 rounded-xl flex items-end p-1 shadow-sm transition-all"
    >
      <div className="flex-1 min-h-[44px] flex items-center">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          className="min-h-[20px] max-h-[200px] border-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none shadow-none resize-none py-3 px-3 bg-transparent w-full text-[15px]"
          rows={1}
        />
      </div>
      <div className="p-1 flex-shrink-0">
        <Button 
          type="submit" 
          disabled={!content.trim() || isPending}
          size="icon"
          className="h-8 w-8 rounded-lg bg-blurple hover:bg-blurple-hover text-white disabled:opacity-50 transition-opacity"
        >
          <SendHorizontal className="h-4 w-4" />
          <span className="sr-only">Send message</span>
        </Button>
      </div>
    </form>
  );
}
