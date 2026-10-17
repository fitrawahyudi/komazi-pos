/**
 * Universal Scheduler Agent untuk Komazi AI.
 * Mengorkestrasi segala jenis penjadwalan tanpa terkecuali:
 * 1. Tugas operasional & pengingat (ScheduledJob)
 * 2. Laporan berkala & backup sistem (Cron)
 * 3. Jadwal kerja shift staf HRIS (StaffSchedule & Schedule Guard)
 * 4. Kueri status jadwal aktif dan pembatalan alami.
 */

import prisma from '../../config/db.js';
import { jobRegistryService } from '../cron/jobRegistryService.js';
import {
  formatFriendlySalutation,
  formatScheduleNaturalReply,
  formatStaffShiftSuccessReply,
  formatScheduleErrorReply,
} from './aiToneFormatter.js';
import { esc } from '../../bot/utils/format.js';
import logger from '../../utils/logger.js';

export class UniversalSchedulerAgent {
  /**
   * Eksekusi langsung pembuatan jadwal (Staff Shift maupun ScheduledJob)
   * @param {object} parsedSchedule - Objek hasil parse dari naturalScheduleParser
   * @param {object} user - ctx.user dari bot
   * @returns {Promise<{ success: boolean, message: string, data?: object }>}
   */
  async executeSchedule(parsedSchedule, user) {
    const salutation = formatFriendlySalutation(user);

    if (!parsedSchedule) {
      return {
        success: false,
        message: formatScheduleErrorReply('Format atau waktu jadwal tidak dikenali.', salutation),
      };
    }

    // ========================================================
    // 1. Penanganan Shift Kerja Staf HRIS
    // ========================================================
    if (parsedSchedule.jobCategory === 'STAFF_SHIFT') {
      const isManagerOrOwner = user?.role === 'OWNER' || user?.role === 'MANAGER';
      if (!isManagerOrOwner) {
        return {
          success: false,
          message: `Maaf ${salutation}, hanya Owner atau Manager yang memiliki izin mengatur jadwal kerja staf.`,
        };
      }

      try {
        // Cari staf berdasarkan nama atau username
        const staff = await prisma.user.findFirst({
          where: {
            OR: [
              { name: { contains: parsedSchedule.staffName } },
              { username: { contains: parsedSchedule.staffName.toLowerCase() } },
            ],
          },
          select: { id: true, name: true, role: true },
        });

        if (!staff) {
          return {
            success: false,
            message: `Maaf ${salutation}, staf dengan nama <b>"${esc(parsedSchedule.staffName)}"</b> tidak ditemukan di data karyawan. Pastikan nama staf sudah terdaftar ya.`,
          };
        }

        // Cek konflik jadwal shift pada tanggal yang sama
        const conflicting = await prisma.staffSchedule.findFirst({
          where: {
            userId: staff.id,
            date: parsedSchedule.dateString,
            startTime: { lte: parsedSchedule.endTime },
            endTime: { gte: parsedSchedule.startTime },
          },
        });

        if (conflicting) {
          return {
            success: false,
            message: `Peringatan bentrok jadwal: <b>${esc(staff.name)}</b> sudah memiliki shift <b>${esc(conflicting.shiftName)}</b> (${conflicting.startTime} - ${conflicting.endTime}) pada tanggal ${parsedSchedule.dateString}.`,
          };
        }

        // Simpan jadwal shift ke database HRIS
        const createdShift = await prisma.staffSchedule.create({
          data: {
            userId: staff.id,
            date: parsedSchedule.dateString,
            shiftName: parsedSchedule.shiftName,
            startTime: parsedSchedule.startTime,
            endTime: parsedSchedule.endTime,
            status: 'PUBLISHED',
            notes: `Dibuat via Komazi AI oleh ${user.name || 'Manager'}`,
          },
        });

        const replyText = formatStaffShiftSuccessReply(
          staff.name,
          parsedSchedule.shiftName,
          parsedSchedule.dateString,
          `${parsedSchedule.startTime} - ${parsedSchedule.endTime} WIB`,
          salutation
        );

        return {
          success: true,
          message: replyText,
          data: createdShift,
        };
      } catch (err) {
        logger.system.error(`[UniversalSchedulerAgent HRIS Error] ${err.message}`);
        return {
          success: false,
          message: formatScheduleErrorReply(err.message, salutation),
        };
      }
    }

    // ========================================================
    // 2. Penanganan Tugas Operasional / Pengingat / Cronjob
    // ========================================================
    try {
      const createdJob = await jobRegistryService.createJob(
        {
          name: parsedSchedule.name,
          description: `Jadwal otomatis via Komazi AI untuk ${user?.name || 'User'}`,
          jobType: parsedSchedule.jobType,
          scheduleType: parsedSchedule.scheduleType || 'cron',
          scheduleExpression: parsedSchedule.scheduleExpression,
          timezone: parsedSchedule.timezone || 'Asia/Jakarta',
          targetRoles: parsedSchedule.targetRoles || ['OWNER', 'MANAGER'],
          timeoutSeconds: 60,
          retryLimit: 3,
          payload: parsedSchedule.payload || {},
        },
        {
          type: 'USER',
          id: String(user?.id || 'ai_agent'),
          name: user?.name || 'Komazi AI',
        }
      );

      const replyText = formatScheduleNaturalReply(createdJob, {
        user,
        isSaved: true,
      });

      return {
        success: true,
        message: replyText,
        data: createdJob,
      };
    } catch (err) {
      logger.system.error(`[UniversalSchedulerAgent Job Error] ${err.message}`);
      return {
        success: false,
        message: formatScheduleErrorReply(err.message, salutation),
      };
    }
  }

  /**
   * Mengambil daftar jadwal aktif secara ramah dan ringkas
   * @param {object} user
   * @returns {Promise<string>}
   */
  async listActiveSchedulesNatural(user) {
    const salutation = formatFriendlySalutation(user);

    try {
      const [jobs, staffSchedules] = await Promise.all([
        prisma.scheduledJob.findMany({
          where: { enabled: true, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        prisma.staffSchedule.findMany({
          where: {
            date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()),
          },
          include: { user: { select: { name: true, role: true } } },
          take: 5,
        }),
      ]);

      let result = `Tentu, ${salutation}! Berikut daftar jadwal dan pengingat yang sedang aktif ya:\n\n`;

      if (jobs.length > 0) {
        result += `⏰ <b>Pengingat & Tugas Otomatis:</b>\n`;
        jobs.forEach((j) => {
          result += `• <b>${esc(j.name)}</b> (${j.scheduleType === 'once' ? 'Sekali jalan' : 'Berulang'})\n`;
        });
      } else {
        result += `⏰ <i>Belum ada tugas otomatis yang terpasang.</i>\n`;
      }

      result += `\n`;

      if (staffSchedules.length > 0) {
        result += `👥 <b>Jadwal Shift Staf Hari Ini:</b>\n`;
        staffSchedules.forEach((s) => {
          result += `• ${esc(s.user?.name || 'Staf')}: Shift <b>${esc(s.shiftName)}</b> (${s.startTime} - ${s.endTime})\n`;
        });
      } else {
        result += `👥 <i>Belum ada roster shift staf yang dijadwalkan hari ini.</i>\n`;
      }

      result += `\nKetik langsung jika ingin menambah, mengubah, atau membatalkan jadwal apa pun ya!`;
      return result;
    } catch (err) {
      return `Maaf ${salutation}, saat ini sedang tidak dapat memuat daftar jadwal: ${err.message}`;
    }
  }
}

export const universalSchedulerAgent = new UniversalSchedulerAgent();
