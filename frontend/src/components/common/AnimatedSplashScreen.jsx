import React, { useState, useEffect } from 'react';
import { isAndroid, isNative } from '../../services/platform';

/**
 * AnimatedSplashScreen
 * 
 * Splash screen beranimasi kustom khusus untuk aplikasi Android (Capacitor APK).
 * TIDAK ditampilkan pada platform Web Browser.
 * 
 * Didesain seamless menyatu dengan native splash screen Android:
 * - Background: #0A0A0A (identik dengan @color/splashBackground di Android native)
 * - Transisi mulus: Tidak ada jeda layar kosong atau kedip putih
 * - Durasi: 1.8 detik dengan auto fade-out & opsi tap-to-skip
 *
 * @param {number} duration - Total durasi dalam milidetik (default: 1800ms)
 * @param {() => void} onFinish - Callback opsional saat animasi selesai dan komponen siap dilepas
 */
export default function AnimatedSplashScreen({ duration = 1800, onFinish }) {
  // Hanya aktif di Android native (Capacitor), kecuali jika didebug manual via query ?splash=1
  const isDebugSplash = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('splash');
  const shouldRender = (isAndroid && isNative) || isDebugSplash;

  const [isVisible, setIsVisible] = useState(shouldRender);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isAnimatedIn, setIsAnimatedIn] = useState(false);

  useEffect(() => {
    if (!shouldRender) {
      setIsVisible(false);
      onFinish?.();
      return;
    }

    // 1. Trigger animasi pembesaran halus & glow sesaat setelah mount
    const enterTimer = setTimeout(() => {
      setIsAnimatedIn(true);
    }, 40);

    // 2. Mulai efek fade-out 450ms sebelum durasi total berakhir
    const fadeOutDuration = 450;
    const fadeOutDelay = Math.max(duration - fadeOutDuration, 400);

    const fadeOutTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, fadeOutDelay);

    // 3. Lepas splash screen dari DOM saat total durasi tercapai
    const endTimer = setTimeout(() => {
      setIsVisible(false);
      if (typeof onFinish === 'function') {
        onFinish();
      }
    }, duration);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(fadeOutTimer);
      clearTimeout(endTimer);
    };
  }, [duration, onFinish, shouldRender]);

  if (!shouldRender || !isVisible) return null;

  // Fitur tap/klik untuk langsung masuk (skip splash) tanpa menunggu
  const handleQuickDismiss = () => {
    if (isFadingOut) return;
    setIsFadingOut(true);
    setTimeout(() => {
      setIsVisible(false);
      onFinish?.();
    }, 250);
  };

  return (
    <div
      aria-hidden="true"
      onClick={handleQuickDismiss}
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center select-none overflow-hidden cursor-pointer transition-opacity duration-400 ease-out ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        backgroundColor: '#0A0A0A',
        backgroundImage: 'radial-gradient(circle at center, rgba(255, 90, 77, 0.08) 0%, rgba(31, 111, 107, 0.05) 45%, #0A0A0A 80%)',
      }}
    >
      {/* Ambient Glow Aura di belakang logo - menyatu halus dari native Android splash */}
      <div
        className={`absolute w-72 h-72 sm:w-96 sm:h-96 rounded-full blur-3xl pointer-events-none transition-all duration-700 ease-out ${
          isAnimatedIn ? 'opacity-70 scale-100' : 'opacity-30 scale-85'
        }`}
        style={{
          background: 'radial-gradient(circle, rgba(255,90,77,0.24) 0%, rgba(31,111,107,0.18) 50%, transparent 70%)',
        }}
      />

      {/* Kontainer Logo - langsung terlihat (opacity-100) sehingga tidak ada kedip saat handover dari native splash */}
      <div
        className={`relative z-10 flex flex-col items-center transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] transform ${
          isAnimatedIn
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-100 scale-95 translate-y-1'
        }`}
      >
        {/* Gambar Logo Resmi Komazi */}
        <div className="relative">
          <img
            src="/komazi-logo-transparent.png"
            alt="Komazi Logo"
            className="w-48 sm:w-56 md:w-64 h-auto object-contain drop-shadow-[0_4px_28px_rgba(255,90,77,0.35)]"
            onError={(e) => {
              e.currentTarget.src = '/komazi-logo.png';
            }}
          />
        </div>

        {/* Garis Loading Progress Halus */}
        <div className="mt-7 w-32 h-[3px] bg-[#1E1E1E] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#FF5A4D] to-[#2FA39C] rounded-full transition-all ease-linear"
            style={{
              width: isAnimatedIn ? '100%' : '15%',
              transitionDuration: `${Math.max(duration - 300, 500)}ms`,
            }}
          />
        </div>

        {/* Teks Tagline */}
        <p
          className={`mt-3 text-xs tracking-widest text-[#9A9A9A] uppercase transition-opacity duration-500 delay-150 font-medium ${
            isAnimatedIn ? 'opacity-85' : 'opacity-50'
          }`}
        >
          Coffee & Workspace POS
        </p>
      </div>
    </div>
  );
}
