import React, { useState, useEffect, useRef } from 'react';
import { X, Check } from 'lucide-react';

export default function PromptModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Masukkan Informasi',
  message = '',
  placeholder = '',
  defaultValue = '',
  confirmText = 'Simpan',
  cancelText = 'Batal',
  icon: Icon = null,
}) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue || '');
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (value.trim()) {
      onConfirm(value.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-sm bg-komazi-surface border border-komazi-border rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-komazi-border">
          <div className="flex items-center gap-2.5">
            {Icon && (
              <div className="w-8 h-8 rounded-xl bg-komazi-coral/10 border border-komazi-coral/20 flex items-center justify-center text-komazi-coral">
                <Icon className="w-4 h-4" />
              </div>
            )}
            <h3 className="font-bold text-sm text-komazi-text">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-komazi-muted hover:text-white hover:bg-komazi-surface-2 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {message && (
            <p className="text-xs text-komazi-muted leading-relaxed">
              {message}
            </p>
          )}

          <div>
            <input
              ref={inputRef}
              type="text"
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              className="w-full px-3.5 py-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text placeholder-komazi-muted/60 focus:border-komazi-coral focus:outline-none shadow-inner"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-muted hover:text-white text-xs font-semibold transition-colors"
            >
              {cancelText}
            </button>
            <button
              type="submit"
              disabled={!value.trim()}
              className="flex-1 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark disabled:opacity-40 text-white font-bold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>{confirmText}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
