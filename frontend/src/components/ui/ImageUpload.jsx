import React, { useState, useRef } from 'react';
import { api } from '../../services/api';
import {
  UploadCloud,
  Image as ImageIcon,
  Link as LinkIcon,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';

export default function ImageUpload({
  value,
  onChange,
  label = 'Foto / Gambar Produk',
  aspectRatio = 'aspect-video',
}) {
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'url'
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [urlInput, setUrlInput] = useState(value || '');
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileUpload = async (file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Hanya file gambar (JPG, PNG, WebP) yang didukung');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Ukuran file maksimal 5 MB');
      return;
    }

    setUploadError('');
    setUploadSuccess('');
    setIsUploading(true);

    try {
      const res = await api.upload(file);
      if (res && res.success && res.data?.url) {
        onChange(res.data.url);
        setUrlInput(res.data.url);
        setUploadSuccess('Foto berhasil diunggah ke Cloudinary! ☁️');
        setTimeout(() => setUploadSuccess(''), 3500);
      } else {
        setUploadError(res?.message || 'Gagal mengunggah gambar ke Cloudinary');
      }
    } catch (err) {
      setUploadError(err.message || 'Gagal mengunggah gambar ke Cloudinary');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleUrlApply = (e) => {
    e.preventDefault();
    if (urlInput.trim()) {
      onChange(urlInput.trim());
      setUploadSuccess('URL gambar diterapkan');
      setTimeout(() => setUploadSuccess(''), 2000);
    }
  };

  const handleRemove = () => {
    onChange('');
    setUrlInput('');
    setUploadError('');
    setUploadSuccess('');
  };

  return (
    <div className="space-y-2 select-none">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold uppercase tracking-wider text-komazi-muted">
          {label}
        </label>

        {/* Mode Toggle: Upload File vs URL Link */}
        <div className="flex items-center gap-1 bg-komazi-surface-2 p-0.5 rounded-lg border border-komazi-border text-[11px]">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`px-2.5 py-0.5 rounded-md font-semibold transition-all ${
              activeTab === 'upload'
                ? 'bg-komazi-coral text-white shadow-sm'
                : 'text-komazi-muted hover:text-white'
            }`}
          >
            Upload File
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`px-2.5 py-0.5 rounded-md font-semibold transition-all ${
              activeTab === 'url'
                ? 'bg-komazi-coral text-white shadow-sm'
                : 'text-komazi-muted hover:text-white'
            }`}
          >
            Input Link URL
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="p-2.5 rounded-xl bg-danger/15 border border-danger/30 text-danger text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {uploadSuccess && (
        <div className="p-2.5 rounded-xl bg-success/15 border border-success/30 text-success text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{uploadSuccess}</span>
        </div>
      )}

      {/* Preview Area & Upload Controls */}
      {value ? (
        <div className="relative group rounded-2xl overflow-hidden border-2 border-komazi-border bg-komazi-surface shadow-md">
          {/* Image Preview */}
          <div className={`w-full ${aspectRatio} max-h-48 overflow-hidden bg-black/40 flex items-center justify-center relative`}>
            <img
              src={value}
              alt="Pratinjau Gambar"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=500&auto=format&fit=crop&q=80';
              }}
            />

            {/* Hover Action Overlay */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[2px]">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-all"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Ganti Gambar</span>
              </button>

              <button
                type="button"
                onClick={handleRemove}
                className="p-2 rounded-xl bg-danger hover:bg-danger/80 text-white font-bold text-xs shadow-lg active:scale-95 transition-all"
                title="Hapus Gambar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : activeTab === 'upload' ? (
        /* Drag & Drop Upload Dropzone */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`p-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
            isDragOver
              ? 'border-komazi-coral bg-komazi-coral/10 scale-[1.01]'
              : 'border-komazi-border hover:border-komazi-coral/60 bg-komazi-surface-2 hover:bg-komazi-surface'
          }`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2 py-3 text-komazi-coral">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-xs font-bold">Mengunggah gambar...</p>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-2xl bg-komazi-coral/15 flex items-center justify-center text-komazi-coral">
                <UploadCloud className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div className="text-center space-y-0.5">
                <p className="text-xs font-bold text-komazi-text">
                  Klik untuk upload atau seret file gambar ke sini
                </p>
                <p className="text-[11px] text-komazi-muted">
                  PNG, JPG, WebP hingga 5 MB
                </p>
              </div>
            </>
          )}
        </div>
      ) : (
        /* Direct Link URL Input */
        <div className="flex gap-2">
          <div className="relative flex-1">
            <LinkIcon className="w-4 h-4 text-komazi-muted absolute left-3.5 top-3" />
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://images.unsplash.com/..."
              className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none font-mono"
            />
          </div>
          <button
            type="button"
            onClick={handleUrlApply}
            className="px-4 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs transition-colors shadow-sm"
          >
            Terapkan
          </button>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
        }}
      />
    </div>
  );
}
