import assert from 'assert';
import cron from 'node-cron';
import { startJobs } from '../src/bot/jobs.js';
import { getCronWorkerStatus } from '../src/services/cron/cronWorker.js';

async function testNoDuplicateCron() {
  console.log('======================================================');
  console.log('🧪 TESTING SINGLE CRON EXECUTION (ANTI-DUPLICATE GUARD)');
  console.log('======================================================\n');

  const scheduledTasks = [];
  const originalSchedule = cron.schedule;

  // Intercept panggilan cron.schedule
  cron.schedule = (expression, fn, options) => {
    scheduledTasks.push({ expression, options });
    return { stop: () => {}, start: () => {} };
  };

  try {
    startJobs();

    console.log(`📌 Terdeteksi ${scheduledTasks.length} jadwal statis node-cron:`);
    scheduledTasks.forEach((t, i) => {
      console.log(`  [${i + 1}] Expression: "${t.expression}", Timezone: "${t.options?.timezone || 'default'}"`);
    });

    // 1. Verifikasi tidak ada jadwal bisnis ganda (seperti laporan 22:00 atau monitoring stok 8-22)
    const hasDailyReportCron = scheduledTasks.some((t) => t.expression === '0 22 * * *');
    const hasLowStockCron = scheduledTasks.some((t) => t.expression === '0 8-22 * * *');
    const hasMorningBriefingCron = scheduledTasks.some((t) => t.expression === '0 8 * * *');
    const hasStockoutSentinelCron = scheduledTasks.some((t) => t.expression === '*/30 8-22 * * *');

    assert.strictEqual(
      hasDailyReportCron,
      false,
      'Jadwal 0 22 * * * tidak boleh didaftarkan di node-cron karena sudah dikelola CronWorker database'
    );
    assert.strictEqual(
      hasLowStockCron,
      false,
      'Jadwal 0 8-22 * * * tidak boleh didaftarkan di node-cron karena sudah dikelola CronWorker database'
    );
    assert.strictEqual(
      hasMorningBriefingCron,
      false,
      'Jadwal 0 8 * * * tidak boleh didaftarkan di node-cron karena sudah dikelola CronWorker database'
    );
    assert.strictEqual(
      hasStockoutSentinelCron,
      false,
      'Jadwal */30 8-22 * * * tidak boleh didaftarkan di node-cron karena sudah dikelola CronWorker database'
    );

    console.log('\n  ✅ Tidak ada jadwal bisnis duplikat di node-cron statis');

    // 2. Verifikasi hanya tugas pemeliharaan server runtime yang didaftarkan
    assert.strictEqual(scheduledTasks.length, 2, 'Hanya boleh ada 2 tugas pemeliharaan runtime internal');
    assert.strictEqual(scheduledTasks[0].expression, '* * * * *', 'Tugas 1: Workspace expiry (tiap menit)');
    assert.strictEqual(scheduledTasks[1].expression, '*/5 * * * *', 'Tugas 2: Approval expiry (tiap 5 menit)');
    console.log('  ✅ Hanya tugas internal runtime (workspace & approval expiry) yang aktif di node-cron');

    // 3. Verifikasi status engine CronWorker
    const workerStatus = getCronWorkerStatus();
    assert.ok(workerStatus !== undefined, 'CronWorker status harus dapat diakses');
    console.log('  ✅ Dynamic CronWorker aktif sebagai single engine utama');

    console.log('\n======================================================');
    console.log('🎉 PENGUJIAN ANTI-DUPLIKASI CRON TELEGRAM 100% LULUS');
    console.log('======================================================');
    process.exit(0);
  } finally {
    cron.schedule = originalSchedule;
  }
}

testNoDuplicateCron().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
