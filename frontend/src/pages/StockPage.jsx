import React, { useState, useMemo, useEffect } from 'react';
import { useStockStore } from '../store/stockStore';
import { useAuthStore } from '../store/authStore';
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
} from 'lucide-react';
import AlertModal from '../components/ui/AlertModal';
import Pagination from '../components/ui/Pagination';
import { toast } from '../store/toastStore';

export default function StockPage() {
  const { user } = useAuthStore();
  const canViewCost = user?.role === 'OWNER' || user?.role === 'MANAGER';

  const {
    ingredients,
    movements,
    addIngredient,
    recordMovement,
    getLowStockItems,
    bulkDeleteIngredients,
    bulkUpdateMinStock,
    bulkRecordMovement,
  } = useStockStore();

  // Multi-select state
  const [selectedIngredientIds, setSelectedIngredientIds] = useState([]);
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

  const [isAddIngredientOpen, setIsAddIngredientOpen] = useState(false);
  const [newIngData, setNewIngData] = useState({
    name: '',
    unit: 'kg',
    stock: 5,
    minStock: 2,
    costPerUnit: 50000,
  });

  // Filter & Pagination States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'LOW_STOCK' | 'SAFE'
  const [unitFilter, setUnitFilter] = useState('ALL');     // 'ALL' | specific unit
  const [sortBy, setSortBy] = useState('name_asc');        // 'name_asc' | 'name_desc' | 'stock_asc' | 'stock_desc' | 'cost_desc' | 'cost_asc'
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [movementPage, setMovementPage] = useState(1);
  const [movementsPerPage, setMovementsPerPage] = useState(10);

  const paginatedMovements = useMemo(() => {
    const start = (movementPage - 1) * movementsPerPage;
    return movements.slice(start, start + movementsPerPage);
  }, [movements, movementPage, movementsPerPage]);

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
    setMovementNote('');
    setMovementUnitCost('');
  };

  const handleSaveMovement = (e) => {
    e.preventDefault();
    recordMovement(
      Number(selectedIngredientId),
      activeMovementType,
      movementQty,
      movementNote,
      movementUnitCost !== '' ? Number(movementUnitCost) : null
    );
    setActiveMovementType(null);
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
    });
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
            <span>Inventori & Stok Bahan Baku</span>
          </h1>
          <p className="text-xs text-komazi-muted mt-0.5">
            Pantau stok biji kopi, susu, sirup, cup, atur harga modal, dan catat pembelian serta waste bahan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenMovementModal('PURCHASE')}
            className="px-3.5 py-2 rounded-xl bg-success/15 hover:bg-success/25 text-success border border-success/30 text-xs font-bold transition-colors flex items-center gap-1.5 active:scale-95"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>+ Stok Masuk</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenMovementModal('WASTE')}
            className="px-3.5 py-2 rounded-xl bg-danger/15 hover:bg-danger/25 text-danger border border-danger/30 text-xs font-bold transition-colors flex items-center gap-1.5 active:scale-95"
          >
            <ArrowDownRight className="w-4 h-4" />
            <span>Catat Waste</span>
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

      {/* 2. Low Stock Warning Banner if any */}
      {lowStock.length > 0 && (
        <div className="p-4 rounded-2xl bg-warning/10 border border-warning/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-warning/20 text-warning shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-warning">
                Peringatan: {lowStock.length} Bahan Mencapai Batas Minimum!
              </h3>
              <p className="text-xs text-komazi-muted mt-0.5 line-clamp-1">
                {lowStock.map((i) => `${i.name} (Sisa ${i.stock} ${i.unit})`).join(', ')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('LOW_STOCK');
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 rounded-xl bg-warning hover:bg-warning/90 text-black font-bold text-xs shrink-0 transition-colors"
          >
            Lihat Bahan Kritis
          </button>
        </div>
      )}

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
          <h2 className="font-bold text-sm text-komazi-text">Daftar Bahan & Level Stok</h2>
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
                        {ing.name}
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
                            className="px-2 py-1 rounded-lg bg-komazi-surface-2 hover:bg-success/20 hover:text-success text-komazi-muted text-[11px] font-semibold border border-komazi-border transition-colors"
                            title="Tambah stok pembelian"
                          >
                            + Masuk
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenMovementModal('ADJUSTMENT', ing.id)}
                            className="px-2 py-1 rounded-lg bg-komazi-surface-2 hover:bg-komazi-teal/20 hover:text-komazi-teal-light text-komazi-muted text-[11px] font-semibold border border-komazi-border transition-colors"
                            title="Penyesuaian stok fisik (Opname)"
                          >
                            Opname
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenMovementModal('WASTE', ing.id)}
                            className="px-2 py-1 rounded-lg bg-komazi-surface-2 hover:bg-danger/20 hover:text-danger text-komazi-muted text-[11px] font-semibold border border-komazi-border transition-colors"
                            title="Catat bahan terbuang"
                          >
                            Waste
                          </button>
                          {canViewCost && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedIngredientIds([ing.id]);
                                setIsBulkDeleteModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-komazi-muted hover:text-danger hover:bg-danger/10 transition-colors"
                              title="Hapus bahan baku"
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
      <div className="rounded-2xl border border-komazi-border bg-komazi-surface overflow-hidden space-y-3 p-4">
        <h3 className="font-bold text-sm text-komazi-text flex items-center gap-2">
          <History className="w-4 h-4 text-komazi-coral" />
          <span>Riwayat Log Pergerakan Stok</span>
        </h3>

        <div className="space-y-2">
          {paginatedMovements.length === 0 ? (
            <p className="text-xs text-komazi-muted text-center py-6">Belum ada riwayat pergerakan stok.</p>
          ) : (
            paginatedMovements.map((m) => (
              <div
                key={m.id}
                className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${
                      m.type === 'PURCHASE'
                        ? 'bg-success/15 text-success border-success/30'
                        : m.type === 'WASTE'
                        ? 'bg-danger/15 text-danger border-danger/30'
                        : 'bg-komazi-teal/15 text-komazi-teal-light border-komazi-teal/30'
                    }`}
                  >
                    {m.type}
                  </span>
                  <div>
                    <p className="font-semibold text-komazi-text">{m.ingredientName}</p>
                    <p className="text-[10px] text-komazi-muted">{m.note || 'Pencatatan manual'}</p>
                  </div>
                </div>

                <div className="text-right">
                  <p
                    className={`font-mono font-bold ${
                      m.qty >= 0 ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {m.qty >= 0 ? `+${m.qty}` : m.qty} {m.unit}
                  </p>
                  <p className="text-[10px] text-komazi-muted">{formatDateTime(m.createdAt)}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination Controls for Movements */}
        <Pagination
          currentPage={movementPage}
          totalItems={movements.length}
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
              <h3 className="font-bold text-base text-komazi-text">
                {activeMovementType === 'PURCHASE' && 'Pencatatan Stok Masuk (Pembelian)'}
                {activeMovementType === 'ADJUSTMENT' && 'Penyesuaian Fisik (Stock Opname)'}
                {activeMovementType === 'WASTE' && 'Pencatatan Bahan Terbuang (Waste)'}
              </h3>
              <button
                type="button"
                onClick={() => setActiveMovementType(null)}
                className="text-komazi-muted hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
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

              <div>
                <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                  Keterangan / Catatan:
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Pembelian supplier Tanamera / tumpah di bar..."
                  value={movementNote}
                  onChange={(e) => setMovementNote(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
                />
              </div>

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
                  className="flex-1 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md"
                >
                  Simpan Perubahan
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
              <button
                type="button"
                onClick={() => setIsAddIngredientOpen(false)}
                className="text-komazi-muted hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
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

      {/* Bulk Delete Alert Modal */}
      <AlertModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={() => {
          bulkDeleteIngredients(selectedIngredientIds);
          toast.success(`${selectedIngredientIds.length} bahan baku berhasil dihapus.`);
          setSelectedIngredientIds([]);
          setIsBulkDeleteModalOpen(false);
        }}
        type="danger"
        title={`Hapus ${selectedIngredientIds.length} Bahan Baku Terpilih?`}
        message={`Apakah Anda yakin ingin menghapus ${selectedIngredientIds.length} bahan baku yang dipilih? Riwayat mutasi tetap tersimpan namun bahan tidak akan muncul di daftar inventori atau resep.`}
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
    </div>
  );
}
