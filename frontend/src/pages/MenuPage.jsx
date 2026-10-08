import React, { useState, useMemo, useEffect } from 'react';
import { usePosStore } from '../store/posStore';
import { useAuthStore } from '../store/authStore';
import { useRecipeStore } from '../store/useRecipeStore';
import { formatRupiah } from '../utils/format';
import {
  UtensilsCrossed,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  SlidersHorizontal,
  X,
  Tag,
  Layers,
  Sparkles,
  Info,
  Coffee,
  Check,
  Calculator,
  RotateCcw,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import ImageUpload from '../components/ui/ImageUpload';
import AlertModal from '../components/ui/AlertModal';
import PromptModal from '../components/ui/PromptModal';
import RecipeModal from '../components/menu/RecipeModal';
import CategoryManagementModal from '../components/menu/CategoryManagementModal';
import Pagination from '../components/ui/Pagination';
import { toast } from '../store/toastStore';

export default function MenuPage() {
  const {
    products,
    categories,
    addProduct,
    updateProduct,
    deleteProduct,
    toggleSoldOut,
    bulkSetSoldOut,
    bulkUpdateCategory,
    bulkDeleteProducts,
    addCategory,
  } = usePosStore();

  const { user } = useAuthStore();
  const canManageRecipe = user?.role === 'OWNER' || user?.role === 'MANAGER';
  const { calculateProductHpp, recipes } = useRecipeStore();
  const [selectedProductForRecipe, setSelectedProductForRecipe] = useState(null);
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);

  // Multi-select state
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [isBulkCatModalOpen, setIsBulkCatModalOpen] = useState(false);
  const [bulkTargetCatId, setBulkTargetCatId] = useState(2);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCatId, setSelectedCatId] = useState('all');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'AVAILABLE' | 'SOLDOUT' | 'INACTIVE'
  const [recipeFilter, setRecipeFilter] = useState('ALL'); // 'ALL' | 'WITH_RECIPE' | 'NO_RECIPE'
  const [priceRangeFilter, setPriceRangeFilter] = useState('ALL'); // 'ALL' | 'UNDER_25K' | '25K_TO_40K' | 'ABOVE_40K'
  const [sortBy, setSortBy] = useState('DEFAULT'); // 'DEFAULT' | 'NAME_ASC' | 'NAME_DESC' | 'PRICE_ASC' | 'PRICE_DESC' | 'NEWEST'
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productToDelete, setProductToDelete] = useState(null);
  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState('info'); // 'info' | 'variants' | 'modifiers'

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    categoryId: 2,
    price: 25000,
    sku: '',
    imageUrl: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=500&auto=format&fit=crop&q=80',
    description: '',
    variants: [],
    modifiers: [],
  });

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setModalTab('info');
    setFormData({
      name: '',
      categoryId: categories[1]?.id || 2,
      price: 25000,
      sku: `KMZ-PRD-${Math.floor(100 + Math.random() * 900)}`,
      imageUrl: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=500&auto=format&fit=crop&q=80',
      description: '',
      variants: [
        { id: 1, name: 'Regular', extraPrice: 0 },
        { id: 2, name: 'Large', extraPrice: 4000 },
      ],
      modifiers: [],
    });
    setIsProductModalOpen(true);
  };

  const handleOpenEdit = (prod) => {
    setEditingProduct(prod);
    setModalTab('info');
    setFormData({
      name: prod.name,
      categoryId: prod.categoryId,
      price: prod.price,
      sku: prod.sku || '',
      imageUrl: prod.imageUrl || '',
      description: prod.description || '',
      variants: prod.variants ? JSON.parse(JSON.stringify(prod.variants)) : [],
      modifiers: prod.modifiers ? JSON.parse(JSON.stringify(prod.modifiers)) : [],
    });
    setIsProductModalOpen(true);
  };

  // Variant handlers
  const handleAddVariant = () => {
    setFormData((prev) => ({
      ...prev,
      variants: [
        ...prev.variants,
        { id: Date.now() + Math.random(), name: '', extraPrice: 0 },
      ],
    }));
  };

  const handleUpdateVariant = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.variants];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, variants: updated };
    });
  };

  const handleRemoveVariant = (index) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index),
    }));
  };

  const handleApplyVariantPreset = (type) => {
    if (type === 'standard') {
      setFormData((prev) => ({
        ...prev,
        variants: [
          { id: Date.now() + 1, name: 'Regular', extraPrice: 0 },
          { id: Date.now() + 2, name: 'Large', extraPrice: 4000 },
        ],
      }));
      toast.info('Preset ukuran Standar diterapkan!');
    } else if (type === 'hot-iced') {
      setFormData((prev) => ({
        ...prev,
        variants: [
          { id: Date.now() + 1, name: 'Regular (Hot)', extraPrice: 0 },
          { id: Date.now() + 2, name: 'Large (Hot)', extraPrice: 4000 },
          { id: Date.now() + 3, name: 'Regular (Iced)', extraPrice: 2000 },
          { id: Date.now() + 4, name: 'Large (Iced)', extraPrice: 6000 },
        ],
      }));
      toast.info('Preset Hot & Iced diterapkan!');
    } else if (type === 'single-double') {
      setFormData((prev) => ({
        ...prev,
        variants: [
          { id: Date.now() + 1, name: 'Single', extraPrice: 0 },
          { id: Date.now() + 2, name: 'Double', extraPrice: 8000 },
        ],
      }));
      toast.info('Preset Single & Double diterapkan!');
    } else if (type === 'clear') {
      setFormData((prev) => ({ ...prev, variants: [] }));
      toast.info('Semua pilihan ukuran dihapus');
    }
  };

  // Modifier handlers
  const handleAddModifier = () => {
    setFormData((prev) => ({
      ...prev,
      modifiers: [
        ...prev.modifiers,
        { id: Date.now() + Math.random(), name: '', price: 0 },
      ],
    }));
  };

  const handleUpdateModifier = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.modifiers];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, modifiers: updated };
    });
  };

  const handleRemoveModifier = (index) => {
    setFormData((prev) => ({
      ...prev,
      modifiers: prev.modifiers.filter((_, i) => i !== index),
    }));
  };

  const handleApplyModifierPreset = (type) => {
    if (type === 'coffee') {
      setFormData((prev) => ({
        ...prev,
        modifiers: [
          { id: Date.now() + 1, name: 'Extra Shot Espresso', price: 6000 },
          { id: Date.now() + 2, name: 'Ganti Oat Milk', price: 7000 },
          { id: Date.now() + 3, name: 'Sirup Karamel', price: 5000 },
          { id: Date.now() + 4, name: 'Less Sugar 50%', price: 0 },
        ],
      }));
      toast.info('Preset Add-ons Kopi diterapkan!');
    } else if (type === 'food') {
      setFormData((prev) => ({
        ...prev,
        modifiers: [
          { id: Date.now() + 1, name: 'Extra Keju Melt', price: 5000 },
          { id: Date.now() + 2, name: 'Telur Ceplok', price: 4000 },
          { id: Date.now() + 3, name: 'Extra Sambal', price: 2000 },
        ],
      }));
      toast.info('Preset Topping Makanan diterapkan!');
    } else if (type === 'clear') {
      setFormData((prev) => ({ ...prev, modifiers: [] }));
      toast.info('Semua opsi tambahan dihapus');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const cat = categories.find((c) => c.id === Number(formData.categoryId));

    // Sanitize variants & modifiers: filter out blank names
    const cleanVariants = (formData.variants || [])
      .filter((v) => v.name && v.name.trim() !== '')
      .map((v, idx) => ({
        id: v.id || Date.now() + idx,
        name: v.name.trim(),
        extraPrice: Math.max(0, Number(v.extraPrice) || 0),
      }));

    const cleanModifiers = (formData.modifiers || [])
      .filter((m) => m.name && m.name.trim() !== '')
      .map((m, idx) => ({
        id: m.id || Date.now() + 100 + idx,
        name: m.name.trim(),
        price: Math.max(0, Number(m.price) || 0),
      }));

    const payload = {
      ...formData,
      price: Number(formData.price),
      categoryName: cat?.name || 'Kopi',
      variants: cleanVariants,
      modifiers: cleanModifiers,
    };

    if (editingProduct) {
      updateProduct(editingProduct.id, payload);
      toast.success(`Produk "${formData.name}" berhasil diperbarui!`);
    } else {
      addProduct(payload);
      toast.success(`Produk "${formData.name}" berhasil ditambahkan ke katalog!`);
    }
    setIsProductModalOpen(false);
  };

  const filtered = useMemo(() => {
    let result = products.filter((p) => {
      // 1. Kategori
      const matchCat = selectedCatId === 'all' || p.categoryId === Number(selectedCatId);
      if (!matchCat) return false;

      // 2. Pencarian Fleksibel (Nama Produk, SKU, Deskripsi, Nama Kategori)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (p.name || '').toLowerCase().includes(q);
        const matchSku = (p.sku || '').toLowerCase().includes(q);
        const matchDesc = (p.description || '').toLowerCase().includes(q);
        const matchCatName = (p.categoryName || '').toLowerCase().includes(q);
        if (!matchName && !matchSku && !matchDesc && !matchCatName) {
          return false;
        }
      }

      // 3. Status Ketersediaan
      if (statusFilter === 'AVAILABLE') {
        if (p.isSoldOut === true || p.isActive === false) return false;
      } else if (statusFilter === 'SOLDOUT') {
        if (p.isSoldOut !== true) return false;
      } else if (statusFilter === 'INACTIVE') {
        if (p.isActive !== false) return false;
      }

      // 4. Status Resep HPP (BOM)
      if (recipeFilter === 'WITH_RECIPE') {
        const hasRecipe = Boolean(recipes[p.id] && recipes[p.id].length > 0);
        if (!hasRecipe) return false;
      } else if (recipeFilter === 'NO_RECIPE') {
        const hasRecipe = Boolean(recipes[p.id] && recipes[p.id].length > 0);
        if (hasRecipe) return false;
      }

      // 5. Rentang Harga
      const price = Number(p.price) || 0;
      if (priceRangeFilter === 'UNDER_25K') {
        if (price >= 25000) return false;
      } else if (priceRangeFilter === '25K_TO_40K') {
        if (price < 25000 || price > 40000) return false;
      } else if (priceRangeFilter === 'ABOVE_40K') {
        if (price <= 40000) return false;
      }

      return true;
    });

    // 6. Pengurutan Data
    if (sortBy === 'NAME_ASC') {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'NAME_DESC') {
      result = [...result].sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortBy === 'PRICE_ASC') {
      result = [...result].sort((a, b) => Number(a.price) - Number(b.price));
    } else if (sortBy === 'PRICE_DESC') {
      result = [...result].sort((a, b) => Number(b.price) - Number(a.price));
    } else if (sortBy === 'NEWEST') {
      result = [...result].sort((a, b) => (b.id || 0) - (a.id || 0));
    }

    return result;
  }, [products, selectedCatId, searchQuery, statusFilter, recipeFilter, priceRangeFilter, sortBy, recipes]);

  // Statistik Cepat untuk Quick Chips
  const stats = useMemo(() => {
    const total = products.length;
    const available = products.filter((p) => !p.isSoldOut && p.isActive !== false).length;
    const soldOut = products.filter((p) => p.isSoldOut).length;
    const inactive = products.filter((p) => p.isActive === false).length;
    const withRecipe = products.filter((p) => recipes[p.id] && recipes[p.id].length > 0).length;
    const noRecipe = total - withRecipe;
    return { total, available, soldOut, inactive, withRecipe, noRecipe };
  }, [products, recipes]);

  const hasActiveFilters =
    selectedCatId !== 'all' ||
    Boolean(searchQuery.trim()) ||
    statusFilter !== 'ALL' ||
    recipeFilter !== 'ALL' ||
    priceRangeFilter !== 'ALL' ||
    sortBy !== 'DEFAULT';

  const handleResetFilters = () => {
    setSelectedCatId('all');
    setSearchQuery('');
    setStatusFilter('ALL');
    setRecipeFilter('ALL');
    setPriceRangeFilter('ALL');
    setSortBy('DEFAULT');
  };

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((p) => selectedProductIds.includes(p.id));
  const someFilteredSelected =
    filtered.some((p) => selectedProductIds.includes(p.id)) && !allFilteredSelected;

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      const filteredIdSet = new Set(filtered.map((p) => p.id));
      setSelectedProductIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    } else {
      const combined = new Set([...selectedProductIds, ...filtered.map((p) => p.id)]);
      setSelectedProductIds(Array.from(combined));
    }
  };

  const handleToggleSelectProduct = (id) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Reset ke halaman 1 jika filter berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCatId, statusFilter, recipeFilter, priceRangeFilter, sortBy]);

  // Sliced items per page
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-6 space-y-6 max-w-7xl mx-auto select-none">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-black text-2xl text-komazi-text flex items-center gap-2">
            <UtensilsCrossed className="w-6 h-6 text-komazi-coral" />
            <span>Manajemen Menu & Kategori</span>
          </h1>
          <p className="text-xs text-komazi-muted mt-0.5">
            Kelola daftar minuman, makanan, harga dasar, pilihan ukuran, tambahan (add-ons), dan ketersediaan stok.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCategoryModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-text text-xs font-semibold border border-komazi-border transition-colors flex items-center gap-1.5"
            title="Kelola daftar kategori, ubah nama, urutan atau hapus kategori"
          >
            <Layers className="w-3.5 h-3.5 text-komazi-coral" />
            <span>Kelola Kategori</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-komazi-coral/15 text-komazi-coral">
              {categories.filter((c) => c.id !== 1).length}
            </span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Tambah Menu</span>
          </button>
        </div>
      </div>

      {/* 2. Filters & Categories Section */}
      <div className="space-y-3">
        {/* Row A: Category Tabs + Shortcut */}
        <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1 no-scrollbar">
          <div className="flex items-center gap-1.5 min-w-max">
            {/* Filter Semua Kategori */}
            <button
              type="button"
              onClick={() => setSelectedCatId('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                selectedCatId === 'all'
                  ? 'bg-komazi-coral text-white shadow-sm ring-1 ring-komazi-coral'
                  : 'bg-komazi-surface text-komazi-muted hover:text-white border border-komazi-border hover:border-komazi-coral/40'
              }`}
            >
              <span>Semua Kategori</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  selectedCatId === 'all'
                    ? 'bg-white/20 text-white'
                    : 'bg-komazi-surface-2 text-komazi-muted'
                }`}
              >
                {products.length}
              </span>
            </button>

            {categories.map((cat) => {
              const isSelected = selectedCatId === cat.id;
              const catCount = products.filter((p) => p.categoryId === cat.id).length;

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCatId(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-komazi-coral text-white shadow-sm ring-1 ring-komazi-coral'
                      : 'bg-komazi-surface text-komazi-muted hover:text-white border border-komazi-border hover:border-komazi-coral/40'
                  }`}
                >
                  <span>{cat.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-komazi-surface-2 text-komazi-muted'
                    }`}
                  >
                    {catCount}
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap bg-komazi-surface-2/60 text-komazi-muted hover:text-komazi-coral border border-dashed border-komazi-border flex items-center gap-1 transition-colors ml-1"
              title="Buka Pengaturan Kategori"
            >
              <Plus className="w-3 h-3" />
              <span>Kategori</span>
            </button>
          </div>
        </div>

        {/* Row B: Filter Controls Toolbar */}
        <div className="p-3 rounded-2xl bg-komazi-surface border border-komazi-border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Left: Search input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-komazi-muted absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari nama menu, SKU, atau deskripsi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-8 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text placeholder-komazi-muted/70 focus:border-komazi-coral focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-komazi-muted hover:text-white p-0.5"
                title="Hapus pencarian"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right: Filter dropdowns & controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Ketersediaan */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`text-xs font-semibold px-3 py-2 rounded-xl border bg-komazi-surface-2 focus:outline-none cursor-pointer transition-colors ${
                  statusFilter !== 'ALL'
                    ? 'border-komazi-coral text-komazi-coral bg-komazi-coral/10'
                    : 'border-komazi-border text-komazi-muted hover:text-komazi-text'
                }`}
                title="Filter berdasarkan status stok"
              >
                <option value="ALL">Semua Status</option>
                <option value="AVAILABLE">Tersedia (Ready)</option>
                <option value="SOLDOUT">Habis (Sold Out)</option>
                <option value="INACTIVE">Nonaktif / Diarsipkan</option>
              </select>
            </div>

            {/* Filter Resep HPP */}
            {canManageRecipe && (
              <div className="relative">
                <select
                  value={recipeFilter}
                  onChange={(e) => setRecipeFilter(e.target.value)}
                  className={`text-xs font-semibold px-3 py-2 rounded-xl border bg-komazi-surface-2 focus:outline-none cursor-pointer transition-colors ${
                    recipeFilter !== 'ALL'
                      ? 'border-komazi-teal-light text-komazi-teal-light bg-komazi-teal/10'
                      : 'border-komazi-border text-komazi-muted hover:text-komazi-text'
                  }`}
                  title="Filter berdasarkan status konfigurasi resep BOM"
                >
                  <option value="ALL">Semua Resep</option>
                  <option value="WITH_RECIPE">Ada Resep HPP</option>
                  <option value="NO_RECIPE">Belum Ada Resep</option>
                </select>
              </div>
            )}

            {/* Filter Rentang Harga */}
            <div className="relative">
              <select
                value={priceRangeFilter}
                onChange={(e) => setPriceRangeFilter(e.target.value)}
                className={`text-xs font-semibold px-3 py-2 rounded-xl border bg-komazi-surface-2 focus:outline-none cursor-pointer transition-colors ${
                  priceRangeFilter !== 'ALL'
                    ? 'border-amber-400 text-amber-400 bg-amber-400/10'
                    : 'border-komazi-border text-komazi-muted hover:text-komazi-text'
                }`}
                title="Filter berdasarkan rentang harga"
              >
                <option value="ALL">Semua Harga</option>
                <option value="UNDER_25K">&lt; Rp 25.000</option>
                <option value="25K_TO_40K">Rp 25.000 - Rp 40.000</option>
                <option value="ABOVE_40K">&gt; Rp 40.000</option>
              </select>
            </div>

            {/* Pengurutan (Sort) */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-xs font-semibold px-3 py-2 rounded-xl border border-komazi-border bg-komazi-surface-2 text-komazi-muted hover:text-komazi-text focus:border-komazi-coral focus:outline-none cursor-pointer"
                title="Urutkan daftar menu"
              >
                <option value="DEFAULT">Urutkan: Standar</option>
                <option value="NAME_ASC">Nama (A - Z)</option>
                <option value="NAME_DESC">Nama (Z - A)</option>
                <option value="PRICE_ASC">Harga Terendah</option>
                <option value="PRICE_DESC">Harga Tertinggi</option>
                <option value="NEWEST">Terbaru Ditambahkan</option>
              </select>
            </div>

            {/* Reset Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-2 rounded-xl text-xs font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 flex items-center gap-1.5 transition-colors active:scale-95"
                title="Kembalikan semua filter ke awal"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Row C: Quick Stat Pills (Interactive Clickable Chips) */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[11px] font-semibold text-komazi-muted mr-1">
            Filter Cepat:
          </span>

          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
              statusFilter === 'ALL'
                ? 'bg-komazi-surface-2 border-komazi-muted text-white font-bold'
                : 'bg-komazi-surface border-komazi-border text-komazi-muted hover:text-white'
            }`}
          >
            Total: <strong className="text-komazi-text">{stats.total}</strong>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('AVAILABLE')}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
              statusFilter === 'AVAILABLE'
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10'
            }`}
          >
            Tersedia: <strong>{stats.available}</strong>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('SOLDOUT')}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
              statusFilter === 'SOLDOUT'
                ? 'bg-rose-500/25 border-rose-500 text-rose-300 font-bold'
                : 'bg-rose-500/10 border-rose-500/25 text-rose-400 hover:bg-rose-500/15'
            }`}
          >
            Habis (Sold Out): <strong>{stats.soldOut}</strong>
          </button>

          {canManageRecipe && stats.noRecipe > 0 && (
            <button
              type="button"
              onClick={() => setRecipeFilter('NO_RECIPE')}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
                recipeFilter === 'NO_RECIPE'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                  : 'bg-amber-500/5 border-amber-500/20 text-amber-400 hover:bg-amber-500/10'
              }`}
            >
              Belum Ada Resep: <strong>{stats.noRecipe}</strong>
            </button>
          )}

          <div className="ml-auto text-[11px] text-komazi-muted">
            Menampilkan <strong className="text-komazi-coral">{filtered.length}</strong> dari {products.length} menu
          </div>
        </div>
      </div>

      {/* 3. Products Table */}
      <div className="rounded-2xl border border-komazi-border bg-komazi-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-komazi-border bg-komazi-surface-2 text-komazi-muted font-bold uppercase tracking-wider">
              <tr>
                <th className="w-10 py-3 px-3 text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someFilteredSelected;
                    }}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 rounded border-komazi-border text-komazi-coral focus:ring-komazi-coral bg-komazi-surface cursor-pointer accent-komazi-coral"
                    title={allFilteredSelected ? 'Batalkan semua pilihan' : 'Pilih semua menu yang tampil'}
                  />
                </th>
                <th className="py-3 px-4">Produk</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">Harga Dasar</th>
                {canManageRecipe && (
                  <th className="py-3 px-4">HPP & Margin</th>
                )}
                <th className="py-3 px-4">Ukuran & Tambahan</th>
                <th className="py-3 px-4 text-center">Status Habis</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-komazi-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={canManageRecipe ? 9 : 8} className="py-14 text-center text-komazi-muted">
                    <div className="max-w-xs mx-auto flex flex-col items-center justify-center space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-komazi-surface-2 border border-komazi-border flex items-center justify-center text-komazi-muted mb-1">
                        <UtensilsCrossed className="w-6 h-6 stroke-[1.8]" />
                      </div>
                      <p className="font-bold text-komazi-text text-sm">Tidak ada menu yang cocok</p>
                      <p className="text-[11px] text-komazi-muted leading-relaxed">
                        Kombinasi kata kunci pencarian, kategori, status ketersediaan, atau rentang harga tidak menemukan hasil.
                      </p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-komazi-coral/15 hover:bg-komazi-coral/25 text-komazi-coral text-xs font-bold border border-komazi-coral/30 transition-all active:scale-95"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset Semua Filter</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((prod) => {
                  const isSelected = selectedProductIds.includes(prod.id);
                  return (
                    <tr
                      key={prod.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-komazi-coral/10 hover:bg-komazi-coral/15'
                          : 'hover:bg-komazi-surface-2/60'
                      }`}
                    >
                      <td className="w-10 py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectProduct(prod.id)}
                          className="w-4 h-4 rounded border-komazi-border text-komazi-coral focus:ring-komazi-coral bg-komazi-surface cursor-pointer accent-komazi-coral"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={prod.imageUrl}
                            alt={prod.name}
                            className="w-10 h-10 rounded-xl object-cover border border-komazi-border shrink-0"
                          />
                          <div>
                            <p className="font-bold text-komazi-text">{prod.name}</p>
                            <p className="text-[10px] text-komazi-muted line-clamp-1">{prod.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-komazi-text">
                        {prod.categoryName}
                      </td>
                      <td className="py-3 px-4 font-mono text-komazi-muted text-[11px]">
                        {prod.sku || '-'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-komazi-coral text-sm">
                        {formatRupiah(prod.price)}
                      </td>
                      {canManageRecipe && (() => {
                        const hpp = calculateProductHpp(prod.id);
                        const prodRecipes = recipes[prod.id] || [];
                        const hasRecipe = prodRecipes.length > 0;
                        const margin = prod.price > 0 && hasRecipe
                          ? Math.round(((prod.price - hpp) / prod.price) * 100)
                          : 0;

                        return (
                          <td className="py-3 px-4">
                            {hasRecipe ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="font-mono font-bold text-komazi-text text-xs">
                                  {formatRupiah(hpp)}
                                </span>
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold w-fit ${
                                  margin >= 60 ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                                  margin >= 40 ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                                  'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                }`}>
                                  Margin: {margin}%
                                </span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedProductForRecipe(prod);
                                  setIsRecipeModalOpen(true);
                                }}
                                className="text-[10px] text-komazi-coral hover:underline font-semibold bg-komazi-coral/10 hover:bg-komazi-coral/20 px-2 py-0.5 rounded border border-komazi-coral/30"
                              >
                                + Atur Resep
                              </button>
                            )}
                          </td>
                        );
                      })()}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {prod.variants && prod.variants.length > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-komazi-coral/10 border border-komazi-coral/30 text-komazi-coral font-medium text-[11px]">
                              <Layers className="w-3 h-3" />
                              <span>{prod.variants.length} Ukuran</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-komazi-muted/70">1 Ukuran dasar</span>
                          )}
                          {prod.modifiers && prod.modifiers.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-komazi-teal/15 border border-komazi-teal-light/30 text-komazi-teal-light font-medium text-[11px]">
                              <Sparkles className="w-3 h-3" />
                              <span>{prod.modifiers.length} Add-on</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => toggleSoldOut(prod.id)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                            prod.isSoldOut
                              ? 'bg-danger/15 text-danger border-danger/30 hover:bg-danger/25'
                              : 'bg-success/15 text-success border-success/30 hover:bg-success/25'
                          }`}
                        >
                          {prod.isSoldOut ? 'Tandai Tersedia' : 'Tersedia'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {canManageRecipe && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedProductForRecipe(prod);
                                setIsRecipeModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-komazi-coral hover:text-white hover:bg-komazi-coral/20 border border-transparent hover:border-komazi-coral/40 transition-colors"
                              title="Kelola Resep & HPP"
                            >
                              <Calculator className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEdit(prod)}
                            className="p-1.5 rounded-lg text-komazi-muted hover:text-white hover:bg-komazi-surface-2 transition-colors"
                            title="Edit menu & varian"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setProductToDelete(prod)}
                            className="p-1.5 rounded-lg text-komazi-muted hover:text-danger hover:bg-danger/10 transition-colors"
                            title="Hapus menu"
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
          totalItems={filtered.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
          itemLabel="menu"
        />
      </div>

      {/* Floating Multi-Select Action Bar */}
      {selectedProductIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-3xl w-[92%] sm:w-auto bg-komazi-surface/95 backdrop-blur-md border border-komazi-coral/40 shadow-2xl shadow-black/70 rounded-2xl p-2.5 sm:px-4 sm:py-3 flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-start gap-2 sm:gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl bg-komazi-coral/20 border border-komazi-coral/40 text-komazi-coral text-xs font-bold whitespace-nowrap flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>{selectedProductIds.length} Menu Terpilih</span>
            </span>
            <button
              type="button"
              onClick={() => setSelectedProductIds([])}
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
                bulkSetSoldOut(selectedProductIds, true);
                toast.success(`${selectedProductIds.length} menu ditandai HABIS.`);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-danger/15 hover:bg-danger/25 text-danger border border-danger/30 text-xs font-semibold transition-all flex items-center gap-1 active:scale-95"
              title="Tandai menu terpilih sebagai habis"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Tandai Habis</span>
            </button>

            <button
              type="button"
              onClick={() => {
                bulkSetSoldOut(selectedProductIds, false);
                toast.success(`${selectedProductIds.length} menu ditandai TERSEDIA.`);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-success/15 hover:bg-success/25 text-success border border-success/30 text-xs font-semibold transition-all flex items-center gap-1 active:scale-95"
              title="Tandai menu terpilih sebagai tersedia"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Tandai Tersedia</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const defaultCat = categories.find((c) => c.id !== 1)?.id || 2;
                setBulkTargetCatId(defaultCat);
                setIsBulkCatModalOpen(true);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-text border border-komazi-border text-xs font-semibold transition-all flex items-center gap-1 active:scale-95"
              title="Ubah kategori untuk menu terpilih"
            >
              <Tag className="w-3.5 h-3.5 text-komazi-teal-light" />
              <span>Pindah Kategori</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-danger hover:bg-danger/80 text-white text-xs font-bold transition-all flex items-center gap-1 active:scale-95 shadow-sm"
              title="Hapus menu terpilih"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus ({selectedProductIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-2xl rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-komazi-border shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-komazi-coral/10 border border-komazi-coral/20 flex items-center justify-center text-komazi-coral">
                  <UtensilsCrossed className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-komazi-text">
                    {editingProduct ? `Edit Menu: ${editingProduct.name}` : 'Tambah Menu Baru'}
                  </h3>
                  <p className="text-[11px] text-komazi-muted">
                    Atur informasi produk, pilihan ukuran/suhu, dan opsi tambahan (add-ons).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="p-1.5 rounded-lg text-komazi-muted hover:text-white hover:bg-komazi-surface-2 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tab Selector */}
            <div className="flex items-center gap-1.5 px-4 pt-3 pb-2 border-b border-komazi-border/60 bg-komazi-surface-2/40 shrink-0">
              <button
                type="button"
                onClick={() => setModalTab('info')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  modalTab === 'info'
                    ? 'bg-komazi-coral text-white shadow-sm'
                    : 'text-komazi-muted hover:text-white hover:bg-komazi-surface-2'
                }`}
              >
                <UtensilsCrossed className="w-3.5 h-3.5" />
                <span>1. Informasi Menu</span>
              </button>

              <button
                type="button"
                onClick={() => setModalTab('variants')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  modalTab === 'variants'
                    ? 'bg-komazi-coral text-white shadow-sm'
                    : 'text-komazi-muted hover:text-white hover:bg-komazi-surface-2'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>2. Pilihan Ukuran & Suhu</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    modalTab === 'variants'
                      ? 'bg-white text-komazi-coral'
                      : 'bg-komazi-surface border border-komazi-border text-komazi-text'
                  }`}
                >
                  {formData.variants?.length || 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setModalTab('modifiers')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  modalTab === 'modifiers'
                    ? 'bg-komazi-coral text-white shadow-sm'
                    : 'text-komazi-muted hover:text-white hover:bg-komazi-surface-2'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>3. Tambahan / Add-ons</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    modalTab === 'modifiers'
                      ? 'bg-white text-komazi-coral'
                      : 'bg-komazi-surface border border-komazi-border text-komazi-text'
                  }`}
                >
                  {formData.modifiers?.length || 0}
                </span>
              </button>
            </div>

            {/* Modal Form Scrollable Area */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
              <div className="p-5 space-y-4 flex-1">
                {/* TAB 1: INFORMASI MENU */}
                {modalTab === 'info' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                        Nama Menu:
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Contoh: Dirty Matcha Latte"
                        className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                          Kategori:
                        </label>
                        <select
                          value={formData.categoryId}
                          onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                          className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
                        >
                          {categories.filter((c) => c.id !== 1).map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                          Harga Dasar (Rp):
                        </label>
                        <input
                          type="number"
                          step="1000"
                          min="0"
                          required
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                          className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs font-mono font-bold text-komazi-text focus:border-komazi-coral focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                        SKU Code:
                      </label>
                      <input
                        type="text"
                        placeholder="KMZ-XXX-001"
                        value={formData.sku}
                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs font-mono text-komazi-text focus:border-komazi-coral focus:outline-none"
                      />
                    </div>

                    {/* Image Upload with Cloudinary & Live Preview */}
                    <ImageUpload
                      value={formData.imageUrl}
                      onChange={(url) => setFormData({ ...formData, imageUrl: url })}
                      label="Foto / Gambar Produk"
                      aspectRatio="aspect-video"
                    />

                    <div>
                      <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                        Deskripsi Singkat:
                      </label>
                      <textarea
                        rows="2"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Bahan utama, rasa, notes barista..."
                        className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* TAB 2: PILIHAN UKURAN / VARIAN */}
                {modalTab === 'variants' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    {/* Information & Preset Toolbar */}
                    <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-2">
                      <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 text-komazi-coral shrink-0 mt-0.5" />
                        <p className="text-[11px] text-komazi-muted leading-relaxed">
                          Pilihan ukuran atau suhu memungkinkan kasir memilih varian saat input order.
                          <strong className="text-komazi-text"> Tambahan Harga (+Rp)</strong> akan ditambahkan ke harga dasar{' '}
                          <span className="font-mono text-komazi-coral font-bold">{formatRupiah(formData.price || 0)}</span>.
                        </p>
                      </div>

                      {/* Quick Presets */}
                      <div className="pt-2 border-t border-komazi-border/60 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] uppercase font-bold text-komazi-muted tracking-wider mr-1">
                          Preset Cepat:
                        </span>
                        <button
                          type="button"
                          onClick={() => handleApplyVariantPreset('standard')}
                          className="px-2 py-1 rounded-lg bg-komazi-surface hover:bg-komazi-border text-komazi-text text-[11px] font-semibold border border-komazi-border transition-colors"
                        >
                          + Standar (Reg/Lrg)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyVariantPreset('hot-iced')}
                          className="px-2 py-1 rounded-lg bg-komazi-surface hover:bg-komazi-border text-komazi-text text-[11px] font-semibold border border-komazi-border transition-colors"
                        >
                          + Hot & Iced
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyVariantPreset('single-double')}
                          className="px-2 py-1 rounded-lg bg-komazi-surface hover:bg-komazi-border text-komazi-text text-[11px] font-semibold border border-komazi-border transition-colors"
                        >
                          + Single/Double
                        </button>
                        {formData.variants?.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleApplyVariantPreset('clear')}
                            className="px-2 py-1 rounded-lg text-danger hover:bg-danger/10 text-[11px] font-semibold transition-colors ml-auto"
                          >
                            Hapus Semua
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Variant Items List */}
                    {formData.variants && formData.variants.length > 0 ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-12 gap-2 text-[10px] font-bold uppercase text-komazi-muted px-2">
                          <span className="col-span-5">Nama Ukuran / Varian</span>
                          <span className="col-span-3">Tambahan Harga (+Rp)</span>
                          <span className="col-span-3 text-right">Harga Final</span>
                          <span className="col-span-1 text-center">Hapus</span>
                        </div>

                        {formData.variants.map((variant, idx) => {
                          const finalPrice = Number(formData.price || 0) + Number(variant.extraPrice || 0);
                          return (
                            <div
                              key={variant.id || idx}
                              className="grid grid-cols-12 gap-2 items-center p-2 rounded-xl bg-komazi-surface-2 border border-komazi-border hover:border-komazi-muted/40 transition-colors"
                            >
                              <div className="col-span-5">
                                <input
                                  type="text"
                                  placeholder="Contoh: Regular, Large, 1L"
                                  value={variant.name}
                                  onChange={(e) => handleUpdateVariant(idx, 'name', e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-komazi-surface border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
                                />
                              </div>

                              <div className="col-span-3">
                                <div className="relative">
                                  <span className="absolute left-2.5 top-1.5 text-[11px] text-komazi-muted font-mono">+</span>
                                  <input
                                    type="number"
                                    step="500"
                                    min="0"
                                    placeholder="0"
                                    value={variant.extraPrice}
                                    onChange={(e) => handleUpdateVariant(idx, 'extraPrice', Number(e.target.value))}
                                    className="w-full pl-6 pr-2 py-1.5 rounded-lg bg-komazi-surface border border-komazi-border text-xs font-mono font-bold text-komazi-coral focus:border-komazi-coral focus:outline-none"
                                  />
                                </div>
                              </div>

                              <div className="col-span-3 text-right">
                                <span className="font-mono text-xs font-bold text-komazi-text">
                                  {formatRupiah(finalPrice)}
                                </span>
                              </div>

                              <div className="col-span-1 flex items-center justify-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveVariant(idx)}
                                  className="p-1.5 rounded-lg text-komazi-muted hover:text-danger hover:bg-danger/10 transition-colors"
                                  title="Hapus varian ini"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-8 text-center border border-dashed border-komazi-border rounded-xl space-y-2 bg-komazi-surface-2/30">
                        <Layers className="w-8 h-8 text-komazi-muted mx-auto opacity-50" />
                        <p className="text-xs text-komazi-muted">
                          Belum ada ukuran khusus yang ditambahkan. Produk akan dijual dengan satu ukuran standar.
                        </p>
                      </div>
                    )}

                    {/* Add Variant Button */}
                    <button
                      type="button"
                      onClick={handleAddVariant}
                      className="w-full py-2.5 rounded-xl border border-dashed border-komazi-coral/50 hover:border-komazi-coral bg-komazi-coral/5 hover:bg-komazi-coral/10 text-komazi-coral font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span>Tambah Opsi Ukuran Baru</span>
                    </button>
                  </div>
                )}

                {/* TAB 3: OPSI TAMBAHAN / MODIFIERS */}
                {modalTab === 'modifiers' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    {/* Information & Preset Toolbar */}
                    <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-2">
                      <div className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-komazi-teal-light shrink-0 mt-0.5" />
                        <p className="text-[11px] text-komazi-muted leading-relaxed">
                          Opsi tambahan (add-ons / topping / level gula) yang dapat dipilih pelanggan saat pemesanan.{' '}
                          <strong className="text-komazi-text">Biaya Rp 0</strong> menandakan opsi gratis (seperti Less Sugar / No Ice).
                        </p>
                      </div>

                      {/* Quick Presets */}
                      <div className="pt-2 border-t border-komazi-border/60 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] uppercase font-bold text-komazi-muted tracking-wider mr-1">
                          Preset Cepat:
                        </span>
                        <button
                          type="button"
                          onClick={() => handleApplyModifierPreset('coffee')}
                          className="px-2 py-1 rounded-lg bg-komazi-surface hover:bg-komazi-border text-komazi-text text-[11px] font-semibold border border-komazi-border transition-colors flex items-center gap-1"
                        >
                          <Coffee className="w-3 h-3 text-komazi-coral" />
                          <span>+ Add-on Kopi</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyModifierPreset('food')}
                          className="px-2 py-1 rounded-lg bg-komazi-surface hover:bg-komazi-border text-komazi-text text-[11px] font-semibold border border-komazi-border transition-colors"
                        >
                          + Topping Makanan
                        </button>
                        {formData.modifiers?.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleApplyModifierPreset('clear')}
                            className="px-2 py-1 rounded-lg text-danger hover:bg-danger/10 text-[11px] font-semibold transition-colors ml-auto"
                          >
                            Hapus Semua
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Modifier Items List */}
                    {formData.modifiers && formData.modifiers.length > 0 ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-12 gap-2 text-[10px] font-bold uppercase text-komazi-muted px-2">
                          <span className="col-span-6">Nama Tambahan / Modifier</span>
                          <span className="col-span-3">Harga Tambahan (Rp)</span>
                          <span className="col-span-2 text-center">Status</span>
                          <span className="col-span-1 text-center">Hapus</span>
                        </div>

                        {formData.modifiers.map((modifier, idx) => {
                          const isFree = Number(modifier.price || 0) === 0;
                          return (
                            <div
                              key={modifier.id || idx}
                              className="grid grid-cols-12 gap-2 items-center p-2 rounded-xl bg-komazi-surface-2 border border-komazi-border hover:border-komazi-muted/40 transition-colors"
                            >
                              <div className="col-span-6">
                                <input
                                  type="text"
                                  placeholder="Contoh: Extra Shot, Ganti Oat Milk"
                                  value={modifier.name}
                                  onChange={(e) => handleUpdateModifier(idx, 'name', e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-komazi-surface border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
                                />
                              </div>

                              <div className="col-span-3">
                                <input
                                  type="number"
                                  step="500"
                                  min="0"
                                  placeholder="0 (Gratis)"
                                  value={modifier.price}
                                  onChange={(e) => handleUpdateModifier(idx, 'price', Number(e.target.value))}
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-komazi-surface border border-komazi-border text-xs font-mono font-bold text-komazi-teal-light focus:border-komazi-coral focus:outline-none"
                                />
                              </div>

                              <div className="col-span-2 flex justify-center">
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                    isFree
                                      ? 'bg-success/15 text-success border border-success/30'
                                      : 'bg-komazi-teal/15 text-komazi-teal-light border border-komazi-teal-light/30'
                                  }`}
                                >
                                  {isFree ? 'Gratis' : `+${formatRupiah(modifier.price)}`}
                                </span>
                              </div>

                              <div className="col-span-1 flex items-center justify-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveModifier(idx)}
                                  className="p-1.5 rounded-lg text-komazi-muted hover:text-danger hover:bg-danger/10 transition-colors"
                                  title="Hapus opsi ini"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-8 text-center border border-dashed border-komazi-border rounded-xl space-y-2 bg-komazi-surface-2/30">
                        <Sparkles className="w-8 h-8 text-komazi-muted mx-auto opacity-50" />
                        <p className="text-xs text-komazi-muted">
                          Belum ada opsi tambahan/add-on untuk menu ini.
                        </p>
                      </div>
                    )}

                    {/* Add Modifier Button */}
                    <button
                      type="button"
                      onClick={handleAddModifier}
                      className="w-full py-2.5 rounded-xl border border-dashed border-komazi-teal-light/50 hover:border-komazi-teal-light bg-komazi-teal/5 hover:bg-komazi-teal/10 text-komazi-teal-light font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span>Tambah Opsi Tambahan (Add-on) Baru</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Persistent Footer */}
              <div className="p-4 border-t border-komazi-border bg-komazi-surface flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-komazi-muted">
                    Total: <strong className="text-komazi-text">{formData.variants?.length || 0}</strong> Ukuran,{' '}
                    <strong className="text-komazi-text">{formData.modifiers?.length || 0}</strong> Add-on
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsProductModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-komazi-surface-2 text-komazi-muted hover:text-white font-semibold text-xs transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>{editingProduct ? 'Simpan Perubahan' : 'Tambah Menu'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirmation Alert Modal */}
      <AlertModal
        isOpen={!!productToDelete}
        onClose={() => setProductToDelete(null)}
        onConfirm={() => {
          if (productToDelete) {
            deleteProduct(productToDelete.id);
            toast.success(`Produk "${productToDelete.name}" berhasil dihapus.`);
            setProductToDelete(null);
          }
        }}
        type="danger"
        title="Hapus Produk Menu?"
        message={`Apakah Anda yakin ingin menghapus "${productToDelete?.name}" dari katalog produk? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Ya, Hapus Produk"
        cancelText="Batal"
      />

      {/* Custom Add Category Prompt Modal */}
      <PromptModal
        isOpen={isAddCatModalOpen}
        onClose={() => setIsAddCatModalOpen(false)}
        onConfirm={async (name) => {
          const res = await addCategory(name);
          if (res?.success) {
            toast.success(`Kategori "${name}" berhasil ditambahkan!`);
          } else {
            toast.error(res?.message || 'Gagal menambahkan kategori');
          }
        }}
        title="Tambah Kategori Baru"
        message="Masukkan nama kategori menu baru yang ingin ditambahkan ke katalog:"
        placeholder="Contoh: Mocktail, Bakery, Signature..."
        confirmText="Tambah Kategori"
        icon={Tag}
      />

      {/* Comprehensive Category CRUD Management Modal */}
      <CategoryManagementModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
      />

      {/* Bulk Delete Confirmation Modal */}
      <AlertModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={() => {
          bulkDeleteProducts(selectedProductIds);
          toast.success(`${selectedProductIds.length} menu berhasil dihapus.`);
          setSelectedProductIds([]);
          setIsBulkDeleteModalOpen(false);
        }}
        type="danger"
        title={`Hapus ${selectedProductIds.length} Menu Terpilih?`}
        message={`Apakah Anda yakin ingin menghapus ${selectedProductIds.length} menu yang dipilih dari katalog produk? Tindakan ini tidak dapat dibatalkan.`}
        confirmText={`Ya, Hapus ${selectedProductIds.length} Menu`}
        cancelText="Batal"
      />

      {/* Bulk Category Change Modal */}
      {isBulkCatModalOpen && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn select-none">
          <div className="w-full max-w-sm bg-komazi-surface border border-komazi-border rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-komazi-border">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-komazi-coral/15 border border-komazi-coral/30 flex items-center justify-center text-komazi-coral">
                  <Tag className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-komazi-text">Pindah Kategori Menu</h3>
                  <p className="text-[11px] text-komazi-muted">{selectedProductIds.length} menu terpilih</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkCatModalOpen(false)}
                className="text-komazi-muted hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-komazi-text">
                Pilih Kategori Tujuan:
              </label>
              <select
                value={bulkTargetCatId}
                onChange={(e) => setBulkTargetCatId(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
              >
                {categories
                  .filter((c) => c.id !== 1)
                  .map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBulkCatModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-komazi-muted hover:text-white hover:bg-komazi-surface-2 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const cat = categories.find((c) => c.id === Number(bulkTargetCatId));
                  if (cat) {
                    bulkUpdateCategory(selectedProductIds, cat.id, cat.name);
                    toast.success(`${selectedProductIds.length} menu berhasil dipindahkan ke kategori "${cat.name}".`);
                    setSelectedProductIds([]);
                    setIsBulkCatModalOpen(false);
                  }
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-komazi-coral hover:bg-komazi-coral-dark text-white shadow-md transition-all active:scale-95"
              >
                Terapkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recipe Modal for COGS calculation */}
      {canManageRecipe && (
        <RecipeModal
          isOpen={isRecipeModalOpen}
          onClose={() => {
            setIsRecipeModalOpen(false);
            setSelectedProductForRecipe(null);
          }}
          product={selectedProductForRecipe}
        />
      )}
    </div>
  );
}
