import React, { useState, useEffect } from 'react';
import {
  Bell,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  Vibrate,
  ShoppingBag,
  Boxes,
  ShieldCheck,
  Send,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { NotificationService } from '../../services/notification.service';
import { toast } from '../../store/toastStore';

export default function AndroidNotificationCard() {
  const [permissionStatus, setPermissionStatus] = useState('prompt');
  const [isChecking, setIsChecking] = useState(false);
  const [settings, setSettings] = useState(NotificationService.getSettings());
  const isNative = NotificationService.isNative;

  useEffect(() => {
    checkCurrentPermission();
  }, []);

  const checkCurrentPermission = async () => {
    setIsChecking(true);
    try {
      const status = await NotificationService.checkPermission();
      setPermissionStatus(status);
    } catch {
      setPermissionStatus('prompt');
    } finally {
      setIsChecking(false);
    }
  };

  const handleRequestPermission = async () => {
    try {
      const res = await NotificationService.requestPermission();
      setPermissionStatus(res);
      if (res === 'granted') {
        toast.success('Izin notifikasi Android berhasil diaktifkan!');
      } else {
        toast.error('Izin notifikasi ditolak. Anda dapat mengaktifkannya di Pengaturan Aplikasi Android.');
      }
    } catch (err) {
      toast.error('Gagal meminta izin: ' + err.message);
    }
  };

  const handleTestNotification = async () => {
    try {
      await NotificationService.testNotification();
      toast.success('Notifikasi uji coba berhasil dikirim! Periksa panel notifikasi Android Anda.');
    } catch (err) {
      toast.error('Gagal mengirim notifikasi: ' + err.message);
    }
  };

  const handleToggle = (key) => {
    const nextSettings = { ...settings, [key]: !settings[key] };
    setSettings(nextSettings);
    NotificationService.updateSettings(nextSettings);
    toast.success('Pengaturan notifikasi diperbarui');
  };

  return (
    <div className="p-5 rounded-2xl bg-komazi-surface border border-komazi-border space-y-5 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-komazi-border pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-komazi-coral/15 border border-komazi-coral/30 text-komazi-coral flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-komazi-text flex items-center gap-2">
              <span>Notifikasi</span>
            </h2>
          </div>
        </div>
      </div>

      {/* Permission Status Banner */}
      <div className="p-4 rounded-xl bg-komazi-surface-2 border border-komazi-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          {permissionStatus === 'granted' ? (
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-komazi-text">
                Status Izin Notifikasi Sistem
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  permissionStatus === 'granted'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : permissionStatus === 'denied'
                    ? 'bg-rose-500/20 text-rose-400'
                    : 'bg-amber-500/20 text-amber-400'
                }`}
              >
                {permissionStatus === 'granted'
                  ? 'Diizinkan (Aktif)'
                  : permissionStatus === 'denied'
                  ? 'Ditolak (Nonaktif)'
                  : 'Belum Diaktifkan'}
              </span>
            </div>
          </div>
        </div>

        {permissionStatus !== 'granted' && (
          <button
            type="button"
            onClick={handleRequestPermission}
            className="px-4 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold transition-all shadow-md active:scale-95 shrink-0"
          >
            Aktifkan Izin Notifikasi
          </button>
        )}
      </div>

      {/* Notification Options Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {/* Toggle 1: Pesanan Masuk */}
        <div className="p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-komazi-surface text-emerald-400 border border-komazi-border flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-komazi-text">Pesanan Masuk & KDS</p>
              <p className="text-[10px] text-komazi-muted">Alert order baru & pesanan siap saji</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleToggle('orderAlerts')}
            className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${
              settings.orderAlerts ? 'bg-emerald-500' : 'bg-neutral-800'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                settings.orderAlerts ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Toggle 2: Peringatan Stok */}
        <div className="p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-komazi-surface text-amber-400 border border-komazi-border flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-komazi-text">Peringatan Stok Menipis</p>
              <p className="text-[10px] text-komazi-muted">Bahan mencapai stok minimum</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleToggle('stockAlerts')}
            className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${
              settings.stockAlerts ? 'bg-amber-500' : 'bg-neutral-800'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                settings.stockAlerts ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Toggle 3: Otorisasi Supervisor */}
        <div className="p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-komazi-surface text-rose-400 border border-komazi-border flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-komazi-text">Otorisasi Supervisor</p>
              <p className="text-[10px] text-komazi-muted">Permintaan void & diskon kasir</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleToggle('approvalAlerts')}
            className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${
              settings.approvalAlerts ? 'bg-rose-500' : 'bg-neutral-800'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                settings.approvalAlerts ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Toggle 4: Bunyi & Suara */}
        <div className="p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-komazi-surface text-blue-400 border border-komazi-border flex items-center justify-center">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-komazi-text">Bunyi Notifikasi</p>
              <p className="text-[10px] text-komazi-muted">Mainkan nada dering saat notifikasi masuk</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleToggle('sound')}
            className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${
              settings.sound ? 'bg-blue-500' : 'bg-neutral-800'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                settings.sound ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
