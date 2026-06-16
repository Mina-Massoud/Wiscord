export interface MessageReaction {
  emoji: string;
  userIds: string[];
}

export interface MessageDto {
  id: string;
  channelId: string;
  authorId: string;
  author?: MessageAuthor;
  content: string;
  mentions: string[];
  reactions: MessageReaction[];
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TypingEvent {
  channelId: string;
  userId: string;
  username: string;
  isTyping: boolean;
}

export interface ReactionEvent {
  channelId: string;
  messageId: string;
  emoji: string;
  userId: string;
}

export interface MessageAuthor {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

// A more strictly typed version for the frontend usage
export interface FrontendMessage {
  id: string;
  channelId: string;
  author: MessageAuthor;
  content: string;
  mentions: string[];
  reactions: { emoji: string; userIds: string[]; count: number }[];
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
