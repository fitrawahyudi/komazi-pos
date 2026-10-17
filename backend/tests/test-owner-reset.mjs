import 'dotenv/config';
import prisma from '../src/config/db.js';
import bcrypt from 'bcryptjs';
import { passwordResetService } from '../src/services/passwordReset.service.js';
import crypto from 'crypto';

async function testOwnerReset() {
  console.log('\n======================================================');
  console.log('🧪 TESTING OWNER PASSWORD RESET VIA TELEGRAM & CLI');
  console.log('======================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`   ✅ PASS [${total}]: ${message}`);
      passed++;
    } else {
      console.error(`   ❌ FAIL [${total}]: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    // Setup test: Ensure owner exists
    const owner = await prisma.user.findFirst({
      where: { role: 'OWNER', isActive: true },
    });
    assert(Boolean(owner), `Owner account found: @${owner?.username}`);

    // Test 1: Non-existent username rejected
    try {
      await passwordResetService.requestOwnerResetOtp('user_does_not_exist_999');
      assert(false, 'Should have thrown for non-existent user');
    } catch (err) {
      assert(err.message.includes('tidak ditemukan'), 'Rejects non-existent username with clear message');
    }

    // Test 2: Non-owner role rejected (e.g., cashier)
    const cashier = await prisma.user.findFirst({
      where: { role: 'CASHIER', isActive: true },
    });
    if (cashier) {
      try {
        await passwordResetService.requestOwnerResetOtp(cashier.username);
        assert(false, 'Should have thrown for non-owner');
      } catch (err) {
        assert(err.message.includes('hanya berlaku untuk akun Owner'), 'Rejects non-owner accounts with informative instruction');
      }
    }

    // Test 3: Owner without Telegram ID rejected with emergency CLI instruction
    // Temporarily backup telegramId
    const originalTelegramId = owner.telegramId;
    await prisma.user.update({
      where: { id: owner.id },
      data: { telegramId: null },
    });

    try {
      await passwordResetService.requestOwnerResetOtp(owner.username);
      assert(false, 'Should have thrown when Telegram ID is not set');
    } catch (err) {
      assert(err.message.includes('belum terhubung dengan akun Telegram') && err.message.includes('npm run reset-owner'), 'Rejects unlinked Telegram and points to emergency CLI');
    }

    // Restore temporary telegram ID for testing
    const testTgId = originalTelegramId || '123456789';
    await prisma.user.update({
      where: { id: owner.id },
      data: { telegramId: testTgId },
    });

    // Test 4: OTP generation & validation
    // We can simulate OTP directly in service
    const otp = '849201';
    const tokenHash = crypto.createHash('sha256').update(`OWNER_OTP:${owner.id}:${otp}`).digest('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        userId: owner.id,
        createdById: owner.id,
        tokenHash,
        expiresAt,
      },
    });

    // Test 5: Reject incorrect OTP
    try {
      await passwordResetService.verifyAndCompleteOwnerReset(owner.username, '111111', 'newpassword123', 'newpassword123');
      assert(false, 'Should reject incorrect OTP');
    } catch (err) {
      assert(err.message.includes('salah atau sudah tidak berlaku'), 'Rejects invalid OTP properly');
    }

    // Test 6: Reject password mismatch
    try {
      await passwordResetService.verifyAndCompleteOwnerReset(owner.username, otp, 'newpassword123', 'mismatched123');
      assert(false, 'Should reject mismatched passwords');
    } catch (err) {
      assert(err.message.includes('tidak cocok'), 'Rejects password mismatch');
    }

    // Test 7: Reject short password (< 8 chars)
    try {
      await passwordResetService.verifyAndCompleteOwnerReset(owner.username, otp, 'short', 'short');
      assert(false, 'Should reject short password');
    } catch (err) {
      assert(err.message.includes('minimal 8 karakter'), 'Enforces 8 character minimum');
    }

    // Test 8: Successful reset with correct OTP
    const oldVersion = owner.tokenVersion;
    const resetResult = await passwordResetService.verifyAndCompleteOwnerReset(
      owner.username,
      otp,
      'supersecurepassword123',
      'supersecurepassword123'
    );
    assert(resetResult.success === true, 'Successfully completed password reset');

    const updatedOwner = await prisma.user.findUnique({ where: { id: owner.id } });
    assert(updatedOwner.tokenVersion > oldVersion, 'tokenVersion incremented to revoke old sessions');
    const isNewPassValid = await bcrypt.compare('supersecurepassword123', updatedOwner.password);
    assert(isNewPassValid, 'New password hash verified via bcrypt');

    // Test 9: OTP cannot be reused
    try {
      await passwordResetService.verifyAndCompleteOwnerReset(
        owner.username,
        otp,
        'anotherpassword123',
        'anotherpassword123'
      );
      assert(false, 'Should not allow reusing consumed OTP');
    } catch (err) {
      assert(err.message.includes('salah atau sudah tidak berlaku'), 'Prevents replay attacks on used OTP');
    }

    // Reset password back to standard 'password123' and restore original telegramId
    const salt = await bcrypt.genSalt(10);
    const restoreHash = await bcrypt.hash('password123', salt);
    await prisma.user.update({
      where: { id: owner.id },
      data: {
        password: restoreHash,
        telegramId: originalTelegramId,
      },
    });

    console.log(`\n🎉 ALL ${passed}/${total} OWNER RESET TESTS PASSED!\n`);
  } catch (err) {
    console.error('\n❌ TEST RUN FAILED:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testOwnerReset();
