import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Building2,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Check,
  CheckCircle2,
  X,
  Landmark,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Star,
  Save,
} from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { toast } from '../../store/toastStore';
import { formatAccountNumber } from '../../utils/format';

export const INDONESIAN_BANKS = [
  { code: 'BCA', label: 'BCA (Bank Central Asia)' },
  { code: 'Mandiri', label: 'Bank Mandiri' },
  { code: 'BRI', label: 'BRI (Bank Rakyat Indonesia)' },
  { code: 'BNI', label: 'BNI (Bank Negara Indonesia)' },
  { code: 'BSI', label: 'BSI (Bank Syariah Indonesia)' },
  { code: 'Bank Jago', label: 'Bank Jago' },
  { code: 'SeaBank', label: 'SeaBank' },
  { code: 'CIMB Niaga', label: 'CIMB Niaga' },
  { code: 'Permata', label: 'Permata Bank' },
  { code: 'OTHER', label: 'Bank Lainnya (Ketik Manual)' },
];

export function getBankBadgeStyle(bankName = '') {
  const normalized = String(bankName || '').toUpperCase();
  if (normalized.includes('BCA')) return 'bg-blue-600/20 text-blue-400 border-blue-500/30';
  if (normalized.includes('MANDIRI')) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  if (normalized.includes('BRI')) return 'bg-sky-600/20 text-sky-400 border-sky-500/30';
  if (normalized.includes('BNI')) return 'bg-orange-600/20 text-orange-400 border-orange-500/30';
  if (normalized.includes('BSI') || normalized.includes('SYARIAH')) return 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30';
  if (normalized.includes('JAGO')) return 'bg-purple-600/20 text-purple-400 border-purple-500/30';
  if (normalized.includes('SEABANK')) return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
  if (normalized.includes('CIMB')) return 'bg-rose-600/20 text-rose-400 border-rose-500/30';
  if (normalized.includes('PERMATA')) return 'bg-teal-600/20 text-teal-400 border-teal-500/30';
  return 'bg-komazi-coral/20 text-komazi-coral border-komazi-coral/30';
}

export default function BankTransferSettingsCard({ formState, setFormState }) {
  const {
    settings,
    updateSettings,
    addBankAccount,
    updateBankAccount,
    deleteBankAccount,
    setDefaultBankAccount,
  } = useSettingsStore();

  // Effective settings fallback to formState or store
  const sourceSettings = formState || settings;

  const [isEnabled, setIsEnabled] = useState(sourceSettings.bankTransferEnabled !== false);
  const [bankOption, setBankOption] = useState('BCA');
  const [customBankName, setCustomBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');

  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize and sync primary bank account fields
  useEffect(() => {
    const curSettings = formState || settings;
    setIsEnabled(curSettings.bankTransferEnabled !== false);

    const bName = curSettings.bankName || 'BCA';
    const matched = INDONESIAN_BANKS.find(
      (b) => b.code.toUpperCase() === bName.toUpperCase()
    );
    if (matched && matched.code !== 'OTHER') {
      setBankOption(matched.code);
      setCustomBankName('');
    } else {
      setBankOption('OTHER');
      setCustomBankName(bName);
    }

    setAccountNumber(curSettings.bankAccountNumber || '8291002931');
    setAccountName(curSettings.bankAccountName || (curSettings.storeName ? `PT ${curSettings.storeName.toUpperCase()}` : 'PT KOMAZI KREATIF BERSAMA'));
  }, [formState, settings]);

  // Bank accounts list
  const rawAccounts = sourceSettings.bankAccounts || settings.bankAccounts || [];
  const bankAccounts = Array.isArray(rawAccounts) && rawAccounts.length > 0
    ? rawAccounts
    : [
        {
          id: 'bank-1',
          bankName: sourceSettings.bankName || settings.bankName || 'BCA',
          accountNumber: sourceSettings.bankAccountNumber || settings.bankAccountNumber || '8291002931',
          accountName: sourceSettings.bankAccountName || settings.bankAccountName || 'PT KOMAZI KREATIF BERSAMA',
          isDefault: true,
        },
      ];

  // Modals state for additional/multi accounts
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [targetDelete, setTargetDelete] = useState(null);

  // Modal Form State
  const [modalBankOption, setModalBankOption] = useState('BCA');
  const [modalCustomBank, setModalCustomBank] = useState('');
  const [modalAccNo, setModalAccNo] = useState('');
  const [modalAccName, setModalAccName] = useState('');
  const [modalIsDefault, setModalIsDefault] = useState(false);
  const [isModalSubmitting, setIsModalSubmitting] = useState(false);

  // Clipboard copy state
  const [copiedId, setCopiedId] = useState(null);

  // Interactive preview cashier bank selection
  const [previewActiveBankId, setPreviewActiveBankId] = useState(() => {
    const def = bankAccounts.find((b) => b.isDefault);
    return def ? def.id : bankAccounts[0]?.id;
  });

  const handleCopyAccount = (id, text) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    toast.success(`Nomor rekening ${text} disalin!`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // -------------------------------------------------------------
  // SAVE PRIMARY BANK ACCOUNT (Direct from card)
  // -------------------------------------------------------------
  const handleSavePrimaryBank = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();

    const finalBankName =
      bankOption === 'OTHER' ? customBankName.trim() : bankOption;

    if (!finalBankName) {
      toast.error('Silakan pilih atau ketik nama bank');
      return;
    }

    const cleanAccNo = accountNumber.replace(/[^0-9]/g, '').trim();
    if (!cleanAccNo || cleanAccNo.length < 5) {
      toast.error('Nomor rekening minimal 5 digit angka');
      return;
    }

    if (!accountName.trim()) {
      toast.error('Nama pemilik rekening (atas nama) wajib diisi');
      return;
    }

    setIsSaving(true);
    try {
      const finalAccName = accountName.trim().toUpperCase();

      // Update the default account in the bankAccounts list, or create one
      const existingList = bankAccounts.map((b) => ({ ...b }));
      const defaultIdx = existingList.findIndex((b) => b.isDefault);

      let updatedList;
      if (defaultIdx >= 0) {
        existingList[defaultIdx] = {
          ...existingList[defaultIdx],
          bankName: finalBankName,
          accountNumber: cleanAccNo,
          accountName: finalAccName,
          isDefault: true,
        };
        updatedList = existingList;
      } else if (existingList.length > 0) {
        existingList[0] = {
          ...existingList[0],
          bankName: finalBankName,
          accountNumber: cleanAccNo,
          accountName: finalAccName,
          isDefault: true,
        };
        updatedList = existingList;
      } else {
        updatedList = [
          {
            id: 'bank-1',
            bankName: finalBankName,
            accountNumber: cleanAccNo,
            accountName: finalAccName,
            isDefault: true,
          },
        ];
      }

      const updates = {
        bankTransferEnabled: isEnabled,
        bankName: finalBankName,
        bankAccountNumber: cleanAccNo,
        bankAccountName: finalAccName,
        bankAccounts: updatedList,
      };

      // 1. Update in settingsStore & persist to backend
      await updateSettings(updates);

      // 2. Sync to parent formState if available
      if (typeof setFormState === 'function') {
        setFormState((prev) => ({
          ...prev,
          ...updates,
        }));
      }

      setIsSaved(true);
      toast.success('Rekening Bank Toko berhasil disimpan!');
      setTimeout(() => setIsSaved(false), 2500);
    } catch (err) {
      toast.error('Gagal menyimpan rekening: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // -------------------------------------------------------------
  // MODAL HANDLERS FOR ADDITIONAL / MULTI ACCOUNTS
  // -------------------------------------------------------------
  const handleOpenAddModal = () => {
    setEditingItem(null);
    setModalBankOption('BCA');
    setModalCustomBank('');
    setModalAccNo('');
    setModalAccName(accountName || (settings.storeName ? `PT ${settings.storeName.toUpperCase()}` : ''));
    setModalIsDefault(bankAccounts.length === 0);
    setShowAddEditModal(true);
  };

  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    const matched = INDONESIAN_BANKS.find(
      (b) => b.code.toUpperCase() === item.bankName?.toUpperCase()
    );
    if (matched && matched.code !== 'OTHER') {
      setModalBankOption(matched.code);
      setModalCustomBank('');
    } else {
      setModalBankOption('OTHER');
      setModalCustomBank(item.bankName || '');
    }
    setModalAccNo(item.accountNumber || '');
    setModalAccName(item.accountName || '');
    setModalIsDefault(Boolean(item.isDefault));
    setShowAddEditModal(true);
  };

  const handleSaveModalAccount = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();

    const finalBankName =
      modalBankOption === 'OTHER' ? modalCustomBank.trim() : modalBankOption;

    if (!finalBankName) {
      toast.error('Silakan tentukan nama bank');
      return;
    }

    const cleanAccNo = modalAccNo.replace(/[^0-9]/g, '').trim();
    if (!cleanAccNo || cleanAccNo.length < 5) {
      toast.error('Nomor rekening minimal 5 digit angka');
      return;
    }

    if (!modalAccName.trim()) {
      toast.error('Nama pemilik rekening (atas nama) wajib diisi');
      return;
    }

    setIsModalSubmitting(true);
    try {
      const finalAccName = modalAccName.trim().toUpperCase();

      if (editingItem) {
        await updateBankAccount(editingItem.id, {
          bankName: finalBankName,
          accountNumber: cleanAccNo,
          accountName: finalAccName,
          isDefault: modalIsDefault,
        });
        toast.success(`Rekening ${finalBankName} berhasil diperbarui!`);
      } else {
        await addBankAccount({
          bankName: finalBankName,
          accountNumber: cleanAccNo,
          accountName: finalAccName,
          isDefault: modalIsDefault,
        });
        toast.success(`Rekening ${finalBankName} berhasil ditambahkan!`);
      }

      // Sync formState if default was updated
      if (modalIsDefault && typeof setFormState === 'function') {
        setFormState((prev) => ({
          ...prev,
          bankName: finalBankName,
          bankAccountNumber: cleanAccNo,
          bankAccountName: finalAccName,
        }));
      }

      setShowAddEditModal(false);
    } catch (err) {
      toast.error('Gagal menyimpan rekening: ' + err.message);
    } finally {
      setIsModalSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!targetDelete) return;
    try {
      await deleteBankAccount(targetDelete.id);
      toast.success(`Rekening ${targetDelete.bankName} telah dihapus`);
      setShowDeleteModal(false);
      setTargetDelete(null);
    } catch (err) {
      toast.error('Gagal menghapus rekening: ' + err.message);
    }
  };

  const handleSetDefault = async (item) => {
    try {
      await setDefaultBankAccount(item.id);
      setBankOption(item.bankName);
      setAccountNumber(item.accountNumber);
      setAccountName(item.accountName);
      if (typeof setFormState === 'function') {
        setFormState((prev) => ({
          ...prev,
          bankName: item.bankName,
          bankAccountNumber: item.accountNumber,
          bankAccountName: item.accountName,
        }));
      }
      toast.success(`${item.bankName} dijadikan rekening utama kasir`);
    } catch (err) {
      toast.error('Gagal mengubah rekening utama: ' + err.message);
    }
  };

  const activePreviewBank =
    bankAccounts.find((b) => b.id === previewActiveBankId) ||
    bankAccounts.find((b) => b.isDefault) ||
    bankAccounts[0];

  return (
    <div className="p-5 rounded-2xl bg-komazi-surface border border-komazi-border space-y-5">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-komazi-border pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-komazi-teal/15 flex items-center justify-center text-komazi-teal-light">
            <Building2 className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-komazi-text flex items-center gap-2">
              <span>Konfigurasi Transfer Bank Toko</span>
            </h2>
            <p className="text-[11px] text-komazi-muted">
              Kelola nomor rekening bank untuk pembayaran pesanan di kasir POS dan struk tagihan
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs font-semibold text-komazi-muted">Aktifkan di Kasir:</span>
            <div className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => {
                  const val = e.target.checked;
                  setIsEnabled(val);
                  if (typeof setFormState === 'function') {
                    setFormState((prev) => ({ ...prev, bankTransferEnabled: val }));
                  }
                }}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-komazi-surface-2 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-komazi-coral"></div>
            </div>
          </label>
        </div>
      </div>

      {/* 2. Status Banner if Disabled */}
      {!isEnabled && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            Metode transfer bank saat ini <b>dinonaktifkan</b> di layar kasir. Kasir hanya akan menampilkan pilihan Tunai dan QRIS.
          </span>
        </div>
      )}

      {/* 3. Formulir Rekening Utama Toko (Direct Form on Card) */}
      <div className="space-y-4 pt-1">
        <div className="flex items-center justify-between border-b border-komazi-border/50 pb-2">
          <span className="text-xs font-bold text-komazi-text flex items-center gap-2">
            <Landmark className="w-4 h-4 text-komazi-coral" />
            <span>Informasi Rekening Utama Kasir</span>
          </span>
          <span className="text-[10px] text-komazi-muted">
            Tampil otomatis saat kasir memilih metode Transfer Bank
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Pilih Bank */}
          <div>
            <label className="block text-xs font-semibold text-komazi-muted mb-1">
              Nama Bank:
            </label>
            <select
              value={bankOption}
              onChange={(e) => setBankOption(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
            >
              {INDONESIAN_BANKS.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>

          {/* Nomor Rekening */}
          <div>
            <label className="block text-xs font-semibold text-komazi-muted mb-1">
              Nomor Rekening:
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: 8291002931"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none font-mono"
            />
          </div>

          {/* Atas Nama */}
          <div>
            <label className="block text-xs font-semibold text-komazi-muted mb-1">
              Atas Nama (Pemilik):
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: PT KOMAZI KREATIF BERSAMA"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none uppercase"
            />
          </div>
        </div>

        {/* Input Bank Kustom jika 'OTHER' dipilih */}
        {bankOption === 'OTHER' && (
          <div className="max-w-sm">
            <label className="block text-xs font-semibold text-komazi-muted mb-1">
              Ketik Nama Bank:
            </label>
            <input
              type="text"
              placeholder="Contoh: Bank Danamon / Bank Neo"
              value={customBankName}
              onChange={(e) => setCustomBankName(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
            />
          </div>
        )}

        {/* Tombol Simpan Rekening Bank (Direct Card Action) */}
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={handleSavePrimaryBank}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {isSaved ? (
              <Check className="w-4 h-4 stroke-[3]" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>
              {isSaved
                ? 'Berhasil Disimpan!'
                : isSaving
                ? 'Menyimpan...'
                : 'Simpan Rekening Bank'}
            </span>
          </button>
        </div>
      </div>

      {/* 4. Rekening Tambahan & Multi-Rekening (Jika ada lebih dari 1 bank) */}
      <div className="space-y-3 pt-3 border-t border-komazi-border/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-komazi-text">Daftar Rekening Outlet</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-komazi-surface-2 border border-komazi-border text-komazi-muted">
              {bankAccounts.length} Rekening Terdaftar
            </span>
          </div>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-coral/20 hover:text-komazi-coral border border-komazi-border text-komazi-text font-bold text-xs transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Tambah Rekening Lain</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {bankAccounts.map((account) => {
            const badgeStyle = getBankBadgeStyle(account.bankName);
            const isDef = Boolean(account.isDefault);

            return (
              <div
                key={account.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  isDef
                    ? 'bg-komazi-surface-2/90 border-komazi-coral/50 shadow-sm ring-1 ring-komazi-coral/20'
                    : 'bg-komazi-surface-2/50 border-komazi-border hover:border-komazi-muted/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black uppercase tracking-wider border ${badgeStyle}`}>
                      {account.bankName}
                    </span>
                    {isDef && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-komazi-coral/15 text-komazi-coral border border-komazi-coral/30">
                        <Star className="w-2.5 h-2.5 fill-current" />
                        <span>Utama</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(account)}
                      className="p-1.5 rounded-lg text-komazi-muted hover:text-white hover:bg-komazi-surface transition-colors"
                      title="Ubah data rekening"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {bankAccounts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setTargetDelete(account);
                          setShowDeleteModal(true);
                        }}
                        className="p-1.5 rounded-lg text-komazi-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Hapus rekening"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1 mb-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-sm text-komazi-text tracking-wide">
                      {formatAccountNumber(account.accountNumber)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyAccount(account.id, account.accountNumber)}
                      className="flex items-center gap-1 text-[11px] text-komazi-teal-light hover:underline font-semibold"
                    >
                      {copiedId === account.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Salin</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-komazi-muted truncate">
                    a.n. <span className="font-bold text-neutral-300">{account.accountName}</span>
                  </p>
                </div>

                {!isDef && (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(account)}
                    className="w-full py-1.5 px-3 rounded-lg bg-komazi-surface hover:bg-komazi-coral/10 hover:text-komazi-coral text-[11px] font-semibold text-komazi-muted border border-komazi-border transition-colors text-center cursor-pointer"
                  >
                    Jadikan Rekening Utama Kasir
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Live Interactive Cashier Preview */}
      <div className="p-4 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-3">
        <div className="flex items-center justify-between border-b border-komazi-border/60 pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-komazi-coral" />
            <span className="text-xs font-bold text-komazi-text">
              Pratinjau Layar Kasir (Saat Transfer Bank Dipilih)
            </span>
          </div>
          <span className="text-[10px] text-komazi-muted">Simulasi tampilan checkout POS</span>
        </div>

        {/* Bank Selection Pills (if multiple banks) */}
        {bankAccounts.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-[11px] text-komazi-muted shrink-0">Pilih Bank:</span>
            {bankAccounts.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setPreviewActiveBankId(b.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border shrink-0 ${
                  activePreviewBank?.id === b.id
                    ? 'bg-komazi-coral text-white border-komazi-coral shadow-sm'
                    : 'bg-komazi-surface text-komazi-muted border-komazi-border hover:text-komazi-text'
                }`}
              >
                {b.bankName}
              </button>
            ))}
          </div>
        )}

        {/* Selected Bank Details Box */}
        {activePreviewBank && (
          <div className="p-3.5 rounded-xl bg-komazi-surface border border-komazi-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-komazi-text flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${getBankBadgeStyle(activePreviewBank.bankName)}`}>
                  {activePreviewBank.bankName}
                </span>
                <span>Rekening Resmi Outlet</span>
              </span>
              <button
                type="button"
                onClick={() => handleCopyAccount('preview', activePreviewBank.accountNumber)}
                className="flex items-center gap-1 text-[11px] text-komazi-teal-light font-semibold hover:underline"
              >
                {copiedId === 'preview' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Rekening</span>
                  </>
                )}
              </button>
            </div>
            <p className="font-mono font-black text-lg text-komazi-coral tracking-wider">
              {formatAccountNumber(activePreviewBank.accountNumber)}
            </p>
            <p className="text-[11px] text-komazi-muted">
              a.n. <span className="text-komazi-text font-bold">{activePreviewBank.accountName}</span>
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 text-[11px] text-komazi-muted pt-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Kasir memverifikasi mutasi rekening di m-banking sebelum menekan tombol konfirmasi bayar.</span>
        </div>
      </div>

      {/* 6. Modal Tambah / Ubah Rekening Bank (Using standalone DIV without form nesting) */}
      {showAddEditModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="w-full max-w-md rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-komazi-border">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-komazi-coral" />
                <h3 className="font-bold text-sm text-komazi-text">
                  {editingItem ? 'Ubah Rekening Bank' : 'Tambah Rekening Bank'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddEditModal(false)}
                className="p-1 rounded-lg text-komazi-muted hover:text-white hover:bg-komazi-surface-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div
              className="p-4 space-y-4"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveModalAccount(e);
                }
              }}
            >
              {/* Select Bank */}
              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1">
                  Nama Bank:
                </label>
                <select
                  value={modalBankOption}
                  onChange={(e) => setModalBankOption(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
                >
                  {INDONESIAN_BANKS.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Bank Name Input */}
              {modalBankOption === 'OTHER' && (
                <div>
                  <label className="block text-xs font-semibold text-komazi-muted mb-1">
                    Ketik Nama Bank:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Bank Danamon / Bank Neo"
                    value={modalCustomBank}
                    onChange={(e) => setModalCustomBank(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
                  />
                </div>
              )}

              {/* Account Number */}
              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1">
                  Nomor Rekening:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 8291002931"
                  value={modalAccNo}
                  onChange={(e) => setModalAccNo(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none font-mono"
                />
                <p className="text-[10px] text-komazi-muted mt-1">
                  Hanya angka tanpa spasi atau tanda hubung.
                </p>
              </div>

              {/* Account Holder Name */}
              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1">
                  Atas Nama (Pemilik Rekening):
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: PT KOMAZI KREATIF BERSAMA"
                  value={modalAccName}
                  onChange={(e) => setModalAccName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none uppercase"
                />
              </div>

              {/* Is Default Checkbox */}
              <label className="flex items-center gap-2 p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border cursor-pointer">
                <input
                  type="checkbox"
                  checked={modalIsDefault}
                  onChange={(e) => setModalIsDefault(e.target.checked)}
                  className="w-4 h-4 rounded text-komazi-coral focus:ring-0 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-bold text-komazi-text block">Jadikan Rekening Utama</span>
                  <span className="text-[11px] text-komazi-muted block">
                    Otomatis dipilih saat kasir membuka opsi Transfer Bank
                  </span>
                </div>
              </label>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="px-4 py-2 rounded-xl bg-komazi-surface-2 text-komazi-muted hover:text-white text-xs font-semibold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveModalAccount}
                  disabled={isModalSubmitting}
                  className="px-5 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isModalSubmitting ? 'Menyimpan...' : 'Simpan Rekening'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal Hapus Rekening */}
      {showDeleteModal && targetDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="w-full max-w-sm rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-komazi-text">Hapus Rekening?</h3>
                <p className="text-xs text-komazi-muted">
                  Hapus rekening <b className="text-white">{targetDelete.bankName} - {targetDelete.accountNumber}</b>?
                </p>
              </div>
            </div>

            <p className="text-[11px] text-komazi-muted leading-relaxed">
              Tindakan ini tidak dapat dibatalkan. Rekening ini tidak akan muncul lagi di pilihan transfer bank kasir.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl bg-komazi-surface-2 text-komazi-muted hover:text-white text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold shadow-md active:scale-95"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
