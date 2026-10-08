import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
    }),
    {
      name: 'komazi-ui-prefs',
      partialize: (state) => ({ isSidebarCollapsed: state.isSidebarCollapsed }),
    }
  )
);
