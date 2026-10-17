import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Search,
  Check,
  X,
  Store,
  RefreshCw
} from 'lucide-react';
import { useCmsStore } from '../../store/cmsStore';
import { api } from '../../services/api';
import { useToastStore } from '../../store/toastStore';
import { getProductInitials, getProductColor } from '../../utils/format';

const BADGE_PRESETS = [
  'Signature',
  'Authentic Medan',
  'Best Seller',
  "Chef's Pick",
  'Popular Choice',
  'Barista Special',
  'New'
];

export default function CmsMenuSpotlightPage() {
  const {
    spotlights,
    fetchSpotlights,
    addSpotlight,
    updateSpotlight,
    deleteSpotlight,
    reorderSpotlights,
    saving,
    loading
  } = useCmsStore();
  const { addToast } = useToastStore();

  const [posProducts, setPosProducts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedBadge, setSelectedBadge] = useState('Signature');
  const [customBadgeInput, setCustomBadgeInput] = useState('');
  const [fetchingProducts, setFetchingProducts] = useState(false);

  useEffect(() => {
    fetchSpotlights();
  }, [fetchSpotlights]);

  const openAddModal = async () => {
    setModalOpen(true);
    if (posProducts.length === 0) {
      setFetchingProducts(true);
      try {
        const res = await api.products.getAll();
        if (res?.success && Array.isArray(res?.data)) {
          setPosProducts(res.data);
        }
      } catch (err) {
        addToast('Gagal memuat katalog produk POS', 'error');
      } finally {
        setFetchingProducts(false);
      }
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProductId) {
      addToast('Pilih produk dari katalog terlebih dahulu', 'error');
      return;
    }

    const badge = customBadgeInput.trim() || selectedBadge;
    const res = await addSpotlight({
      productId: selectedProductId,
      customBadge: badge,
      isFeatured: true
    });

    if (res?.success) {
      addToast('Menu berhasil ditambahkan ke spotlight!', 'success');
      setModalOpen(false);
      setSelectedProductId('');
      setCustomBadgeInput('');
    } else {
      addToast(res?.message || 'Gagal menambahkan menu', 'error');
    }
  };

  const handleToggleFeatured = async (item) => {
    const res = await updateSpotlight(item.id, {
      isFeatured: !item.isFeatured
    });
    if (res?.success) {
      addToast(
        !item.isFeatured ? 'Menu kini ditampilkan di landing page' : 'Menu disembunyikan',
        'info'
      );
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Hapus "${name}" dari menu spotlight?`)) {
      const res = await deleteSpotlight(id);
      if (res?.success) {
        addToast('Menu dihapus dari spotlight', 'success');
      }
    }
  };

  const handleMove = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= spotlights.length) return;

    const newItems = [...spotlights];
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    await reorderSpotlights(newItems);
  };

  const existingProductIds = new Set(spotlights.map((s) => s.productId));
  const filteredProducts = posProducts.filter(
    (p) =>
      p.isActive &&
      !existingProductIds.has(p.id) &&
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-komazi-coral" />
            Menu Spotlight (Etalase Pilihan)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Pilih menu dari katalog POS kasir untuk ditampilkan secara menonjol di halaman depan.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-komazi-coral to-[#ff7368] hover:from-komazi-coral-dark hover:to-komazi-coral text-white font-semibold text-xs transition-all shadow-lg shadow-komazi-coral/30"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Menu Spotlight</span>
        </button>
      </div>

      {/* Spotlights List */}
      <div className="space-y-3">
        {loading && (
          <div className="text-center py-12 text-slate-400 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-komazi-coral" />
            Memuat menu spotlight...
          </div>
        )}

        {!loading && spotlights.length === 0 && (
          <div className="text-center py-16 bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
            <Store className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-300">Belum Ada Menu Spotlight</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Sorot menu signature atau best seller dari kasir POS agar pengunjung langsung tertarik
              memesan.
            </p>
            <button
              onClick={openAddModal}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-komazi-coral to-[#ff7368] text-white font-semibold text-xs shadow-lg shadow-komazi-coral/30"
            >
              <Plus className="w-4 h-4" />
              Pilih Menu Sekarang
            </button>
          </div>
        )}

        {!loading &&
          spotlights.map((item, index) => {
            const product = item.product || {};
            return (
              <div
                key={item.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border transition-all ${
                  item.isFeatured
                    ? 'bg-slate-900/80 border-slate-800 hover:border-komazi-coral/40'
                    : 'bg-slate-950/40 border-slate-900 opacity-60'
                }`}
              >
                {/* Product Info */}
                <div className="flex items-center gap-4 min-w-0">
                  <div className="text-xs font-mono font-bold text-slate-500 w-6 text-center">
                    #{index + 1}
                  </div>

                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-14 h-14 rounded-xl object-cover bg-slate-800 border border-slate-700/50 shrink-0"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        if (e.currentTarget.nextSibling) {
                          e.currentTarget.nextSibling.style.display = 'flex';
                        }
                      }}
                    />
                  ) : null}
                  <div
                    style={{ display: product.imageUrl ? 'none' : 'flex' }}
                    className="w-14 h-14 rounded-xl bg-gradient-to-b from-[#FF6B5E] to-[#D9382B] flex items-center justify-center font-sans font-black text-xl text-white shrink-0 shadow-sm shadow-komazi-coral/20 select-none"
                  >
                    {getProductInitials(product.name)}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-white truncate">
                        {product.name || 'Produk Dihapus'}
                      </span>
                      {item.customBadge && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-komazi-coral/15 text-komazi-coral border border-komazi-coral/30">
                          {item.customBadge}
                        </span>
                      )}
                      {!item.isFeatured && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                          Disembunyikan
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-komazi-coral font-mono mt-0.5 font-medium">
                      Rp {Number(product.price || 0).toLocaleString('id-ID')}
                      {product.category?.name && (
                        <span className="text-slate-500 ml-2 font-sans font-normal text-[11px]">
                          • {product.category.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions & Ordering */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => handleMove(index, -1)}
                    disabled={index === 0 || saving}
                    title="Naikkan Urutan"
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white disabled:opacity-30 transition-colors"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleMove(index, 1)}
                    disabled={index === spotlights.length - 1 || saving}
                    title="Turunkan Urutan"
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white disabled:opacity-30 transition-colors"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleToggleFeatured(item)}
                    title={item.isFeatured ? 'Sembunyikan dari landing page' : 'Tampilkan'}
                    className={`p-1.5 rounded-lg border transition-colors ${
                      item.isFeatured
                        ? 'bg-komazi-coral/10 border-komazi-coral/30 text-komazi-coral'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    {item.isFeatured ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    onClick={() => handleDelete(item.id, product.name)}
                    title="Hapus dari spotlight"
                    className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
      </div>

      {/* Modal Tambah Menu Spotlight */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Sparkles className="w-4 h-4 text-komazi-coral" />
                Pilih Menu dari Katalog POS
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              {/* Search POS Products */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Cari Produk POS
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ketik nama menu kasir..."
                    className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30"
                  />
                </div>
              </div>

              {/* Product Selector Box */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Pilih Produk
                </label>
                <div className="max-h-48 overflow-y-auto border border-slate-800 rounded-xl divide-y divide-slate-800/80 bg-slate-950 custom-scrollbar">
                  {fetchingProducts && (
                    <div className="p-4 text-center text-xs text-slate-500">
                      Memuat katalog produk...
                    </div>
                  )}

                  {!fetchingProducts && filteredProducts.length === 0 && (
                    <div className="p-4 text-center text-xs text-slate-500">
                      Tidak ada produk yang cocok atau semua produk sudah disorot.
                    </div>
                  )}

                  {!fetchingProducts &&
                    filteredProducts.map((p) => {
                      const isSelected = selectedProductId === p.id;
                      return (
                        <div
                          key={p.id}
                          onClick={() => setSelectedProductId(p.id)}
                          className={`flex items-center justify-between p-3 cursor-pointer text-xs transition-colors ${
                            isSelected
                              ? 'bg-komazi-coral/20 text-white'
                              : 'text-slate-300 hover:bg-slate-900'
                          }`}
                        >
                          <div>
                            <div className="font-semibold">{p.name}</div>
                            <div className="text-[11px] text-komazi-coral font-mono">
                              Rp {Number(p.price).toLocaleString('id-ID')}
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-komazi-coral" />}
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Badge Selection */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Label Badge Menu
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {BADGE_PRESETS.map((badge) => (
                    <button
                      type="button"
                      key={badge}
                      onClick={() => {
                        setSelectedBadge(badge);
                        setCustomBadgeInput('');
                      }}
                      className={`px-2.5 py-1 text-[11px] rounded-lg font-medium transition-all ${
                        selectedBadge === badge && !customBadgeInput
                          ? 'bg-komazi-coral text-white font-bold shadow-sm shadow-komazi-coral/30'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {badge}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={customBadgeInput}
                  onChange={(e) => setCustomBadgeInput(e.target.value)}
                  placeholder="Atau ketik badge kustom (misal: Diskon 20%, Fresh Roasting)..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!selectedProductId || saving}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-komazi-coral to-[#ff7368] hover:from-komazi-coral-dark hover:to-komazi-coral disabled:opacity-50 text-white shadow-lg shadow-komazi-coral/30"
                >
                  {saving ? 'Menyimpan...' : 'Tambahkan ke Spotlight'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
