import React, { useMemo, useState } from 'react';
import type { Customer, PaymentMethod } from '../types';
import { formatVND } from '../utils/format';
import { MaterialIcon } from './MaterialIcon';
import { VirtualNumpad } from './VirtualNumpad';

interface PaymentModalProps {
  totalAmount: number;
  itemCount: number;
  customer: Customer | null;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    paymentMethod: PaymentMethod;
    cashTendered: number;
    paymentRef: string;
  }) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  totalAmount,
  itemCount,
  customer,
  submitting,
  onClose,
  onConfirm,
}) => {
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [cashTendered, setCashTendered] = useState<number>(totalAmount);
  const [cardRef, setCardRef] = useState<string>('POS-CARD-4912');
  const [upiRef, setUpiRef] = useState<string>(
    `VIETQR-${String(Date.now()).slice(-6)}`
  );

  const cashQuickChips = useMemo(() => {
    const base = [
      { label: 'Đủ tiền', amount: totalAmount, isExact: true },
      { label: '50.000 ₫', amount: 50000 },
      { label: '100.000 ₫', amount: 100000 },
      { label: '200.000 ₫', amount: 200000 },
      { label: '500.000 ₫', amount: 500000 },
    ];
    return base;
  }, [totalAmount]);

  const changeDue = cashTendered - totalAmount;
  const isCashEnough = method !== 'CASH' || cashTendered >= totalAmount;

  const handleConfirm = () => {
    if (!isCashEnough || submitting) return;
    onConfirm({
      paymentMethod: method,
      cashTendered: method === 'CASH' ? cashTendered : totalAmount,
      paymentRef: method === 'CARD' ? cardRef : method === 'UPI' ? upiRef : '',
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0F172A]/45 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Thanh toán đơn hàng"
    >
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-[0_20px_25px_-5px_rgba(15,23,42,0.12)] border border-[#E2E8F0] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="h-16 px-6 border-b border-[#E2E8F0] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0F766E]/10 text-[#0F766E] flex items-center justify-center">
              <MaterialIcon name="payments" className="text-[22px]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#0F172A]">Thanh toán đơn hàng</h2>
              <div className="text-xs text-[#64748B]">
                {itemCount} sản phẩm · {customer ? customer.name : 'Khách lẻ'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-12 h-12 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-[#0F172A] flex items-center justify-center"
            aria-label="Đóng cửa sổ thanh toán"
          >
            <MaterialIcon name="close" className="text-[22px]" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Total + Method Tabs */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-5">
            <div className="space-y-5">
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-5">
                <div className="text-xs font-semibold text-[#64748B]">
                  Tổng tiền cần thanh toán
                </div>
                <div className="text-[32px] leading-tight font-bold text-[#0F766E] tabular-nums-strict mt-1">
                  {formatVND(totalAmount)}
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-[#0F172A] mb-2.5">
                  Chọn phương thức thanh toán
                </div>
                <div className="space-y-2.5">
                  {[
                    {
                      id: 'CASH' as PaymentMethod,
                      title: 'Tiền mặt (CASH)',
                      sub: 'Nhập số tiền khách đưa & tính tiền thừa',
                      icon: 'payments',
                    },
                    {
                      id: 'CARD' as PaymentMethod,
                      title: 'Thẻ ngân hàng (CARD)',
                      sub: 'Quẹt máy POS / Visa / Mastercard / Napas',
                      icon: 'credit_card',
                    },
                    {
                      id: 'UPI' as PaymentMethod,
                      title: 'Chuyển khoản / QR (UPI)',
                      sub: 'Quét mã VietQR hoặc ví điện tử',
                      icon: 'qr_code_2',
                    },
                  ].map((item) => {
                    const active = method === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setMethod(item.id)}
                        className={`w-full min-h-[60px] p-3.5 rounded-xl border text-left flex items-center gap-3.5 transition-colors ${
                          active
                            ? 'bg-[#0F766E] border-[#0F766E] text-white'
                            : 'bg-white border-[#E2E8F0] text-[#0F172A] hover:bg-[#F1F5F9]'
                        }`}
                      >
                        <MaterialIcon
                          name={item.icon}
                          className={`text-[24px] shrink-0 ${
                            active ? 'text-white' : 'text-[#0F766E]'
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-bold">{item.title}</div>
                          <div
                            className={`text-xs truncate ${
                              active ? 'text-[#a3faef]' : 'text-[#64748B]'
                            }`}
                          >
                            {item.sub}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {method === 'CASH' && (
              <div
                className={`rounded-xl p-4 border ${
                  isCashEnough
                    ? 'bg-[#16A34A]/5 border-[#16A34A]/25'
                    : 'bg-[#FEF2F2] border-[#FECACA]'
                }`}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#64748B]">Khách đưa</span>
                  <span className="font-bold text-[#0F172A] tabular-nums-strict">
                    {formatVND(cashTendered)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#E2E8F0]">
                  <span className="text-sm font-semibold text-[#0F172A]">
                    {isCashEnough ? 'Tiền thừa trả khách' : 'Còn thiếu'}
                  </span>
                  <span
                    className={`text-xl font-bold tabular-nums-strict ${
                      isCashEnough ? 'text-[#16A34A]' : 'text-[#DC2626]'
                    }`}
                  >
                    {formatVND(Math.abs(changeDue))}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right: Dynamic Payment Details */}
          <div className="lg:col-span-7 lg:border-l lg:border-[#E2E8F0] lg:pl-6 flex flex-col justify-between space-y-5">
            {method === 'CASH' && (
              <div className="space-y-4">
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#64748B]">
                    Số tiền khách đưa
                  </span>
                  <span className="text-2xl font-bold text-[#0F172A] tabular-nums-strict">
                    {formatVND(cashTendered)}
                  </span>
                </div>
                <VirtualNumpad
                  value={cashTendered}
                  onChange={setCashTendered}
                  quickChips={cashQuickChips}
                />
              </div>
            )}

            {method === 'CARD' && (
              <div className="space-y-5 py-2">
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-6 text-center space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-[#0F766E]/10 text-[#0F766E] flex items-center justify-center">
                    <MaterialIcon name="contactless" className="text-[32px]" />
                  </div>
                  <div className="text-base font-bold text-[#0F172A]">
                    Chờ quẹt hoặc chạm thẻ tại thiết bị mPOS
                  </div>
                  <p className="text-sm text-[#64748B]">
                    Số tiền trừ thẻ:{' '}
                    <span className="font-bold text-[#0F172A] tabular-nums-strict">
                      {formatVND(totalAmount)}
                    </span>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">
                    Mã chuẩn chi / Số tham chiếu máy POS
                  </label>
                  <input
                    type="text"
                    value={cardRef}
                    onChange={(e) => setCardRef(e.target.value)}
                    placeholder="Ví dụ: VISA-4912"
                    className="w-full h-12 px-3.5 rounded-xl border border-[#CBD5E1] bg-white font-mono text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
                  />
                </div>
              </div>
            )}

            {method === 'UPI' && (
              <div className="space-y-4">
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-5 flex flex-col sm:flex-row items-center gap-5">
                  {/* Crisp Vector VietQR Matrix */}
                  <div className="w-40 h-40 bg-white border border-[#E2E8F0] rounded-xl p-3 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 100 100" className="w-full h-full text-[#0F172A]">
                      <rect x="4" y="4" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="5" />
                      <rect x="11" y="11" width="12" height="12" fill="currentColor" />
                      <rect x="70" y="4" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="5" />
                      <rect x="77" y="11" width="12" height="12" fill="currentColor" />
                      <rect x="4" y="70" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="5" />
                      <rect x="11" y="77" width="12" height="12" fill="currentColor" />
                      <rect x="38" y="8" width="6" height="6" fill="currentColor" />
                      <rect x="50" y="8" width="6" height="12" fill="currentColor" />
                      <rect x="38" y="20" width="12" height="6" fill="currentColor" />
                      <rect x="8" y="38" width="12" height="6" fill="currentColor" />
                      <rect x="26" y="38" width="6" height="12" fill="currentColor" />
                      <rect x="40" y="40" width="20" height="20" rx="3" fill="#0F766E" />
                      <rect x="46" y="46" width="8" height="8" fill="#FFFFFF" />
                      <rect x="66" y="38" width="12" height="6" fill="currentColor" />
                      <rect x="84" y="38" width="10" height="10" fill="currentColor" />
                      <rect x="68" y="54" width="6" height="12" fill="currentColor" />
                      <rect x="80" y="56" width="14" height="6" fill="currentColor" />
                      <rect x="38" y="68" width="10" height="10" fill="currentColor" />
                      <rect x="54" y="68" width="8" height="6" fill="currentColor" />
                      <rect x="42" y="84" width="16" height="8" fill="currentColor" />
                      <rect x="66" y="74" width="12" height="12" fill="currentColor" />
                      <rect x="84" y="72" width="10" height="20" fill="currentColor" />
                    </svg>
                  </div>
                  <div className="space-y-1.5 text-center sm:text-left">
                    <div className="text-xs font-semibold text-[#0F766E]">
                      Chuyển khoản nhanh VietQR / UPI
                    </div>
                    <div className="text-base font-bold text-[#0F172A]">
                      OMNI ROASTERY & BAKERY
                    </div>
                    <div className="text-sm text-[#64748B]">
                      STK: <span className="font-mono font-semibold text-[#0F172A]">1903 8868 2424</span> · Techcombank
                    </div>
                    <div className="text-lg font-bold text-[#0F766E] tabular-nums-strict pt-1">
                      {formatVND(totalAmount)}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">
                    Mã giao dịch chuyển khoản
                  </label>
                  <input
                    type="text"
                    value={upiRef}
                    onChange={(e) => setUpiRef(e.target.value)}
                    className="w-full h-12 px-3.5 rounded-xl border border-[#CBD5E1] bg-white font-mono text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
                  />
                </div>
              </div>
            )}

            {/* Footer Confirm */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="h-14 px-5 rounded-xl border border-[#E2E8F0] bg-white text-[#0F172A] font-semibold text-sm hover:bg-[#F1F5F9] whitespace-nowrap shrink-0"
              >
                Quay lại
              </button>
              <button
                type="button"
                disabled={!isCashEnough || submitting}
                onClick={handleConfirm}
                className="flex-1 h-14 rounded-xl bg-[#16A34A] hover:bg-[#15803D] active:scale-[0.99] text-white font-bold text-base transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MaterialIcon name="check_circle" className="text-[22px]" />
                <span>
                  {submitting
                    ? 'Đang xuất hóa đơn...'
                    : `Xác nhận thanh toán · ${formatVND(totalAmount)}`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
