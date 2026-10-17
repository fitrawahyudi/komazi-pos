import { create } from 'zustand';
import { cmsApi } from '../services/cmsApi';

export const useCmsStore = create((set, get) => ({
  // Data State
  landingData: null,
  config: null,
  spotlights: [],
  promos: [],
  facilities: [],
  testimonials: [],
  outlet: null,

  // Loading & Error States
  loading: false,
  saving: false,
  error: null,

  // ── Public Landing Data Aggregator ─────────────────────────
  fetchPublicLanding: async () => {
    try {
      set({ loading: true, error: null });
      const res = await cmsApi.getPublicLanding();
      if (res?.success && res?.data) {
        set({ landingData: res.data, loading: false });
        return res.data;
      }
      set({ loading: false });
      return null;
    } catch (err) {
      console.error('Error fetching public landing data:', err);
      set({ error: err.message, loading: false });
      return null;
    }
  },

  // ── CMS Config (Brand & Hero) ─────────────────────────────
  fetchConfig: async () => {
    try {
      set({ loading: true, error: null });
      const res = await cmsApi.getCmsConfig();
      if (res?.success && res?.data) {
        set({ config: res.data, loading: false });
        return res.data;
      }
      set({ loading: false });
      return null;
    } catch (err) {
      set({ error: err.message, loading: false });
      return null;
    }
  },

  updateConfig: async (payload) => {
    try {
      set({ saving: true, error: null });
      const res = await cmsApi.updateCmsConfig(payload);
      if (res?.success && res?.data) {
        set({ config: res.data, saving: false });
        return { success: true, data: res.data };
      }
      set({ saving: false });
      return { success: false, message: res?.message || 'Gagal memperbarui konfigurasi' };
    } catch (err) {
      set({ saving: false, error: err.message });
      return { success: false, message: err.message };
    }
  },

  toggleLandingPageActive: async (explicitStatus) => {
    try {
      set({ saving: true });
      const current = get().config || {};
      const newStatus = explicitStatus !== undefined ? Boolean(explicitStatus) : !current.isLandingPageActive;
      const res = await cmsApi.updateCmsConfig({ isLandingPageActive: newStatus });
      if (res?.success && res?.data) {
        set({ config: res.data, saving: false });
        const currentLanding = get().landingData;
        if (currentLanding) {
          set({
            landingData: {
              ...currentLanding,
              config: { ...currentLanding.config, isLandingPageActive: newStatus }
            }
          });
        }
        return { success: true, isLandingPageActive: newStatus };
      }
      set({ saving: false });
      return { success: false };
    } catch (err) {
      set({ saving: false, error: err.message });
      return { success: false, message: err.message };
    }
  },

  // ── Menu Spotlight ─────────────────────────────────────────
  fetchSpotlights: async () => {
    try {
      set({ loading: true, error: null });
      const res = await cmsApi.getSpotlights();
      if (res?.success && Array.isArray(res?.data)) {
        set({ spotlights: res.data, loading: false });
        return res.data;
      }
      set({ loading: false });
      return [];
    } catch (err) {
      set({ error: err.message, loading: false });
      return [];
    }
  },

  addSpotlight: async (payload) => {
    try {
      set({ saving: true, error: null });
      const res = await cmsApi.createSpotlight(payload);
      if (res?.success) {
        await get().fetchSpotlights();
        set({ saving: false });
        return { success: true };
      }
      set({ saving: false });
      return { success: false, message: res?.message };
    } catch (err) {
      set({ saving: false, error: err.message });
      return { success: false, message: err.message };
    }
  },

  updateSpotlight: async (id, payload) => {
    try {
      set({ saving: true, error: null });
      const res = await cmsApi.updateSpotlight(id, payload);
      if (res?.success) {
        await get().fetchSpotlights();
        set({ saving: false });
        return { success: true };
      }
      set({ saving: false });
      return { success: false, message: res?.message };
    } catch (err) {
      set({ saving: false, error: err.message });
      return { success: false, message: err.message };
    }
  },

  deleteSpotlight: async (id) => {
    try {
      set({ saving: true, error: null });
      const res = await cmsApi.deleteSpotlight(id);
      if (res?.success) {
        await get().fetchSpotlights();
        set({ saving: false });
        return { success: true };
      }
      set({ saving: false });
      return { success: false, message: res?.message };
    } catch (err) {
      set({ saving: false, error: err.message });
      return { success: false, message: err.message };
    }
  },

  reorderSpotlights: async (items) => {
    try {
      set({ saving: true });
      const res = await cmsApi.reorderSpotlights(items);
      if (res?.success && Array.isArray(res?.data)) {
        set({ spotlights: res.data, saving: false });
        return { success: true };
      }
      set({ saving: false });
      return { success: false };
    } catch (err) {
      set({ saving: false, error: err.message });
      return { success: false, message: err.message };
    }
  },

  // ── Promos ────────────────────────────────────────────────
  fetchPromos: async () => {
    try {
      set({ loading: true, error: null });
      const res = await cmsApi.getPromos();
      if (res?.success && Array.isArray(res?.data)) {
        set({ promos: res.data, loading: false });
        return res.data;
      }
      set({ loading: false });
      return [];
    } catch (err) {
      set({ error: err.message, loading: false });
      return [];
    }
  },

  createPromo: async (payload) => {
    try {
      set({ saving: true, error: null });
      const res = await cmsApi.createPromo(payload);
      if (res?.success) {
        await get().fetchPromos();
        set({ saving: false });
        return { success: true };
      }
      set({ saving: false });
      return { success: false, message: res?.message };
    } catch (err) {
      set({ saving: false, error: err.message });
      return { success: false, message: err.message };
    }
  },

  updatePromo: async (id, payload) => {
    try {
      set({ saving: true, error: null });
      const res = await cmsApi.updatePromo(id, payload);
      if (res?.success) {
        await get().fetchPromos();
        set({ saving: false });
        return { success: true };
      }
      set({ saving: false });
      return { success: false, message: res?.message };
    } catch (err) {
      set({ saving: false, error: err.message });
      return { success: false, message: err.message };
    }
  },

  deletePromo: async (id) => {
    try {
      set({ saving: true, error: null });
      const res = await cmsApi.deletePromo(id);
      if (res?.success) {
        await get().fetchPromos();
        set({ saving: false });
        return { success: true };
      }
      set({ saving: false });
      return { success: false, message: res?.message };
    } catch (err) {
      set({ saving: false, error: err.message });
      return { success: false, message: err.message };
    }
  },

  // ── Facilities ─────────────────────────────────────────────
  fetchFacilities: async () => {
    try {
      set({ loading: true, error: null });
      const res = await cmsApi.getFacilities();
      if (res?.success && Array.isArray(res?.data)) {
        set({ facilities: res.data, loading: false });
        return res.data;
      }
      set({ loading: false });
      return [];
    } catch (err) {
      set({ error: err.message, loading: false });
      return [];
    }
  },

  createFacility: async (payload) => {
    try {
      set({ saving: true, error: null });
      const res = await cmsApi.createFacility(payload);
      if (res?.success) {
        await get().fetchFacilities();
        set({ saving: false });
        return { success: true };
      }
      set({ saving: false });
      return { success: false, message: res?.message };
    } catch (err) {
      set({ saving: false, error: err.message });
      return { success: false, message: err.message };
    }
  },

  updateFacility: async (id, payload) => {
    try {
      set({ saving: true, error: null });
      const res = await cmsApi.updateFacility(id, payload);
      if (res?.success) {
        await get().fetchFacilities();
        set({ saving: false });
        return { success: true };
      }
      set({ saving: false });
      return { success: false, message: res?.message };
    } catch (err) {
      set({ saving: false, error: err.message });
      return { success: false, message: err.message };
    }
  },

  deleteFacility: async (id) => {
    try {
      set({ saving: true, error: null });
      const res = await cmsApi.deleteFacility(id);
      if (res?.success) {
        await get().fetchFacilities();
        set({ saving: false });
        return { success: true };
      }
      set({ saving: false });
      return { success: false, message: res?.message };
    } catch (err) {
      set({ saving: false, error: err.message });
      return { success: false, message: err.message };
    }
  },

  // ── Testimonials ───────────────────────────────────────────
  fetchTestimonials: async () => {
    try {
      set({ loading: true, error: null });
      const res = await cmsApi.getTestimonials();
      if (res?.success && Array.isArray(res?.data)) {
        set({ testimonials: res.data, loading: false });
        return res.data;
      }
      set({ loading: false });
      return [];
    } catch (err) {
      set({ error: err.message, loading: false });
      return [];
    }
  },

  createTestimonial: async (payload) => {
    try {
      set({ saving: true, error: null });
      const res = await cmsApi.createTestimonial(payload);
      if (res?.success) {
        await get().fetchTestimonials();
        set({ saving: false });
        return { success: true };
      }
      set({ saving: false });
      return { success: false, message: res?.message };
    } catch (err) {
      set({ saving: false, error: err.message });
      return { success: false, message: err.message };
    }
  },

  updateTestimonial: async (id, payload) => {
    try {
      set({ saving: true, error: null });
      const res = await cmsApi.updateTestimonial(id, payload);
      if (res?.success) {
        await get().fetchTestimonials();
        set({ saving: false });
        return { success: true };
      }
      set({ saving: false });
      return { success: false, message: res?.message };
    } catch (err) {
      set({ saving: false, error: err.message });
      return { success: false, message: err.message };
    }
  },

  deleteTestimonial: async (id) => {
    try {
      set({ saving: true, error: null });
      const res = await cmsApi.deleteTestimonial(id);
      if (res?.success) {
        await get().fetchTestimonials();
        set({ saving: false });
        return { success: true };
      }
      set({ saving: false });
      return { success: false, message: res?.message };
    } catch (err) {
      set({ saving: false, error: err.message });
      return { success: false, message: err.message };
    }
  },

  // ── Outlet Info ───────────────────────────────────────────
  fetchOutlet: async () => {
    try {
      set({ loading: true, error: null });
      const res = await cmsApi.getOutletInfo();
      if (res?.success && res?.data) {
        set({ outlet: res.data, loading: false });
        return res.data;
      }
      set({ loading: false });
      return null;
    } catch (err) {
      set({ error: err.message, loading: false });
      return null;
    }
  },

  updateOutlet: async (payload) => {
    try {
      set({ saving: true, error: null });
      const res = await cmsApi.updateOutletInfo(payload);
      if (res?.success && res?.data) {
        set({ outlet: res.data, saving: false });
        return { success: true, data: res.data };
      }
      set({ saving: false });
      return { success: false, message: res?.message || 'Gagal memperbarui info outlet' };
    } catch (err) {
      set({ saving: false, error: err.message });
      return { success: false, message: err.message };
    }
  }
}));
