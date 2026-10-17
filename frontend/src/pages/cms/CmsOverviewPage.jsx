import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Tag,
  Coffee,
  MessageSquare,
  Clock,
  Globe,
  ExternalLink,
  ArrowUpRight,
  CheckCircle2,
  Store,
  Power,
  ShieldCheck,
  Eye,
  EyeOff,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { useCmsStore } from '../../store/cmsStore';
import { useToastStore } from '../../store/toastStore';

export default function CmsOverviewPage() {
  const {
    fetchConfig,
    fetchSpotlights,
    fetchPromos,
    fetchFacilities,
    fetchTestimonials,
    fetchOutlet,
    config,
    spotlights,
    promos,
    facilities,
    testimonials,
    outlet,
    loading,
    saving,
    toggleLandingPageActive
  } = useCmsStore();
  const { addToast } = useToastStore();

  useEffect(() => {
    fetchConfig();
    fetchSpotlights();
    fetchPromos();
    fetchFacilities();
    fetchTestimonials();
    fetchOutlet();
  }, [fetchConfig, fetchSpotlights, fetchPromos, fetchFacilities, fetchTestimonials, fetchOutlet]);

  const isLandingActive = config?.isLandingPageActive ?? true;

  const handleToggleLandingPage = async () => {
    const nextStatus = !isLandingActive;
    const res = await toggleLandingPageActive(nextStatus);
    if (res?.success) {
      addToast(
        nextStatus
          ? 'Landing Page berhasil DIAKTIFKAN! Publik kini dapat melihat landing page kedai.'
          : 'Landing Page berhasil DINONAKTIFKAN! Pengunjung umum akan otomatis dialihkan ke halaman login POS.',
        'success'
      );
    } else {
      addToast(res?.message || 'Gagal memperbarui status landing page', 'error');
    }
  };

  const stats = [
    {
      title: 'Menu Spotlight',
      count: spotlights.length,
      unit: 'Menu Aktif',
      desc: 'Produk unggulan POS yang disorot di landing page',
      link: '/cms/menu-spotlight',
      icon: Sparkles,
      color: 'coral'
    },
    {
      title: 'Promo Aktif',
      count: promos.filter((p) => p.isActive).length,
      unit: 'Penawaran',
      desc: 'Banner diskon dan promo kopi berjalan',
      link: '/cms/promos',
      icon: Tag,
      color: 'amber'
    },
    {
      title: 'Fasilitas Kedai',
      count: facilities.filter((f) => f.isActive).length,
      unit: 'Fasilitas',
      desc: 'Kenyamanan pengunjung (WiFi, stopkontak, AC, dll)',
      link: '/cms/facilities',
      icon: Coffee,
      color: 'cyan'
    },
    {
      title: 'Ulasan Pelanggan',
      count: testimonials.length,
      unit: 'Testimoni',
      desc: 'Ulasan bintang 5 yang tampil di halaman utama',
      link: '/cms/testimonials',
      icon: MessageSquare,
      color: 'purple'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Studio Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#22100f] via-slate-900 to-[#0e1d1c] border border-komazi-coral/25 p-6 md:p-8">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-komazi-coral/10 border border-komazi-coral/30 text-komazi-coral text-xs font-semibold uppercase tracking-wider mb-3">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Marketing Studio Mandiri
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Pusat Pengelolaan Konten & Branding Komazi
          </h1>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">
            Kelola tampilan landing page kedai Anda secara langsung tanpa mengganggu operasional kasir
            POS. Semua perubahan yang Anda simpan di sini otomatis tercermin pada halaman publik.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-5">
            <a
              href="/?preview=true"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-komazi-coral to-[#ff7368] text-white hover:from-komazi-coral-dark hover:to-komazi-coral transition-all shadow-lg shadow-komazi-coral/30"
            >
              <ExternalLink className="w-4 h-4" />
              Lihat Pratinjau Landing Page
            </a>
            <Link
              to="/cms/hero"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 transition-all border border-slate-700"
            >
              Edit Hero & Identitas
            </Link>
          </div>
        </div>

        {/* Ambient Glow */}
        <div className="absolute right-0 top-0 w-80 h-80 bg-komazi-coral/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute right-40 bottom-0 w-80 h-80 bg-komazi-teal/15 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      {/* ─── KONTROL STATUS PUBLIKASI LANDING PAGE (ON / OFF SWITCH) ─── */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 md:p-7 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                  isLandingActive
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isLandingActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                Status Publikasi: {isLandingActive ? 'Aktif' : 'Tidak Aktif'}
              </span>
            </div>

            <h2 className="text-lg font-bold text-white tracking-tight">
              {isLandingActive
                ? 'Landing Page Sedang Aktif & Terbuka untuk Umum'
                : 'Landing Page Sedang Ditutup (Pengunjung Dialihkan ke Login POS)'}
            </h2>

            <p className="text-xs text-slate-400 leading-relaxed">
              {isLandingActive ? (
                <span>
                  Pengunjung yang mengakses alamat website utama <code className="text-komazi-coral bg-komazi-coral/10 px-1 py-0.5 rounded">/</code> dapat
                  melihat menu pilihan, profil kedai, promo, dan melakukan pemesanan via WhatsApp.
                </span>
              ) : (
                <span>
                  Landing page dinonaktifkan untuk publik. Setiap pengunjung yang mengakses <code className="text-komazi-coral bg-komazi-coral/10 px-1 py-0.5 rounded">/</code> akan
                  langsung dialihkan ke halaman login kasir POS. Anda tetap dapat melihat halaman melalui tombol <strong>Pratinjau Khusus</strong>.
                </span>
              )}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              onClick={handleToggleLandingPage}
              disabled={saving}
              className={`inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl font-bold text-xs transition-all shadow-lg ${
                isLandingActive
                  ? 'bg-slate-800 hover:bg-amber-950/40 text-amber-300 hover:text-amber-200 border border-slate-700 hover:border-amber-500/50'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-emerald-500/20'
              }`}
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Power className="w-4 h-4" />
              )}
              <span>
                {saving
                  ? 'Menyimpan...'
                  : isLandingActive
                  ? 'Matikan Landing Page'
                  : 'Aktifkan Landing Page'}
              </span>
            </button>

            <a
              href="/?preview=true"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700 hover:border-slate-600 text-xs font-semibold transition-all"
              title="Buka pratinjau landing page di tab baru"
            >
              <ExternalLink className="w-4 h-4 text-komazi-coral" />
              <span>Pratinjau Khusus</span>
            </a>
          </div>
        </div>
      </div>

      {/* Grid Status Modul */}
      <div>
        <h2 className="text-base font-semibold text-white mb-4 flex items-center justify-between">
          <span>Status Konten Landing Page</span>
          {loading && <span className="text-xs text-slate-400">Memuat data...</span>}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, idx) => {
            const Icon = s.icon;
            return (
              <Link
                key={idx}
                to={s.link}
                className="group relative bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-komazi-coral/40 rounded-2xl p-5 transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700/60 text-komazi-coral group-hover:scale-110 transition-transform">
                      <Icon className="w-5 h-5" />
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-komazi-coral group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </div>
                  <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    {s.title}
                  </div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {s.count}{' '}
                    <span className="text-xs font-normal text-slate-400">
                      {s.unit}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                    {s.desc}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center text-xs font-medium text-komazi-coral group-hover:underline">
                  Kelola Modul &rarr;
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Quick Identity & Outlet Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Brand Identity Card */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Globe className="w-4 h-4 text-komazi-coral" />
              Identitas & Headline Utama
            </div>
            <Link
              to="/cms/hero"
              className="text-xs text-komazi-coral hover:underline font-medium"
            >
              Ubah
            </Link>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block mb-0.5">Nama Brand:</span>
              <span className="font-semibold text-slate-200 text-sm">
                {config?.brandName || 'Komazi Coffee'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Tagline:</span>
              <span className="text-slate-300">
                {config?.brandTagline || '-'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Headline Hero:</span>
              <span className="text-slate-300">
                {config?.heroHeadline || '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Outlet & Jam Operasional Card */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Clock className="w-4 h-4 text-komazi-teal-light" />
              Jam Operasional & Kontak
            </div>
            <Link
              to="/cms/outlet"
              className="text-xs text-komazi-teal-light hover:underline font-medium"
            >
              Ubah
            </Link>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block mb-0.5">Jam Hari Kerja:</span>
              <span className="font-medium text-slate-200">
                {outlet?.weekdayHours || '-'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Jam Akhir Pekan:</span>
              <span className="font-medium text-slate-200">
                {outlet?.weekendHours || '-'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">WhatsApp Pemesanan:</span>
              <span className="font-medium text-komazi-teal-light">
                +{outlet?.whatsappNumber || '-'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
