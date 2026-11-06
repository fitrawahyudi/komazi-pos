import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Boxes,
  Scale,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Coins,
  PackageCheck,
  AlertCircle,
  ExternalLink,
  Sliders,
  Layers,
  Sparkles,
  Info,
  History,
  RefreshCw,
  Search,
  ArrowDownRight,
  ArrowUpRight,
  ArrowRight,
  User,
  Filter,
} from 'lucide-react';
import api from '../../services/api';
import Pagination from '../ui/Pagination';
import { useRecipeStore } from '../../store/useRecipeStore';
import { useStockStore } from '../../store/stockStore';
import { useAuthStore } from '../../store/authStore';
import { formatRupiah, getProductInitials } from '../../utils/format';

function formatMovementDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ProductStockRecipeModal({
  isOpen,
  onClose,
  product,
  onOpenEditRecipe,
}) {
  const { fetchRecipe } = useRecipeStore();
  const { ingredients, fetchIngredients } = useStockStore();
  const { user } = useAuthStore();
  const canManageRecipe = user?.role === 'OWNER' || user?.role === 'MANAGER';
  const canViewCost = user?.role === 'OWNER' || user?.role === 'MANAGER';

  // Navigation tab: 'RECIPE' | 'MOVEMENTS'
  const [activeTab, setActiveTab] = useState('RECIPE');

  const [loading, setLoading] = useState(false);
  const [recipeData, setRecipeData] = useState(null);
  const [selectedVariantId, setSelectedVariantId] = useState(null);

  // Stock movements state
  const [movements, setMovements] = useState([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [movementsTotal, setMovementsTotal] = useState(0);
  const [movementPage, setMovementPage] = useState(1);
  const [movementsPerPage, setMovementsPerPage] = useState(10);
  const [selectedIngFilter, setSelectedIngFilter] = useState('ALL');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Reset tab on modal open
  useEffect(() => {
    if (isOpen) {
      setActiveTab('RECIPE');
      setSelectedIngFilter('ALL');
      setSelectedTypeFilter('ALL');
      setSearchQuery('');
      setMovementPage(1);
    }
  }, [isOpen, product?.id]);

  // Load recipe & ingredients whenever modal opens
  useEffect(() => {
    if (!isOpen || !product?.id) {
      setRecipeData(null);
      setSelectedVariantId(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    Promise.all([
      fetchRecipe(product.id),
      fetchIngredients(),
    ])
      .then(([resRecipe]) => {
        if (!isMounted) return;
        setRecipeData(resRecipe);
      })
      .catch((err) => {
        console.error('Failed to load recipe details:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, product?.id]);

  // Ingredients map for live real-time stock
  const ingredientsMap = useMemo(() => {
    const map = new Map();
    ingredients.forEach((ing) => {
      map.set(Number(ing.id), ing);
    });
    return map;
  }, [ingredients]);

  // Raw recipe items from fetched recipe or product
  const rawItems = useMemo(() => {
    return recipeData?.recipeItems || [];
  }, [recipeData]);

  // Available variants on this product
  const variants = useMemo(() => {
    return product?.variants || recipeData?.variants || [];
  }, [product, recipeData]);

  // Filter items based on selected variant:
  const activeItems = useMemo(() => {
    if (!rawItems || rawItems.length === 0) return [];
    if (!selectedVariantId) {
      return rawItems.filter((item) => item.variantId === null);
    }
    return rawItems.filter(
      (item) => item.variantId === null || Number(item.variantId) === Number(selectedVariantId)
    );
  }, [rawItems, selectedVariantId]);

  // Enriched items with live stock & portion math
  const enrichedItems = useMemo(() => {
    return activeItems.map((item) => {
      const liveIng = ingredientsMap.get(Number(item.ingredientId));
      const ingName = liveIng?.name || item.ingredientName || 'Bahan Baku';
      const unit = liveIng?.unit || item.ingredientUnit || 'unit';
      const currentStock = liveIng ? Number(liveIng.stock) : Number(item.stock) || 0;
      const minStock = liveIng ? Number(liveIng.minStock) : Number(item.minStock) || 0;
      const costPerUnit = liveIng ? Number(liveIng.costPerUnit) : Number(item.costPerUnit) || 0;
      const takeQty = Number(item.quantity) || 0;
      const lineCost = Math.round(takeQty * costPerUnit * 100) / 100;

      // Portion estimate from this specific ingredient
      const portionEstimate = takeQty > 0 ? Math.floor(currentStock / takeQty) : 0;

      // Status
      let status = 'SAFE';
      let statusLabel = 'Stok Aman';
      let statusColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      if (currentStock <= 0) {
        status = 'EMPTY';
        statusLabel = 'Habis';
        statusColor = 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      } else if (currentStock <= minStock || portionEstimate <= 5) {
        status = 'LOW';
        statusLabel = 'Menipis';
        statusColor = 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      }

      return {
        ...item,
        ingName,
        unit,
        currentStock,
        minStock,
        costPerUnit,
        takeQty,
        lineCost,
        portionEstimate,
        status,
        statusLabel,
        statusColor,
      };
    });
  }, [activeItems, ingredientsMap]);

  // Overall menu portion availability based on the bottleneck ingredient
  const bottleneckSummary = useMemo(() => {
    if (enrichedItems.length === 0) {
      return {
        hasRecipe: false,
        totalPortions: 0,
        bottleneckItem: null,
        status: 'NO_RECIPE',
      };
    }

    let minPortions = Infinity;
    let bottleneck = null;

    enrichedItems.forEach((item) => {
      if (item.portionEstimate < minPortions) {
        minPortions = item.portionEstimate;
        bottleneck = item;
      }
    });

    const safePortions = minPortions === Infinity ? 0 : Math.max(0, minPortions);

    let status = 'SAFE';
    if (safePortions === 0) {
      status = 'EMPTY';
    } else if (safePortions <= 10) {
      status = 'LOW';
    }

    return {
      hasRecipe: true,
      totalPortions: safePortions,
      bottleneckItem: bottleneck,
      status,
    };
  }, [enrichedItems]);

  // Financial calculations
  const totalHpp = useMemo(() => {
    return enrichedItems.reduce((sum, item) => sum + item.lineCost, 0);
  }, [enrichedItems]);

  const sellingPrice = useMemo(() => {
    let price = Number(product?.price) || 0;
    if (selectedVariantId) {
      const selVar = variants.find((v) => Number(v.id) === Number(selectedVariantId));
      if (selVar) {
        price += Number(selVar.extraPrice || selVar.price || 0);
      }
    }
    return price;
  }, [product, selectedVariantId, variants]);

  const grossProfit = Math.max(0, sellingPrice - totalHpp);
  const marginPercent = sellingPrice > 0 ? Math.round(((sellingPrice - totalHpp) / sellingPrice) * 1000) / 10 : 0;

  // List of all unique ingredients linked to this product (across base & variants)
  const productIngredientsList = useMemo(() => {
    const map = new Map();
    rawItems.forEach((item) => {
      const liveIng = ingredientsMap.get(Number(item.ingredientId));
      const id = Number(item.ingredientId);
      const name = liveIng?.name || item.ingredientName || `Bahan #${id}`;
      const unit = liveIng?.unit || item.ingredientUnit || 'unit';
      if (!map.has(id)) {
        map.set(id, { id, name, unit });
      }
    });

    // Fallback: if no recipe items, check if any master ingredient matches product name
    if (map.size === 0 && ingredients.length > 0 && product?.name) {
      const pName = String(product.name).toLowerCase().trim();
      const match = ingredients.find(
        (ing) => String(ing.name).toLowerCase().trim() === pName
      );
      if (match) {
        map.set(Number(match.id), { id: Number(match.id), name: match.name, unit: match.unit });
      }
    }

    return Array.from(map.values());
  }, [rawItems, ingredientsMap, ingredients, product?.name]);

  // All ingredient IDs relevant to this product
  const relevantIngredientIds = useMemo(() => {
    return productIngredientsList.map((item) => item.id);
  }, [productIngredientsList]);

  // Reset page when filters or search change
  const handleFilterChange = (setter) => (val) => {
    setter(val);
    setMovementPage(1);
  };

  // Fetch stock movements for relevant ingredients
  const loadMovements = useCallback(async () => {
    if (!isOpen || relevantIngredientIds.length === 0) {
      setMovements([]);
      setMovementsTotal(0);
      return;
    }

    try {
      setMovementsLoading(true);
      const params = {
        page: movementPage,
        limit: movementsPerPage,
      };

      if (selectedIngFilter && selectedIngFilter !== 'ALL') {
        params.ingredientId = selectedIngFilter;
      } else {
        params.ingredientIds = relevantIngredientIds.join(',');
      }

      if (selectedTypeFilter && selectedTypeFilter !== 'ALL') {
        params.type = selectedTypeFilter;
      }

      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const res = await api.stock.getMovements(params);
      if (res && res.success && Array.isArray(res.data)) {
        setMovements(res.data);
        setMovementsTotal(res.meta?.total ?? res.data.length);
      } else {
        setMovements([]);
        setMovementsTotal(0);
      }
    } catch (err) {
      console.error('Failed to load stock movements for product:', err);
      setMovements([]);
      setMovementsTotal(0);
    } finally {
      setMovementsLoading(false);
    }
  }, [isOpen, relevantIngredientIds, selectedIngFilter, selectedTypeFilter, searchQuery, movementPage, movementsPerPage]);

  // Fetch movements whenever user switches to MOVEMENTS tab, page changes, or filters change
  useEffect(() => {
    if (activeTab === 'MOVEMENTS' && relevantIngredientIds.length > 0) {
      loadMovements();
    }
  }, [activeTab, loadMovements, relevantIngredientIds.length]);

  if (!isOpen || !product) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/80 backdrop-blur-md p-3 sm:p-4 flex items-center justify-center animate-in fade-in duration-200"
    >
      <div className="w-full max-w-4xl rounded-3xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)] my-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-komazi-border flex items-center justify-between bg-komazi-surface shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold shadow-inner">
              <Boxes className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                  Lacak Sumber Persediaan
                </span>
                <span className="text-[11px] text-komazi-muted">
                  {product.categoryName || product.category?.name || 'Menu'}
                </span>
              </div>
              <h2 className="font-display font-black text-lg sm:text-xl text-komazi-text mt-0.5">
                {product.name}
              </h2>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-4 sm:px-6 pt-3 pb-2.5 border-b border-komazi-border bg-komazi-surface shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('RECIPE')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'RECIPE'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
                : 'text-komazi-muted hover:text-komazi-text hover:bg-komazi-surface-2 border border-transparent'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Komposisi & Estimasi Porsi</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('MOVEMENTS')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'MOVEMENTS'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
                : 'text-komazi-muted hover:text-komazi-text hover:bg-komazi-surface-2 border border-transparent'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Riwayat Pergerakan Stok</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain space-y-5 flex-1 text-xs">
          {/* TAB 1: KOMPOSISI & ESTIMASI PORSI */}
          {activeTab === 'RECIPE' && (
            <>
              {/* 1. Ketersediaan Porsi Menu (Bottleneck Portions Summary) */}
              {loading ? (
                <div className="p-6 rounded-2xl bg-komazi-surface-2 border border-komazi-border text-center text-komazi-muted animate-pulse">
                  Memuat data resep & memeriksa stok persediaan bahan baku...
                </div>
              ) : !bottleneckSummary.hasRecipe ? (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Belum Ada Resep Bahan Baku Terhubung</span>
                  </div>
                  <p className="text-xs text-amber-200/90 leading-relaxed">
                    Menu ini belum memiliki komposisi bahan baku di sistem. Jika menu ini adalah barang jadi/snack retail (tanpa racikan), menu ini menggunakan <strong>Harga Modal Manual (costPrice: {formatRupiah(product.costPrice || 0)})</strong>.
                  </p>
                  {canManageRecipe && onOpenEditRecipe && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenEditRecipe(product);
                      }}
                      className="mt-2 px-3 py-1.5 rounded-xl bg-komazi-coral text-white font-bold text-xs shadow-md shadow-komazi-coral/30 hover:bg-komazi-coral/90 transition-all inline-flex items-center gap-1.5"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>+ Atur Resep Bahan Sekarang</span>
                    </button>
                  )}
                </div>
              ) : (
                <div
                  className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                    bottleneckSummary.status === 'EMPTY'
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      : bottleneckSummary.status === 'LOW'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner ${
                          bottleneckSummary.status === 'EMPTY'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                            : bottleneckSummary.status === 'LOW'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        }`}
                      >
                        {bottleneckSummary.status === 'EMPTY' ? (
                          <XCircle className="w-6 h-6" />
                        ) : (
                          <PackageCheck className="w-6 h-6" />
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 block">
                          Estimasi Ketersediaan Menu
                        </span>
                        <h3 className="font-display font-black text-xl sm:text-2xl text-komazi-text">
                          {bottleneckSummary.status === 'EMPTY' ? (
                            <span className="text-rose-400">Habis (0 Porsi)</span>
                          ) : (
                            <span>~{bottleneckSummary.totalPortions} Porsi Tersedia</span>
                          )}
                        </h3>
                      </div>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-[10px] uppercase font-bold text-komazi-muted block">
                        Bahan Pembatas Porsi
                      </span>
                      <span className="font-bold text-komazi-text text-sm">
                        {bottleneckSummary.bottleneckItem?.ingName || '-'}
                      </span>
                      <span className="text-[11px] text-cyan-400 font-bold block mt-0.5">
                        Sisa Stok: {bottleneckSummary.bottleneckItem?.currentStock?.toLocaleString('id-ID') || 0}{' '}
                        {bottleneckSummary.bottleneckItem?.unit || ''}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Variant Selector Pills (if product has variants) */}
              {variants && variants.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase text-komazi-muted tracking-wider">
                    Pilih Ukuran / Varian:
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedVariantId(null)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all border ${
                        selectedVariantId === null
                          ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 shadow-sm'
                          : 'bg-komazi-surface-2 border-komazi-border text-komazi-muted hover:text-komazi-text'
                      }`}
                    >
                      Dasar (Semua Ukuran)
                    </button>
                    {variants.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVariantId(Number(v.id))}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all border ${
                          Number(selectedVariantId) === Number(v.id)
                            ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 shadow-sm'
                            : 'bg-komazi-surface-2 border-komazi-border text-komazi-muted hover:text-komazi-text'
                        }`}
                      >
                        {v.name} {Number(v.extraPrice) > 0 ? `(+${formatRupiah(v.extraPrice)})` : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Tabel Rincian Sumber Persediaan Bahan Baku */}
              {enrichedItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-komazi-muted flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Komposisi Sumber Persediaan ({enrichedItems.length} Bahan)</span>
                    </h4>
                    <span className="text-[10px] text-komazi-muted">
                      Takaran per 1 porsi saji
                    </span>
                  </div>

                  <div className="rounded-2xl border border-komazi-border overflow-hidden bg-komazi-surface overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[550px]">
                      <thead className="bg-komazi-surface-2 border-b border-komazi-border text-komazi-muted font-bold uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3">Bahan Baku</th>
                          <th className="py-2.5 px-3 text-right">Takaran/Porsi</th>
                          <th className="py-2.5 px-3 text-right">Sisa Stok Fisik</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3 text-right">Maks. Porsi</th>
                          <th className="py-2.5 px-3 text-right">Biaya/Porsi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-komazi-border">
                        {enrichedItems.map((item) => (
                          <tr key={item.id} className="hover:bg-komazi-surface-2/40 transition-colors">
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-komazi-text block">{item.ingName}</span>
                              <span className="text-[10px] text-komazi-muted">
                                Satuan: {item.unit} • {formatRupiah(item.costPerUnit)}/{item.unit}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-cyan-400">
                              {item.takeQty} {item.unit}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-komazi-text font-bold">
                              {item.currentStock.toLocaleString('id-ID')} {item.unit}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${item.statusColor}`}>
                                {item.statusLabel}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold">
                              <span
                                className={
                                  item.portionEstimate === 0
                                    ? 'text-rose-400'
                                    : item.portionEstimate <= 10
                                    ? 'text-amber-400'
                                    : 'text-komazi-text'
                                }
                              >
                                ~{item.portionEstimate} porsi
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-komazi-coral font-bold">
                              {formatRupiah(item.lineCost)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 4. Financial & Margin Summary */}
              {enrichedItems.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-komazi-surface-2/80 border border-komazi-border">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-komazi-muted block">Harga Jual</span>
                    <span className="font-mono font-black text-sm text-komazi-text mt-0.5 block">
                      {formatRupiah(sellingPrice)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-komazi-muted block">Total HPP Bahan</span>
                    <span className="font-mono font-black text-sm text-komazi-coral mt-0.5 block">
                      {formatRupiah(totalHpp)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-komazi-muted block">Laba Kotor</span>
                    <span className="font-mono font-black text-sm text-emerald-400 mt-0.5 block">
                      {formatRupiah(grossProfit)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-komazi-muted block">Margin Laba</span>
                    <span className="font-mono font-black text-sm text-cyan-400 mt-0.5 block">
                      {marginPercent}%
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* TAB 2: RIWAYAT PERGERAKAN STOK (STOCK MOVEMENTS) */}
          {activeTab === 'MOVEMENTS' && (
            <div className="space-y-4">
              {/* Filter & Controls Bar */}
              <div className="p-3 rounded-2xl bg-komazi-surface-2/70 border border-komazi-border space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-1">
                    {/* Search Input */}
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-komazi-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setMovementPage(1);
                        }}
                        placeholder="Cari catatan, nota, atau petugas..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text placeholder-komazi-muted focus:outline-none focus:border-cyan-400"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setMovementPage(1);
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-komazi-muted hover:text-komazi-text text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Refresh Button */}
                    <button
                      type="button"
                      onClick={() => loadMovements()}
                      disabled={movementsLoading}
                      className="px-3 py-1.5 rounded-xl bg-komazi-surface hover:bg-komazi-surface-2 border border-komazi-border text-komazi-text text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                      title="Segarkan riwayat mutasi"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${movementsLoading ? 'animate-spin text-cyan-400' : ''}`} />
                      <span className="hidden sm:inline">Segarkan</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 text-[11px]">
                  {/* Filter Bahan Baku */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-komazi-muted font-bold">Bahan</span>
                    <select
                      value={selectedIngFilter}
                      onChange={(e) => {
                        setSelectedIngFilter(e.target.value);
                        setMovementPage(1);
                      }}
                      className="px-2.5 py-1 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text font-medium focus:outline-none focus:border-cyan-400"
                    >
                      <option value="ALL">Semua Bahan Baku Resep ({productIngredientsList.length})</option>
                      {productIngredientsList.map((ing) => (
                        <option key={ing.id} value={ing.id}>
                          {ing.name} ({ing.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filter Tipe Mutasi */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-komazi-muted font-bold">Tipe</span>
                    <select
                      value={selectedTypeFilter}
                      onChange={(e) => {
                        setSelectedTypeFilter(e.target.value);
                        setMovementPage(1);
                      }}
                      className="px-2.5 py-1 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text font-medium focus:outline-none focus:border-cyan-400"
                    >
                      <option value="ALL">Semua Tipe Mutasi</option>
                      <option value="PURCHASE">Pembelian / Inbound (+)</option>
                      <option value="SALE">Penjualan Kasir POS (-)</option>
                      <option value="WASTE">Waste / Rusak (-)</option>
                      <option value="ADJUSTMENT">Penyesuaian / Opname (±)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Tabel Log Mutasi Stok */}
              {movementsLoading ? (
                <div className="p-8 rounded-2xl bg-komazi-surface-2 border border-komazi-border text-center text-komazi-muted flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
                  <span>Memuat riwayat pergerakan stok...</span>
                </div>
              ) : relevantIngredientIds.length === 0 ? (
                <div className="p-8 rounded-2xl bg-komazi-surface-2 border border-komazi-border text-center space-y-2">
                  <Boxes className="w-8 h-8 text-komazi-muted mx-auto opacity-50" />
                  <p className="font-bold text-komazi-text">Belum Ada Bahan Baku Terhubung</p>
                  <p className="text-xs text-komazi-muted max-w-sm mx-auto">
                    Menu ini belum memiliki resep komposisi bahan baku sehingga belum ada riwayat mutasi bahan yang dapat ditampilkan.
                  </p>
                </div>
              ) : movements.length === 0 ? (
                <div className="p-8 rounded-2xl bg-komazi-surface-2 border border-komazi-border text-center space-y-2">
                  <History className="w-8 h-8 text-komazi-muted mx-auto opacity-50" />
                  <p className="font-bold text-komazi-text">Belum Ada Riwayat Pergerakan Stok</p>
                  <p className="text-xs text-komazi-muted max-w-sm mx-auto">
                    Tidak ditemukan log mutasi stok untuk bahan baku menu ini dengan kriteria filter yang dipilih.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-komazi-muted">
                    <span>
                      Menampilkan{' '}
                      <strong className="text-komazi-text font-mono">
                        {movementsTotal > 0 ? (movementPage - 1) * movementsPerPage + 1 : 0}–
                        {Math.min(movementPage * movementsPerPage, movementsTotal)}
                      </strong>{' '}
                      dari <strong className="text-komazi-text font-mono">{movementsTotal}</strong> log mutasi
                    </span>
                    <span className="font-mono text-[10px]">
                      {selectedIngFilter === 'ALL'
                        ? 'Sumber: Seluruh bahan resep menu'
                        : `Bahan ID #${selectedIngFilter}`}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-komazi-border overflow-hidden bg-komazi-surface overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[700px]">
                      <thead className="bg-komazi-surface-2 border-b border-komazi-border text-komazi-muted font-bold uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3">Waktu & Tanggal</th>
                          <th className="py-2.5 px-3">Bahan Baku</th>
                          <th className="py-2.5 px-3 text-center">Tipe Mutasi</th>
                          <th className="py-2.5 px-3 text-right">Perubahan Qty</th>
                          <th className="py-2.5 px-3 text-right">Sisa Stok</th>
                          {canViewCost && <th className="py-2.5 px-3 text-right">Total Biaya</th>}
                          <th className="py-2.5 px-3">Petugas</th>
                          <th className="py-2.5 px-3">Keterangan / Ref</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-komazi-border">
                        {movements.map((m) => {
                          const isPurchase = m.type === 'PURCHASE';
                          const isSale = m.type === 'SALE';
                          const isWaste = m.type === 'WASTE';
                          const isAdjustment = m.type === 'ADJUSTMENT';

                          let badgeColor = 'bg-blue-500/10 text-blue-400 border-blue-500/30';
                          let typeLabel = 'Penjualan POS';
                          let qtyPrefix = '-';
                          let qtyColor = 'text-blue-400';

                          if (isPurchase) {
                            badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
                            typeLabel = 'Pembelian / Inbound';
                            qtyPrefix = '+';
                            qtyColor = 'text-emerald-400';
                          } else if (isWaste) {
                            badgeColor = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
                            typeLabel = 'Waste / Rusak';
                            qtyPrefix = '-';
                            qtyColor = 'text-rose-400';
                          } else if (isAdjustment) {
                            badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
                            typeLabel = 'Penyesuaian';
                            qtyPrefix = Number(m.qty) >= 0 ? '+' : '';
                            qtyColor = 'text-amber-400';
                          }

                          const liveIng = ingredientsMap.get(Number(m.ingredientId));
                          const liveStock = liveIng ? Number(liveIng.stock) : null;

                          return (
                            <tr key={m.id} className="hover:bg-komazi-surface-2/40 transition-colors">
                              <td className="py-2.5 px-3 whitespace-nowrap text-komazi-muted font-mono text-[11px]">
                                {formatMovementDate(m.createdAt)}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="font-bold text-komazi-text block">{m.ingredientName}</span>
                                <span className="text-[10px] text-komazi-muted">ID #{m.ingredientId}</span>
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}`}>
                                  {typeLabel}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono font-bold">
                                <span className={qtyColor}>
                                  {qtyPrefix}
                                  {Math.abs(Number(m.qty)).toLocaleString('id-ID')} {m.unit}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono text-[11px]">
                                {m.stockBefore !== null && m.stockAfter !== null ? (
                                  <span className="flex items-center justify-end gap-1 text-komazi-muted">
                                    <span>{Number(m.stockBefore).toLocaleString('id-ID')}</span>
                                    <ArrowRight className="w-3 h-3 text-komazi-muted shrink-0" />
                                    <span className="font-bold text-komazi-text">
                                      {Number(m.stockAfter).toLocaleString('id-ID')}
                                    </span>
                                  </span>
                                ) : m.stockAfter !== null ? (
                                  <span className="font-bold text-komazi-text">
                                    {Number(m.stockAfter).toLocaleString('id-ID')} {m.unit}
                                  </span>
                                ) : liveStock !== null ? (
                                  <span className="font-bold text-komazi-text" title="Sisa stok fisik saat ini di gudang">
                                    {liveStock.toLocaleString('id-ID')} {m.unit}
                                  </span>
                                ) : (
                                  <span className="text-komazi-muted">-</span>
                                )}
                              </td>
                              {canViewCost && (
                                <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono font-bold text-komazi-coral">
                                  {m.totalCost !== null ? formatRupiah(m.totalCost) : '-'}
                                </td>
                              )}
                              <td className="py-2.5 px-3 whitespace-nowrap text-[11px] text-komazi-muted">
                                <div className="flex items-center gap-1.5">
                                  <User className="w-3 h-3 text-komazi-muted shrink-0" />
                                  <span>{m.recordedBy || 'Sistem'}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 max-w-[200px] truncate text-[11px] text-komazi-text" title={m.note || '-'}>
                                {m.note || '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls for Stock Movements */}
                  <Pagination
                    currentPage={movementPage}
                    totalItems={movementsTotal}
                    itemsPerPage={movementsPerPage}
                    onPageChange={setMovementPage}
                    onItemsPerPageChange={(newLimit) => {
                      setMovementsPerPage(newLimit);
                      setMovementPage(1);
                    }}
                    itemsPerPageOptions={[5, 10, 15, 25, 50]}
                    itemLabel="mutasi"
                    className="rounded-2xl border border-komazi-border mt-3 overflow-hidden shadow-sm"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-komazi-border bg-komazi-surface flex items-center justify-between shrink-0">
          <div>
            {canManageRecipe && onOpenEditRecipe && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenEditRecipe(product);
                }}
                className="px-3.5 py-2 rounded-xl bg-komazi-surface-2 hover:bg-komazi-surface-2/80 border border-komazi-border text-xs font-bold text-komazi-coral hover:text-white transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Ubah Resep</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral/90 text-white font-bold text-xs shadow-md shadow-komazi-coral/30 transition-all active:scale-95 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
