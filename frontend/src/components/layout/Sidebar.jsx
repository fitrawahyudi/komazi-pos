import React, { useState, useMemo, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useUiStore } from '../../store/uiStore';
import {
  Store,
  UtensilsCrossed,
  Boxes,
  Receipt,
  BarChart3,
  Settings,
  Shield,
  X,
  UserCog,
  ChefHat,
  Users,
  Tv,
  PanelLeftClose,
  PanelLeftOpen,
  Bluetooth,
  BluetoothConnected,
  Usb,
  Coffee,
  LogOut,
  ChevronDown,
  Layers,
  CookingPot,
  ShoppingBag,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Wallet,
  LockOpen,
  ClipboardList,
  Undo2,
  Tag,
  Truck,
  PackagePlus,
  Carrot,
  ClipboardCheck,
  Landmark,
  Lock,
  CalendarClock,
  Clock,
  Calendar,
  CalendarOff,
  LayoutDashboard,
  History,
  Scale,
  LineChart,
  Sparkles,
  Package,
  CreditCard,
  Percent,
  UserCheck,
  Utensils,
  Download,
} from 'lucide-react';
import EditProfileModal from '../profile/EditProfileModal';
import { usePrinterStore } from '../../store/printerStore';
import { isInstalledApp } from '../../services/platform';

export default function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const {
    isMobileSidebarOpen,
    setMobileSidebarOpen,
    toggleMobileSidebar,
    isSidebarCollapsed,
    setSidebarCollapsed,
    toggleSidebarCollapsed,
    openBluetoothModal,
    openUsbModal,
  } = useUiStore();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const { isConnected: isPrinterConnected, connectedDeviceName, connectionType } = usePrinterStore();

  const role = user?.role || 'CASHIER';
  const isCashier = role === 'CASHIER';
  const isKitchen = role === 'KITCHEN';
  const isBarista = role === 'BARISTA';
  const isKitchenStaff = isKitchen || isBarista;
  const isManagerOrOwner = role === 'MANAGER' || role === 'OWNER';
  const isOwner = role === 'OWNER';

  const btConnected = isPrinterConnected;

  // Keyboard Shortcut: Ctrl+B or Cmd+B to toggle sidebar navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      const target = e.target;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        if (window.innerWidth < 1024) {
          toggleMobileSidebar();
        } else {
          toggleSidebarCollapsed();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleMobileSidebar, toggleSidebarCollapsed]);

  // Auto-close / collapse sidebar ketika berpindah ke tab/halaman Transaksi POS (/pos)
  useEffect(() => {
    if (location.pathname === '/pos') {
      setSidebarCollapsed(true);
      setMobileSidebarOpen(false);
    }
  }, [location.pathname, setSidebarCollapsed, setMobileSidebarOpen]);

  // Grouped Navigation Tree
  const navSections = useMemo(
    () => [
      {
        id: 'POS',
        category: 'POS',
        icon: ShoppingCart,
        items: [
          {
            to: '/pos',
            label: 'Transaksi POS',
            icon: ShoppingCart,
            allowed: !isKitchenStaff,
          },
          {
            to: '/cash-drawer',
            label: 'Kas Kasir',
            icon: Wallet,
            allowed: !isKitchenStaff,
          },
          {
            to: '/cash-session',
            label: 'Sesi Kas Terbuka',
            icon: LockOpen,
            allowed: !isKitchenStaff,
          },
          {
            to: '/shift-history',
            label: 'Riwayat Sesi Kasir',
            icon: History,
            allowed: isManagerOrOwner,
          },
          {
            to: '/orders',
            label: 'Riwayat Pesanan',
            icon: ClipboardList,
            allowed: !isKitchenStaff,
          },
          {
            to: '/refunds',
            label: 'Refund',
            icon: Undo2,
            allowed: !isKitchenStaff,
          },
        ],
      },
      {
        id: 'kitchen_display',
        category: 'Dapur & Bar',
        icon: CookingPot,
        items: [
          {
            to: '/kds',
            label: isBarista ? 'Pesanan Barista (BDS)' : isKitchen ? 'Pesanan Dapur' : 'Layar Antrean',
            icon: isBarista ? Coffee : ChefHat,
            allowed: !isCashier,
          },
          {
            to: '/kds-screen',
            label: 'Monitor Layar TV',
            icon: Tv,
            allowed: !isCashier && !isOwner,
          },
        ],
      },
      {
        id: 'management',
        category: 'Manajemen',
        icon: Layers,
        items: [
          {
            to: '/menu',
            label: 'Menu',
            icon: UtensilsCrossed,
            allowed: isManagerOrOwner,
          },
          {
            to: '/categories',
            label: 'Kategori Menu',
            icon: Tag,
            allowed: isManagerOrOwner,
          },
          {
            to: '/customers',
            label: 'Pelanggan',
            icon: Users,
            allowed: !isKitchenStaff,
          },
        ],
      },
      {
        id: 'inventory',
        category: 'Inventaris',
        icon: Boxes,
        items: [
          {
            to: '/inventory/suppliers',
            label: 'Pemasok',
            icon: Truck,
            allowed: isManagerOrOwner,
          },
          {
            to: '/inventory/inbound',
            label: 'Stok Masuk',
            icon: PackagePlus,
            allowed: isManagerOrOwner,
          },
          {
            to: '/inventory/sources',
            label: 'Sumber Persediaan',
            icon: Carrot,
            allowed: isManagerOrOwner,
          },
          {
            to: '/inventory/opname',
            label: 'Stok Opname',
            icon: ClipboardCheck,
            allowed: isManagerOrOwner,
          },
        ],
      },
      {
        id: 'finance',
        category: 'Buat Biaya',
        icon: Landmark,
        items: [
          {
            to: '/finance/expenses',
            label: 'Biaya Operasional',
            icon: Wallet,
            allowed: isManagerOrOwner,
          },
          {
            to: '/inventory/assets',
            label: 'Aset Tetap',
            icon: Landmark,
            allowed: isManagerOrOwner,
          },
          {
            to: '/finance/depreciation',
            label: 'Penyusutan Aset',
            icon: TrendingDown,
            allowed: isManagerOrOwner,
          },
        ],
      },
      {
        id: 'hris',
        category: 'HRIS',
        icon: CalendarClock,
        items: [
          {
            to: '/hris/dashboard',
            label: 'Dashboard HR',
            icon: LayoutDashboard,
            allowed: isManagerOrOwner,
          },
          {
            to: '/hris/staff',
            label: 'Staf & Karyawan',
            icon: UserCog,
            allowed: isManagerOrOwner,
          },
          {
            to: '/hris/attendance',
            label: 'Kehadiran',
            icon: Clock,
            allowed: true,
          },
          {
            to: '/hris/schedule',
            label: 'Jadwal Kerja',
            icon: Calendar,
            allowed: true,
          },
          {
            to: '/hris/leaves',
            label: 'Pengajuan Cuti',
            icon: CalendarOff,
            allowed: true,
          },
          {
            to: '/hris/payroll',
            label: isManagerOrOwner ? 'Payroll & Gaji' : 'Slip Gaji',
            icon: Wallet,
            allowed: true,
          },
          {
            to: '/hris/audit',
            label: 'Audit Log',
            icon: History,
            allowed: isManagerOrOwner,
          },
        ],
      },
      {
        id: 'reports',
        category: 'Laporan',
        icon: BarChart3,
        items: [
          {
            to: '/reports/sales',
            label: 'Ringkasan Penjualan',
            icon: TrendingUp,
            allowed: isManagerOrOwner,
          },
          {
            to: '/reports/products',
            label: 'Penjualan Produk',
            icon: Package,
            allowed: isManagerOrOwner,
          },
          {
            to: '/reports/categories',
            label: 'Kategori',
            icon: Tag,
            allowed: isManagerOrOwner,
          },
          {
            to: '/reports/customers',
            label: 'Pelanggan',
            icon: Users,
            allowed: isManagerOrOwner,
          },
          {
            to: '/reports/order-types',
            label: 'Tipe Pesanan',
            icon: Utensils,
            allowed: isManagerOrOwner,
          },
          {
            to: '/reports/payments',
            label: 'Metode Pembayaran',
            icon: CreditCard,
            allowed: isManagerOrOwner,
          },
          {
            to: '/reports/taxes',
            label: 'Pajak',
            icon: Receipt,
            allowed: isManagerOrOwner,
          },
          {
            to: '/reports/discounts',
            label: 'Diskon',
            icon: Percent,
            allowed: isManagerOrOwner,
          },
          {
            to: '/reports/staff',
            label: 'Pegawai',
            icon: UserCheck,
            allowed: isManagerOrOwner,
          },
          {
            to: '/reports/cash-drawer',
            label: 'Kas Kasir',
            icon: Wallet,
            allowed: isManagerOrOwner,
          },
          {
            to: '/reports/profit-loss',
            label: 'Laba Rugi',
            icon: Scale,
            allowed: isManagerOrOwner,
          },
        ],
      },
    ],
    [isKitchenStaff, isBarista, isKitchen, isCashier, isManagerOrOwner, isOwner]
  );

  // Filter sections by role
  const visibleSections = useMemo(
    () =>
      navSections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => item.allowed),
        }))
        .filter((section) => section.items.length > 0),
    [navSections]
  );

  // Accordion open/close state dictionary
  const [openSections, setOpenSections] = useState(() => {
    const initialState = {};
    visibleSections.forEach((section) => {
      const isCurrentSectionActive = section.items.some(
        (item) => location.pathname === item.to || location.pathname.startsWith(item.to + '/')
      );
      // Auto open if active route is inside, or open POS section by default
      initialState[section.id] = isCurrentSectionActive || section.id === 'POS';
    });
    return initialState;
  });

  // Keep the accordion containing the active route automatically expanded
  useEffect(() => {
    visibleSections.forEach((section) => {
      const isCurrentSectionActive = section.items.some(
        (item) => location.pathname === item.to || location.pathname.startsWith(item.to + '/')
      );
      if (isCurrentSectionActive) {
        setOpenSections((prev) => ({
          ...prev,
          [section.id]: true,
        }));
      }
    });
  }, [location.pathname, visibleSections]);

  const toggleSection = (sectionId) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  // --- Full sidebar content (Accordion Navigation) ---
  const sidebarContentFull = (
    <div className="flex flex-col justify-between h-full bg-komazi-surface select-none animate-in fade-in duration-150 overflow-hidden">
      {/* Mobile Drawer Header (Hanya tampil pada layar < 1024px) */}
      <div className="flex lg:hidden items-center justify-between px-4 py-3 border-b border-komazi-border bg-komazi-surface-2/70 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-komazi-coral/15 border border-komazi-coral/30 flex items-center justify-center text-komazi-coral font-black text-xs shadow-inner">
            K
          </div>
          <div>
            <h3 className="font-display font-bold text-xs text-komazi-text">Komazi POS</h3>
            <p className="text-[10px] text-komazi-muted">Navigasi Sistem</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(false)}
          className="p-1.5 rounded-lg text-komazi-muted hover:text-white hover:bg-komazi-surface-3 transition-colors focus-visible:ring-2 focus-visible:ring-komazi-coral focus-visible:outline-none"
          aria-label="Tutup menu navigasi"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Links Accordion */}
      <nav className="p-3 space-y-1.5 overflow-y-auto overscroll-contain flex-1">
        {/* Accordion Sections */}
        <div className="space-y-1.5">
          {visibleSections.map((section) => {
            const SectionIcon = section.icon;
            const isOpen = Boolean(openSections[section.id]);
            const hasActiveChild = section.items.some(
              (item) => location.pathname === item.to || location.pathname.startsWith(item.to + '/')
            );

            return (
              <div
                key={section.id}
                className="rounded-2xl transition-colors duration-150 overflow-hidden"
              >
                {/* Accordion Trigger Header */}
                <button
                  type="button"
                  id={`sidebar-header-${section.id}`}
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={isOpen}
                  aria-controls={`sidebar-section-${section.id}`}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-xs transition-all duration-200 select-none group focus-visible:ring-2 focus-visible:ring-komazi-coral focus-visible:outline-none ${hasActiveChild
                    ? 'bg-komazi-surface-2 text-white font-semibold border border-komazi-border/70 shadow-sm'
                    : 'text-komazi-muted hover:text-komazi-text hover:bg-komazi-surface-2/60 border border-transparent'
                    }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${hasActiveChild
                        ? 'bg-komazi-coral/15 text-komazi-coral shadow-inner'
                        : 'bg-komazi-surface text-komazi-muted group-hover:text-white group-hover:bg-komazi-surface-2'
                        }`}
                    >
                      <SectionIcon className="w-3.5 h-3.5" />
                    </div>
                    <span className="truncate tracking-wide text-xs">{section.category}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-komazi-muted transition-transform duration-200 ${isOpen ? 'rotate-180 text-komazi-coral' : 'rotate-0'
                        }`}
                    />
                  </div>
                </button>

                {/* Accordion Body (CSS Grid Smooth Height Transition) */}
                <div
                  id={`sidebar-section-${section.id}`}
                  role="region"
                  aria-labelledby={`sidebar-header-${section.id}`}
                  className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
                    }`}
                >
                  <div className="overflow-hidden">
                    <div className="ml-4 pl-3 border-l-2 border-komazi-border/60 py-1.5 space-y-1 my-1">
                      {section.items.map((item) => {
                        const ItemIcon = item.icon;
                        return (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={() => {
                              if (item.to === '/pos') {
                                setSidebarCollapsed(true);
                                setMobileSidebarOpen(false);
                              } else if (window.innerWidth < 1024) {
                                setMobileSidebarOpen(false);
                              }
                            }}
                            className={({ isActive }) =>
                              `group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 min-h-[38px] focus-visible:ring-2 focus-visible:ring-komazi-coral focus-visible:outline-none ${isActive
                                ? 'bg-komazi-coral-soft text-komazi-coral font-bold shadow-inner'
                                : 'text-komazi-muted hover:text-white hover:bg-komazi-surface-2/80'
                              }`
                            }
                          >
                            {({ isActive }) => (
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {isActive && (
                                    <span className="absolute -left-[14px] top-2 bottom-2 w-1 rounded-r-full bg-komazi-coral" />
                                  )}
                                  <ItemIcon
                                    className={`w-4 h-4 shrink-0 transition-transform duration-150 group-hover:scale-110 ${isActive
                                        ? 'text-komazi-coral'
                                        : 'text-komazi-muted group-hover:text-white'
                                      }`}
                                  />
                                  <span className="truncate">{item.label}</span>
                                </div>
                                {item.locked && (
                                  <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-1.5" />
                                )}
                              </div>
                            )}
                          </NavLink>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Standalone Settings Link (Di luar accordion, Khusus Owner) */}
          {isOwner && (
            <div className="pt-2 mt-1 border-t border-komazi-border/50">
              <NavLink
                to="/settings"
                id="sidebar-link-settings"
                onClick={() => {
                  if (window.innerWidth < 1024) {
                    setMobileSidebarOpen(false);
                  }
                }}
                className={({ isActive }) =>
                  `group relative flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 min-h-[42px] select-none focus-visible:ring-2 focus-visible:ring-komazi-coral focus-visible:outline-none ${isActive
                    ? 'bg-komazi-coral text-white font-bold shadow-sm'
                    : 'text-komazi-muted hover:text-white hover:bg-komazi-surface-2/80'
                  }`
                }
              >
                {({ isActive }) => (
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${isActive
                          ? 'bg-white/20 text-white shadow-inner'
                          : 'bg-komazi-surface text-komazi-muted group-hover:text-white group-hover:bg-komazi-surface-2'
                        }`}
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </div>
                    <span className="truncate tracking-wide text-xs">Pengaturan</span>
                  </div>
                )}
              </NavLink>
            </div>
          )}

          {/* Marketing Studio CMS Link (Khusus Browser Web, DILARANG/SEMBUNYI jika diinstal di aplikasi) */}
          {isManagerOrOwner && !isInstalledApp && (
            <div className={isOwner ? 'pt-1.5' : 'pt-2 mt-1 border-t border-komazi-border/50'}>
              <NavLink
                to="/cms"
                id="sidebar-link-cms"
                onClick={() => {
                  if (window.innerWidth < 1024) {
                    setMobileSidebarOpen(false);
                  }
                }}
                className={({ isActive }) =>
                  `group relative flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 min-h-[42px] select-none focus-visible:ring-2 focus-visible:ring-komazi-coral focus-visible:outline-none ${isActive
                    ? 'bg-gradient-to-r from-komazi-coral to-[#ff7368] text-white font-bold shadow-sm shadow-komazi-coral/30'
                    : 'text-komazi-muted hover:text-white hover:bg-komazi-surface-2/80'
                  }`
                }
              >
                {({ isActive }) => (
                  <div className="flex items-center justify-between w-full min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${isActive
                            ? 'bg-white/25 text-white shadow-inner'
                            : 'bg-komazi-surface text-komazi-coral group-hover:text-white group-hover:bg-komazi-surface-2'
                          }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <span className="truncate tracking-wide text-xs">Studio CMS</span>
                    </div>
                    <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-komazi-coral/15 text-komazi-coral border border-komazi-coral/30 group-hover:border-komazi-coral/50">
                      Web
                    </span>
                  </div>
                )}
              </NavLink>
            </div>
          )}
        </div>
      </nav>

      {/* User Status and Quick Logout Card */}
      <div className="p-3 border-t border-komazi-border bg-komazi-surface shrink-0">
        {/* Printer Button (All role kecuali BARISTA, KITCHEN, dan OWNER) */}
        {!isKitchenStaff && !isOwner && (
          <button
            type="button"
            onClick={connectionType === 'USB' ? openUsbModal : openBluetoothModal}
            title={
              btConnected
                ? `Printer ${connectionType === 'USB' ? 'USB' : 'Bluetooth'} Terhubung: ${connectedDeviceName || 'Thermal'}`
                : `Hubungkan Printer (${connectionType === 'USB' ? 'USB' : 'Bluetooth'})`
            }
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all mb-2 focus-visible:ring-2 focus-visible:ring-komazi-coral focus-visible:outline-none ${btConnected
              ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20'
              : 'text-komazi-muted hover:text-komazi-coral hover:bg-komazi-surface-2 border border-transparent hover:border-komazi-coral/25'
              }`}
          >
            {btConnected ? (
              connectionType === 'USB' ? (
                <Usb className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <BluetoothConnected className="w-4 h-4 shrink-0" />
              )
            ) : connectionType === 'USB' ? (
              <Usb className="w-4 h-4 shrink-0" />
            ) : (
              <Bluetooth className="w-4 h-4 shrink-0" />
            )}
            <span className="truncate">
              {btConnected
                ? `${connectionType === 'USB' ? 'USB' : 'Printer'} Terhubung`
                : connectionType === 'USB'
                ? 'Hubungkan USB'
                : 'Hubungkan Printer'}
            </span>
          </button>
        )}

        <div className="p-2.5 rounded-2xl bg-komazi-surface-2 border border-komazi-border flex items-center justify-between gap-2">
          {/* Clickable Profile Trigger */}
          <button
            type="button"
            onClick={() => setIsProfileModalOpen(true)}
            title="Klik untuk Edit Profil & Foto"
            className="flex items-center gap-2.5 overflow-hidden text-left flex-1 group p-1 -m-1 rounded-xl hover:bg-komazi-surface transition-colors focus-visible:ring-2 focus-visible:ring-komazi-coral focus-visible:outline-none"
          >
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user?.name}
                className="w-9 h-9 rounded-xl object-cover border border-komazi-border shrink-0 shadow-sm"
              />
            ) : isKitchen ? (
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold shrink-0">
                <ChefHat className="w-4 h-4" />
              </div>
            ) : isBarista ? (
              <div className="w-9 h-9 rounded-xl bg-komazi-teal/15 border border-komazi-teal/30 flex items-center justify-center text-komazi-teal-light font-bold shrink-0">
                <Coffee className="w-4 h-4" />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-komazi-coral/15 border border-komazi-coral/30 flex items-center justify-center text-komazi-coral font-bold shrink-0">
                <Shield className="w-4 h-4" />
              </div>
            )}
            <div className="overflow-hidden flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-xs font-bold text-komazi-text truncate group-hover:text-komazi-coral transition-colors">
                  {user?.name || (isKitchen ? 'Staf Dapur' : isBarista ? 'Barista' : 'Kasir')}
                </p>
                <UserCog className="w-3 h-3 text-komazi-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
              <span
                className={`inline-block text-[10px] font-semibold uppercase ${isKitchen
                  ? 'text-amber-400'
                  : isBarista
                    ? 'text-komazi-teal-light'
                    : 'text-komazi-teal-light'
                  }`}
              >
                {isKitchen ? 'Dapur (Kitchen)' : isBarista ? 'Barista (Bar)' : user?.role}
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Desktop fixed sidebar (hanya aktif ketika di-pin / tidak collapsed) */}
      <aside
        className={`hidden lg:flex border-r border-komazi-border bg-komazi-surface flex-col shrink-0 h-[calc(100dvh-4rem)] transition-all duration-300 ease-in-out relative ${isSidebarCollapsed ? 'w-0 border-r-0 overflow-hidden opacity-0 pointer-events-none' : 'w-64'
          }`}
      >
        {!isSidebarCollapsed && sidebarContentFull}
      </aside>

      {/* 2. Slide-in Navigation Drawer (Only for mobile screens < 1024px) */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileSidebarOpen(false)}
          />

          {/* Drawer content */}
          <aside className="relative w-72 max-w-[85vw] h-full shadow-2xl border-r border-komazi-border z-10 animate-in slide-in-from-left duration-200">
            {sidebarContentFull}
          </aside>
        </div>
      )}

      {/* Edit Profile Modal */}
      {isProfileModalOpen && <EditProfileModal onClose={() => setIsProfileModalOpen(false)} />}
    </>
  );
}
