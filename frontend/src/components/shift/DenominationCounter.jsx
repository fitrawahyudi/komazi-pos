import React, { useState, useMemo } from 'react';
import { Calculator, RotateCcw, Check, Plus, Minus, Banknote, Coins } from 'lucide-react';
import { formatRupiah } from '../../utils/format';

const DENOMINATIONS = [
  { value: 100000, label: 'Rp 100.000', type: 'BILL', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  { value: 50000, label: 'Rp 50.000', type: 'BILL', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  { value: 20000, label: 'Rp 20.000', type: 'BILL', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  { value: 10000, label: 'Rp 10.000', type: 'BILL', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  { value: 5000, label: 'Rp 5.000', type: 'BILL', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  { value: 2000, label: 'Rp 2.000', type: 'BILL', color: 'text-gray-300 bg-gray-500/10 border-gray-500/20' },
  { value: 1000, label: 'Rp 1.000', type: 'BILL', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
  { value: 500, label: 'Koin Rp 500', type: 'COIN', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  { value: 200, label: 'Koin Rp 200', type: 'COIN', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  { value: 100, label: 'Koin Rp 100', type: 'COIN', color: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20' },
];

export default function DenominationCounter({ onApply, currentCounted = 0 }) {
  const [counts, setCounts] = useState(() => {
    const initial = {};
    DENOMINATIONS.forEach((d) => {
      initial[d.value] = 0;
    });
    return initial;
  });

  const handleCountChange = (val, delta) => {
    setCounts((prev) => {
      const current = prev[val] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [val]: next };
    });
  };

  const handleDirectInput = (val, text) => {
    const num = Math.max(0, parseInt(text, 10) || 0);
    setCounts((prev) => ({ ...prev, [val]: num }));
  };

  const handleReset = () => {
    const cleared = {};
    DENOMINATIONS.forEach((d) => {
      cleared[d.value] = 0;
    });
    setCounts(cleared);
  };

  const grandTotal = useMemo(() => {
    return DENOMINATIONS.reduce((sum, d) => {
      return sum + d.value * (counts[d.value] || 0);
    }, 0);
  }, [counts]);

  return (
    <div className="rounded-2xl bg-komazi-surface-2 border border-komazi-border p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-komazi-coral/20 text-komazi-coral">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-komazi-text">Kalkulator Uang Fisik Laci</h4>
            <p className="text-[10px] text-komazi-muted">Hitung jumlah lembar dan koin fisik secara cepat</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-komazi-muted hover:text-white bg-komazi-surface border border-komazi-border hover:bg-neutral-800 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>
      </div>

      {/* Grid of Denominations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1 overscroll-contain">
        {DENOMINATIONS.map((d) => {
          const count = counts[d.value] || 0;
          const subtotal = d.value * count;

          return (
            <div
              key={d.value}
              className="flex items-center justify-between p-2 rounded-xl bg-komazi-surface border border-komazi-border/80 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${d.color}`}>
                  {d.label}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCountChange(d.value, -1)}
                  disabled={count === 0}
                  className="w-6 h-6 rounded-md bg-komazi-surface-2 hover:bg-neutral-800 text-komazi-muted hover:text-white flex items-center justify-center disabled:opacity-30 disabled:hover:bg-komazi-surface-2 transition-colors"
                >
                  <Minus className="w-3 h-3" />
                </button>

                <input
                  type="number"
                  min="0"
                  value={count === 0 ? '' : count}
                  placeholder="0"
                  onChange={(e) => handleDirectInput(d.value, e.target.value)}
                  className="w-10 text-center py-0.5 rounded-md bg-komazi-surface-2 border border-komazi-border text-xs font-mono font-bold text-komazi-text focus:border-komazi-coral outline-none"
                />

                <button
                  type="button"
                  onClick={() => handleCountChange(d.value, 1)}
                  className="w-6 h-6 rounded-md bg-komazi-surface-2 hover:bg-neutral-800 text-komazi-muted hover:text-white flex items-center justify-center transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>

                <button
                  type="button"
                  onClick={() => handleCountChange(d.value, 5)}
                  className="px-1.5 h-6 rounded-md bg-komazi-surface-2 hover:bg-neutral-800 text-[10px] font-mono text-komazi-muted hover:text-white flex items-center justify-center transition-colors"
                >
                  +5
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Footer Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl bg-komazi-surface border border-komazi-coral/30 shadow-inner">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-komazi-muted block">
            Total Uang Dihitung
          </span>
          <span className="font-display font-black text-lg text-komazi-coral font-mono tabular-nums">
            {formatRupiah(grandTotal)}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onApply?.(grandTotal)}
          className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral/90 text-white font-bold text-xs shadow-md transition-all active:scale-95"
        >
          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Terapkan ke Kas Fisik</span>
        </button>
      </div>
    </div>
  );
}
