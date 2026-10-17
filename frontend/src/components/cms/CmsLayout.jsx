import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Image as ImageIcon,
  Sparkles,
  Tag,
  Coffee,
  MessageSquare,
  Clock,
  Globe,
  ExternalLink,
  Store,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ShieldAlert,
  Power
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useCmsStore } from '../../store/cmsStore';
import { isInstalledApp } from '../../services/platform';
import KomaziLogo from '../ui/KomaziLogo';

const CMS_NAV_ITEMS = [
  {
    to: '/cms',
    end: true,
    label: 'Overview Studio',
    description: 'Ringkasan & status publikasi',
    icon: LayoutDashboard
  },
  {
    to: '/cms/hero',
    label: 'Hero & Identitas',
    description: 'Headline, tagline & banner utama',
    icon: ImageIcon
  },
  {
    to: '/cms/menu-spotlight',
    label: 'Menu Spotlight',
    description: 'Etalase menu pilihan POS',
    icon: Sparkles
  },
  {
    to: '/cms/promos',
    label: 'Promo & Penawaran',
    description: 'Banner diskon & event kedai',
    icon: Tag
  },
  {
    to: '/cms/facilities',
    label: 'Fasilitas Kedai',
    description: 'Kenyamanan WiFi, AC & stopkontak',
    icon: Coffee
  },
  {
    to: '/cms/testimonials',
    label: 'Ulasan Pelanggan',
    description: 'Testimoni bintang 5 terverifikasi',
    icon: MessageSquare
  },
  {
    to: '/cms/outlet',
    label: 'Jam & Info Outlet',
    description: 'Jam buka, WhatsApp & maps',
    icon: Clock
  },
  {
    to: '/cms/seo',
    label: 'SEO & Meta Tag',
    description: 'Optimasi mesin pencari Google',
    icon: Globe
  }
];

export default function CmsLayout() {
  const { user, logout } = useAuthStore();
  const { config, fetchConfig, toggleLandingPageActive, saving } = useCmsStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isLandingActive = config?.isLandingPageActive ?? true;

  // ── Proteksi Perangkat Terinstal: Kunci HANYA untuk POS Kasir
  if (isInstalledApp) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Akses Studio CMS Dibatasi</h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Aplikasi terinstal pada perangkat ini dikonfigurasi khusus untuk operasional <strong>POS Kasir</strong> saja.
              Pengaturan Studio CMS dan Landing Page hanya dapat dibuka melalui browser web komputer (PC / Laptop).
            </p>
          </div>
          <button
            onClick={() => navigate('/pos')}
            className="w-full py-3 px-4 bg-gradient-to-r from-komazi-coral to-[#ff7368] hover:from-komazi-coral-dark hover:to-komazi-coral text-white font-semibold rounded-xl text-xs transition-all shadow-lg shadow-komazi-coral/25 flex items-center justify-center gap-2"
          >
            <Store className="w-4 h-4" />
            <span>Buka Layar Kasir POS</span>
          </button>
        </div>
      </div>
    );
  }

  const currentNav = CMS_NAV_ITEMS.find((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
  ) || CMS_NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row antialiased selection:bg-komazi-coral/30 selection:text-komazi-coral">
      {/* ─── SIDEBAR DESKTOP ────────────────────────────────────────── */}
      <aside className="hidden md:flex md:w-72 flex-col bg-slate-900 border-r border-slate-800/80 sticky top-0 h-screen z-30">
        {/* Brand Studio Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <KomaziLogo variant="icon" size="sm" className="shrink-0" />
            <div>
              <div className="font-semibold text-white tracking-wide text-sm flex items-center gap-1.5">
                Komazi Studio
                <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-komazi-coral/10 text-komazi-coral border border-komazi-coral/25">
                  CMS
                </span>
              </div>
              <p className="text-xs text-slate-400">Marketing & Content</p>
            </div>
          </div>
        </div>

        {/* Quick Nav Switches */}
        <div className="p-3 border-b border-slate-800/60 bg-slate-950/40 space-y-1.5">
          <a
            href="/?preview=true"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-komazi-coral bg-komazi-coral/10 hover:bg-komazi-coral/20 border border-komazi-coral/30 rounded-lg transition-all"
            title="Pratinjau tampilan publik landing page"
          >
            <span className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-komazi-coral" />
              Lihat Landing Page
            </span>
            <ExternalLink className="w-3.5 h-3.5 text-komazi-coral/80" />
          </a>

          <button
            onClick={() => navigate('/pos')}
            className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-lg transition-all"
          >
            <span className="flex items-center gap-2">
              <Store className="w-4 h-4 text-komazi-teal-light" />
              Beralih ke Kasir POS
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 custom-scrollbar">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Modul Konten Publik
          </div>
          {CMS_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-start gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                    isActive
                      ? 'bg-komazi-coral/15 text-komazi-coral border border-komazi-coral/30 shadow-sm font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`
                }
              >
                <Icon className="w-4 h-4 mt-0.5 shrink-0 transition-transform group-hover:scale-110" />
                <div className="flex-1">
                  <div className="leading-tight font-semibold">{item.label}</div>
                  <div className="text-[11px] text-slate-400 leading-normal mt-0.5 line-clamp-1">
                    {item.description}
                  </div>
                </div>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer User Info */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-komazi-teal/40 flex items-center justify-center font-bold text-xs text-komazi-teal-light">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white truncate">{user?.name}</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                {user?.role}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Keluar"
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* ─── MOBILE NAVBAR HEADER ────────────────────────────────────── */}
      <header className="md:hidden flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <KomaziLogo variant="icon" size="xs" className="shrink-0" />
          <span className="font-semibold text-sm text-white">Komazi CMS</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/?preview=true"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-komazi-coral hover:bg-komazi-coral/15 rounded-lg border border-komazi-coral/30"
            title="Lihat Landing Page (Pratinjau)"
          >
            <Globe className="w-4 h-4" />
          </a>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 p-4 space-y-2 z-30">
          {/* Quick Toggle on Mobile */}
          <button
            onClick={() => toggleLandingPageActive(!isLandingActive)}
            disabled={saving}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              isLandingActive
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}
          >
            <span className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  isLandingActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span>Status Landing Page:</span>
            </span>
            <span className="uppercase font-bold tracking-wider">
              {isLandingActive ? 'Online' : 'Offline'}
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2 pb-3 border-b border-slate-800">
            <a
              href="/?preview=true"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-komazi-coral bg-komazi-coral/10 rounded-lg border border-komazi-coral/30"
            >
              <Globe className="w-3.5 h-3.5" />
              Pratinjau Publik
            </a>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/pos');
              }}
              className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-slate-300 bg-slate-800 rounded-lg border border-slate-700"
            >
              <Store className="w-3.5 h-3.5 text-komazi-teal-light" />
              Kasir POS
            </button>
          </div>

          <div className="space-y-1 pt-1">
            {CMS_NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium ${
                    isActive ? 'bg-komazi-coral/20 text-komazi-coral font-semibold' : 'text-slate-300'
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              Login sebagai: <span className="text-white font-medium">{user?.name}</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-xs text-red-400 hover:underline flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              Keluar
            </button>
          </div>
        </div>
      )}

      {/* ─── MAIN CONTENT AREA ──────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-950 overflow-y-auto">
        {/* Sub-header Context Bar */}
        <div className="hidden md:flex items-center justify-between px-8 py-3.5 bg-slate-900/50 border-b border-slate-800/60 backdrop-blur sticky top-0 z-20">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Studio</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-white font-semibold">{currentNav.label}</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Toggle Landing Page */}
            <button
              onClick={() => toggleLandingPageActive(!isLandingActive)}
              disabled={saving}
              title={
                isLandingActive
                  ? 'Landing Page AKTIF (Online). Klik untuk mematikan landing page bagi umum.'
                  : 'Landing Page NONAKTIF (Offline). Klik untuk mengaktifkan landing page.'
              }
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                isLandingActive
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isLandingActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span>Landing Page: {isLandingActive ? 'ONLINE' : 'OFFLINE'}</span>
            </button>

            <span className="text-xs text-slate-400 hidden xl:flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-komazi-teal-light animate-pulse"></span>
              Live Sync
            </span>

            <a
              href="/?preview=true"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-komazi-coral bg-komazi-coral/10 hover:bg-komazi-coral/20 border border-komazi-coral/30 rounded-lg transition-all"
              title="Pratinjau tampilan landing page (tetap dapat dibuka meskipun status offline)"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Pratinjau Publik
            </a>
          </div>
        </div>

        {/* Page Content View */}
        <div className="p-4 sm:p-6 lg:p-8 flex-1 max-w-7xl w-full mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
