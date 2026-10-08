import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      users: [],

      // Validate stored token on app load — if missing/invalid or mock token, force logout
      initAuth: () => {
        const storedToken = localStorage.getItem('komazi-auth-token');
        const { token, user } = get();
        if (!storedToken || !token || !user || token.startsWith('mock-jwt-token-')) {
          localStorage.removeItem('komazi-auth-token');
          set({ user: null, token: null, isAuthenticated: false, users: [] });
        }
      },

      login: async (username, password) => {
        try {
          const res = await api.auth.login({ username, password });
          if (res && res.success && res.data?.token) {
            localStorage.setItem('komazi-auth-token', res.data.token);
            set({
              user: res.data.user,
              token: res.data.token,
              isAuthenticated: true,
            });
            return { success: true, user: res.data.user };
          }
          return {
            success: false,
            message: res?.message || 'Username atau password salah',
          };
        } catch (err) {
          return {
            success: false,
            message: 'Gagal terhubung ke backend server: ' + err.message,
          };
        }
      },

      // Fetch users directly from database via backend API
      fetchUsers: async () => {
        try {
          const res = await api.users.getAll();
          if (res && res.success && Array.isArray(res.data)) {
            set({ users: res.data });
            return res.data;
          }
        } catch (err) {
          console.error('[AuthStore] Failed to fetch users:', err);
        }
        return get().users;
      },

      // Add staff account to backend database
      addUser: async (userData) => {
        const { name, username, password, role } = userData;

        try {
          const res = await api.users.create({ name, username, password, role });
          if (res && res.success && res.data) {
            const currentUsers = get().users || [];
            set({ users: [res.data, ...currentUsers] });
            return { success: true, user: res.data };
          }
          const errorMessage = res?.errors?.length
            ? res.errors.map((e) => e.message).join(', ')
            : res?.message || 'Gagal menambahkan staf';
          return { success: false, message: errorMessage };
        } catch (err) {
          return { success: false, message: err.message };
        }
      },

      // Reset password via Forgot Password (Login screen)
      resetPasswordWithPin: async ({ username, securityPin, newPassword }) => {
        try {
          const res = await api.auth.resetPassword({ username, securityPin, newPassword });
          if (res && res.success) {
            return { success: true, message: res.message || 'Password berhasil direset' };
          }
          return { success: false, message: res?.message || 'Gagal mereset password' };
        } catch (err) {
          return { success: false, message: err.message };
        }
      },

      // Reset password directly by Owner
      resetUserPasswordByOwner: async (userId, newPassword) => {
        try {
          const res = await api.users.resetPassword(userId, newPassword);
          if (res && res.success) {
            return { success: true, message: 'Password berhasil diperbarui oleh Owner' };
          }
          return { success: false, message: res?.message || 'Gagal memperbarui password' };
        } catch (err) {
          return { success: false, message: err.message };
        }
      },

      // Delete staff account from database
      deleteUser: async (userId) => {
        try {
          const res = await api.users.delete(userId);
          if (res && res.success) {
            set((state) => ({
              users: state.users.filter((u) => u.id !== userId),
            }));
            return { success: true, message: 'Akun staf berhasil dihapus' };
          }
          return { success: false, message: res?.message || 'Gagal menghapus staf' };
        } catch (err) {
          return { success: false, message: err.message };
        }
      },

      // Update personal profile in database
      updateProfile: async (profileData) => {
        const currentUser = get().user;
        if (!currentUser) return { success: false, message: 'Tidak ada sesi aktif' };

        try {
          const res = await api.auth.updateProfile(profileData);
          if (res && res.success && res.data) {
            const updated = { ...currentUser, ...res.data };
            set((state) => ({
              user: updated,
              users: state.users.map((u) => (u.id === currentUser.id ? { ...u, ...res.data } : u)),
            }));
            return { success: true, user: updated, message: 'Profil berhasil diperbarui' };
          }
          return { success: false, message: res?.message || 'Gagal memperbarui profil' };
        } catch (err) {
          return { success: false, message: err.message };
        }
      },

      logout: () => {
        localStorage.removeItem('komazi-auth-token');
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          users: [],
        });
      },
    }),
    {
      name: 'komazi-auth-storage',
      version: 3,
      migrate: (persistedState, version) => {
        if (version < 3) {
          // Force clean state when migrating away from mock data
          return {
            user: null,
            token: null,
            isAuthenticated: false,
            users: [],
          };
        }
        return persistedState;
      },
    }
  )
);
