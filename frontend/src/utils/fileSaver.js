import XLSX from 'xlsx-js-style';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { toast } from '../store/toastStore.js';

/**
 * Konversi Blob menjadi Base64 string murni (tanpa prefix data:...)
 */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    if (typeof FileReader === 'undefined') {
      return resolve('');
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result;
      const base64 = typeof res === 'string' && res.includes(',') ? res.split(',')[1] : res;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Memastikan izin penyimpanan di Android jika diperlukan
 */
async function ensureStoragePermissions() {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const status = await Filesystem.checkPermissions();
    if (status.publicStorage !== 'granted') {
      const req = await Filesystem.requestPermissions();
      return req.publicStorage === 'granted';
    }
    return true;
  } catch (err) {
    console.warn('Filesystem permissions check non-critical warning:', err);
    return true;
  }
}

/**
 * Universal Workbook Saver (Web Browser + Native Android/iOS Capacitor)
 * Menyimpan workbook XLSX/CSV langsung ke Documents perangkat di Android native
 * atau memicu dialog unduhan browser di Web.
 *
 * @param {object} wb - SheetJS / xlsx-js-style Workbook object
 * @param {string} fileName - Nama file tujuan (misal: template_menu.xlsx)
 * @param {object} [options] - Opsi tambahan (misal: bookType: 'csv' atau 'xlsx')
 * @returns {Promise<{success: boolean, fileName: string, uri?: string, error?: any}>}
 */
export async function saveWorkbook(wb, fileName, options = {}) {
  const bookType = options.bookType || (fileName.toLowerCase().endsWith('.csv') ? 'csv' : 'xlsx');

  // Lingkungan Native Android / iOS (Capacitor)
  if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
    try {
      await ensureStoragePermissions();
      const base64Data = XLSX.write(wb, { bookType, type: 'base64' });

      // Simpan ke direktori publik Dokumen Android
      const res = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true,
      });

      toast.success(`File berhasil disimpan di folder Dokumen: ${fileName}`, 'Unduh Selesai');
      return { success: true, fileName, uri: res?.uri };
    } catch (err) {
      console.warn('Gagal simpan ke Directory.Documents, mencoba fallback ke Directory.Data:', err);
      try {
        const base64Data = XLSX.write(wb, { bookType, type: 'base64' });
        const res = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Data,
          recursive: true,
        });

        toast.success(`File tersimpan di penyimpanan aplikasi: ${fileName}`, 'Unduh Selesai');
        return { success: true, fileName, uri: res?.uri };
      } catch (fallbackErr) {
        console.error('Gagal total menyimpan workbook di Android:', fallbackErr);
        toast.error(`Gagal menyimpan file: ${err.message || 'Izin penyimpanan ditolak'}`);
        return { success: false, fileName, error: err };
      }
    }
  }

  // Lingkungan Browser Web standar
  if (typeof window !== 'undefined') {
    try {
      XLSX.writeFile(wb, fileName, options);
    } catch (e) {
      console.warn('XLSX.writeFile warning:', e);
    }
  }

  return { success: true, fileName };
}

/**
 * Universal Blob Saver (Web Browser + Native Android/iOS Capacitor)
 * Menyimpan Blob biner/teks (CSV, TXT, dsb) ke Documents perangkat di Android
 * atau memicu download browser standar.
 *
 * @param {Blob} blob - Data blob yang akan disimpan
 * @param {string} fileName - Nama file tujuan
 * @returns {Promise<{success: boolean, fileName: string, uri?: string, error?: any}>}
 */
export async function saveBlobFile(blob, fileName) {
  // Lingkungan Native Android / iOS (Capacitor)
  if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
    try {
      await ensureStoragePermissions();
      const base64Data = await blobToBase64(blob);

      const res = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true,
      });

      toast.success(`File berhasil disimpan di folder Dokumen: ${fileName}`, 'Unduh Selesai');
      return { success: true, fileName, uri: res?.uri };
    } catch (err) {
      console.warn('Gagal simpan blob ke Directory.Documents, mencoba Directory.Data:', err);
      try {
        const base64Data = await blobToBase64(blob);
        const res = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Data,
          recursive: true,
        });

        toast.success(`File tersimpan di penyimpanan aplikasi: ${fileName}`, 'Unduh Selesai');
        return { success: true, fileName, uri: res?.uri };
      } catch (fallbackErr) {
        console.error('Gagal total menyimpan blob di Android:', fallbackErr);
        toast.error(`Gagal mengunduh file: ${err.message || 'Izin penyimpanan ditolak'}`);
        return { success: false, fileName, error: err };
      }
    }
  }

  // Lingkungan Browser Web standar
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return { success: true, fileName };
}
