import React from 'react';
import KomaziCoffeeLoader from './KomaziCoffeeLoader';

/**
 * ActionOverlayModal
 * Glassmorphic full-screen modal overlay for critical blocking operations
 * such as processing QRIS payments, printing Bluetooth receipts, or closing shifts.
 */
export default function ActionOverlayModal({
  isOpen = false,
  title = 'Memproses Transaksi',
  message = 'Mohon tunggu, sistem sedang memverifikasi data...',
  step = 1,
  totalSteps = 1,
  steps = [],
  onCancel,
  showCancelAfterMs = 12000,
}) {
  const [canCancel, setCanCancel] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) {
      setCanCancel(false);
      return;
    }

    if (onCancel) {
      const timer = setTimeout(() => {
        setCanCancel(true);
      }, showCancelAfterMs);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onCancel, showCancelAfterMs]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-komazi-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-3xl bg-komazi-surface/95 border border-komazi-border/80 shadow-2xl p-6 text-center flex flex-col items-center relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-komazi-coral/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-komazi-teal/15 rounded-full blur-2xl pointer-events-none" />

        {/* Animated Coffee Loader Header */}
        <KomaziCoffeeLoader
          size="md"
          message=""
          subtext=""
          showTrivia={false}
          className="p-2"
        />

        {/* Title and Message */}
        <div className="mt-2 space-y-1">
          <h3 className="font-display font-bold text-base text-komazi-text tracking-wide">
            {title}
          </h3>
          <p className="text-xs text-komazi-muted max-w-xs leading-relaxed">
            {message}
          </p>
        </div>

        {/* Optional Multi-step indicator */}
        {totalSteps > 1 && (
          <div className="w-full mt-4 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-komazi-muted px-1">
              <span>Langkah {step} dari {totalSteps}</span>
              <span>{Math.round((step / totalSteps) * 100)}%</span>
            </div>
            <div className="w-full h-1.5 bg-komazi-surface-2 rounded-full overflow-hidden border border-komazi-border">
              <div
                className="h-full bg-gradient-to-r from-komazi-coral to-komazi-teal-light transition-all duration-300"
                style={{ width: `${(step / totalSteps) * 100}%` }}
              />
            </div>
            {steps.length > 0 && (
              <div className="flex justify-between text-[10px] text-komazi-muted/70 px-0.5">
                {steps.map((s, idx) => (
                  <span
                    key={idx}
                    className={idx + 1 <= step ? 'text-komazi-coral font-bold' : ''}
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Emergency Cancel button after timeout */}
        {canCancel && onCancel && (
          <div className="mt-5 animate-in fade-in duration-300">
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-komazi-muted hover:text-danger underline transition-colors"
            >
              Proses terlalu lama? Batalkan tindakan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
