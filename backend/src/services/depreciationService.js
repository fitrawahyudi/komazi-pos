import prisma from '../config/db.js';

export const depreciationService = {
  /**
   * Get processed depreciations history with filters
   */
  async getDepreciations({ year, month, assetId, page = 1, limit = 20 } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where = {};

    if (year) {
      where.year = parseInt(year, 10);
    }

    if (month) {
      where.month = parseInt(month, 10);
    }

    if (assetId) {
      where.assetId = parseInt(assetId, 10);
    }

    const [items, total] = await Promise.all([
      prisma.assetDepreciation.findMany({
        where,
        include: {
          asset: {
            select: {
              id: true,
              code: true,
              name: true,
              category: true,
              purchasePrice: true,
              bookValue: true,
              residualValue: true,
            },
          },
          processedBy: { select: { id: true, name: true, username: true } },
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { id: 'desc' }],
        skip,
        take: limitNum,
      }),
      prisma.assetDepreciation.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        depreciationAmount: parseFloat(item.depreciationAmount),
        asset: {
          ...item.asset,
          purchasePrice: parseFloat(item.asset.purchasePrice),
          bookValue: parseFloat(item.asset.bookValue),
          residualValue: parseFloat(item.asset.residualValue),
        },
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    };
  },

  /**
   * Preview depreciation for a specific year & month before processing
   */
  async previewDepreciation({ year, month }) {
    const targetYear = parseInt(year, 10);
    const targetMonth = parseInt(month, 10);

    if (isNaN(targetYear) || targetYear < 2000 || targetYear > 2100) {
      throw new Error('Tahun tidak valid');
    }
    if (isNaN(targetMonth) || targetMonth < 1 || targetMonth > 12) {
      throw new Error('Bulan tidak valid (1-12)');
    }

    const endOfTargetMonth = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    // Ambil seluruh aset aktif yang tanggal mulainya <= akhir bulan target
    const assets = await prisma.fixedAsset.findMany({
      where: {
        status: 'ACTIVE',
        startDate: { lte: endOfTargetMonth },
      },
      include: {
        depreciations: {
          where: {
            year: targetYear,
            month: targetMonth,
            status: 'PROCESSED',
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    const eligibleAssets = [];
    const alreadyProcessedAssets = [];
    const fullyDepreciatedAssets = [];
    let totalDepreciationToProcess = 0;

    for (const asset of assets) {
      const purchasePrice = parseFloat(asset.purchasePrice);
      const residualValue = parseFloat(asset.residualValue);
      const bookValue = parseFloat(asset.bookValue);
      const depreciableAmount = Math.max(0, purchasePrice - residualValue);
      const rawMonthly =
        asset.usefulLifeMonths > 0
          ? Math.round((depreciableAmount / asset.usefulLifeMonths) * 100) / 100
          : 0;

      // Cek apakah sudah disusutkan untuk periode ini
      const isAlreadyProcessed = asset.depreciations.length > 0;
      if (isAlreadyProcessed) {
        alreadyProcessedAssets.push({
          id: asset.id,
          code: asset.code,
          name: asset.name,
          category: asset.category,
          processedRecord: asset.depreciations[0],
        });
        continue;
      }

      // Cek apakah nilai buku sudah mencapai/melewati nilai residu
      if (bookValue <= residualValue) {
        fullyDepreciatedAssets.push({
          id: asset.id,
          code: asset.code,
          name: asset.name,
          bookValue,
          residualValue,
        });
        continue;
      }

      // Hitung nominal yang dapat disusutkan bulan ini (tidak boleh menembus residu)
      const maxAllowed = Math.max(0, bookValue - residualValue);
      const depreciationAmount = Math.min(rawMonthly, maxAllowed);

      eligibleAssets.push({
        id: asset.id,
        code: asset.code,
        name: asset.name,
        category: asset.category,
        purchasePrice,
        residualValue,
        currentBookValue: bookValue,
        depreciationAmount: Math.round(depreciationAmount * 100) / 100,
        estimatedClosingBookValue: Math.round((bookValue - depreciationAmount) * 100) / 100,
      });

      totalDepreciationToProcess += depreciationAmount;
    }

    return {
      year: targetYear,
      month: targetMonth,
      eligibleCount: eligibleAssets.length,
      alreadyProcessedCount: alreadyProcessedAssets.length,
      fullyDepreciatedCount: fullyDepreciatedAssets.length,
      totalDepreciationAmount: Math.round(totalDepreciationToProcess * 100) / 100,
      eligibleAssets,
      alreadyProcessedAssets,
      fullyDepreciatedAssets,
    };
  },

  /**
   * Process monthly depreciation for all eligible assets (Idempotent & Atomic)
   */
  async processDepreciation({ year, month, notes = '' }, userId) {
    const preview = await this.previewDepreciation({ year, month });
    const { eligibleAssets, year: targetYear, month: targetMonth } = preview;

    if (eligibleAssets.length === 0) {
      return {
        year: targetYear,
        month: targetMonth,
        processedCount: 0,
        skippedCount: preview.alreadyProcessedCount + preview.fullyDepreciatedCount,
        totalAmount: 0,
        message: 'Tidak ada aset yang perlu disusutkan untuk periode ini (semua sudah disusutkan atau nilai buku sudah habis)',
      };
    }

    return await prisma.$transaction(async (tx) => {
      let totalAmountProcessed = 0;
      let processedCount = 0;
      const processedDetails = [];

      for (const item of eligibleAssets) {
        // Double check atomic idempotency inside tx
        const existing = await tx.assetDepreciation.findUnique({
          where: {
            assetId_year_month: {
              assetId: item.id,
              year: targetYear,
              month: targetMonth,
            },
          },
        });

        if (existing) {
          continue; // Lewati jika proses paralel sudah membuat rekaman ini
        }

        const amount = item.depreciationAmount;

        // 1. Buat catatan penyusutan bulanan
        const record = await tx.assetDepreciation.create({
          data: {
            assetId: item.id,
            year: targetYear,
            month: targetMonth,
            depreciationAmount: amount,
            status: 'PROCESSED',
            processedById: userId,
            notes: notes ? notes.trim() : `Penyusutan otomatis periode ${targetMonth}/${targetYear}`,
          },
        });

        // 2. Perbarui akumulasi penyusutan dan nilai buku aset
        const asset = await tx.fixedAsset.findUnique({ where: { id: item.id } });
        const oldAccum = parseFloat(asset.accumulatedDepreciation || 0);
        const newAccum = Math.round((oldAccum + amount) * 100) / 100;
        const purchasePrice = parseFloat(asset.purchasePrice);
        const residualValue = parseFloat(asset.residualValue);
        const newBookValue = Math.max(residualValue, Math.round((purchasePrice - newAccum) * 100) / 100);

        await tx.fixedAsset.update({
          where: { id: item.id },
          data: {
            accumulatedDepreciation: newAccum,
            bookValue: newBookValue,
          },
        });

        totalAmountProcessed += amount;
        processedCount++;
        processedDetails.push({
          assetId: item.id,
          code: item.code,
          amount,
          newBookValue,
        });
      }

      // 3. Catat audit log
      await tx.auditLog.create({
        data: {
          userId,
          action: 'DEPRECIATION_PROCESS',
          detail: {
            year: targetYear,
            month: targetMonth,
            processedCount,
            totalAmount: totalAmountProcessed,
            assets: processedDetails,
          },
        },
      });

      return {
        year: targetYear,
        month: targetMonth,
        processedCount,
        totalAmount: Math.round(totalAmountProcessed * 100) / 100,
        message: `Penyusutan ${processedCount} aset untuk periode ${targetMonth}/${targetYear} berhasil dibukukan`,
      };
    });
  },
};
