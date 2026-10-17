import React, { useEffect, useState, useRef } from 'react';
import { useUiStore } from '../../../store/uiStore';

/**
 * TopLoadingBar
 * Sleek slim progress indicator pinned to the top of the viewport.
 * Automatically animates smooth trickling progress on background operations
 * with a safety timeout so it never gets permanently stuck.
 */
export default function TopLoadingBar() {
  const isTopBarLoading = useUiStore((state) => state.isTopBarLoading);
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const safetyTimeoutRef = useRef(null);

  useEffect(() => {
    let timer;
    let trickleInterval;

    if (isTopBarLoading) {
      setIsVisible(true);
      setProgress((prev) => (prev > 0 && prev < 88 ? prev : 20));

      // Smooth trickle progress up to 88%
      trickleInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 88) return prev;
          const increment = Math.max(1, (90 - prev) * 0.12);
          return Math.min(prev + increment, 88);
        });
      }, 200);

      // Auto-fallback timeout: after 5.5s, auto-complete to 100% and hide
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = setTimeout(() => {
        setProgress(100);
        timer = setTimeout(() => {
          setIsVisible(false);
          setProgress(0);
          useUiStore.getState().stopTopBarLoading();
        }, 350);
      }, 5500);
    } else {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }

      // Complete to 100% then fade out
      setProgress(100);
      timer = setTimeout(() => {
        setIsVisible(false);
        setProgress(0);
      }, 350);
    }

    return () => {
      clearInterval(trickleInterval);
      clearTimeout(timer);
    };
  }, [isTopBarLoading]);

  // Clean up safety timeout on unmount
  useEffect(() => {
    return () => {
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    };
  }, []);

  if (!isVisible && progress === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-[2.5px] pointer-events-none overflow-hidden bg-transparent">
      <div
        className="h-full bg-gradient-to-r from-komazi-coral via-[#FF7B70] to-komazi-teal-light transition-all duration-300 ease-out shadow-[0_0_10px_rgba(255,90,77,0.8)]"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transition: progress === 100 ? 'width 0.2s ease-out, opacity 0.3s ease-out' : 'width 0.25s ease-out',
        }}
      />
    </div>
  );
}
