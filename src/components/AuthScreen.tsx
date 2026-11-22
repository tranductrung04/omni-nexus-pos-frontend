import React, { useState } from 'react';
import { api } from '../api';
import type { SessionPayload, UserRole } from '../types';
import { MaterialIcon } from './MaterialIcon';

interface AuthScreenProps {
  onSuccess: (session: SessionPayload) => void;
}

const REGISTER_ROLES: Array<{ value: UserRole; label: string; desc: string }> = [
  {
    value: 'BRANCH_CASHIER',
    label: 'Thu ngân chi nhánh',
    desc: 'Mở ca, bán hàng tại quầy, hoàn tiền và chốt ca',
  },
  {
    value: 'BRANCH_MANAGER',
    label: 'Quản lý chi nhánh',
    desc: 'Giám sát tồn kho, nhân sự và báo cáo chi nhánh',
  },
  {
    value: 'STORE_MANAGER',
    label: 'Quản lý cửa hàng',
    desc: 'Điều phối danh mục, sản phẩm và nhiều chi nhánh',
  },
  {
    value: 'STORE_ADMIN',
    label: 'Chủ cửa hàng',
    desc: 'Khởi tạo cửa hàng và toàn quyền vận hành hệ thống',
  },
];

const DEMO_ACCOUNTS: Array<{
  label: string;
  roleLabel: string;
  email: string;
  password: string;
  icon: string;
  primary?: boolean;
}> = [
  {
    label: 'Nguyễn Ngọc Linh',
    roleLabel: 'Thu ngân · Quầy 01',
    email: 'thungan@omninexus.vn',
    password: 'password123',
    icon: 'point_of_sale',
    primary: true,
  },
  {
    label: 'Phạm Đức Khang',
    roleLabel: 'Quản lý chi nhánh Q.1',
    email: 'qlchinhanh@omninexus.vn',
    password: 'password123',
    icon: 'storefront',
  },
  {
    label: 'Trần Hoàng Bảo',
    roleLabel: 'Chủ cửa hàng',
    email: 'owner@omninexus.vn',
    password: 'password123',
    icon: 'domain',
  },
  {
    label: 'Nguyễn Minh Quân',
    roleLabel: 'Admin hệ thống',
    email: 'admin@omninexus.vn',
    password: 'password123',
    icon: 'admin_panel_settings',
  },
];

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('thungan@omninexus.vn');
  const [password, setPassword] = useState('password123');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('BRANCH_CASHIER');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const session = await api.login(email, password);
        onSuccess(session);
      } else {
        const session = await api.register({
          name,
          email,
          password,
          phone,
          role,
        });
        onSuccess(session);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể xác thực tài khoản.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async (demoEmail: string, demoPassword: string) => {
    setError(null);
    setMode('login');
    setEmail(demoEmail);
    setPassword(demoPassword);
    setLoading(true);
    try {
      const session = await api.login(demoEmail, demoPassword);
      onSuccess(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đăng nhập nhanh.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 lg:p-8">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Brand & Cashier Flow Orientation Panel */}
        <div className="lg:col-span-5 bg-[#0F766E] text-white rounded-2xl p-8 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center">
                <MaterialIcon name="point_of_sale" className="text-[26px] text-white" />
              </div>
              <div>
                <div className="text-xl font-bold tracking-tight">Omni Nexus POS</div>
                <div className="text-xs text-[#9cf2e8]">Nền tảng bán hàng đa chi nhánh</div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <h1 className="text-2xl font-bold leading-snug text-balance">
                Vận hành quầy thu ngân chính xác, tốc độ cao.
              </h1>
              <p className="text-sm text-[#a3faef] leading-relaxed">
                Thiết kế chuyên biệt cho màn hình cảm ứng quầy thanh toán: mở ca nhanh,
                lên đơn trực quan, đối soát tiền mặt và chốt báo cáo ca tức thì.
              </p>
            </div>
          </div>

          <div className="pt-8 mt-8 border-t border-white/15 space-y-3">
            <div className="text-xs font-semibold text-[#9cf2e8]">
              Tài khoản trải nghiệm nhanh
            </div>
            <div className="grid grid-cols-1 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickDemo(acc.email, acc.password)}
                  className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-3 text-left transition-colors ${
                    acc.primary
                      ? 'bg-white text-[#0F172A] hover:bg-[#F1F5F9]'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <MaterialIcon
                      name={acc.icon}
                      className={`text-[20px] shrink-0 ${
                        acc.primary ? 'text-[#0F766E]' : 'text-[#9cf2e8]'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{acc.label}</div>
                      <div
                        className={`text-xs truncate ${
                          acc.primary ? 'text-[#64748B]' : 'text-[#a3faef]'
                        }`}
                      >
                        {acc.roleLabel}
                      </div>
                    </div>
                  </div>
                  <MaterialIcon name="arrow_forward" className="text-[18px] shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 flex flex-col justify-center">
          <div className="flex items-center gap-1 p-1 bg-[#F1F5F9] rounded-xl mb-6 w-fit">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`h-11 px-5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                mode === 'login'
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`h-11 px-5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                mode === 'register'
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Đăng ký tài khoản
            </button>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-bold text-[#0F172A]">
              {mode === 'login' ? 'Đăng nhập vào ca làm việc' : 'Tạo tài khoản nhân sự mới'}
            </h2>
            <p className="text-sm text-[#64748B] mt-1">
              {mode === 'login'
                ? 'Nhập email và mật khẩu để truy cập chi nhánh của bạn.'
                : 'Chọn vai trò phù hợp trong cửa hàng (không bao gồm Admin hệ thống).'}
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-sm flex items-center gap-2.5">
              <MaterialIcon name="error" className="text-[20px] shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">
                    Họ và tên
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full h-12 px-3.5 rounded-xl border border-[#CBD5E1] bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-[#0F766E]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0909 123 456"
                    className="w-full h-12 px-3.5 rounded-xl border border-[#CBD5E1] bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-[#0F766E]"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">
                Email đăng nhập
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="thungan@omninexus.vn"
                className="w-full h-12 px-3.5 rounded-xl border border-[#CBD5E1] bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-[#0F766E]"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  className="w-full h-12 pl-3.5 pr-12 rounded-xl border border-[#CBD5E1] bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-[#0F766E]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  <MaterialIcon
                    name={showPassword ? 'visibility_off' : 'visibility'}
                    className="text-[20px]"
                  />
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">
                  Vai trò công việc
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {REGISTER_ROLES.map((item) => {
                    const active = role === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setRole(item.value)}
                        className={`p-3 rounded-xl border text-left transition-colors ${
                          active
                            ? 'border-[#0F766E] bg-[#0F766E]/5'
                            : 'border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <div className="text-sm font-semibold text-[#0F172A]">
                          {item.label}
                        </div>
                        <div className="text-xs text-[#64748B] mt-0.5 line-clamp-2">
                          {item.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 rounded-xl bg-[#0F766E] hover:bg-[#115E59] active:scale-[0.99] text-white font-semibold text-base transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <MaterialIcon
                  name={mode === 'login' ? 'login' : 'person_add'}
                  className="text-[22px]"
                />
                <span>
                  {loading
                    ? 'Đang xử lý...'
                    : mode === 'login'
                    ? 'Đăng nhập hệ thống'
                    : 'Hoàn tất đăng ký'}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
