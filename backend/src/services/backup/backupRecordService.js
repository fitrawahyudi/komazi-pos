/**
 * Backup Record Data Access Layer
 * Mengelola metadata riwayat pencadangan database secara aman.
 * Mendukung Prisma model terkompilasi maupun fallback query langsung yang kompatibel
 * dengan Linux (case-sensitive MySQL) dan Windows/macOS.
 */

import prisma from '../../config/db.js';

let cachedTableName = null;
async function getBackupTableName() {
  if (cachedTableName) return cachedTableName;
  try {
    const tables = await prisma.$queryRawUnsafe('SHOW TABLES');
    const names = tables.map((t) => Object.values(t)[0]);
    if (names.includes('BackupRecord')) {
      cachedTableName = 'BackupRecord';
    } else if (names.includes('backuprecord')) {
      cachedTableName = 'backuprecord';
    } else {
      cachedTableName = 'BackupRecord';
    }
  } catch {
    cachedTableName = 'BackupRecord';
  }
  return cachedTableName;
}

export const backupRecordService = {
  /**
   * Buat catatan backup baru (Status: QUEUED/RUNNING)
   */
  async create(data) {
    try {
      if (prisma.backupRecord && typeof prisma.backupRecord.create === 'function') {
        return await prisma.backupRecord.create({ data });
      }
    } catch (e) {
      // Fallback to raw query if model not yet compiled into client
    }

    const tableName = await getBackupTableName();
    const cols = Object.keys(data);
    const vals = Object.values(data);
    const placeholders = cols.map(() => '?').join(', ');
    const colNames = cols.map((c) => `\`${c}\``).join(', ');

    await prisma.$executeRawUnsafe(
      `INSERT INTO \`${tableName}\` (${colNames}) VALUES (${placeholders})`,
      ...vals
    );

    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM \`${tableName}\` WHERE \`executionId\` = ? LIMIT 1`,
      data.executionId
    );
    return rows[0] || null;
  },

  /**
   * Perbarui catatan backup berdasarkan executionId
   */
  async updateByExecutionId(executionId, data) {
    const updateData = { ...data, updatedAt: new Date() };

    try {
      if (prisma.backupRecord && typeof prisma.backupRecord.update === 'function') {
        return await prisma.backupRecord.update({
          where: { executionId },
          data: updateData,
        });
      }
    } catch (e) {
      // Fallback
    }

    const tableName = await getBackupTableName();
    const sets = Object.keys(updateData)
      .map((col) => `\`${col}\` = ?`)
      .join(', ');
    const vals = [...Object.values(updateData), executionId];

    await prisma.$executeRawUnsafe(
      `UPDATE \`${tableName}\` SET ${sets} WHERE \`executionId\` = ?`,
      ...vals
    );

    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM \`${tableName}\` WHERE \`executionId\` = ? LIMIT 1`,
      executionId
    );
    return rows[0] || null;
  },

  /**
   * Ambil backup berdasarkan ID
   */
  async findById(id) {
    try {
      if (prisma.backupRecord && typeof prisma.backupRecord.findFirst === 'function') {
        return await prisma.backupRecord.findFirst({
          where: { id: Number(id), deletedAt: null },
        });
      }
    } catch {}

    const tableName = await getBackupTableName();
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM \`${tableName}\` WHERE \`id\` = ? AND \`deletedAt\` IS NULL LIMIT 1`,
      Number(id)
    );
    return rows[0] || null;
  },

  /**
   * Ambil backup berdasarkan executionId
   */
  async findByExecutionId(executionId) {
    try {
      if (prisma.backupRecord && typeof prisma.backupRecord.findUnique === 'function') {
        return await prisma.backupRecord.findUnique({
          where: { executionId },
        });
      }
    } catch {}

    const tableName = await getBackupTableName();
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM \`${tableName}\` WHERE \`executionId\` = ? LIMIT 1`,
      executionId
    );
    return rows[0] || null;
  },

  /**
   * Ambil daftar riwayat backup dengan filter dan pagination
   */
  async findMany({ page = 1, limit = 20, status, backupType, startDate, endDate }) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * safeLimit;

    try {
      if (prisma.backupRecord && typeof prisma.backupRecord.findMany === 'function') {
        const where = { deletedAt: null };
        if (status && status !== 'ALL') where.status = status;
        if (backupType && backupType !== 'ALL') where.backupType = backupType;
        if (startDate || endDate) {
          where.startedAt = {};
          if (startDate) where.startedAt.gte = new Date(startDate);
          if (endDate) where.startedAt.lte = new Date(endDate);
        }

        const [total, records] = await Promise.all([
          prisma.backupRecord.count({ where }),
          prisma.backupRecord.findMany({
            where,
            orderBy: { startedAt: 'desc' },
            skip: offset,
            take: safeLimit,
          }),
        ]);

        return {
          records,
          pagination: {
            total,
            page: pageNum,
            limit: safeLimit,
            totalPages: Math.ceil(total / safeLimit) || 1,
          },
        };
      }
    } catch (e) {
      // Fallback to raw SQL if Prisma model is unavailable
    }

    const tableName = await getBackupTableName();
    let whereSql = `WHERE \`deletedAt\` IS NULL`;
    const params = [];

    if (status && status !== 'ALL') {
      whereSql += ` AND \`status\` = ?`;
      params.push(status);
    }

    if (backupType && backupType !== 'ALL') {
      whereSql += ` AND \`backupType\` = ?`;
      params.push(backupType);
    }

    if (startDate) {
      whereSql += ` AND \`startedAt\` >= ?`;
      params.push(new Date(startDate));
    }

    if (endDate) {
      whereSql += ` AND \`startedAt\` <= ?`;
      params.push(new Date(endDate));
    }

    const countRows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as total FROM \`${tableName}\` ${whereSql}`,
      ...params
    );
    const total = Number(countRows[0]?.total || 0);

    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM \`${tableName}\` ${whereSql} ORDER BY \`startedAt\` DESC LIMIT ? OFFSET ?`,
      ...params,
      safeLimit,
      offset
    );

    return {
      records: rows,
      pagination: {
        total,
        page: pageNum,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit) || 1,
      },
    };
  },

  /**
   * Ambil ringkasan status backup terakhir
   */
  async getSummary() {
    try {
      if (prisma.backupRecord && typeof prisma.backupRecord.findFirst === 'function') {
        const [lastSuccess, activeRunning, totalCount, successCount, failedCount, sumSize] =
          await Promise.all([
            prisma.backupRecord.findFirst({
              where: { status: 'SUCCESS', deletedAt: null },
              orderBy: { finishedAt: 'desc' },
            }),
            prisma.backupRecord.findFirst({
              where: {
                status: { in: ['RUNNING', 'VERIFYING', 'QUEUED'] },
                deletedAt: null,
              },
              orderBy: { startedAt: 'desc' },
            }),
            prisma.backupRecord.count({ where: { deletedAt: null } }),
            prisma.backupRecord.count({ where: { deletedAt: null, status: 'SUCCESS' } }),
            prisma.backupRecord.count({ where: { deletedAt: null, status: 'FAILED' } }),
            prisma.backupRecord.aggregate({
              _sum: { fileSizeBytes: true },
              where: { deletedAt: null, status: 'SUCCESS' },
            }),
          ]);

        return {
          lastSuccess: lastSuccess || null,
          activeRunning: activeRunning || null,
          totalCount: Number(totalCount || 0),
          successCount: Number(successCount || 0),
          failedCount: Number(failedCount || 0),
          totalSizeBytes: Number(sumSize?._sum?.fileSizeBytes || 0),
          storageHealth: 'HEALTHY',
        };
      }
    } catch (e) {
      // Fallback
    }

    const tableName = await getBackupTableName();
    const lastSuccessRows = await prisma.$queryRawUnsafe(
      `SELECT * FROM \`${tableName}\` WHERE \`status\` = 'SUCCESS' AND \`deletedAt\` IS NULL ORDER BY \`finishedAt\` DESC LIMIT 1`
    );

    const activeRunningRows = await prisma.$queryRawUnsafe(
      `SELECT * FROM \`${tableName}\` WHERE \`status\` IN ('RUNNING', 'VERIFYING', 'QUEUED') AND \`deletedAt\` IS NULL ORDER BY \`startedAt\` DESC LIMIT 1`
    );

    const countTotalRows = await prisma.$queryRawUnsafe(
      `SELECT 
        COUNT(*) as totalCount,
        SUM(CASE WHEN \`status\` = 'SUCCESS' THEN 1 ELSE 0 END) as successCount,
        SUM(CASE WHEN \`status\` = 'FAILED' THEN 1 ELSE 0 END) as failedCount,
        SUM(CASE WHEN \`status\` = 'SUCCESS' THEN \`fileSizeBytes\` ELSE 0 END) as totalSizeBytes
       FROM \`${tableName}\` WHERE \`deletedAt\` IS NULL`
    );

    const stats = countTotalRows[0] || {};

    return {
      lastSuccess: lastSuccessRows[0] || null,
      activeRunning: activeRunningRows[0] || null,
      totalCount: Number(stats.totalCount || 0),
      successCount: Number(stats.successCount || 0),
      failedCount: Number(stats.failedCount || 0),
      totalSizeBytes: Number(stats.totalSizeBytes || 0),
      storageHealth: 'HEALTHY',
    };
  },

  /**
   * Soft-delete catatan backup untuk jejak audit
   */
  async softDelete(id) {
    try {
      if (prisma.backupRecord && typeof prisma.backupRecord.update === 'function') {
        return await prisma.backupRecord.update({
          where: { id: Number(id) },
          data: { deletedAt: new Date() },
        });
      }
    } catch {}

    const tableName = await getBackupTableName();
    return prisma.$executeRawUnsafe(
      `UPDATE \`${tableName}\` SET \`deletedAt\` = NOW() WHERE \`id\` = ?`,
      Number(id)
    );
  },
};
