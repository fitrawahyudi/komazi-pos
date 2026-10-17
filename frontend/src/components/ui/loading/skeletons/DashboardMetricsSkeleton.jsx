import React from 'react';
import { Skeleton } from '../Skeleton';

/**
 * DashboardMetricsSkeleton
 * Shimmer placeholder for Financial Reports, KPI cards, and AI Analytics.
 */
export default function DashboardMetricsSkeleton() {
  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="p-4 sm:p-5 rounded-2xl bg-komazi-surface border border-komazi-border space-y-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton variant="rect" className="w-24 h-3.5" />
              <Skeleton variant="card" className="w-8 h-8 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Skeleton variant="rect" className="w-32 h-6" />
              <Skeleton variant="rect" className="w-20 h-3 opacity-60" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Chart Card Skeleton */}
      <div className="p-5 sm:p-6 rounded-2xl bg-komazi-surface border border-komazi-border space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton variant="rect" className="w-36 h-4" />
            <Skeleton variant="rect" className="w-52 h-3 opacity-60" />
          </div>
          <Skeleton variant="rect" className="w-28 h-8 rounded-xl" />
        </div>

        {/* Chart Area Bars Placeholder */}
        <div className="h-56 w-full flex items-end gap-3 pt-6 px-2">
          {[40, 65, 30, 85, 55, 95, 70, 45, 60, 80, 50, 75].map((height, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <Skeleton
                variant="rect"
                className="w-full rounded-t-lg transition-all"
                style={{ height: `${height}%` }}
              />
              <Skeleton variant="rect" className="w-6 h-2 opacity-50" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
