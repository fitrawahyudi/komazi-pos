import { create } from 'zustand';
import { persist } from 'zustand/middleware';
let topBarWatchdogTimer = null;
 
export const useUiStore = create(
  persist(
    (set, get) => ({
      isMobileSidebarOpen: false,
      isMobileCartOpen: false,
      isSidebarCollapsed: false,
      isBluetoothModalOpen: false,

      // Generic Feature Preferences dictionary
      featurePreferences: {},
      setFeaturePreference: (featureKey, keyOrValues, value) => {
        set((state) => {
          const current = state.featurePreferences[featureKey] || {};
          let updated;
          if (typeof keyOrValues === 'string') {
            updated = { ...current, [keyOrValues]: value };
          } else if (typeof keyOrValues === 'object' && keyOrValues !== null) {
            updated = { ...current, ...keyOrValues };
          } else {
            updated = current;
          }
          return {
            featurePreferences: {
              ...state.featurePreferences,
              [featureKey]: updated,
            },
          };
        });
      },
      getFeaturePreference: (featureKey, key, defaultValue) => {
        const prefs = get().featurePreferences[featureKey];
        if (!prefs || prefs[key] === undefined) return defaultValue;
        return prefs[key];
      },

      setMobileSidebarOpen: (isOpen) => set({ isMobileSidebarOpen: isOpen }),
      toggleMobileSidebar: () => set((state) => ({ isMobileSidebarOpen: !state.isMobileSidebarOpen })),

      setMobileCartOpen: (isOpen) => set({ isMobileCartOpen: isOpen }),
      toggleMobileCart: () => set((state) => ({ isMobileCartOpen: !state.isMobileCartOpen })),

      setSidebarCollapsed: (isCollapsed) => set({ isSidebarCollapsed: isCollapsed }),
      toggleSidebarCollapsed: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

      openBluetoothModal: () => set({ isBluetoothModalOpen: true }),
      closeBluetoothModal: () => set({ isBluetoothModalOpen: false }),

      isUsbModalOpen: false,
      openUsbModal: () => set({ isUsbModalOpen: true }),
      closeUsbModal: () => set({ isUsbModalOpen: false }),

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
      partialize: (state) => ({
        isSidebarCollapsed: state.isSidebarCollapsed,
        featurePreferences: state.featurePreferences,
      }),
    }
  )
);
