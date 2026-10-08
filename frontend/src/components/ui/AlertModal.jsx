import React from 'react';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  X,
} from 'lucide-react';

export default function AlertModal({
  isOpen,
  onClose,
  onConfirm,
  type = 'warning', // 'warning' | 'danger' | 'info' | 'success'
  title = 'Konfirmasi Tindakan',
  message,
  confirmText = 'Lanjutkan',
  cancelText = 'Batal',
  showCancel = true,
  isProcessing = false,
}) {
  if (!isOpen) return null;

  const config = {
    danger: {
      icon: AlertCircle,
      iconBg: 'bg-danger/15 text-danger border border-danger/30',
      btnBg: 'bg-danger hover:bg-danger/80 text-white shadow-danger/25',
    },
    warning: {
      icon: AlertTriangle,
      iconBg: 'bg-warning/15 text-warning border border-warning/30',
      btnBg: 'bg-komazi-coral hover:bg-komazi-coral-dark text-white shadow-komazi-coral/25',
    },
    info: {
      icon: Info,
      iconBg: 'bg-komazi-teal/20 text-komazi-teal-light border border-komazi-teal/30',
      btnBg: 'bg-komazi-teal hover:bg-komazi-teal-dark text-white shadow-komazi-teal/25',
    },
    success: {
      icon: CheckCircle2,
      iconBg: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
      btnBg: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/25',
    },
  }[type];

  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn select-none">
      <div className="w-full max-w-sm bg-komazi-surface border border-komazi-border rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
        {/* Themed Icon */}
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto ${config.iconBg}`}>
          <Icon className="w-6 h-6 stroke-[2.2]" />
        </div>

        {/* Text */}
        <div className="text-center space-y-1.5">
          <h3 className="font-bold text-sm text-komazi-text">{title}</h3>
          <p className="text-xs text-komazi-muted leading-relaxed font-medium">
            {message}
          </p>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 pt-2">
          {showCancel && (
            <button
              type="button"
              disabled={isProcessing}
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-muted text-xs font-bold transition-colors disabled:opacity-50"
            >
              {cancelText}
            </button>
          )}

          <button
            type="button"
            disabled={isProcessing}
            onClick={() => {
              if (onConfirm) onConfirm();
              else onClose();
            }}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md active:scale-95 disabled:opacity-50 ${config.btnBg}`}
          >
            {isProcessing ? 'Memproses...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
