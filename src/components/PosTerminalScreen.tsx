import React, { useMemo, useState } from 'react';
import { api } from '../api';
import type {
  CartItem,
  Category,
  Customer,
  HeldOrder,
  Product,
} from '../types';
import { formatTimeVN, formatVND } from '../utils/format';
import { MaterialIcon } from './MaterialIcon';

interface PosTerminalScreenProps {
  storeId: string;
  categories: Category[];
  products: Product[];
  customers: Customer[];
  cart: CartItem[];
  selectedCustomer: Customer | null;
  discountPercent: number;
  heldOrders: HeldOrder[];
  onAddToCart: (product: Product) => void;
  onUpdateQty: (lineId: string, delta: number) => void;
  onUpdateNote: (lineId: string, note: string) => void;
  onRemoveLine: (lineId: string) => void;
  onClearCart: () => void;
  onSelectCustomer: (customer: Customer | null) => void;
  onCustomerCreated: (customer: Customer) => void;
  onChangeDiscountPercent: (pct: number) => void;
  onHoldCurrentOrder: () => void;
  onRestoreHeldOrder: (heldId: string) => void;
  onOpenCheckout: () => void;
}

const MODIFIER_PRESETS = [
  'Ít đá',
  'Không đá',
  '50% đường',
  '70% đường',
  'Ít ngọt',
  'Nóng',
  'Mang về',
  'Hâm nóng',
];

const DISCOUNT_PRESETS = [0, 5, 10, 15, 20];

export const PosTerminalScreen: React.FC<PosTerminalScreenProps> = ({
  storeId,
  categories,
  products,
  customers,
  cart,
  selectedCustomer,
  discountPercent,
  heldOrders,
  onAddToCart,
  onUpdateQty,
  onUpdateNote,
  onRemoveLine,
  onClearCart,
  onSelectCustomer,
  onCustomerCreated,
  onChangeDiscountPercent,
  onHoldCurrentOrder,
  onRestoreHeldOrder,
  onOpenCheckout,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string>('ALL');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Modals
  const [editingNoteLine, setEditingNoteLine] = useState<CartItem | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [custError, setCustError] = useState<string | null>(null);
  const [showDiscountBar, setShowDiscountBar] = useState(false);
  const [showHeldModal, setShowHeldModal] = useState(false);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const matchCategory =
        activeCategoryId === 'ALL' || p.categoryId === activeCategoryId;
      if (!matchCategory) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q)
      );
    });
  }, [products, activeCategoryId, searchQuery]);

  const cartQtyByProduct = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of cart) {
      map[item.productId] = (map[item.productId] || 0) + item.quantity;
    }
    return map;
  }, [cart]);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [cart]
  );
  const discountAmount = Math.round((subtotal * discountPercent) / 100);
  const grandTotal = Math.max(0, subtotal - discountAmount);
  const totalItemsCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q)
    );
  }, [customers, customerSearch]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      const exactSku = products.find(
        (p) => p.sku.toLowerCase() === searchQuery.trim().toLowerCase()
      );
      const target =
        exactSku || (filteredProducts.length === 1 ? filteredProducts[0] : null);
      if (target && target.stock > 0) {
        onAddToCart(target);
        setSearchQuery('');
      }
    }
  };

  const openNoteEditor = (line: CartItem) => {
    setEditingNoteLine(line);
    setNoteDraft(line.note);
  };

  const toggleModifierPreset = (preset: string) => {
    const currentParts = noteDraft
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (currentParts.includes(preset)) {
      setNoteDraft(currentParts.filter((p) => p !== preset).join(', '));
    } else {
      setNoteDraft([...currentParts, preset].join(', '));
    }
  };

  const saveNote = () => {
    if (editingNoteLine) {
      onUpdateNote(editingNoteLine.lineId, noteDraft.trim());
    }
    setEditingNoteLine(null);
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustError(null);
    setCreatingCustomer(true);
    try {
      const created = await api.createCustomer({
        storeId,
        name: newCustName,
        phone: newCustPhone,
      });
      onCustomerCreated(created);
      onSelectCustomer(created);
      setNewCustName('');
      setNewCustPhone('');
      setShowCustomerModal(false);
    } catch (err) {
      setCustError(
        err instanceof Error ? err.message : 'Không thể thêm khách hàng.'
      );
    } finally {
      setCreatingCustomer(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden bg-[#F8FAFC]">
      {/* LEFT PANE: Product Catalog Zone (60% - 65%) */}
      <section className="flex-1 min-w-0 flex flex-col min-h-0 p-4 gap-3.5 overflow-hidden">
        {/* Search / Barcode Input Bar */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative flex-1">
            <MaterialIcon
              name="search"
              className="text-[22px] text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Tìm tên món, thương hiệu hoặc quét mã SKU (VD: CF-001)..."
              className="w-full h-12 pl-11 pr-20 rounded-xl border border-[#CBD5E1] bg-white text-sm text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-[#0F766E]"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                  aria-label="Xóa tìm kiếm"
                >
                  <MaterialIcon name="close" className="text-[18px]" />
                </button>
              )}
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[#0F766E] bg-[#0F766E]/10"
                title="Hỗ trợ đầu đọc mã vạch (nhấn Enter để thêm nhanh)"
              >
                <MaterialIcon name="qr_code_scanner" className="text-[20px]" />
              </div>
            </div>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 shrink-0 pos-scroll">
          <button
            type="button"
            onClick={() => setActiveCategoryId('ALL')}
            className={`h-11 px-4 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap shrink-0 border ${
              activeCategoryId === 'ALL'
                ? 'bg-[#0F766E] border-[#0F766E] text-white'
                : 'bg-white border-[#E2E8F0] text-[#0F172A] hover:bg-[#F1F5F9]'
            }`}
          >
            Tất cả ({products.length})
          </button>
          {categories.map((cat) => {
            const active = activeCategoryId === cat.id;
            const count = products.filter((p) => p.categoryId === cat.id).length;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategoryId(cat.id)}
                className={`h-11 px-4 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap shrink-0 border ${
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

        {/* Product Card Grid */}
        <div className="flex-1 min-h-0 overflow-y-auto pos-scroll pr-1">
          {filteredProducts.length === 0 ? (
            <div className="h-full min-h-[260px] bg-white border border-[#E2E8F0] rounded-xl flex flex-col items-center justify-center p-8 text-center">
              <MaterialIcon name="inventory_2" className="text-[40px] text-[#94A3B8] mb-2" />
              <div className="text-base font-semibold text-[#0F172A]">
                Không tìm thấy sản phẩm phù hợp
              </div>
              <p className="text-sm text-[#64748B] mt-1">
                Thử xóa từ khóa tìm kiếm hoặc chọn danh mục khác.
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveCategoryId('ALL');
                  }}
                  className="mt-4 h-11 px-4 rounded-xl bg-[#0F766E] text-white text-sm font-semibold"
                >
                  Hiển thị toàn bộ thực đơn
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 pb-2">
              {filteredProducts.map((product) => {
                const outOfStock = product.stock <= 0;
                const inCartQty = cartQtyByProduct[product.id] || 0;
                const imgBroken = failedImages[product.id];

                return (
                  <button
                    key={product.id}
                    type="button"
                    disabled={outOfStock}
                    onClick={() => onAddToCart(product)}
                    className={`group relative text-left bg-white border rounded-xl overflow-hidden flex flex-col justify-between transition-all min-h-[205px] shadow-[0_1px_3px_0_rgba(15,23,42,0.05)] ${
                      outOfStock
                        ? 'opacity-40 cursor-not-allowed border-[#E2E8F0]'
                        : inCartQty > 0
                        ? 'border-[#0F766E] ring-1 ring-[#0F766E]/25 active:scale-[0.98]'
                        : 'border-[#E2E8F0] hover:border-[#0F766E]/50 active:scale-[0.98]'
                    }`}
                  >
                    {/* Product 4:3 Image */}
                    <div className="relative aspect-[4/3] w-full bg-[#F1F5F9] overflow-hidden">
                      {!imgBroken && product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setFailedImages((prev) => ({ ...prev, [product.id]: true }))
                          }
                          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-[#64748B] bg-gradient-to-br from-[#F1F5F9] to-[#E2E8F0]">
                          <MaterialIcon name="local_cafe" className="text-[32px]" />
                        </div>
                      )}

                      {outOfStock && (
                        <div className="absolute inset-0 bg-[#0F172A]/45 flex items-center justify-center">
                          <span className="px-3 py-1 rounded-lg bg-white text-[#0F172A] text-xs font-bold">
                            Hết hàng
                          </span>
                        </div>
                      )}

                      {inCartQty > 0 && !outOfStock && (
                        <div className="absolute top-2 right-2 min-w-[28px] h-7 px-2 rounded-lg bg-[#0F766E] text-white text-xs font-bold tabular-nums-strict flex items-center justify-center shadow-xs">
                          {inCartQty}
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                      <div>
                        <h3 className="text-[15px] font-semibold text-[#0F172A] leading-snug line-clamp-2">
                          {product.name}
                        </h3>
                        <div className="text-xs text-[#64748B] mt-1 tabular-nums-strict">
                          <span className="font-mono">{product.sku}</span>
                          <span className="mx-1.5" aria-hidden="true">
                            ·
                          </span>
                          <span>Còn {product.stock}</span>
                        </div>
                      </div>

                      <div className="flex items-baseline justify-end gap-2 pt-1">
                        {product.mrp > product.price && (
                          <span className="text-xs text-[#64748B] line-through tabular-nums-strict">
                            {formatVND(product.mrp)}
                          </span>
                        )}
                        <span className="text-base font-bold text-[#0F766E] tabular-nums-strict">
                          {formatVND(product.price)}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* RIGHT PANE: Cart & Settlement Ledger (Fixed 35%-40%, min 420px on lg) */}
      <aside className="w-full lg:w-[420px] xl:w-[450px] shrink-0 bg-white border-t lg:border-t-0 lg:border-l border-[#E2E8F0] flex flex-col min-h-0">
        {/* Customer Selector & Held Orders Bar */}
        <div className="p-3.5 border-b border-[#E2E8F0] flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowCustomerModal(true)}
            className="flex-1 min-w-0 h-12 px-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] flex items-center justify-between gap-2 text-left transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <MaterialIcon
                name="person"
                className="text-[20px] text-[#0F766E] shrink-0"
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[#0F172A] truncate">
                  {selectedCustomer ? selectedCustomer.name : 'Khách lẻ'}
                </div>
                <div className="text-[11px] text-[#64748B] truncate tabular-nums-strict">
                  {selectedCustomer
                    ? `${selectedCustomer.phone} · ${selectedCustomer.points} điểm`
                    : 'Chạm để chọn / thêm khách hàng'}
                </div>
              </div>
            </div>
            <MaterialIcon
              name="chevron_right"
              className="text-[18px] text-[#64748B] shrink-0"
            />
          </button>

          {heldOrders.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHeldModal(true)}
              className="h-12 px-3 rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#855300] text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1.5 hover:bg-[#F59E0B]/20"
            >
              <MaterialIcon name="pause_circle" className="text-[18px]" />
              <span>Đơn giữ ({heldOrders.length})</span>
            </button>
          )}
        </div>

        {/* Cart Toolbar */}
        <div className="px-4 py-2.5 border-b border-[#E2E8F0] flex items-center justify-between text-xs text-[#64748B] shrink-0">
          <span className="font-semibold text-[#0F172A] tabular-nums-strict">
            Đơn hàng hiện tại ({totalItemsCount} món)
          </span>
          <div className="flex items-center gap-3">
            {cart.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={onHoldCurrentOrder}
                  className="font-semibold text-[#855300] hover:underline whitespace-nowrap"
                >
                  Giữ đơn
                </button>
                <button
                  type="button"
                  onClick={onClearCart}
                  className="font-semibold text-[#DC2626] hover:underline whitespace-nowrap"
                >
                  Xóa hết
                </button>
              </>
            )}
          </div>
        </div>

        {/* Scrollable Ticket Item List */}
        <div className="flex-1 min-h-0 overflow-y-auto pos-scroll divide-y divide-[#E2E8F0]">
          {cart.length === 0 ? (
            <div className="h-full min-h-[220px] flex flex-col items-center justify-center p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#F1F5F9] text-[#94A3B8] flex items-center justify-center mb-3">
                <MaterialIcon name="shopping_bag" className="text-[28px]" />
              </div>
              <div className="text-sm font-semibold text-[#0F172A]">
                Chưa có sản phẩm trong đơn
              </div>
              <p className="text-xs text-[#64748B] mt-1 max-w-[240px]">
                Chạm vào món bên trái hoặc quét mã SKU để bắt đầu tính tiền.
              </p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.lineId}
                className="px-3.5 py-3 min-h-[60px] flex items-center justify-between gap-2.5 hover:bg-[#F8FAFC] transition-colors"
              >
                {/* Quantity Steppers */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onUpdateQty(item.lineId, -1)}
                    aria-label={`Giảm số lượng ${item.name}`}
                    className="w-9 h-9 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] active:bg-[#E2E8F0] flex items-center justify-center text-[#0F172A]"
                  >
                    <MaterialIcon name="remove" className="text-[18px]" />
                  </button>
                  <span className="w-7 text-center text-sm font-bold text-[#0F172A] tabular-nums-strict">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdateQty(item.lineId, 1)}
                    aria-label={`Tăng số lượng ${item.name}`}
                    className="w-9 h-9 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] active:bg-[#E2E8F0] flex items-center justify-center text-[#0F172A]"
                  >
                    <MaterialIcon name="add" className="text-[18px]" />
                  </button>
                </div>

                {/* Title & Modifier Note */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#0F172A] truncate">
                    {item.name}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-[#64748B] tabular-nums-strict">
                      {formatVND(item.unitPrice)}
                    </span>
                    <button
                      type="button"
                      onClick={() => openNoteEditor(item)}
                      className="text-xs font-medium text-[#0F766E] hover:underline truncate flex items-center gap-0.5"
                    >
                      <MaterialIcon name="edit_note" className="text-[15px]" />
                      <span className="truncate">
                        {item.note ? item.note : 'Ghi chú'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Line Total & Delete */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[15px] font-bold text-[#0F172A] tabular-nums-strict">
                    {formatVND(item.unitPrice * item.quantity)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveLine(item.lineId)}
                    aria-label={`Xóa ${item.name}`}
                    className="w-9 h-9 rounded-lg text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEF2F2] flex items-center justify-center transition-colors"
                  >
                    <MaterialIcon name="delete_outline" className="text-[19px]" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pinned Receipt Summary & 64px Checkout Action Pad */}
        <div className="p-4 bg-white border-t border-[#E2E8F0] shadow-[0_-4px_12px_0_rgba(15,23,42,0.06)] space-y-3 shrink-0">
          {showDiscountBar && (
            <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#64748B] whitespace-nowrap">
                Chiết khấu:
              </span>
              <div className="flex items-center gap-1.5">
                {DISCOUNT_PRESETS.map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => onChangeDiscountPercent(pct)}
                    className={`h-8 px-2.5 rounded-lg text-xs font-semibold tabular-nums-strict transition-colors ${
                      discountPercent === pct
                        ? 'bg-[#0F766E] text-white'
                        : 'bg-white border border-[#E2E8F0] text-[#0F172A] hover:bg-[#F1F5F9]'
                    }`}
                  >
                    {pct === 0 ? 'Không' : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between text-[#64748B]">
              <span>Tạm tính</span>
              <span className="font-semibold text-[#0F172A] tabular-nums-strict">
                {formatVND(subtotal)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowDiscountBar((v) => !v)}
                className="text-[#0F766E] font-semibold text-xs flex items-center gap-1 hover:underline"
              >
                <MaterialIcon name="sell" className="text-[16px]" />
                <span>
                  {discountPercent > 0
                    ? `Giảm giá (${discountPercent}%)`
                    : 'Áp dụng giảm giá'}
                </span>
              </button>
              <span
                className={`font-semibold tabular-nums-strict ${
                  discountAmount > 0 ? 'text-[#16A34A]' : 'text-[#64748B]'
                }`}
              >
                {discountAmount > 0 ? `-${formatVND(discountAmount)}` : '0 ₫'}
              </span>
            </div>

            <div className="flex items-baseline justify-between pt-2 border-t border-[#E2E8F0]">
              <span className="text-base font-bold text-[#0F172A]">Tổng cộng</span>
              <span className="text-[26px] leading-none font-bold text-[#0F172A] tabular-nums-strict">
                {formatVND(grandTotal)}
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={cart.length === 0}
            onClick={onOpenCheckout}
            className="w-full h-16 rounded-xl bg-[#16A34A] hover:bg-[#15803D] active:scale-[0.99] text-white font-bold text-base transition-all flex items-center justify-between px-5 disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <span className="flex items-center gap-2">
              <MaterialIcon name="payments" className="text-[24px]" />
              <span>Thanh toán</span>
            </span>
            <span className="text-lg tabular-nums-strict">
              {formatVND(grandTotal)}
            </span>
          </button>
        </div>
      </aside>

      {/* Item Modifier / Note Modal */}
      {editingNoteLine && (
        <div
          className="fixed inset-0 z-50 bg-[#0F172A]/45 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white rounded-2xl border border-[#E2E8F0] p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">
                  Tùy chỉnh món
                </h3>
                <div className="text-xs text-[#64748B]">
                  {editingNoteLine.name}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingNoteLine(null)}
                className="w-10 h-10 rounded-xl border border-[#E2E8F0] flex items-center justify-center"
              >
                <MaterialIcon name="close" className="text-[20px]" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {MODIFIER_PRESETS.map((preset) => {
                const active = noteDraft
                  .split(',')
                  .map((s) => s.trim())
                  .includes(preset);
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => toggleModifierPreset(preset)}
                    className={`h-10 px-3.5 rounded-xl text-xs font-semibold border transition-colors ${
                      active
                        ? 'bg-[#0F766E] border-[#0F766E] text-white'
                        : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#0F172A] hover:bg-[#F1F5F9]'
                    }`}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>

            <input
              type="text"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Hoặc nhập ghi chú riêng (VD: Ít đá, để riêng sữa)..."
              className="w-full h-12 px-3.5 rounded-xl border border-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
            />

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setNoteDraft('')}
                className="h-12 px-4 rounded-xl border border-[#E2E8F0] text-sm font-semibold text-[#64748B]"
              >
                Xóa ghi chú
              </button>
              <button
                type="button"
                onClick={saveNote}
                className="flex-1 h-12 rounded-xl bg-[#0F766E] text-white text-sm font-bold"
              >
                Lưu ghi chú
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Picker Modal */}
      {showCustomerModal && (
        <div
          className="fixed inset-0 z-50 bg-[#0F172A]/45 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-xl flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <h3 className="text-base font-bold text-[#0F172A]">
                Chọn khách hàng
              </h3>
              <button
                type="button"
                onClick={() => setShowCustomerModal(false)}
                className="w-10 h-10 rounded-xl border border-[#E2E8F0] flex items-center justify-center"
              >
                <MaterialIcon name="close" className="text-[20px]" />
              </button>
            </div>

            <div className="p-4 space-y-3 border-b border-[#E2E8F0]">
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Tìm theo tên hoặc số điện thoại..."
                className="w-full h-12 px-3.5 rounded-xl border border-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
              />
              <button
                type="button"
                onClick={() => {
                  onSelectCustomer(null);
                  setShowCustomerModal(false);
                }}
                className="w-full h-12 px-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-left text-sm font-semibold text-[#0F172A] flex items-center justify-between"
              >
                <span>Khách lẻ (Không tích điểm)</span>
                {!selectedCustomer && (
                  <MaterialIcon name="check" className="text-[20px] text-[#0F766E]" />
                )}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#E2E8F0] pos-scroll">
              {filteredCustomers.map((c) => {
                const isSelected = selectedCustomer?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onSelectCustomer(c);
                      setShowCustomerModal(false);
                    }}
                    className={`w-full px-5 py-3.5 text-left flex items-center justify-between hover:bg-[#F8FAFC] ${
                      isSelected ? 'bg-[#0F766E]/5' : ''
                    }`}
                  >
                    <div>
                      <div className="text-sm font-semibold text-[#0F172A]">
                        {c.name}
                      </div>
                      <div className="text-xs text-[#64748B] tabular-nums-strict">
                        {c.phone} · {c.points} điểm · {c.visitCount} lần mua
                      </div>
                    </div>
                    {isSelected && (
                      <MaterialIcon name="check_circle" className="text-[20px] text-[#0F766E]" />
                    )}
                  </button>
                );
              })}
            </div>

            <form
              onSubmit={handleCreateCustomer}
              className="p-4 bg-[#F8FAFC] border-t border-[#E2E8F0] space-y-2.5"
            >
              <div className="text-xs font-bold text-[#0F172A]">
                Thêm nhanh khách hàng mới
              </div>
              {custError && (
                <div className="text-xs text-[#DC2626]">{custError}</div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="Họ tên khách hàng"
                  className="h-11 px-3 rounded-xl border border-[#CBD5E1] bg-white text-sm"
                />
                <input
                  type="tel"
                  required
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="Số điện thoại"
                  className="h-11 px-3 rounded-xl border border-[#CBD5E1] bg-white text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={creatingCustomer}
                className="w-full h-11 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#115E59] disabled:opacity-50"
              >
                {creatingCustomer ? 'Đang lưu...' : 'Lưu & Chọn khách hàng'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Held Orders Modal */}
      {showHeldModal && (
        <div
          className="fixed inset-0 z-50 bg-[#0F172A]/45 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <h3 className="text-base font-bold text-[#0F172A]">
                Đơn hàng đang tạm giữ
              </h3>
              <button
                type="button"
                onClick={() => setShowHeldModal(false)}
                className="w-10 h-10 rounded-xl border border-[#E2E8F0] flex items-center justify-center"
              >
                <MaterialIcon name="close" className="text-[20px]" />
              </button>
            </div>
            <div className="divide-y divide-[#E2E8F0] max-h-[60vh] overflow-y-auto">
              {heldOrders.map((held) => {
                const total = held.items.reduce(
                  (s, i) => s + i.unitPrice * i.quantity,
                  0
                );
                return (
                  <button
                    key={held.id}
                    type="button"
                    onClick={() => {
                      onRestoreHeldOrder(held.id);
                      setShowHeldModal(false);
                    }}
                    className="w-full p-4 text-left hover:bg-[#F8FAFC] flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-sm font-semibold text-[#0F172A]">
                        {held.label}
                      </div>
                      <div className="text-xs text-[#64748B] tabular-nums-strict">
                        {held.items.reduce((s, i) => s + i.quantity, 0)} món ·{' '}
                        {formatTimeVN(held.createdAt)}
                      </div>
                    </div>
                    <span className="text-sm font-bold text-[#0F766E] tabular-nums-strict">
                      {formatVND(total)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
