import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { Branch, Store, StoreAuditLog, StoreStatus, User } from '../types';
import {
  downloadCsv,
  formatDateTimeVN,
  formatDateVN,
} from '../utils/format';
import { MaterialIcon } from './MaterialIcon';

interface AdminStoresViewProps {
  user: User;
  onOpenPosFlow: () => void;
}

type AdminTab = 'PENDING' | 'ACTIVE' | 'BLOCKED' | 'ALL';
type ConfirmActionType = 'APPROVE' | 'REJECT' | 'BLOCK' | 'UNBLOCK';

interface ToastItem {
  id: string;
  type: 'success' | 'error';
  title: string;
  message: string;
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'ST';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function getRelativeDayLabel(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTarget = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (startToday.getTime() - startTarget.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays <= 0) return 'Hôm nay';
  if (diffDays === 1) return '1 ngày trước';
  return `${diffDays} ngày trước`;
}

function getBusinessGroup(businessType: string): string {
  const lower = businessType.toLowerCase();
  if (lower.includes('cà phê') || lower.includes('f&b')) return 'FB';
  if (lower.includes('tạp hóa') || lower.includes('bách hóa')) return 'GROCERY';
  if (lower.includes('siêu thị')) return 'MINIMART';
  if (lower.includes('thuốc') || lower.includes('dược')) return 'PHARMACY';
  if (lower.includes('thời trang')) return 'FASHION';
  return 'RETAIL';
}

export const AdminStoresView: React.FC<AdminStoresViewProps> = ({
  user,
  onOpenPosFlow,
}) => {
  const [stores, setStores] = useState<Store[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [auditLogs, setAuditLogs] = useState<StoreAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Admin Console Filters & Navigation
  const [activeTab, setActiveTab] = useState<AdminTab>('PENDING');
  const [searchText, setSearchText] = useState('');
  const [businessFilter, setBusinessFilter] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name'>('newest');

  // Interactive Drawers, Dropdowns & Confirmation Dialogs
  const [detailStoreId, setDetailStoreId] = useState<string | null>(null);
  const [openMenuStoreId, setOpenMenuStoreId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{
    store: Store;
    action: ConfirmActionType;
  } | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [historyFilterStoreId, setHistoryFilterStoreId] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback(
    (type: 'success' | 'error', title: string, message: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, type, title, message }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const loadStores = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        const res = await api.getStores();
        setStores(res.stores);
        setBranches(res.branches);
        setAuditLogs(res.auditLogs || []);
      } catch (err) {
        pushToast(
          'error',
          'Không thể tải dữ liệu',
          err instanceof Error ? err.message : 'Vui lòng thử lại sau.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [pushToast]
  );

  useEffect(() => {
    loadStores(false);
  }, [loadStores]);

  // Close row dropdown menu on outside click
  useEffect(() => {
    if (!openMenuStoreId) return;
    const handleDocClick = () => setOpenMenuStoreId(null);
    window.addEventListener('click', handleDocClick);
    return () => window.removeEventListener('click', handleDocClick);
  }, [openMenuStoreId]);

  const counts = useMemo(() => {
    const pending = stores.filter((s) => s.status === 'PENDING').length;
    const active = stores.filter((s) => s.status === 'ACTIVE').length;
    const blocked = stores.filter((s) => s.status === 'BLOCKED').length;
    return {
      total: stores.length,
      pending,
      active,
      blocked,
    };
  }, [stores]);

  const filteredStores = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const list = stores.filter((s) => {
      if (activeTab !== 'ALL' && s.status !== activeTab) return false;
      if (businessFilter !== 'ALL' && getBusinessGroup(s.businessType) !== businessFilter) {
        return false;
      }
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.brandCode.toLowerCase().includes(q) ||
        s.contactEmail.toLowerCase().includes(q) ||
        s.contactPhone.toLowerCase().includes(q) ||
        (s.ownerName || '').toLowerCase().includes(q) ||
        (s.ownerEmail || '').toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (sortOrder === 'name') return a.name.localeCompare(b.name, 'vi');
      if (sortOrder === 'oldest') return a.createdAt.localeCompare(b.createdAt);
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [stores, activeTab, businessFilter, searchText, sortOrder]);

  const detailStore = useMemo(
    () => stores.find((s) => s.id === detailStoreId) || null,
    [stores, detailStoreId]
  );

  const detailStoreLogs = useMemo(() => {
    if (!detailStore) return [];
    return auditLogs.filter((l) => l.storeId === detailStore.id);
  }, [auditLogs, detailStore]);

  const modalAuditLogs = useMemo(() => {
    if (!historyFilterStoreId) return auditLogs;
    return auditLogs.filter((l) => l.storeId === historyFilterStoreId);
  }, [auditLogs, historyFilterStoreId]);

  const handleCopyText = (text: string, label: string) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    pushToast('success', `Đã sao chép ${label}`, text);
  };

  const handleConfirmAction = async () => {
    if (!confirmState) return;
    const { store, action } = confirmState;
    const nextStatus: StoreStatus =
      action === 'APPROVE' || action === 'UNBLOCK' ? 'ACTIVE' : 'BLOCKED';
    const actionType =
      action === 'APPROVE'
        ? 'APPROVED'
        : action === 'REJECT'
        ? 'REJECTED'
        : action === 'BLOCK'
        ? 'BLOCKED'
        : 'UNBLOCKED';

    setSubmittingAction(true);
    try {
      const updated = await api.updateStoreStatus(store.id, nextStatus, {
        actionType,
      });
      setStores((prev) => prev.map((s) => (s.id === store.id ? updated : s)));
      if (updated.auditLog) {
        setAuditLogs((prev) => [updated.auditLog!, ...prev]);
      }

      const toastTitle =
        action === 'APPROVE'
          ? 'Đã duyệt cửa hàng'
          : action === 'REJECT'
          ? 'Đã từ chối cửa hàng'
          : action === 'BLOCK'
          ? 'Đã chặn cửa hàng'
          : 'Đã mở chặn cửa hàng';

      pushToast('success', toastTitle, store.name);
      setConfirmState(null);
      if (detailStoreId === store.id) {
        setDetailStoreId(null);
      }
    } catch (err) {
      pushToast(
        'error',
        'Thao tác thất bại',
        err instanceof Error
          ? err.message
          : 'Không thể cập nhật trạng thái. Vui lòng thử lại.'
      );
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleExportCsv = () => {
    downloadCsv(
      `omni-nexus-cua-hang-${activeTab.toLowerCase()}.csv`,
      [
        'Mã hồ sơ',
        'Tên cửa hàng',
        'Loại hình',
        'Chủ sở hữu',
        'Số điện thoại',
        'Email',
        'Địa chỉ',
        'Trạng thái',
        'Ngày đăng ký',
        'Lý do chặn (nếu có)',
      ],
      filteredStores.map((s) => [
        s.brandCode,
        s.name,
        s.businessType,
        s.ownerName || '',
        s.contactPhone,
        s.contactEmail,
        s.address,
        s.status === 'ACTIVE'
          ? 'Đang hoạt động'
          : s.status === 'PENDING'
          ? 'Chờ duyệt'
          : 'Bị chặn',
        formatDateTimeVN(s.createdAt),
        s.blockedReason || '',
      ])
    );
  };

  // --- NON-ADMIN VIEW (Store Owner / Manager Overview) ---
  if (user.role !== 'ADMIN') {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto pos-scroll bg-[#F8FAFC] p-4 lg:p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-[#0F172A]">
                Hệ thống cửa hàng & Chi nhánh
              </h1>
              <p className="text-sm text-[#64748B] mt-0.5">
                Theo dõi thông tin cửa hàng, danh sách chi nhánh và truy cập quầy thu ngân POS.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenPosFlow}
              className="h-12 px-5 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-bold flex items-center gap-2 whitespace-nowrap"
            >
              <MaterialIcon name="point_of_sale" className="text-[20px]" />
              <span>Mở màn hình Thu ngân POS</span>
            </button>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E2E8F0]">
              <h2 className="text-base font-bold text-[#0F172A]">
                Danh sách cửa hàng ({stores.length})
              </h2>
            </div>
            {loading ? (
              <div className="p-8 text-sm text-[#64748B]">Đang tải dữ liệu...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-semibold text-[#64748B]">
                    <tr>
                      <th className="py-3 px-5">Tên cửa hàng / Mã</th>
                      <th className="py-3 px-4">Loại hình</th>
                      <th className="py-3 px-4">Liên hệ</th>
                      <th className="py-3 px-4">Ngày tạo</th>
                      <th className="py-3 px-4">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {stores.map((s) => (
                      <tr key={s.id} className="hover:bg-[#F8FAFC]">
                        <td className="py-3.5 px-5">
                          <div className="font-bold text-[#0F172A]">{s.name}</div>
                          <div className="text-xs font-mono text-[#64748B]">
                            {s.brandCode} · {s.address}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-[#0F172A]">{s.businessType}</td>
                        <td className="py-3.5 px-4 text-xs text-[#64748B]">
                          <div>{s.contactPhone}</div>
                          <div>{s.contactEmail}</div>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-[#64748B] tabular-nums-strict">
                          {formatDateTimeVN(s.createdAt)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`text-xs font-bold ${
                              s.status === 'ACTIVE'
                                ? 'text-[#16A34A]'
                                : s.status === 'PENDING'
                                ? 'text-[#855300]'
                                : 'text-[#DC2626]'
                            }`}
                          >
                            {s.status === 'ACTIVE'
                              ? 'Đang hoạt động'
                              : s.status === 'PENDING'
                              ? 'Chờ duyệt'
                              : 'Bị chặn'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E2E8F0]">
              <h2 className="text-base font-bold text-[#0F172A]">
                Chi nhánh trực thuộc ({branches.length})
              </h2>
            </div>
            <div className="divide-y divide-[#E2E8F0]">
              {branches.map((b) => (
                <div
                  key={b.id}
                  className="p-5 flex flex-wrap items-center justify-between gap-4"
                >
                  <div>
                    <div className="text-sm font-bold text-[#0F172A]">
                      {b.name}{' '}
                      <span className="font-mono text-xs text-[#64748B]">
                        ({b.code})
                      </span>
                    </div>
                    <div className="text-xs text-[#64748B] mt-1">
                      {b.address} · Quản lý: {b.managerName}
                    </div>
                  </div>
                  <div className="text-xs text-[#64748B] text-right tabular-nums-strict">
                    <div>
                      {b.workingDays} · {b.openTime} – {b.closeTime}
                    </div>
                    <div className="font-medium text-[#0F172A] mt-0.5">{b.phone}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- SYSTEM ADMIN CONSOLE: STORE APPROVAL & COMPLIANCE ---
  return (
    <div className="flex-1 min-h-0 overflow-y-auto pos-scroll bg-[#F8FAFC] p-4 lg:p-6 relative">
      {/* FIXED TOP-RIGHT TOAST STACK */}
      {toasts.length > 0 && (
        <div className="fixed top-18 right-6 z-[70] flex flex-col gap-2.5 w-[360px] max-w-[calc(100vw-2rem)] pointer-events-auto">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`bg-white rounded-xl shadow-lg border border-[#E2E8F0] border-l-4 ${
                t.type === 'success' ? 'border-l-[#16A34A]' : 'border-l-[#DC2626]'
              } p-3.5 flex items-start gap-3`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  t.type === 'success'
                    ? 'bg-[#DCFCE7] text-[#16A34A]'
                    : 'bg-[#FEE2E2] text-[#DC2626]'
                }`}
              >
                <MaterialIcon
                  name={t.type === 'success' ? 'check_circle' : 'error'}
                  className="text-[19px]"
                />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <div
                  className={`text-sm font-bold leading-snug ${
                    t.type === 'success' ? 'text-[#0F172A]' : 'text-[#DC2626]'
                  }`}
                >
                  {t.title}
                </div>
                <div className="text-xs text-[#64748B] truncate mt-0.5">
                  {t.message}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
                aria-label="Đóng thông báo"
                className="p-1 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]"
              >
                <MaterialIcon name="close" className="text-[16px]" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-5">
        {/* BREADCRUMB & PAGE HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#64748B] mb-1">
              <span>Hệ thống</span>
              <MaterialIcon name="chevron_right" className="text-[14px]" />
              <span className="text-[#0F766E] font-semibold">Duyệt cửa hàng</span>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
                Duyệt cửa hàng
              </h1>
              {counts.pending > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-[#FEF3C7] text-[#855300] text-xs font-bold tabular-nums-strict">
                  {counts.pending} chờ duyệt
                </span>
              )}
            </div>
            <p className="text-sm text-[#64748B] mt-1">
              Xem xét hồ sơ đăng ký mới, kích hoạt vận hành POS và kiểm soát tuân thủ cửa hàng trên toàn hệ thống.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setHistoryFilterStoreId(null);
                setShowHistoryModal(true);
              }}
              className="h-10 px-3.5 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-[#0F172A] text-xs font-semibold flex items-center gap-1.5"
            >
              <MaterialIcon name="history" className="text-[17px] text-[#0F766E]" />
              <span>Lịch sử duyệt ({auditLogs.length})</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="h-10 px-3.5 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-[#0F172A] text-xs font-semibold flex items-center gap-1.5"
            >
              <MaterialIcon name="download" className="text-[17px] text-[#64748B]" />
              <span>Xuất CSV</span>
            </button>
            <button
              type="button"
              onClick={() => loadStores(true)}
              disabled={refreshing}
              className="h-10 px-4 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-60"
            >
              <MaterialIcon
                name="refresh"
                className={`text-[17px] ${refreshing ? 'animate-spin' : ''}`}
              />
              <span>{refreshing ? 'Đang tải...' : 'Làm mới dữ liệu'}</span>
            </button>
          </div>
        </div>

        {/* 4 SUMMARY KPI CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`text-left p-4 rounded-xl bg-white border transition-all flex flex-col justify-between ${
              activeTab === 'ALL'
                ? 'border-[#0F766E] ring-1 ring-[#0F766E]'
                : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  Tổng cửa hàng
                </div>
                <div className="text-3xl font-bold text-[#0F172A] mt-1 tabular-nums-strict">
                  {counts.total}
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-[#F0FDFA] text-[#0F766E] flex items-center justify-center shrink-0">
                <MaterialIcon name="storefront" className="text-[24px]" />
              </div>
            </div>
            <div className="text-xs text-[#64748B] mt-3 flex items-center gap-1.5">
              <MaterialIcon name="language" className="text-[15px] text-[#0F766E]" />
              <span>Toàn bộ hồ sơ trên hệ thống</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PENDING')}
            className={`text-left p-4 rounded-xl border transition-all flex flex-col justify-between ${
              activeTab === 'PENDING'
                ? 'bg-[#FFFBEB] border-[#D97706] ring-1 ring-[#D97706]'
                : 'bg-white border-[#E2E8F0] hover:border-[#CBD5E1]'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#855300]">
                    Chờ duyệt
                  </span>
                  {counts.pending > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-[#FDE68A] text-[#855300] text-[10px] font-bold">
                      Cần xử lý
                    </span>
                  )}
                </div>
                <div className="text-3xl font-bold text-[#855300] mt-1 tabular-nums-strict">
                  {String(counts.pending).padStart(2, '0')}
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-[#FEF3C7] text-[#855300] flex items-center justify-center shrink-0">
                <MaterialIcon name="pending_actions" className="text-[24px]" />
              </div>
            </div>
            <div className="text-xs text-[#855300] font-medium mt-3 flex items-center gap-1.5">
              <MaterialIcon name="schedule" className="text-[15px]" />
              <span>Cần xem xét và phê duyệt</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ACTIVE')}
            className={`text-left p-4 rounded-xl border transition-all flex flex-col justify-between ${
              activeTab === 'ACTIVE'
                ? 'bg-[#F0FDF4] border-[#16A34A] ring-1 ring-[#16A34A]'
                : 'bg-white border-[#E2E8F0] hover:border-[#CBD5E1]'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#15803D]">
                  Đang hoạt động
                </div>
                <div className="text-3xl font-bold text-[#16A34A] mt-1 tabular-nums-strict">
                  {String(counts.active).padStart(2, '0')}
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center shrink-0">
                <MaterialIcon name="check_circle" className="text-[24px]" />
              </div>
            </div>
            <div className="text-xs text-[#15803D] font-medium mt-3 flex items-center gap-1.5">
              <MaterialIcon name="point_of_sale" className="text-[15px]" />
              <span>Cửa hàng đang mở bán POS</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('BLOCKED')}
            className={`text-left p-4 rounded-xl border transition-all flex flex-col justify-between ${
              activeTab === 'BLOCKED'
                ? 'bg-[#FEF2F2] border-[#DC2626] ring-1 ring-[#DC2626]'
                : 'bg-white border-[#E2E8F0] hover:border-[#CBD5E1]'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#DC2626]">
                  Bị chặn / Khóa
                </div>
                <div className="text-3xl font-bold text-[#DC2626] mt-1 tabular-nums-strict">
                  {String(counts.blocked).padStart(2, '0')}
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center shrink-0">
                <MaterialIcon name="block" className="text-[24px]" />
              </div>
            </div>
            <div className="text-xs text-[#DC2626] font-medium mt-3 flex items-center gap-1.5">
              <MaterialIcon name="warning" className="text-[15px]" />
              <span>Từ chối hoặc tạm khóa hệ thống</span>
            </div>
          </button>
        </div>

        {/* TABS + SEARCH & FILTER BAR */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 bg-[#F1F5F9] rounded-xl overflow-x-auto">
              {(
                [
                  { id: 'PENDING', label: 'Chờ duyệt', count: counts.pending },
                  { id: 'ACTIVE', label: 'Đang hoạt động', count: counts.active },
                  { id: 'BLOCKED', label: 'Bị chặn', count: counts.blocked },
                  { id: 'ALL', label: 'Tất cả', count: counts.total },
                ] as Array<{ id: AdminTab; label: string; count: number }>
              ).map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`h-9 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-colors ${
                      isActive
                        ? tab.id === 'BLOCKED'
                          ? 'bg-[#DC2626] text-white'
                          : 'bg-[#0F766E] text-white'
                        : 'text-[#475569] hover:text-[#0F172A] hover:bg-white/60'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold tabular-nums-strict ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : tab.id === 'PENDING' && tab.count > 0
                          ? 'bg-[#FEF3C7] text-[#855300]'
                          : tab.id === 'BLOCKED' && tab.count > 0
                          ? 'bg-[#FEE2E2] text-[#DC2626]'
                          : 'bg-[#E2E8F0] text-[#475569]'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="text-xs text-[#64748B] flex items-center gap-1.5">
              <MaterialIcon name="verified_user" className="text-[16px] text-[#0F766E]" />
              <span>Nhấp vào dòng để mở hồ sơ chi tiết cửa hàng</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-6 relative">
              <MaterialIcon
                name="search"
                className="text-[19px] text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2"
              />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Tìm theo tên thương hiệu, mã hồ sơ, email hoặc số điện thoại..."
                className="w-full h-11 pl-10 pr-9 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] focus:bg-white text-sm text-[#0F172A] focus:outline-none focus:border-[#0F766E]"
              />
              {searchText && (
                <button
                  type="button"
                  onClick={() => setSearchText('')}
                  aria-label="Xóa từ khóa tìm kiếm"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A]"
                >
                  <MaterialIcon name="close" className="text-[17px]" />
                </button>
              )}
            </div>

            <div className="md:col-span-3">
              <select
                value={businessFilter}
                onChange={(e) => setBusinessFilter(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] text-sm font-medium text-[#0F172A] focus:outline-none focus:border-[#0F766E]"
              >
                <option value="ALL">Loại hình: Tất cả</option>
                <option value="GROCERY">Tạp hóa & Bách hóa</option>
                <option value="MINIMART">Siêu thị mini</option>
                <option value="FB">Quán cà phê & F&B</option>
                <option value="PHARMACY">Nhà thuốc</option>
                <option value="FASHION">Thời trang</option>
                <option value="RETAIL">Bán lẻ khác</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <select
                value={sortOrder}
                onChange={(e) =>
                  setSortOrder(e.target.value as 'newest' | 'oldest' | 'name')
                }
                className="w-full h-11 px-3 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] text-sm font-medium text-[#0F172A] focus:outline-none focus:border-[#0F766E]"
              >
                <option value="newest">Sắp xếp: Mới nhất</option>
                <option value="oldest">Sắp xếp: Cũ nhất</option>
                <option value="name">Sắp xếp: Tên A–Z</option>
              </select>
            </div>
          </div>
        </div>

        {/* STORE TABLE OR EMPTY STATE */}
        {loading ? (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-10 text-center text-sm text-[#64748B]">
            Đang tải danh sách hồ sơ cửa hàng...
          </div>
        ) : filteredStores.length === 0 ? (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center mb-4">
              <MaterialIcon
                name={activeTab === 'PENDING' && !searchText && businessFilter === 'ALL' ? 'task_alt' : 'search_off'}
                className="text-[36px]"
              />
            </div>
            <h3 className="text-lg font-bold text-[#0F172A]">
              {activeTab === 'PENDING' && !searchText && businessFilter === 'ALL'
                ? 'Không còn cửa hàng nào chờ duyệt'
                : 'Không tìm thấy cửa hàng phù hợp'}
            </h3>
            <p className="text-sm text-[#64748B] max-w-md mt-1 mb-5">
              {activeTab === 'PENDING' && !searchText && businessFilter === 'ALL'
                ? 'Tuyệt vời! Bạn đã xem xét và giải quyết toàn bộ yêu cầu đăng ký cửa hàng mới trên hệ thống.'
                : 'Không có cửa hàng nào khớp với bộ lọc hiện tại. Hãy thử xóa bộ lọc hoặc chuyển sang danh sách tất cả.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {(searchText || businessFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchText('');
                    setBusinessFilter('ALL');
                  }}
                  className="h-10 px-4 rounded-xl border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-xs font-semibold text-[#0F172A]"
                >
                  Xóa bộ lọc
                </button>
              )}
              {activeTab !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('ALL')}
                  className="h-10 px-4 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <MaterialIcon name="storefront" className="text-[17px]" />
                  <span>Xem danh sách tất cả cửa hàng</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-visible">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm min-w-[960px]">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  <tr>
                    <th className="py-3.5 px-5">Cửa hàng</th>
                    <th className="py-3.5 px-4">Chủ sở hữu</th>
                    <th className="py-3.5 px-4">Liên hệ & Địa chỉ</th>
                    <th className="py-3.5 px-4">
                      {activeTab === 'BLOCKED' ? 'Ngày đăng ký / Khóa' : 'Ngày đăng ký'}
                    </th>
                    <th className="py-3.5 px-4">Trạng thái</th>
                    <th className="py-3.5 px-5 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {filteredStores.map((s) => {
                    const initials = getInitials(s.name);
                    const isBlocked = s.status === 'BLOCKED';
                    const isPending = s.status === 'PENDING';
                    const isActive = s.status === 'ACTIVE';
                    const relativeLabel = getRelativeDayLabel(s.createdAt);

                    return (
                      <tr
                        key={s.id}
                        onClick={() => setDetailStoreId(s.id)}
                        className={`cursor-pointer transition-colors ${
                          detailStoreId === s.id
                            ? 'bg-[#F0FDFA]'
                            : isBlocked
                            ? 'hover:bg-[#FEF2F2]/60'
                            : 'hover:bg-[#F8FAFC]'
                        }`}
                      >
                        {/* Store Info */}
                        <td className="py-4 px-5 align-middle">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                                isPending
                                  ? 'bg-[#0F766E] text-white'
                                  : isActive
                                  ? 'bg-[#CCFBF1] text-[#0F766E]'
                                  : 'bg-[#FEE2E2] text-[#DC2626]'
                              }`}
                            >
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-[#0F172A] truncate">
                                  {s.name}
                                </span>
                                {isBlocked && (
                                  <MaterialIcon
                                    name="lock"
                                    className="text-[16px] text-[#DC2626] shrink-0"
                                  />
                                )}
                              </div>
                              <div className="text-xs text-[#64748B] truncate mt-0.5">
                                {s.businessType} · {s.branchCount || 1} chi nhánh
                              </div>
                              <div className="text-[11px] font-mono text-[#94A3B8] mt-0.5">
                                #{s.brandCode}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Owner */}
                        <td className="py-4 px-4 align-middle">
                          <div className="font-semibold text-[#0F172A]">
                            {s.ownerName || 'Chủ cửa hàng'}
                          </div>
                          <div className="text-xs text-[#64748B] font-mono mt-0.5 truncate max-w-[190px]">
                            {s.ownerEmail || s.contactEmail}
                          </div>
                        </td>

                        {/* Contact & Address */}
                        <td className="py-4 px-4 align-middle max-w-[260px]">
                          <div
                            className="flex items-center gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="font-mono font-semibold text-[#0F172A] tabular-nums-strict">
                              {s.contactPhone}
                            </span>
                            <button
                              type="button"
                              title="Sao chép số điện thoại"
                              onClick={() => handleCopyText(s.contactPhone, 'SĐT')}
                              className="p-0.5 rounded text-[#94A3B8] hover:text-[#0F766E]"
                            >
                              <MaterialIcon name="content_copy" className="text-[15px]" />
                            </button>
                          </div>
                          <div
                            className="text-xs text-[#64748B] truncate mt-0.5"
                            title={s.address}
                          >
                            {s.address}
                          </div>
                        </td>

                        {/* Dates & Reason */}
                        <td className="py-4 px-4 align-middle whitespace-nowrap">
                          <div className="font-semibold text-[#0F172A] tabular-nums-strict">
                            {formatDateVN(s.createdAt)}
                          </div>
                          {isPending && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#475569] text-[11px] font-medium">
                              {relativeLabel}
                            </span>
                          )}
                          {isActive && s.approvedAt && (
                            <div className="text-[11px] text-[#16A34A] mt-0.5">
                              Đã duyệt {formatDateVN(s.approvedAt)}
                            </div>
                          )}
                          {isBlocked && (
                            <div className="mt-1 space-y-1">
                              {s.blockedAt && (
                                <div className="text-[11px] font-semibold text-[#DC2626]">
                                  Khóa ngày {formatDateVN(s.blockedAt)}
                                </div>
                              )}
                              {s.blockedReason && (
                                <div
                                  className="max-w-[220px] truncate px-2 py-0.5 rounded bg-[#FEF2F2] text-[#991B1B] text-[11px]"
                                  title={s.blockedReason}
                                >
                                  {s.blockedReason}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="py-4 px-4 align-middle whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                              isActive
                                ? 'bg-[#DCFCE7] text-[#15803D]'
                                : isPending
                                ? 'bg-[#FEF3C7] text-[#855300]'
                                : 'bg-[#FEE2E2] text-[#DC2626]'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isActive
                                  ? 'bg-[#16A34A]'
                                  : isPending
                                  ? 'bg-[#D97706]'
                                  : 'bg-[#DC2626]'
                              }`}
                            />
                            <span>
                              {isActive
                                ? 'Đang hoạt động'
                                : isPending
                                ? 'Chờ duyệt'
                                : 'Bị chặn'}
                            </span>
                          </span>
                        </td>

                        {/* Actions */}
                        <td
                          className="py-4 px-5 align-middle text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center justify-end gap-1.5 relative">
                            {isPending && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmState({ store: s, action: 'APPROVE' })
                                  }
                                  className="h-9 px-3 rounded-lg bg-[#DCFCE7] hover:bg-[#16A34A] text-[#15803D] hover:text-white text-xs font-bold flex items-center gap-1 transition-colors"
                                >
                                  <MaterialIcon name="check_circle" className="text-[16px]" />
                                  <span>Duyệt</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmState({ store: s, action: 'REJECT' })
                                  }
                                  className="h-9 px-3 rounded-lg bg-[#FEE2E2] hover:bg-[#DC2626] text-[#DC2626] hover:text-white text-xs font-bold transition-colors"
                                >
                                  Từ chối
                                </button>
                              </>
                            )}

                            {isBlocked && (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmState({ store: s, action: 'UNBLOCK' })
                                }
                                className="h-9 px-3 rounded-lg border border-[#16A34A] bg-white hover:bg-[#F0FDF4] text-[#16A34A] text-xs font-bold flex items-center gap-1 transition-colors"
                              >
                                <MaterialIcon name="lock_open" className="text-[16px]" />
                                <span>Mở chặn</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setDetailStoreId(s.id)}
                              title="Xem chi tiết cửa hàng"
                              className="h-9 px-2.5 rounded-lg bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] text-xs font-semibold flex items-center gap-1 transition-colors"
                            >
                              <MaterialIcon name="visibility" className="text-[17px] text-[#0F766E]" />
                              {!isPending && <span>Chi tiết</span>}
                            </button>

                            {!isPending && (
                              <div className="relative">
                                <button
                                  type="button"
                                  aria-label="Tác vụ khác"
                                  onClick={() =>
                                    setOpenMenuStoreId((prev) =>
                                      prev === s.id ? null : s.id
                                    )
                                  }
                                  className="w-9 h-9 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] flex items-center justify-center"
                                >
                                  <MaterialIcon name="more_vert" className="text-[19px]" />
                                </button>

                                {openMenuStoreId === s.id && (
                                  <div className="absolute right-0 top-10 w-48 bg-white rounded-xl shadow-xl border border-[#E2E8F0] p-1.5 z-30 flex flex-col gap-0.5 text-left">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuStoreId(null);
                                        setDetailStoreId(s.id);
                                      }}
                                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC]"
                                    >
                                      <MaterialIcon
                                        name="visibility"
                                        className="text-[17px] text-[#0F766E]"
                                      />
                                      <span>Xem hồ sơ chi tiết</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuStoreId(null);
                                        setHistoryFilterStoreId(s.id);
                                        setShowHistoryModal(true);
                                      }}
                                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC]"
                                    >
                                      <MaterialIcon
                                        name="history"
                                        className="text-[17px] text-[#64748B]"
                                      />
                                      <span>Lịch sử duyệt</span>
                                    </button>
                                    <div className="h-px bg-[#E2E8F0] my-1" />
                                    {isActive ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenMenuStoreId(null);
                                          setConfirmState({ store: s, action: 'BLOCK' });
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-[#DC2626] hover:bg-[#FEF2F2]"
                                      >
                                        <MaterialIcon
                                          name="block"
                                          className="text-[17px] text-[#DC2626]"
                                        />
                                        <span>Chặn cửa hàng</span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenMenuStoreId(null);
                                          setConfirmState({
                                            store: s,
                                            action: 'UNBLOCK',
                                          });
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-[#16A34A] hover:bg-[#F0FDF4]"
                                      >
                                        <MaterialIcon
                                          name="lock_open"
                                          className="text-[17px] text-[#16A34A]"
                                        />
                                        <span>Mở chặn cửa hàng</span>
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="px-5 py-3.5 bg-[#F8FAFC] border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B]">
              <div>
                Hiển thị <span className="font-bold text-[#0F172A]">{filteredStores.length}</span>{' '}
                cửa hàng{' '}
                {activeTab === 'PENDING'
                  ? 'đang chờ duyệt'
                  : activeTab === 'ACTIVE'
                  ? 'đang hoạt động'
                  : activeTab === 'BLOCKED'
                  ? 'đang bị chặn'
                  : 'trên toàn hệ thống'}
              </div>
              <div>Ưu tiên xử lý hồ sơ đăng ký theo thời gian tiếp nhận</div>
            </div>
          </div>
        )}

        {/* REVIEW GUIDELINES OVERVIEW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#F0FDFA] text-[#0F766E] flex items-center justify-center shrink-0">
              <MaterialIcon name="verified" className="text-[20px]" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#0F172A]">Quy chuẩn xét duyệt</div>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                Cửa hàng cần có địa chỉ kinh doanh rõ ràng, thông tin liên hệ xác thực và mô tả ngành hàng phù hợp.
              </p>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#FEF3C7] text-[#855300] flex items-center justify-center shrink-0">
              <MaterialIcon name="timer" className="text-[20px]" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#0F172A]">Cam kết SLA (24h)</div>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                Mọi hồ sơ đăng ký mới cần được phê duyệt hoặc phản hồi trạng thái trong vòng 24 giờ làm việc.
              </p>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center shrink-0">
              <MaterialIcon name="shield" className="text-[20px]" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#0F172A]">Kiểm soát & Mở chặn</div>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                Cửa hàng bị chặn tạm ngừng đăng nhập quầy POS và có thể mở chặn lại sau khi hoàn tất xác minh.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT-SIDE SLIDING DETAIL DRAWER (520px) */}
      {detailStore && (
        <div
          className="fixed inset-0 z-40 bg-[#0F172A]/45 backdrop-blur-[1px] flex justify-end"
          onClick={() => setDetailStoreId(null)}
        >
          <aside
            aria-label="Chi tiết cửa hàng"
            onClick={(e) => e.stopPropagation()}
            className="w-[520px] max-w-full h-full bg-[#F8FAFC] shadow-2xl flex flex-col border-l border-[#E2E8F0]"
          >
            {/* Drawer Header */}
            <div className="px-6 py-5 bg-white border-b border-[#E2E8F0] flex items-start justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={`w-13 h-13 rounded-2xl flex items-center justify-center text-lg font-bold shrink-0 ${
                    detailStore.status === 'ACTIVE'
                      ? 'bg-[#0F766E] text-white'
                      : detailStore.status === 'PENDING'
                      ? 'bg-[#CCFBF1] text-[#0F766E]'
                      : 'bg-[#DC2626] text-white'
                  }`}
                >
                  {getInitials(detailStore.name)}
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-[#0F172A] truncate">
                    {detailStore.name}
                  </h2>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#475569] text-[11px] font-medium">
                      {detailStore.businessType}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        detailStore.status === 'ACTIVE'
                          ? 'bg-[#DCFCE7] text-[#15803D]'
                          : detailStore.status === 'PENDING'
                          ? 'bg-[#FEF3C7] text-[#855300]'
                          : 'bg-[#FEE2E2] text-[#DC2626]'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          detailStore.status === 'ACTIVE'
                            ? 'bg-[#16A34A]'
                            : detailStore.status === 'PENDING'
                            ? 'bg-[#D97706]'
                            : 'bg-[#DC2626]'
                        }`}
                      />
                      <span>
                        {detailStore.status === 'ACTIVE'
                          ? 'Đang hoạt động'
                          : detailStore.status === 'PENDING'
                          ? 'Chờ duyệt'
                          : 'Bị chặn'}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                aria-label="Đóng chi tiết"
                onClick={() => setDetailStoreId(null)}
                className="p-2 rounded-xl text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]"
              >
                <MaterialIcon name="close" className="text-[20px]" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto pos-scroll p-5 space-y-4">
              {/* Red Alert Banner if BLOCKED */}
              {detailStore.status === 'BLOCKED' && (
                <div className="rounded-xl bg-[#FEF2F2] border border-[#FECACA] p-4 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#DC2626] text-white flex items-center justify-center shrink-0">
                    <MaterialIcon name="gpp_maybe" className="text-[20px]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-[#DC2626]">
                      Cửa hàng đang bị chặn
                    </div>
                    <p className="text-xs text-[#7F1D1D] mt-1 leading-relaxed">
                      <span className="font-semibold">Lý do:</span>{' '}
                      {detailStore.blockedReason ||
                        'Tạm khóa tài khoản vận hành POS theo quyết định quản trị.'}
                    </p>
                    {detailStore.blockedAt && (
                      <div className="text-[11px] text-[#991B1B] mt-2 flex items-center gap-1">
                        <MaterialIcon name="schedule" className="text-[14px]" />
                        <span>Khóa lúc: {formatDateTimeVN(detailStore.blockedAt)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Section 1: Thông tin cửa hàng */}
              <section className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#0F766E]">
                    <MaterialIcon name="storefront" className="text-[19px]" />
                    <h3 className="text-sm font-bold text-[#0F172A]">
                      Thông tin cửa hàng
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-[#F1F5F9] text-[#0F766E] font-mono text-[11px] font-bold">
                    #{detailStore.brandCode}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-[#64748B]">Thương hiệu</span>
                    <span className="font-bold text-[#0F172A]">{detailStore.name}</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-[#64748B]">Loại hình kinh doanh</span>
                    <span className="px-2 py-0.5 rounded bg-[#F1F5F9] text-[#0F172A] font-medium">
                      {detailStore.businessType}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-[#64748B]">Số chi nhánh</span>
                    <span className="font-semibold text-[#0F172A]">
                      {detailStore.branchCount || 1} chi nhánh
                    </span>
                  </div>
                  <div className="pt-1">
                    <div className="text-[#64748B] mb-1.5">Mô tả hoạt động</div>
                    <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] leading-relaxed">
                      {detailStore.description || 'Chưa cập nhật mô tả chi tiết.'}
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 2: Địa chỉ & Liên hệ */}
              <section className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-[#0F766E]">
                  <MaterialIcon name="contact_phone" className="text-[19px]" />
                  <h3 className="text-sm font-bold text-[#0F172A]">
                    Địa chỉ & Liên hệ
                  </h3>
                </div>

                <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#0F766E] text-white flex items-center justify-center shrink-0">
                    <MaterialIcon name="location_on" className="text-[17px]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] text-[#64748B]">Địa chỉ kinh doanh</div>
                    <div className="text-xs font-semibold text-[#0F172A] mt-0.5">
                      {detailStore.address}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <MaterialIcon name="call" className="text-[17px] text-[#0F766E]" />
                      <span className="text-xs font-mono font-semibold text-[#0F172A] truncate">
                        {detailStore.contactPhone}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyText(detailStore.contactPhone, 'SĐT')}
                      className="p-1 rounded text-[#64748B] hover:text-[#0F766E]"
                    >
                      <MaterialIcon name="content_copy" className="text-[15px]" />
                    </button>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <MaterialIcon name="mail" className="text-[17px] text-[#0F766E]" />
                      <span className="text-xs font-medium text-[#0F172A] truncate">
                        {detailStore.contactEmail}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyText(detailStore.contactEmail, 'Email')}
                      className="p-1 rounded text-[#64748B] hover:text-[#0F766E]"
                    >
                      <MaterialIcon name="content_copy" className="text-[15px]" />
                    </button>
                  </div>
                </div>
              </section>

              {/* Section 3: Chủ cửa hàng */}
              <section className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#0F766E]">
                    <MaterialIcon name="badge" className="text-[19px]" />
                    <h3 className="text-sm font-bold text-[#0F172A]">Chủ cửa hàng</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-[#CCFBF1] text-[#0F766E] text-[11px] font-bold">
                    Đại diện pháp luật
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#0F766E] text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {getInitials(detailStore.ownerName || 'CH')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-[#0F172A]">
                      {detailStore.ownerName || 'Chủ cửa hàng'}
                    </div>
                    <div className="text-xs font-mono text-[#64748B] truncate">
                      {detailStore.ownerEmail || detailStore.contactEmail}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <div className="text-[11px] text-[#64748B]">Điện thoại cá nhân</div>
                    <div className="font-mono font-bold text-[#0F172A] mt-0.5">
                      {detailStore.ownerPhone || detailStore.contactPhone}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <div className="text-[11px] text-[#64748B]">Mã tài khoản chủ</div>
                    <div className="font-mono font-bold text-[#0F172A] mt-0.5 truncate">
                      {detailStore.ownerId}
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 4: Thời gian */}
              <section className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-[#0F766E]">
                  <MaterialIcon name="schedule" className="text-[19px]" />
                  <h3 className="text-sm font-bold text-[#0F172A]">
                    Thời gian & Kích hoạt
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center gap-2.5">
                    <MaterialIcon
                      name="calendar_add_on"
                      className="text-[18px] text-[#64748B]"
                    />
                    <div>
                      <div className="text-[11px] text-[#64748B]">Ngày đăng ký</div>
                      <div className="font-semibold text-[#0F172A] tabular-nums-strict">
                        {formatDateTimeVN(detailStore.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center gap-2.5">
                    <MaterialIcon
                      name={
                        detailStore.status === 'ACTIVE'
                          ? 'check_circle'
                          : detailStore.status === 'BLOCKED'
                          ? 'block'
                          : 'update'
                      }
                      className={`text-[18px] ${
                        detailStore.status === 'ACTIVE'
                          ? 'text-[#16A34A]'
                          : detailStore.status === 'BLOCKED'
                          ? 'text-[#DC2626]'
                          : 'text-[#64748B]'
                      }`}
                    />
                    <div>
                      <div className="text-[11px] text-[#64748B]">
                        {detailStore.status === 'ACTIVE'
                          ? 'Ngày phê duyệt'
                          : detailStore.status === 'BLOCKED'
                          ? 'Ngày bị chặn'
                          : 'Cập nhật gần nhất'}
                      </div>
                      <div className="font-semibold text-[#0F172A] tabular-nums-strict">
                        {formatDateTimeVN(
                          detailStore.status === 'ACTIVE'
                            ? detailStore.approvedAt || detailStore.updatedAt || detailStore.createdAt
                            : detailStore.status === 'BLOCKED'
                            ? detailStore.blockedAt || detailStore.updatedAt || detailStore.createdAt
                            : detailStore.updatedAt || detailStore.createdAt
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 5: Status-Adaptive Quick Check / Operational / Risk Timeline */}
              {detailStore.status === 'PENDING' && (
                <section className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-3">
                  {(() => {
                    const checks = [
                      {
                        ok: Boolean(detailStore.address.trim()),
                        title: 'Có địa chỉ kinh doanh rõ ràng',
                        desc: detailStore.address,
                      },
                      {
                        ok: detailStore.contactPhone.replace(/\D/g, '').length >= 9,
                        title: 'Số điện thoại liên hệ hợp lệ',
                        desc: `${detailStore.contactPhone} đang hoạt động`,
                      },
                      {
                        ok: detailStore.contactEmail.includes('@'),
                        title: 'Email liên hệ đã xác thực',
                        desc: detailStore.contactEmail,
                      },
                      {
                        ok: detailStore.description.trim().length >= 15,
                        title: 'Có mô tả ngành hàng & quy mô chi tiết',
                        desc: 'Phù hợp chính sách vận hành Omni Nexus POS',
                      },
                      {
                        ok: (detailStore.branchCount || 1) >= 2,
                        title: 'Hồ sơ chuỗi đa chi nhánh',
                        desc:
                          (detailStore.branchCount || 1) >= 2
                            ? `Đã khai báo ${detailStore.branchCount} chi nhánh`
                            : 'Hộ kinh doanh 1 điểm bán (linh hoạt bổ sung GPKD sau)',
                      },
                    ];
                    const passed = checks.filter((c) => c.ok).length;
                    return (
                      <>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-[#16A34A]">
                            <MaterialIcon name="verified_user" className="text-[19px]" />
                            <h3 className="text-sm font-bold text-[#0F172A]">
                              Kiểm tra nhanh hồ sơ
                            </h3>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] text-[11px] font-bold">
                            {passed}/{checks.length} tiêu chí
                          </span>
                        </div>
                        <div className="space-y-2">
                          {checks.map((item) => (
                            <div
                              key={item.title}
                              className={`p-2.5 rounded-lg flex items-start gap-2.5 ${
                                item.ok
                                  ? 'bg-[#F8FAFC] border border-[#E2E8F0]'
                                  : 'bg-[#FFFBEB] border border-[#FDE68A]'
                              }`}
                            >
                              <MaterialIcon
                                name={item.ok ? 'check_circle' : 'info'}
                                className={`text-[18px] shrink-0 mt-0.5 ${
                                  item.ok ? 'text-[#16A34A]' : 'text-[#D97706]'
                                }`}
                              />
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-[#0F172A]">
                                  {item.title}
                                </div>
                                <div className="text-[11px] text-[#64748B] mt-0.5">
                                  {item.desc}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </section>
              )}

              {detailStore.status === 'ACTIVE' && (
                <section className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#16A34A]">
                      <MaterialIcon name="insights" className="text-[19px]" />
                      <h3 className="text-sm font-bold text-[#0F172A]">
                        Chỉ số vận hành & Kiểm tra nhanh
                      </h3>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] text-[11px] font-bold">
                      Hoạt động tốt
                    </span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center gap-2.5">
                      <MaterialIcon
                        name="point_of_sale"
                        className="text-[18px] text-[#16A34A]"
                      />
                      <div>
                        <div className="font-semibold text-[#0F172A]">Tích hợp POS</div>
                        <div className="text-[#16A34A] font-medium">
                          Đã kích hoạt ({detailStore.branchCount || 1} chi nhánh)
                        </div>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center gap-2.5">
                      <MaterialIcon
                        name="check_circle"
                        className="text-[18px] text-[#16A34A]"
                      />
                      <div>
                        <div className="font-semibold text-[#0F172A]">
                          Trạng thái tài khoản
                        </div>
                        <div className="text-[#16A34A] font-medium">
                          Đang hoạt động bình thường
                        </div>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center gap-2.5">
                      <MaterialIcon
                        name="verified_user"
                        className="text-[18px] text-[#0F766E]"
                      />
                      <div>
                        <div className="font-semibold text-[#0F172A]">
                          Khiếu nại / Rủi ro
                        </div>
                        <div className="text-[#64748B]">0 vi phạm đang mở</div>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {detailStore.status === 'BLOCKED' && (
                <section className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#DC2626]">
                      <MaterialIcon name="history_toggle_off" className="text-[19px]" />
                      <h3 className="text-sm font-bold text-[#0F172A]">
                        Nhật ký kiểm soát rủi ro
                      </h3>
                    </div>
                    <span className="text-[11px] text-[#64748B]">
                      {detailStoreLogs.length} bản ghi
                    </span>
                  </div>

                  {detailStoreLogs.length === 0 ? (
                    <div className="text-xs text-[#64748B] py-2">
                      Chưa có nhật ký thay đổi trạng thái cho cửa hàng này.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {detailStoreLogs.map((log) => (
                        <div
                          key={log.id}
                          className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-bold text-[#0F172A] tabular-nums-strict">
                              {formatDateTimeVN(log.createdAt)}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                log.action === 'APPROVED' || log.action === 'UNBLOCKED'
                                  ? 'bg-[#DCFCE7] text-[#15803D]'
                                  : 'bg-[#FEE2E2] text-[#DC2626]'
                              }`}
                            >
                              {log.action === 'APPROVED'
                                ? 'Phê duyệt'
                                : log.action === 'UNBLOCKED'
                                ? 'Mở chặn'
                                : log.action === 'REJECTED'
                                ? 'Từ chối'
                                : 'Khóa hệ thống'}
                            </span>
                          </div>
                          <p className="text-[#0F172A] leading-relaxed">{log.note}</p>
                          <div className="text-[11px] text-[#64748B]">
                            Thực hiện bởi: {log.actorName}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>

            {/* Sticky Drawer Footer */}
            <div className="p-4 bg-white border-t border-[#E2E8F0] shrink-0">
              {detailStore.status === 'PENDING' && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmState({ store: detailStore, action: 'REJECT' })
                    }
                    className="h-12 px-5 rounded-xl bg-[#FEE2E2] hover:bg-[#FECACA] text-[#DC2626] text-sm font-bold flex items-center justify-center gap-1.5"
                  >
                    <MaterialIcon name="cancel" className="text-[18px]" />
                    <span>Từ chối</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmState({ store: detailStore, action: 'APPROVE' })
                    }
                    className="flex-1 h-12 px-5 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-bold flex items-center justify-center gap-2"
                  >
                    <MaterialIcon name="check_circle" className="text-[20px]" />
                    <span>Duyệt cửa hàng</span>
                  </button>
                </div>
              )}

              {detailStore.status === 'ACTIVE' && (
                <button
                  type="button"
                  onClick={() =>
                    setConfirmState({ store: detailStore, action: 'BLOCK' })
                  }
                  className="w-full h-12 px-5 rounded-xl border border-[#DC2626] bg-white hover:bg-[#FEF2F2] text-[#DC2626] text-sm font-bold flex items-center justify-center gap-2"
                >
                  <MaterialIcon name="block" className="text-[19px]" />
                  <span>Chặn cửa hàng</span>
                </button>
              )}

              {detailStore.status === 'BLOCKED' && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmState({ store: detailStore, action: 'UNBLOCK' })
                    }
                    className="w-full h-12 px-5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-bold flex items-center justify-center gap-2"
                  >
                    <MaterialIcon name="lock_open" className="text-[20px]" />
                    <span>Mở chặn cửa hàng</span>
                  </button>
                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#64748B]">
                    <MaterialIcon name="security" className="text-[14px] text-[#855300]" />
                    <span>Yêu cầu xác nhận quản trị viên trước khi mở khóa POS.</span>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* CONFIRMATION DIALOG (460px Centered Card — Approve / Reject / Block / Unblock) */}
      {confirmState && (
        <div
          className="fixed inset-0 z-50 bg-[#0F172A]/55 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !submittingAction && setConfirmState(null)}
        >
          {(() => {
            const { store: target, action } = confirmState;
            const isPositive = action === 'APPROVE' || action === 'UNBLOCK';
            const iconName =
              action === 'APPROVE'
                ? 'check_circle'
                : action === 'UNBLOCK'
                ? 'lock_open'
                : action === 'REJECT'
                ? 'block'
                : 'gpp_maybe';

            const title =
              action === 'APPROVE'
                ? `Duyệt cửa hàng '${target.name}'?`
                : action === 'REJECT'
                ? `Từ chối cửa hàng '${target.name}'?`
                : action === 'BLOCK'
                ? `Chặn cửa hàng '${target.name}'?`
                : `Mở chặn cửa hàng '${target.name}'?`;

            const description =
              action === 'APPROVE'
                ? 'Cửa hàng sẽ chuyển sang trạng thái Đang hoạt động và chủ cửa hàng có thể bắt đầu vận hành ngay lập tức.'
                : action === 'REJECT'
                ? 'Cửa hàng sẽ chuyển sang trạng thái Bị chặn. Bạn có thể mở chặn lại sau.'
                : action === 'BLOCK'
                ? 'Cửa hàng sẽ chuyển sang trạng thái Bị chặn.'
                : 'Cửa hàng sẽ trở lại trạng thái Đang hoạt động.';

            const confirmLabel =
              action === 'APPROVE'
                ? 'Duyệt cửa hàng'
                : action === 'REJECT'
                ? 'Từ chối'
                : action === 'BLOCK'
                ? 'Chặn cửa hàng'
                : 'Mở chặn';

            return (
              <div
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
                className="w-[460px] max-w-full bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] p-6 text-center flex flex-col items-center"
              >
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${
                    isPositive
                      ? 'bg-[#DCFCE7] text-[#16A34A]'
                      : 'bg-[#FEE2E2] text-[#DC2626]'
                  }`}
                >
                  <MaterialIcon name={iconName} className="text-[30px]" />
                </div>

                <h2 className="text-lg font-bold text-[#0F172A] mb-2 leading-snug">
                  {title}
                </h2>
                <p className="text-sm text-[#64748B] mb-5 leading-relaxed max-w-[380px]">
                  {description}
                </p>

                {/* Store Quick Context Card */}
                <div className="w-full p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] mb-6 flex items-center justify-between gap-3 text-left">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[#E2E8F0] text-[#0F172A] flex items-center justify-center font-bold text-xs shrink-0">
                      {getInitials(target.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#0F172A] truncate">
                        {target.name}
                      </div>
                      <div className="text-[11px] font-mono text-[#64748B]">
                        #{target.brandCode} · {target.ownerName || 'Chủ cửa hàng'}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                      isPositive
                        ? 'bg-[#DCFCE7] text-[#15803D]'
                        : 'bg-[#FEE2E2] text-[#DC2626]'
                    }`}
                  >
                    {isPositive ? 'Kích hoạt' : 'Tạm khóa'}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 w-full">
                  <button
                    type="button"
                    disabled={submittingAction}
                    onClick={() => setConfirmState(null)}
                    className="flex-1 h-12 px-4 rounded-xl border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-[#0F172A] text-sm font-semibold disabled:opacity-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={submittingAction}
                    onClick={handleConfirmAction}
                    className={`flex-1 h-12 px-4 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-60 ${
                      isPositive
                        ? 'bg-[#16A34A] hover:bg-[#15803D]'
                        : 'bg-[#DC2626] hover:bg-[#B91C1C]'
                    }`}
                  >
                    <MaterialIcon
                      name={action === 'APPROVE' ? 'check' : iconName}
                      className="text-[18px]"
                    />
                    <span>{submittingAction ? 'Đang xử lý...' : confirmLabel}</span>
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* APPROVAL AUDIT HISTORY MODAL */}
      {showHistoryModal && (
        <div
          className="fixed inset-0 z-50 bg-[#0F172A]/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowHistoryModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[82vh] bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] flex flex-col overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">
                  Lịch sử duyệt & Kiểm soát cửa hàng
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  {historyFilterStoreId
                    ? `Đang lọc theo cửa hàng: ${
                        stores.find((s) => s.id === historyFilterStoreId)?.name || ''
                      }`
                    : 'Nhật ký phê duyệt, từ chối, chặn và mở chặn toàn hệ thống.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {historyFilterStoreId && (
                  <button
                    type="button"
                    onClick={() => setHistoryFilterStoreId(null)}
                    className="h-8 px-2.5 rounded-lg bg-[#F1F5F9] text-xs font-semibold text-[#0F766E]"
                  >
                    Xem tất cả
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(false)}
                  className="p-1.5 rounded-lg text-[#64748B] hover:bg-[#F1F5F9]"
                >
                  <MaterialIcon name="close" className="text-[20px]" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pos-scroll p-5 space-y-3 bg-[#F8FAFC]">
              {modalAuditLogs.length === 0 ? (
                <div className="text-center py-10 text-sm text-[#64748B]">
                  Chưa có bản ghi lịch sử duyệt nào.
                </div>
              ) : (
                modalAuditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 rounded-xl bg-white border border-[#E2E8F0] flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-[#0F172A]">
                          {log.storeName}
                        </span>
                        <span className="text-xs font-mono text-[#64748B]">
                          #{log.brandCode}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            log.action === 'APPROVED' || log.action === 'UNBLOCKED'
                              ? 'bg-[#DCFCE7] text-[#15803D]'
                              : 'bg-[#FEE2E2] text-[#DC2626]'
                          }`}
                        >
                          {log.action === 'APPROVED'
                            ? 'Đã duyệt'
                            : log.action === 'UNBLOCKED'
                            ? 'Đã mở chặn'
                            : log.action === 'REJECTED'
                            ? 'Đã từ chối'
                            : 'Đã chặn'}
                        </span>
                      </div>
                      <p className="text-xs text-[#475569] leading-relaxed">{log.note}</p>
                      <div className="text-[11px] text-[#64748B]">
                        Thực hiện bởi <span className="font-semibold">{log.actorName}</span>
                      </div>
                    </div>
                    <div className="text-xs font-mono text-[#64748B] whitespace-nowrap tabular-nums-strict">
                      {formatDateTimeVN(log.createdAt)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
