import { useState, useEffect } from 'react';

/**
 * Otomatis menggulir elemen input/textarea ke tengah layar saat keyboard virtual muncul.
 * Diberikan debounce/delay 250ms agar animasi transisi keyboard OS selesai terlebih dahulu.
 * 
 * @param {React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>} event 
 * @param {Object} options 
 */
export function scrollInputIntoViewOnFocus(event, options = {}) {
  const target = event?.target;
  if (!target || typeof target.scrollIntoView !== 'function') return;

  // Hanya jalankan pada touch / virtual keyboard devices
  const isTouchDevice =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  if (!isTouchDevice) return;

  const delay = options.delay ?? 280;
  const blockPosition = options.block ?? 'center';

  setTimeout(() => {
    try {
      target.scrollIntoView({
        behavior: 'smooth',
        block: blockPosition,
        inline: 'nearest',
      });
    } catch {
      // Fallback untuk browser yang tidak mendukung opsi scrollIntoView
      target.scrollIntoView(false);
    }
  }, delay);
}

/**
 * Hook untuk memantau status Virtual Keyboard dan tinggi Visual Viewport secara real-time.
 * Bekerja pada browser modern (Chrome, Edge, Safari di Android & iPadOS).
 */
export function useVirtualKeyboard() {
  const [keyboardInfo, setKeyboardInfo] = useState(() => {
    if (typeof window === 'undefined' || !window.visualViewport) {
      return { isOpen: false, viewportHeight: 0, keyboardHeight: 0 };
    }
    return {
      isOpen: false,
      viewportHeight: window.visualViewport.height,
      keyboardHeight: 0,
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleResize = () => {
      const vv = window.visualViewport;
      if (!vv) return;

      const windowHeight = window.innerHeight;
      const currentHeight = vv.height;
      const heightDifference = windowHeight - currentHeight;

      // Jika selisih tinggi lebih dari 150px, keyboard hampir pasti terbuka
      const isKeyboardOpen = heightDifference > 150;

      setKeyboardInfo({
        isOpen: isKeyboardOpen,
        viewportHeight: currentHeight,
        keyboardHeight: isKeyboardOpen ? Math.round(heightDifference) : 0,
      });
    };

    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, []);

  return keyboardInfo;
}
