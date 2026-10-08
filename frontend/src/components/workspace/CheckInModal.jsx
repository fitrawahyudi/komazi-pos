import React, { useState } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { formatRupiah } from '../../utils/format';
import { X, LogIn, Clock, User, Phone } from 'lucide-react';

export default function CheckInModal({ area, onClose }) {
  const { packages, checkIn } = useWorkspaceStore();
  const [selectedPackageId, setSelectedPackageId] = useState(
    packages[0]?.id || 1
  );
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customerName.trim()) return;

    await checkIn({
      areaId: area.id,
      packageId: Number(selectedPackageId),
      customerName,
      phone,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-komazi-border">
          <div className="flex items-center gap-2">
            <LogIn className="w-5 h-5 text-komazi-coral" />
            <h2 className="font-bold text-base text-komazi-text">
              Check-In: {area.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-komazi-surface-2 text-komazi-muted hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-komazi-muted mb-1.5">
              Nama Pelanggan / Tamu:
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-komazi-muted absolute left-3 top-3" />
              <input
                type="text"
                required
                placeholder="Nama lengkap..."
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-komazi-muted mb-1.5">
              Nomor WhatsApp / HP:
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-komazi-muted absolute left-3 top-3" />
              <input
                type="tel"
                placeholder="0812xxxxxx (opsional)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-komazi-muted mb-2">
              Pilih Paket Durasi Workspace:
            </label>
            <div className="space-y-2">
              {packages.map((pkg) => {
                const isSelected = selectedPackageId === pkg.id;
                return (
                  <label
                    key={pkg.id}
                    onClick={() => setSelectedPackageId(pkg.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'border-komazi-coral bg-komazi-coral/10 text-komazi-coral'
                        : 'border-komazi-border bg-komazi-surface-2 text-komazi-text hover:border-komazi-muted'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{pkg.name}</div>
                      <div className="text-[11px] text-komazi-muted">{pkg.description}</div>
                    </div>
                    <div className="font-mono font-bold text-sm">
                      {formatRupiah(pkg.price)}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-komazi-surface-2 text-komazi-muted hover:text-white font-semibold text-xs"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md"
            >
              <span>Mulai Sesi (Timer)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
