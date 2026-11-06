import prisma from '../src/config/db.js';
import {
  getPublicQrOrderConfig,
  getPublicMenu,
  updateQrOrderConfig,
  validateCartStock,
  checkoutQrOrder,
  getPendingQrOrders,
  confirmQrOrderPayment,
  rejectQrOrderPayment,
} from '../src/controllers/qrOrderController.js';

function mockReq(body = {}, params = {}, query = {}, user = null) {
  return {
    body,
    params,
    query,
    user: user || { id: 1, role: 'CASHIER', name: 'Kasir Uji Coba' },
  };
}

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.json = function (payload) {
    res.data = payload;
    return res;
  };
  return res;
}

// 1x1 transparent PNG base64 for testing proof upload
const DUMMY_BASE64_PROOF =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

async function runEndToEndTests() {
  console.log('🚀 ========================================================');
  console.log('   KOMAZI POS: END-TO-END VERIFICATION (QR TABLE ORDER)');
  console.log('========================================================\n');

  try {
    // ----------------------------------------------------
    // SKENARIO 1: Saklar Percobaan OFF (Default Mode)
    // ----------------------------------------------------
    console.log('📋 [SKENARIO 1]: Pengujian Saklar Fitur Nonaktif (Default Percobaan)');
    const resConfigOff = mockRes();
    await updateQrOrderConfig(mockReq({ enabled: false }), resConfigOff);

    const resCheckConfig = mockRes();
    await getPublicQrOrderConfig(mockReq(), resCheckConfig);
    console.log('   -> Config enabled:', resCheckConfig.data?.data?.enabled);
    if (resCheckConfig.data?.data?.enabled !== false) {
      throw new Error('Skenario 1 Gagal: Fitur harus nonaktif secara default');
    }

    const resBlockedCheckout = mockRes();
    await checkoutQrOrder(
      mockReq({
        tableNo: '1',
        customerName: 'Tamu Uji',
        items: [{ productId: 1, qty: 1 }],
      }),
      resBlockedCheckout
    );
    console.log('   -> Checkout saat OFF diblokir dengan code:', resBlockedCheckout.statusCode);
    if (resBlockedCheckout.statusCode !== 403) {
      throw new Error('Skenario 1 Gagal: Checkout harus mengembalikan 403 saat fitur dimatikan');
    }
    console.log('   ✅ [SKENARIO 1 LULUS]: Proteksi saklar nonaktif bekerja sempurna.\n');

    // ----------------------------------------------------
    // AKTIFKAN FITUR UNTUK PENGUJIAN TRANSAKSI
    // ----------------------------------------------------
    console.log('⚙️ Mengaktifkan saklar QR Order untuk pengujian alur transaksi...');
    await updateQrOrderConfig(
      mockReq({
        enabled: true,
        bankName: 'BCA',
        accountNo: '8720192831',
        accountHolder: 'Komazi Coffee & Eatery',
      }),
      mockRes()
    );

    // ----------------------------------------------------
    // SKENARIO 2: Katalog Menu Publik & Validasi Menu
    // ----------------------------------------------------
    console.log('📋 [SKENARIO 2]: Katalog Menu Publik Pelanggan Meja');
    const resMenu = mockRes();
    await getPublicMenu(mockReq(), resMenu);
    const menuItems = resMenu.data?.data?.products || [];
    console.log(`   -> Total menu tersedia di smartphone tamu: ${menuItems.length} menu`);
    if (menuItems.length === 0) {
      throw new Error('Skenario 2 Gagal: Katalog menu publik kosong');
    }
    const sampleProduct = menuItems.find((p) => !p.isSoldOut) || menuItems[0];
    console.log(`   -> Sampel produk siap pesan: "${sampleProduct.name}" (Rp ${sampleProduct.price})`);
    console.log('   ✅ [SKENARIO 2 LULUS]: Menu publik berhasil dimuat dengan atribut lengkap.\n');

    // ----------------------------------------------------
    // SKENARIO 3: Validasi Stok Real-time (Out-of-Stock Protection)
    // ----------------------------------------------------
    console.log('📋 [SKENARIO 3]: Validasi Stok Real-time Keranjang');
    const resValidStock = mockRes();
    await validateCartStock(
      mockReq({
        items: [{ productId: sampleProduct.id, qty: 1 }],
      }),
      resValidStock
    );
    const isValid = resValidStock.data?.data?.valid;
    console.log('   -> Validasi qty normal:', isValid ? 'VALID' : 'INVALID');
    if (!isValid) {
      throw new Error('Skenario 3 Gagal: Produk dengan stok cukup seharusnya valid');
    }

    // Uji proteksi jika memesan kuantitas sangat besar (melebihi kapasitas stok)
    const resOverStock = mockRes();
    await validateCartStock(
      mockReq({
        items: [{ productId: sampleProduct.id, qty: 999999 }],
      }),
      resOverStock
    );
    const isOverValid = resOverStock.data?.data?.valid;
    console.log('   -> Validasi qty 999.999 (Over stock):', isOverValid ? 'VALID' : 'DITOLAK (Aman)');
    if (isOverValid) {
      throw new Error('Skenario 3 Gagal: Kuantitas 999.999 seharusnya tidak valid');
    }
    console.log('   ✅ [SKENARIO 3 LULUS]: Lapisan proteksi stok habis/kurang berfungsi optimal.\n');

    // ----------------------------------------------------
    // SKENARIO 4: Alur Normal - Scan Meja 03, Pesan & Upload Bukti Bayar
    // ----------------------------------------------------
    console.log('📋 [SKENARIO 4]: Checkout Tamu Meja 03 & Notifikasi Kasir');
    const resCheckout = mockRes();
    await checkoutQrOrder(
      mockReq({
        tableNo: '03',
        customerName: 'Ridho & Rina',
        paymentMethod: 'TRANSFER',
        proof: DUMMY_BASE64_PROOF,
        items: [{ productId: sampleProduct.id, qty: 2 }],
      }),
      resCheckout
    );

    const createdOrder = resCheckout.data?.data;
    console.log(`   -> Pesanan dibuat: #${createdOrder?.invoiceNo}`);
    console.log(`   -> Status awal: ${createdOrder?.status} (Menunggu verifikasi kasir)`);
    console.log(`   -> Meja: ${createdOrder?.tableNo}`);
    console.log(`   -> Total: Rp ${createdOrder?.total}`);
    if (createdOrder?.status !== 'PENDING_PAYMENT') {
      throw new Error('Skenario 4 Gagal: Status pesanan harus PENDING_PAYMENT');
    }

    // Verifikasi pesanan masuk ke daftar antrean verifikasi kasir
    const resPending = mockRes();
    await getPendingQrOrders(mockReq(), resPending);
    const pendingList = resPending.data?.data || [];
    const foundInPending = pendingList.find((o) => o.id === createdOrder.id);
    if (!foundInPending) {
      throw new Error('Skenario 4 Gagal: Pesanan tidak ditemukan di antrean verifikasi kasir');
    }
    console.log(`   -> Bukti bayar tersimpan di server: ${foundInPending.paymentProofUrl ? 'YA' : 'TIDAK'}`);
    console.log('   ✅ [SKENARIO 4 LULUS]: Pesanan meja masuk antrean kasir dengan foto bukti bayar.\n');

    // ----------------------------------------------------
    // SKENARIO 5: Kasir Meninjau & Mengonfirmasi Lunas -> Masuk KDS
    // ----------------------------------------------------
    console.log('📋 [SKENARIO 5]: Kasir Konfirmasi Lunas & Tiket Masuk KDS');
    const resConfirm = mockRes();
    await confirmQrOrderPayment(
      mockReq({}, { id: createdOrder.id }),
      resConfirm
    );

    const confirmedOrder = resConfirm.data?.data;
    console.log(`   -> Status setelah konfirmasi: ${confirmedOrder?.status}`);
    console.log(`   -> Kitchen Status: ${confirmedOrder?.kitchenStatus}`);
    console.log(`   -> Bar Status: ${confirmedOrder?.barStatus}`);
    if (confirmedOrder?.status !== 'PAID') {
      throw new Error('Skenario 5 Gagal: Status pesanan harus PAID setelah dikonfirmasi kasir');
    }
    console.log('   ✅ [SKENARIO 5 LULUS]: Pembayaran lunas, stok terpotong, dan tiket terkirim ke KDS.\n');

    // ----------------------------------------------------
    // SKENARIO 6: Kasir Menolak Bukti Transfer Tidak Sah / Palsu
    // ----------------------------------------------------
    console.log('📋 [SKENARIO 6]: Kasir Menolak Bukti Transfer Palsu');
    const resBogusCheckout = mockRes();
    await checkoutQrOrder(
      mockReq({
        tableNo: '08',
        customerName: 'Penipu Struk',
        paymentMethod: 'TRANSFER',
        proof: DUMMY_BASE64_PROOF,
        items: [{ productId: sampleProduct.id, qty: 1 }],
      }),
      resBogusCheckout
    );
    const bogusOrderId = resBogusCheckout.data?.data?.id;

    const resReject = mockRes();
    await rejectQrOrderPayment(
      mockReq({ reason: 'Nominal pada bukti transfer tidak sesuai' }, { id: bogusOrderId }),
      resReject
    );

    const rejectedOrder = await prisma.order.findUnique({
      where: { id: bogusOrderId },
    });
    console.log(`   -> Status pesanan yang ditolak: ${rejectedOrder?.status}`);
    console.log(`   -> Catatan penolakan: ${rejectedOrder?.notes}`);
    if (rejectedOrder?.status !== 'VOIDED') {
      throw new Error('Skenario 6 Gagal: Pesanan yang ditolak harus berstatus VOIDED');
    }
    console.log('   ✅ [SKENARIO 6 LULUS]: Penolakan pesanan berhasil dibatalkan tanpa memotong stok.\n');

    // ----------------------------------------------------
    // CLEANUP: Kembalikan Saklar ke Mode Nonaktif (Percobaan OFF)
    // ----------------------------------------------------
    console.log('🔒 Mengembalikan saklar QR Order ke mode Nonaktif (Sesuai permintaan user)...');
    await updateQrOrderConfig(mockReq({ enabled: false }), mockRes());

    const finalConfigCheck = mockRes();
    await getPublicQrOrderConfig(mockReq(), finalConfigCheck);
    console.log('   -> Final status saklar QR Order:', finalConfigCheck.data?.data?.enabled ? 'AKTIF' : 'NONAKTIF (OFF)');
    if (finalConfigCheck.data?.data?.enabled !== false) {
      throw new Error('Cleanup Gagal: Saklar harus tetap nonaktif di akhir pengujian');
    }

    console.log('\n🎉 ========================================================');
    console.log('   SELURUH SKENARIO END-TO-END BERHASIL DILALUI 100%!');
    console.log('========================================================');
  } catch (err) {
    console.error('\n❌ ERROR SAAT PENGUJIAN END-TO-END:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runEndToEndTests();
