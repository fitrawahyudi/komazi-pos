import { test, expect } from '@playwright/test';

test.describe('03 - KDS (Kitchen & Barista Display System) Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Login menggunakan akun dev
    await page.goto('/login');
    const usernameInput = page.locator('input[placeholder*="kasir / manager / owner"]');
    await expect(usernameInput).toBeVisible();
    await usernameInput.fill('owner');

    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('password123');

    const submitLoginBtn = page.locator('button[type="submit"]:has-text("Masuk")');
    await submitLoginBtn.click();

    await page.waitForURL('**/pos', { timeout: 15000 });

    // Buka shift jika belum aktif
    const openShiftModal = page.locator('text=Sesi Kasir Belum Dibuka');
    if (await openShiftModal.isVisible({ timeout: 2500 }).catch(() => false)) {
      const startShiftBtn = page.locator('button[type="submit"]:has-text("Buka Sesi Kasir & Mulai Transaksi")');
      await startShiftBtn.click();
      await expect(openShiftModal).not.toBeVisible({ timeout: 10000 });
    }
  });

  test('Alur KDS: Buat pesanan di POS -> Buka layar KDS -> Verifikasi tiket pesanan tampil -> Bump tiket selesai saji', async ({
    page,
  }) => {
    // 1. Bersihkan keranjang
    const clearCartBtn = page.locator('button:visible[title="Kosongkan Keranjang"]').or(page.locator('button:visible:has-text("Batal Edit")'));
    if (await clearCartBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await clearCartBtn.first().click();
    }

    // 2. Isi No Meja unik untuk testing KDS
    const testTableNo = `K${Date.now().toString().slice(-2)}`;
    const tableInput = page.locator('input[placeholder="No Meja"]:visible');
    if (await tableInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tableInput.fill(testTableNo);
    }

    // 3. Tambah produk ke keranjang
    const addProductButtons = page.locator('button[aria-label^="Tambah "]');
    const firstProductBtn = addProductButtons.first();
    const firstProductLabel = (await firstProductBtn.getAttribute('aria-label')) || '';
    const productName = firstProductLabel.replace(/^Tambah\s+/, '').replace(/\s+ke pesanan$/, '').trim();
    await firstProductBtn.click();

    const variantSubmitBtn = page.locator('button:visible:has-text("Tambah ke Keranjang")');
    if (await variantSubmitBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await variantSubmitBtn.first().click();
    }

    // 4. Selesaikan pesanan via Bayar Tunai agar langsung terkirim ke KDS
    const bayarBtn = page.locator('button:visible:has-text("BAYAR")').first();
    await bayarBtn.click();
    const confirmPaymentBtn = page.locator('button:visible:has-text("Konfirmasi Pembayaran")').first();
    await confirmPaymentBtn.click();
    const closeReceiptBtn = page.locator('button:visible[title="Tutup Modal"]').first();
    await closeReceiptBtn.click();

    // 5. Buka Layar KDS (/kds)
    await page.goto('/kds');
    await expect(page).toHaveURL(/\/kds/);

    // Tunggu antarmuka KDS termuat
    await page.waitForSelector('text=Kitchen & Bar Display System', { state: 'visible', timeout: 15000 });

    // 6. Verifikasi tiket pesanan yang baru dibuat tampil di layar KDS
    const targetTicket = page.locator(`text=${productName}`).first();
    await expect(targetTicket).toBeVisible({ timeout: 10000 });

    // 7. Uji Filter Station (Tab Semua, Dapur, Barista)
    const dapurTab = page.locator('button:visible:has-text("Dapur")').first();
    if (await dapurTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dapurTab.click();
    }

    const baristaTab = page.locator('button:visible:has-text("Barista / Bar")').first();
    if (await baristaTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await baristaTab.click();
    }

    const semuaTab = page.locator('button:visible:has-text("Semua")').first();
    if (await semuaTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await semuaTab.click();
    }

    // 8. Uji BUMP TIKET (Memajukan status pesanan)
    const bumpTicketBtn = page.locator('button:visible:has-text("BUMP TIKET")').or(page.locator('button:visible:has-text("Mulai")')).first();
    if (await bumpTicketBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await bumpTicketBtn.click();
      await page.waitForTimeout(1000);
    }
  });
});
