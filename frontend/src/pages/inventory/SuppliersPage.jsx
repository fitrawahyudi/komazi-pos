import React, { useState, useMemo, useEffect } from 'react';
import { usePersistentState } from '../../hooks/usePersistentState';
import { useInventoryStore } from '../../store/inventoryStore';
import { toast } from '../../store/toastStore';
import {
  Truck,
  Plus,
  Search,
  X,
  Pencil,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Building2,
  CheckCircle2,
  XCircle,
  Filter,
  Check,
  Download,
  SlidersHorizontal,
} from 'lucide-react';
import AlertModal from '../../components/ui/AlertModal';
import Pagination from '../../components/ui/Pagination';

export default function SuppliersPage() {
  const { suppliers, addSupplier, updateSupplier, deleteSupplier, bulkDeleteSuppliers } = useInventoryStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = usePersistentState('suppliers_categoryFilter', 'ALL');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = usePersistentState('suppliers_itemsPerPage', 10);

  // Multi-Select State
  const [selectedSupplierIds, setSelectedSupplierIds] = useState([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    status: 'ACTIVE',
  });

  // Delete State
  const [supplierToDelete, setSupplierToDelete] = useState(null);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter]);

  // Kategori list unik
  const categoriesList = useMemo(() => {
    const setCat = new Set(suppliers.map((s) => s.category).filter(Boolean));
    return Array.from(setCat);
  }, [suppliers]);

  // Filtered Suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.contactPerson && s.contactPerson.toLowerCase().includes(q));
      const matchCat = categoryFilter === 'ALL' || s.category === categoryFilter;
      return matchQuery && matchCat;
    });
  }, [suppliers, searchQuery, categoryFilter]);

  // Paginated Suppliers
  const paginatedSuppliers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredSuppliers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSuppliers, currentPage, itemsPerPage]);

  // Multi-Select Handlers
  const isAllCurrentPageSelected = useMemo(() => {
    if (paginatedSuppliers.length === 0) return false;
    return paginatedSuppliers.every((sup) => selectedSupplierIds.includes(sup.id));
  }, [paginatedSuppliers, selectedSupplierIds]);

  const handleSelectAllToggle = () => {
    const pageIds = paginatedSuppliers.map((s) => s.id);
    if (isAllCurrentPageSelected) {
      setSelectedSupplierIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedSupplierIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleRowSelect = (id) => {
    setSelectedSupplierIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkStatusChange = (status) => {
    selectedSupplierIds.forEach((id) => {
      updateSupplier(id, { status });
    });
    toast.success(`Status ${selectedSupplierIds.length} pemasok diperbarui ke ${status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}.`);
  };

  const handleBulkExportCSV = () => {
    const target = suppliers.filter((s) => selectedSupplierIds.includes(s.id));
    if (target.length === 0) return;

    const headers = ['Kode', 'Nama Pemasok', 'Kategori', 'PIC', 'Telepon', 'Email', 'Alamat', 'Status'];
    const rows = target.map((s) => [
      s.code,
      `"${s.name.replace(/"/g, '""')}"`,
      `"${(s.category || '').replace(/"/g, '""')}"`,
      `"${(s.contactPerson || '').replace(/"/g, '""')}"`,
      s.phone || '',
      s.email || '',
      `"${(s.address || '').replace(/"/g, '""')}"`,
      s.status,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pemasok_terpilih_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`${target.length} pemasok diekspor ke CSV.`);
  };

  const handleConfirmBulkDelete = () => {
    if (bulkDeleteSuppliers) {
      bulkDeleteSuppliers(selectedSupplierIds);
    } else {
      selectedSupplierIds.forEach((id) => deleteSupplier(id));
    }
    toast.success(`${selectedSupplierIds.length} data pemasok berhasil dihapus.`);
    setSelectedSupplierIds([]);
    setIsBulkDeleteModalOpen(false);
  };

  // Form Handlers
  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setFormData({
      name: '',
      category: 'Bahan Baku',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      status: 'ACTIVE',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sup) => {
    setEditingSupplier(sup);
    setFormData({
      name: sup.name || '',
      category: sup.category || '',
      contactPerson: sup.contactPerson || '',
      phone: sup.phone || '',
      email: sup.email || '',
      address: sup.address || '',
      status: sup.status || 'ACTIVE',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Nama pemasok wajib diisi');
      return;
    }

    if (editingSupplier) {
      updateSupplier(editingSupplier.id, formData);
      toast.success(`Data pemasok "${formData.name}" berhasil diperbarui!`);
    } else {
      addSupplier(formData);
      toast.success(`Pemasok "${formData.name}" berhasil ditambahkan!`);
    }

    setIsModalOpen(false);
  };

  const handleConfirmDelete = () => {
    if (!supplierToDelete) return;
    deleteSupplier(supplierToDelete.id);
    setSelectedSupplierIds((prev) => prev.filter((id) => id !== supplierToDelete.id));
    toast.success(`Pemasok "${supplierToDelete.name}" telah dihapus.`);
    setSupplierToDelete(null);
  };

  return (
    <div className="p-4 sm:p-6 pb-28 lg:pb-6 space-y-6 max-w-7xl mx-auto select-none">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-komazi-coral/15 border border-komazi-coral/30 flex items-center justify-center text-komazi-coral">
              <Truck className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-komazi-text tracking-tight">
              Pemasok
            </h1>
          </div>
          <p className="text-xs text-komazi-muted mt-1">
            Kelola pemasok produk Anda
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="px-4 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold shadow-md transition-all flex items-center gap-2 active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Tambah Pemasok</span>
        </button>
      </div>

      {/* 2. Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-komazi-coral/10 text-komazi-coral flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-komazi-muted font-medium">Total Pemasok</div>
            <div className="text-lg font-black text-komazi-text">{suppliers.length} Vendor</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-komazi-muted font-medium">Pemasok Aktif</div>
            <div className="text-lg font-black text-emerald-400">
              {suppliers.filter((s) => s.status === 'ACTIVE').length} Vendor
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
            <Filter className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-komazi-muted font-medium">Kategori Pasokan</div>
            <div className="text-lg font-black text-amber-400">{categoriesList.length} Jenis</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-komazi-muted font-medium">Nonaktif / Pending</div>
            <div className="text-lg font-black text-komazi-text">
              {suppliers.filter((s) => s.status !== 'ACTIVE').length} Vendor
            </div>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-komazi-muted absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari kode, nama vendor, atau kontak PIC..."
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

        {/* Filter Kategori */}
        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter kategori pemasok"
            className="px-3 py-2 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
          >
            <option value="ALL">Semua Kategori</option>
            {categoriesList.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. Table View with Checkboxes and Pagination */}
      <div className="rounded-2xl border border-komazi-border bg-komazi-surface/90 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-komazi-border bg-komazi-surface-2/40 text-komazi-muted font-semibold">
                <th className="py-3.5 pl-4 pr-2 w-10 text-center">
                  <input
                    type="checkbox"
                    aria-label="Pilih semua pemasok di halaman ini"
                    checked={isAllCurrentPageSelected}
                    onChange={handleSelectAllToggle}
                    className="w-4 h-4 rounded text-komazi-coral accent-komazi-coral cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-3">Kode</th>
                <th className="py-3.5 px-4">Nama Pemasok</th>
                <th className="py-3.5 px-4">Kategori Pasokan</th>
                <th className="py-3.5 px-4">Kontak PIC</th>
                <th className="py-3.5 px-4">Alamat</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 pr-4 pl-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-komazi-border/60">
              {paginatedSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-komazi-muted">
                    <p className="font-semibold text-xs text-komazi-text">Belum ada data pemasok ditemukan</p>
                    <p className="text-[11px] text-komazi-muted mt-1">
                      {searchQuery
                        ? `Tidak ada pemasok yang cocok dengan "${searchQuery}".`
                        : 'Klik "+ Tambah Pemasok" untuk menambahkan vendor baru.'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedSuppliers.map((sup) => {
                  const isSelected = selectedSupplierIds.includes(sup.id);

                  return (
                    <tr
                      key={sup.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-komazi-coral/10 hover:bg-komazi-coral/15' : 'hover:bg-komazi-surface-2/40'
                      }`}
                    >
                      <td className="py-3.5 pl-4 pr-2 text-center">
                        <input
                          type="checkbox"
                          aria-label={`Pilih pemasok ${sup.name}`}
                          checked={isSelected}
                          onChange={() => handleRowSelect(sup.id)}
                          className="w-4 h-4 rounded text-komazi-coral accent-komazi-coral cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-komazi-coral">
                        {sup.code}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-komazi-text text-sm">
                        {sup.name}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-komazi-surface-2 text-komazi-text border border-komazi-border">
                          {sup.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-komazi-muted">
                        <div className="font-medium text-komazi-text">{sup.contactPerson}</div>
                        <div className="flex items-center gap-1.5 text-[11px] mt-0.5">
                          <Phone className="w-3 h-3 text-emerald-400" />
                          <span>{sup.phone}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-komazi-muted text-[11px] max-w-xs truncate" title={sup.address}>
                        {sup.address}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {sup.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 pr-4 pl-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(sup)}
                            className="p-1.5 rounded-lg text-komazi-muted hover:text-white hover:bg-komazi-surface-2 transition-colors"
                            title="Edit Data Pemasok"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSupplierToDelete(sup)}
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Hapus Pemasok"
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

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredSuppliers.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
          itemsPerPageOptions={[5, 10, 20, 50]}
          itemLabel="pemasok"
        />
      </div>

      {/* Floating Multi-Select Action Bar */}
      {selectedSupplierIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-3xl w-[92%] sm:w-auto bg-komazi-surface/95 backdrop-blur-md border border-komazi-coral/40 shadow-2xl shadow-black/70 rounded-2xl p-2.5 sm:px-4 sm:py-3 flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-start gap-2 sm:gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl bg-komazi-coral/20 border border-komazi-coral/40 text-komazi-coral text-xs font-bold whitespace-nowrap flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>{selectedSupplierIds.length} Pemasok Terpilih</span>
            </span>
            <button
              type="button"
              onClick={() => setSelectedSupplierIds([])}
              className="text-[11px] text-komazi-muted hover:text-white underline px-1"
            >
              Batalkan
            </button>
          </div>

          <div className="h-4 w-px bg-komazi-border hidden sm:block" />

          <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => handleBulkStatusChange('ACTIVE')}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all flex items-center gap-1 active:scale-95"
              title="Set status Aktif untuk pemasok terpilih"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Set Aktif</span>
            </button>

            <button
              type="button"
              onClick={() => handleBulkStatusChange('INACTIVE')}
              className="px-2.5 py-1.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-muted hover:text-white border border-komazi-border text-xs font-semibold transition-all flex items-center gap-1 active:scale-95"
              title="Set status Nonaktif untuk pemasok terpilih"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Set Nonaktif</span>
            </button>

            <button
              type="button"
              onClick={handleBulkExportCSV}
              className="px-2.5 py-1.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-text border border-komazi-border text-xs font-semibold transition-all flex items-center gap-1 active:scale-95"
              title="Ekspor pemasok terpilih ke format CSV"
            >
              <Download className="w-3.5 h-3.5 text-komazi-coral" />
              <span>Ekspor CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-xs font-semibold transition-all flex items-center gap-1 active:scale-95"
              title="Hapus pemasok terpilih secara massal"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Terpilih</span>
            </button>
          </div>
        </div>
      )}

      {/* 5. Modal Tambah / Edit Pemasok */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-komazi-surface border border-komazi-border p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-komazi-border pb-3">
              <h3 className="text-base font-bold text-komazi-text flex items-center gap-2">
                <Truck className="w-5 h-5 text-komazi-coral" />
                <span>{editingSupplier ? 'Edit Data Pemasok' : 'Tambah Pemasok Baru'}</span>
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-komazi-muted font-medium mb-1">
                  Nama Pemasok / Perusahaan <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: PT Kopi Sangrai Nusantara"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-komazi-text focus:border-komazi-coral focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-komazi-muted font-medium mb-1">Kategori Pasokan</label>
                  <input
                    type="text"
                    placeholder="Biji Kopi, Dairy, Sirup..."
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-komazi-text focus:border-komazi-coral focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-komazi-muted font-medium mb-1">Nama PIC (Kontak)</label>
                  <input
                    type="text"
                    placeholder="Nama Sales / PIC"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-komazi-text focus:border-komazi-coral focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-komazi-muted font-medium mb-1">No. Telepon / WA</label>
                  <input
                    type="text"
                    placeholder="0812-xxxx-xxxx"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-komazi-text focus:border-komazi-coral focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-komazi-muted font-medium mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="sales@vendor.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-komazi-text focus:border-komazi-coral focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-komazi-muted font-medium mb-1">Alamat Gudang / Kantor</label>
                <textarea
                  rows={2}
                  placeholder="Alamat lengkap supplier..."
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-komazi-text focus:border-komazi-coral focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-komazi-muted font-medium mb-1">Status Kemitraan</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  aria-label="Status kemitraan pemasok"
                  className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-komazi-text focus:border-komazi-coral focus:outline-none"
                >
                  <option value="ACTIVE">Aktif (Bisa Terima Pesanan)</option>
                  <option value="INACTIVE">Nonaktif (Dihentikan Sementara)</option>
                </select>
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
                  {editingSupplier ? 'Simpan Perubahan' : 'Tambah Pemasok'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Alert Modal Hapus Satuan */}
      <AlertModal
        isOpen={Boolean(supplierToDelete)}
        title="Hapus Data Pemasok?"
        message={`Apakah Anda yakin ingin menghapus "${supplierToDelete?.name}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus Pemasok"
        cancelText="Batal"
        type="danger"
        onConfirm={handleConfirmDelete}
        onClose={() => setSupplierToDelete(null)}
      />

      {/* 7. Alert Modal Hapus Massal (Bulk Delete) */}
      <AlertModal
        isOpen={isBulkDeleteModalOpen}
        title="Hapus Pemasok Terpilih?"
        message={`Apakah Anda yakin ingin menghapus ${selectedSupplierIds.length} data pemasok yang dipilih? Tindakan ini tidak dapat dibatalkan.`}
        confirmText={`Hapus ${selectedSupplierIds.length} Pemasok`}
        cancelText="Batal"
        type="danger"
        onConfirm={handleConfirmBulkDelete}
        onClose={() => setIsBulkDeleteModalOpen(false)}
      />
    </div>
  );
}
