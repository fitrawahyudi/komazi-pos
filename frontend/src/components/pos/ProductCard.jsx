import React from 'react';
import { formatRupiah } from '../../utils/format';
import { Plus, SlidersHorizontal, Sparkles } from 'lucide-react';

export default function ProductCard({ product, onSelect }) {
  const hasVariantsOrModifiers =
    (product.variants && product.variants.length > 0) ||
    (product.modifiers && product.modifiers.length > 0);

  return (
    <div
      onClick={() => !product.isSoldOut && onSelect(product)}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-komazi-surface border transition-all duration-200 select-none ${
        product.isSoldOut
          ? 'opacity-50 border-komazi-border cursor-not-allowed'
          : 'border-komazi-border hover:border-komazi-coral/50 hover:shadow-lg hover:shadow-komazi-coral/5 cursor-pointer active:scale-[0.98]'
      }`}
    >
      {/* Product Image */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-komazi-surface-2">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src =
              'https://images.unsplash.com/photo-1509785307050-d4066910ec1e?w=500&auto=format&fit=crop&q=80';
          }}
        />

        {/* Gradient shadow on image */}
        <div className="absolute inset-0 bg-gradient-to-t from-komazi-surface via-transparent to-transparent opacity-80" />

        {/* Sold out overlay */}
        {product.isSoldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/75 backdrop-blur-[2px]">
            <span className="rounded-xl bg-danger px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-md">
              Habis (Sold Out)
            </span>
          </div>
        )}

        {/* Category tag */}
        <div className="absolute top-2 left-2">
          <span className="rounded-lg bg-black/60 backdrop-blur-md px-2 py-0.5 text-[10px] font-medium text-komazi-muted border border-white/10">
            {product.categoryName}
          </span>
        </div>

        {/* Customization icon if has variants */}
        {hasVariantsOrModifiers && !product.isSoldOut && (
          <div className="absolute top-2 right-2">
            <span
              title="Memiliki opsi varian / add-on"
              className="flex items-center gap-1 rounded-lg bg-komazi-surface-2/90 backdrop-blur-md px-2 py-0.5 text-[10px] font-semibold text-komazi-coral border border-komazi-coral/30"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>Opsi</span>
            </span>
          </div>
        )}
      </div>

      {/* Product Information */}
      <div className="flex flex-1 flex-col justify-between p-3.5">
        <div>
          <h3 className="font-semibold text-sm text-komazi-text line-clamp-1 group-hover:text-komazi-coral transition-colors">
            {product.name}
          </h3>
          {product.description && (
            <p className="mt-1 text-xs text-komazi-muted line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          )}
        </div>

        {/* Price & Add Button */}
        <div className="mt-3 flex items-center justify-between pt-2 border-t border-komazi-border/50">
          <div className="flex flex-col">
            <span className="text-[10px] text-komazi-muted">Mulai dari</span>
            <span className="font-bold text-base text-komazi-coral tabular-nums font-mono">
              {formatRupiah(product.price)}
            </span>
          </div>

          <button
            type="button"
            disabled={product.isSoldOut}
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
              product.isSoldOut
                ? 'bg-komazi-surface-2 text-komazi-muted cursor-not-allowed'
                : 'bg-komazi-coral text-white group-hover:bg-komazi-coral-dark shadow-sm active:scale-95'
            }`}
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
}
