import { EventEmitter } from 'events';

import type { NotificationDto } from './schemas.js';

interface NotificationEvents {
  'notification:created': (data: { toUserId: string; notification: NotificationDto }) => void;
  'notification:updated': (data: { toUserId: string; notification: NotificationDto }) => void;
  'notification:deleted': (data: { toUserId: string; notificationId: string }) => void;
  'notification:read-cleared': (data: { toUserId: string }) => void;
}

class TypedEventEmitter extends EventEmitter {
  override on<K extends keyof NotificationEvents>(
    eventName: K,
    listener: NotificationEvents[K],
  ): this {
    return super.on(eventName, listener as (...args: any[]) => void);
  }

  override emit<K extends keyof NotificationEvents>(
    eventName: K,
    ...args: Parameters<NotificationEvents[K]>
  ): boolean {
    return super.emit(eventName, ...args);
  }
}

export const notificationEvents = new TypedEventEmitter();
