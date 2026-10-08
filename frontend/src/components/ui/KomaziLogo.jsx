import React from 'react';

/**
 * Official KOMAZI Logo Component
 * Uses the authentic brand graphic:
 * - 4 dark-teal petals
 * - Coral-red handwritten "KOMAZI"
 * - Tagline "COFFEE & WORKSPACE"
 */
export default function KomaziLogo({
  size = 'md',
  variant = 'full', // 'full' | 'icon'
  className = '',
  imgClassName = '',
}) {
  const sizeMap = {
    xs: 'h-6 sm:h-7',
    sm: 'h-8 sm:h-9',
    md: 'h-10 sm:h-11',
    lg: 'h-20 sm:h-24',
    xl: 'h-28 sm:h-36',
  };

  const heightClass = sizeMap[size] || sizeMap.md;
  const logoSrc = variant === 'icon' ? '/komazi-icon.png' : '/komazi-logo.png';

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      <img
        src={logoSrc}
        alt="KOMAZI Coffee & Workspace"
        className={`${heightClass} w-auto object-contain filter drop-shadow-[0_2px_12px_rgba(255,90,77,0.25)] transition-transform duration-200 hover:scale-105 ${imgClassName}`}
        loading="eager"
      />
    </div>
  );
}
