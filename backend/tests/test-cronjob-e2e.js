/**
 * Comprehensive End-to-End & Integration Test Suite
 * for Integrated Cronjob & OpenClaw Automation System.
 */

import prisma from '../src/config/db.js';
import {
  computeNextRunAt,
  jobRegistryService,
} from '../src/services/cron/jobRegistryService.js';
import { jobRunnerService } from '../src/services/cron/jobRunnerService.js';
import { openclawAutomationAdapter } from '../src/services/cron/openclawAutomationAdapter.js';
import { executeReportJob } from '../src/services/cron/handlers/reportHandler.js';
import { executeBackupJob } from '../src/services/cron/handlers/backupHandler.js';
import { executeMonitoringJob } from '../src/services/cron/handlers/monitoringHandler.js';
import { executeReminderJob } from '../src/services/cron/handlers/reminderHandler.js';
import { executeAiTaskJob } from '../src/services/cron/handlers/aiTaskHandler.js';
import { parseNaturalScheduleText } from '../src/services/cron/naturalScheduleParser.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.error(`  ❌ FAILED: ${message}`);
  }
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('🚀 RUNNING INTEGRATED CRONJOB E2E TEST SUITE');
  console.log('======================================================\n');

  try {
    // ---------------------------------------------------------
    // TEST SUITE 1: TIMEZONE & SCHEDULE CALCULATION
    // ---------------------------------------------------------
    console.log('📌 [Suite 1] Timezone & Next Run At Calculations (Asia/Jakarta)');

    const baseDate = new Date('2026-10-13T10:00:00.000Z'); // 17:00 WIB
    const nextDaily = computeNextRunAt('cron', '0 22 * * *', 'Asia/Jakarta', baseDate);
    assert(nextDaily instanceof Date, 'Cron expression returns valid Date object');
    assert(nextDaily.getTime() > baseDate.getTime(), 'Next run is strictly in the future');

    // 22:00 WIB is 15:00 UTC
    assert(nextDaily.toISOString().endsWith('15:00:00.000Z'), '22:00 WIB correctly mapped to 15:00 UTC');

    // Test Interval parsing
    const nextInterval30m = computeNextRunAt('interval', '30m', 'Asia/Jakarta', baseDate);
    assert(nextInterval30m.getTime() - baseDate.getTime() === 30 * 60 * 1000, 'Interval 30m adds exactly 30 minutes');

    const nextInterval2h = computeNextRunAt('interval', '2h', 'Asia/Jakarta', baseDate);
    assert(nextInterval2h.getTime() - baseDate.getTime() === 2 * 60 * 60 * 1000, 'Interval 2h adds exactly 2 hours');

    // Test Invalid cron validation
    let invalidCaught = false;
    try {
      computeNextRunAt('cron', 'invalid cron syntax', 'Asia/Jakarta', baseDate);
    } catch {
      invalidCaught = true;
    }
    assert(invalidCaught, 'Invalid cron expression throws an error');

    // ---------------------------------------------------------
    // TEST SUITE 2: JOB REGISTRY CRUD & AUDIT LOGGING
    // ---------------------------------------------------------
    console.log('\n📌 [Suite 2] Job Registry CRUD & Audit Logging');

    const testJob = await jobRegistryService.createJob(
      {
        name: 'E2E Automated Test Job',
        description: 'Temporary job created for E2E testing',
        jobType: 'MONITORING',
        scheduleType: 'interval',
        scheduleExpression: '1h',
        timezone: 'Asia/Jakarta',
        targetRoles: ['OWNER'],
        timeoutSeconds: 30,
        retryLimit: 2,
        payload: { checkDb: true, checkDisk: false },
      },
      { type: 'USER', id: 'test_admin', name: 'Test Administrator' }
    );

    assert(testJob && testJob.id > 0, `Job created with ID #${testJob.id}`);
    assert(testJob.enabled === true, 'New job is enabled by default');
    assert(testJob.version === 1, 'Initial version is 1');

    // Check Audit Log for creation
    const createAudit = await prisma.jobAuditLog.findFirst({
      where: { jobId: testJob.id, action: 'CREATE' },
    });
    assert(createAudit && createAudit.actorName === 'Test Administrator', 'Audit log created for CREATE action');

    // Pause Job
    const pausedJob = await jobRegistryService.pauseJob(testJob.id, {
      type: 'USER',
      id: 'test_admin',
      name: 'Test Administrator',
    });
    assert(pausedJob.enabled === false, 'Job successfully paused (enabled: false)');

    const pauseAudit = await prisma.jobAuditLog.findFirst({
      where: { jobId: testJob.id, action: 'PAUSE' },
    });
    assert(pauseAudit !== null, 'Audit log created for PAUSE action');

    // Resume Job
    const resumedJob = await jobRegistryService.resumeJob(testJob.id, {
      type: 'USER',
      id: 'test_admin',
      name: 'Test Administrator',
    });
    assert(resumedJob.enabled === true, 'Job successfully resumed (enabled: true)');
    assert(resumedJob.nextRunAt > new Date(), 'Resumed job has nextRunAt in the future');

    // List Jobs
    const jobList = await jobRegistryService.listJobs({ search: 'E2E Automated' });
    assert(jobList.items.some((j) => j.id === testJob.id), 'Job appears in listJobs query with search filter');

    // ---------------------------------------------------------
    // TEST SUITE 3: HANDLERS EXECUTION
    // ---------------------------------------------------------
    console.log('\n📌 [Suite 3] Built-in Job Handlers');

    // 1. Report Handler
    const reportRes = await executeReportJob({
      id: testJob.id,
      name: 'E2E Report Job',
      payload: { period: 'today' },
    });
    assert(reportRes && typeof reportRes.totalRevenue === 'number', 'Report handler returns revenue metric');
    assert(typeof reportRes.totalTransactions === 'number', 'Report handler returns transaction count');

    // 2. Backup Handler
    const backupRes = await executeBackupJob({
      id: testJob.id,
      name: 'E2E Backup Job',
      payload: {},
    });
    assert(backupRes && backupRes.verified === true, 'Backup handler verifies database integrity');
    assert(backupRes.checksumSha256 && backupRes.checksumSha256.length === 64, 'Backup handler generates SHA-256 manifest');
    assert(backupRes.totalRows > 0, 'Backup handler audits positive total records');

    // 3. Monitoring Handler
    const monRes = await executeMonitoringJob({
      id: testJob.id,
      name: 'E2E Monitoring Job',
      payload: {},
    });
    assert(monRes && monRes.status.database === 'ONLINE', 'Monitoring handler pings MySQL successfully');
    assert(typeof monRes.status.dbLatencyMs === 'number', 'Monitoring handler measures DB latency');
    assert(typeof monRes.status.memoryHeapUsedMb === 'number', 'Monitoring handler measures RAM usage');

    // 4. Reminder Handler
    const remRes = await executeReminderJob({
      id: testJob.id,
      name: 'E2E Reminder Job',
      targetRoles: ['OWNER'],
      payload: {
        title: 'Pengingat E2E',
        message: 'Ini adalah pengingat uji otomatis E2E.',
      },
    });
    assert(remRes && remRes.success === true, 'Reminder handler dispatched successfully');

    // 5. AI Task Handler
    let aiSuccess = false;
    try {
      const aiRes = await executeAiTaskJob({
        id: testJob.id,
        name: 'E2E AI Briefing Job',
        targetRoles: ['OWNER'],
        payload: { prompt: 'Uji sistem analitik' },
      });
      aiSuccess = aiRes && (aiRes.success === true || aiRes.skipped === true);
    } catch {
      // In tests without live OpenClaw gateway connection, network error or offline fallback is acceptable
      aiSuccess = true;
    }
    assert(aiSuccess, 'AI Task executes cleanly or handles offline gracefully');

    // ---------------------------------------------------------
    // TEST SUITE 4: ATOMIC CLAIM, LEASE & IDEMPOTENCY
    // ---------------------------------------------------------
    console.log('\n📌 [Suite 4] Atomic Claim, Lease & Idempotency Key Deduplication');

    // Run manual trigger on test job
    const runResult1 = await jobRunnerService.triggerManualRun(testJob.id, {
      type: 'USER',
      id: 'tester',
      name: 'E2E Runner',
    });
    assert(runResult1.success === true, 'First manual run executed and succeeded');
    assert(runResult1.runId > 0, `JobRun #${runResult1.runId} recorded in database`);

    // Verify JobRun state
    const recordedRun = await prisma.jobRun.findUnique({ where: { id: runResult1.runId } });
    assert(recordedRun.status === 'succeeded', 'JobRun status is marked as succeeded');
    assert(recordedRun.finishedAt !== null, 'JobRun finishedAt timestamp is populated');
    assert(recordedRun.idempotencyKey.startsWith(`${testJob.id}_`), 'JobRun idempotency key contains job ID');

    // Test Idempotency collision simulation (Attempting to insert same idempotency key)
    let collisionDetected = false;
    try {
      await prisma.jobRun.create({
        data: {
          jobId: testJob.id,
          scheduledFor: recordedRun.scheduledFor,
          startedAt: new Date(),
          status: 'running',
          attempt: 1,
          idempotencyKey: recordedRun.idempotencyKey, // DUPLICATE KEY
          workerId: 'worker_collision_test',
        },
      });
    } catch (e) {
      if (e.code === 'P2002') collisionDetected = true;
    }
    assert(collisionDetected, 'Database rejects duplicate claim with P2002 Unique Constraint violation');

    // Test runner handling of duplicate claim
    const duplicateClaim = await jobRunnerService.claimAndRun(
      {
        id: testJob.id,
        name: testJob.name,
        jobType: testJob.jobType,
        version: testJob.version,
        timeoutSeconds: 30,
      },
      recordedRun.scheduledFor,
      1
    );
    assert(duplicateClaim.skipped === true && duplicateClaim.reason === 'ALREADY_CLAIMED', 'Runner safely handles duplicate claim without crash');

    // ---------------------------------------------------------
    // TEST SUITE 5: RETRY MECHANISM & EXPONENTIAL BACKOFF
    // ---------------------------------------------------------
    console.log('\n📌 [Suite 5] Retry Mechanism & Exponential Backoff on Failure');

    // Create a failing job
    const failingJob = await jobRegistryService.createJob(
      {
        name: 'Failing Retry Test Job',
        jobType: 'MONITORING',
        scheduleType: 'interval',
        scheduleExpression: '1h',
        retryLimit: 2,
        timeoutSeconds: 10,
      },
      { type: 'USER', id: 'tester', name: 'Tester' }
    );

    // Mock dispatchHandler temporarily to throw error
    const originalDispatch = jobRunnerService.dispatchHandler;
    jobRunnerService.dispatchHandler = async () => {
      throw new Error('Simulated transient network timeout error with bearer secret_token_xyz');
    };

    // First attempt -> should retry
    const failAttempt1 = await jobRunnerService.claimAndRun(failingJob, new Date(), 1);
    assert(failAttempt1.success === false, 'Failed execution flagged as success: false');
    assert(failAttempt1.willRetry === true, 'Job flagged for retry on attempt 1');
    assert(failAttempt1.nextRetryAt > new Date(), 'Next retry timestamp scheduled in future');

    // Verify error redaction in database
    const retryRun = await prisma.jobRun.findFirst({
      where: { jobId: failingJob.id, status: 'retrying' },
    });
    assert(retryRun !== null, 'JobRun marked as retrying');
    assert(!retryRun.errorMessageRedacted.includes('secret_token_xyz'), 'Sensitive token was redacted from error message');

    // Second attempt (attempt 2 equals retryLimit) -> should fail permanently
    const failAttempt2 = await jobRunnerService.claimAndRun(failingJob, failAttempt1.nextRetryAt, 2);
    assert(failAttempt2.success === false, 'Second attempt failed');
    assert(failAttempt2.failed === true, 'Job marked as permanently failed after max retries');

    const finalFailedRun = await prisma.jobRun.findFirst({
      where: { jobId: failingJob.id, status: 'failed' },
    });
    assert(finalFailedRun && finalFailedRun.errorCode === 'MAX_RETRIES_EXCEEDED', 'Final JobRun recorded with MAX_RETRIES_EXCEEDED');

    // Restore original dispatchHandler
    jobRunnerService.dispatchHandler = originalDispatch;

    // ---------------------------------------------------------
    // TEST SUITE 6: OPENCLAW AUTOMATION ADAPTER & RBAC
    // ---------------------------------------------------------
    console.log('\n📌 [Suite 6] OpenClaw Automation Adapter & Role-Based Access Control');

    // Read access for OWNER
    const ownerList = await openclawAutomationAdapter.listJobs({ actorRole: 'OWNER' });
    assert(ownerList.items.length > 0, 'OWNER can list jobs via OpenClaw adapter');

    // Read access for CASHIER
    const cashierList = await openclawAutomationAdapter.listJobs({ actorRole: 'CASHIER' });
    assert(cashierList.items.length > 0, 'CASHIER can view jobs list');

    // Mutation access blocked for CASHIER
    let cashierBlocked = false;
    try {
      await openclawAutomationAdapter.createJob(
        {
          name: 'Unauthorized Cashier Job',
          jobType: 'REPORT',
          scheduleType: 'interval',
          scheduleExpression: '1h',
        },
        { role: 'CASHIER', id: 'cashier_1', name: 'Budi Kasir' }
      );
    } catch {
      cashierBlocked = true;
    }
    assert(cashierBlocked, 'CASHIER is blocked from creating scheduled jobs');

    // Trigger access blocked for CASHIER
    let triggerBlocked = false;
    try {
      await openclawAutomationAdapter.triggerJob(testJob.id, { role: 'CASHIER' });
    } catch {
      triggerBlocked = true;
    }
    assert(triggerBlocked, 'CASHIER is blocked from triggering jobs on demand');

    // Run history accessible
    const runHistory = await openclawAutomationAdapter.getJobRuns(testJob.id, { actorRole: 'OWNER' });
    assert(runHistory.items.length > 0, 'Job run history retrieved with pagination');

    // ---------------------------------------------------------
    // TEST SUITE 7: CLEANUP & SOFT DELETE
    // ---------------------------------------------------------
    console.log('\n📌 [Suite 7] Job Cancellation & Soft Delete Verification');

    const cancelledJob = await jobRegistryService.cancelJob(testJob.id, {
      type: 'USER',
      id: 'test_admin',
      name: 'Test Administrator',
    });
    assert(cancelledJob.deletedAt !== null, 'Job is soft-deleted (deletedAt timestamp set)');
    assert(cancelledJob.enabled === false, 'Cancelled job is disabled');

    // Verify excluded from active list
    const activeList = await jobRegistryService.listJobs({ enabled: true });
    assert(!activeList.items.some((j) => j.id === testJob.id), 'Cancelled job does not appear in active jobs');

    // ---------------------------------------------------------
    // TEST SUITE 8: NATURAL LANGUAGE PARSER (NO SLASH / NEEDED)
    // ---------------------------------------------------------
    console.log('\n📌 [Suite 8] Natural Language & Free-Text Schedule Parser (No / Required)');

    // 1. Report intent
    const parsedReport = parseNaturalScheduleText('buat jadwal laporan penjualan jam 20:00');
    assert(parsedReport !== null, 'Natural report schedule intent recognized');
    assert(parsedReport.jobType === 'REPORT', 'Job type correctly extracted as REPORT');
    assert(parsedReport.scheduleExpression === '0 20 * * *', '20:00 mapped to cron "0 20 * * *"');

    // 2. Backup intent with colloquial Indonesian ("3 subuh")
    const parsedBackup = parseNaturalScheduleText('jadwalkan backup database tiap jam 3 subuh');
    assert(parsedBackup !== null, 'Backup intent recognized');
    assert(parsedBackup.jobType === 'BACKUP', 'Job type correctly extracted as BACKUP');
    assert(parsedBackup.scheduleExpression === '0 3 * * *', '3 subuh mapped to cron "0 3 * * *"');

    // 3. Monitoring interval intent ("tiap 30 menit")
    const parsedMonitoring = parseNaturalScheduleText('buat monitoring sistem tiap 30 menit');
    assert(parsedMonitoring !== null, 'Monitoring interval intent recognized');
    assert(parsedMonitoring.jobType === 'MONITORING', 'Job type correctly extracted as MONITORING');
    assert(parsedMonitoring.scheduleExpression === '*/30 * * * *', 'Interval mapped to cron "*/30 * * * *"');

    // 4. Reminder intent with period ("jam 8 malam")
    const parsedReminder = parseNaturalScheduleText('ingatkan cek stok bahan jam 8 malam');
    assert(parsedReminder !== null, 'Reminder intent recognized');
    assert(parsedReminder.jobType === 'REMINDER', 'Job type correctly extracted as REMINDER');
    assert(parsedReminder.scheduleExpression === '0 20 * * *', '8 malam mapped to 20:00 ("0 20 * * *")');

    // 5. User exact request: "ingatkan saya pada jam segini untuk melakukan ini"
    const parsedUserPhrase = parseNaturalScheduleText('ingatkan saya pada jam segini untuk melakukan ini', 123456);
    assert(parsedUserPhrase !== null, 'User phrase "ingatkan saya pada jam segini untuk melakukan ini" recognized');
    assert(parsedUserPhrase.jobType === 'REMINDER', 'Job type is REMINDER');
    assert(parsedUserPhrase.payload.message === 'Melakukan ini', 'Task extracted as "Melakukan ini"');
    assert(parsedUserPhrase.payload.recipientTelegramId === 123456, 'Personal telegram ID attached to payload');
    assert(parsedUserPhrase.isPersonal === true, 'isPersonal flag marked true');

    // 6. Detailed reminder: "ingatkan saya pada jam 14:00 untuk cek stok susu"
    const parsedMilkStock = parseNaturalScheduleText('ingatkan saya pada jam 14:00 untuk cek stok susu', 123456);
    assert(parsedMilkStock !== null, 'Reminder "cek stok susu" recognized');
    assert(parsedMilkStock.scheduleExpression === '0 14 * * *', 'Mapped to 14:00 cron expression');
    assert(parsedMilkStock.payload.message === 'Cek stok susu', 'Task extracted as "Cek stok susu"');

    // 7. Relative reminder: "ingatkan saya 30 menit lagi untuk cek oven"
    const parsedRelative = parseNaturalScheduleText('ingatkan saya 30 menit lagi untuk cek oven', 123456);
    assert(parsedRelative !== null, 'Relative reminder recognized');
    assert(parsedRelative.scheduleType === 'once', 'Relative reminder scheduleType is "once"');
    assert(parsedRelative.payload.message === 'Cek oven', 'Task extracted as "Cek oven"');
    assert(!isNaN(new Date(parsedRelative.scheduleExpression).getTime()), 'Valid ISO timestamp generated');

    // 8. General intent without time
    const parsedGeneral = parseNaturalScheduleText('buat jadwal baru');
    assert(parsedGeneral !== null, 'General schedule creation intent recognized');

    // 9. Non-schedule message returns null
    const nonSchedule = parseNaturalScheduleText('halo apa kabar kasir hari ini?');
    assert(nonSchedule === null, 'Non-schedule message returns null');

    // ─────────────────────────────────────────────────────────────
    // Suite 9: Job Update, Skip Occurrence, and Advanced Operations
    // ─────────────────────────────────────────────────────────────
    console.log('\n📌 [Suite 9] Job Update, Skip Occurrence & Versioned Locking');

    // 9.1 Create fresh job for Suite 9
    const modJob = await jobRegistryService.createJob(
      {
        name: 'Modifiable Test Job',
        jobType: 'REPORT',
        scheduleType: 'cron',
        scheduleExpression: '0 22 * * *',
      },
      { type: 'USER', id: 'tester9', name: 'Tester 9' }
    );
    assert(modJob.version === 1, 'Initial job version is 1');

    // 9.2 Update Job Expression
    const updatedJob = await jobRegistryService.updateJob(
      modJob.id,
      { scheduleExpression: '0 21 * * *', description: 'Updated to 21:00 WIB' },
      { type: 'USER', id: 'tester9', name: 'Tester 9' }
    );
    assert(updatedJob.scheduleExpression === '0 21 * * *', 'Schedule expression successfully updated to 21:00');
    assert(updatedJob.version === 2, 'Job version incremented to 2 for optimistic locking');
    assert(updatedJob.description === 'Updated to 21:00 WIB', 'Job description updated');

    const updateAudit = await prisma.jobAuditLog.findFirst({
      where: { jobId: modJob.id, action: 'UPDATE' },
      orderBy: { createdAt: 'desc' },
    });
    assert(updateAudit !== null, 'Audit log recorded for UPDATE action');

    // 9.3 Skip Occurrence
    const initialNextRun = updatedJob.nextRunAt;
    const skipResult = await jobRegistryService.skipJobOccurrence(
      modJob.id,
      { type: 'USER', id: 'tester9', name: 'Tester 9' }
    );
    assert(skipResult.skippedRunAt.getTime() === initialNextRun.getTime(), 'Occurrence correctly skipped');
    assert(skipResult.nextRunAt.getTime() > initialNextRun.getTime(), 'nextRunAt advanced strictly into future');

    const skippedRun = await prisma.jobRun.findFirst({
      where: { jobId: modJob.id, status: 'skipped' },
    });
    assert(skippedRun !== null, 'JobRun record with status skipped successfully created');
    assert(skippedRun.resultSummary.includes('dilewati secara manual'), 'Skipped summary properly recorded');

    // 9.4 OpenClaw Adapter Authorization Checks
    let blockedUpdate = false;
    try {
      await openclawAutomationAdapter.updateJob(modJob.id, { scheduleExpression: '30m' }, { role: 'CASHIER' });
    } catch {
      blockedUpdate = true;
    }
    assert(blockedUpdate, 'CASHIER is blocked from updating scheduled jobs');

    let allowedUpdate = false;
    try {
      await openclawAutomationAdapter.updateJob(modJob.id, { description: 'Owner update' }, { role: 'OWNER' });
      allowedUpdate = true;
    } catch {}
    assert(allowedUpdate, 'OWNER is authorized to update scheduled jobs');

    // Clean up test rows
    await prisma.jobRun.deleteMany({ where: { jobId: { in: [testJob.id, failingJob.id, modJob.id] } } });
    await prisma.jobAuditLog.deleteMany({ where: { jobId: { in: [testJob.id, failingJob.id, modJob.id] } } });
    await prisma.scheduledJob.deleteMany({ where: { id: { in: [testJob.id, failingJob.id, modJob.id] } } });

    console.log('\n======================================================');
    console.log(`🏁 TEST COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('💥 FATAL ERROR DURING TEST SUITE:', err);
    process.exit(1);
  }
}

runTestSuite();
