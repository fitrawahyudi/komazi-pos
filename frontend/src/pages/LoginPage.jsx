import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import KomaziLogo from '../components/ui/KomaziLogo';
import LoadingButton from '../components/ui/loading/LoadingButton';
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
  Send,
  Eye,
  EyeOff,
  MessageSquare,
  Terminal,
} from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, resetPasswordWithPin } = useAuthStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotTab, setForgotTab] = useState('owner'); // 'owner' | 'staff'
  const [ownerStep, setOwnerStep] = useState(1); // 1: input username, 2: input OTP & password, 3: success
  const [ownerUsername, setOwnerUsername] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');
  const [countdown, setCountdown] = useState(0);

  // Countdown timer effect
  React.useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Open Forgot Password Modal
  const openForgotPassword = () => {
    setShowForgotModal(true);
    setForgotTab('owner');
    setOwnerStep(1);
    setOwnerUsername(username || '');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setModalError('');
    setModalSuccess('');
    setCountdown(0);
  };

  const handleRequestOtp = async (e) => {
    e?.preventDefault();
    if (!ownerUsername.trim()) {
      setModalError('Silakan masukkan username akun Owner Anda');
      return;
    }
    setModalError('');
    setModalSuccess('');
    setOtpLoading(true);
    try {
      const res = await api.auth.requestOwnerResetOtp(ownerUsername.trim());
      if (res?.success) {
        setModalSuccess(res.message || 'Kode verifikasi 6-digit berhasil dikirim ke Telegram.');
        setOwnerStep(2);
        setCountdown(60);
      } else {
        setModalError(res?.message || 'Gagal mengirim kode verifikasi.');
      }
    } catch (err) {
      setModalError(err.message || 'Gagal mengirim kode verifikasi ke Telegram.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    if (!otp || otp.trim().length !== 6) {
      setModalError('Masukkan 6 digit kode OTP verifikasi dengan lengkap');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setModalError('Kata sandi baru minimal 8 karakter');
      return;
    }
    if (newPassword !== confirmPassword) {
      setModalError('Konfirmasi kata sandi tidak cocok');
      return;
    }

    setModalError('');
    setVerifyLoading(true);
    try {
      const res = await api.auth.verifyAndCompleteOwnerReset({
        username: ownerUsername.trim(),
        otp: otp.trim(),
        newPassword,
        confirmPassword,
      });
      if (res?.success) {
        setOwnerStep(3);
        setModalSuccess(res.message || 'Kata sandi berhasil diperbarui!');
        setUsername(ownerUsername.trim());
        setPassword('');
      } else {
        setModalError(res?.message || 'Gagal mengatur ulang kata sandi.');
      }
    } catch (err) {
      setModalError(err.message || 'Gagal mengatur ulang kata sandi. Pastikan kode OTP benar.');
    } finally {
      setVerifyLoading(false);
    }
  };

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
            Point of Sale Management System
          </p>
        </div>

        {/* Login Box */}
        <div className="p-7 rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl space-y-5">
          <div className="space-y-1">
            <h2 className="font-bold text-lg text-komazi-text">Masuk</h2>
            <p className="text-xs text-komazi-muted">
              Gunakan akun yang terdaftar untuk melanjutkan.
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
                Username:
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
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-komazi-muted hover:text-komazi-text cursor-pointer transition-colors focus:outline-none"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                  title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <LoadingButton
              type="submit"
              isLoading={isSubmitting}
              loadingText="Menyambungkan..."
              variant="primary"
              size="md"
              icon={LogIn}
              className="w-full py-3 rounded-xl font-bold text-sm shadow-lg shadow-komazi-coral/25"
            >
              Masuk Sekarang
            </LoadingButton>

            {/* Quick Demo Credentials */}
            {/* <div className="pt-2 space-y-1.5">
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
            </div> */}
          </form>

          {/* Security & Access Notice */}
          <div className="pt-3 border-t border-komazi-border text-center space-y-1.5">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-komazi-muted">
              <ShieldCheck className="w-3.5 h-3.5 text-komazi-teal-light" />
              <span className="font-semibold text-komazi-text">Akses Terotorisasi & Hak Akses Ketat</span>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-komazi-surface border border-komazi-border rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-7 space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-komazi-coral/15 flex items-center justify-center text-komazi-coral shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-komazi-text">Pemulihan Kata Sandi</h3>
                  <p className="text-[11px] text-komazi-muted">
                    Pilih tipe akun untuk memulihkan akses login
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="p-1.5 rounded-xl text-komazi-muted hover:text-komazi-text hover:bg-komazi-surface-2 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab Selection */}
            <div className="grid grid-cols-2 p-1 rounded-2xl bg-komazi-surface-2 border border-komazi-border text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setForgotTab('owner');
                  setModalError('');
                }}
                className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  forgotTab === 'owner'
                    ? 'bg-komazi-coral text-white shadow-md'
                    : 'text-komazi-muted hover:text-komazi-text'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Akun Owner</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setForgotTab('staff');
                  setModalError('');
                }}
                className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  forgotTab === 'staff'
                    ? 'bg-komazi-coral text-white shadow-md'
                    : 'text-komazi-muted hover:text-komazi-text'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Staf & Kasir</span>
              </button>
            </div>

            {/* TAB 1: OWNER VIA TELEGRAM */}
            {forgotTab === 'owner' && (
              <div className="space-y-4">
                {modalError && (
                  <div className="p-3 rounded-xl bg-danger/15 border border-danger/30 text-danger text-xs font-semibold flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="leading-tight">{modalError}</span>
                  </div>
                )}

                {/* Step 1: Input Username & Request OTP */}
                {ownerStep === 1 && (
                  <form onSubmit={handleRequestOtp} className="space-y-4">
                    <div className="p-3.5 rounded-2xl bg-komazi-surface-2/80 border border-komazi-border text-xs space-y-1.5">
                      <div className="flex items-center gap-2 text-komazi-coral font-bold">
                        <MessageSquare className="w-4 h-4 shrink-0" />
                        <span>Verifikasi Instan via Telegram Bot</span>
                      </div>
                      <p className="text-[11px] text-komazi-muted leading-relaxed">
                        Masukkan username Owner Anda. Bot Telegram Komazi POS akan mengirimkan 6 digit kode OTP langsung ke chat Telegram pribadi Anda.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-komazi-muted mb-1.5">
                        Username Akun Owner:
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-komazi-muted absolute left-3.5 top-3" />
                        <input
                          type="text"
                          required
                          value={ownerUsername}
                          onChange={(e) => setOwnerUsername(e.target.value)}
                          className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none transition-colors"
                          placeholder="misal: owner"
                        />
                      </div>
                    </div>

                    <LoadingButton
                      type="submit"
                      isLoading={otpLoading}
                      loadingText="Mengirim Kode ke Telegram..."
                      variant="primary"
                      size="md"
                      icon={Send}
                      className="w-full py-3 rounded-2xl font-bold text-xs shadow-lg shadow-komazi-coral/25 cursor-pointer"
                    >
                      Kirim Kode OTP ke Telegram
                    </LoadingButton>

                    {/* Server CLI Fallback Hint */}
                    {/* <div className="pt-2 border-t border-komazi-border/50 text-[11px] text-komazi-muted leading-relaxed">
                      <div className="flex items-start gap-1.5 text-komazi-text">
                        <Terminal className="w-3.5 h-3.5 shrink-0 mt-0.5 text-komazi-teal-light" />
                        <span>
                          <strong>Jalan Keluar Darurat:</strong> Jika Telegram belum terhubung, pengelola server dapat menjalankan perintah terminal:
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-[10.5px] px-2.5 py-1 rounded bg-black/50 text-komazi-teal-light border border-komazi-border">
                        npm run reset-owner
                      </div>
                    </div> */}
                  </form>
                )}

                {/* Step 2: Input OTP & Set New Password */}
                {ownerStep === 2 && (
                  <form onSubmit={handleVerifyOtp} className="space-y-3.5">
                    {modalSuccess && (
                      <div className="p-3 rounded-xl bg-success/15 border border-success/30 text-success text-xs font-semibold flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                        <span className="leading-tight">{modalSuccess}</span>
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold uppercase tracking-wider text-komazi-muted">
                          Kode OTP Telegram (6 Digit):
                        </label>
                        <span className="text-[10px] text-komazi-coral font-semibold">Berlaku 5 menit</span>
                      </div>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        autoFocus
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        className="w-full py-2.5 px-3 rounded-xl bg-komazi-surface-2 border border-komazi-border text-center font-mono text-lg font-bold tracking-widest text-komazi-text focus:border-komazi-coral focus:outline-none transition-colors"
                        placeholder="••••••"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-komazi-muted mb-1">
                        Kata Sandi Baru (Min. 8 Karakter):
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-komazi-muted absolute left-3.5 top-3" />
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none transition-colors"
                          placeholder="Minimal 8 karakter"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-3 text-komazi-muted hover:text-komazi-text cursor-pointer"
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-komazi-muted mb-1">
                        Konfirmasi Kata Sandi Baru:
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-komazi-muted absolute left-3.5 top-3" />
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none transition-colors"
                          placeholder="Ulangi kata sandi baru"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-3 text-komazi-muted hover:text-komazi-text cursor-pointer"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <LoadingButton
                      type="submit"
                      isLoading={verifyLoading}
                      loadingText="Memperbarui Password..."
                      variant="primary"
                      size="md"
                      icon={ShieldCheck}
                      className="w-full py-3 rounded-2xl font-bold text-xs shadow-lg shadow-komazi-coral/25 cursor-pointer mt-1"
                    >
                      Simpan Kata Sandi Baru
                    </LoadingButton>

                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setOwnerStep(1);
                          setOtp('');
                          setModalError('');
                        }}
                        className="text-komazi-muted hover:text-komazi-text transition-colors cursor-pointer"
                      >
                        ← Ganti Username
                      </button>

                      {countdown > 0 ? (
                        <span className="text-komazi-muted">Kirim ulang ({countdown}s)</span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleRequestOtp}
                          disabled={otpLoading}
                          className="text-komazi-coral hover:text-komazi-coral-light font-semibold transition-colors cursor-pointer"
                        >
                          Kirim Ulang Kode OTP
                        </button>
                      )}
                    </div>
                  </form>
                )}

                {/* Step 3: Success State */}
                {ownerStep === 3 && (
                  <div className="text-center py-4 space-y-4">
                    <div className="w-14 h-14 mx-auto rounded-full bg-success/20 text-success flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-base text-komazi-text">Kata Sandi Berhasil Diperbarui!</h4>
                      <p className="text-xs text-komazi-muted max-w-xs mx-auto leading-relaxed">
                        Akun Owner <strong>@{ownerUsername}</strong> telah memiliki kata sandi baru. Seluruh sesi login di perangkat lain telah otomatis dicabut demi keamanan.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="w-full py-3 rounded-2xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                    >
                      Kembali ke Halaman Masuk
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: STAFF & CASHIER */}
            {forgotTab === 'staff' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-400">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Otorisasi Langsung oleh Owner Diperlukan</span>
                  </div>
                  <p className="text-[11px] text-neutral-300 leading-relaxed">
                    Demi keamanan data finansial dan operasional outlet, akun staf kasir/kitchen tidak dapat mereset mandiri tanpa izin Owner.
                  </p>
                </div>

                <div className="space-y-2.5 text-xs text-komazi-text">
                  <p className="font-semibold text-neutral-300 text-[11.5px]">Langkah Pemulihan Staf:</p>
                  <div className="space-y-2 text-[11px] text-komazi-muted">
                    <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-komazi-surface-2/60 border border-komazi-border/50">
                      <span className="w-5 h-5 rounded-full bg-komazi-coral/20 text-komazi-coral font-bold flex items-center justify-center text-[10px] shrink-0">1</span>
                      <span>Hubungi Owner outlet Anda secara langsung untuk mengonfirmasi identitas Anda.</span>
                    </div>
                    <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-komazi-surface-2/60 border border-komazi-border/50">
                      <span className="w-5 h-5 rounded-full bg-komazi-coral/20 text-komazi-coral font-bold flex items-center justify-center text-[10px] shrink-0">2</span>
                      <span>Owner akan membuka <strong>Manajemen Akun</strong> dan menerbitkan kode atau tautan reset sekali pakai (berlaku 15 menit).</span>
                    </div>
                    <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-komazi-surface-2/60 border border-komazi-border/50">
                      <span className="w-5 h-5 rounded-full bg-komazi-coral/20 text-komazi-coral font-bold flex items-center justify-center text-[10px] shrink-0">3</span>
                      <span>Buka halaman reset password dan masukkan kode token tersebut untuk membuat kata sandi baru.</span>
                    </div>
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotModal(false);
                      navigate('/reset-password');
                    }}
                    className="w-full py-3 rounded-2xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Sudah Punya Token Reset? Buka Halaman Reset</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
