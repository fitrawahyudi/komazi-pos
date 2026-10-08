import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useShiftStore } from '../../store/shiftStore';
import { useStockStore } from '../../store/stockStore';
import { useCartStore } from '../../store/cartStore';
import { useUiStore } from '../../store/uiStore';
import KomaziLogo from '../ui/KomaziLogo';
import {
  Clock,
  AlertTriangle,
  UserCheck,
  Maximize2,
  Minimize2,
  CircleDot,
  FileText,
  Menu,
  Bluetooth,
  BluetoothConnected,
  Sparkles,
} from 'lucide-react';
import ShiftModal from '../shift/ShiftModal';
import OpenBillsModal from '../pos/OpenBillsModal';
import AiSalesAssistantModal from '../analytics/AiSalesAssistantModal';
import { useAiAnalyticsStore } from '../../store/aiAnalyticsStore';
import { usePrinterStore } from '../../store/printerStore';

export default function Navbar() {
  const { user } = useAuthStore();
  const { activeShift } = useShiftStore();
  const { getLowStockItems } = useStockStore();
  const { openBills, syncOpenBillsWithBackendOrders } = useCartStore();
  const { toggleMobileSidebar, openBluetoothModal } = useUiStore();
  const { openAssistant } = useAiAnalyticsStore();
  const { isConnected: btConnected, connectedDeviceName } = usePrinterStore();
  const isKitchen = user?.role === 'KITCHEN';
  const isBarista = user?.role === 'BARISTA';
  const isKitchenStaff = isKitchen || isBarista;

  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isOpenBillsModalOpen, setIsOpenBillsModalOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof syncOpenBillsWithBackendOrders === 'function') {
      syncOpenBillsWithBackendOrders();
    }
  }, [syncOpenBillsWithBackendOrders]);

  const lowStockItems = getLowStockItems();

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

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
          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={toggleMobileSidebar}
            className="lg:hidden p-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-komazi-muted hover:text-white"
            title="Buka menu navigasi"
          >
            <Menu className="w-5 h-5" />
          </button>

          <KomaziLogo size="sm" className="sm:hidden" />
          <KomaziLogo size="md" className="hidden sm:flex" />

          {/* Open Bills Badge (Hanya tampil di Desktop/Tablet) */}
          {!isKitchen && openBills.length > 0 && (
            <button
              type="button"
              onClick={() => setIsOpenBillsModalOpen(true)}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-komazi-coral-soft border border-komazi-coral/30 text-komazi-coral text-xs font-semibold hover:bg-komazi-coral/25 transition-colors animate-pulse shrink-0"
              title="Daftar Pesanan Tertahan (Hold Bill)"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>{openBills.length} Bill</span>
            </button>
          )}
        </div>

        {/* Right: Info Badges, Shift, Clock & Role Switcher */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Low Stock Warning Indicator */}
          {lowStockItems.length > 0 && (
            <div
              title={`${lowStockItems.length} bahan menipis di bawah stok minimum`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-warning/15 border border-warning/30 text-warning text-xs font-medium cursor-pointer hover:bg-warning/25 transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
              <span className="hidden md:inline font-semibold">Stok Kritis:</span>
              <span className="bg-warning text-black text-[10px] font-bold px-1.5 rounded-full">
                {lowStockItems.length}
              </span>
            </div>
          )}

          {/* Shift Status Button (Hanya untuk Kasir, Manager, dan Owner - Staf Dapur tidak mengelola kasir) */}
          {!isKitchen && (
            <button
              onClick={() => setIsShiftModalOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                activeShift
                  ? 'bg-success/10 border-success/30 text-success hover:bg-success/20'
                  : 'bg-danger/10 border-danger/30 text-danger hover:bg-danger/20'
              }`}
            >
              <CircleDot
                className={`w-3 h-3 ${activeShift ? 'text-success animate-pulse' : 'text-danger'}`}
              />
              <span className="hidden sm:inline font-semibold">
                {activeShift ? 'Shift Aktif' : 'Tutup'}
              </span>
            </button>
          )}

          {/* Live Clock WIB */}
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-muted">
            <Clock className="w-3.5 h-3.5 text-komazi-teal-light" />
            <span className="text-komazi-text font-medium">{formattedDate}</span>
            <span className="text-komazi-coral font-mono font-bold tabular-nums">
              {formattedTime} WIB
            </span>
          </div>

          {/* AI Sales Analytics Assistant Shortcut (Kecuali Dapur) */}
          {!isKitchen && (
            <button
              type="button"
              onClick={() => openAssistant()}
              title="Tanya Komazi AI Analitik Penjualan"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-komazi-primary/10 hover:bg-komazi-primary/20 border border-komazi-primary/30 text-komazi-primary text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-komazi-primary animate-pulse" />
              <span className="hidden md:inline font-bold">Komazi AI</span>
            </button>
          )}

          {/* Bluetooth Printer Button (Semua role kecuali Barista & Dapur) */}
          {!isKitchenStaff && (
            <button
              onClick={openBluetoothModal}
              title={btConnected ? `Printer Bluetooth Terhubung: ${connectedDeviceName || 'Thermal'}` : 'Hubungkan Printer Bluetooth'}
              className={`hidden sm:flex items-center gap-1.5 p-2 rounded-xl border transition-all duration-200 ${
                btConnected
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20'
                  : 'bg-komazi-surface-2 border-komazi-border text-komazi-muted hover:text-blue-400 hover:border-blue-500/40'
              }`}
            >
              {btConnected ? (
                <BluetoothConnected className="w-4 h-4" />
              ) : (
                <Bluetooth className="w-4 h-4" />
              )}
            </button>
          )}

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            title="Mode Layar Penuh"
            className="hidden sm:flex p-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-komazi-muted hover:text-komazi-text hover:border-komazi-muted/40 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Shift Modal */}
      {isShiftModalOpen && <ShiftModal onClose={() => setIsShiftModalOpen(false)} />}

      {/* Open Bills Modal */}
      {isOpenBillsModalOpen && <OpenBillsModal onClose={() => setIsOpenBillsModalOpen(false)} />}

      {/* AI Sales Analytics Assistant Modal */}
      <AiSalesAssistantModal />
    </>
  );
}
