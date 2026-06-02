import { create } from 'zustand';

export type ChannelChatMessageKind = 'message' | 'system';

export interface ChannelChatMessage {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  timestamp: string;
  kind: ChannelChatMessageKind;
}

/** Stable empty list — never use `?? []` inside a Zustand selector (new ref every snapshot). */
export const EMPTY_CHANNEL_MESSAGES: ChannelChatMessage[] = [];

interface ChannelChatState {
  messagesByChannel: Record<string, ChannelChatMessage[]>;
  getMessages: (channelId: string) => ChannelChatMessage[];
  appendMessage: (channelId: string, message: Omit<ChannelChatMessage, 'id' | 'timestamp'> & { timestamp?: string }) => void;
}

export const useChannelChatStore = create<ChannelChatState>((set, get) => ({
  messagesByChannel: {},
  getMessages: (channelId) => get().messagesByChannel[channelId] ?? EMPTY_CHANNEL_MESSAGES,
  appendMessage: (channelId, partial) => {
    const message: ChannelChatMessage = {
      id: `local_${crypto.randomUUID()}`,
      timestamp: partial.timestamp ?? new Date().toISOString(),
      authorId: partial.authorId,
      authorName: partial.authorName,
      body: partial.body,
      kind: partial.kind,
    };
    set((state) => ({
      messagesByChannel: {
        ...state.messagesByChannel,
        [channelId]: [...(state.messagesByChannel[channelId] ?? EMPTY_CHANNEL_MESSAGES), message],
      },
    }));
  },
}));
