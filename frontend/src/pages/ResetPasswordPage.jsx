import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import KomaziLogo from '../components/ui/KomaziLogo';
import LoadingButton from '../components/ui/loading/LoadingButton';
import {
  KeyRound,
  Lock,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowLeft,
  ShieldCheck,
  User,
  Clock,
  ExternalLink,
} from 'lucide-react';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';

  const { verifyResetToken, completePasswordReset } = useAuthStore();

  const [tokenInput, setTokenInput] = useState(tokenFromUrl);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isVerifying, setIsVerifying] = useState(false);
  const [tokenInfo, setTokenInfo] = useState(null); // { valid, username, name, expiresAt }
  const [tokenError, setTokenError] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Auto-verify token when URL param or input changes
  useEffect(() => {
    const rawToken = tokenInput.trim();
    if (!rawToken) {
      setTokenInfo(null);
      setTokenError('');
      return;
    }

    let isMounted = true;
    setIsVerifying(true);
    setTokenError('');

    verifyResetToken(rawToken)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          setTokenInfo(res.data);
          setTokenError('');
        } else {
          setTokenInfo(null);
          setTokenError(res.message || 'Token tidak valid atau sudah kedaluwarsa');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setTokenInfo(null);
        setTokenError(err.message || 'Gagal memverifikasi token');
      })
      .finally(() => {
        if (isMounted) setIsVerifying(false);
      });

    return () => {
      isMounted = false;
    };
  }, [tokenInput, verifyResetToken]);

  // Password strength helper
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: 'Kosong', color: 'bg-komazi-border' };
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 1) return { score: 1, label: 'Lemah', color: 'bg-danger' };
    if (score === 2) return { score: 2, label: 'Cukup', color: 'bg-amber-500' };
    if (score === 3) return { score: 3, label: 'Kuat', color: 'bg-emerald-500' };
    return { score: 4, label: 'Sangat Kuat', color: 'bg-komazi-coral' };
  };

  const strength = getPasswordStrength(newPassword);
  const isMatch = newPassword && confirmPassword && newPassword === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!tokenInput.trim()) {
      setSubmitError('Token reset wajib diisi');
      return;
    }

    if (newPassword.length < 8) {
      setSubmitError('Password baru minimal 8 karakter');
      return;
    }

    if (newPassword !== confirmPassword) {
      setSubmitError('Konfirmasi password tidak cocok');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await completePasswordReset({
        token: tokenInput.trim(),
        newPassword,
        confirmPassword,
      });

      if (res.success) {
        setIsSuccess(true);
      } else {
        setSubmitError(res.message || 'Gagal mereset password');
      }
    } catch (err) {
      setSubmitError(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-komazi-bg text-komazi-text flex flex-col justify-between p-4 sm:p-6 lg:p-8 selection:bg-komazi-coral selection:text-white">
      {/* Top Header */}
      <header className="max-w-md w-full mx-auto flex items-center justify-between pb-4">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-xs font-semibold text-komazi-muted hover:text-komazi-text transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Login</span>
        </Link>
      </header>
      {/* Main Container */}
      <main className="max-w-md w-full mx-auto my-auto">
        <div className="bg-komazi-surface border border-komazi-border/80 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
          {/* Brand Logo & Title */}
          <div className="text-center space-y-3 mb-6">
            <div className="inline-block transform hover:scale-105 transition-transform">
              <KomaziLogo size="lg" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-komazi-text tracking-tight">
                Reset Password Akun
              </h1>
              <p className="text-xs text-komazi-muted mt-1 leading-relaxed">
                Buat password baru yang aman untuk akun kasir atau staf POS Anda.
              </p>
            </div>
          </div>

          {/* Success State Screen */}
          {isSuccess ? (
            <div className="space-y-6 text-center animate-fadeIn py-2">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-komazi-text">
                  Password Berhasil Diperbarui!
                </h2>
                <p className="text-xs text-komazi-muted leading-relaxed px-2">
                  Password baru Anda telah aktif di sistem. Demi keamanan, seluruh sesi login lama pada perangkat lain telah dicabut secara otomatis.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-komazi-surface-2/60 border border-komazi-border text-[11.5px] text-komazi-muted flex items-start gap-2.5 text-left">
                <ShieldCheck className="w-4 h-4 text-komazi-coral shrink-0 mt-0.5" />
                <span>
                  Silakan login kembali menggunakan username Anda dan password baru yang telah dibuat.
                </span>
              </div>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full py-3.5 rounded-2xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs tracking-wide shadow-lg shadow-komazi-coral/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Masuk Sekarang</span>
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* Reset Password Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Token Input Field */}
              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1.5 flex items-center justify-between">
                  <span>Kode / Token Reset</span>
                  {isVerifying ? (
                    <span className="text-[10.5px] text-amber-400 animate-pulse flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Memverifikasi...
                    </span>
                  ) : tokenInfo ? (
                    <span className="text-[10.5px] text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Token Valid
                    </span>
                  ) : null}
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-komazi-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Masukkan kode reset 64 karakter dari Owner"
                    className="w-full pl-10 pr-3 py-2.5 bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text rounded-xl font-mono focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral outline-none transition-all placeholder:text-neutral-600"
                  />
                </div>
              </div>

              {/* Target User Info Banner if Verified */}
              {tokenInfo && (
                <div className="p-3 rounded-2xl bg-komazi-surface-2/90 border border-emerald-500/30 flex items-center justify-between text-xs animate-fadeIn">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-komazi-text text-xs leading-none">
                        {tokenInfo.name}
                      </p>
                      <p className="text-[11px] text-komazi-muted font-mono mt-0.5">
                        @{tokenInfo.username}
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Target Akun
                  </span>
                </div>
              )}

              {/* Token Error Banner */}
              {tokenError && (
                <div className="p-3 rounded-2xl bg-danger/10 border border-danger/30 text-danger text-xs font-semibold flex items-start gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p>{tokenError}</p>
                    <p className="text-[10.5px] font-normal text-neutral-400">
                      Pastikan Anda menyalin seluruh tautan atau kode dari Owner tanpa terpotong.
                    </p>
                  </div>
                </div>
              )}

              {/* New Password Field */}
              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1.5">
                  Password Baru
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-komazi-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 8 karakter"
                    className="w-full pl-10 pr-10 py-2.5 bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text rounded-xl focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral outline-none transition-all placeholder:text-neutral-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-komazi-muted hover:text-komazi-text"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {newPassword && (
                  <div className="mt-2 space-y-1 animate-fadeIn">
                    <div className="flex items-center justify-between text-[10.5px]">
                      <span className="text-komazi-muted">Kekuatan Password:</span>
                      <span className="font-bold text-komazi-text">{strength.label}</span>
                    </div>
                    <div className="h-1.5 w-full bg-komazi-surface-2 rounded-full overflow-hidden flex gap-1">
                      <div
                        className={`h-full flex-1 transition-all rounded-full ${
                          strength.score >= 1 ? strength.color : 'bg-transparent'
                        }`}
                      />
                      <div
                        className={`h-full flex-1 transition-all rounded-full ${
                          strength.score >= 2 ? strength.color : 'bg-transparent'
                        }`}
                      />
                      <div
                        className={`h-full flex-1 transition-all rounded-full ${
                          strength.score >= 3 ? strength.color : 'bg-transparent'
                        }`}
                      />
                      <div
                        className={`h-full flex-1 transition-all rounded-full ${
                          strength.score >= 4 ? strength.color : 'bg-transparent'
                        }`}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password Field */}
              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1.5 flex items-center justify-between">
                  <span>Konfirmasi Password Baru</span>
                  {confirmPassword && (
                    <span
                      className={`text-[10.5px] font-bold ${
                        isMatch ? 'text-emerald-400' : 'text-danger'
                      }`}
                    >
                      {isMatch ? 'Cocok ✓' : 'Tidak cocok ✗'}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-komazi-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi password baru"
                    className="w-full pl-10 pr-10 py-2.5 bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text rounded-xl focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral outline-none transition-all placeholder:text-neutral-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-komazi-muted hover:text-komazi-text"
                    aria-label={showConfirmPassword ? 'Sembunyikan password' : 'Lihat password'}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Error Banner */}
              {submitError && (
                <div className="p-3 rounded-2xl bg-danger/10 border border-danger/30 text-danger text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Policy Notes */}
              <div className="p-3 rounded-xl bg-komazi-surface-2/40 border border-komazi-border/50 text-[10.5px] text-komazi-muted space-y-1">
                <p className="font-semibold text-neutral-300">Ketentuan Keamanan:</p>
                <ul className="list-disc list-inside space-y-0.5 text-neutral-400">
                  <li>Panjang minimal 8 karakter.</li>
                  <li>Token hanya berlaku satu kali dan kadaluarsa setelah 15 menit.</li>
                  <li>Sesi login lama pada seluruh perangkat akan otomatis diakhiri.</li>
                </ul>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <LoadingButton
                  type="submit"
                  loading={isSubmitting}
                  disabled={!tokenInput.trim() || newPassword.length < 8 || !isMatch}
                  className="w-full py-3.5 rounded-2xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs tracking-wide shadow-lg shadow-komazi-coral/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <span>Simpan Password</span>
                </LoadingButton>
              </div>
            </form>
          )}
        </div>
      </main>

      {/* Footer Info */}
      <footer className="max-w-md w-full mx-auto text-center pt-4">
        <p className="text-[11px] text-komazi-muted">
          Belum memiliki kode reset?{' '}
          <span className="text-komazi-coral font-semibold">
            Hubungi Owner outlet Anda secara langsung
          </span>
        </p>
      </footer>
    </div>
  );
}
