import React, { useState, useMemo } from 'react';
import { formatRupiah, getProductInitials, getProductColor } from '../../utils/format';
import { Plus, SlidersHorizontal, Coffee, UtensilsCrossed, Cookie, Check, Sparkles } from 'lucide-react';
import { useCartStore } from '../../store/cartStore';

function CategoryIcon({ categoryName, className = '' }) {
  const name = String(categoryName || '').toLowerCase();
  if (name.includes('burger') || name.includes('nasi') || name.includes('mie') || name.includes('makan')) {
    return <UtensilsCrossed className={className} />;
  }
  if (name.includes('cemilan') || name.includes('snack') || name.includes('pastry')) {
    return <Cookie className={className} />;
  }
  return <Coffee className={className} />;
}

function ProductCard({ product, onSelect }) {
  const [imageError, setImageError] = useState(false);

  // Calculate current quantity of this product in cart via selector returning primitive number
  // Zustand skips re-render if the primitive number return value doesn't change
  const inCartQty = useCartStore((state) => {
    if (!state.items || state.items.length === 0) return 0;
    return state.items.reduce((sum, i) => (i.productId === product.id ? sum + (Number(i.qty) || 0) : sum), 0);
  });

  const hasVariantsOrModifiers =
    (product.variants && product.variants.length > 0) ||
    (product.modifiers && product.modifiers.length > 0);

  const isSelectedInCart = inCartQty > 0;
  const categoryTitle = product.categoryName || product.category?.name || '';
  const hasImage = Boolean(product.imageUrl && !imageError);
  const initials = useMemo(() => getProductInitials(product.name), [product.name]);
  const colorScheme = useMemo(() => getProductColor(product.name), [product.name]);

  return (
    <div
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-komazi-surface border transition-all duration-200 select-none ${
        product.isSoldOut
          ? 'opacity-50 border-komazi-border'
          : isSelectedInCart
            ? 'ring-1 ring-komazi-coral/60 border-komazi-coral/70 bg-komazi-surface/95 shadow-md shadow-komazi-coral/5'
            : 'border-komazi-border hover:border-komazi-border/80'
      }`}
    >
      {/* Product Image Area */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-komazi-surface-2 flex items-center justify-center">
        {hasImage ? (
          <>
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              onError={() => setImageError(true)}
            />
            {/* Gradient shadow on image bottom */}
            <div className="absolute inset-0 bg-gradient-to-t from-komazi-surface via-transparent to-transparent opacity-80 pointer-events-none" />
          </>
        ) : (
          <div className="h-full w-full p-2.5 flex items-center justify-center bg-transparent">
            <div className="h-full w-full rounded-2xl bg-gradient-to-b from-[#FF6B5E] to-[#D9382B] flex items-center justify-center select-none shadow-md shadow-komazi-coral/25 transition-transform duration-200 group-hover:scale-[1.02]">
              <span className="font-sans font-black text-3xl sm:text-4xl text-white tracking-normal drop-shadow-sm select-none">
                {initials}
              </span>
            </div>
          </div>
        )}

        {/* Selected / In Cart Quantity Badge */}
        {isSelectedInCart && !product.isSoldOut && (
          <div className="absolute top-2 right-2 z-10 animate-in zoom-in-75 duration-150">
            <span className="flex items-center gap-1 rounded-full bg-komazi-coral text-white px-2.5 py-0.5 text-xs font-black shadow-lg shadow-komazi-coral/40 ring-2 ring-komazi-black/80 font-mono">
              <Check className="w-3 h-3 stroke-[3]" />
              <span>{inCartQty}x</span>
            </span>
          </div>
        )}

        {/* Sold out overlay */}
        {product.isSoldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/75 backdrop-blur-[2px] z-10">
            <span className="rounded-xl bg-danger px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-md">
              Habis 
            </span>
          </div>
        )}

        {/* Category & Dynamic Price tag (shown over photo) */}
        {hasImage && (
          <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start">
            <span className="flex items-center gap-1 rounded-lg bg-black/70 backdrop-blur-md px-2 py-0.5 text-[10px] font-semibold text-komazi-muted border border-white/10">
              <CategoryIcon categoryName={categoryTitle} className="w-3 h-3 text-komazi-coral shrink-0" />
              <span className="truncate max-w-[90px]">{categoryTitle || 'Menu'}</span>
            </span>
            {product.isDynamicPrice && (
              <span
                title="Menu dengan harga fleksibel (diinput saat transaksi kasir)"
                className="flex items-center gap-1 rounded-lg bg-amber-500/90 text-slate-950 px-2 py-0.5 text-[10px] font-bold shadow-md shadow-amber-500/20 backdrop-blur-sm"
              >
                <Sparkles className="w-3 h-3 fill-slate-950" />
                <span>Dinamis</span>
              </span>
            )}
          </div>
        )}

        {/* Customization icon if has variants (bottom-right of image) */}
        {hasVariantsOrModifiers && !product.isSoldOut && (
          <div className="absolute bottom-2 right-2 z-10">
            <span
              title="Memiliki pilihan varian / modifier add-on"
              className="flex items-center gap-1 rounded-lg bg-black/70 backdrop-blur-md px-2 py-0.5 text-[10px] font-semibold text-komazi-coral border border-komazi-coral/30"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>Opsi</span>
            </span>
          </div>
        )}
      </div>

      {/* Product Information Container */}
      <div className="flex flex-1 flex-col justify-between p-3 sm:p-3.5">
        <div>
          <h3
            className={`font-bold text-xs sm:text-sm text-komazi-text line-clamp-1 ${
              isSelectedInCart ? 'text-komazi-coral' : ''
            }`}
            title={product.name}
          >
            {product.name}
          </h3>
          <p className="mt-1 text-[11px] sm:text-xs text-komazi-muted line-clamp-2 leading-relaxed min-h-[2rem]">
            {product.description || ''}
          </p>
        </div>

        {/* Price & Add Button Row */}
        <div className="mt-2.5 sm:mt-3 flex items-center justify-between pt-2 border-t border-komazi-border/50">
          <div className="flex flex-col">
            {product.isDynamicPrice ? (
              <div className="flex flex-col">
                <span className="inline-flex items-center gap-1 font-bold text-xs sm:text-sm text-amber-400">
                  <Sparkles className="w-3 h-3" />
                  Harga Fleksibel
                </span>
                <span className="text-[10px] text-komazi-muted">
                  {Number(product.minPrice) > 0
                    ? `Min. ${formatRupiah(product.minPrice)}`
                    : Number(product.price) > 0
                      ? `Saran: ${formatRupiah(product.price)}`
                      : 'Bebas tentukan'}
                </span>
              </div>
            ) : (
              <span className="font-bold text-xs sm:text-sm md:text-base text-komazi-coral tabular-nums font-mono tracking-tight">
                {formatRupiah(product.price)}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!product.isSoldOut) {
                onSelect(product);
              }
            }}
            disabled={product.isSoldOut}
            aria-label={
              product.isSoldOut
                ? `${product.name} habis`
                : product.isDynamicPrice
                  ? `Tentukan harga ${product.name} ke pesanan`
                  : `Tambah ${product.name} ke pesanan`
            }
            title={
              product.isSoldOut
                ? 'Menu habis'
                : product.isDynamicPrice
                  ? `Tentukan harga ${product.name} (+)`
                  : `Tambah ${product.name} ke pesanan (+)`
            }
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all shadow-sm ${
              product.isSoldOut
                ? 'bg-komazi-surface-2 text-komazi-muted cursor-not-allowed opacity-50'
                : product.isDynamicPrice
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 cursor-pointer active:scale-90 hover:scale-105'
                  : isSelectedInCart
                    ? 'bg-komazi-coral hover:bg-komazi-coral/90 text-white shadow-md shadow-komazi-coral/30 cursor-pointer active:scale-90 hover:scale-105'
                    : 'bg-komazi-surface-2 hover:bg-komazi-coral border border-komazi-border hover:border-komazi-coral text-komazi-text hover:text-white cursor-pointer active:scale-90 hover:scale-105'
            }`}
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(ProductCard);
