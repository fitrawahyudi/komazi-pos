# Spesifikasi Teknis: Penguatan Hak Akses (RBAC) & Proteksi Data Sensitif (Fase 1)

## 1. Objective
1. Mengamankan endpoint riwayat shift di backend agar staf non-manager/owner hanya bisa melihat shift miliknya sendiri (`req.user.id`).
2. Menambahkan role guard `requireRole(['OWNER', 'MANAGER'])` pada pembaruan printer (`PATCH/PUT /api/printers/:id`).
3. Memperbaiki izin rute dan sidebar untuk Printer Kasir agar staf `CASHIER` dapat membuka antarmuka `/printer` untuk pairing perangkat printer Bluetooth/USB/LAN.
4. Memvalidasi bahwa seluruh data finansial sensitif (HPP, margin, laporan laba rugi, dan AI business context) terlindungi dari akses peran kasir.

## 2. File Terkait
- **Backend:**
  - `backend/src/controllers/shiftController.js` (Isolasi data shift per cashierId)
  - `backend/src/routes/printerRoutes.js` (Proteksi role `updatePrinter`)
- **Frontend:**
  - `frontend/src/App.jsx` (Izin rute `/printer` untuk CASHIER, MANAGER, OWNER)
  - `frontend/src/components/layout/Sidebar.jsx` (Menu navigasi `Printer Kasir` aktif untuk CASHIER)

## 3. Detail Implementasi

### 3.1 Backend: Isolasi Riwayat Shift (`shiftController.js`)
Pada fungsi `getShiftHistory`:
```javascript
const where = { closedAt: { not: null } };
if (!['MANAGER', 'OWNER'].includes(req.user?.role)) {
  where.cashierId = req.user.id;
}
```
Sehingga saat kasir membuka riwayat shift atau laporan penutupan kasirnya, kasir hanya melihat rekonsiliasi kas yang dikelolanya sendiri.

### 3.2 Backend: Proteksi Pembaruan Profil Printer (`printerRoutes.js`)
Pembaruan printer (`PATCH /:id` dan `PUT /:id`) ditambahkan middleware `requireRole(['OWNER', 'MANAGER'])`:
```javascript
router.patch('/:id', authenticate, requireRole(['OWNER', 'MANAGER']), updatePrinter);
router.put('/:id', authenticate, requireRole(['OWNER', 'MANAGER']), updatePrinter);
```

### 3.3 Frontend: Akses Printer Kasir (`App.jsx` & `Sidebar.jsx`)
- Di `App.jsx`:
  ```jsx
  <Route
    path="printer"
    element={
      <ProtectedRoute allowedRoles={['OWNER', 'MANAGER', 'CASHIER']}>
        <PrinterRoute />
      </ProtectedRoute>
    }
  />
  ```
- Di `Sidebar.jsx`:
  ```javascript
  {
    to: '/printer',
    label: 'Printer Kasir',
    icon: Printer,
    allowed: !isKitchenStaff,
  }
  ```
  Staf dapur/barista tidak memerlukan halaman printer kasir (menggunakan KDS/BDS), namun Kasir, Manager, dan Owner dapat mengaksesnya.

## 4. Boundaries
- **Always:** Pastikan kasir tetap bisa melakukan transaksi harian dan buka/tutup shift secara normal.
- **Never:** Menghilangkan riwayat shift di database.
