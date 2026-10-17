import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';

export const passwordResetService = {
  /**
   * Owner menerbitkan token reset password untuk user tertentu.
   * Hanya menyimpan hash SHA-256 dari token di database.
   * Mengembalikan token mentah & URL sekali untuk disampaikan privat oleh Owner.
   */
  async createResetToken(targetUserId, ownerId) {
    const targetId = parseInt(targetUserId);
    const actorId = parseInt(ownerId);

    const targetUser = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, name: true, username: true, role: true, isActive: true },
    });

    if (!targetUser) {
      throw new Error('Akun pengguna tidak ditemukan');
    }

    if (!targetUser.isActive) {
      throw new Error('Akun pengguna berstatus nonaktif');
    }

    // 1. Generate token acak berentropi tinggi (32 byte -> 64 hex chars)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // 2. Masa berlaku singkat (default 15 menit)
    const expiresInMinutes = 15;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    // 3. Simpan ke database dalam transaksi & cabut token lama yang belum terpakai
    await prisma.$transaction(async (tx) => {
      // Cabut token aktif terdahulu untuk user ini
      await tx.passwordResetToken.updateMany({
        where: {
          userId: targetId,
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: {
          revokedAt: new Date(),
        },
      });

      // Buat token baru (HANYA hash yang disimpan!)
      await tx.passwordResetToken.create({
        data: {
          userId: targetId,
          createdById: actorId,
          tokenHash,
          expiresAt,
        },
      });

      // Catat audit log (tanpa menyimpan token mentah)
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'PASSWORD_RESET_TOKEN_CREATED',
          detail: {
            targetUserId: targetId,
            targetUsername: targetUser.username,
            expiresAt: expiresAt.toISOString(),
            expiresInMinutes,
          },
        },
      });
    });

    // 4. Bangun URL reset dari frontend URL tepercaya
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173')
      .split(',')[0]
      .trim();
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    return {
      rawToken,
      resetUrl,
      expiresAt,
      expiresInMinutes,
      targetUser: {
        id: targetUser.id,
        name: targetUser.name,
        username: targetUser.username,
        role: targetUser.role,
      },
    };
  },

  /**
   * Owner mencabut token aktif yang belum digunakan
   */
  async revokeActiveToken(targetUserId, ownerId) {
    const targetId = parseInt(targetUserId);
    const actorId = parseInt(ownerId);

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.passwordResetToken.updateMany({
        where: {
          userId: targetId,
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: {
          revokedAt: new Date(),
        },
      });

      if (updated.count > 0) {
        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: 'PASSWORD_RESET_TOKEN_REVOKED',
            detail: {
              targetUserId: targetId,
              revokedCount: updated.count,
              revokedAt: new Date().toISOString(),
            },
          },
        });
      }

      return updated.count;
    });

    return { revokedCount: result };
  },

  /**
   * Cek apakah user memiliki token reset aktif (tanpa membocorkan token atau hash)
   */
  async getActiveTokenStatus(targetUserId) {
    const targetId = parseInt(targetUserId);
    const activeToken = await prisma.passwordResetToken.findFirst({
      where: {
        userId: targetId,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    return {
      hasActiveToken: Boolean(activeToken),
      createdAt: activeToken?.createdAt || null,
      expiresAt: activeToken?.expiresAt || null,
    };
  },

  /**
   * Verifikasi validitas token untuk UI preview sebelum submit
   */
  async verifyToken(rawToken) {
    if (!rawToken || typeof rawToken !== 'string') {
      return { valid: false, message: 'Token reset wajib diisi' };
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');

    const tokenRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: { id: true, name: true, username: true, isActive: true },
        },
      },
    });

    if (!tokenRecord) {
      return { valid: false, message: 'Token reset tidak valid atau tidak ditemukan' };
    }

    if (tokenRecord.usedAt) {
      return { valid: false, message: 'Token reset ini sudah pernah digunakan' };
    }

    if (tokenRecord.revokedAt) {
      return { valid: false, message: 'Token reset ini telah dibatalkan oleh Owner' };
    }

    if (new Date() > new Date(tokenRecord.expiresAt)) {
      return { valid: false, message: 'Token reset ini telah kedaluwarsa (masa berlaku 15 menit habis)' };
    }

    if (!tokenRecord.user || !tokenRecord.user.isActive) {
      return { valid: false, message: 'Akun pengguna sedang dinonaktifkan' };
    }

    return {
      valid: true,
      expiresAt: tokenRecord.expiresAt,
      username: tokenRecord.user.username,
      name: tokenRecord.user.name,
    };
  },

  /**
   * Pengguna menyelesaikan reset password dengan token sekali pakai.
   * Dilakukan dalam transaksi atomik:
   * 1. Verifikasi token
   * 2. Tandai token USED
   * 3. Update password hash bcrypt
   * 4. Naikkan tokenVersion pengguna (mencabut semua sesi JWT lama di perangkat lain)
   * 5. Catat audit log
   */
  async completePasswordReset(rawToken, newPassword, confirmPassword) {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new Error('Token reset wajib diisi');
    }

    if (!newPassword || newPassword.length < 8) {
      throw new Error('Password baru minimal 8 karakter');
    }

    if (newPassword !== confirmPassword) {
      throw new Error('Konfirmasi password tidak cocok');
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');

    return prisma.$transaction(async (tx) => {
      const tokenRecord = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
        include: {
          user: true,
        },
      });

      if (!tokenRecord) {
        throw new Error('Token reset tidak valid atau tidak ditemukan');
      }

      if (tokenRecord.usedAt) {
        throw new Error('Token reset ini sudah pernah digunakan');
      }

      if (tokenRecord.revokedAt) {
        throw new Error('Token reset ini telah dibatalkan oleh Owner');
      }

      if (new Date() > new Date(tokenRecord.expiresAt)) {
        throw new Error('Token reset ini telah kedaluwarsa. Silakan minta token baru ke Owner');
      }

      const targetUser = tokenRecord.user;
      if (!targetUser || !targetUser.isActive) {
        throw new Error('Akun pengguna tidak aktif');
      }

      // Hash password baru dengan bcrypt
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // Tandai token usedAt
      await tx.passwordResetToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: new Date() },
      });

      // Cabut sisa token lain untuk user ini
      await tx.passwordResetToken.updateMany({
        where: {
          userId: targetUser.id,
          id: { not: tokenRecord.id },
          usedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      // Perbarui password dan cabut semua sesi JWT yang ada dengan menaikkan tokenVersion
      const updatedUser = await tx.user.update({
        where: { id: targetUser.id },
        data: {
          password: hashedPassword,
          tokenVersion: { increment: 1 },
        },
        select: {
          id: true,
          username: true,
          name: true,
          tokenVersion: true,
        },
      });

      // Catat audit log
      await tx.auditLog.create({
        data: {
          userId: targetUser.id,
          action: 'PASSWORD_RESET_COMPLETED',
          detail: {
            targetUserId: targetUser.id,
            targetUsername: targetUser.username,
            tokenId: tokenRecord.id,
            resetAt: new Date().toISOString(),
          },
        },
      });

      return {
        success: true,
        message: 'Password berhasil diubah. Silakan login kembali dengan password baru.',
        username: updatedUser.username,
      };
    });
  },
};
