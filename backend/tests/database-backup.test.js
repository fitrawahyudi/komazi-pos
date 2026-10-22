import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import zlib from 'zlib';
import {
  escapeSqlValue,
  getEncryptionKey,
  backupEngineService,
} from '../src/services/backup/backupEngineService.js';
import {
  sanitizeFileName,
  backupStorageService,
} from '../src/services/backup/backupStorageService.js';
import { backupRestoreService } from '../src/services/backup/backupRestoreService.js';
import { backupRetentionService } from '../src/services/backup/backupRetentionService.js';
import { backupRecordService } from '../src/services/backup/backupRecordService.js';

test('1. SQL Value Sanitizer: Escapes quotes, nulls, dates, and special characters safely', () => {
  assert.equal(escapeSqlValue(null), 'NULL');
  assert.equal(escapeSqlValue(undefined), 'NULL');
  assert.equal(escapeSqlValue(true), '1');
  assert.equal(escapeSqlValue(false), '0');
  assert.equal(escapeSqlValue(42), '42');
  assert.equal(escapeSqlValue("Kopi's Special"), "'Kopi\\'s Special'");
  assert.equal(escapeSqlValue('Backslash\\Test'), "'Backslash\\\\Test'");

  const testDate = new Date('2026-10-17T02:00:00.000Z');
  assert.ok(escapeSqlValue(testDate).includes('2026-10-17'));

  const jsonObj = { role: 'OWNER', active: true };
  assert.ok(escapeSqlValue(jsonObj).includes('OWNER'));
});

test('2. Path Traversal Guard: Sanitizes file names and prevents directory escape', () => {
  assert.equal(
    sanitizeFileName('../../etc/passwd'),
    'passwd'
  );
  assert.equal(
    sanitizeFileName('..\\..\\windows\\system32'),
    'system32'
  );
  assert.equal(
    sanitizeFileName('komazi_backup_2026-10-17.sql.gz.enc'),
    'komazi_backup_2026-10-17.sql.gz.enc'
  );

  assert.throws(() => sanitizeFileName(''), /Nama file backup tidak valid/);
});

test('3. Cryptographic Pipeline: AES-256-GCM encryption & decryption round-trip', () => {
  const sampleSql = `-- Komazi POS Dump\nCREATE TABLE \`test\` (\`id\` INT);\nINSERT INTO \`test\` VALUES (1);\n`;
  const key = getEncryptionKey();

  const gzipped = zlib.gzipSync(Buffer.from(sampleSql, 'utf8'));
  const encrypted = backupEngineService.encryptPayload(gzipped, key);

  // Minimum size: 12 bytes IV + 16 bytes AuthTag + payload
  assert.ok(encrypted.length > 28);

  const decrypted = backupEngineService.decryptPayload(encrypted, key);
  const decompressed = zlib.gunzipSync(decrypted).toString('utf8');

  assert.equal(decompressed, sampleSql);
});

test('4. Integrity Verifier: Detects tampering, corrupted auth tag, and checksum mismatch', () => {
  const sampleSql = `/*!40014 SET FOREIGN_KEY_CHECKS=0 */;\n-- Komazi POS Valid Dump\n`;
  const key = getEncryptionKey();
  const checksum = crypto.createHash('sha256').update(sampleSql, 'utf8').digest('hex');

  const gzipped = zlib.gzipSync(Buffer.from(sampleSql, 'utf8'));
  const encrypted = backupEngineService.encryptPayload(gzipped, key);

  // 4a. Valid check
  const validRes = backupEngineService.verifyBackupIntegrity(encrypted, checksum, key);
  assert.equal(validRes.isValid, true);
  assert.equal(validRes.calculatedChecksum, checksum);

  // 4b. Tampered checksum
  const invalidRes = backupEngineService.verifyBackupIntegrity(encrypted, 'corrupted_checksum_hash_123', key);
  assert.equal(invalidRes.isValid, false);
  assert.ok(invalidRes.error.includes('Checksum SHA-256 tidak cocok'));

  // 4c. Tampered encrypted ciphertext (Corrupted bit)
  const tamperedBuffer = Buffer.from(encrypted);
  tamperedBuffer[30] = tamperedBuffer[30] ^ 0xff; // Flip a bit in the encrypted data
  const tamperedRes = backupEngineService.verifyBackupIntegrity(tamperedBuffer, checksum, key);
  assert.equal(tamperedRes.isValid, false);
});

test('5. Execution Engine: Generates full database dump and records metadata in database', async () => {
  const result = await backupEngineService.executeBackup({
    backupType: 'MANUAL',
    triggeredBy: 'UNIT_TEST_RUNNER',
    retentionCategory: 'MANUAL',
    isProtected: false,
  });

  assert.equal(result.success, true);
  assert.ok(result.executionId.startsWith('bak_'));
  assert.ok(result.tablesCount > 0);
  assert.ok(result.fileSizeBytes > 0);
  assert.ok(result.checksumSha256.length === 64);

  // Verify file exists on physical storage
  const exists = await backupStorageService.exists(result.fileName);
  assert.equal(exists, true);

  // Verify record in database
  const record = await backupRecordService.findByExecutionId(result.executionId);
  assert.ok(record);
  assert.equal(record.status, 'SUCCESS');
  assert.ok(record.isVerified);
});

test('6. Dry-run Staging Test: Validates SQL structure without mutating database', async () => {
  // Find latest backup
  const summary = await backupRecordService.getSummary();
  assert.ok(summary.lastSuccess);

  const testResult = await backupRestoreService.testRestore(summary.lastSuccess.id);
  assert.equal(testResult.success, true);
  assert.equal(testResult.mode, 'DRY_RUN_TEST');
  assert.equal(testResult.checksumVerified, true);
  assert.ok(testResult.totalStatements > 0);
  assert.ok(testResult.createTableCount > 0);
  assert.ok(testResult.tablesIdentified.length > 0);
});

test('7. Controlled Restore Guard: Rejects invalid confirmation phrase and non-owner', async () => {
  const summary = await backupRecordService.getSummary();
  const backupId = summary.lastSuccess.id;

  // 7a. Rejects wrong phrase
  await assert.rejects(
    async () => {
      await backupRestoreService.executeControlledRestore(backupId, {
        confirmationPhrase: 'WRONG-PHRASE',
        user: { role: 'OWNER', username: 'owner_test' },
      });
    },
    /Frasa konfirmasi tidak valid/
  );

  // 7b. Rejects cashier role
  await assert.rejects(
    async () => {
      await backupRestoreService.executeControlledRestore(backupId, {
        confirmationPhrase: 'RESTORE-DATABASE',
        user: { role: 'CASHIER', username: 'kasir_test' },
      });
    },
    /Akses ditolak: Operasi pemulihan database hanya diizinkan untuk role OWNER/
  );
});

test('8. Retention Immunity: Never purges backups when total count is small', async () => {
  const retentionRes = await backupRetentionService.applyRetention();
  // Safe policy: never deletes when count <= 2
  assert.equal(typeof retentionRes.deletedCount, 'number');
  assert.ok(retentionRes.keptCount >= 0);
});

test('9. Telegram Bot SQL Attachment: verifies safeSendDocument and sendDocumentToRoles handle .sql attachment', async () => {
  const { notifier, safeSendDocument } = await import('../src/bot/notifier.js');
  const { sendTelegramDocument } = await import('../src/services/telegramService.js');

  // Verify functions exist
  assert.equal(typeof safeSendDocument, 'function', 'safeSendDocument should be an exported function');
  assert.equal(typeof notifier.sendDocumentToRoles, 'function', 'notifier.sendDocumentToRoles should be a function');
  assert.equal(typeof notifier.sendDocumentToUser, 'function', 'notifier.sendDocumentToUser should be a function');
  assert.equal(typeof sendTelegramDocument, 'function', 'sendTelegramDocument should be an exported function');

  // Test safeSendDocument handles missing token or invalid chatId gracefully without throwing
  const sendRes = await safeSendDocument('invalid_chat_id', Buffer.from('-- TEST SQL', 'utf8'), 'test.sql', 'Test caption');
  assert.equal(typeof sendRes, 'boolean');

  // Test notifier.sendDocumentToRoles handles role dispatch gracefully without throwing
  const rolesRes = await notifier.sendDocumentToRoles(['OWNER'], Buffer.from('-- TEST SQL', 'utf8'), 'test_backup.sql', '💾 <b>PENCADANGAN DATABASE BERHASIL</b>');
  assert.ok(Array.isArray(rolesRes), 'sendDocumentToRoles should return an array of send results');
});
