#!/usr/bin/env node
/**
 * Komazi POS - Skrip Pemulihan Darurat Kata Sandi Akun Owner
 *
 * Penggunaan:
 * 1. Mode Interaktif (Dipandu):
 *    npm run reset-owner
 *
 * 2. Mode Argumen Langsung:
 *    node scripts/reset-owner.js <username> <newPassword>
 */

import 'dotenv/config';
import readline from 'readline';
import bcrypt from 'bcryptjs';
import prisma from '../src/config/db.js';

function askQuestion(query, rl) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function performReset(user, newPassword) {
  if (!newPassword || newPassword.length < 8) {
    throw new Error('Password baru minimal 8 karakter!');
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  await prisma.$transaction(async (tx) => {
    // 1. Update password & naikkan tokenVersion untuk cabut seluruh sesi login lama
    await tx.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        tokenVersion: { increment: 1 },
      },
    });

    // 2. Cabut semua token reset password yang masih aktif
    await tx.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    // 3. Catat ke audit log
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: 'OWNER_PASSWORD_RESET_CLI',
        detail: {
          username: user.username,
          resetMethod: 'CLI_EMERGENCY_SCRIPT',
          resetAt: new Date().toISOString(),
        },
      },
    });
  });
}

async function main() {
  console.log('\n======================================================');
  console.log('       KOMAZI POS - PEMULIHAN DARURAT AKUN OWNER       ');
  console.log('======================================================\n');

  const args = process.argv.slice(2);

  // 1. Mode argumen langsung: node scripts/reset-owner.js <username> <newPassword>
  if (args.length >= 2) {
    const targetUsername = args[0].trim().toLowerCase();
    const newPassword = args[1];

    console.log(`[*] Mencari akun Owner dengan username: "${targetUsername}"...`);
    const owner = await prisma.user.findFirst({
      where: {
        username: targetUsername,
        isActive: true,
      },
    });

    if (!owner) {
      console.error(`[!] Error: Akun "${targetUsername}" tidak ditemukan atau nonaktif.`);
      process.exit(1);
    }

    if (owner.role !== 'OWNER') {
      console.error(`[!] Error: Akun "${targetUsername}" memiliki role ${owner.role}, bukan OWNER.`);
      process.exit(1);
    }

    try {
      await performReset(owner, newPassword);
      console.log(`\n✅ BERHASIL! Password untuk akun Owner "@${owner.username}" (${owner.name}) telah diperbarui.`);
      console.log('🔒 Seluruh sesi login sebelumnya telah dicabut demi keamanan.');
      console.log('👉 Silakan masuk kembali ke web POS menggunakan password baru.\n');
      process.exit(0);
    } catch (err) {
      console.error(`[!] Gagal mereset password: ${err.message}`);
      process.exit(1);
    }
  }

  // 2. Mode Interaktif
  const owners = await prisma.user.findMany({
    where: {
      role: 'OWNER',
      isActive: true,
    },
    select: {
      id: true,
      username: true,
      name: true,
      telegramId: true,
      telegramUsername: true,
    },
    orderBy: { id: 'asc' },
  });

  if (owners.length === 0) {
    console.error('[!] Tidak ada akun berstatus OWNER yang aktif di database.');
    process.exit(1);
  }

  console.log('Daftar Akun Owner Terdaftar:');
  owners.forEach((o, idx) => {
    const tgInfo = o.telegramUsername
      ? `@${o.telegramUsername}`
      : o.telegramId
      ? `ID: ${o.telegramId}`
      : 'Belum ditautkan';
    console.log(`  [${idx + 1}] Username: @${o.username.padEnd(14)} | Nama: ${o.name.padEnd(20)} | Telegram: ${tgInfo}`);
  });
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const choiceStr = await askQuestion('Pilih nomor akun Owner yang ingin direset (default: 1): ', rl);
    const choiceNum = parseInt(choiceStr.trim() || '1', 10);

    const selectedOwner = owners[choiceNum - 1];
    if (!selectedOwner) {
      console.error('[!] Pilihan nomor tidak valid.');
      rl.close();
      process.exit(1);
    }

    console.log(`\nAnda memilih: @${selectedOwner.username} (${selectedOwner.name})`);
    const newPass = await askQuestion('Masukkan kata sandi baru (minimal 8 karakter): ', rl);

    if (!newPass || newPass.trim().length < 8) {
      console.error('[!] Password baru minimal 8 karakter!');
      rl.close();
      process.exit(1);
    }

    const confirmPass = await askQuestion('Ketik ulang kata sandi baru untuk konfirmasi: ', rl);
    if (newPass.trim() !== confirmPass.trim()) {
      console.error('[!] Konfirmasi kata sandi tidak cocok!');
      rl.close();
      process.exit(1);
    }

    console.log('\n[*] Sedang memproses pembaruan kata sandi...');
    await performReset(selectedOwner, newPass.trim());

    console.log('\n======================================================');
    console.log(`✅ BERHASIL! Kata sandi akun @${selectedOwner.username} telah diperbarui.`);
    console.log('🔒 Semua sesi login di perangkat lain telah otomatis dicabut.');
    console.log('👉 Anda sekarang dapat login ke web POS dengan kata sandi baru.');
    console.log('======================================================\n');
  } catch (err) {
    console.error(`\n[!] Terjadi kesalahan: ${err.message}`);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[!] Fatal Error:', err);
  process.exit(1);
});
