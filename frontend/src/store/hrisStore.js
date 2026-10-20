import { create } from 'zustand';
import { api } from '../services/api';
import { toast } from './toastStore';

export const useHrisStore = create((set, get) => ({
  overview: null,
  staffList: [],
  attendanceList: [],
  correctionsList: [],
  scheduleList: [],
  myTodaySchedule: null,
  leaveList: [],
  overtimeList: [],
  payrollPeriods: [],
  selectedPeriodPayslips: [],
  myPayslips: [],
  auditLogs: [],
  rolesList: [],
  isLoading: false,

  // 1. Overview
  fetchOverview: async () => {
    try {
      const res = await api.hris.getOverview();
      if (res && res.success) {
        set({ overview: res.data });
      }
    } catch (err) {
      console.error('[HrisStore] Error fetching overview:', err);
    }
  },

  // 2. Staff Management
  fetchStaff: async () => {
    try {
      set({ isLoading: true });
      const res = await api.hris.getStaff();
      if (res && res.success) {
        set({ staffList: res.data || [], isLoading: false });
        return res.data;
      }
    } catch (err) {
      console.error('[HrisStore] Error fetching staff:', err);
    } finally {
      set({ isLoading: false });
    }
    return [];
  },

  createStaff: async (data) => {
    try {
      const res = await api.hris.createStaff(data);
      if (res && res.success) {
        toast.success(`Staf "${res.data.name}" berhasil ditambahkan`);
        await get().fetchStaff();
        get().fetchOverview();
        return res.data;
      } else {
        toast.error(res?.message || 'Gagal menambahkan staf');
      }
    } catch (err) {
      toast.error(err.message || 'Gagal menambahkan staf');
    }
    return null;
  },

  updateStaff: async (id, data) => {
    try {
      const res = await api.hris.updateStaff(id, data);
      if (res && res.success) {
        toast.success('Data staf berhasil diperbarui');
        set((state) => ({
          staffList: state.staffList.map((s) => (s.id === id ? { ...s, ...res.data } : s)),
        }));
        return res.data;
      } else {
        toast.error(res?.message || 'Gagal memperbarui staf');
      }
    } catch (err) {
      toast.error(err.message || 'Gagal memperbarui staf');
    }
    return null;
  },

  deleteStaff: async (id) => {
    try {
      const res = await api.hris.deleteStaff(id);
      if (res && res.success) {
        toast.success(res.message || 'Akun staf berhasil dihapus');
        if (res.data?.isHardDeleted) {
          set((state) => ({
            staffList: state.staffList.filter((s) => s.id !== id),
          }));
        } else {
          set((state) => ({
            staffList: state.staffList.map((s) => (s.id === id ? { ...s, isActive: false } : s)),
          }));
        }
        get().fetchOverview();
        return true;
      } else {
        toast.error(res?.message || 'Gagal menghapus staf');
      }
    } catch (err) {
      toast.error(err.message || 'Gagal menghapus staf');
    }
    return false;
  },

  // 3. Attendance
  myTodayAttendance: null,
  fetchTodayAttendance: async (currentUserId) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await api.hris.getAttendance({ date: today });
      if (res && res.success && Array.isArray(res.data)) {
        const found = res.data.find((a) => !currentUserId || a.userId === currentUserId);
        if (found) {
          set({ myTodayAttendance: found });
        }
        return found || null;
      }
    } catch (err) {
      console.error('[HrisStore] Error fetching today attendance:', err);
    }
    return null;
  },

  fetchAttendance: async (params = {}) => {
    try {
      set({ isLoading: true });
      const res = await api.hris.getAttendance(params);
      if (res && res.success) {
        const list = res.data || [];
        set({ attendanceList: list, isLoading: false });
        return list;
      }
    } catch (err) {
      console.error('[HrisStore] Error fetching attendance:', err);
    } finally {
      set({ isLoading: false });
    }
    return [];
  },

  clockIn: async (data = {}) => {
    try {
      const res = await api.hris.clockIn(data);
      if (res && res.success) {
        toast.success('Presensi Clock-In berhasil dicatat!');
        set({ myTodayAttendance: res.data });
        get().fetchStaff();
        get().fetchOverview();
        get().fetchMyTodaySchedule?.();
        return res.data;
      } else {
        const errorMsg = res?.message || 'Gagal Clock-In';
        toast.error(errorMsg);
        const err = new Error(errorMsg);
        err.errors = res?.errors;
        err.status = res?.status;
        throw err;
      }
    } catch (err) {
      if (!err.errors && !err.status) {
        toast.error(err.message || 'Gagal Clock-In');
      }
      throw err;
    }
  },

  clockOut: async (data = {}) => {
    try {
      const res = await api.hris.clockOut(data);
      if (res && res.success) {
        toast.success('Presensi Clock-Out berhasil dicatat!');
        set({ myTodayAttendance: res.data });
        get().fetchStaff();
        get().fetchOverview();
        get().fetchMyTodaySchedule?.();
        return res.data;
      } else {
        const errorMsg = res?.message || 'Gagal Clock-Out';
        toast.error(errorMsg);
        const err = new Error(errorMsg);
        err.errors = res?.errors;
        err.code = res?.errors?.code;
        err.status = res?.status;
        throw err;
      }
    } catch (err) {
      if (!err.errors && !err.status) {
        toast.error(err.message || 'Gagal Clock-Out');
      }
      throw err;
    }
  },

  createManualAttendance: async (data) => {
    try {
      const res = await api.hris.createManualAttendance(data);
      if (res && res.success) {
        toast.success('Kehadiran manual berhasil disimpan');
        get().fetchOverview();
        return res.data;
      } else {
        toast.error(res?.message || 'Gagal menyimpan kehadiran');
      }
    } catch (err) {
      toast.error(err.message || 'Gagal menyimpan kehadiran');
    }
    return null;
  },

  deleteAttendance: async (id) => {
    try {
      const res = await api.hris.deleteAttendance(id);
      if (res && res.success) {
        toast.success('Catatan presensi berhasil dihapus');
        set((state) => ({
          attendanceList: state.attendanceList.filter((a) => a.id !== id),
        }));
        get().fetchOverview();
        return true;
      } else {
        toast.error(res?.message || 'Gagal menghapus presensi');
      }
    } catch (err) {
      toast.error(err.message || 'Gagal menghapus presensi');
    }
    return false;
  },

  // 4. Attendance Corrections
  fetchCorrections: async () => {
    try {
      const res = await api.hris.getAttendanceCorrections();
      if (res && res.success) {
        set({ correctionsList: res.data || [] });
        return res.data;
      }
    } catch (err) {
      console.error('[HrisStore] Error fetching corrections:', err);
    }
    return [];
  },

  createCorrection: async (data) => {
    try {
      const res = await api.hris.createAttendanceCorrection(data);
      if (res && res.success) {
        toast.success('Permohonan koreksi absensi berhasil diajukan');
        get().fetchCorrections();
        get().fetchOverview();
        return res.data;
      } else {
        toast.error(res?.message || 'Gagal mengajukan koreksi');
      }
    } catch (err) {
      toast.error(err.message || 'Gagal mengajukan koreksi');
    }
    return null;
  },

  reviewCorrection: async (id, data) => {
    try {
      const res = await api.hris.reviewAttendanceCorrection(id, data);
      if (res && res.success) {
        toast.success(res.message || 'Koreksi absensi berhasil ditinjau');
        get().fetchCorrections();
        get().fetchAttendance();
        get().fetchOverview();
        return res.data;
      } else {
        toast.error(res?.message || 'Gagal memproses koreksi');
      }
    } catch (err) {
      toast.error(err.message || 'Gagal memproses koreksi');
    }
    return null;
  },

  fetchSchedules: async (params = {}) => {
    try {
      set({ isLoading: true });
      const res = await api.hris.getSchedules(params);
      if (res && res.success) {
        set({ scheduleList: res.data || [], isLoading: false });
        return res.data;
      }
    } catch (err) {
      console.error('[HrisStore] Error fetching schedules:', err);
    } finally {
      set({ isLoading: false });
    }
    return [];
  },

  fetchMyTodaySchedule: async () => {
    try {
      const res = await api.hris.getMyTodaySchedule();
      if (res && res.success) {
        set({ myTodaySchedule: res.data });
        return res.data;
      }
    } catch (err) {
      console.error('[HrisStore] Error fetching my today schedule:', err);
    }
    return null;
  },

  createSchedule: async (data) => {
    try {
      const res = await api.hris.createSchedule(data);
      if (res && res.success) {
        toast.success('Jadwal kerja berhasil ditambahkan');
        get().fetchSchedules();
        get().fetchOverview();
        return res.data;
      } else {
        toast.error(res?.message || 'Gagal menambahkan jadwal');
      }
    } catch (err) {
      toast.error(err.message || 'Gagal menambahkan jadwal');
    }
    return null;
  },

  deleteSchedule: async (id) => {
    try {
      const res = await api.hris.deleteSchedule(id);
      if (res && res.success) {
        toast.success('Jadwal kerja berhasil dihapus');
        set((state) => ({
          scheduleList: state.scheduleList.filter((s) => s.id !== id),
        }));
        get().fetchOverview();
        return true;
      } else {
        toast.error(res?.message || 'Gagal menghapus jadwal');
      }
    } catch (err) {
      toast.error(err.message || 'Gagal menghapus jadwal');
    }
    return false;
  },

  // 6. Leaves
  fetchLeaves: async (params = {}) => {
    try {
      set({ isLoading: true });
      const res = await api.hris.getLeaves(params);
      if (res && res.success) {
        set({ leaveList: res.data || [], isLoading: false });
        return res.data;
      }
    } catch (err) {
      console.error('[HrisStore] Error fetching leaves:', err);
    } finally {
      set({ isLoading: false });
    }
    return [];
  },

  createLeave: async (data) => {
    try {
      const res = await api.hris.createLeave(data);
      if (res && res.success) {
        toast.success('Pengajuan cuti berhasil dikirim');
        get().fetchLeaves();
        get().fetchOverview();
        return res.data;
      } else {
        toast.error(res?.message || 'Gagal mengajukan cuti');
      }
    } catch (err) {
      toast.error(err.message || 'Gagal mengajukan cuti');
    }
    return null;
  },

  updateLeaveStatus: async (id, data) => {
    try {
      const res = await api.hris.updateLeaveStatus(id, data);
      if (res && res.success) {
        toast.success('Status pengajuan cuti berhasil diperbarui');
        get().fetchLeaves();
        get().fetchOverview();
        return res.data;
      } else {
        toast.error(res?.message || 'Gagal memperbarui status cuti');
      }
    } catch (err) {
      toast.error(err.message || 'Gagal memperbarui status cuti');
    }
    return null;
  },

  deleteLeave: async (id) => {
    try {
      const res = await api.hris.deleteLeave(id);
      if (res && res.success) {
        toast.success('Pengajuan cuti berhasil dibatalkan');
        set((state) => ({
          leaveList: state.leaveList.filter((l) => l.id !== id),
        }));
        get().fetchOverview();
        return true;
      } else {
        toast.error(res?.message || 'Gagal membatalkan cuti');
      }
    } catch (err) {
      toast.error(err.message || 'Gagal membatalkan cuti');
    }
    return false;
  },

  // 7. Overtime
  fetchOvertimes: async () => {
    try {
      const res = await api.hris.getOvertimes();
      if (res && res.success) {
        set({ overtimeList: res.data || [] });
        return res.data;
      }
    } catch (err) {
      console.error('[HrisStore] Error fetching overtimes:', err);
    }
    return [];
  },

  createOvertime: async (data) => {
    try {
      const res = await api.hris.createOvertime(data);
      if (res && res.success) {
        toast.success('Pengajuan lembur berhasil dikirim');
        get().fetchOvertimes();
        get().fetchOverview();
        return res.data;
      } else {
        toast.error(res?.message || 'Gagal mengajukan lembur');
      }
    } catch (err) {
      toast.error(err.message || 'Gagal mengajukan lembur');
    }
    return null;
  },

  reviewOvertime: async (id, data) => {
    try {
      const res = await api.hris.reviewOvertime(id, data);
      if (res && res.success) {
        toast.success(res.message || 'Pengajuan lembur berhasil ditinjau');
        get().fetchOvertimes();
        get().fetchOverview();
        return res.data;
      } else {
        toast.error(res?.message || 'Gagal meninjau lembur');
      }
    } catch (err) {
      toast.error(err.message || 'Gagal meninjau lembur');
    }
    return null;
  },

  // 8. Payroll
  fetchPayrollPeriods: async () => {
    try {
      const res = await api.hris.getPayrollPeriods();
      if (res && res.success) {
        set({ payrollPeriods: res.data || [] });
        return res.data;
      }
    } catch (err) {
      console.error('[HrisStore] Error fetching payroll periods:', err);
    }
    return [];
  },

  createPayrollPeriod: async (data) => {
    try {
      const res = await api.hris.createPayrollPeriod(data);
      if (res && res.success) {
        toast.success('Periode payroll berhasil dibuat');
        get().fetchPayrollPeriods();
        get().fetchOverview();
        return res.data;
      } else {
        toast.error(res?.message || 'Gagal membuat periode payroll');
      }
    } catch (err) {
      toast.error(err.message || 'Gagal membuat periode payroll');
    }
    return null;
  },

  calculatePayrollPeriod: async (id) => {
    try {
      const res = await api.hris.calculatePayrollPeriod(id);
      if (res && res.success) {
        toast.success('Kalkulasi payroll berhasil diselesaikan');
        get().fetchPayrollPeriods();
        get().fetchPeriodPayslips(id);
        get().fetchOverview();
        return res.data;
      } else {
        toast.error(res?.message || 'Gagal menghitung payroll');
      }
    } catch (err) {
      toast.error(err.message || 'Gagal menghitung payroll');
    }
    return null;
  },

  finalizePayrollPeriod: async (id) => {
    try {
      const res = await api.hris.finalizePayrollPeriod(id);
      if (res && res.success) {
        toast.success('Periode payroll berhasil difinalisasi');
        get().fetchPayrollPeriods();
        get().fetchOverview();
        return res.data;
      } else {
        toast.error(res?.message || 'Gagal memfinalisasi payroll');
      }
    } catch (err) {
      toast.error(err.message || 'Gagal memfinalisasi payroll');
    }
    return null;
  },

  publishPayrollPeriod: async (id) => {
    try {
      const res = await api.hris.publishPayrollPeriod(id);
      if (res && res.success) {
        toast.success('Slip gaji berhasil dipublikasikan untuk seluruh staf');
        get().fetchPayrollPeriods();
        get().fetchOverview();
        return res.data;
      } else {
        toast.error(res?.message || 'Gagal mempublikasikan slip gaji');
      }
    } catch (err) {
      toast.error(err.message || 'Gagal mempublikasikan slip gaji');
    }
    return null;
  },

  fetchPeriodPayslips: async (periodId) => {
    try {
      const res = await api.hris.getPeriodPayslips(periodId);
      if (res && res.success) {
        set({ selectedPeriodPayslips: res.data || [] });
        return res.data;
      }
    } catch (err) {
      console.error('[HrisStore] Error fetching period payslips:', err);
    }
    return [];
  },

  fetchMyPayslips: async () => {
    try {
      const res = await api.hris.getMyPayslips();
      if (res && res.success) {
        set({ myPayslips: res.data || [] });
        return res.data;
      }
    } catch (err) {
      console.error('[HrisStore] Error fetching my payslips:', err);
    }
    return [];
  },

  // 9. Audit Logs & Roles
  fetchAuditLogs: async (params = {}) => {
    try {
      const res = await api.hris.getAuditLogs(params);
      if (res && res.success) {
        set({ auditLogs: res.data || [] });
        return res.data;
      }
    } catch (err) {
      console.error('[HrisStore] Error fetching audit logs:', err);
    }
    return [];
  },

  fetchRoles: async () => {
    try {
      const res = await api.hris.getRoles();
      if (res && res.success) {
        set({ rolesList: res.data || [] });
      }
    } catch (err) {
      console.error('[HrisStore] Error fetching roles:', err);
    }
  },
}));
