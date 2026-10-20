import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';
import { getSocket } from '../services/socket';

// Cross-tab real-time pub/sub synchronization channel
const CUSTOMERS_SYNC_CHANNEL = 'komazi_customers_sync';
let syncChannel = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    syncChannel = new BroadcastChannel(CUSTOMERS_SYNC_CHANNEL);
  } catch (err) {
    console.warn('[CustomerStore] BroadcastChannel init notice:', err);
  }
}

export function broadcastCustomersSync(eventDetail) {
  if (typeof window !== 'undefined') {
    if (syncChannel) {
      try {
        syncChannel.postMessage(eventDetail);
      } catch (err) {
        console.warn('[CustomerStore] Broadcast error:', err);
      }
    }
    try {
      window.dispatchEvent(new CustomEvent('komazi:customers-updated', { detail: eventDetail }));
    } catch {}
  }
}

// Helper: Hitung statistik agregat secara dinamis dari array customers
function computeDerivedStats(customers, serverStats) {
  const activeCustomers = (customers || []).filter((c) => c && c.isActive !== false);
  const totalCust = activeCustomers.length;
  const totalPts = activeCustomers.reduce((sum, c) => sum + (Number(c.points) || 0), 0);
  const totalSp = activeCustomers.reduce((sum, c) => sum + (Number(c.totalSpent) || 0), 0);
  let silver = 0, gold = 0, platinum = 0;
  activeCustomers.forEach((c) => {
    const t = (c.tier || 'SILVER').toUpperCase();
    if (t === 'PLATINUM') platinum++;
    else if (t === 'GOLD') gold++;
    else silver++;
  });
  return {
    totalCustomers: serverStats?.totalCustomers !== undefined ? serverStats.totalCustomers : totalCust,
    totalPoints: serverStats?.totalPoints !== undefined ? serverStats.totalPoints : totalPts,
    totalSpent: serverStats?.totalSpent !== undefined ? serverStats.totalSpent : totalSp,
    tierDistribution: {
      silver: serverStats?.tierDistribution?.silver !== undefined ? serverStats.tierDistribution.silver : silver,
      gold: serverStats?.tierDistribution?.gold !== undefined ? serverStats.tierDistribution.gold : gold,
      platinum: serverStats?.tierDistribution?.platinum !== undefined ? serverStats.tierDistribution.platinum : platinum,
    },
  };
}

export const useCustomerStore = create(
  persist(
    (set, get) => ({
      customers: [],
      stats: {
        totalCustomers: 0,
        totalPoints: 0,
        totalSpent: 0,
        tierDistribution: { silver: 0, gold: 0, platinum: 0 },
      },
      isLoading: false,
      lastFetchedAt: null,
      error: null,

      fetchCustomers: async (params = {}) => {
        const isSilent = Boolean(params.silent);
        try {
          if (!isSilent) {
            set({ isLoading: true, error: null });
          }
          const { silent, ...cleanParams } = params;
          const queryParams = { limit: 200, ...cleanParams };
          const res = await api.customers.getAll(queryParams);
          if (res && res.success && res.data) {
            const rawList = Array.isArray(res.data.customers)
              ? res.data.customers
              : Array.isArray(res.data)
              ? res.data
              : [];
            const list = rawList.filter((c) => c && c.isActive !== false);
            const newStats = computeDerivedStats(list, res.data.stats);
            set({
              customers: list,
              stats: newStats,
              isLoading: false,
              lastFetchedAt: Date.now(),
            });
            return list;
          } else {
            set({ isLoading: false });
            return get().customers;
          }
        } catch (err) {
          console.error('[CustomerStore] fetchCustomers error:', err);
          set({ isLoading: false, error: err.message });
          return get().customers;
        }
      },

      addCustomer: async (customerData) => {
        try {
          set({ isLoading: true, error: null });
          const res = await api.customers.create(customerData);
          if (res && res.success && res.data) {
            const created = res.data;
            const updatedList = [created, ...get().customers.filter((c) => c.id !== created.id)];
            const updatedStats = computeDerivedStats(updatedList);
            set({
              customers: updatedList,
              stats: updatedStats,
              isLoading: false,
            });
            broadcastCustomersSync({ type: 'CUSTOMER_CREATED', customer: created });
            // Refresh stats di background dari server
            get().fetchCustomers({ silent: true }).catch(() => {});
            return created;
          }
          throw new Error(res?.message || 'Gagal mendaftarkan pelanggan');
        } catch (err) {
          set({ isLoading: false, error: err.message });
          throw err;
        }
      },

      updateCustomer: async (id, updatedData) => {
        try {
          set({ isLoading: true, error: null });
          const res = await api.customers.update(id, updatedData);
          if (res && res.success && res.data) {
            const updated = res.data;
            const updatedList = get().customers.map((c) => (c.id === id ? { ...c, ...updated } : c));
            const updatedStats = computeDerivedStats(updatedList);
            set({
              customers: updatedList,
              stats: updatedStats,
              isLoading: false,
            });
            broadcastCustomersSync({ type: 'CUSTOMER_UPDATED', customer: updated });
            get().fetchCustomers({ silent: true }).catch(() => {});
            return updated;
          }
          throw new Error(res?.message || 'Gagal memperbarui data pelanggan');
        } catch (err) {
          set({ isLoading: false, error: err.message });
          throw err;
        }
      },

      deleteCustomer: async (id) => {
        try {
          set({ isLoading: true, error: null });
          const res = await api.customers.delete(id);
          if (res && res.success) {
            const updatedList = get().customers.filter((c) => c.id !== id);
            const updatedStats = computeDerivedStats(updatedList);
            set({
              customers: updatedList,
              stats: updatedStats,
              isLoading: false,
            });
            broadcastCustomersSync({ type: 'CUSTOMER_DELETED', customerId: id });
            get().fetchCustomers({ silent: true }).catch(() => {});
            return true;
          }
          throw new Error(res?.message || 'Gagal menghapus pelanggan');
        } catch (err) {
          set({ isLoading: false, error: err.message });
          throw err;
        }
      },

      redeemPoints: async (id, pointsToRedeem, note) => {
        try {
          set({ isLoading: true, error: null });
          const res = await api.customers.redeem(id, pointsToRedeem, note);
          if (res && res.success && res.data) {
            const updated = res.data;
            const updatedList = get().customers.map((c) => (c.id === id ? { ...c, ...updated } : c));
            const updatedStats = computeDerivedStats(updatedList);
            set({
              customers: updatedList,
              stats: updatedStats,
              isLoading: false,
            });
            broadcastCustomersSync({ type: 'CUSTOMER_POINTS_REDEEMED', customer: updated });
            get().fetchCustomers({ silent: true }).catch(() => {});
            return true;
          }
          throw new Error(res?.message || 'Gagal menukarkan poin');
        } catch (err) {
          set({ isLoading: false, error: err.message });
          throw err;
        }
      },

      adjustPoints: async (id, deltaPoints, reason) => {
        try {
          set({ isLoading: true, error: null });
          const res = await api.customers.adjustPoints(id, deltaPoints, reason);
          if (res && res.success && res.data) {
            const updated = res.data;
            const updatedList = get().customers.map((c) => (c.id === id ? { ...c, ...updated } : c));
            const updatedStats = computeDerivedStats(updatedList);
            set({
              customers: updatedList,
              stats: updatedStats,
              isLoading: false,
            });
            broadcastCustomersSync({ type: 'CUSTOMER_POINTS_ADJUSTED', customer: updated });
            get().fetchCustomers({ silent: true }).catch(() => {});
            return updated;
          }
          throw new Error(res?.message || 'Gagal menyesuaikan poin');
        } catch (err) {
          set({ isLoading: false, error: err.message });
          throw err;
        }
      },

      // Fallback local recorder for POS checkout
      recordTransaction: (customerId, spentAmount) => {
        const state = get();
        const customer = state.customers.find((c) => c.id === customerId);
        if (!customer) return;

        const pointsEarned = Math.floor(spentAmount / 10000);
        const newTotalSpent = (Number(customer.totalSpent) || 0) + spentAmount;
        const newPoints = (Number(customer.points) || 0) + pointsEarned;
        const newVisits = (Number(customer.visitCount) || 0) + 1;

        let newTier = 'SILVER';
        if (newPoints >= 500) newTier = 'PLATINUM';
        else if (newPoints >= 200) newTier = 'GOLD';

        const updatedCustomer = {
          ...customer,
          totalSpent: newTotalSpent,
          points: newPoints,
          visitCount: newVisits,
          tier: newTier,
        };

        const updatedList = state.customers.map((c) => (c.id === customerId ? updatedCustomer : c));
        const updatedStats = computeDerivedStats(updatedList);

        set({
          customers: updatedList,
          stats: updatedStats,
        });

        broadcastCustomersSync({ type: 'TRANSACTION_RECORDED', customer: updatedCustomer });
        // Sinkronisasi otomatis ke server di background
        get().fetchCustomers({ silent: true }).catch(() => {});
      },
    }),
    {
      name: 'komazi-customer-storage',
      version: 4,
    }
  )
);

// Cross-tab broadcast listener & localStorage fallback listener
if (typeof window !== 'undefined') {
  if (syncChannel) {
    syncChannel.onmessage = (event) => {
      if (event?.data?.type) {
        useCustomerStore.getState().fetchCustomers({ silent: true }).catch(() => {});
        window.dispatchEvent(new CustomEvent('komazi:customers-updated', { detail: event.data }));
      }
    };
  }

  window.addEventListener('storage', (e) => {
    if (e.key === 'komazi-customer-storage') {
      useCustomerStore.persist.rehydrate();
      window.dispatchEvent(new CustomEvent('komazi:customers-updated', { detail: { type: 'STORAGE_SYNC' } }));
    }
  });
}

// Socket.IO Real-time Synchronization Listener
let isCustomerSocketSyncBound = false;

export function initCustomersSocketSync() {
  if (typeof window === 'undefined' || isCustomerSocketSyncBound) return;
  try {
    const socket = getSocket();
    if (!socket) return;

    const handleCustomerChange = () => {
      useCustomerStore.getState().fetchCustomers({ silent: true }).catch(() => {});
    };

    const handleCustomerDeleted = (data) => {
      if (data?.id) {
        const currentList = useCustomerStore.getState().customers;
        const updatedList = currentList.filter((c) => c.id !== data.id);
        const updatedStats = computeDerivedStats(updatedList);
        useCustomerStore.setState({ customers: updatedList, stats: updatedStats });
      }
      handleCustomerChange();
    };

    socket.on('customer:created', handleCustomerChange);
    socket.on('customer:updated', handleCustomerChange);
    socket.on('customer:deleted', handleCustomerDeleted);
    socket.on('customer:points_redeemed', handleCustomerChange);
    socket.on('customer:points_adjusted', handleCustomerChange);
    socket.on('customers:changed', handleCustomerChange);

    // Saat ada order baru atau pembayaran selesai, cek bila ada customer terkait
    socket.on('order:new', (order) => {
      if (order?.customerId || order?.customer) {
        handleCustomerChange();
      }
    });

    socket.on('order:created', (order) => {
      if (order?.customerId || order?.customer) {
        handleCustomerChange();
      }
    });

    socket.on('order:updated', (order) => {
      if (order?.customerId || order?.customer) {
        handleCustomerChange();
      }
    });

    // Auto-refresh customers saat socket terhubung / menyambung ulang
    socket.on('connect', () => {
      useCustomerStore.getState().fetchCustomers({ silent: true }).catch(() => {});
    });

    socket.on('reconnect', () => {
      useCustomerStore.getState().fetchCustomers({ silent: true }).catch(() => {});
    });

    isCustomerSocketSyncBound = true;
  } catch (err) {
    console.warn('[CustomerStore] Failed to bind socket listeners:', err);
  }
}

// Auto-bind immediately in browser environment
if (typeof window !== 'undefined') {
  initCustomersSocketSync();
}
