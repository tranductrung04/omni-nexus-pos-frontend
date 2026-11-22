import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { Category } from '../types';
import { MaterialIcon } from './MaterialIcon';

interface CategoriesViewProps {
  storeId: string;
  canManage: boolean;
  onCatalogChanged: () => Promise<void> | void;
  onGoToProducts?: (categoryId: string) => void;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  storeId,
  canManage,
  onCatalogChanged,
  onGoToProducts,
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Add / Edit Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Modal
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const list = await api.getCategories(storeId);
      setCategories(list);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Không thể tải danh sách danh mục.'
      );
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
    );
  }, [categories, searchQuery]);

  const stats = useMemo(() => {
    const total = categories.length;
    const withProducts = categories.filter((c) => (c.productCount || 0) > 0).length;
    const empty = total - withProducts;
    const totalLinkedProducts = categories.reduce(
      (sum, c) => sum + (c.productCount || 0),
      0
    );
    return { total, withProducts, empty, totalLinkedProducts };
  }, [categories]);

  const openCreateModal = () => {
    setEditingCategory(null);
    setNameInput('');
    setFormError(null);
    setFormOpen(true);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setNameInput(category.name);
    setFormError(null);
    setFormOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = nameInput.trim();
    if (!clean) {
      setFormError('Vui lòng nhập tên danh mục.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      if (editingCategory) {
        const updated = await api.updateCategory(editingCategory.id, {
          name: clean,
        });
        setCategories((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c))
        );
      } else {
        const created = await api.createCategory({ storeId, name: clean });
        setCategories((prev) => [...prev, created]);
      }
      setFormOpen(false);
      await onCatalogChanged();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Không thể lưu danh mục.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingCategory) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteCategory(deletingCategory.id);
      setCategories((prev) =>
        prev.filter((c) => c.id !== deletingCategory.id)
      );
      setDeletingCategory(null);
      await onCatalogChanged();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Không thể xóa danh mục này.'
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pos-scroll bg-[#F8FAFC] p-4 lg:p-6">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">
              Danh mục sản phẩm
            </h1>
            <p className="text-sm text-[#64748B] mt-0.5 tabular-nums-strict">
              {stats.total} danh mục · {stats.totalLinkedProducts} sản phẩm đang phân loại trên toàn hệ thống
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-72">
              <MaterialIcon
                name="search"
                className="text-[19px] text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên hoặc mã danh mục..."
                className="w-full h-11 pl-10 pr-3 rounded-xl bg-white border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
              />
            </div>

            {canManage && (
              <button
                type="button"
                onClick={openCreateModal}
                className="h-11 px-4 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                <MaterialIcon name="add" className="text-[20px]" />
                <span>Thêm danh mục</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-[#0F766E]/10 flex items-center justify-center shrink-0">
              <MaterialIcon name="category" className="text-[22px] text-[#0F766E]" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-[#64748B]">Tổng danh mục</div>
              <div className="text-lg font-bold text-[#0F172A] tabular-nums-strict">
                {stats.total}
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-[#16A34A]/10 flex items-center justify-center shrink-0">
              <MaterialIcon name="check_circle" className="text-[22px] text-[#16A34A]" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-[#64748B]">Đang có sản phẩm</div>
              <div className="text-lg font-bold text-[#0F172A] tabular-nums-strict">
                {stats.withProducts}
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/15 flex items-center justify-center shrink-0">
              <MaterialIcon name="folder_open" className="text-[22px] text-[#855300]" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-[#64748B]">Danh mục trống</div>
              <div className="text-lg font-bold text-[#0F172A] tabular-nums-strict">
                {stats.empty}
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-[#E2E8F0]/70 flex items-center justify-center shrink-0">
              <MaterialIcon name="grid_view" className="text-[22px] text-[#0F172A]" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-[#64748B]">Sản phẩm đã gắn</div>
              <div className="text-lg font-bold text-[#0F172A] tabular-nums-strict">
                {stats.totalLinkedProducts}
              </div>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-sm text-[#DC2626] flex items-center justify-between gap-3">
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={loadCategories}
              className="text-xs font-bold underline shrink-0"
            >
              Thử lại
            </button>
          </div>
        )}

        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm text-[#64748B]">
              Đang tải danh sách danh mục...
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-[#F1F5F9] flex items-center justify-center mb-3">
                <MaterialIcon name="category" className="text-[28px] text-[#94A3B8]" />
              </div>
              <div className="text-base font-bold text-[#0F172A]">
                {searchQuery
                  ? 'Không tìm thấy danh mục phù hợp'
                  : 'Chưa có danh mục sản phẩm nào'}
              </div>
              <p className="text-sm text-[#64748B] mt-1 max-w-md">
                {searchQuery
                  ? 'Thử thay đổi từ khóa tìm kiếm hoặc xóa bộ lọc để xem tất cả danh mục.'
                  : 'Tạo danh mục để phân nhóm thực đơn và đồng bộ bộ lọc nhanh trên màn hình thu ngân POS.'}
              </p>
              {canManage && !searchQuery && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-4 h-11 px-4 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-bold flex items-center gap-1.5"
                >
                  <MaterialIcon name="add" className="text-[19px]" />
                  <span>Tạo danh mục đầu tiên</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-semibold text-[#64748B]">
                  <tr>
                    <th className="py-3.5 px-5">Tên danh mục</th>
                    <th className="py-3.5 px-4">Mã định danh</th>
                    <th className="py-3.5 px-4">Số sản phẩm</th>
                    <th className="py-3.5 px-4">Trạng thái</th>
                    <th className="py-3.5 px-5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {filteredCategories.map((cat) => {
                    const count = cat.productCount || 0;
                    return (
                      <tr key={cat.id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-[#0F766E]/10 flex items-center justify-center shrink-0">
                              <MaterialIcon
                                name="label"
                                className="text-[19px] text-[#0F766E]"
                              />
                            </div>
                            <span className="font-bold text-[#0F172A]">
                              {cat.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-[#64748B]">
                          {cat.id}
                        </td>
                        <td className="py-3.5 px-4 tabular-nums-strict font-semibold text-[#0F172A]">
                          {count} sản phẩm
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`text-xs font-semibold ${
                              count > 0 ? 'text-[#16A34A]' : 'text-[#64748B]'
                            }`}
                          >
                            {count > 0 ? 'Đang hiển thị POS' : 'Chưa có sản phẩm'}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            {onGoToProducts && (
                              <button
                                type="button"
                                onClick={() => onGoToProducts(cat.id)}
                                className="h-9 px-3 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-xs font-semibold text-[#0F172A] flex items-center gap-1 whitespace-nowrap"
                              >
                                <MaterialIcon name="visibility" className="text-[16px]" />
                                <span>Xem SP</span>
                              </button>
                            )}
                            {canManage && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEditModal(cat)}
                                  className="h-9 px-3 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-xs font-semibold text-[#0F172A] flex items-center gap-1 whitespace-nowrap"
                                >
                                  <MaterialIcon name="edit" className="text-[16px]" />
                                  <span>Sửa</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeleteError(null);
                                    setDeletingCategory(cat);
                                  }}
                                  className="h-9 px-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] hover:bg-[#FEE2E2] text-xs font-semibold text-[#DC2626] flex items-center gap-1 whitespace-nowrap"
                                >
                                  <MaterialIcon name="delete" className="text-[16px]" />
                                  <span>Xóa</span>
                                </button>
                              </>
                            )}
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
      </div>

      {formOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#0F172A]/45 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveCategory}
            className="w-full max-w-md bg-white rounded-2xl border border-[#E2E8F0] shadow-xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <h3 className="text-base font-bold text-[#0F172A]">
                {editingCategory ? 'Cập nhật danh mục' : 'Thêm danh mục mới'}
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="w-10 h-10 rounded-xl border border-[#E2E8F0] flex items-center justify-center text-[#64748B] hover:text-[#0F172A]"
              >
                <MaterialIcon name="close" className="text-[20px]" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#DC2626]">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">
                  Tên danh mục <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Ví dụ: Nước ép & Sinh tố"
                  className="w-full h-12 px-3.5 rounded-xl border border-[#CBD5E1] text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
                />
                <p className="text-xs text-[#64748B] mt-1.5">
                  Tên danh mục sẽ hiển thị trực tiếp trên thanh lọc nhanh của màn hình Thu ngân POS.
                </p>
              </div>
            </div>

            <div className="p-4 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center gap-3">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="h-12 px-4 rounded-xl border border-[#E2E8F0] bg-white text-sm font-semibold text-[#0F172A]"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 h-12 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-bold disabled:opacity-50"
              >
                {submitting
                  ? 'Đang lưu...'
                  : editingCategory
                  ? 'Lưu thay đổi'
                  : 'Tạo danh mục'}
              </button>
            </div>
          </form>
        </div>
      )}

      {deletingCategory && (
        <div
          className="fixed inset-0 z-50 bg-[#0F172A]/45 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white rounded-2xl border border-[#E2E8F0] shadow-xl overflow-hidden">
            <div className="p-5 flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-[#FEF2F2] flex items-center justify-center shrink-0">
                <MaterialIcon name="warning" className="text-[24px] text-[#DC2626]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-[#0F172A]">
                  Xóa danh mục "{deletingCategory.name}"?
                </h3>
                <p className="text-sm text-[#64748B] mt-1">
                  {(deletingCategory.productCount || 0) > 0
                    ? `Danh mục này hiện đang chứa ${deletingCategory.productCount} sản phẩm. Bạn cần chuyển các sản phẩm sang danh mục khác trước khi xóa.`
                    : 'Thao tác này sẽ xóa vĩnh viễn danh mục khỏi hệ thống cửa hàng.'}
                </p>
                {deleteError && (
                  <div className="mt-3 p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#DC2626]">
                    {deleteError}
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingCategory(null)}
                className="h-11 px-4 rounded-xl border border-[#E2E8F0] bg-white text-sm font-semibold text-[#0F172A]"
              >
                Đóng
              </button>
              {(deletingCategory.productCount || 0) === 0 && (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleConfirmDelete}
                  className="h-11 px-4 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-sm font-bold disabled:opacity-50"
                >
                  {deleting ? 'Đang xóa...' : 'Xác nhận xóa'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
