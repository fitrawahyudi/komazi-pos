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
              minPrice: Number(p.minPrice) || 0,
              isDynamicPrice: Boolean(p.isDynamicPrice),
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
              minPrice: Number(res.data.minPrice) || 0,
              isDynamicPrice: Boolean(res.data.isDynamicPrice),
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
          return res || { success: false, message: 'Gagal membuat produk' };
        } catch (err) {
          console.error('[PosStore] Error creating product:', err);
          return { success: false, message: err.message };
        }
      },

      updateProduct: async (id, updatedData) => {
        try {
          const res = await api.products.update(id, updatedData);
          if (res && res.success && res.data) {
            const formatted = {
              ...res.data,
              price: Number(res.data.price) || 0,
              minPrice: Number(res.data.minPrice) || 0,
              isDynamicPrice: Boolean(res.data.isDynamicPrice),
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
          return res || { success: false, message: 'Gagal memperbarui produk' };
        } catch (err) {
          console.error('[PosStore] Error updating product:', err);
          return { success: false, message: err.message };
        }
      },

      deleteProduct: async (id) => {
        try {
          const res = await api.products.delete(id);
          if (res && res.success) {
            set((state) => ({
              products: state.products.filter((p) => p.id !== id),
            }));
            return { success: true, message: res.message || 'Produk berhasil dihapus' };
          }
          return { success: false, message: res?.message || 'Gagal menghapus produk' };
        } catch (err) {
          console.error('[PosStore] Error deleting product:', err);
          return { success: false, message: err.message || 'Gagal menghapus produk' };
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
        if (!ids || ids.length === 0) return { success: true, count: 0 };
        try {
          const res = await api.products.bulkDelete(ids);
          if (res && res.success) {
            set((state) => ({
              products: state.products.filter((p) => !ids.includes(p.id)),
            }));
            return {
              success: true,
              count: res.data?.total || ids.length,
              message: res.message || `${ids.length} menu berhasil dihapus`,
            };
          }
          // Fallback sequential
          let deletedCount = 0;
          const failedIds = [];
          for (const id of ids) {
            try {
              const r = await api.products.delete(id);
              if (r && r.success) {
                deletedCount++;
              } else {
                failedIds.push(id);
              }
            } catch {
              failedIds.push(id);
            }
          }
          const successIds = ids.filter((id) => !failedIds.includes(id));
          if (successIds.length > 0) {
            set((state) => ({
              products: state.products.filter((p) => !successIds.includes(p.id)),
            }));
          }
          return {
            success: successIds.length > 0,
            count: successIds.length,
            failedCount: failedIds.length,
            message: `${successIds.length} menu berhasil dihapus`,
          };
        } catch (err) {
          console.error('[PosStore] Error bulk deleting products:', err);
          return { success: false, message: err.message || 'Gagal menghapus menu terpilih' };
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
