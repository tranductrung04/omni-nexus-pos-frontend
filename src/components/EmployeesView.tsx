import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { Branch, Employee, EmployeeStatus, User, UserRole } from '../types';
import { roleLabelVN } from '../utils/format';
import { MaterialIcon } from './MaterialIcon';

interface EmployeesViewProps {
  currentUser: User;
  storeId: string;
}

interface EmployeeFormState {
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  branchId: string;
  password: string;
  status: EmployeeStatus;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return 'NV';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const EmployeesView: React.FC<EmployeesViewProps> = ({
  currentUser,
  storeId,
}) => {
  const isStoreLevelManager =
    currentUser.role === 'STORE_ADMIN' || currentUser.role === 'STORE_MANAGER';
  const defaultBranchScope = isStoreLevelManager
    ? 'ALL'
    : currentUser.branchId || 'branch-1';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [scopeMode, setScopeMode] = useState<'ALL' | 'STORE_LEVEL' | 'BRANCH'>(
    isStoreLevelManager ? 'ALL' : 'BRANCH'
  );
  const [selectedBranchId, setSelectedBranchId] =
    useState<string>(defaultBranchScope);
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Add / Edit Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeFormState>({
    name: '',
    email: '',
    phone: '',
    role: 'BRANCH_CASHIER',
    branchId: '',
    password: '',
    status: 'ACTIVE',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Modal
  const [deletingEmp, setDeletingEmp] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const effectiveBranchParam = !isStoreLevelManager
        ? currentUser.branchId || 'branch-1'
        : scopeMode === 'STORE_LEVEL'
        ? 'STORE_LEVEL'
        : scopeMode === 'BRANCH'
        ? selectedBranchId
        : 'ALL';

      const [empList, branchList] = await Promise.all([
        api.getEmployees({
          storeId,
          branchId: effectiveBranchParam,
        }),
        api.getBranches(storeId),
      ]);
      setEmployees(empList);
      setBranches(branchList);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Không thể tải danh sách nhân viên.'
      );
    } finally {
      setLoading(false);
    }
  }, [storeId, isStoreLevelManager, currentUser.branchId, scopeMode, selectedBranchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return employees.filter((emp) => {
      if (roleFilter !== 'ALL' && emp.role !== roleFilter) return false;
      if (!q) return true;
      return (
        emp.name.toLowerCase().includes(q) ||
        emp.email.toLowerCase().includes(q) ||
        emp.phone.toLowerCase().includes(q) ||
        emp.branchName.toLowerCase().includes(q)
      );
    });
  }, [employees, roleFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = employees.length;
    const onShift = employees.filter((e) => e.isOnShift).length;
    const managers = employees.filter(
      (e) =>
        e.role === 'STORE_ADMIN' ||
        e.role === 'STORE_MANAGER' ||
        e.role === 'BRANCH_MANAGER'
    ).length;
    const cashiers = employees.filter((e) => e.role === 'BRANCH_CASHIER').length;
    return { total, onShift, managers, cashiers };
  }, [employees]);

  const openCreateModal = () => {
    setEditingEmp(null);
    const defaultBr =
      !isStoreLevelManager && currentUser.branchId
        ? currentUser.branchId
        : scopeMode === 'BRANCH' && selectedBranchId !== 'ALL'
        ? selectedBranchId
        : branches[0]?.id || '';
    setForm({
      name: '',
      email: '',
      phone: '',
      role: 'BRANCH_CASHIER',
      branchId: defaultBr,
      password: '',
      status: 'ACTIVE',
    });
    setFormError(null);
    setFormOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmp(emp);
    setForm({
      name: emp.name,
      email: emp.email,
      phone: emp.phone,
      role: emp.role,
      branchId: emp.branchId || branches[0]?.id || '',
      password: '',
      status: emp.status,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmitEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = form.name.trim();
    const cleanEmail = form.email.trim().toLowerCase();
    const cleanPhone = form.phone.trim();

    if (!cleanName || !cleanEmail) {
      setFormError('Vui lòng nhập đầy đủ họ tên và email nhân viên.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setFormError('Email không đúng định dạng (ví dụ: nhanvien@omninexus.vn).');
      return;
    }
    if (!editingEmp && form.password.length < 6) {
      setFormError('Mật khẩu khởi tạo phải có tối thiểu 6 ký tự.');
      return;
    }
    if (editingEmp && form.password && form.password.length < 6) {
      setFormError('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }

    const needsBranch =
      form.role === 'BRANCH_MANAGER' || form.role === 'BRANCH_CASHIER';
    if (needsBranch && !form.branchId) {
      setFormError('Vui lòng chọn chi nhánh làm việc cho nhân viên.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingEmp) {
        await api.updateEmployee(editingEmp.id, {
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone || '0900 000 000',
          role: form.role,
          branchId: needsBranch ? form.branchId : null,
          status: form.status,
          password: form.password ? form.password : undefined,
        });
      } else {
        await api.createEmployee({
          storeId,
          branchId: needsBranch ? form.branchId : null,
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone || '0900 000 000',
          password: form.password,
          role: form.role,
          status: form.status,
        });
      }
      setFormOpen(false);
      await loadData();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Không thể lưu thông tin nhân viên.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingEmp) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteEmployee(deletingEmp.id);
      setEmployees((prev) => prev.filter((e) => e.id !== deletingEmp.id));
      setDeletingEmp(null);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Không thể xóa nhân viên này.'
      );
    } finally {
      setDeleting(false);
    }
  };

  const roleFilterOptions = [
    { id: 'ALL', label: 'Tất cả vai trò' },
    ...(isStoreLevelManager
      ? [{ id: 'STORE_MANAGER', label: 'Quản lý cửa hàng' }]
      : []),
    { id: 'BRANCH_MANAGER', label: 'Quản lý chi nhánh' },
    { id: 'BRANCH_CASHIER', label: 'Thu ngân' },
  ];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pos-scroll bg-[#F8FAFC] p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">Quản lý nhân viên</h1>
            <p className="text-sm text-[#64748B] mt-0.5">
              {isStoreLevelManager
                ? 'Phân quyền nhân sự cấp cửa hàng và điều phối thu ngân, quản lý theo từng chi nhánh.'
                : 'Theo dõi và quản lý đội ngũ thu ngân đang làm việc tại chi nhánh.'}
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="h-11 px-5 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-colors"
          >
            <MaterialIcon name="person_add" className="text-[20px]" />
            <span>Thêm nhân viên</span>
          </button>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <div className="text-xs font-semibold text-[#64748B]">Tổng nhân sự</div>
            <div className="text-2xl font-bold text-[#0F172A] mt-1 tabular-nums-strict">
              {stats.total}
            </div>
            <div className="text-xs text-[#64748B] mt-1">Thuộc phạm vi đang lọc</div>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <div className="text-xs font-semibold text-[#64748B]">Đang trực ca POS</div>
            <div className="text-2xl font-bold text-[#16A34A] mt-1 tabular-nums-strict">
              {stats.onShift}
            </div>
            <div className="text-xs text-[#64748B] mt-1">Ca làm việc đang mở</div>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <div className="text-xs font-semibold text-[#64748B]">Cấp quản lý</div>
            <div className="text-2xl font-bold text-[#0F766E] mt-1 tabular-nums-strict">
              {stats.managers}
            </div>
            <div className="text-xs text-[#64748B] mt-1">Chủ, QL chuỗi &amp; QL nhánh</div>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <div className="text-xs font-semibold text-[#64748B]">Thu ngân quầy POS</div>
            <div className="text-2xl font-bold text-[#0F172A] mt-1 tabular-nums-strict">
              {stats.cashiers}
            </div>
            <div className="text-xs text-[#64748B] mt-1">Nhân sự vận hành quầy</div>
          </div>
        </div>

        {/* Scope, Role Filter & Search Toolbar */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Scope Switcher */}
            {isStoreLevelManager ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-[#64748B] mr-1">
                  Phạm vi:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setScopeMode('ALL');
                    setSelectedBranchId('ALL');
                  }}
                  className={`h-9 px-3.5 rounded-lg text-xs font-semibold transition-colors ${
                    scopeMode === 'ALL'
                      ? 'bg-[#0F766E] text-white'
                      : 'bg-[#F1F5F9] text-[#0F172A] hover:bg-[#E2E8F0]'
                  }`}
                >
                  Toàn cửa hàng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScopeMode('STORE_LEVEL');
                    setSelectedBranchId('STORE_LEVEL');
                  }}
                  className={`h-9 px-3.5 rounded-lg text-xs font-semibold transition-colors ${
                    scopeMode === 'STORE_LEVEL'
                      ? 'bg-[#0F766E] text-white'
                      : 'bg-[#F1F5F9] text-[#0F172A] hover:bg-[#E2E8F0]'
                  }`}
                >
                  Cấp cửa hàng
                </button>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setScopeMode('BRANCH');
                      if (
                        selectedBranchId === 'ALL' ||
                        selectedBranchId === 'STORE_LEVEL'
                      ) {
                        setSelectedBranchId(branches[0]?.id || 'branch-1');
                      }
                    }}
                    className={`h-9 px-3.5 rounded-lg text-xs font-semibold transition-colors ${
                      scopeMode === 'BRANCH'
                        ? 'bg-[#0F766E] text-white'
                        : 'bg-[#F1F5F9] text-[#0F172A] hover:bg-[#E2E8F0]'
                    }`}
                  >
                    Theo chi nhánh
                  </button>
                  {scopeMode === 'BRANCH' && (
                    <select
                      value={selectedBranchId}
                      onChange={(e) => setSelectedBranchId(e.target.value)}
                      className="h-9 px-3 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-[#0F172A] focus:border-[#0F766E] focus:outline-none"
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xs font-semibold text-[#0F172A]">
                Chi nhánh phụ trách:{' '}
                <span className="text-[#0F766E]">
                  {branches.find((b) => b.id === currentUser.branchId)?.name ||
                    'Chi nhánh hiện tại'}
                </span>
              </div>
            )}

            {/* Role Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {roleFilterOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRoleFilter(opt.id)}
                  className={`h-9 px-3 rounded-lg text-xs font-semibold transition-colors ${
                    roleFilter === opt.id
                      ? 'bg-[#0F172A] text-white'
                      : 'bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[260px]">
              <MaterialIcon
                name="search"
                className="text-[20px] text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tên nhân viên, email, số điện thoại..."
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
              onClick={loadData}
              className="h-11 px-4 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] flex items-center gap-1.5"
            >
              <MaterialIcon name="refresh" className="text-[18px] text-[#64748B]" />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-sm text-[#DC2626]">
            {errorMsg}
          </div>
        )}

        {/* Employees Table */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#0F172A]">
              Danh sách nhân sự ({filteredEmployees.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-[#64748B]">
              Đang tải danh sách nhân viên...
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="p-12 text-center">
              <MaterialIcon name="badge" className="text-[36px] text-[#94A3B8]" />
              <div className="text-sm font-bold text-[#0F172A] mt-2">
                Chưa có nhân viên phù hợp bộ lọc
              </div>
              <p className="text-xs text-[#64748B] mt-1">
                Thử đổi phạm vi chi nhánh, vai trò hoặc nhấn Thêm nhân viên.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-semibold text-[#64748B]">
                  <tr>
                    <th className="py-3 px-5">Nhân viên</th>
                    <th className="py-3 px-4">Số điện thoại</th>
                    <th className="py-3 px-4">Vai trò</th>
                    <th className="py-3 px-4">Phạm vi / Chi nhánh</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {filteredEmployees.map((emp) => {
                    const isSelf = emp.id === currentUser.id;
                    const isOwner = emp.role === 'STORE_ADMIN';
                    const canEditTarget =
                      isStoreLevelManager ||
                      emp.role === 'BRANCH_CASHIER' ||
                      emp.id === currentUser.id;
                    const canDeleteTarget =
                      !isOwner &&
                      !isSelf &&
                      (isStoreLevelManager || emp.role === 'BRANCH_CASHIER');

                    return (
                      <tr key={emp.id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                emp.status === 'INACTIVE'
                                  ? 'bg-[#F1F5F9] text-[#64748B]'
                                  : 'bg-[#CCFBF1] text-[#0F766E]'
                              }`}
                            >
                              {getInitials(emp.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-[#0F172A] truncate">
                                {emp.name}
                                {isSelf && (
                                  <span className="ml-1.5 text-[11px] font-semibold text-[#0F766E]">
                                    (Bạn)
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-[#64748B] truncate">
                                {emp.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-sm text-[#0F172A] tabular-nums-strict">
                          {emp.phone}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`text-xs font-bold ${
                              emp.role === 'STORE_ADMIN'
                                ? 'text-[#855300]'
                                : emp.role === 'STORE_MANAGER'
                                ? 'text-[#0F766E]'
                                : emp.role === 'BRANCH_MANAGER'
                                ? 'text-[#0F172A]'
                                : 'text-[#475569]'
                            }`}
                          >
                            {roleLabelVN(emp.role)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-medium text-[#0F172A]">
                          {emp.branchName}
                        </td>
                        <td className="py-3.5 px-4">
                          {emp.status === 'INACTIVE' ? (
                            <span className="text-xs font-bold text-[#DC2626]">
                              Tạm khóa
                            </span>
                          ) : emp.isOnShift ? (
                            <span className="text-xs font-bold text-[#16A34A]">
                              Đang trực ca
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-[#0F766E]">
                              Đang hoạt động
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {canEditTarget && (
                              <button
                                type="button"
                                onClick={() => openEditModal(emp)}
                                className="h-9 px-3 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-xs font-semibold text-[#0F172A] inline-flex items-center gap-1"
                              >
                                <MaterialIcon
                                  name="edit"
                                  className="text-[16px] text-[#0F766E]"
                                />
                                <span>Sửa</span>
                              </button>
                            )}
                            {canDeleteTarget && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteError(null);
                                  setDeletingEmp(emp);
                                }}
                                className="h-9 px-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] hover:bg-[#FEE2E2] text-xs font-semibold text-[#DC2626] inline-flex items-center gap-1"
                              >
                                <MaterialIcon name="delete" className="text-[16px]" />
                                <span>Xóa</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Employee Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl w-full max-w-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">
                  {editingEmp ? 'Chỉnh sửa hồ sơ nhân viên' : 'Thêm nhân viên mới'}
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Cấp tài khoản đăng nhập quầy thu ngân POS hoặc phân quyền quản lý.
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

            <form
              onSubmit={handleSubmitEmployee}
              className="p-6 space-y-4 max-h-[80vh] overflow-y-auto pos-scroll"
            >
              {formError && (
                <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs font-medium text-[#DC2626]">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                    Họ và tên <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Nguyễn Văn An"
                    className="w-full h-11 px-3.5 rounded-xl border border-[#E2E8F0] focus:border-[#0F766E] focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                    Số điện thoại
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="0912 345 678"
                    className="w-full h-11 px-3.5 rounded-xl border border-[#E2E8F0] focus:border-[#0F766E] focus:outline-none text-sm tabular-nums-strict"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                  Email đăng nhập <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="nhanvien@omninexus.vn"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#E2E8F0] focus:border-[#0F766E] focus:outline-none text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                    Vai trò <span className="text-[#DC2626]">*</span>
                  </label>
                  <select
                    value={form.role}
                    disabled={editingEmp?.role === 'STORE_ADMIN'}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        role: e.target.value as UserRole,
                        branchId:
                          e.target.value === 'STORE_MANAGER'
                            ? ''
                            : f.branchId || branches[0]?.id || '',
                      }))
                    }
                    className="w-full h-11 px-3 rounded-xl border border-[#E2E8F0] focus:border-[#0F766E] focus:outline-none text-sm bg-white disabled:bg-[#F1F5F9]"
                  >
                    {editingEmp?.role === 'STORE_ADMIN' && (
                      <option value="STORE_ADMIN">Chủ cửa hàng</option>
                    )}
                    {isStoreLevelManager && (
                      <option value="STORE_MANAGER">Quản lý cửa hàng (Toàn chuỗi)</option>
                    )}
                    {isStoreLevelManager && (
                      <option value="BRANCH_MANAGER">Quản lý chi nhánh</option>
                    )}
                    <option value="BRANCH_CASHIER">Thu ngân chi nhánh</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                    Chi nhánh trực thuộc
                  </label>
                  <select
                    value={
                      form.role === 'STORE_MANAGER' || form.role === 'STORE_ADMIN'
                        ? ''
                        : form.branchId
                    }
                    disabled={
                      form.role === 'STORE_MANAGER' ||
                      form.role === 'STORE_ADMIN' ||
                      !isStoreLevelManager
                    }
                    onChange={(e) =>
                      setForm((f) => ({ ...f, branchId: e.target.value }))
                    }
                    className="w-full h-11 px-3 rounded-xl border border-[#E2E8F0] focus:border-[#0F766E] focus:outline-none text-sm bg-white disabled:bg-[#F1F5F9] disabled:text-[#64748B]"
                  >
                    {form.role === 'STORE_MANAGER' || form.role === 'STORE_ADMIN' ? (
                      <option value="">Toàn chuỗi (Cấp cửa hàng)</option>
                    ) : (
                      branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                    {editingEmp ? 'Đặt lại mật khẩu mới (tùy chọn)' : 'Mật khẩu khởi tạo *'}
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, password: e.target.value }))
                    }
                    placeholder={
                      editingEmp ? 'Để trống nếu giữ nguyên' : 'Tối thiểu 6 ký tự'
                    }
                    className="w-full h-11 px-3.5 rounded-xl border border-[#E2E8F0] focus:border-[#0F766E] focus:outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                    Trạng thái tài khoản
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={editingEmp?.role === 'STORE_ADMIN'}
                      onClick={() => setForm((f) => ({ ...f, status: 'ACTIVE' }))}
                      className={`h-11 rounded-xl border text-xs font-bold transition-colors ${
                        form.status === 'ACTIVE'
                          ? 'border-[#16A34A] bg-[#DCFCE7] text-[#15803D]'
                          : 'border-[#E2E8F0] bg-white text-[#64748B]'
                      }`}
                    >
                      Hoạt động
                    </button>
                    <button
                      type="button"
                      disabled={editingEmp?.role === 'STORE_ADMIN'}
                      onClick={() => setForm((f) => ({ ...f, status: 'INACTIVE' }))}
                      className={`h-11 rounded-xl border text-xs font-bold transition-colors disabled:opacity-50 ${
                        form.status === 'INACTIVE'
                          ? 'border-[#DC2626] bg-[#FEF2F2] text-[#DC2626]'
                          : 'border-[#E2E8F0] bg-white text-[#64748B]'
                      }`}
                    >
                      Tạm khóa
                    </button>
                  </div>
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
                    : editingEmp
                    ? 'Lưu thay đổi'
                    : 'Tạo nhân viên'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingEmp && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] flex items-center justify-center text-[#DC2626] shrink-0">
                <MaterialIcon name="person_remove" className="text-[22px]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">
                  Xác nhận xóa nhân viên
                </h3>
                <p className="text-sm text-[#64748B] mt-1">
                  Tài khoản{' '}
                  <span className="font-bold text-[#0F172A]">{deletingEmp.name}</span> (
                  {deletingEmp.email}) sẽ bị thu hồi quyền truy cập POS ngay lập tức.
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
                onClick={() => setDeletingEmp(null)}
                className="h-10 px-4 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-sm font-semibold text-[#0F172A]"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="h-10 px-5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-sm font-bold disabled:opacity-50"
              >
                {deleting ? 'Đang xóa...' : 'Xóa nhân viên'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
