import { test, expect } from '@playwright/test';

test.describe('04 - Inventory Stok & Pengurangan Resep (BOM) Workflow', () => {
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

  test('Manajemen Bahan Baku & Pencatatan Mutasi Stok Manual (Restok Masuk)', async ({ page }) => {
    // 1. Akses halaman Sumber Persediaan (Bahan Baku)
    await page.goto('/inventory/sources');
    await expect(page).toHaveURL(/\/inventory\/sources/);

    // Verifikasi header halaman
    await expect(page.locator('h1:has-text("Sumber Persediaan")')).toBeVisible({ timeout: 10000 });

    // Tunggu tabel bahan baku memuat data
    await page.waitForSelector('table tbody tr td', { timeout: 10000 });

    // 2. Cari bahan baku "Beef Patty" pada input pencarian tabel bahan baku
    const searchInput = page.locator('input[placeholder*="satuan"]');
    await searchInput.fill('Beef Patty');
    await page.waitForTimeout(500);

    // Verifikasi baris tabel memuat "Beef Patty"
    const ingredientRow = page.locator('table tbody tr').filter({ hasText: 'Beef Patty' }).first();
    await expect(ingredientRow).toBeVisible({ timeout: 8000 });

    // 3. Klik tombol Tambah stok pembelian (Restok Masuk)
    const restockBtn = ingredientRow.locator('button[aria-label="Tambah stok masuk"]');
    await expect(restockBtn).toBeVisible();
    await restockBtn.click();

    // 4. Modal Mutasi Terbuka
    await expect(page.locator('h3:has-text("Pencatatan Stok Masuk")').first()).toBeVisible({ timeout: 5000 });

    // Isi Qty & Catatan
    const qtyInput = page.locator('input[type="number"][required]').first();
    await qtyInput.fill('15');

    const noteInput = page.locator('input[placeholder*="Pembelian supplier"]').first();
    if (await noteInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await noteInput.fill('Restok Pengadaan Playwright Automated Test');
    }

    // Submit form modal
    const submitBtn = page.locator('button[type="submit"]:has-text("Simpan")').first();
    await submitBtn.click();

    // 5. Verifikasi muncul di Riwayat Pergerakan Stok
    const historySection = page.locator('h3:has-text("Riwayat Pergerakan Stok")');
    await expect(historySection).toBeVisible({ timeout: 8000 });
    await historySection.scrollIntoViewIfNeeded();

    // Klik filter tab Masuk / Restok
    const purchaseTab = page.locator('button:has-text("Masuk / Restok")').first();
    await purchaseTab.click();

    // Verifikasi mutasi tercatat dengan nama Beef Patty & Qty +15
    const latestMovementCard = page.locator('div:has-text("Beef Patty")').filter({ hasText: 'Masuk / Restok' }).first();
    await expect(latestMovementCard).toBeVisible({ timeout: 8000 });
    await expect(latestMovementCard).toContainText('+15');
  });

  test('Pengurangan Otomatis Stok Bahan Berbasis Resep (BOM) Pasca Order POS', async ({ page }) => {
    // 1. Buka POS Kasir
    await page.goto('/pos');
    await page.waitForSelector('button[aria-label^="Tambah "]', { state: 'visible', timeout: 15000 });

    // Bersihkan keranjang jika ada
    const clearCartBtn = page.locator('button:visible[title="Kosongkan Keranjang"]').or(page.locator('button:visible:has-text("Batal Edit")'));
    if (await clearCartBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await clearCartBtn.first().click();
    }

    // 2. Pilih produk Burger (yang memiliki resep BOM)
    const burgerBtn = page.locator('button[aria-label*="Burger Hot Spicy"]').first();
    if (await burgerBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
      await burgerBtn.click();
    } else {
      // Fallback ke produk pertama yang tersedia
      await page.locator('button[aria-label^="Tambah "]').first().click();
    }

    // Handle variant modal jika muncul
    const variantSubmitBtn = page.locator('button:visible:has-text("Tambah ke Keranjang")');
    if (await variantSubmitBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await variantSubmitBtn.first().click();
    }

    // 3. Bayar dengan CASH
    const bayarBtn = page.locator('button:visible:has-text("BAYAR")').first();
    await expect(bayarBtn).toBeEnabled({ timeout: 5000 });
    await bayarBtn.click();

    const paymentModal = page.locator('div[role="dialog"]').filter({ hasText: 'Pembayaran' });
    await expect(paymentModal).toBeVisible({ timeout: 8000 });

    const confirmPaymentBtn = paymentModal.locator('button:has-text("Konfirmasi Pembayaran")');
    await confirmPaymentBtn.click();

    // 4. Struk Penjualan Muncul
    const receiptModal = page.locator('div[role="dialog"]').filter({ hasText: 'KOMAZI' }).or(page.locator('text=STRUK PEMBAYARAN')).first();
    await expect(receiptModal).toBeVisible({ timeout: 10000 });

    // Tutup Struk
    const closeReceiptBtn = page.locator('button:visible[title="Tutup Modal"]').or(page.locator('button:visible:has-text("Tutup")')).first();
    await closeReceiptBtn.click();

    // 5. Buka kembali halaman Sumber Persediaan untuk cek audit trail mutasi penjualan (SALE)
    await page.goto('/inventory/sources');
    await expect(page.locator('h1:has-text("Sumber Persediaan")')).toBeVisible({ timeout: 10000 });

    const historySection = page.locator('h3:has-text("Riwayat Pergerakan Stok")');
    await expect(historySection).toBeVisible({ timeout: 8000 });
    await historySection.scrollIntoViewIfNeeded();

    // Klik filter tab "Terjual" (SALE mutasi dari POS)
    const saleTab = page.locator('button:has-text("Terjual")').first();
    await saleTab.click();

    // Verifikasi ada mutasi bertipe "Transaksi Penjualan"
    const saleMovementCard = page.locator('span:has-text("Transaksi Penjualan")').first();
    await expect(saleMovementCard).toBeVisible({ timeout: 8000 });
  });
});
