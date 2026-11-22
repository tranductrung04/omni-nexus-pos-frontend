import { useCallback, useEffect, useState } from 'react';
import { api, getStoredToken, setStoredToken } from './api';
import { AdminStoresView } from './components/AdminStoresView';
import { AuthScreen } from './components/AuthScreen';
import { BranchesView } from './components/BranchesView';
import { CategoriesView } from './components/CategoriesView';
import { CustomersView } from './components/CustomersView';
import { EmployeesView } from './components/EmployeesView';
import { InventoryView } from './components/InventoryView';
import { MaterialIcon } from './components/MaterialIcon';
import { OrdersAndRefundsView } from './components/OrdersAndRefundsView';
import { OrdersManagementView } from './components/OrdersManagementView';
import { PaymentModal } from './components/PaymentModal';
import { PosTerminalScreen } from './components/PosTerminalScreen';
import { ProductsView } from './components/ProductsView';
import { ProfileModal } from './components/ProfileModal';
import { ReceiptModal } from './components/ReceiptModal';
import { RefundsManagementView } from './components/RefundsManagementView';
import { ShiftCloseAndSummaryView } from './components/ShiftCloseAndSummaryView';
import { ShiftReportsView } from './components/ShiftReportsView';
import { StartShiftScreen } from './components/StartShiftScreen';
import type {
  Branch,
  CartItem,
  Category,
  Customer,
  HeldOrder,
  Order,
  PaymentMethod,
  Product,
  Refund,
  SessionPayload,
  Shift,
  Store,
  User,
} from './types';
import { roleLabelVN } from './utils/format';

type ActiveTab =
  | 'pos'
  | 'products'
  | 'inventory'
  | 'categories'
  | 'orders-admin'
  | 'refunds'
  | 'shift-reports'
  | 'branches'
  | 'employees'
  | 'customers'
  | 'orders'
  | 'shift'
  | 'stores';

export default function App() {
  const [bootstrapping, setBootstrapping] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);

  // Navigation & View State
  const [activeTab, setActiveTab] = useState<ActiveTab>('pos');
  const [showStartShiftForce, setShowStartShiftForce] = useState(false);
  const [productsCategoryFilter, setProductsCategoryFilter] =
    useState<string>('ALL');
  const [jumpToOrderId, setJumpToOrderId] = useState<string | null>(null);
  const clearJumpToOrder = useCallback(() => setJumpToOrderId(null), []);

  // Catalog & Operations Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [shiftHistory, setShiftHistory] = useState<Shift[]>([]);

  // Active Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);

  // Modals
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [receiptModalState, setReceiptModalState] = useState<{
    order: Order;
    isAfterCheckout: boolean;
  } | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const loadWorkspaceData = useCallback(
    async (resolvedStoreId: string, resolvedBranchId: string) => {
      try {
        const [catalogRes, custList, orderList, refundList, shiftList] =
          await Promise.all([
            api.getCatalog(resolvedStoreId, resolvedBranchId),
            api.getCustomers(resolvedStoreId),
            api.getOrders({ branchId: resolvedBranchId }),
            api.getRefunds({ branchId: resolvedBranchId }),
            api.getShifts({ branchId: resolvedBranchId }),
          ]);
        setCategories(catalogRes.categories);
        setProducts(catalogRes.products);
        setCustomers(custList);
        setOrders(orderList);
        setRefunds(refundList);
        setShiftHistory(shiftList);
      } catch (err) {
        console.error('Failed to load POS workspace data:', err);
      }
    },
    []
  );

  const refreshCatalog = useCallback(async () => {
    const resolvedStoreId = user?.storeId || store?.id || 'store-1';
    const resolvedBranchId = user?.branchId || branch?.id || 'branch-1';
    try {
      const catalogRes = await api.getCatalog(resolvedStoreId, resolvedBranchId);
      setCategories(catalogRes.categories);
      setProducts(catalogRes.products);
    } catch (err) {
      console.error('Failed to refresh POS catalog:', err);
    }
  }, [user?.storeId, user?.branchId, store?.id, branch?.id]);

  const refreshCustomers = useCallback(async () => {
    const resolvedStoreId = user?.storeId || store?.id || 'store-1';
    try {
      const custList = await api.getCustomers(resolvedStoreId);
      setCustomers(custList);
      setSelectedCustomer((prev) => {
        if (!prev) return null;
        return custList.find((c) => c.id === prev.id) || null;
      });
    } catch (err) {
      console.error('Failed to refresh customers:', err);
    }
  }, [user?.storeId, store?.id]);

  // Restore session on mount
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setBootstrapping(false);
      return;
    }

    api
      .getSession()
      .then((res) => {
        setUser(res.user);
        setStore(res.store);
        setBranch(res.branch);
        setActiveShift(res.activeShift);
        if (res.user.role === 'ADMIN') {
          setActiveTab('stores');
        } else if (
          res.user.role === 'STORE_ADMIN' ||
          res.user.role === 'STORE_MANAGER'
        ) {
          setActiveTab('products');
        } else {
          setActiveTab('pos');
        }
        if (res.user.storeId || res.user.branchId) {
          return loadWorkspaceData(
            res.user.storeId || 'store-1',
            res.user.branchId || 'branch-1'
          );
        }
      })
      .catch(() => {
        setStoredToken(null);
      })
      .finally(() => setBootstrapping(false));
  }, [loadWorkspaceData]);

  const handleAuthSuccess = async (session: SessionPayload) => {
    setStoredToken(session.token);
    setUser(session.user);
    setStore(session.store);
    setBranch(session.branch);
    setActiveShift(session.activeShift);
    setShowStartShiftForce(false);

    if (session.user.role === 'ADMIN') {
      setActiveTab('stores');
    } else if (
      session.user.role === 'STORE_ADMIN' ||
      session.user.role === 'STORE_MANAGER'
    ) {
      setActiveTab('products');
    } else {
      setActiveTab('pos');
    }

    await loadWorkspaceData(
      session.user.storeId || 'store-1',
      session.user.branchId || 'branch-1'
    );
  };

  const handleLogout = () => {
    setStoredToken(null);
    setUser(null);
    setStore(null);
    setBranch(null);
    setActiveShift(null);
    setCart([]);
    setSelectedCustomer(null);
    setDiscountPercent(0);
    setHeldOrders([]);
    setShowStartShiftForce(false);
  };

  // Cart Actions
  const handleAddToCart = (product: Product) => {
    if (product.stock <= 0) return;
    setCart((prev) => {
      const existing = prev.find(
        (item) => item.productId === product.id && item.note === ''
      );
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((item) =>
          item.lineId === existing.lineId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          lineId: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          productId: product.id,
          name: product.name,
          sku: product.sku,
          unitPrice: product.price,
          quantity: 1,
          note: '',
        },
      ];
    });
  };

  const handleUpdateQty = (lineId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.lineId !== lineId) return item;
          const prod = products.find((p) => p.id === item.productId);
          const maxStock = prod ? prod.stock : 999;
          const nextQty = Math.min(maxStock, item.quantity + delta);
          return { ...item, quantity: nextQty };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const handleUpdateNote = (lineId: string, note: string) => {
    setCart((prev) =>
      prev.map((item) => (item.lineId === lineId ? { ...item, note } : item))
    );
  };

  const handleRemoveLine = (lineId: string) => {
    setCart((prev) => prev.filter((item) => item.lineId !== lineId));
  };

  const handleClearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setDiscountPercent(0);
  };

  const handleHoldCurrentOrder = () => {
    if (cart.length === 0) return;
    const held: HeldOrder = {
      id: `held-${Date.now()}`,
      label: selectedCustomer
        ? selectedCustomer.name
        : `Đơn tạm #${heldOrders.length + 1}`,
      customer: selectedCustomer,
      items: cart,
      discountPercent,
      createdAt: new Date().toISOString(),
    };
    setHeldOrders((prev) => [held, ...prev]);
    handleClearCart();
  };

  const handleRestoreHeldOrder = (heldId: string) => {
    const target = heldOrders.find((h) => h.id === heldId);
    if (!target) return;
    if (cart.length > 0) {
      handleHoldCurrentOrder();
    }
    setCart(target.items);
    setSelectedCustomer(target.customer);
    setDiscountPercent(target.discountPercent);
    setHeldOrders((prev) => prev.filter((h) => h.id !== heldId));
  };

  // Checkout & Payment
  const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const discountAmount = Math.round((subtotal * discountPercent) / 100);
  const grandTotal = Math.max(0, subtotal - discountAmount);
  const totalItemsCount = cart.reduce((s, i) => s + i.quantity, 0);

  const handleConfirmPayment = async (payload: {
    paymentMethod: PaymentMethod;
    cashTendered: number;
    paymentRef: string;
  }) => {
    if (!activeShift) return;
    setCheckoutError(null);
    setSubmittingOrder(true);
    try {
      const res = await api.createOrder({
        storeId: store?.id || 'store-1',
        branchId: branch?.id || 'branch-1',
        shiftId: activeShift.id,
        customerId: selectedCustomer?.id || null,
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          note: item.note,
        })),
        discountAmount,
        discountLabel: discountPercent > 0 ? `${discountPercent}%` : '',
        paymentMethod: payload.paymentMethod,
        cashTendered: payload.cashTendered,
        paymentRef: payload.paymentRef,
      });

      setOrders((prev) => [res.order, ...prev]);
      setActiveShift(res.shift);
      setShiftHistory((prev) => {
        const exists = prev.some((s) => s.id === res.shift.id);
        return exists
          ? prev.map((s) => (s.id === res.shift.id ? res.shift : s))
          : [res.shift, ...prev];
      });

      // Refresh catalog stock + customer points
      const [catalogRes, custList] = await Promise.all([
        api.getCatalog(store?.id || 'store-1', branch?.id || 'branch-1'),
        api.getCustomers(store?.id || 'store-1'),
      ]);
      setProducts(catalogRes.products);
      setCustomers(custList);

      setShowPaymentModal(false);
      handleClearCart();
      setReceiptModalState({ order: res.order, isAfterCheckout: true });
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : 'Không thể hoàn tất thanh toán.'
      );
    } finally {
      setSubmittingOrder(false);
    }
  };

  if (bootstrapping) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-sm font-semibold text-[#64748B]">
          Đang khôi phục phiên làm việc Omni Nexus POS...
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onSuccess={handleAuthSuccess} />;
  }

  // If user needs to start a shift before using POS (and isn't inspecting closed shift summary or store admin view)
  const needsStartShift =
    user.role !== 'ADMIN' &&
    !activeShift &&
    (showStartShiftForce || activeTab === 'pos');

  if (needsStartShift) {
    return (
      <StartShiftScreen
        user={user}
        store={store}
        branch={branch}
        onShiftOpened={(openedShift) => {
          setActiveShift(openedShift);
          setShiftHistory((prev) => [openedShift, ...prev]);
          setShowStartShiftForce(false);
          setActiveTab('pos');
        }}
        onLogout={handleLogout}
      />
    );
  }

  const isManagerOrOwner =
    user.role === 'STORE_ADMIN' ||
    user.role === 'STORE_MANAGER' ||
    user.role === 'BRANCH_MANAGER';

  const canManageCatalog =
    user.role === 'STORE_ADMIN' || user.role === 'STORE_MANAGER';

  const backOfficeTabs: Array<{
    id: ActiveTab;
    label: string;
    icon: string;
  }> = [
    { id: 'products', label: 'Sản phẩm', icon: 'grid_view' },
    { id: 'inventory', label: 'Tồn kho', icon: 'inventory_2' },
    { id: 'categories', label: 'Danh mục', icon: 'category' },
    { id: 'orders-admin', label: 'Đơn hàng', icon: 'receipt_long' },
    { id: 'refunds', label: 'Hoàn tiền', icon: 'assignment_return' },
    { id: 'shift-reports', label: 'Báo cáo ca', icon: 'summarize' },
    { id: 'branches', label: 'Chi nhánh', icon: 'store' },
    { id: 'employees', label: 'Nhân viên', icon: 'badge' },
    { id: 'customers', label: 'Khách hàng', icon: 'group' },
    { id: 'stores', label: 'Cửa hàng', icon: 'storefront' },
  ];

  const isInBackOffice =
    isManagerOrOwner &&
    backOfficeTabs.some((t) => t.id === activeTab);

  const primaryNavItems: Array<{
    id: string;
    label: string;
    icon: string;
    active: boolean;
    onClick: () => void;
    show: boolean;
  }> = [
    {
      id: 'pos',
      label: 'Bán hàng',
      icon: 'point_of_sale',
      active: activeTab === 'pos',
      onClick: () => {
        if (!activeShift) {
          setShowStartShiftForce(true);
        } else {
          setActiveTab('pos');
        }
      },
      show: user.role !== 'ADMIN',
    },
    {
      id: 'orders',
      label: 'Đơn hôm nay',
      icon: 'receipt_long',
      active: activeTab === 'orders',
      onClick: () => setActiveTab('orders'),
      show: user.role !== 'ADMIN',
    },
    {
      id: 'shift',
      label: activeShift ? 'Kết thúc ca' : 'Báo cáo ca',
      icon: 'summarize',
      active: activeTab === 'shift',
      onClick: () => setActiveTab('shift'),
      show: user.role !== 'ADMIN',
    },
    {
      id: 'cashier-customers',
      label: 'Khách hàng',
      icon: 'group',
      active: activeTab === 'customers',
      onClick: () => setActiveTab('customers'),
      show: user.role === 'BRANCH_CASHIER',
    },
    {
      id: 'backoffice',
      label: 'Quản lý chuỗi',
      icon: 'dashboard',
      active: isInBackOffice,
      onClick: () => {
        if (!isInBackOffice) {
          setActiveTab('products');
        }
      },
      show: isManagerOrOwner,
    },
    {
      id: 'admin-stores',
      label: 'Duyệt cửa hàng',
      icon: 'storefront',
      active: activeTab === 'stores',
      onClick: () => setActiveTab('stores'),
      show: user.role === 'ADMIN',
    },
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#F8FAFC]">
      {/* TOP UTILITY BAR (Fixed 56px height, crisp 3-zone layout) */}
      <header className="h-14 bg-white border-b border-[#E2E8F0] px-4 lg:px-5 flex items-center justify-between gap-3 shrink-0">
        {/* Zone 1: Brand + Active Branch/Shift Context */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#0F766E] flex items-center justify-center shrink-0">
            <MaterialIcon name="point_of_sale" className="text-[20px] text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-[#0F172A] whitespace-nowrap leading-tight">
              Omni Nexus POS
            </div>
            <div className="text-[11px] text-[#64748B] truncate whitespace-nowrap">
              {branch ? branch.code : store ? store.brandCode : 'Hệ thống'}
              {activeShift ? ` · ${activeShift.shiftCode} (${activeShift.registerName})` : ''}
            </div>
          </div>
        </div>

        {/* Zone 2: Primary Navigation Tabs */}
        <nav className="flex items-center gap-1.5">
          {primaryNavItems
            .filter((item) => item.show)
            .map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className={`h-9 px-3 lg:px-3.5 rounded-xl text-[13px] font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  item.active
                    ? 'bg-[#0F766E] text-white'
                    : 'text-[#0F172A] hover:bg-[#F1F5F9]'
                }`}
              >
                <MaterialIcon name={item.icon} className="text-[18px]" />
                <span>{item.label}</span>
              </button>
            ))}
        </nav>

        {/* Zone 3: Cashier Profile + Logout */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowProfileModal(true)}
            className="h-10 px-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] flex items-center gap-2 text-left whitespace-nowrap shrink-0"
          >
            <MaterialIcon
              name="account_circle"
              className="text-[20px] text-[#0F766E]"
            />
            <div className="hidden md:block leading-tight">
              <div className="text-xs font-bold text-[#0F172A]">{user.name}</div>
              <div className="text-[10px] text-[#64748B]">
                {roleLabelVN(user.role)}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            aria-label="Đăng xuất"
            title="Đăng xuất"
            className="h-10 w-10 sm:w-auto sm:px-3 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#FEF2F2] hover:border-[#FECACA] hover:text-[#DC2626] text-[#64748B] flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors shrink-0"
          >
            <MaterialIcon name="logout" className="text-[19px]" />
            <span className="hidden sm:inline whitespace-nowrap">Đăng xuất</span>
          </button>
        </div>
      </header>

      {/* BACK-OFFICE SUB-NAVIGATION BAR (Visible when in management modules) */}
      {isInBackOffice && (
        <div className="h-11 bg-[#F8FAFC] border-b border-[#E2E8F0] px-4 lg:px-6 flex items-center gap-1 overflow-x-auto shrink-0">
          {backOfficeTabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`h-8 px-2.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-white border border-[#CBD5E1] text-[#0F766E]'
                    : 'text-[#64748B] hover:text-[#0F172A] hover:bg-white/60'
                }`}
              >
                <MaterialIcon name={tab.icon} className="text-[16px]" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Checkout Error Banner if any */}
      {checkoutError && (
        <div className="px-6 py-2.5 bg-[#FEF2F2] border-b border-[#FECACA] text-[#DC2626] text-sm flex items-center justify-between">
          <span>{checkoutError}</span>
          <button
            type="button"
            onClick={() => setCheckoutError(null)}
            className="text-xs font-bold underline"
          >
            Đóng
          </button>
        </div>
      )}

      {/* MAIN VIEWPORT */}
      {activeTab === 'pos' && (
        <PosTerminalScreen
          storeId={store?.id || 'store-1'}
          categories={categories}
          products={products}
          customers={customers}
          cart={cart}
          selectedCustomer={selectedCustomer}
          discountPercent={discountPercent}
          heldOrders={heldOrders}
          onAddToCart={handleAddToCart}
          onUpdateQty={handleUpdateQty}
          onUpdateNote={handleUpdateNote}
          onRemoveLine={handleRemoveLine}
          onClearCart={handleClearCart}
          onSelectCustomer={setSelectedCustomer}
          onCustomerCreated={(cust) => setCustomers((prev) => [cust, ...prev])}
          onChangeDiscountPercent={setDiscountPercent}
          onHoldCurrentOrder={handleHoldCurrentOrder}
          onRestoreHeldOrder={handleRestoreHeldOrder}
          onOpenCheckout={() => setShowPaymentModal(true)}
        />
      )}

      {activeTab === 'orders' && (
        <OrdersAndRefundsView
          orders={orders}
          refunds={refunds}
          activeShift={activeShift}
          onViewReceipt={(order) =>
            setReceiptModalState({ order, isAfterCheckout: false })
          }
          onRefundCreated={(updatedOrder, newRefund, updatedShift) => {
            setOrders((prev) =>
              prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
            );
            setRefunds((prev) => [newRefund, ...prev]);
            if (updatedShift) {
              if (activeShift?.id === updatedShift.id) {
                setActiveShift(updatedShift);
              }
              setShiftHistory((prev) =>
                prev.map((s) => (s.id === updatedShift.id ? updatedShift : s))
              );
            }
          }}
        />
      )}

      {activeTab === 'shift' && (
        <ShiftCloseAndSummaryView
          activeShift={activeShift}
          shiftHistory={shiftHistory}
          onShiftClosed={(closedShift) => {
            setActiveShift(null);
            setShiftHistory((prev) =>
              prev.map((s) => (s.id === closedShift.id ? closedShift : s))
            );
          }}
          onStartNewShift={() => setShowStartShiftForce(true)}
          onViewOrderReceipt={(order) =>
            setReceiptModalState({ order, isAfterCheckout: false })
          }
        />
      )}

      {activeTab === 'products' && isManagerOrOwner && (
        <ProductsView
          storeId={store?.id || 'store-1'}
          canManage={canManageCatalog}
          initialCategoryFilter={productsCategoryFilter}
          onCatalogChanged={refreshCatalog}
        />
      )}

      {activeTab === 'inventory' && isManagerOrOwner && (
        <InventoryView
          user={user}
          storeId={store?.id || 'store-1'}
          activeBranchId={branch?.id || 'branch-1'}
          onCatalogChanged={refreshCatalog}
        />
      )}

      {activeTab === 'categories' && isManagerOrOwner && (
        <CategoriesView
          storeId={store?.id || 'store-1'}
          canManage={canManageCatalog}
          onCatalogChanged={refreshCatalog}
          onGoToProducts={(categoryId) => {
            setProductsCategoryFilter(categoryId);
            setActiveTab('products');
          }}
        />
      )}

      {activeTab === 'orders-admin' && isManagerOrOwner && (
        <OrdersManagementView
          user={user}
          storeId={store?.id || 'store-1'}
          activeShift={activeShift}
          initialSelectedOrderId={jumpToOrderId}
          onClearInitialOrder={clearJumpToOrder}
          onViewReceipt={(order) =>
            setReceiptModalState({ order, isAfterCheckout: false })
          }
          onNavigateToCustomer={() => setActiveTab('customers')}
          onRefundCreated={(updatedOrder, newRefund, updatedShift) => {
            setOrders((prev) =>
              prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
            );
            setRefunds((prev) => [newRefund, ...prev]);
            if (updatedShift) {
              if (activeShift?.id === updatedShift.id) {
                setActiveShift(updatedShift);
              }
              setShiftHistory((prev) =>
                prev.map((s) => (s.id === updatedShift.id ? updatedShift : s))
              );
            }
          }}
        />
      )}

      {activeTab === 'refunds' && isManagerOrOwner && (
        <RefundsManagementView
          user={user}
          storeId={store?.id || 'store-1'}
          onOpenOrderDetail={(orderId) => {
            setJumpToOrderId(orderId);
            setActiveTab('orders-admin');
          }}
        />
      )}

      {activeTab === 'shift-reports' && isManagerOrOwner && (
        <ShiftReportsView
          user={user}
          storeId={store?.id || 'store-1'}
          onViewOrderReceipt={(order) =>
            setReceiptModalState({ order, isAfterCheckout: false })
          }
          onOpenOrderDetail={(orderId) => {
            setJumpToOrderId(orderId);
            setActiveTab('orders-admin');
          }}
        />
      )}

      {activeTab === 'branches' && isManagerOrOwner && (
        <BranchesView
          storeId={store?.id || 'store-1'}
          canManage={canManageCatalog}
          onBranchUpdated={(updated) => {
            if (branch?.id === updated.id) {
              setBranch(updated);
            }
          }}
        />
      )}

      {activeTab === 'employees' && isManagerOrOwner && (
        <EmployeesView
          currentUser={user}
          storeId={store?.id || 'store-1'}
        />
      )}

      {activeTab === 'customers' && user.role !== 'ADMIN' && (
        <CustomersView
          storeId={store?.id || 'store-1'}
          onCustomersChanged={refreshCustomers}
          onViewOrderReceipt={(order) =>
            setReceiptModalState({ order, isAfterCheckout: false })
          }
        />
      )}

      {activeTab === 'stores' && (
        <AdminStoresView
          user={user}
          onOpenPosFlow={() => {
            if (!activeShift) {
              setShowStartShiftForce(true);
            } else {
              setActiveTab('pos');
            }
          }}
        />
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentModal
          totalAmount={grandTotal}
          itemCount={totalItemsCount}
          customer={selectedCustomer}
          submitting={submittingOrder}
          onClose={() => setShowPaymentModal(false)}
          onConfirm={handleConfirmPayment}
        />
      )}

      {/* Receipt Modal */}
      {receiptModalState && (
        <ReceiptModal
          order={receiptModalState.order}
          store={store}
          branch={branch}
          isAfterCheckout={receiptModalState.isAfterCheckout}
          onClose={() => setReceiptModalState(null)}
        />
      )}

      {/* User Profile Modal */}
      {showProfileModal && (
        <ProfileModal
          user={user}
          store={store}
          branch={branch}
          onUpdated={(updatedUser) => setUser(updatedUser)}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </div>
  );
}
