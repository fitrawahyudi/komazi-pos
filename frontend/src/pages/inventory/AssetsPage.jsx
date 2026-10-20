import React, { useState, useEffect, useMemo } from 'react';
import { useAssetStore } from '../../store/assetStore';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import { formatRupiah } from '../../utils/format';
import {
  Landmark,
  Plus,
  Search,
  X,
  Wrench,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Sparkles,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  Trash2,
  Edit2,
  Eye,
  Ban,
  Loader2,
  FileSpreadsheet,
  DollarSign,
} from 'lucide-react';

const ASSET_CATEGORIES = [
  'Peralatan Bar & Kopi',
  'Refrigerasi & Pendingin',
  'Elektronik & POS Hardware',
  'Kitchen & Cookware',
  'Furniture & Tata Ruang',
  'Kendaraan & Operasional',
  'Lainnya',
];

const LOCATIONS = [
  'Station Barista',
  'Station Kitchen',
  'Area Kasir & POS',
  'Dining Area & Indoor',
  'Outdoor & Smoking Area',
  'Gudang & Storage',
];

export default function AssetsPage() {
  const { user } = useAuthStore();
  const {
    assets,
    pagination,
    summary,
    activeAssetSchedule,
    loading,
    scheduleLoading,
    fetchAssets,
    createAsset,
    updateAsset,
    disposeAsset,
    fetchAssetSchedule,
  } = useAssetStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [isDisposeOpen, setIsDisposeOpen] = useState(false);
  const [disposingAsset, setDisposingAsset] = useState(null);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [viewingAsset, setViewingAsset] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: 'Peralatan Bar & Kopi',
    location: 'Station Barista',
    purchaseDate: new Date().toISOString().split('T')[0],
    startDate: new Date().toISOString().split('T')[0],
    purchasePrice: '',
    residualValue: '0',
    usefulLifeMonths: 60,
    condition: 'EXCELLENT',
    serialNumber: '',
    vendor: '',
    description: '',
  });

  // Disposal Form State
  const [disposalPrice, setDisposalPrice] = useState('0');
  const [disposalNotes, setDisposalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAssets({
      page: 1,
      status: statusFilter,
      category: categoryFilter,
      search,
    });
  }, [fetchAssets, statusFilter, categoryFilter, search]);

  const handlePageChange = (newPage) => {
    fetchAssets({
      page: newPage,
      status: statusFilter,
      category: categoryFilter,
      search,
    });
  };

  const handleOpenAdd = () => {
    setEditingAsset(null);
    setFormData({
      name: '',
      category: 'Peralatan Bar & Kopi',
      location: 'Station Barista',
      purchaseDate: new Date().toISOString().split('T')[0],
      startDate: new Date().toISOString().split('T')[0],
      purchasePrice: '',
      residualValue: '0',
      usefulLifeMonths: 60,
      condition: 'EXCELLENT',
      serialNumber: '',
      vendor: '',
      description: '',
    });
    setIsAddOpen(true);
  };

  const handleOpenEdit = (a) => {
    setEditingAsset(a);
    setFormData({
      name: a.name,
      category: a.category,
      location: a.location,
      purchaseDate: new Date(a.purchaseDate).toISOString().split('T')[0],
      startDate: new Date(a.startDate).toISOString().split('T')[0],
      purchasePrice: a.purchasePrice,
      residualValue: a.residualValue,
      usefulLifeMonths: a.usefulLifeMonths,
      condition: a.condition,
      serialNumber: a.serialNumber || '',
      vendor: a.vendor || '',
      description: a.description || '',
    });
    setIsAddOpen(true);
  };

  const handleOpenSchedule = async (a) => {
    setViewingAsset(a);
    setIsScheduleOpen(true);
    await fetchAssetSchedule(a.id);
  };

  const handleOpenDispose = (a) => {
    setDisposingAsset(a);
    setDisposalPrice('0');
    setDisposalNotes('');
    setIsDisposeOpen(true);
  };

  // Preview straight line monthly depreciation
  const previewMonthly = useMemo(() => {
    const price = parseFloat(formData.purchasePrice) || 0;
    const residual = parseFloat(formData.residualValue) || 0;
    const months = parseInt(formData.usefulLifeMonths, 10) || 60;
    if (months <= 0) return 0;
    return Math.max(0, Math.round(((price - residual) / months) * 100) / 100);
  }, [formData.purchasePrice, formData.residualValue, formData.usefulLifeMonths]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Nama aset wajib diisi');
      return;
    }
    const price = parseFloat(formData.purchasePrice);
    if (isNaN(price) || price <= 0) {
      toast.error('Harga perolehan harus lebih besar dari 0');
      return;
    }
    const residual = parseFloat(formData.residualValue || 0);
    if (residual > price) {
      toast.error('Nilai residu tidak boleh melebihi harga perolehan');
      return;
    }

    setSubmitting(true);
    try {
      if (editingAsset) {
        await updateAsset(editingAsset.id, {
          ...formData,
          purchasePrice: price,
          residualValue: residual,
          usefulLifeMonths: parseInt(formData.usefulLifeMonths, 10),
        });
      } else {
        await createAsset({
          ...formData,
          purchasePrice: price,
          residualValue: residual,
          usefulLifeMonths: parseInt(formData.usefulLifeMonths, 10),
        });
      }
      setIsAddOpen(false);
    } catch {
      // error handled in store
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDispose = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await disposeAsset(disposingAsset.id, {
        disposalPrice: parseFloat(disposalPrice) || 0,
        disposalNotes,
      });
      setIsDisposeOpen(false);
    } catch {
      // error handled in store
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-6 space-y-6 max-w-7xl mx-auto select-none">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-komazi-coral/15 border border-komazi-coral/30 flex items-center justify-center text-komazi-coral">
              <Landmark className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-komazi-text tracking-tight flex items-center gap-2">
              <span>Aset Tetap</span>
            </h1>
          </div>
          <p className="text-xs text-komazi-muted mt-1">
            Register aktiva tetap, mesin kopi, pendingin, POS, dan kalkulasi penyusutan garis lurus otomatis.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="px-4 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold shadow-md transition-all flex items-center gap-2 active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Tambah Aset</span>
        </button>
      </div>

      {/* 2. Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-komazi-coral/10 text-komazi-coral flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-komazi-muted font-medium truncate">Total Peralatan</div>
            <div className="text-lg font-black text-komazi-text truncate">
              {summary?.totalAssets || assets.length} Aset
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <Landmark className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-komazi-muted font-medium truncate">Nilai Investasi Awal</div>
            <div className="text-lg font-black text-emerald-400 truncate">
              {formatRupiah(summary?.totalPurchaseValue || 0)}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-komazi-muted font-medium truncate">Akumulasi Penyusutan</div>
            <div className="text-lg font-black text-purple-400 truncate">
              -{formatRupiah(summary?.totalAccumulatedDepreciation || 0)}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-komazi-muted font-medium truncate">Nilai Buku Bersih (NBV)</div>
            <div className="text-lg font-black text-blue-400 truncate">
              {formatRupiah(summary?.totalBookValue || 0)}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-komazi-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode aset, nama, lokasi, serial number..."
              className="w-full pl-9 pr-3 py-2 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs text-komazi-text focus:outline-none focus:border-komazi-coral transition-colors"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs text-komazi-text focus:outline-none focus:border-komazi-coral cursor-pointer"
          >
            <option value="">Semua Kategori</option>
            {ASSET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs text-komazi-text focus:outline-none focus:border-komazi-coral cursor-pointer"
          >
            <option value="">Semua Status</option>
            <option value="ACTIVE">Aktif (Digunakan)</option>
            <option value="IDLE">Tidak Digunakan</option>
            <option value="MAINTENANCE">Dalam Perbaikan</option>
            <option value="DISPOSED">Dilepas / Dijual</option>
          </select>
        </div>
      </div>

      {/* 4. Asset Table */}
      <div className="rounded-2xl bg-komazi-surface border border-komazi-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-komazi-border bg-komazi-surface-2/60 text-komazi-muted font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Kode</th>
                <th className="py-3 px-4">Nama Aset</th>
                <th className="py-3 px-4">Kategori / Lokasi</th>
                <th className="py-3 px-4 text-right">Harga Perolehan</th>
                <th className="py-3 px-4 text-right">Akumulasi Depr.</th>
                <th className="py-3 px-4 text-right">Nilai Buku</th>
                <th className="py-3 px-4 text-center">Kondisi / Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-komazi-border/50 text-komazi-text font-medium">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-komazi-muted">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-komazi-coral" />
                    <span>Memuat register aktiva tetap...</span>
                  </td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-komazi-muted space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-komazi-surface-2 flex items-center justify-center mx-auto text-komazi-muted">
                      <Landmark className="w-6 h-6" />
                    </div>
                    <div className="text-sm font-bold text-komazi-text">Belum ada aset tetap</div>
                    <p className="text-xs text-komazi-muted max-w-sm mx-auto">
                      Daftarkan mesin espresso, grinder, AC, kulkas, dan peralatan operasional kedai.
                    </p>
                  </td>
                </tr>
              ) : (
                assets.map((a) => (
                  <tr
                    key={a.id}
                    className={`hover:bg-komazi-surface-2/40 transition-colors ${
                      a.status === 'DISPOSED' ? 'opacity-60 bg-danger/5' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-komazi-coral whitespace-nowrap">
                      {a.code}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-komazi-text">{a.name}</div>
                      {a.serialNumber && (
                        <div className="text-[10px] text-komazi-muted font-mono">
                          SN: {a.serialNumber}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="text-[11px] text-komazi-text font-medium">{a.category}</div>
                      <div className="text-[10px] text-komazi-muted">{a.location}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold whitespace-nowrap text-komazi-text">
                      {formatRupiah(a.purchasePrice)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-purple-400 whitespace-nowrap">
                      -{formatRupiah(a.accumulatedDepreciation)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                      {formatRupiah(a.bookValue)}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="space-y-0.5">
                        {a.status === 'DISPOSED' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-danger/15 text-danger border border-danger/30 text-[10px] font-bold">
                            <span>Dilepas / Dijual</span>
                          </span>
                        ) : a.status === 'MAINTENANCE' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                            <Wrench className="w-3 h-3" />
                            <span>Servis</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Aktif</span>
                          </span>
                        )}
                        <div className="text-[9px] text-komazi-muted font-medium">
                          {a.condition === 'EXCELLENT'
                            ? 'Prima'
                            : a.condition === 'GOOD'
                            ? 'Baik'
                            : a.condition === 'FAIR'
                            ? 'Cukup'
                            : 'Butuh Servis'}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenSchedule(a)}
                          title="Lihat Jadwal Penyusutan"
                          className="p-1.5 rounded-lg hover:bg-komazi-surface-2 text-komazi-muted hover:text-purple-400 transition-colors"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                        </button>
                        {a.status !== 'DISPOSED' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(a)}
                              title="Edit Aset"
                              className="p-1.5 rounded-lg hover:bg-komazi-surface-2 text-komazi-muted hover:text-amber-400 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDispose(a)}
                              title="Lepas / Jual Aset"
                              className="p-1.5 rounded-lg hover:bg-danger/15 text-komazi-muted hover:text-danger transition-colors"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="p-3 border-t border-komazi-border bg-komazi-surface-2/30 flex items-center justify-between text-xs text-komazi-muted">
            <div>
              Menampilkan {assets.length} dari total {pagination.total} aset
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => handlePageChange(pagination.page - 1)}
                className="p-1.5 rounded-lg bg-komazi-surface border border-komazi-border text-komazi-text disabled:opacity-40 disabled:cursor-not-allowed hover:border-komazi-coral transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-bold text-komazi-text">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => handlePageChange(pagination.page + 1)}
                className="p-1.5 rounded-lg bg-komazi-surface border border-komazi-border text-komazi-text disabled:opacity-40 disabled:cursor-not-allowed hover:border-komazi-coral transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Modal Tambah / Edit Aset */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-komazi-surface border border-komazi-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-komazi-border flex items-center justify-between bg-komazi-surface-2/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-komazi-coral/15 flex items-center justify-center text-komazi-coral">
                  <Landmark className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-komazi-text">
                    {editingAsset ? `Edit Aset (${editingAsset.code})` : 'Pendaftaran Aset Tetap Baru'}
                  </h3>
                  <p className="text-[11px] text-komazi-muted">
                    Masukkan spesifikasi dan parameter penyusutan garis lurus
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
              {/* Nama Aset */}
              <div>
                <label className="block text-xs font-bold text-komazi-muted mb-1">
                  Nama Aset & Seri <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Mesin Kopi La Marzocco Linea Mini 1-Group"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs text-komazi-text focus:outline-none focus:border-komazi-coral"
                />
              </div>

              {/* Kategori & Lokasi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-komazi-muted mb-1">
                    Kategori Aset <span className="text-danger">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs text-komazi-text focus:outline-none focus:border-komazi-coral"
                  >
                    {ASSET_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-komazi-muted mb-1">
                    Lokasi Penempatan
                  </label>
                  <select
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs text-komazi-text focus:outline-none focus:border-komazi-coral"
                  >
                    {LOCATIONS.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tanggal Perolehan & Mulai Penyusutan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-komazi-muted mb-1">
                    Tanggal Pembelian <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                    className="w-full px-3 py-2 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs text-komazi-text focus:outline-none focus:border-komazi-coral"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-komazi-muted mb-1">
                    Mulai Disusutkan <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs text-komazi-text focus:outline-none focus:border-komazi-coral"
                  />
                </div>
              </div>

              {/* Harga Perolehan, Residu, Umur Manfaat */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-komazi-muted mb-1">
                    Harga Perolehan (Rp) <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    placeholder="0"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                    className="w-full px-3 py-2 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs font-mono font-bold text-komazi-text focus:outline-none focus:border-komazi-coral"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-komazi-muted mb-1">
                    Nilai Residu (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={formData.residualValue}
                    onChange={(e) => setFormData({ ...formData, residualValue: e.target.value })}
                    className="w-full px-3 py-2 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs font-mono text-komazi-text focus:outline-none focus:border-komazi-coral"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-komazi-muted mb-1">
                    Masa Manfaat (Bulan) <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="600"
                    required
                    placeholder="60"
                    value={formData.usefulLifeMonths}
                    onChange={(e) => setFormData({ ...formData, usefulLifeMonths: e.target.value })}
                    className="w-full px-3 py-2 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs font-mono text-komazi-text focus:outline-none focus:border-komazi-coral"
                  />
                </div>
              </div>

              {/* Preview Kalkulasi Penyusutan Bulanan */}
              {previewMonthly > 0 && (
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs flex items-center justify-between">
                  <div className="text-purple-300">
                    <span className="font-bold">Estimasi Penyusutan Bulanan (Garis Lurus):</span>
                    <div className="text-[10px] text-komazi-muted">
                      ({formatRupiah(formData.purchasePrice || 0)} - {formatRupiah(formData.residualValue || 0)}) / {formData.usefulLifeMonths} bln
                    </div>
                  </div>
                  <div className="font-mono font-black text-sm text-purple-400">
                    {formatRupiah(previewMonthly)} / bln
                  </div>
                </div>
              )}

              {/* Kondisi, Vendor, SN */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-komazi-muted mb-1">Kondisi</label>
                  <select
                    value={formData.condition}
                    onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                    className="w-full px-3 py-2 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs text-komazi-text focus:outline-none focus:border-komazi-coral"
                  >
                    <option value="EXCELLENT">Prima (Excellent)</option>
                    <option value="GOOD">Baik (Good)</option>
                    <option value="FAIR">Cukup (Fair)</option>
                    <option value="MAINTENANCE">Perlu Servis</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-komazi-muted mb-1">
                    Serial Number (SN)
                  </label>
                  <input
                    type="text"
                    placeholder="SN-123456"
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs text-komazi-text focus:outline-none focus:border-komazi-coral"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-komazi-muted mb-1">
                    Vendor / Distributor
                  </label>
                  <input
                    type="text"
                    placeholder="PT Toffin Indonesia"
                    value={formData.vendor}
                    onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                    className="w-full px-3 py-2 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs text-komazi-text focus:outline-none focus:border-komazi-coral"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-komazi-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 rounded-xl bg-komazi-surface border border-komazi-border text-xs font-bold text-komazi-muted hover:text-komazi-text"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold flex items-center gap-2 shadow-md"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingAsset ? 'Simpan Perubahan' : 'Daftarkan Aset'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal Jadwal Penyusutan Garis Lurus */}
      {isScheduleOpen && viewingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-komazi-surface border border-komazi-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-komazi-border flex items-center justify-between bg-komazi-surface-2/50">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-purple-400" />
                <div>
                  <h3 className="font-bold text-sm text-komazi-text">
                    Jadwal Penyusutan: {viewingAsset.name} ({viewingAsset.code})
                  </h3>
                  <p className="text-[11px] text-komazi-muted">
                    Proyeksi Garis Lurus {viewingAsset.usefulLifeMonths} Bulan • Beban{' '}
                    {formatRupiah(viewingAsset.monthlyDepreciation)}/bln
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleOpen(false)}
                className="p-1 text-komazi-muted hover:text-komazi-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto">
              {scheduleLoading ? (
                <div className="py-12 text-center text-komazi-muted">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-400" />
                  <span>Membuat matriks penyusutan...</span>
                </div>
              ) : activeAssetSchedule?.schedule ? (
                <div className="rounded-xl border border-komazi-border overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-komazi-surface-2/60 border-b border-komazi-border text-[10px] uppercase font-bold text-komazi-muted">
                        <th className="py-2.5 px-3">Bulan</th>
                        <th className="py-2.5 px-3">Periode</th>
                        <th className="py-2.5 px-3 text-right">Nilai Awal</th>
                        <th className="py-2.5 px-3 text-right">Beban Depresiasi</th>
                        <th className="py-2.5 px-3 text-right">Nilai Akhir (NBV)</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-komazi-border/50 text-komazi-text">
                      {activeAssetSchedule.schedule.map((row) => (
                        <tr
                          key={row.monthIndex}
                          className={`hover:bg-komazi-surface-2/40 ${
                            row.isProcessed ? 'bg-emerald-500/5' : ''
                          }`}
                        >
                          <td className="py-2 px-3 font-mono text-komazi-muted font-bold">
                            #{row.monthIndex}
                          </td>
                          <td className="py-2 px-3 font-semibold">{row.periodLabel}</td>
                          <td className="py-2 px-3 text-right font-mono text-komazi-muted">
                            {formatRupiah(row.openingBookValue)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-purple-400">
                            {formatRupiah(row.depreciationAmount)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">
                            {formatRupiah(row.closingBookValue)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {row.isProcessed ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                <span>Dibukukan</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-komazi-muted">Proyeksi</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal Pelepasan / Jual Aset (Disposal) */}
      {isDisposeOpen && disposingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-komazi-surface border border-danger/40 rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3 text-danger">
              <div className="w-10 h-10 rounded-xl bg-danger/15 flex items-center justify-center shrink-0">
                <Ban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-komazi-text">Pelepasan / Penjualan Aset</h3>
                <p className="text-[11px] text-komazi-muted">
                  {disposingAsset.code} - {disposingAsset.name}
                </p>
              </div>
            </div>

            <p className="text-xs text-komazi-muted">
              Nilai buku saat ini adalah{' '}
              <strong className="text-komazi-text">{formatRupiah(disposingAsset.bookValue)}</strong>.
              Aset yang dilepas akan berhenti disusutkan pada bulan-bulan berikutnya dan statusnya
              berubah menjadi <strong>DISPOSED</strong>.
            </p>

            <form onSubmit={handleConfirmDispose} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-komazi-muted mb-1">
                  Nilai Pelepasan / Harga Jual (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0 (Jika dibuang/rusak total)"
                  value={disposalPrice}
                  onChange={(e) => setDisposalPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs font-mono font-bold text-komazi-text focus:outline-none focus:border-danger"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-komazi-muted mb-1">
                  Alasan / Catatan Pelepasan
                </label>
                <textarea
                  rows="2"
                  placeholder="Misal: Dijual ke pihak ketiga / rusak total terbakar"
                  value={disposalNotes}
                  onChange={(e) => setDisposalNotes(e.target.value)}
                  className="w-full p-2.5 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs text-komazi-text focus:outline-none focus:border-danger resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDisposeOpen(false)}
                  className="px-4 py-2 rounded-xl bg-komazi-surface border border-komazi-border text-xs font-bold text-komazi-muted"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-danger hover:bg-danger-dark text-white text-xs font-bold flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Konfirmasi Pelepasan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
