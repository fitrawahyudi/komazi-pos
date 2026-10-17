import React, { useState, useEffect } from 'react';
import {
  Save,
  Image as ImageIcon,
  Sparkles,
  ExternalLink,
  Eye,
  Check,
  RefreshCw
} from 'lucide-react';
import { useCmsStore } from '../../store/cmsStore';
import { useToastStore } from '../../store/toastStore';

export default function CmsHeroPage() {
  const { config, fetchConfig, updateConfig, saving, loading } = useCmsStore();
  const { addToast } = useToastStore();

  const [formData, setFormData] = useState({
    isLandingPageActive: true,
    brandName: '',
    brandTagline: '',
    heroHeadline: '',
    heroSubheadline: '',
    heroImageUrl: '',
    heroCtaText: '',
    heroCtaLink: '',
    secondaryCtaText: '',
    secondaryCtaLink: '',
    aboutTitle: '',
    aboutStory: '',
    aboutImageUrl: ''
  });

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    if (config) {
      setFormData({
        isLandingPageActive: config.isLandingPageActive ?? true,
        brandName: config.brandName || '',
        brandTagline: config.brandTagline || '',
        heroHeadline: config.heroHeadline || '',
        heroSubheadline: config.heroSubheadline || '',
        heroImageUrl: config.heroImageUrl || '',
        heroCtaText: config.heroCtaText || '',
        heroCtaLink: config.heroCtaLink || '',
        secondaryCtaText: config.secondaryCtaText || '',
        secondaryCtaLink: config.secondaryCtaLink || '',
        aboutTitle: config.aboutTitle || '',
        aboutStory: config.aboutStory || '',
        aboutImageUrl: config.aboutImageUrl || ''
      });
    }
  }, [config]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await updateConfig(formData);
    if (res?.success) {
      addToast('Konten Hero & Identitas berhasil disimpan!', 'success');
    } else {
      addToast(res?.message || 'Gagal menyimpan perubahan', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-komazi-coral" />
            Hero & Identitas Brand
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Atur headline pembuka, visual banner utama, tagline, dan cerita filosofi kedai Komazi.
          </p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-komazi-coral to-[#ff7368] hover:from-komazi-coral-dark hover:to-komazi-coral disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-lg shadow-komazi-coral/30"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-6">
          {/* Section: Identitas Kedai */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 pb-2 border-b border-slate-800/80">
              <Sparkles className="w-4 h-4 text-komazi-coral" />
              1. Identitas Brand & Tagline
            </h2>

            {/* Publikasi Landing Page Switch */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
              <div>
                <div className="text-xs font-semibold text-white flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      formData.isLandingPageActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  <span>
                    Status Landing Page: {formData.isLandingPageActive ? 'ONLINE (AKTIF)' : 'OFFLINE (NONAKTIF)'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {formData.isLandingPageActive
                    ? 'Landing page terbuka untuk umum di alamat web utama /.'
                    : 'Landing page dinonaktifkan. Pengunjung web otomatis diarahkan ke login POS.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    isLandingPageActive: !prev.isLandingPageActive
                  }))
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all shrink-0 ${
                  formData.isLandingPageActive
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                }`}
              >
                {formData.isLandingPageActive ? 'Aktif (Klik utk Matikan)' : 'Mati (Klik utk Aktifkan)'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Nama Brand
                </label>
                <input
                  type="text"
                  name="brandName"
                  value={formData.brandName}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30 rounded-xl text-white outline-none transition-colors"
                  placeholder="Komazi Coffee"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Tagline Kedai
                </label>
                <input
                  type="text"
                  name="brandTagline"
                  value={formData.brandTagline}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30 rounded-xl text-white outline-none transition-colors"
                  placeholder="Artisan Coffee Roastery & Space"
                />
              </div>
            </div>
          </div>

          {/* Section: Headline & Hero Banner */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 pb-2 border-b border-slate-800/80">
              <ImageIcon className="w-4 h-4 text-komazi-teal-light" />
              2. Headline Hero Utama
            </h2>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Headline (Judul Besar Pengunjung)
              </label>
              <input
                type="text"
                name="heroHeadline"
                value={formData.heroHeadline}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-800 focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30 rounded-xl text-white outline-none font-medium transition-colors"
                placeholder="Secangkir Kopi Pilihan & Cita Rasa Otentik"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Subheadline (Deskripsi Pembuka)
              </label>
              <textarea
                name="heroSubheadline"
                rows={3}
                value={formData.heroSubheadline}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-800 focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30 rounded-xl text-white outline-none transition-colors resize-none leading-relaxed"
                placeholder="Deskripsi singkat yang menggugah selera kopi pengunjung..."
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                URL Gambar Hero Banner
              </label>
              <input
                type="url"
                name="heroImageUrl"
                value={formData.heroImageUrl}
                onChange={handleChange}
                className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30 rounded-xl text-white outline-none transition-colors"
                placeholder="https://images.unsplash.com/..."
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Gunakan URL gambar beresolusi tinggi bertema racikan kopi atau barista.
              </p>
            </div>

            {/* Tombol Aksi (CTA) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Teks Tombol Utama (CTA 1)
                </label>
                <input
                  type="text"
                  name="heroCtaText"
                  value={formData.heroCtaText}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30 rounded-xl text-white outline-none"
                  placeholder="Jelajahi Menu Pilihan"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Tautan Tombol Utama
                </label>
                <input
                  type="text"
                  name="heroCtaLink"
                  value={formData.heroCtaLink}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30 rounded-xl text-white outline-none font-mono text-[11px]"
                  placeholder="#menu"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Teks Tombol Sekunder (CTA 2)
                </label>
                <input
                  type="text"
                  name="secondaryCtaText"
                  value={formData.secondaryCtaText}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30 rounded-xl text-white outline-none"
                  placeholder="Kunjungi Kedai Kami"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Tautan Tombol Sekunder
                </label>
                <input
                  type="text"
                  name="secondaryCtaLink"
                  value={formData.secondaryCtaLink}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30 rounded-xl text-white outline-none font-mono text-[11px]"
                  placeholder="#location"
                />
              </div>
            </div>
          </div>

          {/* Section: Kisah & Filosofi Kedai */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 pb-2 border-b border-slate-800/80">
              <Sparkles className="w-4 h-4 text-komazi-coral" />
              3. Cerita & Filosofi Kedai (About Section)
            </h2>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Judul Cerita
              </label>
              <input
                type="text"
                name="aboutTitle"
                value={formData.aboutTitle}
                onChange={handleChange}
                className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30 rounded-xl text-white outline-none"
                placeholder="Kisah & Filosofi Komazi Coffee"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Isi Cerita & Dedikasi Racikan
              </label>
              <textarea
                name="aboutStory"
                rows={4}
                value={formData.aboutStory}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-800 focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30 rounded-xl text-white outline-none resize-none leading-relaxed"
                placeholder="Ceritakan latar belakang, pemilihan biji kopi lokal, dan dedikasi barista..."
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                URL Gambar Cerita (Opsional)
              </label>
              <input
                type="url"
                name="aboutImageUrl"
                value={formData.aboutImageUrl}
                onChange={handleChange}
                className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30 rounded-xl text-white outline-none"
                placeholder="https://images.unsplash.com/..."
              />
            </div>
          </div>
        </form>

        {/* Live Preview Card */}
        <div className="lg:col-span-5 space-y-4">
          <div className="sticky top-20">
            <div className="flex items-center justify-between pb-2 text-xs text-slate-400 font-semibold uppercase tracking-wider">
              <span className="flex items-center gap-1.5 text-komazi-coral">
                <Eye className="w-3.5 h-3.5" />
                Live Preview (Pratinjau)
              </span>
              <span>Tampilan Pengunjung</span>
            </div>

            {/* Simulated Hero Card */}
            <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
              {/* Background Mock */}
              <div
                className="h-64 sm:h-72 w-full bg-cover bg-center relative"
                style={{
                  backgroundImage: `url(${
                    formData.heroImageUrl ||
                    'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&auto=format&fit=crop&q=80'
                  })`
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/40"></div>

                <div className="absolute inset-0 p-6 flex flex-col justify-end">
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-komazi-coral/20 text-komazi-coral border border-komazi-coral/30 text-[10px] font-semibold tracking-wider uppercase w-fit mb-2">
                    {formData.brandName || 'Komazi Coffee'}
                  </span>
                  <h3 className="text-lg font-bold text-white tracking-tight leading-snug">
                    {formData.heroHeadline || 'Headline Kopi Komazi'}
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 line-clamp-3 leading-relaxed">
                    {formData.heroSubheadline || 'Deskripsi pembuka kopi artisan...'}
                  </p>

                  <div className="flex items-center gap-2 mt-4">
                    <div className="px-3 py-1.5 bg-gradient-to-r from-komazi-coral to-[#ff7368] text-white font-bold text-[11px] rounded-lg shadow-md shadow-komazi-coral/30">
                      {formData.heroCtaText || 'Lihat Menu'}
                    </div>
                    <div className="px-3 py-1.5 bg-slate-800/80 hover:border-komazi-teal/50 text-white font-medium text-[11px] rounded-lg border border-slate-700">
                      {formData.secondaryCtaText || 'Kontak'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Story Mini Preview */}
              <div className="p-5 border-t border-slate-800/80 bg-slate-900/60 space-y-2">
                <div className="text-xs font-semibold text-white">
                  {formData.aboutTitle || 'Tentang Kami'}
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-3 leading-relaxed">
                  {formData.aboutStory || 'Cerita tentang kopi Komazi...'}
                </p>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 text-[11px] text-slate-400 leading-normal">
              💡 <strong>Tips:</strong> Simpan perubahan untuk memperbarui tampilan pengunjung di rute utama{' '}
              <a href="/" target="_blank" className="text-komazi-coral underline">
                /
              </a>
              .
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
