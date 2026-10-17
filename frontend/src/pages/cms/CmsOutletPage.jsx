import React, { useState, useEffect } from 'react';
import {
  Clock,
  MapPin,
  Phone,
  MessageCircle,
  Save,
  RefreshCw,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';
import { useCmsStore } from '../../store/cmsStore';
import { useToastStore } from '../../store/toastStore';

function InstagramIcon({ className = 'w-4 h-4' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export default function CmsOutletPage() {
  const { outlet, fetchOutlet, updateOutlet, saving, loading } = useCmsStore();
  const { addToast } = useToastStore();

  const [formData, setFormData] = useState({
    outletName: '',
    address: '',
    city: 'Medan',
    weekdayHours: '',
    weekendHours: '',
    phone: '',
    whatsappNumber: '',
    whatsappMessage: '',
    googleMapsUrl: '',
    googleMapsEmbed: '',
    instagramUrl: '',
    tiktokUrl: ''
  });

  useEffect(() => {
    fetchOutlet();
  }, [fetchOutlet]);

  useEffect(() => {
    if (outlet) {
      setFormData({
        outletName: outlet.outletName || '',
        address: outlet.address || '',
        city: outlet.city || 'Medan',
        weekdayHours: outlet.weekdayHours || '',
        weekendHours: outlet.weekendHours || '',
        phone: outlet.phone || '',
        whatsappNumber: outlet.whatsappNumber || '',
        whatsappMessage: outlet.whatsappMessage || '',
        googleMapsUrl: outlet.googleMapsUrl || '',
        googleMapsEmbed: outlet.googleMapsEmbed || '',
        instagramUrl: outlet.instagramUrl || '',
        tiktokUrl: outlet.tiktokUrl || ''
      });
    }
  }, [outlet]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await updateOutlet(formData);
    if (res?.success) {
      addToast('Informasi kedai & jam operasional berhasil disimpan!', 'success');
    } else {
      addToast(res?.message || 'Gagal menyimpan perubahan', 'error');
    }
  };

  const testWhatsAppUrl = `https://wa.me/${formData.whatsappNumber.replace(
    /[^0-9]/g,
    ''
  )}?text=${encodeURIComponent(formData.whatsappMessage || 'Halo Komazi')}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5 text-komazi-teal-light" />
            Jam Operasional & Info Kedai
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Atur jam buka, nomor WhatsApp pemesanan/tanya-jawab, alamat fisik di Medan, dan tautan peta.
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

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kolom 1: Jam Buka & Lokasi Fisik */}
        <div className="space-y-6">
          {/* Card Jam Operasional */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 pb-2 border-b border-slate-800/80">
              <Clock className="w-4 h-4 text-komazi-teal-light" />
              1. Jam Buka Kedai
            </h2>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Jam Buka Hari Kerja (Senin - Jumat)
              </label>
              <input
                type="text"
                name="weekdayHours"
                value={formData.weekdayHours}
                onChange={handleChange}
                placeholder="Senin - Jumat: 08:00 - 23:00 WIB"
                className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30 rounded-xl text-white outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Jam Buka Akhir Pekan (Sabtu - Minggu)
              </label>
              <input
                type="text"
                name="weekendHours"
                value={formData.weekendHours}
                onChange={handleChange}
                placeholder="Sabtu - Minggu: 07:00 - 00:00 WIB"
                className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30 rounded-xl text-white outline-none"
                required
              />
            </div>
          </div>

          {/* Card Alamat & Maps */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 pb-2 border-b border-slate-800/80">
              <MapPin className="w-4 h-4 text-komazi-coral" />
              2. Alamat & Google Maps
            </h2>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Nama Outlet</label>
              <input
                type="text"
                name="outletName"
                value={formData.outletName}
                onChange={handleChange}
                placeholder="Komazi Coffee - Medan"
                className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30 rounded-xl text-white outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Alamat Lengkap
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Jl. Sisingamangaraja No. 88..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30 rounded-xl text-white outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Kota</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Medan"
                  className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30 rounded-xl text-white outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Tautan Google Maps Langsung (Petunjuk Arah)
              </label>
              <input
                type="url"
                name="googleMapsUrl"
                value={formData.googleMapsUrl}
                onChange={handleChange}
                placeholder="https://maps.google.com/?q=..."
                className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30 rounded-xl text-white outline-none font-mono text-[11px]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                URL Embed Google Maps (Iframe)
              </label>
              <input
                type="text"
                name="googleMapsEmbed"
                value={formData.googleMapsEmbed}
                onChange={handleChange}
                placeholder="https://www.google.com/maps/embed?pb=..."
                className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30 rounded-xl text-white outline-none font-mono text-[11px]"
              />
            </div>
          </div>
        </div>

        {/* Kolom 2: Kontak WhatsApp & Sosial Media */}
        <div className="space-y-6">
          {/* Card WhatsApp Pemesanan */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 pb-2 border-b border-slate-800/80">
              <MessageCircle className="w-4 h-4 text-komazi-teal-light" />
              3. WhatsApp Pemesanan & Pertanyaan
            </h2>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Nomor WhatsApp Kedai (Format: 628xxx)
              </label>
              <input
                type="text"
                name="whatsappNumber"
                value={formData.whatsappNumber}
                onChange={handleChange}
                placeholder="6281298765432"
                className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30 rounded-xl text-white outline-none font-mono"
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Gunakan kode negara 62 tanpa spasi atau tanda plus (+).
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Draf Pesan Otomatis Pengunjung
              </label>
              <textarea
                rows={3}
                name="whatsappMessage"
                value={formData.whatsappMessage}
                onChange={handleChange}
                placeholder="Halo Komazi Coffee, saya ingin bertanya tentang menu..."
                className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30 rounded-xl text-white outline-none resize-none leading-relaxed"
              />
            </div>

            {/* Tombol Uji WhatsApp */}
            <div className="p-3 bg-komazi-teal/15 border border-komazi-teal/30 rounded-xl flex items-center justify-between">
              <span className="text-xs text-komazi-teal-light font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-komazi-teal-light" />
                Uji Tautan WhatsApp
              </span>
              <a
                href={testWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-komazi-teal to-komazi-teal-light text-white text-xs font-semibold hover:opacity-90 transition-opacity shadow"
              >
                <span>Buka WhatsApp</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Card Media Sosial */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 pb-2 border-b border-slate-800/80">
              <InstagramIcon className="w-4 h-4 text-pink-400" />
              4. Media Sosial Kedai
            </h2>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                URL Akun Instagram
              </label>
              <input
                type="url"
                name="instagramUrl"
                value={formData.instagramUrl}
                onChange={handleChange}
                placeholder="https://instagram.com/komazi.coffee"
                className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30 rounded-xl text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                URL Akun TikTok
              </label>
              <input
                type="url"
                name="tiktokUrl"
                value={formData.tiktokUrl}
                onChange={handleChange}
                placeholder="https://tiktok.com/@komazi.coffee"
                className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30 rounded-xl text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Nomor Telepon Kantor / Kasir
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="081298765432"
                className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30 rounded-xl text-white outline-none font-mono"
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
