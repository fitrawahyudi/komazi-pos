import prisma from '../config/db.js';

/**
 * Generate sequential asset code format: AST-XXXX
 */
async function generateAssetCode(tx = prisma) {
  const latestAsset = await tx.fixedAsset.findFirst({
    where: {
      code: {
        startsWith: 'AST-',
      },
    },
    orderBy: {
      code: 'desc',
    },
    select: {
      code: true,
    },
  });

  let nextSequence = 1;
  if (latestAsset && latestAsset.code) {
    const parts = latestAsset.code.split('-');
    const currentSeq = parseInt(parts[1], 10);
    if (!isNaN(currentSeq)) {
      nextSequence = currentSeq + 1;
    }
  }

  return `AST-${String(nextSequence).padStart(4, '0')}`;
}

export const assetService = {
  /**
   * Get all assets with filtering and pagination
   */
  async getAssets({
    page = 1,
    limit = 20,
    status,
    category,
    condition,
    search,
  } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where = {};

    if (status) {
      where.status = status.toUpperCase();
    }

    if (category) {
      where.category = category;
    }

    if (condition) {
      where.condition = condition.toUpperCase();
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { code: { contains: q } },
        { name: { contains: q } },
        { location: { contains: q } },
        { serialNumber: { contains: q } },
        { vendor: { contains: q } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.fixedAsset.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true, username: true } },
          _count: { select: { depreciations: true } },
        },
        orderBy: [{ id: 'desc' }],
        skip,
        take: limitNum,
      }),
      prisma.fixedAsset.count({ where }),
    ]);

    return {
      items: items.map((a) => {
        const purchasePrice = parseFloat(a.purchasePrice);
        const residualValue = parseFloat(a.residualValue);
        const accumulatedDepreciation = parseFloat(a.accumulatedDepreciation);
        const bookValue = parseFloat(a.bookValue);
        const depreciableAmount = Math.max(0, purchasePrice - residualValue);
        const monthlyDepreciation =
          a.usefulLifeMonths > 0
            ? Math.round((depreciableAmount / a.usefulLifeMonths) * 100) / 100
            : 0;

        return {
          ...a,
          purchasePrice,
          residualValue,
          accumulatedDepreciation,
          bookValue,
          monthlyDepreciation,
        };
      }),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    };
  },

  /**
   * Get single asset by ID
   */
  async getAssetById(id) {
    const asset = await prisma.fixedAsset.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        createdBy: { select: { id: true, name: true, username: true } },
        depreciations: {
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
          include: {
            processedBy: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!asset) return null;

    const purchasePrice = parseFloat(asset.purchasePrice);
    const residualValue = parseFloat(asset.residualValue);
    const accumulatedDepreciation = parseFloat(asset.accumulatedDepreciation);
    const bookValue = parseFloat(asset.bookValue);
    const depreciableAmount = Math.max(0, purchasePrice - residualValue);
    const monthlyDepreciation =
      asset.usefulLifeMonths > 0
        ? Math.round((depreciableAmount / asset.usefulLifeMonths) * 100) / 100
        : 0;

    return {
      ...asset,
      purchasePrice,
      residualValue,
      accumulatedDepreciation,
      bookValue,
      monthlyDepreciation,
      depreciations: (asset.depreciations || []).map((d) => ({
        ...d,
        depreciationAmount: parseFloat(d.depreciationAmount),
      })),
    };
  },

  /**
   * Create new fixed asset
   */
  async createAsset(data, userId) {
    const {
      name,
      category = 'Peralatan Bar & Kopi',
      description = null,
      purchaseDate,
      startDate,
      purchasePrice,
      residualValue = 0,
      usefulLifeMonths = 60,
      depreciationMethod = 'STRAIGHT_LINE',
      location = 'Station Barista',
      condition = 'EXCELLENT',
      serialNumber = null,
      vendor = null,
      receiptUrl = null,
    } = data;

    if (!name || !name.trim()) {
      throw new Error('Nama aset wajib diisi');
    }

    const price = parseFloat(purchasePrice);
    if (isNaN(price) || price <= 0) {
      throw new Error('Harga perolehan aset harus lebih besar dari 0');
    }

    const residual = parseFloat(residualValue || 0);
    if (isNaN(residual) || residual < 0) {
      throw new Error('Nilai residu tidak boleh negatif');
    }

    if (residual > price) {
      throw new Error('Nilai residu tidak boleh melebihi harga perolehan');
    }

    const months = parseInt(usefulLifeMonths, 10);
    if (isNaN(months) || months <= 0) {
      throw new Error('Umur manfaat aset harus lebih besar dari 0 bulan');
    }

    const pDate = purchaseDate ? new Date(purchaseDate) : new Date();
    const sDate = startDate ? new Date(startDate) : pDate;

    return await prisma.$transaction(async (tx) => {
      const code = await generateAssetCode(tx);

      const created = await tx.fixedAsset.create({
        data: {
          code,
          name: name.trim(),
          category,
          description: description ? description.trim() : null,
          purchaseDate: pDate,
          startDate: sDate,
          purchasePrice: price,
          residualValue: residual,
          usefulLifeMonths: months,
          depreciationMethod,
          accumulatedDepreciation: 0,
          bookValue: price, // Awalnya nilai buku = harga perolehan
          location: location || 'Station Barista',
          condition: condition || 'EXCELLENT',
          status: 'ACTIVE',
          serialNumber: serialNumber ? serialNumber.trim() : null,
          vendor: vendor ? vendor.trim() : null,
          receiptUrl: receiptUrl || null,
          createdById: userId,
        },
        include: {
          createdBy: { select: { id: true, name: true, username: true } },
        },
      });

      // Audit trail
      await tx.auditLog.create({
        data: {
          userId,
          action: 'ASSET_CREATE',
          detail: {
            assetId: created.id,
            code: created.code,
            name: created.name,
            purchasePrice: price,
            usefulLifeMonths: months,
          },
        },
      });

      return {
        ...created,
        purchasePrice: parseFloat(created.purchasePrice),
        residualValue: parseFloat(created.residualValue),
        accumulatedDepreciation: parseFloat(created.accumulatedDepreciation),
        bookValue: parseFloat(created.bookValue),
      };
    });
  },

  /**
   * Update fixed asset details
   */
  async updateAsset(id, data, userId) {
    const assetId = parseInt(id, 10);
    const existing = await prisma.fixedAsset.findUnique({
      where: { id: assetId },
      include: { depreciations: true },
    });

    if (!existing) {
      throw new Error('Aset tidak ditemukan');
    }

    if (existing.status === 'DISPOSED') {
      throw new Error('Aset yang sudah dilepas / dijual tidak dapat diubah kembali');
    }

    const updateData = {};

    if (data.name !== undefined) {
      if (!data.name.trim()) throw new Error('Nama aset tidak boleh kosong');
      updateData.name = data.name.trim();
    }

    if (data.category !== undefined) {
      updateData.category = data.category;
    }

    if (data.location !== undefined) {
      updateData.location = data.location;
    }

    if (data.condition !== undefined) {
      updateData.condition = data.condition;
    }

    if (data.status !== undefined && data.status !== 'DISPOSED') {
      updateData.status = data.status;
    }

    if (data.serialNumber !== undefined) {
      updateData.serialNumber = data.serialNumber ? data.serialNumber.trim() : null;
    }

    if (data.vendor !== undefined) {
      updateData.vendor = data.vendor ? data.vendor.trim() : null;
    }

    if (data.description !== undefined) {
      updateData.description = data.description ? data.description.trim() : null;
    }

    if (data.receiptUrl !== undefined) {
      updateData.receiptUrl = data.receiptUrl || null;
    }

    // Jika harga atau nilai residu atau umur manfaat diubah setelah penyusutan berjalan:
    // Pastikan nilai buku dihitung ulang secara konsisten
    if (data.purchasePrice !== undefined || data.residualValue !== undefined || data.usefulLifeMonths !== undefined) {
      const newPrice = data.purchasePrice !== undefined ? parseFloat(data.purchasePrice) : parseFloat(existing.purchasePrice);
      const newResidual = data.residualValue !== undefined ? parseFloat(data.residualValue) : parseFloat(existing.residualValue);
      const newMonths = data.usefulLifeMonths !== undefined ? parseInt(data.usefulLifeMonths, 10) : existing.usefulLifeMonths;

      if (isNaN(newPrice) || newPrice <= 0) throw new Error('Harga perolehan aset harus lebih besar dari 0');
      if (isNaN(newResidual) || newResidual < 0) throw new Error('Nilai residu tidak boleh negatif');
      if (newResidual > newPrice) throw new Error('Nilai residu tidak boleh melebihi harga perolehan');
      if (isNaN(newMonths) || newMonths <= 0) throw new Error('Umur manfaat aset harus lebih besar dari 0 bulan');

      updateData.purchasePrice = newPrice;
      updateData.residualValue = newResidual;
      updateData.usefulLifeMonths = newMonths;

      // Nilai buku baru = Harga baru - Akumulasi penyusutan yang sudah tercatat
      const accum = parseFloat(existing.accumulatedDepreciation || 0);
      updateData.bookValue = Math.max(newResidual, newPrice - accum);
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.fixedAsset.update({
        where: { id: assetId },
        data: updateData,
        include: {
          createdBy: { select: { id: true, name: true, username: true } },
        },
      });

      // Audit trail
      await tx.auditLog.create({
        data: {
          userId,
          action: 'ASSET_UPDATE',
          detail: {
            assetId,
            code: updated.code,
            changes: Object.keys(updateData),
          },
        },
      });

      return {
        ...updated,
        purchasePrice: parseFloat(updated.purchasePrice),
        residualValue: parseFloat(updated.residualValue),
        accumulatedDepreciation: parseFloat(updated.accumulatedDepreciation),
        bookValue: parseFloat(updated.bookValue),
      };
    });
  },

  /**
   * Dispose or sell asset
   */
  async disposeAsset(id, data, userId) {
    const assetId = parseInt(id, 10);
    const existing = await prisma.fixedAsset.findUnique({
      where: { id: assetId },
    });

    if (!existing) {
      throw new Error('Aset tidak ditemukan');
    }

    if (existing.status === 'DISPOSED') {
      throw new Error('Aset ini sudah berstatus dilepas / dijual');
    }

    const { disposalPrice = 0, disposalNotes = '' } = data;
    const parsedPrice = parseFloat(disposalPrice || 0);

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.fixedAsset.update({
        where: { id: assetId },
        data: {
          status: 'DISPOSED',
          disposedAt: new Date(),
          disposalPrice: parsedPrice,
          disposalNotes: disposalNotes ? disposalNotes.trim() : null,
        },
      });

      // Audit trail
      await tx.auditLog.create({
        data: {
          userId,
          action: 'ASSET_DISPOSE',
          detail: {
            assetId,
            code: updated.code,
            name: updated.name,
            bookValueAtDisposal: parseFloat(existing.bookValue),
            disposalPrice: parsedPrice,
            disposalNotes: disposalNotes ? disposalNotes.trim() : null,
          },
        },
      });

      return {
        ...updated,
        purchasePrice: parseFloat(updated.purchasePrice),
        residualValue: parseFloat(updated.residualValue),
        accumulatedDepreciation: parseFloat(updated.accumulatedDepreciation),
        bookValue: parseFloat(updated.bookValue),
        disposalPrice: parsedPrice,
      };
    });
  },

  /**
   * Generate full projected depreciation schedule for an asset
   */
  async getDepreciationSchedule(id) {
    const asset = await this.getAssetById(id);
    if (!asset) {
      throw new Error('Aset tidak ditemukan');
    }

    const {
      purchasePrice,
      residualValue,
      usefulLifeMonths,
      startDate,
      depreciations = [],
    } = asset;

    const depreciableAmount = Math.max(0, purchasePrice - residualValue);
    const monthlyRate =
      usefulLifeMonths > 0
        ? Math.round((depreciableAmount / usefulLifeMonths) * 100) / 100
        : 0;

    // Map existing processed records by "YYYY-M"
    const processedMap = new Map();
    for (const dep of depreciations) {
      processedMap.set(`${dep.year}-${dep.month}`, dep);
    }

    const schedule = [];
    const start = new Date(startDate);
    let currentOpening = purchasePrice;
    let accumulated = 0;

    for (let i = 0; i < usefulLifeMonths; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const key = `${year}-${month}`;

      // Hitung nominal bulan ini (pastikan tidak menembus batas nilai residu pada bulan terakhir)
      let amountThisMonth = monthlyRate;
      if (i === usefulLifeMonths - 1 || (currentOpening - amountThisMonth) < residualValue) {
        amountThisMonth = Math.max(0, currentOpening - residualValue);
      }

      const closingValue = Math.max(residualValue, currentOpening - amountThisMonth);
      accumulated += amountThisMonth;

      const processedRecord = processedMap.get(key);

      schedule.push({
        monthIndex: i + 1,
        year,
        month,
        periodLabel: `${d.toLocaleString('id-ID', { month: 'short' })} ${year}`,
        openingBookValue: Math.round(currentOpening * 100) / 100,
        depreciationAmount: Math.round(amountThisMonth * 100) / 100,
        closingBookValue: Math.round(closingValue * 100) / 100,
        accumulatedDepreciation: Math.round(accumulated * 100) / 100,
        isProcessed: Boolean(processedRecord && processedRecord.status === 'PROCESSED'),
        processedAt: processedRecord?.processedAt || null,
        processedBy: processedRecord?.processedBy?.name || null,
      });

      currentOpening = closingValue;
      if (currentOpening <= residualValue) break;
    }

    return {
      asset: {
        id: asset.id,
        code: asset.code,
        name: asset.name,
        category: asset.category,
        purchasePrice,
        residualValue,
        usefulLifeMonths,
        monthlyDepreciation: monthlyRate,
        accumulatedDepreciation: asset.accumulatedDepreciation,
        bookValue: asset.bookValue,
        status: asset.status,
      },
      schedule,
    };
  },

  /**
   * Assets summary KPIs
   */
  async getAssetsSummary() {
    const assets = await prisma.fixedAsset.findMany();

    let totalAssets = assets.length;
    let activeAssets = 0;
    let totalPurchaseValue = 0;
    let totalAccumulatedDepreciation = 0;
    let totalBookValue = 0;

    for (const a of assets) {
      if (a.status === 'ACTIVE') activeAssets++;
      totalPurchaseValue += parseFloat(a.purchasePrice || 0);
      totalAccumulatedDepreciation += parseFloat(a.accumulatedDepreciation || 0);
      totalBookValue += parseFloat(a.bookValue || 0);
    }

    return {
      totalAssets,
      activeAssets,
      totalPurchaseValue: Math.round(totalPurchaseValue * 100) / 100,
      totalAccumulatedDepreciation: Math.round(totalAccumulatedDepreciation * 100) / 100,
      totalBookValue: Math.round(totalBookValue * 100) / 100,
    };
  },
};
