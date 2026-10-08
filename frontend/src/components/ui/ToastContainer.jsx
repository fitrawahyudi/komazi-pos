import React, { useEffect, useState } from 'react';
import { useToastStore } from '../../store/toastStore';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';

function ToastItem({ toast, onDismiss }) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!toast.duration || toast.duration <= 0) return;

    const intervalTime = 50;
    const step = (intervalTime / toast.duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= step) {
          clearInterval(timer);
          return 0;
        }
        return prev - step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [toast.duration]);

  const config = {
    success: {
      icon: CheckCircle2,
      borderColor: 'border-emerald-500/40',
      iconBg: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
      progressBar: 'bg-emerald-500',
      glow: 'shadow-emerald-950/40',
    },
    error: {
      icon: AlertCircle,
      borderColor: 'border-komazi-coral/40',
      iconBg: 'bg-komazi-coral/15 text-komazi-coral border border-komazi-coral/30',
      progressBar: 'bg-komazi-coral',
      glow: 'shadow-komazi-coral/20',
    },
    warning: {
      icon: AlertTriangle,
      borderColor: 'border-amber-500/40',
      iconBg: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
      progressBar: 'bg-amber-500',
      glow: 'shadow-amber-950/40',
    },
    info: {
      icon: Info,
      borderColor: 'border-komazi-teal-light/40',
      iconBg: 'bg-komazi-teal/20 text-komazi-teal-light border border-komazi-teal/30',
      progressBar: 'bg-komazi-teal-light',
      glow: 'shadow-komazi-teal/30',
    },
  }[toast.type || 'info'];

  const Icon = config.icon;

  return (
    <div
      className={`group relative overflow-hidden w-full max-w-sm rounded-2xl bg-komazi-surface/95 backdrop-blur-xl border ${config.borderColor} shadow-2xl ${config.glow} transition-all duration-300 hover:scale-[1.02] animate-slideDown select-none`}
    >
      <div className="p-3.5 flex items-start gap-3">
        {/* Themed Icon */}
        <div className={`p-2 rounded-xl shrink-0 ${config.iconBg}`}>
          <Icon className="w-4 h-4 stroke-[2.4]" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-1">
          {toast.title && (
            <h4 className="font-bold text-xs text-komazi-text mb-0.5 tracking-wide">
              {toast.title}
            </h4>
          )}
          <p className="text-[11px] text-komazi-muted leading-relaxed font-medium">
            {toast.message}
          </p>
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="p-1 rounded-lg text-komazi-muted hover:text-komazi-text hover:bg-komazi-surface-2 transition-colors shrink-0 -mr-1 -mt-1"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Countdown Progress Bar */}
      {toast.duration > 0 && (
        <div className="h-0.5 w-full bg-komazi-border/50 overflow-hidden">
          <div
            className={`h-full ${config.progressBar} transition-all duration-75 ease-linear`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col items-end gap-2.5 max-w-[calc(100vw-2rem)] pointer-events-auto">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
      ))}
    </div>
  );
}
