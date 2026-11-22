export type UserRole =
  | 'ADMIN'
  | 'STORE_ADMIN'
  | 'STORE_MANAGER'
  | 'BRANCH_MANAGER'
  | 'BRANCH_CASHIER';

export type StoreStatus = 'PENDING' | 'ACTIVE' | 'BLOCKED';

export type PaymentMethod = 'CASH' | 'CARD' | 'UPI';

export type OrderStatus = 'COMPLETED' | 'PARTIALLY_REFUNDED' | 'REFUNDED';

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  storeId: string | null;
  branchId: string | null;
  status?: EmployeeStatus;
}

export interface Employee extends User {
  status: EmployeeStatus;
  branchName: string;
  isOnShift: boolean;
}

export interface StoreAuditLog {
  id: string;
  storeId: string;
  storeName: string;
  brandCode: string;
  action: 'APPROVED' | 'REJECTED' | 'BLOCKED' | 'UNBLOCKED';
  fromStatus: StoreStatus;
  toStatus: StoreStatus;
  actorName: string;
  note: string;
  createdAt: string;
}

export interface Store {
  id: string;
  name: string;
  brandCode: string;
  businessType: string;
  description: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  status: StoreStatus;
  ownerId: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  branchCount?: number;
  createdAt: string;
  updatedAt?: string;
  approvedAt?: string | null;
  blockedAt?: string | null;
  blockedReason?: string;
}

export interface Branch {
  id: string;
  storeId: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  workingDays: string;
  openTime: string;
  closeTime: string;
  managerName: string;
  employeeCount?: number;
  activeShiftCount?: number;
}

export interface Category {
  id: string;
  storeId: string;
  name: string;
  productCount?: number;
}

export interface Product {
  id: string;
  storeId: string;
  categoryId: string;
  categoryName?: string;
  name: string;
  sku: string;
  brand: string;
  mrp: number;
  price: number;
  imageUrl: string;
  unit: string;
  stock: number;
  totalStock?: number;
  branchStocks?: Array<{
    branchId: string;
    branchName: string;
    stock: number;
  }>;
}

export type InventoryAdjustMode = 'IMPORT' | 'SET' | 'DEDUCT';

export interface InventoryItem {
  productId: string;
  branchId: string;
  name: string;
  sku: string;
  brand: string;
  categoryId: string;
  categoryName: string;
  unit: string;
  price: number;
  imageUrl: string;
  stock: number;
}

export interface InventoryLog {
  id: string;
  storeId: string;
  branchId: string;
  productId: string;
  productName: string;
  sku: string;
  mode: InventoryAdjustMode;
  previousStock: number;
  delta: number;
  newStock: number;
  reason: string;
  actorName: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  storeId: string;
  name: string;
  phone: string;
  email: string;
  points: number;
  totalSpent: number;
  visitCount: number;
  lastVisitAt?: string | null;
}

export interface CartItem {
  lineId: string;
  productId: string;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  note: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  note: string;
}

export interface Order {
  id: string;
  receiptCode: string;
  storeId: string;
  branchId: string;
  branchName?: string;
  shiftId: string;
  shiftCode?: string;
  registerName?: string;
  cashierId: string;
  cashierName: string;
  customerId: string | null;
  customerName: string;
  items: OrderItem[];
  subtotal: number;
  discountAmount: number;
  discountLabel: string;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  cashTendered: number;
  changeDue: number;
  paymentRef: string;
  status: OrderStatus;
  refundedAmount: number;
  createdAt: string;
}

export interface Refund {
  id: string;
  refundCode: string;
  orderId: string;
  receiptCode: string;
  storeId: string;
  branchId: string;
  branchName?: string;
  shiftId: string;
  cashierId: string;
  cashierName: string;
  amount: number;
  reason: string;
  method: PaymentMethod;
  createdAt: string;
  orderTotalAmount?: number;
  orderRefundedAmount?: number;
  orderCustomerName?: string;
  orderStatus?: OrderStatus;
}

export interface Shift {
  id: string;
  shiftCode: string;
  storeId: string;
  branchId: string;
  branchName: string;
  registerName: string;
  cashierId: string;
  cashierName: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  expectedCash: number;
  actualCash: number | null;
  cashVariance: number | null;
  openingNote: string;
  closingNote: string;
  totalOrders: number;
  grossSales: number;
  totalRefunds: number;
  cashRefunds?: number;
  netRevenue: number;
  paymentBreakdown: {
    CASH: number;
    CARD: number;
    UPI: number;
  };
  paymentCounts?: {
    CASH: number;
    CARD: number;
    UPI: number;
  };
  topProducts?: Array<{
    productId: string;
    name: string;
    sku: string;
    quantity: number;
    revenue: number;
    imageUrl?: string;
  }>;
  recentOrders?: Order[];
  refunds?: Refund[];
}

export interface HeldOrder {
  id: string;
  label: string;
  customer: Customer | null;
  items: CartItem[];
  discountPercent: number;
  createdAt: string;
}

export interface SessionPayload {
  token: string;
  user: User;
  store: Store | null;
  branch: Branch | null;
  activeShift: Shift | null;
}
