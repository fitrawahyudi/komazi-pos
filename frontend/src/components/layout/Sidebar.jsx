import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
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
  Coffee,
} from 'lucide-react';
import EditProfileModal from '../profile/EditProfileModal';
import KomaziLogo from '../ui/KomaziLogo';
import { usePrinterStore } from '../../store/printerStore';

export default function Sidebar() {
  const { user } = useAuthStore();
  const {
    isMobileSidebarOpen,
    setMobileSidebarOpen,
    isSidebarCollapsed,
    toggleSidebarCollapsed,
    openBluetoothModal,
  } = useUiStore();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const { isConnected: isPrinterConnected, connectedDeviceName } = usePrinterStore();

  const role = user?.role || 'CASHIER';
  const isKitchen = role === 'KITCHEN';
  const isBarista = role === 'BARISTA';
  const isKitchenStaff = isKitchen || isBarista;
  const isManagerOrOwner = role === 'MANAGER' || role === 'OWNER';
  const isOwner = role === 'OWNER';

  const btConnected = isPrinterConnected;

  const navSections = [
    {
      category: 'Operasional',
      items: [
        {
          to: '/pos',
          label: 'Kasir',
          icon: Store,
          allowed: !isKitchenStaff,
        },
        {
          to: '/orders',
          label: 'Riwayat Pesanan',
          icon: Receipt,
          allowed: !isKitchenStaff,
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
      category: 'Kitchen & Display',
      items: [
        {
          to: '/kds',
          label: isBarista ? 'Barista KDS' : isKitchen ? 'Dapur KDS' : 'Kitchen & Bar (KDS)',
          icon: isBarista ? Coffee : ChefHat,
          allowed: true,
        },
        {
          to: '/kds-screen',
          label: 'Monitor Layar TV (KDS)',
          icon: Tv,
          allowed: true,
        },
      ],
    },
    {
      category: 'Produk & Inventori',
      items: [
        {
          to: '/menu',
          label: 'Menu & Produk',
          icon: UtensilsCrossed,
          allowed: isManagerOrOwner,
        },
        {
          to: '/stock',
          label: 'Stok Bahan',
          icon: Boxes,
          allowed: isManagerOrOwner,
        },
      ],
    },
    {
      category: 'Laporan & Pengaturan',
      items: [
        {
          to: '/reports',
          label: 'Laporan & Omzet',
          icon: BarChart3,
          allowed: isManagerOrOwner,
        },
        {
          to: '/settings',
          label: 'Pengaturan',
          icon: Settings,
          allowed: isOwner,
        },
      ],
    },
  ];

  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.allowed),
    }))
    .filter((section) => section.items.length > 0);

  // --- Full sidebar content (for expanded desktop & mobile drawer) ---
  const sidebarContentFull = (
    <div className="flex flex-col justify-between h-full bg-komazi-surface select-none">
      {/* Navigation Links */}
      <nav className="p-3 space-y-2 overflow-y-auto">
        <div className="flex items-center justify-between px-3 py-2 border-b border-komazi-border/40 mb-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-komazi-muted">
              Menu Navigasi
            </span>
          </div>
          {/* Close button on mobile */}
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            className="lg:hidden p-1 rounded-lg text-komazi-muted hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {visibleSections.map((section, idx) => (
          <div key={section.category} className={idx > 0 ? 'pt-2' : ''}>
            <div className="px-3 pb-1.5 flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-komazi-muted/70">
                {section.category}
              </span>
              <div className="h-px bg-komazi-border/40 flex-1" />
            </div>

            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileSidebarOpen(false)}
                    className={({ isActive }) =>
                      `group relative flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 min-h-[42px] ${isActive
                        ? 'bg-komazi-coral-soft text-komazi-coral font-semibold shadow-inner'
                        : 'text-komazi-muted hover:text-komazi-text hover:bg-komazi-surface-2'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <div className="flex items-center gap-3">
                        {/* Active indicator vertical bar */}
                        {isActive && (
                          <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-komazi-coral" />
                        )}
                        <Icon
                          className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-komazi-coral' : 'text-komazi-muted group-hover:text-komazi-text'
                            }`}
                        />
                        <span>{item.label}</span>
                      </div>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User Status and Quick Logout Card */}
      <div className="p-3 border-t border-komazi-border bg-komazi-surface">
        {/* Bluetooth Printer Button (All role kecuali BARISTA dan KITCHEN) */}
        {!isKitchenStaff && (
          <button
            type="button"
            onClick={openBluetoothModal}
            title={btConnected ? `Printer Bluetooth Terhubung: ${connectedDeviceName || 'Thermal'}` : 'Hubungkan Printer Bluetooth'}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all mb-2 ${btConnected
              ? 'bg-blue-500/10 border border-blue-500/25 text-blue-400 hover:bg-blue-500/20'
              : 'text-komazi-muted hover:text-blue-400 hover:bg-komazi-surface-2 border border-transparent hover:border-blue-500/25'
              }`}
          >
            {btConnected ? (
              <BluetoothConnected className="w-4 h-4 shrink-0" />
            ) : (
              <Bluetooth className="w-4 h-4 shrink-0" />
            )}
            <span className="truncate">
              {btConnected ? 'Printer Terhubung' : 'Hubungkan Printer'}
            </span>
          </button>
        )}
        <div className="p-2.5 rounded-2xl bg-komazi-surface-2 border border-komazi-border flex items-center justify-between gap-2">
          {/* Clickable Profile Trigger */}
          <button
            type="button"
            onClick={() => setIsProfileModalOpen(true)}
            title="Klik untuk Edit Profil & Foto"
            className="flex items-center gap-2.5 overflow-hidden text-left flex-1 group p-1 -m-1 rounded-xl hover:bg-komazi-surface transition-colors"
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

  // --- Collapsed sidebar content (icons only, desktop) ---
  const sidebarContentCollapsed = (
    <div className="flex flex-col justify-between h-full bg-komazi-surface select-none">
      <nav className="p-2 space-y-2 overflow-y-auto">
        {/* Brand emblem at top of collapsed bar */}
        <div className="h-9 flex items-center justify-center border-b border-komazi-border/40 pb-2 mb-1">
          <KomaziLogo size="xs" variant="icon" />
        </div>

        {visibleSections.map((section, idx) => (
          <div key={section.category} className="space-y-1">
            {idx > 0 && <div className="border-t border-komazi-border/40 my-2 mx-1" />}
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `group relative flex items-center justify-center p-3 rounded-xl transition-all duration-200 min-h-[44px] ${isActive
                      ? 'bg-komazi-coral-soft text-komazi-coral shadow-inner'
                      : 'text-komazi-muted hover:text-komazi-text hover:bg-komazi-surface-2'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-komazi-coral" />
                      )}
                      <Icon
                        className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-komazi-coral' : 'text-komazi-muted group-hover:text-komazi-text'
                          }`}
                      />
                      {/* Tooltip with Category & Label */}
                      <div className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-komazi-surface-2 text-komazi-text text-xs whitespace-nowrap border border-komazi-border shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50">
                        <span className="block text-[9px] uppercase tracking-wider text-komazi-muted font-bold">
                          {section.category}
                        </span>
                        <span className="font-semibold text-white">{item.label}</span>
                      </div>
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Collapsed user section */}
      <div className="p-2 border-t border-komazi-border bg-komazi-surface space-y-1">
        <button
          type="button"
          onClick={() => setIsProfileModalOpen(true)}
          title={user?.name || 'Edit Profil'}
          className="group relative w-full flex items-center justify-center p-2 rounded-xl hover:bg-komazi-surface-2 transition-colors"
        >
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user?.name}
              className="w-8 h-8 rounded-xl object-cover border border-komazi-border shadow-sm"
            />
          ) : isKitchen ? (
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ChefHat className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-komazi-coral/15 border border-komazi-coral/30 flex items-center justify-center text-komazi-coral">
              <Shield className="w-4 h-4" />
            </div>
          )}
          {/* Tooltip */}
          <span className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-komazi-surface-2 text-komazi-text text-xs font-medium whitespace-nowrap border border-komazi-border shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50">
            {user?.name || 'Profil'}
          </span>
        </button>

        {/* Bluetooth icon button (collapsed, all role kecuali BARISTA dan KITCHEN) */}
        {!isKitchenStaff && (
          <button
            type="button"
            onClick={openBluetoothModal}
            title={btConnected ? `Printer Bluetooth Terhubung: ${connectedDeviceName || 'Thermal'}` : 'Hubungkan Printer Bluetooth'}
            className={`group relative w-full flex items-center justify-center p-2 rounded-xl transition-colors ${btConnected
              ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
              : 'text-komazi-muted hover:text-blue-400 hover:bg-komazi-surface-2'
              }`}
          >
            {btConnected ? (
              <BluetoothConnected className="w-4 h-4" />
            ) : (
              <Bluetooth className="w-4 h-4" />
            )}
            <span className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-komazi-surface-2 text-komazi-text text-xs font-medium whitespace-nowrap border border-komazi-border shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50">
              {btConnected ? 'Printer Terhubung' : 'Hubungkan Printer'}
            </span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Desktop fixed sidebar */}
      <aside
        className={`hidden lg:flex border-r border-komazi-border bg-komazi-surface flex-col shrink-0 h-[calc(100vh-4rem)] transition-all duration-300 ease-in-out relative ${isSidebarCollapsed ? 'w-[68px]' : 'w-64'
          }`}
      >
        {/* Toggle collapse button */}
        <button
          type="button"
          onClick={toggleSidebarCollapsed}
          title={isSidebarCollapsed ? 'Lebarkan Sidebar' : 'Ciutkan Sidebar'}
          className="absolute -right-3.5 top-4 z-20 w-7 h-7 rounded-full bg-komazi-surface-2 border border-komazi-border text-komazi-muted hover:text-komazi-coral hover:border-komazi-coral/50 hover:bg-komazi-coral/10 flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-komazi-coral/20"
        >
          {isSidebarCollapsed ? (
            <PanelLeftOpen className="w-3.5 h-3.5" />
          ) : (
            <PanelLeftClose className="w-3.5 h-3.5" />
          )}
        </button>

        {isSidebarCollapsed ? sidebarContentCollapsed : sidebarContentFull}
      </aside>

      {/* 2. Mobile/Tablet Slide-in Drawer (always full width) */}
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
