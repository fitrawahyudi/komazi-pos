import React from 'react';
import { CheckCircle2 } from 'lucide-react';

/**
 * LoadingButton
 * Stateful action button that morphs into a smooth spinner on action,
 * preventing double-clicks and accidental repeated transactions.
 */
export default function LoadingButton({
  children,
  isLoading = false,
  isSuccess = false,
  loadingText,
  successText,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  disabled = false,
  className = '',
  type = 'button',
  onClick,
  ...props
}) {
  const variantStyles = {
    primary:
      'bg-komazi-coral hover:bg-komazi-coral-dark text-white shadow-lg shadow-komazi-coral/20 border border-white/10',
    secondary:
      'bg-komazi-surface-2 hover:bg-komazi-border text-komazi-text border border-komazi-border',
    teal:
      'bg-komazi-teal hover:bg-komazi-teal-light text-white shadow-lg shadow-komazi-teal/20 border border-white/10',
    danger:
      'bg-danger hover:bg-red-600 text-white shadow-lg shadow-danger/20 border border-white/10',
    outline:
      'bg-transparent hover:bg-komazi-surface-2 text-komazi-text border border-komazi-border',
  }[variant] || variantStyles.primary;

  const sizeStyles = {
    sm: 'px-3 py-2 text-xs rounded-xl gap-1.5',
    md: 'px-4 py-2.5 text-xs sm:text-sm rounded-xl gap-2',
    lg: 'px-6 py-3.5 text-sm sm:text-base rounded-2xl gap-2.5',
  }[size] || sizeStyles.md;

  const isDisabled = disabled || isLoading || isSuccess;

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={isDisabled ? undefined : onClick}
      className={`relative inline-flex items-center justify-center font-bold transition-all duration-200 select-none ${
        isDisabled ? 'opacity-65 cursor-not-allowed' : 'active:scale-[0.98] cursor-pointer'
      } ${variantStyles} ${sizeStyles} ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
          <span>{loadingText || 'Memproses...'}</span>
        </>
      ) : isSuccess ? (
        <>
          <CheckCircle2 className="w-4 h-4 text-success animate-in zoom-in duration-200 shrink-0" />
          <span>{successText || 'Berhasil!'}</span>
        </>
      ) : (
        <>
          {Icon && <Icon className="w-4 h-4 shrink-0" />}
          <span>{children}</span>
        </>
      )}
    </button>
  );
}
