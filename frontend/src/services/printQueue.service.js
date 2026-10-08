import { PrinterService } from './printer.service';
import { toast } from '../store/toastStore';

/**
 * Print Queue & Double Print Protection (Section 70 & 71 Implementation Guide)
 * Mencegah kegagalan printer merusak transaksi dan mencegah double print
 */
class PrintQueueService {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.printedJobIds = new Set();
  }

  enqueue(receipt, options = {}) {
    const jobId = options.jobId || `${receipt.orderNumber || receipt.invoiceNo || Date.now()}_${Date.now()}`;

    // Double Print Protection: Jangan cetak jika job id yang sama sudah dicetak, kecuali forceReprint
    if (this.printedJobIds.has(jobId) && !options.forceReprint) {
      console.warn('[PrintQueue] Double print detected and suppressed for job:', jobId);
      toast.info('Struk untuk pesanan ini sudah dicetak.');
      return { success: false, duplicate: true };
    }

    const job = {
      id: jobId,
      receipt,
      attempts: 0,
      status: 'PENDING',
      createdAt: new Date(),
    };

    this.queue.push(job);
    this.processQueue();
    return { success: true, jobId };
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    const currentJob = this.queue[0];
    currentJob.status = 'PRINTING';
    currentJob.attempts += 1;

    try {
      const res = await PrinterService.print(currentJob.receipt);
      if (res && res.success) {
        currentJob.status = 'PRINTED';
        this.printedJobIds.add(currentJob.id);
        this.queue.shift(); // Remove completed job
      } else {
        throw new Error(res?.message || 'Print job failed');
      }
    } catch (err) {
      console.warn(`[PrintQueue] Error printing job ${currentJob.id}:`, err);
      currentJob.status = 'FAILED';
      currentJob.lastError = err.message;

      // Jika gagal, jangan blokir queue indefinitely, pindahkan atau beri notifikasi
      if (currentJob.attempts >= 2) {
        this.queue.shift();
        toast.warning('Pencetakan struk tertunda. Anda dapat mencetak ulang melalui riwayat transaksi.');
      }
    } finally {
      this.isProcessing = false;
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), 500);
      }
    }
  }

  hasPrinted(jobId) {
    return this.printedJobIds.has(jobId);
  }
}

export const printQueue = new PrintQueueService();
