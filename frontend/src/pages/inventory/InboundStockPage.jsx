import React, { useState, useMemo, useEffect } from 'react';
import { usePersistentState } from '../../hooks/usePersistentState';
import { useInventoryStore } from '../../store/inventoryStore';
import { useStockStore } from '../../store/stockStore';
import { toast } from '../../store/toastStore';
import { formatRupiah } from '../../utils/format';
import {
  PackagePlus,
  Plus,
  Search,
  X,
  Calendar,
  FileText,
  Truck,
  CheckCircle2,
  Clock,
  Boxes,
  Trash2,
  Check,
  Download,
  Eye,
} from 'lucide-react';
import AlertModal from '../../components/ui/AlertModal';
import Pagination from '../../components/ui/Pagination';

export default function InboundStockPage() {
  const { inboundRecords, suppliers, addInboundRecord, deleteInboundRecord, bulkDeleteInboundRecords } =
    useInventoryStore();
  const { ingredients } = useStockStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = usePersistentState('inbound_statusFilter', 'ALL');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = usePersistentState('inbound_itemsPerPage', 10);

  // Multi-Select State
  const [selectedRecordIds, setSelectedRecordIds] = useState([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);

  // Detail Modal State
  const [selectedRecordDetail, setSelectedRecordDetail] = useState(null);

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    supplierId: '',
    date: new Date().toISOString().split('T')[0],
    receivedBy: 'Manager',
    notes: '',
    items: [{ name: '', qty: 1, unit: 'kg', unitCost: 0 }],
  });

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return inboundRecords.filter((rec) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQ =
        !q ||
        rec.inboundNumber.toLowerCase().includes(q) ||
        rec.supplierName.toLowerCase().includes(q) ||
        (rec.notes && rec.notes.toLowerCase().includes(q));
      const matchStatus = statusFilter === 'ALL' || rec.status === statusFilter;
      return matchQ && matchStatus;
    });
  }, [inboundRecords, searchQuery, statusFilter]);

  // Paginated records
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRecords, currentPage, itemsPerPage]);

  // Total Nilai Pengadaan
  const totalInboundValue = useMemo(() => {
    return inboundRecords.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0);
  }, [inboundRecords]);

  // Multi-Select Handlers
  const isAllCurrentPageSelected = useMemo(() => {
    if (paginatedRecords.length === 0) return false;
    return paginatedRecords.every((rec) => selectedRecordIds.includes(rec.id));
  }, [paginatedRecords, selectedRecordIds]);

  const handleSelectAllToggle = () => {
    const pageIds = paginatedRecords.map((r) => r.id);
    if (isAllCurrentPageSelected) {
      setSelectedRecordIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedRecordIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleRowSelect = (id) => {
    setSelectedRecordIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkExportCSV = () => {
    const target = inboundRecords.filter((r) => selectedRecordIds.includes(r.id));
    if (target.length === 0) return;

    const headers = ['No. Masuk', 'Tanggal', 'Pemasok', 'Penerima', 'Total Nilai (Rp)', 'Status', 'Catatan'];
    const rows = target.map((r) => [
      r.inboundNumber,
      r.date,
      `"${(r.supplierName || '').replace(/"/g, '""')}"`,
      `"${(r.receivedBy || '').replace(/"/g, '""')}"`,
      r.totalAmount || 0,
      r.status,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `stok_masuk_terpilih_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`${target.length} catatan stok masuk diekspor ke CSV.`);
  };

  const handleConfirmBulkDelete = () => {
    if (bulkDeleteInboundRecords) {
      bulkDeleteInboundRecords(selectedRecordIds);
    } else {
      selectedRecordIds.forEach((id) => deleteInboundRecord && deleteInboundRecord(id));
    }
    toast.success(`${selectedRecordIds.length} riwayat stok masuk berhasil dihapus.`);
    setSelectedRecordIds([]);
    setIsBulkDeleteModalOpen(false);
  };

  const handleConfirmSingleDelete = () => {
    if (!recordToDelete) return;
    if (deleteInboundRecord) {
      deleteInboundRecord(recordToDelete.id);
    }
    setSelectedRecordIds((prev) => prev.filter((id) => id !== recordToDelete.id));
    toast.success(`Riwayat ${recordToDelete.inboundNumber} berhasil dihapus.`);
    setRecordToDelete(null);
  };

  // Form Handlers
  const handleOpenAdd = () => {
    setFormData({
      supplierId: suppliers[0]?.id || '',
      date: new Date().toISOString().split('T')[0],
      receivedBy: 'Manager',
      notes: '',
      items: [{ name: ingredients[0]?.name || '', qty: 1, unit: ingredients[0]?.unit || 'kg', unitCost: 0 }],
    });
    setIsModalOpen(true);
  };

  const handleAddItemRow = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { name: '', qty: 1, unit: 'kg', unitCost: 0 }],
    });
  };

  const handleRemoveItemRow = (idx) => {
    if (formData.items.length <= 1) return;
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== idx),
    });
  };

  const handleItemChange = (idx, field, value) => {
    const updated = [...formData.items];
    updated[idx][field] = value;
    // Auto-fill unit if selecting from ingredients
    if (field === 'name') {
      const found = ingredients.find((i) => i.name === value);
      if (found) {
        updated[idx].unit = found.unit;
        updated[idx].unitCost = Number(found.costPerUnit) || 0;
      }
    }
    setFormData({ ...formData, items: updated });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const selectedSupplier = suppliers.find((s) => s.id === Number(formData.supplierId));
    const totalAmount = formData.items.reduce(
      (sum, item) => sum + (Number(item.qty) || 0) * (Number(item.unitCost) || 0),
      0
    );

    const record = {
      supplierId: selectedSupplier ? selectedSupplier.id : null,
      supplierName: selectedSupplier ? selectedSupplier.name : 'Pemasok Umum',
      date: formData.date,
      receivedBy: formData.receivedBy || 'Staff',
      notes: formData.notes,
      totalAmount,
      items: formData.items.map((i) => ({
        name: i.name,
        qty: Number(i.qty) || 0,
        unit: i.unit,
        unitCost: Number(i.unitCost) || 0,
        subtotal: (Number(i.qty) || 0) * (Number(i.unitCost) || 0),
      })),
    };

    addInboundRecord(record);
    toast.success('Penerimaan stok masuk berhasil dicatat!');
    setIsModalOpen(false);
  };

  return (
    <div className="p-4 sm:p-6 pb-28 lg:pb-6 space-y-6 max-w-7xl mx-auto select-none">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-komazi-coral/15 border border-komazi-coral/30 flex items-center justify-center text-komazi-coral">
              <PackagePlus className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-komazi-text tracking-tight">
              Stok Masuk
            </h1>
          </div>
          <p className="text-xs text-komazi-muted mt-1">
            Lacak stok yang diterima ke inventaris
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="px-4 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold shadow-md transition-all flex items-center gap-2 active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Catat Barang Masuk</span>
        </button>
      </div>

      {/* 2. Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-komazi-coral/10 text-komazi-coral flex items-center justify-center shrink-0">
            <PackagePlus className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-komazi-muted font-medium">Total Penerimaan</div>
            <div className="text-lg font-black text-komazi-text">{inboundRecords.length} Transaksi</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-komazi-muted font-medium">Nilai Pengadaan</div>
            <div className="text-lg font-black text-emerald-400">{formatRupiah(totalInboundValue)}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-komazi-muted font-medium">Pemasok Terdaftar</div>
            <div className="text-lg font-black text-amber-400">{suppliers.length} Vendor</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-komazi-muted font-medium">Status Pengiriman</div>
            <div className="text-lg font-black text-komazi-text">100% Selesai</div>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-komazi-muted absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari nomor penerimaan, pemasok, atau catatan..."
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

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter status penerimaan stok masuk"
            className="px-3 py-2 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
          >
            <option value="ALL">Semua Status</option>
            <option value="COMPLETED">Selesai (Completed)</option>
            <option value="PENDING">Menunggu Verifikasi</option>
          </select>
        </div>
      </div>

      {/* 4. Table View with Checkboxes & Pagination */}
      <div className="rounded-2xl border border-komazi-border bg-komazi-surface/90 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-komazi-border bg-komazi-surface-2/40 text-komazi-muted font-semibold">
                <th className="py-3.5 pl-4 pr-2 w-10 text-center">
                  <input
                    type="checkbox"
                    aria-label="Pilih semua stok masuk di halaman ini"
                    checked={isAllCurrentPageSelected}
                    onChange={handleSelectAllToggle}
                    className="w-4 h-4 rounded text-komazi-coral accent-komazi-coral cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-3">No. Masuk</th>
                <th className="py-3.5 px-4">Tanggal</th>
                <th className="py-3.5 px-4">Pemasok</th>
                <th className="py-3.5 px-4">Bahan Baku Diterima</th>
                <th className="py-3.5 px-4">Penerima</th>
                <th className="py-3.5 px-4 text-right">Total Nilai</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 pr-4 pl-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-komazi-border/60">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-komazi-muted">
                    <p className="font-semibold text-xs text-komazi-text">Belum ada riwayat stok masuk</p>
                    <p className="text-[11px] text-komazi-muted mt-1">
                      Klik "+ Catat Barang Masuk" saat menerima kiriman bahan dari vendor.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((rec) => {
                  const isSelected = selectedRecordIds.includes(rec.id);

                  return (
                    <tr
                      key={rec.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-komazi-coral/10 hover:bg-komazi-coral/15' : 'hover:bg-komazi-surface-2/40'
                      }`}
                    >
                      <td className="py-3.5 pl-4 pr-2 text-center">
                        <input
                          type="checkbox"
                          aria-label={`Pilih penerimaan ${rec.inboundNumber}`}
                          checked={isSelected}
                          onChange={() => handleRowSelect(rec.id)}
                          className="w-4 h-4 rounded text-komazi-coral accent-komazi-coral cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-komazi-coral">
                        {rec.inboundNumber}
                      </td>
                      <td className="py-3.5 px-4 text-komazi-muted font-mono text-[11px]">
                        {rec.date}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-komazi-text">
                        <div className="flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-komazi-coral shrink-0" />
                          <span>{rec.supplierName}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5 max-w-xs">
                          {rec.items?.slice(0, 2).map((item, idx) => (
                            <div key={idx} className="text-komazi-text font-medium flex items-center gap-1.5 truncate">
                              <span className="w-1.5 h-1.5 rounded-full bg-komazi-coral shrink-0" />
                              <span className="truncate">{item.name}</span>
                              <span className="text-komazi-muted font-mono text-[11px] shrink-0">
                                ({item.qty} {item.unit})
                              </span>
                            </div>
                          ))}
                          {rec.items?.length > 2 && (
                            <div className="text-[10px] text-komazi-muted font-semibold pl-3">
                              +{rec.items.length - 2} bahan lainnya...
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-komazi-muted text-[11px]">
                        {rec.receivedBy}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                        {formatRupiah(rec.totalAmount)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          {rec.status === 'COMPLETED' ? 'Selesai' : 'Pending'}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 pl-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedRecordDetail(rec)}
                            className="p-1.5 rounded-lg text-komazi-muted hover:text-komazi-coral hover:bg-komazi-surface-2 transition-colors"
                            title="Lihat Rincian Item"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setRecordToDelete(rec)}
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Hapus Riwayat"
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
          totalItems={filteredRecords.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
          itemsPerPageOptions={[5, 10, 20, 50]}
          itemLabel="stok masuk"
        />
      </div>

      {/* Floating Multi-Select Action Bar */}
      {selectedRecordIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-3xl w-[92%] sm:w-auto bg-komazi-surface/95 backdrop-blur-md border border-komazi-coral/40 shadow-2xl shadow-black/70 rounded-2xl p-2.5 sm:px-4 sm:py-3 flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-start gap-2 sm:gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl bg-komazi-coral/20 border border-komazi-coral/40 text-komazi-coral text-xs font-bold whitespace-nowrap flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>{selectedRecordIds.length} Riwayat Terpilih</span>
            </span>
            <button
              type="button"
              onClick={() => setSelectedRecordIds([])}
              className="text-[11px] text-komazi-muted hover:text-white underline px-1"
            >
              Batalkan
            </button>
          </div>

          <div className="h-4 w-px bg-komazi-border hidden sm:block" />

          <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleBulkExportCSV}
              className="px-2.5 py-1.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-text border border-komazi-border text-xs font-semibold transition-all flex items-center gap-1 active:scale-95"
              title="Ekspor riwayat terpilih ke format CSV"
            >
              <Download className="w-3.5 h-3.5 text-komazi-coral" />
              <span>Ekspor CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-xs font-semibold transition-all flex items-center gap-1 active:scale-95"
              title="Hapus riwayat terpilih"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Terpilih</span>
            </button>
          </div>
        </div>
      )}

      {/* 5. Modal Rincian Stok Masuk (Detail Modal) */}
      {selectedRecordDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-komazi-surface border border-komazi-border p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-komazi-border pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-komazi-coral/15 flex items-center justify-center text-komazi-coral">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-komazi-text">
                    Rincian {selectedRecordDetail.inboundNumber}
                  </h3>
                  <p className="text-[11px] text-komazi-muted">
                    {selectedRecordDetail.date} • {selectedRecordDetail.supplierName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecordDetail(null)}
                className="p-1 rounded-lg text-komazi-muted hover:text-white hover:bg-komazi-surface-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-komazi-surface-2/50 border border-komazi-border space-y-1">
                <div className="flex justify-between">
                  <span className="text-komazi-muted">Penerima:</span>
                  <span className="font-semibold text-komazi-text">{selectedRecordDetail.receivedBy}</span>
                </div>
                {selectedRecordDetail.notes && (
                  <div className="flex justify-between">
                    <span className="text-komazi-muted">Catatan:</span>
                    <span className="text-komazi-text">{selectedRecordDetail.notes}</span>
                  </div>
                )}
              </div>

              <div>
                <div className="font-semibold text-komazi-muted mb-1.5 uppercase text-[10px] tracking-wider">
                  Daftar Bahan Diterima
                </div>
                <div className="rounded-xl border border-komazi-border bg-komazi-surface overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-komazi-surface-2 border-b border-komazi-border text-komazi-muted">
                      <tr>
                        <th className="py-2 px-3">Bahan</th>
                        <th className="py-2 px-3 text-center">Qty</th>
                        <th className="py-2 px-3 text-right">Harga Satuan</th>
                        <th className="py-2 px-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-komazi-border/50">
                      {selectedRecordDetail.items?.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 font-semibold text-komazi-text">{item.name}</td>
                          <td className="py-2 px-3 text-center font-mono">
                            {item.qty} {item.unit}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-komazi-muted">
                            {formatRupiah(item.unitCost)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">
                            {formatRupiah(item.subtotal || item.qty * item.unitCost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-komazi-border bg-komazi-surface-2/60">
                      <tr>
                        <td colSpan={3} className="py-2.5 px-3 font-bold text-komazi-text">
                          Total Nilai
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                          {formatRupiah(selectedRecordDetail.totalAmount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-komazi-border flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRecordDetail(null)}
                className="px-4 py-2 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-xs font-semibold text-komazi-text transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal Catat Stok Masuk */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-2xl bg-komazi-surface border border-komazi-border p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-komazi-border pb-3">
              <h3 className="text-base font-bold text-komazi-text flex items-center gap-2">
                <PackagePlus className="w-5 h-5 text-komazi-coral" />
                <span>Pencatatan Stok Masuk Baru</span>
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-komazi-muted font-medium mb-1">
                    Pilih Pemasok / Vendor <span className="text-rose-400">*</span>
                  </label>
                  <select
                    required
                    value={formData.supplierId}
                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                    aria-label="Pilih pemasok pengirim"
                    className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-komazi-text focus:border-komazi-coral focus:outline-none"
                  >
                    <option value="">-- Pilih Pemasok --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-komazi-muted font-medium mb-1">Tanggal Masuk</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-komazi-text focus:border-komazi-coral focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-komazi-muted font-medium mb-1">Petugas Penerima Logistik</label>
                <input
                  type="text"
                  required
                  placeholder="Nama staf atau supervisor penerima"
                  value={formData.receivedBy}
                  onChange={(e) => setFormData({ ...formData, receivedBy: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-komazi-text focus:border-komazi-coral focus:outline-none"
                />
              </div>

              {/* Dynamic Item Rows */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-komazi-muted font-bold uppercase text-[10px] tracking-wider">
                    Daftar Bahan Yang Diterima
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-komazi-coral hover:text-komazi-coral-dark text-xs font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Tambah Baris</span>
                  </button>
                </div>

                {formData.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-komazi-surface-2 p-2 rounded-xl border border-komazi-border">
                    <div className="col-span-5">
                      <input
                        type="text"
                        required
                        list="ingredient-suggestions"
                        placeholder="Nama bahan..."
                        value={item.name}
                        onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-komazi-surface border border-komazi-border text-komazi-text focus:border-komazi-coral focus:outline-none"
                      />
                      <datalist id="ingredient-suggestions">
                        {ingredients.map((ing) => (
                          <option key={ing.id} value={ing.name} />
                        ))}
                      </datalist>
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        required
                        placeholder="Qty"
                        value={item.qty}
                        onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-komazi-surface border border-komazi-border text-komazi-text focus:border-komazi-coral focus:outline-none text-center font-mono"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="Satuan"
                        value={item.unit}
                        onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-komazi-surface border border-komazi-border text-komazi-text focus:border-komazi-coral focus:outline-none text-center font-mono"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0"
                        placeholder="Harga/Unit"
                        value={item.unitCost}
                        onChange={(e) => handleItemChange(idx, 'unitCost', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-komazi-surface border border-komazi-border text-komazi-text focus:border-komazi-coral focus:outline-none text-right font-mono"
                      />
                    </div>
                    <div className="col-span-1 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        disabled={formData.items.length <= 1}
                        className="p-1 rounded text-rose-500 hover:text-rose-400 disabled:opacity-20"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-komazi-muted font-medium mb-1">Catatan / Nomor Surat Jalan</label>
                <textarea
                  rows={2}
                  placeholder="Nomor faktur vendor atau catatan kondisi kemasan..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-komazi-text focus:border-komazi-coral focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
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
                  Simpan Penerimaan Stok
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Alert Modal Hapus Satuan */}
      <AlertModal
        isOpen={Boolean(recordToDelete)}
        title="Hapus Riwayat Stok Masuk?"
        message={`Apakah Anda yakin ingin menghapus penerimaan "${recordToDelete?.inboundNumber}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus Riwayat"
        cancelText="Batal"
        type="danger"
        onConfirm={handleConfirmSingleDelete}
        onClose={() => setRecordToDelete(null)}
      />

      {/* 8. Alert Modal Hapus Massal (Bulk Delete) */}
      <AlertModal
        isOpen={isBulkDeleteModalOpen}
        title="Hapus Riwayat Stok Masuk Terpilih?"
        message={`Apakah Anda yakin ingin menghapus ${selectedRecordIds.length} riwayat stok masuk yang dipilih? Tindakan ini tidak dapat dibatalkan.`}
        confirmText={`Hapus ${selectedRecordIds.length} Riwayat`}
        cancelText="Batal"
        type="danger"
        onConfirm={handleConfirmBulkDelete}
        onClose={() => setIsBulkDeleteModalOpen(false)}
      />
    </div>
  );
}
