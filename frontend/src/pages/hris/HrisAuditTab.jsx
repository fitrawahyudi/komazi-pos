import React, { useState, useMemo } from 'react';
import { ShieldCheck, History, Filter, Search, Calendar, User } from 'lucide-react';
import Pagination from '../../components/ui/Pagination';

export default function HrisAuditTab({ auditLogs = [], onRefresh }) {
  const [entityFilter, setEntityFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const matchEntity = entityFilter === 'ALL' || log.entityType === entityFilter;
      const matchSearch =
        !search ||
        log.action.toLowerCase().includes(search.toLowerCase()) ||
        (log.user?.name && log.user.name.toLowerCase().includes(search.toLowerCase())) ||
        (log.details && log.details.toLowerCase().includes(search.toLowerCase()));

      return matchEntity && matchSearch;
    });
  }, [auditLogs, entityFilter, search]);

  const paginatedLogs = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredLogs.slice(start, start + perPage);
  }, [filteredLogs, page, perPage]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header & Controls */}
      <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-sm text-komazi-text flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-komazi-coral" />
            <span>Catatan Audit &amp; Rekam Jejak Keamanan HRIS</span>
          </h3>
          <p className="text-[11px] text-komazi-muted">
            Pencatatan kepatuhan hukum untuk tindakan pembuatan staf, persetujuan cuti/lembur, dan penggajian
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Entity Filter */}
          <select
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none cursor-pointer"
          >
            <option value="ALL">Semua</option>
            <option value="STAFF">Staf &amp; Karyawan</option>
            <option value="ATTENDANCE">Presensi &amp; Koreksi</option>
            <option value="LEAVE">Cuti &amp; Izin</option>
            <option value="OVERTIME">Lembur</option>
            <option value="PAYROLL">Penggajian &amp; Slip</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-komazi-surface-2 border-b border-komazi-border text-komazi-muted font-bold">
              <tr>
                <th className="py-3 px-4">Waktu Server</th>
                <th className="py-3 px-4">Pengguna (Aktor)</th>
                <th className="py-3 px-4">Tindakan</th>
                <th className="py-3 px-4">Entitas Terkait</th>
                <th className="py-3 px-4">Rincian Perubahan</th>
                <th className="py-3 px-4 text-right">Alamat IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-komazi-border font-mono text-[11px]">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-komazi-muted font-sans">
                    <History className="w-8 h-8 mx-auto opacity-30 mb-2" />
                    <p>Belum ada catatan aktivitas audit yang terekam</p>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const time = new Date(log.createdAt).toLocaleString('id-ID', {
                    dateStyle: 'short',
                    timeStyle: 'medium',
                  });

                  return (
                    <tr key={log.id} className="hover:bg-komazi-surface-2/60 transition-colors">
                      <td className="py-3 px-4 text-komazi-muted whitespace-nowrap">{time}</td>
                      <td className="py-3 px-4 font-sans">
                        <div className="font-bold text-komazi-text">{log.user?.name || `User #${log.userId}`}</div>
                        <div className="text-[10px] text-komazi-muted">{log.user?.role}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-komazi-coral/15 text-komazi-coral border border-komazi-coral/30 font-bold text-[10px]">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-komazi-text font-semibold">
                        {log.entityType} #{log.entityId}
                      </td>
                      <td className="py-3 px-4 text-komazi-muted max-w-xs truncate" title={log.details}>
                        {log.details || '—'}
                      </td>
                      <td className="py-3 px-4 text-right text-komazi-muted">{log.ipAddress || 'Internal'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filteredLogs.length > 0 && (
          <div className="p-3 border-t border-komazi-border">
            <Pagination
              currentPage={page}
              totalItems={filteredLogs.length}
              itemsPerPage={perPage}
              onPageChange={setPage}
              onItemsPerPageChange={(newLimit) => {
                setPerPage(newLimit);
                setPage(1);
              }}
              itemLabel="catatan audit"
            />
          </div>
        )}
      </div>
    </div>
  );
}
