import React from 'react';
import type { Branch, Order, Store } from '../types';
import {
  formatDateTimeVN,
  formatVND,
  paymentMethodLabelVN,
} from '../utils/format';
import { MaterialIcon } from './MaterialIcon';

interface ReceiptModalProps {
  order: Order;
  store: Store | null;
  branch: Branch | null;
  isAfterCheckout?: boolean;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  order,
  store,
  branch,
  isAfterCheckout = false,
  onClose,
}) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0F172A]/45 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Hóa đơn bán hàng"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-[0_20px_25px_-5px_rgba(15,23,42,0.12)] border border-[#E2E8F0] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Status Header */}
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between gap-3 bg-[#F8FAFC]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#16A34A]/15 text-[#16A34A] flex items-center justify-center">
              <MaterialIcon name="receipt_long" className="text-[20px]" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#0F172A]">
                {isAfterCheckout ? 'Thanh toán thành công' : 'Chi tiết biên lai'}
              </div>
              <div className="text-xs font-mono text-[#64748B]">
                {order.receiptCode}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] flex items-center justify-center text-[#0F172A]"
            aria-label="Đóng biên lai"
          >
            <MaterialIcon name="close" className="text-[20px]" />
          </button>
        </div>

        {/* Thermal Receipt Body */}
        <div className="flex-1 overflow-y-auto p-6 pos-scroll">
          <div className="printable-receipt space-y-4 text-[#0F172A]">
            <div className="text-center space-y-1 pb-3 border-b border-dashed border-[#CBD5E1]">
              <div className="text-lg font-bold tracking-tight">
                {store?.name || 'Omni Roastery & Bakery'}
              </div>
              <div className="text-xs text-[#64748B]">
                {branch?.name || 'Chi nhánh Nguyễn Huệ (Q.1)'}
              </div>
              <div className="text-xs text-[#64748B]">
                {branch?.address || '68 Nguyễn Huệ, Quận 1, TP.HCM'}
              </div>
              <div className="text-xs text-[#64748B]">
                Hotline: {branch?.phone || '028 3822 6868'}
              </div>
            </div>

            <div className="text-center py-1">
              <div className="text-sm font-bold tracking-wide">
                HÓA ĐƠN BÁN HÀNG
              </div>
              <div className="text-xs font-mono text-[#64748B] mt-0.5">
                Số: {order.receiptCode}
              </div>
            </div>

            <div className="text-xs space-y-1.5 pb-3 border-b border-dashed border-[#CBD5E1]">
              <div className="flex justify-between gap-2">
                <span className="text-[#64748B]">Thời gian:</span>
                <span className="font-medium tabular-nums-strict">
                  {formatDateTimeVN(order.createdAt)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#64748B]">Thu ngân:</span>
                <span className="font-medium">{order.cashierName}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#64748B]">Khách hàng:</span>
                <span className="font-medium">{order.customerName}</span>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2.5 pb-3 border-b border-dashed border-[#CBD5E1]">
              <div className="flex justify-between text-[11px] font-semibold text-[#64748B]">
                <span>Mặt hàng</span>
                <span>Thành tiền</span>
              </div>
              {order.items.map((item) => (
                <div key={item.id} className="space-y-0.5">
                  <div className="flex justify-between items-start gap-3 text-sm">
                    <span className="font-semibold text-[#0F172A]">
                      {item.name}
                    </span>
                    <span className="font-semibold tabular-nums-strict shrink-0">
                      {formatVND(item.lineTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-[#64748B] tabular-nums-strict">
                    <span>
                      {item.quantity} × {formatVND(item.unitPrice)}
                    </span>
                    {item.note && (
                      <span className="italic text-[#0F766E]">{item.note}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="space-y-1.5 text-sm pb-3 border-b border-dashed border-[#CBD5E1]">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Tạm tính</span>
                <span className="font-medium tabular-nums-strict">
                  {formatVND(order.subtotal)}
                </span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-[#16A34A]">
                  <span>
                    Giảm giá {order.discountLabel ? `(${order.discountLabel})` : ''}
                  </span>
                  <span className="font-medium tabular-nums-strict">
                    -{formatVND(order.discountAmount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-1.5 border-t border-[#E2E8F0]">
                <span>Tổng thanh toán</span>
                <span className="text-[#0F766E] tabular-nums-strict">
                  {formatVND(order.totalAmount)}
                </span>
              </div>
            </div>

            {/* Payment Info */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Phương thức:</span>
                <span className="font-semibold">
                  {paymentMethodLabelVN(order.paymentMethod)}
                </span>
              </div>
              {order.paymentMethod === 'CASH' ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Khách đưa:</span>
                    <span className="font-semibold tabular-nums-strict">
                      {formatVND(order.cashTendered)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Tiền thừa:</span>
                    <span className="font-semibold tabular-nums-strict">
                      {formatVND(order.changeDue)}
                    </span>
                  </div>
                </>
              ) : (
                order.paymentRef && (
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Mã tham chiếu:</span>
                    <span className="font-mono font-semibold">
                      {order.paymentRef}
                    </span>
                  </div>
                )
              )}
              {order.refundedAmount > 0 && (
                <div className="flex justify-between text-[#DC2626] font-semibold pt-1">
                  <span>Đã hoàn tiền:</span>
                  <span className="tabular-nums-strict">
                    -{formatVND(order.refundedAmount)}
                  </span>
                </div>
              )}
            </div>

            <div className="text-center pt-3 border-t border-dashed border-[#CBD5E1] space-y-1">
              <div className="text-xs font-semibold text-[#0F172A]">
                Cảm ơn quý khách & Hẹn gặp lại!
              </div>
              <div className="text-[11px] text-[#64748B]">
                Giá đã bao gồm thuế GTGT theo quy định
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="h-12 px-4 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-[#0F172A] font-semibold text-sm flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
          >
            <MaterialIcon name="print" className="text-[20px]" />
            <span>In hóa đơn</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-12 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white font-bold text-sm flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <MaterialIcon
              name={isAfterCheckout ? 'add_shopping_cart' : 'check'}
              className="text-[20px]"
            />
            <span>{isAfterCheckout ? 'Đơn hàng mới' : 'Đóng'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
