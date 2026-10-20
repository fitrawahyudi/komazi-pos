import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
  Phone,
  Briefcase,
  Coins,
  ShieldCheck,
  Calendar,
  X,
  Check,
  AlertCircle,
  Clock,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  FileSpreadsheet,
} from 'lucide-react';
import Pagination from '../../components/ui/Pagination';
import AlertModal from '../../components/ui/AlertModal';
import OwnerResetPasswordModal from '../../components/auth/OwnerResetPasswordModal';
import ExcelImportModal from '../../components/common/ExcelImportModal';
import { formatRupiah } from '../../utils/format';
import { toast } from '../../store/toastStore';

export default function HrisStaffTab({
  staffList = [],
  currentUser,
  isManagerOrOwner,
  onCreateStaff,
  onUpdateStaff,
  onDeleteStaff,
  onRefresh,
}) {
  const isOwner = currentUser?.role === 'OWNER';

  const [staffForReset, setStaffForReset] = useState(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffToDelete, setStaffToDelete] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [usernameManuallyEdited, setUsernameManuallyEdited] = useState(false);

  const [form, setForm] = useState({
    name: '',
    username: '',
    password: '',
    role: 'CASHIER',
    phone: '',
    department: 'Operasional',
    jobTitle: '',
    employmentType: 'FULL_TIME',
    joinDate: new Date().toISOString().split('T')[0],
    baseSalary: 0,
    dailyAllowance: 0,
    hourlyOvertimeRate: 0,
    isActive: true,
  });

  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      const matchSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.username.toLowerCase().includes(search.toLowerCase()) ||
        (s.phone && s.phone.includes(search)) ||
        (s.jobTitle && s.jobTitle.toLowerCase().includes(search.toLowerCase()));

      const matchRole = roleFilter === 'ALL' || s.role === roleFilter;
      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && s.isActive) ||
        (statusFilter === 'INACTIVE' && !s.isActive);

      return matchSearch && matchRole && matchStatus;
    });
  }, [staffList, search, roleFilter, statusFilter]);

  const paginatedStaff = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredStaff.slice(start, start + perPage);
  }, [filteredStaff, page, perPage]);

  const handleOpenAdd = () => {
    setEditingStaff(null);
    setUsernameManuallyEdited(false);
    setShowPassword(false);
    setForm({
      name: '',
      username: '',
      password: '',
      role: 'CASHIER',
      phone: '',
      department: 'Operasional',
      jobTitle: '',
      employmentType: 'FULL_TIME',
      joinDate: new Date().toISOString().split('T')[0],
      baseSalary: 0,
      dailyAllowance: 0,
      hourlyOvertimeRate: 0,
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (staff) => {
    setEditingStaff(staff);
    setUsernameManuallyEdited(true);
    setShowPassword(false);
    setForm({
      name: staff.name || '',
      username: staff.username || '',
      password: '',
      role: staff.role || 'CASHIER',
      phone: staff.phone || '',
      department: staff.department || 'Operasional',
      jobTitle: staff.jobTitle || '',
      employmentType: staff.employmentType || 'FULL_TIME',
      joinDate: staff.joinDate || new Date().toISOString().split('T')[0],
      baseSalary: Number(staff.baseSalary || 0),
      dailyAllowance: Number(staff.dailyAllowance || 0),
      hourlyOvertimeRate: Number(staff.hourlyOvertimeRate || 0),
      isActive: staff.isActive ?? true,
    });
    setIsModalOpen(true);
  };

  const handleNameChange = (e) => {
    const newName = e.target.value;
    if (!editingStaff && !usernameManuallyEdited) {
      // Auto-suggest lowercase dot-separated username from name (e.g. "Budi Santoso" -> "budi.santoso")
      const suggested = newName
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '.')
        .replace(/[^a-z0-9_.-]/g, '');
      setForm((prev) => ({ ...prev, name: newName, username: suggested }));
    } else {
      setForm((prev) => ({ ...prev, name: newName }));
    }
  };

  const handleGeneratePassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$';
    let pass = '';
    for (let i = 0; i < 8; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setForm((prev) => ({ ...prev, password: pass }));
    setShowPassword(true);
    toast.success('Kata sandi acak berhasil dibuat');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!editingStaff) {
      const cleanUsername = (form.username || '').trim().toLowerCase();
      if (!cleanUsername || cleanUsername.length < 3) {
        toast.error('Username login minimal 3 karakter');
        return;
      }
      if (!/^[a-z0-9_.-]+$/.test(cleanUsername)) {
        toast.error('Username hanya boleh huruf kecil, angka, titik, underscore, atau strip');
        return;
      }
      if (!form.password || form.password.trim().length < 6) {
        toast.error('Kata sandi login minimal 6 karakter');
        return;
      }

      const res = await onCreateStaff({
        ...form,
        username: cleanUsername,
        password: form.password.trim(),
      });
      if (res) {
        setIsModalOpen(false);
      }
    } else {
      if (form.password && form.password.trim().length > 0 && form.password.trim().length < 6) {
        toast.error('Kata sandi baru minimal 6 karakter');
        return;
      }
      const payload = { ...form };
      if (!payload.password || payload.password.trim() === '') {
        delete payload.password;
      } else {
        payload.password = payload.password.trim();
      }
      const res = await onUpdateStaff(editingStaff.id, payload);
      if (res) {
        setIsModalOpen(false);
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (staffToDelete) {
      await onDeleteStaff(staffToDelete.id);
      setStaffToDelete(null);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Controls: Search, Filters, Add Button */}
      <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-komazi-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nama, username, jabatan..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text placeholder-komazi-muted focus:border-komazi-coral outline-none transition-all"
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none cursor-pointer"
          >
            <option value="ALL">Semua Peran</option>
            <option value="OWNER">Pemilik (Owner)</option>
            <option value="MANAGER">Manajer</option>
            <option value="CASHIER">Kasir</option>
            <option value="BARISTA">Barista</option>
            <option value="KITCHEN">Dapur</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none cursor-pointer"
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">Staf Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
          </select>
        </div>

        {/* Action Buttons (Manager / Owner only) */}
        {isManagerOrOwner && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-surface-3 border border-komazi-border text-komazi-text font-bold text-xs shadow-sm transition-all active:scale-95 shrink-0"
              title="Import banyak akun staf sekaligus via file Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Import Excel</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAdd}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md transition-all active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Tambah Staf</span>
            </button>
          </div>
        )}
      </div>

      {/* Staff Table */}
      <div className="rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-komazi-surface-2 border-b border-komazi-border text-komazi-muted font-bold">
              <tr>
                <th className="py-3 px-4">Pegawai</th>
                <th className="py-3 px-4">Peran</th>
                <th className="py-3 px-4">Jabatan / Departemen</th>
                {isOwner && <th className="py-3 px-4">Gaji Pokok</th>}
                <th className="py-3 px-4">Kehadiran Hari Ini</th>
                <th className="py-3 px-4">Status Akun</th>
                {isManagerOrOwner && <th className="py-3 px-4 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-komazi-border">
              {paginatedStaff.length === 0 ? (
                <tr>
                  <td colSpan={isOwner ? 7 : 6} className="py-12 text-center text-komazi-muted">
                    <Users className="w-8 h-8 mx-auto opacity-30 mb-2" />
                    <p>Tidak ada data staf yang sesuai filter pencarian</p>
                  </td>
                </tr>
              ) : (
                paginatedStaff.map((staff) => {
                  const isSelf = currentUser?.id === staff.id;
                  return (
                    <tr key={staff.id} className="hover:bg-komazi-surface-2/60 transition-colors">
                      {/* Pegawai Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                              staff.role === 'OWNER'
                                ? 'bg-komazi-coral/20 text-komazi-coral'
                                : staff.role === 'MANAGER'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : staff.role === 'BARISTA'
                                ? 'bg-amber-500/20 text-amber-400'
                                : staff.role === 'KITCHEN'
                                ? 'bg-rose-500/20 text-rose-400'
                                : 'bg-neutral-800 text-komazi-text'
                            }`}
                          >
                            {staff.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-komazi-text flex items-center gap-1.5">
                              <span>{staff.name}</span>
                              {isSelf && (
                                <span className="px-1.5 py-0.2 rounded bg-neutral-800 text-[10px] text-komazi-muted font-medium">
                                  Anda
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-komazi-muted flex items-center gap-2 mt-0.5">
                              <span>@{staff.username}</span>
                              {staff.phone && (
                                <span className="flex items-center gap-1 text-[10px] opacity-80">
                                  <Phone className="w-2.5 h-2.5" />
                                  <span>{staff.phone}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Peran Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-block ${
                            staff.role === 'OWNER'
                              ? 'bg-komazi-coral/15 text-komazi-coral border border-komazi-coral/30'
                              : staff.role === 'MANAGER'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : staff.role === 'BARISTA'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : staff.role === 'KITCHEN'
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              : 'bg-neutral-800 text-komazi-muted border border-komazi-border'
                          }`}
                        >
                          {staff.role === 'OWNER'
                            ? 'Pemilik'
                            : staff.role === 'MANAGER'
                            ? 'Manajer'
                            : staff.role === 'CASHIER'
                            ? 'Kasir'
                            : staff.role === 'BARISTA'
                            ? 'Barista'
                            : staff.role === 'KITCHEN'
                            ? 'Dapur'
                            : staff.role}
                        </span>
                      </td>

                      {/* Jabatan & Departemen */}
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-semibold text-komazi-text">
                          {staff.jobTitle || 'Staf Reguler'}
                        </div>
                        <div className="text-[11px] text-komazi-muted mt-0.5">
                          {staff.department || 'Operasional'} • {
                            staff.employmentType === 'FULL_TIME'
                              ? 'Purnawaktu'
                              : staff.employmentType === 'PART_TIME'
                              ? 'Paruh Waktu'
                              : staff.employmentType === 'CONTRACT'
                              ? 'Kontrak'
                              : staff.employmentType || 'Purnawaktu'
                          }
                        </div>
                      </td>

                      {/* Gaji Pokok (Owner Only) */}
                      {isOwner && (
                        <td className="py-3.5 px-4 font-mono font-bold text-komazi-text">
                          {formatRupiah(staff.baseSalary || 0)}
                        </td>
                      )}

                      {/* Kehadiran Hari Ini */}
                      <td className="py-3.5 px-4">
                        {staff.attendanceStatus === 'CLOCKED_IN' ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1 w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Sedang Bekerja</span>
                          </span>
                        ) : staff.attendanceStatus === 'COMPLETED' ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-neutral-800 text-komazi-muted border border-komazi-border text-[10px] font-bold w-fit">
                            Selesai Giliran Kerja
                          </span>
                        ) : (
                          <span className="text-[11px] text-komazi-muted italic">Belum Hadir</span>
                        )}
                      </td>

                      {/* Status Akun */}
                      <td className="py-3.5 px-4">
                        {isManagerOrOwner && !isSelf && (isOwner || staff.role !== 'OWNER') ? (
                          <button
                            type="button"
                            onClick={() => onUpdateStaff(staff.id, { isActive: !staff.isActive })}
                            title={staff.isActive ? 'Klik untuk menonaktifkan akun staf' : 'Klik untuk mengaktifkan akun staf'}
                            className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                              staff.isActive
                                ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30'
                                : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 border border-neutral-700'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                staff.isActive ? 'bg-emerald-400' : 'bg-neutral-500'
                              }`}
                            />
                            <span>{staff.isActive ? 'Aktif' : 'Nonaktif'}</span>
                          </button>
                        ) : (
                          <span
                            className={`text-xs font-bold flex items-center gap-1.5 ${
                              staff.isActive ? 'text-emerald-400' : 'text-neutral-500'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                staff.isActive ? 'bg-emerald-400' : 'bg-neutral-600'
                              }`}
                            />
                            <span>{staff.isActive ? 'Aktif' : 'Nonaktif'}</span>
                          </span>
                        )}
                      </td>

                      {/* Aksi */}
                      {isManagerOrOwner && (
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(staff)}
                              title="Ubah Profil Staf"
                              className="p-1.5 rounded-lg text-komazi-muted hover:text-komazi-coral hover:bg-komazi-surface transition-all"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            {/* Tombol Terbitkan Token Reset Password Khusus Owner */}
                            {isOwner && !isSelf && (
                              <button
                                type="button"
                                onClick={() => setStaffForReset(staff)}
                                title="Terbitkan Token Atur Ulang Kata Sandi"
                                className="p-1.5 rounded-lg text-komazi-muted hover:text-amber-400 hover:bg-komazi-surface transition-all"
                              >
                                <KeyRound className="w-4 h-4" />
                              </button>
                            )}

                            {/* Delete button (not allowed on self or owner if caller is manager) */}
                            {(!isSelf && (isOwner || staff.role !== 'OWNER')) && (
                              <button
                                type="button"
                                onClick={() => setStaffToDelete(staff)}
                                title="Hapus Akun Staf"
                                className="p-1.5 rounded-lg text-komazi-muted hover:text-rose-400 hover:bg-komazi-surface transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredStaff.length > 0 && (
          <div className="p-3 border-t border-komazi-border">
            <Pagination
              currentPage={page}
              totalItems={filteredStaff.length}
              itemsPerPage={perPage}
              onPageChange={setPage}
              onItemsPerPageChange={(newLimit) => {
                setPerPage(newLimit);
                setPage(1);
              }}
              itemLabel="staf"
            />
          </div>
        )}
      </div>

      {/* Add / Edit Staff Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-komazi-surface border border-komazi-border rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-komazi-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-komazi-coral/15 text-komazi-coral flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-komazi-text">
                    {editingStaff ? 'Ubah Profil Staf' : 'Tambah Akun Staf Baru'}
                  </h3>
                  <p className="text-[11px] text-komazi-muted">
                    Lengkapi data pegawai, jabatan, dan hak akses peran
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Nama Lengkap & Nomor Telepon */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-komazi-muted mb-1">Nama Lengkap *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={handleNameChange}
                    placeholder="Contoh: Budi Santoso"
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-komazi-muted mb-1">No. WhatsApp / Telepon</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="08123456789"
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
                  />
                </div>
              </div>

              {/* Akun Login: Username & Password */}
              <div className="p-3.5 rounded-xl bg-komazi-surface-2/70 border border-komazi-border space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold text-komazi-text flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-komazi-coral" />
                    <span>Kredensial Akun Login Sistem</span>
                  </div>
                  <span className="text-[10px] text-komazi-muted">Login POS &amp; HRIS</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-komazi-muted mb-1">
                      Username Login *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.username}
                      onChange={(e) => {
                        setUsernameManuallyEdited(true);
                        setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s+/g, '') });
                      }}
                      placeholder="budi.santoso"
                      className="w-full p-2.5 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text font-mono focus:border-komazi-coral outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-semibold text-komazi-muted">
                        {editingStaff ? 'Ganti Sandi (Opsional)' : 'Kata Sandi Login *'}
                      </label>
                      <button
                        type="button"
                        onClick={handleGeneratePassword}
                        className="text-[10px] text-komazi-coral hover:underline flex items-center gap-1 font-medium"
                      >
                        <Sparkles className="w-3 h-3" /> Acak
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required={!editingStaff}
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        placeholder={editingStaff ? 'Kosongkan jika tak diubah' : 'Min. 6 karakter'}
                        className="w-full pl-3 pr-8 py-2.5 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text font-mono focus:border-komazi-coral outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-komazi-muted hover:text-komazi-text"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Peran & Departemen */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-komazi-muted mb-1">Peran</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
                  >
                    <option value="CASHIER">Kasir</option>
                    <option value="BARISTA">Barista</option>
                    <option value="KITCHEN">Dapur</option>
                    <option value="MANAGER">Manajer</option>
                    {isOwner && <option value="OWNER">Pemilik (Owner)</option>}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-komazi-muted mb-1">Departemen</label>
                  <select
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
                  >
                    <option value="Operasional">Operasional</option>
                    <option value="Bar & Minuman">Bar &amp; Minuman</option>
                    <option value="Dapur & Makanan">Dapur &amp; Makanan</option>
                    <option value="Manajemen">Manajemen</option>
                  </select>
                </div>
              </div>

              {/* Jabatan & Tipe Kerja */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-komazi-muted mb-1">Judul Jabatan</label>
                  <input
                    type="text"
                    value={form.jobTitle}
                    onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                    placeholder="Contoh: Barista Utama / Kasir Utama"
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-komazi-muted mb-1">Tipe Kerja</label>
                  <select
                    value={form.employmentType}
                    onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
                  >
                    <option value="FULL_TIME">Purnawaktu</option>
                    <option value="PART_TIME">Paruh Waktu</option>
                    <option value="CONTRACT">Kontrak</option>
                  </select>
                </div>
              </div>

              {/* Komponen Gaji (Khusus Owner) */}
              {isOwner && (
                <div className="p-3.5 rounded-xl bg-neutral-900 border border-komazi-border space-y-3">
                  <div className="text-[11px] font-bold text-komazi-coral flex items-center gap-1.5">
                    <Coins className="w-4 h-4" />
                    <span>Komponen Penggajian (Rahasia Pemilik)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[10px] text-komazi-muted mb-1">Gaji Pokok (Bulan):</label>
                      <input
                        type="number"
                        min="0"
                        value={form.baseSalary}
                        onChange={(e) => setForm({ ...form, baseSalary: Number(e.target.value) })}
                        className="w-full p-2 rounded-lg bg-komazi-surface border border-komazi-border text-xs text-komazi-text font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-komazi-muted mb-1">Uang Makan / Hari:</label>
                      <input
                        type="number"
                        min="0"
                        value={form.dailyAllowance}
                        onChange={(e) => setForm({ ...form, dailyAllowance: Number(e.target.value) })}
                        className="w-full p-2 rounded-lg bg-komazi-surface border border-komazi-border text-xs text-komazi-text font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-komazi-muted mb-1">Tarif Lembur / Jam:</label>
                      <input
                        type="number"
                        min="0"
                        value={form.hourlyOvertimeRate}
                        onChange={(e) => setForm({ ...form, hourlyOvertimeRate: Number(e.target.value) })}
                        className="w-full p-2 rounded-lg bg-komazi-surface border border-komazi-border text-xs text-komazi-text font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Status Aktif Toggle */}
              {editingStaff && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border">
                  <div>
                    <div className="text-xs font-bold text-komazi-text">Status Keaktifan Akun</div>
                    <div className="text-[10px] text-komazi-muted">Nonaktifkan jika staf sudah berhenti</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, isActive: !form.isActive })}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors ${
                      form.isActive
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                    }`}
                  >
                    {form.isActive ? '✓ Aktif' : 'Nonaktif'}
                  </button>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-komazi-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-muted text-xs font-bold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>{editingStaff ? 'Simpan Perubahan' : 'Buat Akun Staf'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {staffToDelete && (
        <AlertModal
          isOpen={true}
          title="Hapus Akun Staf?"
          message={`Apakah Anda yakin ingin menghapus akun ${staffToDelete.name} (@${staffToDelete.username})? Jika staf belum memiliki riwayat transaksi atau presensi, akun akan dihapus permanen dari sistem. Jika sudah memiliki riwayat, akun akan dinonaktifkan secara aman agar pembukuan dan laporan keuangan tetap utuh.`}
          confirmText="Ya, Hapus Staf"
          cancelText="Batal"
          type="danger"
          onConfirm={handleConfirmDelete}
          onCancel={() => setStaffToDelete(null)}
        />
      )}
      {/* Modal: Otorisasi Token Reset Password oleh Owner */}
      {staffForReset && (
        <OwnerResetPasswordModal
          targetUser={staffForReset}
          onClose={() => setStaffForReset(null)}
          onSuccess={onRefresh}
        />
      )}

      {/* Modal: Impor Staf dari Excel */}
      {isImportModalOpen && (
        <ExcelImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          title="Import Staf & Pegawai dari Excel"
          type="STAFF"
          onSuccess={() => {
            onRefresh?.();
            toast.success('Impor staf dari Excel berhasil!');
          }}
        />
      )}
    </div>
  );
}
