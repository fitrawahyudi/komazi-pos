import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';

export const useStockStore = create(
  persist(
    (set, get) => ({
      ingredients: [],
      movements: [],
      isLoading: false,

      fetchIngredients: async () => {
        try {
          set({ isLoading: true });
          const res = await api.stock.getIngredients();
          if (res && res.success && Array.isArray(res.data)) {
            const formatted = res.data.map((ing) => ({
              ...ing,
              stock: Number(ing.stock) || 0,
              minStock: Number(ing.minStock) || 0,
              costPerUnit: Number(ing.costPerUnit) || 0,
            }));
            set({ ingredients: formatted, isLoading: false });
            return formatted;
          }
        } catch (err) {
          console.error('[StockStore] Error fetching ingredients:', err);
        } finally {
          set({ isLoading: false });
        }
        return get().ingredients;
      },

      addIngredient: async (ingredient) => {
        try {
          const res = await api.stock.create(ingredient);
          if (res && res.success && res.data) {
            const newIng = {
              ...res.data,
              stock: Number(res.data.stock) || 0,
              minStock: Number(res.data.minStock) || 0,
              costPerUnit: Number(res.data.costPerUnit) || 0,
            };
            set((state) => ({ ingredients: [...state.ingredients, newIng] }));
            return newIng;
          }
        } catch (err) {
          console.error('[StockStore] Error adding ingredient:', err);
        }
        return null;
      },

      updateIngredient: async (id, data) => {
        try {
          const res = await api.stock.update(id, data);
          if (res && res.success && res.data) {
            const updated = {
              ...res.data,
              stock: Number(res.data.stock) || 0,
              minStock: Number(res.data.minStock) || 0,
              costPerUnit: Number(res.data.costPerUnit) || 0,
            };
            set((state) => ({
              ingredients: state.ingredients.map((ing) => (ing.id === id ? updated : ing)),
            }));
            return updated;
          }
        } catch (err) {
          console.error('[StockStore] Error updating ingredient:', err);
        }
        return null;
      },

      deleteIngredient: async (id) => {
        try {
          const res = await api.stock.delete(id);
          if (res && res.success) {
            set((state) => ({
              ingredients: state.ingredients.filter((ing) => ing.id !== id),
            }));
            return { success: true };
          }
          return { success: false, message: res?.message || 'Gagal menghapus bahan baku' };
        } catch (err) {
          console.error('[StockStore] Error deleting ingredient:', err);
          return { success: false, message: err.message || 'Gagal menghapus bahan baku' };
        }
      },

      bulkDeleteIngredients: async (ids) => {
        for (const id of ids) {
          try {
            await api.stock.delete(id);
          } catch {}
        }
        set((state) => ({
          ingredients: state.ingredients.filter((ing) => !ids.includes(ing.id)),
        }));
      },

      bulkUpdateMinStock: async (ids, minStock) => {
        const val = Number(minStock) || 0;
        set((state) => ({
          ingredients: state.ingredients.map((ing) =>
            ids.includes(ing.id) ? { ...ing, minStock: val } : ing
          ),
        }));

        for (const id of ids) {
          try {
            await api.stock.update(id, { minStock: val });
          } catch {}
        }
      },

      recordMovement: async (ingredientId, type, qty, note = '') => {
        const numericQty = Number(qty);
        if (isNaN(numericQty) || numericQty === 0) return;

        try {
          const res = await api.stock.recordMovement(ingredientId, { type, qty: numericQty, note });
          if (res && res.success) {
            // Refresh ingredients to get exact stock from DB
            get().fetchIngredients();
            return res.data;
          }
        } catch (err) {
          console.error('[StockStore] Error recording movement:', err);
        }
      },

      bulkRecordMovement: async (ids, type, qty, note = '') => {
        const state = get();
        const numericQty = Number(qty);
        if (isNaN(numericQty) || numericQty === 0) return;

        for (const id of ids) {
          try {
            await api.stock.recordMovement(id, { type, qty: numericQty, note });
          } catch {}
        }

        get().fetchIngredients();
      },

      // Potong stok otomatis berdasarkan komposisi item pesanan
      deductStockForOrder: (orderItems = [], invoiceNo = '') => {
        const state = get();
        const updatedIngredients = [...state.ingredients];
        const newMovements = [];

        orderItems.forEach((item) => {
          const name = (item.name || item.productName || '').toLowerCase();
          const category = (item.categoryName || '').toLowerCase();
          const qty = Number(item.qty || 1);
          const isIced = (item.variantName || '').toLowerCase().includes('iced') || (item.variantName || '').toLowerCase().includes('dingin');

          const deduct = (ingredientId, amountPerItem) => {
            const ingIdx = updatedIngredients.findIndex((i) => i.id === ingredientId);
            if (ingIdx !== -1) {
              const totalDeduct = amountPerItem * qty;
              updatedIngredients[ingIdx] = {
                ...updatedIngredients[ingIdx],
                stock: Math.max(0, updatedIngredients[ingIdx].stock - totalDeduct),
              };

              newMovements.push({
                id: Date.now() + Math.random(),
                ingredientId,
                ingredientName: updatedIngredients[ingIdx].name,
                type: 'SALE',
                qty: -totalDeduct,
                unit: updatedIngredients[ingIdx].unit,
                note: `Auto-potong resep (${qty}x ${item.name || item.productName}) [${invoiceNo}]`,
                createdAt: new Date().toISOString(),
              });
            }
          };

          // Coffee items
          if (name.includes('kopi') || name.includes('latte') || name.includes('espresso') || name.includes('cappuccino') || name.includes('americano') || category.includes('kopi')) {
            deduct(1, 18); // 18 gram biji kopi
            if (name.includes('aren')) {
              deduct(4, 25); // 25ml gula aren
            }
            if (item.modifiers?.some((m) => (m.name || '').toLowerCase().includes('oat'))) {
              deduct(3, 180); // 180ml Oat Milk
            } else if (!name.includes('americano') && !name.includes('espresso')) {
              deduct(2, 180); // 180ml Fresh Milk
            }
          } else if (name.includes('matcha')) {
            deduct(5, 20); // 20g matcha
            deduct(2, 180); // Fresh milk
          } else if (name.includes('choco') || name.includes('cokelat')) {
            deduct(2, 180); // Fresh milk
          }

          // Cups
          if (isIced) {
            deduct(7, 1); // 1 Cold Cup
          } else {
            deduct(6, 1); // 1 Hot Paper Cup
          }
        });

        if (newMovements.length > 0) {
          set({
            ingredients: updatedIngredients,
            movements: [...newMovements, ...state.movements],
          });
        }
      },

      // Alias untuk interoperabilitas dengan POS PaymentModal
      deductIngredientsForOrder: (orderItems = [], invoiceNo = '') => {
        return get().deductStockForOrder(orderItems, invoiceNo);
      },

      // Check low stock count
      getLowStockItems: () => {
        return (get().ingredients || []).filter((i) => Number(i.stock) <= Number(i.minStock));
      },
    }),
    {
      name: 'komazi-stock-storage',
      version: 3,
      migrate: (persistedState, version) => {
        if (version < 3) {
          return {
            ingredients: [],
            movements: [],
          };
        }
        return persistedState;
      },
    }
  )
);
