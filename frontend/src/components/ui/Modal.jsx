import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

const MAX_WIDTHS = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  full: 'max-w-full',
};

/**
 * Komponen Modal universal yang adaptif terhadap Virtual Keyboard tablet & mobile.
 *
 * Fitur Utama:
 * 1. Backdrop memiliki `overflow-y-auto` + `min-h-full` sehingga saat keyboard tablet terbuka,
 *    seluruh modal tetap bisa discroll dan tidak terjebak di luar layar.
 * 2. Menggunakan `100dvh` (dynamic viewport height) agar tingginya otomatis menyesuaikan
 *    area yang tersisa saat keyboard muncul.
 * 3. Menangani tombol ESC dan klik backdrop secara aman.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
  footer,
  maxWidth = 'lg',
  closeOnBackdropClick = true,
  closeOnEsc = true,
  className = '',
  bodyClassName = 'p-5 space-y-4',
  headerRight = null,
  showCloseButton = true,
}) {
  const modalRef = useRef(null);

  // Keyboard navigation: ESC to close
  useEffect(() => {
    if (!isOpen || !closeOnEsc) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEsc, onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const widthClass = MAX_WIDTHS[maxWidth] || MAX_WIDTHS.lg;

  const handleBackdropClick = (e) => {
    if (closeOnBackdropClick && modalRef.current && !modalRef.current.contains(e.target)) {
      onClose?.();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : 'Dialog'}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150"
    >
      <div className="min-h-full flex items-center justify-center">
        <div
          ref={modalRef}
          onClick={(e) => e.stopPropagation()}
          className={`w-full ${widthClass} rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.5rem)] my-auto animate-in zoom-in-95 duration-150 ${className}`}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-center justify-between p-4 border-b border-komazi-border shrink-0 bg-komazi-surface">
              <div className="flex items-center gap-2.5 min-w-0">
                {Icon && (
                  <div className="w-8 h-8 rounded-xl bg-komazi-coral/10 border border-komazi-coral/20 flex items-center justify-center text-komazi-coral shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                )}
                <div className="min-w-0">
                  {title && (
                    <h2 className="font-bold text-base text-komazi-text truncate">
                      {title}
                    </h2>
                  )}
                  {subtitle && (
                    <p className="text-[11px] text-komazi-muted truncate">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {headerRight}
                {showCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1 rounded-lg text-komazi-muted hover:text-white hover:bg-komazi-surface-2 transition-colors"
                    aria-label="Tutup dialog"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Body */}
          <div className={`flex-1 overflow-y-auto overscroll-contain ${bodyClassName}`}>
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="p-4 border-t border-komazi-border shrink-0 bg-komazi-surface">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
