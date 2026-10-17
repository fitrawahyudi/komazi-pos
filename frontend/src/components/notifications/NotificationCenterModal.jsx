import React, { useEffect, useState } from 'react';
import {
  Bell,
  X,
  CheckCheck,
  Check,
  AlertTriangle,
  ShoppingBag,
  Clock,
  Sparkles,
  ExternalLink,
  Settings,
  ShieldAlert,
} from 'lucide-react';
import { useNotificationStore } from '../../store/notificationStore';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import { toast } from '../../store/toastStore';
import AndroidNotificationCard from '../settings/AndroidNotificationCard';

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const date = new Date(dateString);
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Baru saja';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} jam lalu`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} hari lalu`;

  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const CATEGORIES = [
  { id: 'ALL', label: 'Semua', icon: Bell },
  { id: 'ORDERS', label: 'Pesanan', icon: ShoppingBag },
  { id: 'ALERTS', label: 'Peringatan', icon: AlertTriangle },
  { id: 'OPERATIONAL', label: 'Operasional', icon: Clock },
];

export default function NotificationCenterModal() {
  const { user } = useAuthStore();
  const {
    isCenterOpen,
    closeCenter,
    notifications,
    unreadCount,
    loading,
    activeCategory,
    setActiveCategory,
    markAsRead,
    markAllAsRead,
  } = useNotificationStore();

  const [showSettingsCard, setShowSettingsCard] = useState(false);
  const [isTestingPush, setIsTestingPush] = useState(false);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isCenterOpen) {
        closeCenter();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCenterOpen, closeCenter]);

  if (!isCenterOpen) return null;

  const isPrivileged = ['OWNER', 'MANAGER'].includes(user?.role);

  const handleNotificationClick = (item) => {
    if (!item.isRead) {
      markAsRead(item.id);
    }
    const targetUrl = item.data?.url;
    if (targetUrl) {
      closeCenter();
      window.location.hash = targetUrl.startsWith('/') ? targetUrl : `/${targetUrl}`;
    }
  };

  const handleTestPush = async () => {
    setIsTestingPush(true);
    try {
      const res = await api.notifications.testPush();
      if (res && res.success) {
        toast.success(res.message || 'Push notification uji coba berhasil dikirim!');
      } else {
        toast.error(res?.message || 'Gagal mengirim push test');
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsTestingPush(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pusat Pemberitahuan"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeCenter();
      }}
    >
      <div className="w-full max-w-xl bg-komazi-surface border border-komazi-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh] animate-scaleUp">
        {/* Header Bar */}
        <div className="p-4 border-b border-komazi-border flex items-center justify-between bg-komazi-surface-2/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-komazi-coral/15 text-komazi-coral flex items-center justify-center font-bold">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-komazi-text">Pemberitahuan</h2>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-komazi-coral text-white tracking-wide">
                    {unreadCount} Baru
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                title="Tandai semua telah dibaca"
                aria-label="Tandai semua telah dibaca"
                className="px-2.5 py-1.5 rounded-xl bg-komazi-surface-3 hover:bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-muted hover:text-white transition-all flex items-center gap-1.5 active:scale-95"
              >
                <CheckCheck className="w-3.5 h-3.5 text-komazi-teal-light" />
                <span className="hidden sm:inline font-medium">Tandai Dibaca</span>
              </button>
            )}

            <button
              type="button"
              onClick={closeCenter}
              title="Tutup dialog"
              aria-label="Tutup dialog"
              className="p-2 rounded-xl text-komazi-muted hover:text-white hover:bg-komazi-surface-3 transition-colors active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="px-4 py-2.5 border-b border-komazi-border bg-komazi-surface-2/30 flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                  isActive
                    ? 'bg-komazi-coral text-white shadow-sm shadow-komazi-coral/30'
                    : 'bg-komazi-surface-3 text-komazi-muted hover:text-white hover:bg-komazi-surface-2 border border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body Notification List or Settings Drawer */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[280px]">
          {showSettingsCard ? (
            <div className="space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-komazi-muted uppercase tracking-wider">
                  Pengaturan Notifikasi Perangkat
                </span>
                <button
                  type="button"
                  onClick={() => setShowSettingsCard(false)}
                  className="text-xs text-komazi-coral hover:underline font-semibold"
                >
                  ← Kembali ke Daftar Notifikasi
                </button>
              </div>
              <AndroidNotificationCard />
            </div>
          ) : loading && notifications.length === 0 ? (
            /* Skeleton Loading State */
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-2xl bg-komazi-surface-2/40 border border-komazi-border animate-pulse flex items-start gap-3"
                >
                  <div className="w-9 h-9 rounded-xl bg-komazi-surface-3 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-komazi-surface-3 rounded w-3/4" />
                    <div className="h-3 bg-komazi-surface-3 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <div className="w-14 h-14 rounded-2xl bg-komazi-surface-2/60 border border-komazi-border text-komazi-muted flex items-center justify-center mb-3.5 shadow-inner">
                <Bell className="w-7 h-7 stroke-1 text-komazi-muted/70" />
              </div>
              <h3 className="font-bold text-sm text-komazi-text">Belum Ada Pemberitahuan</h3>
              <p className="text-xs text-komazi-muted max-w-xs mt-1 leading-relaxed">
                Pemberitahuan penting seperti pesanan masuk, kesiapan menu, stok kritis, dan otorisasi akan otomatis tampil di sini.
              </p>
            </div>
          ) : (
            /* Notification Cards */
            notifications.map((item) => {
              const isUnread = !item.isRead;
              const isOrder = item.category === 'ORDERS';
              const isAlert = item.category === 'ALERTS';

              return (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`group relative p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                    isUnread
                      ? 'bg-komazi-surface-2/80 border-komazi-coral/30 hover:border-komazi-coral/60 shadow-sm'
                      : 'bg-komazi-surface-2/30 border-komazi-border/60 hover:bg-komazi-surface-2/60 opacity-80 hover:opacity-100'
                  }`}
                >
                  {/* Category Indicator Icon */}
                  <div
                    className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center ${
                      isOrder
                        ? 'bg-komazi-coral/15 text-komazi-coral'
                        : isAlert
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-komazi-teal-light/15 text-komazi-teal-light'
                    }`}
                  >
                    {isOrder ? (
                      <ShoppingBag className="w-4.5 h-4.5" />
                    ) : isAlert ? (
                      <ShieldAlert className="w-4.5 h-4.5" />
                    ) : (
                      <Clock className="w-4.5 h-4.5" />
                    )}
                  </div>

                  {/* Notification Content */}
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                          isOrder
                            ? 'bg-komazi-coral/15 text-komazi-coral'
                            : isAlert
                            ? 'bg-amber-500/15 text-amber-400'
                            : 'bg-komazi-surface-3 text-komazi-muted'
                        }`}
                      >
                        {item.category || 'INFO'}
                      </span>
                      <span className="text-[11px] text-komazi-muted tabular-nums">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>

                    <h4
                      className={`text-sm font-bold truncate ${
                        isUnread ? 'text-komazi-text' : 'text-komazi-text/80'
                      }`}
                    >
                      {item.title}
                    </h4>

                    <p className="text-xs text-komazi-muted mt-0.5 leading-relaxed line-clamp-2">
                      {item.body}
                    </p>

                    {item.data?.url && (
                      <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-komazi-coral hover:underline">
                        <span>Lihat detail</span>
                        <ExternalLink className="w-3 h-3" />
                      </div>
                    )}
                  </div>

                  {/* Actions & Unread Status Dot */}
                  <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5">
                    {isUnread && (
                      <span
                        title="Belum dibaca"
                        className="w-2.5 h-2.5 rounded-full bg-komazi-coral shadow-[0_0_6px_rgba(255,87,34,0.8)]"
                      />
                    )}

                    {isUnread && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(item.id);
                        }}
                        title="Tandai dibaca"
                        aria-label="Tandai dibaca"
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-komazi-surface-3 text-komazi-muted hover:text-white transition-opacity"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Bar */}
        <div className="p-3 sm:p-4 border-t border-komazi-border bg-komazi-surface-2/60 shrink-0 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowSettingsCard(!showSettingsCard)}
            className="flex items-center gap-1.5 text-xs font-semibold text-komazi-muted hover:text-white transition-colors"
          >
            <Settings className="w-3.5 h-3.5 text-komazi-coral" />
            <span>{showSettingsCard ? 'Tutup Pengaturan' : 'Pengaturan Notifikasi & Suara'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
