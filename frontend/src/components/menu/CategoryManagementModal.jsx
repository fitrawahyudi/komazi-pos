import React, { useState } from 'react';
import { usePosStore } from '../../store/posStore';
import { toast } from '../../store/toastStore';
import { scrollInputIntoViewOnFocus } from '../../utils/keyboard';
import {
  Tag,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  RotateCcw,
  Layers,
  ArrowUpDown,
  UtensilsCrossed,
  AlertCircle,
  FolderPlus,
  CheckCircle2,
} from 'lucide-react';

export default function CategoryManagementModal({ isOpen, onClose }) {
  const { categories, products, addCategory, updateCategory, deleteCategory } = usePosStore();

  // Create state
  const [newName, setNewName] = useState('');
  const [newSortOrder, setNewSortOrder] = useState('');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editSortOrder, setEditSortOrder] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Delete state
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  if (!isOpen) return null;

  // Filter out pseudo category 'Semua' if id === 'all' or name === 'Semua'
  const editableCategories = categories.filter((c) => c.id !== 'all' && c.name?.toLowerCase() !== 'semua');

  const getProductCount = (category) => {
    if (category._count?.products !== undefined) {
      return category._count.products;
    }
    return products.filter((p) => p.categoryId === category.id).length;
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error('Nama kategori wajib diisi');
      return;
    }

    setIsSubmittingAdd(true);
    try {
      const res = await addCategory({
        name: newName.trim(),
        sortOrder: newSortOrder ? Number(newSortOrder) : undefined,
      });

      if (res.success) {
        toast.success(`Kategori "${newName.trim()}" berhasil ditambahkan!`);
        setNewName('');
        setNewSortOrder('');
      } else {
        toast.error(res.message || 'Gagal menambahkan kategori');
      }
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const handleStartEdit = (cat) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditSortOrder(cat.sortOrder !== undefined ? String(cat.sortOrder) : '0');
    setDeleteConfirmId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditSortOrder('');
  };

  const handleSaveEdit = async (id) => {
    if (!editName.trim()) {
      toast.error('Nama kategori tidak boleh kosong');
      return;
    }

    setIsSubmittingEdit(true);
    try {
      const res = await updateCategory(id, {
        name: editName.trim(),
        sortOrder: editSortOrder !== '' ? Number(editSortOrder) : 0,
      });

      if (res.success) {
        toast.success(`Kategori "${editName.trim()}" berhasil diperbarui!`);
        handleCancelEdit();
      } else {
        toast.error(res.message || 'Gagal memperbarui kategori');
      }
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleDelete = async (cat) => {
    const count = getProductCount(cat);
    if (count > 0) {
      toast.error(`Tidak dapat menghapus "${cat.name}". Masih ada ${count} menu di kategori ini!`);
      setDeleteConfirmId(null);
      return;
    }

    setIsSubmittingDelete(true);
    try {
      const res = await deleteCategory(cat.id);
      if (res.success) {
        toast.success(`Kategori "${cat.name}" berhasil dihapus.`);
        setDeleteConfirmId(null);
      } else {
        toast.error(res.message || 'Gagal menghapus kategori');
      }
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 select-none"
    >
      <div className="min-h-full flex items-center justify-center">
        <div className="w-full max-w-2xl bg-komazi-surface border border-komazi-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.5rem)] my-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-komazi-border bg-komazi-surface-2/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-komazi-coral/15 border border-komazi-coral/30 flex items-center justify-center text-komazi-coral">
              <Layers className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="font-bold text-base text-komazi-text flex items-center gap-2">
                <span>Kelola Kategori Menu</span>
              </h2>
              <p className="text-xs text-komazi-muted">
                Atur nama kelompok menu, urutan tampil pada kasir & POS
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-komazi-surface text-komazi-muted hover:text-white hover:bg-komazi-border transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
          {/* 1. Form Tambah Kategori Baru */}
          <div className="p-4 rounded-xl bg-komazi-surface-2 border border-komazi-border/80 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-komazi-text">
              <FolderPlus className="w-4 h-4 text-komazi-coral" />
              <span>Tambah Kategori Baru</span>
            </div>

            <form onSubmit={handleAddSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Nama Kategori (contoh: Mocktail, Pastry, Signature...)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onFocus={scrollInputIntoViewOnFocus}
                  className="w-full px-3 py-2 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text placeholder-komazi-muted focus:border-komazi-coral focus:outline-none"
                />
              </div>

              <div className="w-full sm:w-28">
                <input
                  type="number"
                  min="0"
                  placeholder="Urutan (opsional)"
                  value={newSortOrder}
                  onChange={(e) => setNewSortOrder(e.target.value)}
                  onFocus={scrollInputIntoViewOnFocus}
                  className="w-full px-3 py-2 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text placeholder-komazi-muted focus:border-komazi-coral focus:outline-none text-center font-mono"
                  title="Nomor urut tampilan di POS"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingAdd || !newName.trim()}
                className="px-4 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 min-h-[38px] active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>{isSubmittingAdd ? 'Menyimpan...' : 'Tambah'}</span>
              </button>
            </form>
          </div>

          {/* 2. Daftar Kategori yang Ada */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-komazi-muted px-1">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Daftar Kategori Menu</span>
              <span className="text-[11px]">Total: {editableCategories.length} kategori aktif</span>
            </div>

            {editableCategories.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-dashed border-komazi-border bg-komazi-surface-2/30">
                <Tag className="w-8 h-8 text-komazi-muted mx-auto mb-2 opacity-50" />
                <p className="text-xs font-semibold text-komazi-muted">Belum ada kategori kustom</p>
                <p className="text-[11px] text-komazi-muted/70 mt-0.5">
                  Tambahkan kategori pertama Anda menggunakan formulir di atas.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-komazi-border/50 border border-komazi-border rounded-xl bg-komazi-surface overflow-hidden">
                {editableCategories.map((cat, idx) => {
                  const productCount = getProductCount(cat);
                  const isEditing = editingId === cat.id;
                  const isConfirmingDelete = deleteConfirmId === cat.id;

                  return (
                    <div
                      key={cat.id}
                      className={`p-3 sm:p-3.5 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isEditing
                          ? 'bg-komazi-coral/5'
                          : isConfirmingDelete
                          ? 'bg-rose-500/10'
                          : 'hover:bg-komazi-surface-2/50'
                      }`}
                    >
                      {isEditing ? (
                        // Mode Edit
                        <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <div className="flex-1">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onFocus={scrollInputIntoViewOnFocus}
                              className="w-full px-3 py-1.5 rounded-lg bg-komazi-surface-2 border border-komazi-coral text-xs text-komazi-text font-bold focus:outline-none"
                              autoFocus
                            />
                          </div>
                          <div className="w-24">
                            <input
                              type="number"
                              min="0"
                              placeholder="Urutan"
                              value={editSortOrder}
                              onChange={(e) => setEditSortOrder(e.target.value)}
                              onFocus={scrollInputIntoViewOnFocus}
                              className="w-full px-3 py-1.5 rounded-lg bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text font-mono text-center focus:border-komazi-coral focus:outline-none"
                              title="Nomor urut kategori"
                            />
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(cat.id)}
                              disabled={isSubmittingEdit || !editName.trim()}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 transition-all active:scale-95"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Simpan</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="px-3 py-1.5 rounded-lg bg-komazi-surface-2 hover:bg-komazi-border text-komazi-muted text-xs font-semibold transition-colors"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      ) : isConfirmingDelete ? (
                        // Mode Konfirmasi Hapus
                        <div className="flex-1 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-rose-400 text-xs">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>
                              Yakin ingin menghapus kategori <strong>"{cat.name}"</strong>?
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleDelete(cat)}
                              disabled={isSubmittingDelete}
                              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all active:scale-95"
                            >
                              {isSubmittingDelete ? 'Menghapus...' : 'Ya, Hapus'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-3 py-1.5 rounded-lg bg-komazi-surface-2 hover:bg-komazi-border text-komazi-muted text-xs font-semibold transition-colors"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Mode Tampilan Normal
                        <>
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-6 h-6 rounded-lg bg-komazi-surface-2 text-komazi-muted font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                              {cat.sortOrder !== undefined ? cat.sortOrder : idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-komazi-text truncate">
                                {cat.name}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-komazi-muted">
                                  ID: {cat.id}
                                </span>
                                <span className="text-neutral-600">•</span>
                                <span
                                  className={`text-[10px] font-medium px-2 py-0.2 rounded-full border ${
                                    productCount > 0
                                      ? 'bg-komazi-teal/10 text-komazi-teal-light border-komazi-teal/20'
                                      : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                                  }`}
                                >
                                  {productCount} Menu Terdaftar
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(cat)}
                              className="p-1.5 rounded-lg text-komazi-muted hover:text-komazi-text hover:bg-komazi-surface-2 transition-colors"
                              title="Edit nama atau urutan kategori"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (productCount > 0) {
                                  toast.error(
                                    `Kategori "${cat.name}" masih memiliki ${productCount} menu. Pindahkan produk terlebih dahulu!`
                                  );
                                } else {
                                  setDeleteConfirmId(cat.id);
                                }
                              }}
                              className={`p-1.5 rounded-lg transition-colors ${
                                productCount > 0
                                  ? 'text-neutral-600 hover:text-neutral-400 cursor-not-allowed'
                                  : 'text-komazi-muted hover:text-rose-400 hover:bg-rose-500/10'
                              }`}
                              title={
                                productCount > 0
                                  ? `Tidak dapat dihapus (${productCount} menu terkait)`
                                  : 'Hapus kategori ini'
                              }
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-komazi-border bg-komazi-surface flex items-center justify-between gap-2 shrink-0">
          <p className="text-[11px] text-komazi-muted">
            * Perubahan kategori otomatis tersinkronisasi ke katalog kasir POS & laporan penjualan.
          </p>
        </div>
      </div>
    </div>
  </div>
);
}
