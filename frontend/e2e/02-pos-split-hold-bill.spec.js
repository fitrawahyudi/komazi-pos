import { test, expect } from '@playwright/test';

test.describe('POS - Split Bill & Open Bills E2E Workflow', () => {
  test('Alur lengkap: Login Kasir -> Buka Shift -> Order 2 Menu -> Split Bill Batch 1 -> Bayar -> Validasi Struk & Sisa Bill Tertahan', async ({
    page,
  }) => {
    // 1. Masuk ke halaman login
    await page.goto('/login');
    await expect(page).toHaveTitle(/Komazi/i);

    // 2. Login menggunakan akun Owner / Kasir dev
    const usernameInput = page.locator('input[placeholder*="kasir / manager / owner"]');
    await expect(usernameInput).toBeVisible();
    await usernameInput.fill('owner');

    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('password123');

    const submitLoginBtn = page.locator('button[type="submit"]:has-text("Masuk")');
    await submitLoginBtn.click();

    // 3. Verifikasi navigasi berhasil ke halaman POS (/pos)
    await page.waitForURL('**/pos', { timeout: 15000 });
    await expect(page).toHaveURL(/\/pos/);

    // 4. Jika Sesi Kasir (Shift) belum terbuka, buka shift kasir terlebih dahulu
    const openShiftModal = page.locator('text=Sesi Kasir Belum Dibuka');
    if (await openShiftModal.isVisible({ timeout: 2500 }).catch(() => false)) {
      const startShiftBtn = page.locator('button[type="submit"]:has-text("Buka Sesi Kasir & Mulai Transaksi")');
      await expect(startShiftBtn).toBeVisible();
      await startShiftBtn.click();
      await expect(openShiftModal).not.toBeVisible({ timeout: 10000 });
    }

    // Tunggu katalog produk POS tampil
    await page.waitForSelector('button[aria-label^="Tambah "]', { state: 'visible', timeout: 15000 });

    // Kosongkan keranjang jika ada sisa item sebelumnya
    const clearCartBtn = page.locator('button:visible[title="Kosongkan Keranjang"]').or(page.locator('button:visible:has-text("Batal Edit")'));
    if (await clearCartBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await clearCartBtn.first().click();
    }

    // 5. Masukkan Nomor Meja
    const tableInput = page.locator('input[placeholder="No Meja"]:visible');
    if (await tableInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tableInput.fill('12');
    }

    // 6. Pilih 2 Menu Berbeda ke dalam keranjang
    const addProductButtons = page.locator('button[aria-label^="Tambah "]');
    const availableCount = await addProductButtons.count();
    expect(availableCount).toBeGreaterThanOrEqual(2);

    // Tambah Menu 1
    const firstProductBtn = addProductButtons.nth(0);
    const firstProductLabel = (await firstProductBtn.getAttribute('aria-label')) || '';
    const firstProductName = firstProductLabel.replace(/^Tambah\s+/, '').replace(/\s+ke pesanan$/, '').trim();
    await firstProductBtn.click();

    // Jika muncul modal varian/modifier, konfirmasi tambah
    const variantSubmitBtn = page.locator('button:visible:has-text("Tambah ke Keranjang")');
    if (await variantSubmitBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await variantSubmitBtn.first().click();
    }

    // Tambah Menu 2
    const secondProductBtn = addProductButtons.nth(1);
    const secondProductLabel = (await secondProductBtn.getAttribute('aria-label')) || '';
    const secondProductName = secondProductLabel.replace(/^Tambah\s+/, '').replace(/\s+ke pesanan$/, '').trim();
    await secondProductBtn.click();

    if (await variantSubmitBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await variantSubmitBtn.first().click();
    }

    // Verifikasi keranjang memuat 2 jenis item (hanya targetkan heading yang visible)
    await expect(page.locator('h3:visible:has-text("Keranjang")')).toContainText('2 item', { timeout: 5000 });

    // 7. Buka modal Split Bill (gunakan tombol yang visible)
    const splitButton = page.locator('button:visible:has-text("Split")').first();
    await expect(splitButton).toBeEnabled();
    await splitButton.click();

    // Verifikasi Modal Split Bill terbuka
    const splitModal = page.locator('div[role="dialog"]').filter({ hasText: 'Pisah Tagihan (Split Bill)' });
    await expect(splitModal).toBeVisible({ timeout: 5000 });

    // 8. Pilih hanya Menu 1 untuk dibayar pada Batch 1
    // Klik "Kosongkan" terlebih dahulu untuk memastikan tidak ada item terpilih
    const deselectAllBtn = splitModal.locator('button:has-text("Kosongkan")');
    if (await deselectAllBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await deselectAllBtn.click();
    }

    // Pilih menu pertama di dalam modal Split Bill
    const firstItemInModal = splitModal.locator('.cursor-pointer').filter({ hasText: firstProductName }).first();
    await firstItemInModal.click();

    // Verifikasi tombol berubah menjadi "Bayar Batch 1 (Rp ...)"
    const payBatch1Btn = splitModal.locator('button:has-text("Bayar Batch 1")');
    await expect(payBatch1Btn).toBeVisible({ timeout: 5000 });
    await expect(payBatch1Btn).toBeEnabled();

    // 9. Eksekusi Pembayaran Batch 1
    await payBatch1Btn.click();

    // 10. Verifikasi Modal Pembayaran Terbuka
    const paymentModal = page.locator('div[role="dialog"]').filter({ hasText: 'Pembayaran' });
    await expect(paymentModal).toBeVisible({ timeout: 8000 });

    // Pilih metode CASH (default) dan konfirmasi pembayaran
    const confirmPaymentBtn = paymentModal.locator('button:has-text("Konfirmasi Pembayaran")');
    await expect(confirmPaymentBtn).toBeVisible({ timeout: 5000 });
    await confirmPaymentBtn.click();

    // 11. Verifikasi Struk Belanja (Thermal Receipt Modal)
    // Struk harus muncul setelah pembayaran sukses
    const receiptModal = page.locator('div[role="dialog"]').filter({ hasText: 'KOMAZI' }).or(page.locator('text=STRUK PEMBAYARAN')).first();
    await expect(receiptModal).toBeVisible({ timeout: 10000 });

    // VERIFIKASI PENTING 1: Menu 1 (yang dibayar) HARUS ada di struk
    await expect(page.locator(`text=${firstProductName}`).first()).toBeVisible();

    // VERIFIKASI PENTING 2: Menu 2 (Batch 2 / Sisa) TIDAK BOLEH muncul di struk Batch 1
    const receiptLineItems = page.locator('.space-y-1\\.5.my-1\\.5').first();
    if (await receiptLineItems.isVisible({ timeout: 2000 }).catch(() => false)) {
      const receiptContent = await receiptLineItems.innerText();
      expect(receiptContent).toContain(firstProductName);
      expect(receiptContent).not.toContain(secondProductName);
    }

    // Tutup Modal Struk
    const closeReceiptBtn = page.locator('button:visible[title="Tutup Modal"]').or(page.locator('button:visible:has-text("Tutup")')).first();
    await closeReceiptBtn.click();

    // 12. Kembali ke POS: Keranjang lokal harus kosong
    await expect(page.locator('text=Keranjang kosong:visible').or(page.locator('h3:visible:has-text("Keranjang (0 item)")'))).toBeVisible({ timeout: 8000 });

    // 13. VERIFIKASI PENTING 3: Batch 2 (Sisa Split Bill) HARUS ada di "Pesanan Tertahan" (Open Bills)
    const openBillsBanner = page.locator('button:visible:has-text("Pesanan Tertahan")').first();
    await expect(openBillsBanner).toBeVisible({ timeout: 8000 });
    await openBillsBanner.click();

    // Modal Pesanan Tertahan terbuka
    const openBillsModal = page.locator('text=Daftar Pesanan Tertahan').first();
    await expect(openBillsModal).toBeVisible({ timeout: 5000 });

    // Label Meja 12 (Sisa Split Bill) harus muncul di daftar
    const splitRemainingBill = page.locator('text=Sisa Split Bill').first();
    await expect(splitRemainingBill).toBeVisible({ timeout: 8000 });

    // Menu 2 harus tercatat sebagai sisa item yang belum dibayar
    await expect(page.locator(`text=${secondProductName}`).first()).toBeVisible();

    // Tutup modal Open Bills
    const closeOpenBillsBtn = page.locator('button:visible[title="Tutup"]').or(page.locator('button:visible:has-text("Tutup")')).first();
    await closeOpenBillsBtn.click();
    await expect(openBillsModal).not.toBeVisible();
  });
});
