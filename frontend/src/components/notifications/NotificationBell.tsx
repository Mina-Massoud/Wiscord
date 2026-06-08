import { AtSign, Bell, Check, MessageCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router';

import { cn } from '@/lib/cn';
import {
  useClearReadNotifications,
  useDeleteNotification,
  useMarkNotificationRead,
  useNotifications,
  type NotificationDto,
} from '@/queries/notifications';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { UnreadBadge } from '@/components/app-shell/atoms/UnreadBadge';

function notificationLabel(notification: NotificationDto): string {
  if (notification.type === 'mention') return 'You were mentioned';
  if (notification.type === 'dm') return 'New direct message';
  return 'System notification';
}

function NotificationIcon({ type }: { type: NotificationDto['type'] }): React.JSX.Element {
  if (type === 'mention') return <AtSign className="size-4" aria-hidden />;
  if (type === 'dm') return <MessageCircle className="size-4" aria-hidden />;
  return <Bell className="size-4" aria-hidden />;
}

// eslint-disable-next-line react/no-multi-comp
export function NotificationBell(): React.JSX.Element {
  const { data: notifications = [] } = useNotifications();
  const markRead = useMarkNotificationRead();
  const deleteNotification = useDeleteNotification();
  const clearReadNotifications = useClearReadNotifications();
  const navigate = useNavigate();

  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const mentionCount = notifications.filter(
    (notification) => notification.type === 'mention' && !notification.read,
  ).length;
  const hasReadNotifications = notifications.some((notification) => notification.read);

  const handleNotificationClick = (notification: NotificationDto): void => {
    if (!notification.read) {
      markRead.mutate({ notificationId: notification.id });
    }

    // Navigate to target location based on notification type
    if (notification.type === 'mention' && notification.serverId && notification.channelId) {
      const url = `/app/servers/${notification.serverId}/channels/${notification.channelId}`;
      const withMessage = notification.messageId ? `${url}?highlight=${notification.messageId}` : url;
      navigate(withMessage);
    } else if (notification.type === 'dm' && notification.channelId) {
      const url = `/app/dms/${notification.channelId}`;
      const withMessage = notification.messageId ? `${url}?highlight=${notification.messageId}` : url;
      navigate(withMessage);
    }
  };

  const handleDeleteNotification = (e: React.MouseEvent, notificationId: string): void => {
    e.stopPropagation();
    deleteNotification.mutate({ notificationId });
  };

  const handleClearRead = (e: React.MouseEvent): void => {
    e.stopPropagation();
    clearReadNotifications.mutate();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="hover:text-ink relative flex size-7 items-center justify-center rounded-md"
        >
          <Bell className="size-4" />
          {unreadCount > 0 ? (
            <UnreadBadge count={unreadCount} className="absolute -top-1 -right-1" />
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="bg-glass-surface-chrome border-glass-border w-80 p-0 text-ink shadow-xl"
      >
        <div className="border-glass-border flex h-11 items-center justify-between border-b px-3">
          <div className="flex items-center gap-2">
            <span className="text-control font-semibold">Notifications</span>
            {mentionCount > 0 ? (
              <span className="bg-blurple/15 text-blurple flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold">
                <AtSign className="size-3" aria-hidden />
                {mentionCount}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {hasReadNotifications && (
              <button
                type="button"
                onClick={handleClearRead}
                disabled={clearReadNotifications.isPending}
                className="hover:text-ink text-ink-subtle text-caption font-medium transition-colors disabled:opacity-50"
              >
                Clear Read
              </button>
            )}
            <span className="text-ink-subtle text-caption">{unreadCount} unread</span>
          </div>
        </div>

        <div className="max-h-96 rounded-3xl overflow-y-auto ">
          {notifications.length === 0 ? (
            <div className="text-ink-subtle px-3 py-8 text-center text-sm">
              No notifications yet.
            </div>
          ) : (
            notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleNotificationClick(notification)}
                className={cn(
                  'hover:bg-glass-hover flex w-full items-start gap-3 px-3 py-2 text-left transition-colors',
                  !notification.read && 'bg-gray-900 border-l-2 hover:bg-gray-800',
                  notification.read && 'bg-gray-900 border-l-2 hover:bg-gray-800',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md',
                    notification.type === 'mention'
                      ? 'bg-blurple/15 text-blurple'
                      : 'bg-glass-surface-2 text-ink-muted',
                  )}
                >
                  <NotificationIcon type={notification.type} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-control block truncate font-medium">
                    {notificationLabel(notification)}
                  </span>
                  <span className="text-ink-subtle text-caption block truncate">
                    {new Date(notification.createdAt).toLocaleString()}
                  </span>
                </span>
                {notification.read ? (
                  <Check className="text-ink-subtle mt-1 size-4 shrink-0" aria-hidden />
                ) : (
                  <span className="bg-destructive mt-2 size-2 shrink-0 rounded-full" />
                )}
                <button
                  type="button"
                  onClick={(e) => handleDeleteNotification(e, notification.id)}
                  disabled={deleteNotification.isPending}
                  className="hover:text-ink text-ink-subtle size-4 shrink-0 transition-colors disabled:opacity-50"
                  aria-label="Delete notification"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
