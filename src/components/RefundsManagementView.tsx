import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { Branch, Order, PaymentMethod, Refund, User } from '../types';
import {
  downloadCsv,
  formatDateTimeVN,
  formatVND,
  orderStatusLabelVN,
  paymentMethodLabelVN,
} from '../utils/format';
import { MaterialIcon } from './MaterialIcon';

interface RefundsManagementViewProps {
  user: User;
  storeId: string;
  onOpenOrderDetail: (orderId: string) => void;
}

export const RefundsManagementView: React.FC<RefundsManagementViewProps> = ({
  user,
  storeId,
  onOpenOrderDetail,
}) => {
  const isBranchLocked = user.role === 'BRANCH_MANAGER' && Boolean(user.branchId);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    isBranchLocked && user.branchId ? user.branchId : 'ALL'
  );
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [cashierFilter, setCashierFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState<'ALL' | PaymentMethod>('ALL');

  // Right slide-over drawer
  const [selectedRefund, setSelectedRefund] = useState<Refund | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [branchList, refundList, orderList] = await Promise.all([
        api.getBranches(storeId),
        api.getRefunds({ storeId, branchId: selectedBranchId }),
        api.getOrders({ storeId, branchId: selectedBranchId }),
      ]);
      setBranches(branchList);
      setRefunds(refundList);
      setOrders(orderList);
    } catch (err) {
      console.error('Failed to load refunds:', err);
    } finally {
      setLoading(false);
    }
  }, [storeId, selectedBranchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const cashierOptions = useMemo(() => {
    return Array.from(new Set(refunds.map((r) => r.cashierName)))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'vi'));
  }, [refunds]);

  const filteredRefunds = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return refunds.filter((r) => {
      if (cashierFilter !== 'ALL' && r.cashierName !== cashierFilter) return false;
      if (methodFilter !== 'ALL' && r.method !== methodFilter) return false;
      if (!q) return true;
      return (
        r.refundCode.toLowerCase().includes(q) ||
        r.receiptCode.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q) ||
        r.cashierName.toLowerCase().includes(q)
      );
    });
  }, [refunds, cashierFilter, methodFilter, searchText]);

  const metrics = useMemo(() => {
    const totalCount = filteredRefunds.length;
    const totalAmount = filteredRefunds.reduce((s, r) => s + r.amount, 0);
    const cashRefunds = filteredRefunds.filter((r) => r.method === 'CASH');
    const cashAmount = cashRefunds.reduce((s, r) => s + r.amount, 0);
    const grossRevenue = orders.reduce((s, o) => s + o.totalAmount, 0);
    const ratePct =
      grossRevenue > 0 ? Math.round((totalAmount / grossRevenue) * 1000) / 10 : 0;
    return {
      totalCount,
      totalAmount,
      cashCount: cashRefunds.length,
      cashAmount,
      ratePct,
      grossRevenue,
    };
  }, [filteredRefunds, orders]);

  const resetFilters = () => {
    setSearchText('');
    setCashierFilter('ALL');
    setMethodFilter('ALL');
  };

  const handleExportCsv = () => {
    downloadCsv(
      `hoan-tien-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Mã hoàn tiền',
        'Mã đơn hàng',
        'Chi nhánh',
        'Lý do hoàn',
        'Hình thức',
        'Số tiền hoàn (VND)',
        'Thu ngân',
        'Thời gian',
      ],
      filteredRefunds.map((r) => [
        r.refundCode,
        r.receiptCode,
        r.branchName || '',
        r.reason,
        paymentMethodLabelVN(r.method),
        r.amount,
        r.cashierName,
        formatDateTimeVN(r.createdAt),
      ])
    );
  };

  const linkedOrderForDrawer = useMemo(() => {
    if (!selectedRefund) return null;
    return orders.find((o) => o.id === selectedRefund.orderId) || null;
  }, [selectedRefund, orders]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pos-scroll bg-[#F8FAFC] p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-[#0F172A]">Hoàn tiền</h1>
              <select
                value={selectedBranchId}
                disabled={isBranchLocked}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                aria-label="Chọn chi nhánh"
                className="h-10 px-3 rounded-xl border border-[#CBD5E1] bg-white text-sm font-semibold text-[#0F172A] disabled:opacity-75"
              >
                {!isBranchLocked && <option value="ALL">Tất cả chi nhánh</option>}
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-sm text-[#64748B]">
              Theo dõi các khoản hoàn tiền do thu ngân thực hiện tại quầy thu ngân
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => window.print()}
              className="h-11 px-4 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-sm font-semibold text-[#0F172A] flex items-center gap-2"
            >
              <MaterialIcon name="print" className="text-[19px]" />
              <span>In báo cáo hoàn tiền</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredRefunds.length === 0}
              className="h-11 px-4 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
            >
              <MaterialIcon name="download" className="text-[19px]" />
              <span>Xuất dữ liệu</span>
            </button>
          </div>
        </div>

        {/* 3 KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Số lượt hoàn tiền
              </span>
              <div className="w-9 h-9 rounded-xl bg-[#F0FDFA] text-[#0F766E] flex items-center justify-center">
                <MaterialIcon name="assignment_return" className="text-[20px]" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0F172A] tabular-nums-strict">
              {metrics.totalCount}
            </div>
            <div className="text-xs text-[#64748B] tabular-nums-strict">
              Trong tổng số {orders.length} đơn hàng ghi nhận
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Tổng tiền hoàn
              </span>
              <div className="w-9 h-9 rounded-xl bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center">
                <MaterialIcon name="payments" className="text-[20px]" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#DC2626] tabular-nums-strict">
              {formatVND(metrics.totalAmount)}
            </div>
            <div className="text-xs text-[#64748B] flex items-center justify-between tabular-nums-strict">
              <span>{metrics.cashCount} giao dịch tiền mặt</span>
              <strong className="text-[#0F172A]">
                {formatVND(metrics.cashAmount)}
              </strong>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Tỉ lệ so với doanh thu
              </span>
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  metrics.ratePct <= 5
                    ? 'bg-[#F0FDF4] text-[#16A34A]'
                    : 'bg-[#FFFBEB] text-[#B45309]'
                }`}
              >
                <MaterialIcon name="verified" className="text-[20px]" />
              </div>
            </div>
            <div
              className={`text-3xl font-bold tabular-nums-strict ${
                metrics.ratePct <= 5 ? 'text-[#16A34A]' : 'text-[#B45309]'
              }`}
            >
              {metrics.ratePct.toLocaleString('vi-VN')}%
            </div>
            <div className="text-xs text-[#64748B] tabular-nums-strict">
              {metrics.ratePct <= 5
                ? 'Trong ngưỡng kiểm soát vận hành'
                : 'Cần rà soát nguyên nhân đổi trả'}
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative min-w-[240px] flex-1 max-w-sm">
              <MaterialIcon
                name="search"
                className="text-[19px] text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2"
              />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Tìm theo mã đơn, mã hoàn, lý do..."
                className="w-full h-11 pl-9 pr-3 rounded-xl border border-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
              />
            </div>

            <select
              value={cashierFilter}
              onChange={(e) => setCashierFilter(e.target.value)}
              aria-label="Lọc theo thu ngân"
              className="h-11 px-3 rounded-xl border border-[#CBD5E1] bg-white text-sm text-[#0F172A]"
            >
              <option value="ALL">Tất cả thu ngân</option>
              {cashierOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={methodFilter}
              onChange={(e) =>
                setMethodFilter(e.target.value as 'ALL' | PaymentMethod)
              }
              aria-label="Lọc theo hình thức hoàn"
              className="h-11 px-3 rounded-xl border border-[#CBD5E1] bg-white text-sm text-[#0F172A]"
            >
              <option value="ALL">Tất cả hình thức</option>
              <option value="CASH">Tiền mặt</option>
              <option value="CARD">Thẻ ngân hàng</option>
              <option value="UPI">QR / Ví điện tử</option>
            </select>
          </div>

          <button
            type="button"
            onClick={resetFilters}
            className="h-11 px-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-sm font-semibold text-[#0F766E] flex items-center justify-center gap-1.5"
          >
            <MaterialIcon name="restart_alt" className="text-[18px]" />
            <span>Xóa bộ lọc</span>
          </button>
        </div>

        {/* Refunds Table */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm text-[#64748B]">
              Đang tải dữ liệu hoàn tiền...
            </div>
          ) : filteredRefunds.length === 0 ? (
            <div className="py-16 px-6 text-center space-y-2">
              <MaterialIcon
                name="receipt_long"
                className="text-[42px] text-[#94A3B8]"
              />
              <div className="text-base font-bold text-[#0F172A]">
                Chưa có khoản hoàn tiền nào
              </div>
              <p className="text-sm text-[#64748B] max-w-md mx-auto">
                Mọi giao dịch hoàn tiền của thu ngân tại chi nhánh sẽ được ghi
                nhận tại đây.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-semibold text-[#64748B]">
                  <tr>
                    <th className="py-3.5 px-5">Mã hoàn tiền</th>
                    <th className="py-3.5 px-4">Đơn hàng</th>
                    <th className="py-3.5 px-4">Lý do</th>
                    <th className="py-3.5 px-4">Hình thức</th>
                    <th className="py-3.5 px-4 text-right">Số tiền</th>
                    <th className="py-3.5 px-4">Thu ngân</th>
                    <th className="py-3.5 px-4">Thời gian</th>
                    <th className="py-3.5 px-4 text-center">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {filteredRefunds.map((ref) => (
                    <tr
                      key={ref.id}
                      onClick={() => setSelectedRefund(ref)}
                      className="hover:bg-[#F8FAFC] cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-5 font-mono font-bold text-[#0F172A] whitespace-nowrap">
                        {ref.refundCode}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenOrderDetail(ref.orderId);
                          }}
                          className="inline-flex items-center gap-1 font-mono font-semibold text-[#0F766E] hover:underline"
                        >
                          <span>{ref.receiptCode}</span>
                          <MaterialIcon name="open_in_new" className="text-[14px]" />
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-[#0F172A] max-w-xs truncate">
                        {ref.reason}
                      </td>
                      <td className="py-3.5 px-4 text-[#0F172A] whitespace-nowrap">
                        {paymentMethodLabelVN(ref.method)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-[#DC2626] tabular-nums-strict whitespace-nowrap">
                        -{formatVND(ref.amount)}
                      </td>
                      <td className="py-3.5 px-4 text-[#0F172A] font-medium whitespace-nowrap">
                        {ref.cashierName}
                      </td>
                      <td className="py-3.5 px-4 text-[#64748B] tabular-nums-strict whitespace-nowrap">
                        {formatDateTimeVN(ref.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 text-center text-[#94A3B8]">
                        <MaterialIcon name="chevron_right" className="text-[20px]" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Right Slide-Over Refund Detail Drawer */}
      {selectedRefund && (
        <div
          className="fixed inset-0 z-50 bg-[#0F172A]/40 backdrop-blur-[1px] flex justify-end"
          onClick={() => setSelectedRefund(null)}
          role="dialog"
          aria-modal="true"
        >
          <aside
            className="w-full max-w-[460px] bg-white h-full border-l border-[#E2E8F0] shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between gap-3 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-[#0F172A]">
                  Chi tiết hoàn tiền{' '}
                  <span className="font-mono text-[#0F766E]">
                    {selectedRefund.refundCode}
                  </span>
                </h2>
                <div className="text-xs text-[#64748B] tabular-nums-strict">
                  {formatDateTimeVN(selectedRefund.createdAt)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRefund(null)}
                aria-label="Đóng chi tiết hoàn tiền"
                className="w-10 h-10 rounded-xl border border-[#E2E8F0] hover:bg-[#F8FAFC] flex items-center justify-center text-[#64748B]"
              >
                <MaterialIcon name="close" className="text-[20px]" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 pos-scroll">
              <div className="p-5 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] text-center space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                  Số tiền hoàn trả
                </div>
                <div className="text-3xl font-extrabold text-[#DC2626] tabular-nums-strict">
                  -{formatVND(selectedRefund.amount)}
                </div>
                <div className="text-xs font-semibold text-[#DC2626] pt-1">
                  Đã hoàn qua {paymentMethodLabelVN(selectedRefund.method)}
                </div>
              </div>

              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Thông tin giao dịch
                </h3>
                <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#64748B]">Mã đơn hàng</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRefund(null);
                        onOpenOrderDetail(selectedRefund.orderId);
                      }}
                      className="inline-flex items-center gap-1 font-mono font-bold text-[#0F766E] hover:underline"
                    >
                      <span>{selectedRefund.receiptCode}</span>
                      <MaterialIcon name="open_in_new" className="text-[14px]" />
                    </button>
                  </div>
                  <div className="flex items-start justify-between gap-3 pt-2 border-t border-[#E2E8F0]">
                    <span className="text-[#64748B] shrink-0">Lý do hoàn</span>
                    <span className="font-semibold text-[#0F172A] text-right">
                      {selectedRefund.reason}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#E2E8F0]">
                    <span className="text-[#64748B]">Hình thức hoàn</span>
                    <span className="font-semibold text-[#0F172A]">
                      {paymentMethodLabelVN(selectedRefund.method)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#E2E8F0]">
                    <span className="text-[#64748B]">Thu ngân thực hiện</span>
                    <span className="font-semibold text-[#0F172A]">
                      {selectedRefund.cashierName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#E2E8F0]">
                    <span className="text-[#64748B]">Chi nhánh</span>
                    <span className="font-semibold text-[#0F172A] text-right">
                      {selectedRefund.branchName || 'Chi nhánh'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#E2E8F0]">
                    <span className="text-[#64748B]">Thời gian thực hiện</span>
                    <span className="font-semibold text-[#0F172A] tabular-nums-strict">
                      {formatDateTimeVN(selectedRefund.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Linked Original Order Summary */}
              {(() => {
                const origTotal =
                  linkedOrderForDrawer?.totalAmount ??
                  selectedRefund.orderTotalAmount ??
                  selectedRefund.amount;
                const totalRefunded =
                  linkedOrderForDrawer?.refundedAmount ??
                  selectedRefund.orderRefundedAmount ??
                  selectedRefund.amount;
                const netAfter = Math.max(0, origTotal - totalRefunded);
                const customerName =
                  linkedOrderForDrawer?.customerName ??
                  selectedRefund.orderCustomerName ??
                  'Khách lẻ';
                const status =
                  linkedOrderForDrawer?.status ??
                  selectedRefund.orderStatus ??
                  'PARTIALLY_REFUNDED';

                return (
                  <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-sm text-[#0F172A]">
                        <MaterialIcon
                          name="receipt_long"
                          className="text-[18px] text-[#0F766E]"
                        />
                        <span>Đơn hàng gốc {selectedRefund.receiptCode}</span>
                      </div>
                      <span className="text-xs font-semibold text-[#64748B]">
                        {orderStatusLabelVN(status)}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">Khách hàng</span>
                        <span className="font-semibold text-[#0F172A]">
                          {customerName}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">Tổng giá trị ban đầu</span>
                        <span className="font-bold text-[#0F172A] tabular-nums-strict">
                          {formatVND(origTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">Số tiền sau khi hoàn</span>
                        <span className="font-bold text-[#0F766E] tabular-nums-strict">
                          {formatVND(netAfter)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Drawer Footer */}
            <div className="p-5 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 h-11 rounded-xl border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] text-sm font-semibold text-[#0F172A] flex items-center justify-center gap-1.5"
              >
                <MaterialIcon name="print" className="text-[18px]" />
                <span>In phiếu</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const ordId = selectedRefund.orderId;
                  setSelectedRefund(null);
                  onOpenOrderDetail(ordId);
                }}
                className="flex-1 h-11 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-bold flex items-center justify-center gap-1.5"
              >
                <MaterialIcon name="receipt" className="text-[18px]" />
                <span>Xem đơn hàng</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};
