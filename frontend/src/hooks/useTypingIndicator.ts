import { useEffect, useState, useRef, useCallback } from 'react';
import { getSocket } from '@/queries/client';
import type { TypingEvent } from '@/types/message';

interface TypingUser {
  userId: string;
  username: string;
  lastTypedAt: number;
}

export function useTypingIndicator(channelId: string) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const lastEmittedRef = useRef<number>(0);
  const timeoutRefs = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    const socket = getSocket();

    const onTypingUpdate = ({ channelId: eventChannelId, userId, username, isTyping }: TypingEvent) => {
      if (eventChannelId !== channelId) return;

      setTypingUsers((prev) => {
        if (!isTyping) {
          return prev.filter((u) => u.userId !== userId);
        }

        const existing = prev.find((u) => u.userId === userId);
        if (existing) {
          return prev.map((u) => (u.userId === userId ? { ...u, lastTypedAt: Date.now() } : u));
        }
        return [...prev, { userId, username, lastTypedAt: Date.now() }];
      });

      // Clear previous timeout for this user
      if (timeoutRefs.current[userId]) {
        clearTimeout(timeoutRefs.current[userId]);
      }

      // Auto-clear after 5 seconds if we don't get another update
      if (isTyping) {
        timeoutRefs.current[userId] = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
        }, 5000);
      }
    };

    socket.on('typing:update', onTypingUpdate);

    return () => {
      socket.off('typing:update', onTypingUpdate);
      // Clean up timeouts
      Object.values(timeoutRefs.current).forEach(clearTimeout);
    };
  }, [channelId]);

  const emitTyping = useCallback(
    (username: string) => {
      const now = Date.now();
      // Only emit every 3 seconds
      if (now - lastEmittedRef.current > 3000) {
        lastEmittedRef.current = now;
        getSocket().emit('typing:start', channelId, username);
      }
    },
    [channelId]
  );

  return { typingUsers, emitTyping };
}
