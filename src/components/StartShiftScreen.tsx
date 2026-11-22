import React, { useState } from 'react';
import { api } from '../api';
import type { Branch, Shift, Store, User } from '../types';
import { formatDateTimeVN, formatVND } from '../utils/format';
import { MaterialIcon } from './MaterialIcon';
import { VirtualNumpad } from './VirtualNumpad';

interface StartShiftScreenProps {
  user: User;
  store: Store | null;
  branch: Branch | null;
  onShiftOpened: (shift: Shift) => void;
  onLogout: () => void;
}

const REGISTERS = ['Quầy POS 01', 'Quầy POS 02', 'Quầy Mang Về'];

const OPENING_CHIPS = [
  { label: '500.000 ₫', amount: 500000 },
  { label: '1.000.000 ₫', amount: 1000000 },
  { label: '1.500.000 ₫', amount: 1500000 },
  { label: '2.000.000 ₫', amount: 2000000 },
  { label: '3.000.000 ₫', amount: 3000000 },
];

export const StartShiftScreen: React.FC<StartShiftScreenProps> = ({
  user,
  store,
  branch,
  onShiftOpened,
  onLogout,
}) => {
  const [openingCash, setOpeningCash] = useState<number>(1000000);
  const [registerName, setRegisterName] = useState<string>('Quầy POS 01');
  const [openingNote, setOpeningNote] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenShift = async () => {
    setError(null);
    setLoading(true);
    try {
      const shift = await api.openShift({
        cashierId: user.id,
        cashierName: user.name,
        storeId: store?.id || 'store-1',
        branchId: branch?.id || 'branch-1',
        registerName,
        openingCash,
        openingNote,
      });
      onShiftOpened(shift);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể mở ca làm việc.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Minimal Header */}
      <header className="h-14 bg-white border-b border-[#E2E8F0] px-6 flex items-center justify-between gap-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#0F766E] flex items-center justify-center shrink-0">
            <MaterialIcon name="point_of_sale" className="text-[20px] text-white" />
          </div>
          <span className="text-base font-bold text-[#0F172A] whitespace-nowrap">
            Omni Nexus POS
          </span>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold text-[#0F172A]">{user.name}</div>
            <div className="text-xs text-[#64748B]">{branch?.name || 'Chi nhánh chính'}</div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="h-10 px-4 rounded-xl border border-[#E2E8F0] bg-white text-sm font-semibold text-[#0F172A] hover:bg-[#F1F5F9] flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <MaterialIcon name="logout" className="text-[18px] text-[#64748B]" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </header>

      {/* Main Centered Landscape Card */}
      <main className="flex-1 flex items-center justify-center p-4 lg:p-8">
        <div className="w-full max-w-5xl bg-white border border-[#E2E8F0] rounded-2xl p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Shift Context & Cash Float Summary */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              <div>
                <div className="text-xs font-semibold text-[#0F766E] mb-1">
                  Bắt đầu ca thu ngân
                </div>
                <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
                  Kiểm đếm tiền mặt đầu ca
                </h1>
                <p className="text-sm text-[#64748B] mt-1.5">
                  Xác nhận số tiền lẻ chuẩn bị sẵn trong ngăn kéo trước khi mở màn hình bán hàng.
                </p>
              </div>

              {/* Shift Metadata Summary */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[#64748B]">Cửa hàng</span>
                  <span className="font-semibold text-[#0F172A] text-right">
                    {store?.name || 'Omni Roastery & Bakery'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[#64748B]">Chi nhánh</span>
                  <span className="font-semibold text-[#0F172A] text-right">
                    {branch?.name || 'Chi nhánh Nguyễn Huệ (Q.1)'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[#64748B]">Thu ngân phụ trách</span>
                  <span className="font-semibold text-[#0F172A] text-right">{user.name}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[#64748B]">Thời gian mở</span>
                  <span className="font-semibold text-[#0F172A] tabular-nums-strict">
                    {formatDateTimeVN(new Date().toISOString())}
                  </span>
                </div>
              </div>

              {/* Register Selection */}
              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                  Quầy thu ngân
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {REGISTERS.map((reg) => (
                    <button
                      key={reg}
                      type="button"
                      onClick={() => setRegisterName(reg)}
                      className={`h-12 px-2 rounded-xl text-sm font-semibold border transition-colors whitespace-nowrap ${
                        registerName === reg
                          ? 'bg-[#0F766E] border-[#0F766E] text-white'
                          : 'bg-white border-[#E2E8F0] text-[#0F172A] hover:bg-[#F1F5F9]'
                      }`}
                    >
                      {reg}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">
                  Ghi chú đầu ca (tuỳ chọn)
                </label>
                <input
                  type="text"
                  value={openingNote}
                  onChange={(e) => setOpeningNote(e.target.value)}
                  placeholder="Ví dụ: Đã nhận đủ tiền lẻ 10k, 20k từ quản lý..."
                  className="w-full h-12 px-3.5 rounded-xl border border-[#CBD5E1] bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
                />
              </div>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-sm flex items-center gap-2">
                <MaterialIcon name="error" className="text-[20px] shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Right Column: Cash Float Display + Virtual Numpad */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-5 lg:border-l lg:border-[#E2E8F0] lg:pl-8">
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-5 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-[#64748B]">
                  Tiền mặt đầu ca trong két
                </div>
                <div className="text-[30px] leading-tight font-bold text-[#0F766E] tabular-nums-strict mt-1">
                  {formatVND(openingCash)}
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[#0F766E]/10 text-[#0F766E] flex items-center justify-center shrink-0">
                <MaterialIcon name="payments" className="text-[28px]" />
              </div>
            </div>

            <VirtualNumpad
              value={openingCash}
              onChange={setOpeningCash}
              quickChips={OPENING_CHIPS}
            />

            <button
              type="button"
              disabled={loading}
              onClick={handleOpenShift}
              className="w-full h-16 rounded-xl bg-[#16A34A] hover:bg-[#15803D] active:scale-[0.99] text-white font-bold text-base transition-all flex items-center justify-center gap-2.5 disabled:opacity-60"
            >
              <MaterialIcon name="play_circle" className="text-[24px]" />
              <span>{loading ? 'Đang khởi tạo ca...' : 'Mở ca làm việc & Vào bán hàng'}</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
