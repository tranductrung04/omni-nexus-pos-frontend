import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { Customer, Order } from '../types';
import {
  formatDateTimeVN,
  formatVND,
  orderStatusLabelVN,
  paymentMethodLabelVN,
} from '../utils/format';
import { MaterialIcon } from './MaterialIcon';

interface CustomersViewProps {
  storeId: string;
  onCustomersChanged: () => Promise<void> | void;
  onViewOrderReceipt?: (order: Order) => void;
}

interface CustomerFormState {
  name: string;
  phone: string;
  email: string;
  points: number;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return 'KH';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getTierInfo(points: number): { label: string; colorClass: string } {
  if (points >= 400) return { label: 'Hạng Vàng', colorClass: 'text-[#855300]' };
  if (points >= 150) return { label: 'Hạng Bạc', colorClass: 'text-[#0F766E]' };
  return { label: 'Thành viên', colorClass: 'text-[#64748B]' };
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  storeId,
  onCustomersChanged,
  onViewOrderReceipt,
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'RECENT' | 'SPENT' | 'POINTS'>('RECENT');

  // Detail Modal / Drawer
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [detailOrders, setDetailOrders] = useState<Order[]>([]);

  // Add / Edit Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerFormState>({
    name: '',
    phone: '',
    email: '',
    points: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Modal
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const list = await api.getCustomers(storeId);
      setCustomers(list);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Không thể tải danh sách khách hàng.'
      );
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = q
      ? customers.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.phone.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q)
        )
      : [...customers];

    if (sortBy === 'SPENT') {
      list.sort((a, b) => b.totalSpent - a.totalSpent);
    } else if (sortBy === 'POINTS') {
      list.sort((a, b) => b.points - a.points);
    }
    return list;
  }, [customers, searchQuery, sortBy]);

  const stats = useMemo(() => {
    const total = customers.length;
    const activeBuyers = customers.filter((c) => c.visitCount > 0).length;
    const totalPoints = customers.reduce((s, c) => s + c.points, 0);
    const totalSpent = customers.reduce((s, c) => s + c.totalSpent, 0);
    return { total, activeBuyers, totalPoints, totalSpent };
  }, [customers]);

  const openDetailModal = async (cust: Customer) => {
    setDetailCustomer(cust);
    setDetailOrders([]);
    setDetailLoading(true);
    try {
      const res = await api.getCustomerDetail(cust.id);
      setDetailCustomer(res.customer);
      setDetailOrders(res.orders);
    } catch (err) {
      console.error('Failed to load customer detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingCustomer(null);
    setForm({ name: '', phone: '', email: '', points: 0 });
    setFormError(null);
    setFormOpen(true);
  };

  const openEditModal = (cust: Customer) => {
    setEditingCustomer(cust);
    setForm({
      name: cust.name,
      phone: cust.phone,
      email: cust.email,
      points: cust.points,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmitCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.name.trim() || !form.phone.trim()) {
      setFormError('Vui lòng nhập đầy đủ họ tên và số điện thoại khách hàng.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingCustomer) {
        const updated = await api.updateCustomer(editingCustomer.id, {
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          points: form.points,
        });
        setCustomers((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c))
        );
        if (detailCustomer?.id === updated.id) {
          setDetailCustomer(updated);
        }
      } else {
        const created = await api.createCustomer({
          storeId,
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
        });
        setCustomers((prev) => [created, ...prev]);
      }
      setFormOpen(false);
      await onCustomersChanged();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Không thể lưu thông tin khách hàng.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingCustomer) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteCustomer(deletingCustomer.id);
      setCustomers((prev) => prev.filter((c) => c.id !== deletingCustomer.id));
      if (detailCustomer?.id === deletingCustomer.id) {
        setDetailCustomer(null);
      }
      setDeletingCustomer(null);
      await onCustomersChanged();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Không thể xóa khách hàng.'
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pos-scroll bg-[#F8FAFC] p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">Quản lý khách hàng</h1>
            <p className="text-sm text-[#64748B] mt-0.5">
              Theo dõi hội viên thân thiết, điểm tích lũy và lịch sử đơn hàng đồng bộ trực tiếp với quầy POS.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="h-11 px-5 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-colors"
          >
            <MaterialIcon name="person_add" className="text-[20px]" />
            <span>Thêm khách hàng</span>
          </button>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <div className="text-xs font-semibold text-[#64748B]">Tổng hội viên</div>
            <div className="text-2xl font-bold text-[#0F172A] mt-1 tabular-nums-strict">
              {stats.total}
            </div>
            <div className="text-xs text-[#64748B] mt-1">Hồ sơ trong cửa hàng</div>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <div className="text-xs font-semibold text-[#64748B]">Đã phát sinh giao dịch</div>
            <div className="text-2xl font-bold text-[#16A34A] mt-1 tabular-nums-strict">
              {stats.activeBuyers}
            </div>
            <div className="text-xs text-[#64748B] mt-1">Khách hàng quay lại</div>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <div className="text-xs font-semibold text-[#64748B]">Tổng điểm tích lũy</div>
            <div className="text-2xl font-bold text-[#855300] mt-1 tabular-nums-strict">
              {stats.totalPoints.toLocaleString('vi-VN')} điểm
            </div>
            <div className="text-xs text-[#64748B] mt-1">Tích 1 điểm / 10.000 ₫</div>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <div className="text-xs font-semibold text-[#64748B]">Tổng chi tiêu hội viên</div>
            <div className="text-2xl font-bold text-[#0F766E] mt-1 tabular-nums-strict">
              {formatVND(stats.totalSpent)}
            </div>
            <div className="text-xs text-[#64748B] mt-1">Giá trị tích lũy toàn chuỗi</div>
          </div>
        </div>

        {/* Search & Sort Toolbar */}
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
              placeholder="Tìm theo tên khách hàng, số điện thoại hoặc email..."
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

          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as 'RECENT' | 'SPENT' | 'POINTS')
              }
              className="h-11 px-3.5 rounded-xl border border-[#E2E8F0] bg-white text-xs font-semibold text-[#0F172A] focus:border-[#0F766E] focus:outline-none"
            >
              <option value="RECENT">Sắp xếp: Mới nhất</option>
              <option value="SPENT">Sắp xếp: Chi tiêu cao nhất</option>
              <option value="POINTS">Sắp xếp: Điểm tích lũy cao nhất</option>
            </select>
            <button
              type="button"
              onClick={loadCustomers}
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

        {/* Customers Table */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#0F172A]">
              Danh sách khách hàng ({filteredCustomers.length})
            </h2>
            <span className="text-xs text-[#64748B]">
              Nhấn vào khách hàng để xem chi tiết &amp; lịch sử mua hàng
            </span>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-[#64748B]">
              Đang tải dữ liệu khách hàng...
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-12 text-center">
              <MaterialIcon name="group" className="text-[36px] text-[#94A3B8]" />
              <div className="text-sm font-bold text-[#0F172A] mt-2">
                Không tìm thấy khách hàng phù hợp
              </div>
              <p className="text-xs text-[#64748B] mt-1">
                Thử từ khóa khác hoặc tạo mới hồ sơ hội viên.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-semibold text-[#64748B]">
                  <tr>
                    <th className="py-3 px-5">Khách hàng</th>
                    <th className="py-3 px-4">Số điện thoại &amp; Email</th>
                    <th className="py-3 px-4 text-right">Điểm tích lũy</th>
                    <th className="py-3 px-4 text-right">Lượt mua</th>
                    <th className="py-3 px-4 text-right">Tổng chi tiêu</th>
                    <th className="py-3 px-5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {filteredCustomers.map((c) => {
                    const tier = getTierInfo(c.points);
                    return (
                      <tr
                        key={c.id}
                        onClick={() => openDetailModal(c)}
                        className="hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#CCFBF1] text-[#0F766E] flex items-center justify-center text-xs font-bold shrink-0">
                              {getInitials(c.name)}
                            </div>
                            <div>
                              <div className="font-bold text-[#0F172A]">{c.name}</div>
                              <div className={`text-xs font-semibold ${tier.colorClass}`}>
                                {tier.label}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-sm font-medium text-[#0F172A] tabular-nums-strict">
                            {c.phone}
                          </div>
                          <div className="text-xs text-[#64748B]">
                            {c.email || 'Chưa cập nhật email'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-[#855300] tabular-nums-strict">
                          {c.points.toLocaleString('vi-VN')} điểm
                        </td>
                        <td className="py-3.5 px-4 text-right font-semibold text-[#0F172A] tabular-nums-strict">
                          {c.visitCount} lượt
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-[#0F766E] tabular-nums-strict">
                          {formatVND(c.totalSpent)}
                        </td>
                        <td
                          className="py-3.5 px-5 text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openDetailModal(c)}
                              className="h-9 px-3 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-xs font-semibold text-[#0F172A] inline-flex items-center gap-1"
                            >
                              <MaterialIcon
                                name="visibility"
                                className="text-[16px] text-[#0F766E]"
                              />
                              <span>Chi tiết</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(c)}
                              className="h-9 px-3 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-xs font-semibold text-[#0F172A] inline-flex items-center gap-1"
                            >
                              <MaterialIcon
                                name="edit"
                                className="text-[16px] text-[#0F766E]"
                              />
                              <span>Sửa</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteError(null);
                                setDeletingCustomer(c);
                              }}
                              className="h-9 px-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] hover:bg-[#FEE2E2] text-xs font-semibold text-[#DC2626] inline-flex items-center gap-1"
                            >
                              <MaterialIcon name="delete" className="text-[16px]" />
                              <span>Xóa</span>
                            </button>
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

      {/* Customer Detail Modal */}
      {detailCustomer && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl w-full max-w-3xl max-h-[86vh] flex flex-col overflow-hidden">
            {/* Banner Header */}
            <div className="px-6 py-5 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-4 bg-[#F8FAFC]">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[#0F766E] text-white flex items-center justify-center text-lg font-bold shrink-0">
                  {getInitials(detailCustomer.name)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-[#0F172A]">
                      {detailCustomer.name}
                    </h2>
                    <span
                      className={`text-xs font-bold ${
                        getTierInfo(detailCustomer.points).colorClass
                      }`}
                    >
                      · {getTierInfo(detailCustomer.points).label}
                    </span>
                  </div>
                  <div className="text-xs text-[#64748B] mt-1 flex flex-wrap items-center gap-3 tabular-nums-strict">
                    <span>SĐT: {detailCustomer.phone}</span>
                    <span>·</span>
                    <span>{detailCustomer.email || 'Chưa có email'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditModal(detailCustomer)}
                  className="h-9 px-3.5 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-xs font-semibold text-[#0F172A] inline-flex items-center gap-1.5"
                >
                  <MaterialIcon name="edit" className="text-[16px] text-[#0F766E]" />
                  <span>Sửa hồ sơ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDetailCustomer(null)}
                  className="w-9 h-9 rounded-lg hover:bg-[#E2E8F0] flex items-center justify-center text-[#64748B]"
                >
                  <MaterialIcon name="close" className="text-[20px]" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto pos-scroll space-y-5">
              {/* 3 Stat Tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <div className="text-xs font-semibold text-[#64748B]">
                    Điểm tích lũy hiện có
                  </div>
                  <div className="text-xl font-bold text-[#855300] mt-1 tabular-nums-strict">
                    {detailCustomer.points.toLocaleString('vi-VN')} điểm
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <div className="text-xs font-semibold text-[#64748B]">
                    Số lượt mua hàng
                  </div>
                  <div className="text-xl font-bold text-[#0F172A] mt-1 tabular-nums-strict">
                    {detailCustomer.visitCount} lượt
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <div className="text-xs font-semibold text-[#64748B]">
                    Tổng chi tiêu tích lũy
                  </div>
                  <div className="text-xl font-bold text-[#0F766E] mt-1 tabular-nums-strict">
                    {formatVND(detailCustomer.totalSpent)}
                  </div>
                </div>
              </div>

              {/* Purchase History */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-[#0F172A]">
                    Lịch sử mua hàng ({detailOrders.length} đơn)
                  </h3>
                  {detailCustomer.lastVisitAt && (
                    <span className="text-xs text-[#64748B] tabular-nums-strict">
                      Gần nhất: {formatDateTimeVN(detailCustomer.lastVisitAt)}
                    </span>
                  )}
                </div>

                {detailLoading ? (
                  <div className="p-6 text-center text-xs text-[#64748B]">
                    Đang tải lịch sử đơn hàng...
                  </div>
                ) : detailOrders.length === 0 ? (
                  <div className="p-8 rounded-xl border border-dashed border-[#CBD5E1] text-center text-xs text-[#64748B]">
                    Khách hàng chưa có hóa đơn nào được ghi nhận tại quầy POS.
                  </div>
                ) : (
                  <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-semibold">
                        <tr>
                          <th className="py-2.5 px-4">Mã hóa đơn</th>
                          <th className="py-2.5 px-3">Thời gian</th>
                          <th className="py-2.5 px-3">Sản phẩm</th>
                          <th className="py-2.5 px-3">Thanh toán</th>
                          <th className="py-2.5 px-3 text-right">Tổng tiền</th>
                          {onViewOrderReceipt && (
                            <th className="py-2.5 px-4 text-right">Hóa đơn</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0]">
                        {detailOrders.map((ord) => (
                          <tr key={ord.id} className="hover:bg-[#F8FAFC]">
                            <td className="py-3 px-4 font-mono font-bold text-[#0F172A]">
                              {ord.receiptCode}
                            </td>
                            <td className="py-3 px-3 text-[#64748B] tabular-nums-strict">
                              {formatDateTimeVN(ord.createdAt)}
                            </td>
                            <td className="py-3 px-3 text-[#0F172A]">
                              {ord.items
                                .map((it) => `${it.name} ×${it.quantity}`)
                                .join(', ')}
                            </td>
                            <td className="py-3 px-3">
                              <div className="text-[#0F172A] font-medium">
                                {paymentMethodLabelVN(ord.paymentMethod)}
                              </div>
                              <div
                                className={`text-[11px] font-semibold ${
                                  ord.status === 'COMPLETED'
                                    ? 'text-[#16A34A]'
                                    : 'text-[#855300]'
                                }`}
                              >
                                {orderStatusLabelVN(ord.status)}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-[#0F172A] tabular-nums-strict">
                              {formatVND(ord.totalAmount)}
                            </td>
                            {onViewOrderReceipt && (
                              <td className="py-3 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => onViewOrderReceipt(ord)}
                                  className="text-xs font-bold text-[#0F766E] hover:underline"
                                >
                                  Xem phiếu
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0F172A]">
                {editingCustomer ? 'Cập nhật thông tin khách hàng' : 'Thêm khách hàng mới'}
              </h2>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="w-9 h-9 rounded-lg hover:bg-[#F1F5F9] flex items-center justify-center text-[#64748B]"
              >
                <MaterialIcon name="close" className="text-[20px]" />
              </button>
            </div>

            <form onSubmit={handleSubmitCustomer} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs font-medium text-[#DC2626]">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                  Họ và tên khách hàng <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Võ Thanh Tùng"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#E2E8F0] focus:border-[#0F766E] focus:outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                  Số điện thoại <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="0909 123 456"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#E2E8F0] focus:border-[#0F766E] focus:outline-none text-sm tabular-nums-strict"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                  Email liên hệ (tùy chọn)
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="khachhang@gmail.com"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#E2E8F0] focus:border-[#0F766E] focus:outline-none text-sm"
                />
              </div>

              {editingCustomer && (
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                    Điểm tích lũy
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.points}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        points: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="w-full h-11 px-3.5 rounded-xl border border-[#E2E8F0] focus:border-[#0F766E] focus:outline-none text-sm tabular-nums-strict"
                  />
                </div>
              )}

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
                    : editingCustomer
                    ? 'Lưu thay đổi'
                    : 'Thêm khách hàng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingCustomer && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] flex items-center justify-center text-[#DC2626] shrink-0">
                <MaterialIcon name="warning" className="text-[22px]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">
                  Xác nhận xóa khách hàng
                </h3>
                <p className="text-sm text-[#64748B] mt-1">
                  Hồ sơ hội viên{' '}
                  <span className="font-bold text-[#0F172A]">
                    {deletingCustomer.name}
                  </span>{' '}
                  ({deletingCustomer.phone}) sẽ bị xóa khỏi danh sách tích điểm.
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
                onClick={() => setDeletingCustomer(null)}
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
                {deleting ? 'Đang xóa...' : 'Xóa khách hàng'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
