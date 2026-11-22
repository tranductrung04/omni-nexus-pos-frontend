import React, { useMemo, useState } from 'react';
import type { Order, PaymentMethod, Refund, Shift } from '../types';
import {
  formatDateTimeVN,
  formatVND,
  orderStatusLabelVN,
  paymentMethodLabelVN,
} from '../utils/format';
import { MaterialIcon } from './MaterialIcon';
import { RefundModal } from './RefundModal';

interface OrdersAndRefundsViewProps {
  orders: Order[];
  refunds: Refund[];
  activeShift: Shift | null;
  onViewReceipt: (order: Order) => void;
  onRefundCreated: (updatedOrder: Order, newRefund: Refund, updatedShift: Shift | null) => void;
}

export const OrdersAndRefundsView: React.FC<OrdersAndRefundsViewProps> = ({
  orders,
  refunds,
  activeShift,
  onViewReceipt,
  onRefundCreated,
}) => {
  const [scopeFilter, setScopeFilter] = useState<'SHIFT' | 'ALL_TODAY'>(
    activeShift ? 'SHIFT' : 'ALL_TODAY'
  );
  const [methodFilter, setMethodFilter] = useState<'ALL' | PaymentMethod>('ALL');
  const [searchText, setSearchText] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    orders[0]?.id || null
  );
  const [refundOrder, setRefundOrder] = useState<Order | null>(null);

  const filteredOrders = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return orders.filter((o) => {
      if (scopeFilter === 'SHIFT' && activeShift && o.shiftId !== activeShift.id) {
        return false;
      }
      if (methodFilter !== 'ALL' && o.paymentMethod !== methodFilter) {
        return false;
      }
      if (!q) return true;
      return (
        o.receiptCode.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.cashierName.toLowerCase().includes(q)
      );
    });
  }, [orders, scopeFilter, activeShift, methodFilter, searchText]);

  const selectedOrder = useMemo(
    () =>
      filteredOrders.find((o) => o.id === selectedOrderId) ||
      filteredOrders[0] ||
      null,
    [filteredOrders, selectedOrderId]
  );

  const selectedOrderRefunds = useMemo(() => {
    if (!selectedOrder) return [];
    return refunds.filter((r) => r.orderId === selectedOrder.id);
  }, [refunds, selectedOrder]);

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden bg-[#F8FAFC]">
      {/* Left List */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0 p-4 gap-3.5 overflow-hidden">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {activeShift && (
              <div className="flex items-center gap-1 p-1 bg-[#F1F5F9] rounded-xl">
                <button
                  type="button"
                  onClick={() => setScopeFilter('SHIFT')}
                  className={`h-9 px-3.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    scopeFilter === 'SHIFT'
                      ? 'bg-white text-[#0F172A] shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  Ca hiện tại ({activeShift.shiftCode})
                </button>
                <button
                  type="button"
                  onClick={() => setScopeFilter('ALL_TODAY')}
                  className={`h-9 px-3.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    scopeFilter === 'ALL_TODAY'
                      ? 'bg-white text-[#0F172A] shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  Tất cả đơn chi nhánh
                </button>
              </div>
            )}

            <div className="flex items-center gap-1 p-1 bg-[#F1F5F9] rounded-xl">
              {(['ALL', 'CASH', 'CARD', 'UPI'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethodFilter(m)}
                  className={`h-9 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    methodFilter === m
                      ? 'bg-[#0F766E] text-white'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  {m === 'ALL' ? 'Tất cả' : m}
                </button>
              ))}
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <MaterialIcon
              name="search"
              className="text-[19px] text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2"
            />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Tìm mã hóa đơn, khách..."
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
            />
          </div>
        </div>

        {/* Orders Table */}
        <div className="flex-1 min-h-0 bg-white border border-[#E2E8F0] rounded-xl overflow-hidden flex flex-col">
          {filteredOrders.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <MaterialIcon name="receipt_long" className="text-[40px] text-[#94A3B8] mb-2" />
              <div className="text-base font-semibold text-[#0F172A]">
                Chưa có đơn hàng nào khớp bộ lọc
              </div>
              <p className="text-sm text-[#64748B] mt-1">
                Thực hiện bán hàng tại quầy hoặc chuyển sang xem toàn bộ đơn chi nhánh.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pos-scroll">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-semibold text-[#64748B]">
                  <tr>
                    <th className="py-3 px-4">Mã hóa đơn</th>
                    <th className="py-3 px-4">Thời gian</th>
                    <th className="py-3 px-4">Khách hàng</th>
                    <th className="py-3 px-4">Thanh toán</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Tổng tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-sm">
                  {filteredOrders.map((ord) => {
                    const active = selectedOrder?.id === ord.id;
                    return (
                      <tr
                        key={ord.id}
                        onClick={() => setSelectedOrderId(ord.id)}
                        className={`cursor-pointer transition-colors ${
                          active ? 'bg-[#0F766E]/5' : 'hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-semibold text-[#0F172A]">
                          {ord.receiptCode}
                        </td>
                        <td className="py-3 px-4 text-[#64748B] tabular-nums-strict">
                          {formatDateTimeVN(ord.createdAt)}
                        </td>
                        <td className="py-3 px-4 font-medium text-[#0F172A]">
                          {ord.customerName}
                        </td>
                        <td className="py-3 px-4 text-[#0F172A]">
                          {paymentMethodLabelVN(ord.paymentMethod)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-xs font-semibold ${
                              ord.status === 'COMPLETED'
                                ? 'text-[#16A34A]'
                                : ord.status === 'PARTIALLY_REFUNDED'
                                ? 'text-[#855300]'
                                : 'text-[#DC2626]'
                            }`}
                          >
                            {orderStatusLabelVN(ord.status)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-[#0F172A] tabular-nums-strict">
                          {formatVND(ord.totalAmount)}
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

      {/* Right Detail Drawer */}
      <aside className="w-full lg:w-[420px] shrink-0 bg-white border-t lg:border-t-0 lg:border-l border-[#E2E8F0] flex flex-col min-h-0">
        {!selectedOrder ? (
          <div className="flex-1 flex items-center justify-center p-8 text-sm text-[#64748B]">
            Chọn một đơn hàng để xem chi tiết hoặc hoàn tiền.
          </div>
        ) : (
          <>
            <div className="p-5 border-b border-[#E2E8F0] flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-[#64748B]">
                  Chi tiết đơn hàng
                </div>
                <div className="text-lg font-bold font-mono text-[#0F172A] mt-0.5">
                  {selectedOrder.receiptCode}
                </div>
                <div className="text-xs text-[#64748B] mt-1 tabular-nums-strict">
                  {formatDateTimeVN(selectedOrder.createdAt)} · {selectedOrder.cashierName}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onViewReceipt(selectedOrder)}
                className="h-10 px-3.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-xs font-semibold text-[#0F172A] flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <MaterialIcon name="print" className="text-[18px]" />
                <span>Biên lai</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5 pos-scroll">
              {/* Items */}
              <div className="space-y-2.5">
                <div className="text-xs font-semibold text-[#64748B]">
                  Sản phẩm đã bán ({selectedOrder.items.length})
                </div>
                <div className="divide-y divide-[#E2E8F0] border border-[#E2E8F0] rounded-xl">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="p-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#0F172A]">
                          {item.name}
                        </div>
                        <div className="text-xs text-[#64748B] tabular-nums-strict">
                          {item.quantity} × {formatVND(item.unitPrice)}
                          {item.note ? ` · ${item.note}` : ''}
                        </div>
                      </div>
                      <span className="text-sm font-bold text-[#0F172A] tabular-nums-strict shrink-0">
                        {formatVND(item.lineTotal)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between text-[#64748B]">
                  <span>Tạm tính</span>
                  <span className="tabular-nums-strict font-medium text-[#0F172A]">
                    {formatVND(selectedOrder.subtotal)}
                  </span>
                </div>
                {selectedOrder.discountAmount > 0 && (
                  <div className="flex justify-between text-[#16A34A]">
                    <span>Giảm giá</span>
                    <span className="tabular-nums-strict font-medium">
                      -{formatVND(selectedOrder.discountAmount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base pt-2 border-t border-[#E2E8F0]">
                  <span>Tổng thanh toán</span>
                  <span className="text-[#0F766E] tabular-nums-strict">
                    {formatVND(selectedOrder.totalAmount)}
                  </span>
                </div>
                {selectedOrder.refundedAmount > 0 && (
                  <div className="flex justify-between text-[#DC2626] font-semibold pt-1">
                    <span>Đã hoàn tiền</span>
                    <span className="tabular-nums-strict">
                      -{formatVND(selectedOrder.refundedAmount)}
                    </span>
                  </div>
                )}
              </div>

              {/* Refund History for this Order */}
              {selectedOrderRefunds.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-[#DC2626]">
                    Lịch sử hoàn tiền
                  </div>
                  <div className="space-y-2">
                    {selectedOrderRefunds.map((ref) => (
                      <div
                        key={ref.id}
                        className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs space-y-1"
                      >
                        <div className="flex justify-between font-bold text-[#DC2626]">
                          <span className="font-mono">{ref.refundCode}</span>
                          <span className="tabular-nums-strict">
                            -{formatVND(ref.amount)}
                          </span>
                        </div>
                        <div className="text-[#0F172A]">{ref.reason}</div>
                        <div className="text-[#64748B] tabular-nums-strict">
                          {paymentMethodLabelVN(ref.method)} · {formatDateTimeVN(ref.createdAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Refund Trigger */}
            <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC]">
              {selectedOrder.totalAmount - selectedOrder.refundedAmount > 0 ? (
                <button
                  type="button"
                  onClick={() => setRefundOrder(selectedOrder)}
                  className="w-full h-12 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] hover:bg-[#FEE2E2] font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <MaterialIcon name="assignment_return" className="text-[20px]" />
                  <span>Tạo hoàn tiền cho đơn này</span>
                </button>
              ) : (
                <div className="h-12 rounded-xl bg-[#F1F5F9] text-[#64748B] text-sm font-semibold flex items-center justify-center">
                  Đơn hàng đã được hoàn tiền toàn bộ
                </div>
              )}
            </div>
          </>
        )}
      </aside>

      {refundOrder && (
        <RefundModal
          order={refundOrder}
          activeShift={activeShift}
          onClose={() => setRefundOrder(null)}
          onRefundCreated={(updatedOrder, newRefund, updatedShift) => {
            onRefundCreated(updatedOrder, newRefund, updatedShift);
            setRefundOrder(null);
          }}
        />
      )}
    </div>
  );
};
