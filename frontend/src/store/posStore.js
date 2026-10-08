import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';

export const usePosStore = create(
  persist(
    (set, get) => ({
      categories: [],
      products: [],
      isLoading: false,
      selectedCategoryId: 'all',
      searchQuery: '',

      setSelectedCategoryId: (id) => set({ selectedCategoryId: id }),
      setSearchQuery: (query) => set({ searchQuery: query }),

      fetchCategories: async () => {
        try {
          const res = await api.categories.getAll();
          if (res && res.success && Array.isArray(res.data)) {
            set({ categories: res.data });
            return res.data;
          }
        } catch (err) {
          console.error('[PosStore] Error fetching categories:', err);
        }
        return get().categories;
      },

      fetchProducts: async () => {
        try {
          set({ isLoading: true });
          const res = await api.products.getAll();
          if (res && res.success && Array.isArray(res.data)) {
            const formatted = res.data.map((p) => ({
              ...p,
              price: Number(p.price) || 0,
              categoryName: p.category?.name || '',
              variants: (p.variants || []).map((v) => ({
                ...v,
                extraPrice: Number(v.extraPrice) || 0,
              })),
            }));
            set({ products: formatted, isLoading: false });
            return formatted;
          }
        } catch (err) {
          console.error('[PosStore] Error fetching products:', err);
        } finally {
          set({ isLoading: false });
        }
        return get().products;
      },

      toggleSoldOut: async (productId) => {
        const prod = get().products.find((p) => p.id === productId);
        if (!prod) return;
        const newSoldOut = !prod.isSoldOut;

        // Optimistic update
        set((state) => ({
          products: state.products.map((p) =>
            p.id === productId ? { ...p, isSoldOut: newSoldOut } : p
          ),
        }));

        try {
          await api.products.update(productId, { isSoldOut: newSoldOut });
        } catch (err) {
          console.error('[PosStore] Error updating product sold out status:', err);
        }
      },

      addProduct: async (productData) => {
        try {
          const res = await api.products.create(productData);
          if (res && res.success && res.data) {
            const formatted = {
              ...res.data,
              price: Number(res.data.price) || 0,
              categoryName: res.data.category?.name || '',
              variants: (res.data.variants || []).map((v) => ({
                ...v,
                extraPrice: Number(v.extraPrice) || 0,
              })),
            };
            set((state) => ({
              products: [formatted, ...state.products],
            }));
            return formatted;
          }
        } catch (err) {
          console.error('[PosStore] Error creating product:', err);
        }
        return null;
      },

      updateProduct: async (id, updatedData) => {
        try {
          const res = await api.products.update(id, updatedData);
          if (res && res.success && res.data) {
            const formatted = {
              ...res.data,
              price: Number(res.data.price) || 0,
              categoryName: res.data.category?.name || '',
              variants: (res.data.variants || []).map((v) => ({
                ...v,
                extraPrice: Number(v.extraPrice) || 0,
              })),
            };
            set((state) => ({
              products: state.products.map((p) => (p.id === id ? formatted : p)),
            }));
            return formatted;
          }
        } catch (err) {
          console.error('[PosStore] Error updating product:', err);
        }
        return null;
      },

      deleteProduct: async (id) => {
        try {
          await api.products.delete(id);
          set((state) => ({
            products: state.products.filter((p) => p.id !== id),
          }));
          return true;
        } catch (err) {
          console.error('[PosStore] Error deleting product:', err);
          return false;
        }
      },

      bulkSetSoldOut: async (ids, isSoldOut) => {
        set((state) => ({
          products: state.products.map((p) =>
            ids.includes(p.id) ? { ...p, isSoldOut } : p
          ),
        }));

        for (const id of ids) {
          try {
            await api.products.update(id, { isSoldOut });
          } catch {}
        }
      },

      bulkUpdateCategory: async (ids, categoryId, categoryName) => {
        set((state) => ({
          products: state.products.map((p) =>
            ids.includes(p.id) ? { ...p, categoryId, categoryName } : p
          ),
        }));

        for (const id of ids) {
          try {
            await api.products.update(id, { categoryId });
          } catch {}
        }
      },

      bulkDeleteProducts: async (ids) => {
        set((state) => ({
          products: state.products.filter((p) => !ids.includes(p.id)),
        }));

        for (const id of ids) {
          try {
            await api.products.delete(id);
          } catch {}
        }
      },

      addCategory: async (categoryData) => {
        try {
          const payload = typeof categoryData === 'string'
            ? { name: categoryData.trim() }
            : {
                name: categoryData.name?.trim(),
                sortOrder: categoryData.sortOrder !== undefined ? Number(categoryData.sortOrder) : undefined,
              };

          const res = await api.categories.create(payload);
          if (res && res.success && res.data) {
            set((state) => ({
              categories: [...state.categories, res.data].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
            }));
            return { success: true, data: res.data, message: res.message || 'Kategori berhasil dibuat' };
          }
          return { success: false, message: res?.message || 'Gagal menambahkan kategori' };
        } catch (err) {
          console.error('[PosStore] Error creating category:', err);
          return { success: false, message: err.message || 'Terjadi kesalahan sistem' };
        }
      },

      updateCategory: async (id, data) => {
        try {
          const payload = typeof data === 'string'
            ? { name: data.trim() }
            : {
                ...(data.name && { name: data.name.trim() }),
                ...(data.sortOrder !== undefined && { sortOrder: Number(data.sortOrder) }),
              };

          const res = await api.categories.update(id, payload);
          if (res && res.success && res.data) {
            set((state) => ({
              categories: state.categories
                .map((c) => (c.id === id ? { ...c, ...res.data } : c))
                .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
            }));
            return { success: true, data: res.data, message: res.message || 'Kategori berhasil diperbarui' };
          }
          return { success: false, message: res?.message || 'Gagal memperbarui kategori' };
        } catch (err) {
          console.error('[PosStore] Error updating category:', err);
          return { success: false, message: err.message || 'Terjadi kesalahan sistem' };
        }
      },

      deleteCategory: async (id) => {
        try {
          const res = await api.categories.delete(id);
          if (res && res.success) {
            set((state) => ({
              categories: state.categories.filter((c) => c.id !== id),
            }));
            return { success: true, message: 'Kategori berhasil dihapus' };
          }
          return { success: false, message: res?.message || 'Gagal menghapus kategori' };
        } catch (err) {
          console.error('[PosStore] Error deleting category:', err);
          return { success: false, message: err.message || 'Gagal menghapus kategori' };
        }
      },
    }),
    {
      name: 'komazi-pos-storage',
      version: 3,
      migrate: (persistedState, version) => {
        if (version < 3) {
          return {
            categories: [],
            products: [],
            selectedCategoryId: 'all',
            searchQuery: '',
          };
        }
        return persistedState;
      },
    }
  )
);
