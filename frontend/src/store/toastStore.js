import { create } from 'zustand';

export const useToastStore = create((set, get) => ({
  toasts: [],

  addToast: ({ type = 'info', title, message, duration = 3500 }) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    const newToast = { id, type, title, message, duration, createdAt: Date.now() };

    set((state) => ({
      toasts: [newToast, ...state.toasts.slice(0, 4)], // Keep at most 5 toasts visible
    }));

    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }

    return id;
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearAll: () => set({ toasts: [] }),
}));

// Convenient standalone helper export
export const toast = {
  success: (message, title = 'Berhasil') =>
    useToastStore.getState().addToast({ type: 'success', title, message }),
  error: (message, title = 'Peringatan / Error') =>
    useToastStore.getState().addToast({ type: 'error', title, message, duration: 4500 }),
  warning: (message, title = 'Perhatian') =>
    useToastStore.getState().addToast({ type: 'warning', title, message, duration: 4000 }),
  warn: (message, title = 'Perhatian') =>
    useToastStore.getState().addToast({ type: 'warning', title, message, duration: 4000 }),
  info: (message, title = 'Informasi') =>
    useToastStore.getState().addToast({ type: 'info', title, message }),
};

