import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { Branch } from '../types';
import { MaterialIcon } from './MaterialIcon';

interface BranchesViewProps {
  storeId: string;
  canManage: boolean;
  onBranchUpdated?: (updated: Branch) => void;
}

interface BranchFormState {
  name: string;
  code: string;
  address: string;
  phone: string;
  workingDays: string;
  openTime: string;
  closeTime: string;
  managerName: string;
}

const WORKING_DAYS_PRESETS = [
  'Thứ 2 – Chủ nhật',
  'Thứ 2 – Thứ 7',
  'Thứ 2 – Thứ 6',
  'Cả tuần (24/7)',
];

export const BranchesView: React.FC<BranchesViewProps> = ({
  storeId,
  canManage,
  onBranchUpdated,
}) => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Add / Edit Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [form, setForm] = useState<BranchFormState>({
    name: '',
    code: '',
    address: '',
    phone: '',
    workingDays: 'Thứ 2 – Chủ nhật',
    openTime: '07:00',
    closeTime: '22:00',
    managerName: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Modal
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadBranches = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const list = await api.getBranches(storeId);
      setBranches(list);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Không thể tải danh sách chi nhánh.'
      );
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  const filteredBranches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.code.toLowerCase().includes(q) ||
        b.address.toLowerCase().includes(q) ||
        b.managerName.toLowerCase().includes(q) ||
        b.phone.toLowerCase().includes(q)
    );
  }, [branches, searchQuery]);

  const stats = useMemo(() => {
    const total = branches.length;
    const openShifts = branches.reduce(
      (sum, b) => sum + (b.activeShiftCount ?? 0),
      0
    );
    const totalStaff = branches.reduce(
      (sum, b) => sum + (b.employeeCount ?? 0),
      0
    );
    const activeBranches = branches.filter(
      (b) => (b.activeShiftCount ?? 0) > 0
    ).length;
    return { total, openShifts, totalStaff, activeBranches };
  }, [branches]);

  const openCreateModal = () => {
    setEditingBranch(null);
    const nextIdx = String(branches.length + 1).padStart(2, '0');
    setForm({
      name: '',
      code: `CN-${nextIdx}`,
      address: '',
      phone: '',
      workingDays: 'Thứ 2 – Chủ nhật',
      openTime: '07:00',
      closeTime: '22:00',
      managerName: '',
    });
    setFormError(null);
    setFormOpen(true);
  };

  const openEditModal = (branch: Branch) => {
    setEditingBranch(branch);
    setForm({
      name: branch.name,
      code: branch.code,
      address: branch.address,
      phone: branch.phone,
      workingDays: branch.workingDays,
      openTime: branch.openTime,
      closeTime: branch.closeTime,
      managerName: branch.managerName,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmitBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (
      !form.name.trim() ||
      !form.code.trim() ||
      !form.address.trim() ||
      !form.phone.trim()
    ) {
      setFormError(
        'Vui lòng nhập đầy đủ tên chi nhánh, mã chi nhánh, địa chỉ và số điện thoại.'
      );
      return;
    }

    setSubmitting(true);
    try {
      if (editingBranch) {
        const updated = await api.updateBranch(editingBranch.id, {
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          address: form.address.trim(),
          phone: form.phone.trim(),
          workingDays: form.workingDays.trim() || 'Thứ 2 – Chủ nhật',
          openTime: form.openTime.trim() || '07:00',
          closeTime: form.closeTime.trim() || '22:00',
          managerName: form.managerName.trim() || 'Chưa phân công',
        });
        setBranches((prev) =>
          prev.map((b) => (b.id === updated.id ? updated : b))
        );
        onBranchUpdated?.(updated);
      } else {
        const created = await api.createBranch({
          storeId,
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          address: form.address.trim(),
          phone: form.phone.trim(),
          workingDays: form.workingDays.trim() || 'Thứ 2 – Chủ nhật',
          openTime: form.openTime.trim() || '07:00',
          closeTime: form.closeTime.trim() || '22:00',
          managerName: form.managerName.trim() || 'Chưa phân công',
        });
        setBranches((prev) => [...prev, created]);
      }
      setFormOpen(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Không thể lưu thông tin chi nhánh.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingBranch) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteBranch(deletingBranch.id);
      setBranches((prev) => prev.filter((b) => b.id !== deletingBranch.id));
      setDeletingBranch(null);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Không thể xóa chi nhánh này.'
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pos-scroll bg-[#F8FAFC] p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Page Header */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">Quản lý chi nhánh</h1>
            <p className="text-sm text-[#64748B] mt-0.5">
              Khai báo địa điểm, giờ mở cửa, quản lý phụ trách và theo dõi ca vận hành từng chi nhánh.
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={openCreateModal}
              className="h-11 px-5 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-colors"
            >
              <MaterialIcon name="add_business" className="text-[20px]" />
              <span>Thêm chi nhánh</span>
            </button>
          )}
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <div className="text-xs font-semibold text-[#64748B]">Tổng số chi nhánh</div>
            <div className="text-2xl font-bold text-[#0F172A] mt-1 tabular-nums-strict">
              {stats.total}
            </div>
            <div className="text-xs text-[#64748B] mt-1">Đang hoạt động trong chuỗi</div>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <div className="text-xs font-semibold text-[#64748B]">Chi nhánh đang mở ca</div>
            <div className="text-2xl font-bold text-[#16A34A] mt-1 tabular-nums-strict">
              {stats.activeBranches}
            </div>
            <div className="text-xs text-[#64748B] mt-1 tabular-nums-strict">
              {stats.openShifts} quầy POS đang trực
            </div>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <div className="text-xs font-semibold text-[#64748B]">Nhân sự theo nhánh</div>
            <div className="text-2xl font-bold text-[#0F766E] mt-1 tabular-nums-strict">
              {stats.totalStaff}
            </div>
            <div className="text-xs text-[#64748B] mt-1">Quản lý &amp; thu ngân</div>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <div className="text-xs font-semibold text-[#64748B]">Đồng bộ kho POS</div>
            <div className="text-2xl font-bold text-[#0F172A] mt-1">Tự động</div>
            <div className="text-xs text-[#64748B] mt-1">Tách tồn kho theo từng nhánh</div>
          </div>
        </div>

        {/* Search & Refresh Toolbar */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <MaterialIcon
              name="search"
              className="text-[20px] text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên chi nhánh, mã CN, địa chỉ, số điện thoại hoặc quản lý..."
              className="w-full h-11 pl-10 pr-9 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white focus:border-[#0F766E] focus:outline-none text-sm text-[#0F172A]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Xóa tìm kiếm"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A]"
              >
                <MaterialIcon name="close" className="text-[18px]" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={loadBranches}
            className="h-11 px-4 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] flex items-center gap-1.5"
          >
            <MaterialIcon name="refresh" className="text-[18px] text-[#64748B]" />
            <span>Làm mới</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-sm text-[#DC2626]">
            {errorMsg}
          </div>
        )}

        {/* Branches Table */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#0F172A]">
              Danh sách chi nhánh ({filteredBranches.length})
            </h2>
            {!canManage && (
              <span className="text-xs text-[#64748B]">
                Chế độ chỉ xem · Liên hệ Chủ/Quản lý cửa hàng để chỉnh sửa
              </span>
            )}
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-[#64748B]">
              Đang tải dữ liệu chi nhánh...
            </div>
          ) : filteredBranches.length === 0 ? (
            <div className="p-12 text-center">
              <MaterialIcon name="store_mall_directory" className="text-[36px] text-[#94A3B8]" />
              <div className="text-sm font-bold text-[#0F172A] mt-2">
                Không tìm thấy chi nhánh phù hợp
              </div>
              <p className="text-xs text-[#64748B] mt-1">
                Thử thay đổi từ khóa tìm kiếm hoặc thêm chi nhánh mới.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-semibold text-[#64748B]">
                  <tr>
                    <th className="py-3 px-5">Chi nhánh / Mã</th>
                    <th className="py-3 px-4">Địa chỉ &amp; Liên hệ</th>
                    <th className="py-3 px-4">Quản lý phụ trách</th>
                    <th className="py-3 px-4">Lịch &amp; Giờ mở cửa</th>
                    <th className="py-3 px-4 text-right">Nhân sự</th>
                    <th className="py-3 px-4">Trạng thái ca</th>
                    {canManage && <th className="py-3 px-5 text-right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {filteredBranches.map((b) => {
                    const isActiveShift = (b.activeShiftCount ?? 0) > 0;
                    return (
                      <tr key={b.id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="py-3.5 px-5">
                          <div className="font-bold text-[#0F172A]">{b.name}</div>
                          <div className="text-xs font-mono text-[#0F766E] font-semibold mt-0.5">
                            {b.code}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 max-w-[280px]">
                          <div className="text-xs text-[#0F172A] leading-snug">
                            {b.address}
                          </div>
                          <div className="text-xs text-[#64748B] mt-0.5 tabular-nums-strict">
                            ĐT: {b.phone}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-sm font-medium text-[#0F172A]">
                          {b.managerName || 'Chưa phân công'}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-xs font-semibold text-[#0F172A] tabular-nums-strict">
                            {b.openTime} – {b.closeTime}
                          </div>
                          <div className="text-xs text-[#64748B] mt-0.5">
                            {b.workingDays}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-semibold text-[#0F172A] tabular-nums-strict">
                          {b.employeeCount ?? 0} người
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`text-xs font-bold ${
                              isActiveShift ? 'text-[#16A34A]' : 'text-[#64748B]'
                            }`}
                          >
                            {isActiveShift
                              ? `Đang mở ${b.activeShiftCount} ca`
                              : 'Chưa mở ca'}
                          </span>
                        </td>
                        {canManage && (
                          <td className="py-3.5 px-5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditModal(b)}
                                className="h-9 px-3 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-xs font-semibold text-[#0F172A] inline-flex items-center gap-1"
                              >
                                <MaterialIcon name="edit" className="text-[16px] text-[#0F766E]" />
                                <span>Sửa</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteError(null);
                                  setDeletingBranch(b);
                                }}
                                className="h-9 px-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] hover:bg-[#FEE2E2] text-xs font-semibold text-[#DC2626] inline-flex items-center gap-1"
                              >
                                <MaterialIcon name="delete" className="text-[16px]" />
                                <span>Xóa</span>
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Branch Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">
                  {editingBranch ? 'Cập nhật thông tin chi nhánh' : 'Thêm chi nhánh mới'}
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  {editingBranch
                    ? `Mã hiện tại: ${editingBranch.code}`
                    : 'Hệ thống sẽ tự động khởi tạo danh mục tồn kho POS cho chi nhánh mới.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="w-9 h-9 rounded-lg hover:bg-[#F1F5F9] flex items-center justify-center text-[#64748B]"
              >
                <MaterialIcon name="close" className="text-[20px]" />
              </button>
            </div>

            <form onSubmit={handleSubmitBranch} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto pos-scroll">
              {formError && (
                <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs font-medium text-[#DC2626]">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                    Tên chi nhánh <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="VD: Chi nhánh Hai Bà Trưng (Q.3)"
                    className="w-full h-11 px-3.5 rounded-xl border border-[#E2E8F0] focus:border-[#0F766E] focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                    Mã chi nhánh <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
                    }
                    placeholder="CN-Q3-03"
                    className="w-full h-11 px-3.5 rounded-xl border border-[#E2E8F0] focus:border-[#0F766E] focus:outline-none text-sm font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                    Số điện thoại chi nhánh <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="028 3910 8888"
                    className="w-full h-11 px-3.5 rounded-xl border border-[#E2E8F0] focus:border-[#0F766E] focus:outline-none text-sm tabular-nums-strict"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                    Quản lý phụ trách
                  </label>
                  <input
                    type="text"
                    value={form.managerName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, managerName: e.target.value }))
                    }
                    placeholder="Họ tên quản lý chi nhánh"
                    className="w-full h-11 px-3.5 rounded-xl border border-[#E2E8F0] focus:border-[#0F766E] focus:outline-none text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                  Địa chỉ chi tiết <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#E2E8F0] focus:border-[#0F766E] focus:outline-none text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 border-t border-[#E2E8F0]">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                    Ngày hoạt động
                  </label>
                  <select
                    value={
                      WORKING_DAYS_PRESETS.includes(form.workingDays)
                        ? form.workingDays
                        : 'CUSTOM'
                    }
                    onChange={(e) => {
                      if (e.target.value !== 'CUSTOM') {
                        setForm((f) => ({ ...f, workingDays: e.target.value }));
                      }
                    }}
                    className="w-full h-11 px-3 rounded-xl border border-[#E2E8F0] focus:border-[#0F766E] focus:outline-none text-sm bg-white"
                  >
                    {WORKING_DAYS_PRESETS.map((preset) => (
                      <option key={preset} value={preset}>
                        {preset}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                    Giờ mở cửa
                  </label>
                  <input
                    type="time"
                    value={form.openTime}
                    onChange={(e) => setForm((f) => ({ ...f, openTime: e.target.value }))}
                    className="w-full h-11 px-3.5 rounded-xl border border-[#E2E8F0] focus:border-[#0F766E] focus:outline-none text-sm tabular-nums-strict"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                    Giờ đóng cửa
                  </label>
                  <input
                    type="time"
                    value={form.closeTime}
                    onChange={(e) => setForm((f) => ({ ...f, closeTime: e.target.value }))}
                    className="w-full h-11 px-3.5 rounded-xl border border-[#E2E8F0] focus:border-[#0F766E] focus:outline-none text-sm tabular-nums-strict"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="h-11 px-5 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-sm font-semibold text-[#0F172A]"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-11 px-6 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-bold disabled:opacity-50"
                >
                  {submitting
                    ? 'Đang lưu...'
                    : editingBranch
                    ? 'Lưu thay đổi'
                    : 'Tạo chi nhánh'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingBranch && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] flex items-center justify-center text-[#DC2626] shrink-0">
                <MaterialIcon name="warning" className="text-[22px]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">
                  Xác nhận xóa chi nhánh
                </h3>
                <p className="text-sm text-[#64748B] mt-1">
                  Bạn có chắc chắn muốn xóa{' '}
                  <span className="font-bold text-[#0F172A]">{deletingBranch.name}</span>{' '}
                  (<span className="font-mono">{deletingBranch.code}</span>)? Dữ liệu tồn kho của chi nhánh này cũng sẽ bị gỡ bỏ.
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs font-medium text-[#DC2626]">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingBranch(null)}
                className="h-10 px-4 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-sm font-semibold text-[#0F172A]"
              >
                Giữ lại
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="h-10 px-5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-sm font-bold disabled:opacity-50"
              >
                {deleting ? 'Đang xóa...' : 'Xóa chi nhánh'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
