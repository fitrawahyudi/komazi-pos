import React, { useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNotificationStore } from '../../store/notificationStore';
import { getSocket } from '../../services/socket';

export default function NotificationBellButton({ className = '' }) {
  const { unreadCount, toggleCenter, fetchUnreadCount, addRealtimeNotification } = useNotificationStore();

  useEffect(() => {
    // Initial fetch of unread count on mount
    fetchUnreadCount();

    // Listen to realtime socket notification events
    try {
      const socket = getSocket();
      const handleNewNotification = (notif) => {
        addRealtimeNotification(notif);
      };

      socket.on('notification:new', handleNewNotification);

      return () => {
        socket.off('notification:new', handleNewNotification);
      };
    } catch (err) {
      console.warn('[NotificationBell] Socket listener attachment warning:', err);
    }
  }, [fetchUnreadCount, addRealtimeNotification]);

  return (
    <button
      type="button"
      onClick={toggleCenter}
      title={unreadCount > 0 ? `${unreadCount} pemberitahuan belum dibaca` : 'Pemberitahuan'}
      aria-label={`Pemberitahuan, ${unreadCount} belum dibaca`}
      className={`relative p-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-komazi-muted hover:text-white hover:border-komazi-coral/40 transition-all shadow-sm active:scale-95 flex items-center justify-center shrink-0 ${className}`}
    >
      <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-komazi-text transition-transform group-hover:rotate-12" />

      {unreadCount > 0 && (
        <span
          className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-black rounded-full bg-komazi-coral text-white shadow-[0_0_8px_rgba(255,87,34,0.6)] animate-pulse"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
