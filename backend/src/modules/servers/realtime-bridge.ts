import { EventEmitter } from 'events';

export interface ServerUnreadChanged {
  serverId: string;
  channelId: string;
}

interface ServerUnreadEvents {
  changed: (event: ServerUnreadChanged) => void;
}

class TypedEventEmitter extends EventEmitter {
  override on<K extends keyof ServerUnreadEvents>(eventName: K, listener: ServerUnreadEvents[K]): this {
    return super.on(eventName, listener as (...args: any[]) => void);
  }

  override emit<K extends keyof ServerUnreadEvents>(
    eventName: K,
    ...args: Parameters<ServerUnreadEvents[K]>
  ): boolean {
    return super.emit(eventName, ...args);
  }
}

export const serverUnreadEvents = new TypedEventEmitter();
