import prisma from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { getSettingsMap, invalidateSettingsCache } from '../services/settingsCache.service.js';
import logger from '../utils/logger.js';

/**
 * =========================================================================
 * PRINTER PROFILES CONTROLLER
 * =========================================================================
 */

/**
 * GET /api/printers
 * Mengambil daftar seluruh profil printer yang terdaftar
 */
export async function getAllPrinters(req, res) {
  try {
    const printers = await prisma.printerProfile.findMany({
      include: {
        kitchenRoutes: {
          include: {
            station: true,
            category: true,
          },
        },
        _count: {
          select: { printJobs: true },
        },
      },
      orderBy: [
        { isDefaultReceipt: 'desc' },
        { isDefaultKitchen: 'desc' },
        { name: 'asc' },
      ],
    });

    return successResponse(res, printers, 'Daftar printer berhasil diambil');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * GET /api/printers/:id
 * Mengambil detail profil printer tertentu
 */
export async function getPrinterById(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return errorResponse(res, 'ID printer tidak valid', 400);

    const printer = await prisma.printerProfile.findUnique({
      where: { id },
      include: {
        kitchenRoutes: {
          include: {
            station: true,
            category: true,
          },
        },
        printJobs: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!printer) return errorResponse(res, 'Profil printer tidak ditemukan', 404);

    return successResponse(res, printer, 'Detail printer berhasil diambil');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * POST /api/printers
 * Membuat profil printer baru (Manager/Owner)
 */
export async function createPrinter(req, res) {
  try {
    const {
      name,
      role = 'RECEIPT',
      connectionType = 'BLUETOOTH_CLASSIC',
      deviceIdentifier,
      networkHost,
      networkPort = 9100,
      paperWidthMm = 58,
      isDefaultReceipt = false,
      isDefaultKitchen = false,
      isActive = true,
      copies = 1,
      autoCut = true,
      openCashDrawer = false,
      buzzer = false,
      capabilitiesJson,
      settingsJson,
    } = req.body;

    if (!name || !name.trim()) {
      return errorResponse(res, 'Nama profil printer wajib diisi', 400);
    }

    const cleanWidth = Number(paperWidthMm) === 80 ? 80 : 58;

    const newPrinter = await prisma.$transaction(async (tx) => {
      // Jika disetel sebagai default receipt, copot status default receipt dari printer lain
      if (isDefaultReceipt) {
        await tx.printerProfile.updateMany({
          data: { isDefaultReceipt: false },
        });
      }

      // Jika disetel sebagai default kitchen, copot status default kitchen dari printer lain
      if (isDefaultKitchen) {
        await tx.printerProfile.updateMany({
          data: { isDefaultKitchen: false },
        });
      }

      return await tx.printerProfile.create({
        data: {
          name: name.trim(),
          role,
          connectionType,
          deviceIdentifier: deviceIdentifier?.trim() || null,
          networkHost: networkHost?.trim() || null,
          networkPort: Number(networkPort) || 9100,
          paperWidthMm: cleanWidth,
          isDefaultReceipt: Boolean(isDefaultReceipt),
          isDefaultKitchen: Boolean(isDefaultKitchen),
          isActive: Boolean(isActive),
          copies: Math.max(1, Number(copies) || 1),
          autoCut: Boolean(autoCut),
          openCashDrawer: Boolean(openCashDrawer),
          buzzer: Boolean(buzzer),
          capabilitiesJson: capabilitiesJson || undefined,
          settingsJson: settingsJson || undefined,
        },
      });
    });

    return successResponse(res, newPrinter, 'Profil printer berhasil dibuat', 201);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * PATCH /api/printers/:id or PUT /api/printers/:id
 * Memperbarui profil printer
 */
export async function updatePrinter(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return errorResponse(res, 'ID printer tidak valid', 400);

    const existing = await prisma.printerProfile.findUnique({ where: { id } });
    if (!existing) return errorResponse(res, 'Profil printer tidak ditemukan', 404);

    const isOwner = req.user?.role === 'OWNER';
    if (!isOwner) {
      // Non-owner is strictly restricted to updating connection & port fields
      const allowedKeys = ['connectionType', 'deviceIdentifier', 'networkHost', 'networkPort'];
      const attemptedKeys = Object.keys(req.body).filter((k) => req.body[k] !== undefined);
      const unauthorizedKeys = attemptedKeys.filter((k) => !allowedKeys.includes(k));
      if (unauthorizedKeys.length > 0) {
        return errorResponse(
          res,
          'Hanya Owner yang diizinkan mengelola konfigurasi profil printer. Peran staf hanya dapat memperbarui jalur koneksi dan port.',
          403
        );
      }
    }

    const {
      name,
      role,
      connectionType,
      deviceIdentifier,
      networkHost,
      networkPort,
      paperWidthMm,
      isDefaultReceipt,
      isDefaultKitchen,
      isActive,
      copies,
      autoCut,
      openCashDrawer,
      buzzer,
      capabilitiesJson,
      settingsJson,
    } = req.body;

    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (role !== undefined) data.role = role;
    if (connectionType !== undefined) data.connectionType = connectionType;
    if (deviceIdentifier !== undefined) data.deviceIdentifier = deviceIdentifier?.trim() || null;
    if (networkHost !== undefined) data.networkHost = networkHost?.trim() || null;
    if (networkPort !== undefined) data.networkPort = Number(networkPort) || 9100;
    if (paperWidthMm !== undefined) data.paperWidthMm = Number(paperWidthMm) === 80 ? 80 : 58;
    if (copies !== undefined) data.copies = Math.max(1, Number(copies) || 1);
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (autoCut !== undefined) data.autoCut = Boolean(autoCut);
    if (openCashDrawer !== undefined) data.openCashDrawer = Boolean(openCashDrawer);
    if (buzzer !== undefined) data.buzzer = Boolean(buzzer);
    if (capabilitiesJson !== undefined) data.capabilitiesJson = capabilitiesJson;
    if (settingsJson !== undefined) data.settingsJson = settingsJson;

    const updated = await prisma.$transaction(async (tx) => {
      if (isDefaultReceipt !== undefined) {
        if (isDefaultReceipt) {
          await tx.printerProfile.updateMany({
            where: { id: { not: id } },
            data: { isDefaultReceipt: false },
          });
          data.isDefaultReceipt = true;
        } else {
          data.isDefaultReceipt = false;
        }
      }

      if (isDefaultKitchen !== undefined) {
        if (isDefaultKitchen) {
          await tx.printerProfile.updateMany({
            where: { id: { not: id } },
            data: { isDefaultKitchen: false },
          });
          data.isDefaultKitchen = true;
        } else {
          data.isDefaultKitchen = false;
        }
      }

      return await tx.printerProfile.update({
        where: { id },
        data,
      });
    });

    return successResponse(res, updated, 'Profil printer berhasil diperbarui');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * DELETE /api/printers/:id
 * Menghapus profil printer
 */
export async function deletePrinter(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return errorResponse(res, 'ID printer tidak valid', 400);

    const printer = await prisma.printerProfile.findUnique({ where: { id } });
    if (!printer) return errorResponse(res, 'Profil printer tidak ditemukan', 404);

    await prisma.printerProfile.delete({ where: { id } });

    return successResponse(res, null, `Profil printer "${printer.name}" berhasil dihapus`);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * =========================================================================
 * RECEIPT SETTINGS CONTROLLER
 * =========================================================================
 */

/**
 * GET /api/printer-settings/receipt
 * Mengambil preferensi format struk belanja
 */
export async function getReceiptSettings(req, res) {
  try {
    const map = await getSettingsMap();

    const receiptConfig = {
      storeName: map.storeName !== undefined ? map.storeName : 'KOMAZI COFFEE & WORKSPACE',
      storeTagline: map.storeTagline !== undefined ? map.storeTagline : 'Coffee & Collaborative Workspace',
      address: map.address !== undefined ? map.address : 'Jl. Gatot Subroto No. 88, Medan',
      phone: map.phone !== undefined ? map.phone : '0812-6899-7721',
      headerText: map.headerText !== undefined ? map.headerText : (map.receiptHeader !== undefined ? map.receiptHeader : ''),
      receiptHeader: map.receiptHeader !== undefined ? map.receiptHeader : (map.headerText !== undefined ? map.headerText : ''),
      receiptFooter: map.receiptFooter !== undefined ? map.receiptFooter : (map.footerText !== undefined ? map.footerText : 'Terima kasih atas kunjungan Anda!\nFollow IG: @komazi.coffee'),
      footerText: map.footerText !== undefined ? map.footerText : (map.receiptFooter !== undefined ? map.receiptFooter : 'Terima kasih atas kunjungan Anda!\nFollow IG: @komazi.coffee'),
      wifiName: map.wifiName !== undefined ? map.wifiName : 'KOMAZI_HIGH_SPEED',
      wifiPass: map.wifiPass !== undefined ? map.wifiPass : '',
      receiptPaperWidth: map.receiptPaperWidth || '58',
      receiptShowLogo: map.receiptShowLogo !== 'false',
      receiptShowWifi: map.receiptShowWifi !== 'false',
      receiptShowCustomer: map.receiptShowCustomer !== 'false',
      receiptAutoPrint: map.receiptAutoPrint !== 'false',
      kitchenAutoPrint: map.kitchenAutoPrint === 'true',
    };

    return successResponse(res, receiptConfig, 'Pengaturan struk berhasil diambil');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * PUT /api/printer-settings/receipt
 * Memperbarui preferensi format struk belanja
 */
export async function updateReceiptSettings(req, res) {
  try {
    const data = req.body || {};
    const updates = [];

    // Ensure aliases stay in sync
    if (data.headerText !== undefined && data.receiptHeader === undefined) {
      data.receiptHeader = data.headerText;
    } else if (data.receiptHeader !== undefined && data.headerText === undefined) {
      data.headerText = data.receiptHeader;
    }

    if (data.footerText !== undefined && data.receiptFooter === undefined) {
      data.receiptFooter = data.footerText;
    } else if (data.receiptFooter !== undefined && data.footerText === undefined) {
      data.footerText = data.receiptFooter;
    }

    const allowedKeys = [
      'storeName',
      'storeTagline',
      'address',
      'phone',
      'headerText',
      'receiptHeader',
      'footerText',
      'receiptFooter',
      'wifiName',
      'wifiPass',
      'receiptPaperWidth',
      'receiptShowLogo',
      'receiptShowWifi',
      'receiptShowCustomer',
      'receiptAutoPrint',
      'kitchenAutoPrint',
    ];

    for (const key of allowedKeys) {
      if (data[key] !== undefined) {
        updates.push(
          prisma.setting.upsert({
            where: { key },
            update: { value: String(data[key]) },
            create: { key, value: String(data[key]) },
          })
        );
      }
    }

    await Promise.all(updates);
    invalidateSettingsCache();
    return await getReceiptSettings(req, res);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * =========================================================================
 * PRINT JOBS AUDIT & QUEUE CONTROLLER
 * =========================================================================
 */

/**
 * GET /api/print-jobs
 * Mengambil daftar riwayat pekerjaan cetak (Receipt & Kitchen)
 */
export async function getPrintJobs(req, res) {
  try {
    const {
      status,
      documentType,
      printerProfileId,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;

    const where = {};
    if (status && status !== 'ALL') where.status = status;
    if (documentType && documentType !== 'ALL') where.documentType = documentType;
    if (printerProfileId && printerProfileId !== 'ALL') {
      where.printerProfileId = parseInt(printerProfileId);
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { requestedBy: { contains: q } },
        { errorCode: { contains: q } },
        { order: { invoiceNo: { contains: q } } },
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const take = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
    const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take;

    const [jobs, total] = await Promise.all([
      prisma.printJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          printerProfile: {
            select: { id: true, name: true, role: true, paperWidthMm: true, connectionType: true },
          },
          order: {
            select: { id: true, invoiceNo: true, total: true, customerName: true, status: true },
          },
        },
      }),
      prisma.printJob.count({ where }),
    ]);

    return successResponse(
      res,
      {
        jobs,
        total,
        page: parseInt(page) || 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
      'Riwayat pekerjaan cetak berhasil diambil'
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * GET /api/print-jobs/:id
 */
export async function getPrintJobById(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return errorResponse(res, 'ID pekerjaan cetak tidak valid', 400);

    const job = await prisma.printJob.findUnique({
      where: { id },
      include: {
        printerProfile: true,
        order: {
          include: {
            items: true,
            payments: true,
          },
        },
      },
    });

    if (!job) return errorResponse(res, 'Pekerjaan cetak tidak ditemukan', 404);

    return successResponse(res, job, 'Detail pekerjaan cetak');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * POST /api/print-jobs
 * Mencatat hasil eksekusi cetak (dari kasir atau server)
 */
export async function createPrintJob(req, res) {
  try {
    const {
      printerProfileId,
      orderId,
      documentType = 'RECEIPT',
      status = 'PRINTED',
      attemptCount = 1,
      idempotencyKey,
      errorCode,
      errorMessage,
      requestedBy,
      payloadSnapshot,
    } = req.body;

    const job = await prisma.printJob.create({
      data: {
        printerProfileId: printerProfileId ? parseInt(printerProfileId) : null,
        orderId: orderId ? parseInt(orderId) : null,
        documentType,
        status,
        attemptCount: Number(attemptCount) || 1,
        idempotencyKey: idempotencyKey || null,
        errorCode: errorCode || null,
        errorMessage: errorMessage || null,
        requestedBy: requestedBy || req.user?.username || 'kasir',
        payloadSnapshot: payloadSnapshot || undefined,
        printedAt: status === 'PRINTED' ? new Date() : null,
      },
      include: {
        printerProfile: true,
      },
    });

    if (status === 'PRINTED') {
      logger.printer.info(`Receipt printed | jobId=${job.id} type=${documentType}`, {
        jobId: job.id,
        documentType,
        printer: job.printerProfile?.name || 'Default',
      });
    } else if (status === 'FAILED') {
      logger.printer.error(`Print failed | jobId=${job.id} code=${errorCode || 'P_ERR'}`, {
        jobId: job.id,
        errorCode,
        errorMessage,
      });
    } else {
      logger.printer.warn(`Print attempt delayed | jobId=${job.id} attempt=${attemptCount}`, {
        jobId: job.id,
        attemptCount,
      });
    }

    return successResponse(res, job, 'Catatan pekerjaan cetak berhasil disimpan', 201);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * POST /api/print-jobs/:id/retry
 * Mencoba kembali pekerjaan cetak yang gagal
 */
export async function retryPrintJob(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return errorResponse(res, 'ID pekerjaan cetak tidak valid', 400);

    const existing = await prisma.printJob.findUnique({
      where: { id },
      include: { printerProfile: true, order: true },
    });
    if (!existing) return errorResponse(res, 'Pekerjaan cetak tidak ditemukan', 404);

    const updated = await prisma.printJob.update({
      where: { id },
      data: {
        status: 'QUEUED',
        attemptCount: existing.attemptCount + 1,
        errorMessage: null,
        errorCode: null,
      },
      include: { printerProfile: true, order: true },
    });

    return successResponse(res, updated, 'Pekerjaan cetak dimasukkan kembali ke antrean');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * POST /api/print-jobs/:id/reprint
 * Mencatat cetak ulang resmi (audit trail)
 */
export async function reprintPrintJob(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return errorResponse(res, 'ID pekerjaan cetak tidak valid', 400);

    const original = await prisma.printJob.findUnique({
      where: { id },
      include: { order: true, printerProfile: true },
    });
    if (!original) return errorResponse(res, 'Pekerjaan cetak tidak ditemukan', 404);

    const newReprintJob = await prisma.printJob.create({
      data: {
        printerProfileId: original.printerProfileId,
        orderId: original.orderId,
        documentType: original.documentType,
        status: 'PRINTED',
        attemptCount: 1,
        requestedBy: req.user?.username || 'kasir',
        payloadSnapshot: original.payloadSnapshot,
        printedAt: new Date(),
      },
      include: { printerProfile: true, order: true },
    });

    // Catat ke audit log
    if (req.user?.id) {
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'RECEIPT_REPRINT',
          detail: {
            originalJobId: original.id,
            reprintJobId: newReprintJob.id,
            orderId: original.orderId,
            invoiceNo: original.order?.invoiceNo,
          },
        },
      });
    }

    return successResponse(res, newReprintJob, 'Cetak ulang berhasil dicatat ke sistem');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * =========================================================================
 * KITCHEN PRINTER ROUTES CONTROLLER
 * =========================================================================
 */

/**
 * GET /api/kitchen-printer-routes
 */
export async function getKitchenRoutes(req, res) {
  try {
    const routes = await prisma.kitchenPrinterRoute.findMany({
      include: {
        printerProfile: {
          select: { id: true, name: true, role: true, connectionType: true, paperWidthMm: true },
        },
        station: {
          select: { id: true, name: true, code: true, type: true },
        },
        category: {
          select: { id: true, name: true },
        },
      },
    });

    return successResponse(res, routes, 'Rute printer dapur berhasil diambil');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * PUT /api/kitchen-printer-routes
 * Menata routing stasiun/kategori produk ke profil printer dapur
 */
export async function updateKitchenRoutes(req, res) {
  try {
    const { routes } = req.body; // Array of { printerProfileId, stationId?, categoryId? }
    if (!Array.isArray(routes)) {
      return errorResponse(res, 'Format rute tidak valid (harus berupa array)', 400);
    }

    await prisma.$transaction(async (tx) => {
      // Hapus rute lama
      await tx.kitchenPrinterRoute.deleteMany();

      if (routes.length > 0) {
        await tx.kitchenPrinterRoute.createMany({
          data: routes.map((r) => ({
            printerProfileId: parseInt(r.printerProfileId),
            stationId: r.stationId ? parseInt(r.stationId) : null,
            categoryId: r.categoryId ? parseInt(r.categoryId) : null,
          })),
        });
      }
    });

    return await getKitchenRoutes(req, res);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}
