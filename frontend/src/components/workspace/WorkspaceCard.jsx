import React, { useState, useEffect } from 'react';
import { formatRupiah, formatDuration } from '../../utils/format';
import {
  Laptop,
  Users,
  Clock,
  LogIn,
  LogOut,
  AlertTriangle,
  Zap,
} from 'lucide-react';

export default function WorkspaceCard({ area, session, onCheckIn, onCheckOut }) {
  const isOccupied = !!session;

  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [remainingMinutes, setRemainingMinutes] = useState(0);
  const [isOvertime, setIsOvertime] = useState(false);

  useEffect(() => {
    if (!session) return;

    const calculateTimer = () => {
      const checkInTime = new Date(session.checkInAt).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - checkInTime) / 60000);
      const target = session.targetDurationMin || 60;
      const remaining = target - elapsed;

      setElapsedMinutes(elapsed);
      setRemainingMinutes(remaining);
      setIsOvertime(remaining <= 0);
    };

    calculateTimer();
    const interval = setInterval(calculateTimer, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, [session]);

  // Determine status color and label
  let statusBadge = {
    label: 'Tersedia',
    bg: 'bg-success/15 border-success/30 text-success',
    dot: 'bg-success',
  };

  if (isOccupied) {
    if (isOvertime) {
      statusBadge = {
        label: `Overtime (${formatDuration(Math.abs(remainingMinutes))})`,
        bg: 'bg-danger/20 border-danger/50 text-danger animate-pulse',
        dot: 'bg-danger',
      };
    } else if (remainingMinutes <= 15) {
      statusBadge = {
        label: `Sisa ${remainingMinutes}m`,
        bg: 'bg-warning/20 border-warning/50 text-warning',
        dot: 'bg-warning',
      };
    } else {
      statusBadge = {
        label: `Aktif (${formatDuration(remainingMinutes)} lagi)`,
        bg: 'bg-komazi-coral-soft border-komazi-coral/40 text-komazi-coral',
        dot: 'bg-komazi-coral',
      };
    }
  }

  const targetMinutes = session?.targetDurationMin || 60;
  const progressPercent = Math.min(
    100,
    Math.round((elapsedMinutes / targetMinutes) * 100)
  );

  return (
    <div
      className={`rounded-2xl border bg-komazi-surface p-4 flex flex-col justify-between transition-all duration-200 ${
        isOccupied
          ? isOvertime
            ? 'border-danger/60 shadow-lg shadow-danger/10'
            : 'border-komazi-border hover:border-komazi-coral/40'
          : 'border-komazi-border/70 hover:border-success/40'
      }`}
    >
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                isOccupied
                  ? isOvertime
                    ? 'bg-danger/20 text-danger'
                    : 'bg-komazi-coral-soft text-komazi-coral'
                  : 'bg-success/15 text-success'
              }`}
            >
              <Laptop className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-komazi-text">{area.name}</h3>
              <div className="flex items-center gap-1.5 text-[11px] text-komazi-muted">
                <Users className="w-3 h-3" />
                <span>Kapasitas {area.capacity} orang</span>
                {area.powerOutlet && (
                  <>
                    <span>•</span>
                    <Zap className="w-3 h-3 text-warning" />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <span
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${statusBadge.bg}`}
          >
            <span className={`w-2 h-2 rounded-full ${statusBadge.dot}`} />
            <span>{statusBadge.label}</span>
          </span>
        </div>

        {/* Occupied Session Details */}
        {isOccupied ? (
          <div className="mt-3 p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="font-semibold text-xs text-komazi-text truncate">
                {session.customerName}
              </span>
              <span className="text-[10px] text-komazi-muted font-mono">{session.phone || '-'}</span>
            </div>

            <div className="flex justify-between items-center text-[11px] text-komazi-muted">
              <span>Paket:</span>
              <span className="font-semibold text-komazi-teal-light">
                {session.packageName}
              </span>
            </div>

            {/* Time progress bar */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[10px] text-komazi-muted">
                <span>Berjalan: {formatDuration(elapsedMinutes)}</span>
                <span>Target: {formatDuration(targetMinutes)}</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-komazi-surface overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isOvertime
                      ? 'bg-danger'
                      : remainingMinutes <= 15
                      ? 'bg-warning'
                      : 'bg-komazi-coral'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3 py-6 rounded-xl border border-dashed border-komazi-border/80 flex flex-col items-center justify-center text-center text-komazi-muted">
            <p className="text-xs font-medium">Area Kosong & Bersih</p>
            <p className="text-[11px] text-komazi-muted/70 mt-0.5">Siap digunakan pelanggan baru</p>
          </div>
        )}
      </div>

      {/* Action Button */}
      <div className="mt-4 pt-3 border-t border-komazi-border/50">
        {isOccupied ? (
          <button
            type="button"
            onClick={() => onCheckOut(session)}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm ${
              isOvertime
                ? 'bg-danger hover:bg-danger/90 text-white'
                : 'bg-komazi-teal hover:bg-komazi-teal-light text-white'
            }`}
          >
            <LogOut className="w-4 h-4" />
            <span>Check-Out & Tagihan</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onCheckIn(area)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-coral hover:text-white text-komazi-text font-bold text-xs border border-komazi-border hover:border-komazi-coral transition-all"
          >
            <LogIn className="w-4 h-4 text-komazi-coral group-hover:text-white" />
            <span>Check-In Pelanggan</span>
          </button>
        )}
      </div>
    </div>
  );
}
