import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
} from 'lucide-react';

/**
 * Reusable, responsive pagination component matching Komazi POS design tokens.
 * Highly optimized for mobile devices (smartphones, handheld terminals) and tablets,
 * while retaining the comprehensive classic layout for desktop monitors.
 *
 * @param {number} currentPage - Active page (1-indexed)
 * @param {number} totalItems - Total count of items matching current filter
 * @param {number} itemsPerPage - Number of items shown per page (default: 10)
 * @param {function} onPageChange - Callback when user selects a different page
 * @param {function} onItemsPerPageChange - (Optional) Callback to alter rows per page
 * @param {number[]} itemsPerPageOptions - (Optional) Dropdown row counts, default [10, 20, 50]
 * @param {string} itemLabel - (Optional) Plural/singular noun, e.g. "transaksi", "menu", "member"
 * @param {string} className - (Optional) Additional Tailwind classes
 */
export default function Pagination({
  currentPage = 1,
  totalItems = 0,
  itemsPerPage = 10,
  onPageChange,
  onItemsPerPageChange,
  itemsPerPageOptions = [10, 20, 50],
  itemLabel = 'data',
  className = '',
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  if (totalItems === 0) return null;

  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

  return (
    <div className={`border-t border-komazi-border bg-komazi-surface-2/40 ${className}`}>
      {/* ─────────────────────────────────────────────────────────────
          1. NON-DESKTOP VIEW (Mobile, Smartphone, & Tablet: < lg)
          Ergonomic touch targets (min 38-40px), thumb-friendly actions,
          zero horizontal overflow, direct page jumper dropdown.
         ───────────────────────────────────────────────────────────── */}
      <div className="lg:hidden p-3 sm:p-3.5 flex flex-col gap-2.5 text-xs">
        {/* Row 1: Range info & Items Per Page Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-komazi-muted select-none text-[11px] sm:text-xs">
            <span>
              Menampilkan{' '}
              <strong className="text-komazi-text font-mono font-bold">
                {startIndex + 1}–{endIndex}
              </strong>
              {' - '}
              <strong className="text-komazi-text font-mono font-bold">
                {totalItems}
              </strong>
              {' '}{itemLabel}
            </span>
          </div>

          {onItemsPerPageChange && (
            <div className="flex items-center gap-1.5 text-komazi-muted shrink-0">
              <span className="text-[11px]">Baris:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  onItemsPerPageChange(Number(e.target.value));
                  if (onPageChange) onPageChange(1);
                }}
                aria-label="Pilih jumlah baris per halaman"
                className="h-8 px-2 py-1 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text font-semibold focus:outline-none focus:border-komazi-coral cursor-pointer shadow-sm"
              >
                {itemsPerPageOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt} / hal
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Row 2: Touch Navigation Controls (Only shown if totalPages > 1) */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between sm:justify-center gap-2 sm:gap-3 pt-2 border-t border-komazi-border/50">
            {/* Tombol Sebelumnya */}
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
              disabled={safeCurrentPage === 1}
              aria-label="Halaman Sebelumnya"
              className="flex-1 sm:flex-initial h-10 px-3.5 sm:px-4 rounded-xl border border-komazi-border bg-komazi-surface hover:bg-komazi-surface-2 active:scale-95 text-komazi-text font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-sm"
            >
              <ChevronLeft className="w-4 h-4 text-komazi-coral shrink-0" />
              <span className="truncate">Sebelumnya</span>
            </button>

            {/* Tablet pills if totalPages <= 7 (shown on sm: to lg) */}
            {totalPages <= 7 ? (
              <>
                {/* On mobile (< sm): Show compact dropdown pill */}
                <div className="relative shrink-0 sm:hidden">
                  <select
                    value={safeCurrentPage}
                    onChange={(e) => onPageChange(Number(e.target.value))}
                    aria-label="Pilih nomor halaman"
                    className="appearance-none h-10 pl-3.5 pr-8 rounded-xl bg-komazi-surface border border-komazi-border text-xs font-bold text-komazi-text focus:outline-none focus:border-komazi-coral cursor-pointer shadow-sm text-center"
                  >
                    {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((p) => (
                      <option key={p} value={p}>
                        Hal {p} dari {totalPages}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-komazi-muted">
                    <ChevronsUpDown className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* On tablet (sm to lg): Show comfortable touch number buttons */}
                <div className="hidden sm:flex items-center gap-1.5">
                  {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => onPageChange(pageNum)}
                      className={`min-w-10 h-10 px-3 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                        safeCurrentPage === pageNum
                          ? 'bg-komazi-coral text-white shadow-md shadow-komazi-coral/25 ring-1 ring-komazi-coral'
                          : 'bg-komazi-surface border border-komazi-border text-komazi-muted hover:text-white hover:bg-komazi-border'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              /* When totalPages > 7: Always show quick-jump dropdown to avoid squeezing */
              <div className="relative shrink-0">
                <select
                  value={safeCurrentPage}
                  onChange={(e) => onPageChange(Number(e.target.value))}
                  aria-label="Pilih nomor halaman"
                  className="appearance-none h-10 pl-3.5 pr-8 rounded-xl bg-komazi-surface border border-komazi-border text-xs font-bold text-komazi-text focus:outline-none focus:border-komazi-coral cursor-pointer shadow-sm text-center"
                >
                  {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((p) => (
                    <option key={p} value={p}>
                      Hal {p} dari {totalPages}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-komazi-muted">
                  <ChevronsUpDown className="w-3.5 h-3.5" />
                </div>
              </div>
            )}

            {/* Tombol Selanjutnya */}
            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, safeCurrentPage + 1))}
              disabled={safeCurrentPage === totalPages}
              aria-label="Halaman Selanjutnya"
              className="flex-1 sm:flex-initial h-10 px-3.5 sm:px-4 rounded-xl border border-komazi-border bg-komazi-surface hover:bg-komazi-surface-2 active:scale-95 text-komazi-text font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-sm"
            >
              <span className="truncate">Selanjutnya</span>
              <ChevronRight className="w-4 h-4 text-komazi-coral shrink-0" />
            </button>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. DESKTOP VIEW (lg:flex)
          Full layout with complete controls optimized for mouse pointer
         ───────────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex p-3.5 items-center justify-between gap-3 text-xs">
        {/* 1. Showing range info */}
        <div className="text-komazi-muted select-none">
          <span>
            Menampilkan{' '}
            <strong className="text-komazi-text font-mono font-bold">{startIndex + 1}</strong>
            {' - '}
            <strong className="text-komazi-text font-mono font-bold">{endIndex}</strong>
            {' dari '}
            <strong className="text-komazi-text font-mono font-bold">{totalItems}</strong>
            {' '}{itemLabel}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* 2. Optional Rows per Page Selector */}
          {onItemsPerPageChange && (
            <div className="flex items-center gap-1.5 text-komazi-muted">
              <span className="text-[11px]">Baris:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  onItemsPerPageChange(Number(e.target.value));
                  if (onPageChange) onPageChange(1);
                }}
                className="px-2 py-1 rounded-lg bg-komazi-surface border border-komazi-border text-xs text-komazi-text focus:outline-none focus:border-komazi-coral cursor-pointer"
              >
                {itemsPerPageOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 3. Page Navigation Buttons (Only shown if totalPages > 1) */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              {/* First Page button */}
              <button
                type="button"
                onClick={() => onPageChange(1)}
                disabled={safeCurrentPage === 1}
                className="p-1.5 rounded-lg border border-komazi-border bg-komazi-surface hover:bg-komazi-border text-komazi-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Halaman Pertama"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>

              {/* Prev Page button */}
              <button
                type="button"
                onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
                disabled={safeCurrentPage === 1}
                className="p-1.5 rounded-lg border border-komazi-border bg-komazi-surface hover:bg-komazi-border text-komazi-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {/* Smart Page numbers with gap ellipsis */}
              {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                .filter((pageNum) => {
                  return (
                    pageNum === 1 ||
                    pageNum === totalPages ||
                    Math.abs(pageNum - safeCurrentPage) <= 1
                  );
                })
                .map((pageNum, idx, visibleArr) => {
                  const prevNum = visibleArr[idx - 1];
                  const hasGap = prevNum && pageNum - prevNum > 1;

                  return (
                    <React.Fragment key={pageNum}>
                      {hasGap && <span className="px-1 text-komazi-muted text-xs">...</span>}
                      <button
                        type="button"
                        onClick={() => onPageChange(pageNum)}
                        className={`min-w-7 h-7 px-2 rounded-lg text-xs font-bold transition-colors ${
                          safeCurrentPage === pageNum
                            ? 'bg-komazi-coral text-white shadow-sm ring-1 ring-komazi-coral'
                            : 'bg-komazi-surface border border-komazi-border text-komazi-muted hover:text-white hover:bg-komazi-border'
                        }`}
                      >
                        {pageNum}
                      </button>
                    </React.Fragment>
                  );
                })}

              {/* Next Page button */}
              <button
                type="button"
                onClick={() => onPageChange(Math.min(totalPages, safeCurrentPage + 1))}
                disabled={safeCurrentPage === totalPages}
                className="p-1.5 rounded-lg border border-komazi-border bg-komazi-surface hover:bg-komazi-border text-komazi-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Halaman Selanjutnya"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              {/* Last Page button */}
              <button
                type="button"
                onClick={() => onPageChange(totalPages)}
                disabled={safeCurrentPage === totalPages}
                className="p-1.5 rounded-lg border border-komazi-border bg-komazi-surface hover:bg-komazi-border text-komazi-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Halaman Terakhir"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
