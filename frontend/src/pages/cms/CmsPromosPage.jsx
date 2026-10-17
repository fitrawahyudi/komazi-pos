import React, { useState, useEffect } from 'react';
import {
  Tag,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  ExternalLink,
  Eye,
  EyeOff,
  X,
  RefreshCw,
  Gift
} from 'lucide-react';
import { useCmsStore } from '../../store/cmsStore';
import { useToastStore } from '../../store/toastStore';

export default function CmsPromosPage() {
  const { promos, fetchPromos, createPromo, updatePromo, deletePromo, saving, loading } =
    useCmsStore();
  const { addToast } = useToastStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    badgeText: 'Promo Terbatas',
    bannerUrl: '',
    description: '',
    actionText: 'Klaim Promo via WhatsApp',
    actionLink: '',
    validUntil: '',
    isActive: true
  });

  useEffect(() => {
    fetchPromos();
  }, [fetchPromos]);

  const openCreateModal = () => {
    setEditingPromo(null);
    setFormData({
      title: '',
      subtitle: '',
      badgeText: 'Promo Terbatas',
      bannerUrl: '',
      description: '',
      actionText: 'Klaim Promo via WhatsApp',
      actionLink:
        'https://wa.me/6281298765432?text=Halo%20Komazi,%20saya%20ingin%20tanya%20promo',
      validUntil: '',
      isActive: true
    });
    setModalOpen(true);
  };

  const openEditModal = (promo) => {
    setEditingPromo(promo);
    setFormData({
      title: promo.title || '',
      subtitle: promo.subtitle || '',
      badgeText: promo.badgeText || '',
      bannerUrl: promo.bannerUrl || '',
      description: promo.description || '',
      actionText: promo.actionText || 'Klaim Promo via WhatsApp',
      actionLink: promo.actionLink || '',
      validUntil: promo.validUntil ? promo.validUntil.slice(0, 10) : '',
      isActive: promo.isActive
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      addToast('Judul promo wajib diisi', 'error');
      return;
    }

    if (editingPromo) {
      const res = await updatePromo(editingPromo.id, formData);
      if (res?.success) {
        addToast('Promo berhasil diperbarui', 'success');
        setModalOpen(false);
      } else {
        addToast(res?.message || 'Gagal memperbarui promo', 'error');
      }
    } else {
      const res = await createPromo(formData);
      if (res?.success) {
        addToast('Promo baru berhasil ditambahkan', 'success');
        setModalOpen(false);
      } else {
        addToast(res?.message || 'Gagal menambahkan promo', 'error');
      }
    }
  };

  const handleToggleActive = async (promo) => {
    const res = await updatePromo(promo.id, { isActive: !promo.isActive });
    if (res?.success) {
      addToast(
        !promo.isActive ? 'Promo diaktifkan di landing page' : 'Promo dinonaktifkan',
        'info'
      );
    }
  };

  const handleDelete = async (id, title) => {
    if (window.confirm(`Hapus promo "${title}"?`)) {
      const res = await deletePromo(id);
      if (res?.success) {
        addToast('Promo berhasil dihapus', 'success');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Tag className="w-5 h-5 text-komazi-coral" />
            Promo & Penawaran Kedai
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Kelola banner promosi diskon, paket combo kopi, dan penawaran musiman untuk pengunjung.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-komazi-coral to-[#ff7368] hover:from-komazi-coral-dark hover:to-komazi-coral text-white font-semibold text-xs transition-all shadow-lg shadow-komazi-coral/30"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Promo Baru</span>
        </button>
      </div>

      {/* Promos Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading && (
          <div className="col-span-2 text-center py-12 text-slate-400 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-komazi-coral" />
            Memuat daftar promo...
          </div>
        )}

        {!loading && promos.length === 0 && (
          <div className="col-span-2 text-center py-16 bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
            <Gift className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-300">Belum Ada Promo Aktif</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Buat penawaran menarik seperti paket combo kopi pagi atau diskon pastry akhir pekan.
            </p>
            <button
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-komazi-coral to-[#ff7368] text-white font-semibold text-xs shadow-lg shadow-komazi-coral/30"
            >
              <Plus className="w-4 h-4" />
              Buat Promo Sekarang
            </button>
          </div>
        )}

        {!loading &&
          promos.map((promo) => (
            <div
              key={promo.id}
              className={`rounded-2xl border overflow-hidden transition-all flex flex-col justify-between ${
                promo.isActive
                  ? 'bg-slate-900/80 border-slate-800 hover:border-komazi-coral/40'
                  : 'bg-slate-950/40 border-slate-900 opacity-60'
              }`}
            >
              {/* Image Banner */}
              {promo.bannerUrl && (
                <div
                  className="h-40 w-full bg-cover bg-center relative"
                  style={{ backgroundImage: `url(${promo.bannerUrl})` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>
                  {promo.badgeText && (
                    <span className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-komazi-coral to-[#ff7368] text-white font-bold text-[10px] uppercase tracking-wider shadow">
                      {promo.badgeText}
                    </span>
                  )}
                </div>
              )}

              {/* Promo Details */}
              <div className="p-5 flex-1 space-y-3">
                {!promo.bannerUrl && promo.badgeText && (
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-komazi-coral/15 text-komazi-coral border border-komazi-coral/30 font-bold text-[10px] uppercase tracking-wider">
                    {promo.badgeText}
                  </span>
                )}

                <div>
                  <h3 className="font-bold text-white text-base leading-snug">
                    {promo.title}
                  </h3>
                  {promo.subtitle && (
                    <p className="text-xs text-komazi-coral font-medium mt-0.5">
                      {promo.subtitle}
                    </p>
                  )}
                </div>

                {promo.description && (
                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    {promo.description}
                  </p>
                )}

                {promo.validUntil && (
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    Berlaku hingga: {new Date(promo.validUntil).toLocaleDateString('id-ID')}
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(promo)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                      promo.isActive
                        ? 'bg-komazi-coral/10 text-komazi-coral border-komazi-coral/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {promo.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{promo.isActive ? 'Aktif' : 'Nonaktif'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEditModal(promo)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    title="Edit Promo"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(promo.id, promo.title)}
                    className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                    title="Hapus Promo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* Modal Form Create/Edit Promo */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Tag className="w-4 h-4 text-komazi-coral" />
                {editingPromo ? 'Edit Promo' : 'Buat Promo Baru'}
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Judul Promo</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Misal: Morning Booster Combo"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Subjudul / Tag</label>
                  <input
                    type="text"
                    value={formData.subtitle}
                    onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                    placeholder="Mulai pagimu lebih segar"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Badge Teks</label>
                  <input
                    type="text"
                    value={formData.badgeText}
                    onChange={(e) => setFormData({ ...formData, badgeText: e.target.value })}
                    placeholder="Hemat 25% / Special"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">URL Banner Foto</label>
                <input
                  type="url"
                  value={formData.bannerUrl}
                  onChange={(e) => setFormData({ ...formData, bannerUrl: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Rincian Deskripsi</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Beli 1 Kopi Aren dan Croissant hanya Rp 38rb..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30 resize-none leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Teks Tombol Aksi</label>
                  <input
                    type="text"
                    value={formData.actionText}
                    onChange={(e) => setFormData({ ...formData, actionText: e.target.value })}
                    placeholder="Klaim Promo via WhatsApp"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Batas Berlaku</label>
                  <input
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Tautan Aksi (Tautan WhatsApp / Link)
                </label>
                <input
                  type="text"
                  value={formData.actionLink}
                  onChange={(e) => setFormData({ ...formData, actionLink: e.target.value })}
                  placeholder="https://wa.me/6281298765432?text=..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30 font-mono text-[11px]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 font-medium text-slate-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 font-semibold rounded-xl bg-gradient-to-r from-komazi-coral to-[#ff7368] hover:from-komazi-coral-dark hover:to-komazi-coral disabled:opacity-50 text-white shadow-lg shadow-komazi-coral/30"
                >
                  {saving ? 'Menyimpan...' : editingPromo ? 'Simpan Perubahan' : 'Buat Promo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
