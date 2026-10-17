import http from 'http';
import { io as Client } from 'socket.io-client';
import { initSocket, emitToStation, emitOrderEvent } from '../src/config/socket.js';

async function runTest() {
  console.log('====================================================');
  console.log('🚀 MENJALANKAN TEST OTOMATIS: REAL-TIME SYNC SUITE');
  console.log('====================================================\n');

  const PORT = 4099;
  const httpServer = http.createServer();
  initSocket(httpServer);

  await new Promise((resolve) => httpServer.listen(PORT, resolve));
  console.log(`[SETUP] Server Socket.IO uji aktif di port ${PORT}\n`);

  let kdsClient = null;
  let bdsClient = null;
  let posClient = null;

  try {
    // 1. Hubungkan 3 simulasi klien: KDS (Dapur), BDS (Bar), dan POS (Kasir)
    console.log('[CONNECT] Menghubungkan 3 klien simulasi...');

    const connectClient = (name) => {
      return new Promise((resolve) => {
        const client = Client(`http://localhost:${PORT}`, {
          transports: ['websocket'],
          forceNew: true,
        });
        client.on('connect', () => {
          console.log(`  -> Klien ${name} terhubung (ID: ${client.id})`);
          resolve(client);
        });
      });
    };

    kdsClient = await connectClient('KDS Dapur');
    bdsClient = await connectClient('BDS Bar');
    posClient = await connectClient('POS Kasir');

    // Bergabung ke room masing-masing
    kdsClient.emit('station:join', { stationCode: 'KITCHEN_MAIN' });
    bdsClient.emit('station:join', { stationCode: 'BAR_MAIN' });
    posClient.emit('orders:join');

    // Beri jeda sejenak agar join room selesai di server
    await new Promise((r) => setTimeout(r, 200));
    console.log('✅ Ketiga klien berhasil bergabung ke room masing-masing.\n');

    // ─────────────────────────────────────────────────────────────────
    // SCENARIO 1: ISOLASI ROOM KITCHEN (Makanan)
    // ─────────────────────────────────────────────────────────────────
    console.log('--- TEST 1: Targeted Emission ke KITCHEN_MAIN ---');
    let kdsReceivedFood = false;
    let bdsReceivedFood = false;
    let posReceivedFood = false;

    kdsClient.on('order:new', (data) => {
      if (data.id === 101) kdsReceivedFood = true;
    });
    bdsClient.on('order:new', (data) => {
      if (data.id === 101) bdsReceivedFood = true;
    });
    posClient.on('order:new', (data) => {
      if (data.id === 101) posReceivedFood = true;
    });

    emitToStation('KITCHEN_MAIN', 'order:new', { id: 101, title: 'Burger Hot Spicy Dapur' });
    await new Promise((r) => setTimeout(r, 200));

    console.log(`KDS Dapur menerima order makanan: ${kdsReceivedFood} (Ekspektasi: true)`);
    console.log(`BDS Bar menerima order makanan: ${bdsReceivedFood} (Ekspektasi: false - ISOLASI)`);
    console.log(`POS Kasir menerima order makanan: ${posReceivedFood} (Ekspektasi: true)`);

    if (!kdsReceivedFood || bdsReceivedFood || !posReceivedFood) {
      throw new Error('TEST 1 GAGAL: Isolasi event KITCHEN_MAIN bocor atau tidak diterima!');
    }
    console.log('✅ TEST 1 LULUS: Event makanan terisolasi ke KDS & POS, aman dari BDS.\n');

    // ─────────────────────────────────────────────────────────────────
    // SCENARIO 2: ISOLASI ROOM BAR (Minuman)
    // ─────────────────────────────────────────────────────────────────
    console.log('--- TEST 2: Targeted Emission ke BAR_MAIN ---');
    let kdsReceivedDrink = false;
    let bdsReceivedDrink = false;
    let posReceivedDrink = false;

    kdsClient.on('order:new', (data) => {
      if (data.id === 102) kdsReceivedDrink = true;
    });
    bdsClient.on('order:new', (data) => {
      if (data.id === 102) bdsReceivedDrink = true;
    });
    posClient.on('order:new', (data) => {
      if (data.id === 102) posReceivedDrink = true;
    });

    emitToStation('BAR_MAIN', 'order:new', { id: 102, title: 'Iced Caramel Macchiato Bar' });
    await new Promise((r) => setTimeout(r, 200));

    console.log(`BDS Bar menerima order minuman: ${bdsReceivedDrink} (Ekspektasi: true)`);
    console.log(`KDS Dapur menerima order minuman: ${kdsReceivedDrink} (Ekspektasi: false - ISOLASI)`);
    console.log(`POS Kasir menerima order minuman: ${posReceivedDrink} (Ekspektasi: true)`);

    if (!bdsReceivedDrink || kdsReceivedDrink || !posReceivedDrink) {
      throw new Error('TEST 2 GAGAL: Isolasi event BAR_MAIN bocor atau tidak diterima!');
    }
    console.log('✅ TEST 2 LULUS: Event minuman terisolasi ke BDS & POS, aman dari KDS.\n');

    // ─────────────────────────────────────────────────────────────────
    // SCENARIO 3: KONTRAK PAYLOAD ORDER:ITEM:UPDATED
    // ─────────────────────────────────────────────────────────────────
    console.log('--- TEST 3: Kontrak Payload order:item:updated ---');
    let itemPayload = null;

    kdsClient.on('order:item:updated', (data) => {
      itemPayload = data;
    });

    const sampleItemUpdate = {
      orderId: 101,
      item: { id: 501, productName: 'Burger Hot Spicy', status: 'READY', readyAt: new Date().toISOString() },
      order: { id: 101, kitchenStatus: 'READY', status: 'OPEN' },
    };

    emitToStation('KITCHEN_MAIN', 'order:item:updated', sampleItemUpdate);
    await new Promise((r) => setTimeout(r, 200));

    if (!itemPayload || itemPayload.orderId !== 101 || !itemPayload.item || !itemPayload.order) {
      throw new Error('TEST 3 GAGAL: Struktur payload order:item:updated tidak sesuai kontrak!');
    }
    if (itemPayload.item.status !== 'READY' || itemPayload.order.kitchenStatus !== 'READY') {
      throw new Error('TEST 3 GAGAL: Data item atau status order dalam payload salah!');
    }
    console.log('Payload diterima lengkap:', JSON.stringify(itemPayload));
    console.log('✅ TEST 3 LULUS: Kontrak payload order:item:updated valid.\n');

    // ─────────────────────────────────────────────────────────────────
    // SCENARIO 4: GLOBAL BROADCAST ORDER:VOIDED
    // ─────────────────────────────────────────────────────────────────
    console.log('--- TEST 4: Global Broadcast order:voided ---');
    let kdsVoided = false;
    let bdsVoided = false;
    let posVoided = false;

    kdsClient.on('order:voided', (data) => {
      if (data.orderId === 101) kdsVoided = true;
    });
    bdsClient.on('order:voided', (data) => {
      if (data.orderId === 101) bdsVoided = true;
    });
    posClient.on('order:voided', (data) => {
      if (data.orderId === 101) posVoided = true;
    });

    emitOrderEvent('order:voided', { orderId: 101, invoiceNo: 'INV-TEST-VOID', reason: 'Pelanggan batal' });
    await new Promise((r) => setTimeout(r, 200));

    console.log(`KDS menerima void: ${kdsVoided}`);
    console.log(`BDS menerima void: ${bdsVoided}`);
    console.log(`POS menerima void: ${posVoided}`);

    if (!kdsVoided || !bdsVoided || !posVoided) {
      throw new Error('TEST 4 GAGAL: Broadcast order:voided tidak diterima oleh seluruh klien!');
    }
    console.log('✅ TEST 4 LULUS: Broadcast global order:voided berhasil diterima semua stasiun.\n');

    console.log('====================================================');
    console.log('🎉 SEMUA 4 SKENARIO PENGUJIAN REAL-TIME SYNC SUKSES!');
    console.log('====================================================');
  } catch (err) {
    console.error('\n❌ ERROR SAAT PENGUJIAN REAL-TIME SYNC:', err);
    process.exitCode = 1;
  } finally {
    console.log('\n[CLEANUP] Menutup koneksi klien & server socket uji...');
    if (kdsClient) kdsClient.disconnect();
    if (bdsClient) bdsClient.disconnect();
    if (posClient) posClient.disconnect();
    httpServer.close();
    console.log('✅ Server & klien uji ditutup bersih.');
  }
}

runTest();
