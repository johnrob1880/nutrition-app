import { useState, useEffect, useRef } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  userId: number;
  operationId: number;
  type: 'task_assigned' | 'task_completed' | 'feeding_program_ready';
  title: string;
  message: string;
  relatedEntityId?: string;
  relatedEntityType?: 'pen' | 'task' | 'feeding_program';
  isRead: boolean;
  createdAt: string;
  readAt?: string;
}

interface NotificationDropdownProps {
  userId: number;
}

export function NotificationDropdown({ userId }: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();

  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      const response = await fetch(`/api/notifications?userId=${userId}&limit=20`);
      if (!response.ok) throw new Error('Failed to fetch notifications');
      return response.json();
    },
    enabled: !!userId,
    refetchInterval: false, // Disable polling when WebSocket is enabled
    staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
  });

  // Fetch unread count
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications-unread-count', userId],
    queryFn: async () => {
      const response = await fetch(`/api/notifications/unread-count?userId=${userId}`);
      if (!response.ok) throw new Error('Failed to fetch unread count');
      const data = await response.json();
      return data.count;
    },
    enabled: !!userId,
    refetchInterval: false, // Disable polling when WebSocket is enabled
    staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
      });
      if (!response.ok) throw new Error('Failed to mark notification as read');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', userId] });
    },
  });

  // WebSocket real-time notifications
  useEffect(() => {
    if (!userId) return;

    // Request notification permission
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const connectWebSocket = () => {
      try {
        const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/notifications?userId=${userId}`;
        console.log('Connecting to WebSocket:', wsUrl);

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('WebSocket connected for notifications');
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);

            if (message.type === 'notification') {
              // Invalidate queries to refresh the UI with new notifications
              queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
              queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', userId] });

              // Show browser notification if permitted
              if (Notification.permission === 'granted') {
                new Notification(message.data.title || 'New Notification', {
                  body: message.data.message,
                  icon: '/favicon.ico',
                  tag: message.data.type || 'general'
                });
              }
            } else if (message.type === 'connection') {
              console.log('WebSocket connection confirmed:', message.message);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };

        ws.onclose = (event) => {
          console.log('WebSocket connection closed:', event.code, event.reason);

          // Attempt to reconnect after 5 seconds if not a clean close
          if (event.code !== 1000 && userId) {
            setTimeout(() => {
              console.log('Attempting to reconnect WebSocket...');
              connectWebSocket();
            }, 5000);
          }
        };

      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000);
      }
    };
  }, [userId, queryClient]);

  const handleMarkAsRead = (notificationId: string) => {
    markAsReadMutation.mutate(notificationId);
  };

  const handleMarkAllAsRead = () => {
    const unreadNotifications = notifications.filter((n: Notification) => !n.isRead);
    unreadNotifications.forEach((n: Notification) => {
      markAsReadMutation.mutate(n.id);
    });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task_assigned':
        return '📋';
      case 'task_completed':
        return '✅';
      case 'feeding_program_ready':
        return '🐄';
      default:
        return '📢';
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="text-xs"
            >
              Mark all as read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            notifications.map((notification: Notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`p-3 cursor-pointer ${
                  !notification.isRead ? 'bg-accent/50' : ''
                }`}
                onClick={() => {
                  if (!notification.isRead) {
                    handleMarkAsRead(notification.id);
                  }
                  // Handle navigation based on notification type
                  if (notification.relatedEntityType === 'pen' && notification.relatedEntityId) {
                    window.location.href = `/pens/${notification.relatedEntityId}`;
                  } else if (notification.relatedEntityType === 'task' && notification.relatedEntityId) {
                    window.location.href = `/tasks/${notification.relatedEntityId}`;
                  }
                }}
              >
                <div className="flex gap-3 w-full">
                  <span className="text-2xl">{getNotificationIcon(notification.type)}</span>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  {!notification.isRead && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                  )}
                </div>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Hook for using notifications in other components
export function useNotifications(userId: number) {
  const queryClient = useQueryClient();

  const sendNotification = async (notification: Partial<Notification>) => {
    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...notification,
        userId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to send notification');
    }

    const data = await response.json();

    // Invalidate queries to refresh the UI
    queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', userId] });

    return data;
  };

  return {
    sendNotification,
  };
}