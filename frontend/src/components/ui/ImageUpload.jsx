import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../services/api';
import { toast } from '../../store/toastStore';
import {
  UploadCloud,
  Image as ImageIcon,
  Link as LinkIcon,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  RefreshCw,
  Wand2,
  Coffee,
  Utensils,
  Check,
  ExternalLink,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';

export default function ImageUpload({
  value,
  onChange,
  label = 'Foto / Gambar Produk',
  aspectRatio = 'aspect-video',
  productName = '',
  categoryName = '',
}) {
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'url' | 'ai'
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [urlInput, setUrlInput] = useState(value || '');
  const [isDragOver, setIsDragOver] = useState(false);

  // AI Studio States
  const [aiCustomPrompt, setAiCustomPrompt] = useState('');
  const [aiCustomName, setAiCustomName] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isAiSaving, setIsAiSaving] = useState(false);
  const [aiPreviewData, setAiPreviewData] = useState(null); // { imageUrl, prompt, seed, isSaved }
  const [aiStatusStep, setAiStatusStep] = useState(0);

  // Sync custom name when prop changes
  useEffect(() => {
    if (productName && (!aiCustomName || aiCustomName === productName)) {
      setAiCustomName(productName);
    }
  }, [productName]);

  // Keep urlInput in sync with external value
  useEffect(() => {
    setUrlInput(value || '');
  }, [value]);

  const targetProductName = (aiCustomName || productName || '').trim();

  // Detect drink vs food category
  const isDrink = Boolean(
    categoryName?.toLowerCase().includes('kopi') ||
    categoryName?.toLowerCase().includes('coffee') ||
    categoryName?.toLowerCase().includes('minum') ||
    categoryName?.toLowerCase().includes('drink') ||
    categoryName?.toLowerCase().includes('beverage') ||
    categoryName?.toLowerCase().includes('tea') ||
    categoryName?.toLowerCase().includes('teh') ||
    categoryName?.toLowerCase().includes('boba') ||
    categoryName?.toLowerCase().includes('juice') ||
    /^(kopi|iced|ice|es|hot|tea|teh|latte|americano|cappuccino|matcha|boba|espresso)/i.test(targetProductName)
  );

  const promptSuggestions = isDrink
    ? [
        'Es batu kristal melimpah',
        'Latte art estetik bunga',
        'Gelas tinggi modern & embun segar',
        'Cangkir keramik hitam cafe',
        'Garnish daun mint & kayu manis',
      ]
    : [
        'Plating piring keramik elegan',
        'Garnish daun parsley segar',
        'Rustic wooden cafe table',
        'Asap hangat mengepul lembut',
        'Crispy golden brown lezat',
      ];

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
    setAiPreviewData(null);
  };

  const handleGenerateAi = async () => {
    if (!targetProductName) {
      setUploadError('Nama menu wajib diisi terlebih dahulu agar AI mengenali produk!');
      toast.warning('Silakan isi Nama Menu terlebih dahulu sebelum membuat foto AI.');
      return;
    }

    setUploadError('');
    setUploadSuccess('');
    setIsAiGenerating(true);
    setAiStatusStep(1);

    const stepInterval = setInterval(() => {
      setAiStatusStep((prev) => (prev < 3 ? prev + 1 : 1));
    }, 1400);

    try {
      const res = await api.generateAiMenuImage({
        productName: targetProductName,
        categoryName: categoryName || '',
        customPrompt: aiCustomPrompt.trim() || undefined,
      });

      clearInterval(stepInterval);

      if (res && res.success && res.data?.imageUrl) {
        setAiPreviewData(res.data);
        toast.success('Foto AI berhasil dibuat! Silakan pratinjau sebelum menyimpan.');
      } else {
        const errMsg = res?.message || 'Gagal menghasilkan foto AI dari server.';
        setUploadError(errMsg);
        toast.error(errMsg);
      }
    } catch (err) {
      clearInterval(stepInterval);
      const errMsg = err?.message || 'Terjadi kesalahan jaringan saat membuat foto AI.';
      setUploadError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsAiGenerating(false);
      setAiStatusStep(0);
    }
  };

  const handleSaveAiToCloudinary = async () => {
    if (!aiPreviewData?.imageUrl) return;

    setUploadError('');
    setIsAiSaving(true);

    try {
      const res = await api.generateAiMenuImage({
        saveToCloudinary: true,
        imageUrl: aiPreviewData.imageUrl,
      });

      if (res && res.success && res.data?.url) {
        const permanentUrl = res.data.url;
        onChange(permanentUrl);
        setUrlInput(permanentUrl);
        setUploadSuccess('Foto produk AI berhasil disimpan permanen ke Cloudinary! ☁️✨');
        toast.success('Foto AI berhasil disimpan permanen ke Cloudinary & katalog produk!');
        setAiPreviewData(null);
        setActiveTab('upload');
        setTimeout(() => setUploadSuccess(''), 4000);
      } else {
        const errMsg = res?.message || 'Gagal menyimpan gambar AI ke Cloudinary.';
        setUploadError(errMsg);
        toast.error(errMsg);
      }
    } catch (err) {
      const errMsg = err?.message || 'Gagal menyimpan gambar AI ke Cloudinary.';
      setUploadError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsAiSaving(false);
    }
  };

  const handleUseDirectUrl = () => {
    if (!aiPreviewData?.imageUrl) return;
    onChange(aiPreviewData.imageUrl);
    setUrlInput(aiPreviewData.imageUrl);
    toast.info('Menggunakan tautan gambar AI langsung.');
    setUploadSuccess('Tautan foto AI diterapkan');
    setAiPreviewData(null);
    setActiveTab('upload');
    setTimeout(() => setUploadSuccess(''), 3000);
  };

  return (
    <div className="space-y-2 select-none">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-komazi-muted">
          {label}
        </label>

        {/* Mode Toggle: Upload File vs URL Link vs AI Studio */}
        <div className="flex items-center gap-1 bg-komazi-surface-2 p-1 rounded-xl border border-komazi-border text-[11px]">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'bg-komazi-coral text-white shadow-sm'
                : 'text-komazi-muted hover:text-white'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload File</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'url'
                ? 'bg-komazi-coral text-white shadow-sm'
                : 'text-komazi-muted hover:text-white'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>Link URL</span>
          </button>

          {/* <button
            type="button"
            onClick={() => {
              setActiveTab('ai');
              if (productName && !aiCustomName) {
                setAiCustomName(productName);
              }
            }}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'ai'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold shadow-sm shadow-amber-500/20'
                : 'text-amber-400/90 hover:text-amber-300 hover:bg-amber-500/10'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Studio (1-Klik)</span>
          </button> */}
        </div>
      </div>

      {uploadError && (
        <div className="p-2.5 rounded-xl bg-danger/15 border border-danger/30 text-danger text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{uploadError}</span>
        </div>
      )}

      {uploadSuccess && (
        <div className="p-2.5 rounded-xl bg-success/15 border border-success/30 text-success text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="flex-1">{uploadSuccess}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 1 & 2: PREVIEW EXISTING VALUE OR UPLOAD / URL
          ───────────────────────────────────────────────────────────────────────────── */}
      {value && activeTab !== 'ai' ? (
        <div className="relative group rounded-2xl overflow-hidden border-2 border-komazi-border bg-komazi-surface shadow-md">
          {/* Image Preview */}
          <div className={`w-full ${aspectRatio} max-h-52 overflow-hidden bg-black/40 flex items-center justify-center relative`}>
            <img
              src={value}
              alt="Pratinjau Gambar Produk"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=500&auto=format&fit=crop&q=80';
              }}
            />

            {/* Hover Action Overlay */}
            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2.5 backdrop-blur-[2px] p-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-all"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Ganti File</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('ai');
                  if (productName && !aiCustomName) {
                    setAiCustomName(productName);
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ganti dg AI</span>
              </button>

              <button
                type="button"
                onClick={handleRemove}
                className="p-1.5 rounded-xl bg-danger hover:bg-danger/80 text-white font-bold text-xs shadow-lg active:scale-95 transition-all"
                title="Hapus Gambar"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : activeTab === 'upload' ? (
        /* Drag & Drop Upload Dropzone */
        <div className="space-y-2">
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
                <p className="text-xs font-bold">Mengunggah gambar ke Cloudinary...</p>
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

          {/* Quick AI Trigger Banner when no image is set */}
          {/* <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/25 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-300">Belum punya foto menu?</p>
                <p className="text-[11px] text-komazi-muted">
                  Buat foto makanan/minuman estetik otomatis dalam 1-klik dengan AI.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveTab('ai');
                if (productName && !aiCustomName) {
                  setAiCustomName(productName);
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all shrink-0 cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Coba AI Studio</span>
            </button>
          </div> */}
        </div>
      ) : activeTab === 'url' ? (
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
      ) : (
        /* ─────────────────────────────────────────────────────────────────────────────
           TAB 3: KOMAZI AI F&B PHOTO STUDIO
           ───────────────────────────────────────────────────────────────────────────── */
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 via-komazi-surface to-komazi-surface-2 p-4 space-y-4 shadow-lg animate-in fade-in">
          {/* AI Studio Header */}
          <div className="flex items-start justify-between gap-3 border-b border-amber-500/20 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-300 flex items-center gap-2">
                  <span>Komazi AI F&B Photo Studio</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    FLUX Model • Gratis
                  </span>
                </h4>
                <p className="text-[11px] text-komazi-muted">
                  Membuat foto komersial makanan & minuman estetik otomatis dari nama menu
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-komazi-surface-2 border border-komazi-border text-komazi-muted">
              {isDrink ? (
                <>
                  <Coffee className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-cyan-300 font-semibold">Gaya Minuman</span>
                </>
              ) : (
                <>
                  <Utensils className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-amber-300 font-semibold">Gaya Makanan</span>
                </>
              )}
            </div>
          </div>

          {/* AI Generator Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-komazi-muted mb-1">
                Nama Menu yang Dibuat:
              </label>
              <input
                type="text"
                value={aiCustomName}
                onChange={(e) => setAiCustomName(e.target.value)}
                placeholder="Misal: Iced Salted Caramel Latte"
                className="w-full p-2.5 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text focus:border-amber-400 outline-none font-semibold"
              />
              <span className="text-[10px] text-komazi-muted mt-0.5 block">
                {productName ? 'Tersinkron otomatis dari form menu' : 'Isi nama produk yang ingin difoto'}
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-komazi-muted mb-1">
                Detail / Catatan Tambahan (Opsional):
              </label>
              <input
                type="text"
                value={aiCustomPrompt}
                onChange={(e) => setAiCustomPrompt(e.target.value)}
                placeholder="Contoh: ekstra es, cangkir keramik hitam..."
                className="w-full p-2.5 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text focus:border-amber-400 outline-none"
              />
              <span className="text-[10px] text-komazi-muted mt-0.5 block">
                Bisa dikosongkan, AI akan meracik prompt profesional otomatis
              </span>
            </div>
          </div>

          {/* Suggestion Chips */}
          <div>
            <span className="text-[10px] uppercase font-bold text-komazi-muted tracking-wider block mb-1.5">
              Ide Detail Cepat (Klik untuk menambah):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {promptSuggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setAiCustomPrompt((prev) =>
                      prev ? `${prev}, ${suggestion}` : suggestion
                    );
                  }}
                  className="px-2 py-1 rounded-lg text-[10px] bg-komazi-surface-2 hover:bg-amber-500/20 text-komazi-text hover:text-amber-300 border border-komazi-border hover:border-amber-500/30 transition-all cursor-pointer"
                >
                  + {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Trigger Generate Button (if not generated yet) */}
          {!aiPreviewData && !isAiGenerating && (
            <button
              type="button"
              onClick={handleGenerateAi}
              disabled={isAiGenerating || !targetProductName}
              className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all ${
                !targetProductName
                  ? 'bg-komazi-surface-2 text-komazi-muted border border-komazi-border cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 active:scale-[0.99] text-slate-950 shadow-amber-500/20 cursor-pointer'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Buat Foto AI Sekarang (1-Klik)</span>
            </button>
          )}

          {/* Loading Animation during AI generation */}
          {isAiGenerating && (
            <div className="p-6 rounded-2xl bg-komazi-surface-2 border border-amber-500/30 flex flex-col items-center justify-center gap-3 text-center animate-pulse">
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
                <Sparkles className="w-4 h-4 text-amber-400 absolute -top-1 -right-1 animate-bounce" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-amber-300">
                  {aiStatusStep === 1
                    ? `Meracik fotografi komersial untuk "${targetProductName}"...`
                    : aiStatusStep === 2
                    ? 'Mengatur pencahayaan cafe & depth of field modern...'
                    : 'Rendering detail visual 8K fotorealistis...'}
                </p>
                <p className="text-[11px] text-komazi-muted">
                  Memproses via engine AI FLUX (biasanya membutuhkan 3 - 8 detik)
                </p>
              </div>
            </div>
          )}

          {/* Generated Preview Card */}
          {aiPreviewData && !isAiGenerating && (
            <div className="space-y-3 pt-2">
              <div className="relative rounded-2xl overflow-hidden border-2 border-amber-500/40 bg-black/50 shadow-xl group">
                <div className={`w-full ${aspectRatio} max-h-60 overflow-hidden flex items-center justify-center relative`}>
                  <img
                    src={aiPreviewData.imageUrl}
                    alt="Pratinjau AI Menu"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
                  />

                  {/* Badges on preview */}
                  <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-amber-500/40 text-[10px] font-bold text-amber-300 flex items-center gap-1 shadow-md">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>AI Generated (FLUX)</span>
                  </div>

                  <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/20 text-[10px] font-semibold text-white/90 shadow-md">
                    Pratinjau Sementara
                  </div>
                </div>
              </div>

              {/* Action Buttons for Preview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleGenerateAi}
                  disabled={isAiSaving}
                  className="py-2.5 px-4 rounded-xl bg-komazi-surface-2 hover:bg-komazi-surface border border-komazi-border hover:border-amber-500/40 text-komazi-text font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Buat Ulang (Acak Variasi)</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveAiToCloudinary}
                  disabled={isAiSaving}
                  className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 active:scale-[0.99] transition-all cursor-pointer"
                >
                  {isAiSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan ke Cloudinary...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Simpan & Pasang ke Produk</span>
                    </>
                  )}
                </button>
              </div>

              {/* Fallback direct URL button */}
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={handleUseDirectUrl}
                  className="text-[11px] text-komazi-muted hover:text-amber-300 underline underline-offset-2 transition-colors cursor-pointer"
                >
                  Gunakan tautan gambar langsung tanpa menyimpan ke Cloudinary
                </button>
              </div>
            </div>
          )}
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
