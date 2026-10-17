import React, { useEffect } from 'react';
import { Wifi, WifiOff, Printer, RefreshCw } from 'lucide-react';
import { usePrinterStore } from '../../../store/printerStore';
import { useServerStatusStore } from '../../../store/serverStatusStore';

/**
 * SyncStatusBadge
 * Real-time pill badge displaying live synchronization status with the
 * backend server (Node.js REST API & Socket.IO WebSocket) and Bluetooth printer.
 */
export default function SyncStatusBadge({ className = '' }) {
  const { isConnected: isPrinterConnected, isConnecting: isPrinterConnecting } = usePrinterStore();
  const {
    status: serverStatus,
    latency,
    reconnect,
    isChecking,
    initServerMonitor,
  } = useServerStatusStore();

  useEffect(() => {
    // Start continuous server health monitor & socket listener
    const cleanup = initServerMonitor();
    return () => {
      cleanup?.();
    };
  }, [initServerMonitor]);

  const isFullyConnected = serverStatus === 'CONNECTED';
  const isConnecting = serverStatus === 'CONNECTING' || isChecking;

  const handleServerPillClick = () => {
    reconnect();
  };

  return (
    <div className={`inline-flex items-center gap-1.5 sm:gap-2 select-none text-[11px] font-semibold ${className}`}>
      {/* 1. Server & Realtime Socket Sync Pill (Clickable to Re-test Connection) */}
      <button
        type="button"
        onClick={handleServerPillClick}
        disabled={isChecking}
        className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full border transition-all cursor-pointer hover:brightness-110 active:scale-95 ${
          isFullyConnected
            ? 'bg-success/10 border-success/30 text-success hover:bg-success/15'
            : isConnecting
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/15'
              : 'bg-danger/10 border-danger/30 text-danger animate-pulse hover:bg-danger/15'
        }`}
        title={
          isFullyConnected
            ? 'Sistem Online & Terkoneksi'
            : isConnecting
              ? 'Menghubungkan ke sistem... Klik untuk mencoba lagi.'
              : 'Sistem sedang Offline. Klik untuk mencoba menghubungkan kembali.'
        }
      >
        {isFullyConnected ? (
          <>
            <Wifi className="w-3 h-3 text-success shrink-0" />
            <span className="hidden xl:inline text-[10px] font-medium opacity-90">
              Online
            </span>
          </>
        ) : isConnecting ? (
          <>
            <RefreshCw className="w-3 h-3 animate-spin text-amber-300 shrink-0" />
            <span className="hidden xl:inline text-[10px] font-medium opacity-90">
              Menyambung
            </span>
          </>
        ) : (
          <>
            <WifiOff className="w-3 h-3 text-danger shrink-0" />
            <span className="hidden xl:inline text-[10px] font-medium opacity-90">
              Offline
            </span>
          </>
        )}
      </button>

      {/* 2. Bluetooth Printer Status Pill (Clickable to Manage / Connect Printer) */}
      <button
        type="button"
        onClick={() => {
          try {
            const { openBluetoothModal } = usePrinterStore.getState();
            if (typeof openBluetoothModal === 'function') {
              openBluetoothModal();
            } else {
              // fallback to uiStore
              import('../../../store/uiStore').then(({ useUiStore }) => {
                useUiStore.getState().openBluetoothModal();
              });
            }
          } catch {
            import('../../../store/uiStore').then(({ useUiStore }) => {
              useUiStore.getState().openBluetoothModal();
            });
          }
        }}
        className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full border transition-all cursor-pointer active:scale-95 ${
          isPrinterConnecting
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            : isPrinterConnected
              ? 'bg-komazi-teal/15 border-komazi-teal/30 text-komazi-teal-light hover:bg-komazi-teal/25'
              : 'bg-komazi-surface border-komazi-border text-komazi-muted hover:text-white hover:border-komazi-coral/40'
        }`}
        title={
          isPrinterConnecting
            ? 'Menyambungkan ke Printer Bluetooth... Klik untuk kelola'
            : isPrinterConnected
              ? 'Printer Thermal Bluetooth Aktif (Klik untuk kelola)'
              : 'Printer Bluetooth Belum Terhubung (Klik untuk menghubungkan)'
        }
      >
        {isPrinterConnecting ? (
          <>
            <RefreshCw className="w-3 h-3 animate-spin text-amber-300 shrink-0" />
            <span className="hidden sm:inline">Menyambung...</span>
          </>
        ) : isPrinterConnected ? (
          <>
            <Printer className="w-3 h-3 text-komazi-teal-light shrink-0" />
            <span className="hidden sm:inline">Printer Ready</span>
          </>
        ) : (
          <>
            <Printer className="w-3 h-3 opacity-60 shrink-0" />
            <span className="hidden md:inline text-komazi-muted/70">Printer Standby</span>
          </>
        )}
      </button>
    </div>
  );
}
