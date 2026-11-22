import type {
  Branch,
  Category,
  Customer,
  Employee,
  EmployeeStatus,
  InventoryAdjustMode,
  InventoryItem,
  InventoryLog,
  Order,
  PaymentMethod,
  Product,
  Refund,
  SessionPayload,
  Shift,
  Store,
  StoreAuditLog,
  StoreStatus,
  User,
  UserRole,
} from './types';

const TOKEN_KEY = 'omni_pos_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Lỗi máy chủ (${res.status})`);
  }
  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    apiFetch<SessionPayload>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (payload: {
    name: string;
    email: string;
    password: string;
    phone: string;
    role: UserRole;
  }) =>
    apiFetch<SessionPayload>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getSession: () => apiFetch<Omit<SessionPayload, 'token'>>('/api/auth/session'),

  updateProfile: (payload: { name: string; phone: string }) =>
    apiFetch<User>('/api/users/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  getStores: () =>
    apiFetch<{ stores: Store[]; branches: Branch[]; auditLogs?: StoreAuditLog[] }>(
      '/api/stores'
    ),

  updateStoreStatus: (
    storeId: string,
    status: StoreStatus,
    options?: {
      actionType?: 'APPROVED' | 'REJECTED' | 'BLOCKED' | 'UNBLOCKED';
      reason?: string;
    }
  ) =>
    apiFetch<Store & { auditLog?: StoreAuditLog }>(
      `/api/stores/${storeId}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status, ...options }),
      }
    ),

  getCatalog: (storeId: string, branchId: string) =>
    apiFetch<{ categories: Category[]; products: Product[] }>(
      `/api/catalog?storeId=${encodeURIComponent(storeId)}&branchId=${encodeURIComponent(branchId)}`
    ),

  // --- CATEGORIES ---
  getCategories: (storeId: string) =>
    apiFetch<Category[]>(`/api/categories?storeId=${encodeURIComponent(storeId)}`),

  createCategory: (payload: { storeId: string; name: string }) =>
    apiFetch<Category>('/api/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateCategory: (categoryId: string, payload: { name: string }) =>
    apiFetch<Category>(`/api/categories/${categoryId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteCategory: (categoryId: string) =>
    apiFetch<{ deletedId: string }>(`/api/categories/${categoryId}`, {
      method: 'DELETE',
    }),

  // --- PRODUCTS ---
  getProducts: (params: { storeId: string; categoryId?: string; q?: string }) => {
    const query = new URLSearchParams();
    query.set('storeId', params.storeId);
    if (params.categoryId) query.set('categoryId', params.categoryId);
    if (params.q) query.set('q', params.q);
    return apiFetch<Product[]>(`/api/products?${query.toString()}`);
  },

  createProduct: (payload: {
    storeId: string;
    categoryId: string;
    name: string;
    sku: string;
    brand: string;
    mrp: number;
    price: number;
    imageUrl: string;
    unit: string;
    initialStock?: number;
  }) =>
    apiFetch<Product>('/api/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateProduct: (
    productId: string,
    payload: {
      categoryId: string;
      name: string;
      sku: string;
      brand: string;
      mrp: number;
      price: number;
      imageUrl: string;
      unit: string;
    }
  ) =>
    apiFetch<Product>(`/api/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteProduct: (productId: string) =>
    apiFetch<{ deletedId: string }>(`/api/products/${productId}`, {
      method: 'DELETE',
    }),

  // --- INVENTORY ---
  getInventory: (storeId: string, branchId?: string) => {
    const query = new URLSearchParams();
    query.set('storeId', storeId);
    if (branchId) query.set('branchId', branchId);
    return apiFetch<{
      branches: Branch[];
      branchId: string;
      items: InventoryItem[];
      logs: InventoryLog[];
    }>(`/api/inventory?${query.toString()}`);
  },

  adjustInventory: (payload: {
    productId: string;
    branchId: string;
    mode: InventoryAdjustMode;
    quantity: number;
    reason?: string;
  }) =>
    apiFetch<{ item: InventoryItem; log: InventoryLog }>('/api/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // --- BRANCHES ---
  getBranches: (storeId: string, q = '') =>
    apiFetch<Branch[]>(
      `/api/branches?storeId=${encodeURIComponent(storeId)}&q=${encodeURIComponent(q)}`
    ),

  createBranch: (payload: {
    storeId: string;
    name: string;
    code: string;
    address: string;
    phone: string;
    workingDays: string;
    openTime: string;
    closeTime: string;
    managerName: string;
  }) =>
    apiFetch<Branch>('/api/branches', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateBranch: (
    branchId: string,
    payload: {
      name: string;
      code: string;
      address: string;
      phone: string;
      workingDays: string;
      openTime: string;
      closeTime: string;
      managerName: string;
    }
  ) =>
    apiFetch<Branch>(`/api/branches/${branchId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteBranch: (branchId: string) =>
    apiFetch<{ deletedId: string }>(`/api/branches/${branchId}`, {
      method: 'DELETE',
    }),

  // --- EMPLOYEES ---
  getEmployees: (params: {
    storeId: string;
    branchId?: string;
    role?: string;
    q?: string;
  }) => {
    const query = new URLSearchParams();
    query.set('storeId', params.storeId);
    if (params.branchId) query.set('branchId', params.branchId);
    if (params.role) query.set('role', params.role);
    if (params.q) query.set('q', params.q);
    return apiFetch<Employee[]>(`/api/employees?${query.toString()}`);
  },

  createEmployee: (payload: {
    storeId: string;
    branchId: string | null;
    name: string;
    email: string;
    phone: string;
    password: string;
    role: UserRole;
    status?: EmployeeStatus;
  }) =>
    apiFetch<Employee>('/api/employees', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateEmployee: (
    employeeId: string,
    payload: {
      name: string;
      email: string;
      phone: string;
      role: UserRole;
      branchId: string | null;
      status: EmployeeStatus;
      password?: string;
    }
  ) =>
    apiFetch<Employee>(`/api/employees/${employeeId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteEmployee: (employeeId: string) =>
    apiFetch<{ deletedId: string }>(`/api/employees/${employeeId}`, {
      method: 'DELETE',
    }),

  // --- CUSTOMERS ---
  getCustomers: (storeId: string, q = '') =>
    apiFetch<Customer[]>(
      `/api/customers?storeId=${encodeURIComponent(storeId)}&q=${encodeURIComponent(q)}`
    ),

  getCustomerDetail: (customerId: string) =>
    apiFetch<{ customer: Customer; orders: Order[] }>(
      `/api/customers/${customerId}`
    ),

  createCustomer: (payload: {
    storeId: string;
    name: string;
    phone: string;
    email?: string;
  }) =>
    apiFetch<Customer>('/api/customers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateCustomer: (
    customerId: string,
    payload: {
      name: string;
      phone: string;
      email?: string;
      points?: number;
    }
  ) =>
    apiFetch<Customer>(`/api/customers/${customerId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteCustomer: (customerId: string) =>
    apiFetch<{ deletedId: string }>(`/api/customers/${customerId}`, {
      method: 'DELETE',
    }),

  getShifts: (params: { storeId?: string; branchId?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.storeId) query.set('storeId', params.storeId);
    if (params.branchId) query.set('branchId', params.branchId);
    const qs = query.toString();
    return apiFetch<Shift[]>(qs ? `/api/shifts?${qs}` : '/api/shifts');
  },

  openShift: (payload: {
    cashierId: string;
    cashierName: string;
    storeId: string;
    branchId: string;
    registerName: string;
    openingCash: number;
    openingNote: string;
  }) =>
    apiFetch<Shift>('/api/shifts/open', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  closeShift: (
    shiftId: string,
    payload: { actualCash: number; closingNote: string }
  ) =>
    apiFetch<Shift>(`/api/shifts/${shiftId}/close`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getOrders: (params: { storeId?: string; shiftId?: string; branchId?: string }) => {
    const query = new URLSearchParams();
    if (params.storeId) query.set('storeId', params.storeId);
    if (params.shiftId) query.set('shiftId', params.shiftId);
    if (params.branchId) query.set('branchId', params.branchId);
    return apiFetch<Order[]>(`/api/orders?${query.toString()}`);
  },

  createOrder: (payload: {
    storeId: string;
    branchId: string;
    shiftId: string;
    customerId: string | null;
    items: Array<{ productId: string; quantity: number; note: string }>;
    discountAmount: number;
    discountLabel: string;
    paymentMethod: PaymentMethod;
    cashTendered: number;
    paymentRef: string;
  }) =>
    apiFetch<{ order: Order; shift: Shift }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getRefunds: (params: { storeId?: string; shiftId?: string; branchId?: string }) => {
    const query = new URLSearchParams();
    if (params.storeId) query.set('storeId', params.storeId);
    if (params.shiftId) query.set('shiftId', params.shiftId);
    if (params.branchId) query.set('branchId', params.branchId);
    return apiFetch<Refund[]>(`/api/refunds?${query.toString()}`);
  },

  createRefund: (payload: {
    orderId: string;
    shiftId: string;
    amount: number;
    reason: string;
    note?: string;
    method: PaymentMethod;
  }) =>
    apiFetch<{ refund: Refund; order: Order; shift: Shift | null }>(
      '/api/refunds',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),
};
