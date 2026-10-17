import prisma from '../config/db.js';

class CmsService {
  /**
   * Mengambil seluruh data agregasi untuk Landing Page publik dalam 1 request berkecepatan tinggi
   */
  async getPublicLandingData() {
    const [config, spotlights, promos, facilities, testimonials, outlet] = await Promise.all([
      prisma.cmsLandingConfig.findFirst(),
      prisma.cmsMenuSpotlight.findMany({
        where: { isFeatured: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              price: true,
              imageUrl: true,
              description: true,
              isSoldOut: true,
              category: {
                select: { id: true, name: true }
              }
            }
          }
        }
      }),
      prisma.cmsPromo.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' }
      }),
      prisma.cmsFacility.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' }
      }),
      prisma.cmsTestimonial.findMany({
        where: { isFeatured: true },
        orderBy: { sortOrder: 'asc' }
      }),
      prisma.cmsOutletInfo.findFirst()
    ]);

    // Fallback default jika tabel belum terisi sama sekali
    const safeConfig = config || {
      brandName: 'Komazi Coffee',
      brandTagline: 'Artisan Coffee Roastery, Comfort Food & Relaxing Space',
      heroHeadline: 'Secangkir Kopi Pilihan & Cita Rasa Otentik di Setiap Tetesnya',
      heroSubheadline:
        'Nikmati racikan kopi artisan nusantara, hidangan lezat, dan suasana kedai yang hangat di pusat kota Medan.',
      heroImageUrl:
        'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1600&auto=format&fit=crop&q=80',
      heroCtaText: 'Jelajahi Menu Pilihan',
      heroCtaLink: '#menu',
      secondaryCtaText: 'Kunjungi Kedai Kami',
      secondaryCtaLink: '#location',
      aboutTitle: 'Kisah & Filosofi Komazi Coffee',
      aboutStory:
        'Komazi Coffee hadir menyajikan racikan kopi artisan yang dipanggang dengan presisi dan cita rasa otentik.',
      aboutImageUrl:
        'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=1000&auto=format&fit=crop&q=80',
      metaTitle: 'Komazi Coffee — Kopi Pilihan & Cita Rasa Otentik Medan',
      metaDescription: 'Kunjungi Komazi Coffee di Medan. Nikmati sajian kopi berkualitas dan makanan lezat.',
      isLandingPageActive: config?.isLandingPageActive !== false
    };

    const safeOutlet = outlet || {
      outletName: 'Komazi Coffee - Medan',
      address: 'Jl. Sisingamangaraja No. 88, Kota Medan, Sumatera Utara 20217',
      city: 'Medan',
      weekdayHours: 'Senin - Jumat: 08:00 - 23:00 WIB',
      weekendHours: 'Sabtu - Minggu: 07:00 - 00:00 WIB',
      phone: '081298765432',
      whatsappNumber: '6281298765432',
      whatsappMessage: 'Halo Komazi Coffee, saya ingin bertanya tentang menu atau reservasi meja.',
      googleMapsUrl: 'https://maps.google.com/?q=Medan',
      googleMapsEmbed: null,
      instagramUrl: 'https://instagram.com/komazi.coffee',
      tiktokUrl: 'https://tiktok.com/@komazi.coffee'
    };

    return {
      config: safeConfig,
      spotlights: spotlights.filter((s) => s.product !== null),
      promos,
      facilities,
      testimonials,
      outlet: safeOutlet
    };
  }

  // ─── 1. Brand & Hero Config ───────────────────────────────────────────
  async getConfig() {
    let config = await prisma.cmsLandingConfig.findFirst();
    if (!config) {
      config = await prisma.cmsLandingConfig.create({
        data: {
          brandName: 'Komazi Coffee',
          brandTagline: 'Artisan Coffee Roastery, Comfort Food & Relaxing Space',
          heroHeadline: 'Secangkir Kopi Pilihan & Cita Rasa Otentik di Setiap Tetesnya',
          heroSubheadline:
            'Nikmati racikan kopi artisan nusantara, hidangan lezat, dan suasana kedai yang hangat di pusat kota Medan.',
          aboutStory:
            'Komazi Coffee hadir menyajikan racikan kopi artisan yang dipanggang dengan presisi dan cita rasa otentik.',
          metaDescription: 'Kunjungi Komazi Coffee di Medan. Nikmati sajian kopi berkualitas dan makanan lezat.',
          isLandingPageActive: true
        }
      });
    }
    return config;
  }

  async updateConfig(data) {
    const config = await this.getConfig();
    return prisma.cmsLandingConfig.update({
      where: { id: config.id },
      data: {
        brandName: data.brandName !== undefined ? data.brandName : config.brandName,
        brandTagline: data.brandTagline !== undefined ? data.brandTagline : config.brandTagline,
        heroHeadline: data.heroHeadline !== undefined ? data.heroHeadline : config.heroHeadline,
        heroSubheadline: data.heroSubheadline !== undefined ? data.heroSubheadline : config.heroSubheadline,
        heroImageUrl: data.heroImageUrl !== undefined ? data.heroImageUrl : config.heroImageUrl,
        heroCtaText: data.heroCtaText !== undefined ? data.heroCtaText : config.heroCtaText,
        heroCtaLink: data.heroCtaLink !== undefined ? data.heroCtaLink : config.heroCtaLink,
        secondaryCtaText: data.secondaryCtaText !== undefined ? data.secondaryCtaText : config.secondaryCtaText,
        secondaryCtaLink: data.secondaryCtaLink !== undefined ? data.secondaryCtaLink : config.secondaryCtaLink,
        aboutTitle: data.aboutTitle !== undefined ? data.aboutTitle : config.aboutTitle,
        aboutStory: data.aboutStory !== undefined ? data.aboutStory : config.aboutStory,
        aboutImageUrl: data.aboutImageUrl !== undefined ? data.aboutImageUrl : config.aboutImageUrl,
        metaTitle: data.metaTitle !== undefined ? data.metaTitle : config.metaTitle,
        metaDescription: data.metaDescription !== undefined ? data.metaDescription : config.metaDescription,
        isLandingPageActive:
          data.isLandingPageActive !== undefined
            ? Boolean(data.isLandingPageActive)
            : config.isLandingPageActive !== false
      }
    });
  }

  // ─── 2. Menu Spotlight ────────────────────────────────────────────────
  async getSpotlights() {
    return prisma.cmsMenuSpotlight.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            imageUrl: true,
            description: true,
            isSoldOut: true,
            category: { select: { id: true, name: true } }
          }
        }
      }
    });
  }

  async createSpotlight(data) {
    const productId = parseInt(data.productId, 10);
    const existing = await prisma.cmsMenuSpotlight.findFirst({
      where: { productId }
    });
    if (existing) {
      throw new Error('Produk ini sudah ada di daftar menu spotlight');
    }

    const maxSort = await prisma.cmsMenuSpotlight.aggregate({ _max: { sortOrder: true } });
    const nextOrder = (maxSort._max.sortOrder || 0) + 1;

    return prisma.cmsMenuSpotlight.create({
      data: {
        productId,
        customBadge: data.customBadge || 'Signature',
        sortOrder: data.sortOrder !== undefined ? parseInt(data.sortOrder, 10) : nextOrder,
        isFeatured: data.isFeatured !== undefined ? Boolean(data.isFeatured) : true
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            imageUrl: true,
            description: true
          }
        }
      }
    });
  }

  async updateSpotlight(id, data) {
    const spotlightId = parseInt(id, 10);
    return prisma.cmsMenuSpotlight.update({
      where: { id: spotlightId },
      data: {
        customBadge: data.customBadge,
        sortOrder: data.sortOrder !== undefined ? parseInt(data.sortOrder, 10) : undefined,
        isFeatured: data.isFeatured !== undefined ? Boolean(data.isFeatured) : undefined
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            imageUrl: true,
            description: true
          }
        }
      }
    });
  }

  async deleteSpotlight(id) {
    const spotlightId = parseInt(id, 10);
    return prisma.cmsMenuSpotlight.delete({ where: { id: spotlightId } });
  }

  async reorderSpotlights(items = []) {
    const updates = items.map((item, index) =>
      prisma.cmsMenuSpotlight.update({
        where: { id: parseInt(item.id, 10) },
        data: { sortOrder: index + 1 }
      })
    );
    await prisma.$transaction(updates);
    return this.getSpotlights();
  }

  // ─── 3. Promos ────────────────────────────────────────────────────────
  async getPromos() {
    return prisma.cmsPromo.findMany({
      orderBy: { sortOrder: 'asc' }
    });
  }

  async createPromo(data) {
    const maxSort = await prisma.cmsPromo.aggregate({ _max: { sortOrder: true } });
    const nextOrder = (maxSort._max.sortOrder || 0) + 1;

    return prisma.cmsPromo.create({
      data: {
        title: data.title,
        subtitle: data.subtitle || null,
        bannerUrl: data.bannerUrl || null,
        badgeText: data.badgeText || null,
        description: data.description || null,
        actionText: data.actionText || 'Klaim Promo via WhatsApp',
        actionLink: data.actionLink || '',
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        sortOrder: data.sortOrder !== undefined ? parseInt(data.sortOrder, 10) : nextOrder,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true
      }
    });
  }

  async updatePromo(id, data) {
    const promoId = parseInt(id, 10);
    return prisma.cmsPromo.update({
      where: { id: promoId },
      data: {
        title: data.title,
        subtitle: data.subtitle,
        bannerUrl: data.bannerUrl,
        badgeText: data.badgeText,
        description: data.description,
        actionText: data.actionText,
        actionLink: data.actionLink,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        sortOrder: data.sortOrder !== undefined ? parseInt(data.sortOrder, 10) : undefined,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : undefined
      }
    });
  }

  async deletePromo(id) {
    const promoId = parseInt(id, 10);
    return prisma.cmsPromo.delete({ where: { id: promoId } });
  }

  // ─── 4. Facilities (Café Amenities) ───────────────────────────────────
  async getFacilities() {
    return prisma.cmsFacility.findMany({
      orderBy: { sortOrder: 'asc' }
    });
  }

  async createFacility(data) {
    const maxSort = await prisma.cmsFacility.aggregate({ _max: { sortOrder: true } });
    const nextOrder = (maxSort._max.sortOrder || 0) + 1;

    return prisma.cmsFacility.create({
      data: {
        title: data.title,
        description: data.description || '',
        iconName: data.iconName || 'Coffee',
        imageUrl: data.imageUrl || null,
        sortOrder: data.sortOrder !== undefined ? parseInt(data.sortOrder, 10) : nextOrder,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true
      }
    });
  }

  async updateFacility(id, data) {
    const facilityId = parseInt(id, 10);
    return prisma.cmsFacility.update({
      where: { id: facilityId },
      data: {
        title: data.title,
        description: data.description,
        iconName: data.iconName,
        imageUrl: data.imageUrl,
        sortOrder: data.sortOrder !== undefined ? parseInt(data.sortOrder, 10) : undefined,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : undefined
      }
    });
  }

  async deleteFacility(id) {
    const facilityId = parseInt(id, 10);
    return prisma.cmsFacility.delete({ where: { id: facilityId } });
  }

  // ─── 5. Testimonials ──────────────────────────────────────────────────
  async getTestimonials() {
    return prisma.cmsTestimonial.findMany({
      orderBy: { sortOrder: 'asc' }
    });
  }

  async createTestimonial(data) {
    const maxSort = await prisma.cmsTestimonial.aggregate({ _max: { sortOrder: true } });
    const nextOrder = (maxSort._max.sortOrder || 0) + 1;

    return prisma.cmsTestimonial.create({
      data: {
        customerName: data.customerName,
        customerRole: data.customerRole || 'Pelanggan Setia',
        avatarUrl: data.avatarUrl || null,
        rating: data.rating !== undefined ? parseInt(data.rating, 10) : 5,
        reviewText: data.reviewText || '',
        isFeatured: data.isFeatured !== undefined ? Boolean(data.isFeatured) : true,
        sortOrder: data.sortOrder !== undefined ? parseInt(data.sortOrder, 10) : nextOrder
      }
    });
  }

  async updateTestimonial(id, data) {
    const testimonialId = parseInt(id, 10);
    return prisma.cmsTestimonial.update({
      where: { id: testimonialId },
      data: {
        customerName: data.customerName,
        customerRole: data.customerRole,
        avatarUrl: data.avatarUrl,
        rating: data.rating !== undefined ? parseInt(data.rating, 10) : undefined,
        reviewText: data.reviewText,
        isFeatured: data.isFeatured !== undefined ? Boolean(data.isFeatured) : undefined,
        sortOrder: data.sortOrder !== undefined ? parseInt(data.sortOrder, 10) : undefined
      }
    });
  }

  async deleteTestimonial(id) {
    const testimonialId = parseInt(id, 10);
    return prisma.cmsTestimonial.delete({ where: { id: testimonialId } });
  }

  // ─── 6. Outlet Info ───────────────────────────────────────────────────
  async getOutletInfo() {
    let outlet = await prisma.cmsOutletInfo.findFirst();
    if (!outlet) {
      outlet = await prisma.cmsOutletInfo.create({
        data: {
          outletName: 'Komazi Coffee - Medan',
          address: 'Jl. Sisingamangaraja No. 88, Kota Medan, Sumatera Utara 20217',
          city: 'Medan',
          weekdayHours: 'Senin - Jumat: 08:00 - 23:00 WIB',
          weekendHours: 'Sabtu - Minggu: 07:00 - 00:00 WIB',
          phone: '081298765432',
          whatsappNumber: '6281298765432',
          whatsappMessage: 'Halo Komazi Coffee, saya ingin bertanya tentang menu atau reservasi meja.',
          googleMapsUrl: 'https://maps.google.com/?q=Medan'
        }
      });
    }
    return outlet;
  }

  async updateOutletInfo(data) {
    const outlet = await this.getOutletInfo();
    return prisma.cmsOutletInfo.update({
      where: { id: outlet.id },
      data: {
        outletName: data.outletName !== undefined ? data.outletName : outlet.outletName,
        address: data.address !== undefined ? data.address : outlet.address,
        city: data.city !== undefined ? data.city : outlet.city,
        weekdayHours: data.weekdayHours !== undefined ? data.weekdayHours : outlet.weekdayHours,
        weekendHours: data.weekendHours !== undefined ? data.weekendHours : outlet.weekendHours,
        phone: data.phone !== undefined ? data.phone : outlet.phone,
        whatsappNumber: data.whatsappNumber !== undefined ? data.whatsappNumber : outlet.whatsappNumber,
        whatsappMessage: data.whatsappMessage !== undefined ? data.whatsappMessage : outlet.whatsappMessage,
        googleMapsUrl: data.googleMapsUrl !== undefined ? data.googleMapsUrl : outlet.googleMapsUrl,
        googleMapsEmbed: data.googleMapsEmbed !== undefined ? data.googleMapsEmbed : outlet.googleMapsEmbed,
        instagramUrl: data.instagramUrl !== undefined ? data.instagramUrl : outlet.instagramUrl,
        tiktokUrl: data.tiktokUrl !== undefined ? data.tiktokUrl : outlet.tiktokUrl
      }
    });
  }
}

export default new CmsService();
