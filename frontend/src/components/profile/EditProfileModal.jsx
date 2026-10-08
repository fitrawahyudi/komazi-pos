import React, { useState, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import {
  User,
  Camera,
  X,
  Check,
  Lock,
  Phone,
  Shield,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Sparkles,
  Loader2,
  LogOut,
} from 'lucide-react';

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
];

export default function EditProfileModal({ onClose }) {
  const { user, updateProfile, logout } = useAuthStore();
  const fileInputRef = useRef(null);

  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');

  // Password update fields
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Handle file upload strictly to Cloudinary
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Hanya file gambar (JPG, PNG, WebP) yang didukung');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Ukuran file maksimal 5 MB');
      return;
    }

    setErrorMsg('');
    setIsUploadingAvatar(true);

    try {
      const res = await api.upload(file);
      if (res && res.success && res.data?.url) {
        setAvatarUrl(res.data.url);
        setSuccessMsg('Foto profil berhasil diunggah');
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setErrorMsg(res?.message || 'Gagal mengunggah foto');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Gagal mengunggah foto');
    } finally {
      setIsUploadingAvatar(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!name.trim()) {
      setErrorMsg('Nama lengkap tidak boleh kosong');
      return;
    }

    if (!username.trim()) {
      setErrorMsg('Username tidak boleh kosong');
      return;
    }

    // Password validation if user entered password
    if (showPasswordSection && newPassword) {
      if (!currentPassword) {
        setErrorMsg('Masukkan password saat ini untuk memverifikasi penggantian password');
        return;
      }
      if (newPassword.length < 6) {
        setErrorMsg('Password baru minimal 6 karakter');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMsg('Konfirmasi password baru tidak cocok');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        username: username.trim().toLowerCase(),
        phone: phone.trim(),
        avatarUrl,
      };

      if (showPasswordSection && newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await updateProfile(payload);
      if (res.success) {
        setSuccessMsg('Profil dan foto berhasil diperbarui!');
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setErrorMsg(res.message || 'Gagal memperbarui profil');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    onClose();
    logout();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn select-none">
      <div className="w-full max-w-lg bg-komazi-surface border border-komazi-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-komazi-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-komazi-coral/15 flex items-center justify-center text-komazi-coral">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-komazi-text">Edit Profil Pengguna</h2>
              <p className="text-[11px] text-komazi-muted">
                Perbarui foto profil, nama, nomor kontak, dan password
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-komazi-muted hover:text-komazi-text hover:bg-komazi-surface-2 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-danger/15 border border-danger/30 text-danger text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-success/15 border border-success/30 text-success text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 1. Avatar & Photo Upload Section */}
          <div className="p-4 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-komazi-muted">
              Foto Profil
            </label>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Avatar Preview */}
              <div className="relative group shrink-0">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-komazi-surface border-2 border-komazi-border flex items-center justify-center shadow-lg relative">
                  {isUploadingAvatar ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-black/70 text-komazi-coral">
                      <Loader2 className="w-6 h-6 animate-spin text-komazi-coral" />
                      <span className="text-[9px] font-bold mt-1 text-white">Upload...</span>
                    </div>
                  ) : avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-xl text-komazi-coral bg-komazi-coral/10">
                      {name ? name.substring(0, 2).toUpperCase() : 'KM'}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 p-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white shadow-md transition-all active:scale-90"
                  title="Upload Foto"
                >
                  <Camera className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* Upload Controls & Presets */}
              <div className="space-y-2 flex-1 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl('')}
                      className="px-2.5 py-1.5 rounded-xl bg-danger/10 hover:bg-danger/20 border border-danger/30 text-danger text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] text-komazi-muted">Atau pilih avatar siap pakai:</p>
                  <div className="flex items-center justify-center sm:justify-start gap-1.5">
                    {AVATAR_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setAvatarUrl(preset)}
                        className={`w-7 h-7 rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${avatarUrl === preset ? 'border-komazi-coral scale-105' : 'border-transparent opacity-70 hover:opacity-100'
                          }`}
                      >
                        <img src={preset} alt="preset" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Personal Information */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-komazi-muted mb-1">
                Nama Lengkap:
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-komazi-muted absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
                  placeholder="Nama Lengkap Staf"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1">
                  Username Akun:
                </label>
                <div className="relative">
                  <span className="text-xs text-komazi-muted font-bold absolute left-3.5 top-2.5">@</span>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
                    placeholder="username"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1">
                  Nomor WhatsApp / HP:
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-komazi-muted absolute left-3.5 top-3" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
                    placeholder="0812-xxxx-xxxx"
                  />
                </div>
              </div>
            </div>

            {/* Read-only Role info */}
            <div>
              <label className="block text-xs font-semibold text-komazi-muted mb-1">
                Hak Akses / Role:
              </label>
              <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-komazi-teal-light" />
                  <span className="text-komazi-text font-bold">
                    {user?.role === 'OWNER'
                      ? 'Pemilik Outlet (Owner)'
                      : user?.role === 'MANAGER'
                        ? 'Supervisor / Manager'
                        : 'Kasir (Cashier)'}
                  </span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${user?.role === 'OWNER'
                    ? 'bg-komazi-coral/15 text-komazi-coral border border-komazi-coral/30'
                    : user?.role === 'MANAGER'
                      ? 'bg-komazi-teal/15 text-komazi-teal-light border border-komazi-teal/30'
                      : 'bg-komazi-surface text-komazi-muted border border-komazi-border'
                    }`}
                >
                  {user?.role}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Password Change Accordion */}
          <div className="pt-2 border-t border-komazi-border">
            <button
              type="button"
              onClick={() => setShowPasswordSection(!showPasswordSection)}
              className="w-full flex items-center justify-between py-2 text-xs font-bold text-komazi-coral hover:text-komazi-coral-light transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <KeyRound className="w-4 h-4" />
                <span>{showPasswordSection ? 'Tutup Pengaturan Password' : 'Ganti Password Akun (Opsional)'}</span>
              </div>
              <span className="text-[11px] font-normal text-komazi-muted">
                {showPasswordSection ? '▲' : '▼'}
              </span>
            </button>

            {showPasswordSection && (
              <div className="p-3.5 mt-2 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-3 animate-fadeIn">
                <div>
                  <label className="block text-[11px] font-semibold text-komazi-muted mb-1">
                    Password Saat Ini:
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full p-2.5 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-komazi-muted mb-1">
                      Password Baru:
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min. 6 Karakter"
                      className="w-full p-2.5 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-komazi-muted mb-1">
                      Konfirmasi Password:
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full p-2.5 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t border-komazi-border">
            <button
              type="button"
              onClick={handleLogout}
              className="px-4 py-2.5 rounded-xl bg-danger/10 hover:bg-danger/20 border border-danger/30 text-danger text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shrink-0"
              title="Keluar dari sesi saat ini / Ganti Akun"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar / Ganti Akun</span>
            </button>

            <button
              type="submit"
              disabled={isSubmitting || isUploadingAvatar}
              className="flex-1 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md disabled:opacity-50"
            >
              {isSubmitting || isUploadingAvatar ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isUploadingAvatar ? 'Mengunggah Foto...' : 'Menyimpan...'}</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Simpan Perubahan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
