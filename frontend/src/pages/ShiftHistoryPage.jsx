import React, { useState, useEffect, useMemo } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import {
  History,
  Clock,
  Lock,
  Unlock,
  User,
  Banknote,
  Coins,
  Download,
  Search,
  Calendar,
  Filter,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Eye,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  X,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Scale,
  QrCode,
  CreditCard,
} from 'lucide-react';
import XLSX from 'xlsx-js-style';
import { exportToExcel } from '../utils/excel';
import { useShiftStore } from '../store/shiftStore';
import { useAuthStore } from '../store/authStore';
import { formatRupiah, formatDateTime } from '../utils/format';
import { toast } from '../store/toastStore';
import { Navigate } from 'react-router-dom';
import Pagination from '../components/ui/Pagination';
import CloseSessionReportModal from '../components/shift/CloseSessionReportModal';

export default function ShiftHistoryPage() {
  const { shiftHistory, fetchShiftHistory, fetchShiftDetail } = useShiftStore();
  const { user } = useAuthStore();

  if (user && !['OWNER', 'MANAGER'].includes(user.role)) {
    return <Navigate to="/pos" replace />;
  }

  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCashier, setSelectedCashier] = usePersistentState('shifthistory_cashier', 'ALL');
  const [dateFilter, setDateFilter] = usePersistentState('shifthistory_date', 'ALL'); // 'ALL' | 'TODAY' | '7DAYS' | 'MONTH'
  const [differenceFilter, setDifferenceFilter] = usePersistentState('shifthistory_diff', 'ALL'); // 'ALL' | 'MATCH' | 'DEFICIT' | 'SURPLUS'

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = usePersistentState('shifthistory_itemsPerPage', 10);

  // Selected shift for detail modal
  const [selectedShiftId, setSelectedShiftId] = useState(null);
  const [shiftDetailData, setShiftDetailData] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // Export dropdown state
  const [showExportMenu, setShowExportMenu] = useState(false);

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      await fetchShiftHistory({ limit: 100 });
    } catch (err) {
      toast.error('Gagal memuat riwayat sesi kasir: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Open detail modal
  const handleOpenDetail = async (shiftId) => {
    try {
      setSelectedShiftId(shiftId);
      setIsDetailLoading(true);
      const detail = await fetchShiftDetail(shiftId);
      setShiftDetailData(detail);
    } catch (err) {
      toast.error('Gagal mengambil rincian sesi shift: ' + err.message);
    } finally {
      setIsDetailLoading(false);
    }
  };

  // Unique cashier names for dropdown
  const uniqueCashiers = useMemo(() => {
    const names = new Set();
    (shiftHistory || []).forEach((s) => {
      const name = s.cashierName || s.cashier?.name;
      if (name) names.add(name);
    });
    return Array.from(names);
  }, [shiftHistory]);

  // Filter shifts
  const filteredShifts = useMemo(() => {
    return (shiftHistory || []).filter((shift) => {
      // 1. Search Query
      const cashierName = (shift.cashierName || shift.cashier?.name || '').toLowerCase();
      const notes = (shift.notes || shift.note || '').toLowerCase();
      const query = searchQuery.toLowerCase().trim();
      if (query && !cashierName.includes(query) && !notes.includes(query)) {
        return false;
      }

      // 2. Cashier dropdown
      if (selectedCashier !== 'ALL') {
        const name = shift.cashierName || shift.cashier?.name;
        if (name !== selectedCashier) return false;
      }

      // 3. Difference status filter
      const diff = Number(shift.difference || 0);
      if (differenceFilter === 'MATCH' && diff !== 0) return false;
      if (differenceFilter === 'DEFICIT' && diff >= 0) return false;
      if (differenceFilter === 'SURPLUS' && diff <= 0) return false;

      // 4. Date filter
      if (dateFilter !== 'ALL' && shift.closedAt) {
        const shiftDate = new Date(shift.closedAt);
        const now = new Date();

        if (dateFilter === 'TODAY') {
          if (shiftDate.toDateString() !== now.toDateString()) return false;
        } else if (dateFilter === '7DAYS') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(now.getDate() - 7);
          if (shiftDate < sevenDaysAgo) return false;
        } else if (dateFilter === 'MONTH') {
          if (
            shiftDate.getMonth() !== now.getMonth() ||
            shiftDate.getFullYear() !== now.getFullYear()
          ) {
            return false;
          }
        }
      }

      return true;
    });
  }, [shiftHistory, searchQuery, selectedCashier, differenceFilter, dateFilter]);

  // Summary Metrics
  const metrics = useMemo(() => {
    let totalSessions = filteredShifts.length;
    let totalCashSales = 0;
    let totalNonCashSales = 0;
    let totalDifference = 0;
    let deficitCount = 0;
    let surplusCount = 0;
    let matchCount = 0;

    filteredShifts.forEach((s) => {
      totalCashSales += Number(s.totalCashSales || s.cashSales || 0);
      totalNonCashSales += Number(s.totalNonCashSales || s.nonCashSales || 0);
      const diff = Number(s.difference || 0);
      totalDifference += diff;
      if (diff === 0) matchCount++;
      else if (diff < 0) deficitCount++;
      else surplusCount++;
    });

    return {
      totalSessions,
      totalSales: totalCashSales + totalNonCashSales,
      totalCashSales,
      totalNonCashSales,
      totalDifference,
      deficitCount,
      surplusCount,
      matchCount,
    };
  }, [filteredShifts]);

  // Paginated data
  const paginatedShifts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredShifts.slice(start, start + itemsPerPage);
  }, [filteredShifts, currentPage, itemsPerPage]);

  // Export functions
  const handleExport = (type) => {
    try {
      const dataToExport = filteredShifts.map((s, idx) => ({
        'No': idx + 1,
        'Nama Kasir': s.cashierName || s.cashier?.name || 'Kasir',
        'Waktu Buka': s.openedAt ? formatDateTime(s.openedAt) : '-',
        'Waktu Tutup': s.closedAt ? formatDateTime(s.closedAt) : '-',
        'Durasi': s.workDurationFormatted || '-',
        'Modal Awal (Rp)': Number(s.openingCash || 0),
        'Penjualan Tunai (Rp)': Number(s.totalCashSales || s.cashSales || 0),
        'Penjualan Non-Tunai (Rp)': Number(s.totalNonCashSales || s.nonCashSales || 0),
        'Total Penjualan (Rp)': Number(s.totalSales || 0),
        'Uang Wajib di Laci (Rp)': Number(s.expectedCash || 0),
        'Kas Aktual di Laci (Rp)': Number(s.closingCash || 0),
        'Selisih Kas (Rp)': Number(s.difference || 0),
        'Status Selisih': Number(s.difference || 0) === 0 ? 'Pas' : Number(s.difference || 0) > 0 ? 'Surplus' : 'Defisit',
        'Catatan': s.notes || s.note || '-',
      }));

      const dateStr = new Date().toISOString().slice(0, 10);
      if (type === 'xlsx') {
        exportToExcel(dataToExport, `Komazi_Riwayat_Sesi_Kasir_${dateStr}.xlsx`, 'Riwayat Sesi Kasir');
        toast.success('Laporan riwayat sesi berhasil di-export ke Excel!');
      } else {
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Riwayat Sesi Kasir');
        XLSX.writeFile(wb, `Komazi_Riwayat_Sesi_Kasir_${dateStr}.csv`, { bookType: 'csv' });
        toast.success('Laporan riwayat sesi berhasil di-export ke CSV!');
      }
      setShowExportMenu(false);
    } catch (err) {
      toast.error('Gagal export data: ' + err.message);
    }
  };

  return (
    <div className="p-4 sm:p-6 pb-28 lg:pb-12 space-y-6 max-w-7xl mx-auto select-none animate-in fade-in duration-200">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-komazi-surface p-5 sm:p-6 rounded-2xl border border-komazi-border shadow-sm">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-komazi-coral/15 border border-komazi-coral/30 flex items-center justify-center text-komazi-coral shadow-inner shrink-0">
            <History className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display font-black text-xl sm:text-2xl text-komazi-text tracking-tight">
                Riwayat Sesi Kasir
              </h1>
            </div>
            <p className="text-xs text-komazi-muted mt-1 leading-relaxed">
              Pantau laporan penutupan shift kasir, rekonsiliasi kas fisik di laci, selisih uang, dan catatan operasional.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={loadHistory}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-xs font-bold text-komazi-muted hover:text-white border border-komazi-border transition-all active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md transition-all active:scale-95"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Export Laporan</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-80" />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl py-1.5 z-20 animate-in fade-in zoom-in-95">
                <button
                  type="button"
                  onClick={() => handleExport('xlsx')}
                  className="w-full px-4 py-2 text-left text-xs text-komazi-text hover:bg-komazi-surface-2 flex items-center gap-2.5 transition-colors font-medium"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Download Excel (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('csv')}
                  className="w-full px-4 py-2 text-left text-xs text-komazi-text hover:bg-komazi-surface-2 flex items-center gap-2.5 transition-colors font-medium"
                >
                  <FileText className="w-4 h-4 text-komazi-teal-light" />
                  <span>Download CSV (.csv)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-komazi-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Sesi Ditutup</span>
            <div className="w-8 h-8 rounded-xl bg-komazi-coral/10 text-komazi-coral flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="font-mono font-black text-2xl sm:text-3xl text-komazi-text">
              {metrics.totalSessions}
            </span>
            <span className="text-xs text-komazi-muted ml-1.5">Sesi Kasir</span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-komazi-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Omzet Sesi</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="font-mono font-black text-xl sm:text-2xl text-emerald-400 block truncate">
              {formatRupiah(metrics.totalSales)}
            </span>
            <span className="text-[10px] text-komazi-muted mt-0.5 block">
              Tunai: {formatRupiah(metrics.totalCashSales)} • Non-Tunai: {formatRupiah(metrics.totalNonCashSales)}
            </span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-komazi-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider">Akumulasi Selisih Kas</span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                metrics.totalDifference === 0
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : metrics.totalDifference < 0
                  ? 'bg-danger/10 text-danger'
                  : 'bg-blue-500/10 text-blue-400'
              }`}
            >
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span
              className={`font-mono font-black text-xl sm:text-2xl block truncate ${
                metrics.totalDifference === 0
                  ? 'text-emerald-400'
                  : metrics.totalDifference < 0
                  ? 'text-danger'
                  : 'text-blue-400'
              }`}
            >
              {metrics.totalDifference === 0
                ? 'Pas (Rp 0)'
                : `${metrics.totalDifference > 0 ? '+' : ''}${formatRupiah(metrics.totalDifference)}`}
            </span>
            <span className="text-[10px] text-komazi-muted mt-0.5 block">
              {metrics.deficitCount} minus • {metrics.surplusCount} lebih • {metrics.matchCount} pas
            </span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-komazi-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider">Tingkat Akurasi Kas</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="font-mono font-black text-2xl sm:text-3xl text-komazi-text">
              {metrics.totalSessions > 0
                ? `${Math.round((metrics.matchCount / metrics.totalSessions) * 100)}%`
                : '100%'}
            </span>
            <span className="text-xs text-komazi-muted ml-1.5">Sesi Sesuai (Pas)</span>
          </div>
        </div>
      </div>

      {/* 3. Filter Bar */}
      <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-komazi-muted absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Cari nama kasir atau catatan sesi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text placeholder-komazi-muted focus:border-komazi-coral outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-komazi-muted hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Kasir filter */}
          <select
            value={selectedCashier}
            onChange={(e) => setSelectedCashier(e.target.value)}
            className="px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text font-medium focus:border-komazi-coral outline-none cursor-pointer"
          >
            <option value="ALL">Semua Kasir ({uniqueCashiers.length})</option>
            {uniqueCashiers.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          {/* Date range filter */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text font-medium focus:border-komazi-coral outline-none cursor-pointer"
          >
            <option value="ALL">Semua Waktu</option>
            <option value="TODAY">Hari Ini</option>
            <option value="7DAYS">7 Hari Terakhir</option>
            <option value="MONTH">Bulan Ini</option>
          </select>

          {/* Status Selisih filter */}
          <select
            value={differenceFilter}
            onChange={(e) => setDifferenceFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text font-medium focus:border-komazi-coral outline-none cursor-pointer"
          >
            <option value="ALL">Semua Status Selisih</option>
            <option value="MATCH">Kas Pas (Rp 0)</option>
            <option value="DEFICIT">Kas Minus / Kurang</option>
            <option value="SURPLUS">Kas Lebih / Surplus</option>
          </select>
        </div>
      </div>

      {/* 4. Shift History Table */}
      <div className="bg-komazi-surface rounded-2xl border border-komazi-border overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 border-b border-komazi-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-komazi-coral" />
            <h2 className="font-bold text-sm text-komazi-text">
              Daftar Rekonsiliasi Sesi Kasir
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-komazi-surface-2 text-komazi-muted font-bold font-mono">
              {filteredShifts.length} Sesi Terfilter
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-komazi-surface-2/70 text-komazi-muted uppercase text-[10px] font-bold tracking-wider border-b border-komazi-border">
              <tr>
                <th className="py-3 px-4">Kasir</th>
                <th className="py-3 px-4">Waktu Buka / Tutup</th>
                <th className="py-3 px-4">Durasi Shift</th>
                <th className="py-3 px-4 text-right">Modal Awal</th>
                <th className="py-3 px-4 text-right">Penjualan Tunai</th>
                <th className="py-3 px-4 text-right">Non-Tunai</th>
                <th className="py-3 px-4 text-right">Kas Akhir Laci</th>
                <th className="py-3 px-4 text-right">Selisih Kas</th>
                <th className="py-3 px-4">Catatan Kasir</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-komazi-border/50">
              {paginatedShifts.length > 0 ? (
                paginatedShifts.map((shift) => {
                  const diff = Number(shift.difference || 0);
                  const isMatch = diff === 0;
                  const isSurplus = diff > 0;
                  return (
                    <tr
                      key={shift.id}
                      className="hover:bg-komazi-surface-2/40 transition-colors"
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-komazi-coral/15 text-komazi-coral flex items-center justify-center font-bold text-xs shrink-0">
                            {(shift.cashierName || 'K')[0].toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-komazi-text block">
                              {shift.cashierName || shift.cashier?.name || 'Kasir'}
                            </span>
                            <span className="text-[10px] text-komazi-muted font-mono">
                              ID: #{shift.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-komazi-muted font-mono whitespace-nowrap">
                        <div>{shift.openedAt ? formatDateTime(shift.openedAt) : '-'}</div>
                        <div className="text-[10px] opacity-75">
                          s/d {shift.closedAt ? formatDateTime(shift.closedAt) : 'Selesai'}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-komazi-text font-bold whitespace-nowrap">
                        {shift.workDurationFormatted || '-'}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-komazi-muted whitespace-nowrap">
                        {formatRupiah(shift.openingCash)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-emerald-400 font-bold whitespace-nowrap">
                        +{formatRupiah(shift.totalCashSales || shift.cashSales || 0)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-komazi-teal-light whitespace-nowrap">
                        +{formatRupiah(shift.totalNonCashSales || shift.nonCashSales || 0)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-komazi-text font-bold whitespace-nowrap">
                        {shift.closingCash !== null && shift.closingCash !== undefined
                          ? formatRupiah(shift.closingCash)
                          : '-'}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[10px] inline-flex items-center gap-1 ${
                            isMatch
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : isSurplus
                              ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                              : 'bg-danger/15 text-danger border border-danger/30'
                          }`}
                        >
                          {isMatch ? 'Pas (Rp 0)' : `${isSurplus ? '+' : ''}${formatRupiah(diff)}`}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-komazi-muted max-w-xs truncate">
                        {shift.notes || shift.note || '-'}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(shift.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-komazi-surface-2 hover:bg-komazi-coral hover:text-white text-komazi-muted text-xs font-bold transition-all active:scale-95 inline-flex items-center gap-1 border border-komazi-border"
                          title="Lihat rincian lengkap sesi"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Detail</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="10" className="py-14 text-center text-komazi-muted">
                    {isLoading ? 'Memuat data riwayat sesi...' : 'Tidak ada riwayat sesi kasir yang cocok dengan filter'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredShifts.length > itemsPerPage && (
          <div className="p-4 border-t border-komazi-border">
            <Pagination
              currentPage={currentPage}
              totalItems={filteredShifts.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* 5. Modal Detail Audit Sesi Shift (Z-Report) */}
      {selectedShiftId && shiftDetailData && (
        <CloseSessionReportModal
          session={shiftDetailData}
          onClose={() => {
            setSelectedShiftId(null);
            setShiftDetailData(null);
          }}
        />
      )}
    </div>
  );
}
