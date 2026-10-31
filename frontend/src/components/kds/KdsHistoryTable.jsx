import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  RotateCcw,
  Eye,
  Calendar,
  CheckCircle2,
  Clock,
  Store,
  ShoppingBag,
  RefreshCw,
  SearchX,
  Coffee,
  Utensils,
  Receipt,
  ArrowUpDown,
  Filter,
  Printer,
} from 'lucide-react';
import { formatDateTime, formatTime, formatOrderType, isDrinkItem, isToday, isBaristaItem, isKitchenItem } from '../../utils/format';
import Pagination from '../ui/Pagination';
import KdsOrderDetailModal from './KdsOrderDetailModal';

/**
 * Komponen Tabel Riwayat Pesanan Selesai KDS/BDS
 * Menampilkan pesanan dengan status SERVED dalam format tabel bersih,
 * dilengkapi filter hari ini, search query, tombol aksi Detail & Recall,
 * serta pagination 10 data per halaman.
 */
export default function KdsHistoryTable({
  orders = [],
  station = 'ALL',
  onRecall,
  onPrint,
  canBump = true,
  onRefresh,
  isRefreshing = false,
  isStandalone = false,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTodayOnly, setFilterTodayOnly] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Filter pesanan berstatus SERVED sesuai station, filter hari ini, dan pencarian
  const servedOrders = useMemo(() => {
    return orders.filter((o) => {
      const status = (o.status || '').toUpperCase();
      if (status === 'VOIDED' || status === 'REFUNDED') return false;

      const items = o.items || [];
      const hasDrinks = items.some((i) => isBaristaItem(i));
      const hasFood = items.some((i) => isKitchenItem(i));

      const barServed = (o.barStatus || 'PENDING') === 'SERVED';
      const kitchenServed = (o.kitchenStatus || 'PENDING') === 'SERVED';

      // 1. Evaluasi apakah pesanan ini dianggap selesai pada station yang aktif
      let isServedAtStation = false;
      if (station === 'BAR') {
        isServedAtStation = hasDrinks && barServed;
      } else if (station === 'KITCHEN') {
        isServedAtStation = hasFood && kitchenServed;
      } else {
        // Station 'ALL' atau Split View
        // Selesai jika stasiun yang memiliki item pesanan sudah SERVED
        const barDone = !hasDrinks || barServed;
        const kitchenDone = !hasFood || kitchenServed;
        isServedAtStation = (hasDrinks || hasFood) && (barServed || kitchenServed);
      }

      if (!isServedAtStation) return false;

      // 2. Filter Hari Ini
      if (filterTodayOnly) {
        const orderDate = o.updatedAt || o.createdAt;
        if (!isToday(orderDate)) return false;
      }

      // 3. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchInv = (o.invoiceNo || '').toLowerCase().includes(q);
        const matchCust = (o.customerName || '').toLowerCase().includes(q);
        const matchTable = String(o.tableNo || o.tableNumber || '').toLowerCase().includes(q);
        const matchNotes = (o.notes || '').toLowerCase().includes(q);
        const matchType = (o.orderType || '').toLowerCase().includes(q);
        const matchItem = items.some(
          (i) =>
            (i.productName || i.name || '').toLowerCase().includes(q) ||
            (i.variantName || '').toLowerCase().includes(q) ||
            (i.note || i.notes || '').toLowerCase().includes(q)
        );

        if (!matchInv && !matchCust && !matchTable && !matchNotes && !matchType && !matchItem) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      // Urutkan pesanan selesai terbaru di paling atas
      const timeA = new Date(a.updatedAt || a.createdAt).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt).getTime();
      return timeB - timeA;
    });
  }, [orders, station, filterTodayOnly, searchQuery]);

  // Reset ke halaman 1 saat filter atau query berubah
  const handleQueryChange = (val) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handleToggleToday = (val) => {
    setFilterTodayOnly(val);
    setCurrentPage(1);
  };

  // Pagination Slice
  const totalItems = servedOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const paginatedOrders = servedOrders.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="flex flex-col flex-1 min-w-0 space-y-4 animate-fade-in">
      {/* ── Control Bar: Search, Quick Filters & Stats ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-komazi-surface p-3 sm:p-4 rounded-2xl border border-komazi-border">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-komazi-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Cari invoice, meja, pemesan, atau menu..."
            className="w-full pl-10 pr-9 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text placeholder-komazi-muted focus:outline-none focus:border-komazi-coral transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => handleQueryChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md hover:bg-komazi-border flex items-center justify-center text-komazi-muted hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Toggle Filter Hari Ini */}
          <div className="flex items-center bg-komazi-surface-2 p-1 rounded-xl border border-komazi-border">
            <button
              type="button"
              onClick={() => handleToggleToday(true)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${filterTodayOnly
                  ? 'bg-komazi-coral text-white shadow-sm'
                  : 'text-komazi-muted hover:text-white'
                }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Hari Ini</span>
            </button>
            <button
              type="button"
              onClick={() => handleToggleToday(false)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${!filterTodayOnly
                  ? 'bg-komazi-coral text-white shadow-sm'
                  : 'text-komazi-muted hover:text-white'
                }`}
            >
              Semua Hari
            </button>
          </div>

          {/* Refresh Data */}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border border border-komazi-border text-komazi-text text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
              title="Perbarui daftar pesanan selesai"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-komazi-coral' : ''}`} />
              <span className="hidden sm:inline">Segarkan</span>
            </button>
          )}

          {/* Counter Badge */}
          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{totalItems} Selesai</span>
          </div>
        </div>
      </div>

      {/* ── Table View ── */}
      <div className="bg-komazi-surface rounded-2xl border border-komazi-border overflow-hidden shadow-sm flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-komazi-border bg-komazi-surface-2/60 text-komazi-muted uppercase font-bold text-[10px] tracking-wider select-none">
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4 w-32">Waktu Selesai</th>
                <th className="py-3 px-4 w-44">Invoice & Tipe</th>
                <th className="py-3 px-4 w-36">Meja / Pemesan</th>
                <th className="py-3 px-4 min-w-[220px]">Menu Disajikan</th>
                <th className="py-3 px-4 w-28 text-center">Status</th>
                <th className="py-3 px-4 w-44 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-komazi-border/50 text-komazi-text">
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      {searchQuery ? (
                        <SearchX className="w-10 h-10 text-komazi-coral opacity-60" />
                      ) : (
                        <CheckCircle2 className="w-10 h-10 text-emerald-400 opacity-40" />
                      )}
                      <div>
                        <p className="font-bold text-sm text-komazi-text">
                          {searchQuery
                            ? 'Tidak ada pesanan riwayat yang cocok'
                            : filterTodayOnly
                              ? 'Belum ada pesanan selesai hari ini'
                              : 'Tidak ada riwayat pesanan'}
                        </p>
                        <p className="text-xs text-komazi-muted mt-1 max-w-sm">
                          {searchQuery
                            ? 'Coba gunakan kata kunci pencarian yang berbeda.'
                            : 'Pesanan yang telah di-BUMP ke SERVED akan otomatis tercatat pada tabel ini.'}
                        </p>
                      </div>
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => handleQueryChange('')}
                          className="px-3 py-1.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border border border-komazi-border text-xs font-bold text-komazi-coral transition-colors"
                        >
                          Hapus Pencarian
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order, idx) => {
                  const rowNumber = startIndex + idx + 1;
                  const isDineIn = (order.orderType || '').toUpperCase() === 'DINE_IN';
                  const tableOrCust = order.tableNo || order.tableNumber
                    ? `Meja ${order.tableNo || order.tableNumber}`
                    : order.customerName || '-';

                  const items = order.items || [];
                  const stationItems = items.filter((i) => {
                    if (station === 'BAR') return isBaristaItem(i);
                    if (station === 'KITCHEN') return isKitchenItem(i);
                    return true;
                  });
                  const displayItems = stationItems.length > 0 ? stationItems : items;

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-komazi-surface-2/40 transition-colors group"
                    >
                      {/* 1. Row Number */}
                      <td className="py-3 px-4 text-center font-mono text-komazi-muted font-bold">
                        {rowNumber}
                      </td>

                      {/* 2. Waktu Selesai & Dibuat */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-mono font-bold text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{formatTime(order.updatedAt || order.createdAt)} WIB</span>
                        </div>
                        <span className="text-[10px] text-komazi-muted block mt-0.5">
                          Masuk: {formatTime(order.createdAt)} WIB
                        </span>
                      </td>

                      {/* 3. Invoice & Tipe */}
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-komazi-text block truncate">
                          {order.invoiceNo || `#${order.id}`}
                        </span>
                        <div className="mt-1 flex items-center gap-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${isDineIn
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              }`}
                          >
                            {isDineIn ? (
                              <Store className="w-2.5 h-2.5" />
                            ) : (
                              <ShoppingBag className="w-2.5 h-2.5" />
                            )}
                            <span>{formatOrderType(order.orderType)}</span>
                          </span>
                        </div>
                      </td>

                      {/* 4. Meja / Pemesan */}
                      <td className="py-3 px-4">
                        <span className="font-bold text-komazi-text block">
                          {tableOrCust}
                        </span>
                        {order.customerName && (order.tableNo || order.tableNumber) && (
                          <span className="text-[11px] text-komazi-muted block truncate">
                            {order.customerName}
                          </span>
                        )}
                      </td>

                      {/* 5. Menu Disajikan (Badge List) */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1.5 max-w-md items-center">
                          {displayItems.slice(0, 3).map((item, itemIdx) => {
                            const qty = Number(item.qty || item.quantity) || 1;
                            const name = item.productName || item.name || item.product?.name || 'Item';
                            return (
                              <span
                                key={item.id || itemIdx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-komazi-surface-2 border border-komazi-border text-[11px] font-medium text-komazi-text"
                              >
                                <strong className="text-komazi-coral font-mono">{qty}x</strong>
                                <span className="truncate max-w-[120px]">{name}</span>
                              </span>
                            );
                          })}
                          {displayItems.length > 3 && (
                            <button
                              type="button"
                              onClick={() => setSelectedOrder(order)}
                              className="text-[10px] font-bold text-komazi-muted hover:text-komazi-coral px-1.5 py-0.5 rounded bg-komazi-surface-2 border border-komazi-border cursor-pointer transition-colors"
                            >
                              +{displayItems.length - 3} lainnya
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 6. Status */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>SERVED</span>
                        </span>
                      </td>

                      {/* 7. Tombol Aksi */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Tombol Detail */}
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border border border-komazi-border text-komazi-text text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                            title="Lihat rincian lengkap pesanan"
                          >
                            <Eye className="w-3.5 h-3.5 text-komazi-teal-light" />
                            <span>Detail</span>
                          </button>

                          {/* Tombol Cetak */}
                          {onPrint && (
                            <button
                              type="button"
                              onClick={() => onPrint(order)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-komazi-coral/15 hover:bg-komazi-coral active:scale-95 text-komazi-coral hover:text-white border border-komazi-coral/30 text-xs font-bold transition-all hover:scale-[1.02] cursor-pointer"
                              title="Cetak Tiket Pesanan / Struk"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Cetak</span>
                            </button>
                          )}

                          {/* Tombol Recall */}
                          {canBump && onRecall && (
                            <button
                              type="button"
                              onClick={() => onRecall(order.id, station)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500 active:scale-95 text-amber-400 hover:text-black border border-amber-500/30 text-xs font-bold transition-all hover:scale-[1.02] cursor-pointer"
                              title="Tarik kembali pesanan ini ke antrean aktif (Recall)"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Recall</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Integrated Pagination (10 data per halaman) ── */}
        <Pagination
          currentPage={safeCurrentPage}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={(page) => setCurrentPage(page)}
          itemLabel="pesanan selesai"
        />
      </div>

      {/* ── Order Detail Modal ── */}
      <KdsOrderDetailModal
        isOpen={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        order={selectedOrder}
        station={station}
        onRecall={onRecall}
        onPrint={onPrint}
        canBump={canBump}
      />
    </div>
  );
}
