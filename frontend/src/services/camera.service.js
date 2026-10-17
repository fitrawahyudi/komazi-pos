import { isNative } from './platform';

/**
 * Unified Camera Service (Section 14 Implementation Guide)
 * Native: Menggunakan Capacitor Camera jika tersedia
 * Web Fallback: Menggunakan HTML file input dengan capture="environment"
 */
export const CameraService = {
  async takePhoto(options = {}) {
    const facing = options.facingMode || 'user';
    if (isNative && typeof window !== 'undefined' && window.Capacitor?.Plugins?.Camera) {
      try {
        const image = await window.Capacitor.Plugins.Camera.getPhoto({
          quality: 85,
          allowEditing: false,
          resultType: 'dataUrl',
          source: 'CAMERA',
          direction: facing === 'user' ? 'FRONT' : 'REAR',
        });
        return { success: true, dataUrl: image.dataUrl };
      } catch (err) {
        if (err.message?.includes('User cancelled')) {
          return { success: false, cancelled: true };
        }
        console.warn('[CameraService] Native camera error, falling back to file input:', err);
      }
    }

    // Web Fallback: input file capture
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = facing;
      input.style.display = 'none';

      input.onchange = (e) => {
        const file = e.target.files?.[0];
        if (!file) {
          resolve({ success: false, cancelled: true });
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          resolve({ success: true, dataUrl: event.target.result, file });
        };
        reader.onerror = (err) => {
          resolve({ success: false, message: err.message });
        };
        reader.readAsDataURL(file);
      };

      document.body.appendChild(input);
      input.click();
      setTimeout(() => document.body.removeChild(input), 1000);
    });
  },
};
