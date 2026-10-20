import { Router } from 'express';
import {
  getHrisOverview,
  getStaffList,
  createStaff,
  bulkCreateStaff,
  updateStaff,
  deleteStaff,
  getAttendanceList,
  clockIn,
  clockOut,
  createManualAttendance,
  deleteAttendance,
  getAttendanceCorrections,
  createAttendanceCorrection,
  reviewAttendanceCorrection,
  getScheduleList,
  createSchedule,
  deleteSchedule,
  getMyTodaySchedule,
  getMyAttendanceStatus,
  getLeaveList,
  createLeaveRequest,
  updateLeaveStatus,
  deleteLeave,
  getOvertimeList,
  createOvertimeRequest,
  reviewOvertime,
  getPayrollPeriods,
  createPayrollPeriod,
  calculatePayrollPeriod,
  finalizePayrollPeriod,
  publishPayrollPeriod,
  getPeriodPayslips,
  getMyPayslips,
  getMyPayslipDetail,
  getHrisAuditLogs,
  getRolesList,
} from '../controllers/hrisController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';

const router = Router();

// Semua rute HRIS wajib terautentikasi
router.use(authenticate);

// 1. Ringkasan HRIS Dashboard
router.get('/overview', getHrisOverview);

// 2. Data Karyawan & Staf
router.get('/staff', getStaffList);
router.post('/staff', requireRole(['OWNER', 'MANAGER']), createStaff);
router.post('/staff/bulk', requireRole(['OWNER', 'MANAGER']), bulkCreateStaff);
router.patch('/staff/:id', requireRole(['OWNER', 'MANAGER']), updateStaff);
router.delete('/staff/:id', requireRole(['OWNER']), deleteStaff);

// 3. Kehadiran & Koreksi Absensi
router.get('/attendance', getAttendanceList);
router.get('/attendance/status', getMyAttendanceStatus);
router.get('/status', getMyAttendanceStatus);
router.get('/my-attendance-status', getMyAttendanceStatus);
router.post('/attendance/clock-in', clockIn);
router.post('/attendance/clock-out', clockOut);
router.post('/clock-in', clockIn);
router.post('/clock-out', clockOut);
router.post('/attendance/manual', requireRole(['OWNER', 'MANAGER']), createManualAttendance);
router.delete('/attendance/:id', requireRole(['OWNER', 'MANAGER']), deleteAttendance);
router.get('/attendance/corrections', getAttendanceCorrections);
router.post('/attendance/corrections', createAttendanceCorrection);
router.patch('/attendance/corrections/:id', requireRole(['OWNER', 'MANAGER']), reviewAttendanceCorrection);
router.patch('/attendance/corrections/:id/review', requireRole(['OWNER', 'MANAGER']), reviewAttendanceCorrection);

// 4. Jadwal Kerja & Shift
router.get('/schedules', getScheduleList);
router.get('/my-schedule-today', getMyTodaySchedule);
router.post('/schedules', requireRole(['OWNER', 'MANAGER']), createSchedule);
router.delete('/schedules/:id', requireRole(['OWNER', 'MANAGER']), deleteSchedule);

// 5. Pengajuan Cuti (Leaves)
router.get('/leaves', getLeaveList);
router.post('/leaves', createLeaveRequest);
router.patch('/leaves/:id/status', requireRole(['OWNER', 'MANAGER']), updateLeaveStatus);
router.delete('/leaves/:id', deleteLeave);

// 6. Lembur (Overtime)
router.get('/overtimes', getOvertimeList);
router.post('/overtimes', createOvertimeRequest);
router.patch('/overtimes/:id/status', requireRole(['OWNER', 'MANAGER']), reviewOvertime);

// 7. Payroll & Slip Gaji
router.get('/payroll/periods', requireRole(['OWNER', 'MANAGER']), getPayrollPeriods);
router.post('/payroll/periods', requireRole(['OWNER']), createPayrollPeriod);
router.post('/payroll/periods/:id/calculate', requireRole(['OWNER', 'MANAGER']), calculatePayrollPeriod);
router.post('/payroll/periods/:id/finalize', requireRole(['OWNER']), finalizePayrollPeriod);
router.post('/payroll/periods/:id/publish', requireRole(['OWNER']), publishPayrollPeriod);
router.get('/payroll/periods/:id/payslips', requireRole(['OWNER']), getPeriodPayslips);
router.get('/payroll/my-payslips', getMyPayslips);
router.get('/payroll/my-payslips/:id', getMyPayslipDetail);

// 8. Audit Logs HR
router.get('/audit-logs', requireRole(['OWNER', 'MANAGER']), getHrisAuditLogs);

// 9. Peran & Hak Akses (RBAC Matrix)
router.get('/roles', getRolesList);

export default router;
