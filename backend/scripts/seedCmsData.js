/**
 * Seed script for initial CMS & Landing Page data
 * Focus: F&B Specialty Coffee & Café Amenities (Workspace rental module is disabled)
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('☕ Memulai seeding konten awal CMS Komazi Coffee...');

  // 1. Konfigurasi Brand & Hero Landing Page
  const existingConfig = await prisma.cmsLandingConfig.findFirst();
  if (!existingConfig) {
    await prisma.cmsLandingConfig.create({
      data: {
        brandName: 'Komazi Coffee',
        brandTagline: 'Artisan Coffee Roastery, Comfort Food & Relaxing Space',
        heroHeadline: 'Secangkir Kopi Pilihan & Cita Rasa Otentik di Setiap Tetesnya',
        heroSubheadline:
          'Nikmati racikan kopi artisan nusantara, hidangan lezat, dan suasana kedai yang hangat di pusat kota Medan. Tempat sempurna untuk memulai hari atau bersantai bersama teman.',
        heroImageUrl:
          'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1600&auto=format&fit=crop&q=80',
        heroCtaText: 'Jelajahi Menu Pilihan',
        heroCtaLink: '#menu',
        secondaryCtaText: 'Kunjungi Kedai Kami',
        secondaryCtaLink: '#location',
        aboutTitle: 'Kisah & Filosofi Komazi Coffee',
        aboutStory:
          'Berawal dari kecintaan mendalam terhadap biji kopi Indonesia dan kehangatan tradisi ngopi di Medan, Komazi Coffee hadir menyajikan racikan kopi artisan yang dipanggang dengan presisi. Setiap seduhan dibuat dari biji kopi pilihan langsung dari petani lokal, diracik dengan dedikasi tinggi oleh barista kami untuk menghadirkan pengalaman rasa yang tak terlupakan.',
        aboutImageUrl:
          'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=1000&auto=format&fit=crop&q=80',
        metaTitle: 'Komazi Coffee — Kopi Pilihan, Hidangan Lezat & Suasana Hangat Medan',
        metaDescription:
          'Kunjungi Komazi Coffee di Medan. Nikmati signature coffee Komazi Aren Latte, Sanger otentik, croissant artisan, dan sajian lezat dalam suasana kedai yang nyaman.'
      }
    });
    console.log('✅ Konfigurasi CmsLandingConfig berhasil dibuat.');
  } else {
    console.log('ℹ️ CmsLandingConfig sudah ada, melewati pembuatan baru.');
  }

  // 2. Menu Unggulan (Spotlight) yang tersambung ke Product POS
  const spotlightCount = await prisma.cmsMenuSpotlight.count();
  if (spotlightCount === 0) {
    // Cari produk riil dari katalog POS
    const products = await prisma.product.findMany({
      where: { isActive: true },
      take: 8
    });

    if (products.length > 0) {
      const badges = ['Signature', 'Authentic Medan', "Chef's Pick", 'Best Seller'];
      for (let i = 0; i < Math.min(products.length, 4); i++) {
        await prisma.cmsMenuSpotlight.create({
          data: {
            productId: products[i].id,
            customBadge: badges[i] || 'Popular',
            sortOrder: i + 1,
            isFeatured: true
          }
        });
      }
      console.log(`✅ ${Math.min(products.length, 4)} produk berhasil disorot pada CmsMenuSpotlight.`);
    } else {
      console.log('⚠️ Belum ada produk POS aktif untuk disorot.');
    }
  } else {
    console.log(`ℹ️ CmsMenuSpotlight sudah berisi ${spotlightCount} item.`);
  }

  // 3. Banner Promosi & Penawaran Khusus
  const promoCount = await prisma.cmsPromo.count();
  if (promoCount === 0) {
    await prisma.cmsPromo.createMany({
      data: [
        {
          title: 'Morning Booster: Coffee & Croissant Combo',
          subtitle: 'Mulai pagimu lebih bersemangat sebelum jam 11:00 WIB',
          bannerUrl:
            'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=800&auto=format&fit=crop&q=80',
          badgeText: 'Hemat 25%',
          description:
            'Beli 1 Komazi Aren Latte / Americano bersama 1 Artisan Butter Croissant hanya Rp 38.000. Berlaku setiap Senin - Jumat jam 08:00 - 11:00 WIB.',
          actionText: 'Klaim Promo via WhatsApp',
          actionLink:
            'https://wa.me/6281298765432?text=Halo%20Komazi,%20saya%20ingin%20klaim%20promo%20Morning%20Booster',
          sortOrder: 1,
          isActive: true
        },
        {
          title: 'Weekend Treat: Buy 2 Get 1 Free Pastry',
          subtitle: 'Habiskan akhir pekan santai bersama teman dan keluarga',
          bannerUrl:
            'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800&auto=format&fit=crop&q=80',
          badgeText: 'Weekend Special',
          description:
            'Pesan 2 minuman artisan varian apa saja, dapatkan 1 French Pastry gratis pilihanmu sepanjang hari Sabtu & Minggu.',
          actionText: 'Tanya Ketersediaan Promo',
          actionLink:
            'https://wa.me/6281298765432?text=Halo%20Komazi,%20apakah%20promo%20Weekend%20Treat%20masih%20tersedia?',
          sortOrder: 2,
          isActive: true
        }
      ]
    });
    console.log('✅ 2 promo awal berhasil dibuat di CmsPromo.');
  } else {
    console.log(`ℹ️ CmsPromo sudah berisi ${promoCount} item.`);
  }

  // 4. Fasilitas Kedai & Kenyamanan Pengunjung (F&B Café Amenities)
  const facilityCount = await prisma.cmsFacility.count();
  if (facilityCount === 0) {
    await prisma.cmsFacility.createMany({
      data: [
        {
          title: 'Ultra High-Speed WiFi (100 Mbps)',
          description:
            'Koneksi internet serat optik stabil dan kencang untuk streaming musik, browsing, dan berselancar santai.',
          iconName: 'Wifi',
          sortOrder: 1,
          isActive: true
        },
        {
          title: 'Stopkontak di Setiap Meja',
          description:
            'Semua meja dilengkapi colokan listrik yang aman agar daya smartphone dan gawai Anda tetap terjaga.',
          iconName: 'Zap',
          sortOrder: 2,
          isActive: true
        },
        {
          title: 'Suasana Sejuk Full AC & Outdoor',
          description:
            'Area indoor berpendingin udara yang bersih higienis serta area outdoor sejuk bagi pecinta udara segar.',
          iconName: 'Wind',
          sortOrder: 3,
          isActive: true
        },
        {
          title: 'Musholla Bersih & Tenang',
          description:
            'Fasilitas tempat ibadah musholla yang nyaman, bersih, ber-AC, dan dilengkapi tempat wudhu tersendiri.',
          iconName: 'Shield',
          sortOrder: 4,
          isActive: true
        }
      ]
    });
    console.log('✅ 4 fasilitas kedai berhasil dibuat di CmsFacility.');
  } else {
    console.log(`ℹ️ CmsFacility sudah berisi ${facilityCount} item.`);
  }

  // 5. Ulasan & Testimoni Pelanggan
  const testimonialCount = await prisma.cmsTestimonial.count();
  if (testimonialCount === 0) {
    await prisma.cmsTestimonial.createMany({
      data: [
        {
          customerName: 'Dian Pratama',
          customerRole: 'Coffee Enthusiast',
          avatarUrl:
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          rating: 5,
          reviewText:
            'Komazi Aren Latte-nya benar-benar juara! Gurih manis arennya pas dan rasa kopinya tetap dominan mantap. Tempatnya nyaman banget buat ngobrol santai.',
          isFeatured: true,
          sortOrder: 1
        },
        {
          customerName: 'Budi Santoso',
          customerRole: 'Food Reviewer',
          avatarUrl:
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
          rating: 5,
          reviewText:
            'Sanger otentiknya membawa cita rasa khas Medan dengan teknik seduh modern. Nasi Goreng Spesial Komazi juga gurih porsi pas. Wajib mampir kalau ke Medan!',
          isFeatured: true,
          sortOrder: 2
        },
        {
          customerName: 'Sarah Anindita',
          customerRole: 'Pelanggan Setia',
          avatarUrl:
            'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
          rating: 5,
          reviewText:
            'Croissant-nya renyah di luar lembut di dalam, butter-nya wangi. Barista dan staf kasirnya sangat ramah melayani pesanan. Salah satu café favorit di Medan.',
          isFeatured: true,
          sortOrder: 3
        }
      ]
    });
    console.log('✅ 3 ulasan pelanggan berhasil dibuat di CmsTestimonial.');
  } else {
    console.log(`ℹ️ CmsTestimonial sudah berisi ${testimonialCount} item.`);
  }

  // 6. Jam Operasional & Kontak Outlet
  const existingOutlet = await prisma.cmsOutletInfo.findFirst();
  if (!existingOutlet) {
    await prisma.cmsOutletInfo.create({
      data: {
        outletName: 'Komazi Coffee - Medan',
        address: 'Jl. Sisingamangaraja No. 88, Kota Medan, Sumatera Utara 20217',
        city: 'Medan',
        weekdayHours: 'Senin - Jumat: 08:00 - 23:00 WIB',
        weekendHours: 'Sabtu - Minggu: 07:00 - 00:00 WIB',
        phone: '081298765432',
        whatsappNumber: '6281298765432',
        whatsappMessage: 'Halo Komazi Coffee, saya ingin bertanya tentang menu atau reservasi meja.',
        googleMapsUrl: 'https://maps.google.com/?q=Medan',
        googleMapsEmbed:
          'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d127415.82760927655!2d98.60309995!3d3.59519565!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x303131cc1c3eb2fd%3A0x23d4310e9f697472!2sMedan%2C%20North%20Sumatra!5e0!3m2!1sen!2sid!4v1700000000000',
        instagramUrl: 'https://instagram.com/komazi.coffee',
        tiktokUrl: 'https://tiktok.com/@komazi.coffee'
      }
    });
    console.log('✅ Info outlet CmsOutletInfo berhasil dibuat.');
  } else {
    console.log('ℹ️ CmsOutletInfo sudah ada, melewati pembuatan baru.');
  }

  console.log('✨ Seeding CMS data selesai dengan sukses!');
}

main()
  .catch((e) => {
    console.error('❌ Error saat seeding CMS:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
