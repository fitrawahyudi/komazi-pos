import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useShiftStore } from '../../store/shiftStore';
import { useStockStore } from '../../store/stockStore';
import { useUiStore } from '../../store/uiStore';
import KomaziLogo from '../ui/KomaziLogo';
import {
  Clock,
  AlertTriangle,
  Menu,
  Sparkles,
  Bell,
  X,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import ShiftModal from '../shift/ShiftModal';
import AiSalesAssistantModal from '../analytics/AiSalesAssistantModal';
import { useAiAnalyticsStore } from '../../store/aiAnalyticsStore';
import SyncStatusBadge from '../ui/loading/SyncStatusBadge';
import AndroidNotificationCard from '../settings/AndroidNotificationCard';
import NotificationBellButton from '../notifications/NotificationBellButton';
import NotificationCenterModal from '../notifications/NotificationCenterModal';

export default function Navbar() {
  const { user } = useAuthStore();
  const { activeShift } = useShiftStore();
  const { getLowStockItems } = useStockStore();
  const {
    toggleMobileSidebar,
    toggleSidebarCollapsed,
  } = useUiStore();
  const { openAssistant } = useAiAnalyticsStore();
  const isKitchen = user?.role === 'KITCHEN';

  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        Boolean(
          document.fullscreenElement ||
          document.webkitFullscreenElement ||
          document.mozFullScreenElement ||
          document.msFullscreenElement
        )
      );
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (
        !document.fullscreenElement &&
        !document.webkitFullscreenElement &&
        !document.mozFullScreenElement &&
        !document.msFullscreenElement
      ) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
          await document.documentElement.webkitRequestFullscreen();
        } else if (document.documentElement.mozRequestFullScreen) {
          await document.documentElement.mozRequestFullScreen();
        } else if (document.documentElement.msRequestFullscreen) {
          await document.documentElement.msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          await document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Gagal mengubah mode layar penuh:', err);
    }
  };

  const lowStockItems = getLowStockItems();

  const formattedTime = currentTime.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const formattedDate = currentTime.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <>
      <header className="h-16 border-b border-komazi-border bg-komazi-surface/90 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between z-30 select-none">
        {/* Left: Mobile Toggle & Brand Logo */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Menu toggle button (Desktop & Mobile) */}
          <button
            type="button"
            onClick={() => {
              if (window.innerWidth < 1024) {
                toggleMobileSidebar();
              } else {
                toggleSidebarCollapsed();
              }
            }}
            className="p-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-komazi-muted hover:text-white hover:border-komazi-coral/40 transition-all shadow-sm active:scale-95 flex items-center justify-center shrink-0"
            title="Menu navigasi (Ctrl+B)"
            aria-label="Menu navigasi"
          >
            <Menu className="w-5 h-5" />
          </button>

          <KomaziLogo size="sm" className="sm:hidden" />
          <KomaziLogo size="md" className="hidden sm:flex" />
        </div>

        {/* Right: Operational Status Cluster & Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Low Stock Warning Indicator */}
          {lowStockItems.length > 0 && (
            <div
              title={`${lowStockItems.length} bahan menipis di bawah stok minimum`}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-warning/15 border border-warning/30 text-warning text-xs font-medium cursor-pointer hover:bg-warning/25 transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
              <span className="hidden md:inline font-semibold">Stok Kritis:</span>
              <span className="bg-warning text-black text-[10px] font-bold px-1.5 rounded-full">
                {lowStockItems.length}
              </span>
            </div>
          )}

          {/* Real-time Server Sync & Bluetooth Printer Status */}
          <SyncStatusBadge className="inline-flex" />

          {/* Shift & Kasir Status Pill (Exact match with screen.png: [dot KASIR]) */}
          {!isKitchen && (
            <button
              type="button"
              onClick={() => setIsShiftModalOpen(true)}
              title={
                activeShift
                  ? `Sesi Kasir Aktif (${activeShift.cashierName || 'Kasir'}) — Klik untuk kelola / tutup shift`
                  : 'Sesi Kasir Ditutup — Klik untuk buka shift'
              }
              aria-label={activeShift ? 'Sesi Kasir Aktif' : 'Sesi Kasir Ditutup'}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold transition-all active:scale-95 ${activeShift
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 shadow-sm'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                }`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${activeShift
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)] animate-pulse'
                    : 'bg-rose-500'
                  }`}
              />
              <span className="text-[11px] font-bold tracking-wider">
                {activeShift ? 'KASIR' : 'SHIFT TUTUP'}
              </span>
            </button>
          )}

          {/* Live Clock WIB (Desktop only) */}
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-muted">
            <Clock className="w-3.5 h-3.5 text-komazi-teal-light" />
            <span className="text-komazi-text font-medium">{formattedDate}</span>
            <span className="text-komazi-coral font-mono font-bold tabular-nums">
              {formattedTime} WIB
            </span>
          </div>

          {/* In-App & Android Notification Bell Button */}
          {/* <NotificationBellButton /> */}

          {/* AI Sales Analytics Assistant Shortcut (Kecuali Dapur) */}
          {!isKitchen && (
            <button
              type="button"
              onClick={() => openAssistant()}
              title="Tanya Komazi AI Analitik Penjualan"
              aria-label="Tanya Komazi AI"
              className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl bg-komazi-primary/10 hover:bg-komazi-primary/20 border border-komazi-primary/30 text-komazi-primary text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-2xs flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-komazi-primary animate-pulse" />
              <span className="hidden md:inline font-bold">Komazi AI</span>
            </button>
          )}

          {/* Fullscreen Toggle Button (Hidden on Mobile) */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Keluar dari Layar Penuh (Esc)' : 'Mode Layar Penuh / Fullscreen (F11)'}
            aria-label={isFullscreen ? 'Keluar Layar Penuh' : 'Mode Layar Penuh'}
            className={`hidden sm:flex p-2 rounded-xl border transition-all active:scale-95 items-center justify-center shrink-0 shadow-sm ${isFullscreen
                ? 'bg-komazi-coral/15 border-komazi-coral/40 text-komazi-coral hover:bg-komazi-coral/25'
                : 'bg-komazi-surface-2 border-komazi-border text-komazi-muted hover:text-white hover:border-komazi-border-bright hover:bg-komazi-surface-3'
              }`}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-komazi-coral" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </header>

      {/* Shift Modal */}
      {isShiftModalOpen && <ShiftModal onClose={() => setIsShiftModalOpen(false)} />}

      {/* AI Sales Analytics Assistant Modal */}
      <AiSalesAssistantModal />

      {/* In-App & Push Notification Center Modal */}
      <NotificationCenterModal />

      {/* Quick Notification Settings Modal for All Roles */}
      {isNotificationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-xl bg-komazi-surface border border-komazi-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-komazi-border flex items-center justify-between bg-komazi-surface-2/60 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-komazi-coral/15 text-komazi-coral flex items-center justify-center font-bold">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-komazi-text">Notifikasi &amp; Suara Perangkat</h3>
                  <p className="text-[10px] text-komazi-muted">Kelola notifikasi Android &amp; nada dering untuk akun @{user?.username || 'user'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNotificationModalOpen(false)}
                className="p-1.5 rounded-xl text-komazi-muted hover:text-white hover:bg-komazi-surface-3 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-4">
              <AndroidNotificationCard />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
