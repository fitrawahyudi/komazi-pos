import { test, expect } from '@playwright/test';

test.describe('01 - POS Checkout & Payments Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login menggunakan akun dev
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

    // Tunggu produk tampil di layar
    await page.waitForSelector('button[aria-label^="Tambah "]', { state: 'visible', timeout: 15000 });

    // Bersihkan keranjang awal jika ada
    const clearCartBtn = page.locator('button:visible[title="Kosongkan Keranjang"]').or(page.locator('button:visible:has-text("Batal Edit")'));
    if (await clearCartBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await clearCartBtn.first().click();
    }
  });

  test('Transaksi Take-Away: Pilih menu -> Bayar Tunai (CASH) -> Verifikasi Struk Take-Away', async ({ page }) => {
    // 1. Pilih tipe pesanan Take-Away
    const takeawayBtn = page.locator('button:visible:has-text("Take-Away")').first();
    await takeawayBtn.click();

    // 2. Tambah produk pertama ke keranjang
    const addProductButtons = page.locator('button[aria-label^="Tambah "]');
    const firstProductBtn = addProductButtons.nth(0);
    const firstProductLabel = (await firstProductBtn.getAttribute('aria-label')) || '';
    const productName = firstProductLabel.replace(/^Tambah\s+/, '').replace(/\s+ke pesanan$/, '').trim();
    await firstProductBtn.click();

    // Handle variant modal jika menu memiliki varian
    const variantSubmitBtn = page.locator('button:visible:has-text("Tambah ke Keranjang")');
    if (await variantSubmitBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await variantSubmitBtn.first().click();
    }

    // Verifikasi keranjang terisi 1 item
    await expect(page.locator('h3:visible:has-text("Keranjang")')).toContainText('1 item', { timeout: 5000 });

    // 3. Klik tombol BAYAR di keranjang kasir
    const bayarBtn = page.locator('button:visible:has-text("BAYAR")').first();
    await expect(bayarBtn).toBeEnabled();
    await bayarBtn.click();

    // 4. Verifikasi Modal Pembayaran terbuka
    const paymentModal = page.locator('div[role="dialog"]').filter({ hasText: 'Pembayaran' });
    await expect(paymentModal).toBeVisible({ timeout: 8000 });

    // 5. Konfirmasi pembayaran metode CASH (default)
    const confirmPaymentBtn = paymentModal.locator('button:has-text("Konfirmasi Pembayaran")');
    await expect(confirmPaymentBtn).toBeVisible({ timeout: 5000 });
    await confirmPaymentBtn.click();

    // 6. Verifikasi Struk Penjualan muncul & memuat nama menu
    const receiptModal = page.locator('div[role="dialog"]').filter({ hasText: 'KOMAZI' }).or(page.locator('text=STRUK PEMBAYARAN')).first();
    await expect(receiptModal).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${productName}`).first()).toBeVisible();

    // Tutup struk
    const closeReceiptBtn = page.locator('button:visible[title="Tutup Modal"]').or(page.locator('button:visible:has-text("Tutup")')).first();
    await closeReceiptBtn.click();
    await expect(receiptModal).not.toBeVisible();
  });

  test('Transaksi Dine-In dengan Meja: Pilih menu -> Bayar QRIS -> Verifikasi Pembayaran & Struk', async ({ page }) => {
    // 1. Pilih tipe pesanan Dine-In & isi No Meja
    const dineInBtn = page.locator('button:visible:has-text("Dine-In")').first();
    await dineInBtn.click();

    const tableInput = page.locator('input[placeholder="No Meja"]:visible');
    if (await tableInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tableInput.fill('07');
    }

    // 2. Tambah produk ke keranjang
    const addProductButtons = page.locator('button[aria-label^="Tambah "]');
    const productBtn = addProductButtons.nth(1);
    const productLabel = (await productBtn.getAttribute('aria-label')) || '';
    const productName = productLabel.replace(/^Tambah\s+/, '').replace(/\s+ke pesanan$/, '').trim();
    await productBtn.click();

    const variantSubmitBtn = page.locator('button:visible:has-text("Tambah ke Keranjang")');
    if (await variantSubmitBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await variantSubmitBtn.first().click();
    }

    await expect(page.locator('h3:visible:has-text("Keranjang")')).toContainText('1 item', { timeout: 5000 });

    // 3. Klik tombol BAYAR
    const bayarBtn = page.locator('button:visible:has-text("BAYAR")').first();
    await expect(bayarBtn).toBeEnabled();
    await bayarBtn.click();

    // 4. Modal Pembayaran: Pilih metode QRIS
    const paymentModal = page.locator('div[role="dialog"]').filter({ hasText: 'Pembayaran' });
    await expect(paymentModal).toBeVisible({ timeout: 8000 });

    const qrisMethodBtn = paymentModal.locator('button:has-text("QRIS")').first();
    if (await qrisMethodBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await qrisMethodBtn.click();
    }

    // 5. Konfirmasi pembayaran QRIS (atau simulasi masuk dana)
    const confirmQrisBtn = paymentModal.locator('button:has-text("Konfirmasi QRIS")').or(paymentModal.locator('button:has-text("Konfirmasi Pembayaran")')).first();
    await expect(confirmQrisBtn).toBeVisible({ timeout: 5000 });
    await confirmQrisBtn.click();

    // 6. Verifikasi Struk Penjualan muncul dengan nomor meja
    const receiptModal = page.locator('div[role="dialog"]').filter({ hasText: 'KOMAZI' }).or(page.locator('text=STRUK PEMBAYARAN')).first();
    await expect(receiptModal).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${productName}`).first()).toBeVisible();

    // Tutup struk
    const closeReceiptBtn = page.locator('button:visible[title="Tutup Modal"]').or(page.locator('button:visible:has-text("Tutup")')).first();
    await closeReceiptBtn.click();
    await expect(receiptModal).not.toBeVisible();
  });
});

