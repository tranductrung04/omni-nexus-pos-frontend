import React, { useMemo, useState } from 'react';
import { api } from '../api';
import type { Order, PaymentMethod, Refund, Shift } from '../types';
import {
  formatDateTimeVN,
  formatVND,
  paymentMethodLabelVN,
} from '../utils/format';
import { MaterialIcon } from './MaterialIcon';

interface RefundModalProps {
  order: Order;
  activeShift: Shift | null;
  cashierName?: string;
  onClose: () => void;
  onRefundCreated: (
    updatedOrder: Order,
    newRefund: Refund,
    updatedShift: Shift | null
  ) => void;
}

const REASON_PRESETS = [
  'Sản phẩm lỗi',
  'Khách đổi ý',
  'Thu nhầm tiền',
  'Sản phẩm hết hạn',
  'Khác',
];

export const RefundModal: React.FC<RefundModalProps> = ({
  order,
  activeShift,
  cashierName,
  onClose,
  onRefundCreated,
}) => {
  const remaining = Math.max(0, order.totalAmount - order.refundedAmount);
  const hasPriorRefund = order.refundedAmount > 0;

  const [amount, setAmount] = useState<number>(remaining);
  const [selectedReason, setSelectedReason] = useState<string>(REASON_PRESETS[0]);
  const [note, setNote] = useState<string>('');
  const [method, setMethod] = useState<PaymentMethod>(order.paymentMethod);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const totalItemQty = useMemo(
    () => order.items.reduce((sum, i) => sum + i.quantity, 0),
    [order.items]
  );

  const initials = useMemo(() => {
    const parts = (order.customerName || 'KL').trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [order.customerName]);

  const isOverLimit = amount > remaining;
  const isInvalidZero = amount <= 0;
  const canSubmit = !isOverLimit && !isInvalidZero && !submitting;

  const isFullSelected = amount === remaining && remaining > 0;

  const handleKeyPress = (key: string) => {
    setServerError(null);
    if (key === 'C') {
      setAmount(0);
      return;
    }
    if (key === 'BACK') {
      const str = String(Math.floor(amount));
      if (str.length <= 1) {
        setAmount(0);
      } else {
        setAmount(Number(str.slice(0, -1)) || 0);
      }
      return;
    }
    if (key === '+10k') {
      setAmount((prev) => Math.min(999_999_999, prev + 10_000));
      return;
    }
    if (key === '+50k') {
      setAmount((prev) => Math.min(999_999_999, prev + 50_000));
      return;
    }
    if (key === '000') {
      setAmount((prev) => {
        if (prev === 0) return 0;
        const next = prev * 1000;
        return next > 999_999_999 ? prev : next;
      });
      return;
    }
    // Digit 0-9
    setAmount((prev) => {
      const nextStr = prev === 0 ? key : `${prev}${key}`;
      const nextNum = Number(nextStr);
      if (!Number.isFinite(nextNum) || nextNum > 999_999_999) return prev;
      return nextNum;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setServerError(null);
    setSubmitting(true);
    try {
      const res = await api.createRefund({
        orderId: order.id,
        shiftId: activeShift?.id || order.shiftId,
        amount,
        reason: selectedReason,
        note: note.trim(),
        method,
      });
      onRefundCreated(res.order, res.refund, res.shift);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Không thể tạo phiếu hoàn tiền.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0F172A]/50 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[640px] max-h-[92vh] bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Top Accent Strip */}
        <div className="h-1 bg-[#DC2626] shrink-0" />

        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] flex items-center justify-center shrink-0">
              <MaterialIcon name="keyboard_return" className="text-[22px]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[#0F172A] truncate">
                  Hoàn tiền đơn{' '}
                  <span className="font-mono text-[#0F766E]">
                    {order.receiptCode}
                  </span>
                </h2>
              </div>
              <p className="text-xs text-[#64748B] truncate mt-0.5 tabular-nums-strict">
                Tổng đơn:{' '}
                <strong className="text-[#0F172A]">
                  {formatVND(order.totalAmount)}
                </strong>
                {hasPriorRefund ? (
                  <>
                    {' '}
                    · Đã hoàn:{' '}
                    <strong className="text-[#DC2626]">
                      {formatVND(order.refundedAmount)}
                    </strong>
                  </>
                ) : (
                  <> · {order.branchName || 'Quầy POS'}</>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại"
            className="w-11 h-11 rounded-xl border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] flex items-center justify-center shrink-0"
          >
            <MaterialIcon name="close" className="text-[20px]" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 pos-scroll">
          {/* Order Summary Card */}
          <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#0F766E]/10 text-[#0F766E] flex items-center justify-center font-bold text-xs shrink-0">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#0F172A] truncate">
                    {order.customerName}
                  </div>
                  <div className="text-xs text-[#64748B] tabular-nums-strict">
                    {formatDateTimeVN(order.createdAt)} · {order.cashierName}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-medium text-[#64748B]">
                  {paymentMethodLabelVN(order.paymentMethod)}
                </div>
                <div className="text-sm font-bold text-[#0F172A] tabular-nums-strict">
                  {formatVND(order.totalAmount)}
                </div>
              </div>
            </div>

            <details className="group pt-1 border-t border-[#E2E8F0]">
              <summary className="list-none flex items-center justify-between cursor-pointer py-1 text-xs font-semibold text-[#0F766E] hover:text-[#115E59]">
                <span className="flex items-center gap-1">
                  <MaterialIcon
                    name="expand_more"
                    className="text-[16px] transition-transform group-open:rotate-180"
                  />
                  <span>
                    Xem danh sách {totalItemQty} món hàng đã mua
                  </span>
                </span>
                <span className="text-[#64748B] font-medium tabular-nums-strict">
                  {order.items.length} mặt hàng
                </span>
              </summary>
              <div className="mt-2 bg-white border border-[#E2E8F0] rounded-lg p-2.5 space-y-1.5">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-xs gap-2"
                  >
                    <span className="text-[#0F172A] truncate">
                      <strong className="text-[#0F766E] tabular-nums-strict">
                        {item.quantity}×
                      </strong>{' '}
                      {item.name}
                    </span>
                    <span className="font-semibold text-[#64748B] tabular-nums-strict shrink-0">
                      {formatVND(item.lineTotal)}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          </div>

          {/* Prior Partial Refund Banner */}
          {hasPriorRefund && (
            <div className="p-3.5 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] flex items-center gap-3 text-xs">
              <MaterialIcon
                name="warning"
                className="text-[20px] text-[#B45309] shrink-0"
              />
              <div>
                <div className="font-bold text-[#92400E] tabular-nums-strict">
                  Đơn này đã được hoàn {formatVND(order.refundedAmount)} trước đó
                </div>
                <div className="text-[#B45309] mt-0.5 tabular-nums-strict">
                  Số tiền tối đa còn có thể hoàn:{' '}
                  <strong className="font-bold">{formatVND(remaining)}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Field 1: Refund Amount & Touch Keypad */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-[#0F172A]">
                Số tiền hoàn <span className="text-[#DC2626]">*</span>
              </label>
              <span className="text-xs text-[#64748B] tabular-nums-strict">
                Tối đa có thể hoàn: {formatVND(remaining)}
              </span>
            </div>

            {/* Big Numeric Display Box */}
            <div
              className={`px-4 py-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                isOverLimit
                  ? 'bg-[#FEF2F2] border-[#DC2626]'
                  : 'bg-[#F8FAFC] border-[#CBD5E1]'
              }`}
            >
              <div className="flex items-baseline gap-1 min-w-0">
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={amount === 0 ? '' : amount}
                  onChange={(e) => {
                    setServerError(null);
                    const val = Math.max(0, Math.floor(Number(e.target.value) || 0));
                    setAmount(val);
                  }}
                  placeholder="0"
                  aria-label="Số tiền hoàn"
                  className={`w-48 bg-transparent text-2xl sm:text-3xl font-extrabold tabular-nums-strict focus:outline-none ${
                    isOverLimit ? 'text-[#DC2626]' : 'text-[#855300]'
                  }`}
                />
                <span
                  className={`text-lg font-bold ${
                    isOverLimit ? 'text-[#DC2626]' : 'text-[#855300]'
                  }`}
                >
                  ₫
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleKeyPress('BACK')}
                  aria-label="Xóa 1 chữ số"
                  className="w-10 h-10 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#DC2626] flex items-center justify-center"
                >
                  <MaterialIcon name="backspace" className="text-[19px]" />
                </button>
                <button
                  type="button"
                  onClick={() => handleKeyPress('C')}
                  className="h-10 px-3 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#FEF2F2] text-xs font-semibold text-[#64748B] hover:text-[#DC2626]"
                >
                  Xóa hết
                </button>
              </div>
            </div>

            {/* Quick Action Chips */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setServerError(null);
                  setAmount(remaining);
                }}
                className={`h-10 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border tabular-nums-strict ${
                  isFullSelected
                    ? 'bg-[#855300] border-[#855300] text-white'
                    : 'bg-white border-[#E2E8F0] text-[#0F172A] hover:bg-[#F8FAFC]'
                }`}
              >
                <MaterialIcon name="check_circle" className="text-[16px]" />
                <span>
                  {hasPriorRefund
                    ? `Hoàn phần còn lại (${formatVND(remaining)})`
                    : `Hoàn toàn bộ (${formatVND(remaining)})`}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setServerError(null);
                  setAmount(Math.min(remaining, 50000));
                }}
                className={`h-10 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border ${
                  !isFullSelected && amount > 0 && !isOverLimit
                    ? 'bg-[#855300] border-[#855300] text-white'
                    : 'bg-white border-[#E2E8F0] text-[#0F172A] hover:bg-[#F8FAFC]'
                }`}
              >
                <span>Hoàn một phần</span>
              </button>
            </div>

            {/* Over-limit Error Alert */}
            {isOverLimit && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-xs font-semibold tabular-nums-strict">
                <MaterialIcon name="error" className="text-[18px] shrink-0" />
                <span>
                  Số tiền hoàn ({formatVND(amount)}) vượt quá số tiền còn lại có
                  thể hoàn ({formatVND(remaining)}).
                </span>
              </div>
            )}

            {/* Touch Numeric Keypad */}
            <div className="grid grid-cols-4 gap-2 pt-0.5 select-none">
              {[
                '1',
                '2',
                '3',
                '+10k',
                '4',
                '5',
                '6',
                '+50k',
                '7',
                '8',
                '9',
                '000',
                'C',
                '0',
                '00',
                'BACK',
              ].map((k) => {
                const isAction = k === '+10k' || k === '+50k' || k === '000';
                const isClear = k === 'C';
                const isBack = k === 'BACK';
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      if (k === '00') {
                        setAmount((prev) => {
                          if (prev === 0) return 0;
                          const next = prev * 100;
                          return next > 999_999_999 ? prev : next;
                        });
                      } else {
                        handleKeyPress(k);
                      }
                    }}
                    className={`h-11 rounded-xl font-bold text-sm transition-transform active:scale-95 flex items-center justify-center border tabular-nums-strict ${
                      isClear
                        ? 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626] hover:bg-[#FEE2E2]'
                        : isAction
                        ? 'bg-[#F0FDFA] border-[#CCFBF1] text-[#0F766E] hover:bg-[#CCFBF1]/60'
                        : isBack
                        ? 'bg-[#F1F5F9] border-[#E2E8F0] text-[#475569] hover:bg-[#E2E8F0]'
                        : 'bg-white border-[#E2E8F0] text-[#0F172A] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    {isBack ? (
                      <MaterialIcon name="backspace" className="text-[19px]" />
                    ) : (
                      k
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Field 2: Reason */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-[#0F172A]">
              Lý do hoàn <span className="text-[#DC2626]">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {REASON_PRESETS.map((reason) => {
                const active = selectedReason === reason;
                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setSelectedReason(reason)}
                    className={`h-9 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 border ${
                      active
                        ? 'bg-[#0F766E] border-[#0F766E] text-white'
                        : 'bg-white border-[#E2E8F0] text-[#0F172A] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    {active && (
                      <MaterialIcon name="check" className="text-[15px]" />
                    )}
                    <span>{reason}</span>
                  </button>
                );
              })}
            </div>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nhập chi tiết lý do hoàn tiền (tùy chọn hoặc ghi chú hư hại)..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0F766E] resize-none"
            />
          </div>

          {/* Field 3: Refund Payment Method */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-[#0F172A]">
              Hình thức hoàn tiền
            </label>
            <div className="grid grid-cols-3 gap-2 p-1 bg-[#F1F5F9] rounded-xl">
              {(
                [
                  { id: 'CASH', label: 'Tiền mặt', icon: 'payments' },
                  { id: 'CARD', label: 'Thẻ ngân hàng', icon: 'credit_card' },
                  { id: 'UPI', label: 'QR / Ví điện tử', icon: 'qr_code_2' },
                ] as const
              ).map((m) => {
                const active = method === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={`h-10 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      active
                        ? 'bg-white text-[#0F766E] shadow-xs'
                        : 'text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    <MaterialIcon name={m.icon} className="text-[17px]" />
                    <span className="truncate">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cash Drawer Deduction Warning */}
          {method === 'CASH' && (
            <div className="p-3 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] flex items-start gap-2.5 text-xs">
              <MaterialIcon
                name="warning"
                className="text-[19px] text-[#B45309] shrink-0 mt-0.5"
              />
              <div>
                <div className="font-bold text-[#92400E]">
                  Cảnh báo trừ quỹ tiền mặt
                </div>
                <div className="text-[#B45309] mt-0.5 leading-relaxed">
                  Khoản hoàn tiền mặt này sẽ được trừ trực tiếp vào số tiền lý
                  thuyết trong két ca{' '}
                  <strong className="text-[#92400E]">
                    {activeShift
                      ? `${activeShift.shiftCode} (${activeShift.cashierName})`
                      : `${order.shiftCode || 'gốc'} (${
                          cashierName || order.cashierName
                        })`}
                  </strong>
                  .
                </div>
              </div>
            </div>
          )}

          {serverError && (
            <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs font-semibold text-[#DC2626]">
              {serverError}
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-1/3 h-12 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-sm font-semibold text-[#0F172A]"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex-1 h-12 rounded-xl bg-[#855300] hover:bg-[#6A4200] text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed transition-colors tabular-nums-strict"
          >
            <MaterialIcon name="currency_exchange" className="text-[20px]" />
            <span>
              {submitting
                ? 'Đang xử lý...'
                : `Xác nhận hoàn tiền · ${formatVND(amount)}`}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};
