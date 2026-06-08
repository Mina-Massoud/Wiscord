import { EventEmitter } from 'events';

import type { DmRoomDto } from './schemas.js';

interface DmEvents {
  'room:updated': (data: { toUserId: string; room: DmRoomDto }) => void;
}

class TypedEventEmitter extends EventEmitter {
  override on<K extends keyof DmEvents>(eventName: K, listener: DmEvents[K]): this {
    return super.on(eventName, listener as (...args: any[]) => void);
  }

  override emit<K extends keyof DmEvents>(
    eventName: K,
    ...args: Parameters<DmEvents[K]>
  ): boolean {
    return super.emit(eventName, ...args);
  }
}

export const dmEvents = new TypedEventEmitter();
