import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

export const useShiftStore = create(
  persist(
    (set, get) => ({
      activeShift: null,
      shiftHistory: [],
      isLoading: false,
      lastSyncedAt: null,

      /**
       * Ambil shift aktif langsung dari database MySQL via backend API
       */
      fetchActiveShift: async () => {
        try {
          set({ isLoading: true });
          const res = await api.shifts.getCurrent();

          if (res && res.success && res.data) {
            const shiftData = res.data;
            const existingMovements = get().activeShift?.cashMovements || [];

            const syncedShift = {
              id: shiftData.id,
              cashierId: shiftData.cashierId,
              cashierName: shiftData.cashierName || shiftData.cashier?.name || 'Kasir',
              openedAt: shiftData.openedAt,
              closedAt: shiftData.closedAt,
              openingCash: Number(shiftData.openingCash || 0),
              closingCash: shiftData.closingCash ? Number(shiftData.closingCash) : null,
              expectedCash: Number(shiftData.expectedCash || 0),
              totalCashSales: Number(shiftData.totalCashSales || shiftData.cashSales || 0),
              totalNonCashSales: Number(shiftData.totalNonCashSales || shiftData.nonCashSales || 0),
              totalCashIn: Number(get().activeShift?.totalCashIn || 0),
              totalCashOut: Number(get().activeShift?.totalCashOut || 0),
              cashMovements: existingMovements,
              ordersCount: shiftData.ordersCount || 0,
              isClosed: false,
            };

            set({
              activeShift: syncedShift,
              isLoading: false,
              lastSyncedAt: new Date().toISOString(),
            });
            return syncedShift;
          } else {
            set({ activeShift: null, isLoading: false, lastSyncedAt: new Date().toISOString() });
            return null;
          }
        } catch (err) {
          console.warn('[ShiftStore] Gagal sinkronisasi shift aktif dari backend:', err?.message);
          set({ isLoading: false });
          return get().activeShift;
        }
      },

      /**
       * Buka shift kasir baru dan simpan ke database MySQL
       */
      openShift: async (cashier, openingCash) => {
        const numOpeningCash = Number(openingCash) || 0;
        try {
          set({ isLoading: true });
          const res = await api.shifts.open({ openingCash: numOpeningCash });

          if (res && res.success && res.data) {
            const newShift = {
              id: res.data.id,
              cashierId: res.data.cashierId || cashier?.id,
              cashierName: res.data.cashierName || res.data.cashier?.name || cashier?.name || 'Kasir',
              openedAt: res.data.openedAt || new Date().toISOString(),
              openingCash: numOpeningCash,
              totalCashSales: 0,
              totalNonCashSales: 0,
              totalCashIn: 0,
              totalCashOut: 0,
              cashMovements: [],
              isClosed: false,
            };

            set({
              activeShift: newShift,
              isLoading: false,
              lastSyncedAt: new Date().toISOString(),
            });

            return newShift;
          } else {
            throw new Error(res?.message || 'Gagal membuka shift di server');
          }
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      /**
       * Tutup shift kasir dan rekap selisih kas di database MySQL
       */
      closeShift: async (closingCash, notes = '') => {
        const shift = get().activeShift;
        if (!shift) throw new Error('Tidak ada shift aktif yang ditemukan');

        const numClosingCash = Number(closingCash) || 0;

        try {
          set({ isLoading: true });
          const res = await api.shifts.close({
            closingCash: numClosingCash,
            notes: notes || '',
          });

          if (res && res.success && res.data) {
            const closedData = res.data;
            const completedShift = {
              ...shift,
              closedAt: closedData.closedAt || new Date().toISOString(),
              closingCash: numClosingCash,
              expectedCash: Number(closedData.expectedCash || shift.expectedCash || 0),
              difference: Number(closedData.difference || (numClosingCash - (shift.expectedCash || 0))),
              notes,
              isClosed: true,
            };

            set((state) => ({
              activeShift: null,
              shiftHistory: [completedShift, ...state.shiftHistory.filter((s) => s.id !== completedShift.id)],
              isLoading: false,
              lastSyncedAt: new Date().toISOString(),
            }));

            // Refresh riwayat shift dari DB di background
            get().fetchShiftHistory().catch(() => {});

            return completedShift;
          } else {
            throw new Error(res?.message || 'Gagal menutup shift di server');
          }
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      /**
       * Ambil riwayat shift dari database MySQL
       */
      fetchShiftHistory: async () => {
        try {
          const res = await api.shifts.getHistory({ limit: 50 });
          if (res && res.success && Array.isArray(res.data)) {
            set({ shiftHistory: res.data });
            return res.data;
          }
        } catch (err) {
          console.warn('[ShiftStore] Gagal mengambil riwayat shift dari server:', err?.message);
        }
        return get().shiftHistory;
      },

      /**
       * Optimistic update saat ada transaksi penjualan POS
       */
      recordSaleToShift: (paymentMethod, amount) => {
        const shift = get().activeShift;
        if (!shift || shift.isClosed) return;

        const numAmount = Number(amount) || 0;

        if (paymentMethod === 'CASH') {
          const newCashSales = (shift.totalCashSales || 0) + numAmount;
          const newExpected = (shift.openingCash || 0) + newCashSales + (shift.totalCashIn || 0) - (shift.totalCashOut || 0);

          set({
            activeShift: {
              ...shift,
              totalCashSales: newCashSales,
              expectedCash: newExpected,
            },
          });
        } else {
          set({
            activeShift: {
              ...shift,
              totalNonCashSales: (shift.totalNonCashSales || 0) + numAmount,
            },
          });
        }
      },

      /**
       * Catat kas masuk/keluar operasional kasir
       */
      addCashMovement: (type, amount, reason) => {
        const shift = get().activeShift;
        if (!shift || shift.isClosed) return null;

        const numAmount = Math.max(0, Number(amount) || 0);
        const movement = {
          id: Date.now(),
          type, // 'IN' | 'OUT'
          amount: numAmount,
          reason: reason || (type === 'IN' ? 'Kas Masuk' : 'Kas Keluar'),
          timestamp: new Date().toISOString(),
        };

        const totalCashIn = (shift.totalCashIn || 0) + (type === 'IN' ? numAmount : 0);
        const totalCashOut = (shift.totalCashOut || 0) + (type === 'OUT' ? numAmount : 0);
        const expectedCash = (shift.openingCash || 0) + (shift.totalCashSales || 0) + totalCashIn - totalCashOut;

        set({
          activeShift: {
            ...shift,
            totalCashIn,
            totalCashOut,
            expectedCash,
            cashMovements: [movement, ...(shift.cashMovements || [])],
          },
        });

        return movement;
      },
    }),
    {
      name: 'komazi-shift-storage',
    }
  )
);
