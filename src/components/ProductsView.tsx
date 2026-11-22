import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { Category, Product } from '../types';
import { formatVND } from '../utils/format';
import { MaterialIcon } from './MaterialIcon';

interface ProductsViewProps {
  storeId: string;
  canManage: boolean;
  initialCategoryFilter?: string;
  onCatalogChanged: () => Promise<void> | void;
}

const IMAGE_PRESETS = [
  {
    label: 'Cà phê sữa đá',
    url: '/src/assets/images/pos_iced_milk_coffee_1795270258563.jpg',
  },
  {
    label: 'Matcha Latte',
    url: '/src/assets/images/pos_matcha_latte_1795270258250.jpg',
  },
  {
    label: 'Trà trái cây',
    url: '/src/assets/images/pos_peach_tea_1795270258952.jpg',
  },
  {
    label: 'Croissant bơ',
    url: '/src/assets/images/pos_butter_croissant_1795270259186.jpg',
  },
  {
    label: 'Bánh Tiramisu',
    url: '/src/assets/images/pos_tiramisu_cake_1795270259164.jpg',
  },
  {
    label: 'Túi cà phê hạt',
    url: '/src/assets/images/pos_coffee_beans_bag_1795270258836.jpg',
  },
];

const UNIT_PRESETS = ['Ly', 'Cái', 'Phần', 'Gói', 'Chai', 'Hộp'];

interface ProductFormState {
  name: string;
  sku: string;
  brand: string;
  categoryId: string;
  unit: string;
  mrp: number;
  price: number;
  imageUrl: string;
  initialStock: number;
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  storeId,
  canManage,
  initialCategoryFilter = 'ALL',
  onCatalogChanged,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategoryFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Add / Edit Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormState>({
    name: '',
    sku: '',
    brand: 'Omni Signature',
    categoryId: '',
    unit: 'Ly',
    mrp: 45000,
    price: 45000,
    imageUrl: IMAGE_PRESETS[0].url,
    initialStock: 20,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Modal
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setCategoryFilter(initialCategoryFilter);
  }, [initialCategoryFilter]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [prodList, catList] = await Promise.all([
        api.getProducts({ storeId }),
        api.getCategories(storeId),
      ]);
      setProducts(prodList);
      setCategories(catList);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Không thể tải danh sách sản phẩm.'
      );
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== 'ALL' && p.categoryId !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q)
      );
    });
  }, [products, categoryFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = products.length;
    const discounted = products.filter((p) => p.mrp > p.price).length;
    const totalStock = products.reduce((s, p) => s + (p.totalStock ?? p.stock), 0);
    return {
      total,
      categoriesCount: categories.length,
      discounted,
      totalStock,
    };
  }, [products, categories]);

  const openCreateModal = () => {
    setEditingProduct(null);
    setForm({
      name: '',
      sku: '',
      brand: 'Omni Signature',
      categoryId: categories[0]?.id || '',
      unit: 'Ly',
      mrp: 55000,
      price: 49000,
      imageUrl: IMAGE_PRESETS[0].url,
      initialStock: 25,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const openEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setForm({
      name: prod.name,
      sku: prod.sku,
      brand: prod.brand,
      categoryId: prod.categoryId,
      unit: prod.unit,
      mrp: prod.mrp,
      price: prod.price,
      imageUrl: prod.imageUrl,
      initialStock: 0,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setFormError('Ảnh tải lên không được vượt quá 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm((prev) => ({ ...prev, imageUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.name.trim() || !form.sku.trim()) {
      setFormError('Vui lòng nhập đầy đủ tên sản phẩm và mã SKU.');
      return;
    }
    if (!form.categoryId) {
      setFormError('Vui lòng chọn danh mục sản phẩm.');
      return;
    }
    if (form.price <= 0) {
      setFormError('Giá bán phải lớn hơn 0 ₫.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingProduct) {
        const updated = await api.updateProduct(editingProduct.id, {
          categoryId: form.categoryId,
          name: form.name.trim(),
          sku: form.sku.trim().toUpperCase(),
          brand: form.brand.trim() || 'Omni Signature',
          mrp: Math.max(form.price, Number(form.mrp) || form.price),
          price: Number(form.price),
          imageUrl: form.imageUrl.trim(),
          unit: form.unit.trim() || 'Phần',
        });
        setProducts((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p))
        );
      } else {
        const created = await api.createProduct({
          storeId,
          categoryId: form.categoryId,
          name: form.name.trim(),
          sku: form.sku.trim().toUpperCase(),
          brand: form.brand.trim() || 'Omni Signature',
          mrp: Math.max(form.price, Number(form.mrp) || form.price),
          price: Number(form.price),
          imageUrl: form.imageUrl.trim(),
          unit: form.unit.trim() || 'Phần',
          initialStock: Math.max(0, Math.floor(Number(form.initialStock) || 0)),
        });
        setProducts((prev) => [created, ...prev]);
      }
      setFormOpen(false);
      await onCatalogChanged();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Không thể lưu thông tin sản phẩm.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingProduct) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteProduct(deletingProduct.id);
      setProducts((prev) => prev.filter((p) => p.id !== deletingProduct.id));
      setDeletingProduct(null);
      await onCatalogChanged();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Không thể xóa sản phẩm.'
      );
    } finally {
      setDeleting(false);
    }
  };

  const discountPreviewPercent =
    form.mrp > form.price && form.mrp > 0
      ? Math.round(((form.mrp - form.price) / form.mrp) * 100)
      : 0;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pos-scroll bg-[#F8FAFC] p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">
              Danh mục & Bảng giá Sản phẩm
            </h1>
            <p className="text-sm text-[#64748B] mt-0.5 tabular-nums-strict">
              Quản lý SKU, thương hiệu, giá niêm yết (MRP), giá bán và đơn vị tính đồng bộ tới quầy thu ngân
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
                placeholder="Tìm tên, SKU, thương hiệu..."
                className="w-full h-11 pl-10 pr-3 rounded-xl bg-white border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
              />
            </div>

            {canManage && (
              <button
                type="button"
                onClick={openCreateModal}
                disabled={categories.length === 0}
                className="h-11 px-4 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <MaterialIcon name="add" className="text-[20px]" />
                <span>Thêm sản phẩm</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-[#0F766E]/10 flex items-center justify-center shrink-0">
              <MaterialIcon name="grid_view" className="text-[22px] text-[#0F766E]" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-[#64748B]">Tổng mặt hàng</div>
              <div className="text-lg font-bold text-[#0F172A] tabular-nums-strict">
                {stats.total} SKU
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-[#16A34A]/10 flex items-center justify-center shrink-0">
              <MaterialIcon name="category" className="text-[22px] text-[#16A34A]" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-[#64748B]">Danh mục hoạt động</div>
              <div className="text-lg font-bold text-[#0F172A] tabular-nums-strict">
                {stats.categoriesCount} nhóm
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/15 flex items-center justify-center shrink-0">
              <MaterialIcon name="sell" className="text-[22px] text-[#855300]" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-[#64748B]">Ưu đãi dưới MRP</div>
              <div className="text-lg font-bold text-[#0F172A] tabular-nums-strict">
                {stats.discounted} sản phẩm
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-[#E2E8F0]/70 flex items-center justify-center shrink-0">
              <MaterialIcon name="inventory_2" className="text-[22px] text-[#0F172A]" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-[#64748B]">Tổng tồn toàn chuỗi</div>
              <div className="text-lg font-bold text-[#0F172A] tabular-nums-strict">
                {stats.totalStock.toLocaleString('vi-VN')} đơn vị
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setCategoryFilter('ALL')}
            className={`h-10 px-4 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border ${
              categoryFilter === 'ALL'
                ? 'bg-[#0F766E] border-[#0F766E] text-white'
                : 'bg-white border-[#E2E8F0] text-[#0F172A] hover:bg-[#F1F5F9]'
            }`}
          >
            Tất cả ({products.length})
          </button>
          {categories.map((cat) => {
            const count = products.filter((p) => p.categoryId === cat.id).length;
            const active = categoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`h-10 px-4 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border ${
                  active
                    ? 'bg-[#0F766E] border-[#0F766E] text-white'
                    : 'bg-white border-[#E2E8F0] text-[#0F172A] hover:bg-[#F1F5F9]'
                }`}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-sm text-[#DC2626] flex items-center justify-between gap-3">
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={loadData}
              className="text-xs font-bold underline shrink-0"
            >
              Thử lại
            </button>
          </div>
        )}

        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm text-[#64748B]">
              Đang tải danh sách sản phẩm...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-[#F1F5F9] flex items-center justify-center mb-3">
                <MaterialIcon name="grid_view" className="text-[28px] text-[#94A3B8]" />
              </div>
              <div className="text-base font-bold text-[#0F172A]">
                Không có sản phẩm nào khớp bộ lọc
              </div>
              <p className="text-sm text-[#64748B] mt-1">
                Thử chọn danh mục khác, đổi từ khóa tìm kiếm hoặc thêm sản phẩm mới vào thực đơn.
              </p>
              {canManage && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-4 h-11 px-4 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-bold flex items-center gap-1.5"
                >
                  <MaterialIcon name="add" className="text-[19px]" />
                  <span>Thêm sản phẩm mới</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-semibold text-[#64748B]">
                  <tr>
                    <th className="py-3.5 px-5">Sản phẩm</th>
                    <th className="py-3.5 px-4">SKU</th>
                    <th className="py-3.5 px-4">Danh mục</th>
                    <th className="py-3.5 px-4">Đơn vị</th>
                    <th className="py-3.5 px-4 text-right">Giá niêm yết (MRP)</th>
                    <th className="py-3.5 px-4 text-right">Giá bán</th>
                    <th className="py-3.5 px-4 text-right">Tồn toàn chuỗi</th>
                    {canManage && (
                      <th className="py-3.5 px-5 text-right">Thao tác</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {filteredProducts.map((prod) => {
                    const imgBroken = !prod.imageUrl || failedImages[prod.id];
                    const hasMrpDiscount = prod.mrp > prod.price;
                    return (
                      <tr key={prod.id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-3 min-w-[220px]">
                            <div className="w-12 h-12 rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] overflow-hidden flex items-center justify-center shrink-0">
                              {imgBroken ? (
                                <MaterialIcon
                                  name="local_cafe"
                                  className="text-[22px] text-[#94A3B8]"
                                />
                              ) : (
                                <img
                                  src={prod.imageUrl}
                                  alt={prod.name}
                                  referrerPolicy="no-referrer"
                                  onError={() =>
                                    setFailedImages((prev) => ({
                                      ...prev,
                                      [prod.id]: true,
                                    }))
                                  }
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-[#0F172A] truncate">
                                {prod.name}
                              </div>
                              <div className="text-xs text-[#64748B] truncate">
                                {prod.brand}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-[#0F172A] whitespace-nowrap">
                          {prod.sku}
                        </td>
                        <td className="py-3 px-4 text-[#0F172A] whitespace-nowrap">
                          {prod.categoryName || '—'}
                        </td>
                        <td className="py-3 px-4 text-[#64748B] whitespace-nowrap">
                          {prod.unit}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums-strict whitespace-nowrap text-[#64748B]">
                          <span className={hasMrpDiscount ? 'line-through' : ''}>
                            {formatVND(prod.mrp)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums-strict whitespace-nowrap font-bold text-[#0F766E]">
                          {formatVND(prod.price)}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums-strict whitespace-nowrap">
                          <div className="font-bold text-[#0F172A]">
                            {prod.totalStock ?? prod.stock} {prod.unit}
                          </div>
                          {prod.branchStocks && prod.branchStocks.length > 0 && (
                            <div className="text-[11px] text-[#64748B]">
                              {prod.branchStocks
                                .map((bs) => `${bs.stock}`)
                                .join(' + ')}{' '}
                              theo CN
                            </div>
                          )}
                        </td>
                        {canManage && (
                          <td className="py-3 px-5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openEditModal(prod)}
                                className="h-9 px-3 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-xs font-semibold text-[#0F172A] flex items-center gap-1"
                              >
                                <MaterialIcon name="edit" className="text-[16px]" />
                                <span>Sửa</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteError(null);
                                  setDeletingProduct(prod);
                                }}
                                className="h-9 px-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] hover:bg-[#FEE2E2] text-xs font-semibold text-[#DC2626] flex items-center gap-1"
                              >
                                <MaterialIcon name="delete" className="text-[16px]" />
                                <span>Xóa</span>
                              </button>
                            </div>
                          </td>
                        )}
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
            onSubmit={handleSubmitProduct}
            className="w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl border border-[#E2E8F0] shadow-xl flex flex-col overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">
                  {editingProduct ? 'Cập nhật sản phẩm' : 'Thêm sản phẩm mới'}
                </h3>
                <div className="text-xs text-[#64748B]">
                  {editingProduct
                    ? `Mã hiện tại: ${editingProduct.sku}`
                    : 'Sản phẩm mới sẽ được đồng bộ ngay tới các chi nhánh và quầy POS'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="w-10 h-10 rounded-xl border border-[#E2E8F0] flex items-center justify-center text-[#64748B] hover:text-[#0F172A]"
              >
                <MaterialIcon name="close" className="text-[20px]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 pos-scroll">
              {formError && (
                <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#DC2626]">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">
                    Tên sản phẩm <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ví dụ: Trà Sen Vàng Kem Cheese"
                    className="w-full h-11 px-3.5 rounded-xl border border-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">
                    Mã SKU <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.sku}
                    onChange={(e) =>
                      setForm({ ...form, sku: e.target.value.toUpperCase() })
                    }
                    placeholder="VD: TR-005"
                    className="w-full h-11 px-3.5 rounded-xl border border-[#CBD5E1] font-mono text-sm uppercase focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">
                    Danh mục <span className="text-[#DC2626]">*</span>
                  </label>
                  <select
                    required
                    value={form.categoryId}
                    onChange={(e) =>
                      setForm({ ...form, categoryId: e.target.value })
                    }
                    className="w-full h-11 px-3 rounded-xl border border-[#CBD5E1] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
                  >
                    <option value="" disabled>
                      Chọn danh mục
                    </option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">
                    Thương hiệu
                  </label>
                  <input
                    type="text"
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    placeholder="Omni Signature"
                    className="w-full h-11 px-3.5 rounded-xl border border-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">
                    Đơn vị tính <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    list="unit-presets"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="Ly / Cái / Gói"
                    className="w-full h-11 px-3.5 rounded-xl border border-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
                  />
                  <datalist id="unit-presets">
                    {UNIT_PRESETS.map((u) => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">
                    Giá niêm yết MRP (₫)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={form.mrp}
                    onChange={(e) =>
                      setForm({ ...form, mrp: Number(e.target.value) || 0 })
                    }
                    className="w-full h-11 px-3.5 rounded-xl border border-[#CBD5E1] text-sm font-semibold tabular-nums-strict focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">
                    Giá bán thực tế (₫) <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1000}
                    step={1000}
                    value={form.price}
                    onChange={(e) =>
                      setForm({ ...form, price: Number(e.target.value) || 0 })
                    }
                    className="w-full h-11 px-3.5 rounded-xl border border-[#CBD5E1] text-sm font-bold text-[#0F766E] tabular-nums-strict focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
                  />
                  {discountPreviewPercent > 0 && (
                    <div className="text-[11px] font-semibold text-[#16A34A] mt-1 tabular-nums-strict">
                      Thấp hơn MRP {discountPreviewPercent}%
                    </div>
                  )}
                </div>

                {!editingProduct && (
                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">
                      Tồn kho ban đầu / CN
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={form.initialStock}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          initialStock: Math.max(
                            0,
                            Math.floor(Number(e.target.value) || 0)
                          ),
                        })
                      }
                      className="w-full h-11 px-3.5 rounded-xl border border-[#CBD5E1] text-sm font-semibold tabular-nums-strict focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
                    />
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-[#E2E8F0] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-sm font-semibold text-[#0F172A]">
                    Hình ảnh sản phẩm
                  </label>
                  <label className="h-9 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-xs font-semibold text-[#0F172A] flex items-center gap-1.5 cursor-pointer">
                    <MaterialIcon name="upload" className="text-[16px]" />
                    <span>Tải ảnh từ máy</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {IMAGE_PRESETS.map((preset) => {
                    const selected = form.imageUrl === preset.url;
                    return (
                      <button
                        key={preset.url}
                        type="button"
                        onClick={() => setForm({ ...form, imageUrl: preset.url })}
                        className={`p-1.5 rounded-xl border text-left transition-all ${
                          selected
                            ? 'border-[#0F766E] bg-[#0F766E]/5 ring-2 ring-[#0F766E]/25'
                            : 'border-[#E2E8F0] bg-white hover:border-[#94A3B8]'
                        }`}
                      >
                        <div className="aspect-[4/3] rounded-lg overflow-hidden bg-[#F1F5F9] mb-1">
                          <img
                            src={preset.url}
                            alt={preset.label}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="text-[11px] font-medium text-[#0F172A] truncate text-center">
                          {preset.label}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] overflow-hidden flex items-center justify-center shrink-0">
                    {form.imageUrl ? (
                      <img
                        src={form.imageUrl}
                        alt="Xem trước"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <MaterialIcon name="image" className="text-[22px] text-[#94A3B8]" />
                    )}
                  </div>
                  <input
                    type="text"
                    value={form.imageUrl}
                    onChange={(e) =>
                      setForm({ ...form, imageUrl: e.target.value })
                    }
                    placeholder="Hoặc dán đường dẫn hình ảnh (/src/assets/images/...)"
                    className="flex-1 h-11 px-3.5 rounded-xl border border-[#CBD5E1] text-xs font-mono text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="h-12 px-5 rounded-xl border border-[#E2E8F0] bg-white text-sm font-semibold text-[#0F172A]"
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
                  : editingProduct
                  ? 'Lưu cập nhật sản phẩm'
                  : 'Tạo sản phẩm mới'}
              </button>
            </div>
          </form>
        </div>
      )}

      {deletingProduct && (
        <div
          className="fixed inset-0 z-50 bg-[#0F172A]/45 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white rounded-2xl border border-[#E2E8F0] shadow-xl overflow-hidden">
            <div className="p-5 flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-[#FEF2F2] flex items-center justify-center shrink-0">
                <MaterialIcon name="delete_forever" className="text-[24px] text-[#DC2626]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-[#0F172A]">
                  Xóa sản phẩm "{deletingProduct.name}"?
                </h3>
                <p className="text-sm text-[#64748B] mt-1">
                  Mã <span className="font-mono font-semibold">{deletingProduct.sku}</span> và toàn bộ số liệu tồn kho của sản phẩm tại các chi nhánh sẽ bị gỡ bỏ.
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
                onClick={() => setDeletingProduct(null)}
                className="h-11 px-4 rounded-xl border border-[#E2E8F0] bg-white text-sm font-semibold text-[#0F172A]"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="h-11 px-4 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-sm font-bold disabled:opacity-50"
              >
                {deleting ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
