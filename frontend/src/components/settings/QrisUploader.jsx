import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Image as ImageIcon,
  CheckCircle,
  AlertCircle,
  Loader2,
  Trash2,
  RefreshCw,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Eye,
  X,
} from 'lucide-react';
import { decodeQrFromImageFile } from '../../utils/qrDecoder';
import { extractQrisMetadata } from '../../utils/qris';
import { api } from '../../services/api';
import { toast } from '../../store/toastStore';

/**
 * QrisUploader Component
 * Allows users to upload static QRIS image (photo/poster/flyer),
 * decodes the QR code in browser, extracts EMVCo metadata (NMID, Merchant, City, Zip),
 * and uploads the image to Cloudinary for permanent storage.
 */
export default function QrisUploader({
  currentImageUrl = '',
  merchantName = '',
  nmid = '',
  city = '',
  postalCode = '',
  onExtracted,
  onClear,
  disabled = false,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState(''); // 'decoding' | 'uploading'
  const [lastExtracted, setLastExtracted] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(currentImageUrl || '');
  const [showFullImageModal, setShowFullImageModal] = useState(false);
  const fileInputRef = useRef(null);

  // Sync previewUrl when currentImageUrl is updated from parent (e.g. after async fetchSettings)
  useEffect(() => {
    if (currentImageUrl) {
      setPreviewUrl(currentImageUrl);
    }
  }, [currentImageUrl]);

  const handleFileSelect = async (file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar (PNG, JPG, JPEG, WebP)');
      return;
    }

    setIsProcessing(true);
    setProcessingStatus('decoding');

    // Create local object URL for instant preview
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);

    try {
      // 1. Decode QR Code from Image File in browser using jsQR
      const rawPayload = await decodeQrFromImageFile(file);

      if (!rawPayload || rawPayload.length < 20) {
        throw new Error('Hasil pemindaian QR tidak valid atau terlalu pendek');
      }

      // 2. Extract EMVCo TLV Metadata
      const metadata = extractQrisMetadata(rawPayload);

      setLastExtracted({
        rawPayload,
        metadata,
      });

      // 3. Upload image to Cloudinary via backend API
      setProcessingStatus('uploading');
      let uploadedUrl = '';
      try {
        const uploadRes = await api.upload(file);
        if (uploadRes && (uploadRes.url || uploadRes.data?.url)) {
          uploadedUrl = uploadRes.url || uploadRes.data.url;
          setPreviewUrl(uploadedUrl);
        }
      } catch (uploadErr) {
        console.warn('[QRIS Uploader] Upload Cloudinary gagal, namun payload berhasil diekstrak:', uploadErr);
        // Jangan blokir ekstraksi data jika upload gagal
      }

      // 4. Notify parent component with extracted payload & metadata
      if (onExtracted) {
        onExtracted({
          rawPayload,
          metadata: metadata || {},
          imageUrl: uploadedUrl || localPreview,
        });
      }

      toast.success(
        metadata?.merchantName
          ? `QRIS ${metadata.merchantName} berhasil diekstrak!`
          : 'Payload QRIS berhasil dibaca dan diekstrak!'
      );
    } catch (err) {
      console.error('[QRIS Uploader] Error decoding QR:', err);
      toast.error(err.message || 'Gagal membaca kode QR dari gambar');
      setLastExtracted(null);
      // Reset preview on fail if no existing image
      if (!currentImageUrl) {
        setPreviewUrl('');
      }
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled && !isProcessing) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isProcessing) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleClear = () => {
    setPreviewUrl('');
    setLastExtracted(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onClear) {
      onClear();
    }
  };

  const activeMerchant = lastExtracted?.metadata?.merchantName || merchantName;
  const activeNmid = lastExtracted?.metadata?.nmid || nmid;
  const activeCity = lastExtracted?.metadata?.merchantCity || city;
  const hasExistingConfig = Boolean(activeMerchant || activeNmid);

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        disabled={disabled || isProcessing}
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFileSelect(e.target.files[0]);
          }
        }}
      />

      {/* Main Upload Box / Active QRIS Card */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative rounded-2xl transition-all overflow-hidden ${
          isDragging
            ? 'border-2 border-dashed border-komazi-coral bg-komazi-coral/10 scale-[1.01]'
            : 'border border-komazi-border bg-komazi-surface-2/60'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isProcessing ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <div className="relative">
              <Loader2 className="w-10 h-10 text-komazi-coral animate-spin" />
              <QrCode className="w-5 h-5 text-white absolute inset-0 m-auto" />
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-komazi-text">
                {processingStatus === 'uploading'
                  ? 'Menyimpan Foto QRIS...'
                  : 'Membaca & Mengekstrak QR Code...'}
              </p>
              <p className="text-[11px] text-komazi-muted mt-0.5">
                {processingStatus === 'uploading'
                  ? 'Menyimpan gambar ke cloud untuk pratinjau kasir'
                  : 'Membaca payload EMVCo MPM dan tag Bank Indonesia'}
              </p>
            </div>
          </div>
        ) : previewUrl ? (
          /* STATE 1: Foto QRIS Aktif & Terpasang */
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0 w-full sm:w-auto">
              {/* Thumbnail Preview with Zoom trigger */}
              <div
                onClick={() => setShowFullImageModal(true)}
                className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-2xl overflow-hidden bg-black/60 border border-komazi-border/80 flex items-center justify-center group cursor-pointer shadow-md hover:border-komazi-coral transition-colors"
                title="Klik untuk melihat ukuran penuh"
              >
                <img
                  src={previewUrl}
                  alt="Foto QRIS Toko"
                  className="w-full h-full object-contain p-1.5"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                  <Eye className="w-5 h-5 text-white" />
                  <span className="text-[9px] text-white font-bold">Perbesar</span>
                </div>
              </div>

              {/* Info & Details */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    QRIS Terpasang &amp; Aktif
                  </span>
                </div>

                <h3 className="font-bold text-sm text-komazi-text truncate">
                  {activeMerchant || 'QRIS Toko Komazi'}
                </h3>

                <p className="text-[11px] text-komazi-muted font-mono mt-0.5 truncate">
                  NMID: <strong className="text-neutral-200">{activeNmid || '-'}</strong>
                  {activeCity && (
                    <>
                      {' '}• Kota: <strong className="text-neutral-200">{activeCity}</strong>
                    </>
                  )}
                </p>
                <p className="text-[10px] text-komazi-muted mt-1">
                  Siap digunakan untuk generate QRIS Dinamis otomatis di POS Kasir.
                </p>
              </div>
            </div>

            {/* Actions: Ganti & Hapus */}
            <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-komazi-border/50">
              <button
                type="button"
                onClick={() => {
                  if (!disabled && !isProcessing && fileInputRef.current) {
                    fileInputRef.current.click();
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-komazi-surface border border-komazi-border hover:border-komazi-coral text-komazi-text hover:text-white text-xs font-semibold transition-all shadow-sm active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5 text-komazi-coral" />
                <span>Ganti Foto</span>
              </button>

              <button
                type="button"
                onClick={handleClear}
                className="p-2 rounded-xl text-komazi-muted hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
                title="Hapus foto QRIS ini"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : hasExistingConfig ? (
          /* STATE 2: QRIS Toko Sudah Terdaftar (NMID/Merchant Ada), Siap Upload/Perbarui Foto */
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-500/10 border border-emerald-500/25 p-3.5 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full">
                      QRIS Terkonfigurasi &amp; Aktif
                    </span>
                    <span className="text-xs font-bold text-komazi-text">
                      {activeMerchant}
                    </span>
                  </div>
                  <p className="text-[11px] text-komazi-muted font-mono mt-0.5">
                    NMID: <strong className="text-neutral-200">{activeNmid}</strong> • Kota: <strong className="text-neutral-200">{activeCity || '-'}</strong>
                  </p>
                </div>
              </div>

              <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 self-start sm:self-auto shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Siap Dipakai di Kasir
              </span>
            </div>

            {/* Dropzone untuk melengkapi foto */}
            <div
              onClick={() => {
                if (!disabled && !isProcessing && fileInputRef.current) {
                  fileInputRef.current.click();
                }
              }}
              className="border-2 border-dashed border-komazi-border hover:border-komazi-coral/60 rounded-xl p-4 text-center cursor-pointer hover:bg-komazi-surface transition-all group"
            >
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-komazi-coral/10 text-komazi-coral flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Upload className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-xs font-bold text-komazi-text group-hover:text-komazi-coral transition-colors">
                    Unggah / Perbarui Foto Akrilik QRIS Toko
                  </p>
                  <p className="text-[11px] text-komazi-muted">
                    Seret file foto stiker/akrilik kasir ke sini atau klik untuk memilih file (PNG, JPG, WebP)
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* STATE 3: Fresh Dropzone (Belum ada QRIS sama sekali) */
          <div
            onClick={() => {
              if (!disabled && !isProcessing && fileInputRef.current) {
                fileInputRef.current.click();
              }
            }}
            className="border-2 border-dashed border-komazi-border hover:border-komazi-coral/60 rounded-2xl p-6 text-center cursor-pointer hover:bg-komazi-surface transition-all group"
          >
            <div className="flex flex-col items-center justify-center space-y-2.5">
              <div className="w-12 h-12 rounded-2xl bg-komazi-coral/10 border border-komazi-coral/20 flex items-center justify-center text-komazi-coral group-hover:scale-105 transition-transform">
                <Upload className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <p className="text-xs font-bold text-komazi-text">
                  Upload Foto / Gambar QRIS Toko Anda
                </p>
                <p className="text-[11px] text-komazi-muted mt-0.5 max-w-sm mx-auto">
                  Seret dan lepas file foto QRIS statis (DANA Bisnis, BCA, LinkAja, ShopeePay, dsb) atau klik untuk memilih file
                </p>
              </div>
              <div className="flex items-center gap-2 pt-1 text-[10px] text-komazi-muted font-medium">
                <span className="px-2 py-0.5 rounded bg-komazi-surface border border-komazi-border">
                  PNG, JPG, WebP
                </span>
                <span>•</span>
                <span className="text-komazi-coral font-semibold">Otomatis Ekstrak NMID &amp; Merchant</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Extraction Result Banner (Muncul seketika setelah upload baru berhasil) */}
      {lastExtracted?.metadata && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-3 text-xs animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="font-bold text-emerald-400">
              Payload &amp; Metadata QRIS Berhasil Diekstrak Otomatis:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
              <div className="bg-emerald-950/40 p-2 rounded-lg border border-emerald-500/20">
                <span className="text-komazi-muted text-[10px] block">NMID</span>
                <span className="font-mono font-bold text-emerald-300">
                  {lastExtracted.metadata.nmid || '(Tidak ada)'}
                </span>
              </div>
              <div className="bg-emerald-950/40 p-2 rounded-lg border border-emerald-500/20">
                <span className="text-komazi-muted text-[10px] block">Merchant</span>
                <span className="font-bold text-emerald-300 truncate block">
                  {lastExtracted.metadata.merchantName || '(Tidak ada)'}
                </span>
              </div>
              <div className="bg-emerald-950/40 p-2 rounded-lg border border-emerald-500/20">
                <span className="text-komazi-muted text-[10px] block">Kota</span>
                <span className="font-bold text-emerald-300">
                  {lastExtracted.metadata.merchantCity || '(Tidak ada)'}
                </span>
              </div>
              <div className="bg-emerald-950/40 p-2 rounded-lg border border-emerald-500/20">
                <span className="text-komazi-muted text-[10px] block">Kode Pos</span>
                <span className="font-mono font-bold text-emerald-300">
                  {lastExtracted.metadata.postalCode || '(Tidak ada)'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal untuk melihat foto QRIS penuh */}
      {showFullImageModal && previewUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm p-4 flex items-center justify-center animate-in fade-in duration-150"
          onClick={() => setShowFullImageModal(false)}
        >
          <div
            className="relative max-w-lg w-full bg-komazi-surface border border-komazi-border rounded-3xl p-4 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-komazi-border mb-3">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-komazi-coral" />
                <span className="font-bold text-xs text-komazi-text">
                  Foto QRIS Toko: {activeMerchant || 'Komazi Coffee'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowFullImageModal(false)}
                className="p-1 rounded-lg text-komazi-muted hover:text-white hover:bg-komazi-surface-2 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-white rounded-2xl p-4 flex items-center justify-center max-h-[70vh] overflow-hidden">
              <img
                src={previewUrl}
                alt="QRIS Toko Penuh"
                className="max-h-[60vh] w-auto object-contain mx-auto"
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-komazi-muted font-mono">
              <span>NMID: {activeNmid || '-'}</span>
              <span>Kota: {activeCity || '-'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
