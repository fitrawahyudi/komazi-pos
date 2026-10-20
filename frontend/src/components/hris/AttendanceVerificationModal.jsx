import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  XCircle,
  Camera,
  RotateCcw,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  RefreshCw,
  LocateFixed,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { useHrisStore } from '../../store/hrisStore';
import { toast } from '../../store/toastStore';
import { CameraService } from '../../services/camera.service';
import LoadingButton from '../ui/loading/LoadingButton';

// Haversine formula di client untuk feedback instan ke user
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export default function AttendanceVerificationModal({
  isOpen,
  onClose,
  onSuccess,
  mode = 'CLOCK_IN',
  onOpenCloseSessionModal,
}) {
  const { settings } = useSettingsStore();
  const { user } = useAuthStore();
  const clockIn = useHrisStore((state) => state.clockIn);
  const clockOut = useHrisStore((state) => state.clockOut);
  const fetchMyTodaySchedule = useHrisStore((state) => state.fetchMyTodaySchedule);
  const fetchTodayAttendance = useHrisStore((state) => state.fetchTodayAttendance);

  const isClockOut = mode === 'CLOCK_OUT';

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraSessionIdRef = useRef(0);

  const [photoDataUrl, setPhotoDataUrl] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [facingMode, setFacingMode] = useState('user');
  const [cameraError, setCameraError] = useState(null);
  const [activeSessionError, setActiveSessionError] = useState(null);

  // GPS state
  const [gpsLoading, setGpsLoading] = useState(true);
  const [staffCoords, setStaffCoords] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const [distanceMeters, setDistanceMeters] = useState(null);
  const [staffNotes, setStaffNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOwner = user?.role === 'OWNER';
  const isGeofenceEnabled =
    settings?.attendanceGeofenceEnabled === 'true' ||
    settings?.attendanceGeofenceEnabled === true;
  const outletLat = parseFloat(settings?.outletLatitude);
  const outletLon = parseFloat(settings?.outletLongitude);
  const maxRadiusMeters = parseInt(settings?.attendanceRadiusMeters, 10) || 100;
  const hasOutletCoords = !isNaN(outletLat) && !isNaN(outletLon);

  const isSelfieRequired =
    settings?.attendanceSelfieRequired === 'true' ||
    settings?.attendanceSelfieRequired === true;

  // 1. Inisialisasi GPS Lokasi saat modal dibuka
  const detectLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Perangkat tidak mendukung Geolocation GPS');
      setGpsLoading(false);
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setStaffCoords({ latitude, longitude, accuracy });
        setGpsLoading(false);

        if (hasOutletCoords) {
          const dist = calculateDistanceMeters(outletLat, outletLon, latitude, longitude);
          setDistanceMeters(dist);
        }
      },
      (err) => {
        setGpsLoading(false);
        let msg = 'Gagal mengakses GPS. Pastikan izin lokasi aktif di browser/HP.';
        if (err.code === 1) msg = 'Izin lokasi (GPS) ditolak. Silakan izinkan akses lokasi.';
        if (err.code === 2) msg = 'Posisi GPS tidak dapat dideteksi.';
        if (err.code === 3) msg = 'Waktu deteksi GPS habis. Silakan coba lagi.';
        setGpsError(msg);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // 2. Binding stream video ke DOM node video
  const bindStreamToVideo = (element, stream) => {
    if (!element || !stream) return;
    try {
      if (element.srcObject !== stream) {
        element.srcObject = stream;
      }
      element.muted = true;
      element.defaultMuted = true;
      element.playsInline = true;
      element.setAttribute('playsinline', 'true');
      element.setAttribute('autoplay', 'true');
      const p = element.play();
      if (p !== undefined) {
        p.catch((err) => {
          console.warn('[AttendanceVerificationModal] play error:', err);
        });
      }
    } catch (err) {
      console.warn('[AttendanceVerificationModal] bindStream error:', err);
    }
  };

  const setVideoRef = (element) => {
    videoRef.current = element;
    if (element && streamRef.current) {
      bindStreamToVideo(element, streamRef.current);
    }
  };

  const startCamera = async (targetFacing = facingMode) => {
    const sessionId = ++cameraSessionIdRef.current;
    setIsCameraLoading(true);
    setIsVideoReady(false);
    setCameraError(null);

    // Hentikan stream sebelumnya jika aktif
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      if (sessionId === cameraSessionIdRef.current) {
        setIsCameraLoading(false);
        setIsCameraActive(false);
        setCameraError('Browser ini tidak mendukung akses webcam langsung. Silakan gunakan tombol Unggah Foto.');
      }
      return;
    }

    let stream = null;
    try {
      // 1. Coba kamera depan (selfie) dengan resolusi ideal
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: targetFacing,
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      });
    } catch (err1) {
      console.warn('[Camera] Fallback 1: facingMode gagal, mencoba generic video: true', err1);
      try {
        // 2. Fallback jika kamera perangkat/laptop menolak constraint facingMode 'user'
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      } catch (err2) {
        console.warn('[Camera] Fallback 2 gagal:', err2);
        if (sessionId !== cameraSessionIdRef.current) return;
        setIsCameraLoading(false);
        setIsCameraActive(false);
        let msg = 'Gagal mengakses kamera selfie. Pastikan izin kamera aktif.';
        if (err2.name === 'NotAllowedError' || err2.name === 'PermissionDeniedError') {
          msg = 'Izin kamera ditolak. Silakan izinkan akses kamera di pengaturan browser/perangkat.';
        } else if (err2.name === 'NotFoundError' || err2.name === 'DevicesNotFoundError') {
          msg = 'Kamera tidak ditemukan di perangkat ini.';
        } else if (err2.name === 'NotReadableError' || err2.name === 'TrackStartError') {
          msg = 'Kamera sedang digunakan oleh aplikasi lain atau ditutup fisiknya.';
        }
        setCameraError(msg);
        return;
      }
    }

    // Jika unmount / StrictMode cleanup membatalkan request ini
    if (sessionId !== cameraSessionIdRef.current) {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      return;
    }

    streamRef.current = stream;
    setIsCameraActive(true);
    setIsCameraLoading(false);

    if (videoRef.current) {
      bindStreamToVideo(videoRef.current, stream);
    }
  };

  const stopCamera = () => {
    cameraSessionIdRef.current++;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsCameraLoading(false);
    setIsVideoReady(false);
  };

  const takePhotoFromVideo = () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;

      if (video.videoWidth === 0 || video.videoHeight === 0) {
        toast.error('Kamera belum siap memuat gambar. Silakan tunggu 1-2 detik atau gunakan opsi Unggah Foto.');
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (facingMode === 'user') {
        // Mirror horizontal agar foto sama persis dengan preview yang dilihat user
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setPhotoDataUrl(dataUrl);
      stopCamera();
    } catch (err) {
      toast.error('Gagal mengambil foto dari video: ' + err.message);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar (JPG, PNG, WebP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoDataUrl(event.target.result);
      stopCamera();
      toast.success('Foto selfie berhasil dipilih!');
    };
    reader.onerror = () => {
      toast.error('Gagal membaca file gambar');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleToggleFacingMode = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  const handleNativeCameraFallback = async () => {
    try {
      const res = await CameraService.takePhoto({ facingMode: 'user' });
      if (res && res.success && res.dataUrl) {
        setPhotoDataUrl(res.dataUrl);
        stopCamera();
      }
    } catch (err) {
      toast.error('Gagal mengambil foto selfie: ' + err.message);
    }
  };

  const handleRetake = () => {
    setPhotoDataUrl(null);
    startCamera(facingMode);
  };

  useEffect(() => {
    if (isOpen) {
      setActiveSessionError(null);
      detectLocation();
      startCamera('user');
    } else {
      stopCamera();
      setPhotoDataUrl(null);
      setStaffNotes('');
      setActiveSessionError(null);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Logika Kelayakan (Eligibility)
  const isDistanceValid =
    isOwner ||
    !isGeofenceEnabled ||
    !hasOutletCoords ||
    (distanceMeters !== null && distanceMeters <= maxRadiusMeters);

  const isLocationBlocked =
    !isOwner &&
    isGeofenceEnabled &&
    hasOutletCoords &&
    (gpsError !== null || (distanceMeters !== null && distanceMeters > maxRadiusMeters));

  const isPhotoBlocked = !isOwner && isSelfieRequired && !photoDataUrl;

  const canSubmit = !isLocationBlocked && !isPhotoBlocked && !gpsLoading && !isSubmitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLocationBlocked) {
      toast.error('Presensi ditolak: Anda harus berada di area outlet.');
      return;
    }
    if (isPhotoBlocked) {
      toast.error('Foto selfie wajib diambil sebagai bukti ' + (isClockOut ? 'pulang.' : 'kehadiran.'));
      return;
    }

    try {
      setIsSubmitting(true);
      setActiveSessionError(null);
      const payload = {
        latitude: staffCoords?.latitude || null,
        longitude: staffCoords?.longitude || null,
        accuracy: staffCoords?.accuracy || null,
        photo: photoDataUrl || null,
        notes: staffNotes.trim() || undefined,
        deviceInfo: typeof navigator !== 'undefined' ? `${navigator.userAgent}` : null,
      };

      const actionFn = isClockOut ? clockOut : clockIn;
      const result = await actionFn(payload);
      if (result) {
        await fetchMyTodaySchedule?.();
        if (user?.id) await fetchTodayAttendance?.(user.id);
        toast.success(
          isClockOut
            ? 'Presensi pulang berhasil dicatat dengan bukti foto & GPS!'
            : 'Presensi berhasil dicatat dengan verifikasi anti-fraud!'
        );
        onSuccess?.(result);
        onClose?.();
      }
    } catch (err) {
      if (err.code === 'ACTIVE_CASHIER_SESSION_EXISTS' || err.errors?.code === 'ACTIVE_CASHIER_SESSION_EXISTS') {
        setActiveSessionError({
          message: err.message || 'Anda masih memiliki sesi kasir aktif. Tutup sesi atau selesaikan serah terima sebelum presensi pulang.',
          details: err.errors || {},
        });
      }
      toast.error(err?.message || (isClockOut ? 'Gagal memproses presensi pulang' : 'Gagal memproses presensi'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/85 backdrop-blur-md p-4 flex items-center justify-center animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md rounded-3xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div
          className={`p-5 bg-gradient-to-r ${
            isClockOut ? 'from-rose-500/20' : 'from-komazi-coral/20'
          } via-transparent to-transparent border-b border-komazi-border flex items-center justify-between`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl ${
                isClockOut
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                  : 'bg-komazi-coral/20 border-komazi-coral/40 text-komazi-coral'
              } border flex items-center justify-center shadow-inner`}
            >
              <ShieldCheck className="w-5 h-5 stroke-[2.4]" />
            </div>
            <div>
              <h3 className="font-display font-black text-base text-komazi-text">
                {isClockOut ? 'Verifikasi Presensi Pulang' : 'Verifikasi Presensi Kehadiran'}
              </h3>
              <p className="text-[11px] text-komazi-muted">
                {isClockOut
                  ? 'Ambil bukti foto selfie & koordinat GPS saat selesai bekerja'
                  : 'Validasi lokasi GPS & bukti foto selfie staf saat mulai bekerja'}
              </p>
            </div>
          </div>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Active Cashier Session Barrier Banner */}
          {activeSessionError && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5 animate-in fade-in">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Sesi Kasir Masih Aktif</span>
              </div>
              <p className="text-amber-300/90 text-xs leading-relaxed">
                {activeSessionError.message}
              </p>
              {onOpenCloseSessionModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose?.();
                    onOpenCloseSessionModal?.();
                  }}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Tutup Sesi Kasir Sekarang</span>
                </button>
              )}
            </div>
          )}

          {/* 1. Camera Viewfinder / Photo Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-komazi-text uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <Camera className={`w-3.5 h-3.5 ${isClockOut ? 'text-rose-400' : 'text-komazi-coral'}`} />
                {isClockOut ? 'Bukti Foto Selfie Pulang' : 'Bukti Foto Selfie'}{' '}
                {isSelfieRequired && <span className="text-rose-400">*Wajib</span>}
              </span>
              {photoDataUrl && (
                <button
                  type="button"
                  onClick={handleRetake}
                  className="text-[11px] text-komazi-coral hover:underline font-bold flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Foto Ulang
                </button>
              )}
            </div>

            <div className="relative aspect-square max-h-60 mx-auto w-full rounded-2xl bg-black border border-komazi-border overflow-hidden flex items-center justify-center shadow-inner">
              {photoDataUrl ? (
                /* Captured Photo */
                <div className="relative w-full h-full">
                  <img
                    src={photoDataUrl}
                    alt="Selfie Presensi"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/80 text-[10px] font-mono text-emerald-400 font-bold border border-emerald-500/30 flex items-center gap-1 shadow-lg backdrop-blur-sm">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>✓ Foto Terverifikasi</span>
                  </div>
                </div>
              ) : isCameraActive ? (
                /* Live Camera Stream */
                <div className="relative w-full h-full flex items-center justify-center bg-black">
                  <video
                    ref={setVideoRef}
                    autoPlay
                    playsInline
                    muted
                    onLoadedMetadata={(e) => {
                      e.currentTarget.muted = true;
                      const p = e.currentTarget.play();
                      if (p !== undefined) p.catch(() => {});
                      setIsVideoReady(true);
                    }}
                    onCanPlay={() => {
                      setIsVideoReady(true);
                    }}
                    className={`w-full h-full object-cover transition-opacity duration-300 ${
                      facingMode === 'user' ? 'transform -scale-x-100' : ''
                    } ${isVideoReady ? 'opacity-100' : 'opacity-0'}`}
                  />

                  {/* Face Guide Oval */}
                  <div className="absolute inset-4 rounded-full border-2 border-dashed border-white/50 pointer-events-none shadow-[0_0_15px_rgba(0,0,0,0.5)]" />

                  {/* Loading indicator while video metadata/frames load */}
                  {(!isVideoReady || isCameraLoading) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 text-komazi-muted space-y-2 z-10">
                      <RefreshCw className="w-7 h-7 animate-spin text-komazi-coral" />
                      <span className="text-xs font-semibold text-komazi-text">Mengakses Kamera...</span>
                      <span className="text-[10px] text-komazi-muted">Mohon izinkan akses webcam/kamera</span>
                    </div>
                  )}

                  {/* Shutter & Controls Buttons */}
                  <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-2 px-3 z-20">
                    <button
                      type="button"
                      onClick={takePhotoFromVideo}
                      disabled={!isVideoReady}
                      className={`px-4 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral/90 active:scale-95 text-white font-bold text-xs flex items-center gap-2 shadow-xl shadow-komazi-coral/40 cursor-pointer transition-all ${
                        !isVideoReady ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <Camera className="w-4 h-4 stroke-[2.5]" />
                      <span>Ambil Foto Selfie</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2.5 rounded-xl bg-black/70 hover:bg-neutral-800 border border-white/20 text-white font-bold text-xs flex items-center justify-center shadow-lg transition-all cursor-pointer backdrop-blur-md"
                      title="Unggah Foto dari File / Galeri"
                    >
                      <Upload className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleFacingMode}
                      className="p-2.5 rounded-xl bg-black/70 hover:bg-neutral-800 border border-white/20 text-white font-bold text-xs flex items-center justify-center shadow-lg transition-all cursor-pointer backdrop-blur-md"
                      title="Putar Kamera (Depan/Belakang)"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Camera Error / Fallback State */
                <div className="p-4 text-center space-y-3">
                  <Camera className="w-9 h-9 text-komazi-muted mx-auto stroke-[1.5]" />
                  <p className="text-[11px] text-komazi-muted leading-relaxed max-w-xs mx-auto">
                    {cameraError || 'Kamera selfie belum aktif.'}
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => startCamera()}
                      className="px-3.5 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-komazi-text font-bold text-xs hover:border-komazi-coral flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Coba Kamera Lagi</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral/90 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-komazi-coral/25 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Unggah Foto Selfie</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Hidden File Input for Native File/Camera Fallback */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="user"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* 2. Geofencing GPS Radius Verification Card */}
          <div className="p-3.5 rounded-2xl bg-komazi-surface-2 border border-komazi-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-komazi-text uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-komazi-coral" />
                Lokasi Outlet (GPS)
              </span>
              <button
                type="button"
                onClick={detectLocation}
                disabled={gpsLoading}
                className="text-[10px] text-komazi-muted hover:text-white flex items-center gap-1"
                title="Refresh Lokasi GPS"
              >
                <RefreshCw className={`w-3 h-3 ${gpsLoading ? 'animate-spin text-komazi-coral' : ''}`} />
                <span>{gpsLoading ? 'Mendeteksi...' : 'Cek Ulang GPS'}</span>
              </button>
            </div>

            {/* GPS Feedback Badges */}
            {gpsLoading ? (
              <div className="p-2.5 rounded-xl bg-komazi-surface border border-komazi-border flex items-center gap-2 text-komazi-muted">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-komazi-coral shrink-0" />
                <span>Mendeteksi koordinat GPS presisi tinggi...</span>
              </div>
            ) : gpsError ? (
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <strong className="block text-rose-200">GPS Tidak Terdeteksi</strong>
                  <p className="text-[11px] text-rose-300/90 leading-relaxed">{gpsError}</p>
                </div>
              </div>
            ) : hasOutletCoords && isGeofenceEnabled ? (
              <div
                className={`p-2.5 rounded-xl border flex items-start gap-2.5 ${
                  isDistanceValid
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                }`}
              >
                {isDistanceValid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center justify-between font-bold">
                    <span>{isDistanceValid ? 'Terverifikasi di Outlet' : 'Di Luar Radius Outlet'}</span>
                    <span className="font-mono text-[11px]">
                      {distanceMeters !== null ? `${distanceMeters} meter` : '-'}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-90 leading-relaxed">
                    {isDistanceValid
                      ? `Kamu berada di area komazi (toleransi maks: ${maxRadiusMeters}m).`
                      : `Jarak kamu ${distanceMeters}m dari komazi (maksimal: ${maxRadiusMeters}m).`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-komazi-surface border border-komazi-border text-komazi-muted flex items-center justify-between">
                <span>GPS Terdeteksi ({staffCoords?.latitude?.toFixed(4)}, {staffCoords?.longitude?.toFixed(4)})</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] bg-blue-500/15 text-blue-400 font-bold">
                  Bebas Radius
                </span>
              </div>
            )}
          </div>

          {/* 3. Catatan Staf (Opsional) */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-komazi-muted uppercase tracking-wider">
              Keterangan Tambahan (Opsional):
            </label>
            <input
              type="text"
              value={staffNotes}
              onChange={(e) => setStaffNotes(e.target.value)}
              placeholder="Contoh: Shift pagi, seragam lengkap"
              className="w-full px-3 py-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-komazi-text placeholder-komazi-muted text-xs focus:border-komazi-coral outline-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-xl bg-komazi-surface-2 border border-komazi-border hover:bg-neutral-800 text-komazi-muted hover:text-white font-bold transition-colors"
            >
              Batal
            </button>
            <LoadingButton
              type="submit"
              isLoading={isSubmitting}
              disabled={!canSubmit}
              loadingText="Memverifikasi..."
              variant="primary"
              size="lg"
              icon={isClockOut ? XCircle : CheckCircle2}
              className={`flex-2 py-3 rounded-xl font-bold shadow-lg ${
                !canSubmit
                  ? 'opacity-50 cursor-not-allowed bg-neutral-800 text-neutral-500 border border-neutral-700'
                  : isClockOut
                  ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/25'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20'
              }`}
            >
              {isLocationBlocked
                ? 'Di Luar Area Outlet'
                : isPhotoBlocked
                ? 'Ambil Foto Selfie Dahulu'
                : isClockOut
                ? 'Konfirmasi Presensi Pulang'
                : 'Konfirmasi Presensi Masuk'}
            </LoadingButton>
          </div>
        </form>
      </div>
    </div>
  );
}
