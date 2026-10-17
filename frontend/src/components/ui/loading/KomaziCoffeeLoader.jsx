import React, { useState, useEffect } from 'react';

const COFFEE_TIPS = [
  'Menyeduh data katalog menu spesialisasi...',
  'Menyiapkan mesin espresso & grinder...',
  'Mengkalibrasi printer thermal kasir...',
  'Menghitung takaran resep & stok bahan baku...',
  'Menyinkronkan meja komunal & private pods...',
  'Memastikan sistem kasir siap melayani...',
];

/**
 * KomaziCoffeeLoader
 * Signature Coffee Cup Animated Loader with dynamic steam & ambient glow.
 *
 * @param {string} message - Primary status message (optional)
 * @param {string} subtext - Secondary hint message (optional)
 * @param {boolean} fullScreen - If true, fills screen with dark backdrop
 * @param {'sm'|'md'|'lg'} size - Scale of the cup
 * @param {boolean} showTrivia - Rotate coffee-themed status messages
 */
export default function KomaziCoffeeLoader({
  message,
  subtext,
  fullScreen = false,
  size = 'md',
  showTrivia = true,
  className = '',
}) {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    if (!showTrivia || message) return;
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % COFFEE_TIPS.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [showTrivia, message]);

  const activeMessage = message || (showTrivia ? COFFEE_TIPS[tipIndex] : 'Memuat data Komazi...');

  const sizeDimensions = {
    sm: { cup: 'w-12 h-12', glow: 'w-16 h-16', text: 'text-xs' },
    md: { cup: 'w-20 h-20', glow: 'w-24 h-24', text: 'text-sm' },
    lg: { cup: 'w-28 h-28', glow: 'w-36 h-36', text: 'text-base' },
  }[size] || { cup: 'w-20 h-20', glow: 'w-24 h-24', text: 'text-sm' };

  const content = (
    <div className={`flex flex-col items-center justify-center p-6 text-center select-none ${className}`}>
      {/* Ambient Pulsing Glow Backdrop */}
      <div className="relative flex items-center justify-center">
        <div
          className={`absolute rounded-full bg-gradient-to-tr from-komazi-coral/30 to-komazi-teal-light/20 blur-2xl animate-pulse-glow ${sizeDimensions.glow}`}
        />

        {/* Animated Barista Coffee Cup SVG */}
        <svg
          className={`${sizeDimensions.cup} relative z-10 text-komazi-coral drop-shadow-[0_4px_20px_rgba(255,90,77,0.45)]`}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Steam Path 1 (Left) */}
          <path
            className="animate-steam-1 text-komazi-coral"
            d="M24 19C22 14 26 10 24 5"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Steam Path 2 (Center - Teal Tinted Accent) */}
          <path
            className="animate-steam-2 text-komazi-teal-light"
            d="M32 18C30 13 34 8 32 4"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Steam Path 3 (Right) */}
          <path
            className="animate-steam-3 text-komazi-coral"
            d="M40 19C38 14 42 10 40 5"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Cup Rim Highlight */}
          <ellipse cx="32" cy="24" rx="15" ry="3.5" fill="#1E1E1E" stroke="#FF5A4D" strokeWidth="2" />

          {/* Hot Coffee Liquid Surface */}
          <ellipse cx="32" cy="24" rx="12" ry="2.2" fill="#2FA39C" opacity="0.8" />

          {/* Coffee Cup Body */}
          <path
            d="M17 24C17 35.5 23 45 32 45C41 45 47 35.5 47 24H17Z"
            fill="#141414"
            stroke="#FF5A4D"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {/* Komazi Flame/Leaf Badge on Cup */}
          <path
            d="M32 29C34 32 35 35 32 38C29 35 30 32 32 29Z"
            fill="#FF5A4D"
            opacity="0.9"
          />

          {/* Ergonomic Cup Handle */}
          <path
            d="M47 27C51 27 54 30 54 34C54 38 50 40 45 40"
            stroke="#FF5A4D"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Ceramic Saucer Plate */}
          <path
            d="M11 50C15 54 49 54 53 50"
            stroke="#2A2A2A"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Dynamic Status Typography */}
      <div className="mt-5 space-y-1 max-w-xs transition-all duration-300">
        <p className={`font-display font-semibold ${sizeDimensions.text} text-komazi-text tracking-wide`}>
          {activeMessage}
        </p>
        <p className="text-[11px] text-komazi-muted">
          {subtext || 'Komazi Coffee & Workspace Engine'}
        </p>
      </div>

      {/* Subtle Progress Bar */}
      <div className="w-32 h-1 bg-komazi-surface-2 rounded-full mt-3 overflow-hidden border border-komazi-border/60">
        <div className="h-full bg-gradient-to-r from-komazi-coral via-komazi-teal-light to-komazi-coral w-full -translate-x-full animate-shimmer" />
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-komazi-black/90 backdrop-blur-md animate-in fade-in duration-200">
        {content}
      </div>
    );
  }

  return content;
}
