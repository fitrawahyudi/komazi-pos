import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useCustomerStore = create(
  persist(
    (set, get) => ({
      customers: [],

      addCustomer: (customerData) => {
        const newCustomer = {
          id: Date.now(),
          name: customerData.name,
          phone: customerData.phone,
          email: customerData.email || '',
          points: 10, // Bonus 10 poin pendaftaran
          totalSpent: 0,
          visitCount: 0,
          tier: 'SILVER',
          joinedDate: new Date().toISOString().split('T')[0],
        };
        set((state) => ({
          customers: [newCustomer, ...state.customers],
        }));
        return newCustomer;
      },

      updateCustomer: (id, updatedData) => {
        set((state) => ({
          customers: state.customers.map((c) =>
            c.id === id ? { ...c, ...updatedData } : c
          ),
        }));
      },

      deleteCustomer: (id) => {
        set((state) => ({
          customers: state.customers.filter((c) => c.id !== id),
        }));
      },

      recordTransaction: (customerId, spentAmount) => {
        const state = get();
        const customer = state.customers.find((c) => c.id === customerId);
        if (!customer) return;

        // 1 poin tiap Rp 10.000 belanja
        const pointsEarned = Math.floor(spentAmount / 10000);
        const newTotalSpent = customer.totalSpent + spentAmount;
        const newPoints = customer.points + pointsEarned;
        const newVisits = customer.visitCount + 1;

        // Hitung Tier
        let newTier = 'SILVER';
        if (newPoints >= 500) newTier = 'PLATINUM';
        else if (newPoints >= 200) newTier = 'GOLD';

        set({
          customers: state.customers.map((c) =>
            c.id === customerId
              ? {
                  ...c,
                  totalSpent: newTotalSpent,
                  points: newPoints,
                  visitCount: newVisits,
                  tier: newTier,
                }
              : c
          ),
        });
      },

      redeemPoints: (customerId, pointsToRedeem) => {
        const state = get();
        const customer = state.customers.find((c) => c.id === customerId);
        if (!customer || customer.points < pointsToRedeem) return false;

        set({
          customers: state.customers.map((c) =>
            c.id === customerId
              ? { ...c, points: c.points - pointsToRedeem }
              : c
          ),
        });
        return true;
      },
    }),
    {
      name: 'komazi-customer-storage',
      version: 3,
      migrate: (persistedState, version) => {
        if (version < 3) {
          return { customers: [] };
        }
        return persistedState;
      },
    }
  )
);
