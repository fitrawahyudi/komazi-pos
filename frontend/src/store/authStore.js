import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';
import { NotificationService } from '../services/notification.service';

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
          localStorage.removeItem('komazi-refresh-token');
          set({ user: null, token: null, isAuthenticated: false, users: [] });
        }
      },

      login: async (username, password) => {
        try {
          const res = await api.auth.login({ username, password });
          if (res && res.success && res.data?.token) {
            localStorage.setItem('komazi-auth-token', res.data.token);
            if (res.data.refreshToken) {
              localStorage.setItem('komazi-refresh-token', res.data.refreshToken);
            }
            set({
              user: res.data.user,
              token: res.data.token,
              isAuthenticated: true,
            });
            // Sinkronkan token perangkat FCM dengan akun user yang baru login
            NotificationService.syncPushTokenWithBackend().catch(() => {});
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

      // Terbitkan token reset password sekali pakai oleh Owner
      createResetToken: async (userId) => {
        try {
          const res = await api.users.createResetToken(userId);
          if (res && res.success && res.data) {
            return { success: true, data: res.data, message: res.message };
          }
          return { success: false, message: res?.message || 'Gagal menerbitkan token reset' };
        } catch (err) {
          return { success: false, message: err.message };
        }
      },

      // Cabut token reset aktif oleh Owner
      revokeResetToken: async (userId) => {
        try {
          const res = await api.users.revokeResetToken(userId);
          if (res && res.success) {
            return { success: true, message: res.message || 'Token berhasil dibatalkan' };
          }
          return { success: false, message: res?.message || 'Gagal membatalkan token' };
        } catch (err) {
          return { success: false, message: err.message };
        }
      },

      // Cek status token reset aktif untuk user tertentu
      getResetTokenStatus: async (userId) => {
        try {
          const res = await api.users.getResetTokenStatus(userId);
          if (res && res.success && res.data) {
            return res.data;
          }
        } catch (err) {
          console.warn('[AuthStore] Gagal mengecek status token:', err?.message);
        }
        return { hasActiveToken: false };
      },

      // Verifikasi token reset publik sebelum submit form
      verifyResetToken: async (token) => {
        try {
          const res = await api.auth.verifyResetToken(token);
          if (res && res.success && res.data) {
            return { success: true, data: res.data };
          }
          return { success: false, message: res?.message || 'Token tidak valid' };
        } catch (err) {
          return { success: false, message: err.message };
        }
      },

      // Pengguna menyelesaikan pergantian password dengan token sekali pakai
      completePasswordReset: async ({ token, newPassword, confirmPassword }) => {
        try {
          const res = await api.auth.completePasswordReset({ token, newPassword, confirmPassword });
          if (res && res.success) {
            return { success: true, message: res.message || 'Password berhasil diperbarui' };
          }
          return { success: false, message: res?.message || 'Gagal mengubah password' };
        } catch (err) {
          return { success: false, message: err.message };
        }
      },

      // Reset password via Forgot Password (Login screen legacy)
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

      // Ambil data profil terbaru dari database
      refreshProfile: async () => {
        try {
          const res = await api.auth.getProfile();
          if (res && res.success && res.data) {
            const currentUser = get().user || {};
            const updated = { ...currentUser, ...res.data };
            set((state) => ({
              user: updated,
              users: state.users.map((u) => (u.id === updated.id ? { ...u, ...res.data } : u)),
            }));
            return { success: true, user: updated };
          }
          return { success: false, message: res?.message || 'Gagal memuat profil' };
        } catch (err) {
          console.warn('[AuthStore] Failed to refresh profile:', err);
          return { success: false, message: err.message };
        }
      },

      // Buat kode tautan Telegram untuk akun saat ini
      generateTelegramLinkCode: async () => {
        const currentUser = get().user;
        if (!currentUser) return { success: false, message: 'Tidak ada sesi aktif' };
        try {
          const res = await api.telegram.generateLinkCode(currentUser.id);
          if (res && res.success && res.data) {
            return { success: true, data: res.data };
          }
          return { success: false, message: res?.message || 'Gagal membuat kode tautan' };
        } catch (err) {
          return { success: false, message: err.message || 'Terjadi kesalahan sistem' };
        }
      },

      // Putuskan tautan bot Telegram akun saat ini
      unlinkTelegram: async () => {
        const currentUser = get().user;
        if (!currentUser) return { success: false, message: 'Tidak ada sesi aktif' };
        try {
          const res = await api.telegram.unlink(currentUser.id);
          if (res && res.success) {
            await get().refreshProfile();
            return { success: true, message: 'Tautan Telegram berhasil diputuskan' };
          }
          return { success: false, message: res?.message || 'Gagal memutuskan tautan' };
        } catch (err) {
          return { success: false, message: err.message || 'Terjadi kesalahan sistem' };
        }
      },

      logout: () => {
        // Lepas relasi token perangkat FCM agar akun berikutnya tidak menerima notifikasi akun ini
        NotificationService.unregisterPushToken().catch(() => {});
        localStorage.removeItem('komazi-auth-token');
        localStorage.removeItem('komazi-refresh-token');
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
