import React from 'react';
import { Skeleton } from '../Skeleton';

/**
 * OrdersTableSkeleton
 * Shimmer placeholder that matches the order history transaction list in OrdersPage.
 */
export default function OrdersTableSkeleton({ rows = 6 }) {
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Stats Banner Placeholder */}
      <div className="p-4 sm:p-5 rounded-2xl bg-komazi-surface border border-komazi-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton variant="card" className="w-12 h-12 rounded-2xl shrink-0" />
          <div className="space-y-2">
            <Skeleton variant="rect" className="w-36 h-4" />
            <Skeleton variant="rect" className="w-48 h-3 opacity-60" />
          </div>
        </div>
        <div className="flex items-center gap-4 bg-komazi-surface-2/60 p-2.5 rounded-xl border border-komazi-border shrink-0">
          <div className="space-y-1.5">
            <Skeleton variant="rect" className="w-16 h-3" />
            <Skeleton variant="rect" className="w-20 h-5" />
          </div>
          <div className="h-8 w-px bg-komazi-border" />
          <div className="space-y-1.5">
            <Skeleton variant="rect" className="w-16 h-3" />
            <Skeleton variant="rect" className="w-24 h-5" />
          </div>
        </div>
      </div>

      {/* Orders List Rows Placeholder */}
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, idx) => (
          <div
            key={idx}
            className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            {/* Invoice & Time info */}
            <div className="flex items-start sm:items-center gap-3">
              <Skeleton variant="card" className="w-10 h-10 rounded-xl shrink-0" />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton variant="rect" className="w-28 h-4 font-mono" />
                  <Skeleton variant="pill" className="w-14 h-4" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton variant="rect" className="w-24 h-3 opacity-60" />
                  <Skeleton variant="rect" className="w-20 h-3 opacity-60" />
                </div>
              </div>
            </div>

            {/* Price & Action button */}
            <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-komazi-border/50">
              <div className="text-left sm:text-right space-y-1">
                <Skeleton variant="rect" className="w-24 h-4 ml-auto" />
                <Skeleton variant="rect" className="w-16 h-3 ml-auto opacity-60" />
              </div>
              <Skeleton variant="rect" className="w-20 h-8 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
