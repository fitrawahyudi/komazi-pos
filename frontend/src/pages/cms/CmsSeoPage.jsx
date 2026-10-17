import React, { useState, useEffect } from 'react';
import { Globe, Save, RefreshCw, Search, CheckCircle2 } from 'lucide-react';
import { useCmsStore } from '../../store/cmsStore';
import { useToastStore } from '../../store/toastStore';
import KomaziLogo from '../../components/ui/KomaziLogo';

export default function CmsSeoPage() {
  const { config, fetchConfig, updateConfig, saving, loading } = useCmsStore();
  const { addToast } = useToastStore();

  const [formData, setFormData] = useState({
    metaTitle: '',
    metaDescription: ''
  });

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    if (config) {
      setFormData({
        metaTitle: config.metaTitle || '',
        metaDescription: config.metaDescription || ''
      });
    }
  }, [config]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await updateConfig(formData);
    if (res?.success) {
      addToast('Pengaturan SEO & Meta Tag berhasil disimpan!', 'success');
    } else {
      addToast(res?.message || 'Gagal menyimpan pengaturan SEO', 'error');
    }
  };

  const titleLength = formData.metaTitle.length;
  const descLength = formData.metaDescription.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Globe className="w-5 h-5 text-komazi-coral" />
            SEO & Identitas Mesin Pencari
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Optimalkan judul dan deskripsi pencarian agar kedai Komazi mudah ditemukan di Google dan
            media sosial.
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
        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-5">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Judul Halaman (Meta Title)
                </label>
                <span
                  className={`text-[11px] font-mono ${
                    titleLength > 60 ? 'text-amber-400' : 'text-slate-500'
                  }`}
                >
                  {titleLength}/60 karakter disarankan
                </span>
              </div>
              <input
                type="text"
                value={formData.metaTitle}
                onChange={(e) => setFormData({ ...formData, metaTitle: e.target.value })}
                placeholder="Komazi Coffee — Kopi Pilihan & Cita Rasa Otentik Medan"
                className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-800 focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30 rounded-xl text-white outline-none"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Deskripsi Pencarian (Meta Description)
                </label>
                <span
                  className={`text-[11px] font-mono ${
                    descLength > 160 ? 'text-amber-400' : 'text-slate-500'
                  }`}
                >
                  {descLength}/160 karakter disarankan
                </span>
              </div>
              <textarea
                rows={4}
                value={formData.metaDescription}
                onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                placeholder="Kunjungi Komazi Coffee di Medan. Nikmati signature coffee Komazi Aren Latte, Sanger otentik, dan hidangan lezat dalam suasana kedai yang nyaman."
                className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-800 focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30 rounded-xl text-white outline-none resize-none leading-relaxed"
                required
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 text-xs text-slate-400 space-y-2">
            <div className="font-semibold text-slate-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-komazi-teal-light" />
              Petunjuk Optimasi SEO Kedai Kopi
            </div>
            <p className="leading-relaxed">
              Sertakan kata kunci lokasi seperti <strong>"Medan"</strong>, menu signature seperti{' '}
              <strong>"Kopi Aren"</strong>, dan identitas seperti <strong>"Artisan Coffee"</strong> agar
              calon pelanggan mudah menemukan kedai Anda di Google Maps dan pencarian lokal.
            </p>
          </div>
        </form>

        {/* Google Search Result Preview */}
        <div className="lg:col-span-5 space-y-4">
          <div className="sticky top-20">
            <div className="flex items-center justify-between pb-2 text-xs text-slate-400 font-semibold uppercase tracking-wider">
              <span className="flex items-center gap-1.5 text-komazi-coral">
                <Search className="w-3.5 h-3.5" />
                Simulasi Hasil Google
              </span>
              <span>Desktop & Ponsel</span>
            </div>

            {/* Google Search Mock Card */}
            <div className="bg-white text-slate-900 rounded-2xl p-5 border border-slate-200 shadow-xl space-y-1.5">
              <div className="flex items-center gap-2">
                <KomaziLogo variant="icon" size="xs" className="shrink-0" />
                <div>
                  <div className="text-xs font-medium text-slate-800 leading-tight">
                    Komazi Coffee
                  </div>
                  <div className="text-[11px] text-slate-500 leading-none">
                    https://komazi.coffee
                  </div>
                </div>
              </div>

              <div className="pt-1">
                <h3 className="text-base font-medium text-blue-800 hover:underline cursor-pointer leading-snug line-clamp-1">
                  {formData.metaTitle || 'Komazi Coffee — Kopi Pilihan & Cita Rasa Otentik Medan'}
                </h3>
                <p className="text-xs text-slate-600 mt-1 line-clamp-3 leading-relaxed">
                  {formData.metaDescription ||
                    'Kunjungi Komazi Coffee di Medan. Nikmati sajian kopi pilihan dan kenyamanan kedai.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
