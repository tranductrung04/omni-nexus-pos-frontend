import React, { useState } from 'react';
import { api } from '../api';
import type { Branch, Store, User } from '../types';
import { roleLabelVN } from '../utils/format';
import { MaterialIcon } from './MaterialIcon';

interface ProfileModalProps {
  user: User;
  store: Store | null;
  branch: Branch | null;
  onUpdated: (user: User) => void;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  user,
  store,
  branch,
  onUpdated,
  onClose,
}) => {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      const updated = await api.updateProfile({ name, phone });
      onUpdated(updated);
      setSavedMsg('Đã cập nhật hồ sơ cá nhân.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể cập nhật hồ sơ.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0F172A]/45 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={handleSave}
        className="w-full max-w-md bg-white rounded-2xl border border-[#E2E8F0] shadow-xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0F766E]/10 text-[#0F766E] flex items-center justify-center">
              <MaterialIcon name="account_circle" className="text-[22px]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0F172A]">Hồ sơ cá nhân</h3>
              <div className="text-xs text-[#64748B]">{roleLabelVN(user.role)}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl border border-[#E2E8F0] flex items-center justify-center"
          >
            <MaterialIcon name="close" className="text-[20px]" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#DC2626]">
              {error}
            </div>
          )}
          {savedMsg && (
            <div className="p-3 rounded-xl bg-[#16A34A]/10 border border-[#16A34A]/25 text-xs text-[#16A34A] font-semibold">
              {savedMsg}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">
              Họ và tên
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-12 px-3.5 rounded-xl border border-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
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
              className="w-full h-12 px-3.5 rounded-xl border border-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
            />
          </div>

          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[#64748B]">Email:</span>
              <span className="font-semibold text-[#0F172A]">{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Vai trò:</span>
              <span className="font-semibold text-[#0F766E]">
                {roleLabelVN(user.role)}
              </span>
            </div>
            {store && (
              <div className="flex justify-between">
                <span className="text-[#64748B]">Cửa hàng:</span>
                <span className="font-semibold text-[#0F172A]">{store.name}</span>
              </div>
            )}
            {branch && (
              <div className="flex justify-between">
                <span className="text-[#64748B]">Chi nhánh:</span>
                <span className="font-semibold text-[#0F172A]">{branch.name}</span>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-12 px-4 rounded-xl border border-[#E2E8F0] bg-white text-sm font-semibold text-[#0F172A]"
          >
            Đóng
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 h-12 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-bold disabled:opacity-50"
          >
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </div>
  );
};
