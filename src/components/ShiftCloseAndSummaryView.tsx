import React, { useMemo, useState } from 'react';
import { api } from '../api';
import type { Order, Shift } from '../types';
import {
  formatDateTimeVN,
  formatVND,
  paymentMethodLabelVN,
} from '../utils/format';
import { MaterialIcon } from './MaterialIcon';
import { VirtualNumpad } from './VirtualNumpad';

interface ShiftCloseAndSummaryViewProps {
  activeShift: Shift | null;
  shiftHistory: Shift[];
  onShiftClosed: (closedShift: Shift) => void;
  onStartNewShift: () => void;
  onViewOrderReceipt: (order: Order) => void;
}

export const ShiftCloseAndSummaryView: React.FC<ShiftCloseAndSummaryViewProps> = ({
  activeShift,
  shiftHistory,
  onShiftClosed,
  onStartNewShift,
  onViewOrderReceipt,
}) => {
  const [actualCash, setActualCash] = useState<number>(
    activeShift ? activeShift.expectedCash : 0
  );
  const [closingNote, setClosingNote] = useState('');
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(
    activeShift?.id || shiftHistory[0]?.id || null
  );

  const viewedShift = useMemo(() => {
    if (activeShift && selectedReportId === activeShift.id) {
      return activeShift;
    }
    return (
      shiftHistory.find((s) => s.id === selectedReportId) ||
      activeShift ||
      shiftHistory[0] ||
      null
    );
  }, [activeShift, shiftHistory, selectedReportId]);

  const isClosingActiveShift =
    Boolean(activeShift) &&
    viewedShift?.id === activeShift?.id &&
    activeShift?.status === 'OPEN';

  const variance = activeShift ? actualCash - activeShift.expectedCash : 0;

  const handleCloseShift = async () => {
    if (!activeShift || closing) return;
    setError(null);
    setClosing(true);
    try {
      const closed = await api.closeShift(activeShift.id, {
        actualCash,
        closingNote,
      });
      setSelectedReportId(closed.id);
      onShiftClosed(closed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đóng ca.');
    } finally {
      setClosing(false);
    }
  };

  if (!viewedShift) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <MaterialIcon name="summarize" className="text-[44px] text-[#94A3B8] mb-3" />
        <div className="text-lg font-bold text-[#0F172A]">Chưa có dữ liệu ca làm việc</div>
        <button
          type="button"
          onClick={onStartNewShift}
          className="mt-4 h-12 px-5 rounded-xl bg-[#0F766E] text-white font-semibold text-sm"
        >
          Mở ca làm việc mới
        </button>
      </div>
    );
  }

  const totalPayAmount =
    viewedShift.paymentBreakdown.CASH +
    viewedShift.paymentBreakdown.CARD +
    viewedShift.paymentBreakdown.UPI;

  const payPct = (val: number) =>
    totalPayAmount > 0 ? Math.round((val / totalPayAmount) * 100) : 0;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pos-scroll bg-[#F8FAFC] p-4 lg:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Shift Selector Bar */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                viewedShift.status === 'OPEN'
                  ? 'bg-[#0F766E]/10 text-[#0F766E]'
                  : 'bg-[#16A34A]/10 text-[#16A34A]'
              }`}
            >
              <MaterialIcon
                name={viewedShift.status === 'OPEN' ? 'lock_open' : 'task_alt'}
                className="text-[24px]"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-[#0F172A]">
                  {viewedShift.status === 'OPEN'
                    ? `Kết thúc ca · ${viewedShift.shiftCode}`
                    : `Tóm tắt ca · ${viewedShift.shiftCode}`}
                </h1>
                <span className="text-xs font-semibold text-[#64748B]">
                  · {viewedShift.status === 'OPEN' ? 'Đang mở' : 'Đã chốt ca'}
                </span>
              </div>
              <div className="text-xs text-[#64748B] tabular-nums-strict">
                {viewedShift.branchName} · {viewedShift.registerName} · Mở lúc{' '}
                {formatDateTimeVN(viewedShift.openedAt)}
                {viewedShift.closedAt
                  ? ` · Đóng lúc ${formatDateTimeVN(viewedShift.closedAt)}`
                  : ''}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {shiftHistory.length > 0 && (
              <select
                value={viewedShift.id}
                onChange={(e) => setSelectedReportId(e.target.value)}
                aria-label="Chọn ca để xem báo cáo"
                className="h-11 px-3 rounded-xl border border-[#CBD5E1] bg-white text-sm font-medium text-[#0F172A]"
              >
                {activeShift && (
                  <option value={activeShift.id}>
                    Ca đang mở: {activeShift.shiftCode}
                  </option>
                )}
                {shiftHistory
                  .filter((s) => s.id !== activeShift?.id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.shiftCode} · {formatDateTimeVN(s.openedAt)}
                    </option>
                  ))}
              </select>
            )}

            {viewedShift.status === 'CLOSED' && (
              <>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="h-11 px-4 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-sm font-semibold text-[#0F172A] flex items-center gap-2"
                >
                  <MaterialIcon name="print" className="text-[19px]" />
                  <span>In báo cáo</span>
                </button>
                {!activeShift && (
                  <button
                    type="button"
                    onClick={onStartNewShift}
                    className="h-11 px-4 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-bold flex items-center gap-2"
                  >
                    <MaterialIcon name="play_circle" className="text-[19px]" />
                    <span>Mở ca làm việc mới</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* 4 Core KPI Summary Cells */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <div className="text-xs font-semibold text-[#64748B]">Tổng bán (Gross)</div>
            <div className="text-2xl font-bold text-[#0F172A] tabular-nums-strict mt-1.5">
              {formatVND(viewedShift.grossSales)}
            </div>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <div className="text-xs font-semibold text-[#64748B]">Tổng hoàn tiền</div>
            <div className="text-2xl font-bold text-[#DC2626] tabular-nums-strict mt-1.5">
              {formatVND(viewedShift.totalRefunds)}
            </div>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <div className="text-xs font-semibold text-[#64748B]">Doanh thu ròng (Net)</div>
            <div className="text-2xl font-bold text-[#0F766E] tabular-nums-strict mt-1.5">
              {formatVND(viewedShift.netRevenue)}
            </div>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <div className="text-xs font-semibold text-[#64748B]">Số đơn hoàn tất</div>
            <div className="text-2xl font-bold text-[#0F172A] tabular-nums-strict mt-1.5">
              {viewedShift.totalOrders} đơn
            </div>
          </div>
        </div>

        {/* Main 2-Column Shift Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Payment Breakdown, Top Products, Recent Orders */}
          <div className="lg:col-span-7 space-y-6">
            {/* Payment Method Breakdown */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-4">
              <h2 className="text-base font-bold text-[#0F172A]">
                Tỉ lệ theo phương thức thanh toán
              </h2>
              <div className="space-y-3.5">
                {(['CASH', 'CARD', 'UPI'] as const).map((method) => {
                  const amt = viewedShift.paymentBreakdown[method];
                  const pct = payPct(amt);
                  const barColor =
                    method === 'CASH'
                      ? 'bg-[#16A34A]'
                      : method === 'CARD'
                      ? 'bg-[#0F766E]'
                      : 'bg-[#F59E0B]';
                  return (
                    <div key={method} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-[#0F172A]">
                          {paymentMethodLabelVN(method)} ({method})
                        </span>
                        <span className="tabular-nums-strict font-bold text-[#0F172A]">
                          {formatVND(amt)}{' '}
                          <span className="text-xs font-medium text-[#64748B]">
                            ({pct}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-[#F1F5F9] rounded-full overflow-hidden">
                        <div
                          className={`h-full ${barColor} rounded-full transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Selling Products */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E2E8F0]">
                <h2 className="text-base font-bold text-[#0F172A]">
                  Sản phẩm bán chạy trong ca
                </h2>
              </div>
              {!viewedShift.topProducts || viewedShift.topProducts.length === 0 ? (
                <div className="p-6 text-sm text-[#64748B] text-center">
                  Chưa có sản phẩm nào được bán trong ca này.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-semibold text-[#64748B]">
                    <tr>
                      <th className="py-2.5 px-5">Sản phẩm</th>
                      <th className="py-2.5 px-4 text-right">SL</th>
                      <th className="py-2.5 px-5 text-right">Doanh thu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {viewedShift.topProducts.map((item) => (
                      <tr key={item.productId}>
                        <td className="py-3 px-5">
                          <div className="font-semibold text-[#0F172A]">{item.name}</div>
                          <div className="text-xs font-mono text-[#64748B]">{item.sku}</div>
                        </td>
                        <td className="py-3 px-4 text-right font-semibold tabular-nums-strict">
                          {item.quantity}
                        </td>
                        <td className="py-3 px-5 text-right font-bold text-[#0F766E] tabular-nums-strict">
                          {formatVND(item.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Recent Orders in Shift */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E2E8F0]">
                <h2 className="text-base font-bold text-[#0F172A]">
                  Đơn hàng gần đây trong ca
                </h2>
              </div>
              {!viewedShift.recentOrders || viewedShift.recentOrders.length === 0 ? (
                <div className="p-6 text-sm text-[#64748B] text-center">
                  Chưa có đơn hàng nào trong ca này.
                </div>
              ) : (
                <div className="divide-y divide-[#E2E8F0]">
                  {viewedShift.recentOrders.map((ord) => (
                    <button
                      key={ord.id}
                      type="button"
                      onClick={() => onViewOrderReceipt(ord)}
                      className="w-full px-5 py-3 text-left hover:bg-[#F8FAFC] flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-sm font-mono font-semibold text-[#0F172A]">
                          {ord.receiptCode}
                        </div>
                        <div className="text-xs text-[#64748B] tabular-nums-strict">
                          {ord.customerName} · {paymentMethodLabelVN(ord.paymentMethod)} ·{' '}
                          {formatDateTimeVN(ord.createdAt)}
                        </div>
                      </div>
                      <span className="text-sm font-bold text-[#0F172A] tabular-nums-strict">
                        {formatVND(ord.totalAmount)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Cash Drawer Reconciliation & Close Action */}
          <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-5">
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">
                Đối soát tiền mặt trong két
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Số tiền lý thuyết = Tiền đầu ca + Thu tiền mặt − Hoàn tiền mặt
              </p>
            </div>

            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Tiền mặt đầu ca</span>
                <span className="font-semibold tabular-nums-strict">
                  {formatVND(viewedShift.openingCash)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Thu tiền mặt trong ca</span>
                <span className="font-semibold text-[#16A34A] tabular-nums-strict">
                  +{formatVND(viewedShift.paymentBreakdown.CASH)}
                </span>
              </div>
              {(viewedShift.cashRefunds ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Hoàn tiền mặt trong ca</span>
                  <span className="font-semibold text-[#DC2626] tabular-nums-strict">
                    -{formatVND(viewedShift.cashRefunds ?? 0)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-[#E2E8F0] font-bold">
                <span className="text-[#0F172A]">Tiền mặt lý thuyết (Expected)</span>
                <span className="text-[#0F766E] tabular-nums-strict">
                  {formatVND(viewedShift.expectedCash)}
                </span>
              </div>
            </div>

            {isClosingActiveShift ? (
              <>
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-[#64748B]">
                      Tiền mặt thực đếm trong két
                    </div>
                    <div className="text-2xl font-bold text-[#0F172A] tabular-nums-strict mt-0.5">
                      {formatVND(actualCash)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-[#64748B]">Chênh lệch</div>
                    <div
                      className={`text-base font-bold tabular-nums-strict mt-0.5 ${
                        variance === 0
                          ? 'text-[#16A34A]'
                          : variance > 0
                          ? 'text-[#0F766E]'
                          : 'text-[#DC2626]'
                      }`}
                    >
                      {variance === 0
                        ? 'Khớp 0 ₫'
                        : `${variance > 0 ? '+' : ''}${formatVND(variance)}`}
                    </div>
                  </div>
                </div>

                <VirtualNumpad
                  value={actualCash}
                  onChange={setActualCash}
                  quickChips={[
                    {
                      label: 'Khớp két',
                      amount: viewedShift.expectedCash,
                      isExact: true,
                    },
                    { label: '500.000 ₫', amount: 500000 },
                    { label: '1.000.000 ₫', amount: 1000000 },
                    { label: '2.000.000 ₫', amount: 2000000 },
                  ]}
                />

                <div>
                  <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">
                    Ghi chú kết ca
                  </label>
                  <input
                    type="text"
                    value={closingNote}
                    onChange={(e) => setClosingNote(e.target.value)}
                    placeholder="Ghi chú chênh lệch hoặc bàn giao ca sau..."
                    className="w-full h-12 px-3.5 rounded-xl border border-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
                  />
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#DC2626]">
                    {error}
                  </div>
                )}

                <button
                  type="button"
                  disabled={closing}
                  onClick={handleCloseShift}
                  className="w-full h-14 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] active:scale-[0.99] text-white font-bold text-base transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <MaterialIcon name="lock" className="text-[22px]" />
                  <span>
                    {closing ? 'Đang chốt ca...' : 'Xác nhận đóng ca & Xuất tóm tắt'}
                  </span>
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Tiền mặt thực đếm</span>
                    <span className="font-bold tabular-nums-strict">
                      {formatVND(viewedShift.actualCash ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Chênh lệch két</span>
                    <span
                      className={`font-bold tabular-nums-strict ${
                        (viewedShift.cashVariance ?? 0) === 0
                          ? 'text-[#16A34A]'
                          : 'text-[#DC2626]'
                      }`}
                    >
                      {(viewedShift.cashVariance ?? 0) === 0
                        ? 'Khớp 0 ₫'
                        : formatVND(viewedShift.cashVariance ?? 0)}
                    </span>
                  </div>
                </div>
                {viewedShift.closingNote && (
                  <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#64748B]">
                    <span className="font-semibold text-[#0F172A]">Ghi chú: </span>
                    {viewedShift.closingNote}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
