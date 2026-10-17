import React, { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Coffee,
  Sparkles,
  MapPin,
  Clock,
  MessageCircle,
  ArrowRight,
  ExternalLink,
  Star,
  ChevronDown,
  Menu as MenuIcon,
  X,
  Lock,
  Tag,
  Gift,
  ShieldCheck,
  CheckCircle2,
  Heart,
  AlertTriangle
} from 'lucide-react';
import { useCmsStore } from '../../store/cmsStore';
import { useAuthStore } from '../../store/authStore';
import { renderFacilityIcon } from '../cms/CmsFacilitiesPage';
import KomaziLogo from '../../components/ui/KomaziLogo';
import { isInstalledApp } from '../../services/platform';
import { getProductInitials, getProductColor } from '../../utils/format';

function InstagramIcon({ className = 'w-4 h-4' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export default function LandingPage() {
  const { landingData, fetchPublicLanding, loading } = useCmsStore();
  const { isAuthenticated, user } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    fetchPublicLanding();
  }, [fetchPublicLanding]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ── 1. Jika dijalankan di aplikasi terinstal (APK / POS Tablet): Kunci langsung ke POS / Login
  if (isInstalledApp) {
    if (!isAuthenticated) {
      return <Navigate to="/login" replace />;
    }
    if (user?.role === 'KITCHEN' || user?.role === 'BARISTA') {
      return <Navigate to="/kds-screen" replace />;
    }
    return <Navigate to="/pos" replace />;
  }

  const isPreview = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === 'true';
  const isLandingActive = landingData?.config?.isLandingPageActive ?? true;

  // ── 2. Jika Landing Page dimatikan (OFF) oleh Owner dan BUKAN pratinjau khusus: Alihkan ke Login / POS
  if (landingData?.config && !isLandingActive && !isPreview) {
    if (!isAuthenticated) {
      return <Navigate to="/login" replace />;
    }
    if (user?.role === 'KITCHEN' || user?.role === 'BARISTA') {
      return <Navigate to="/kds-screen" replace />;
    }
    return <Navigate to="/pos" replace />;
  }

  // Jika data landing page belum siap dan bukan mode pratinjau, tahan render agar tidak terjadi flash
  if (!landingData && !isPreview) {
    return null;
  }

  const config = landingData?.config || {};
  const spotlights = landingData?.spotlights || [];
  const promos = landingData?.promos || [];
  const facilities = landingData?.facilities || [];
  const testimonials = landingData?.testimonials || [];
  const outlet = landingData?.outlet || {};

  const cleanPhone = (outlet.whatsappNumber || '6281298765432').replace(/[^0-9]/g, '');
  const generalWaUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
    outlet.whatsappMessage || 'Halo Komazi Coffee, saya ingin bertanya tentang menu kedai.'
  )}`;

  const getProductWaUrl = (productName) => {
    const text = `Halo Komazi Coffee, saya tertarik dan ingin memesan menu "${productName}". Apakah menu ini tersedia sekarang?`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  const navLinks = [
    { name: 'Tentang Kami', href: '#about' },
    { name: 'Menu Pilihan', href: '#menu' },
    { name: 'Fasilitas', href: '#facilities' },
    { name: 'Promo', href: '#promos' },
    { name: 'Ulasan', href: '#reviews' },
    { name: 'Lokasi & Jam', href: '#location' }
  ];

  return (
    <div className="min-h-screen bg-komazi-black text-komazi-text font-sans selection:bg-komazi-coral/30 selection:text-komazi-coral">
      {/* ─── PREVIEW MODE BANNER (Ketika Landing Page Offline / Mode Pratinjau) ─── */}
      {isPreview && (
        <div className="bg-gradient-to-r from-amber-950 via-amber-900 to-amber-950 border-b border-amber-500/40 text-amber-200 px-4 py-2.5 text-xs font-medium sticky top-0 z-[60] shadow-xl backdrop-blur-md">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0"></span>
              <span>
                <strong className="text-amber-100 uppercase tracking-wider">Mode Pratinjau CMS:</strong>{' '}
                {!isLandingActive
                  ? 'Landing page saat ini sedang DINONAKTIFKAN untuk umum. Pengunjung publik otomatis dialihkan ke halaman login POS.'
                  : 'Anda sedang melihat pratinjau landing page secara langsung.'}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                to="/cms"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 border border-amber-500/40 text-[11px] font-semibold transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Kembali ke Studio CMS</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ─── STICKY NAVBAR ─────────────────────────────────────────── */}
      <header
        className={`fixed ${isPreview ? 'top-10' : 'top-0'} left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-komazi-black/90 backdrop-blur-md border-b border-komazi-border shadow-2xl py-3.5'
            : 'bg-transparent py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Logo Brand Resmi Komazi */}
          <a href="#" className="flex items-center gap-3 group transition-transform duration-200 hover:scale-105">
            <KomaziLogo size="md" />
          </a>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-7">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-xs font-medium text-slate-300 hover:text-komazi-coral transition-colors"
              >
                {link.name}
              </a>
            ))}
          </nav>

          {/* Action Buttons Right */}
          <div className="hidden sm:flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                {!isInstalledApp && (user?.role === 'OWNER' || user?.role === 'MANAGER') && (
                  <Link
                    to="/cms"
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-komazi-coral/15 hover:bg-komazi-coral/25 text-komazi-coral border border-komazi-coral/30 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-komazi-coral" />
                    <span>Studio CMS</span>
                  </Link>
                )}
                <Link
                  to={user?.role === 'KITCHEN' || user?.role === 'BARISTA' ? '/kds-screen' : '/pos'}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-komazi-surface hover:bg-komazi-surface-2 text-slate-200 border border-komazi-border transition-all"
                >
                  <Lock className="w-3.5 h-3.5 text-komazi-coral" />
                  <span>Buka POS ({user?.name})</span>
                </Link>
              </div>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl text-slate-400 hover:text-white hover:bg-komazi-surface-2 transition-all"
                title="Masuk Kasir / Staf"
              >
                <Lock className="w-3.5 h-3.5 text-komazi-coral" />
                <span>Masuk Kasir</span>
              </Link>
            )}
          </div>

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl bg-komazi-surface border border-komazi-border text-slate-300 hover:text-white"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-komazi-surface/98 backdrop-blur-xl border-b border-komazi-border px-5 py-4 space-y-3 animate-in fade-in slide-in-from-top-4 duration-200">
            <div className="space-y-1">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-xs font-medium text-slate-200 hover:text-komazi-coral hover:bg-komazi-surface-2 rounded-lg"
                >
                  {link.name}
                </a>
              ))}
            </div>
            <div className="pt-3 border-t border-komazi-border flex flex-col gap-2">
              {isAuthenticated ? (
                <>
                  {!isInstalledApp && (user?.role === 'OWNER' || user?.role === 'MANAGER') && (
                    <Link
                      to="/cms"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg bg-komazi-coral/15 text-komazi-coral border border-komazi-coral/30"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Buka Studio CMS</span>
                    </Link>
                  )}
                  <Link
                    to={user?.role === 'KITCHEN' || user?.role === 'BARISTA' ? '/kds-screen' : '/pos'}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg bg-komazi-surface text-white border border-komazi-border"
                  >
                    <Lock className="w-3.5 h-3.5 text-komazi-coral" />
                    <span>Layar Kasir POS</span>
                  </Link>
                </>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg bg-komazi-surface text-slate-300 border border-komazi-border"
                >
                  <Lock className="w-3.5 h-3.5 text-komazi-coral" />
                  <span>Masuk Kasir / Staf</span>
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ─── HERO SECTION ──────────────────────────────────────────── */}
      <section
        id="hero"
        className="relative min-h-[92vh] flex items-center justify-center overflow-hidden pt-28 pb-16 px-4 sm:px-6 lg:px-8"
      >
        {/* Background Image with Dark Vignette & Brand Glows */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-all duration-1000 scale-105"
          style={{
            backgroundImage: `url(${
              config.heroImageUrl ||
              'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1600&auto=format&fit=crop&q=80'
            })`
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-komazi-black via-komazi-black/85 to-komazi-black/65"></div>
          {/* Ambient Brand Lightings from Logo Colors (Coral & Teal) */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-komazi-coral/10 blur-[130px] pointer-events-none" />
          <div className="absolute bottom-10 right-1/4 w-[450px] h-[450px] rounded-full bg-komazi-teal/15 blur-[110px] pointer-events-none" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6">
          {/* Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.15]">
            {config.heroHeadline || 'Secangkir Kopi Pilihan & Cita Rasa Otentik di Setiap Tetesnya'}
          </h1>

          {/* Subheadline */}
          <p className="text-sm sm:text-base lg:text-lg text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
            {config.heroSubheadline ||
              'Nikmati racikan kopi artisan nusantara, hidangan lezat, dan suasana kedai yang hangat di pusat kota Medan.'}
          </p>

          {/* Hero CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-4">
            <a
              href={config.heroCtaLink || '#menu'}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-komazi-coral to-[#ff7368] hover:from-komazi-coral-dark hover:to-komazi-coral text-white font-bold text-xs uppercase tracking-wider transition-all shadow-xl shadow-komazi-coral/30 transform hover:-translate-y-0.5"
            >
              <span>{config.heroCtaText || 'Jelajahi Menu Pilihan'}</span>
              <ArrowRight className="w-4 h-4" />
            </a>

            <a
              href={config.secondaryCtaLink || '#location'}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-komazi-surface/90 hover:bg-komazi-surface-2 text-komazi-text border border-komazi-border hover:border-komazi-teal-light font-semibold text-xs tracking-wide transition-all backdrop-blur"
            >
              <MapPin className="w-4 h-4 text-komazi-teal-light" />
              <span>{config.secondaryCtaText || 'Kunjungi Komazi Coffee'}</span>
            </a>
          </div>
        </div>
      </section>

      {/* ─── ABOUT & STORY SECTION ─────────────────────────────────── */}
      <section id="about" className="py-20 bg-komazi-surface/40 border-t border-komazi-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Story Text */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-komazi-teal/15 border border-komazi-teal/30 text-komazi-teal-light text-xs font-semibold uppercase tracking-wider">
                <Coffee className="w-3.5 h-3.5" />
                Filosofi & Racikan
              </div>

              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-snug">
                {config.aboutTitle || 'Kisah & Dedikasi Komazi Coffee'}
              </h2>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed whitespace-pre-line font-light">
                {config.aboutStory ||
                  'Berawal dari kecintaan mendalam terhadap biji kopi nusantara dan kehangatan tradisi ngopi di Medan, Komazi Coffee hadir menyajikan racikan kopi artisan yang dipanggang dengan presisi.'}
              </p>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-komazi-border">
                <div>
                  <div className="text-2xl font-bold text-komazi-coral">4.9 / 5.0</div>
                  <div className="text-xs text-slate-400 mt-0.5">Rating Kepuasan Pelanggan</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-komazi-teal-light">30+ Pilihan</div>
                  <div className="text-xs text-slate-400 mt-0.5">Menu Kopi, Pastry & Makanan</div>
                </div>
              </div>
            </div>

            {/* Visual Photography with Logo Identity Badge */}
            <div className="relative">
              <div className="rounded-3xl overflow-hidden border border-komazi-border shadow-2xl">
                <img
                  src={
                    config.aboutImageUrl ||
                    'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=1000&auto=format&fit=crop&q=80'
                  }
                  alt="Tentang Komazi Coffee"
                  className="w-full h-80 sm:h-96 object-cover hover:scale-105 transition-transform duration-700"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── MENU SPOTLIGHT SECTION ────────────────────────────────── */}
      <section id="menu" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Menu Pilihan
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm">
            Disajikan langsung dari dapur dan bar espresso kami dengan bahan-bahan berkualitas prima.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {spotlights.map((item) => {
            const product = item.product || {};
            const waUrl = getProductWaUrl(product.name || 'Menu Komazi');
            return (
              <div
                key={item.id}
                className="group bg-komazi-surface/85 hover:bg-komazi-surface border border-komazi-border hover:border-komazi-coral/50 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col justify-between shadow-lg hover:shadow-2xl hover:shadow-komazi-coral/15 transform hover:-translate-y-1"
              >
                <div>
                  {/* Product Image */}
                  <div className="relative h-48 w-full overflow-hidden bg-komazi-black flex items-center justify-center">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full p-3 flex items-center justify-center bg-komazi-surface">
                        <div className="w-full h-full rounded-2xl bg-gradient-to-b from-[#FF6B5E] to-[#D9382B] flex items-center justify-center shadow-md shadow-komazi-coral/25 select-none">
                          <span className="font-sans font-black text-4xl text-white select-none">
                            {getProductInitials(product.name)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Badge Coral */}
                    {item.customBadge && (
                      <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-komazi-coral text-white font-bold text-[10px] uppercase tracking-wider shadow-lg shadow-komazi-coral/40">
                        {item.customBadge}
                      </span>
                    )}

                    {product.isSoldOut && (
                      <div className="absolute inset-0 bg-komazi-black/80 flex items-center justify-center">
                        <span className="px-3 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 font-bold text-xs uppercase tracking-wider">
                          Habis Terjual
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="p-5 space-y-2">
                    <div className="text-[11px] text-komazi-teal-light font-medium uppercase tracking-wider">
                      {product.category?.name || 'Spesial Kedai'}
                    </div>

                    <h3 className="font-bold text-white text-base leading-snug group-hover:text-komazi-coral transition-colors">
                      {product.name}
                    </h3>

                    {product.description && (
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {product.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── CAFÉ FACILITIES & AMENITIES SECTION ─────────────────────── */}
      <section id="facilities" className="py-20 bg-komazi-surface/30 border-y border-komazi-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Fasilitas Lengkap untuk Waktu Bersantai Anda
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm">
              Kami merancang suasana kedai agar Anda betah menikmati secangkir kopi dengan segala
              fasilitas pendukung.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {facilities.map((fac) => (
              <div
                key={fac.id}
                className="bg-komazi-surface/70 border border-komazi-border hover:border-komazi-teal-light/50 rounded-2xl p-6 space-y-4 transition-all duration-200 hover:-translate-y-1 shadow-lg"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-komazi-teal/20 to-komazi-teal-light/10 border border-komazi-teal/30 text-komazi-teal-light flex items-center justify-center">
                  {renderFacilityIcon(fac.iconName, 'w-6 h-6')}
                </div>
                <h3 className="font-bold text-white text-base">{fac.title}</h3>
                <p className="text-xs text-slate-300 leading-relaxed font-light">
                  {fac.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PROMOS & OFFERS SECTION ───────────────────────────────── */}
      {promos.length > 0 && (
        <section id="promos" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-komazi-coral/15 border border-komazi-coral/30 text-komazi-coral text-xs font-semibold uppercase tracking-wider">
              <Tag className="w-3.5 h-3.5" />
              Penawaran Terkini
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Promo Spesial & Paket Hemat
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm">
              Nikmati penawaran terbatas untuk pengalaman ngopi lebih hemat bersama teman dan keluarga.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {promos.map((promo) => (
              <div
                key={promo.id}
                className="rounded-3xl border border-komazi-border bg-komazi-surface/80 overflow-hidden shadow-xl flex flex-col sm:flex-row hover:border-komazi-coral/40 transition-colors"
              >
                {promo.bannerUrl && (
                  <div
                    className="sm:w-1/2 h-48 sm:h-auto bg-cover bg-center shrink-0"
                    style={{ backgroundImage: `url(${promo.bannerUrl})` }}
                  ></div>
                )}
                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    {promo.badgeText && (
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-komazi-coral text-white font-bold text-[10px] uppercase tracking-wider shadow">
                        {promo.badgeText}
                      </span>
                    )}
                    <h3 className="font-bold text-white text-lg leading-snug">{promo.title}</h3>
                    {promo.subtitle && (
                      <p className="text-xs text-komazi-teal-light font-medium">{promo.subtitle}</p>
                    )}
                    {promo.description && (
                      <p className="text-xs text-slate-300 leading-relaxed font-light">
                        {promo.description}
                      </p>
                    )}
                  </div>

                  <a
                    href={promo.actionLink || generalWaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-komazi-teal to-komazi-teal-light hover:brightness-110 text-white font-bold text-xs transition-all shadow"
                  >
                    <MessageCircle className="w-4 h-4 fill-white" />
                    <span>{promo.actionText || 'Klaim Promo via WhatsApp'}</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── CUSTOMER REVIEWS SECTION ──────────────────────────────── */}
      <section id="reviews" className="py-20 bg-komazi-surface/30 border-t border-komazi-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Kata Mereka Tentang Komazi
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm">
              Kisah nyata dari para penikmat kopi yang telah merasakan kehangatan kedai kami.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.id}
                className="bg-komazi-surface/80 border border-komazi-border hover:border-komazi-coral/30 rounded-2xl p-6 space-y-4 flex flex-col justify-between shadow-lg transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-1 text-komazi-coral">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i < (t.rating || 5)
                            ? 'fill-komazi-coral text-komazi-coral'
                            : 'text-slate-700'
                        }`}
                      />
                    ))}
                  </div>

                  <p className="text-xs text-slate-300 italic leading-relaxed">
                    "{t.reviewText}"
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-3 border-t border-komazi-border">
                  {t.avatarUrl ? (
                    <img
                      src={t.avatarUrl}
                      alt={t.customerName}
                      className="w-9 h-9 rounded-full object-cover border border-komazi-border shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-komazi-coral/20 text-komazi-coral border border-komazi-coral/30 flex items-center justify-center font-bold text-xs shrink-0">
                      {t.customerName?.[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-white text-xs">{t.customerName}</div>
                    <div className="text-[11px] text-slate-400">{t.customerRole}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── LOCATION, HOURS & CONTACT SECTION ──────────────────────── */}
      <section id="location" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Outlet Info */}
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-komazi-teal/15 border border-komazi-teal/30 text-komazi-teal-light text-xs font-semibold uppercase tracking-wider">
              <MapPin className="w-3.5 h-3.5" />
              Kunjungi Komazi Coffee
            </div>

            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Temukan Komazi Coffee di Medan
            </h2>

            <div className="space-y-4 text-xs">
              {/* Alamat */}
              <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-komazi-surface border border-komazi-border">
                <MapPin className="w-5 h-5 text-komazi-coral shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white text-sm">{outlet.outletName || 'Komazi Coffee'}</div>
                  <div className="text-slate-300 mt-1 leading-relaxed">{outlet.address}</div>
                </div>
              </div>

              {/* Jam Buka */}
              <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-komazi-surface border border-komazi-border">
                <Clock className="w-5 h-5 text-komazi-teal-light shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-white text-sm">Jam Operasional</div>
                  <div className="text-slate-300">{outlet.weekdayHours}</div>
                  <div className="text-slate-300">{outlet.weekendHours}</div>
                </div>
              </div>
            </div>

            {/* Direct CTA WA in Coral Red */}
            <div className="pt-2">
              <a
                href={generalWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-komazi-coral to-[#ff7368] hover:from-komazi-coral-dark hover:to-komazi-coral text-white font-bold text-xs uppercase tracking-wider transition-all shadow-xl shadow-komazi-coral/30"
              >
                <MessageCircle className="w-4 h-4 fill-white text-white" />
                <span>Hubungi Kami via WhatsApp</span>
              </a>
            </div>

            {/* Socials */}
            <div className="flex items-center gap-3 pt-2">
              {outlet.instagramUrl && (
                <a
                  href={outlet.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-komazi-surface border border-komazi-border text-slate-300 hover:text-komazi-coral hover:border-komazi-coral/30 text-xs transition-colors"
                >
                  <InstagramIcon className="w-3.5 h-3.5" />
                  <span>Instagram</span>
                </a>
              )}
              {outlet.googleMapsUrl && (
                <a
                  href={outlet.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-komazi-surface border border-komazi-border text-slate-300 hover:text-komazi-teal-light hover:border-komazi-teal-light/30 text-xs transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Petunjuk Arah Google Maps</span>
                </a>
              )}
            </div>
          </div>

          {/* Map Embed or Visual Card */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl overflow-hidden border border-komazi-border bg-komazi-surface h-80 sm:h-96 shadow-2xl relative">
              {outlet.googleMapsEmbed ? (
                <iframe
                  src={outlet.googleMapsEmbed}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen=""
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Peta Lokasi Komazi Coffee"
                  className="w-full h-full grayscale-[30%] contrast-[1.1]"
                ></iframe>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-tr from-komazi-black via-komazi-surface to-komazi-black">
                  <MapPin className="w-12 h-12 text-komazi-coral mb-3 animate-bounce" />
                  <h3 className="font-bold text-white text-base">Lokasi Kedai Komazi</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">{outlet.address}</p>
                  <a
                    href={outlet.googleMapsUrl || 'https://maps.google.com/?q=Medan'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 px-4 py-2 rounded-xl bg-komazi-coral text-white font-bold text-xs shadow-lg shadow-komazi-coral/30"
                  >
                    Buka di Aplikasi Google Maps
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ────────────────────────────────────────────────── */}
      <footer className="border-t border-komazi-border bg-komazi-black py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <KomaziLogo size="sm" />
            <div>
              <span className="font-bold text-slate-300 block">{config.brandName || 'Komazi Coffee'}</span>
              <span>© {new Date().getFullYear()} Komazi. All rights reserved.</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <a href="#hero" className="hover:text-komazi-coral transition-colors">
              Kembali ke Atas
            </a>
            <Link to="/login" className="hover:text-white transition-colors flex items-center gap-1">
              <Lock className="w-3 h-3 text-komazi-coral" />
              <span>Portal Kasir & Staf</span>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
