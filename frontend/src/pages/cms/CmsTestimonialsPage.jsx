import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Plus,
  Trash2,
  Edit2,
  Star,
  Eye,
  EyeOff,
  X,
  RefreshCw,
  Quote
} from 'lucide-react';
import { useCmsStore } from '../../store/cmsStore';
import { useToastStore } from '../../store/toastStore';

export default function CmsTestimonialsPage() {
  const {
    testimonials,
    fetchTestimonials,
    createTestimonial,
    updateTestimonial,
    deleteTestimonial,
    saving,
    loading
  } = useCmsStore();
  const { addToast } = useToastStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState(null);

  const [formData, setFormData] = useState({
    customerName: '',
    customerRole: 'Pelanggan Setia',
    avatarUrl: '',
    rating: 5,
    reviewText: '',
    isFeatured: true
  });

  useEffect(() => {
    fetchTestimonials();
  }, [fetchTestimonials]);

  const openCreateModal = () => {
    setEditingTestimonial(null);
    setFormData({
      customerName: '',
      customerRole: 'Pelanggan Setia',
      avatarUrl: '',
      rating: 5,
      reviewText: '',
      isFeatured: true
    });
    setModalOpen(true);
  };

  const openEditModal = (t) => {
    setEditingTestimonial(t);
    setFormData({
      customerName: t.customerName || '',
      customerRole: t.customerRole || '',
      avatarUrl: t.avatarUrl || '',
      rating: t.rating || 5,
      reviewText: t.reviewText || '',
      isFeatured: t.isFeatured
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customerName.trim() || !formData.reviewText.trim()) {
      addToast('Nama pelanggan dan isi ulasan wajib diisi', 'error');
      return;
    }

    if (editingTestimonial) {
      const res = await updateTestimonial(editingTestimonial.id, formData);
      if (res?.success) {
        addToast('Ulasan pelanggan berhasil diperbarui', 'success');
        setModalOpen(false);
      } else {
        addToast(res?.message || 'Gagal memperbarui ulasan', 'error');
      }
    } else {
      const res = await createTestimonial(formData);
      if (res?.success) {
        addToast('Ulasan baru berhasil ditambahkan', 'success');
        setModalOpen(false);
      } else {
        addToast(res?.message || 'Gagal menambahkan ulasan', 'error');
      }
    }
  };

  const handleToggleFeatured = async (t) => {
    const res = await updateTestimonial(t.id, { isFeatured: !t.isFeatured });
    if (res?.success) {
      addToast(
        !t.isFeatured ? 'Ulasan kini ditampilkan di landing page' : 'Ulasan disembunyikan',
        'info'
      );
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Hapus ulasan dari "${name}"?`)) {
      const res = await deleteTestimonial(id);
      if (res?.success) {
        addToast('Ulasan berhasil dihapus', 'success');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-komazi-coral" />
            Ulasan & Testimoni Pelanggan
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Tampilkan kepuasan pelanggan atas rasa kopi, makanan, dan suasana kedai Komazi.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-komazi-coral to-[#ff7368] hover:from-komazi-coral-dark hover:to-komazi-coral text-white font-semibold text-xs transition-all shadow-lg shadow-komazi-coral/30"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Ulasan</span>
        </button>
      </div>

      {/* Testimonials Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && (
          <div className="col-span-full text-center py-12 text-slate-400 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-komazi-coral" />
            Memuat testimoni...
          </div>
        )}

        {!loading && testimonials.length === 0 && (
          <div className="col-span-full text-center py-16 bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
            <Quote className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-300">Belum Ada Ulasan Pelanggan</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Tambahkan review bintang 5 dari pelanggan setia kedai untuk meningkatkan kepercayaan
              pengunjung baru.
            </p>
            <button
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-komazi-coral to-[#ff7368] text-white font-semibold text-xs shadow-lg shadow-komazi-coral/30"
            >
              <Plus className="w-4 h-4" />
              Tambah Ulasan Sekarang
            </button>
          </div>
        )}

        {!loading &&
          testimonials.map((t) => (
            <div
              key={t.id}
              className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
                t.isFeatured
                  ? 'bg-slate-900/80 border-slate-800 hover:border-komazi-coral/40'
                  : 'bg-slate-950/40 border-slate-900 opacity-60'
              }`}
            >
              <div className="space-y-3">
                {/* Rating & Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i < (t.rating || 5)
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-700'
                        }`}
                      />
                    ))}
                  </div>

                  <button
                    onClick={() => handleToggleFeatured(t)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                      t.isFeatured
                        ? 'bg-komazi-coral/10 text-komazi-coral border-komazi-coral/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {t.isFeatured ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    <span>{t.isFeatured ? 'Tampil' : 'Sembunyi'}</span>
                  </button>
                </div>

                {/* Review Quote */}
                <p className="text-xs text-slate-300 italic leading-relaxed line-clamp-4">
                  "{t.reviewText}"
                </p>

                {/* Author Info */}
                <div className="flex items-center gap-3 pt-2">
                  {t.avatarUrl ? (
                    <img
                      src={t.avatarUrl}
                      alt={t.customerName}
                      className="w-9 h-9 rounded-full object-cover border border-slate-700 shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-komazi-coral/15 text-komazi-coral border border-komazi-coral/30 flex items-center justify-center font-bold text-xs shrink-0">
                      {t.customerName?.[0]?.toUpperCase() || 'U'}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="font-semibold text-white text-xs truncate">
                      {t.customerName}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {t.customerRole || 'Pelanggan Setia'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-1.5 mt-4 pt-3 border-t border-slate-800/80">
                <button
                  onClick={() => openEditModal(t)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="Edit Ulasan"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(t.id, t.customerName)}
                  className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                  title="Hapus Ulasan"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
      </div>

      {/* Modal Form */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <MessageSquare className="w-4 h-4 text-komazi-coral" />
                {editingTestimonial ? 'Edit Ulasan' : 'Tambah Ulasan Baru'}
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
                <label className="block text-slate-300 font-medium mb-1">Nama Pelanggan</label>
                <input
                  type="text"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  placeholder="Misal: Dian Pratama"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Peran / Profesi</label>
                <input
                  type="text"
                  value={formData.customerRole}
                  onChange={(e) => setFormData({ ...formData, customerRole: e.target.value })}
                  placeholder="Coffee Enthusiast / Pelanggan Setia"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Rating Bintang</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setFormData({ ...formData, rating: star })}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`w-5 h-5 ${
                          star <= formData.rating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-700'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs text-amber-400 font-semibold ml-2">
                    {formData.rating} dari 5
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Isi Ulasan</label>
                <textarea
                  rows={4}
                  value={formData.reviewText}
                  onChange={(e) => setFormData({ ...formData, reviewText: e.target.value })}
                  placeholder="Komazi Aren Latte-nya benar-benar juara! Suasananya hangat dan nyaman..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30 resize-none leading-relaxed"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  URL Foto Profil (Opsional)
                </label>
                <input
                  type="url"
                  value={formData.avatarUrl}
                  onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30"
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
                  {saving
                    ? 'Menyimpan...'
                    : editingTestimonial
                    ? 'Simpan Perubahan'
                    : 'Tambah Ulasan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
