import React from 'react';
import { Skeleton } from '../Skeleton';

/**
 * PageFallbackSkeleton
 * Reusable full-page shimmer placeholder used with React.Suspense during
 * dynamic asynchronous route transitions (SPA History API navigation).
 *
 * Official Reference: https://react.dev/reference/react/Suspense
 */
export default function PageFallbackSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in duration-200">
      {/* Top Header Placeholder */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-komazi-border/50">
        <div className="space-y-2">
          <Skeleton variant="rect" className="h-8 w-48 sm:w-64" />
          <Skeleton variant="rect" className="h-4 w-32 sm:w-48 opacity-60" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton variant="pill" className="h-10 w-28" />
          <Skeleton variant="pill" className="h-10 w-36" />
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border/40 space-y-3"
          >
            <Skeleton variant="rect" className="h-4 w-24 opacity-70" />
            <Skeleton variant="rect" className="h-7 w-32" />
          </div>
        ))}
      </div>

      {/* Main Content / Table Shimmer */}
      <div className="p-5 rounded-2xl bg-komazi-surface border border-komazi-border/40 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton variant="rect" className="h-5 w-40" />
          <Skeleton variant="pill" className="h-8 w-24" />
        </div>
        <div className="space-y-3 pt-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-komazi-border/20 last:border-none">
              <div className="flex items-center gap-3">
                <Skeleton variant="circle" className="w-9 h-9 shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton variant="rect" className="h-4 w-36" />
                  <Skeleton variant="rect" className="h-3 w-24 opacity-60" />
                </div>
              </div>
              <Skeleton variant="rect" className="h-5 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
