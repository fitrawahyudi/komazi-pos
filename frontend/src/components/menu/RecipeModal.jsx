import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  Calculator,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Percent,
  Coins,
  Scale,
  Package,
  Layers,
  Save,
  HelpCircle,
} from 'lucide-react';
import { useRecipeStore } from '../../store/useRecipeStore';
import { useStockStore } from '../../store/stockStore';
import { formatRupiah } from '../../utils/format';
import { toast } from '../../store/toastStore';

export default function RecipeModal({ isOpen, onClose, product }) {
  const { fetchRecipe, saveRecipe } = useRecipeStore();
  const { ingredients, fetchIngredients } = useStockStore();

  const [recipeItems, setRecipeItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load existing recipe and ingredients when modal opens or product changes
  useEffect(() => {
    if (!isOpen || !product?.id) {
      setRecipeItems([]);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const productId = product.id;

    Promise.all([
      fetchRecipe(productId),
      fetchIngredients(),
    ])
      .then(([recipeData]) => {
        if (!isMounted) return;

        if (recipeData && Array.isArray(recipeData.recipeItems) && recipeData.recipeItems.length > 0) {
          setRecipeItems(
            recipeData.recipeItems.map((item) => ({
              id: item.id || Date.now() + Math.random(),
              ingredientId: Number(item.ingredientId),
              quantity: Number(item.quantity) || 1,
              variantId: item.variantId ? Number(item.variantId) : null,
            }))
          );
        } else {
          // Check local recipe store fallback
          const local = useRecipeStore.getState().recipes[productId] || [];
          setRecipeItems(
            local.map((item) => ({
              id: item.id || Date.now() + Math.random(),
              ingredientId: Number(item.ingredientId),
              quantity: Number(item.quantity) || 1,
              variantId: item.variantId ? Number(item.variantId) : null,
            }))
          );
        }
      })
      .catch((err) => {
        console.error('Failed to load recipe or ingredients:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, product?.id]);

  // Ingredients lookup map for live cost calculation
  const ingredientsMap = useMemo(() => {
    const map = new Map();
    ingredients.forEach((ing) => {
      map.set(Number(ing.id), ing);
    });
    return map;
  }, [ingredients]);

  // Live HPP calculation
  const calculatedItems = useMemo(() => {
    return recipeItems.map((item) => {
      const ing = ingredientsMap.get(Number(item.ingredientId));
      const costPerUnit = Number(ing?.costPerUnit) || 0;
      const qty = Number(item.quantity) || 0;
      const lineCost = Math.round(qty * costPerUnit * 100) / 100;

      return {
        ...item,
        ingredientName: ing?.name || 'Pilih Bahan',
        unit: ing?.unit || '-',
        costPerUnit,
        lineCost,
      };
    });
  }, [recipeItems, ingredientsMap]);

  // Total HPP for base product (items with variantId === null)
  const baseHpp = useMemo(() => {
    return calculatedItems
      .filter((item) => !item.variantId)
      .reduce((sum, item) => sum + item.lineCost, 0);
  }, [calculatedItems]);

  const sellingPrice = Number(product?.price) || 0;
  const grossProfit = Math.max(0, sellingPrice - baseHpp);
  const grossMargin = sellingPrice > 0
    ? Math.round(((sellingPrice - baseHpp) / sellingPrice) * 10000) / 100
    : 0;

  // Margin health classification
  const marginStatus = useMemo(() => {
    if (recipeItems.length === 0) {
      return {
        label: 'Resep Belum Diatur',
        desc: 'HPP belum dapat dihitung karena takaran bahan belum dimasukkan',
        color: 'text-komazi-muted bg-komazi-surface-2 border-komazi-border',
        badge: 'bg-zinc-700 text-zinc-300',
      };
    }
    if (grossMargin >= 60) {
      return {
        label: 'Margin Sangat Sehat (Ideal F&B)',
        desc: `Laba kotor ${grossMargin}% sangat optimal untuk menjaga operational expense & laba bersih bisnis.`,
        color: 'text-emerald-400 bg-emerald-950/30 border-emerald-500/30',
        badge: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
      };
    }
    if (grossMargin >= 40) {
      return {
        label: 'Margin Standar',
        desc: `Laba kotor ${grossMargin}% berada dalam rentang wajar cafe & resto.`,
        color: 'text-amber-400 bg-amber-950/30 border-amber-500/30',
        badge: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
      };
    }
    return {
      label: 'Margin Tipis (Perlu Evaluasi)',
      desc: `Laba kotor ${grossMargin}% terlalu rendah. Disarankan meninjau harga jual atau mencari supplier bahan lebih murah.`,
      color: 'text-rose-400 bg-rose-950/30 border-rose-500/30',
      badge: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
    };
  }, [grossMargin, recipeItems.length]);

  // Handler: Add new row
  const handleAddRow = () => {
    const stockList = ingredients.length > 0 ? ingredients : useStockStore.getState().ingredients;
    const firstIng = stockList[0];
    setRecipeItems((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        ingredientId: firstIng ? Number(firstIng.id) : '',
        quantity: 1,
        variantId: null,
      },
    ]);
  };

  // Handler: Update row
  const handleUpdateRow = (index, field, value) => {
    setRecipeItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Handler: Remove row
  const handleRemoveRow = (index) => {
    setRecipeItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Handler: Save
  const handleSave = async () => {
    if (!product) return;

    // Validate that all items have ingredientId and quantity > 0
    const validItems = recipeItems
      .filter((item) => item.ingredientId && Number(item.quantity) > 0)
      .map((item) => ({
        ingredientId: Number(item.ingredientId),
        quantity: Number(item.quantity),
        variantId: item.variantId ? Number(item.variantId) : null,
      }));

    setSaving(true);
    try {
      const res = await saveRecipe(product.id, validItems);
      if (res.success) {
        toast.success(`Resep & HPP "${product.name}" berhasil disimpan!`);
        onClose();
      } else {
        toast.error('Gagal menyimpan resep');
      }
    } catch (err) {
      toast.error(err.message || 'Gagal menyimpan resep');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !product) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
    >
      <div className="min-h-full flex items-center justify-center">
        <div className="bg-komazi-surface border border-komazi-border w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.5rem)] my-auto">
          {/* 1. Modal Header */}
          <div className="p-4 sm:p-5 border-b border-komazi-border bg-komazi-surface-2 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-komazi-coral/15 border border-komazi-coral/30 flex items-center justify-center text-komazi-coral shrink-0">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-komazi-text font-display">
                  Resep & Kalkulasi HPP
                </h2>
              </div>
              <p className="text-xs text-komazi-muted mt-0.5">
                <p>{product.name}</p>
              </p>
            </div>
          </div>
        </div>

        {/* 2. Live Cost & Margin Cards */}
        <div className="p-4 sm:p-5 border-b border-komazi-border bg-gradient-to-r from-komazi-surface to-komazi-surface-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Selling Price */}
            <div className="p-3 rounded-xl bg-komazi-surface/80 border border-komazi-border">
              <div className="flex items-center gap-1.5 text-komazi-muted text-[11px] font-medium mb-1">
                <Coins className="w-3.5 h-3.5 text-komazi-teal-light" />
                <span>Harga Jual</span>
              </div>
              <p className="text-base sm:text-lg font-black font-mono text-komazi-text">
                {formatRupiah(sellingPrice)}
              </p>
            </div>

            {/* Total HPP */}
            <div className="p-3 rounded-xl bg-komazi-surface/80 border border-komazi-border">
              <div className="flex items-center gap-1.5 text-komazi-muted text-[11px] font-medium mb-1">
                <Scale className="w-3.5 h-3.5 text-komazi-coral" />
                <span>Total HPP (Modal)</span>
              </div>
              <p className="text-base sm:text-lg font-black font-mono text-komazi-coral">
                {formatRupiah(baseHpp)}
              </p>
            </div>

            {/* Gross Profit */}
            <div className="p-3 rounded-xl bg-komazi-surface/80 border border-komazi-border">
              <div className="flex items-center gap-1.5 text-komazi-muted text-[11px] font-medium mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>Laba Kotor</span>
              </div>
              <p className="text-base sm:text-lg font-black font-mono text-emerald-400">
                {formatRupiah(grossProfit)}
              </p>
            </div>

            {/* Gross Margin % */}
            <div className="p-3 rounded-xl bg-komazi-surface/80 border border-komazi-border">
              <div className="flex items-center gap-1.5 text-komazi-muted text-[11px] font-medium mb-1">
                <Percent className="w-3.5 h-3.5 text-purple-400" />
                <span>Margin Laba</span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-base sm:text-lg font-black font-mono text-komazi-text">
                  {grossMargin}%
                </p>
              </div>
            </div>
          </div>

          {/* Margin Status Alert */}
          <div className={`mt-3 p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${marginStatus.color}`}>
            <div className="flex items-center gap-2">
              {grossMargin >= 60 ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : grossMargin >= 40 ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-amber-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span className="font-semibold">{marginStatus.label}:</span>
              <span className="text-[11px] opacity-90 hidden sm:inline">{marginStatus.desc}</span>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${marginStatus.badge}`}>
              {recipeItems.length} Bahan
            </span>
          </div>
        </div>

        {/* 3. Recipe Items Table */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-komazi-text uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-komazi-coral" />
                <span>Komposisi Bahan Baku</span>
              </h3>
              <p className="text-[11px] text-komazi-muted mt-0.5">
                Masukkan takaran bahan baku yang digunakan untuk membuat 1 porsi menu ini.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddRow}
              className="px-3 py-1.5 rounded-xl bg-komazi-coral/15 hover:bg-komazi-coral/25 border border-komazi-coral/30 text-komazi-coral text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Tambah Bahan</span>
            </button>
          </div>

          {ingredients.length === 0 && !loading && (
            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>
                Master bahan baku belum tersedia di sistem. Tambahkan data bahan baku pada menu <strong>Sumber Persediaan</strong> terlebih dahulu agar harga modal dapat dikalkulasikan.
              </span>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-komazi-muted text-xs animate-pulse">
              Memuat data resep & harga bahan...
            </div>
          ) : recipeItems.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-dashed border-komazi-border bg-komazi-surface-2/40">
              <Package className="w-8 h-8 text-komazi-muted/50 mx-auto mb-2" />
              <p className="text-xs font-semibold text-komazi-text">Belum ada bahan baku pada resep ini</p>
              <p className="text-[11px] text-komazi-muted mt-1 max-w-sm mx-auto">
                Klik tombol "Tambah Bahan" di atas untuk menambahkan bahan seperti biji kopi, susu, sirup, atau kemasan cup.
              </p>
              <button
                type="button"
                onClick={handleAddRow}
                className="mt-3 px-3.5 py-1.5 rounded-xl bg-komazi-coral text-white text-xs font-bold shadow-sm"
              >
                + Tambah Bahan Pertama
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-komazi-border overflow-hidden bg-komazi-surface">
              <table className="w-full text-left text-xs">
                <thead className="bg-komazi-surface-2 border-b border-komazi-border text-komazi-muted font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Bahan Baku</th>
                    {product.variants && product.variants.length > 0 && (
                      <th className="py-2.5 px-3 w-32">Varian (Opsional)</th>
                    )}
                    <th className="py-2.5 px-3 w-32">Takaran</th>
                    <th className="py-2.5 px-3 w-28 text-right">Harga Modal</th>
                    <th className="py-2.5 px-3 w-28 text-right">Subtotal HPP</th>
                    <th className="py-2.5 px-3 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-komazi-border">
                  {calculatedItems.map((item, index) => {
                    const ing = ingredientsMap.get(Number(item.ingredientId));
                    const unitName = ing?.unit || 'unit';
                    const hasCost = Number(ing?.costPerUnit) > 0;

                    return (
                      <tr key={item.id} className="hover:bg-komazi-surface-2/50 transition-colors">
                        {/* 1. Ingredient Selector */}
                        <td className="py-2.5 px-3">
                          <select
                            value={item.ingredientId || ''}
                            onChange={(e) => handleUpdateRow(index, 'ingredientId', Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
                          >
                            <option value="" disabled>-- Pilih Bahan Baku --</option>
                            {ingredients.map((ingItem) => (
                              <option key={ingItem.id} value={Number(ingItem.id)}>
                                {ingItem.name} ({ingItem.unit}) - {formatRupiah(ingItem.costPerUnit || 0)}/{ingItem.unit}
                              </option>
                            ))}
                          </select>
                          {!hasCost && item.ingredientId && (
                            <span className="text-[10px] text-amber-400 mt-0.5 inline-block">
                              ⚠️ Modal belum diatur di menu stok (Rp 0)
                            </span>
                          )}
                        </td>

                        {/* 2. Variant Selector (if product has variants) */}
                        {product.variants && product.variants.length > 0 && (
                          <td className="py-2.5 px-3">
                            <select
                              value={item.variantId || ''}
                              onChange={(e) => handleUpdateRow(index, 'variantId', e.target.value ? Number(e.target.value) : null)}
                              className="w-full px-2 py-1.5 rounded-lg bg-komazi-surface-2 border border-komazi-border text-[11px] text-komazi-text focus:border-komazi-coral focus:outline-none"
                            >
                              <option value="">Semua Varian</option>
                              {product.variants.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.name}
                                </option>
                              ))}
                            </select>
                          </td>
                        )}

                        {/* 3. Quantity input */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={item.quantity}
                              onChange={(e) => handleUpdateRow(index, 'quantity', e.target.value)}
                              className="w-20 px-2 py-1.5 rounded-lg bg-komazi-surface-2 border border-komazi-border text-xs font-mono font-bold text-komazi-text focus:border-komazi-coral focus:outline-none text-right"
                            />
                            <span className="text-[11px] text-komazi-muted font-medium shrink-0">
                              {unitName}
                            </span>
                          </div>
                        </td>

                        {/* 4. Cost per unit */}
                        <td className="py-2.5 px-3 text-right font-mono text-[11px] text-komazi-muted">
                          {formatRupiah(item.costPerUnit)}
                        </td>

                        {/* 5. Subtotal HPP */}
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-xs text-komazi-coral">
                          {formatRupiah(item.lineCost)}
                        </td>

                        {/* 6. Remove button */}
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(index)}
                            className="p-1 rounded text-komazi-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Hapus bahan dari resep"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Quick tips */}
          <div className="p-3 rounded-xl bg-komazi-surface-2/60 border border-komazi-border text-[11px] text-komazi-muted flex items-start gap-2">
            <HelpCircle className="w-4 h-4 text-komazi-teal-light shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-komazi-text">Tips Penentuan Takaran F&B:</p>
              <p className="mt-0.5">
                Pastikan satuan takaran sesuai dengan master bahan (misal 18 gram untuk biji espresso, 150 ml untuk fresh milk, 1 pcs untuk cup). Perubahan resep akan langsung memperbarui kalkulasi laba kotor transaksi baru.
              </p>
            </div>
          </div>
        </div>

        {/* 4. Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-komazi-border bg-komazi-surface-2 flex items-center justify-between gap-3">
          <div className="text-xs text-komazi-muted">
            Total {recipeItems.length} jenis bahan baku pada resep dasar
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-komazi-surface hover:bg-komazi-border text-komazi-text text-xs font-semibold border border-komazi-border transition-colors disabled:opacity-50"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Menyimpan...' : 'Simpan'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}
