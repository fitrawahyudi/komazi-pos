import React from 'react';
import { formatRupiah } from '../../utils/format';

export default function PaymentMethodBreakdownCard({
  shift = null,
  paymentMethodsSummary = null,
  totalCashSales = 0,
  className = '',
}) {
  const methods = paymentMethodsSummary || shift?.paymentMethodsSummary || {};
  const cashAmount = Number(
    methods.CASH !== undefined
      ? methods.CASH
      : shift?.totalCashSales !== undefined
      ? shift.totalCashSales
      : totalCashSales
  );
  const cardAmount = Number(methods.CARD || 0);
  const qrisAmount = Number(methods.QRIS || 0);
  const transferAmount = Number(methods.TRANSFER || 0);
  const otherAmount = Number(methods.OTHER || 0);

  const breakdown = [
    { label: 'Tunai', amount: cashAmount },
    { label: 'Kartu', amount: cardAmount },
    { label: 'QRIS', amount: qrisAmount },
    { label: 'Transfer Bank', amount: transferAmount },
    { label: 'Lainnya', amount: otherAmount },
  ];

  return (
    <div className={`bg-komazi-surface rounded-2xl border border-komazi-border p-5 sm:p-6 shadow-sm ${className}`}>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-komazi-muted mb-4 sm:mb-5">
        RINCIAN PER METODE BAYAR
      </h2>

      <div className="w-full">
        {/* Header */}
        <div className="flex items-center justify-between text-xs sm:text-sm text-komazi-muted pb-3.5 border-b border-komazi-border/40 font-medium">
          <span>Metode Pembayaran</span>
          <span className="text-right">Jumlah</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-komazi-border/30 text-sm">
          {breakdown.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between py-4 transition-colors hover:bg-komazi-surface-2/20 px-1 -mx-1 rounded-lg"
            >
              <span className="font-bold text-white tracking-wide">
                {item.label}
              </span>
              <span className="font-mono font-bold text-white text-right">
                {formatRupiah(item.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
