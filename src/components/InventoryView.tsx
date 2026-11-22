import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type {
  Branch,
  InventoryAdjustMode,
  InventoryItem,
  InventoryLog,
  User,
} from '../types';
import { formatDateTimeVN, formatVND } from '../utils/format';
import { MaterialIcon } from './MaterialIcon';

interface InventoryViewProps {
  user: User;
  storeId: string;
  activeBranchId: string;
  onCatalogChanged: () => Promise<void> | void;
}

type StockStatusFilter = 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

const REASON_PRESETS: Record<InventoryAdjustMode, string[]> = {
  IMPORT: [
    'Nhập hàng đầu ngày từ kho trung tâm',
    'Bổ sung hàng bán chạy trong ca',
    'Nhập hàng từ nhà cung cấp',
  ],
  SET: [
    'Kiểm kê thực tế cuối ngày',
    'Điều chỉnh chênh lệch sổ sách',
  ],
  DEDUCT: [
    'Hỏng / Hết hạn sử dụng',
    'Điều chuyển nội bộ sang chi nhánh khác',
    'Xuất dùng nội bộ / Pha chế mẫu',
  ],
};

export const InventoryView: React.FC<InventoryViewProps> = ({
  user,
  storeId,
  activeBranchId,
  onCatalogChanged,
}) => {
  const canSwitchBranch =
    user.role === 'STORE_ADMIN' || user.role === 'STORE_MANAGER';

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(activeBranchId);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StockStatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showLogsPanel, setShowLogsPanel] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [quickBusyId, setQuickBusyId] = useState<string | null>(null);

  // Adjust Stock Modal
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [adjustMode, setAdjustMode] = useState<InventoryAdjustMode>('IMPORT');
  const [adjustQty, setAdjustQty] = useState<number>(10);
  const [adjustReason, setAdjustReason] = useState<string>(
    REASON_PRESETS.IMPORT[0]
  );
  const [submitting, setSubmitting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const loadInventory = useCallback(
    async (branchToLoad: string) => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await api.getInventory(storeId, branchToLoad);
        setBranches(res.branches);
        setSelectedBranchId(res.branchId);
        setItems(res.items);
        setLogs(res.logs);
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : 'Không thể tải dữ liệu tồn kho.'
        );
      } finally {
        setLoading(false);
      }
    },
    [storeId]
  );

  useEffect(() => {
    loadInventory(selectedBranchId);
  }, [loadInventory, selectedBranchId]);

  const activeBranch = useMemo(
    () => branches.find((b) => b.id === selectedBranchId) || null,
    [branches, selectedBranchId]
  );

  const stats = useMemo(() => {
    const totalSkus = items.length;
    const totalUnits = items.reduce((sum, i) => sum + i.stock, 0);
    const lowStock = items.filter((i) => i.stock > 0 && i.stock <= 10).length;
    const outOfStock = items.filter((i) => i.stock === 0).length;
    return { totalSkus, totalUnits, lowStock, outOfStock };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter === 'IN_STOCK' && item.stock <= 10) return false;
      if (statusFilter === 'LOW_STOCK' && (item.stock <= 0 || item.stock > 10)) {
        return false;
      }
      if (statusFilter === 'OUT_OF_STOCK' && item.stock !== 0) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.categoryName.toLowerCase().includes(q)
      );
    });
  }, [items, statusFilter, searchQuery]);

  const openAdjustModal = (item: InventoryItem, defaultMode: InventoryAdjustMode = 'IMPORT') => {
    setAdjustItem(item);
    setAdjustMode(defaultMode);
    setAdjustQty(defaultMode === 'SET' ? item.stock : 10);
    setAdjustReason(REASON_PRESETS[defaultMode][0]);
    setAdjustError(null);
  };

  const handleModeChange = (nextMode: InventoryAdjustMode) => {
    setAdjustMode(nextMode);
    setAdjustReason(REASON_PRESETS[nextMode][0]);
    if (nextMode === 'SET' && adjustItem) {
      setAdjustQty(adjustItem.stock);
    } else if (adjustQty <= 0) {
      setAdjustQty(10);
    }
  };

  const previewNextStock = useMemo(() => {
    if (!adjustItem) return 0;
    const q = Math.max(0, Math.floor(Number(adjustQty) || 0));
    if (adjustMode === 'IMPORT') return adjustItem.stock + q;
    if (adjustMode === 'DEDUCT') return Math.max(0, adjustItem.stock - q);
    return q;
  }, [adjustItem, adjustMode, adjustQty]);

  const handleQuickStep = async (item: InventoryItem, delta: number) => {
    if (delta < 0 && item.stock === 0) return;
    setQuickBusyId(item.productId);
    try {
      const res = await api.adjustInventory({
        productId: item.productId,
        branchId: selectedBranchId,
        mode: delta > 0 ? 'IMPORT' : 'DEDUCT',
        quantity: Math.abs(delta),
        reason: delta > 0 ? 'Điều chỉnh nhanh (+1)' : 'Điều chỉnh nhanh (-1)',
      });
      setItems((prev) =>
        prev.map((i) => (i.productId === item.productId ? res.item : i))
      );
      setLogs((prev) => [res.log, ...prev]);
      if (selectedBranchId === activeBranchId) {
        await onCatalogChanged();
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Không thể điều chỉnh tồn kho.'
      );
    } finally {
      setQuickBusyId(null);
    }
  };

  const handleConfirmAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem) return;

    const qty = Math.floor(Number(adjustQty) || 0);
    if ((adjustMode === 'IMPORT' || adjustMode === 'DEDUCT') && qty <= 0) {
      setAdjustError('Số lượng nhập hoặc xuất kho phải lớn hơn 0.');
      return;
    }

    setSubmitting(true);
    setAdjustError(null);
    try {
      const res = await api.adjustInventory({
        productId: adjustItem.productId,
        branchId: selectedBranchId,
        mode: adjustMode,
        quantity: qty,
        reason: adjustReason.trim(),
      });
      setItems((prev) =>
        prev.map((i) => (i.productId === adjustItem.productId ? res.item : i))
      );
      setLogs((prev) => [res.log, ...prev]);
      setAdjustItem(null);
      if (selectedBranchId === activeBranchId) {
        await onCatalogChanged();
      }
    } catch (err) {
      setAdjustError(
        err instanceof Error ? err.message : 'Không thể cập nhật tồn kho.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pos-scroll bg-[#F8FAFC] p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">
              Tồn kho theo chi nhánh
            </h1>
            <p className="text-sm text-[#64748B] mt-0.5">
              {activeBranch
                ? `${activeBranch.name} (${activeBranch.code}) · Quản lý số lượng sẵn bán tại quầy`
                : 'Theo dõi và nhập / kiểm kê tồn kho từng chi nhánh'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {canSwitchBranch ? (
              <div className="flex items-center gap-2 bg-white border border-[#E2E8F0] rounded-xl px-3 h-11">
                <MaterialIcon name="storefront" className="text-[19px] text-[#0F766E]" />
                <select
                  aria-label="Chọn chi nhánh"
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="bg-transparent text-sm font-semibold text-[#0F172A] focus:outline-none pr-2"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="h-11 px-3.5 rounded-xl bg-white border border-[#E2E8F0] flex items-center gap-2 text-sm font-semibold text-[#0F172A]">
                <MaterialIcon name="storefront" className="text-[19px] text-[#0F766E]" />
                <span>{activeBranch?.name || 'Chi nhánh hiện tại'}</span>
              </div>
            )}

            <div className="relative w-full sm:w-64">
              <MaterialIcon
                name="search"
                className="text-[19px] text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên hàng, SKU..."
                className="w-full h-11 pl-10 pr-3 rounded-xl bg-white border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowLogsPanel((prev) => !prev)}
              className={`h-11 px-4 rounded-xl border text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
                showLogsPanel
                  ? 'bg-[#0F766E] border-[#0F766E] text-white'
                  : 'bg-white border-[#E2E8F0] text-[#0F172A] hover:bg-[#F1F5F9]'
              }`}
            >
              <MaterialIcon name="history" className="text-[19px]" />
              <span>Lịch sử kho ({logs.length})</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-[#0F766E]/10 flex items-center justify-center shrink-0">
              <MaterialIcon name="inventory_2" className="text-[22px] text-[#0F766E]" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-[#64748B]">Mặt hàng quản lý</div>
              <div className="text-lg font-bold text-[#0F172A] tabular-nums-strict">
                {stats.totalSkus} SKU
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-[#16A34A]/10 flex items-center justify-center shrink-0">
              <MaterialIcon name="stacks" className="text-[22px] text-[#16A34A]" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-[#64748B]">Tổng số lượng tồn</div>
              <div className="text-lg font-bold text-[#0F172A] tabular-nums-strict">
                {stats.totalUnits.toLocaleString('vi-VN')} đơn vị
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/15 flex items-center justify-center shrink-0">
              <MaterialIcon name="warning" className="text-[22px] text-[#855300]" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-[#64748B]">Sắp hết hàng (1–10)</div>
              <div className="text-lg font-bold text-[#855300] tabular-nums-strict">
                {stats.lowStock} mặt hàng
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-[#FEF2F2] flex items-center justify-center shrink-0">
              <MaterialIcon name="production_quantity_limits" className="text-[22px] text-[#DC2626]" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-[#64748B]">Hết hàng (= 0)</div>
              <div className="text-lg font-bold text-[#DC2626] tabular-nums-strict">
                {stats.outOfStock} mặt hàng
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'ALL', label: `Tất cả (${items.length})` },
              {
                id: 'IN_STOCK',
                label: `Còn nhiều (${items.filter((i) => i.stock > 10).length})`,
              },
              { id: 'LOW_STOCK', label: `Sắp hết (${stats.lowStock})` },
              { id: 'OUT_OF_STOCK', label: `Hết hàng (${stats.outOfStock})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`h-10 px-4 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap border ${
                statusFilter === tab.id
                  ? 'bg-[#0F766E] border-[#0F766E] text-white'
                  : 'bg-white border-[#E2E8F0] text-[#0F172A] hover:bg-[#F1F5F9]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-sm text-[#DC2626] flex items-center justify-between gap-3">
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => loadInventory(selectedBranchId)}
              className="text-xs font-bold underline shrink-0"
            >
              Thử lại
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          <div
            className={`${
              showLogsPanel ? 'xl:col-span-8' : 'xl:col-span-12'
            } bg-white border border-[#E2E8F0] rounded-xl overflow-hidden`}
          >
            {loading ? (
              <div className="p-10 text-center text-sm text-[#64748B]">
                Đang tải tồn kho chi nhánh...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-2xl bg-[#F1F5F9] flex items-center justify-center mb-3">
                  <MaterialIcon name="inventory_2" className="text-[28px] text-[#94A3B8]" />
                </div>
                <div className="text-base font-bold text-[#0F172A]">
                  Không tìm thấy mặt hàng phù hợp
                </div>
                <p className="text-sm text-[#64748B] mt-1">
                  Hãy chuyển bộ lọc trạng thái về Tất cả hoặc xóa từ khóa tìm kiếm.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-semibold text-[#64748B]">
                    <tr>
                      <th className="py-3.5 px-5">Sản phẩm</th>
                      <th className="py-3.5 px-4">SKU</th>
                      <th className="py-3.5 px-4">Danh mục</th>
                      <th className="py-3.5 px-4 text-right">Giá bán</th>
                      <th className="py-3.5 px-4 text-right">Tồn hiện tại</th>
                      <th className="py-3.5 px-4">Trạng thái</th>
                      <th className="py-3.5 px-5 text-right">Điều chỉnh kho</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {filteredItems.map((item) => {
                      const imgBroken = !item.imageUrl || failedImages[item.productId];
                      const statusColor =
                        item.stock === 0
                          ? 'text-[#DC2626]'
                          : item.stock <= 10
                          ? 'text-[#855300]'
                          : 'text-[#16A34A]';
                      const statusLabel =
                        item.stock === 0
                          ? 'Hết hàng'
                          : item.stock <= 10
                          ? 'Sắp hết'
                          : 'Còn hàng';

                      return (
                        <tr
                          key={item.productId}
                          className="hover:bg-[#F8FAFC] transition-colors"
                        >
                          <td className="py-3 px-5">
                            <div className="flex items-center gap-3 min-w-[200px]">
                              <div className="w-11 h-11 rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] overflow-hidden flex items-center justify-center shrink-0">
                                {imgBroken ? (
                                  <MaterialIcon
                                    name="inventory_2"
                                    className="text-[20px] text-[#94A3B8]"
                                  />
                                ) : (
                                  <img
                                    src={item.imageUrl}
                                    alt={item.name}
                                    referrerPolicy="no-referrer"
                                    onError={() =>
                                      setFailedImages((prev) => ({
                                        ...prev,
                                        [item.productId]: true,
                                      }))
                                    }
                                    className="w-full h-full object-cover"
                                  />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-[#0F172A] truncate">
                                  {item.name}
                                </div>
                                <div className="text-xs text-[#64748B] truncate">
                                  ĐVT: {item.unit}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs font-semibold text-[#0F172A] whitespace-nowrap">
                            {item.sku}
                          </td>
                          <td className="py-3 px-4 text-[#64748B] whitespace-nowrap">
                            {item.categoryName}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums-strict font-medium text-[#0F172A] whitespace-nowrap">
                            {formatVND(item.price)}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums-strict whitespace-nowrap">
                            <span
                              className={`text-base font-bold ${
                                item.stock === 0
                                  ? 'text-[#DC2626]'
                                  : item.stock <= 10
                                  ? 'text-[#855300]'
                                  : 'text-[#0F172A]'
                              }`}
                            >
                              {item.stock}
                            </span>{' '}
                            <span className="text-xs text-[#64748B]">{item.unit}</span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`text-xs font-bold ${statusColor}`}>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="py-3 px-5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                disabled={
                                  item.stock === 0 || quickBusyId === item.productId
                                }
                                onClick={() => handleQuickStep(item, -1)}
                                title="Giảm nhanh 1"
                                className="w-9 h-9 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-[#0F172A] font-bold flex items-center justify-center disabled:opacity-40"
                              >
                                −
                              </button>
                              <button
                                type="button"
                                disabled={quickBusyId === item.productId}
                                onClick={() => handleQuickStep(item, 1)}
                                title="Tăng nhanh 1"
                                className="w-9 h-9 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-[#0F172A] font-bold flex items-center justify-center disabled:opacity-40"
                              >
                                +
                              </button>
                              <button
                                type="button"
                                onClick={() => openAdjustModal(item, 'IMPORT')}
                                className="h-9 px-3 rounded-lg bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-bold flex items-center gap-1"
                              >
                                <MaterialIcon name="edit_note" className="text-[17px]" />
                                <span>Nhập / Kiểm kê</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {showLogsPanel && (
            <aside className="xl:col-span-4 bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
              <div className="px-4 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-[#0F172A]">
                    Lịch sử biến động kho
                  </h2>
                  <div className="text-xs text-[#64748B]">
                    {activeBranch?.name}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLogsPanel(false)}
                  className="w-8 h-8 rounded-lg border border-[#E2E8F0] flex items-center justify-center text-[#64748B]"
                >
                  <MaterialIcon name="close" className="text-[18px]" />
                </button>
              </div>

              {logs.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#64748B]">
                  Chưa có phiếu nhập hoặc điều chỉnh kho nào tại chi nhánh này.
                </div>
              ) : (
                <div className="divide-y divide-[#E2E8F0] max-h-[560px] overflow-y-auto pos-scroll">
                  {logs.map((log) => (
                    <div key={log.id} className="p-3.5 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#0F172A] truncate">
                            {log.productName}
                          </div>
                          <div className="text-[11px] font-mono text-[#64748B]">
                            {log.sku} · {log.previousStock} → {log.newStock}
                          </div>
                        </div>
                        <span
                          className={`text-xs font-bold tabular-nums-strict shrink-0 ${
                            log.delta > 0
                              ? 'text-[#16A34A]'
                              : log.delta < 0
                              ? 'text-[#DC2626]'
                              : 'text-[#64748B]'
                          }`}
                        >
                          {log.delta > 0 ? `+${log.delta}` : log.delta}
                        </span>
                      </div>
                      <div className="text-xs text-[#334155]">{log.reason}</div>
                      <div className="text-[11px] text-[#64748B] tabular-nums-strict">
                        {log.actorName} · {formatDateTimeVN(log.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </aside>
          )}
        </div>
      </div>

      {adjustItem && (
        <div
          className="fixed inset-0 z-50 bg-[#0F172A]/45 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleConfirmAdjust}
            className="w-full max-w-lg bg-white rounded-2xl border border-[#E2E8F0] shadow-xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">
                  Nhập / Điều chỉnh tồn kho
                </h3>
                <div className="text-xs text-[#64748B] mt-0.5">
                  {activeBranch?.name} ·{' '}
                  <span className="font-mono font-semibold">
                    {adjustItem.sku}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAdjustItem(null)}
                className="w-10 h-10 rounded-xl border border-[#E2E8F0] flex items-center justify-center text-[#64748B]"
              >
                <MaterialIcon name="close" className="text-[20px]" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {adjustError && (
                <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#DC2626]">
                  {adjustError}
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[#0F172A] truncate">
                    {adjustItem.name}
                  </div>
                  <div className="text-xs text-[#64748B]">
                    Đơn vị tính: {adjustItem.unit}
                  </div>
                </div>
                <div className="text-right tabular-nums-strict shrink-0">
                  <div className="text-[11px] text-[#64748B]">Tồn hiện tại</div>
                  <div className="text-lg font-bold text-[#0F172A]">
                    {adjustItem.stock}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">
                  Hình thức cập nhật
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'IMPORT', label: 'Nhập thêm (+)' },
                      { id: 'SET', label: 'Kiểm kê (=)' },
                      { id: 'DEDUCT', label: 'Xuất / Hủy (−)' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleModeChange(m.id)}
                      className={`h-11 rounded-xl text-xs font-bold border transition-colors ${
                        adjustMode === m.id
                          ? 'bg-[#0F766E] border-[#0F766E] text-white'
                          : 'bg-white border-[#E2E8F0] text-[#0F172A] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-semibold text-[#0F172A]">
                    {adjustMode === 'SET'
                      ? 'Số lượng tồn thực tế sau kiểm kê'
                      : adjustMode === 'IMPORT'
                      ? 'Số lượng nhập thêm'
                      : 'Số lượng xuất / hủy'}
                  </label>
                  <div className="text-xs font-semibold tabular-nums-strict text-[#0F766E]">
                    Sau cập nhật: {previewNextStock} {adjustItem.unit}
                  </div>
                </div>

                <input
                  type="number"
                  required
                  min={adjustMode === 'SET' ? 0 : 1}
                  step={1}
                  value={adjustQty}
                  onChange={(e) =>
                    setAdjustQty(
                      Math.max(0, Math.floor(Number(e.target.value) || 0))
                    )
                  }
                  className="w-full h-12 px-3.5 rounded-xl border border-[#CBD5E1] text-base font-bold tabular-nums-strict focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
                />

                <div className="flex flex-wrap gap-2 mt-2">
                  {[5, 10, 20, 50].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAdjustQty(preset)}
                      className="h-8 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-xs font-semibold text-[#0F172A] tabular-nums-strict"
                    >
                      {adjustMode === 'SET' ? `Đặt ${preset}` : `${preset} ${adjustItem.unit}`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">
                  Lý do / Ghi chú phiếu kho
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {REASON_PRESETS[adjustMode].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAdjustReason(preset)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border ${
                        adjustReason === preset
                          ? 'bg-[#0F766E]/10 border-[#0F766E] text-[#0F766E]'
                          : 'bg-white border-[#E2E8F0] text-[#64748B]'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Nhập ghi chú điều chỉnh kho..."
                  className="w-full h-11 px-3.5 rounded-xl border border-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
                />
              </div>
            </div>

            <div className="p-4 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAdjustItem(null)}
                className="h-12 px-4 rounded-xl border border-[#E2E8F0] bg-white text-sm font-semibold text-[#0F172A]"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 h-12 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-bold disabled:opacity-50"
              >
                {submitting ? 'Đang cập nhật...' : 'Xác nhận cập nhật tồn kho'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
