import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import {
  KeyRound,
  X,
  Copy,
  Check,
  ShieldAlert,
  ShieldCheck,
  Clock,
  AlertCircle,
  RefreshCw,
  Ban,
  User,
  ExternalLink,
} from 'lucide-react';

export default function OwnerResetPasswordModal({ targetUser, onClose, onSuccess }) {
  const { createResetToken, revokeResetToken, getResetTokenStatus } = useAuthStore();

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successResult, setSuccessResult] = useState(null); // { rawToken, resetUrl, expiresAt }
  const [tokenStatus, setTokenStatus] = useState(null); // { hasActiveToken, expiresAt }
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  // Cek apakah user saat ini sedang memiliki token aktif
  useEffect(() => {
    if (!targetUser?.id) return;
    getResetTokenStatus(targetUser.id).then((status) => {
      setTokenStatus(status);
    });
  }, [targetUser, getResetTokenStatus]);

  // Handle pembuatan token reset
  const handleGenerateToken = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await createResetToken(targetUser.id);
      if (res.success && res.data) {
        setSuccessResult(res.data);
        setTokenStatus({ hasActiveToken: true, expiresAt: res.data.expiresAt });
        onSuccess?.();
      } else {
        setErrorMsg(res.message || 'Gagal menerbitkan token reset');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle pencabutan token aktif
  const handleRevokeToken = async () => {
    if (!window.confirm(`Batalkan token reset aktif untuk @${targetUser.username}?`)) return;
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await revokeResetToken(targetUser.id);
      if (res.success) {
        setTokenStatus({ hasActiveToken: false });
        setSuccessResult(null);
      } else {
        setErrorMsg(res.message || 'Gagal membatalkan token');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!successResult?.resetUrl) return;
    navigator.clipboard?.writeText(successResult.resetUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyToken = () => {
    if (!successResult?.rawToken) return;
    navigator.clipboard?.writeText(successResult.rawToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  if (!targetUser) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-komazi-surface border border-komazi-border rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-7 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-komazi-coral/15 flex items-center justify-center text-komazi-coral shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-komazi-text">
                Otorisasi Reset Password Staf
              </h3>
              <p className="text-[11px] text-komazi-muted">
                Penerbitan token pemulihan satu kali pakai oleh Owner
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-komazi-muted hover:text-komazi-text hover:bg-komazi-surface-2 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target User Info Badge */}
        <div className="p-3.5 rounded-2xl bg-komazi-surface-2 border border-komazi-border flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-neutral-800 text-komazi-text font-bold flex items-center justify-center text-xs">
              <User className="w-4 h-4 text-komazi-muted" />
            </div>
            <div>
              <p className="font-bold text-komazi-text">{targetUser.name}</p>
              <p className="text-[11px] text-komazi-muted font-mono">@{targetUser.username}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-komazi-border text-komazi-text">
              {targetUser.role}
            </span>
            {targetUser.isActive ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Aktif
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-danger/10 text-danger border border-danger/20">
                Nonaktif
              </span>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 rounded-2xl bg-danger/10 border border-danger/30 text-danger text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* State A: Token Generated Successfully (Tampil Hanya Sekali) */}
        {successResult ? (
          <div className="space-y-4 animate-fadeIn">
            {/* Warning Banner */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-amber-400">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Peringatan Keamanan Owner</span>
              </div>
              <p className="text-[11px] text-neutral-300 leading-relaxed">
                Tautan dan kode ini <strong>hanya ditampilkan satu kali</strong> dan tidak dapat diambil kembali setelah jendela ini ditutup. Sampaikan hanya melalui saluran komunikasi pribadi yang aman (misal: pesan langsung/WhatsApp staf).
              </p>
            </div>

            {/* URL Tautan Reset Lengkap */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-komazi-muted flex items-center justify-between">
                <span>Tautan Reset Password:</span>
                <span className="text-[10.5px] text-emerald-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Berlaku 15 Menit
                </span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={successResult.resetUrl}
                  className="flex-1 p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-[11px] text-komazi-text font-mono truncate select-all outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3.5 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-md"
                >
                  {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? 'Tersalin' : 'Salin Tautan'}</span>
                </button>
              </div>
            </div>

            {/* Kode Token Mentah */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-komazi-muted">
                Kode Token (Jika staf memasukkan manual):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={successResult.rawToken}
                  className="flex-1 p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-[10.5px] text-komazi-text font-mono truncate select-all outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className="px-3 py-2.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-text font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer"
                >
                  {copiedToken ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedToken ? 'Tersalin' : 'Salin Kode'}</span>
                </button>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-2xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-text text-xs font-bold transition-colors cursor-pointer"
              >
                Selesai &amp; Tutup Jendela
              </button>
            </div>
          </div>
        ) : (
          /* State B: Pre-generation Confirmation */
          <div className="space-y-4">
            {/* Active Token Notice if exists */}
            {tokenStatus?.hasActiveToken && (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>Staf ini sudah memiliki token reset aktif.</span>
                </div>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleRevokeToken}
                  className="px-2.5 py-1 rounded-lg bg-danger/15 hover:bg-danger/25 text-danger font-bold text-[10.5px] flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Ban className="w-3 h-3" />
                  <span>Batalkan Token</span>
                </button>
              </div>
            )}

            {/* Explanatory Rules */}
            <div className="p-4 rounded-2xl bg-komazi-surface-2/60 border border-komazi-border text-xs space-y-2 text-komazi-muted">
              <p className="font-semibold text-komazi-text flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-komazi-coral" />
                <span>Ketentuan Pemulihan Akun:</span>
              </p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-neutral-300">
                <li>Token berlaku selama <strong>15 menit</strong> dan hanya bisa dipakai satu kali.</li>
                <li>Setelah password diubah, seluruh sesi login aktif staf di perangkat lain akan dicabut otomatis.</li>
                <li>Demi alasan keamanan, token rahasia ini dienkripsi dan tidak dapat ditampilkan ulang setelah Anda menutup jendela ini.</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={isLoading}
                onClick={handleGenerateToken}
                className="flex-1 py-3 rounded-2xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-komazi-coral/20 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Menerbitkan...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>{tokenStatus?.hasActiveToken ? 'Generate Token Baru' : 'Generate Token Reset'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
