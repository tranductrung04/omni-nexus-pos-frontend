import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { Branch, Order, Shift, User } from '../types';
import {
  downloadCsv,
  formatDateVN,
  formatDurationVN,
  formatTimeVN,
  formatVND,
  paymentMethodLabelVN,
} from '../utils/format';
import { MaterialIcon } from './MaterialIcon';

interface ShiftReportsViewProps {
  user: User;
  storeId: string;
  onViewOrderReceipt: (order: Order) => void;
  onOpenOrderDetail?: (orderId: string) => void;
}

const DONUT_CIRCUMFERENCE = 2 * Math.PI * 46; // ~289.0265

export const ShiftReportsView: React.FC<ShiftReportsViewProps> = ({
  user,
  storeId,
  onViewOrderReceipt,
  onOpenOrderDetail,
}) => {
  const isBranchLocked = user.role === 'BRANCH_MANAGER' && Boolean(user.branchId);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    isBranchLocked && user.branchId ? user.branchId : 'ALL'
  );
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  // List filters
  const [cashierFilter, setCashierFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [branchList, shiftList] = await Promise.all([
        api.getBranches(storeId),
        api.getShifts({ storeId, branchId: selectedBranchId }),
      ]);
      setBranches(branchList);
      setShifts(shiftList);
    } catch (err) {
      console.error('Failed to load shift reports:', err);
    } finally {
      setLoading(false);
    }
  }, [storeId, selectedBranchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const cashierOptions = useMemo(() => {
    return Array.from(new Set(shifts.map((s) => s.cashierName)))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'vi'));
  }, [shifts]);

  const filteredShifts = useMemo(() => {
    return shifts.filter((s) => {
      if (cashierFilter !== 'ALL' && s.cashierName !== cashierFilter) return false;
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
      return true;
    });
  }, [shifts, cashierFilter, statusFilter]);

  const summary = useMemo(() => {
    const shiftCount = filteredShifts.length;
    const openCount = filteredShifts.filter((s) => s.status === 'OPEN').length;
    const closedCount = shiftCount - openCount;
    const totalOrders = filteredShifts.reduce((sum, s) => sum + s.totalOrders, 0);
    const grossSales = filteredShifts.reduce((sum, s) => sum + s.grossSales, 0);
    const totalRefunds = filteredShifts.reduce((sum, s) => sum + s.totalRefunds, 0);
    const netRevenue = filteredShifts.reduce((sum, s) => sum + s.netRevenue, 0);
    const refundCount = filteredShifts.reduce(
      (sum, s) => sum + (s.refunds?.length || 0),
      0
    );
    const avgOrdersPerShift =
      shiftCount > 0 ? Math.round((totalOrders / shiftCount) * 10) / 10 : 0;
    const refundRatePct =
      grossSales > 0 ? Math.round((totalRefunds / grossSales) * 1000) / 10 : 0;

    return {
      shiftCount,
      openCount,
      closedCount,
      totalOrders,
      grossSales,
      totalRefunds,
      netRevenue,
      refundCount,
      avgOrdersPerShift,
      refundRatePct,
    };
  }, [filteredShifts]);

  const selectedShift = useMemo(
    () => shifts.find((s) => s.id === selectedShiftId) || null,
    [shifts, selectedShiftId]
  );

  const handleExportListCsv = () => {
    downloadCsv(
      `bao-cao-ca-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Mã ca',
        'Ngày',
        'Chi nhánh',
        'Thu ngân',
        'Quầy POS',
        'Bắt đầu',
        'Kết thúc',
        'Thời lượng',
        'Số đơn',
        'Doanh thu gộp (VND)',
        'Hoàn tiền (VND)',
        'Doanh thu ròng (VND)',
        'Trạng thái',
      ],
      filteredShifts.map((s) => [
        s.shiftCode,
        formatDateVN(s.openedAt),
        s.branchName,
        s.cashierName,
        s.registerName,
        formatTimeVN(s.openedAt),
        formatTimeVN(s.closedAt),
        formatDurationVN(s.openedAt, s.closedAt),
        s.totalOrders,
        s.grossSales,
        s.totalRefunds,
        s.netRevenue,
        s.status === 'OPEN' ? 'Đang mở' : 'Đã kết thúc',
      ])
    );
  };

  const handleExportSingleShiftCsv = (s: Shift) => {
    downloadCsv(
      `bao-cao-${s.shiftCode}.csv`,
      ['Hạng mục', 'Giá trị'],
      [
        ['Mã ca', s.shiftCode],
        ['Chi nhánh', s.branchName],
        ['Thu ngân', s.cashierName],
        ['Máy POS', s.registerName],
        ['Mở ca', formatTimeVN(s.openedAt)],
        ['Đóng ca', formatTimeVN(s.closedAt)],
        ['Số đơn hàng', s.totalOrders],
        ['Tổng doanh thu (VND)', s.grossSales],
        ['Tổng hoàn tiền (VND)', s.totalRefunds],
        ['Doanh thu ròng (VND)', s.netRevenue],
        ['Tiền mặt (VND)', s.paymentBreakdown.CASH],
        ['Thẻ ngân hàng (VND)', s.paymentBreakdown.CARD],
        ['QR / Ví điện tử (VND)', s.paymentBreakdown.UPI],
        ['Tiền mặt đầu ca (VND)', s.openingCash],
        ['Tiền mặt lý thuyết (VND)', s.expectedCash],
        ['Tiền mặt thực đếm (VND)', s.actualCash ?? 'Chưa đóng ca'],
      ]
    );
  };

  // --- DETAIL REPORT MODE ---
  if (selectedShift) {
    const payTotal =
      selectedShift.paymentBreakdown.CASH +
      selectedShift.paymentBreakdown.CARD +
      selectedShift.paymentBreakdown.UPI;
    const cashPct =
      payTotal > 0 ? (selectedShift.paymentBreakdown.CASH / payTotal) * 100 : 0;
    const cardPct =
      payTotal > 0 ? (selectedShift.paymentBreakdown.CARD / payTotal) * 100 : 0;
    const upiPct =
      payTotal > 0 ? (selectedShift.paymentBreakdown.UPI / payTotal) * 100 : 0;

    const cashLen = (cashPct / 100) * DONUT_CIRCUMFERENCE;
    const cardLen = (cardPct / 100) * DONUT_CIRCUMFERENCE;
    const upiLen = (upiPct / 100) * DONUT_CIRCUMFERENCE;

    const avgOrderValue =
      selectedShift.totalOrders > 0
        ? Math.round(selectedShift.grossSales / selectedShift.totalOrders)
        : 0;
    const activeMethodCount = (
      ['CASH', 'CARD', 'UPI'] as const
    ).filter((m) => selectedShift.paymentBreakdown[m] > 0).length;

    const top5 = (selectedShift.topProducts || []).slice(0, 5);
    const shiftRefunds = selectedShift.refunds || [];
    const shiftRecentOrders = selectedShift.recentOrders || [];

    return (
      <div className="flex-1 min-h-0 overflow-y-auto pos-scroll bg-[#F8FAFC] p-4 lg:p-6">
        <div className="max-w-7xl mx-auto space-y-5">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#64748B]">
            <button
              type="button"
              onClick={() => setSelectedShiftId(null)}
              className="inline-flex items-center gap-1 hover:text-[#0F766E]"
            >
              <MaterialIcon name="arrow_back" className="text-[16px]" />
              <span>Báo cáo ca</span>
            </button>
            <span>/</span>
            <span className="text-[#0F172A]">
              {formatDateVN(selectedShift.openedAt)} · {selectedShift.cashierName}
            </span>
          </div>

          {/* Detail Header */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => setSelectedShiftId(null)}
                aria-label="Quay lại danh sách báo cáo ca"
                className="w-10 h-10 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] flex items-center justify-center text-[#0F172A] shrink-0"
              >
                <MaterialIcon name="arrow_back" className="text-[20px]" />
              </button>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl font-bold text-[#0F172A]">
                    Báo cáo ca {selectedShift.shiftCode} ·{' '}
                    {formatDateVN(selectedShift.openedAt)}
                  </h1>
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-lg border ${
                      selectedShift.status === 'OPEN'
                        ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#16A34A]'
                        : 'bg-[#F1F5F9] border-[#E2E8F0] text-[#64748B]'
                    }`}
                  >
                    {selectedShift.status === 'OPEN' ? 'Đang mở' : 'Đã kết thúc'}
                  </span>
                </div>
                <p className="text-sm text-[#64748B] mt-1 tabular-nums-strict">
                  {selectedShift.cashierName} · {selectedShift.branchName} ·{' '}
                  {selectedShift.registerName} ·{' '}
                  <strong className="text-[#0F172A]">
                    {formatTimeVN(selectedShift.openedAt)} –{' '}
                    {selectedShift.closedAt
                      ? formatTimeVN(selectedShift.closedAt)
                      : 'Hiện tại'}
                  </strong>{' '}
                  ({formatDurationVN(selectedShift.openedAt, selectedShift.closedAt)})
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => window.print()}
                className="h-11 px-4 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-sm font-semibold text-[#0F172A] flex items-center gap-2"
              >
                <MaterialIcon name="print" className="text-[19px]" />
                <span>In báo cáo</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportSingleShiftCsv(selectedShift)}
                className="h-11 px-4 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-semibold flex items-center gap-2"
              >
                <MaterialIcon name="download" className="text-[19px]" />
                <span>Xuất báo cáo (CSV)</span>
              </button>
            </div>
          </div>

          {/* 4 KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#64748B]">
                  Tổng doanh thu
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#F0FDFA] text-[#0F766E] flex items-center justify-center">
                  <MaterialIcon name="point_of_sale" className="text-[18px]" />
                </div>
              </div>
              <div className="text-2xl font-bold text-[#0F172A] tabular-nums-strict">
                {formatVND(selectedShift.grossSales)}
              </div>
              <div className="text-xs text-[#64748B]">
                Trước hoàn tiền tại quầy
              </div>
            </div>

            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#64748B]">
                  Tổng hoàn tiền
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center">
                  <MaterialIcon name="currency_exchange" className="text-[18px]" />
                </div>
              </div>
              <div className="text-2xl font-bold text-[#DC2626] tabular-nums-strict">
                {selectedShift.totalRefunds > 0
                  ? `-${formatVND(selectedShift.totalRefunds)}`
                  : formatVND(0)}
              </div>
              <div className="text-xs text-[#64748B] tabular-nums-strict">
                {shiftRefunds.length} yêu cầu đã xử lý
              </div>
            </div>

            <div className="bg-[#0F766E] rounded-xl p-5 space-y-2 text-white">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#CCFBF1]">
                  Doanh thu ròng
                </span>
                <div className="w-8 h-8 rounded-lg bg-white/15 text-white flex items-center justify-center">
                  <MaterialIcon
                    name="account_balance_wallet"
                    className="text-[18px]"
                  />
                </div>
              </div>
              <div className="text-2xl font-bold text-white tabular-nums-strict">
                {formatVND(selectedShift.netRevenue)}
              </div>
              <div className="text-xs text-[#CCFBF1]">
                Doanh thu thực tế sau hoàn
              </div>
            </div>

            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#64748B]">
                  Số đơn hàng
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] text-[#0F172A] flex items-center justify-center">
                  <MaterialIcon name="receipt_long" className="text-[18px]" />
                </div>
              </div>
              <div className="text-2xl font-bold text-[#0F172A] tabular-nums-strict">
                {selectedShift.totalOrders}
              </div>
              <div className="text-xs text-[#64748B] tabular-nums-strict">
                Trung bình {formatVND(avgOrderValue)} / đơn
              </div>
            </div>
          </div>

          {/* Middle 50/50 Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Card 1: Payment Methods + SVG Donut */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MaterialIcon
                    name="pie_chart"
                    className="text-[20px] text-[#0F766E]"
                  />
                  <h2 className="text-base font-bold text-[#0F172A]">
                    Theo phương thức thanh toán
                  </h2>
                </div>
                <span className="text-xs font-semibold text-[#64748B] tabular-nums-strict">
                  {activeMethodCount} hình thức
                </span>
              </div>

              {payTotal === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-[#F1F5F9] text-[#94A3B8] flex items-center justify-center">
                    <MaterialIcon name="payments" className="text-[26px]" />
                  </div>
                  <div className="text-sm font-bold text-[#0F172A]">
                    Chưa có giao dịch trong ca này
                  </div>
                  <p className="text-xs text-[#64748B] max-w-xs">
                    Các khoản thanh toán qua tiền mặt, thẻ ngân hàng và mã QR sẽ
                    hiển thị tại đây khi phát sinh giao dịch.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-6 my-auto">
                  {/* SVG Donut */}
                  <div className="relative w-40 h-40 shrink-0 flex items-center justify-center">
                    <svg
                      className="w-full h-full -rotate-90"
                      viewBox="0 0 120 120"
                    >
                      <circle
                        cx="60"
                        cy="60"
                        r="46"
                        fill="none"
                        stroke="#F1F5F9"
                        strokeWidth="16"
                      />
                      {cashLen > 0 && (
                        <circle
                          cx="60"
                          cy="60"
                          r="46"
                          fill="none"
                          stroke="#0F766E"
                          strokeWidth="16"
                          strokeDasharray={`${cashLen} ${DONUT_CIRCUMFERENCE}`}
                          strokeDashoffset="0"
                        />
                      )}
                      {cardLen > 0 && (
                        <circle
                          cx="60"
                          cy="60"
                          r="46"
                          fill="none"
                          stroke="#2563EB"
                          strokeWidth="16"
                          strokeDasharray={`${cardLen} ${DONUT_CIRCUMFERENCE}`}
                          strokeDashoffset={-cashLen}
                        />
                      )}
                      {upiLen > 0 && (
                        <circle
                          cx="60"
                          cy="60"
                          r="46"
                          fill="none"
                          stroke="#7C3AED"
                          strokeWidth="16"
                          strokeDasharray={`${upiLen} ${DONUT_CIRCUMFERENCE}`}
                          strokeDashoffset={-(cashLen + cardLen)}
                        />
                      )}
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className="text-[11px] font-medium text-[#64748B]">
                        Tổng thu
                      </span>
                      <span className="text-sm font-bold text-[#0F172A]">
                        100%
                      </span>
                    </div>
                  </div>

                  {/* Breakdown Rows */}
                  <div className="flex-1 w-full space-y-3">
                    {(
                      [
                        {
                          key: 'CASH',
                          label: 'Tiền mặt',
                          dot: 'bg-[#0F766E]',
                          bar: 'bg-[#0F766E]',
                          text: 'text-[#0F766E]',
                          pct: Math.round(cashPct),
                        },
                        {
                          key: 'CARD',
                          label: 'Thẻ (POS)',
                          dot: 'bg-[#2563EB]',
                          bar: 'bg-[#2563EB]',
                          text: 'text-[#2563EB]',
                          pct: Math.round(cardPct),
                        },
                        {
                          key: 'UPI',
                          label: 'QR / Ví điện tử',
                          dot: 'bg-[#7C3AED]',
                          bar: 'bg-[#7C3AED]',
                          text: 'text-[#7C3AED]',
                          pct: Math.round(upiPct),
                        },
                      ] as const
                    ).map((m) => {
                      const amt = selectedShift.paymentBreakdown[m.key];
                      const cnt = selectedShift.paymentCounts?.[m.key] ?? 0;
                      return (
                        <div
                          key={m.key}
                          className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2.5 h-2.5 rounded-full ${m.dot}`}
                              />
                              <span className="font-semibold text-[#0F172A]">
                                {m.label}
                              </span>
                              <span className="text-[#64748B] tabular-nums-strict">
                                ({cnt} giao dịch)
                              </span>
                            </div>
                            <div className="flex items-center gap-2 tabular-nums-strict">
                              <span className="font-bold text-[#0F172A]">
                                {formatVND(amt)}
                              </span>
                              <span className={`font-bold ${m.text}`}>
                                {m.pct}%
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-[#E2E8F0] overflow-hidden">
                            <div
                              className={`h-full ${m.bar} rounded-full`}
                              style={{ width: `${m.pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Card 2: Top 5 Best Sellers */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MaterialIcon
                    name="local_fire_department"
                    className="text-[20px] text-[#B45309]"
                  />
                  <h2 className="text-base font-bold text-[#0F172A]">
                    Sản phẩm bán chạy
                  </h2>
                </div>
                <span className="text-xs font-bold text-[#B45309]">Top 5</span>
              </div>

              {top5.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-[#F1F5F9] text-[#94A3B8] flex items-center justify-center">
                    <MaterialIcon name="inventory_2" className="text-[26px]" />
                  </div>
                  <div className="text-sm font-bold text-[#0F172A]">
                    Chưa có sản phẩm nào được bán trong ca này
                  </div>
                  <p className="text-xs text-[#64748B] max-w-xs">
                    Danh sách sản phẩm bán chạy nhất sẽ tự động sắp xếp theo số
                    lượng và doanh thu.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {top5.map((prod, idx) => (
                    <div
                      key={prod.productId}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 tabular-nums-strict ${
                            idx === 0
                              ? 'bg-[#FEF3C7] text-[#B45309]'
                              : 'bg-[#E2E8F0] text-[#0F172A]'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        {prod.imageUrl ? (
                          <img
                            src={prod.imageUrl}
                            alt={prod.name}
                            className="w-10 h-10 rounded-lg object-cover bg-[#F1F5F9] shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-[#E2E8F0] text-[#64748B] flex items-center justify-center shrink-0">
                            <MaterialIcon name="local_cafe" className="text-[18px]" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#0F172A] truncate">
                            {prod.name}
                          </div>
                          <div className="text-xs text-[#64748B] font-mono tabular-nums-strict">
                            SKU: {prod.sku} · {prod.quantity} đã bán
                          </div>
                        </div>
                      </div>
                      <div className="text-right font-bold text-sm text-[#0F766E] tabular-nums-strict shrink-0">
                        {formatVND(prod.revenue)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bottom 50/50 Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Card 3: Refunds in Shift */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MaterialIcon name="undo" className="text-[20px] text-[#DC2626]" />
                  <h2 className="text-base font-bold text-[#0F172A]">
                    Hoàn tiền ({shiftRefunds.length})
                  </h2>
                </div>
                <span className="text-xs font-bold text-[#DC2626] tabular-nums-strict">
                  {selectedShift.totalRefunds > 0
                    ? `-${formatVND(selectedShift.totalRefunds)}`
                    : formatVND(0)}
                </span>
              </div>

              {shiftRefunds.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-[#F1F5F9] text-[#94A3B8] flex items-center justify-center">
                    <MaterialIcon name="check_circle" className="text-[26px]" />
                  </div>
                  <div className="text-sm font-bold text-[#0F172A]">
                    Chưa có hoàn tiền phát sinh
                  </div>
                  <p className="text-xs text-[#64748B] max-w-xs">
                    Không có đơn hàng nào bị hoàn trả trong suốt thời gian của
                    ca này.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {shiftRefunds.map((ref) => (
                    <div
                      key={ref.id}
                      className="p-3.5 rounded-xl bg-[#FEF2F2]/60 border border-[#FECACA] flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono font-bold text-[#0F766E]">
                            {ref.receiptCode}
                          </span>
                          <span className="text-[#64748B]">
                            · {paymentMethodLabelVN(ref.method)} ·{' '}
                            {formatTimeVN(ref.createdAt)}
                          </span>
                        </div>
                        <div className="text-xs text-[#0F172A] truncate">
                          Lý do: <strong>{ref.reason}</strong>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-[#DC2626] tabular-nums-strict shrink-0">
                        -{formatVND(ref.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Card 4: Recent Orders */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MaterialIcon
                    name="history"
                    className="text-[20px] text-[#0F766E]"
                  />
                  <h2 className="text-base font-bold text-[#0F172A]">
                    Đơn gần đây
                  </h2>
                </div>
                <span className="text-xs font-semibold text-[#64748B] tabular-nums-strict">
                  {shiftRecentOrders.length} / {selectedShift.totalOrders} đơn
                </span>
              </div>

              {shiftRecentOrders.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-[#F1F5F9] text-[#94A3B8] flex items-center justify-center">
                    <MaterialIcon name="receipt" className="text-[26px]" />
                  </div>
                  <div className="text-sm font-bold text-[#0F172A]">
                    Chưa có đơn hàng nào trong ca này
                  </div>
                  <p className="text-xs text-[#64748B] max-w-xs">
                    Khi nhân viên thực hiện thanh toán giao dịch, các đơn hàng sẽ
                    được liệt kê tại đây.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead className="border-b border-[#E2E8F0] text-xs font-semibold text-[#64748B]">
                      <tr>
                        <th className="pb-2.5">Mã đơn</th>
                        <th className="pb-2.5">Giờ</th>
                        <th className="pb-2.5">Thanh toán</th>
                        <th className="pb-2.5 text-right">Tổng tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {shiftRecentOrders.map((ord) => (
                        <tr
                          key={ord.id}
                          onClick={() =>
                            onOpenOrderDetail
                              ? onOpenOrderDetail(ord.id)
                              : onViewOrderReceipt(ord)
                          }
                          className="hover:bg-[#F8FAFC] cursor-pointer"
                        >
                          <td className="py-2.5 font-mono font-bold text-[#0F766E]">
                            {ord.receiptCode}
                          </td>
                          <td className="py-2.5 text-xs text-[#64748B] tabular-nums-strict">
                            {formatTimeVN(ord.createdAt)}
                          </td>
                          <td className="py-2.5 text-xs text-[#0F172A]">
                            {paymentMethodLabelVN(ord.paymentMethod)}
                          </td>
                          <td className="py-2.5 text-right font-bold text-[#0F172A] tabular-nums-strict">
                            {formatVND(ord.totalAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Cash Drawer Reconciliation Summary */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
            <h2 className="text-base font-bold text-[#0F172A] mb-3">
              Đối soát tiền mặt trong két
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="text-xs text-[#64748B]">Tiền đầu ca</div>
                <div className="font-bold text-[#0F172A] tabular-nums-strict mt-1">
                  {formatVND(selectedShift.openingCash)}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="text-xs text-[#64748B]">Thu tiền mặt</div>
                <div className="font-bold text-[#16A34A] tabular-nums-strict mt-1">
                  +{formatVND(selectedShift.paymentBreakdown.CASH)}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="text-xs text-[#64748B]">Hoàn tiền mặt</div>
                <div className="font-bold text-[#DC2626] tabular-nums-strict mt-1">
                  -{formatVND(selectedShift.cashRefunds ?? 0)}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="text-xs text-[#64748B]">Lý thuyết (Expected)</div>
                <div className="font-bold text-[#0F766E] tabular-nums-strict mt-1">
                  {formatVND(selectedShift.expectedCash)}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="text-xs text-[#64748B]">Thực đếm / Chênh lệch</div>
                <div className="font-bold text-[#0F172A] tabular-nums-strict mt-1">
                  {selectedShift.actualCash !== null
                    ? `${formatVND(selectedShift.actualCash)} (${
                        (selectedShift.cashVariance ?? 0) === 0
                          ? 'Khớp'
                          : formatVND(selectedShift.cashVariance ?? 0)
                      })`
                    : 'Đang mở ca'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- SHIFT REPORTS LIST VIEW ---
  return (
    <div className="flex-1 min-h-0 overflow-y-auto pos-scroll bg-[#F8FAFC] p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-[#0F172A]">Báo cáo ca</h1>
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

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => window.print()}
              className="h-11 px-4 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-sm font-semibold text-[#0F172A] flex items-center gap-2"
            >
              <MaterialIcon name="print" className="text-[19px]" />
              <span>In danh sách</span>
            </button>
            <button
              type="button"
              onClick={handleExportListCsv}
              disabled={filteredShifts.length === 0}
              className="h-11 px-4 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
            >
              <MaterialIcon name="download" className="text-[19px]" />
              <span>Xuất báo cáo (CSV)</span>
            </button>
          </div>
        </div>

        {/* 4 Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#64748B]">
                Số ca làm việc
              </span>
              <div className="w-9 h-9 rounded-xl bg-[#F0FDFA] text-[#0F766E] flex items-center justify-center">
                <MaterialIcon name="schedule" className="text-[20px]" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0F172A] tabular-nums-strict">
              {summary.shiftCount}
            </div>
            <div className="text-xs text-[#64748B] tabular-nums-strict">
              {summary.closedCount} hoàn tất · {summary.openCount} đang mở
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#64748B]">
                Tổng đơn hoàn thành
              </span>
              <div className="w-9 h-9 rounded-xl bg-[#FFFBEB] text-[#B45309] flex items-center justify-center">
                <MaterialIcon name="receipt_long" className="text-[20px]" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0F172A] tabular-nums-strict">
              {summary.totalOrders}
            </div>
            <div className="text-xs text-[#64748B] tabular-nums-strict">
              ~ {summary.avgOrdersPerShift} đơn trung bình / ca
            </div>
          </div>

          <div className="bg-[#0F766E] rounded-xl p-5 flex flex-col justify-between gap-2 text-white">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#CCFBF1]">
                Doanh thu ròng
              </span>
              <div className="w-9 h-9 rounded-xl bg-white/15 text-white flex items-center justify-center">
                <MaterialIcon name="payments" className="text-[20px]" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white tabular-nums-strict">
              {formatVND(summary.netRevenue)}
            </div>
            <div className="text-xs text-[#CCFBF1]">
              Sau khấu trừ toàn bộ tiền hoàn
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#64748B]">
                Tổng hoàn tiền
              </span>
              <div className="w-9 h-9 rounded-xl bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center">
                <MaterialIcon name="assignment_return" className="text-[20px]" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#DC2626] tabular-nums-strict">
              {formatVND(summary.totalRefunds)}
            </div>
            <div className="text-xs text-[#64748B] tabular-nums-strict">
              {summary.refundCount} giao dịch hoàn · tỉ lệ{' '}
              {summary.refundRatePct.toLocaleString('vi-VN')}%
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={cashierFilter}
              onChange={(e) => setCashierFilter(e.target.value)}
              aria-label="Lọc theo thu ngân"
              className="h-11 px-3 rounded-xl border border-[#CBD5E1] bg-white text-sm font-medium text-[#0F172A]"
            >
              <option value="ALL">Tất cả thu ngân ({cashierOptions.length})</option>
              {cashierOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <div className="inline-flex p-1 rounded-xl bg-[#F1F5F9]">
              {(
                [
                  { id: 'ALL', label: `Tất cả (${shifts.length})` },
                  {
                    id: 'OPEN',
                    label: `Đang mở (${
                      shifts.filter((s) => s.status === 'OPEN').length
                    })`,
                  },
                  {
                    id: 'CLOSED',
                    label: `Đã kết thúc (${
                      shifts.filter((s) => s.status === 'CLOSED').length
                    })`,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`h-9 px-3.5 rounded-lg text-xs font-semibold transition-colors ${
                    statusFilter === tab.id
                      ? 'bg-white text-[#0F766E] shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setCashierFilter('ALL');
              setStatusFilter('ALL');
            }}
            className="h-11 px-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-sm font-semibold text-[#0F766E] flex items-center justify-center gap-1.5 self-end lg:self-auto"
          >
            <MaterialIcon name="filter_alt_off" className="text-[18px]" />
            <span>Xóa bộ lọc</span>
          </button>
        </div>

        {/* Shifts Table */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm text-[#64748B]">
              Đang tải báo cáo ca làm việc...
            </div>
          ) : filteredShifts.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <MaterialIcon name="summarize" className="text-[40px] text-[#94A3B8]" />
              <div className="text-base font-bold text-[#0F172A]">
                Chưa có ca làm việc nào khớp bộ lọc
              </div>
              <p className="text-sm text-[#64748B]">
                Thay đổi bộ lọc trạng thái hoặc chi nhánh để xem các ca làm việc.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-semibold text-[#64748B]">
                  <tr>
                    <th className="py-3.5 px-5">Ngày & Ca</th>
                    <th className="py-3.5 px-4">Thu ngân</th>
                    <th className="py-3.5 px-3 text-center">Bắt đầu</th>
                    <th className="py-3.5 px-3 text-center">Kết thúc</th>
                    <th className="py-3.5 px-3 text-center">Thời lượng</th>
                    <th className="py-3.5 px-3 text-right">Số đơn</th>
                    <th className="py-3.5 px-4 text-right">Doanh thu</th>
                    <th className="py-3.5 px-4 text-right">Hoàn tiền</th>
                    <th className="py-3.5 px-4 text-right">Doanh thu ròng</th>
                    <th className="py-3.5 px-4 text-center">Trạng thái</th>
                    <th className="py-3.5 px-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {filteredShifts.map((sh) => {
                    const initials = sh.cashierName
                      .trim()
                      .split(/\s+/)
                      .slice(-2)
                      .map((w) => w[0])
                      .join('')
                      .toUpperCase();
                    return (
                      <tr
                        key={sh.id}
                        onClick={() => setSelectedShiftId(sh.id)}
                        className="hover:bg-[#F8FAFC] cursor-pointer transition-colors"
                      >
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          <div className="font-semibold text-[#0F172A] tabular-nums-strict">
                            {formatDateVN(sh.openedAt)}
                          </div>
                          <div className="text-xs font-mono text-[#64748B]">
                            {sh.shiftCode} · {sh.branchName}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#0F766E]/10 text-[#0F766E] text-xs font-bold flex items-center justify-center shrink-0">
                              {initials}
                            </div>
                            <div>
                              <div className="font-semibold text-[#0F172A]">
                                {sh.cashierName}
                              </div>
                              <div className="text-xs text-[#64748B]">
                                {sh.registerName}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-center font-semibold text-[#0F172A] tabular-nums-strict">
                          {formatTimeVN(sh.openedAt)}
                        </td>
                        <td className="py-3.5 px-3 text-center text-[#64748B] tabular-nums-strict">
                          {formatTimeVN(sh.closedAt)}
                        </td>
                        <td className="py-3.5 px-3 text-center text-[#64748B] tabular-nums-strict">
                          {formatDurationVN(sh.openedAt, sh.closedAt)}
                        </td>
                        <td className="py-3.5 px-3 text-right font-semibold text-[#0F172A] tabular-nums-strict">
                          {sh.totalOrders}
                        </td>
                        <td className="py-3.5 px-4 text-right font-semibold text-[#0F172A] tabular-nums-strict whitespace-nowrap">
                          {formatVND(sh.grossSales)}
                        </td>
                        <td
                          className={`py-3.5 px-4 text-right font-semibold tabular-nums-strict whitespace-nowrap ${
                            sh.totalRefunds > 0
                              ? 'text-[#DC2626]'
                              : 'text-[#64748B]'
                          }`}
                        >
                          {formatVND(sh.totalRefunds)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-[#0F766E] tabular-nums-strict whitespace-nowrap">
                          {formatVND(sh.netRevenue)}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span
                            className={`text-xs font-bold ${
                              sh.status === 'OPEN'
                                ? 'text-[#16A34A]'
                                : 'text-[#64748B]'
                            }`}
                          >
                            {sh.status === 'OPEN' ? 'Đang mở' : 'Đã kết thúc'}
                          </span>
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
