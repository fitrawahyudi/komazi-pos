import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { formatRupiah, getProductInitials, getProductColor } from '../../utils/format';
import {
  X,
  Check,
  Sparkles,
  AlertCircle,
  Delete,
  CornerDownLeft,
  Plus,
  SlidersHorizontal,
  MessageSquare,
  Coins,
} from 'lucide-react';
import { scrollInputIntoViewOnFocus } from '../../utils/keyboard';

export default function DynamicPriceModal({
  product,
  initialPrice = null,
  initialVariant = null,
  initialModifiers = [],
  initialNote = '',
  isEditMode = false,
  onClose,
  onSubmit,
}) {
  const minPrice = Number(product?.minPrice) || 0;
  const defaultSuggestedPrice = Number(product?.price) || 0;

  // Initial price state (if editing cart item or product has suggested price)
  const [priceStr, setPriceStr] = useState(() => {
    if (initialPrice !== null && initialPrice !== undefined && initialPrice > 0) {
      return String(initialPrice);
    }
    if (defaultSuggestedPrice > 0) {
      return String(defaultSuggestedPrice);
    }
    if (minPrice > 0) {
      return String(minPrice);
    }
    return '';
  });

  const [hasVariants] = useState(() => product?.variants && product.variants.length > 0);
  const [selectedVariant, setSelectedVariant] = useState(() => {
    if (initialVariant) return initialVariant;
    return hasVariants ? product.variants[0] : null;
  });

  const [selectedModifiers, setSelectedModifiers] = useState(initialModifiers || []);
  const [note, setNote] = useState(initialNote || '');
  const [errorMsg, setErrorMsg] = useState('');

  const modalRef = useRef(null);
  const inputRef = useRef(null);

  const numericPrice = useMemo(() => {
    const parsed = parseInt(priceStr.replace(/\D/g, ''), 10);
    return isNaN(parsed) ? 0 : parsed;
  }, [priceStr]);

  const variantExtra = selectedVariant ? Number(selectedVariant.extraPrice || 0) : 0;
  const modifiersTotal = selectedModifiers.reduce((sum, m) => sum + Number(m.price || 0), 0);
  const finalUnitPrice = numericPrice + variantExtra + modifiersTotal;

  const initials = useMemo(() => getProductInitials(product?.name || ''), [product?.name]);
  const colorScheme = useMemo(() => getProductColor(product?.name || ''), [product?.name]);

  // Keypad press handler
  const handleKeypadPress = useCallback((key) => {
    setErrorMsg('');
    if (key === 'CLEAR') {
      setPriceStr('');
      return;
    }
    if (key === 'BACKSPACE') {
      setPriceStr((prev) => prev.slice(0, -1));
      return;
    }
    if (key === '00' || key === '000') {
      setPriceStr((prev) => {
        if (!prev || prev === '0') return '';
        const next = prev + key;
        return next.length > 9 ? prev : next;
      });
      return;
    }
    // Number digit 0-9
    setPriceStr((prev) => {
      if (prev === '0') return key;
      const next = prev + key;
      return next.length > 9 ? prev : next;
    });
  }, []);

  // Quick preset increment
  const handleAddPreset = (amount) => {
    setErrorMsg('');
    setPriceStr((prev) => {
      const cur = parseInt(prev.replace(/\D/g, ''), 10) || 0;
      return String(cur + amount);
    });
  };

  // Keyboard navigation listener (Esc to close, Enter to submit, physical numpad)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Enter') {
        if (activeEl && activeEl.tagName === 'TEXTAREA') return;
        e.preventDefault();
        handleValidateAndSubmit();
        return;
      }

      // If cashier is typing on note input, don't capture keypad
      if (isInputFocused && activeEl.id === 'dynamic-price-note-input') {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        handleKeypadPress(e.key);
      } else if (e.key === 'Backspace') {
        handleKeypadPress('BACKSPACE');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeypadPress, onClose, numericPrice]);

  const toggleModifier = (mod) => {
    if (selectedModifiers.some((m) => m.id === mod.id)) {
      setSelectedModifiers(selectedModifiers.filter((m) => m.id !== mod.id));
    } else {
      setSelectedModifiers([...selectedModifiers, mod]);
    }
  };

  const handleValidateAndSubmit = () => {
    if (!numericPrice || numericPrice <= 0) {
      setErrorMsg('Silakan masukkan harga produk.');
      return;
    }

    if (minPrice > 0 && numericPrice < minPrice) {
      setErrorMsg(`Harga tidak boleh kurang dari batas minimum (${formatRupiah(minPrice)})`);
      return;
    }

    setErrorMsg('');
    onSubmit({
      product,
      customPrice: numericPrice,
      selectedVariant,
      selectedModifiers,
      note: note.trim(),
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dynamic-price-modal-title"
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/80 backdrop-blur-sm p-3 sm:p-4 flex items-center justify-center animate-in fade-in duration-150"
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.5rem)] my-auto select-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-komazi-border shrink-0 bg-komazi-surface-2/60">
          <div className="flex items-center gap-3 min-w-0">
            {product?.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-11 h-11 rounded-xl object-cover border border-komazi-border shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : null}
            <div
              style={{ display: product?.imageUrl ? 'none' : 'flex' }}
              className="w-11 h-11 rounded-xl bg-gradient-to-b from-[#FF6B5E] to-[#D9382B] flex items-center justify-center font-sans font-black text-base text-white shrink-0 shadow-sm shadow-komazi-coral/20 select-none"
            >
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 id="dynamic-price-modal-title" className="font-bold text-sm sm:text-base text-komazi-text truncate">
                  {product?.name || 'Menu Dinamis'}
                </h2>
              </div>
              <p className="text-xs text-komazi-muted truncate">
                {product?.categoryName || 'Menu'} • {isEditMode ? 'Ubah Harga di Keranjang' : 'Tentukan Harga Pesanan'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog harga dinamis"
            className="p-2 rounded-xl text-komazi-muted hover:text-white hover:bg-komazi-surface-2 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-komazi-coral focus-visible:outline-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
          {/* Price Display Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-komazi-surface-2 to-komazi-surface border border-amber-500/30 text-center relative overflow-hidden">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400/90 block mb-1">
              Nominal Harga Satuan
            </span>

            <div className="flex items-center justify-center gap-1 font-mono">
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-400">
                {numericPrice > 0 ? formatRupiah(numericPrice) : 'Rp 0'}
              </span>
              <span className="inline-block w-0.5 h-7 sm:h-8 bg-amber-400 animate-pulse ml-0.5" />
            </div>

            {/* Min Price or Suggested Price Alert */}
            <div className="mt-2 flex items-center justify-center gap-3 text-[11px] text-komazi-muted flex-wrap">
              {minPrice > 0 && (
                <span className="inline-flex items-center gap-1 font-semibold text-amber-300/80">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  Batas Min: {formatRupiah(minPrice)}
                </span>
              )}
              {defaultSuggestedPrice > 0 && (
                <span className="text-komazi-muted">
                  Saran: {formatRupiah(defaultSuggestedPrice)}
                </span>
              )}
            </div>

            {errorMsg && (
              <div className="mt-2.5 p-2 rounded-xl bg-danger/15 border border-danger/30 text-danger text-xs font-semibold flex items-center justify-center gap-1.5 animate-in shake duration-200">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Quick Preset Buttons */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase text-komazi-muted">Tambah Cepat:</span>
              {defaultSuggestedPrice > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setPriceStr(String(defaultSuggestedPrice));
                  }}
                  className="text-[11px] font-semibold text-komazi-coral hover:underline"
                >
                  Pakai Harga Saran
                </button>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[5000, 10000, 25000, 50000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleAddPreset(amt)}
                  className="py-1.5 px-2 rounded-xl bg-komazi-surface-2 hover:bg-amber-500/15 border border-komazi-border hover:border-amber-500/40 text-komazi-text hover:text-amber-300 text-xs font-mono font-bold transition-all active:scale-95"
                >
                  +{amt >= 1000 ? `${amt / 1000}k` : amt}
                </button>
              ))}
            </div>
          </div>

          {/* Touchscreen Numeric Keypad */}
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '000'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleKeypadPress(digit)}
                className="py-3 sm:py-3.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-surface-3 border border-komazi-border text-base sm:text-lg font-mono font-bold text-komazi-text hover:text-white transition-all active:scale-95 shadow-sm flex items-center justify-center min-h-[46px]"
              >
                {digit}
              </button>
            ))}
          </div>

          {/* Keypad Auxiliary Row (Clear & Backspace) */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleKeypadPress('CLEAR')}
              className="py-2.5 px-3 rounded-xl bg-komazi-surface-2 hover:bg-danger/15 border border-komazi-border hover:border-danger/30 text-komazi-muted hover:text-danger text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 min-h-[42px]"
            >
              <span>Hapus Semua (C)</span>
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress('BACKSPACE')}
              className="py-2.5 px-3 rounded-xl bg-komazi-surface-2 hover:bg-komazi-surface-3 border border-komazi-border text-komazi-text text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 min-h-[42px]"
            >
              <Delete className="w-4 h-4" />
              <span>Hapus Digit</span>
            </button>
          </div>

          {/* Variant Selection (If Available) */}
          {hasVariants && (
            <div className="pt-2 border-t border-komazi-border/50">
              <label className="block text-xs font-bold uppercase tracking-wider text-komazi-muted mb-2">
                Pilih Varian:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {product.variants.map((v) => {
                  const isSelected = selectedVariant?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariant(v)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium transition-all ${
                        isSelected
                          ? 'border-komazi-coral bg-komazi-coral/10 text-komazi-coral font-bold'
                          : 'border-komazi-border bg-komazi-surface-2 text-komazi-text hover:border-komazi-muted/40'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected ? 'border-komazi-coral bg-komazi-coral text-white' : 'border-komazi-muted'
                          }`}
                        >
                          {isSelected && <Check className="w-2 h-2 stroke-[3]" />}
                        </div>
                        <span className="truncate">{v.name}</span>
                      </div>
                      <span className="text-[11px] font-mono text-komazi-muted shrink-0">
                        {v.extraPrice > 0 ? `+${formatRupiah(v.extraPrice)}` : 'Standar'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Modifiers Selection (If Available) */}
          {product?.modifiers && product.modifiers.length > 0 && (
            <div className="pt-2 border-t border-komazi-border/50">
              <label className="block text-xs font-bold uppercase tracking-wider text-komazi-muted mb-2">
                Tambahan:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {product.modifiers.map((mod) => {
                  const isChecked = selectedModifiers.some((m) => m.id === mod.id);
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => toggleModifier(mod)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium transition-all ${
                        isChecked
                          ? 'border-komazi-teal-light bg-komazi-teal/15 text-komazi-teal-light font-bold'
                          : 'border-komazi-border bg-komazi-surface-2 text-komazi-text hover:border-komazi-muted/40'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div
                          className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center shrink-0 ${
                            isChecked ? 'border-komazi-teal-light bg-komazi-teal text-white' : 'border-komazi-muted'
                          }`}
                        >
                          {isChecked && <Check className="w-2 h-2 stroke-[3]" />}
                        </div>
                        <span className="truncate">{mod.name}</span>
                      </div>
                      <span className="text-[11px] font-mono text-komazi-muted shrink-0">
                        {mod.price > 0 ? `+${formatRupiah(mod.price)}` : 'Gratis'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Special Notes (e.g., Berat timbangan, rasa custom, request pelanggan) */}
          <div className="pt-2 border-t border-komazi-border/50">
            <label
              htmlFor="dynamic-price-note-input"
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-komazi-muted mb-2"
            >
              <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
              <span>Catatan / Keterangan Khusus:</span>
            </label>
            <input
              id="dynamic-price-note-input"
              ref={inputRef}
              type="text"
              placeholder="Contoh: Berat 550g, kematangan medium, tanpa cabai..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onFocus={scrollInputIntoViewOnFocus}
              className="w-full rounded-xl bg-komazi-surface-2 border border-komazi-border px-3.5 py-2.5 text-xs text-komazi-text placeholder-komazi-muted/60 focus:border-amber-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-komazi-border bg-komazi-surface-2/80 flex items-center justify-between shrink-0">
          <div className="flex flex-col">
            <span className="text-[11px] text-komazi-muted">Total Harga Satuan:</span>
            <span className="text-lg font-bold font-mono text-amber-400 tabular-nums">
              {formatRupiah(finalUnitPrice)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleValidateAndSubmit}
              disabled={numericPrice <= 0}
              className={`flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 ${
                numericPrice > 0
                  ? 'bg-amber-500 hover:bg-amber-600 text-black shadow-amber-500/20'
                  : 'bg-komazi-surface-2 text-komazi-muted cursor-not-allowed border border-komazi-border'
              }`}
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>{isEditMode ? 'Simpan Perubahan' : 'Masukkan ke Pesanan'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
