import React from 'react';

/**
 * Skeleton Primitive Component
 * Reusable dark-mode shimmer placeholder to eliminate layout shifts (CLS).
 *
 * @param {'rect'|'circle'|'pill'|'card'} variant - Shape variant
 * @param {string} className - Additional Tailwind utility classes
 */
export function Skeleton({
  variant = 'rect',
  className = '',
  ...props
}) {
  const variantStyles = {
    circle: 'rounded-full',
    pill: 'rounded-full',
    card: 'rounded-2xl',
    rect: 'rounded-xl',
  }[variant] || 'rounded-xl';

  return (
    <div
      className={`skeleton-shimmer bg-komazi-surface-2/80 border border-komazi-border/40 ${variantStyles} ${className}`}
      {...props}
    />
  );
}

export default Skeleton;
