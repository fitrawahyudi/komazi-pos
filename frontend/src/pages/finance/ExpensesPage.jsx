import React, { useState, useEffect, useMemo } from 'react';
import { useExpenseStore } from '../../store/expenseStore';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import { formatRupiah } from '../../utils/format';
import {
  Wallet,
  Plus,
  Search,
  Filter,
  Calendar,
  Layers,
  X,
  CheckCircle2,
  AlertCircle,
  FileText,
  UploadCloud,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit2,
  Ban,
  Trash2,
  ArrowUpRight,
  Receipt,
  Tag,
  Sparkles,
  Loader2,
  ExternalLink,
} from 'lucide-react';

const getLocalDateString = (d = new Date()) => {
  const dateObj = d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj.getTime())) return '';
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function ExpensesPage() {
  const { user } = useAuthStore();
  const {
    expenses,
    pagination,
    summary,
    categories,
    loading,
    categoriesLoading,
    fetchExpenses,
    fetchCategories,
    createExpense,
    updateExpense,
    cancelExpense,
    createCategory,
    updateCategory,
    deleteCategory,
  } = useExpenseStore();

  // Filter state
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [isCancelledFilter, setIsCancelledFilter] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return getLocalDateString(new Date(d.getFullYear(), d.getMonth(), 1));
  });
  const [endDate, setEndDate] = useState(() => getLocalDateString());

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancellingExpense, setCancellingExpense] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailExpense, setDetailExpense] = useState(null);

  // Form inputs
  const [formData, setFormData] = useState({
    date: getLocalDateString(),
    categoryId: '',
    description: '',
    amount: '',
    paymentMethod: 'CASH',
    paymentStatus: 'PAID',
    recipientVendor: '',
    notes: '',
    receiptUrl: '',
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New Category State
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  // Initial load
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchExpenses({
      page: 1,
      startDate,
      endDate,
      categoryId: selectedCategory,
      paymentStatus,
      isCancelled: isCancelledFilter,
      search,
    });
  }, [fetchExpenses, startDate, endDate, selectedCategory, paymentStatus, isCancelledFilter, search]);

  const handlePageChange = (newPage) => {
    fetchExpenses({
      page: newPage,
      startDate,
      endDate,
      categoryId: selectedCategory,
      paymentStatus,
      isCancelled: isCancelledFilter,
      search,
    });
  };

  const handleOpenCreate = () => {
    setEditingExpense(null);
    setFormData({
      date: getLocalDateString(),
      categoryId: categories[0]?.id || '',
      description: '',
      amount: '',
      paymentMethod: 'CASH',
      paymentStatus: 'PAID',
      recipientVendor: '',
      notes: '',
      receiptUrl: '',
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (exp) => {
    setEditingExpense(exp);
    setFormData({
      date: exp.date ? getLocalDateString(new Date(exp.date)) : getLocalDateString(),
      categoryId: exp.categoryId,
      description: exp.description,
      amount: exp.amount,
      paymentMethod: exp.paymentMethod,
      paymentStatus: exp.paymentStatus,
      recipientVendor: exp.recipientVendor || '',
      notes: exp.notes || '',
      receiptUrl: exp.receiptUrl || '',
    });
    setIsFormOpen(true);
  };

  const handleOpenCancel = (exp) => {
    setCancellingExpense(exp);
    setCancelReason('');
    setIsCancelModalOpen(true);
  };

  const handleOpenDetail = (exp) => {
    setDetailExpense(exp);
    setIsDetailModalOpen(true);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 5MB');
      return;
    }

    setUploadingImage(true);
    const fd = new FormData();
    fd.append('image', file);

    try {
      const token = localStorage.getItem('komazi-auth-token');
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: fd,
      });
      const data = await res.json();
      if (data.success && data.data?.url) {
        setFormData((prev) => ({ ...prev, receiptUrl: data.data.url }));
        toast.success('Bukti transaksi berhasil diunggah');
      } else {
        toast.error(data.message || 'Gagal mengunggah gambar');
      }
    } catch (err) {
      toast.error('Terjadi kesalahan saat mengunggah bukti');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.description.trim()) {
      toast.error('Deskripsi pengeluaran wajib diisi');
      return;
    }
    const amt = parseFloat(formData.amount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Nominal biaya harus lebih besar dari 0');
      return;
    }
    if (!formData.categoryId) {
      toast.error('Pilih kategori biaya');
      return;
    }

    setSubmitting(true);
    try {
      if (editingExpense) {
        await updateExpense(editingExpense.id, {
          ...formData,
          amount: amt,
        });
      } else {
        await createExpense({
          ...formData,
          amount: amt,
        });
      }
      setIsFormOpen(false);
    } catch {
      // error handled in store
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmCancel = async (e) => {
    e.preventDefault();
    if (!cancelReason.trim()) {
      toast.error('Alasan pembatalan wajib diisi');
      return;
    }
    setSubmitting(true);
    try {
      await cancelExpense(cancellingExpense.id, cancelReason);
      setIsCancelModalOpen(false);
    } catch {
      // error handled in store
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await createCategory({ name: newCatName, description: newCatDesc });
      setNewCatName('');
      setNewCatDesc('');
    } catch {}
  };

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-6 space-y-6 max-w-7xl mx-auto select-none">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-komazi-coral/15 border border-komazi-coral/30 flex items-center justify-center text-komazi-coral">
              <Wallet className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-komazi-text tracking-tight flex items-center gap-2">
              <span>Biaya Operasional</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsCategoryModalOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-komazi-surface border border-komazi-border hover:border-komazi-coral text-komazi-text text-xs font-bold transition-all flex items-center gap-2 active:scale-95"
          >
            <Tag className="w-3.5 h-3.5 text-komazi-coral" />
            <span>Kategori Biaya</span>
          </button>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold shadow-md transition-all flex items-center gap-2 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Tambah Biaya</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-komazi-coral/10 text-komazi-coral flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-komazi-muted font-medium truncate">Total Pengeluaran</div>
            <div className="text-lg font-black text-komazi-text truncate">
              {formatRupiah(summary?.totalAmount || 0)}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-komazi-muted font-medium truncate">Sudah Dibayar</div>
            <div className="text-lg font-black text-emerald-400 truncate">
              {formatRupiah(summary?.paidAmount || 0)}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-komazi-muted font-medium truncate">Belum Dibayar</div>
            <div className="text-lg font-black text-amber-400 truncate">
              {formatRupiah(summary?.unpaidAmount || 0)}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-komazi-muted font-medium truncate">Kategori Terbesar</div>
            <div className="text-sm font-black text-purple-400 truncate">
              {summary?.byCategory?.[0]?.name || 'Belum Ada'}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filter Bar */}
      <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-komazi-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nomor nota, vendor, atau deskripsi..."
              className="w-full pl-9 pr-3 py-2 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs text-komazi-text focus:outline-none focus:border-komazi-coral transition-colors"
            />
          </div>

          {/* Kategori Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs text-komazi-text focus:outline-none focus:border-komazi-coral transition-colors cursor-pointer"
          >
            <option value="">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Status Bayar */}
          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            className="px-3 py-2 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs text-komazi-text focus:outline-none focus:border-komazi-coral transition-colors cursor-pointer"
          >
            <option value="">Semua Status Bayar</option>
            <option value="PAID">Lunas</option>
            <option value="UNPAID">Belum Dibayar</option>
          </select>

          {/* Status Batal */}
          <select
            value={isCancelledFilter}
            onChange={(e) => setIsCancelledFilter(e.target.value)}
            className="px-3 py-2 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs text-komazi-text focus:outline-none focus:border-komazi-coral transition-colors cursor-pointer"
          >
            <option value="">Status Aktif & Batal</option>
            <option value="false">Hanya Aktif</option>
            <option value="true">Hanya Dibatalkan</option>
          </select>

          {/* Date Picker */}
          <div className="flex items-center gap-1.5 text-xs text-komazi-muted">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs text-komazi-text focus:outline-none focus:border-komazi-coral"
            />
            <span>s/d</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs text-komazi-text focus:outline-none focus:border-komazi-coral"
            />
          </div>
        </div>
      </div>

      {/* 4. Data Table */}
      <div className="rounded-2xl bg-komazi-surface border border-komazi-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-komazi-border bg-komazi-surface-2/60 text-komazi-muted font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">No. Referensi</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4">Deskripsi</th>
                <th className="py-3 px-4 text-right">Nominal</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Pembuat</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-komazi-border/50 text-komazi-text font-medium">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-komazi-muted">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-komazi-coral" />
                    <span>Memuat data biaya operasional...</span>
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-komazi-muted space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-komazi-surface-2 flex items-center justify-center mx-auto text-komazi-muted">
                      <Receipt className="w-6 h-6" />
                    </div>
                    <div className="text-sm font-bold text-komazi-text">Belum ada data biaya operasional</div>
                    <p className="text-xs text-komazi-muted max-w-sm mx-auto">
                      Belum ada transaksi pengeluaran operasional yang tercatat untuk filter dan periode ini.
                    </p>
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr
                    key={exp.id}
                    className={`hover:bg-komazi-surface-2/40 transition-colors ${
                      exp.isCancelled ? 'opacity-50 line-through bg-danger/5' : ''
                    }`}
                  >
                    <td className="py-3 px-4 text-komazi-muted whitespace-nowrap">
                      {new Date(exp.date).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-komazi-coral whitespace-nowrap">
                      {exp.referenceNo}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-komazi-surface-2 border border-komazi-border text-[11px] font-medium text-komazi-text">
                        {exp.category?.name || 'Lainnya'}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate" title={exp.description}>
                      <div className="font-semibold text-komazi-text truncate">{exp.description}</div>
                      {exp.recipientVendor && (
                        <div className="text-[10px] text-komazi-muted truncate">
                          Vendor: {exp.recipientVendor}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap text-komazi-text">
                      {formatRupiah(exp.amount)}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {exp.isCancelled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-danger/15 text-danger border border-danger/30 text-[10px] font-bold">
                          <Ban className="w-3 h-3" />
                          <span>Dibatalkan</span>
                        </span>
                      ) : exp.paymentStatus === 'PAID' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Lunas ({exp.paymentMethod})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                          <AlertCircle className="w-3 h-3" />
                          <span>Belum Bayar</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-komazi-muted whitespace-nowrap">
                      {exp.createdBy?.name || '-'}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(exp)}
                          title="Lihat Detail"
                          className="p-1.5 rounded-lg hover:bg-komazi-surface-2 text-komazi-muted hover:text-komazi-text transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {!exp.isCancelled && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(exp)}
                              title="Edit Biaya"
                              className="p-1.5 rounded-lg hover:bg-komazi-surface-2 text-komazi-muted hover:text-amber-400 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenCancel(exp)}
                              title="Batalkan Biaya"
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
              Menampilkan {expenses.length} dari total {pagination.total} pengeluaran
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

      {/* 5. Modal Tambah / Edit Biaya */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-komazi-surface border border-komazi-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-komazi-border flex items-center justify-between bg-komazi-surface-2/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-komazi-coral/15 flex items-center justify-center text-komazi-coral">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-komazi-text">
                    {editingExpense ? 'Edit Biaya Operasional' : 'Catat Biaya Operasional Baru'}
                  </h3>
                  <p className="text-[11px] text-komazi-muted">
                    {editingExpense ? editingExpense.referenceNo : 'Masukkan rincian pengeluaran kedai'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 rounded-lg text-komazi-muted hover:text-komazi-text hover:bg-komazi-surface transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
              {/* Tanggal & Kategori */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-komazi-muted mb-1">
                    Tanggal Pengeluaran <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs text-komazi-text focus:outline-none focus:border-komazi-coral"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-komazi-muted mb-1">
                    Kategori Biaya <span className="text-danger">*</span>
                  </label>
                  <select
                    required
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full px-3 py-2 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs text-komazi-text focus:outline-none focus:border-komazi-coral"
                  >
                    <option value="" disabled>
                      Pilih Kategori
                    </option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Deskripsi */}
              <div>
                <label className="block text-xs font-bold text-komazi-muted mb-1">
                  Deskripsi Biaya <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Tagihan Listrik PLN Bulan Oktober"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs text-komazi-text focus:outline-none focus:border-komazi-coral"
                />
              </div>

              {/* Nominal & Format Rupiah Preview */}
              <div>
                <label className="block text-xs font-bold text-komazi-muted mb-1">
                  Nominal (Rp) <span className="text-danger">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-komazi-muted">
                    Rp
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    placeholder="0"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 bg-komazi-surface-2 border border-komazi-border rounded-xl text-sm font-mono font-bold text-komazi-text focus:outline-none focus:border-komazi-coral"
                  />
                </div>
                {formData.amount > 0 && (
                  <p className="text-[11px] font-mono text-komazi-coral mt-1">
                    Terbaca: {formatRupiah(formData.amount)}
                  </p>
                )}
              </div>

              {/* Metode & Status Bayar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-komazi-muted mb-1">
                    Metode Pembayaran
                  </label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs text-komazi-text focus:outline-none focus:border-komazi-coral"
                  >
                    <option value="CASH">Tunai</option>
                    <option value="TRANSFER">Transfer Bank</option>
                    <option value="QRIS">QRIS / E-Wallet</option>
                    <option value="OTHER">Lainnya</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-komazi-muted mb-1">
                    Status Pembayaran
                  </label>
                  <select
                    value={formData.paymentStatus}
                    onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value })}
                    className="w-full px-3 py-2 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs text-komazi-text focus:outline-none focus:border-komazi-coral"
                  >
                    <option value="PAID">Lunas</option>
                    <option value="UNPAID">Belum Dibayar</option>
                  </select>
                </div>
              </div>

              {/* Vendor & Catatan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-komazi-muted mb-1">
                    Penerima / Vendor (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Misal: PLN Persero, Toko Sumber Rejeki"
                    value={formData.recipientVendor}
                    onChange={(e) => setFormData({ ...formData, recipientVendor: e.target.value })}
                    className="w-full px-3 py-2 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs text-komazi-text focus:outline-none focus:border-komazi-coral"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-komazi-muted mb-1">
                    Catatan Tambahan
                  </label>
                  <input
                    type="text"
                    placeholder="Keterangan nota/petugas"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs text-komazi-text focus:outline-none focus:border-komazi-coral"
                  />
                </div>
              </div>

              {/* Upload Bukti Pembayaran / Nota */}
              <div>
                <label className="block text-xs font-bold text-komazi-muted mb-1">
                  Bukti Nota / Kuitansi (Opsional)
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 border-2 border-dashed border-komazi-border hover:border-komazi-coral/50 rounded-xl p-3 text-center cursor-pointer transition-colors bg-komazi-surface-2/40">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={uploadingImage}
                    />
                    <div className="flex items-center justify-center gap-2 text-xs text-komazi-muted">
                      {uploadingImage ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-komazi-coral" />
                          <span>Mengunggah bukti ke Cloudinary...</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-4 h-4 text-komazi-coral" />
                          <span>Pilih Foto Nota / Kuitansi (Max 5MB)</span>
                        </>
                      )}
                    </div>
                  </label>
                  {formData.receiptUrl && (
                    <a
                      href={formData.receiptUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-12 h-12 rounded-xl border border-komazi-border overflow-hidden shrink-0 relative group"
                    >
                      <img
                        src={formData.receiptUrl}
                        alt="Bukti Nota"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                        <ExternalLink className="w-4 h-4" />
                      </div>
                    </a>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-komazi-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl bg-komazi-surface border border-komazi-border text-xs font-bold text-komazi-muted hover:text-komazi-text transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploadingImage}
                  className="px-5 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingExpense ? 'Simpan Perubahan' : 'Catat Biaya'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal Pembatalan Biaya */}
      {isCancelModalOpen && cancellingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-komazi-surface border border-danger/40 rounded-2xl shadow-2xl overflow-hidden p-5 space-y-4">
            <div className="flex items-center gap-3 text-danger">
              <div className="w-10 h-10 rounded-xl bg-danger/15 flex items-center justify-center shrink-0">
                <Ban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-komazi-text">Batalkan Biaya Operasional</h3>
                <p className="text-[11px] text-komazi-muted">{cancellingExpense.referenceNo}</p>
              </div>
            </div>

            <p className="text-xs text-komazi-muted">
              Tindakan ini akan membatalkan pengeluaran sebesar{' '}
              <strong className="text-komazi-text">{formatRupiah(cancellingExpense.amount)}</strong>.
              Pengeluaran yang dibatalkan akan otomatis dikeluarkan dari perhitungan Laporan Laba Rugi
              dan tercatat dalam jejak audit.
            </p>

            <form onSubmit={handleConfirmCancel} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-komazi-muted mb-1">
                  Alasan Pembatalan <span className="text-danger">*</span>
                </label>
                <textarea
                  required
                  rows="3"
                  placeholder="Misal: Nota ganda / salah input kasir"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full p-2.5 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs text-komazi-text focus:outline-none focus:border-danger resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-komazi-surface border border-komazi-border text-xs font-bold text-komazi-muted"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-danger hover:bg-danger-dark text-white text-xs font-bold flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Konfirmasi Pembatalan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Modal Kelola Kategori */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-komazi-surface border border-komazi-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-komazi-border flex items-center justify-between bg-komazi-surface-2/50">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-komazi-coral" />
                <h3 className="font-bold text-sm text-komazi-text">Kategori Biaya Operasional</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1 rounded-lg text-komazi-muted hover:text-komazi-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Form Tambah Kategori */}
              <form onSubmit={handleCreateCategory} className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-2">
                <div className="text-xs font-bold text-komazi-text">Tambah Kategori Baru</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Nama Kategori (misal: Pajak & Retribusi)"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-komazi-surface border border-komazi-border rounded-xl text-xs text-komazi-text focus:outline-none focus:border-komazi-coral"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold"
                  >
                    Tambah
                  </button>
                </div>
              </form>

              {/* Daftar Kategori */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-komazi-muted uppercase tracking-wider text-[10px]">
                  Daftar Kategori Tersedia ({categories.length})
                </div>
                <div className="divide-y divide-komazi-border/50 rounded-xl border border-komazi-border overflow-hidden">
                  {categories.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 bg-komazi-surface-2/30 flex items-center justify-between hover:bg-komazi-surface-2/60 transition-colors"
                    >
                      <div>
                        <div className="text-xs font-bold text-komazi-text flex items-center gap-1.5">
                          <span>{c.name}</span>
                          {c.isDefault && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-komazi-surface border border-komazi-border text-komazi-muted">
                              Default
                            </span>
                          )}
                        </div>
                        {c.description && (
                          <div className="text-[10px] text-komazi-muted">{c.description}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-komazi-muted font-mono">
                          {c._count?.expenses || 0} nota
                        </span>
                        {!c.isDefault && (c._count?.expenses === 0 || !c._count?.expenses) && (
                          <button
                            type="button"
                            onClick={() => deleteCategory(c.id)}
                            className="p-1 rounded text-komazi-muted hover:text-danger transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. Modal Detail Biaya */}
      {isDetailModalOpen && detailExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-komazi-surface border border-komazi-border rounded-2xl shadow-2xl overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-komazi-border pb-3">
              <div>
                <h3 className="font-bold text-sm text-komazi-text">{detailExpense.description}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="p-1 text-komazi-muted hover:text-komazi-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-komazi-border/40">
                <span className="text-komazi-muted">Tanggal:</span>
                <span className="font-bold text-komazi-text">
                  {new Date(detailExpense.date).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-komazi-border/40">
                <span className="text-komazi-muted">Kategori:</span>
                <span className="font-bold text-komazi-text">{detailExpense.category?.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-komazi-border/40">
                <span className="text-komazi-muted">Nominal:</span>
                <span className="font-mono font-bold text-base text-komazi-coral">
                  {formatRupiah(detailExpense.amount)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-komazi-border/40">
                <span className="text-komazi-muted">Metode / Status:</span>
                <span className="font-bold text-komazi-text">
                  {detailExpense.paymentMethod} • {detailExpense.paymentStatus}
                </span>
              </div>
              {detailExpense.recipientVendor && (
                <div className="flex justify-between py-1 border-b border-komazi-border/40">
                  <span className="text-komazi-muted">Penerima / Vendor:</span>
                  <span className="font-bold text-komazi-text">{detailExpense.recipientVendor}</span>
                </div>
              )}
              {detailExpense.notes && (
                <div className="py-1">
                  <span className="text-komazi-muted block mb-1">Catatan:</span>
                  <p className="p-2 rounded-xl bg-komazi-surface-2 text-komazi-text text-[11px]">
                    {detailExpense.notes}
                  </p>
                </div>
              )}
              {detailExpense.isCancelled && (
                <div className="p-2.5 rounded-xl bg-danger/10 border border-danger/30 text-danger text-[11px]">
                  <strong>Dibatalkan pada:</strong>{' '}
                  {new Date(detailExpense.cancelledAt).toLocaleString('id-ID')}
                  <br />
                  <strong>Alasan:</strong> {detailExpense.cancelledReason}
                </div>
              )}
              {detailExpense.receiptUrl && (
                <div className="pt-2">
                  <span className="text-komazi-muted block mb-1">Bukti Kuitansi:</span>
                  <a
                    href={detailExpense.receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl overflow-hidden border border-komazi-border max-h-48"
                  >
                    <img
                      src={detailExpense.receiptUrl}
                      alt="Kuitansi"
                      className="w-full h-full object-cover"
                    />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
