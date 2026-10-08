import React, { useState, useMemo } from 'react';
import { useCartStore } from '../../store/cartStore';
import { formatRupiah, formatDateTime, formatOrderType } from '../../utils/format';
import { X, Clock, Play, Trash2, FileText } from 'lucide-react';
import Pagination from '../ui/Pagination';

export default function OpenBillsModal({ onClose }) {
  const { openBills, restoreOpenBill, deleteOpenBill, syncOpenBillsWithBackendOrders } = useCartStore();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  React.useEffect(() => {
    if (typeof syncOpenBillsWithBackendOrders === 'function') {
      syncOpenBillsWithBackendOrders();
    }
  }, [syncOpenBillsWithBackendOrders]);

  const paginatedBills = useMemo(() => {
    const start = (page - 1) * perPage;
    return openBills.slice(start, start + perPage);
  }, [openBills, page, perPage]);

  const handleRestore = (billId) => {
    restoreOpenBill(billId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-komazi-border">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-komazi-coral shrink-0" />
            <h2 className="font-bold text-sm sm:text-base text-komazi-text">
              Daftar Pesanan Tertahan (Open Bills)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-komazi-surface-2 text-komazi-muted hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-3 flex-1">
          {openBills.length === 0 ? (
            <div className="text-center py-12 text-komazi-muted space-y-2">
              <FileText className="w-12 h-12 mx-auto text-komazi-muted/40" />
              <p className="font-semibold text-sm text-komazi-text">Tidak Ada Bill Tertahan</p>
              <p className="text-xs">
                Gunakan tombol "Hold Bill" di keranjang kasir untuk menyimpan pesanan sementara.
              </p>
            </div>
          ) : (
            paginatedBills.map((bill) => (
              <div
                key={bill.id}
                className="p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-komazi-coral/40 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-komazi-text">{bill.label}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-komazi-surface border border-komazi-border text-komazi-muted">
                      {formatOrderType(bill.orderType)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-komazi-muted">
                    <Clock className="w-3.5 h-3.5 text-komazi-teal-light" />
                    <span>Disimpan: {formatDateTime(bill.savedAt)}</span>
                  </div>
                  <p className="text-xs text-komazi-muted">
                    {bill.items.length} jenis item • Subtotal: {formatRupiah(bill.total)}
                  </p>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-komazi-border/50 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => deleteOpenBill(bill.id)}
                    className="p-2 rounded-xl text-komazi-muted hover:text-danger hover:bg-danger/10 transition-colors"
                    title="Hapus bill"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRestore(bill.id)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md transition-colors active:scale-95"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Lanjutkan</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {openBills.length > 0 && (
          <div className="p-3 border-t border-komazi-border bg-komazi-surface">
            <Pagination
              currentPage={page}
              totalItems={openBills.length}
              itemsPerPage={perPage}
              onPageChange={setPage}
              onItemsPerPageChange={(newLimit) => {
                setPerPage(newLimit);
                setPage(1);
              }}
              itemLabel="bill tertahan"
            />
          </div>
        )}
      </div>
    </div>
  );
}
