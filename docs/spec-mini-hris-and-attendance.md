# Spesifikasi Teknis: Mini HRIS & Absensi Digital Staf (Fase 4)

## 1. Objective
1. Mengintegrasikan durasi jam kerja staf (`workDurationMinutes` dan `workDurationFormatted`) pada endpoint riwayat shift `GET /api/shifts/history`.
2. Menyajikan penghitungan durasi aktif kehadiran staf secara langsung di [ShiftModal.jsx](file:///d:/pos-komazi/frontend/src/components/shift/ShiftModal.jsx) dengan status `● Presensi Aktif`.

## 2. Implementasi
- Di `shiftController.js`:
  ```javascript
  const durationMs = s.closedAt ? Math.max(0, new Date(s.closedAt).getTime() - new Date(s.openedAt).getTime()) : 0;
  const durationMinutes = Math.floor(durationMs / 60000);
  const hours = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  const workDurationFormatted = `${hours}j ${mins}m`;
  ```
- Di `ShiftModal.jsx`: Menampilkan durasi jam kerja langsung di kartu ringkasan shift kasir.
