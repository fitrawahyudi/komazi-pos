import React, { useState, useEffect, useMemo } from 'react';
import {
  Ticket,
  Zap,
  Plus,
  Search,
  Pencil,
  Trash2,
  Check,
  X,
  RefreshCw,
  Copy,
  Calendar,
  Layers,
  Sparkles,
  Percent,
  Coins,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { api } from '../services/api';
import { formatRupiah } from '../utils/format';
import { toast } from '../store/toastStore';
import AlertModal from '../components/ui/AlertModal';
import { scrollInputIntoViewOnFocus } from '../utils/keyboard';

export default function PromosPage() {
  const [activeTab, setActiveTab] = useState('vouchers'); // 'vouchers' | 'presets'
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'EXPIRED'

  const [vouchers, setVouchers] = useState([]);
  const [presets, setPresets] = useState([]);

  // Modal Voucher State
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState(null);
  const [voucherForm, setVoucherForm] = useState({
    code: '',
    name: '',
    type: 'PERCENT', // 'PERCENT' | 'NOMINAL'
    value: '',
    minSpend: '',
    maxDiscount: '',
    quota: '',
    startDate: '',
    endDate: '',
    description: '',
    isActive: true,
  });
  const [isSubmittingVoucher, setIsSubmittingVoucher] = useState(false);

  // Modal Preset State
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState(null);
  const [presetForm, setPresetForm] = useState({
    name: '',
    shortLabel: '',
    type: 'PERCENT',
    value: '',
    description: '',
  });
  const [isSubmittingPreset, setIsSubmittingPreset] = useState(false);

  // Delete Confirm Modal
  const [itemToDelete, setItemToDelete] = useState(null); // { type: 'voucher' | 'preset', data }
  const [isDeleting, setIsDeleting] = useState(false);

  // Load Data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [vouchersRes, presetsRes] = await Promise.all([
        api.get('/promos/vouchers'),
        api.get('/promos/presets'),
      ]);

      if (vouchersRes?.success && Array.isArray(vouchersRes.data)) {
        setVouchers(vouchersRes.data);
      }
      if (presetsRes?.success && Array.isArray(presetsRes.data)) {
        setPresets(presetsRes.data);
      }
    } catch (err) {
      toast.error('Gagal memuat data promosi: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Vouchers
  const filteredVouchers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const todayStr = new Date().toISOString().slice(0, 10);

    return vouchers.filter((v) => {
      const matchSearch =
        !q ||
        (v.code || '').toLowerCase().includes(q) ||
        (v.name || '').toLowerCase().includes(q) ||
        (v.description || '').toLowerCase().includes(q);

      if (!matchSearch) return false;

      if (statusFilter === 'ACTIVE') {
        const isNotExpired = !v.endDate || todayStr <= v.endDate;
        const hasQuota = !v.quota || (Number(v.usedCount) || 0) < Number(v.quota);
        return v.isActive !== false && isNotExpired && hasQuota;
      }
      if (statusFilter === 'EXPIRED') {
        const isExpiredDate = v.endDate && todayStr > v.endDate;
        const isQuotaOut = v.quota && (Number(v.usedCount) || 0) >= Number(v.quota);
        return isExpiredDate || isQuotaOut || v.isActive === false;
      }

      return true;
    });
  }, [vouchers, searchQuery, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const activeCount = vouchers.filter(
      (v) =>
        v.isActive !== false &&
        (!v.endDate || todayStr <= v.endDate) &&
        (!v.quota || (Number(v.usedCount) || 0) < Number(v.quota))
    ).length;

    const totalClaims = vouchers.reduce((acc, v) => acc + (Number(v.usedCount) || 0), 0);

    return {
      activeCount,
      totalCount: vouchers.length,
      totalClaims,
      presetsCount: presets.length,
    };
  }, [vouchers, presets]);

  // Handle Copy Voucher Code
  const handleCopyCode = (code) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(code);
      toast.success(`Kode "${code}" disalin ke clipboard!`);
    }
  };

  // Toggle Voucher Active Status
  const handleToggleVoucherActive = async (voucher) => {
    try {
      const updatedStatus = !voucher.isActive;
      const res = await api.put(`/promos/vouchers/${voucher.code}`, {
        ...voucher,
        isActive: updatedStatus,
      });

      if (res?.success) {
        setVouchers((prev) =>
          prev.map((v) => (v.code === voucher.code ? { ...v, isActive: updatedStatus } : v))
        );
        toast.success(
          `Voucher "${voucher.code}" berhasil ${updatedStatus ? 'diaktifkan' : 'dinonaktifkan'}.`
        );
      } else {
        toast.error(res?.message || 'Gagal mengubah status voucher');
      }
    } catch (err) {
      toast.error('Gagal memperbarui status: ' + err.message);
    }
  };

  // Open Voucher Modal
  const handleOpenVoucherModal = (voucher = null) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const nextYearStr = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    if (voucher) {
      setEditingVoucher(voucher);
      setVoucherForm({
        code: voucher.code || '',
        name: voucher.name || '',
        type: voucher.type || 'PERCENT',
        value: voucher.value || '',
        minSpend: voucher.minSpend || '',
        maxDiscount: voucher.maxDiscount || '',
        quota: voucher.quota || '',
        startDate: voucher.startDate || todayStr,
        endDate: voucher.endDate || nextYearStr,
        description: voucher.description || '',
        isActive: voucher.isActive !== false,
      });
    } else {
      setEditingVoucher(null);
      setVoucherForm({
        code: '',
        name: '',
        type: 'PERCENT',
        value: '',
        minSpend: 0,
        maxDiscount: 0,
        quota: 100,
        startDate: todayStr,
        endDate: nextYearStr,
        description: '',
        isActive: true,
      });
    }
    setIsVoucherModalOpen(true);
  };

  // Submit Voucher Form
  const handleSubmitVoucher = async (e) => {
    e.preventDefault();
    const cleanCode = (voucherForm.code || '').trim().toUpperCase();
    if (!cleanCode) {
      toast.warning('Kode voucher wajib diisi');
      return;
    }
    if (!voucherForm.name.trim()) {
      toast.warning('Nama voucher wajib diisi');
      return;
    }
    if (Number(voucherForm.value) <= 0) {
      toast.warning('Nilai diskon harus lebih besar dari 0');
      return;
    }

    setIsSubmittingVoucher(true);
    try {
      const payload = {
        code: cleanCode,
        name: voucherForm.name.trim(),
        type: voucherForm.type,
        value: Number(voucherForm.value) || 0,
        minSpend: Number(voucherForm.minSpend) || 0,
        maxDiscount: Number(voucherForm.maxDiscount) || 0,
        quota: Number(voucherForm.quota) || 100,
        startDate: voucherForm.startDate,
        endDate: voucherForm.endDate,
        description: voucherForm.description.trim(),
        isActive: voucherForm.isActive,
      };

      if (editingVoucher) {
        const res = await api.put(`/promos/vouchers/${editingVoucher.code}`, payload);
        if (res?.success) {
          toast.success(`Voucher "${cleanCode}" berhasil diperbarui!`);
          setIsVoucherModalOpen(false);
          loadData();
        } else {
          toast.error(res?.message || 'Gagal memperbarui voucher');
        }
      } else {
        const res = await api.post('/promos/vouchers', payload);
        if (res?.success) {
          toast.success(`Voucher "${cleanCode}" berhasil dibuat!`);
          setIsVoucherModalOpen(false);
          loadData();
        } else {
          toast.error(res?.message || 'Gagal membuat voucher');
        }
      }
    } catch (err) {
      toast.error('Terjadi kesalahan: ' + err.message);
    } finally {
      setIsSubmittingVoucher(false);
    }
  };

  // Open Preset Modal
  const handleOpenPresetModal = (preset = null) => {
    if (preset) {
      setEditingPreset(preset);
      setPresetForm({
        name: preset.name || '',
        shortLabel: preset.shortLabel || preset.name || '',
        type: preset.type || 'PERCENT',
        value: preset.value || '',
        description: preset.description || '',
      });
    } else {
      setEditingPreset(null);
      setPresetForm({
        name: '',
        shortLabel: '',
        type: 'PERCENT',
        value: '',
        description: '',
      });
    }
    setIsPresetModalOpen(true);
  };

  // Submit Preset Form
  const handleSubmitPreset = async (e) => {
    e.preventDefault();
    if (!presetForm.name.trim()) {
      toast.warning('Nama preset wajib diisi');
      return;
    }
    if (Number(presetForm.value) <= 0) {
      toast.warning('Nilai diskon harus lebih besar dari 0');
      return;
    }

    setIsSubmittingPreset(true);
    try {
      let updatedPresets;
      if (editingPreset) {
        updatedPresets = presets.map((p) =>
          p.id === editingPreset.id
            ? {
                ...p,
                name: presetForm.name.trim(),
                shortLabel: presetForm.shortLabel.trim() || presetForm.name.trim(),
                type: presetForm.type,
                value: Number(presetForm.value) || 0,
                description: presetForm.description.trim(),
              }
            : p
        );
      } else {
        const newPreset = {
          id: `preset_${Date.now()}`,
          name: presetForm.name.trim(),
          shortLabel: presetForm.shortLabel.trim() || presetForm.name.trim(),
          type: presetForm.type,
          value: Number(presetForm.value) || 0,
          description: presetForm.description.trim(),
        };
        updatedPresets = [...presets, newPreset];
      }

      const res = await api.put('/promos/presets', { presets: updatedPresets });
      if (res?.success) {
        setPresets(res.data || updatedPresets);
        toast.success(
          editingPreset
            ? `Preset "${presetForm.name}" berhasil diperbarui!`
            : `Preset "${presetForm.name}" berhasil ditambahkan!`
        );
        setIsPresetModalOpen(false);
      } else {
        toast.error(res?.message || 'Gagal menyimpan preset');
      }
    } catch (err) {
      toast.error('Terjadi kesalahan: ' + err.message);
    } finally {
      setIsSubmittingPreset(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      if (itemToDelete.type === 'voucher') {
        const res = await api.delete(`/promos/vouchers/${itemToDelete.data.code}`);
        if (res?.success) {
          toast.success(`Voucher "${itemToDelete.data.code}" berhasil dihapus.`);
          setVouchers((prev) => prev.filter((v) => v.code !== itemToDelete.data.code));
        } else {
          toast.error(res?.message || 'Gagal menghapus voucher');
        }
      } else if (itemToDelete.type === 'preset') {
        const updated = presets.filter((p) => p.id !== itemToDelete.data.id);
        const res = await api.put('/promos/presets', { presets: updated });
        if (res?.success) {
          toast.success(`Preset "${itemToDelete.data.name}" berhasil dihapus.`);
          setPresets(updated);
        } else {
          toast.error(res?.message || 'Gagal menghapus preset');
        }
      }
      setItemToDelete(null);
    } catch (err) {
      toast.error('Gagal menghapus: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-komazi-coral to-komazi-coral-dark text-white flex items-center justify-center shadow-lg shadow-komazi-coral/20">
              <Ticket className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-komazi-text tracking-tight flex items-center gap-2">
                Promo & Diskon
              </h1>
              <p className="text-xs text-komazi-muted">
                Atur voucher kupon promosi, preset diskon kasir 1-klik, kuota, dan minimal belanja.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-komazi-surface border border-komazi-border text-komazi-muted hover:text-white hover:border-komazi-coral/50 active:scale-95 transition-all cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {activeTab === 'vouchers' ? (
            <button
              type="button"
              onClick={() => handleOpenVoucherModal(null)}
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-komazi-coral to-komazi-coral-dark hover:brightness-110 active:scale-95 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-komazi-coral/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Buat Voucher Baru</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleOpenPresetModal(null)}
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-komazi-teal to-komazi-teal-light hover:brightness-110 active:scale-95 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-komazi-teal/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Tambah Preset Kasir</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Stat KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border/80 space-y-1 relative overflow-hidden group">
          <div className="text-[11px] font-bold text-komazi-muted uppercase tracking-wider flex items-center justify-between">
            <span>Voucher Aktif</span>
            <Ticket className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-komazi-text font-mono">
            {stats.activeCount} <span className="text-xs font-normal text-komazi-muted">/ {stats.totalCount}</span>
          </div>
          <p className="text-[10px] text-emerald-400 font-medium">Siap digunakan kasir & pelanggan</p>
        </div>

        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border/80 space-y-1 relative overflow-hidden group">
          <div className="text-[11px] font-bold text-komazi-muted uppercase tracking-wider flex items-center justify-between">
            <span>Total Pemakaian</span>
            <Sparkles className="w-4 h-4 text-komazi-coral" />
          </div>
          <div className="text-2xl font-black text-komazi-text font-mono">
            {stats.totalClaims} <span className="text-xs font-normal text-komazi-muted">kali</span>
          </div>
          <p className="text-[10px] text-komazi-muted font-medium">Akumulasi kupon diklaim di POS</p>
        </div>

        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border/80 space-y-1 relative overflow-hidden group">
          <div className="text-[11px] font-bold text-komazi-muted uppercase tracking-wider flex items-center justify-between">
            <span>Preset Kasir 1-Klik</span>
            <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
          </div>
          <div className="text-2xl font-black text-komazi-text font-mono">
            {stats.presetsCount} <span className="text-xs font-normal text-komazi-muted">preset</span>
          </div>
          <p className="text-[10px] text-amber-300 font-medium">Tombol instan di popover kasir</p>
        </div>

        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border/80 space-y-1 relative overflow-hidden group">
          <div className="text-[11px] font-bold text-komazi-muted uppercase tracking-wider flex items-center justify-between">
            <span>Proteksi Transaksi</span>
            <ShieldCheck className="w-4 h-4 text-komazi-teal-light" />
          </div>
          <div className="text-2xl font-black text-komazi-text font-mono">
            100% <span className="text-xs font-normal text-komazi-muted">Tervalidasi</span>
          </div>
          <p className="text-[10px] text-komazi-teal-light font-medium">Audit trail & anti double-claim</p>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-komazi-border">
        <button
          type="button"
          onClick={() => setActiveTab('vouchers')}
          className={`py-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'vouchers'
              ? 'border-komazi-coral text-komazi-coral'
              : 'border-transparent text-komazi-muted hover:text-white'
          }`}
        >
          <Ticket className="w-4 h-4" />
          <span>Kode Voucher Promo ({vouchers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('presets')}
          className={`py-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'presets'
              ? 'border-komazi-teal text-komazi-teal-light'
              : 'border-transparent text-komazi-muted hover:text-white'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Preset Diskon Cepat Kasir ({presets.length})</span>
        </button>
      </div>

      {/* 4. Tab 1: Vouchers List */}
      {activeTab === 'vouchers' && (
        <div className="space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-komazi-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kode atau nama voucher..."
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-komazi-muted hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-komazi-muted font-bold">Status:</span>
              <div className="flex rounded-xl bg-komazi-surface p-1 border border-komazi-border text-xs">
                {['ALL', 'ACTIVE', 'EXPIRED'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                      statusFilter === s
                        ? 'bg-komazi-coral text-white shadow-sm'
                        : 'text-komazi-muted hover:text-white'
                    }`}
                  >
                    {s === 'ALL' ? 'Semua' : s === 'ACTIVE' ? 'Aktif' : 'Nonaktif/Habis'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Vouchers Grid Cards */}
          {isLoading ? (
            <div className="p-12 text-center text-komazi-muted space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-komazi-coral" />
              <p className="text-xs">Memuat daftar voucher promo...</p>
            </div>
          ) : filteredVouchers.length === 0 ? (
            <div className="p-12 rounded-2xl bg-komazi-surface border border-komazi-border text-center space-y-3">
              <Ticket className="w-10 h-10 text-komazi-muted mx-auto stroke-1" />
              <p className="text-sm font-bold text-komazi-text">Tidak ada voucher promo yang cocok</p>
              <p className="text-xs text-komazi-muted">
                {searchQuery
                  ? 'Coba ubah kata kunci pencarian Anda.'
                  : 'Belum ada voucher yang dibuat. Klik tombol "Buat Voucher Baru" untuk mulai.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVouchers.map((voucher) => {
                const todayStr = new Date().toISOString().slice(0, 10);
                const isExpiredDate = voucher.endDate && todayStr > voucher.endDate;
                const isQuotaOut = voucher.quota && (Number(voucher.usedCount) || 0) >= Number(voucher.quota);
                const isEffectiveActive = voucher.isActive !== false && !isExpiredDate && !isQuotaOut;
                const usedPercent = voucher.quota
                  ? Math.min(100, Math.round(((voucher.usedCount || 0) / voucher.quota) * 100))
                  : 0;

                return (
                  <div
                    key={voucher.code}
                    className={`p-4 rounded-2xl border transition-all space-y-3.5 relative flex flex-col justify-between ${
                      isEffectiveActive
                        ? 'bg-komazi-surface border-komazi-border/80 hover:border-komazi-coral/40 shadow-sm'
                        : 'bg-komazi-surface/50 border-komazi-border/40 opacity-75'
                    }`}
                  >
                    {/* Top Row: Code Badge & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2.5 py-1 rounded-lg bg-komazi-coral/15 border border-komazi-coral/30 text-komazi-coral font-mono font-black text-xs tracking-wider flex items-center gap-1">
                          {voucher.code}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(voucher.code)}
                          className="p-1 rounded-md text-komazi-muted hover:text-white hover:bg-komazi-surface-2 transition-colors cursor-pointer"
                          title="Salin Kode Voucher"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Status Badge */}
                      {isEffectiveActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <Check className="w-3 h-3 stroke-[3]" /> Aktif
                        </span>
                      ) : isExpiredDate ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                          Kedaluwarsa
                        </span>
                      ) : isQuotaOut ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          Kuota Habis
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-500/15 text-slate-400 border border-slate-500/30">
                          Nonaktif
                        </span>
                      )}
                    </div>

                    {/* Voucher Detail */}
                    <div className="space-y-1">
                      <h3 className="font-bold text-sm text-komazi-text leading-tight">{voucher.name}</h3>
                      <p className="text-[11px] text-komazi-muted line-clamp-2">
                        {voucher.description || 'Tidak ada deskripsi khusus.'}
                      </p>
                    </div>

                    {/* Value Pill & Thresholds */}
                    <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border/60 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-komazi-muted text-[11px]">Besar Diskon:</span>
                        <span className="font-black text-komazi-coral font-mono text-sm">
                          {voucher.type === 'PERCENT' ? `${voucher.value}%` : formatRupiah(voucher.value)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-komazi-muted">
                        <span>Min. Transaksi:</span>
                        <span className="font-mono text-komazi-text font-bold">
                          {voucher.minSpend > 0 ? formatRupiah(voucher.minSpend) : 'Tanpa Syarat'}
                        </span>
                      </div>
                      {voucher.type === 'PERCENT' && voucher.maxDiscount > 0 && (
                        <div className="flex items-center justify-between text-[11px] text-komazi-muted">
                          <span>Maks. Potongan:</span>
                          <span className="font-mono text-komazi-text font-bold">
                            {formatRupiah(voucher.maxDiscount)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Quota Progress Bar */}
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-[11px] text-komazi-muted">
                        <span>Kuota Pemakaian:</span>
                        <span className="font-mono text-komazi-text font-bold">
                          {voucher.usedCount || 0} / {voucher.quota || '∞'}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-komazi-surface-2 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-komazi-coral to-amber-400 rounded-full transition-all"
                          style={{ width: `${usedPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Date Period */}
                    <div className="flex items-center gap-1.5 text-[10px] text-komazi-muted pt-1 border-t border-komazi-border/50">
                      <Calendar className="w-3 h-3 text-komazi-muted" />
                      <span>
                        {voucher.startDate || 'Sekarang'} s/d {voucher.endDate || 'Seterusnya'}
                      </span>
                    </div>

                    {/* Actions Bottom Bar */}
                    <div className="flex items-center justify-between pt-2 border-t border-komazi-border/60">
                      <label className="flex items-center gap-1.5 text-xs text-komazi-muted cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={voucher.isActive !== false}
                          onChange={() => handleToggleVoucherActive(voucher)}
                          className="rounded accent-komazi-coral w-3.5 h-3.5 cursor-pointer"
                        />
                        <span className="text-[11px] font-medium">Aktifkan</span>
                      </label>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenVoucherModal(voucher)}
                          className="p-1.5 rounded-lg text-komazi-muted hover:text-white hover:bg-komazi-surface-2 transition-colors cursor-pointer"
                          title="Edit Voucher"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setItemToDelete({ type: 'voucher', data: voucher })}
                          className="p-1.5 rounded-lg text-komazi-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Hapus Voucher"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. Tab 2: Presets List */}
      {activeTab === 'presets' && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs flex items-start gap-2.5 text-amber-300">
            <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 fill-amber-400" />
            <div>
              <strong className="block text-amber-200 font-bold mb-0.5">Preset Diskon Cepat di Kasir POS</strong>
              Preset ini otomatis muncul sebagai tombol 1-klik di popover diskon kasir saat bertransaksi. Kasir cukup menekan satu tombol tanpa perlu mengetik angka manual.
            </div>
          </div>

          {presets.length === 0 ? (
            <div className="p-12 rounded-2xl bg-komazi-surface border border-komazi-border text-center space-y-3">
              <Zap className="w-10 h-10 text-komazi-muted mx-auto stroke-1" />
              <p className="text-sm font-bold text-komazi-text">Belum ada preset diskon kasir</p>
              <p className="text-xs text-komazi-muted">
                Semua preset telah dihapus. Klik tombol "+ Tambah Preset Baru" di atas untuk membuat preset diskon cepat kasir.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border/80 space-y-3 flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-sm text-komazi-text">{preset.name}</h3>
                      <span className="inline-block px-2 py-0.5 rounded-md bg-komazi-teal/15 text-komazi-teal-light text-[10px] font-bold font-mono mt-1">
                        Label Kasir: "{preset.shortLabel || preset.name}"
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-xl bg-komazi-coral/15 text-komazi-coral font-bold font-mono text-xs">
                      {preset.type === 'PERCENT' ? `${preset.value}%` : formatRupiah(preset.value)}
                    </span>
                  </div>

                  <p className="text-xs text-komazi-muted">
                    {preset.description || 'Tidak ada catatan deskripsi.'}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-komazi-border/60 text-xs">
                    <span className="text-[11px] text-komazi-muted">Tipe: {preset.type === 'PERCENT' ? 'Persentase' : 'Nominal Tetap'}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenPresetModal(preset)}
                        className="p-1.5 rounded-lg text-komazi-muted hover:text-white hover:bg-komazi-surface-2 transition-colors cursor-pointer"
                        title="Edit Preset"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setItemToDelete({ type: 'preset', data: preset })}
                        className="p-1.5 rounded-lg text-komazi-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Hapus Preset"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. Modal Buat / Edit Voucher */}
      {isVoucherModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl p-5 md:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-komazi-border pb-3">
              <h2 className="text-base font-black text-komazi-text flex items-center gap-2">
                <Ticket className="w-4 h-4 text-komazi-coral" />
                <span>{editingVoucher ? `Edit Voucher ${editingVoucher.code}` : 'Buat Voucher Promo Baru'}</span>
              </h2>
            </div>

            <form onSubmit={handleSubmitVoucher} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-komazi-muted font-bold mb-1 uppercase tracking-wider text-[10px]">
                    Kode Voucher (Unik)*
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingVoucher)}
                    value={voucherForm.code}
                    onChange={(e) => setVoucherForm({ ...voucherForm, code: e.target.value.toUpperCase() })}
                    placeholder="MISAL: KOMAZI10"
                    className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text font-mono uppercase font-bold tracking-wider focus:border-komazi-coral outline-none disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-komazi-muted font-bold mb-1 uppercase tracking-wider text-[10px]">
                    Nama Promo*
                  </label>
                  <input
                    type="text"
                    required
                    value={voucherForm.name}
                    onChange={(e) => setVoucherForm({ ...voucherForm, name: e.target.value })}
                    placeholder="Contoh: Diskon 10% Ngopi Santai"
                    className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-komazi-muted font-bold mb-1 uppercase tracking-wider text-[10px]">
                    Tipe Diskon
                  </label>
                  <select
                    value={voucherForm.type}
                    onChange={(e) => setVoucherForm({ ...voucherForm, type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text font-bold focus:border-komazi-coral outline-none"
                  >
                    <option value="PERCENT">Persentase (%)</option>
                    <option value="NOMINAL">Nominal Rupiah (Rp)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-komazi-muted font-bold mb-1 uppercase tracking-wider text-[10px]">
                    Nilai Diskon*
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={voucherForm.value}
                    onChange={(e) => setVoucherForm({ ...voucherForm, value: e.target.value })}
                    placeholder={voucherForm.type === 'PERCENT' ? 'Misal: 10 (%)' : 'Misal: 15000 (Rp)'}
                    className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text font-mono font-bold focus:border-komazi-coral outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-komazi-muted font-bold mb-1 uppercase tracking-wider text-[10px]">
                    Min. Belanja (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={voucherForm.minSpend}
                    onChange={(e) => setVoucherForm({ ...voucherForm, minSpend: e.target.value })}
                    placeholder="0 = Tanpa syarat"
                    className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text font-mono focus:border-komazi-coral outline-none"
                  />
                </div>

                <div>
                  <label className="block text-komazi-muted font-bold mb-1 uppercase tracking-wider text-[10px]">
                    Maks. Diskon (Rp) {voucherForm.type === 'PERCENT' ? '*' : '(Opsional)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={voucherForm.maxDiscount}
                    onChange={(e) => setVoucherForm({ ...voucherForm, maxDiscount: e.target.value })}
                    placeholder="0 = Tanpa batas"
                    className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text font-mono focus:border-komazi-coral outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-komazi-muted font-bold mb-1 uppercase tracking-wider text-[10px]">
                    Kuota Klaim (Jumlah)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={voucherForm.quota}
                    onChange={(e) => setVoucherForm({ ...voucherForm, quota: e.target.value })}
                    placeholder="100"
                    className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text font-mono font-bold focus:border-komazi-coral outline-none"
                  />
                </div>

                <div>
                  <label className="block text-komazi-muted font-bold mb-1 uppercase tracking-wider text-[10px]">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    required
                    value={voucherForm.startDate}
                    onChange={(e) => setVoucherForm({ ...voucherForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
                  />
                </div>

                <div>
                  <label className="block text-komazi-muted font-bold mb-1 uppercase tracking-wider text-[10px]">
                    Tanggal Kedaluwarsa
                  </label>
                  <input
                    type="date"
                    required
                    value={voucherForm.endDate}
                    onChange={(e) => setVoucherForm({ ...voucherForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-komazi-muted font-bold mb-1 uppercase tracking-wider text-[10px]">
                  Deskripsi / Syarat & Ketentuan
                </label>
                <textarea
                  rows="2"
                  value={voucherForm.description}
                  onChange={(e) => setVoucherForm({ ...voucherForm, description: e.target.value })}
                  placeholder="Misal: Berlaku untuk semua minuman kopi dine in..."
                  className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-komazi-border">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={voucherForm.isActive}
                    onChange={(e) => setVoucherForm({ ...voucherForm, isActive: e.target.checked })}
                    className="rounded accent-komazi-coral w-4 h-4 cursor-pointer"
                  />
                  <span className="font-bold text-komazi-text">Langsung Aktifkan</span>
                </label>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsVoucherModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-text font-bold text-xs cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingVoucher}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-komazi-coral to-komazi-coral-dark hover:brightness-110 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-komazi-coral/20 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingVoucher ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                    <span>{editingVoucher ? 'Simpan Perubahan' : 'Buat Voucher'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Modal Tambah / Edit Preset Kasir */}
      {isPresetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl p-5 md:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-komazi-border pb-3">
              <h2 className="text-base font-black text-komazi-text flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span>{editingPreset ? 'Edit Preset Diskon Kasir' : 'Tambah Preset Diskon Kasir'}</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsPresetModalOpen(false)}
                className="text-komazi-muted hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitPreset} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-komazi-muted font-bold mb-1 uppercase tracking-wider text-[10px]">
                  Nama Preset Lengkap*
                </label>
                <input
                  type="text"
                  required
                  value={presetForm.name}
                  onChange={(e) => setPresetForm({ ...presetForm, name: e.target.value })}
                  placeholder="Misal: Diskon Karyawan Internal 20%"
                  className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-teal outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-komazi-muted font-bold mb-1 uppercase tracking-wider text-[10px]">
                  Label Singkat Tombol Kasir (Maks 16 Huruf)*
                </label>
                <input
                  type="text"
                  required
                  maxLength="16"
                  value={presetForm.shortLabel}
                  onChange={(e) => setPresetForm({ ...presetForm, shortLabel: e.target.value })}
                  placeholder="Misal: Karyawan 20%"
                  className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text font-bold focus:border-komazi-teal outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-komazi-muted font-bold mb-1 uppercase tracking-wider text-[10px]">
                    Tipe Diskon
                  </label>
                  <select
                    value={presetForm.type}
                    onChange={(e) => setPresetForm({ ...presetForm, type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text font-bold focus:border-komazi-teal outline-none"
                  >
                    <option value="PERCENT">Persentase (%)</option>
                    <option value="NOMINAL">Nominal Rupiah (Rp)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-komazi-muted font-bold mb-1 uppercase tracking-wider text-[10px]">
                    Nilai Diskon*
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={presetForm.value}
                    onChange={(e) => setPresetForm({ ...presetForm, value: e.target.value })}
                    placeholder={presetForm.type === 'PERCENT' ? 'Misal: 20' : 'Misal: 25000'}
                    className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text font-mono font-bold focus:border-komazi-teal outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-komazi-muted font-bold mb-1 uppercase tracking-wider text-[10px]">
                  Catatan / Keterangan Kasir
                </label>
                <textarea
                  rows="2"
                  value={presetForm.description}
                  onChange={(e) => setPresetForm({ ...presetForm, description: e.target.value })}
                  placeholder="Khusus staf yang sedang bertugas shift..."
                  className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-teal outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-komazi-border">
                <button
                  type="button"
                  onClick={() => setIsPresetModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-text font-bold text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPreset}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-komazi-teal to-komazi-teal-light hover:brightness-110 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-komazi-teal/20 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingPreset ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                  <span>{editingPreset ? 'Simpan Preset' : 'Tambah Preset'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Modal Konfirmasi Hapus */}
      <AlertModal
        isOpen={Boolean(itemToDelete)}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        title={itemToDelete?.type === 'voucher' ? 'Hapus Voucher Promo?' : 'Hapus Preset Diskon?'}
        message={
          itemToDelete?.type === 'voucher'
            ? `Apakah Anda yakin ingin menghapus voucher "${itemToDelete.data?.code}" (${itemToDelete.data?.name})? Tindakan ini tidak dapat dibatalkan.`
            : `Apakah Anda yakin ingin menghapus preset "${itemToDelete?.data?.name}"? Tombol ini tidak akan muncul lagi di kasir POS.`
        }
        confirmText="Ya, Hapus"
        cancelText="Batal"
        type="danger"
      />
    </div>
  );
}
