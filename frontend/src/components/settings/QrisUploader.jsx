import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, CheckCircle, AlertCircle, Loader2, Trash2, RefreshCw, QrCode } from 'lucide-react';
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
  onExtracted,
  disabled = false,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState(''); // 'decoding' | 'uploading'
  const [lastExtracted, setLastExtracted] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(currentImageUrl || '');
  const fileInputRef = useRef(null);

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
      // Reset preview on fail
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
  };

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

      {/* Main Upload Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (!disabled && !isProcessing && fileInputRef.current) {
            fileInputRef.current.click();
          }
        }}
        className={`relative border-2 border-dashed rounded-2xl p-5 text-center transition-all cursor-pointer overflow-hidden ${
          isDragging
            ? 'border-komazi-coral bg-komazi-coral/10 scale-[1.01]'
            : 'border-komazi-border bg-komazi-surface-2/60 hover:bg-komazi-surface-2 hover:border-komazi-coral/50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isProcessing ? (
          <div className="flex flex-col items-center justify-center py-6 space-y-3">
            <div className="relative">
              <Loader2 className="w-10 h-10 text-komazi-coral animate-spin" />
              <QrCode className="w-5 h-5 text-white absolute inset-0 m-auto" />
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-komazi-text">
                {processingStatus === 'uploading'
                  ? 'Menyimpan QRIS...'
                  : 'Mendeteksi & Mengekstrak QR Code...'}
              </p>
              <p className="text-[11px] text-komazi-muted mt-0.5">
                {processingStatus === 'uploading'
                  ? 'Data merchant siap diisikan ke form'
                  : 'Membaca payload EMVCo MPM dan tag Bank Indonesia'}
              </p>
            </div>
          </div>
        ) : previewUrl ? (
          <div className="flex flex-col sm:flex-row items-center gap-4 text-left">
            {/* Thumbnail Preview */}
            <div className="relative w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-black/40 border border-komazi-border flex items-center justify-center group">
              <img
                src={previewUrl}
                alt="Foto QRIS"
                className="w-full h-full object-contain p-1"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-white" />
              </div>
            </div>

            {/* Info and Actions */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <CheckCircle className="w-3 h-3" />
                  Foto QRIS Terpasang
                </span>
                <span className="text-[10px] text-komazi-muted">
                  Klik untuk ganti foto
                </span>
              </div>

              {lastExtracted?.metadata ? (
                <div className="text-xs text-komazi-text space-y-0.5">
                  <p className="font-bold truncate">
                    {lastExtracted.metadata.merchantName || 'Merchant Terdeteksi'}
                  </p>
                  <p className="text-[11px] text-komazi-muted font-mono truncate">
                    NMID: {lastExtracted.metadata.nmid || '-'} • Kota: {lastExtracted.metadata.merchantCity || '-'}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-komazi-muted">
                  Klik atau seret gambar baru jika ingin mengekstrak ulang dari file berbeda.
                </p>
              )}
            </div>

            {/* Button Clear */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="p-2 rounded-xl text-komazi-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Hapus pratinjau"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-4 space-y-2.5">
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
            </div>
          </div>
        )}
      </div>

      {/* Extraction Result Banner */}
      {lastExtracted?.metadata && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-3 text-xs">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="font-bold text-emerald-400">
              Payload & Metadata Berhasil Diekstrak Otomatis:
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
    </div>
  );
}
