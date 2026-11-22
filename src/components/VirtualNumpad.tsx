import React from 'react';
import { formatVND } from '../utils/format';
import { MaterialIcon } from './MaterialIcon';

interface VirtualNumpadProps {
  value: number;
  onChange: (nextValue: number) => void;
  quickChips?: Array<{ label: string; amount: number; isExact?: boolean }>;
  maxDigits?: number;
}

export const VirtualNumpad: React.FC<VirtualNumpadProps> = ({
  value,
  onChange,
  quickChips = [],
  maxDigits = 10,
}) => {
  const handleDigit = (digitStr: string) => {
    const raw = value === 0 ? '' : String(Math.floor(value));
    const nextStr = raw + digitStr;
    if (nextStr.length > maxDigits) return;
    const parsed = Number(nextStr);
    if (Number.isFinite(parsed)) {
      onChange(parsed);
    }
  };

  const handleBackspace = () => {
    const raw = String(Math.floor(value));
    if (raw.length <= 1) {
      onChange(0);
      return;
    }
    onChange(Number(raw.slice(0, -1)) || 0);
  };

  const handleClear = () => {
    onChange(0);
  };

  return (
    <div className="space-y-3">
      {quickChips.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {quickChips.map((chip) => {
            const isSelected = !chip.isExact && value === chip.amount;
            return (
              <button
                key={chip.label}
                type="button"
                onClick={() => onChange(chip.amount)}
                className={`h-12 px-2 rounded-xl text-sm font-semibold tabular-nums-strict transition-colors whitespace-nowrap shrink-0 border ${
                  chip.isExact
                    ? 'bg-[#0F766E]/10 border-[#0F766E]/30 text-[#0F766E] hover:bg-[#0F766E] hover:text-white'
                    : isSelected
                    ? 'bg-[#0F766E] border-[#0F766E] text-white'
                    : 'bg-[#F1F5F9] border-[#E2E8F0] text-[#0F172A] hover:bg-[#E2E8F0]'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => handleDigit(digit)}
            className="h-16 rounded-xl bg-white border border-[#E2E8F0] text-xl font-semibold text-[#0F172A] tabular-nums-strict hover:bg-[#F1F5F9] active:bg-[#E2E8F0] active:scale-[0.98] transition-all"
          >
            {digit}
          </button>
        ))}

        <button
          type="button"
          onClick={() => handleDigit('000')}
          className="h-16 rounded-xl bg-white border border-[#E2E8F0] text-lg font-semibold text-[#0F172A] tabular-nums-strict hover:bg-[#F1F5F9] active:bg-[#E2E8F0] active:scale-[0.98] transition-all"
        >
          000
        </button>

        <button
          type="button"
          onClick={() => handleDigit('0')}
          className="h-16 rounded-xl bg-white border border-[#E2E8F0] text-xl font-semibold text-[#0F172A] tabular-nums-strict hover:bg-[#F1F5F9] active:bg-[#E2E8F0] active:scale-[0.98] transition-all"
        >
          0
        </button>

        <button
          type="button"
          onClick={handleBackspace}
          aria-label="Xóa một ký tự"
          className="h-16 rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] text-[#0F172A] hover:bg-[#E2E8F0] active:scale-[0.98] transition-all flex items-center justify-center"
        >
          <MaterialIcon name="backspace" className="text-[22px]" />
        </button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleClear}
          className="h-12 px-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-sm font-semibold hover:bg-[#FEE2E2] transition-colors whitespace-nowrap shrink-0"
        >
          Xóa số tiền
        </button>
        <div className="text-right text-sm text-[#64748B] tabular-nums-strict">
          Đang nhập: <span className="font-semibold text-[#0F172A]">{formatVND(value)}</span>
        </div>
      </div>
    </div>
  );
};
