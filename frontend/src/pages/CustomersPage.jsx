import React, { useState, useMemo, useEffect } from 'react';
import { useCustomerStore } from '../store/customerStore';
import { usePersistentState } from '../hooks/usePersistentState';
import { formatRupiah } from '../utils/format';
import {
  Users,
  UserPlus,
  Search,
  Award,
  Crown,
  Sparkles,
  Phone,
  Mail,
  Trash2,
  Edit2,
  X,
  Check,
  Gift,
  RefreshCw,
  MessageCircle,
  ExternalLink,
  FileSpreadsheet,
  Filter,
  Calendar,
  ArrowUpDown,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import AlertModal from '../components/ui/AlertModal';
import Pagination from '../components/ui/Pagination';
import { toast } from '../store/toastStore';
import { scrollInputIntoViewOnFocus } from '../utils/keyboard';
import { exportToExcel } from '../utils/excel';

export default function CustomersPage() {
  const {
    customers,
    stats,
    isLoading,
    fetchCustomers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    redeemPoints,
  } = useCustomerStore();

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = usePersistentState('customers_tier', 'ALL');
  const [segmentFilter, setSegmentFilter] = usePersistentState('customers_segment', 'ALL'); // 'ALL' | 'LOYAL' | 'TOP_SPENDER' | 'HAS_POINTS' | 'NEW' | 'ZERO_ORDERS'
  const [periodFilter, setPeriodFilter] = usePersistentState('customers_period', 'ALL');   // 'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH'
  const [sortBy, setSortBy] = usePersistentState('customers_sortBy', 'recent');            // 'recent' | 'oldest' | 'points_desc' | 'points_asc' | 'spent_desc' | 'spent_asc' | 'visits_desc' | 'name_asc' | 'name_desc'

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [redeemCustomer, setRedeemCustomer] = useState(null);
  const [redeemPointsAmount, setRedeemPointsAmount] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    notes: '',
  });

  // Muat data pelanggan terbaru dari database MySQL secara otomatis
  useEffect(() => {
    // 1. Fetch data pelanggan terbaru saat halaman dimuat
    fetchCustomers().catch((err) => {
      console.warn('Gagal memuat pelanggan dari server:', err);
    });

    // 2. Auto-fetch saat tab/window browser kembali aktif (focus / visibility)
    const handleWindowActive = () => {
      if (document.visibilityState === 'visible') {
        fetchCustomers({ silent: true }).catch(() => {});
      }
    };

    // 3. Listener event real-time perubahan data pelanggan (cross-tab / POS checkout)
    const handleCustomersUpdated = () => {
      fetchCustomers({ silent: true }).catch(() => {});
    };

    // 4. Polling heartbeat otomatis setiap 15 detik saat tab Pelanggan aktif
    const heartbeatTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchCustomers({ silent: true }).catch(() => {});
      }
    }, 15000);

    window.addEventListener('focus', handleWindowActive);
    document.addEventListener('visibilitychange', handleWindowActive);
    window.addEventListener('komazi:customers-updated', handleCustomersUpdated);

    return () => {
      clearInterval(heartbeatTimer);
      window.removeEventListener('focus', handleWindowActive);
      document.removeEventListener('visibilitychange', handleWindowActive);
      window.removeEventListener('komazi:customers-updated', handleCustomersUpdated);
    };
  }, [fetchCustomers]);

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormData({ name: '', phone: '', email: '', notes: '' });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
      notes: customer.notes || '',
    });
    setIsAddModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) {
      toast.error('Nama dan No. WhatsApp wajib diisi');
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, formData);
        toast.success(`Data member "${formData.name}" berhasil diperbarui`);
      } else {
        await addCustomer(formData);
        toast.success(`Member baru "${formData.name}" berhasil ditambahkan (+10 Poin Selamat Datang!)`);
      }
      setIsAddModalOpen(false);
      // Sinkronisasi otomatis data pelanggan terbaru dari server
      fetchCustomers({ silent: true }).catch(() => {});
    } catch (err) {
      toast.error(err.message || 'Gagal menyimpan data pelanggan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmRedeem = async (e) => {
    e.preventDefault();
    if (!redeemCustomer) return;
    const amount = Number(redeemPointsAmount);
    if (amount <= 0 || amount > redeemCustomer.points) {
      toast.error('Jumlah poin tidak valid atau melebihi saldo member');
      return;
    }

    try {
      setIsSubmitting(true);
      await redeemPoints(redeemCustomer.id, amount, 'Penukaran reward kasir');
      toast.success(`Berhasil menukar ${amount} poin untuk member "${redeemCustomer.name}"!`);
      setRedeemCustomer(null);
      // Sinkronisasi otomatis data poin terbaru dari server
      fetchCustomers({ silent: true }).catch(() => {});
    } catch (err) {
      toast.error(err.message || 'Gagal menukar poin');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!customerToDelete) return;
    try {
      await deleteCustomer(customerToDelete.id);
      toast.success(`Member "${customerToDelete.name}" berhasil dihapus.`);
      setCustomerToDelete(null);
      // Sinkronisasi otomatis data pelanggan terbaru dari server
      fetchCustomers({ silent: true }).catch(() => {});
    } catch (err) {
      toast.error(err.message || 'Gagal menghapus member');
    }
  };


  const tierCounts = useMemo(() => {
    const cMap = { ALL: customers.length, SILVER: 0, GOLD: 0, PLATINUM: 0 };
    customers.forEach((c) => {
      const t = (c.tier || 'SILVER').toUpperCase();
      if (cMap[t] !== undefined) cMap[t]++;
    });
    return cMap;
  }, [customers]);

  const filtered = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const q = searchQuery.toLowerCase().trim();

    return customers
      .filter((c) => {
        // 1. Filter Tier
        if (selectedTier !== 'ALL' && (c.tier || 'SILVER').toUpperCase() !== selectedTier) {
          return false;
        }

        // 2. Filter Search
        if (q) {
          const matchName = (c.name || '').toLowerCase().includes(q);
          const matchPhone = (c.phone || '').includes(q);
          const matchEmail = (c.email || '').toLowerCase().includes(q);
          const matchNotes = (c.notes || '').toLowerCase().includes(q);
          if (!matchName && !matchPhone && !matchEmail && !matchNotes) return false;
        }

        // 3. Filter Segmentasi
        if (segmentFilter === 'LOYAL' && (c.visitCount || 0) < 3) return false;
        if (segmentFilter === 'TOP_SPENDER' && Number(c.totalSpent || 0) < 100000) return false;
        if (segmentFilter === 'HAS_POINTS' && (c.points || 0) <= 0) return false;
        if (segmentFilter === 'NEW' && (c.visitCount || 0) > 1) return false;
        if (segmentFilter === 'ZERO_ORDERS' && Number(c.totalSpent || 0) > 0) return false;

        // 4. Filter Periode Terdaftar
        if (periodFilter !== 'ALL') {
          const createdAtTime = c.createdAt ? new Date(c.createdAt).getTime() : 0;
          if (periodFilter === 'TODAY' && createdAtTime < startOfToday) return false;
          if (periodFilter === 'THIS_WEEK' && createdAtTime < sevenDaysAgo) return false;
          if (periodFilter === 'THIS_MONTH' && createdAtTime < startOfMonth) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // 5. Sorting
        if (sortBy === 'recent') {
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        }
        if (sortBy === 'oldest') {
          return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        }
        if (sortBy === 'points_desc') {
          return (b.points || 0) - (a.points || 0);
        }
        if (sortBy === 'points_asc') {
          return (a.points || 0) - (b.points || 0);
        }
        if (sortBy === 'spent_desc') {
          return Number(b.totalSpent || 0) - Number(a.totalSpent || 0);
        }
        if (sortBy === 'spent_asc') {
          return Number(a.totalSpent || 0) - Number(b.totalSpent || 0);
        }
        if (sortBy === 'visits_desc') {
          return (b.visitCount || 0) - (a.visitCount || 0);
        }
        if (sortBy === 'name_asc') {
          return (a.name || '').localeCompare(b.name || '');
        }
        if (sortBy === 'name_desc') {
          return (b.name || '').localeCompare(a.name || '');
        }
        return 0;
      });
  }, [customers, selectedTier, searchQuery, segmentFilter, periodFilter, sortBy]);

  const isFilterActive =
    selectedTier !== 'ALL' ||
    segmentFilter !== 'ALL' ||
    periodFilter !== 'ALL' ||
    sortBy !== 'recent' ||
    searchQuery.trim() !== '';

  const handleResetFilters = () => {
    setSelectedTier('ALL');
    setSegmentFilter('ALL');
    setPeriodFilter('ALL');
    setSortBy('recent');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handleExportExcel = () => {
    const targetData = filtered.length > 0 ? filtered : customers;
    if (!targetData || targetData.length === 0) {
      toast.error('Tidak ada data pelanggan untuk diekspor');
      return;
    }
    const dataToExport = targetData.map((c, idx) => ({
      'No': idx + 1,
      'Nama Member': c.name,
      'Nomor WhatsApp': c.phone,
      'Email': c.email || '-',
      'Tier Member': c.tier || 'SILVER',
      'Saldo Poin Loyalty': c.points || 0,
      'Total Belanja (Rp)': Number(c.totalSpent || 0),
      'Jumlah Kunjungan': c.visitCount || 0,
      'Catatan': c.notes || '-',
      'Terdaftar Sejak': c.createdAt ? new Date(c.createdAt).toLocaleDateString('id-ID') : '-',
    }));
    const dateStr = new Date().toISOString().split('T')[0];
    const suffix = isFilterActive ? '_terfilter' : '';
    exportToExcel(dataToExport, `data_member_loyalty_komazi_${dateStr}${suffix}.xlsx`, 'Member Loyalty');
    toast.success(`Berhasil mengekspor ${dataToExport.length} data member ke Excel!`);
  };

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = usePersistentState('customers_itemsPerPage', 10);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedTier, segmentFilter, periodFilter, sortBy]);

  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  const totalPoints = stats?.totalPoints || customers.reduce((sum, c) => sum + (c.points || 0), 0);
  const platinumCount = stats?.tierDistribution?.platinum ?? customers.filter((c) => c.tier === 'PLATINUM').length;
  const goldCount = stats?.tierDistribution?.gold ?? customers.filter((c) => c.tier === 'GOLD').length;

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-6 space-y-6 max-w-7xl mx-auto select-none">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display font-black text-2xl text-komazi-text flex items-center gap-2">
              <Users className="w-6 h-6 text-komazi-coral" />
              <span>Pelanggan</span>
            </h1>
          </div>
          <p className="text-xs text-komazi-muted mt-0.5">
            Kelola data pelanggan dan poin reward loyalty
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              fetchCustomers();
              toast.info('Memperbarui data pelanggan');
            }}
            disabled={isLoading}
            className="p-2 rounded-xl bg-komazi-surface border border-komazi-border text-komazi-muted hover:text-white transition-colors"
            title="Segarkan Data Pelanggan"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-komazi-coral' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-xl bg-komazi-surface border border-komazi-border hover:border-emerald-500/50 hover:text-emerald-400 text-komazi-text text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
            title="Ekspor Data Member ke Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Ekspor Excel</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 active:scale-95"
          >
            <UserPlus className="w-4 h-4 stroke-[3]" />
            <span>Tambah Pelanggan</span>
          </button>
        </div>
      </div>

      {/* 2. Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm">
          <p className="text-[11px] font-bold uppercase text-komazi-muted">Total Member</p>
          <p className="text-2xl font-black text-komazi-text mt-1">{stats?.totalCustomers || customers.length}</p>
          <p className="text-[10px] text-komazi-muted mt-0.5">Pelanggan terdaftar</p>
        </div>
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm">
          <p className="text-[11px] font-bold uppercase text-komazi-muted">Total Poin</p>
          <p className="text-2xl font-black font-mono text-komazi-coral mt-1">{totalPoints.toLocaleString()}</p>
          <p className="text-[10px] text-komazi-muted mt-0.5">1 Poin = Rp 10.000 belanja</p>
        </div>
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm">
          <p className="text-[11px] font-bold uppercase text-komazi-muted">Member VIP Gold</p>
          <p className="text-2xl font-black font-mono text-amber-400 mt-1">{goldCount}</p>
          <p className="text-[10px] text-komazi-muted mt-0.5">Saldo ≥ 200 Poin</p>
        </div>
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm">
          <p className="text-[11px] font-bold uppercase text-komazi-muted">Member Platinum</p>
          <p className="text-2xl font-black font-mono text-cyan-400 mt-1">{platinumCount}</p>
          <p className="text-[10px] text-komazi-muted mt-0.5">Saldo ≥ 500 Poin</p>
        </div>
      </div>

      {/* 3. Filters & Search Section */}
      <div className="space-y-3">
        {/* Row 1: Tier Tabs & Active Counter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {[
              { id: 'ALL', label: 'Semua Member', icon: Users, color: 'text-komazi-text' },
              { id: 'SILVER', label: 'Silver', icon: Award, color: 'text-slate-400' },
              { id: 'GOLD', label: 'Gold', icon: Crown, color: 'text-amber-400' },
              { id: 'PLATINUM', label: 'Platinum', icon: Sparkles, color: 'text-cyan-400' },
            ].map(({ id, label, icon: TierIcon, color }) => {
              const isSelected = selectedTier === id;
              const count = tierCounts[id] || 0;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedTier(id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-komazi-coral text-white shadow-sm'
                      : 'bg-komazi-surface text-komazi-muted hover:text-white border border-komazi-border hover:border-komazi-border/80'
                  }`}
                >
                  <TierIcon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : color}`} />
                  <span>{label}</span>
                  <span
                    className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-komazi-surface-2 text-komazi-muted border border-komazi-border'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick Counter & Reset All */}
          <div className="text-xs text-komazi-muted flex items-center justify-between sm:justify-end gap-2.5">
            <span>
              Menampilkan <strong className="text-komazi-text font-bold">{filtered.length}</strong> dari{' '}
              <strong className="text-komazi-text font-bold">{customers.length}</strong> pelanggan
            </span>
            {isFilterActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-komazi-coral hover:text-komazi-coral-dark bg-komazi-coral/10 hover:bg-komazi-coral/20 px-2.5 py-1 rounded-lg transition-colors active:scale-95"
                title="Reset semua filter ke kondisi awal"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filter</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Search Box & 3 Secondary Filter Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-komazi-muted absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari nama, WhatsApp, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text placeholder-komazi-muted/60 focus:border-komazi-coral focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-komazi-muted hover:text-white"
                title="Hapus kata kunci pencarian"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Segment Filter Dropdown */}
          <div className="relative">
            <Filter className="w-3.5 h-3.5 text-komazi-muted absolute left-3 top-2.5 pointer-events-none" />
            <select
              value={segmentFilter}
              onChange={(e) => setSegmentFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none appearance-none cursor-pointer"
            >
              <option value="ALL">Semua Segmentasi Pelanggan</option>
              <option value="LOYAL">Pelanggan Setia (≥3x Kunjungan)</option>
              <option value="TOP_SPENDER">Top Spender (≥ Rp 100.000)</option>
              <option value="HAS_POINTS">Memiliki Poin Tersedia (&gt; 0)</option>
              <option value="NEW">Member Baru (≤1x Kunjungan)</option>
              <option value="ZERO_ORDERS">Belum Pernah Belanja (Rp 0)</option>
            </select>
          </div>

          {/* Period Registered Dropdown */}
          <div className="relative">
            <Calendar className="w-3.5 h-3.5 text-komazi-muted absolute left-3 top-2.5 pointer-events-none" />
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none appearance-none cursor-pointer"
            >
              <option value="ALL">Semua Waktu Bergabung</option>
              <option value="TODAY">Terdaftar Hari Ini</option>
              <option value="THIS_WEEK">7 Hari Terakhir</option>
              <option value="THIS_MONTH">Bulan Ini</option>
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div className="relative">
            <ArrowUpDown className="w-3.5 h-3.5 text-komazi-muted absolute left-3 top-2.5 pointer-events-none" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none appearance-none cursor-pointer"
            >
              <option value="recent">Urutkan: Terbaru Terdaftar</option>
              <option value="oldest">Urutkan: Terlama Terdaftar</option>
              <option value="points_desc">Urutkan: Saldo Poin Tertinggi</option>
              <option value="points_asc">Urutkan: Saldo Poin Terendah</option>
              <option value="spent_desc">Urutkan: Total Belanja Terbanyak</option>
              <option value="spent_asc">Urutkan: Total Belanja Terendah</option>
              <option value="visits_desc">Urutkan: Kunjungan Terbanyak</option>
              <option value="name_asc">Urutkan: Nama (A - Z)</option>
              <option value="name_desc">Urutkan: Nama (Z - A)</option>
            </select>
          </div>
        </div>

        {/* Row 3: Active Filter Chips Bar */}
        {isFilterActive && (
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <span className="text-[11px] text-komazi-muted font-medium flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3 text-komazi-coral" />
              Filter aktif:
            </span>
            {selectedTier !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] bg-komazi-coral/15 text-komazi-coral border border-komazi-coral/30">
                Tier: {selectedTier}
                <button type="button" onClick={() => setSelectedTier('ALL')} className="hover:text-white">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            )}
            {segmentFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] bg-komazi-surface-2 text-komazi-text border border-komazi-border">
                Segmentasi:{' '}
                {segmentFilter === 'LOYAL'
                  ? 'Pelanggan Setia'
                  : segmentFilter === 'TOP_SPENDER'
                  ? 'Top Spender'
                  : segmentFilter === 'HAS_POINTS'
                  ? 'Punya Poin'
                  : segmentFilter === 'NEW'
                  ? 'Member Baru'
                  : 'Belum Belanja'}
                <button type="button" onClick={() => setSegmentFilter('ALL')} className="hover:text-komazi-coral">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            )}
            {periodFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] bg-komazi-surface-2 text-komazi-text border border-komazi-border">
                Periode:{' '}
                {periodFilter === 'TODAY'
                  ? 'Hari Ini'
                  : periodFilter === 'THIS_WEEK'
                  ? '7 Hari Terakhir'
                  : 'Bulan Ini'}
                <button type="button" onClick={() => setPeriodFilter('ALL')} className="hover:text-komazi-coral">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            )}
            {sortBy !== 'recent' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] bg-komazi-surface-2 text-komazi-text border border-komazi-border">
                Urut:{' '}
                {sortBy === 'points_desc'
                  ? 'Poin Terbanyak'
                  : sortBy === 'spent_desc'
                  ? 'Belanja Terbanyak'
                  : sortBy === 'visits_desc'
                  ? 'Kunjungan Terbanyak'
                  : sortBy === 'name_asc'
                  ? 'Nama A-Z'
                  : sortBy}
                <button type="button" onClick={() => setSortBy('recent')} className="hover:text-komazi-coral">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            )}
            {searchQuery.trim() && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] bg-komazi-surface-2 text-komazi-text border border-komazi-border">
                Cari: "{searchQuery}"
                <button type="button" onClick={() => setSearchQuery('')} className="hover:text-komazi-coral">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* 4. Customer Table */}
      <div className="rounded-2xl border border-komazi-border bg-komazi-surface overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-komazi-border bg-komazi-surface-2 text-komazi-muted font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Nama Pelanggan</th>
                <th className="py-3 px-4">Kontak (WhatsApp)</th>
                <th className="py-3 px-4 text-center">Tier Member</th>
                <th className="py-3 px-4 text-right">Saldo Poin</th>
                <th className="py-3 px-4 text-right">Total Belanja</th>
                <th className="py-3 px-4 text-center">Kunjungan</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-komazi-border">
              {isLoading && customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-komazi-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-komazi-coral" />
                      <p className="text-xs">Memuat data pelanggan...</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-komazi-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="w-8 h-8 text-komazi-muted/40" />
                      <p className="font-semibold text-xs text-komazi-text">Belum ada pelanggan ditemukan</p>
                      <p className="text-[11px] text-komazi-muted max-w-xs">
                        {isFilterActive
                          ? 'Tidak ada pelanggan yang cocok dengan kombinasi filter yang dipilih.'
                          : 'Klik "Tambah Pelanggan" untuk mendaftarkan member baru.'}
                      </p>
                      {isFilterActive && (
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="mt-1 px-3 py-1.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs font-semibold text-komazi-coral hover:bg-komazi-surface transition-all flex items-center gap-1.5 active:scale-95"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset Semua Filter</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((c) => {
                  const isPlatinum = c.tier === 'PLATINUM';
                  const isGold = c.tier === 'GOLD';
                  const cleanPhone = (c.phone || '').replace(/[-\s]/g, '');
                  const waNumber = cleanPhone.startsWith('0') ? `62${cleanPhone.slice(1)}` : cleanPhone;
                  const joinedDate = c.createdAt
                    ? new Date(c.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                    : c.joinedDate || '-';

                  return (
                    <tr key={c.id} className="hover:bg-komazi-surface-2/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-komazi-surface-2 border border-komazi-border flex items-center justify-center font-bold text-xs text-komazi-text">
                            {c.name ? c.name.charAt(0).toUpperCase() : '?'}
                          </div>
                          <div>
                            <p className="font-bold text-komazi-text">{c.name}</p>
                            <p className="text-[10px] text-komazi-muted">
                              Bergabung: {joinedDate}
                            </p>
                            {c.notes && (
                              <p className="text-[9px] text-komazi-teal-light italic max-w-xs truncate mt-0.5">
                                "{c.notes}"
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-komazi-text">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-success" />
                            <span>{c.phone}</span>
                          </div>
                          {cleanPhone && (
                            <a
                              href={`https://wa.me/${waNumber}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded-md bg-success/10 hover:bg-success/20 text-success transition-colors"
                              title="Chat WhatsApp Pelanggan"
                            >
                              <MessageCircle className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${isPlatinum
                              ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                              : isGold
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                : 'bg-komazi-surface-2 text-komazi-muted border-komazi-border'
                            }`}
                        >
                          {isPlatinum ? (
                            <Crown className="w-3 h-3" />
                          ) : isGold ? (
                            <Award className="w-3 h-3" />
                          ) : (
                            <Sparkles className="w-3 h-3" />
                          )}
                          <span>{c.tier}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-komazi-coral text-sm">
                        {c.points} pts
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-komazi-text">
                        {formatRupiah(Number(c.totalSpent) || 0)}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-komazi-muted">
                        {c.visitCount}x
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setRedeemCustomer(c);
                              setRedeemPointsAmount(Math.min(50, c.points));
                            }}
                            className="px-2 py-1 rounded-lg bg-komazi-surface-2 hover:bg-komazi-border text-komazi-teal-light text-[11px] font-bold border border-komazi-border flex items-center gap-1 transition-colors"
                            title="Tukar Poin Hadiah"
                          >
                            <Gift className="w-3 h-3" />
                            <span>Tukar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(c)}
                            className="p-1.5 rounded-lg text-komazi-muted hover:text-white hover:bg-komazi-surface-2 transition-colors"
                            title="Edit member"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setCustomerToDelete(c)}
                            className="p-1.5 rounded-lg text-komazi-muted hover:text-danger hover:bg-danger/10 transition-colors"
                            title="Hapus member"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <Pagination
          currentPage={currentPage}
          totalItems={filtered.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
          itemLabel="pelanggan"
        />
      </div>

      {/* Add / Edit Member Modal */}
      {isAddModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in"
        >
          <div className="min-h-full flex items-center justify-center">
            <div className="w-full max-w-md rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.5rem)] my-auto">
              <div className="flex items-center justify-between p-4 border-b border-komazi-border shrink-0 bg-komazi-surface">
                <h3 className="font-bold text-base text-komazi-text">
                  {editingCustomer ? 'Edit Data Member' : 'Tambah Member Baru'}
                </h3>
              </div>

              <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 flex-1 overflow-y-auto overscroll-contain">
                <div>
                  <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                    Nama Lengkap:
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    onFocus={scrollInputIntoViewOnFocus}
                    placeholder="Contoh: Rian Anggara"
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                    Nomor WhatsApp / HP:
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    onFocus={scrollInputIntoViewOnFocus}
                    placeholder="08xxxxxxxxxx"
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs font-mono text-komazi-text focus:border-komazi-coral focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                    Email (Opsional):
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    onFocus={scrollInputIntoViewOnFocus}
                    placeholder="nama@email.com"
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                    Catatan / Preferensi (Opsional):
                  </label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    onFocus={scrollInputIntoViewOnFocus}
                    placeholder="Contoh: Suka Kopi Less Sugar, langganan meeting room..."
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none resize-none"
                  />
                </div>

                <div className="pt-2 flex justify-between gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 rounded-xl bg-komazi-surface-2 text-komazi-muted hover:text-white font-semibold text-xs disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>{editingCustomer ? 'Simpan Perubahan' : 'Daftarkan Member'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Redeem Points Modal */}
      {redeemCustomer && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in"
        >
          <div className="min-h-full flex items-center justify-center">
            <div className="w-full max-w-sm rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.5rem)] my-auto">
              <div className="flex items-center justify-between p-4 border-b border-komazi-border shrink-0 bg-komazi-surface">
                <div className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-komazi-coral" />
                  <h3 className="font-bold text-sm text-komazi-text">Tukar Poin Member</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setRedeemCustomer(null)}
                  className="p-1 rounded-lg text-komazi-muted hover:text-white hover:bg-komazi-surface-2 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleConfirmRedeem} className="p-4 sm:p-5 space-y-3.5 flex-1 overflow-y-auto overscroll-contain">
                <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs space-y-1">
                  <p className="text-komazi-muted">Member:</p>
                  <p className="font-bold text-komazi-text text-sm">{redeemCustomer.name}</p>
                  <p className="font-mono text-komazi-coral font-bold">
                    Saldo Saat Ini: {redeemCustomer.points} Poin
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                    Jumlah Poin Ditukar:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={redeemCustomer.points}
                    value={redeemPointsAmount}
                    onChange={(e) => setRedeemPointsAmount(e.target.value)}
                    onFocus={scrollInputIntoViewOnFocus}
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-sm font-mono font-bold text-komazi-text focus:border-komazi-coral focus:outline-none"
                  />
                  <span className="text-[11px] text-komazi-muted mt-1 block">
                    Nilai Diskon: {formatRupiah(Number(redeemPointsAmount || 0) * 1000)}
                  </span>
                </div>

                <div className="pt-2 flex justify-between gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setRedeemCustomer(null)}
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 rounded-xl bg-komazi-surface-2 text-komazi-muted hover:text-white font-semibold text-xs disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || redeemCustomer.points <= 0}
                    className="flex-1 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark disabled:opacity-50 text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5"
                  >
                    {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Konfirmasi Tukar</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Alert Modal */}
      <AlertModal
        isOpen={!!customerToDelete}
        onClose={() => setCustomerToDelete(null)}
        onConfirm={handleDeleteConfirm}
        type="danger"
        title="Hapus Member Pelanggan?"
        message={`Apakah Anda yakin ingin menghapus "${customerToDelete?.name}" dari daftar member? Seluruh poin yang dimiliki akan hangus.`}
        confirmText="Ya, Hapus Member"
        cancelText="Batal"
      />
    </div>
  );
}
