import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type {
  Branch,
  Order,
  OrderStatus,
  PaymentMethod,
  Refund,
  Shift,
  User,
} from '../types';
import {
  downloadCsv,
  formatDateTimeVN,
  formatVND,
  orderStatusLabelVN,
  paymentMethodLabelVN,
} from '../utils/format';
import { MaterialIcon } from './MaterialIcon';
import { RefundModal } from './RefundModal';

interface OrdersManagementViewProps {
  user: User;
  storeId: string;
  activeShift: Shift | null;
  initialSelectedOrderId?: string | null;
  onClearInitialOrder?: () => void;
  onViewReceipt: (order: Order) => void;
  onNavigateToCustomer?: () => void;
  onRefundCreated: (
    updatedOrder: Order,
    newRefund: Refund,
    updatedShift: Shift | null
  ) => void;
}

export const OrdersManagementView: React.FC<OrdersManagementViewProps> = ({
  user,
  storeId,
  activeShift,
  initialSelectedOrderId,
  onClearInitialOrder,
  onViewReceipt,
  onNavigateToCustomer,
  onRefundCreated,
}) => {
  const isBranchLocked = user.role === 'BRANCH_MANAGER' && Boolean(user.branchId);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    isBranchLocked && user.branchId ? user.branchId : 'ALL'
  );
  const [orders, setOrders] = useState<Order[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateScope, setDateScope] = useState<'TODAY' | 'ALL'>('TODAY');
  const [searchCode, setSearchCode] = useState('');
  const [cashierFilter, setCashierFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | PaymentMethod>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [customerSearch, setCustomerSearch] = useState('');

  // Detail & Refund Modal
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    initialSelectedOrderId || null
  );
  const [refundModalOrder, setRefundModalOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (initialSelectedOrderId) {
      setSelectedOrderId(initialSelectedOrderId);
      setDateScope('ALL');
      onClearInitialOrder?.();
    }
  }, [initialSelectedOrderId, onClearInitialOrder]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [branchList, orderList, refundList] = await Promise.all([
        api.getBranches(storeId),
        api.getOrders({ storeId, branchId: selectedBranchId }),
        api.getRefunds({ storeId, branchId: selectedBranchId }),
      ]);
      setBranches(branchList);
      setOrders(orderList);
      setRefunds(refundList);
    } catch (err) {
      console.error('Failed to load backoffice orders:', err);
    } finally {
      setLoading(false);
    }
  }, [storeId, selectedBranchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const cashierOptions = useMemo(() => {
    const names = Array.from(new Set(orders.map((o) => o.cashierName))).filter(Boolean);
    return names.sort((a, b) => a.localeCompare(b, 'vi'));
  }, [orders]);

  const todayPrefix = new Date().toISOString().slice(0, 10);

  const filteredOrders = useMemo(() => {
    const codeQ = searchCode.trim().toLowerCase();
    const custQ = customerSearch.trim().toLowerCase();
    return orders.filter((o) => {
      if (dateScope === 'TODAY' && o.createdAt.slice(0, 10) !== todayPrefix) {
        return false;
      }
      if (cashierFilter !== 'ALL' && o.cashierName !== cashierFilter) {
        return false;
      }
      if (paymentFilter !== 'ALL' && o.paymentMethod !== paymentFilter) {
        return false;
      }
      if (statusFilter !== 'ALL' && o.status !== statusFilter) {
        return false;
      }
      if (codeQ && !o.receiptCode.toLowerCase().includes(codeQ)) {
        return false;
      }
      if (custQ && !o.customerName.toLowerCase().includes(custQ)) {
        return false;
      }
      return true;
    });
  }, [
    orders,
    dateScope,
    todayPrefix,
    cashierFilter,
    paymentFilter,
    statusFilter,
    searchCode,
    customerSearch,
  ]);

  const kpis = useMemo(() => {
    const count = filteredOrders.length;
    const gross = filteredOrders.reduce((s, o) => s + o.totalAmount, 0);
    const totalRefunded = filteredOrders.reduce((s, o) => s + o.refundedAmount, 0);
    const avg = count > 0 ? Math.round(gross / count) : 0;
    const refundedOrders = filteredOrders.filter((o) => o.refundedAmount > 0).length;
    return { count, gross, totalRefunded, avg, refundedOrders };
  }, [filteredOrders]);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) || null,
    [orders, selectedOrderId]
  );

  const linkedRefunds = useMemo(() => {
    if (!selectedOrder) return [];
    return refunds.filter((r) => r.orderId === selectedOrder.id);
  }, [refunds, selectedOrder]);

  const resetFilters = () => {
    setSearchCode('');
    setCashierFilter('ALL');
    setPaymentFilter('ALL');
    setStatusFilter('ALL');
    setCustomerSearch('');
    setDateScope('TODAY');
  };

  const handleExportCsv = () => {
    downloadCsv(
      `don-hang-${todayPrefix}.csv`,
      [
        'Mã đơn',
        'Thời gian',
        'Chi nhánh',
        'Khách hàng',
        'Thu ngân',
        'Thanh toán',
        'Trạng thái',
        'Số món',
        'Tổng tiền (VND)',
        'Đã hoàn (VND)',
      ],
      filteredOrders.map((o) => [
        o.receiptCode,
        formatDateTimeVN(o.createdAt),
        o.branchName || '',
        o.customerName,
        o.cashierName,
        paymentMethodLabelVN(o.paymentMethod),
        orderStatusLabelVN(o.status),
        o.items.reduce((sum, i) => sum + i.quantity, 0),
        o.totalAmount,
        o.refundedAmount,
      ])
    );
  };

  const handleExportSingleOrderCsv = (order: Order) => {
    downloadCsv(
      `chi-tiet-${order.receiptCode}.csv`,
      ['Mã SKU', 'Sản phẩm', 'Đơn giá (VND)', 'Số lượng', 'Thành tiền (VND)', 'Ghi chú'],
      order.items.map((i) => [
        i.sku,
        i.name,
        i.unitPrice,
        i.quantity,
        i.lineTotal,
        i.note,
      ])
    );
  };

  // --- DETAIL VIEW ---
  if (selectedOrder) {
    const remainingRefundable = Math.max(
      0,
      selectedOrder.totalAmount - selectedOrder.refundedAmount
    );
    const totalQty = selectedOrder.items.reduce((s, i) => s + i.quantity, 0);
    const custInitials = selectedOrder.customerName
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();

    return (
      <div className="flex-1 min-h-0 overflow-y-auto pos-scroll bg-[#F8FAFC] p-4 lg:p-6">
        <div className="max-w-6xl mx-auto space-y-5">
          {/* Top Breadcrumb + Actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#64748B]">
                <button
                  type="button"
                  onClick={() => setSelectedOrderId(null)}
                  className="inline-flex items-center gap-1 hover:text-[#0F766E]"
                >
                  <MaterialIcon name="arrow_back" className="text-[16px]" />
                  <span>Quay lại</span>
                </button>
                <span>/</span>
                <button
                  type="button"
                  onClick={() => setSelectedOrderId(null)}
                  className="hover:text-[#0F766E]"
                >
                  Đơn hàng
                </button>
                <span>/</span>
                <span className="text-[#0F766E] font-mono">
                  {selectedOrder.receiptCode}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-[#0F172A] font-mono">
                  Đơn hàng {selectedOrder.receiptCode}
                </h1>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                    selectedOrder.status === 'COMPLETED'
                      ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#16A34A]'
                      : selectedOrder.status === 'PARTIALLY_REFUNDED'
                      ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]'
                      : 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]'
                  }`}
                >
                  {orderStatusLabelVN(selectedOrder.status)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-[#64748B] tabular-nums-strict">
                <span className="inline-flex items-center gap-1">
                  <MaterialIcon name="schedule" className="text-[15px]" />
                  {formatDateTimeVN(selectedOrder.createdAt)}
                </span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <MaterialIcon name="storefront" className="text-[15px]" />
                  {selectedOrder.branchName || 'Chi nhánh'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleExportSingleOrderCsv(selectedOrder)}
                className="h-11 px-4 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-xs font-semibold text-[#0F172A] flex items-center gap-1.5"
              >
                <MaterialIcon name="download" className="text-[18px]" />
                <span>Xuất CSV</span>
              </button>
              <button
                type="button"
                onClick={() => onViewReceipt(selectedOrder)}
                className="h-11 px-4 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-xs font-semibold text-[#0F172A] flex items-center gap-1.5"
              >
                <MaterialIcon name="print" className="text-[18px]" />
                <span>In hóa đơn</span>
              </button>
              {remainingRefundable > 0 && (
                <button
                  type="button"
                  onClick={() => setRefundModalOrder(selectedOrder)}
                  className="h-11 px-4 rounded-xl bg-[#855300] hover:bg-[#6A4200] text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <MaterialIcon name="assignment_return" className="text-[18px]" />
                  <span>Tạo hoàn tiền</span>
                </button>
              )}
            </div>
          </div>

          {/* 2-Column Content */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left 8 Cols */}
            <div className="lg:col-span-8 space-y-5">
              {/* Items Card */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MaterialIcon
                      name="inventory_2"
                      className="text-[20px] text-[#0F766E]"
                    />
                    <h2 className="text-base font-bold text-[#0F172A]">
                      Danh sách sản phẩm
                    </h2>
                  </div>
                  <span className="text-xs font-semibold text-[#64748B] tabular-nums-strict">
                    {selectedOrder.items.length} mặt hàng · {totalQty} món
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-semibold text-[#64748B]">
                      <tr>
                        <th className="py-3 px-5">Sản phẩm</th>
                        <th className="py-3 px-4 text-right">Đơn giá</th>
                        <th className="py-3 px-4 text-center">SL</th>
                        <th className="py-3 px-5 text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {selectedOrder.items.map((item) => (
                        <tr key={item.id}>
                          <td className="py-3.5 px-5">
                            <div className="font-semibold text-[#0F172A]">
                              {item.name}
                            </div>
                            <div className="text-xs text-[#64748B] font-mono">
                              {item.sku}
                              {item.note ? (
                                <span className="font-sans text-[#0F766E] ml-2">
                                  · {item.note}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right text-[#64748B] tabular-nums-strict">
                            {formatVND(item.unitPrice)}
                          </td>
                          <td className="py-3.5 px-4 text-center font-semibold text-[#0F172A] tabular-nums-strict">
                            {item.quantity}
                          </td>
                          <td className="py-3.5 px-5 text-right font-bold text-[#0F766E] tabular-nums-strict">
                            {formatVND(item.lineTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-5 bg-[#F8FAFC] border-t border-[#E2E8F0] space-y-2 text-sm">
                  <div className="flex justify-between text-[#64748B]">
                    <span>Tổng số lượng</span>
                    <span className="font-semibold text-[#0F172A] tabular-nums-strict">
                      {totalQty} món
                    </span>
                  </div>
                  <div className="flex justify-between text-[#64748B]">
                    <span>Tạm tính</span>
                    <span className="font-semibold text-[#0F172A] tabular-nums-strict">
                      {formatVND(selectedOrder.subtotal)}
                    </span>
                  </div>
                  {selectedOrder.discountAmount > 0 && (
                    <div className="flex justify-between text-[#16A34A]">
                      <span>
                        Giảm giá{' '}
                        {selectedOrder.discountLabel
                          ? `(${selectedOrder.discountLabel})`
                          : ''}
                      </span>
                      <span className="font-semibold tabular-nums-strict">
                        -{formatVND(selectedOrder.discountAmount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-[#E2E8F0]">
                    <span className="font-bold text-[#0F172A]">Tổng cộng</span>
                    <span className="text-xl font-bold text-[#0F766E] tabular-nums-strict">
                      {formatVND(selectedOrder.totalAmount)}
                    </span>
                  </div>
                  {selectedOrder.refundedAmount > 0 && (
                    <>
                      <div className="flex justify-between text-[#DC2626] font-semibold">
                        <span>Đã hoàn tiền</span>
                        <span className="tabular-nums-strict">
                          -{formatVND(selectedOrder.refundedAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[#0F172A] font-bold">
                        <span>Giá trị thực thu sau hoàn</span>
                        <span className="tabular-nums-strict">
                          {formatVND(remainingRefundable)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Linked Refunds Card */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MaterialIcon
                      name="assignment_return"
                      className="text-[20px] text-[#855300]"
                    />
                    <h2 className="text-base font-bold text-[#0F172A]">
                      Hoàn tiền liên quan ({linkedRefunds.length})
                    </h2>
                  </div>
                  {remainingRefundable > 0 && (
                    <button
                      type="button"
                      onClick={() => setRefundModalOrder(selectedOrder)}
                      className="text-xs font-bold text-[#0F766E] hover:underline"
                    >
                      + Tạo phiếu hoàn tiền
                    </button>
                  )}
                </div>

                {linkedRefunds.length === 0 ? (
                  <div className="p-6 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-center space-y-1.5">
                    <MaterialIcon
                      name="receipt_long"
                      className="text-[32px] text-[#94A3B8]"
                    />
                    <div className="text-sm font-semibold text-[#0F172A]">
                      Đơn hàng này chưa có hoàn tiền
                    </div>
                    <p className="text-xs text-[#64748B]">
                      Mọi thao tác đổi trả hoặc hoàn tiền cho đơn{' '}
                      {selectedOrder.receiptCode} sẽ được ghi nhận tại đây.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {linkedRefunds.map((ref) => (
                      <div
                        key={ref.id}
                        className="p-4 rounded-xl bg-[#FEF2F2]/60 border border-[#FECACA] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold font-mono text-[#0F172A]">
                              {ref.refundCode}
                            </span>
                            <span className="text-xs font-semibold text-[#DC2626]">
                              · {paymentMethodLabelVN(ref.method)}
                            </span>
                          </div>
                          <div className="text-xs text-[#0F172A]">{ref.reason}</div>
                          <div className="text-xs text-[#64748B] tabular-nums-strict">
                            Người xử lý: <strong>{ref.cashierName}</strong> ·{' '}
                            {formatDateTimeVN(ref.createdAt)}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-base font-bold text-[#DC2626] tabular-nums-strict">
                            -{formatVND(ref.amount)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right 4 Cols */}
            <div className="lg:col-span-4 space-y-4">
              {/* Customer Card */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <MaterialIcon name="person" className="text-[19px] text-[#0F766E]" />
                  <h3 className="text-sm font-bold text-[#0F172A]">Khách hàng</h3>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#0F766E]/10 text-[#0F766E] font-bold text-sm flex items-center justify-center shrink-0">
                    {custInitials || 'KL'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[#0F172A] truncate">
                      {selectedOrder.customerName}
                    </div>
                    <div className="text-xs text-[#64748B]">
                      {selectedOrder.customerId
                        ? 'Thành viên tích điểm'
                        : 'Khách mua lẻ tại quầy'}
                    </div>
                  </div>
                </div>
                {onNavigateToCustomer && selectedOrder.customerId && (
                  <button
                    type="button"
                    onClick={onNavigateToCustomer}
                    className="w-full pt-2 border-t border-[#E2E8F0] flex items-center justify-between text-xs font-semibold text-[#0F766E] hover:underline"
                  >
                    <span>Xem danh sách khách hàng</span>
                    <MaterialIcon name="arrow_forward" className="text-[16px]" />
                  </button>
                )}
              </div>

              {/* Cashier Card */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <MaterialIcon name="badge" className="text-[19px] text-[#0F766E]" />
                  <h3 className="text-sm font-bold text-[#0F172A]">Thu ngân</h3>
                </div>
                <div className="text-sm font-bold text-[#0F172A]">
                  {selectedOrder.cashierName}
                </div>
                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Ca làm việc</span>
                    <span className="font-mono font-semibold text-[#0F172A]">
                      {selectedOrder.shiftCode || selectedOrder.shiftId}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Thiết bị</span>
                    <span className="font-semibold text-[#0F172A]">
                      {selectedOrder.registerName || 'Quầy POS 01'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Card */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MaterialIcon
                      name="credit_card"
                      className="text-[19px] text-[#0F766E]"
                    />
                    <h3 className="text-sm font-bold text-[#0F172A]">Thanh toán</h3>
                  </div>
                  <span className="text-xs font-semibold text-[#16A34A]">
                    Đã thu
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Phương thức</span>
                    <span className="font-semibold text-[#0F172A]">
                      {paymentMethodLabelVN(selectedOrder.paymentMethod)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Tiền khách đưa</span>
                    <span className="font-semibold text-[#0F172A] tabular-nums-strict">
                      {formatVND(selectedOrder.cashTendered)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Tiền thừa trả khách</span>
                    <span className="font-bold text-[#16A34A] tabular-nums-strict">
                      {formatVND(selectedOrder.changeDue)}
                    </span>
                  </div>
                  {selectedOrder.paymentRef && (
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Mã tham chiếu</span>
                      <span className="font-mono font-semibold text-[#0F172A]">
                        {selectedOrder.paymentRef}
                      </span>
                    </div>
                  )}
                  <div className="pt-1.5 border-t border-[#E2E8F0] flex justify-between font-bold text-sm">
                    <span className="text-[#0F172A]">Tổng thanh toán</span>
                    <span className="text-[#0F766E] tabular-nums-strict">
                      {formatVND(selectedOrder.totalAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Branch Card */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-2">
                <div className="flex items-center gap-2">
                  <MaterialIcon name="store" className="text-[19px] text-[#0F766E]" />
                  <h3 className="text-sm font-bold text-[#0F172A]">Chi nhánh</h3>
                </div>
                <div className="text-sm font-semibold text-[#0F172A]">
                  {selectedOrder.branchName || 'Chi nhánh'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {refundModalOrder && (
          <RefundModal
            order={refundModalOrder}
            activeShift={activeShift}
            cashierName={user.name}
            onClose={() => setRefundModalOrder(null)}
            onRefundCreated={(updatedOrder, newRefund, updatedShift) => {
              setOrders((prev) =>
                prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
              );
              setRefunds((prev) => [newRefund, ...prev]);
              onRefundCreated(updatedOrder, newRefund, updatedShift);
              setRefundModalOrder(null);
            }}
          />
        )}
      </div>
    );
  }

  // --- ORDERS LIST VIEW ---
  return (
    <div className="flex-1 min-h-0 overflow-y-auto pos-scroll bg-[#F8FAFC] p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-[#0F172A]">Đơn hàng</h1>

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

            <div className="inline-flex p-1 rounded-xl bg-[#E2E8F0]/60">
              <button
                type="button"
                onClick={() => setDateScope('TODAY')}
                className={`h-8 px-3.5 rounded-lg text-xs font-semibold transition-colors ${
                  dateScope === 'TODAY'
                    ? 'bg-[#0F766E] text-white'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                Hôm nay
              </button>
              <button
                type="button"
                onClick={() => setDateScope('ALL')}
                className={`h-8 px-3.5 rounded-lg text-xs font-semibold transition-colors ${
                  dateScope === 'ALL'
                    ? 'bg-[#0F766E] text-white'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                Tất cả
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredOrders.length === 0}
            className="h-11 px-4 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-sm font-semibold text-[#0F766E] flex items-center gap-2 self-start lg:self-auto disabled:opacity-50"
          >
            <MaterialIcon name="file_download" className="text-[19px]" />
            <span>Xuất dữ liệu (CSV)</span>
          </button>
        </div>

        {/* 3 KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#64748B]">
                Số đơn hàng
              </span>
              <div className="w-9 h-9 rounded-xl bg-[#F0FDFA] text-[#0F766E] flex items-center justify-center">
                <MaterialIcon name="receipt_long" className="text-[20px]" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0F172A] tabular-nums-strict">
              {kpis.count}
            </div>
            <div className="text-xs text-[#64748B] tabular-nums-strict">
              {kpis.refundedOrders > 0
                ? `${kpis.refundedOrders} đơn có phát sinh hoàn tiền`
                : 'Tất cả đơn hoàn tất bình thường'}
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#64748B]">
                Doanh thu
              </span>
              <div className="w-9 h-9 rounded-xl bg-[#F0FDF4] text-[#16A34A] flex items-center justify-center">
                <MaterialIcon name="payments" className="text-[20px]" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0F766E] tabular-nums-strict">
              {formatVND(kpis.gross)}
            </div>
            <div className="text-xs text-[#64748B] tabular-nums-strict">
              Sau hoàn tiền:{' '}
              <strong className="text-[#0F172A]">
                {formatVND(kpis.gross - kpis.totalRefunded)}
              </strong>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#64748B]">
                Giá trị trung bình / đơn
              </span>
              <div className="w-9 h-9 rounded-xl bg-[#FFFBEB] text-[#B45309] flex items-center justify-center">
                <MaterialIcon name="query_stats" className="text-[20px]" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0F172A] tabular-nums-strict">
              {formatVND(kpis.avg)}
            </div>
            <div className="text-xs text-[#64748B] tabular-nums-strict">
              Dựa trên {kpis.count} giao dịch khớp bộ lọc
            </div>
          </div>
        </div>

        {/* Multi-Filter Toolbar */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
            <div className="relative">
              <MaterialIcon
                name="search"
                className="text-[19px] text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2"
              />
              <input
                type="text"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                placeholder="Tìm theo mã đơn..."
                className="w-full h-11 pl-9 pr-3 rounded-xl border border-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
              />
            </div>

            <select
              value={cashierFilter}
              onChange={(e) => setCashierFilter(e.target.value)}
              aria-label="Lọc theo thu ngân"
              className="h-11 px-3 rounded-xl border border-[#CBD5E1] bg-white text-sm text-[#0F172A]"
            >
              <option value="ALL">Thu ngân: Tất cả</option>
              {cashierOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={paymentFilter}
              onChange={(e) =>
                setPaymentFilter(e.target.value as 'ALL' | PaymentMethod)
              }
              aria-label="Lọc theo phương thức thanh toán"
              className="h-11 px-3 rounded-xl border border-[#CBD5E1] bg-white text-sm text-[#0F172A]"
            >
              <option value="ALL">Thanh toán: Tất cả</option>
              <option value="CASH">Tiền mặt</option>
              <option value="CARD">Thẻ ngân hàng</option>
              <option value="UPI">Chuyển khoản / QR</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'ALL' | OrderStatus)
              }
              aria-label="Lọc theo trạng thái đơn"
              className="h-11 px-3 rounded-xl border border-[#CBD5E1] bg-white text-sm text-[#0F172A]"
            >
              <option value="ALL">Trạng thái: Tất cả</option>
              <option value="COMPLETED">Hoàn tất</option>
              <option value="PARTIALLY_REFUNDED">Hoàn một phần</option>
              <option value="REFUNDED">Đã hoàn tiền</option>
            </select>

            <div className="relative">
              <MaterialIcon
                name="person_search"
                className="text-[19px] text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2"
              />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Khách hàng..."
                className="w-full h-11 pl-9 pr-3 rounded-xl border border-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
              />
            </div>

            <button
              type="button"
              onClick={resetFilters}
              className="h-11 px-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-sm font-semibold text-[#0F766E] flex items-center justify-center gap-1.5"
            >
              <MaterialIcon name="filter_alt_off" className="text-[18px]" />
              <span>Xóa bộ lọc</span>
            </button>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm text-[#64748B]">
              Đang tải danh sách đơn hàng...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <MaterialIcon
                name="receipt_long"
                className="text-[40px] text-[#94A3B8]"
              />
              <div className="text-base font-bold text-[#0F172A]">
                Chưa có đơn hàng nào khớp bộ lọc
              </div>
              <p className="text-sm text-[#64748B]">
                Thử chuyển sang chế độ &ldquo;Tất cả&rdquo; hoặc xóa bộ lọc để
                xem thêm lịch sử giao dịch.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-semibold text-[#64748B]">
                  <tr>
                    <th className="py-3.5 px-5">Mã đơn</th>
                    <th className="py-3.5 px-4">Thời gian</th>
                    <th className="py-3.5 px-4">Chi nhánh</th>
                    <th className="py-3.5 px-4">Khách hàng</th>
                    <th className="py-3.5 px-4">Thu ngân</th>
                    <th className="py-3.5 px-4">Thanh toán</th>
                    <th className="py-3.5 px-4">Trạng thái</th>
                    <th className="py-3.5 px-4 text-center">Số món</th>
                    <th className="py-3.5 px-5 text-right">Tổng tiền</th>
                    <th className="py-3.5 px-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {filteredOrders.map((ord) => {
                    const qty = ord.items.reduce((s, i) => s + i.quantity, 0);
                    return (
                      <tr
                        key={ord.id}
                        onClick={() => setSelectedOrderId(ord.id)}
                        className="hover:bg-[#F8FAFC] cursor-pointer transition-colors"
                      >
                        <td className="py-3.5 px-5 font-mono font-bold text-[#0F766E] whitespace-nowrap">
                          {ord.receiptCode}
                        </td>
                        <td className="py-3.5 px-4 text-[#64748B] tabular-nums-strict whitespace-nowrap">
                          {formatDateTimeVN(ord.createdAt)}
                        </td>
                        <td className="py-3.5 px-4 text-[#0F172A] max-w-[180px] truncate">
                          {ord.branchName || '—'}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-[#0F172A] whitespace-nowrap">
                          {ord.customerName}
                        </td>
                        <td className="py-3.5 px-4 text-[#64748B] whitespace-nowrap">
                          {ord.cashierName}
                        </td>
                        <td className="py-3.5 px-4 text-[#0F172A] whitespace-nowrap">
                          {paymentMethodLabelVN(ord.paymentMethod)}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`text-xs font-bold ${
                              ord.status === 'COMPLETED'
                                ? 'text-[#16A34A]'
                                : ord.status === 'PARTIALLY_REFUNDED'
                                ? 'text-[#B45309]'
                                : 'text-[#DC2626]'
                            }`}
                          >
                            {orderStatusLabelVN(ord.status)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-semibold text-[#0F172A] tabular-nums-strict">
                          {qty}
                        </td>
                        <td className="py-3.5 px-5 text-right font-bold text-[#0F172A] tabular-nums-strict whitespace-nowrap">
                          {formatVND(ord.totalAmount)}
                        </td>
                        <td className="py-3.5 px-3 text-right text-[#94A3B8]">
                          <MaterialIcon name="chevron_right" className="text-[20px]" />
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
    </div>
  );
};
