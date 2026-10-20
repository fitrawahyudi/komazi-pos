import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useHrisStore } from '../../store/hrisStore';
import { useAuthStore } from '../../store/authStore';
import { RefreshCw } from 'lucide-react';

import HrisDashboardTab from './HrisDashboardTab';
import HrisStaffTab from './HrisStaffTab';
import HrisAttendanceTab from './HrisAttendanceTab';
import HrisScheduleTab from './HrisScheduleTab';
import HrisLeavesTab from './HrisLeavesTab';
import HrisPayrollTab from './HrisPayrollTab';
import HrisAuditTab from './HrisAuditTab';

export default function HrisPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const isManagerOrOwner = currentUser?.role === 'OWNER' || currentUser?.role === 'MANAGER';
  const isOwner = currentUser?.role === 'OWNER';

  const {
    overview,
    staffList,
    attendanceList,
    correctionsList,
    scheduleList,
    leaveList,
    overtimeList,
    payrollPeriods,
    selectedPeriodPayslips,
    myPayslips,
    auditLogs,
    isLoading,
    fetchOverview,
    fetchStaff,
    createStaff,
    updateStaff,
    deleteStaff,
    fetchAttendance,
    clockIn,
    clockOut,
    createManualAttendance,
    deleteAttendance,
    fetchCorrections,
    createCorrection,
    reviewCorrection,
    fetchSchedules,
    createSchedule,
    deleteSchedule,
    fetchLeaves,
    createLeave,
    updateLeaveStatus,
    deleteLeave,
    fetchOvertimes,
    createOvertime,
    reviewOvertime,
    fetchPayrollPeriods,
    createPayrollPeriod,
    calculatePayrollPeriod,
    finalizePayrollPeriod,
    publishPayrollPeriod,
    fetchPeriodPayslips,
    fetchMyPayslips,
    fetchAuditLogs,
  } = useHrisStore();

  // 1. Determine active module from URL path
  const currentTab = useMemo(() => {
    const path = location.pathname;
    if (path.includes('/hris/dashboard') || path.includes('/hris/overview')) return 'dashboard';
    if (path.includes('/hris/staff')) return 'staff';
    if (path.includes('/hris/attendance')) return 'attendance';
    if (path.includes('/hris/schedule')) return 'schedule';
    if (path.includes('/hris/leaves')) return 'leaves';
    if (path.includes('/hris/payroll')) return 'payroll';
    if (path.includes('/hris/audit')) return 'audit';
    return isManagerOrOwner ? 'dashboard' : 'attendance';
  }, [location.pathname, isManagerOrOwner]);

  // Redirect root /hris or deprecated /hris/roles to default module
  useEffect(() => {
    if (
      location.pathname === '/hris' ||
      location.pathname === '/hris/' ||
      location.pathname.includes('/hris/roles')
    ) {
      navigate(isManagerOrOwner ? '/hris/dashboard' : '/hris/attendance', { replace: true });
    }
  }, [location.pathname, isManagerOrOwner, navigate]);

  const handleTabChange = (tabKey) => {
    navigate(`/hris/${tabKey}`);
  };

  // Initial load
  useEffect(() => {
    fetchOverview();
    fetchStaff();
    fetchAttendance({ date: new Date().toISOString().split('T')[0] });
    fetchCorrections();
    fetchSchedules();
    fetchLeaves();
    fetchOvertimes();
    if (isManagerOrOwner) {
      fetchPayrollPeriods();
      fetchAuditLogs();
    }
  }, [
    fetchOverview,
    fetchStaff,
    fetchAttendance,
    fetchCorrections,
    fetchSchedules,
    fetchLeaves,
    fetchOvertimes,
    fetchPayrollPeriods,
    fetchAuditLogs,
    isManagerOrOwner,
  ]);

  // Current WIB time ticker
  const [currentTimeWib, setCurrentTimeWib] = useState(
    new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimeWib(
        new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRefreshAll = async () => {
    const tasks = [
      fetchOverview(),
      fetchStaff(),
      fetchAttendance({ date: new Date().toISOString().split('T')[0] }),
      fetchCorrections(),
      fetchSchedules(),
      fetchLeaves(),
      fetchOvertimes(),
    ];
    if (isManagerOrOwner) {
      tasks.push(fetchPayrollPeriods());
      tasks.push(fetchAuditLogs());
    }
    await Promise.all(tasks);
  };

  // Informasi tajuk halaman dinamis berdasarkan rute modul aktif
  const pageHeaderInfo = useMemo(() => {
    switch (currentTab) {
      case 'dashboard':
      case 'overview':
        return {
          title: 'Dasbor HRIS',
          badge: 'Ringkasan',
          desc: 'Statistik waktu nyata staf aktif, kehadiran hari ini, pengajuan cuti yang menunggu persetujuan, dan ringkasan siklus penggajian.',
        };
      case 'staff':
        return {
          title: 'Staf & Karyawan',
          badge: `${staffList.length} Pegawai`,
          desc: 'Kelola data identitas karyawan, peran jabatan, departemen, jenis ikatan kerja, dan konfigurasi upah.',
        };
      case 'attendance':
        return {
          title: 'Kehadiran',
          badge: 'Presensi Jam Kerja',
          desc: 'Pencatatan waktu nyata jam masuk dan pulang, kalkulasi keterlambatan, serta pengajuan koreksi presensi.',
        };
      case 'schedule':
        return {
          title: 'Jadwal Kerja',
          badge: 'Manajemen Sif',
          desc: 'Pengaturan jadwal kerja mingguan, penugasan sif staf, dan pencegahan jadwal bentrok.',
        };
      case 'leaves':
        return {
          title: 'Pengajuan Cuti & Lembur',
          badge: overview?.pendingLeaves ? `${overview.pendingLeaves} Menunggu Persetujuan` : 'Tiket Pengajuan',
          desc: 'Pengajuan cuti tahunan, izin sakit, keperluan mendesak, jam lembur, serta persetujuan berprinsip penyetuju kedua.',
        };
      case 'payroll':
        return {
          title: isManagerOrOwner ? 'Penggajian & Slip Gaji' : 'Slip Gaji Saya',
          badge: isManagerOrOwner ? 'Siklus Penggajian' : 'Layanan Mandiri Karyawan',
          desc: isManagerOrOwner
            ? 'Kalkulasi otomatis kompensasi berbasis absensi dan lembur riil, finalisasi data, dan penerbitan slip gaji resmi.'
            : 'Riwayat slip gaji resmi, rekap kehadiran kerja, tunjangan uang makan, potongan keterlambatan, dan rincian gaji bersih Anda.',
        };
      case 'audit':
        return {
          title: 'Catatan Audit',
          desc: 'Rekam jejak riwayat mutasi data karyawan, persetujuan cuti/koreksi, dan audit kepatuhan sistem.',
        };
      default:
        return {
          title: 'Sistem Informasi Sumber Daya Manusia (HRIS)',
          badge: 'HRIS POS',
          desc: 'Manajemen operasional pegawai, presensi jam kerja, penjadwalan giliran kerja, dan penggajian outlet.',
        };
    }
  }, [currentTab, staffList.length, overview?.pendingLeaves, isManagerOrOwner]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* ─────────────────────────────────────────────────────────────
          PAGE HEADER (DYNAMIC PER MODUL HRIS)
         ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-komazi-text tracking-tight">
              {pageHeaderInfo.title}
            </h1>
          </div>
          <p className="text-xs text-komazi-muted mt-1">
            {pageHeaderInfo.desc}
          </p>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          ACTIVE MODULE CONTENT
         ───────────────────────────────────────────────────────────── */}
      {(currentTab === 'dashboard' || currentTab === 'overview') && (
        <HrisDashboardTab
          overview={overview}
          currentUser={currentUser}
          isManagerOrOwner={isManagerOrOwner}
          onNavigateTab={handleTabChange}
          staffList={staffList}
        />
      )}

      {currentTab === 'staff' && (
        <HrisStaffTab
          staffList={staffList}
          currentUser={currentUser}
          isManagerOrOwner={isManagerOrOwner}
          onCreateStaff={createStaff}
          onUpdateStaff={updateStaff}
          onDeleteStaff={deleteStaff}
          onRefresh={fetchStaff}
        />
      )}

      {currentTab === 'attendance' && (
        <HrisAttendanceTab
          attendanceList={attendanceList}
          correctionsList={correctionsList}
          staffList={staffList}
          currentUser={currentUser}
          isManagerOrOwner={isManagerOrOwner}
          onClockIn={clockIn}
          onClockOut={clockOut}
          onCreateManualAttendance={createManualAttendance}
          onDeleteAttendance={deleteAttendance}
          onCreateCorrection={createCorrection}
          onReviewCorrection={reviewCorrection}
          currentTimeWib={currentTimeWib}
          onFetchAttendance={fetchAttendance}
        />
      )}

      {currentTab === 'schedule' && (
        <HrisScheduleTab
          scheduleList={scheduleList}
          staffList={staffList}
          currentUser={currentUser}
          isManagerOrOwner={isManagerOrOwner}
          onCreateSchedule={createSchedule}
          onDeleteSchedule={deleteSchedule}
        />
      )}

      {currentTab === 'leaves' && (
        <HrisLeavesTab
          leaveList={leaveList}
          overtimeList={overtimeList}
          currentUser={currentUser}
          isManagerOrOwner={isManagerOrOwner}
          onCreateLeave={createLeave}
          onUpdateLeaveStatus={updateLeaveStatus}
          onDeleteLeave={deleteLeave}
          onCreateOvertime={createOvertime}
          onReviewOvertime={reviewOvertime}
        />
      )}

      {currentTab === 'payroll' && (
        <HrisPayrollTab
          payrollPeriods={payrollPeriods}
          selectedPeriodPayslips={selectedPeriodPayslips}
          myPayslips={myPayslips}
          currentUser={currentUser}
          isManagerOrOwner={isManagerOrOwner}
          onCreatePayrollPeriod={createPayrollPeriod}
          onCalculatePayrollPeriod={calculatePayrollPeriod}
          onFinalizePayrollPeriod={finalizePayrollPeriod}
          onPublishPayrollPeriod={publishPayrollPeriod}
          onFetchPeriodPayslips={fetchPeriodPayslips}
          onFetchMyPayslips={fetchMyPayslips}
        />
      )}

      {currentTab === 'audit' && <HrisAuditTab auditLogs={auditLogs} onRefresh={fetchAuditLogs} />}
    </div>
  );
}
