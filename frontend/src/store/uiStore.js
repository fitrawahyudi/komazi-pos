import { create } from 'zustand';
import { persist } from 'zustand/middleware';
let topBarWatchdogTimer = null;
 
export const useUiStore = create(
  persist(
    (set) => ({
      isMobileSidebarOpen: false,
      isMobileCartOpen: false,
      isSidebarCollapsed: false,
      isBluetoothModalOpen: false,

      setMobileSidebarOpen: (isOpen) => set({ isMobileSidebarOpen: isOpen }),
      toggleMobileSidebar: () => set((state) => ({ isMobileSidebarOpen: !state.isMobileSidebarOpen })),

      setMobileCartOpen: (isOpen) => set({ isMobileCartOpen: isOpen }),
      toggleMobileCart: () => set((state) => ({ isMobileCartOpen: !state.isMobileCartOpen })),

      setSidebarCollapsed: (isCollapsed) => set({ isSidebarCollapsed: isCollapsed }),
      toggleSidebarCollapsed: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

      openBluetoothModal: () => set({ isBluetoothModalOpen: true }),
      closeBluetoothModal: () => set({ isBluetoothModalOpen: false }),

      // Top Progress Bar state with auto-timeout watchdog (max 8 seconds)
      isTopBarLoading: false,
      startTopBarLoading: () => {
        if (topBarWatchdogTimer) clearTimeout(topBarWatchdogTimer);
        topBarWatchdogTimer = setTimeout(() => {
          set({ isTopBarLoading: false });
          topBarWatchdogTimer = null;
        }, 8000);
        set({ isTopBarLoading: true });
      },
      stopTopBarLoading: () => {
        if (topBarWatchdogTimer) {
          clearTimeout(topBarWatchdogTimer);
          topBarWatchdogTimer = null;
        }
        set({ isTopBarLoading: false });
      },

      // Global Critical Action Overlay
      globalOverlay: {
        isOpen: false,
        title: '',
        message: '',
        step: 1,
        totalSteps: 1,
        steps: [],
      },
      showActionOverlay: ({ title = 'Memproses...', message = '', step = 1, totalSteps = 1, steps = [] } = {}) =>
        set({
          globalOverlay: { isOpen: true, title, message, step, totalSteps, steps },
        }),
      updateActionOverlay: (updates) =>
        set((state) => ({
          globalOverlay: { ...state.globalOverlay, ...updates },
        })),
      hideActionOverlay: () =>
        set({
          globalOverlay: { isOpen: false, title: '', message: '', step: 1, totalSteps: 1, steps: [] },
        }),
    }),
    {
      name: 'komazi-ui-prefs',
      partialize: () => ({}),
    }
  )
);
