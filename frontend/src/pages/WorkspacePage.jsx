import React, { useState, useEffect, useMemo } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useOrdersStore } from '../store/ordersStore';
import { useShiftStore } from '../store/shiftStore';
import { useAuthStore } from '../store/authStore';
import WorkspaceCard from '../components/workspace/WorkspaceCard';
import CheckInModal from '../components/workspace/CheckInModal';
import CheckOutModal from '../components/workspace/CheckOutModal';
import ThermalReceiptModal from '../components/pos/ThermalReceiptModal';
import Pagination from '../components/ui/Pagination';
import { formatRupiah } from '../utils/format';
import {
  Laptop,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Sparkles,
  Zap,
} from 'lucide-react';

export default function WorkspacePage() {
  const { areas, packages, sessions, fetchWorkspaceData } = useWorkspaceStore();
  const { createOrder } = useOrdersStore();
  const { recordSaleToShift } = useShiftStore();
  const { user } = useAuthStore();

  const [activeCheckInArea, setActiveCheckInArea] = useState(null);
  const [activeCheckOutSession, setActiveCheckOutSession] = useState(null);
  const [receiptOrder, setReceiptOrder] = useState(null);

  useEffect(() => {
    fetchWorkspaceData();
  }, [fetchWorkspaceData]);

  // Pagination for Workspace Areas
  const [areaPage, setAreaPage] = useState(1);
  const [areasPerPage, setAreasPerPage] = usePersistentState('workspace_areasPerPage', 10);

  const paginatedAreas = useMemo(() => {
    const start = (areaPage - 1) * areasPerPage;
    return areas.slice(start, start + areasPerPage);
  }, [areas, areaPage, areasPerPage]);

  // Compute metrics
  const totalAreas = areas.length;
  const occupiedCount = sessions.length;
  const availableCount = Math.max(0, totalAreas - occupiedCount);

  // Overtime sessions check
  const overtimeCount = sessions.filter((s) => {
    const elapsed = Math.floor((Date.now() - new Date(s.checkInAt).getTime()) / 60000);
    return elapsed > (s.targetDurationMin || 60);
  }).length;

  const handleDirectPay = async (completedSession) => {
    const charge = Number(completedSession.charge) || 0;
    // Generate order for direct workspace payment
    const orderPayload = {
      cashierId: user?.id || 1,
      cashierName: user?.name || 'Kasir',
      type: 'DINE_IN',
      tableNo: completedSession.areaName || completedSession.area?.name || 'Meja Workspace',
      customerName: completedSession.customerName || 'Pelanggan',
      items: [],
      workspaceSessionId: completedSession.id,
      workspaceSession: completedSession,
      subtotal: charge,
      discount: 0,
      serviceFee: 0,
      tax: 0,
      total: charge,
      payments: [
        {
          method: 'CASH',
          amount: charge,
          tendered: charge,
          change: 0,
        },
      ],
    };

    const newOrder = await createOrder(orderPayload);
    recordSaleToShift('CASH', charge);
    setReceiptOrder(newOrder);
    fetchWorkspaceData();
  };

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-6 space-y-6 max-w-7xl mx-auto select-none">
      {/* 1. Header & Quick Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-black text-2xl text-komazi-text flex items-center gap-2">
            <span>Manajemen Workspace</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-komazi-coral-soft text-komazi-coral border border-komazi-coral/30">
              Live Monitor
            </span>
          </h1>
          <p className="text-xs text-komazi-muted mt-0.5">
            Pantau okupansi meja kerja, countdown timer pelanggan, dan tagihan overtime secara real-time.
          </p>
        </div>

        {/* Quick Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="px-3.5 py-2 rounded-xl bg-komazi-surface border border-komazi-border">
            <span className="text-[10px] text-komazi-muted uppercase font-semibold">Total Area</span>
            <p className="font-mono font-bold text-lg text-komazi-text">{totalAreas}</p>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-komazi-surface border border-success/30 bg-success/5">
            <span className="text-[10px] text-success uppercase font-semibold">Tersedia</span>
            <p className="font-mono font-bold text-lg text-success">{availableCount}</p>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-komazi-surface border border-komazi-coral/30 bg-komazi-coral/5">
            <span className="text-[10px] text-komazi-coral uppercase font-semibold">Terisi</span>
            <p className="font-mono font-bold text-lg text-komazi-coral">{occupiedCount}</p>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-komazi-surface border border-danger/30 bg-danger/5">
            <span className="text-[10px] text-danger uppercase font-semibold">Overtime</span>
            <p className="font-mono font-bold text-lg text-danger">{overtimeCount}</p>
          </div>
        </div>
      </div>

      {/* 2. Workspace Areas Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm text-komazi-text flex items-center gap-2">
            <Laptop className="w-4 h-4 text-komazi-coral" />
            <span>Denah & Status Meja Kerja</span>
          </h2>
          <span className="text-xs text-komazi-muted">
            Pembaruan timer otomatis setiap 10 detik
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedAreas.map((area) => {
            const currentSession = sessions.find((s) => s.areaId === area.id);
            return (
              <WorkspaceCard
                key={area.id}
                area={area}
                session={currentSession}
                onCheckIn={(a) => setActiveCheckInArea(a)}
                onCheckOut={(s) => setActiveCheckOutSession(s)}
              />
            );
          })}
        </div>

        {areas.length > 0 && (
          <Pagination
            currentPage={areaPage}
            totalItems={areas.length}
            itemsPerPage={areasPerPage}
            onPageChange={setAreaPage}
            onItemsPerPageChange={(newLimit) => {
              setAreasPerPage(newLimit);
              setAreaPage(1);
            }}
            itemsPerPageOptions={[6, 10, 12, 24]}
            itemLabel="area meja"
          />
        )}
      </div>

      {/* 3. Tariff & Packages Reference Card */}
      <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border space-y-3">
        <h3 className="font-bold text-xs uppercase tracking-wider text-komazi-muted flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-warning" />
          <span>Daftar Paket & Tarif Workspace Aktif</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border flex flex-col justify-between"
            >
              <div>
                <p className="font-bold text-xs text-komazi-text">{pkg.name}</p>
                <p className="text-[11px] text-komazi-muted mt-0.5 line-clamp-2">{pkg.description}</p>
              </div>
              <div className="mt-2 pt-2 border-t border-komazi-border/50 flex justify-between items-baseline">
                <span className="font-mono font-bold text-xs text-komazi-coral">
                  {formatRupiah(pkg.price)}
                </span>
                <span className="text-[10px] text-komazi-muted">
                  OT: {formatRupiah(pkg.overtimePerHr)}/jam
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      {activeCheckInArea && (
        <CheckInModal
          area={activeCheckInArea}
          onClose={() => setActiveCheckInArea(null)}
        />
      )}

      {activeCheckOutSession && (
        <CheckOutModal
          session={activeCheckOutSession}
          onClose={() => setActiveCheckOutSession(null)}
          onDirectPay={handleDirectPay}
        />
      )}

      {receiptOrder && (
        <ThermalReceiptModal
          order={receiptOrder}
          onClose={() => setReceiptOrder(null)}
        />
      )}
    </div>
  );
}
