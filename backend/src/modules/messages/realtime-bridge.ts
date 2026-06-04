import { EventEmitter } from 'events';
import type { MessageDoc } from '../../db/models/index.js';

interface MessageEvents {
  'message:created': (data: { channelId: string; message: MessageDoc }) => void;
  'message:updated': (data: { channelId: string; message: MessageDoc }) => void;
  'message:deleted': (data: { channelId: string; messageId: string }) => void;
  'message:reaction_added': (data: { channelId: string; messageId: string; emoji: string; userId: string }) => void;
  'message:reaction_removed': (data: { channelId: string; messageId: string; emoji: string; userId: string }) => void;
}

class TypedEventEmitter extends EventEmitter {
  override on<K extends keyof MessageEvents>(eventName: K, listener: MessageEvents[K]): this {
    return super.on(eventName, listener as (...args: any[]) => void);
  }

  override emit<K extends keyof MessageEvents>(eventName: K, ...args: Parameters<MessageEvents[K]>): boolean {
    return super.emit(eventName, ...args);
  }
}

export const messageEvents = new TypedEventEmitter();
