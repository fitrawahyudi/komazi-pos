import { create } from 'zustand';
import { api } from '../services/api';

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
  activeCategory: 'ALL',
  isCenterOpen: false,
  pagination: {
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  },

  openCenter: () => {
    set({ isCenterOpen: true });
    get().fetchNotifications();
    get().fetchUnreadCount();
  },

  closeCenter: () => set({ isCenterOpen: false }),
  toggleCenter: () => {
    const nextState = !get().isCenterOpen;
    set({ isCenterOpen: nextState });
    if (nextState) {
      get().fetchNotifications();
      get().fetchUnreadCount();
    }
  },

  setActiveCategory: (category) => {
    set({ activeCategory: category });
    get().fetchNotifications({ category: category === 'ALL' ? null : category });
  },

  fetchNotifications: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const { activeCategory } = get();
      const categoryParam = params.category !== undefined
        ? params.category
        : activeCategory === 'ALL'
        ? null
        : activeCategory;

      const res = await api.notifications.getAll({
        ...params,
        ...(categoryParam ? { category: categoryParam } : {}),
      });

      if (res && res.success && res.data) {
        set({
          notifications: res.data.notifications || [],
          pagination: res.data.pagination || get().pagination,
          loading: false,
        });
        return res.data.notifications;
      }
      set({ loading: false });
    } catch (err) {
      set({ loading: false, error: err.message });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const res = await api.notifications.getUnreadCount();
      if (res && res.success && res.data?.count !== undefined) {
        set({ unreadCount: Number(res.data.count) });
        return res.data.count;
      }
    } catch (err) {
      console.warn('[NotificationStore] Gagal mengambil unread count:', err.message);
    }
    return get().unreadCount;
  },

  markAsRead: async (id) => {
    // Optimistic UI update
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));

    try {
      await api.notifications.markAsRead(id);
    } catch (err) {
      console.warn('[NotificationStore] Gagal menandai dibaca:', err.message);
    }
  },

  markAllAsRead: async () => {
    // Optimistic UI update
    set((state) => ({
      notifications: state.notifications.map((n) => ({
        ...n,
        isRead: true,
        readAt: new Date().toISOString(),
      })),
      unreadCount: 0,
    }));

    try {
      await api.notifications.markAllAsRead();
    } catch (err) {
      console.warn('[NotificationStore] Gagal menandai semua dibaca:', err.message);
    }
  },

  addRealtimeNotification: (notif) => {
    if (!notif) return;
    const { activeCategory, notifications, unreadCount } = get();

    // Check if already in list to avoid duplicates
    if (notifications.some((n) => n.id === notif.id)) return;

    const matchesCategory =
      activeCategory === 'ALL' || notif.category === activeCategory;

    set({
      notifications: matchesCategory ? [notif, ...notifications] : notifications,
      unreadCount: unreadCount + 1,
    });
  },
}));

export default useNotificationStore;
