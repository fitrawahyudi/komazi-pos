import React, { useState, useMemo, useEffect } from 'react';
import { useStockStore } from '../store/stockStore';
import { useAuthStore } from '../store/authStore';
import { usePersistentState } from '../hooks/usePersistentState';
import { formatDateTime, formatRupiah } from '../utils/format';
import {
  Boxes,
  AlertTriangle,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  Trash2,
  RefreshCw,
  X,
  History,
  Coins,
  Search,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle2,
  Check,
  SlidersHorizontal,
  FileSpreadsheet,
  Download,
  Upload,
  MessageCircle,
  Edit2,
  ExternalLink,
  PackagePlus,
  PackageX,
  ClipboardCheck,
} from 'lucide-react';
import AlertModal from '../components/ui/AlertModal';
import Pagination from '../components/ui/Pagination';
import ExcelImportModal from '../components/common/ExcelImportModal';
import { exportToExcel } from '../utils/excel';
import { toast } from '../store/toastStore';

export default function StockPage() {
  const { user } = useAuthStore();
  const canViewCost = user?.role === 'OWNER' || user?.role === 'MANAGER';

  const {
    ingredients,
    movements,
    isMovementsLoading,
    fetchMovements,
    fetchIngredients,
    addIngredient,
    updateIngredient,
    deleteIngredient,
    recordMovement,
    recordWaste,
    getLowStockItems,
    bulkDeleteIngredients,
    bulkUpdateMinStock,
    bulkRecordMovement,
  } = useStockStore();

  useEffect(() => {
    useStockStore.getState().fetchIngredients?.();
    useStockStore.getState().fetchMovements?.();
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        useStockStore.getState().fetchIngredients?.();
        useStockStore.getState().fetchMovements?.();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  // Multi-select state
  const [selectedIngredientIds, setSelectedIngredientIds] = useState([]);
  const [ingredientToDelete, setIngredientToDelete] = useState(null);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);
  const [isExcelImportModalOpen, setIsExcelImportModalOpen] = useState(false);

  const handleExportStock = () => {
    if (!ingredients || ingredients.length === 0) {
      toast.error('Tidak ada data bahan baku untuk diekspor');
      return;
    }
    const exportData = ingredients.map((i) => ({
      'ID': i.id,
      'Nama Bahan': i.name,
      'Satuan': i.unit,
      'Stok Saat Ini': i.stock,
      'Stok Minimum': i.minStock,
      'Harga Modal per Satuan': canViewCost ? (i.costPerUnit || 0) : 'Dirahasiakan',
      'Nama Supplier': i.supplierName || '-',
      'Kontak WA Supplier': i.supplierPhone || '-',
      'Status': Number(i.stock) <= Number(i.minStock) ? 'Menipis' : 'Aman',
    }));
    exportToExcel(exportData, `inventori_bahan_komazi_${new Date().toISOString().slice(0, 10)}.xlsx`, 'Stok Bahan Baku');
    toast.success('Data stok bahan berhasil diekspor ke Excel');
  };
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkMinStockModalOpen, setIsBulkMinStockModalOpen] = useState(false);
  const [bulkMinStockValue, setBulkMinStockValue] = useState(2);
  const [isBulkMovementModalOpen, setIsBulkMovementModalOpen] = useState(false);
  const [bulkMovementType, setBulkMovementType] = useState('PURCHASE');
  const [bulkMovementQty, setBulkMovementQty] = useState(5);
  const [bulkMovementNote, setBulkMovementNote] = useState('');

  // Movement & Modal States
  const [activeMovementType, setActiveMovementType] = useState(null); // 'PURCHASE' | 'ADJUSTMENT' | 'WASTE'
  const [selectedIngredientId, setSelectedIngredientId] = useState(ingredients[0]?.id || 1);
  const [movementQty, setMovementQty] = useState(1);
  const [movementNote, setMovementNote] = useState('');
  const [movementUnitCost, setMovementUnitCost] = useState('');
  const [movementRecordedBy, setMovementRecordedBy] = useState('');

  // Waste reasons presets
  const WASTE_REASONS = [
    'Kalibrasi Grinder / Dial-in Espresso',
    'Basi / Kadaluwarsa (Expired)',
    'Tumpah di Bar / Bocor',
    'Salah Racik Barista (Human Error)',
    'Cacat Kemasan / Rusak Pabrik',
    'Lainnya',
  ];

  const [isAddIngredientOpen, setIsAddIngredientOpen] = useState(false);
  const [newIngData, setNewIngData] = useState({
    name: '',
    unit: 'kg',
    stock: 5,
    minStock: 2,
    costPerUnit: 50000,
    supplierName: '',
    supplierPhone: '',
  });

  const [isEditIngredientOpen, setIsEditIngredientOpen] = useState(false);
  const [editingIngData, setEditingIngData] = useState(null);

  const getWhatsAppRestockUrl = (ing) => {
    if (!ing?.supplierPhone) return null;
    let clean = String(ing.supplierPhone).replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);
    else if (clean.startsWith('8')) clean = '62' + clean;

    const greeting = ing.supplierName ? `Halo ${ing.supplierName}` : 'Halo Supplier';
    const text = `${greeting}, kami dari Komazi Coffee ingin memesan restock bahan:\n\n• Bahan: *${ing.name}*\n• Sisa Stok: ${ing.stock} ${ing.unit}\n• Status: Memerlukan restock segera\n\nMohon konfirmasi stok & harga terbarunya. Terima kasih! 🙏`;
    return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
  };

  // Filter & Pagination States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = usePersistentState('stock_statusFilter', 'ALL'); // 'ALL' | 'LOW_STOCK' | 'SAFE'
  const [unitFilter, setUnitFilter] = usePersistentState('stock_unitFilter', 'ALL');     // 'ALL' | specific unit
  const [sortBy, setSortBy] = usePersistentState('stock_sortBy', 'name_asc');        // 'name_asc' | 'name_desc' | 'stock_asc' | 'stock_desc' | 'cost_desc' | 'cost_asc'
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = usePersistentState('stock_itemsPerPage', 10);
  const [movementPage, setMovementPage] = useState(1);
  const [movementsPerPage, setMovementsPerPage] = usePersistentState('stock_movementsPerPage', 10);
  const [movementSearchQuery, setMovementSearchQuery] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = usePersistentState('stock_movementTypeFilter', 'ALL'); // 'ALL' | 'PURCHASE' | 'WASTE' | 'SALE' | 'ADJUSTMENT'
  const [movementIngredientFilter, setMovementIngredientFilter] = useState('ALL');

  useEffect(() => {
    setMovementPage(1);
  }, [movementTypeFilter, movementIngredientFilter, movementSearchQuery]);

  const movementCounts = useMemo(() => {
    const counts = { ALL: (movements || []).length, PURCHASE: 0, WASTE: 0, SALE: 0, ADJUSTMENT: 0 };
    for (const m of movements || []) {
      if (counts[m.type] !== undefined) {
        counts[m.type]++;
      }
    }
    return counts;
  }, [movements]);

  const filteredMovements = useMemo(() => {
    return (movements || []).filter((m) => {
      if (movementTypeFilter !== 'ALL' && m.type !== movementTypeFilter) {
        return false;
      }
      if (movementIngredientFilter !== 'ALL' && String(m.ingredientId) !== String(movementIngredientFilter)) {
        return false;
      }
      if (movementSearchQuery.trim()) {
        const q = movementSearchQuery.toLowerCase().trim();
        const matchName = (m.ingredientName || '').toLowerCase().includes(q);
        const matchNote = (m.note || '').toLowerCase().includes(q);
        const matchStaff = (m.recordedBy || '').toLowerCase().includes(q);
        if (!matchName && !matchNote && !matchStaff) return false;
      }
      return true;
    });
  }, [movements, movementTypeFilter, movementIngredientFilter, movementSearchQuery]);

  const paginatedMovements = useMemo(() => {
    const start = (movementPage - 1) * movementsPerPage;
    return filteredMovements.slice(start, start + movementsPerPage);
  }, [filteredMovements, movementPage, movementsPerPage]);

  const handleRefreshMovements = async () => {
    try {
      await useStockStore.getState().fetchMovements?.();
      toast.success('Riwayat log stok berhasil diperbarui');
    } catch {
      toast.error('Gagal memperbarui riwayat log stok');
    }
  };

  const handleExportMovements = () => {
    if (!filteredMovements || filteredMovements.length === 0) {
      toast.error('Tidak ada data riwayat pergerakan stok untuk diekspor');
      return;
    }
    const exportData = filteredMovements.map((m, idx) => ({
      'No': idx + 1,
      'Waktu': formatDateTime(m.createdAt),
      'Tipe Mutasi':
        m.type === 'PURCHASE'
          ? 'Masuk / Pembelian'
          : m.type === 'WASTE'
          ? 'Terbuang / Waste'
          : m.type === 'SALE'
          ? 'Penjualan POS'
          : m.type === 'ADJUSTMENT'
          ? 'Penyesuaian Opname'
          : m.type,
      'Nama Bahan': m.ingredientName || '-',
      'Perubahan Qty': `${
        m.type === 'PURCHASE'
          ? '+'
          : m.type === 'WASTE' || m.type === 'SALE'
          ? '-'
          : m.qty >= 0
          ? '+'
          : ''
      }${Math.abs(m.qty)} ${m.unit || ''}`,
      'Satuan': m.unit || '',
      'Keterangan / Alasan': m.note || '-',
      'Dicatat Oleh': m.recordedBy || 'Sistem',
      ...(canViewCost
        ? {
            'Nilai Total': m.totalCost ? formatRupiah(m.totalCost) : '-',
          }
        : {}),
    }));
    exportToExcel(
      exportData,
      `riwayat_mutasi_stok_komazi_${new Date().toISOString().slice(0, 10)}.xlsx`,
      'Log Mutasi Stok'
    );
    toast.success('Riwayat log stok berhasil diekspor ke Excel');
  };

  const lowStock = getLowStockItems();

  // Distinct units for dropdown
  const availableUnits = useMemo(() => {
    const set = new Set(ingredients.map((i) => i.unit).filter(Boolean));
    return Array.from(set).sort();
  }, [ingredients]);

  // Overall counts for tabs
  const counts = useMemo(() => {
    const total = ingredients.length;
    const low = ingredients.filter((i) => Number(i.stock) <= Number(i.minStock)).length;
    const safe = total - low;
    return { total, low, safe };
  }, [ingredients]);

  // Filtered and sorted ingredients list
  const filteredIngredients = useMemo(() => {
    return ingredients
      .filter((ing) => {
        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = (ing.name || '').toLowerCase().includes(q);
          const matchUnit = (ing.unit || '').toLowerCase().includes(q);
          if (!matchName && !matchUnit) return false;
        }

        // Status filter
        const isLow = Number(ing.stock) <= Number(ing.minStock);
        if (statusFilter === 'LOW_STOCK' && !isLow) return false;
        if (statusFilter === 'SAFE' && isLow) return false;

        // Unit filter
        if (unitFilter !== 'ALL' && ing.unit !== unitFilter) return false;

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'name_asc':
            return (a.name || '').localeCompare(b.name || '');
          case 'name_desc':
            return (b.name || '').localeCompare(a.name || '');
          case 'stock_asc':
            return Number(a.stock) - Number(b.stock);
          case 'stock_desc':
            return Number(b.stock) - Number(a.stock);
          case 'cost_desc':
            return (Number(b.costPerUnit) || 0) - (Number(a.costPerUnit) || 0);
          case 'cost_asc':
            return (Number(a.costPerUnit) || 0) - (Number(b.costPerUnit) || 0);
          default:
            return (a.name || '').localeCompare(b.name || '');
        }
      });
  }, [ingredients, searchQuery, statusFilter, unitFilter, sortBy]);

  // Pagination calculation
  const totalFiltered = filteredIngredients.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / itemsPerPage));

  // Reset page to 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, unitFilter, itemsPerPage]);

  // Ensure current page does not exceed total pages
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedIngredients = filteredIngredients.slice(startIndex, startIndex + itemsPerPage);

  // Multi-select helpers
  const allPageSelected =
    paginatedIngredients.length > 0 &&
    paginatedIngredients.every((i) => selectedIngredientIds.includes(i.id));
  const somePageSelected =
    paginatedIngredients.some((i) => selectedIngredientIds.includes(i.id)) && !allPageSelected;
  const allFilteredSelected =
    filteredIngredients.length > 0 &&
    filteredIngredients.every((i) => selectedIngredientIds.includes(i.id));

  const handleToggleSelectPage = () => {
    if (allPageSelected) {
      const pageIdSet = new Set(paginatedIngredients.map((i) => i.id));
      setSelectedIngredientIds((prev) => prev.filter((id) => !pageIdSet.has(id)));
    } else {
      const combined = new Set([
        ...selectedIngredientIds,
        ...paginatedIngredients.map((i) => i.id),
      ]);
      setSelectedIngredientIds(Array.from(combined));
    }
  };

  const handleToggleSelectIngredient = (id) => {
    setSelectedIngredientIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    setSelectedIngredientIds(filteredIngredients.map((i) => i.id));
  };

  const handleOpenMovementModal = (type, ingredientId = null) => {
    setActiveMovementType(type);
    if (ingredientId) setSelectedIngredientId(ingredientId);
    setMovementQty(1);
    setMovementNote(type === 'WASTE' ? WASTE_REASONS[0] : '');
    setMovementUnitCost('');
    setMovementRecordedBy(user?.name || 'Staff');
  };

  const handleSaveMovement = async (e) => {
    e.preventDefault();
    if (activeMovementType === 'WASTE') {
      await recordWaste(
        Number(selectedIngredientId),
        movementQty,
        movementNote || 'Waste / Kalibrasi',
        movementRecordedBy || user?.name || 'Staff'
      );
      toast.success('Pencatatan waste berhasil disimpan');
    } else {
      await recordMovement(
        Number(selectedIngredientId),
        activeMovementType,
        movementQty,
        movementNote,
        movementUnitCost !== '' ? Number(movementUnitCost) : null,
        movementRecordedBy || user?.name || 'Staff'
      );
      toast.success('Mutasi stok berhasil dicatat');
    }
    setActiveMovementType(null);
  };

  const handleOpenEditModal = (ing) => {
    setEditingIngData({
      id: ing.id,
      name: ing.name,
      unit: ing.unit,
      minStock: Number(ing.minStock),
      costPerUnit: Number(ing.costPerUnit || 0),
      supplierName: ing.supplierName || '',
      supplierPhone: ing.supplierPhone || '',
    });
    setIsEditIngredientOpen(true);
  };

  const handleUpdateIngredient = async (e) => {
    e.preventDefault();
    if (!editingIngData) return;
    try {
      await updateIngredient(editingIngData.id, editingIngData);
      toast.success(`Bahan "${editingIngData.name}" berhasil diperbarui`);
      setIsEditIngredientOpen(false);
      setEditingIngData(null);
    } catch (err) {
      toast.error('Gagal memperbarui bahan: ' + err.message);
    }
  };

  const handleCreateIngredient = (e) => {
    e.preventDefault();
    addIngredient(newIngData);
    setIsAddIngredientOpen(false);
    // Reset form
    setNewIngData({
      name: '',
      unit: 'kg',
      stock: 5,
      minStock: 2,
      costPerUnit: 50000,
      supplierName: '',
      supplierPhone: '',
    });
    toast.success('Bahan baku baru berhasil ditambahkan');
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setUnitFilter('ALL');
    setSortBy('name_asc');
    setCurrentPage(1);
  };

  const isFiltered = searchQuery !== '' || statusFilter !== 'ALL' || unitFilter !== 'ALL' || sortBy !== 'name_asc';

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-6 space-y-6 max-w-7xl mx-auto select-none">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-black text-2xl text-komazi-text flex items-center gap-2">
            <Boxes className="w-6 h-6 text-komazi-coral" />
            <span>Sumber Persediaan</span>
          </h1>
          <p className="text-xs text-komazi-muted mt-0.5">
            Kelola sumber persediaan dan tingkat stoknya
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportStock}
            className="px-3 py-2 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-text text-xs font-semibold border border-komazi-border transition-colors flex items-center gap-1.5"
            title="Ekspor daftar bahan baku ke file Excel (.xlsx)"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Ekspor Excel</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExcelImportModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-colors flex items-center gap-1.5 active:scale-95"
            title="Import bahan baku massal dari file Excel atau CSV"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Excel</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddIngredientOpen(true)}
            className="px-4 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Bahan Baru</span>
          </button>
        </div>
      </div>

      {/* 3. Filters & Search Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-komazi-surface border border-komazi-border p-1 rounded-xl overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              statusFilter === 'ALL'
                ? 'bg-komazi-coral text-white shadow-sm'
                : 'text-komazi-muted hover:text-white'
            }`}
          >
            <span>Semua</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                statusFilter === 'ALL'
                  ? 'bg-white/20 text-white'
                  : 'bg-komazi-surface-2 text-komazi-muted'
              }`}
            >
              {counts.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('LOW_STOCK')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              statusFilter === 'LOW_STOCK'
                ? 'bg-warning text-black font-bold shadow-sm'
                : 'text-komazi-muted hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Stok Kritis</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                statusFilter === 'LOW_STOCK'
                  ? 'bg-black/20 text-black'
                  : 'bg-warning/15 text-warning'
              }`}
            >
              {counts.low}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('SAFE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              statusFilter === 'SAFE'
                ? 'bg-success text-white shadow-sm'
                : 'text-komazi-muted hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Stok Aman</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                statusFilter === 'SAFE'
                  ? 'bg-white/20 text-white'
                  : 'bg-success/15 text-success'
              }`}
            >
              {counts.safe}
            </span>
          </button>
        </div>

        {/* Search, Unit Filter & Sorting Dropdown */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-komazi-muted absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari nama bahan / satuan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-komazi-muted hover:text-white"
                title="Hapus pencarian"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Unit Filter Dropdown */}
          <div className="relative">
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none appearance-none pr-8 cursor-pointer font-medium"
            >
              <option value="ALL">Semua Satuan</option>
              {availableUnits.map((u) => (
                <option key={u} value={u}>Satuan: {u}</option>
              ))}
            </select>
            <Filter className="w-3 h-3 text-komazi-muted absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none appearance-none pr-8 cursor-pointer font-medium"
            >
              <option value="name_asc">Nama (A - Z)</option>
              <option value="name_desc">Nama (Z - A)</option>
              <option value="stock_asc">Stok: Terendah</option>
              <option value="stock_desc">Stok: Terbanyak</option>
              {canViewCost && (
                <>
                  <option value="cost_desc">Modal: Tertinggi</option>
                  <option value="cost_asc">Modal: Terendah</option>
                </>
              )}
            </select>
            <ArrowUpDown className="w-3 h-3 text-komazi-muted absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          {/* Reset Filters button if any active */}
          {isFiltered && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-2.5 py-1.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-coral hover:text-white text-xs border border-komazi-border transition-colors whitespace-nowrap font-semibold"
              title="Reset semua filter"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* 4. Ingredients Table */}
      <div className="rounded-2xl border border-komazi-border bg-komazi-surface overflow-hidden">
        <div className="p-4 border-b border-komazi-border flex items-center justify-between">
          <h2 className="font-bold text-sm text-komazi-text">Daftar Bahan</h2>
          <span className="text-xs text-komazi-muted font-medium">
            Total {totalFiltered} dari {ingredients.length} bahan baku
          </span>
        </div>

        {/* Select all across pages banner */}
        {allPageSelected && totalFiltered > paginatedIngredients.length && selectedIngredientIds.length < totalFiltered && (
          <div className="bg-komazi-coral/10 border-b border-komazi-coral/30 px-4 py-2 text-xs flex items-center justify-between text-komazi-text animate-fadeIn">
            <span>
              Semua <strong>{paginatedIngredients.length}</strong> bahan di halaman ini terpilih.
            </span>
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              className="text-komazi-coral hover:underline font-bold text-xs"
            >
              Pilih semua {totalFiltered} bahan hasil pencarian
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-komazi-border bg-komazi-surface-2 text-komazi-muted font-bold uppercase tracking-wider">
              <tr>
                <th className="w-10 py-3 px-3 text-center">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = somePageSelected;
                    }}
                    onChange={handleToggleSelectPage}
                    className="w-4 h-4 rounded border-komazi-border text-komazi-coral focus:ring-komazi-coral bg-komazi-surface cursor-pointer accent-komazi-coral"
                    title={allPageSelected ? 'Batalkan pilihan halaman ini' : 'Pilih semua bahan di halaman ini'}
                  />
                </th>
                <th className="py-3 px-4">Nama Bahan</th>
                <th className="py-3 px-4">Satuan</th>
                <th className="py-3 px-4">Stok Saat Ini</th>
                <th className="py-3 px-4">Batas Min.</th>
                {canViewCost && (
                  <th className="py-3 px-4">Harga Modal</th>
                )}
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-komazi-border">
              {paginatedIngredients.length === 0 ? (
                <tr>
                  <td colSpan={canViewCost ? 8 : 7} className="py-12 text-center text-komazi-muted">
                    <Boxes className="w-8 h-8 text-komazi-muted/40 mx-auto mb-2" />
                    <p className="font-semibold text-komazi-text text-xs">
                      Tidak ada bahan baku yang cocok
                    </p>
                    <p className="text-[11px] text-komazi-muted mt-1">
                      Coba ubah kata kunci pencarian atau sesuaikan pilihan filter status & satuan.
                    </p>
                    {isFiltered && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="mt-3 px-3 py-1.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-xs text-komazi-coral font-bold border border-komazi-border transition-colors"
                      >
                        Reset Filter & Pencarian
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedIngredients.map((ing) => {
                  const isUnderMin = Number(ing.stock) <= Number(ing.minStock);
                  const isSelected = selectedIngredientIds.includes(ing.id);
                  return (
                    <tr
                      key={ing.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-komazi-coral/10 hover:bg-komazi-coral/15'
                          : 'hover:bg-komazi-surface-2/60'
                      }`}
                    >
                      <td className="w-10 py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectIngredient(ing.id)}
                          className="w-4 h-4 rounded border-komazi-border text-komazi-coral focus:ring-komazi-coral bg-komazi-surface cursor-pointer accent-komazi-coral"
                        />
                      </td>
                      <td className="py-3.5 px-4 font-bold text-komazi-text">
                        <div>{ing.name}</div>
                        {(ing.supplierName || ing.supplierPhone) ? (
                          <div className="flex flex-wrap items-center gap-1.5 mt-1 font-normal">
                            {ing.supplierName && (
                              <span className="text-[10px] text-komazi-muted bg-komazi-surface-2 px-1.5 py-0.5 rounded border border-komazi-border">
                                {ing.supplierName}
                              </span>
                            )}
                            {ing.supplierPhone && (
                              <a
                                href={getWhatsAppRestockUrl(ing)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 font-bold bg-emerald-500/15 hover:bg-emerald-500/25 px-1.5 py-0.5 rounded border border-emerald-500/30 transition-colors shadow-sm"
                                title={`Chat WhatsApp ke supplier ${ing.supplierPhone}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MessageCircle className="w-2.5 h-2.5" />
                                <span>Pesan WA</span>
                              </a>
                            )}
                          </div>
                        ) : canViewCost ? (
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(ing)}
                            className="text-[10px] text-komazi-muted/70 hover:text-komazi-coral mt-1 transition-colors flex items-center gap-1 font-normal"
                          >
                            + Atur Supplier
                          </button>
                        ) : null}
                      </td>
                      <td className="py-3.5 px-4 text-komazi-muted uppercase font-semibold">
                        {ing.unit}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-sm text-komazi-text">
                        {ing.stock} <span className="text-xs text-komazi-muted">{ing.unit}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-komazi-muted">
                        {ing.minStock} {ing.unit}
                      </td>
                      {canViewCost && (
                        <td className="py-3.5 px-4 font-mono font-bold text-xs text-komazi-coral">
                          {formatRupiah(ing.costPerUnit || 0)}{' '}
                          <span className="text-[10px] text-komazi-muted font-normal">/{ing.unit}</span>
                        </td>
                      )}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            isUnderMin
                              ? 'bg-warning/15 text-warning border-warning/30 animate-pulse'
                              : 'bg-success/15 text-success border-success/30'
                          }`}
                        >
                          {isUnderMin ? <AlertTriangle className="w-3 h-3" /> : null}
                          <span>{isUnderMin ? 'Stok Kritis' : 'Aman'}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenMovementModal('PURCHASE', ing.id)}
                            className="p-1.5 rounded-lg bg-komazi-surface-2 hover:bg-emerald-500/20 text-emerald-400 border border-komazi-border hover:border-emerald-500/40 transition-all active:scale-95"
                            title="Tambah stok pembelian (Restok)"
                            aria-label="Tambah stok masuk"
                          >
                            <PackagePlus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenMovementModal('ADJUSTMENT', ing.id)}
                            className="p-1.5 rounded-lg bg-komazi-surface-2 hover:bg-amber-500/20 text-amber-400 border border-komazi-border hover:border-amber-500/40 transition-all active:scale-95"
                            title="Penyesuaian stok fisik (Opname)"
                            aria-label="Penyesuaian stok fisik (Opname)"
                          >
                            <ClipboardCheck className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenMovementModal('WASTE', ing.id)}
                            className="p-1.5 rounded-lg bg-komazi-surface-2 hover:bg-rose-500/20 text-rose-400 border border-komazi-border hover:border-rose-500/40 transition-all active:scale-95"
                            title="Catat bahan terbuang / rusak (Waste)"
                            aria-label="Catat bahan terbuang (Waste)"
                          >
                            <PackageX className="w-3.5 h-3.5" />
                          </button>
                          {canViewCost && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(ing)}
                              className="p-1.5 rounded-lg bg-komazi-surface-2 text-komazi-muted hover:text-white hover:bg-komazi-surface border border-komazi-border hover:border-komazi-border-light transition-all active:scale-95"
                              title="Edit bahan baku & supplier"
                              aria-label="Edit bahan baku"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canViewCost && (
                            <button
                              type="button"
                              onClick={() => setIngredientToDelete(ing)}
                              className="p-1.5 rounded-lg bg-komazi-surface-2 text-komazi-muted hover:text-rose-400 hover:bg-rose-500/20 border border-komazi-border hover:border-rose-500/40 transition-all active:scale-95"
                              title="Hapus bahan baku"
                              aria-label="Hapus bahan baku"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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
          totalItems={totalFiltered}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
          itemsPerPageOptions={[5, 10, 15, 25, 50]}
          itemLabel="bahan baku"
        />
      </div>

      {/* Floating Multi-Select Action Bar */}
      {selectedIngredientIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-3xl w-[92%] sm:w-auto bg-komazi-surface/95 backdrop-blur-md border border-komazi-coral/40 shadow-2xl shadow-black/70 rounded-2xl p-2.5 sm:px-4 sm:py-3 flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-start gap-2 sm:gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl bg-komazi-coral/20 border border-komazi-coral/40 text-komazi-coral text-xs font-bold whitespace-nowrap flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>{selectedIngredientIds.length} Bahan Terpilih</span>
            </span>
            <button
              type="button"
              onClick={() => setSelectedIngredientIds([])}
              className="text-[11px] text-komazi-muted hover:text-white underline px-1"
            >
              Batalkan
            </button>
          </div>

          <div className="h-4 w-px bg-komazi-border hidden sm:block" />

          <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => {
                setBulkMovementType('PURCHASE');
                setBulkMovementQty(5);
                setBulkMovementNote('');
                setIsBulkMovementModalOpen(true);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-success/15 hover:bg-success/25 text-success border border-success/30 text-xs font-semibold transition-all flex items-center gap-1 active:scale-95"
              title="Tambah stok pembelian untuk bahan terpilih"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>+ Restok Bersama</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setBulkMinStockValue(2);
                setIsBulkMinStockModalOpen(true);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-text border border-komazi-border text-xs font-semibold transition-all flex items-center gap-1 active:scale-95"
              title="Atur batas minimum stok untuk bahan terpilih"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-komazi-teal-light" />
              <span>Set Min. Stok</span>
            </button>

            {canViewCost && (
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(true)}
                className="px-2.5 py-1.5 rounded-xl bg-danger hover:bg-danger/80 text-white text-xs font-bold transition-all flex items-center gap-1 active:scale-95 shadow-sm"
                title="Hapus bahan terpilih"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus ({selectedIngredientIds.length})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 5. Movement History Log */}
      <div className="rounded-2xl border border-komazi-border bg-komazi-surface overflow-hidden space-y-4 p-4 sm:p-5 shadow-sm">
        {/* Header & Quick Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-komazi-border pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-komazi-coral/15 text-komazi-coral border border-komazi-coral/30 flex items-center justify-center shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-komazi-text">
                  Riwayat Pergerakan Stok
                </h3>
              </div>
              <p className="text-[11px] text-komazi-muted">
                Rekam mutasi stok bahan baku (pembelian masuk, terbuang/waste, penjualan POS, dan stok opname)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleRefreshMovements}
              disabled={isMovementsLoading}
              className="px-3 py-1.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-text border border-komazi-border text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
              title="Perbarui riwayat mutasi stok"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-komazi-teal-light ${isMovementsLoading ? 'animate-spin' : ''}`} />
              <span>Muat Ulang</span>
            </button>

            <button
              type="button"
              onClick={handleExportMovements}
              className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-95"
              title="Ekspor seluruh riwayat mutasi stok ke Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor Excel</span>
            </button>
          </div>
        </div>

        {/* Filter Controls: Type Tabs, Search, Ingredient Select */}
        <div className="space-y-3">
          {/* Movement Type Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'ALL', label: 'Semua', count: movementCounts.ALL },
              { id: 'PURCHASE', label: 'Masuk / Restok', count: movementCounts.PURCHASE, color: 'text-emerald-400' },
              { id: 'WASTE', label: 'Terbuang', count: movementCounts.WASTE, color: 'text-rose-400' },
              { id: 'SALE', label: 'Terjual', count: movementCounts.SALE, color: 'text-sky-400' },
              { id: 'ADJUSTMENT', label: 'Opname / Koreksi', count: movementCounts.ADJUSTMENT, color: 'text-amber-400' },
            ].map((tab) => {
              const active = movementTypeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMovementTypeFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 border active:scale-95 ${
                    active
                      ? 'bg-komazi-coral text-white border-komazi-coral shadow-sm shadow-komazi-coral/20'
                      : 'bg-komazi-surface-2 text-komazi-muted border-komazi-border hover:text-komazi-text hover:bg-komazi-border/50'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      active
                        ? 'bg-black/20 text-white'
                        : 'bg-komazi-surface-3 text-komazi-muted'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search & Specific Ingredient Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <div className="sm:col-span-7 relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-komazi-muted" />
              <input
                type="text"
                value={movementSearchQuery}
                onChange={(e) => setMovementSearchQuery(e.target.value)}
                placeholder="Cari nama bahan, catatan resep/order, atau staf..."
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text placeholder-komazi-muted focus:border-komazi-coral focus:outline-none transition-colors"
              />
              {movementSearchQuery && (
                <button
                  type="button"
                  onClick={() => setMovementSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-komazi-muted hover:text-komazi-text"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="sm:col-span-5">
              <select
                value={movementIngredientFilter}
                onChange={(e) => setMovementIngredientFilter(e.target.value)}
                className="w-full py-2 px-3 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none transition-colors"
              >
                <option value="ALL">Semua Bahan Baku ({ingredients.length})</option>
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name} ({ing.unit})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Movement Cards List */}
        <div className="space-y-2">
          {isMovementsLoading && paginatedMovements.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-komazi-coral mx-auto opacity-80" />
              <p className="text-xs text-komazi-muted">Memuat riwayat pergerakan stok...</p>
            </div>
          ) : paginatedMovements.length === 0 ? (
            <div className="rounded-xl bg-komazi-surface-2 border border-dashed border-komazi-border p-8 text-center space-y-2">
              <History className="w-8 h-8 text-komazi-muted/40 mx-auto" />
              <p className="text-xs font-semibold text-komazi-text">Belum ada riwayat pergerakan stok</p>
              <p className="text-[11px] text-komazi-muted max-w-sm mx-auto">
                {movementSearchQuery || movementTypeFilter !== 'ALL' || movementIngredientFilter !== 'ALL'
                  ? 'Tidak ada catatan mutasi yang cocok dengan filter atau kata kunci pencarian.'
                  : 'Catatan mutasi stok akan muncul secara otomatis saat restok, pesanan POS, waste bahan, atau stok opname dilakukan.'}
              </p>
              {(movementSearchQuery || movementTypeFilter !== 'ALL' || movementIngredientFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setMovementSearchQuery('');
                    setMovementTypeFilter('ALL');
                    setMovementIngredientFilter('ALL');
                  }}
                  className="mt-2 text-xs font-semibold text-komazi-coral hover:underline"
                >
                  Reset Semua Filter
                </button>
              )}
            </div>
          ) : (
            paginatedMovements.map((m) => {
              const isPurchase = m.type === 'PURCHASE';
              const isWaste = m.type === 'WASTE';
              const isSale = m.type === 'SALE';

              const badgeConfig = isPurchase
                ? {
                    label: 'Masuk / Restok',
                    style: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                    qtyColor: 'text-emerald-400',
                    prefix: '+',
                  }
                : isWaste
                ? {
                    label: 'Terbuang / Waste',
                    style: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
                    qtyColor: 'text-rose-400',
                    prefix: '-',
                  }
                : isSale
                ? {
                    label: 'Transaksi Penjualan',
                    style: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
                    qtyColor: 'text-sky-400',
                    prefix: '-',
                  }
                : {
                    label: 'Opname / Koreksi',
                    style: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
                    qtyColor: m.qty >= 0 ? 'text-emerald-400' : 'text-rose-400',
                    prefix: m.qty >= 0 ? '+' : '',
                  };

              const displayQty = `${badgeConfig.prefix}${Math.abs(m.qty)} ${m.unit || ''}`;

              return (
                <div
                  key={m.id}
                  className="p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border hover:border-komazi-coral/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs group"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <span
                      className={`px-2.5 py-1 rounded-lg font-bold text-[10px] tracking-wide border shrink-0 uppercase ${badgeConfig.style}`}
                    >
                      {badgeConfig.label}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-komazi-text text-sm group-hover:text-komazi-coral transition-colors truncate">
                          {m.ingredientName}
                        </p>
                        {m.unit && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-komazi-surface-3 text-komazi-muted font-mono">
                            {m.unit}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-komazi-muted mt-0.5 flex-wrap">
                        <span className="text-neutral-300 font-medium">
                          {m.note || 'Pencatatan manual sistem'}
                        </span>
                        <span>•</span>
                        <span className="text-komazi-muted">
                          oleh: <strong className="text-neutral-300 font-semibold">{m.recordedBy || 'Sistem'}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-left sm:text-right shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-komazi-border/50 flex sm:flex-col justify-between sm:justify-start items-center sm:items-end">
                    <div>
                      <p className={`font-mono font-bold text-sm ${badgeConfig.qtyColor}`}>
                        {displayQty}
                      </p>
                      {canViewCost && m.totalCost && Number(m.totalCost) > 0 && (
                        <p className="text-[10px] text-komazi-muted font-mono">
                          Total: {formatRupiah(m.totalCost)}
                        </p>
                      )}
                    </div>
                    <p className="text-[10px] text-komazi-muted font-mono">
                      {formatDateTime(m.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Controls for Movements */}
        <Pagination
          currentPage={movementPage}
          totalItems={filteredMovements.length}
          itemsPerPage={movementsPerPage}
          onPageChange={setMovementPage}
          onItemsPerPageChange={setMovementsPerPage}
          itemLabel="log pergerakan"
        />
      </div>

      {/* Modal: Movement (Purchase, Adjustment, Waste) */}
      {activeMovementType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-komazi-border">
              <h3 className="font-bold text-base text-komazi-text flex items-center gap-2">
                {activeMovementType === 'PURCHASE' && <span>Pencatatan Stok Masuk</span>}
                {activeMovementType === 'ADJUSTMENT' && <span>Penyesuaian Fisik (Opname)</span>}
                {activeMovementType === 'WASTE' && (
                  <>
                    <Trash2 className="w-4 h-4 text-danger" />
                    <span>Catat Bahan Terbuang (Waste)</span>
                  </>
                )}
              </h3>
            </div>

            <form onSubmit={handleSaveMovement} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                  Pilih Bahan Baku:
                </label>
                <select
                  value={selectedIngredientId}
                  onChange={(e) => setSelectedIngredientId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
                >
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.stock} {ing.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                  {activeMovementType === 'ADJUSTMENT'
                    ? 'Jumlah Stok Fisik Sebenarnya:'
                    : activeMovementType === 'WASTE'
                    ? 'Jumlah Bahan Terbuang:'
                    : 'Jumlah Qty:'}
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={movementQty}
                  onChange={(e) => setMovementQty(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs font-mono font-bold text-komazi-text focus:border-komazi-coral focus:outline-none"
                />
              </div>

              {activeMovementType === 'PURCHASE' && canViewCost && (
                <div>
                  <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                    Harga Beli per Satuan (Opsional - Perbarui Modal):
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Kosongkan jika sesuai modal saat ini"
                    value={movementUnitCost}
                    onChange={(e) => setMovementUnitCost(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs font-mono font-bold text-komazi-text focus:border-komazi-coral focus:outline-none"
                  />
                </div>
              )}

              {activeMovementType === 'WASTE' && (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                      Penyebab / Alasan Waste:
                    </label>
                    <select
                      value={movementNote}
                      onChange={(e) => setMovementNote(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
                    >
                      {WASTE_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                      Catatan Tambahan (Opsional):
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Kalibrasi shot ke-3 over-extracted / tumpah saat rush hour..."
                      value={movementNote && !WASTE_REASONS.includes(movementNote) ? movementNote : ''}
                      onChange={(e) => setMovementNote(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
                    />
                  </div>

                  {/* Financial Loss Preview Banner */}
                  {(() => {
                    const sel = ingredients.find((i) => i.id === Number(selectedIngredientId));
                    const estLoss = Math.round((Number(movementQty) || 0) * (Number(sel?.costPerUnit) || 0));
                    return (
                      <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 flex items-center justify-between text-xs">
                        <span className="text-komazi-muted font-medium">Estimasi Kerugian Biaya:</span>
                        <span className="font-mono font-bold text-danger text-sm">
                          {canViewCost ? formatRupiah(estLoss) : 'Tercatat di Laporan P&L'}
                        </span>
                      </div>
                    );
                  })()}

                  <div>
                    <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                      Staf Pencatat:
                    </label>
                    <input
                      type="text"
                      required
                      value={movementRecordedBy}
                      onChange={(e) => setMovementRecordedBy(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
                    />
                  </div>
                </>
              )}

              {activeMovementType !== 'WASTE' && (
                <div>
                  <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                    Keterangan / Catatan:
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Pembelian supplier Tanamera / penyesuaian opname..."
                    value={movementNote}
                    onChange={(e) => setMovementNote(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
                  />
                </div>
              )}

              <div className="pt-2 flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setActiveMovementType(null)}
                  className="flex-1 py-2.5 rounded-xl bg-komazi-surface-2 text-komazi-muted hover:text-white font-semibold text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2.5 rounded-xl text-white font-bold text-xs shadow-md ${
                    activeMovementType === 'WASTE'
                      ? 'bg-danger hover:bg-danger/80'
                      : 'bg-komazi-coral hover:bg-komazi-coral-dark'
                  }`}
                >
                  {activeMovementType === 'WASTE' ? 'Catat Kerugian Waste' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add New Ingredient */}
      {isAddIngredientOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-komazi-border">
              <h3 className="font-bold text-base text-komazi-text">Tambah Bahan Baku Baru</h3>
            </div>

            <form onSubmit={handleCreateIngredient} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                  Nama Bahan Baku:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Sirup Hazelnut Monin"
                  value={newIngData.name}
                  onChange={(e) => setNewIngData({ ...newIngData, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                    Satuan Ukur:
                  </label>
                  <select
                    value={newIngData.unit}
                    onChange={(e) => setNewIngData({ ...newIngData, unit: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
                  >
                    <option value="kg">kg (Kilogram)</option>
                    <option value="gram">gram</option>
                    <option value="liter">liter</option>
                    <option value="ml">ml (Mililiter)</option>
                    <option value="pcs">pcs (Pieces)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                    Batas Minimum:
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newIngData.minStock}
                    onChange={(e) => setNewIngData({ ...newIngData, minStock: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs font-mono text-komazi-text focus:border-komazi-coral focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                  Stok Awal:
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={newIngData.stock}
                  onChange={(e) => setNewIngData({ ...newIngData, stock: Number(e.target.value) })}
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs font-mono text-komazi-text focus:border-komazi-coral focus:outline-none"
                />
              </div>

              {canViewCost && (
                <div>
                  <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                    Harga Modal Standar (Rp / {newIngData.unit}):
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newIngData.costPerUnit}
                    onChange={(e) => setNewIngData({ ...newIngData, costPerUnit: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs font-mono font-bold text-komazi-text focus:border-komazi-coral focus:outline-none"
                  />
                </div>
              )}

              <div className="pt-2 border-t border-komazi-border">
                <span className="text-[11px] font-bold text-komazi-coral uppercase tracking-wider block mb-2">
                  Kontak Restock Supplier
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                      Nama Supplier:
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: PT Sukanda Djaya"
                      value={newIngData.supplierName}
                      onChange={(e) => setNewIngData({ ...newIngData, supplierName: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                      No. WhatsApp:
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: 08123456789"
                      value={newIngData.supplierPhone}
                      onChange={(e) => setNewIngData({ ...newIngData, supplierPhone: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddIngredientOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-komazi-surface-2 text-komazi-muted hover:text-white font-semibold text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md"
                >
                  Simpan Bahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Ingredient & Supplier */}
      {isEditIngredientOpen && editingIngData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-komazi-border">
              <h3 className="font-bold text-base text-komazi-text flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-komazi-coral" />
                <span>Edit Bahan Baku & Supplier</span>
              </h3>
            </div>

            <form onSubmit={handleUpdateIngredient} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                  Nama Bahan Baku:
                </label>
                <input
                  type="text"
                  required
                  value={editingIngData.name}
                  onChange={(e) => setEditingIngData({ ...editingIngData, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                    Satuan Ukur:
                  </label>
                  <select
                    value={editingIngData.unit}
                    onChange={(e) => setEditingIngData({ ...editingIngData, unit: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
                  >
                    <option value="kg">kg (Kilogram)</option>
                    <option value="gram">gram</option>
                    <option value="liter">liter</option>
                    <option value="ml">ml (Mililiter)</option>
                    <option value="pcs">pcs (Pieces)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                    Batas Minimum:
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editingIngData.minStock}
                    onChange={(e) => setEditingIngData({ ...editingIngData, minStock: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs font-mono text-komazi-text focus:border-komazi-coral focus:outline-none"
                  />
                </div>
              </div>

              {canViewCost && (
                <div>
                  <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                    Harga Modal Standar (Rp / {editingIngData.unit}):
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editingIngData.costPerUnit}
                    onChange={(e) => setEditingIngData({ ...editingIngData, costPerUnit: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs font-mono font-bold text-komazi-text focus:border-komazi-coral focus:outline-none"
                  />
                </div>
              )}

              <div className="pt-2 border-t border-komazi-border">
                <span className="text-[11px] font-bold text-komazi-coral uppercase tracking-wider block mb-2">
                  Kontak Restock Supplier
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                      Nama Supplier:
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Toffin Indonesia"
                      value={editingIngData.supplierName}
                      onChange={(e) => setEditingIngData({ ...editingIngData, supplierName: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                      No. WhatsApp:
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: 08123456789"
                      value={editingIngData.supplierPhone}
                      onChange={(e) => setEditingIngData({ ...editingIngData, supplierPhone: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditIngredientOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-komazi-surface-2 text-komazi-muted hover:text-white font-semibold text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Single Delete Alert Modal */}
      <AlertModal
        isOpen={!!ingredientToDelete}
        onClose={() => !isDeletingSingle && setIngredientToDelete(null)}
        isProcessing={isDeletingSingle}
        onConfirm={async () => {
          if (!ingredientToDelete) return;
          setIsDeletingSingle(true);
          try {
            const res = await deleteIngredient(ingredientToDelete.id);
            if (res?.success) {
              toast.success(res.message || `Bahan baku "${ingredientToDelete.name}" berhasil dihapus.`);
              setSelectedIngredientIds((prev) => prev.filter((id) => id !== ingredientToDelete.id));
              setIngredientToDelete(null);
            } else {
              toast.error(res?.message || 'Gagal menghapus bahan baku');
            }
          } finally {
            setIsDeletingSingle(false);
          }
        }}
        type="danger"
        title="Hapus Bahan Baku?"
        message={`Apakah Anda yakin ingin menghapus "${ingredientToDelete?.name}"? Data resep dan riwayat mutasi terkait bahan ini akan dibersihkan secara aman.`}
        confirmText="Ya, Hapus Bahan"
        cancelText="Batal"
      />

      {/* Bulk Delete Alert Modal */}
      <AlertModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => !isDeletingBulk && setIsBulkDeleteModalOpen(false)}
        isProcessing={isDeletingBulk}
        onConfirm={async () => {
          if (selectedIngredientIds.length === 0) return;
          setIsDeletingBulk(true);
          try {
            const res = await bulkDeleteIngredients(selectedIngredientIds);
            if (res?.success) {
              toast.success(res.message || `${res.count || selectedIngredientIds.length} bahan baku berhasil dihapus.`);
              setSelectedIngredientIds([]);
              setIsBulkDeleteModalOpen(false);
            } else {
              toast.error(res?.message || 'Gagal menghapus bahan baku terpilih');
            }
          } finally {
            setIsDeletingBulk(false);
          }
        }}
        type="danger"
        title={`Hapus ${selectedIngredientIds.length} Bahan Baku Terpilih?`}
        message={`Apakah Anda yakin ingin menghapus ${selectedIngredientIds.length} bahan baku yang dipilih? Data resep dan riwayat mutasi terkait bahan-bahan ini akan dibersihkan secara aman.`}
        confirmText={`Ya, Hapus ${selectedIngredientIds.length} Bahan`}
        cancelText="Batal"
      />

      {/* Bulk Min Stock Modal */}
      {isBulkMinStockModalOpen && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn select-none">
          <div className="w-full max-w-sm bg-komazi-surface border border-komazi-border rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-komazi-border">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-komazi-teal/15 border border-komazi-teal-light/30 flex items-center justify-center text-komazi-teal-light">
                  <SlidersHorizontal className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-komazi-text">Atur Batas Min. Stok</h3>
                  <p className="text-[11px] text-komazi-muted">{selectedIngredientIds.length} bahan terpilih</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkMinStockModalOpen(false)}
                className="text-komazi-muted hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                bulkUpdateMinStock(selectedIngredientIds, bulkMinStockValue);
                toast.success(
                  `Batas minimum stok diperbarui menjadi ${bulkMinStockValue} untuk ${selectedIngredientIds.length} bahan baku.`
                );
                setSelectedIngredientIds([]);
                setIsBulkMinStockModalOpen(false);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold uppercase text-komazi-muted mb-1.5">
                  Nilai Batas Minimum Baru:
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={bulkMinStockValue}
                  onChange={(e) => setBulkMinStockValue(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs font-mono font-bold text-komazi-text focus:border-komazi-coral focus:outline-none"
                  placeholder="Contoh: 2"
                />
                <p className="text-[10px] text-komazi-muted mt-1">
                  Bahan akan otomatis ditandai "Stok Kritis" jika stoknya kurang dari atau sama dengan nilai ini.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBulkMinStockModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-komazi-muted hover:text-white hover:bg-komazi-surface-2 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-komazi-coral hover:bg-komazi-coral-dark text-white shadow-md transition-all active:scale-95"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Stock Movement Modal */}
      {isBulkMovementModalOpen && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn select-none">
          <div className="w-full max-w-sm bg-komazi-surface border border-komazi-border rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-komazi-border">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-success/15 border border-success/30 flex items-center justify-center text-success">
                  <ArrowUpRight className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-komazi-text">Restok Bahan Bersama</h3>
                  <p className="text-[11px] text-komazi-muted">{selectedIngredientIds.length} bahan terpilih</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkMovementModalOpen(false)}
                className="text-komazi-muted hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                bulkRecordMovement(
                  selectedIngredientIds,
                  bulkMovementType,
                  bulkMovementQty,
                  bulkMovementNote || 'Restok batch multi-select'
                );
                toast.success(
                  `Berhasil mencatat stok masuk (+${bulkMovementQty}) untuk ${selectedIngredientIds.length} bahan baku.`
                );
                setSelectedIngredientIds([]);
                setIsBulkMovementModalOpen(false);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold uppercase text-komazi-muted mb-1.5">
                  Jumlah Tambahan per Bahan:
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  required
                  value={bulkMovementQty}
                  onChange={(e) => setBulkMovementQty(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs font-mono font-bold text-komazi-text focus:border-komazi-coral focus:outline-none"
                  placeholder="Contoh: 5"
                />
                <p className="text-[10px] text-komazi-muted mt-1">
                  Jumlah ini akan ditambahkan ke masing-masing bahan terpilih sesuai satuannya.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-komazi-muted mb-1.5">
                  Catatan / Keterangan (Opsional):
                </label>
                <input
                  type="text"
                  value={bulkMovementNote}
                  onChange={(e) => setBulkMovementNote(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
                  placeholder="Contoh: Pengiriman supplier mingguan"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBulkMovementModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-komazi-muted hover:text-white hover:bg-komazi-surface-2 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-success hover:bg-success/80 text-white shadow-md transition-all active:scale-95"
                >
                  Simpan Restok
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Excel Import Modal */}
      <ExcelImportModal
        isOpen={isExcelImportModalOpen}
        onClose={() => setIsExcelImportModalOpen(false)}
        title="Import Inventori Bahan Baku"
        type="INGREDIENT"
        onSuccess={() => {
          useStockStore.getState().fetchIngredients();
          toast.success('Bahan baku berhasil diimpor!');
        }}
      />
    </div>
  );
}
