import React, { useEffect } from 'react';
import { useAiAnalyticsStore } from '../../store/aiAnalyticsStore';
import {
  Sparkles,
  Flame,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Coffee,
  CheckCircle2,
  Zap,
} from 'lucide-react';

export default function TopProductInsightCard() {
  const {
    quickInsight,
    isQuickInsightLoading,
    fetchQuickInsight,
    openAssistant,
  } = useAiAnalyticsStore();

  useEffect(() => {
    fetchQuickInsight();
  }, []);

  const topProduct = quickInsight?.topProduct;
  const hasSales = quickInsight?.hasSales;

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-komazi-surface-2 via-komazi-surface-2 to-komazi-primary/5 border border-komazi-primary/20 shadow-md relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-komazi-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
        
        {/* Left Side: Header & Insight Summary */}
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-komazi-primary/10 text-komazi-primary border border-komazi-primary/20">
              <Sparkles className="w-3.5 h-3.5 text-komazi-primary animate-pulse" />
              Komazi AI
            </span>
          </div>

          <div className="pt-0.5">
            {isQuickInsightLoading ? (
              <div className="h-6 w-64 bg-komazi-border/50 animate-pulse rounded" />
            ) : topProduct ? (
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-base sm:text-lg font-bold text-komazi-text flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
                  {topProduct.name}
                </span>
                <span className="text-xs sm:text-sm text-komazi-muted">
                  merupakan menu terlaris hari ini ({topProduct.qty} terjual • {topProduct.revenue})
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {topProduct.share} Kontribusi Omset
                </span>
              </div>
            ) : (
              <p className="text-sm font-medium text-komazi-text">
                Belum ada transaksi hari ini. Kedai siap menyambut pesanan pertama!
              </p>
            )}
          </div>

          <p className="text-xs text-komazi-muted">
            {hasSales
              ? `Total omzet terdata hari ini ${quickInsight?.todayRevenue} (${quickInsight?.todayOrders} transaksi lunas).`
              : 'Klik tombol di bawah untuk melihat proyeksi atau mengecek kesiapan bahan baku.'}
          </p>
        </div>

        {/* Right Side: Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => fetchQuickInsight()}
            disabled={isQuickInsightLoading}
            title="Segarkan Analisis"
            className="p-2.5 text-komazi-muted hover:text-komazi-text bg-komazi-surface border border-komazi-border hover:border-komazi-primary/40 rounded-xl transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isQuickInsightLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => openAssistant()}
            className="px-4 py-2.5 bg-komazi-primary hover:bg-komazi-primary-hover text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-md transition-all active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            <span>Tanya Komazi AI</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
}
