// Web Audio API Chime for Kitchen & Bar Order Alerts
export function playKitchenChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const triggerSound = () => {
      try {
        // Tone 1: High chime
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        gain1.gain.setValueAtTime(0.25, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.4);

        // Tone 2: Melodic finish
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
        gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(ctx.currentTime + 0.15);
        osc2.stop(ctx.currentTime + 0.7);
      } catch (err) {
        console.warn('Audio tone synthesis error:', err);
      }
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(triggerSound).catch(() => {});
    } else {
      triggerSound();
    }

    // Getarkan perangkat Android jika didukung
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([250, 100, 250]);
    }
  } catch (e) {
    console.warn('Audio chime notice:', e);
  }
}

/**
 * Web Audio API Bell Chime khusus untuk Pesanan Meja QR Baru (Triple Bell).
 * Didesain terdengar jelas di tengah kebisingan mesin kopi / grinder.
 */
export function playQrOrderChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const triggerSound = () => {
      try {
        const tones = [
          { freq: 523.25, time: 0, dur: 0.35, gain: 0.35 },    // C5 (Ding)
          { freq: 659.25, time: 0.14, dur: 0.35, gain: 0.38 }, // E5 (Dong)
          { freq: 783.99, time: 0.28, dur: 0.55, gain: 0.42 }, // G5 (Ding~)
        ];

        tones.forEach(({ freq, time, dur, gain: targetGain }) => {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          osc.type = 'triangle'; // Suara bell kafe lebih renyah dan tembus kebisingan
          osc.frequency.setValueAtTime(freq, ctx.currentTime + time);
          gainNode.gain.setValueAtTime(targetGain, ctx.currentTime + time);
          gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + dur);

          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          osc.start(ctx.currentTime + time);
          osc.stop(ctx.currentTime + time + dur);
        });
      } catch (err) {
        console.warn('QR chime tone synthesis error:', err);
      }
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(triggerSound).catch(() => {});
    } else {
      triggerSound();
    }

    // Pola getar berulang yang terasa jelas di saku barista
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([300, 150, 300, 150, 400]);
    }
  } catch (e) {
    console.warn('QR audio chime notice:', e);
  }
}

