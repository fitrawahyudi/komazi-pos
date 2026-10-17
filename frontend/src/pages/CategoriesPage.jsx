import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePosStore } from '../store/posStore';
import { toast } from '../store/toastStore';
import api from '../services/api';
import {
  GripVertical,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  Plus,
  Search,
  X,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import AlertModal from '../components/ui/AlertModal';
import { scrollInputIntoViewOnFocus } from '../utils/keyboard';

export default function CategoriesPage() {
  const navigate = useNavigate();
  const {
    categories,
    products,
    isLoading,
    fetchCategories,
    fetchProducts,
    addCategory,
    updateCategory,
    deleteCategory,
  } = usePosStore();

  const [searchQuery, setSearchQuery] = useState('');

  // Drag and drop states (Fitur seret urutan)
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Modal states (Tambah / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', sortOrder: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete modal state
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Muat kategori & produk saat halaman dibuka
  useEffect(() => {
    fetchCategories().catch((err) => console.warn('Fetch categories notice:', err));
    fetchProducts().catch((err) => console.warn('Fetch products notice:', err));
  }, [fetchCategories, fetchProducts]);

  // Filter out pseudo category 'Semua' jika ada id === 1 atau id === 'all'
  const rawCategories = useMemo(() => {
    return categories
      .filter((c) => c.id !== 1 && c.id !== 'all')
      .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
  }, [categories]);

  // Helper hitung jumlah produk per kategori
  const getProductCount = (category) => {
    if (category._count?.products !== undefined) {
      return category._count.products;
    }
    return products.filter((p) => p.categoryId === category.id).length;
  };

  // Filter Kategori berdasarkan pencarian
  const filteredCategories = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return rawCategories;
    return rawCategories.filter((cat) => (cat.name || '').toLowerCase().includes(q));
  }, [rawCategories, searchQuery]);

  // Buka Modal Tambah
  const handleOpenAdd = () => {
    const nextOrder = rawCategories.length > 0
      ? Math.max(...rawCategories.map((c) => Number(c.sortOrder) || 0)) + 1
      : 1;

    setEditingCategory(null);
    setFormData({ name: '', description: '', sortOrder: String(nextOrder) });
    setIsModalOpen(true);
  };

  // Buka Modal Edit
  const handleOpenEdit = (cat) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name || '',
      description: cat.description || '',
      sortOrder: cat.sortOrder !== undefined ? String(cat.sortOrder) : '0',
    });
    setIsModalOpen(true);
  };

  // Simpan Form (Tambah / Edit)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Nama kategori wajib diisi');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCategory) {
        const res = await updateCategory(editingCategory.id, {
          name: formData.name.trim(),
          description: formData.description?.trim() || undefined,
          sortOrder: formData.sortOrder !== '' ? Number(formData.sortOrder) : 0,
        });
        if (res.success) {
          toast.success(`Kategori "${formData.name.trim()}" berhasil diperbarui!`);
          setIsModalOpen(false);
        } else {
          toast.error(res.message || 'Gagal memperbarui kategori');
        }
      } else {
        const res = await addCategory({
          name: formData.name.trim(),
          description: formData.description?.trim() || undefined,
          sortOrder: formData.sortOrder !== '' ? Number(formData.sortOrder) : 0,
        });
        if (res.success) {
          toast.success(`Kategori baru "${formData.name.trim()}" berhasil ditambahkan!`);
          setIsModalOpen(false);
        } else {
          toast.error(res.message || 'Gagal menambahkan kategori');
        }
      }
    } catch (err) {
      toast.error(err.message || 'Terjadi kesalahan saat menyimpan kategori');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tukar Urutan Kategori via Tombol Panah (Pindah Naik / Turun)
  const handleSwapOrder = async (index, direction) => {
    if (searchQuery.trim()) {
      toast.info('Reset pencarian terlebih dahulu untuk mengubah urutan kategori');
      return;
    }
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= filteredCategories.length) return;

    // Susun array baru dengan elemen yang ditukar
    const reordered = [...filteredCategories];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    // Optimistic store update seketika agar UI langsung responsif
    usePosStore.setState((state) => {
      const updatedCategories = state.categories.map((c) => {
        const foundIdx = reordered.findIndex((item) => item.id === c.id);
        if (foundIdx !== -1) {
          return { ...c, sortOrder: foundIdx + 1 };
        }
        return c;
      }).sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
      return { categories: updatedCategories };
    });

    try {
      await Promise.all(
        reordered.map((cat, newIdx) =>
          api.categories.update(cat.id, { sortOrder: newIdx + 1 })
        )
      );
      toast.success(`Urutan "${temp.name}" berhasil diubah`);
    } catch (err) {
      console.error('Failed to swap category order:', err);
      toast.error('Gagal memperbarui urutan kategori');
      fetchCategories();
    }
  };

  // Fitur Seret & Lepas (Drag & Drop Reorder)
  const handleDragStart = (e, index) => {
    if (searchQuery.trim()) {
      e.preventDefault();
      toast.info('Urutan hanya dapat diubah saat menampilkan semua kategori');
      return;
    }
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnter = (e, index) => {
    e.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();
    const rawData = e.dataTransfer.getData('text/plain');
    const sourceIndex = draggedIndex !== null ? draggedIndex : (rawData !== '' ? parseInt(rawData, 10) : null);

    setDraggedIndex(null);
    setDragOverIndex(null);

    if (sourceIndex === null || isNaN(sourceIndex) || sourceIndex === dropIndex) return;

    // Hitung susunan baru secara reorder array
    const reordered = [...filteredCategories];
    const [movedItem] = reordered.splice(sourceIndex, 1);
    reordered.splice(dropIndex, 0, movedItem);

    // Optimistic store update seketika agar UI terasa sangat responsif (60fps)
    usePosStore.setState((state) => {
      const updatedCategories = state.categories.map((c) => {
        const foundIdx = reordered.findIndex((item) => item.id === c.id);
        if (foundIdx !== -1) {
          return { ...c, sortOrder: foundIdx + 1 };
        }
        return c;
      }).sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
      return { categories: updatedCategories };
    });

    // Simpan urutan sortOrder baru ke database
    try {
      await Promise.all(
        reordered.map((cat, newIdx) =>
          api.categories.update(cat.id, { sortOrder: newIdx + 1 })
        )
      );
      toast.success(`Kategori "${movedItem.name}" berhasil dipindahkan ke urutan #${dropIndex + 1}!`);
    } catch (err) {
      console.error('Failed to sync reordered categories:', err);
      toast.error('Gagal menyimpan urutan kategori ke server');
      fetchCategories(); // Rollback jika ada kendala jaringan
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Konfirmasi Hapus
  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return;
    const count = getProductCount(categoryToDelete);
    if (count > 0) {
      toast.error(`Tidak dapat menghapus "${categoryToDelete.name}". Masih ada ${count} produk di kategori ini!`);
      setCategoryToDelete(null);
      return;
    }

    setIsDeleting(true);
    try {
      const res = await deleteCategory(categoryToDelete.id);
      if (res.success) {
        toast.success(`Kategori "${categoryToDelete.name}" berhasil dihapus.`);
        setCategoryToDelete(null);
      } else {
        toast.error(res.message || 'Gagal menghapus kategori');
      }
    } catch (err) {
      toast.error(err.message || 'Gagal menghapus kategori');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-6 space-y-5 max-w-7xl mx-auto select-none">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-komazi-text tracking-tight flex items-center gap-2">
            <span>Kategori</span>
          </h1>
          <p className="text-xs text-komazi-muted mt-0.5">
            Kelola kategori produk dan seret baris untuk mengatur urutan tampilan.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Input Pencarian */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-komazi-muted absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari kategori..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-44 sm:w-56 pl-8 pr-7 py-1.5 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text placeholder-komazi-muted/60 focus:border-komazi-coral focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-komazi-muted hover:text-white"
                title="Hapus pencarian"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Tombol Refresh */}
          <button
            type="button"
            onClick={() => {
              fetchCategories();
              fetchProducts();
              toast.info('Memperbarui kategori dari server...');
            }}
            disabled={isLoading}
            className="p-2 rounded-xl bg-komazi-surface border border-komazi-border text-komazi-muted hover:text-white transition-colors"
            title="Muat Ulang"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-komazi-coral' : ''}`} />
          </button>

          {/* Tombol Tambah Kategori */}
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 active:scale-95 whitespace-nowrap"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Tambah Kategori</span>
          </button>
        </div>
      </div>

      {/* 2. Main Category Table View (Sesuai Desain Referensi) */}
      <div className="rounded-2xl border border-komazi-border bg-komazi-surface/90 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-komazi-border bg-komazi-surface-2/40 text-komazi-muted text-xs font-semibold">
                <th className="py-3.5 pl-4 pr-1 w-24"></th>
                <th className="py-3.5 px-4 font-semibold text-komazi-muted text-xs">Nama Kategori</th>
                <th className="py-3.5 px-4 font-semibold text-komazi-muted text-xs">Deskripsi</th>
                <th className="py-3.5 px-4 font-semibold text-komazi-muted text-xs text-center w-32">Produk</th>
                <th className="py-3.5 pr-5 pl-2 w-20 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-komazi-border/60">
              {filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-komazi-muted">
                    <p className="font-semibold text-xs text-komazi-text">Belum ada kategori ditemukan</p>
                    <p className="text-[11px] text-komazi-muted mt-0.5">
                      {searchQuery
                        ? `Tidak ada kategori yang cocok dengan "${searchQuery}".`
                        : 'Klik tombol "+ Tambah Kategori" untuk membuat kategori baru.'}
                    </p>
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="mt-2 px-3 py-1.5 rounded-xl bg-komazi-surface-2 text-xs font-semibold text-komazi-coral hover:bg-komazi-border transition-colors inline-flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset Pencarian</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredCategories.map((cat, idx) => {
                  const productCount = getProductCount(cat);
                  const isFirst = idx === 0;
                  const isLast = idx === filteredCategories.length - 1;

                  return (
                    <tr
                      key={cat.id}
                      draggable={!searchQuery}
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnter={(e) => handleDragEnter(e, idx)}
                      onDrop={(e) => handleDrop(e, idx)}
                      onDragEnd={handleDragEnd}
                      className={`border-b transition-all duration-150 group select-none ${
                        draggedIndex === idx
                          ? 'opacity-30 bg-komazi-coral/10 border-dashed border-2 border-komazi-coral'
                          : dragOverIndex === idx
                          ? 'bg-komazi-surface-2 border-t-2 border-t-komazi-coral shadow-inner'
                          : 'border-komazi-border/60 hover:bg-komazi-surface-2/40'
                      }`}
                    >
                      {/* Left: Grip Dots & Move Up/Down Controls */}
                      <td className="py-3.5 pl-4 pr-1 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-komazi-muted">
                          <span
                            className={`p-1.5 rounded transition-colors ${
                              searchQuery
                                ? 'cursor-not-allowed opacity-30 text-komazi-muted'
                                : 'cursor-grab active:cursor-grabbing text-komazi-muted/70 hover:text-white hover:bg-komazi-surface-2'
                            }`}
                            title={searchQuery ? 'Urutan tidak dapat diubah saat pencarian aktif' : 'Tahan dan seret untuk memindahkan urutan kategori'}
                          >
                            <GripVertical className="w-4 h-4 pointer-events-none" />
                          </span>
                          <button
                            type="button"
                            draggable={false}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={() => handleSwapOrder(idx, 'up')}
                            disabled={isFirst || Boolean(searchQuery)}
                            className="p-1 rounded hover:bg-komazi-surface-2 text-komazi-muted hover:text-white disabled:opacity-20 disabled:hover:text-komazi-muted transition-colors"
                            title="Pindah Urutan Naik"
                            aria-label={`Pindah urutan ${cat.name} naik`}
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            draggable={false}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={() => handleSwapOrder(idx, 'down')}
                            disabled={isLast || Boolean(searchQuery)}
                            className="p-1 rounded hover:bg-komazi-surface-2 text-komazi-muted hover:text-white disabled:opacity-20 disabled:hover:text-komazi-muted transition-colors"
                            title="Pindah Urutan Turun"
                            aria-label={`Pindah urutan ${cat.name} turun`}
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Nama Kategori */}
                      <td className="py-3.5 px-4 font-bold text-sm text-komazi-text">
                        <span
                          className="hover:text-komazi-coral transition-colors cursor-pointer"
                          draggable={false}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={() => handleOpenEdit(cat)}
                          title="Klik untuk mengedit kategori"
                        >
                          {cat.name}
                        </span>
                      </td>

                      {/* Deskripsi */}
                      <td className="py-3.5 px-4 text-xs text-komazi-muted">
                        {cat.description || '—'}
                      </td>

                      {/* Produk (Navy / Dark-Blue Pill Badge) */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          draggable={false}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={() => navigate(`/menu?cat=${cat.id}`)}
                          className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full bg-[#13233c] hover:bg-[#1a3154] text-[#7dd3fc] font-bold text-xs border border-[#1e3a5f]/60 font-mono shadow-sm transition-colors"
                          title={`Lihat ${productCount} produk di kategori ini`}
                        >
                          {productCount}
                        </button>
                      </td>

                      {/* Right: Actions (Pencil & Trash) */}
                      <td className="py-3.5 pr-5 pl-2 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            draggable={false}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={() => handleOpenEdit(cat)}
                            className="p-1.5 rounded-lg text-komazi-muted hover:text-white hover:bg-komazi-surface-2 transition-colors"
                            title="Edit Kategori"
                            aria-label={`Edit kategori ${cat.name}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            draggable={false}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={() => setCategoryToDelete(cat)}
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Hapus Kategori"
                            aria-label={`Hapus kategori ${cat.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
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
      </div>

      {/* 3. Modal Tambah / Edit Kategori */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in flex items-center justify-center"
        >
          <div className="w-full max-w-md rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden my-auto">
            <div className="flex items-center justify-between p-4 border-b border-komazi-border bg-komazi-surface-2/60">
              <h3 className="font-bold text-sm text-komazi-text">
                {editingCategory ? 'Edit Kategori' : 'Tambah Kategori Baru'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-komazi-text mb-1">
                  Nama Kategori <span className="text-komazi-coral">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Pcs, Makanan, Minuman, Coffee..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  onFocus={scrollInputIntoViewOnFocus}
                  autoFocus
                  required
                  className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-komazi-text mb-1">
                  Deskripsi <span className="text-komazi-muted font-normal">(Opsional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Keterangan singkat kategori..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  onFocus={scrollInputIntoViewOnFocus}
                  className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-komazi-text mb-1">
                  Urutan Tampilan POS <span className="text-komazi-muted font-normal">(Angka)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="1, 2, 3..."
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                  onFocus={scrollInputIntoViewOnFocus}
                  className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-komazi-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-3.5 py-2 rounded-xl bg-komazi-surface-2 text-komazi-muted hover:text-white text-xs font-semibold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                >
                  {isSubmitting && <RefreshCw className="w-3 h-3 animate-spin" />}
                  <span>{editingCategory ? 'Simpan Perubahan' : 'Buat Kategori'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Alert Modal Konfirmasi Hapus */}
      <AlertModal
        isOpen={Boolean(categoryToDelete)}
        title={`Hapus Kategori "${categoryToDelete?.name || ''}"?`}
        message={
          categoryToDelete && getProductCount(categoryToDelete) > 0
            ? `Peringatan: Kategori ini masih memiliki ${getProductCount(categoryToDelete)} produk terdaftar. Anda harus menghapus atau memindahkan produk tersebut sebelum kategori ini dapat dihapus.`
            : 'Apakah Anda yakin ingin menghapus kategori ini? Kategori yang telah dihapus tidak dapat dipulihkan.'
        }
        confirmText={
          categoryToDelete && getProductCount(categoryToDelete) > 0
            ? 'Tutup'
            : isDeleting
            ? 'Menghapus...'
            : 'Ya, Hapus Kategori'
        }
        confirmVariant={categoryToDelete && getProductCount(categoryToDelete) > 0 ? 'secondary' : 'danger'}
        onConfirm={
          categoryToDelete && getProductCount(categoryToDelete) > 0
            ? () => setCategoryToDelete(null)
            : handleConfirmDelete
        }
        onCancel={() => setCategoryToDelete(null)}
      />
    </div>
  );
}
