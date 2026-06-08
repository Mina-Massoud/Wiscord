import { EventEmitter } from 'events';
import type { MessageDto } from './schemas.js';

interface MessageEvents {
  'message:created': (data: { channelId: string; isDm: boolean; message: MessageDto; serverId?: string }) => void;
  'message:updated': (data: { channelId: string; isDm: boolean; message: MessageDto }) => void;
  'message:deleted': (data: { channelId: string; isDm: boolean; messageId: string }) => void;
  'message:reaction_added': (data: { channelId: string; isDm: boolean; messageId: string; emoji: string; userId: string }) => void;
  'message:reaction_removed': (data: { channelId: string; isDm: boolean; messageId: string; emoji: string; userId: string }) => void;
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
