/**
 * Backup Record Data Access Layer
 * Mengelola metadata riwayat pencadangan database secara aman.
 * Mendukung Prisma model terkompilasi maupun fallback query langsung.
 */

import prisma from '../../config/db.js';

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

    const cols = Object.keys(data);
    const vals = Object.values(data);
    const placeholders = cols.map(() => '?').join(', ');
    const colNames = cols.map((c) => `\`${c}\``).join(', ');

    await prisma.$executeRawUnsafe(
      `INSERT INTO \`backuprecord\` (${colNames}) VALUES (${placeholders})`,
      ...vals
    );

    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM \`backuprecord\` WHERE \`executionId\` = ? LIMIT 1`,
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

    const sets = Object.keys(updateData)
      .map((col) => `\`${col}\` = ?`)
      .join(', ');
    const vals = [...Object.values(updateData), executionId];

    await prisma.$executeRawUnsafe(
      `UPDATE \`backuprecord\` SET ${sets} WHERE \`executionId\` = ?`,
      ...vals
    );

    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM \`backuprecord\` WHERE \`executionId\` = ? LIMIT 1`,
      executionId
    );
    return rows[0] || null;
  },

  /**
   * Ambil backup berdasarkan ID
   */
  async findById(id) {
    try {
      if (prisma.backupRecord && typeof prisma.backupRecord.findUnique === 'function') {
        return await prisma.backupRecord.findUnique({
          where: { id: Number(id) },
        });
      }
    } catch {}

    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM \`backuprecord\` WHERE \`id\` = ? AND \`deletedAt\` IS NULL LIMIT 1`,
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

    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM \`backuprecord\` WHERE \`executionId\` = ? LIMIT 1`,
      executionId
    );
    return rows[0] || null;
  },

  /**
   * Ambil daftar riwayat backup dengan filter dan pagination
   */
  async findMany({ page = 1, limit = 20, status, backupType, startDate, endDate }) {
    const offset = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit));
    const safeLimit = Math.min(100, Math.max(1, limit));

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
      `SELECT COUNT(*) as total FROM \`backuprecord\` ${whereSql}`,
      ...params
    );
    const total = Number(countRows[0]?.total || 0);

    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM \`backuprecord\` ${whereSql} ORDER BY \`startedAt\` DESC LIMIT ? OFFSET ?`,
      ...params,
      safeLimit,
      offset
    );

    return {
      records: rows,
      pagination: {
        total,
        page: Number(page),
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit) || 1,
      },
    };
  },

  /**
   * Ambil ringkasan status backup terakhir
   */
  async getSummary() {
    const lastSuccessRows = await prisma.$queryRawUnsafe(
      `SELECT * FROM \`backuprecord\` WHERE \`status\` = 'SUCCESS' AND \`deletedAt\` IS NULL ORDER BY \`finishedAt\` DESC LIMIT 1`
    );

    const activeRunningRows = await prisma.$queryRawUnsafe(
      `SELECT * FROM \`backuprecord\` WHERE \`status\` IN ('RUNNING', 'VERIFYING', 'QUEUED') AND \`deletedAt\` IS NULL ORDER BY \`startedAt\` DESC LIMIT 1`
    );

    const countTotalRows = await prisma.$queryRawUnsafe(
      `SELECT 
        COUNT(*) as totalCount,
        SUM(CASE WHEN \`status\` = 'SUCCESS' THEN 1 ELSE 0 END) as successCount,
        SUM(CASE WHEN \`status\` = 'FAILED' THEN 1 ELSE 0 END) as failedCount,
        SUM(CASE WHEN \`status\` = 'SUCCESS' THEN \`fileSizeBytes\` ELSE 0 END) as totalSizeBytes
       FROM \`backuprecord\` WHERE \`deletedAt\` IS NULL`
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
    return prisma.$executeRawUnsafe(
      `UPDATE \`backuprecord\` SET \`deletedAt\` = NOW() WHERE \`id\` = ?`,
      Number(id)
    );
  },
};
