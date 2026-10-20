import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';
import { getSocket } from '../services/socket';

export const useShiftStore = create(
  persist(
    (set, get) => ({
      activeShift: null,
      registers: [],
      selectedRegisterId: 1,
      shiftHistory: [],
      isLoading: false,
      lastSyncedAt: null,

      /**
       * Set register yang dipilih oleh kasir
       */
      setSelectedRegisterId: (registerId) => {
        set({ selectedRegisterId: Number(registerId) });
        get().fetchActiveShift(registerId);
      },

      /**
       * Ambil daftar terminal/register kasir dari backend
       */
      fetchRegisters: async () => {
        try {
          const res = await api.shifts.getRegisters();
          if (res && res.success && Array.isArray(res.data)) {
            set({ registers: res.data });
            if (!get().selectedRegisterId && res.data.length > 0) {
              set({ selectedRegisterId: res.data[0].id });
            }
            return res.data;
          }
        } catch (err) {
          console.warn('[ShiftStore] Gagal mengambil daftar register:', err?.message);
        }
        return get().registers;
      },

      /**
       * Ambil shift aktif langsung dari database MySQL via backend API
       */
      fetchActiveShift: async (targetRegisterId = null) => {
        const regId = targetRegisterId || get().selectedRegisterId;
        try {
          set({ isLoading: true });
          const res = await api.shifts.getCurrent(regId);

          if (res && res.success && res.data) {
            const shiftData = res.data;

            const syncedShift = {
              id: shiftData.id,
              registerId: shiftData.registerId || regId,
              registerName: shiftData.registerName || 'Kasir Utama',
              registerCode: shiftData.registerCode || 'REG-01',
              cashierId: shiftData.cashierId,
              cashierName: shiftData.cashierName || 'Kasir',
              openedAt: shiftData.openedAt,
              closedAt: shiftData.closedAt,
              openingCash: Number(shiftData.openingCash || 0),
              closingCash: shiftData.closingCash ? Number(shiftData.closingCash) : null,
              expectedCash: Number(shiftData.expectedCash || 0),
              totalCashSales: Number(shiftData.totalCashSales || 0),
              totalNonCashSales: Number(shiftData.totalNonCashSales || 0),
              totalSales: Number(shiftData.totalSales || 0),
              totalCashIn: Number(shiftData.totalCashIn || 0),
              totalCashOut: Number(shiftData.totalCashOut || 0),
              totalCashDrop: Number(shiftData.totalCashDrop || 0),
              totalCashRefund: Number(shiftData.totalCashRefund || 0),
              paymentMethodsSummary: shiftData.paymentMethodsSummary || { CASH: 0, CARD: 0, QRIS: 0, TRANSFER: 0, OTHER: 0 },
              cashMovements: Array.isArray(shiftData.cashMovements) ? shiftData.cashMovements : [],
              cashiers: Array.isArray(shiftData.cashiers) ? shiftData.cashiers : [],
              ordersCount: shiftData.ordersCount || 0,
              isClosed: false,
            };

            set({
              activeShift: syncedShift,
              selectedRegisterId: syncedShift.registerId || regId,
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
      openShift: async (cashierOrPayload, openingCashVal = null) => {
        // Mendukung format (cashier, openingCash) atau ({ openingCash, registerId })
        let numOpeningCash = 0;
        let registerId = get().selectedRegisterId;

        if (typeof cashierOrPayload === 'object' && cashierOrPayload !== null && ('openingCash' in cashierOrPayload || 'registerId' in cashierOrPayload)) {
          numOpeningCash = Number(cashierOrPayload.openingCash) || 0;
          if (cashierOrPayload.registerId) registerId = Number(cashierOrPayload.registerId);
        } else {
          numOpeningCash = Number(openingCashVal) || 0;
        }

        try {
          set({ isLoading: true });
          const res = await api.shifts.open({
            openingCash: numOpeningCash,
            registerId,
          });

          if (res && res.success && res.data) {
            const data = res.data;
            const newShift = {
              id: data.id,
              registerId: data.registerId || registerId,
              registerName: data.registerName || 'Kasir Utama',
              registerCode: data.registerCode || 'REG-01',
              cashierId: data.cashierId,
              cashierName: data.cashierName || 'Kasir',
              openedAt: data.openedAt || new Date().toISOString(),
              openingCash: numOpeningCash,
              closingCash: null,
              expectedCash: numOpeningCash,
              totalCashSales: 0,
              totalNonCashSales: 0,
              totalSales: 0,
              totalCashIn: 0,
              totalCashOut: 0,
              totalCashDrop: 0,
              totalCashRefund: 0,
              paymentMethodsSummary: { CASH: 0, CARD: 0, QRIS: 0, TRANSFER: 0, OTHER: 0 },
              cashMovements: [],
              cashiers: [],
              ordersCount: 0,
              isClosed: false,
            };

            set({
              activeShift: newShift,
              selectedRegisterId: newShift.registerId,
              isLoading: false,
              lastSyncedAt: new Date().toISOString(),
            });

            // Refresh registers state in background
            get().fetchRegisters().catch(() => {});

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
      closeShift: async (closingCash, notes = '', shiftId = null) => {
        const shift = get().activeShift;
        const targetId = shiftId || shift?.id;
        if (!targetId) throw new Error('Tidak ada shift aktif yang ditemukan untuk ditutup');

        const numClosingCash = Number(closingCash) || 0;

        try {
          set({ isLoading: true });
          const res = await api.shifts.close({
            closingCash: numClosingCash,
            notes: notes || '',
            shiftId: targetId,
          });

          if (res && res.success && res.data) {
            const closedData = res.data;
            const completedShift = {
              ...(shift || {}),
              ...closedData,
              closedAt: closedData.closedAt || new Date().toISOString(),
              closingCash: numClosingCash,
              expectedCash: Number(closedData.expectedCash || shift?.expectedCash || 0),
              difference: Number(closedData.difference || (numClosingCash - (shift?.expectedCash || 0))),
              notes,
              isClosed: true,
            };

            set((state) => ({
              activeShift: null,
              shiftHistory: [completedShift, ...state.shiftHistory.filter((s) => s.id !== completedShift.id)],
              isLoading: false,
              lastSyncedAt: new Date().toISOString(),
            }));

            // Refresh riwayat shift & registers dari DB
            get().fetchShiftHistory().catch(() => {});
            get().fetchRegisters().catch(() => {});

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
       * Catat kas masuk/keluar/drop operasional kasir langsung ke database MySQL
       */
      addCashMovement: async (typeOrPayload, amountVal = null, reasonVal = '') => {
        let type = 'CASH_OUT';
        let amount = 0;
        let reason = '';
        let shiftId = get().activeShift?.id;

        if (typeof typeOrPayload === 'object' && typeOrPayload !== null) {
          type = typeOrPayload.type || 'CASH_OUT';
          amount = Number(typeOrPayload.amount) || 0;
          reason = typeOrPayload.reason || '';
          if (typeOrPayload.shiftId) shiftId = typeOrPayload.shiftId;
        } else {
          type = typeOrPayload || 'CASH_OUT';
          amount = Number(amountVal) || 0;
          reason = reasonVal;
        }

        // Normalisasi enum tipe pergerakan kas
        const uType = String(type).toUpperCase().trim();
        if (uType === 'IN' || uType === 'CASH_IN') type = 'CASH_IN';
        else if (uType === 'OUT' || uType === 'CASH_OUT') type = 'CASH_OUT';
        else if (uType === 'DROP' || uType === 'CASH_DROP') type = 'CASH_DROP';
        else type = 'CASH_OUT';

        if (!shiftId) throw new Error('Tidak ada shift aktif untuk mencatat arus kas.');
        if (amount <= 0) throw new Error('Nominal kas harus lebih dari Rp 0.');

        try {
          set({ isLoading: true });
          const res = await api.shifts.recordMovement({
            type,
            amount,
            reason: reason.trim(),
            shiftId,
          });

          if (res && res.success && res.data) {
            // Re-fetch active shift directly from backend to get accurate recalculated totals
            await get().fetchActiveShift(get().selectedRegisterId);
            set({ isLoading: false });
            return res.data;
          } else {
            throw new Error(res?.message || 'Gagal mencatat arus kas');
          }
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      /**
       * Ambil riwayat shift dari database MySQL
       */
      fetchShiftHistory: async (params = { limit: 50 }) => {
        try {
          const res = await api.shifts.getHistory(params);
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
       * Ambil detail lengkap suatu shift untuk audit & Z-Report
       */
      fetchShiftDetail: async (id) => {
        try {
          const res = await api.shifts.getDetail(id);
          if (res && res.success && res.data) {
            return res.data;
          }
        } catch (err) {
          console.warn('[ShiftStore] Gagal mengambil detail shift:', err?.message);
        }
        return null;
      },

      /**
       * Optimistic update saat ada transaksi penjualan POS
       */
      recordSaleToShift: (paymentMethod, amount) => {
        const shift = get().activeShift;
        if (!shift || shift.isClosed) return;

        const numAmount = Number(amount) || 0;
        const methodUpper = String(paymentMethod || '').toUpperCase();
        const curSummary = shift.paymentMethodsSummary || { CASH: 0, CARD: 0, QRIS: 0, TRANSFER: 0, OTHER: 0 };
        const updatedSummary = { ...curSummary };

        if (methodUpper === 'CASH') {
          updatedSummary.CASH = (updatedSummary.CASH || 0) + numAmount;
          const newCashSales = (shift.totalCashSales || 0) + numAmount;
          const newExpected =
            (shift.openingCash || 0) +
            newCashSales +
            (shift.totalCashIn || 0) -
            (shift.totalCashOut || 0) -
            (shift.totalCashDrop || 0);

          set({
            activeShift: {
              ...shift,
              totalCashSales: newCashSales,
              totalSales: (shift.totalSales || 0) + numAmount,
              expectedCash: newExpected,
              paymentMethodsSummary: updatedSummary,
              ordersCount: (shift.ordersCount || 0) + 1,
            },
          });
        } else {
          if (['CARD', 'DEBIT', 'CREDIT', 'EDC'].includes(methodUpper)) {
            updatedSummary.CARD = (updatedSummary.CARD || 0) + numAmount;
          } else if (methodUpper.includes('QRIS') || methodUpper.includes('QR')) {
            updatedSummary.QRIS = (updatedSummary.QRIS || 0) + numAmount;
          } else if (methodUpper.includes('TRANSFER')) {
            updatedSummary.TRANSFER = (updatedSummary.TRANSFER || 0) + numAmount;
          } else {
            updatedSummary.OTHER = (updatedSummary.OTHER || 0) + numAmount;
          }

          set({
            activeShift: {
              ...shift,
              totalNonCashSales: (shift.totalNonCashSales || 0) + numAmount,
              totalSales: (shift.totalSales || 0) + numAmount,
              paymentMethodsSummary: updatedSummary,
              ordersCount: (shift.ordersCount || 0) + 1,
            },
          });
        }
      },
    }),
    {
      name: 'komazi-shift-storage',
      partialize: (state) => ({
        selectedRegisterId: state.selectedRegisterId,
      }),
    }
  )
);

// Socket.IO Real-time Synchronization Listener untuk Sesi Kasir & Register
let isShiftSocketSyncBound = false;

export function initShiftSocketSync() {
  if (typeof window === 'undefined' || isShiftSocketSyncBound) return;

  try {
    const socket = getSocket();
    if (!socket) return;

    socket.on('shift:opened', (openedShift) => {
      console.log('📡 [ShiftStore] Realtime shift:opened received:', openedShift);
      const state = useShiftStore.getState();
      state.fetchRegisters?.().catch(() => {});
      if (!state.selectedRegisterId || state.selectedRegisterId === openedShift?.registerId) {
        state.fetchActiveShift?.(openedShift?.registerId).catch(() => {});
      }
    });

    socket.on('shift:closed', (closedShift) => {
      console.log('📡 [ShiftStore] Realtime shift:closed received:', closedShift);
      const state = useShiftStore.getState();
      state.fetchRegisters?.().catch(() => {});
      state.fetchShiftHistory?.().catch(() => {});
      if (state.activeShift?.id === closedShift?.id || state.selectedRegisterId === closedShift?.registerId) {
        state.fetchActiveShift?.(state.selectedRegisterId).catch(() => {});
      }
    });

    socket.on('shift:movement_added', (movement) => {
      console.log('📡 [ShiftStore] Realtime shift:movement_added received:', movement);
      const state = useShiftStore.getState();
      if (Number(state.activeShift?.id) === Number(movement?.shiftId) || !state.activeShift) {
        state.fetchActiveShift?.(state.selectedRegisterId).catch(() => {});
      }
    });

    isShiftSocketSyncBound = true;
  } catch (err) {
    console.warn('[ShiftStore] Gagal mengikat listener socket:', err);
  }
}
