import { create } from 'zustand';
import api from '../services/api';
import { toast } from './toastStore';

export const useAssetStore = create((set, get) => ({
  assets: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
  summary: null,
  activeAssetSchedule: null,
  depreciations: [],
  depreciationPreview: null,
  loading: false,
  scheduleLoading: false,
  depreciationLoading: false,
  error: null,

  fetchAssets: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const [assetsRes, sumRes] = await Promise.all([
        api.assets.getAll(params),
        api.assets.getSummary(),
      ]);

      if (assetsRes && assetsRes.success) {
        set({
          assets: assetsRes.data || [],
          pagination: assetsRes.meta || { page: 1, limit: 20, total: 0, totalPages: 1 },
          loading: false,
        });
      }
      if (sumRes && sumRes.success) {
        set({ summary: sumRes.data });
      }
    } catch (err) {
      set({ error: err.message || 'Gagal memuat data aset', loading: false });
      toast.error(err.message || 'Gagal memuat daftar aset');
    }
  },

  createAsset: async (data) => {
    try {
      const res = await api.assets.create(data);
      if (res && res.success) {
        toast.success(`Aset "${res.data.name}" (${res.data.code}) berhasil didaftarkan`);
        get().fetchAssets();
        return res.data;
      }
      throw new Error(res?.message || 'Gagal mendaftarkan aset');
    } catch (err) {
      toast.error(err.message || 'Gagal mendaftarkan aset');
      throw err;
    }
  },

  updateAsset: async (id, data) => {
    try {
      const res = await api.assets.update(id, data);
      if (res && res.success) {
        toast.success(`Aset "${res.data.name}" berhasil diperbarui`);
        get().fetchAssets();
        return res.data;
      }
      throw new Error(res?.message || 'Gagal memperbarui aset');
    } catch (err) {
      toast.error(err.message || 'Gagal memperbarui aset');
      throw err;
    }
  },

  disposeAsset: async (id, data) => {
    try {
      const res = await api.assets.dispose(id, data);
      if (res && res.success) {
        toast.success(`Aset "${res.data.name}" berhasil dilepas / dijual`);
        get().fetchAssets();
        return res.data;
      }
      throw new Error(res?.message || 'Gagal melepas aset');
    } catch (err) {
      toast.error(err.message || 'Gagal melepas aset');
      throw err;
    }
  },

  fetchAssetSchedule: async (id) => {
    set({ scheduleLoading: true, activeAssetSchedule: null });
    try {
      const res = await api.assets.getSchedule(id);
      if (res && res.success) {
        set({ activeAssetSchedule: res.data, scheduleLoading: false });
        return res.data;
      }
    } catch (err) {
      set({ scheduleLoading: false });
      toast.error(err.message || 'Gagal memuat jadwal penyusutan');
    }
  },

  fetchDepreciations: async (params = {}) => {
    set({ depreciationLoading: true });
    try {
      const res = await api.depreciations.getAll(params);
      if (res && res.success) {
        set({ depreciations: res.data || [], depreciationLoading: false });
      }
    } catch (err) {
      set({ depreciationLoading: false });
      toast.error(err.message || 'Gagal memuat histori penyusutan');
    }
  },

  previewDepreciation: async (year, month) => {
    set({ depreciationLoading: true, depreciationPreview: null });
    try {
      const res = await api.depreciations.preview({ year, month });
      if (res && res.success) {
        set({ depreciationPreview: res.data, depreciationLoading: false });
        return res.data;
      }
    } catch (err) {
      set({ depreciationLoading: false });
      toast.error(err.message || 'Gagal menghitung pratinjau penyusutan');
      throw err;
    }
  },

  processDepreciation: async (year, month, notes) => {
    set({ depreciationLoading: true });
    try {
      const res = await api.depreciations.process({ year, month, notes });
      if (res && res.success) {
        toast.success(res.message || 'Penyusutan bulanan berhasil diproses');
        set({ depreciationLoading: false, depreciationPreview: null });
        get().fetchDepreciations({ year, month });
        get().fetchAssets();
        return res.data;
      }
      throw new Error(res?.message || 'Gagal memproses penyusutan');
    } catch (err) {
      set({ depreciationLoading: false });
      toast.error(err.message || 'Gagal memproses penyusutan');
      throw err;
    }
  },
}));
