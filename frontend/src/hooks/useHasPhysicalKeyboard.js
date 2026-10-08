import { useState, useEffect } from 'react';

/**
 * Deteksi apakah device kemungkinan memiliki keyboard fisik (laptop/desktop).
 * Menggunakan kombinasi:
 * - matchMedia 'hover: hover' dan 'pointer: fine' (mouse/trackpad = desktop)
 * - Tidak ada fitur touchscreen yang merupakan satu-satunya input
 * 
 * Pada device hybrid (laptop touchscreen), tetap return true karena ada keyboard.
 */
export function useHasPhysicalKeyboard() {
  const [hasKeyboard, setHasKeyboard] = useState(() => {
    if (typeof window === 'undefined') return true;
    // 'hover: hover' + 'pointer: fine' = mouse/trackpad present = likely desktop/laptop
    const hasHover = window.matchMedia('(hover: hover)').matches;
    const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
    return hasHover && hasFinePointer;
  });

  useEffect(() => {
    const hoverMQ = window.matchMedia('(hover: hover)');
    const pointerMQ = window.matchMedia('(pointer: fine)');

    const update = () => {
      setHasKeyboard(hoverMQ.matches && pointerMQ.matches);
    };

    hoverMQ.addEventListener('change', update);
    pointerMQ.addEventListener('change', update);

    return () => {
      hoverMQ.removeEventListener('change', update);
      pointerMQ.removeEventListener('change', update);
    };
  }, []);

  return hasKeyboard;
}
