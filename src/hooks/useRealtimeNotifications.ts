import { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { SystemNotification, UserProfile } from '../types';
import {
  playNotificationSound,
  sendBrowserDesktopNotification,
  markNotificationAsRead as markReadService,
  markAllNotificationsAsRead as markAllReadService,
  deleteSystemNotification as deleteNotifService
} from '../utils/notificationService';

export interface UseRealtimeNotificationsReturn {
  notifications: SystemNotification[];
  filteredNotifications: SystemNotification[];
  unreadCount: number;
  unreadCriticalCount: number;
  activeToasts: SystemNotification[];
  isMuted: boolean;
  toggleMute: () => void;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  dismissToast: (notificationId: string) => void;
  loading: boolean;
}

export function useRealtimeNotifications(profile: UserProfile | null): UseRealtimeNotificationsReturn {
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [activeToasts, setActiveToasts] = useState<SystemNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    return localStorage.getItem('marsil_notifications_muted') === 'true';
  });

  const isInitialLoadRef = useRef(true);
  const knownIdsRef = useRef<Set<string>>(new Set());

  const userKey = profile?.uid || profile?.email || profile?.departmentId || 'anonymous';

  // Toggle sound mute preference
  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      localStorage.setItem('marsil_notifications_muted', next ? 'true' : 'false');
      return next;
    });
  }, []);

  // Dismiss a floating toast
  const dismissToast = useCallback((id: string) => {
    setActiveToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Real-time Firestore listener
  useEffect(() => {
    if (!profile) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const notifQuery = query(
      collection(db, 'system_notifications'),
      orderBy('timestamp', 'desc'),
      limit(60)
    );

    const unsubscribe = onSnapshot(
      notifQuery,
      (snapshot) => {
        const list: SystemNotification[] = [];
        const newItemsToAlert: SystemNotification[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;
          const notifItem: SystemNotification = {
            id: docSnap.id,
            ...data
          };

          // Filter by audience visibility
          const isForThisUser =
            profile.departmentId === 'admin' ||
            notifItem.targetType === 'all' ||
            notifItem.targetDepartment === 'all' ||
            notifItem.targetDepartment === profile.departmentId ||
            notifItem.targetUserId === profile.uid ||
            (profile.role && notifItem.targetRole === profile.role);

          if (isForThisUser) {
            list.push(notifItem);

            // If not initial load and this is a new incoming doc not seen yet
            if (!isInitialLoadRef.current && !knownIdsRef.current.has(docSnap.id)) {
              newItemsToAlert.push(notifItem);
            }
          }
          knownIdsRef.current.add(docSnap.id);
        });

        // Handle alerts for new incoming items
        if (!isInitialLoadRef.current && newItemsToAlert.length > 0) {
          // Play sound for highest severity among new items
          const highestSeverity = newItemsToAlert.some(n => n.severity === 'critical')
            ? 'critical'
            : newItemsToAlert.some(n => n.severity === 'warning')
            ? 'warning'
            : newItemsToAlert.some(n => n.severity === 'success')
            ? 'success'
            : 'info';

          if (!isMuted) {
            playNotificationSound(highestSeverity);
          }

          // Trigger browser notification & in-app toast
          newItemsToAlert.forEach((item) => {
            sendBrowserDesktopNotification(item.title, {
              body: item.message,
              tag: item.id
            });

            // Add to active toast queue
            setActiveToasts((prev) => {
              if (prev.some(t => t.id === item.id)) return prev;
              return [item, ...prev.slice(0, 3)]; // Keep max 4 toasts
            });
          });
        }

        isInitialLoadRef.current = false;
        setNotifications(list);
        setLoading(false);
      },
      (error) => {
        console.warn('Erro ao escutar notificações em tempo real:', error);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [profile, isMuted]);

  // Mark single as read
  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!notificationId) return;
      await markReadService(notificationId, userKey);
      setNotifications(prev =>
        prev.map(n => {
          if (n.id === notificationId) {
            const currentReads = n.readBy || [];
            if (!currentReads.includes(userKey)) {
              return { ...n, readBy: [...currentReads, userKey] };
            }
          }
          return n;
        })
      );
      dismissToast(notificationId);
    },
    [userKey, dismissToast]
  );

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    await markAllReadService(notifications, userKey);
    setNotifications(prev =>
      prev.map(n => {
        const currentReads = n.readBy || [];
        if (!currentReads.includes(userKey)) {
          return { ...n, readBy: [...currentReads, userKey] };
        }
        return n;
      })
    );
    setActiveToasts([]);
  }, [notifications, userKey]);

  // Delete notification
  const deleteNotification = useCallback(
    async (notificationId: string) => {
      await deleteNotifService(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      dismissToast(notificationId);
    },
    [dismissToast]
  );

  // Unread calculation
  const unreadCount = notifications.filter(
    n => !n.readBy || !n.readBy.includes(userKey)
  ).length;

  const unreadCriticalCount = notifications.filter(
    n => n.severity === 'critical' && (!n.readBy || !n.readBy.includes(userKey))
  ).length;

  return {
    notifications,
    filteredNotifications: notifications,
    unreadCount,
    unreadCriticalCount,
    activeToasts,
    isMuted,
    toggleMute,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    dismissToast,
    loading
  };
}
