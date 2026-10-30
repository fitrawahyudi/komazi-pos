import { test, expect } from '@playwright/test';

test.describe('05 - Shift Kasir & Cash Drawer Laci Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Login menggunakan akun owner
    await page.goto('/login');
    const usernameInput = page.locator('input[placeholder*="kasir / manager / owner"]');
    await expect(usernameInput).toBeVisible();
    await usernameInput.fill('owner');

    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('password123');

    const submitLoginBtn = page.locator('button[type="submit"]:has-text("Masuk")');
    await submitLoginBtn.click();

    await page.waitForURL('**/pos', { timeout: 15000 });
    await expect(page).toHaveURL(/\/pos/);

    // Buka shift jika belum aktif
    const openShiftModal = page.locator('text=Sesi Kasir Belum Dibuka');
    if (await openShiftModal.isVisible({ timeout: 2500 }).catch(() => false)) {
      const startShiftBtn = page.locator('button[type="submit"]:has-text("Buka Sesi Kasir & Mulai Transaksi")');
      await startShiftBtn.click();
      await expect(openShiftModal).not.toBeVisible({ timeout: 10000 });
    }
  });

  test('Manajemen Peti Kas: Pencatatan Kas Masuk & Kas Keluar di Cash Drawer', async ({ page }) => {
    // 1. Akses halaman Cash Drawer
    await page.goto('/cash-drawer');
    await expect(page).toHaveURL(/\/cash-drawer/);

    // 2. Verifikasi Metrik Keuangan Kasir
    await expect(page.locator('text=Saldo Kas di Laci Saat Ini').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Modal Awal Kasir').first()).toBeVisible();

    // 3. Catat Kas Masuk (Petty Cash Tambahan)
    const kasMasukBtn = page.locator('button:visible:has-text("Kas Masuk")').first();
    await expect(kasMasukBtn).toBeVisible();
    await kasMasukBtn.click();

    // Verifikasi Modal Mutasi Kas Masuk terbuka
    await expect(page.locator('h3:has-text("Kas Masuk")').first()).toBeVisible({ timeout: 5000 });

    // Isi nominal dan alasan
    const nominalInput = page.locator('input[type="number"][min="1000"]');
    await nominalInput.fill('50000');

    const reasonTextarea = page.locator('textarea[required]');
    await reasonTextarea.fill('Uang Pecahan Tambahan Automated Test Playwright');

    // Simpan Mutasi Kas
    const saveMovementBtn = page.locator('button[type="submit"]:has-text("Simpan Mutasi Kas")');
    await saveMovementBtn.click();

    // 4. Verifikasi mutasi Kas Masuk tercatat di tabel
    const historyTable = page.locator('table');
    await expect(historyTable).toBeVisible({ timeout: 8000 });
    const kasMasukRow = page.locator('tr').filter({ hasText: 'Uang Pecahan Tambahan Automated Test Playwright' }).first();
    await expect(kasMasukRow).toBeVisible({ timeout: 8000 });
    await expect(kasMasukRow).toContainText('Kas Masuk');

    // 5. Catat Kas Keluar (Pengeluaran Operasional Cepat)
    const kasKeluarBtn = page.locator('button:visible:has-text("Kas Keluar")').first();
    await expect(kasKeluarBtn).toBeVisible();
    await kasKeluarBtn.click();

    await expect(page.locator('h3:has-text("Kas Keluar")').first()).toBeVisible({ timeout: 5000 });
    await page.locator('input[type="number"][min="1000"]').fill('25000');
    await page.locator('textarea[required]').fill('Beli Es Batu Darurat Automated Test Playwright');

    const saveKasKeluarBtn = page.locator('button[type="submit"]:has-text("Simpan Mutasi Kas")');
    await saveKasKeluarBtn.click();

    // 6. Verifikasi mutasi Kas Keluar tercatat di tabel
    const kasKeluarRow = page.locator('tr').filter({ hasText: 'Beli Es Batu Darurat Automated Test Playwright' }).first();
    await expect(kasKeluarRow).toBeVisible({ timeout: 8000 });
    await expect(kasKeluarRow).toContainText('Kas Keluar');
  });

  test('Monitoring Sesi Kas Terbuka & Dialog Rekonsiliasi Tutup Sesi', async ({ page }) => {
    // 1. Akses halaman Sesi Kas Terbuka
    await page.goto('/cash-session');
    await expect(page).toHaveURL(/\/cash-session/);

    // 2. Verifikasi Banner & Informasi Sesi Aktif
    await expect(page.locator('h1:has-text("Sesi Kas Terbuka")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=SESI AKTIF').first()).toBeVisible();
    await expect(page.locator('text=Modal Awal').first()).toBeVisible();

    // 3. Verifikasi Tombol Tutup Sesi Kasir & Rekonsiliasi
    const closeShiftBtn = page.locator('button:has-text("Tutup Sesi Kasir & Rekonsiliasi")').first();
    await expect(closeShiftBtn).toBeVisible();
    await closeShiftBtn.click();

    // 4. Verifikasi Dialog Tutup Sesi & Rekonsiliasi Terbuka
    const modalTitle = page.locator('h2:has-text("Manajemen Sesi Kasir")').first();
    await expect(modalTitle).toBeVisible({ timeout: 8000 });

    // Verifikasi elemen kalkulasi uang fisik kasir di dalam modal
    await expect(page.locator('text=Total Kas yang Diharapkan di Laci').or(page.locator('text=Modal Awal')).first()).toBeVisible();

    // 5. Tutup modal secara aman tanpa menyelesaikan penutupan shift agar tidak merusak state sesi
    const closeBtn = page.locator('div[role="dialog"] button:has(svg)').first();
    await closeBtn.click();
    await expect(modalTitle).not.toBeVisible({ timeout: 5000 });
  });
});
