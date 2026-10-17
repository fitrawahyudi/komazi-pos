import React, { useState, useMemo } from 'react';
import { useInventoryStore } from '../../store/inventoryStore';
import { toast } from '../../store/toastStore';
import { formatRupiah } from '../../utils/format';
import {
  Landmark,
  Lock,
  Plus,
  Search,
  X,
  Wrench,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Sparkles,
} from 'lucide-react';

export default function AssetsPage() {
  const { assets, addAsset } = useInventoryStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: 'Peralatan Bar & Kopi',
    location: 'Station Barista',
    purchaseDate: new Date().toISOString().split('T')[0],
    purchasePrice: 0,
    condition: 'EXCELLENT',
    serialNumber: '',
  });

  const filteredAssets = useMemo(() => {
    return assets.filter((a) => {
      const q = searchQuery.toLowerCase().trim();
      return (
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.code.toLowerCase().includes(q) ||
        a.location.toLowerCase().includes(q) ||
        (a.serialNumber && a.serialNumber.toLowerCase().includes(q))
      );
    });
  }, [assets, searchQuery]);

  const totalAssetValue = useMemo(() => {
    return assets.reduce((sum, a) => sum + (Number(a.purchasePrice) || 0), 0);
  }, [assets]);

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      category: 'Peralatan Bar & Kopi',
      location: 'Station Barista',
      purchaseDate: new Date().toISOString().split('T')[0],
      purchasePrice: 0,
      condition: 'EXCELLENT',
      serialNumber: '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Nama aset wajib diisi');
      return;
    }
    addAsset(formData);
    toast.success(`Aset "${formData.name}" berhasil didaftarkan`);
    setIsModalOpen(false);
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
              <span>Aset & Peralatan</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold">
                <Lock className="w-3 h-3 text-amber-400" />
                <span>Enterprise</span>
              </span>
            </h1>
          </div>
          <p className="text-xs text-komazi-muted mt-1">
            Manajemen mesin espresso, grinder, chiller, POS hardware, dan peralatan modal operasional.
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

      {/* 3. Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-komazi-coral/10 text-komazi-coral flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-komazi-muted font-medium">Total Peralatan</div>
            <div className="text-lg font-black text-komazi-text">{assets.length} Aset</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-komazi-muted font-medium">Nilai Investasi Aset</div>
            <div className="text-lg font-black text-emerald-400">{formatRupiah(totalAssetValue)}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-komazi-muted font-medium">Kondisi Prima</div>
            <div className="text-lg font-black text-amber-400">
              {assets.filter((a) => a.condition === 'EXCELLENT').length} Unit
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-komazi-muted font-medium">Jadwal Servis</div>
            <div className="text-lg font-black text-purple-400">Tepat Waktu</div>
          </div>
        </div>
      </div>

      {/* 4. Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-komazi-muted absolute left-3 top-3 pointer-events-none" />
        <input
          type="text"
          placeholder="Cari nama mesin, nomor seri, kode aset..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-8 py-2 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text placeholder-komazi-muted focus:border-komazi-coral focus:outline-none"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-2.5 text-komazi-muted hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 5. Table View */}
      <div className="rounded-2xl border border-komazi-border bg-komazi-surface/90 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-komazi-border bg-komazi-surface-2/40 text-komazi-muted font-semibold">
                <th className="py-3.5 pl-4 pr-2">Kode Aset</th>
                <th className="py-3.5 px-4">Nama Mesin / Alat</th>
                <th className="py-3.5 px-4">Kategori & Lokasi</th>
                <th className="py-3.5 px-4">Serial Number</th>
                <th className="py-3.5 px-4 text-right">Nilai Beli</th>
                <th className="py-3.5 px-4 text-center">Kondisi</th>
                <th className="py-3.5 pr-4 pl-2 text-right">Servis Terakhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-komazi-border/60">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-komazi-muted">
                    <p className="font-semibold text-xs text-komazi-text">Belum ada data aset peralatan</p>
                    <p className="text-[11px] text-komazi-muted mt-1">
                      Klik "+ Tambah Aset" untuk mencatat mesin dan perlengkapan resto Anda.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-komazi-surface-2/40 transition-colors">
                    <td className="py-3.5 pl-4 pr-2 font-mono font-bold text-komazi-coral">
                      {asset.code}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-komazi-text">
                      {asset.name}
                    </td>
                    <td className="py-3.5 px-4 text-komazi-muted">
                      <div className="text-komazi-text font-medium">{asset.category}</div>
                      <div className="text-[11px] text-komazi-muted">{asset.location}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-komazi-muted">
                      {asset.serialNumber || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                      {formatRupiah(asset.purchasePrice)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        {asset.condition === 'EXCELLENT' ? 'Sangat Baik' : 'Baik'}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4 pl-2 text-right font-mono text-[11px] text-komazi-muted">
                      {asset.lastMaintenance || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Modal Tambah Aset */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-komazi-surface border border-komazi-border p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-komazi-border pb-3">
              <h3 className="text-base font-bold text-komazi-text flex items-center gap-2">
                <Landmark className="w-5 h-5 text-komazi-coral" />
                <span>Daftarkan Aset Baru</span>
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-komazi-muted font-medium mb-1">
                  Nama Mesin / Peralatan <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Mesin Espresso La Marzocco"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-komazi-text focus:border-komazi-coral focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-komazi-muted font-medium mb-1">Kategori</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-komazi-text focus:border-komazi-coral focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-komazi-muted font-medium mb-1">Lokasi Stasiun</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-komazi-text focus:border-komazi-coral focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-komazi-muted font-medium mb-1">Harga Pembelian (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-komazi-text focus:border-komazi-coral focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-komazi-muted font-medium mb-1">Nomor Seri / SN</label>
                  <input
                    type="text"
                    placeholder="SN-12345"
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-komazi-text focus:border-komazi-coral focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-komazi-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-muted hover:text-white transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold transition-all shadow-md active:scale-95"
                >
                  Simpan Aset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
