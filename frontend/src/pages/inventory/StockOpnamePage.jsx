import React, { useState, useMemo, useEffect } from 'react';
import { useInventoryStore } from '../../store/inventoryStore';
import { useStockStore } from '../../store/stockStore';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import {
  ClipboardCheck,
  Plus,
  Search,
  X,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Eye,
  RefreshCw,
  RotateCcw,
  Check,
  Download,
  Trash2,
  ChevronRight,
  SlidersHorizontal,
} from 'lucide-react';
import AlertModal from '../../components/ui/AlertModal';
import Pagination from '../../components/ui/Pagination';

export default function StockOpnamePage() {
  const { opnameSessions, addOpnameSession, deleteOpnameSession, bulkDeleteOpnameSessions } = useInventoryStore();
  const { ingredients, fetchIngredients, bulkAdjustStock, isLoading: isStockLoading } = useStockStore();
  const { user } = useAuthStore();

  // Table filters & search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Multi-Select State
  const [selectedSessionIds, setSelectedSessionIds] = useState([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);

  // Modal 1: Mulai Sesi Opname (Audit Baru)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [sessionAuditor, setSessionAuditor] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [applyStockAdjustment, setApplyStockAdjustment] = useState(true);

  // Items being audited in modal
  const [auditItems, setAuditItems] = useState([]);
  const [modalSearch, setModalSearch] = useState('');
  const [modalFilterTab, setModalFilterTab] = useState('ALL'); // ALL, VARIANCE, MATCH

  // Modal 2: Detail Sesi Opname (Inspeksi Riwayat)
  const [selectedSession, setSelectedSession] = useState(null);
  const [detailSearch, setDetailSearch] = useState('');

  // Fetch latest ingredients on mount
  useEffect(() => {
    fetchIngredients();
  }, [fetchIngredients]);

  // Set default auditor from current logged-in user
  useEffect(() => {
    if (user?.name) {
      setSessionAuditor(user.name);
    } else {
      setSessionAuditor('Manager');
    }
  }, [user]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  // Open Create Opname Modal with real ingredients
  const handleOpenCreateModal = async () => {
    const list = ingredients.length > 0 ? ingredients : await fetchIngredients();
    const initializedItems = (list || []).map((ing) => {
      const current = Number(ing.stock) || 0;
      return {
        ingredientId: ing.id,
        name: ing.name,
        unit: ing.unit,
        systemStock: current,
        physicalStock: current, // Default matching system stock
        variance: 0,
        notes: '',
      };
    });

    setAuditItems(initializedItems);
    setSessionDate(new Date().toISOString().split('T')[0]);
    setSessionAuditor(user?.name || 'Manager');
    setSessionNotes('');
    setApplyStockAdjustment(true);
    setModalSearch('');
    setModalFilterTab('ALL');
    setIsCreateModalOpen(true);
  };

  // Handle physical stock input change
  const handlePhysicalChange = (ingredientId, rawValue) => {
    setAuditItems((prev) =>
      prev.map((item) => {
        if (item.ingredientId !== ingredientId) return item;
        const val = rawValue === '' ? '' : Number(rawValue);
        const physical = rawValue === '' ? 0 : val;
        const variance = Number((physical - item.systemStock).toFixed(3));
        return {
          ...item,
          physicalStock: val,
          variance,
        };
      })
    );
  };

  // Handle per-item note change
  const handleItemNoteChange = (ingredientId, note) => {
    setAuditItems((prev) =>
      prev.map((item) => (item.ingredientId === ingredientId ? { ...item, notes: note } : item))
    );
  };

  // Helper: Reset all physical counts to system stock
  const handleResetAllToSystem = () => {
    setAuditItems((prev) =>
      prev.map((item) => ({
        ...item,
        physicalStock: item.systemStock,
        variance: 0,
      }))
    );
    toast.success('Semua stok fisik telah disetel sesuai stok sistem.');
  };

  // Filtered audit items in creation modal
  const filteredAuditItems = useMemo(() => {
    return auditItems.filter((item) => {
      const q = modalSearch.toLowerCase().trim();
      const matchSearch = !q || item.name.toLowerCase().includes(q) || item.unit.toLowerCase().includes(q);
      if (!matchSearch) return false;

      if (modalFilterTab === 'VARIANCE') {
        return Math.abs(item.variance) > 0.0001;
      }
      if (modalFilterTab === 'MATCH') {
        return Math.abs(item.variance) <= 0.0001;
      }
      return true;
    });
  }, [auditItems, modalSearch, modalFilterTab]);

  // Counts inside creation modal
  const modalVarianceCount = useMemo(() => {
    return auditItems.filter((i) => Math.abs(i.variance) > 0.0001).length;
  }, [auditItems]);

  const modalMatchCount = useMemo(() => {
    return auditItems.length - modalVarianceCount;
  }, [auditItems, modalVarianceCount]);

  // Submit Stock Opname session
  const handleSubmitOpname = async (e) => {
    e.preventDefault();
    if (auditItems.length === 0) {
      toast.error('Tidak ada bahan baku yang dapat diaudit.');
      return;
    }

    setIsSubmitting(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 7).replace('-', '');
      const newId = opnameSessions.length > 0 ? Math.max(...opnameSessions.map((s) => s.id)) + 1 : 1;
      const opnameNumber = `OPN-${todayStr}-${String(newId).padStart(2, '0')}`;

      // Cleaned items array
      const finalizedItems = auditItems.map((item) => {
        const physical = item.physicalStock === '' ? 0 : Number(item.physicalStock);
        const variance = Number((physical - item.systemStock).toFixed(3));
        return {
          ingredientId: item.ingredientId,
          name: item.name,
          unit: item.unit,
          systemStock: item.systemStock,
          physicalStock: physical,
          variance,
          notes: item.notes.trim(),
        };
      });

      const itemsWithVariance = finalizedItems.filter((i) => Math.abs(i.variance) > 0.0001);

      // 1. If applyStockAdjustment is TRUE: Apply stock adjustments to actual stock in DB & Store
      if (applyStockAdjustment && itemsWithVariance.length > 0) {
        const adjustmentsToApply = itemsWithVariance.map((it) => ({
          ingredientId: it.ingredientId,
          physicalStock: it.physicalStock,
          note: `Stok Opname ${opnameNumber}: Selisih ${it.variance > 0 ? '+' : ''}${it.variance} ${it.unit}. ${it.notes || 'Penyesuaian audit fisik'}`.trim(),
        }));

        await bulkAdjustStock(adjustmentsToApply);
      }

      // 2. Save full audit session into inventoryStore
      addOpnameSession({
        opnameNumber,
        date: sessionDate,
        auditor: sessionAuditor.trim() || 'Manager',
        totalItemsChecked: finalizedItems.length,
        varianceCount: itemsWithVariance.length,
        status: 'APPROVED',
        appliedToStock: applyStockAdjustment,
        notes: sessionNotes.trim(),
        items: finalizedItems,
      });

      toast.success(
        `Sesi Stok Opname ${opnameNumber} berhasil disimpan! ${
          applyStockAdjustment && itemsWithVariance.length > 0
            ? `${itemsWithVariance.length} bahan telah disesuaikan di persediaan.`
            : 'Semua data telah dicatat.'
        }`
      );

      setIsCreateModalOpen(false);
    } catch (err) {
      console.error('[StockOpnamePage] Submit error:', err);
      toast.error('Terjadi kesalahan saat menyimpan sesi stok opname.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered Sessions for the main table
  const filteredSessions = useMemo(() => {
    return opnameSessions.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQ =
        !q ||
        s.opnameNumber.toLowerCase().includes(q) ||
        s.auditor.toLowerCase().includes(q) ||
        (s.notes && s.notes.toLowerCase().includes(q));
      const matchStatus = statusFilter === 'ALL' || s.status === statusFilter;
      return matchQ && matchStatus;
    });
  }, [opnameSessions, searchQuery, statusFilter]);

  // Paginated Sessions for table view
  const paginatedSessions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredSessions.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSessions, currentPage, itemsPerPage]);

  // Multi-Select Handlers
  const isAllCurrentPageSelected = useMemo(() => {
    if (paginatedSessions.length === 0) return false;
    return paginatedSessions.every((session) => selectedSessionIds.includes(session.id));
  }, [paginatedSessions, selectedSessionIds]);

  const handleSelectAllToggle = () => {
    const pageIds = paginatedSessions.map((s) => s.id);
    if (isAllCurrentPageSelected) {
      setSelectedSessionIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedSessionIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleRowSelect = (id) => {
    setSelectedSessionIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkExportCSV = () => {
    const target = opnameSessions.filter((s) => selectedSessionIds.includes(s.id));
    if (target.length === 0) return;

    const headers = ['ID Opname', 'Tanggal', 'Auditor', 'Bahan Diperiksa', 'Selisih Fisik', 'Status', 'Penyesuaian Stok', 'Catatan'];
    const rows = target.map((s) => [
      s.opnameNumber,
      s.date,
      `"${(s.auditor || '').replace(/"/g, '""')}"`,
      s.totalItemsChecked || 0,
      s.varianceCount || 0,
      s.status,
      s.appliedToStock ? 'Disesuaikan' : 'Hanya Catatan',
      `"${(s.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `stok_opname_terpilih_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`${target.length} sesi opname diekspor ke CSV.`);
  };

  const handleConfirmBulkDelete = () => {
    if (bulkDeleteOpnameSessions) {
      bulkDeleteOpnameSessions(selectedSessionIds);
    } else {
      selectedSessionIds.forEach((id) => deleteOpnameSession && deleteOpnameSession(id));
    }
    toast.success(`${selectedSessionIds.length} sesi opname berhasil dihapus.`);
    setSelectedSessionIds([]);
    setIsBulkDeleteModalOpen(false);
  };

  const handleConfirmSingleDelete = () => {
    if (!sessionToDelete) return;
    deleteOpnameSession(sessionToDelete.id);
    setSelectedSessionIds((prev) => prev.filter((id) => id !== sessionToDelete.id));
    toast.success(`Sesi ${sessionToDelete.opnameNumber} berhasil dihapus.`);
    setSessionToDelete(null);
  };

  // Overall metrics calculation
  const latestVariance = useMemo(() => {
    if (opnameSessions.length === 0) return 0;
    return opnameSessions[0]?.varianceCount || 0;
  }, [opnameSessions]);

  const accuracyRate = useMemo(() => {
    if (opnameSessions.length === 0) return '100%';
    const latest = opnameSessions[0];
    if (!latest.totalItemsChecked || latest.totalItemsChecked === 0) return '100%';
    const rate = ((latest.totalItemsChecked - latest.varianceCount) / latest.totalItemsChecked) * 100;
    return `${Math.max(0, rate).toFixed(1)}% Cocok`;
  }, [opnameSessions]);

  // Export session details to CSV
  const handleExportSessionCSV = (session) => {
    if (!session || !session.items || session.items.length === 0) {
      toast.error('Tidak ada data item untuk diekspor.');
      return;
    }

    const headers = ['ID Bahan', 'Nama Bahan', 'Satuan', 'Stok Sistem', 'Stok Fisik', 'Selisih', 'Catatan'];
    const rows = session.items.map((i) => [
      i.ingredientId,
      `"${i.name.replace(/"/g, '""')}"`,
      i.unit,
      i.systemStock,
      i.physicalStock,
      i.variance,
      `"${(i.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${session.opnameNumber}_detail_audit.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Laporan detail opname berhasil diekspor ke CSV.');
  };

  return (
    <div className="p-4 sm:p-6 pb-28 lg:pb-6 space-y-6 max-w-7xl mx-auto select-none">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-komazi-coral/15 border border-komazi-coral/30 flex items-center justify-center text-komazi-coral">
              <ClipboardCheck className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-komazi-text tracking-tight">
              Stok Opname (Stock Take)
            </h1>
          </div>
          <p className="text-xs text-komazi-muted mt-1">
            Penghitungan fisik berkala, audit selisih persediaan, dan rekonsiliasi otomatis bahan baku.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => fetchIngredients()}
            title="Muat Ulang Bahan Baku"
            className="p-2.5 rounded-xl bg-komazi-surface border border-komazi-border hover:bg-komazi-surface-2 text-komazi-muted hover:text-white transition-all shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isStockLoading ? 'animate-spin text-komazi-coral' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold shadow-md transition-all flex items-center gap-2 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Mulai Sesi Opname</span>
          </button>
        </div>
      </div>

      {/* 2. Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-komazi-coral/10 text-komazi-coral flex items-center justify-center shrink-0">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-komazi-muted font-medium">Total Sesi Audit</div>
            <div className="text-lg font-black text-komazi-text">{opnameSessions.length} Sesi</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-komazi-muted font-medium">Akurasi Audit Terakhir</div>
            <div className="text-lg font-black text-emerald-400">{accuracyRate}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-komazi-muted font-medium">Selisih Terdeteksi</div>
            <div className="text-lg font-black text-amber-400">{latestVariance} Bahan</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-komazi-muted font-medium">Bahan Aktif Terdaftar</div>
            <div className="text-lg font-black text-komazi-text">{ingredients.length} Bahan</div>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-komazi-muted absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari ID sesi opname, auditor, atau catatan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text placeholder-komazi-muted focus:border-komazi-coral focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-komazi-muted hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter status sesi opname"
            className="px-3 py-2 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
          >
            <option value="ALL">Semua Status</option>
            <option value="APPROVED">Disetujui (Approved)</option>
            <option value="DRAFT">Draft</option>
          </select>
        </div>
      </div>

      {/* 4. Table Riwayat Opname with Checkboxes & Pagination */}
      <div className="rounded-2xl border border-komazi-border bg-komazi-surface/90 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-komazi-border bg-komazi-surface-2/40 text-komazi-muted font-semibold">
                <th className="py-3.5 pl-4 pr-2 w-10 text-center">
                  <input
                    type="checkbox"
                    aria-label="Pilih semua sesi opname di halaman ini"
                    checked={isAllCurrentPageSelected}
                    onChange={handleSelectAllToggle}
                    className="w-4 h-4 rounded text-komazi-coral accent-komazi-coral cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-3">ID Opname</th>
                <th className="py-3.5 px-4">Tanggal Audit</th>
                <th className="py-3.5 px-4">Auditor / Petugas</th>
                <th className="py-3.5 px-4 text-center">Bahan Diperiksa</th>
                <th className="py-3.5 px-4 text-center">Selisih Fisik</th>
                <th className="py-3.5 px-4">Penyesuaian Stok</th>
                <th className="py-3.5 px-4">Catatan</th>
                <th className="py-3.5 pr-4 pl-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-komazi-border/60">
              {paginatedSessions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-komazi-muted">
                    <p className="font-semibold text-xs text-komazi-text">Belum ada riwayat sesi opname</p>
                    <p className="text-[11px] text-komazi-muted mt-1">
                      Klik "+ Mulai Sesi Opname" untuk mencatat penghitungan fisik bahan baku.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedSessions.map((session) => {
                  const isSelected = selectedSessionIds.includes(session.id);

                  return (
                    <tr
                      key={session.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-komazi-coral/10 hover:bg-komazi-coral/15' : 'hover:bg-komazi-surface-2/40'
                      }`}
                    >
                      <td className="py-3.5 pl-4 pr-2 text-center">
                        <input
                          type="checkbox"
                          aria-label={`Pilih sesi ${session.opnameNumber}`}
                          checked={isSelected}
                          onChange={() => handleRowSelect(session.id)}
                          className="w-4 h-4 rounded text-komazi-coral accent-komazi-coral cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-komazi-coral">
                        {session.opnameNumber}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-komazi-muted">
                        {session.date}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-komazi-text">
                        {session.auditor}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-komazi-text">
                        {session.totalItemsChecked} Bahan
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold">
                        {session.varianceCount > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            {session.varianceCount} Selisih
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            0 (Cocok)
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {session.appliedToStock ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                            <Check className="w-3.5 h-3.5" />
                            <span>Disesuaikan</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-komazi-muted">Hanya Catatan</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-komazi-muted text-[11px] max-w-xs truncate">
                        {session.notes || '—'}
                      </td>
                      <td className="py-3.5 pr-4 pl-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedSession(session)}
                            title="Lihat Detail Sesi Audit"
                            className="px-2.5 py-1.5 rounded-lg bg-komazi-surface-2 hover:bg-komazi-border text-komazi-text hover:text-komazi-coral text-xs font-semibold transition-colors flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSessionToDelete(session)}
                            title="Hapus Sesi"
                            className="p-1.5 rounded-lg text-komazi-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredSessions.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
          itemsPerPageOptions={[5, 10, 20, 50]}
          itemLabel="sesi opname"
        />
      </div>

      {/* Floating Multi-Select Action Bar */}
      {selectedSessionIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-3xl w-[92%] sm:w-auto bg-komazi-surface/95 backdrop-blur-md border border-komazi-coral/40 shadow-2xl shadow-black/70 rounded-2xl p-2.5 sm:px-4 sm:py-3 flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-start gap-2 sm:gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl bg-komazi-coral/20 border border-komazi-coral/40 text-komazi-coral text-xs font-bold whitespace-nowrap flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>{selectedSessionIds.length} Sesi Terpilih</span>
            </span>
            <button
              type="button"
              onClick={() => setSelectedSessionIds([])}
              className="text-[11px] text-komazi-muted hover:text-white underline px-1"
            >
              Batalkan
            </button>
          </div>

          <div className="h-4 w-px bg-komazi-border hidden sm:block" />

          <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleBulkExportCSV}
              className="px-2.5 py-1.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-text border border-komazi-border text-xs font-semibold transition-all flex items-center gap-1 active:scale-95"
              title="Ekspor sesi terpilih ke CSV"
            >
              <Download className="w-3.5 h-3.5 text-komazi-coral" />
              <span>Ekspor CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-xs font-semibold transition-all flex items-center gap-1 active:scale-95"
              title="Hapus sesi audit terpilih"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Terpilih</span>
            </button>
          </div>
        </div>
      )}

      {/* 5. MODAL: MULAI SESI STOK OPNAME (PENGHITUNGAN FISIK) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-komazi-border shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-komazi-coral/15 border border-komazi-coral/30 flex items-center justify-center text-komazi-coral">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-komazi-text flex items-center gap-2">
                    <span>Sesi Stok Opname Baru</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-komazi-surface-2 border border-komazi-border text-komazi-coral">
                      Audit Fisik Persediaan
                    </span>
                  </h3>
                  <p className="text-[11px] text-komazi-muted mt-0.5">
                    Masukkan hasil penghitungan fisik bahan baku. Sistem akan menghitung selisih dan menyesuaikan stok secara instan.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Body / Scrollable Content */}
            <form onSubmit={handleSubmitOpname} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Session Meta Header Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-komazi-surface-2/60 border border-komazi-border text-xs">
                <div>
                  <label className="block text-komazi-muted font-medium mb-1">Tanggal Audit</label>
                  <input
                    type="date"
                    required
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-komazi-surface border border-komazi-border text-komazi-text focus:border-komazi-coral focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-komazi-muted font-medium mb-1">Auditor / Petugas</label>
                  <input
                    type="text"
                    required
                    placeholder="Nama staf/manager"
                    value={sessionAuditor}
                    onChange={(e) => setSessionAuditor(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-komazi-surface border border-komazi-border text-komazi-text focus:border-komazi-coral focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-komazi-muted font-medium mb-1">Penyesuaian Stok Sistem</label>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={applyStockAdjustment}
                      onChange={(e) => setApplyStockAdjustment(e.target.checked)}
                      className="w-4 h-4 rounded text-komazi-coral focus:ring-0 focus:outline-none accent-komazi-coral cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-komazi-text">
                      Otomatis update stok di sistem
                    </span>
                  </label>
                </div>
              </div>

              {/* Quick Action Toolbar & Tabs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                <div className="relative flex-1 max-w-xs">
                  <Search className="w-3.5 h-3.5 text-komazi-muted absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Filter nama bahan..."
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex rounded-xl bg-komazi-surface-2 p-0.5 border border-komazi-border text-xs">
                    <button
                      type="button"
                      onClick={() => setModalFilterTab('ALL')}
                      className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                        modalFilterTab === 'ALL'
                          ? 'bg-komazi-coral text-white shadow-sm'
                          : 'text-komazi-muted hover:text-white'
                      }`}
                    >
                      Semua ({auditItems.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalFilterTab('VARIANCE')}
                      className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                        modalFilterTab === 'VARIANCE'
                          ? 'bg-amber-500 text-black shadow-sm'
                          : 'text-komazi-muted hover:text-amber-400'
                      }`}
                    >
                      Selisih ({modalVarianceCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalFilterTab('MATCH')}
                      className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                        modalFilterTab === 'MATCH'
                          ? 'bg-emerald-500 text-black shadow-sm'
                          : 'text-komazi-muted hover:text-emerald-400'
                      }`}
                    >
                      Cocok ({modalMatchCount})
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetAllToSystem}
                    title="Set semua stok fisik sama dengan stok sistem saat ini"
                    className="px-2.5 py-1.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-[11px] font-semibold text-komazi-text flex items-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3 text-komazi-coral" />
                    <span>Reset Sesuai Sistem</span>
                  </button>
                </div>
              </div>

              {/* Table of items to count */}
              <div className="rounded-xl border border-komazi-border bg-komazi-surface overflow-hidden">
                <div className="max-h-[380px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-komazi-surface-2 z-10 border-b border-komazi-border">
                      <tr className="text-komazi-muted font-semibold">
                        <th className="py-2.5 pl-4 pr-2">Bahan Baku</th>
                        <th className="py-2.5 px-3 text-right">Stok Sistem</th>
                        <th className="py-2.5 px-3 text-center w-36">Stok Fisik Aktual</th>
                        <th className="py-2.5 px-3 text-center w-28">Selisih</th>
                        <th className="py-2.5 pr-4 pl-2">Catatan / Alasan Selisih</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-komazi-border/50">
                      {filteredAuditItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-komazi-muted">
                            Tidak ada bahan baku yang cocok dengan pencarian / filter.
                          </td>
                        </tr>
                      ) : (
                        filteredAuditItems.map((item) => {
                          const hasVariance = Math.abs(item.variance) > 0.0001;
                          const isDeficit = item.variance < 0;

                          return (
                            <tr
                              key={item.ingredientId}
                              className={`transition-colors ${
                                hasVariance ? 'bg-amber-500/5 hover:bg-amber-500/10' : 'hover:bg-komazi-surface-2/30'
                              }`}
                            >
                              {/* Nama Bahan & Satuan */}
                              <td className="py-2.5 pl-4 pr-2">
                                <div className="font-bold text-komazi-text">{item.name}</div>
                                <div className="text-[10px] text-komazi-muted font-mono uppercase">
                                  Satuan: {item.unit}
                                </div>
                              </td>

                              {/* Stok Sistem (Read-only) */}
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-komazi-text">
                                {item.systemStock}{' '}
                                <span className="text-[10px] text-komazi-muted font-normal">{item.unit}</span>
                              </td>

                              {/* Input Stok Fisik */}
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    required
                                    value={item.physicalStock}
                                    onChange={(e) => handlePhysicalChange(item.ingredientId, e.target.value)}
                                    className="w-24 px-2 py-1.5 rounded-lg bg-komazi-surface-2 border border-komazi-border text-center font-mono font-bold text-komazi-text focus:border-komazi-coral focus:outline-none text-xs"
                                  />
                                  <span className="text-[10px] text-komazi-muted font-mono">{item.unit}</span>
                                </div>
                              </td>

                              {/* Badge Selisih */}
                              <td className="py-2.5 px-3 text-center">
                                {!hasVariance ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    0 (Cocok)
                                  </span>
                                ) : isDeficit ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                    {item.variance} {item.unit}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                    +{item.variance} {item.unit}
                                  </span>
                                )}
                              </td>

                              {/* Catatan Per-Item */}
                              <td className="py-2.5 pr-4 pl-2">
                                <input
                                  type="text"
                                  placeholder={hasVariance ? 'Alasan selisih (wajib diisi)...' : 'Catatan opsional...'}
                                  value={item.notes}
                                  onChange={(e) => handleItemNoteChange(item.ingredientId, e.target.value)}
                                  className={`w-full px-2.5 py-1.5 rounded-lg bg-komazi-surface-2 border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none ${
                                    hasVariance && !item.notes
                                      ? 'border-amber-500/50 placeholder-amber-400/60'
                                      : 'border-komazi-border placeholder-komazi-muted'
                                  }`}
                                />
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Catatan Sesi Audit Umum */}
              <div>
                <label className="block text-komazi-muted font-medium mb-1 text-xs">
                  Catatan Sesi Audit Umum
                </label>
                <textarea
                  rows={2}
                  placeholder="Catatan ringkasan investigasi, kondisi gudang bar/kitchen, atau tindakan pencegahan selisih..."
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-komazi-text text-xs focus:border-komazi-coral focus:outline-none resize-none"
                />
              </div>

              {/* Modal Footer Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-komazi-border">
                <div className="text-xs text-komazi-muted flex items-center gap-2">
                  <span>
                    Total <strong className="text-komazi-text">{auditItems.length}</strong> bahan diperiksa
                  </span>
                  <span>•</span>
                  <span>
                    <strong className="text-emerald-400">{modalMatchCount}</strong> cocok
                  </span>
                  <span>•</span>
                  <span>
                    <strong className={modalVarianceCount > 0 ? 'text-amber-400' : 'text-komazi-muted'}>
                      {modalVarianceCount}
                    </strong>{' '}
                    ada selisih
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-muted hover:text-white transition-colors text-xs font-semibold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || auditItems.length === 0}
                    className="px-5 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold transition-all shadow-md active:scale-95 text-xs flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Menyimpan & Menyesuaikan...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Simpan & Terapkan Opname</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: LIHAT DETAIL SESI OPNAME (INSPEKSI RIWAYAT) */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-komazi-border shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-komazi-coral/15 border border-komazi-coral/30 flex items-center justify-center text-komazi-coral">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-komazi-text flex items-center gap-2">
                    <span>Detail Sesi Stok Opname</span>
                    <span className="font-mono text-komazi-coral text-xs">
                      {selectedSession.opnameNumber}
                    </span>
                  </h3>
                  <p className="text-[11px] text-komazi-muted">
                    Dilaksanakan pada {selectedSession.date} oleh auditor{' '}
                    <strong className="text-komazi-text">{selectedSession.auditor}</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExportSessionCSV(selectedSession)}
                  title="Ekspor Hasil Audit ke CSV"
                  className="p-2 rounded-lg bg-komazi-surface-2 hover:bg-komazi-border text-komazi-text text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-4 h-4 text-komazi-coral" />
                  <span className="hidden sm:inline font-semibold">Unduh CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSession(null)}
                  className="p-1.5 rounded-lg text-komazi-muted hover:text-white hover:bg-komazi-surface-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Summary Badges */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border text-center">
                  <div className="text-[11px] text-komazi-muted font-medium">Bahan Diperiksa</div>
                  <div className="text-base font-black text-komazi-text font-mono mt-0.5">
                    {selectedSession.totalItemsChecked} Bahan
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border text-center">
                  <div className="text-[11px] text-komazi-muted font-medium">Stok Cocok</div>
                  <div className="text-base font-black text-emerald-400 font-mono mt-0.5">
                    {selectedSession.totalItemsChecked - selectedSession.varianceCount} Bahan
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border text-center">
                  <div className="text-[11px] text-komazi-muted font-medium">Ada Selisih</div>
                  <div className="text-base font-black text-amber-400 font-mono mt-0.5">
                    {selectedSession.varianceCount} Bahan
                  </div>
                </div>
              </div>

              {/* General Note */}
              {selectedSession.notes && (
                <div className="p-3 rounded-xl bg-komazi-surface-2/40 border border-komazi-border text-xs">
                  <span className="font-semibold text-komazi-text">Catatan Sesi: </span>
                  <span className="text-komazi-muted">{selectedSession.notes}</span>
                </div>
              )}

              {/* Search Inside Detail Items */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="relative flex-1 max-w-xs">
                  <Search className="w-3.5 h-3.5 text-komazi-muted absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Cari item audit..."
                    value={detailSearch}
                    onChange={(e) => setDetailSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
                  />
                </div>
                <div className="text-[11px] text-komazi-muted font-mono">
                  {selectedSession.appliedToStock ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Telah diterapkan ke stok sistem
                    </span>
                  ) : (
                    <span>Hanya pencatatan laporan</span>
                  )}
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div className="rounded-xl border border-komazi-border bg-komazi-surface overflow-hidden">
                <div className="max-h-[340px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-komazi-surface-2 z-10 border-b border-komazi-border">
                      <tr className="text-komazi-muted font-semibold">
                        <th className="py-2.5 pl-4 pr-2">Bahan Baku</th>
                        <th className="py-2.5 px-3 text-right">Stok Sistem</th>
                        <th className="py-2.5 px-3 text-right">Stok Fisik</th>
                        <th className="py-2.5 px-3 text-center">Selisih</th>
                        <th className="py-2.5 pr-4 pl-2">Catatan / Alasan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-komazi-border/50">
                      {(!selectedSession.items || selectedSession.items.length === 0) ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-komazi-muted">
                            Tidak ada rincian item pada sesi opname ini.
                          </td>
                        </tr>
                      ) : (
                        selectedSession.items
                          .filter((i) => {
                            const q = detailSearch.toLowerCase().trim();
                            return !q || i.name.toLowerCase().includes(q) || (i.notes && i.notes.toLowerCase().includes(q));
                          })
                          .map((item, idx) => {
                            const hasVariance = Math.abs(item.variance) > 0.0001;
                            const isDeficit = item.variance < 0;

                            return (
                              <tr
                                key={idx}
                                className={`hover:bg-komazi-surface-2/30 transition-colors ${
                                  hasVariance ? 'bg-amber-500/5' : ''
                                }`}
                              >
                                <td className="py-2.5 pl-4 pr-2">
                                  <div className="font-bold text-komazi-text">{item.name}</div>
                                  <div className="text-[10px] text-komazi-muted font-mono">{item.unit}</div>
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-komazi-text">
                                  {item.systemStock} {item.unit}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-komazi-text">
                                  {item.physicalStock} {item.unit}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {!hasVariance ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                      0 (Cocok)
                                    </span>
                                  ) : isDeficit ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                      {item.variance} {item.unit}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                      +{item.variance} {item.unit}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 pr-4 pl-2 text-komazi-muted text-[11px]">
                                  {item.notes || '—'}
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-komazi-border shrink-0 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedSession(null)}
                className="px-4 py-2 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-text text-xs font-semibold transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Alert Modal Hapus Satuan */}
      <AlertModal
        isOpen={Boolean(sessionToDelete)}
        title="Hapus Riwayat Sesi Opname?"
        message={`Apakah Anda yakin ingin menghapus sesi "${sessionToDelete?.opnameNumber}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus Sesi"
        cancelText="Batal"
        type="danger"
        onConfirm={handleConfirmSingleDelete}
        onClose={() => setSessionToDelete(null)}
      />

      {/* 8. Alert Modal Hapus Massal (Bulk Delete) */}
      <AlertModal
        isOpen={isBulkDeleteModalOpen}
        title="Hapus Sesi Opname Terpilih?"
        message={`Apakah Anda yakin ingin menghapus ${selectedSessionIds.length} sesi stok opname yang dipilih? Tindakan ini tidak dapat dibatalkan.`}
        confirmText={`Hapus ${selectedSessionIds.length} Sesi`}
        cancelText="Batal"
        type="danger"
        onConfirm={handleConfirmBulkDelete}
        onClose={() => setIsBulkDeleteModalOpen(false)}
      />
    </div>
  );
}
