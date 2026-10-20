import { create } from 'zustand';
import api from '../services/api';
import { toast } from './toastStore';

export const useExpenseStore = create((set, get) => ({
  expenses: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
  summary: null,
  categories: [],
  loading: false,
  categoriesLoading: false,
  error: null,

  fetchCategories: async () => {
    set({ categoriesLoading: true });
    try {
      const res = await api.expenses.getCategories();
      if (res && res.success) {
        set({ categories: res.data || [], categoriesLoading: false });
      }
    } catch (err) {
      console.error('Fetch categories error:', err);
      set({ categoriesLoading: false });
    }
  },

  fetchExpenses: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const [expRes, sumRes] = await Promise.all([
        api.expenses.getAll(params),
        api.expenses.getSummary({ startDate: params.startDate, endDate: params.endDate }),
      ]);

      if (expRes && expRes.success) {
        set({
          expenses: expRes.data || [],
          pagination: expRes.meta || { page: 1, limit: 20, total: 0, totalPages: 1 },
          loading: false,
        });
      }
      if (sumRes && sumRes.success) {
        set({ summary: sumRes.data });
      }
    } catch (err) {
      set({ error: err.message || 'Gagal memuat data biaya operasional', loading: false });
      toast.error(err.message || 'Gagal memuat biaya operasional');
    }
  },

  createExpense: async (data) => {
    try {
      const res = await api.expenses.create(data);
      if (res && res.success) {
        toast.success(`Biaya ${res.data.referenceNo} berhasil dicatat`);
        get().fetchExpenses();
        return res.data;
      }
      throw new Error(res?.message || 'Gagal menyimpan biaya');
    } catch (err) {
      toast.error(err.message || 'Gagal mencatat biaya');
      throw err;
    }
  },

  updateExpense: async (id, data) => {
    try {
      const res = await api.expenses.update(id, data);
      if (res && res.success) {
        toast.success('Biaya operasional berhasil diperbarui');
        get().fetchExpenses();
        return res.data;
      }
      throw new Error(res?.message || 'Gagal memperbarui biaya');
    } catch (err) {
      toast.error(err.message || 'Gagal memperbarui biaya');
      throw err;
    }
  },

  cancelExpense: async (id, reason) => {
    try {
      const res = await api.expenses.cancel(id, reason);
      if (res && res.success) {
        toast.success('Biaya operasional berhasil dibatalkan');
        get().fetchExpenses();
        return res.data;
      }
      throw new Error(res?.message || 'Gagal membatalkan biaya');
    } catch (err) {
      toast.error(err.message || 'Gagal membatalkan biaya');
      throw err;
    }
  },

  createCategory: async (data) => {
    try {
      const res = await api.expenses.createCategory(data);
      if (res && res.success) {
        toast.success(`Kategori "${data.name}" berhasil dibuat`);
        get().fetchCategories();
        return res.data;
      }
      throw new Error(res?.message || 'Gagal membuat kategori');
    } catch (err) {
      toast.error(err.message || 'Gagal membuat kategori');
      throw err;
    }
  },

  updateCategory: async (id, data) => {
    try {
      const res = await api.expenses.updateCategory(id, data);
      if (res && res.success) {
        toast.success('Kategori berhasil diperbarui');
        get().fetchCategories();
        return res.data;
      }
      throw new Error(res?.message || 'Gagal memperbarui kategori');
    } catch (err) {
      toast.error(err.message || 'Gagal memperbarui kategori');
      throw err;
    }
  },

  deleteCategory: async (id) => {
    try {
      const res = await api.expenses.deleteCategory(id);
      if (res && res.success) {
        toast.success('Kategori berhasil dihapus');
        get().fetchCategories();
        return true;
      }
      throw new Error(res?.message || 'Gagal menghapus kategori');
    } catch (err) {
      toast.error(err.message || 'Gagal menghapus kategori');
      throw err;
    }
  },
}));
