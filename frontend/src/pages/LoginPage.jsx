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

  // Open Forgot Password Info
  const openForgotPassword = () => {
    setShowForgotModal(true);
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
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none transition-colors"
                  placeholder="••••••••"
                />
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
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-komazi-coral/15 flex items-center justify-center text-komazi-coral shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-komazi-text">Pemulihan Akun Staf</h3>
                  <p className="text-[11px] text-komazi-muted">
                    Prosedur Resmi Pengaturan Ulang Password
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowForgotModal(false)}
                className="p-1.5 rounded-xl text-komazi-muted hover:text-komazi-text hover:bg-komazi-surface-2 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Otorisasi Langsung oleh Owner Diperlukan</span>
              </div>
              <p className="text-[11px] text-neutral-300 leading-relaxed">
                Demi keamanan data finansial dan operasional outlet, sistem POS Komazi tidak mengizinkan reset password otomatis tanpa verifikasi manual oleh Owner.
              </p>
            </div>

            <div className="space-y-2.5 text-xs text-komazi-text">
              <p className="font-semibold text-neutral-300 text-[11.5px]">Langkah Pemulihan:</p>
              <div className="space-y-2 text-[11px] text-komazi-muted">
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-komazi-surface-2/60 border border-komazi-border/50">
                  <span className="w-5 h-5 rounded-full bg-komazi-coral/20 text-komazi-coral font-bold flex items-center justify-center text-[10px] shrink-0">1</span>
                  <span>Hubungi Owner outlet Anda secara langsung untuk memverifikasi identitas Anda.</span>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-komazi-surface-2/60 border border-komazi-border/50">
                  <span className="w-5 h-5 rounded-full bg-komazi-coral/20 text-komazi-coral font-bold flex items-center justify-center text-[10px] shrink-0">2</span>
                  <span>Owner akan membuka <strong>Manajemen Akun</strong> dan menerbitkan kode atau tautan reset sekali pakai (berlaku 15 menit).</span>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-komazi-surface-2/60 border border-komazi-border/50">
                  <span className="w-5 h-5 rounded-full bg-komazi-coral/20 text-komazi-coral font-bold flex items-center justify-center text-[10px] shrink-0">3</span>
                  <span>Buka tautan atau masukkan kode tersebut di halaman reset password untuk membuat password baru.</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(false);
                  navigate('/reset-password');
                }}
                className="w-full py-3 rounded-2xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>Sudah Punya Kode / Tautan? Buka Halaman Reset</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
