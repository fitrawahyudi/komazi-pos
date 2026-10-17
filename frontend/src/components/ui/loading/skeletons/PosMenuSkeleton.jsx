import React from 'react';
import { Skeleton } from '../Skeleton';

/**
 * PosMenuSkeleton
 * Shimmer placeholder that matches the exact layout of the POS cashier menu grid,
 * eliminating Cumulative Layout Shift (CLS = 0).
 */
export default function PosMenuSkeleton({ count = 8 }) {
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Category Pills Bar Skeleton */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <Skeleton variant="pill" className="h-9 w-20 shrink-0" />
        <Skeleton variant="pill" className="h-9 w-24 shrink-0" />
        <Skeleton variant="pill" className="h-9 w-28 shrink-0" />
        <Skeleton variant="pill" className="h-9 w-20 shrink-0" />
        <Skeleton variant="pill" className="h-9 w-24 shrink-0" />
        <Skeleton variant="pill" className="h-9 w-20 shrink-0" />
      </div>

      {/* Product Cards Grid Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-3.5">
        {Array.from({ length: count }).map((_, idx) => (
          <div
            key={idx}
            className="flex flex-col justify-between overflow-hidden rounded-2xl bg-komazi-surface border border-komazi-border/50"
          >
            {/* Image Placeholder aspect-[4/3] */}
            <div className="relative aspect-[4/3] w-full">
              <Skeleton variant="rect" className="w-full h-full rounded-none" />
              {/* Category pill placeholder */}
              <div className="absolute top-2 left-2">
                <Skeleton variant="pill" className="w-14 h-4 bg-black/40" />
              </div>
            </div>

            {/* Product Details Area */}
            <div className="p-3 sm:p-3.5 space-y-2.5">
              <div className="space-y-1.5">
                <Skeleton variant="rect" className="w-3/4 h-4" />
                <Skeleton variant="rect" className="w-1/2 h-3 opacity-60" />
              </div>

              {/* Price and Add Button Placeholder */}
              <div className="flex items-center justify-between pt-1">
                <Skeleton variant="rect" className="w-20 h-5" />
                <Skeleton variant="circle" className="w-7 h-7 shrink-0" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
