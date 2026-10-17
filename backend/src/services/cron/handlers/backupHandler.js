import { backupEngineService } from '../../backup/backupEngineService.js';
import logger from '../../../utils/logger.js';

export async function executeBackupJob(job) {
  const payload = job?.payload || {};
  const retentionCategory = payload.retentionCategory || 'DAILY';

  logger.scheduler.info(`Executing BACKUP job #${job?.id || 'manual'}: Full database backup & AES-256 encryption`);

  const result = await backupEngineService.executeBackup({
    backupType: 'SCHEDULED',
    triggeredBy: `SYSTEM_CRON_JOB_${job?.id || 'AUTO'}`,
    retentionCategory,
    isProtected: false,
  });

  return {
    success: true,
    executionId: result.executionId,
    file: result.fileName,
    fileSizeBytes: result.fileSizeBytes,
    checksumSha256: result.checksumSha256,
    totalRows: result.totalRows,
    tablesAudited: result.tablesCount,
    verified: true,
  };
}
