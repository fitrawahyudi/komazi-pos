import prisma from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { getSettingsMap, invalidateSettingsCache } from '../services/settingsCache.service.js';
import { deltaInventoryService } from '../services/deltaInventoryService.js';
import { calculateProductCogs } from '../services/cogsService.js';
import { isDrinkItemHelper } from '../services/kdsService.js';
import { generateInvoiceNo } from '../utils/invoice.js';
import { savePaymentProof } from '../services/paymentProofService.js';
import { emitOrderEvent } from '../config/socket.js';
import { notifyNewQrOrder } from '../services/telegramService.js';

let defaultBarStationId = null;
let defaultKitchenStationId = null;
let stationsCachedAt = 0;

async function getDefaultStationId(isDrink) {
  const now = Date.now();
  if (now - stationsCachedAt > 60000 || !defaultBarStationId || !defaultKitchenStationId) {
    const [bar, kitchen] = await Promise.all([
      prisma.station.findFirst({ where: { OR: [{ code: 'BAR_MAIN' }, { type: 'BAR' }] } }),
      prisma.station.findFirst({ where: { OR: [{ code: 'KITCHEN_MAIN' }, { type: 'KITCHEN' }] } }),
    ]);
    defaultBarStationId = bar?.id || null;
    defaultKitchenStationId = kitchen?.id || null;
    stationsCachedAt = now;
  }
  return isDrink ? defaultBarStationId : defaultKitchenStationId;
}

/**
 * 1. Ambil konfigurasi publik QR Order (Status Saklar, Rekening Bank, QRIS, & Info Usaha)
 * Endpoint publik: GET /api/public/qr-order/config
 */
export async function getPublicQrOrderConfig(req, res) {
  try {
    const map = await getSettingsMap();

    const config = {
      enabled: map.qrOrderEnabled === 'true',
      bankName: map.qrOrderBankName || '',
      accountNo: map.qrOrderAccountNo || '',
      accountHolder: map.qrOrderAccountHolder || '',
      qrisUrl: map.qrOrderQrisUrl || '',
      storeName: map.storeName || 'Komazi Coffee & Space',
      storeAddress: map.storeAddress || '',
      storePhone: map.storePhone || '',
      taxRate: parseFloat(map.taxRate || 0),
      serviceFeeRate: parseFloat(map.serviceFeeRate || 0),
    };

    return successResponse(res, config, 'Konfigurasi QR Order Meja');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * 2. Ambil katalog menu publik untuk pemesanan mandiri meja
 * Endpoint publik: GET /api/public/qr-order/menu
 */
export async function getPublicMenu(req, res) {
  try {
    const map = await getSettingsMap();
    const isEnabled = map.qrOrderEnabled === 'true';

    const [categories, products] = await Promise.all([
      prisma.category.findMany({
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.product.findMany({
        where: { isActive: true },
        select: {
          id: true,
          categoryId: true,
          name: true,
          price: true,
          imageUrl: true,
          description: true,
          isSoldOut: true,
          variants: {
            select: {
              id: true,
              name: true,
              extraPrice: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    const formattedProducts = products.map((p) => ({
      ...p,
      price: Number(p.price),
      variants: (p.variants || []).map((v) => ({
        ...v,
        extraPrice: Number(v.extraPrice || 0),
      })),
    }));

    return successResponse(
      res,
      {
        enabled: isEnabled,
        categories,
        products: formattedProducts,
      },
      'Katalog Menu QR Order'
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * 3. Update konfigurasi saklar (Feature Flag) dan rekening pembayaran QR Order
 * Endpoint terautentikasi: PUT /api/settings/qr-order (Owner / Manager)
 */
export async function updateQrOrderConfig(req, res) {
  try {
    const { enabled, bankName, accountNo, accountHolder, qrisUrl } = req.body || {};

    const updates = {};
    if (enabled !== undefined) {
      updates.qrOrderEnabled = enabled === true || enabled === 'true' ? 'true' : 'false';
    }
    if (bankName !== undefined) {
      updates.qrOrderBankName = String(bankName).trim();
    }
    if (accountNo !== undefined) {
      updates.qrOrderAccountNo = String(accountNo).trim();
    }
    if (accountHolder !== undefined) {
      updates.qrOrderAccountHolder = String(accountHolder).trim();
    }
    if (qrisUrl !== undefined) {
      updates.qrOrderQrisUrl = String(qrisUrl).trim();
    }

    if (Object.keys(updates).length > 0) {
      await prisma.$transaction(
        Object.entries(updates).map(([key, value]) =>
          prisma.setting.upsert({
            where: { key },
            update: { value },
            create: { key, value },
          })
        )
      );
      invalidateSettingsCache();
    }

    const updatedMap = await getSettingsMap();
    const config = {
      enabled: updatedMap.qrOrderEnabled === 'true',
      bankName: updatedMap.qrOrderBankName || '',
      accountNo: updatedMap.qrOrderAccountNo || '',
      accountHolder: updatedMap.qrOrderAccountHolder || '',
      qrisUrl: updatedMap.qrOrderQrisUrl || '',
    };

    return successResponse(res, config, 'Konfigurasi QR Order berhasil diperbarui');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * 4. Validasi ketersediaan stok keranjang secara real-time sebelum pembayaran
 * Endpoint publik: POST /api/public/qr-order/validate-cart
 */
export async function validateCartStock(req, res) {
  try {
    const map = await getSettingsMap();
    if (map.qrOrderEnabled !== 'true') {
      return errorResponse(
        res,
        'Pemesanan mandiri via QR meja sedang dinonaktifkan sementara. Silakan pesan langsung di kasir.',
        403
      );
    }

    const { items = [] } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return errorResponse(res, 'Daftar menu pesanan tidak boleh kosong', 400);
    }

    const unavailableItems = [];

    // 1. Validasi status produk (aktif & tidak sold out)
    const productIds = [...new Set(items.map((it) => Number(it.productId)).filter(Boolean))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, isActive: true, isSoldOut: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of items) {
      const prod = productMap.get(Number(item.productId));
      if (!prod || !prod.isActive) {
        unavailableItems.push({
          productId: item.productId,
          productName: prod?.name || item.productName || 'Menu',
          reason: 'Menu sudah tidak aktif di sistem',
        });
      } else if (prod.isSoldOut) {
        unavailableItems.push({
          productId: item.productId,
          productName: prod.name,
          reason: 'Menu sedang habis (Sold Out)',
        });
      }
    }

    // 2. Validasi stok bahan baku (BOM)
    const aggregatedRequirements = new Map();
    for (const item of items) {
      const itemQty = parseInt(item.qty || 1, 10);
      const bomItems = await deltaInventoryService.extractBomRequirements(
        prisma,
        item.productId,
        item.variantName,
        itemQty
      );

      for (const bom of bomItems) {
        const cur = aggregatedRequirements.get(bom.ingredientId) || {
          ingredientId: bom.ingredientId,
          name: bom.ingredientName,
          unit: bom.unit,
          needed: 0,
          currentStock: bom.currentStock,
          relatedProductIds: new Set(),
        };
        cur.needed += bom.requiredQty;
        cur.relatedProductIds.add(item.productId);
        aggregatedRequirements.set(bom.ingredientId, cur);
      }
    }

    for (const [, reqBOM] of aggregatedRequirements) {
      const ing = await prisma.ingredient.findUnique({
        where: { id: reqBOM.ingredientId },
        select: { id: true, name: true, stock: true, unit: true },
      });
      const currentStock = parseFloat(ing?.stock || 0);
      if (currentStock < reqBOM.needed) {
        for (const prodId of reqBOM.relatedProductIds) {
          const prod = productMap.get(prodId);
          if (!unavailableItems.some((u) => u.productId === prodId)) {
            unavailableItems.push({
              productId: prodId,
              productName: prod?.name || 'Menu',
              reason: `Bahan baku (${reqBOM.name}) tidak mencukupi`,
            });
          }
        }
      }
    }

    if (unavailableItems.length > 0) {
      return res.status(200).json({
        success: false,
        valid: false,
        unavailableItems,
        message: 'Beberapa menu di keranjang Anda sedang tidak tersedia.',
      });
    }

    return successResponse(res, { valid: true }, 'Seluruh menu tersedia');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * 5. Checkout pesanan meja pelanggan dengan foto bukti transfer
 * Endpoint publik: POST /api/public/qr-order/checkout
 */
export async function checkoutQrOrder(req, res) {
  try {
    const map = await getSettingsMap();
    if (map.qrOrderEnabled !== 'true') {
      return errorResponse(
        res,
        'Pemesanan mandiri via QR meja sedang dinonaktifkan sementara. Silakan pesan langsung di kasir.',
        403
      );
    }

    const body = req.body || {};
    const rawTableNo = String(body.tableNo || '').trim();
    // Simpan nomor meja murni (misal "12", "04") agar saat di-render dengan prefix "Meja" tidak terjadi double kata
    const tableNo = rawTableNo.replace(/^(meja\s*)+/i, '').trim() || rawTableNo;
    const customerName = String(body.customerName || 'Tamu').trim();
    const paymentMethod = String(body.paymentMethod || 'QRIS').toUpperCase();

    let items = [];
    if (typeof body.items === 'string') {
      try {
        items = JSON.parse(body.items);
      } catch {
        return errorResponse(res, 'Format data items pesanan tidak valid', 400);
      }
    } else if (Array.isArray(body.items)) {
      items = body.items;
    }

    if (!tableNo) {
      return errorResponse(res, 'Nomor meja wajib diisi / terdeteksi', 400);
    }
    if (!Array.isArray(items) || items.length === 0) {
      return errorResponse(res, 'Keranjang pesanan tidak boleh kosong', 400);
    }

    // Wajib metode non-tunai langsung
    if (!['QRIS', 'TRANSFER'].includes(paymentMethod)) {
      return errorResponse(res, 'Metode pembayaran QR meja hanya mendukung Transfer Bank atau QRIS', 400);
    }

    // Bukti bayar wajib dilampirkan (bisa file upload atau base64)
    const proofBase64 = body.proofImage || body.proof || body.image;
    if (!req.file && (!proofBase64 || typeof proofBase64 !== 'string')) {
      return errorResponse(res, 'Foto bukti transfer pembayaran wajib diunggah', 400);
    }

    // Ambil data produk untuk kalkulasi harga dan station
    const productIds = [...new Set(items.map((it) => Number(it.productId)).filter(Boolean))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { category: true, station: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Validasi ketersediaan menu sebelum membuat invoice
    for (const item of items) {
      const prod = productMap.get(Number(item.productId));
      if (!prod || !prod.isActive || prod.isSoldOut) {
        return errorResponse(
          res,
          `Menu "${prod?.name || 'Item'}" sedang habis atau tidak tersedia. Silakan pilih menu lain.`,
          400
        );
      }
    }

    // Buat nomor invoice baru
    const invoiceNo = await generateInvoiceNo(null, 0);

    // Simpan foto bukti transfer
    const proofUrl = await savePaymentProof({
      file: req.file,
      base64: proofBase64,
      invoiceNo,
    });

    // Hitung rincian item, subtotal, tax, & service fee
    let subtotal = 0;
    const orderItemsData = [];

    for (const item of items) {
      const prod = productMap.get(Number(item.productId));
      const isDrink = isDrinkItemHelper(prod);
      const stationId = prod?.stationId || (await getDefaultStationId(isDrink));

      let unitCost = 0;
      try {
        unitCost = await calculateProductCogs(item.productId, item.variantName || null);
      } catch {}

      const qty = Math.max(1, parseInt(item.qty || 1, 10));
      const unitPrice = parseFloat(item.unitPrice || prod?.price || 0);
      const lineTotal = qty * unitPrice;
      const lineCost = Math.round(unitCost * qty * 100) / 100;
      subtotal += lineTotal;

      orderItemsData.push({
        productId: Number(item.productId),
        stationId,
        status: 'PENDING',
        productName: prod ? prod.name : item.productName || 'Item',
        variantName: item.variantName || null,
        qty,
        unitPrice,
        unitCost,
        discount: 0,
        note: item.note || null,
        lineTotal,
        lineCost,
      });
    }

    const taxRate = parseFloat(map.taxRate || 0);
    const serviceFeeRate = parseFloat(map.serviceFeeRate || 0);
    const tax = Math.round(subtotal * (taxRate / 100));
    const serviceFee = Math.round(subtotal * (serviceFeeRate / 100));
    const total = subtotal + tax + serviceFee;

    // Tentukan penanggung jawab kasir & shift (Shift aktif atau fallback Owner)
    const activeShift = await prisma.shift.findFirst({
      where: { closedAt: null },
      select: { id: true, cashierId: true },
      orderBy: { openedAt: 'desc' },
    });

    let cashierId = activeShift?.cashierId || null;
    const shiftId = activeShift?.id || null;

    if (!cashierId) {
      const defaultUser = await prisma.user.findFirst({
        where: { role: { in: ['OWNER', 'MANAGER', 'CASHIER'] }, isActive: true },
        select: { id: true },
      });
      cashierId = defaultUser?.id || 1;
    }

    // Simpan pesanan dengan status PENDING_PAYMENT (Menunggu verifikasi kasir)
    const newOrder = await prisma.order.create({
      data: {
        invoiceNo,
        cashierId,
        shiftId,
        type: 'DINE_IN',
        tableNo,
        customerName,
        status: 'PENDING_PAYMENT',
        kitchenStatus: 'PENDING',
        barStatus: 'PENDING',
        subtotal,
        discount: 0,
        tax,
        serviceFee,
        total,
        items: {
          create: orderItemsData,
        },
        payments: {
          create: [
            {
              method: paymentMethod === 'QRIS' ? 'QRIS' : 'TRANSFER',
              amount: total,
              reference: proofUrl,
            },
          ],
        },
      },
      include: {
        items: true,
        payments: true,
      },
    });

    // Siarkan notifikasi pesanan meja baru ke Web POS kasir secara real-time
    try {
      emitOrderEvent('qr-order:received', {
        order: {
          id: newOrder.id,
          invoiceNo: newOrder.invoiceNo,
          tableNo: newOrder.tableNo,
          customerName: newOrder.customerName,
          total: Number(newOrder.total),
          proofUrl,
          createdAt: newOrder.createdAt,
          itemsCount: orderItemsData.length,
        },
      });
    } catch (e) {
      console.warn('[Socket.IO] Emit qr-order:received error:', e);
    }

    // Kirim notifikasi bot Telegram ke barista/owner secara asinkron
    notifyNewQrOrder(newOrder).catch((err) => {
      console.warn('[TelegramBot] notifyNewQrOrder background error:', err?.message);
    });

    return successResponse(
      res,
      {
        id: newOrder.id,
        invoiceNo: newOrder.invoiceNo,
        tableNo: newOrder.tableNo,
        customerName: newOrder.customerName,
        total: Number(newOrder.total),
        status: newOrder.status,
        proofUrl,
      },
      'Pesanan meja berhasil dikirim. Menunggu verifikasi kasir.',
      201
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * 6. Ambil daftar pesanan meja yang sedang menunggu verifikasi kasir
 * Endpoint terautentikasi: GET /api/orders/qr-pending (Kasir / Manager / Owner)
 */
export async function getPendingQrOrders(req, res) {
  try {
    const orders = await prisma.order.findMany({
      where: {
        status: 'PENDING_PAYMENT',
        tableNo: { not: null },
      },
      include: {
        items: true,
        payments: true,
        cashier: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = orders.map((o) => ({
      ...o,
      subtotal: Number(o.subtotal),
      tax: Number(o.tax),
      serviceFee: Number(o.serviceFee),
      total: Number(o.total),
      proofUrl: o.payments?.[0]?.reference || null,
      items: (o.items || []).map((it) => ({
        ...it,
        unitPrice: Number(it.unitPrice),
        lineTotal: Number(it.lineTotal),
      })),
    }));

    return successResponse(res, formatted, 'Daftar pesanan meja menunggu verifikasi kasir');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * 7. Konfirmasi pembayaran pesanan meja oleh kasir
 * Endpoint terautentikasi: POST /api/orders/:id/confirm-qr-payment (Kasir / Manager / Owner)
 */
export async function confirmQrOrderPayment(req, res) {
  try {
    const orderId = parseInt(req.params.id, 10);
    if (isNaN(orderId)) {
      return errorResponse(res, 'ID pesanan tidak valid', 400);
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, payments: true },
    });

    if (!order) {
      return errorResponse(res, 'Pesanan tidak ditemukan', 404);
    }

    if (order.status !== 'PENDING_PAYMENT') {
      return errorResponse(
        res,
        `Pesanan tidak dalam status menunggu pembayaran (Status saat ini: ${order.status})`,
        400
      );
    }

    // Jalankan transaksi database: potong stok bahan dan ubah status order menjadi PAID
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Potong stok bahan baku sesuai resep pesanan
      await deltaInventoryService.deductNewOrderStock(
        tx,
        order.id,
        order.invoiceNo,
        order.items,
        req.user?.name || 'Kasir'
      );

      // 2. Ubah status order menjadi PAID
      const ord = await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          cashierId: req.user?.id || order.cashierId,
        },
        include: {
          items: true,
          payments: true,
          cashier: { select: { id: true, name: true, role: true } },
        },
      });

      return ord;
    });

    // Broadcast ke seluruh KDS Barista & Kitchen serta antarmuka POS
    try {
      emitOrderEvent('order:created', updated);
      emitOrderEvent('qr-order:confirmed', { orderId: updated.id, invoiceNo: updated.invoiceNo });
    } catch (e) {
      console.warn('[Socket.IO] Emit confirm error:', e);
    }

    return successResponse(res, updated, 'Pembayaran pesanan meja berhasil dikonfirmasi lunas');
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

/**
 * 8. Tolak pesanan meja oleh kasir (misal bukti transfer palsu / tidak terbaca)
 * Endpoint terautentikasi: POST /api/orders/:id/reject-qr-payment (Kasir / Manager / Owner)
 */
export async function rejectQrOrderPayment(req, res) {
  try {
    const orderId = parseInt(req.params.id, 10);
    const { reason = 'Bukti transfer tidak valid atau tidak terbaca' } = req.body || {};

    if (isNaN(orderId)) {
      return errorResponse(res, 'ID pesanan tidak valid', 400);
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, invoiceNo: true },
    });

    if (!order) {
      return errorResponse(res, 'Pesanan tidak ditemukan', 404);
    }

    if (order.status !== 'PENDING_PAYMENT') {
      return errorResponse(
        res,
        `Hanya pesanan menunggu pembayaran yang dapat ditolak (Status saat ini: ${order.status})`,
        400
      );
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'VOIDED',
        voidReason: `Bukti transfer ditolak kasir: ${reason}`,
      },
      include: {
        items: true,
        payments: true,
      },
    });

    try {
      emitOrderEvent('qr-order:rejected', {
        orderId: updated.id,
        invoiceNo: updated.invoiceNo,
        reason,
      });
    } catch (e) {
      console.warn('[Socket.IO] Emit reject error:', e);
    }

    return successResponse(res, updated, 'Pesanan meja telah ditolak');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * 8. Cek status live pesanan meja untuk smartphone pelanggan
 * Endpoint publik: GET /api/public/qr-order/status/:identifier
 */
export async function getPublicOrderStatus(req, res) {
  try {
    const { identifier } = req.params;
    if (!identifier) {
      return errorResponse(res, 'Nomor invoice atau ID pesanan diperlukan', 400);
    }

    const isNumeric = /^\d+$/.test(identifier);
    const where = isNumeric
      ? { id: Number(identifier) }
      : { invoiceNo: String(identifier).trim() };

    const order = await prisma.order.findFirst({
      where,
      include: {
        items: {
          include: {
            product: {
              select: { imageUrl: true },
            },
          },
        },
        payments: {
          select: {
            method: true,
            amount: true,
            reference: true,
          },
        },
      },
    });

    if (!order) {
      return errorResponse(res, 'Pesanan tidak ditemukan', 404);
    }

    // Hitung tahapan status pesanan untuk timeline pelacak
    let stage = 'PAYMENT_REVIEW';
    let stepIndex = 0;
    let statusTitle = 'Menunggu Konfirmasi Kasir';
    let statusDesc = 'Staf kasir sedang memeriksa foto bukti transfer Anda.';

    if (order.status === 'VOIDED' || order.status === 'CANCELLED') {
      stage = 'REJECTED';
      stepIndex = -1;
      statusTitle = 'Pesanan Dibatalkan / Ditolak';
      statusDesc = order.voidReason || 'Bukti transfer tidak sesuai atau pesanan dibatalkan kasir.';
    } else if (order.status === 'COMPLETED') {
      stage = 'COMPLETED';
      stepIndex = 3;
      statusTitle = 'Pesanan Selesai';
      statusDesc = 'Pesanan telah disajikan di meja. Selamat menikmati!';
    } else if (order.kitchenStatus === 'READY' || order.barStatus === 'READY') {
      stage = 'READY';
      stepIndex = 3;
      statusTitle = 'Pesanan Siap Disajikan! 🛎️';
      statusDesc = 'Pesanan Anda sudah siap dan sedang diantarkan pelayan ke meja.';
    } else if (order.kitchenStatus === 'PREPARING' || order.barStatus === 'PREPARING') {
      stage = 'PREPARING';
      stepIndex = 2;
      statusTitle = 'Sedang Diracik & Dimasak ☕';
      statusDesc = 'Barista dan dapur sedang menyiapkan pesanan Anda.';
    } else if (order.status === 'PAID') {
      stage = 'CONFIRMED';
      stepIndex = 1;
      statusTitle = 'Pembayaran Dikonfirmasi Lunas ✅';
      statusDesc = 'Pesanan Anda telah diterima dan masuk ke antrean KDS Barista & Kitchen.';
    }

    const formatted = {
      id: order.id,
      invoiceNo: order.invoiceNo,
      tableNo: order.tableNo,
      customerName: order.customerName,
      status: order.status,
      kitchenStatus: order.kitchenStatus,
      barStatus: order.barStatus,
      total: Number(order.total),
      subtotal: Number(order.subtotal),
      voidReason: order.voidReason,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      stage,
      stepIndex,
      statusTitle,
      statusDesc,
      paymentMethod: order.payments?.[0]?.method || 'TRANSFER',
      paymentProofUrl: order.payments?.[0]?.reference || null,
      items: (order.items || []).map((it) => ({
        id: it.id,
        name: it.productName || 'Menu',
        imageUrl: it.product?.imageUrl || null,
        variantName: it.variantName || null,
        quantity: it.qty,
        price: Number(it.unitPrice),
        lineTotal: Number(it.lineTotal),
        notes: it.note || null,
        status: it.status,
      })),
    };

    return successResponse(res, formatted, 'Status pesanan meja');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}
