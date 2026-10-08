import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import KomaziLogo from '../components/ui/KomaziLogo';
import {
  Lock,
  User,
  LogIn,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  X,
  AlertCircle,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, resetPasswordWithPin } = useAuthStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: username verify, 2: pin & new password
  const [forgotUsername, setForgotUsername] = useState('');
  const [verifiedUserInfo, setVerifiedUserInfo] = useState(null);
  const [securityPin, setSecurityPin] = useState('1234');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      const res = await login(username, password);
      if (res.success) {
        if (res.user?.role === 'KITCHEN' || res.user?.role === 'BARISTA') {
          navigate('/kds-screen');
        } else {
          navigate('/pos');
        }
      } else {
        setErrorMsg(res.message || 'Username atau password salah');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat masuk');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Forgot Password
  const openForgotPassword = () => {
    setForgotStep(1);
    setForgotUsername(username || '');
    setVerifiedUserInfo(null);
    setSecurityPin('1234');
    setNewPassword('');
    setConfirmPassword('');
    setForgotError('');
    setForgotSuccess('');
    setShowForgotModal(true);
  };

  // Step 1: Verify Username
  const handleVerifyUsername = async (e) => {
    e.preventDefault();
    setForgotError('');
    if (!forgotUsername.trim()) {
      setForgotError('Masukkan username atau ID kasir Anda');
      return;
    }

    try {
      // Check backend API verification
      const res = await api.auth.verifyReset(forgotUsername.trim());
      if (res && res.success && res.data) {
        setVerifiedUserInfo(res.data);
        setForgotStep(2);
        return;
      }
    } catch {
      // Backend not responding, check local store
    }

    // Local fallback check
    const currentUsers = useAuthStore.getState().users || [];
    const found = currentUsers.find(
      (u) => u.username.toLowerCase() === forgotUsername.trim().toLowerCase()
    );

    if (found) {
      setVerifiedUserInfo({
        name: found.name,
        username: found.username,
        role: found.role,
      });
      setForgotStep(2);
    } else {
      setForgotError('Akun dengan username tersebut tidak ditemukan');
    }
  };

  // Step 2: Submit Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!securityPin.trim()) {
      setForgotError('Masukkan PIN keamanan outlet / supervisor (default: 1234)');
      return;
    }

    if (newPassword.length < 6) {
      setForgotError('Password baru minimal 6 karakter');
      return;
    }

    if (newPassword !== confirmPassword) {
      setForgotError('Konfirmasi password tidak cocok');
      return;
    }

    setIsResetting(true);
    try {
      const res = await resetPasswordWithPin({
        username: forgotUsername.trim(),
        securityPin: securityPin.trim(),
        newPassword,
      });

      if (res.success) {
        setForgotSuccess('Password berhasil direset! Silakan masuk dengan password baru.');
        setPassword(newPassword);
        setUsername(forgotUsername.trim());
        setTimeout(() => {
          setShowForgotModal(false);
        }, 2000);
      } else {
        setForgotError(res.message || 'Gagal mereset password');
      }
    } catch (err) {
      setForgotError(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-komazi-black px-4 relative select-none">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-komazi-coral/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-komazi-teal/5 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Brand Logo Header */}
        <div className="flex flex-col items-center justify-center text-center space-y-2">
          <KomaziLogo size="lg" />
          <p className="text-xs text-komazi-muted max-w-xs pt-1">
            Point of Sale & Collaborative Workspace Management System
          </p>
        </div>

        {/* Login Box */}
        <div className="p-7 rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl space-y-5">
          <div className="space-y-1">
            <h2 className="font-bold text-lg text-komazi-text">Masuk ke Sistem Kasir</h2>
            <p className="text-xs text-komazi-muted">
              Gunakan akun kasir, manager, atau pemilik outlet untuk melanjutkan.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-danger/15 border border-danger/30 text-danger text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-komazi-muted mb-1.5">
                Username / ID Kasir:
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-komazi-muted absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none transition-colors"
                  placeholder="kasir / manager / owner"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-komazi-muted">
                  Password:
                </label>
                <button
                  type="button"
                  onClick={openForgotPassword}
                  className="text-xs text-komazi-coral hover:text-komazi-coral-light font-semibold hover:underline flex items-center gap-1 transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Lupa Password?</span>
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-komazi-muted absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-komazi-coral/25 active:scale-98 transition-all disabled:opacity-50"
            >
              <LogIn className="w-4 h-4 stroke-[2.5]" />
              <span>{isSubmitting ? 'Memeriksa...' : 'Masuk Sekarang'}</span>
            </button>

            {/* Quick Demo Credentials */}
            <div className="pt-2 space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-komazi-muted tracking-wider block text-center">
                Pilih Akun Cepat (Demo):
              </span>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setUsername('kasir');
                    setPassword('password123');
                  }}
                  className="p-1.5 rounded-lg bg-komazi-surface-2 hover:bg-komazi-border border border-komazi-border text-komazi-muted hover:text-white transition-colors text-left"
                >
                  <p className="font-bold text-komazi-text">Kasir</p>
                  <p className="text-[10px] text-komazi-muted">@kasir • POS Kasir</p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUsername('dapur');
                    setPassword('password123');
                  }}
                  className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 transition-colors text-left"
                >
                  <p className="font-bold text-amber-300">Dapur</p>
                  <p className="text-[10px] opacity-80">@dapur • Hanya KDS</p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUsername('barista');
                    setPassword('password123');
                  }}
                  className="p-1.5 rounded-lg bg-komazi-teal/10 hover:bg-komazi-teal/20 border border-komazi-teal/30 text-komazi-teal-light transition-colors text-left"
                >
                  <p className="font-bold text-komazi-teal-light">Barista</p>
                  <p className="text-[10px] opacity-80">@barista • Hanya KDS Bar</p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUsername('manager');
                    setPassword('password123');
                  }}
                  className="p-1.5 rounded-lg bg-komazi-surface-2 hover:bg-komazi-border border border-komazi-border text-komazi-muted hover:text-white transition-colors text-left"
                >
                  <p className="font-bold text-komazi-text">Manager</p>
                  <p className="text-[10px] text-komazi-muted">@manager • Stok & Shift</p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUsername('owner');
                    setPassword('password123');
                  }}
                  className="p-1.5 rounded-lg bg-komazi-surface-2 hover:bg-komazi-border border border-komazi-border text-komazi-muted hover:text-white transition-colors text-left"
                >
                  <p className="font-bold text-komazi-text">Owner</p>
                  <p className="text-[10px] text-komazi-muted">@owner • Akses Penuh</p>
                </button>
              </div>
            </div>
          </form>

          {/* Security & Access Notice */}
          <div className="pt-3 border-t border-komazi-border text-center space-y-1.5">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-komazi-muted">
              <ShieldCheck className="w-3.5 h-3.5 text-komazi-teal-light" />
              <span className="font-semibold text-komazi-text">Akses Terotorisasi & Hak Akses Ketat</span>
            </div>
            <p className="text-[11px] text-komazi-muted leading-relaxed">
              Setiap staf masuk menggunakan akun masing-masing. Hak akses menu, stok, laporan, dan pengaturan ditentukan secara otomatis oleh sistem berdasarkan akun terdaftar.
            </p>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-komazi-muted">
          Komazi POS v1.0 • Coffee & Workspace System
        </p>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-komazi-surface border border-komazi-border rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-komazi-coral/15 flex items-center justify-center text-komazi-coral">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-komazi-text">Reset Password Staf</h3>
                  <p className="text-[11px] text-komazi-muted">
                    Pemulihan mandiri dengan PIN Pengawas / Outlet
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowForgotModal(false)}
                className="p-1.5 rounded-lg text-komazi-muted hover:text-komazi-text hover:bg-komazi-surface-2 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {forgotError && (
              <div className="p-3 rounded-xl bg-danger/15 border border-danger/30 text-danger text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccess && (
              <div className="p-3 rounded-xl bg-success/15 border border-success/30 text-success text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{forgotSuccess}</span>
              </div>
            )}

            {/* Step 1: Input username */}
            {forgotStep === 1 && (
              <form onSubmit={handleVerifyUsername} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-komazi-muted mb-1.5">
                    Masukkan Username Akun Anda:
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-komazi-muted absolute left-3.5 top-3" />
                    <input
                      type="text"
                      autoFocus
                      required
                      value={forgotUsername}
                      onChange={(e) => setForgotUsername(e.target.value)}
                      placeholder="contoh: kasir / manager"
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-muted text-xs font-bold transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md"
                  >
                    <span>Lanjut Verifikasi</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}

            {/* Step 2: Verification PIN & New Password */}
            {forgotStep === 2 && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                {verifiedUserInfo && (
                  <div className="p-2.5 rounded-xl bg-komazi-teal/10 border border-komazi-teal/30 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[11px] text-komazi-muted">Akun ditemukan: </span>
                      <span className="font-bold text-komazi-text">{verifiedUserInfo.name}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-komazi-teal/20 text-komazi-teal-light">
                      {verifiedUserInfo.role}
                    </span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-komazi-muted">
                      PIN Keamanan Outlet / Supervisor:
                    </label>
                    <span className="text-[10px] text-komazi-coral font-bold bg-komazi-coral/10 px-1.5 py-0.5 rounded">
                      Default: 1234
                    </span>
                  </div>
                  <input
                    type="password"
                    required
                    maxLength={8}
                    value={securityPin}
                    onChange={(e) => setSecurityPin(e.target.value)}
                    placeholder="PIN Keamanan Toko (1234)"
                    className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text font-mono tracking-widest focus:border-komazi-coral outline-none"
                  />
                  <p className="text-[10px] text-komazi-muted mt-1">
                    Untuk keamanan outlet, reset password memerlukan otorisasi PIN pengawas/outlet.
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-komazi-muted mb-1">
                      Password Baru (Minimal 6 Karakter):
                    </label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-komazi-muted mb-1">
                      Konfirmasi Password Baru:
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    className="flex-1 py-2.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-muted text-xs font-bold transition-colors"
                  >
                    Kembali
                  </button>
                  <button
                    type="submit"
                    disabled={isResetting}
                    className="flex-1 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md disabled:opacity-50"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>{isResetting ? 'Menyimpan...' : 'Simpan Password Baru'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
