import cmsService from '../services/cms.service.js';
import { successResponse, errorResponse } from '../utils/response.js';

class CmsController {
  // Public Aggregator
  async getPublicLandingData(req, res, next) {
    try {
      const data = await cmsService.getPublicLandingData();
      return successResponse(res, data, 'Data landing page berhasil dimuat');
    } catch (err) {
      next(err);
    }
  }

  // 1. Config
  async getConfig(req, res, next) {
    try {
      const data = await cmsService.getConfig();
      return successResponse(res, data, 'Konfigurasi landing page berhasil diambil');
    } catch (err) {
      next(err);
    }
  }

  async updateConfig(req, res, next) {
    try {
      const data = await cmsService.updateConfig(req.body);
      return successResponse(res, data, 'Konfigurasi landing page berhasil diperbarui');
    } catch (err) {
      next(err);
    }
  }

  // 2. Spotlight
  async getSpotlights(req, res, next) {
    try {
      const data = await cmsService.getSpotlights();
      return successResponse(res, data, 'Daftar menu spotlight berhasil diambil');
    } catch (err) {
      next(err);
    }
  }

  async createSpotlight(req, res, next) {
    try {
      if (!req.body.productId) {
        return errorResponse(res, 'ID Produk wajib diisi', 400);
      }
      const data = await cmsService.createSpotlight(req.body);
      return successResponse(res, data, 'Menu spotlight berhasil ditambahkan', 201);
    } catch (err) {
      next(err);
    }
  }

  async updateSpotlight(req, res, next) {
    try {
      const data = await cmsService.updateSpotlight(req.params.id, req.body);
      return successResponse(res, data, 'Menu spotlight berhasil diperbarui');
    } catch (err) {
      next(err);
    }
  }

  async deleteSpotlight(req, res, next) {
    try {
      await cmsService.deleteSpotlight(req.params.id);
      return successResponse(res, null, 'Menu spotlight berhasil dihapus');
    } catch (err) {
      next(err);
    }
  }

  async reorderSpotlights(req, res, next) {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) {
        return errorResponse(res, 'Format urutan item tidak valid', 400);
      }
      const data = await cmsService.reorderSpotlights(items);
      return successResponse(res, data, 'Urutan menu spotlight berhasil disimpan');
    } catch (err) {
      next(err);
    }
  }

  // 3. Promos
  async getPromos(req, res, next) {
    try {
      const data = await cmsService.getPromos();
      return successResponse(res, data, 'Daftar promo berhasil diambil');
    } catch (err) {
      next(err);
    }
  }

  async createPromo(req, res, next) {
    try {
      if (!req.body.title) {
        return errorResponse(res, 'Judul promo wajib diisi', 400);
      }
      const data = await cmsService.createPromo(req.body);
      return successResponse(res, data, 'Promo berhasil dibuat', 201);
    } catch (err) {
      next(err);
    }
  }

  async updatePromo(req, res, next) {
    try {
      const data = await cmsService.updatePromo(req.params.id, req.body);
      return successResponse(res, data, 'Promo berhasil diperbarui');
    } catch (err) {
      next(err);
    }
  }

  async deletePromo(req, res, next) {
    try {
      await cmsService.deletePromo(req.params.id);
      return successResponse(res, null, 'Promo berhasil dihapus');
    } catch (err) {
      next(err);
    }
  }

  // 4. Facilities
  async getFacilities(req, res, next) {
    try {
      const data = await cmsService.getFacilities();
      return successResponse(res, data, 'Daftar fasilitas berhasil diambil');
    } catch (err) {
      next(err);
    }
  }

  async createFacility(req, res, next) {
    try {
      if (!req.body.title) {
        return errorResponse(res, 'Nama fasilitas wajib diisi', 400);
      }
      const data = await cmsService.createFacility(req.body);
      return successResponse(res, data, 'Fasilitas berhasil dibuat', 201);
    } catch (err) {
      next(err);
    }
  }

  async updateFacility(req, res, next) {
    try {
      const data = await cmsService.updateFacility(req.params.id, req.body);
      return successResponse(res, data, 'Fasilitas berhasil diperbarui');
    } catch (err) {
      next(err);
    }
  }

  async deleteFacility(req, res, next) {
    try {
      await cmsService.deleteFacility(req.params.id);
      return successResponse(res, null, 'Fasilitas berhasil dihapus');
    } catch (err) {
      next(err);
    }
  }

  // 5. Testimonials
  async getTestimonials(req, res, next) {
    try {
      const data = await cmsService.getTestimonials();
      return successResponse(res, data, 'Daftar ulasan berhasil diambil');
    } catch (err) {
      next(err);
    }
  }

  async createTestimonial(req, res, next) {
    try {
      if (!req.body.customerName || !req.body.reviewText) {
        return errorResponse(res, 'Nama pelanggan dan teks ulasan wajib diisi', 400);
      }
      const data = await cmsService.createTestimonial(req.body);
      return successResponse(res, data, 'Ulasan berhasil ditambahkan', 201);
    } catch (err) {
      next(err);
    }
  }

  async updateTestimonial(req, res, next) {
    try {
      const data = await cmsService.updateTestimonial(req.params.id, req.body);
      return successResponse(res, data, 'Ulasan berhasil diperbarui');
    } catch (err) {
      next(err);
    }
  }

  async deleteTestimonial(req, res, next) {
    try {
      await cmsService.deleteTestimonial(req.params.id);
      return successResponse(res, null, 'Ulasan berhasil dihapus');
    } catch (err) {
      next(err);
    }
  }

  // 6. Outlet Info
  async getOutletInfo(req, res, next) {
    try {
      const data = await cmsService.getOutletInfo();
      return successResponse(res, data, 'Info outlet berhasil diambil');
    } catch (err) {
      next(err);
    }
  }

  async updateOutletInfo(req, res, next) {
    try {
      const data = await cmsService.updateOutletInfo(req.body);
      return successResponse(res, data, 'Info outlet berhasil diperbarui');
    } catch (err) {
      next(err);
    }
  }
}

export default new CmsController();
