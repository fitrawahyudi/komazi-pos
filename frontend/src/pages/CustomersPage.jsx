import React, { useState, useMemo, useEffect } from 'react';
import { useCustomerStore } from '../store/customerStore';
import { formatRupiah } from '../utils/format';
import {
  Users,
  UserPlus,
  Search,
  Award,
  Crown,
  Sparkles,
  Phone,
  Mail,
  Trash2,
  Edit2,
  X,
  Check,
  Gift,
} from 'lucide-react';
import AlertModal from '../components/ui/AlertModal';
import Pagination from '../components/ui/Pagination';
import { toast } from '../store/toastStore';

export default function CustomersPage() {
  const { customers, addCustomer, updateCustomer, deleteCustomer, redeemPoints } =
    useCustomerStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [redeemCustomer, setRedeemCustomer] = useState(null);
  const [redeemPointsAmount, setRedeemPointsAmount] = useState(50);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
  });

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormData({ name: '', phone: '', email: '' });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
    });
    setIsAddModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) {
      toast.error('Nama dan No. WhatsApp wajib diisi');
      return;
    }

    if (editingCustomer) {
      updateCustomer(editingCustomer.id, formData);
      toast.success(`Data member "${formData.name}" berhasil diperbarui`);
    } else {
      addCustomer(formData);
      toast.success(`Member baru "${formData.name}" berhasil ditambahkan (+10 Poin Selamat Datang!)`);
    }
    setIsAddModalOpen(false);
  };

  const handleConfirmRedeem = (e) => {
    e.preventDefault();
    if (!redeemCustomer) return;
    const amount = Number(redeemPointsAmount);
    if (amount <= 0 || amount > redeemCustomer.points) {
      toast.error('Jumlah poin tidak valid atau melebihi saldo member');
      return;
    }

    const success = redeemPoints(redeemCustomer.id, amount);
    if (success) {
      toast.success(`Berhasil menukar ${amount} poin untuk member "${redeemCustomer.name}"!`);
      setRedeemCustomer(null);
    } else {
      toast.error('Gagal menukar poin');
    }
  };

  const filtered = customers.filter((c) => {
    const matchTier = selectedTier === 'ALL' || c.tier === selectedTier;
    const matchSearch =
      !searchQuery.trim() ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery);
    return matchTier && matchSearch;
  });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedTier]);

  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  const totalPoints = customers.reduce((sum, c) => sum + (c.points || 0), 0);
  const platinumCount = customers.filter((c) => c.tier === 'PLATINUM').length;
  const goldCount = customers.filter((c) => c.tier === 'GOLD').length;

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-6 space-y-6 max-w-7xl mx-auto select-none">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-black text-2xl text-komazi-text flex items-center gap-2">
            <Users className="w-6 h-6 text-komazi-coral" />
            <span>Pelanggan & Member Loyalty</span>
          </h1>
          <p className="text-xs text-komazi-muted mt-0.5">
            Kelola database pelanggan setia, akumulasi poin belanja, tier member, dan penukaran hadiah.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="px-4 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 active:scale-95 self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4 stroke-[3]" />
          <span>+ Tambah Pelanggan</span>
        </button>
      </div>

      {/* 2. Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border">
          <p className="text-[11px] font-bold uppercase text-komazi-muted">Total Member</p>
          <p className="text-2xl font-black text-komazi-text mt-1">{customers.length}</p>
          <p className="text-[10px] text-komazi-muted mt-0.5">Pelanggan terdaftar</p>
        </div>
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border">
          <p className="text-[11px] font-bold uppercase text-komazi-muted">Total Poin</p>
          <p className="text-2xl font-black font-mono text-komazi-coral mt-1">{totalPoints.toLocaleString()}</p>
          <p className="text-[10px] text-komazi-muted mt-0.5">1 Poin = Rp 10.000 belanja</p>
        </div>
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border">
          <p className="text-[11px] font-bold uppercase text-komazi-muted">Member VIP Gold</p>
          <p className="text-2xl font-black font-mono text-amber-400 mt-1">{goldCount}</p>
          <p className="text-[10px] text-komazi-muted mt-0.5">Saldo ≥ 200 Poin</p>
        </div>
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border">
          <p className="text-[11px] font-bold uppercase text-komazi-muted">Member Platinum</p>
          <p className="text-2xl font-black font-mono text-cyan-400 mt-1">{platinumCount}</p>
          <p className="text-[10px] text-komazi-muted mt-0.5">Saldo ≥ 500 Poin</p>
        </div>
      </div>

      {/* 3. Filters & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {['ALL', 'SILVER', 'GOLD', 'PLATINUM'].map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => setSelectedTier(tier)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${selectedTier === tier
                ? 'bg-komazi-coral text-white'
                : 'bg-komazi-surface text-komazi-muted hover:text-white border border-komazi-border'
                }`}
            >
              {tier === 'ALL' ? 'Semua Member' : tier}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-komazi-muted absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari nama atau No. WhatsApp..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
          />
        </div>
      </div>

      {/* 4. Customer Table */}
      <div className="rounded-2xl border border-komazi-border bg-komazi-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-komazi-border bg-komazi-surface-2 text-komazi-muted font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Nama Pelanggan</th>
                <th className="py-3 px-4">Kontak (WhatsApp)</th>
                <th className="py-3 px-4 text-center">Tier Member</th>
                <th className="py-3 px-4 text-right">Saldo Poin</th>
                <th className="py-3 px-4 text-right">Total Belanja</th>
                <th className="py-3 px-4 text-center">Kunjungan</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-komazi-border">
              {paginatedCustomers.map((c) => {
                const isPlatinum = c.tier === 'PLATINUM';
                const isGold = c.tier === 'GOLD';

                return (
                  <tr key={c.id} className="hover:bg-komazi-surface-2/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-komazi-surface-2 border border-komazi-border flex items-center justify-center font-bold text-xs text-komazi-text">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-komazi-text">{c.name}</p>
                          <p className="text-[10px] text-komazi-muted">Sejak {c.joinedDate}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-komazi-text">
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-success" />
                        <span>{c.phone}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${isPlatinum
                          ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                          : isGold
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : 'bg-komazi-surface-2 text-komazi-muted border-komazi-border'
                          }`}
                      >
                        {isPlatinum ? (
                          <Crown className="w-3 h-3" />
                        ) : isGold ? (
                          <Award className="w-3 h-3" />
                        ) : (
                          <Sparkles className="w-3 h-3" />
                        )}
                        <span>{c.tier}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-komazi-coral text-sm">
                      {c.points} pts
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-komazi-text">
                      {formatRupiah(c.totalSpent)}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-komazi-muted">
                      {c.visitCount}x
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setRedeemCustomer(c);
                            setRedeemPointsAmount(Math.min(50, c.points));
                          }}
                          className="px-2 py-1 rounded-lg bg-komazi-surface-2 hover:bg-komazi-border text-komazi-teal-light text-[11px] font-bold border border-komazi-border flex items-center gap-1 transition-colors"
                          title="Tukar Poin Hadiah"
                        >
                          <Gift className="w-3 h-3" />
                          <span>Tukar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(c)}
                          className="p-1.5 rounded-lg text-komazi-muted hover:text-white hover:bg-komazi-surface-2 transition-colors"
                          title="Edit member"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomerToDelete(c)}
                          className="p-1.5 rounded-lg text-komazi-muted hover:text-danger hover:bg-danger/10 transition-colors"
                          title="Hapus member"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <Pagination
          currentPage={currentPage}
          totalItems={filtered.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
          itemLabel="pelanggan"
        />
      </div>

      {/* Add / Edit Member Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-komazi-border">
              <h3 className="font-bold text-base text-komazi-text">
                {editingCustomer ? 'Edit Data Member' : 'Tambah Member Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-komazi-muted hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                  Nama Lengkap:
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Rian Anggara"
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                  Nomor WhatsApp / HP:
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="08xxxxxxxxxx"
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs font-mono text-komazi-text focus:border-komazi-coral focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                  Email (Opsional):
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="nama@email.com"
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-komazi-surface-2 text-komazi-muted hover:text-white font-semibold text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md"
                >
                  {editingCustomer ? 'Simpan' : 'Daftarkan Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Redeem Points Modal */}
      {redeemCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-komazi-border">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-komazi-coral" />
                <h3 className="font-bold text-sm text-komazi-text">Tukar Poin Member</h3>
              </div>
              <button
                type="button"
                onClick={() => setRedeemCustomer(null)}
                className="text-komazi-muted hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmRedeem} className="p-5 space-y-3.5">
              <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs space-y-1">
                <p className="text-komazi-muted">Member:</p>
                <p className="font-bold text-komazi-text text-sm">{redeemCustomer.name}</p>
                <p className="font-mono text-komazi-coral font-bold">
                  Saldo Saat Ini: {redeemCustomer.points} Poin
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-komazi-muted mb-1">
                  Jumlah Poin Ditukar:
                </label>
                <input
                  type="number"
                  min="1"
                  max={redeemCustomer.points}
                  value={redeemPointsAmount}
                  onChange={(e) => setRedeemPointsAmount(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-sm font-mono font-bold text-komazi-text focus:border-komazi-coral focus:outline-none"
                />
                <span className="text-[11px] text-komazi-muted mt-1 block">
                  Nilai Diskon: {formatRupiah(Number(redeemPointsAmount || 0) * 1000)}
                </span>
              </div>

              <div className="pt-2 flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setRedeemCustomer(null)}
                  className="flex-1 py-2.5 rounded-xl bg-komazi-surface-2 text-komazi-muted hover:text-white font-semibold text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={redeemCustomer.points <= 0}
                  className="flex-1 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark disabled:opacity-50 text-white font-bold text-xs shadow-md"
                >
                  Konfirmasi Tukar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Alert Modal */}
      <AlertModal
        isOpen={!!customerToDelete}
        onClose={() => setCustomerToDelete(null)}
        onConfirm={() => {
          if (customerToDelete) {
            deleteCustomer(customerToDelete.id);
            toast.success(`Member "${customerToDelete.name}" berhasil dihapus.`);
            setCustomerToDelete(null);
          }
        }}
        type="danger"
        title="Hapus Member Pelanggan?"
        message={`Apakah Anda yakin ingin menghapus "${customerToDelete?.name}" dari database member? Seluruh poin yang dimiliki akan hangus.`}
        confirmText="Ya, Hapus Member"
        cancelText="Batal"
      />
    </div>
  );
}
