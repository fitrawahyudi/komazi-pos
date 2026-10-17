import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';
import { sendTelegramMessage } from './telegramService.js';

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

  /**
   * Owner meminta kode OTP 6-digit untuk reset password mandiri via Telegram.
   * Disimpan dalam bentuk hash SHA-256 ber-salt (OWNER_OTP:userId:otp) dengan masa berlaku 5 menit.
   */
  async requestOwnerResetOtp(username) {
    if (!username || typeof username !== 'string' || !username.trim()) {
      throw new Error('Username akun Owner wajib diisi');
    }

    const cleanUsername = username.trim().toLowerCase();

    const owner = await prisma.user.findFirst({
      where: {
        username: cleanUsername,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        telegramId: true,
        telegramUsername: true,
      },
    });

    if (!owner) {
      throw new Error('Akun tidak ditemukan atau berstatus nonaktif');
    }

    if (owner.role !== 'OWNER') {
      throw new Error('Pemulihan kata sandi via Telegram hanya berlaku untuk akun Owner. Untuk staf atau kasir, silakan hubungi Owner untuk dibuatkan token reset baru.');
    }

    if (!owner.telegramId || !String(owner.telegramId).trim()) {
      throw new Error('Akun Owner ini belum terhubung dengan akun Telegram. Silakan gunakan perintah darurat server (npm run reset-owner) atau hubungi administrator sistem.');
    }

    // 1. Generate 6-digit numeric OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const tokenHash = crypto.createHash('sha256').update(`OWNER_OTP:${owner.id}:${otp}`).digest('hex');

    // 2. Masa berlaku 5 menit
    const expiresInMinutes = 5;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    // 3. Simpan ke database dalam transaksi & cabut token lama
    await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: {
          userId: owner.id,
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: {
          revokedAt: new Date(),
        },
      });

      await tx.passwordResetToken.create({
        data: {
          userId: owner.id,
          createdById: owner.id,
          tokenHash,
          expiresAt,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: owner.id,
          action: 'OWNER_PASSWORD_RESET_OTP_REQUESTED',
          detail: {
            username: owner.username,
            telegramId: String(owner.telegramId),
            expiresAt: expiresAt.toISOString(),
          },
        },
      });
    });

    // 4. Kirim kode OTP via Telegram
    const formattedDate = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    const telegramMessage =
      `🔐 *KODE VERIFIKASI RESET PASSWORD OWNER*\n\n` +
      `Halo *${owner.name}*,\n` +
      `Permintaan atur ulang kata sandi diterima untuk akun *@${owner.username}* pada ${formattedDate}.\n\n` +
      `Kode Verifikasi Anda:\n` +
      `👉 \`${otp}\`\n\n` +
      `⏱️ _Kode berlaku selama ${expiresInMinutes} menit._\n` +
      `⚠️ *PENTING:* Jangan berikan kode ini kepada siapa pun termasuk staf kasir! Jika Anda tidak meminta kode ini, akun Anda tetap aman dan abaikan pesan ini.`;

    const sendRes = await sendTelegramMessage(telegramMessage, owner.telegramId);

    if (!sendRes.success) {
      throw new Error(
        `Gagal mengirim kode ke Telegram (${sendRes.reason || sendRes.error || 'Kendala bot'}). Pastikan Anda sudah membuka chat dan klik /start pada bot Telegram Komazi POS.`
      );
    }

    // Mask telegram ID/username untuk konfirmasi ke UI tanpa membocorkan nomor
    const maskedTelegram = owner.telegramUsername
      ? `@${owner.telegramUsername}`
      : `ID: ${String(owner.telegramId).slice(-4).padStart(String(owner.telegramId).length, '*')}`;

    return {
      success: true,
      message: `Kode verifikasi 6-digit berhasil dikirim ke Telegram Owner (${maskedTelegram}).`,
      expiresInMinutes,
    };
  },

  /**
   * Owner memverifikasi kode OTP 6-digit dan menetapkan password baru
   */
  async verifyAndCompleteOwnerReset(username, otp, newPassword, confirmPassword) {
    if (!username || typeof username !== 'string' || !username.trim()) {
      throw new Error('Username akun Owner wajib diisi');
    }

    if (!otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
      throw new Error('Kode OTP verifikasi harus berupa 6 digit angka');
    }

    if (!newPassword || newPassword.length < 8) {
      throw new Error('Password baru minimal 8 karakter');
    }

    if (newPassword !== confirmPassword) {
      throw new Error('Konfirmasi password tidak cocok');
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanOtp = otp.trim();

    const owner = await prisma.user.findFirst({
      where: {
        username: cleanUsername,
        isActive: true,
      },
    });

    if (!owner || owner.role !== 'OWNER') {
      throw new Error('Akun Owner tidak ditemukan atau tidak valid');
    }

    const tokenHash = crypto.createHash('sha256').update(`OWNER_OTP:${owner.id}:${cleanOtp}`).digest('hex');

    return prisma.$transaction(async (tx) => {
      const tokenRecord = await tx.passwordResetToken.findFirst({
        where: {
          userId: owner.id,
          tokenHash,
          usedAt: null,
          revokedAt: null,
        },
      });

      if (!tokenRecord) {
        throw new Error('Kode verifikasi salah atau sudah tidak berlaku.');
      }

      if (new Date() > new Date(tokenRecord.expiresAt)) {
        throw new Error('Kode verifikasi telah kedaluwarsa (masa berlaku 5 menit habis). Silakan minta kode baru.');
      }

      // Hash password baru dengan bcrypt
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // Tandai token usedAt
      await tx.passwordResetToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: new Date() },
      });

      // Cabut sisa token aktif lainnya untuk akun ini
      await tx.passwordResetToken.updateMany({
        where: {
          userId: owner.id,
          id: { not: tokenRecord.id },
          usedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      // Perbarui password dan cabut semua sesi login dengan increment tokenVersion
      const updatedOwner = await tx.user.update({
        where: { id: owner.id },
        data: {
          password: hashedPassword,
          tokenVersion: { increment: 1 },
        },
        select: {
          id: true,
          username: true,
          name: true,
          telegramId: true,
        },
      });

      // Catat audit log
      await tx.auditLog.create({
        data: {
          userId: owner.id,
          action: 'OWNER_PASSWORD_RESET_COMPLETED',
          detail: {
            username: owner.username,
            resetMethod: 'TELEGRAM_OTP',
            resetAt: new Date().toISOString(),
          },
        },
      });

      // Kirim konfirmasi keamanan ke Telegram Owner
      if (owner.telegramId) {
        const formattedDate = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        const notifyMsg =
          `✅ *KATA SANDI BERHASIL DIUBAH*\n\n` +
          `Halo *${owner.name}*,\n` +
          `Kata sandi untuk akun Owner *@${owner.username}* baru saja berhasil diperbarui pada ${formattedDate}.\n\n` +
          `🔒 *Catatan Keamanan:* Seluruh sesi login di perangkat lain telah otomatis dicabut demi keamanan outlet Anda.`;

        sendTelegramMessage(notifyMsg, owner.telegramId).catch((err) => {
          console.warn('[PasswordResetService] Gagal kirim notifikasi reset sukses ke Telegram:', err.message);
        });
      }

      return {
        success: true,
        message: 'Password Owner berhasil diperbarui! Silakan masuk dengan kata sandi baru.',
        username: updatedOwner.username,
      };
    });
  },
};
