import React, { useState, useEffect } from 'react';
import {
  Coffee,
  Plus,
  Trash2,
  Edit2,
  Wifi,
  Zap,
  Wind,
  Armchair,
  Shield,
  Sparkles,
  Clock,
  Music,
  Eye,
  EyeOff,
  X,
  RefreshCw
} from 'lucide-react';
import { useCmsStore } from '../../store/cmsStore';
import { useToastStore } from '../../store/toastStore';

const ICON_OPTIONS = [
  { name: 'Wifi', label: 'WiFi', icon: Wifi },
  { name: 'Zap', label: 'Colokan / Listrik', icon: Zap },
  { name: 'Wind', label: 'AC / Udara Sejuk', icon: Wind },
  { name: 'Coffee', label: 'Kopi & Bar', icon: Coffee },
  { name: 'Armchair', label: 'Tempat Duduk Nyaman', icon: Armchair },
  { name: 'Shield', label: 'Musholla / Ibadah', icon: Shield },
  { name: 'Sparkles', label: 'Spot Foto Estetik', icon: Sparkles },
  { name: 'Music', label: 'Musik Santai', icon: Music },
  { name: 'Clock', label: 'Buka Hingga Larut', icon: Clock }
];

export function renderFacilityIcon(iconName, className = 'w-5 h-5') {
  switch (iconName) {
    case 'Wifi':
      return <Wifi className={className} />;
    case 'Zap':
      return <Zap className={className} />;
    case 'Wind':
      return <Wind className={className} />;
    case 'Armchair':
      return <Armchair className={className} />;
    case 'Shield':
      return <Shield className={className} />;
    case 'Sparkles':
      return <Sparkles className={className} />;
    case 'Music':
      return <Music className={className} />;
    case 'Clock':
      return <Clock className={className} />;
    case 'Coffee':
    default:
      return <Coffee className={className} />;
  }
}

export default function CmsFacilitiesPage() {
  const {
    facilities,
    fetchFacilities,
    createFacility,
    updateFacility,
    deleteFacility,
    saving,
    loading
  } = useCmsStore();
  const { addToast } = useToastStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    iconName: 'Wifi',
    imageUrl: '',
    isActive: true
  });

  useEffect(() => {
    fetchFacilities();
  }, [fetchFacilities]);

  const openCreateModal = () => {
    setEditingFacility(null);
    setFormData({
      title: '',
      description: '',
      iconName: 'Wifi',
      imageUrl: '',
      isActive: true
    });
    setModalOpen(true);
  };

  const openEditModal = (fac) => {
    setEditingFacility(fac);
    setFormData({
      title: fac.title || '',
      description: fac.description || '',
      iconName: fac.iconName || 'Coffee',
      imageUrl: fac.imageUrl || '',
      isActive: fac.isActive
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      addToast('Nama fasilitas wajib diisi', 'error');
      return;
    }

    if (editingFacility) {
      const res = await updateFacility(editingFacility.id, formData);
      if (res?.success) {
        addToast('Fasilitas kedai berhasil diperbarui', 'success');
        setModalOpen(false);
      } else {
        addToast(res?.message || 'Gagal memperbarui fasilitas', 'error');
      }
    } else {
      const res = await createFacility(formData);
      if (res?.success) {
        addToast('Fasilitas baru berhasil ditambahkan', 'success');
        setModalOpen(false);
      } else {
        addToast(res?.message || 'Gagal menambahkan fasilitas', 'error');
      }
    }
  };

  const handleToggleActive = async (fac) => {
    const res = await updateFacility(fac.id, { isActive: !fac.isActive });
    if (res?.success) {
      addToast(
        !fac.isActive ? 'Fasilitas diaktifkan di landing page' : 'Fasilitas disembunyikan',
        'info'
      );
    }
  };

  const handleDelete = async (id, title) => {
    if (window.confirm(`Hapus fasilitas "${title}"?`)) {
      const res = await deleteFacility(id);
      if (res?.success) {
        addToast('Fasilitas berhasil dihapus', 'success');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Coffee className="w-5 h-5 text-komazi-teal-light" />
            Fasilitas & Kenyamanan Kedai
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Tampilkan kenyamanan suasana kedai kopi (WiFi 100 Mbps, colokan listrik di setiap meja,
            AC dingin, musholla bersih).
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-komazi-coral to-[#ff7368] hover:from-komazi-coral-dark hover:to-komazi-coral text-white font-semibold text-xs transition-all shadow-lg shadow-komazi-coral/30"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Fasilitas</span>
        </button>
      </div>

      {/* Facilities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && (
          <div className="col-span-full text-center py-12 text-slate-400 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-komazi-teal-light" />
            Memuat daftar fasilitas...
          </div>
        )}

        {!loading && facilities.length === 0 && (
          <div className="col-span-full text-center py-16 bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
            <Coffee className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-300">Belum Ada Fasilitas Kedai</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Tambahkan fasilitas keunggulan seperti WiFi cepat atau stopkontak di setiap meja.
            </p>
            <button
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-komazi-coral to-[#ff7368] text-white font-semibold text-xs shadow-lg shadow-komazi-coral/30"
            >
              <Plus className="w-4 h-4" />
              Tambah Fasilitas Sekarang
            </button>
          </div>
        )}

        {!loading &&
          facilities.map((fac) => (
            <div
              key={fac.id}
              className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
                fac.isActive
                  ? 'bg-slate-900/80 border-slate-800 hover:border-komazi-teal/40'
                  : 'bg-slate-950/40 border-slate-900 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-komazi-teal/15 border border-komazi-teal/30 text-komazi-teal-light flex items-center justify-center">
                    {renderFacilityIcon(fac.iconName, 'w-5 h-5')}
                  </div>
                  <button
                    onClick={() => handleToggleActive(fac)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                      fac.isActive
                        ? 'bg-komazi-teal/15 text-komazi-teal-light border-komazi-teal/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {fac.isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    <span>{fac.isActive ? 'Tampil' : 'Sembunyi'}</span>
                  </button>
                </div>

                <h3 className="font-bold text-white text-sm mb-1.5">{fac.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                  {fac.description}
                </p>
              </div>

              <div className="flex items-center justify-end gap-1.5 mt-4 pt-3 border-t border-slate-800/80">
                <button
                  onClick={() => openEditModal(fac)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="Edit Fasilitas"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(fac.id, fac.title)}
                  className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                  title="Hapus Fasilitas"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
      </div>

      {/* Modal Form Create/Edit Facility */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Coffee className="w-4 h-4 text-komazi-teal-light" />
                {editingFacility ? 'Edit Fasilitas' : 'Tambah Fasilitas Baru'}
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
                <label className="block text-slate-300 font-medium mb-1">
                  Pilih Ikon Fasilitas
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {ICON_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = formData.iconName === opt.name;
                    return (
                      <button
                        type="button"
                        key={opt.name}
                        onClick={() => setFormData({ ...formData, iconName: opt.name })}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-komazi-teal/20 border-komazi-teal-light text-white font-semibold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        <Icon className="w-4 h-4 text-komazi-teal-light shrink-0" />
                        <span className="text-[11px] truncate">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Nama Fasilitas</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Misal: Ultra High-Speed WiFi (100 Mbps)"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Deskripsi Keunggulan
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Koneksi serat optik cepat dan stabil untuk streaming..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral/30 resize-none leading-relaxed"
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
                    : editingFacility
                    ? 'Simpan Perubahan'
                    : 'Tambah Fasilitas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
