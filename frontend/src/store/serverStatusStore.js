import { create } from 'zustand';
import { getSocket } from '../services/socket';
import { resolveApiBaseUrl } from '../services/api';

export const useServerStatusStore = create((set, get) => ({
  status: 'CONNECTING', // 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED'
  isSocketConnected: false,
  isServerReachable: false,
  latency: null, // latency in ms
  lastChecked: null,
  errorMessage: null,
  isChecking: false,

  // Probe server health via HTTP GET /health
  checkHealth: async () => {
    set({ isChecking: true });
    const startTime = performance.now();

    try {
      // Build clean health URL using standardized base URL
      const baseUrl = resolveApiBaseUrl();
      const healthUrl = `${baseUrl}/health`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(healthUrl, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const endTime = performance.now();
      const latencyMs = Math.round(endTime - startTime);

      if (res.ok) {
        const socket = getSocket();
        const isSocketOk = Boolean(socket && socket.connected);

        set({
          status: 'CONNECTED',
          isServerReachable: true,
          isSocketConnected: isSocketOk,
          latency: latencyMs,
          lastChecked: new Date(),
          errorMessage: null,
          isChecking: false,
        });
        return true;
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      const socket = getSocket();
      const isSocketOk = Boolean(socket && socket.connected);

      if (isSocketOk) {
        // Socket.IO is still alive and streaming even if HTTP experienced a momentary blip
        set({
          status: 'CONNECTED',
          isServerReachable: true,
          isSocketConnected: true,
          lastChecked: new Date(),
          errorMessage: null,
          isChecking: false,
        });
        return true;
      }

      set({
        status: 'DISCONNECTED',
        isServerReachable: false,
        isSocketConnected: false,
        latency: null,
        lastChecked: new Date(),
        errorMessage: err.message || 'Server tidak merespons',
        isChecking: false,
      });
      return false;
    }
  },

  // Manual reconnect trigger
  reconnect: () => {
    const socket = getSocket();
    if (socket && !socket.connected) {
      socket.connect();
    }
    return get().checkHealth();
  },

  // Inisialisasi listener Socket.IO dan lifecycle monitor
  initServerMonitor: () => {
    if (typeof window === 'undefined') return;

    try {
      const socket = getSocket();
      if (socket) {
        socket.on('connect', () => {
          set({
            status: 'CONNECTED',
            isSocketConnected: true,
            isServerReachable: true,
            lastChecked: new Date(),
            errorMessage: null,
          });
        });

        socket.on('disconnect', () => {
          set({
            status: 'CONNECTING',
            isSocketConnected: false,
          });
          get().checkHealth();
        });

        socket.on('connect_error', (err) => {
          set({
            status: 'DISCONNECTED',
            isSocketConnected: false,
            errorMessage: err?.message || 'Gagal koneksi Socket.IO',
          });
          get().checkHealth();
        });

        socket.on('reconnect_attempt', () => {
          set({ status: 'CONNECTING' });
        });

        socket.on('reconnect', () => {
          set({
            status: 'CONNECTED',
            isSocketConnected: true,
            isServerReachable: true,
            lastChecked: new Date(),
            errorMessage: null,
          });
        });
      }
    } catch (e) {
      console.warn('[ServerStatusStore] Socket monitor init warning:', e);
    }

    // Tangani event online/offline browser window
    const handleOnline = () => {
      set({ status: 'CONNECTING' });
      const socket = getSocket();
      socket?.connect();
      get().checkHealth();
    };

    const handleOffline = () => {
      set({
        status: 'DISCONNECTED',
        isServerReachable: false,
        isSocketConnected: false,
        errorMessage: 'Koneksi jaringan terputus (Offline)',
      });
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        get().checkHealth();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    // Initial check
    get().checkHealth();

    // Heartbeat check setiap 15 detik
    const intervalId = setInterval(() => {
      get().checkHealth();
    }, 15000);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  },
}));
