import React, { useState } from 'react';
import { formatRupiah } from '../../utils/format';
import { X, Check, Plus, MessageSquare } from 'lucide-react';

export default function ProductVariantModal({ product, onClose, onAddToCart }) {
  const hasVariants = product.variants && product.variants.length > 0;
  const [selectedVariant, setSelectedVariant] = useState(
    hasVariants ? product.variants[0] : null
  );
  const [selectedModifiers, setSelectedModifiers] = useState([]);
  const [note, setNote] = useState('');

  const toggleModifier = (mod) => {
    if (selectedModifiers.some((m) => m.id === mod.id)) {
      setSelectedModifiers(selectedModifiers.filter((m) => m.id !== mod.id));
    } else {
      setSelectedModifiers([...selectedModifiers, mod]);
    }
  };

  const variantExtra = selectedVariant ? Number(selectedVariant.extraPrice || 0) : 0;
  const modifiersTotal = selectedModifiers.reduce((sum, m) => sum + Number(m.price || 0), 0);
  const calculatedUnitPrice = Number(product.price) + variantExtra + modifiersTotal;

  const handleSubmit = (e) => {
    e.preventDefault();
    onAddToCart(product, selectedVariant, selectedModifiers, note);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-komazi-border">
          <div className="flex items-center gap-3">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-12 h-12 rounded-xl object-cover border border-komazi-border"
            />
            <div>
              <h2 className="font-bold text-base text-komazi-text">{product.name}</h2>
              <span className="text-xs font-semibold text-komazi-coral">
                {product.categoryName} • Base: {formatRupiah(product.price)}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-komazi-surface-2 text-komazi-muted hover:text-white hover:bg-komazi-border transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Variant Selection */}
          {hasVariants && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-komazi-muted mb-2">
                Pilih Ukuran / Suhu / Varian:
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {product.variants.map((v) => {
                  const isSelected = selectedVariant?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariant(v)}
                      className={`flex items-center justify-between p-3 rounded-xl border text-xs font-medium transition-all ${
                        isSelected
                          ? 'border-komazi-coral bg-komazi-coral/10 text-komazi-coral shadow-sm'
                          : 'border-komazi-border bg-komazi-surface-2 text-komazi-text hover:border-komazi-muted/40'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isSelected
                              ? 'border-komazi-coral bg-komazi-coral text-white'
                              : 'border-komazi-muted'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                        <span className="font-semibold">{v.name}</span>
                      </div>
                      <span className="text-[11px] font-mono text-komazi-muted">
                        {v.extraPrice > 0 ? `+${formatRupiah(v.extraPrice)}` : 'Standard'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add-on / Modifiers Selection */}
          {product.modifiers && product.modifiers.length > 0 && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-komazi-muted mb-2">
                Tambahan / Modifier (Add-ons):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {product.modifiers.map((mod) => {
                  const isChecked = selectedModifiers.some((m) => m.id === mod.id);
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => toggleModifier(mod)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium transition-all ${
                        isChecked
                          ? 'border-komazi-teal-light bg-komazi-teal/15 text-komazi-teal-light'
                          : 'border-komazi-border bg-komazi-surface-2 text-komazi-text hover:border-komazi-muted/40'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                            isChecked
                              ? 'border-komazi-teal-light bg-komazi-teal text-white'
                              : 'border-komazi-muted'
                          }`}
                        >
                          {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                        <span>{mod.name}</span>
                      </div>
                      <span className="font-mono text-[11px] text-komazi-muted">
                        {mod.price > 0 ? `+${formatRupiah(mod.price)}` : 'Free'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Special Barista Note */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-komazi-muted mb-2">
              <MessageSquare className="w-3.5 h-3.5 text-komazi-coral" />
              <span>Catatan Khusus Barista / Dapur:</span>
            </label>
            <input
              type="text"
              placeholder="Contoh: Less ice 50%, gula pisah, tanpa sedotan..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl bg-komazi-surface-2 border border-komazi-border px-3.5 py-2.5 text-xs text-komazi-text placeholder-komazi-muted/60 focus:border-komazi-coral focus:outline-none"
            />
          </div>
        </form>

        {/* Footer / Submit */}
        <div className="p-4 border-t border-komazi-border bg-komazi-surface flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] text-komazi-muted">Harga Item:</span>
            <span className="text-lg font-bold font-mono text-komazi-coral tabular-nums">
              {formatRupiah(calculatedUnitPrice)}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            className="flex items-center gap-2 px-6 py-2.5 min-h-[44px] rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-sm shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Tambah ke Pesanan</span>
          </button>
        </div>
      </div>
    </div>
  );
}
