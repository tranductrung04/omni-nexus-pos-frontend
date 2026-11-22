import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type UserRole =
  | 'ADMIN'
  | 'STORE_ADMIN'
  | 'STORE_MANAGER'
  | 'BRANCH_MANAGER'
  | 'BRANCH_CASHIER';

type StoreStatus = 'PENDING' | 'ACTIVE' | 'BLOCKED';
type PaymentMethod = 'CASH' | 'CARD' | 'UPI';
type OrderStatus = 'COMPLETED' | 'PARTIALLY_REFUNDED' | 'REFUNDED';

type EmployeeStatus = 'ACTIVE' | 'INACTIVE';

interface UserRecord {
  id: string;
  name: string;
  email: string;
  password: string;
  phone: string;
  role: UserRole;
  storeId: string | null;
  branchId: string | null;
  status: EmployeeStatus;
}

interface StoreRecord {
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
  createdAt: string;
  updatedAt?: string;
  approvedAt?: string | null;
  blockedAt?: string | null;
  blockedReason?: string;
}

interface StoreAuditLogRecord {
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

interface BranchRecord {
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
}

interface CategoryRecord {
  id: string;
  storeId: string;
  name: string;
}

interface ProductRecord {
  id: string;
  storeId: string;
  categoryId: string;
  name: string;
  sku: string;
  brand: string;
  mrp: number;
  price: number;
  imageUrl: string;
  unit: string;
}

interface InventoryRecord {
  productId: string;
  branchId: string;
  stock: number;
}

type InventoryAdjustMode = 'IMPORT' | 'SET' | 'DEDUCT';

interface InventoryLogRecord {
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

interface CustomerRecord {
  id: string;
  storeId: string;
  name: string;
  phone: string;
  email: string;
  points: number;
  totalSpent: number;
  visitCount: number;
}

interface OrderItemRecord {
  id: string;
  productId: string;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  note: string;
}

interface OrderRecord {
  id: string;
  receiptCode: string;
  storeId: string;
  branchId: string;
  shiftId: string;
  cashierId: string;
  cashierName: string;
  customerId: string | null;
  customerName: string;
  items: OrderItemRecord[];
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

interface RefundRecord {
  id: string;
  refundCode: string;
  orderId: string;
  receiptCode: string;
  storeId: string;
  branchId: string;
  shiftId: string;
  cashierId: string;
  cashierName: string;
  amount: number;
  reason: string;
  method: PaymentMethod;
  createdAt: string;
}

interface ShiftRecord {
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
  actualCash: number | null;
  openingNote: string;
  closingNote: string;
}

// Seeded multi-store, multi-branch dataset
const users: UserRecord[] = [
  {
    id: 'usr-admin',
    name: 'Nguyễn Minh Quân',
    email: 'admin@omninexus.vn',
    password: 'password123',
    phone: '0901 000 111',
    role: 'ADMIN',
    storeId: null,
    branchId: null,
    status: 'ACTIVE',
  },
  {
    id: 'usr-store-admin',
    name: 'Trần Hoàng Bảo',
    email: 'owner@omninexus.vn',
    password: 'password123',
    phone: '0903 222 888',
    role: 'STORE_ADMIN',
    storeId: 'store-1',
    branchId: null,
    status: 'ACTIVE',
  },
  {
    id: 'usr-store-mgr',
    name: 'Lê Thảo Vy',
    email: 'manager@omninexus.vn',
    password: 'password123',
    phone: '0904 555 777',
    role: 'STORE_MANAGER',
    storeId: 'store-1',
    branchId: null,
    status: 'ACTIVE',
  },
  {
    id: 'usr-branch-mgr',
    name: 'Phạm Đức Khang',
    email: 'qlchinhanh@omninexus.vn',
    password: 'password123',
    phone: '0908 333 999',
    role: 'BRANCH_MANAGER',
    storeId: 'store-1',
    branchId: 'branch-1',
    status: 'ACTIVE',
  },
  {
    id: 'usr-cashier-1',
    name: 'Nguyễn Ngọc Linh',
    email: 'thungan@omninexus.vn',
    password: 'password123',
    phone: '0912 444 666',
    role: 'BRANCH_CASHIER',
    storeId: 'store-1',
    branchId: 'branch-1',
    status: 'ACTIVE',
  },
  {
    id: 'usr-branch-mgr-2',
    name: 'Trần Tuấn Kiệt',
    email: 'kiet.tran@omninexus.vn',
    password: 'password123',
    phone: '0907 654 321',
    role: 'BRANCH_MANAGER',
    storeId: 'store-1',
    branchId: 'branch-2',
    status: 'ACTIVE',
  },
  {
    id: 'usr-cashier-2',
    name: 'Phạm Minh Anh',
    email: 'minhanh@omninexus.vn',
    password: 'password123',
    phone: '0918 777 333',
    role: 'BRANCH_CASHIER',
    storeId: 'store-1',
    branchId: 'branch-2',
    status: 'ACTIVE',
  },
];

const stores: StoreRecord[] = [
  {
    id: 'store-1',
    name: 'Omni Roastery & Bakery',
    brandCode: 'OMNI-RB',
    businessType: 'F&B · Cà phê & Bánh thủ công',
    description: 'Chuỗi cà phê đặc sản kết hợp bánh ngọt Pháp và sản phẩm đóng gói.',
    contactPhone: '028 3822 6868',
    contactEmail: 'hello@omniroastery.vn',
    address: '68 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    status: 'ACTIVE',
    ownerId: 'usr-store-admin',
    ownerName: 'Trần Hoàng Bảo',
    ownerEmail: 'owner@omninexus.vn',
    ownerPhone: '0903 222 888',
    createdAt: '2026-06-15T08:00:00.000Z',
    updatedAt: '2026-06-16T10:15:00.000Z',
    approvedAt: '2026-06-16T10:15:00.000Z',
  },
  {
    id: 'store-2',
    name: 'Sài Gòn Green Market',
    brandCode: 'SGM-RT',
    businessType: 'Bán lẻ · Thực phẩm hữu cơ',
    description: 'Cửa hàng tiện lợi và nông sản hữu cơ chọn lọc tại Quận 3, cần triển khai quầy thu ngân kết nối cân điện tử.',
    contactPhone: '028 3910 2424',
    contactEmail: 'contact@sgmarket.vn',
    address: '142 Hai Bà Trưng, Quận 3, TP. Hồ Chí Minh',
    status: 'PENDING',
    ownerId: 'usr-store-admin',
    ownerName: 'Nguyễn Minh Quân',
    ownerEmail: 'quan.sgm@sgmarket.vn',
    ownerPhone: '0908 412 512',
    createdAt: '2026-11-21T02:15:00.000Z',
    updatedAt: '2026-11-21T02:15:00.000Z',
  },
  {
    id: 'store-3',
    name: 'Cửa hàng Minh Châu',
    brandCode: 'MC-TH89',
    businessType: 'Tạp hóa & Bách hóa',
    description: 'Cửa hàng tạp hóa và thực phẩm tiêu dùng, hoạt động từ 2019 với 2 điểm bán tại khu vực Thanh Xuân. Cần triển khai POS quản lý bán hàng kết nối máy quét mã vạch và máy in hóa đơn nhiệt.',
    contactPhone: '0903 456 789',
    contactEmail: 'contact@minhchau.vn',
    address: '12 Nguyễn Trãi, Phường Thượng Đình, Quận Thanh Xuân, Hà Nội',
    status: 'PENDING',
    ownerId: 'ext-owner-3',
    ownerName: 'Nguyễn Minh Châu',
    ownerEmail: 'chau.nguyen@gmail.com',
    ownerPhone: '0903 456 789',
    createdAt: '2026-11-21T04:12:00.000Z',
    updatedAt: '2026-11-21T04:12:00.000Z',
  },
  {
    id: 'store-4',
    name: 'Nhà thuốc An Khang',
    brandCode: 'AK-DP20',
    businessType: 'Nhà thuốc',
    description: 'Hệ thống nhà thuốc đạt chuẩn GPP phục vụ dược phẩm, thực phẩm chức năng và thiết bị y tế gia đình.',
    contactPhone: '0912 888 321',
    contactEmail: 'ankhang@nhathuocak.vn',
    address: '55 Lê Văn Sỹ, Quận 3, TP. Hồ Chí Minh',
    status: 'PENDING',
    ownerId: 'ext-owner-4',
    ownerName: 'Trần Quốc Khánh',
    ownerEmail: 'khanh.tran@gmail.com',
    ownerPhone: '0912 888 321',
    createdAt: '2026-11-20T07:40:00.000Z',
    updatedAt: '2026-11-20T07:40:00.000Z',
  },
  {
    id: 'store-5',
    name: 'Cafe Góc Phố',
    brandCode: 'CGP-FB',
    businessType: 'Quán cà phê & F&B',
    description: 'Quán cà phê phong cách cổ điển tại trung tâm Hoàn Kiếm, phục vụ đồ uống pha máy và bánh ngọt.',
    contactPhone: '0987 111 222',
    contactEmail: 'hello@cafegocpho.vn',
    address: '8 Hai Bà Trưng, Hoàn Kiếm, Hà Nội',
    status: 'PENDING',
    ownerId: 'ext-owner-5',
    ownerName: 'Lê Thị Hoa',
    ownerEmail: 'hoa.le@gmail.com',
    ownerPhone: '0987 111 222',
    createdAt: '2026-11-19T11:20:00.000Z',
    updatedAt: '2026-11-19T11:20:00.000Z',
  },
  {
    id: 'store-6',
    name: 'Thời trang Linh Đan',
    brandCode: 'LD-BTQ',
    businessType: 'Thời trang',
    description: 'Boutique thời trang nữ thiết kế riêng, tích hợp quản lý size/màu sắc và khách hàng thành viên.',
    contactPhone: '0935 222 444',
    contactEmail: 'linhdan@boutiqueld.vn',
    address: '101 Hải Phòng, Hải Châu, Đà Nẵng',
    status: 'PENDING',
    ownerId: 'ext-owner-6',
    ownerName: 'Phạm Linh Đan',
    ownerEmail: 'dan.pham@gmail.com',
    ownerPhone: '0935 222 444',
    createdAt: '2026-11-18T09:00:00.000Z',
    updatedAt: '2026-11-18T09:00:00.000Z',
  },
  {
    id: 'store-7',
    name: 'Omni Nexus Mart',
    brandCode: 'ON-MART',
    businessType: 'Siêu thị mini',
    description: 'Chuỗi siêu thị mini tiện ích chuyên cung cấp thực phẩm sạch, đồ gia dụng và tiêu dùng nhanh.',
    contactPhone: '024 3765 4321',
    contactEmail: 'contact@omninexus.vn',
    address: '123 Cầu Giấy, Phường Quan Hoa, Quận Cầu Giấy, Hà Nội',
    status: 'ACTIVE',
    ownerId: 'ext-owner-7',
    ownerName: 'Lê Minh Tuấn',
    ownerEmail: 'tuan.le@omninexus.vn',
    ownerPhone: '0912 345 678',
    createdAt: '2026-09-02T08:30:00.000Z',
    updatedAt: '2026-09-03T14:15:00.000Z',
    approvedAt: '2026-09-03T14:15:00.000Z',
  },
  {
    id: 'store-8',
    name: 'Bách Hóa Xanh Mini',
    brandCode: 'BHX-Q1',
    businessType: 'Tạp hóa & Bách hóa',
    description: 'Cửa hàng bách hóa thực phẩm tươi sống và nhu yếu phẩm khu vực trung tâm Quận 1.',
    contactPhone: '028 3822 9900',
    contactEmail: 'nam.vo@bhxmini.vn',
    address: '88 Lê Lợi, Quận 1, TP. Hồ Chí Minh',
    status: 'ACTIVE',
    ownerId: 'ext-owner-8',
    ownerName: 'Võ Hoàng Nam',
    ownerEmail: 'nam.vo@gmail.com',
    ownerPhone: '0909 882 119',
    createdAt: '2026-09-15T09:00:00.000Z',
    updatedAt: '2026-09-16T11:20:00.000Z',
    approvedAt: '2026-09-16T11:20:00.000Z',
  },
  {
    id: 'store-9',
    name: 'Highlands Central Coffee',
    brandCode: 'HCC-HN',
    businessType: 'Quán cà phê & F&B',
    description: 'Điểm phục vụ cà phê và đồ uống nhanh dành cho khối văn phòng khu vực Ba Đình.',
    contactPhone: '024 7300 8899',
    contactEmail: 'duong.dang@highlands.com.vn',
    address: '29 Liễu Giai, Ba Đình, Hà Nội',
    status: 'ACTIVE',
    ownerId: 'ext-owner-9',
    ownerName: 'Đặng Thùy Dương',
    ownerEmail: 'duong.dang@highlands.com.vn',
    ownerPhone: '0904 778 990',
    createdAt: '2026-08-10T07:45:00.000Z',
    updatedAt: '2026-08-11T10:00:00.000Z',
    approvedAt: '2026-08-11T10:00:00.000Z',
  },
  {
    id: 'store-10',
    name: 'Shop Online 24h',
    brandCode: 'SO-24H',
    businessType: 'Thời trang',
    description: 'Chuỗi cửa hàng thời trang thiết kế trẻ, có 1 cửa hàng bán lẻ và kênh bán hàng trực tuyến đa nền tảng.',
    contactPhone: '0966 123 456',
    contactEmail: 'contact@shoponline24h.vn',
    address: '17 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    status: 'BLOCKED',
    ownerId: 'ext-owner-10',
    ownerName: 'Đặng Văn Bình',
    ownerEmail: 'binh.dang@gmail.com',
    ownerPhone: '0966 123 456',
    createdAt: '2026-07-12T08:15:00.000Z',
    updatedAt: '2026-11-03T09:30:00.000Z',
    blockedAt: '2026-11-03T09:30:00.000Z',
    blockedReason: 'Vi phạm chính sách hàng hóa không rõ nguồn gốc / chậm đối soát',
  },
  {
    id: 'store-11',
    name: 'Tạp hóa Bà Sáu',
    brandCode: 'BS-4319',
    businessType: 'Tạp hóa & Bách hóa',
    description: 'Cửa hàng bán lẻ hàng tiêu dùng thiết yếu tại quận Ninh Kiều.',
    contactPhone: '0944 321 987',
    contactEmail: 'sau.nguyen@gmail.com',
    address: '22 Trần Hưng Đạo, Ninh Kiều, Cần Thơ',
    status: 'BLOCKED',
    ownerId: 'ext-owner-11',
    ownerName: 'Nguyễn Thị Sáu',
    ownerEmail: 'sau.nguyen@gmail.com',
    ownerPhone: '0944 321 987',
    createdAt: '2026-08-05T10:10:00.000Z',
    updatedAt: '2026-11-11T16:45:00.000Z',
    blockedAt: '2026-11-11T16:45:00.000Z',
    blockedReason: 'Tạm ngưng do khiếu nại giao dịch thẻ ngân hàng cần xác minh',
  },
];

const storeAuditLogs: StoreAuditLogRecord[] = [
  {
    id: 'slog-1',
    storeId: 'store-1',
    storeName: 'Omni Roastery & Bakery',
    brandCode: 'OMNI-RB',
    action: 'APPROVED',
    fromStatus: 'PENDING',
    toStatus: 'ACTIVE',
    actorName: 'Nguyễn Minh Quân',
    note: 'Hồ sơ hợp lệ, đã xác minh địa điểm kinh doanh Quận 1.',
    createdAt: '2026-06-16T10:15:00.000Z',
  },
  {
    id: 'slog-2',
    storeId: 'store-7',
    storeName: 'Omni Nexus Mart',
    brandCode: 'ON-MART',
    action: 'APPROVED',
    fromStatus: 'PENDING',
    toStatus: 'ACTIVE',
    actorName: 'Nguyễn Minh Quân',
    note: 'Phê duyệt kích hoạt gói chuỗi siêu thị mini.',
    createdAt: '2026-09-03T14:15:00.000Z',
  },
  {
    id: 'slog-3',
    storeId: 'store-10',
    storeName: 'Shop Online 24h',
    brandCode: 'SO-24H',
    action: 'BLOCKED',
    fromStatus: 'ACTIVE',
    toStatus: 'BLOCKED',
    actorName: 'Nguyễn Minh Quân',
    note: 'Vi phạm chính sách hàng hóa không rõ nguồn gốc / chậm đối soát.',
    createdAt: '2026-11-03T09:30:00.000Z',
  },
  {
    id: 'slog-4',
    storeId: 'store-11',
    storeName: 'Tạp hóa Bà Sáu',
    brandCode: 'BS-4319',
    action: 'BLOCKED',
    fromStatus: 'ACTIVE',
    toStatus: 'BLOCKED',
    actorName: 'Nguyễn Minh Quân',
    note: 'Tạm ngưng do khiếu nại giao dịch thẻ ngân hàng cần xác minh.',
    createdAt: '2026-11-11T16:45:00.000Z',
  },
];

function enrichStore(store: StoreRecord) {
  const owner = users.find((u) => u.id === store.ownerId);
  const branchCount = branches.filter((b) => b.storeId === store.id).length || 1;
  return {
    ...store,
    ownerName: store.ownerName || owner?.name || 'Chủ cửa hàng',
    ownerEmail: store.ownerEmail || owner?.email || store.contactEmail,
    ownerPhone: store.ownerPhone || owner?.phone || store.contactPhone,
    branchCount,
  };
}

const branches: BranchRecord[] = [
  {
    id: 'branch-1',
    storeId: 'store-1',
    name: 'Chi nhánh Nguyễn Huệ (Q.1)',
    code: 'CN-Q1-01',
    address: '68 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM',
    phone: '028 3822 6868',
    workingDays: 'Thứ 2 – Chủ nhật',
    openTime: '06:30',
    closeTime: '22:30',
    managerName: 'Phạm Đức Khang',
  },
  {
    id: 'branch-2',
    storeId: 'store-1',
    name: 'Chi nhánh Thảo Điền (TP. Thủ Đức)',
    code: 'CN-TD-02',
    address: '28 Xuân Thủy, Phường Thảo Điền, TP. Thủ Đức, TP.HCM',
    phone: '028 3898 1212',
    workingDays: 'Thứ 2 – Chủ nhật',
    openTime: '07:00',
    closeTime: '22:00',
    managerName: 'Lê Thảo Vy',
  },
];

const categories: CategoryRecord[] = [
  { id: 'cat-coffee', storeId: 'store-1', name: 'Cà phê' },
  { id: 'cat-tea', storeId: 'store-1', name: 'Trà & Matcha' },
  { id: 'cat-bakery', storeId: 'store-1', name: 'Bánh ngọt' },
  { id: 'cat-retail', storeId: 'store-1', name: 'Hàng đóng gói' },
];

const products: ProductRecord[] = [
  {
    id: 'prod-1',
    storeId: 'store-1',
    categoryId: 'cat-coffee',
    name: 'Cà phê Sữa đá Sài Gòn',
    sku: 'CF-001',
    brand: 'Omni Signature',
    mrp: 49000,
    price: 45000,
    imageUrl: '/src/assets/images/pos_iced_milk_coffee_1795270258563.jpg',
    unit: 'Ly',
  },
  {
    id: 'prod-2',
    storeId: 'store-1',
    categoryId: 'cat-coffee',
    name: 'Bạc Xỉu Kem Muối',
    sku: 'CF-002',
    brand: 'Omni Signature',
    mrp: 55000,
    price: 49000,
    imageUrl: '/src/assets/images/pos_iced_milk_coffee_1795270258563.jpg',
    unit: 'Ly',
  },
  {
    id: 'prod-3',
    storeId: 'store-1',
    categoryId: 'cat-coffee',
    name: 'Cold Brew Cam Vàng',
    sku: 'CF-003',
    brand: 'Omni Roastery',
    mrp: 65000,
    price: 59000,
    imageUrl: '/src/assets/images/pos_peach_tea_1795270258952.jpg',
    unit: 'Ly',
  },
  {
    id: 'prod-4',
    storeId: 'store-1',
    categoryId: 'cat-coffee',
    name: 'Latte Hạnh Nhân Nóng',
    sku: 'CF-004',
    brand: 'Omni Roastery',
    mrp: 65000,
    price: 62000,
    imageUrl: '/src/assets/images/pos_iced_milk_coffee_1795270258563.jpg',
    unit: 'Ly',
  },
  {
    id: 'prod-5',
    storeId: 'store-1',
    categoryId: 'cat-tea',
    name: 'Matcha Latte Uji Nhật Bản',
    sku: 'TR-001',
    brand: 'Kyoto Ceremonial',
    mrp: 69000,
    price: 65000,
    imageUrl: '/src/assets/images/pos_matcha_latte_1795270258250.jpg',
    unit: 'Ly',
  },
  {
    id: 'prod-6',
    storeId: 'store-1',
    categoryId: 'cat-tea',
    name: 'Trà Đào Cam Sả',
    sku: 'TR-002',
    brand: 'Omni Tea',
    mrp: 59000,
    price: 55000,
    imageUrl: '/src/assets/images/pos_peach_tea_1795270258952.jpg',
    unit: 'Ly',
  },
  {
    id: 'prod-7',
    storeId: 'store-1',
    categoryId: 'cat-tea',
    name: 'Trà Oolong Sữa Hạt Sen',
    sku: 'TR-003',
    brand: 'Omni Tea',
    mrp: 59000,
    price: 55000,
    imageUrl: '/src/assets/images/pos_matcha_latte_1795270258250.jpg',
    unit: 'Ly',
  },
  {
    id: 'prod-8',
    storeId: 'store-1',
    categoryId: 'cat-bakery',
    name: 'Croissant Bơ Pháp Laminated',
    sku: 'BK-001',
    brand: 'L’Artisan Bake',
    mrp: 48000,
    price: 45000,
    imageUrl: '/src/assets/images/pos_butter_croissant_1795270259186.jpg',
    unit: 'Cái',
  },
  {
    id: 'prod-9',
    storeId: 'store-1',
    categoryId: 'cat-bakery',
    name: 'Tiramisu Cacao Ý',
    sku: 'BK-002',
    brand: 'L’Artisan Bake',
    mrp: 69000,
    price: 65000,
    imageUrl: '/src/assets/images/pos_tiramisu_cake_1795270259164.jpg',
    unit: 'Phần',
  },
  {
    id: 'prod-10',
    storeId: 'store-1',
    categoryId: 'cat-bakery',
    name: 'Bánh Sừng Bò Hạnh Nhân',
    sku: 'BK-003',
    brand: 'L’Artisan Bake',
    mrp: 58000,
    price: 52000,
    imageUrl: '/src/assets/images/pos_butter_croissant_1795270259186.jpg',
    unit: 'Cái',
  },
  {
    id: 'prod-11',
    storeId: 'store-1',
    categoryId: 'cat-retail',
    name: 'Cà phê Hạt Arabica Guji 250g',
    sku: 'RT-001',
    brand: 'Altura Roasters',
    mrp: 245000,
    price: 220000,
    imageUrl: '/src/assets/images/pos_coffee_beans_bag_1795270258836.jpg',
    unit: 'Gói',
  },
  {
    id: 'prod-12',
    storeId: 'store-1',
    categoryId: 'cat-retail',
    name: 'Cà phê Phin Truyền Thống 250g',
    sku: 'RT-002',
    brand: 'Omni Roastery',
    mrp: 165000,
    price: 150000,
    imageUrl: '/src/assets/images/pos_coffee_beans_bag_1795270258836.jpg',
    unit: 'Gói',
  },
  {
    id: 'prod-13',
    storeId: 'store-1',
    categoryId: 'cat-bakery',
    name: 'Cheesecake Chanh Dây',
    sku: 'BK-004',
    brand: 'L’Artisan Bake',
    mrp: 65000,
    price: 60000,
    imageUrl: '/src/assets/images/pos_tiramisu_cake_1795270259164.jpg',
    unit: 'Phần',
  },
  {
    id: 'prod-14',
    storeId: 'store-1',
    categoryId: 'cat-tea',
    name: 'Trà Vải Hoa Hồng',
    sku: 'TR-004',
    brand: 'Omni Tea',
    mrp: 59000,
    price: 55000,
    imageUrl: '/src/assets/images/pos_peach_tea_1795270258952.jpg',
    unit: 'Ly',
  },
];

const inventory: InventoryRecord[] = [
  // Branch 1: Chi nhánh Nguyễn Huệ (Q.1)
  { productId: 'prod-1', branchId: 'branch-1', stock: 85 },
  { productId: 'prod-2', branchId: 'branch-1', stock: 64 },
  { productId: 'prod-3', branchId: 'branch-1', stock: 38 },
  { productId: 'prod-4', branchId: 'branch-1', stock: 42 },
  { productId: 'prod-5', branchId: 'branch-1', stock: 51 },
  { productId: 'prod-6', branchId: 'branch-1', stock: 47 },
  { productId: 'prod-7', branchId: 'branch-1', stock: 29 },
  { productId: 'prod-8', branchId: 'branch-1', stock: 18 },
  { productId: 'prod-9', branchId: 'branch-1', stock: 14 },
  { productId: 'prod-10', branchId: 'branch-1', stock: 9 },
  { productId: 'prod-11', branchId: 'branch-1', stock: 24 },
  { productId: 'prod-12', branchId: 'branch-1', stock: 30 },
  { productId: 'prod-13', branchId: 'branch-1', stock: 0 }, // Out of stock demonstration
  { productId: 'prod-14', branchId: 'branch-1', stock: 33 },

  // Branch 2: Chi nhánh Thảo Điền (TP. Thủ Đức)
  { productId: 'prod-1', branchId: 'branch-2', stock: 54 },
  { productId: 'prod-2', branchId: 'branch-2', stock: 36 },
  { productId: 'prod-3', branchId: 'branch-2', stock: 22 },
  { productId: 'prod-4', branchId: 'branch-2', stock: 19 },
  { productId: 'prod-5', branchId: 'branch-2', stock: 6 },
  { productId: 'prod-6', branchId: 'branch-2', stock: 41 },
  { productId: 'prod-7', branchId: 'branch-2', stock: 15 },
  { productId: 'prod-8', branchId: 'branch-2', stock: 26 },
  { productId: 'prod-9', branchId: 'branch-2', stock: 8 },
  { productId: 'prod-10', branchId: 'branch-2', stock: 0 },
  { productId: 'prod-11', branchId: 'branch-2', stock: 17 },
  { productId: 'prod-12', branchId: 'branch-2', stock: 12 },
  { productId: 'prod-13', branchId: 'branch-2', stock: 11 },
  { productId: 'prod-14', branchId: 'branch-2', stock: 28 },
];

const inventoryLogs: InventoryLogRecord[] = [
  {
    id: 'invlog-1',
    storeId: 'store-1',
    branchId: 'branch-1',
    productId: 'prod-1',
    productName: 'Cà phê Sữa đá Sài Gòn',
    sku: 'CF-001',
    mode: 'IMPORT',
    previousStock: 45,
    delta: 40,
    newStock: 85,
    reason: 'Nhập nguyên liệu đầu ngày từ kho trung tâm',
    actorName: 'Phạm Đức Khang',
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
  },
  {
    id: 'invlog-2',
    storeId: 'store-1',
    branchId: 'branch-1',
    productId: 'prod-10',
    productName: 'Bánh Sừng Bò Hạnh Nhân',
    sku: 'BK-003',
    mode: 'SET',
    previousStock: 12,
    delta: -3,
    newStock: 9,
    reason: 'Kiểm kê cuối buổi trưa (loại bỏ bánh mẫu trưng bày)',
    actorName: 'Phạm Đức Khang',
    createdAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
  },
  {
    id: 'invlog-3',
    storeId: 'store-1',
    branchId: 'branch-2',
    productId: 'prod-5',
    productName: 'Matcha Latte Uji Nhật Bản',
    sku: 'TR-001',
    mode: 'DEDUCT',
    previousStock: 10,
    delta: -4,
    newStock: 6,
    reason: 'Điều chuyển nội bộ sang CN Nguyễn Huệ',
    actorName: 'Lê Thảo Vy',
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
];

const customers: CustomerRecord[] = [
  {
    id: 'cust-1',
    storeId: 'store-1',
    name: 'Võ Thanh Tùng',
    phone: '0909 123 456',
    email: 'tung.vo@gmail.com',
    points: 340,
    totalSpent: 2850000,
    visitCount: 18,
  },
  {
    id: 'cust-2',
    storeId: 'store-1',
    name: 'Đặng Minh Thư',
    phone: '0938 678 910',
    email: 'minhthu.dang@gmail.com',
    points: 520,
    totalSpent: 4620000,
    visitCount: 27,
  },
  {
    id: 'cust-3',
    storeId: 'store-1',
    name: 'Huỳnh Gia Huy',
    phone: '0918 456 789',
    email: 'giahuy.h@outlook.com',
    points: 115,
    totalSpent: 980000,
    visitCount: 6,
  },
];

// Historical shifts & transactions so Shift Reports, Orders, and Refunds work across branches immediately
const todayStr = new Date().toISOString().slice(0, 10);
const yesterdayDate = new Date(Date.now() - 86400000);
const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);
const morningOpenIso = `${todayStr}T06:30:00.000Z`;
const morningCloseIso = `${todayStr}T13:30:00.000Z`;
const branch2OpenIso = `${todayStr}T07:00:00.000Z`;
const branch2CloseIso = `${todayStr}T14:15:00.000Z`;
const yesterdayOpenIso = `${yesterdayStr}T14:00:00.000Z`;
const yesterdayCloseIso = `${yesterdayStr}T21:30:00.000Z`;

const shifts: ShiftRecord[] = [
  {
    id: 'shift-morning-1',
    shiftCode: 'CA-SANG-001',
    storeId: 'store-1',
    branchId: 'branch-1',
    branchName: 'Chi nhánh Nguyễn Huệ (Q.1)',
    registerName: 'Quầy POS 01',
    cashierId: 'usr-cashier-1',
    cashierName: 'Nguyễn Ngọc Linh',
    status: 'CLOSED',
    openedAt: morningOpenIso,
    closedAt: morningCloseIso,
    openingCash: 1000000,
    actualCash: 1170000,
    openingNote: 'Tiền lẻ mệnh giá 10k, 20k, 50k đầy đủ.',
    closingNote: 'Bàn giao ca chiều đúng số liệu (đã trừ 1 phiếu hoàn tiền mặt).',
  },
  {
    id: 'shift-branch2-1',
    shiftCode: 'CA-SANG-TD-001',
    storeId: 'store-1',
    branchId: 'branch-2',
    branchName: 'Chi nhánh Thảo Điền (TP. Thủ Đức)',
    registerName: 'Quầy POS 02',
    cashierId: 'usr-cashier-2',
    cashierName: 'Phạm Minh Anh',
    status: 'CLOSED',
    openedAt: branch2OpenIso,
    closedAt: branch2CloseIso,
    openingCash: 1500000,
    actualCash: 1740000,
    openingNote: 'Kiểm đếm đầu ca đầy đủ.',
    closingNote: 'Khớp két cuối ca.',
  },
  {
    id: 'shift-yesterday-empty',
    shiftCode: 'CA-BAOTRI-000',
    storeId: 'store-1',
    branchId: 'branch-1',
    branchName: 'Chi nhánh Nguyễn Huệ (Q.1)',
    registerName: 'Quầy POS 02',
    cashierId: 'usr-branch-mgr',
    cashierName: 'Phạm Đức Khang',
    status: 'CLOSED',
    openedAt: yesterdayOpenIso,
    closedAt: yesterdayCloseIso,
    openingCash: 500000,
    actualCash: 500000,
    openingNote: 'Mở ca kiểm tra thiết bị POS dự phòng.',
    closingNote: 'Không phát sinh giao dịch.',
  },
];

const orders: OrderRecord[] = [
  {
    id: 'ord-seed-1',
    receiptCode: 'HD-261121-001',
    storeId: 'store-1',
    branchId: 'branch-1',
    shiftId: 'shift-morning-1',
    cashierId: 'usr-cashier-1',
    cashierName: 'Nguyễn Ngọc Linh',
    customerId: 'cust-1',
    customerName: 'Võ Thanh Tùng',
    items: [
      {
        id: 'oi-1',
        productId: 'prod-1',
        name: 'Cà phê Sữa đá Sài Gòn',
        sku: 'CF-001',
        unitPrice: 45000,
        quantity: 2,
        lineTotal: 90000,
        note: 'Ít đá, 50% đường',
      },
      {
        id: 'oi-2',
        productId: 'prod-8',
        name: 'Croissant Bơ Pháp Laminated',
        sku: 'BK-001',
        unitPrice: 45000,
        quantity: 1,
        lineTotal: 45000,
        note: 'Hâm nóng',
      },
    ],
    subtotal: 135000,
    discountAmount: 0,
    discountLabel: '',
    taxAmount: 0,
    totalAmount: 135000,
    paymentMethod: 'CASH',
    cashTendered: 200000,
    changeDue: 65000,
    paymentRef: '',
    status: 'PARTIALLY_REFUNDED',
    refundedAmount: 45000,
    createdAt: `${todayStr}T08:15:00.000Z`,
  },
  {
    id: 'ord-seed-2',
    receiptCode: 'HD-261121-002',
    storeId: 'store-1',
    branchId: 'branch-1',
    shiftId: 'shift-morning-1',
    cashierId: 'usr-cashier-1',
    cashierName: 'Nguyễn Ngọc Linh',
    customerId: 'cust-2',
    customerName: 'Đặng Minh Thư',
    items: [
      {
        id: 'oi-3',
        productId: 'prod-5',
        name: 'Matcha Latte Uji Nhật Bản',
        sku: 'TR-001',
        unitPrice: 65000,
        quantity: 2,
        lineTotal: 130000,
        note: 'Ít ngọt',
      },
      {
        id: 'oi-4',
        productId: 'prod-11',
        name: 'Cà phê Hạt Arabica Guji 250g',
        sku: 'RT-001',
        unitPrice: 220000,
        quantity: 1,
        lineTotal: 220000,
        note: '',
      },
    ],
    subtotal: 350000,
    discountAmount: 0,
    discountLabel: '',
    taxAmount: 0,
    totalAmount: 350000,
    paymentMethod: 'UPI',
    cashTendered: 350000,
    changeDue: 0,
    paymentRef: 'VIETQR-882419',
    status: 'COMPLETED',
    refundedAmount: 0,
    createdAt: `${todayStr}T09:40:00.000Z`,
  },
  {
    id: 'ord-seed-3',
    receiptCode: 'HD-261121-003',
    storeId: 'store-1',
    branchId: 'branch-1',
    shiftId: 'shift-morning-1',
    cashierId: 'usr-cashier-1',
    cashierName: 'Nguyễn Ngọc Linh',
    customerId: null,
    customerName: 'Khách lẻ',
    items: [
      {
        id: 'oi-5',
        productId: 'prod-6',
        name: 'Trà Đào Cam Sả',
        sku: 'TR-002',
        unitPrice: 55000,
        quantity: 2,
        lineTotal: 110000,
        note: '',
      },
      {
        id: 'oi-6',
        productId: 'prod-9',
        name: 'Tiramisu Cacao Ý',
        sku: 'BK-002',
        unitPrice: 65000,
        quantity: 1,
        lineTotal: 65000,
        note: '',
      },
    ],
    subtotal: 175000,
    discountAmount: 0,
    discountLabel: '',
    taxAmount: 0,
    totalAmount: 175000,
    paymentMethod: 'CARD',
    cashTendered: 175000,
    changeDue: 0,
    paymentRef: 'VISA-4912',
    status: 'COMPLETED',
    refundedAmount: 0,
    createdAt: `${todayStr}T11:10:00.000Z`,
  },
  {
    id: 'ord-seed-4',
    receiptCode: 'HD-261121-004',
    storeId: 'store-1',
    branchId: 'branch-1',
    shiftId: 'shift-morning-1',
    cashierId: 'usr-cashier-1',
    cashierName: 'Nguyễn Ngọc Linh',
    customerId: null,
    customerName: 'Khách lẻ',
    items: [
      {
        id: 'oi-7',
        productId: 'prod-1',
        name: 'Cà phê Sữa đá Sài Gòn',
        sku: 'CF-001',
        unitPrice: 45000,
        quantity: 2,
        lineTotal: 90000,
        note: 'Mang về',
      },
    ],
    subtotal: 90000,
    discountAmount: 10000,
    discountLabel: 'Ưu đãi sáng',
    taxAmount: 0,
    totalAmount: 80000,
    paymentMethod: 'CASH',
    cashTendered: 100000,
    changeDue: 20000,
    paymentRef: '',
    status: 'COMPLETED',
    refundedAmount: 0,
    createdAt: `${todayStr}T12:05:00.000Z`,
  },
  {
    id: 'ord-seed-5',
    receiptCode: 'HD-261121-005',
    storeId: 'store-1',
    branchId: 'branch-2',
    shiftId: 'shift-branch2-1',
    cashierId: 'usr-cashier-2',
    cashierName: 'Phạm Minh Anh',
    customerId: 'cust-3',
    customerName: 'Huỳnh Gia Huy',
    items: [
      {
        id: 'oi-8',
        productId: 'prod-12',
        name: 'Cà phê Phin Truyền Thống 250g',
        sku: 'RT-002',
        unitPrice: 150000,
        quantity: 1,
        lineTotal: 150000,
        note: '',
      },
      {
        id: 'oi-9',
        productId: 'prod-8',
        name: 'Croissant Bơ Pháp Laminated',
        sku: 'BK-001',
        unitPrice: 45000,
        quantity: 2,
        lineTotal: 90000,
        note: '',
      },
    ],
    subtotal: 240000,
    discountAmount: 0,
    discountLabel: '',
    taxAmount: 0,
    totalAmount: 240000,
    paymentMethod: 'CASH',
    cashTendered: 250000,
    changeDue: 10000,
    paymentRef: '',
    status: 'COMPLETED',
    refundedAmount: 0,
    createdAt: `${todayStr}T09:15:00.000Z`,
  },
  {
    id: 'ord-seed-6',
    receiptCode: 'HD-261121-006',
    storeId: 'store-1',
    branchId: 'branch-2',
    shiftId: 'shift-branch2-1',
    cashierId: 'usr-cashier-2',
    cashierName: 'Phạm Minh Anh',
    customerId: null,
    customerName: 'Khách lẻ',
    items: [
      {
        id: 'oi-10',
        productId: 'prod-13',
        name: 'Cheesecake Chanh Dây',
        sku: 'BK-004',
        unitPrice: 60000,
        quantity: 2,
        lineTotal: 120000,
        note: 'Đóng hộp riêng',
      },
    ],
    subtotal: 120000,
    discountAmount: 0,
    discountLabel: '',
    taxAmount: 0,
    totalAmount: 120000,
    paymentMethod: 'UPI',
    cashTendered: 120000,
    changeDue: 0,
    paymentRef: 'VIETQR-551092',
    status: 'REFUNDED',
    refundedAmount: 120000,
    createdAt: `${todayStr}T10:30:00.000Z`,
  },
];

const refunds: RefundRecord[] = [
  {
    id: 'ref-seed-1',
    refundCode: 'HT-001',
    orderId: 'ord-seed-1',
    receiptCode: 'HD-261121-001',
    storeId: 'store-1',
    branchId: 'branch-1',
    shiftId: 'shift-morning-1',
    cashierId: 'usr-cashier-1',
    cashierName: 'Nguyễn Ngọc Linh',
    amount: 45000,
    reason: 'Sản phẩm lỗi — Ly cà phê bị đổ khi đóng gói mang đi',
    method: 'CASH',
    createdAt: `${todayStr}T08:45:00.000Z`,
  },
  {
    id: 'ref-seed-2',
    refundCode: 'HT-002',
    orderId: 'ord-seed-6',
    receiptCode: 'HD-261121-006',
    storeId: 'store-1',
    branchId: 'branch-2',
    shiftId: 'shift-branch2-1',
    cashierId: 'usr-cashier-2',
    cashierName: 'Phạm Minh Anh',
    amount: 120000,
    reason: 'Khách đổi ý — Đổi sang bánh khác chưa kịp giao',
    method: 'UPI',
    createdAt: `${todayStr}T10:50:00.000Z`,
  },
];

// Simple token map
const sessions = new Map<string, string>(); // token -> userId

function enrichOrder(o: OrderRecord) {
  const br = branches.find((b) => b.id === o.branchId);
  const sh = shifts.find((s) => s.id === o.shiftId);
  return {
    ...o,
    branchName: br ? br.name : 'Chi nhánh',
    shiftCode: sh ? sh.shiftCode : '',
    registerName: sh ? sh.registerName : 'Quầy POS 01',
  };
}

function enrichRefund(r: RefundRecord) {
  const br = branches.find((b) => b.id === r.branchId);
  const ord = orders.find((o) => o.id === r.orderId);
  return {
    ...r,
    branchName: br ? br.name : 'Chi nhánh',
    orderTotalAmount: ord ? ord.totalAmount : r.amount,
    orderRefundedAmount: ord ? ord.refundedAmount : r.amount,
    orderCustomerName: ord ? ord.customerName : 'Khách lẻ',
    orderStatus: ord ? ord.status : 'COMPLETED',
  };
}

function computeShiftSummary(shift: ShiftRecord) {
  const shiftOrders = orders.filter((o) => o.shiftId === shift.id);
  const shiftRefunds = refunds
    .filter((r) => r.shiftId === shift.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  let grossSales = 0;
  const paymentBreakdown: { CASH: number; CARD: number; UPI: number } = {
    CASH: 0,
    CARD: 0,
    UPI: 0,
  };
  const paymentCounts: { CASH: number; CARD: number; UPI: number } = {
    CASH: 0,
    CARD: 0,
    UPI: 0,
  };

  const productAgg = new Map<
    string,
    {
      productId: string;
      name: string;
      sku: string;
      quantity: number;
      revenue: number;
      imageUrl: string;
    }
  >();

  for (const order of shiftOrders) {
    grossSales += order.totalAmount;
    paymentBreakdown[order.paymentMethod] += order.totalAmount;
    paymentCounts[order.paymentMethod] += 1;

    for (const item of order.items) {
      const prod = products.find((p) => p.id === item.productId);
      const existing = productAgg.get(item.productId);
      if (existing) {
        existing.quantity += item.quantity;
        existing.revenue += item.lineTotal;
      } else {
        productAgg.set(item.productId, {
          productId: item.productId,
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          revenue: item.lineTotal,
          imageUrl: prod?.imageUrl || '',
        });
      }
    }
  }

  let totalRefunds = 0;
  let cashRefunds = 0;
  for (const ref of shiftRefunds) {
    totalRefunds += ref.amount;
    if (ref.method === 'CASH') {
      cashRefunds += ref.amount;
    }
  }

  const expectedCash = shift.openingCash + paymentBreakdown.CASH - cashRefunds;
  const cashVariance =
    shift.actualCash !== null ? shift.actualCash - expectedCash : null;

  const topProducts = Array.from(productAgg.values())
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, 6);

  const recentOrders = [...shiftOrders]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10)
    .map(enrichOrder);

  return {
    ...shift,
    expectedCash,
    cashVariance,
    totalOrders: shiftOrders.length,
    grossSales,
    totalRefunds,
    cashRefunds,
    netRevenue: grossSales - totalRefunds,
    paymentBreakdown,
    paymentCounts,
    topProducts,
    recentOrders,
    refunds: shiftRefunds.map(enrichRefund),
  };
}

function getUserFromAuthHeader(req: express.Request): UserRecord | null {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return null;
  const userId = sessions.get(token);
  if (!userId) return null;
  return users.find((u) => u.id === userId) || null;
}

function sanitizeUser(u: UserRecord) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    storeId: u.storeId,
    branchId: u.branchId,
    status: u.status,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // --- AUTH ENDPOINTS ---
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body || {};
    const user = users.find(
      (u) => u.email.toLowerCase() === String(email || '').trim().toLowerCase()
    );
    if (!user || (password && user.password !== password)) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác.' });
    }
    if (user.status === 'INACTIVE') {
      return res.status(403).json({
        error: 'Tài khoản này đang tạm khóa. Vui lòng liên hệ quản lý cửa hàng.',
      });
    }

    const token = `tok_${user.id}_${Date.now().toString(36)}`;
    sessions.set(token, user.id);

    const store = user.storeId
      ? stores.find((s) => s.id === user.storeId) || null
      : null;
    const branch = user.branchId
      ? branches.find((b) => b.id === user.branchId) || null
      : null;
    const activeShiftRaw = shifts.find(
      (s) => s.cashierId === user.id && s.status === 'OPEN'
    );

    return res.json({
      token,
      user: sanitizeUser(user),
      store,
      branch,
      activeShift: activeShiftRaw ? computeShiftSummary(activeShiftRaw) : null,
    });
  });

  app.post('/api/auth/register', (req, res) => {
    const { name, email, password, phone, role } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ họ tên, email và mật khẩu.' });
    }
    const allowedRoles: UserRole[] = [
      'STORE_ADMIN',
      'STORE_MANAGER',
      'BRANCH_MANAGER',
      'BRANCH_CASHIER',
    ];
    const safeRole: UserRole = allowedRoles.includes(role) ? role : 'BRANCH_CASHIER';

    const exists = users.some(
      (u) => u.email.toLowerCase() === String(email).trim().toLowerCase()
    );
    if (exists) {
      return res.status(409).json({ error: 'Email này đã được đăng ký trong hệ thống.' });
    }

    const newUser: UserRecord = {
      id: `usr-${Date.now()}`,
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      password: String(password),
      phone: String(phone || '0900 000 000').trim(),
      role: safeRole,
      storeId: 'store-1',
      branchId:
        safeRole === 'BRANCH_CASHIER' || safeRole === 'BRANCH_MANAGER'
          ? 'branch-1'
          : null,
      status: 'ACTIVE',
    };
    users.push(newUser);

    const token = `tok_${newUser.id}_${Date.now().toString(36)}`;
    sessions.set(token, newUser.id);

    const store = stores.find((s) => s.id === newUser.storeId) || null;
    const branch = newUser.branchId
      ? branches.find((b) => b.id === newUser.branchId) || null
      : null;

    return res.status(201).json({
      token,
      user: sanitizeUser(newUser),
      store,
      branch,
      activeShift: null,
    });
  });

  app.get('/api/auth/session', (req, res) => {
    const user = getUserFromAuthHeader(req);
    if (!user || user.status === 'INACTIVE') {
      return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn.' });
    }
    const store = user.storeId
      ? stores.find((s) => s.id === user.storeId) || null
      : null;
    const branch = user.branchId
      ? branches.find((b) => b.id === user.branchId) || null
      : null;
    const activeShiftRaw = shifts.find(
      (s) => s.cashierId === user.id && s.status === 'OPEN'
    );
    return res.json({
      user: sanitizeUser(user),
      store,
      branch,
      activeShift: activeShiftRaw ? computeShiftSummary(activeShiftRaw) : null,
    });
  });

  // --- PROFILE ---
  app.get('/api/users/profile', (req, res) => {
    const user = getUserFromAuthHeader(req);
    if (!user) return res.status(401).json({ error: 'Chưa đăng nhập' });
    return res.json(sanitizeUser(user));
  });

  app.put('/api/users/profile', (req, res) => {
    const user = getUserFromAuthHeader(req);
    if (!user) return res.status(401).json({ error: 'Chưa đăng nhập' });
    const { name, phone } = req.body || {};
    if (name) user.name = String(name).trim();
    if (phone) user.phone = String(phone).trim();
    return res.json(sanitizeUser(user));
  });

  // --- STORES (ADMIN & STORE_ADMIN) ---
  app.get('/api/stores', (_req, res) => {
    const enrichedStores = stores.map(enrichStore);
    const sortedLogs = [...storeAuditLogs].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
    return res.json({ stores: enrichedStores, branches, auditLogs: sortedLogs });
  });

  app.patch('/api/stores/:id/status', (req, res) => {
    const { id } = req.params;
    const { status, actionType, reason } = req.body || {};
    const store = stores.find((s) => s.id === id);
    if (!store) return res.status(404).json({ error: 'Không tìm thấy cửa hàng.' });
    if (!['PENDING', 'ACTIVE', 'BLOCKED'].includes(status)) {
      return res.status(400).json({ error: 'Trạng thái không hợp lệ.' });
    }
    const prevStatus = store.status;
    const nowIso = new Date().toISOString();
    store.status = status;
    store.updatedAt = nowIso;

    let resolvedAction: StoreAuditLogRecord['action'] = 'APPROVED';
    let defaultNote = '';
    if (status === 'ACTIVE') {
      if (prevStatus === 'BLOCKED' || actionType === 'UNBLOCKED') {
        resolvedAction = 'UNBLOCKED';
        store.blockedAt = null;
        store.blockedReason = undefined;
        defaultNote = 'Mở chặn và kích hoạt lại hoạt động POS cho cửa hàng.';
      } else {
        resolvedAction = 'APPROVED';
        store.approvedAt = nowIso;
        defaultNote = 'Phê duyệt hồ sơ đăng ký mới, kích hoạt trạng thái Đang hoạt động.';
      }
    } else if (status === 'BLOCKED') {
      store.blockedAt = nowIso;
      if (prevStatus === 'PENDING' || actionType === 'REJECTED') {
        resolvedAction = 'REJECTED';
        store.blockedReason =
          String(reason || '').trim() || 'Từ chối yêu cầu đăng ký cửa hàng mới.';
        defaultNote = store.blockedReason;
      } else {
        resolvedAction = 'BLOCKED';
        store.blockedReason =
          String(reason || '').trim() || 'Tạm khóa hoạt động theo yêu cầu quản trị.';
        defaultNote = store.blockedReason;
      }
    }

    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
    const sessionUserId = sessions.get(token);
    const actor = users.find((u) => u.id === sessionUserId);

    const auditLog: StoreAuditLogRecord = {
      id: `slog-${Date.now()}`,
      storeId: store.id,
      storeName: store.name,
      brandCode: store.brandCode,
      action: resolvedAction,
      fromStatus: prevStatus,
      toStatus: status,
      actorName: actor?.name || 'Nguyễn Minh Quân',
      note: String(reason || '').trim() || defaultNote,
      createdAt: nowIso,
    };
    storeAuditLogs.unshift(auditLog);

    return res.json({
      ...enrichStore(store),
      auditLog,
    });
  });

  // --- CATALOG (CATEGORIES + PRODUCTS + BRANCH STOCK) ---
  app.get('/api/catalog', (req, res) => {
    const storeId = String(req.query.storeId || 'store-1');
    const branchId = String(req.query.branchId || 'branch-1');

    const storeCategories = categories.filter((c) => c.storeId === storeId);
    const storeProducts = products
      .filter((p) => p.storeId === storeId)
      .map((p) => {
        const inv = inventory.find(
          (i) => i.productId === p.id && i.branchId === branchId
        );
        return {
          ...p,
          stock: inv ? inv.stock : 0,
        };
      });

    return res.json({
      categories: storeCategories,
      products: storeProducts,
    });
  });

  // --- CATEGORIES CRUD ---
  app.get('/api/categories', (req, res) => {
    const storeId = String(req.query.storeId || 'store-1');
    const list = categories
      .filter((c) => c.storeId === storeId)
      .map((c) => ({
        ...c,
        productCount: products.filter(
          (p) => p.storeId === storeId && p.categoryId === c.id
        ).length,
      }));
    return res.json(list);
  });

  app.post('/api/categories', (req, res) => {
    const { storeId = 'store-1', name } = req.body || {};
    const cleanName = String(name || '').trim();
    if (!cleanName) {
      return res.status(400).json({ error: 'Tên danh mục không được để trống.' });
    }
    const duplicate = categories.some(
      (c) =>
        c.storeId === storeId &&
        c.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) {
      return res
        .status(409)
        .json({ error: `Danh mục "${cleanName}" đã tồn tại trong cửa hàng.` });
    }

    const created: CategoryRecord = {
      id: `cat-${Date.now()}`,
      storeId: String(storeId),
      name: cleanName,
    };
    categories.push(created);
    return res.status(201).json({ ...created, productCount: 0 });
  });

  app.put('/api/categories/:id', (req, res) => {
    const { id } = req.params;
    const { name } = req.body || {};
    const cat = categories.find((c) => c.id === id);
    if (!cat) {
      return res.status(404).json({ error: 'Không tìm thấy danh mục.' });
    }
    const cleanName = String(name || '').trim();
    if (!cleanName) {
      return res.status(400).json({ error: 'Tên danh mục không được để trống.' });
    }
    const duplicate = categories.some(
      (c) =>
        c.id !== id &&
        c.storeId === cat.storeId &&
        c.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) {
      return res
        .status(409)
        .json({ error: `Danh mục "${cleanName}" đã tồn tại trong cửa hàng.` });
    }

    cat.name = cleanName;
    const productCount = products.filter(
      (p) => p.storeId === cat.storeId && p.categoryId === cat.id
    ).length;
    return res.json({ ...cat, productCount });
  });

  app.delete('/api/categories/:id', (req, res) => {
    const { id } = req.params;
    const idx = categories.findIndex((c) => c.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy danh mục.' });
    }
    const usedCount = products.filter((p) => p.categoryId === id).length;
    if (usedCount > 0) {
      return res.status(400).json({
        error: `Không thể xóa danh mục đang chứa ${usedCount} sản phẩm. Hãy chuyển sản phẩm sang danh mục khác trước.`,
      });
    }
    categories.splice(idx, 1);
    return res.json({ deletedId: id });
  });

  // --- PRODUCTS CRUD ---
  const enrichProduct = (p: ProductRecord) => {
    const cat = categories.find((c) => c.id === p.categoryId);
    const storeBranches = branches.filter((b) => b.storeId === p.storeId);
    const branchStocks = storeBranches.map((b) => {
      const inv = inventory.find(
        (i) => i.productId === p.id && i.branchId === b.id
      );
      return {
        branchId: b.id,
        branchName: b.name,
        stock: inv ? inv.stock : 0,
      };
    });
    const totalStock = branchStocks.reduce((sum, bs) => sum + bs.stock, 0);
    return {
      ...p,
      categoryName: cat ? cat.name : 'Chưa phân loại',
      totalStock,
      branchStocks,
    };
  };

  app.get('/api/products', (req, res) => {
    const storeId = String(req.query.storeId || 'store-1');
    const categoryId = req.query.categoryId ? String(req.query.categoryId) : '';
    const q = String(req.query.q || '').trim().toLowerCase();

    let list = products.filter((p) => p.storeId === storeId);
    if (categoryId && categoryId !== 'ALL') {
      list = list.filter((p) => p.categoryId === categoryId);
    }
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q)
      );
    }

    return res.json(list.map(enrichProduct));
  });

  app.post('/api/products', (req, res) => {
    const user = getUserFromAuthHeader(req);
    const {
      storeId = 'store-1',
      categoryId,
      name,
      sku,
      brand = 'Omni Signature',
      mrp,
      price,
      imageUrl = '',
      unit = 'Ly',
      initialStock = 0,
    } = req.body || {};

    const cleanName = String(name || '').trim();
    const cleanSku = String(sku || '').trim().toUpperCase();
    const cleanBrand = String(brand || '').trim() || 'Omni Signature';
    const cleanUnit = String(unit || '').trim() || 'Phần';
    const numPrice = Math.max(0, Number(price) || 0);
    const numMrp = Math.max(numPrice, Number(mrp) || numPrice);

    if (!cleanName || !cleanSku) {
      return res
        .status(400)
        .json({ error: 'Vui lòng nhập đầy đủ tên sản phẩm và mã SKU.' });
    }
    if (numPrice <= 0) {
      return res
        .status(400)
        .json({ error: 'Giá bán phải lớn hơn 0 ₫.' });
    }
    const catExists = categories.some(
      (c) => c.id === categoryId && c.storeId === storeId
    );
    if (!catExists) {
      return res
        .status(400)
        .json({ error: 'Vui lòng chọn danh mục sản phẩm hợp lệ.' });
    }
    const skuDuplicate = products.some(
      (p) => p.storeId === storeId && p.sku.toLowerCase() === cleanSku.toLowerCase()
    );
    if (skuDuplicate) {
      return res
        .status(409)
        .json({ error: `Mã SKU "${cleanSku}" đã tồn tại trong cửa hàng.` });
    }

    const created: ProductRecord = {
      id: `prod-${Date.now()}`,
      storeId: String(storeId),
      categoryId: String(categoryId),
      name: cleanName,
      sku: cleanSku,
      brand: cleanBrand,
      mrp: numMrp,
      price: numPrice,
      imageUrl: String(imageUrl || '').trim(),
      unit: cleanUnit,
    };
    products.unshift(created);

    const safeInitialStock = Math.max(0, Math.floor(Number(initialStock) || 0));
    const storeBranches = branches.filter((b) => b.storeId === created.storeId);
    for (const b of storeBranches) {
      inventory.push({
        productId: created.id,
        branchId: b.id,
        stock: safeInitialStock,
      });
      if (safeInitialStock > 0) {
        inventoryLogs.unshift({
          id: `invlog-${Date.now()}-${b.id}`,
          storeId: created.storeId,
          branchId: b.id,
          productId: created.id,
          productName: created.name,
          sku: created.sku,
          mode: 'IMPORT',
          previousStock: 0,
          delta: safeInitialStock,
          newStock: safeInitialStock,
          reason: 'Khởi tạo tồn kho khi thêm sản phẩm mới',
          actorName: user ? user.name : 'Quản lý',
          createdAt: new Date().toISOString(),
        });
      }
    }

    return res.status(201).json(enrichProduct(created));
  });

  app.put('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const prod = products.find((p) => p.id === id);
    if (!prod) {
      return res.status(404).json({ error: 'Không tìm thấy sản phẩm.' });
    }

    const { categoryId, name, sku, brand, mrp, price, imageUrl, unit } =
      req.body || {};

    const cleanName = String(name ?? prod.name).trim();
    const cleanSku = String(sku ?? prod.sku).trim().toUpperCase();
    const numPrice = Math.max(0, Number(price ?? prod.price) || 0);
    const numMrp = Math.max(numPrice, Number(mrp ?? prod.mrp) || numPrice);
    const nextCatId = String(categoryId ?? prod.categoryId);

    if (!cleanName || !cleanSku) {
      return res
        .status(400)
        .json({ error: 'Tên sản phẩm và mã SKU không được để trống.' });
    }
    if (numPrice <= 0) {
      return res.status(400).json({ error: 'Giá bán phải lớn hơn 0 ₫.' });
    }
    const catExists = categories.some(
      (c) => c.id === nextCatId && c.storeId === prod.storeId
    );
    if (!catExists) {
      return res
        .status(400)
        .json({ error: 'Danh mục sản phẩm không hợp lệ.' });
    }
    const skuDuplicate = products.some(
      (p) =>
        p.id !== id &&
        p.storeId === prod.storeId &&
        p.sku.toLowerCase() === cleanSku.toLowerCase()
    );
    if (skuDuplicate) {
      return res
        .status(409)
        .json({ error: `Mã SKU "${cleanSku}" đã được sử dụng bởi sản phẩm khác.` });
    }

    prod.categoryId = nextCatId;
    prod.name = cleanName;
    prod.sku = cleanSku;
    prod.brand = String(brand ?? prod.brand).trim() || 'Omni Signature';
    prod.mrp = numMrp;
    prod.price = numPrice;
    prod.imageUrl = String(imageUrl ?? prod.imageUrl).trim();
    prod.unit = String(unit ?? prod.unit).trim() || 'Phần';

    return res.json(enrichProduct(prod));
  });

  app.delete('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const idx = products.findIndex((p) => p.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy sản phẩm.' });
    }
    products.splice(idx, 1);
    for (let i = inventory.length - 1; i >= 0; i--) {
      if (inventory[i].productId === id) {
        inventory.splice(i, 1);
      }
    }
    return res.json({ deletedId: id });
  });

  // --- BRANCH INVENTORY ---
  app.get('/api/inventory', (req, res) => {
    const storeId = String(req.query.storeId || 'store-1');
    const storeBranches = branches.filter((b) => b.storeId === storeId);
    const requestedBranchId = req.query.branchId
      ? String(req.query.branchId)
      : storeBranches[0]?.id || 'branch-1';

    const branch =
      storeBranches.find((b) => b.id === requestedBranchId) || storeBranches[0];
    const resolvedBranchId = branch ? branch.id : requestedBranchId;

    const items = products
      .filter((p) => p.storeId === storeId)
      .map((p) => {
        const inv = inventory.find(
          (i) => i.productId === p.id && i.branchId === resolvedBranchId
        );
        const cat = categories.find((c) => c.id === p.categoryId);
        return {
          productId: p.id,
          branchId: resolvedBranchId,
          name: p.name,
          sku: p.sku,
          brand: p.brand,
          categoryId: p.categoryId,
          categoryName: cat ? cat.name : 'Chưa phân loại',
          unit: p.unit,
          price: p.price,
          imageUrl: p.imageUrl,
          stock: inv ? inv.stock : 0,
        };
      });

    const logs = inventoryLogs
      .filter((l) => l.storeId === storeId && l.branchId === resolvedBranchId)
      .slice(0, 30);

    return res.json({
      branches: storeBranches,
      branchId: resolvedBranchId,
      items,
      logs,
    });
  });

  app.post('/api/inventory/adjust', (req, res) => {
    const user = getUserFromAuthHeader(req);
    const {
      productId,
      branchId = 'branch-1',
      mode = 'IMPORT',
      quantity,
      reason = '',
    } = req.body || {};

    const prod = products.find((p) => p.id === productId);
    if (!prod) {
      return res.status(404).json({ error: 'Không tìm thấy sản phẩm.' });
    }
    const branchExists = branches.some((b) => b.id === branchId);
    if (!branchExists) {
      return res.status(404).json({ error: 'Không tìm thấy chi nhánh.' });
    }

    const qty = Math.floor(Number(quantity));
    if (!Number.isFinite(qty) || qty < 0) {
      return res.status(400).json({ error: 'Số lượng phải là số nguyên không âm.' });
    }
    if ((mode === 'IMPORT' || mode === 'DEDUCT') && qty <= 0) {
      return res
        .status(400)
        .json({ error: 'Số lượng nhập/xuất kho phải lớn hơn 0.' });
    }

    let inv = inventory.find(
      (i) => i.productId === productId && i.branchId === branchId
    );
    if (!inv) {
      inv = { productId, branchId, stock: 0 };
      inventory.push(inv);
    }

    const previousStock = inv.stock;
    let nextStock = previousStock;
    if (mode === 'IMPORT') {
      nextStock = previousStock + qty;
    } else if (mode === 'DEDUCT') {
      nextStock = Math.max(0, previousStock - qty);
    } else if (mode === 'SET') {
      nextStock = Math.max(0, qty);
    } else {
      return res.status(400).json({ error: 'Chế độ cập nhật kho không hợp lệ.' });
    }

    inv.stock = nextStock;
    const delta = nextStock - previousStock;

    const defaultReason =
      mode === 'IMPORT'
        ? 'Nhập bổ sung tồn kho'
        : mode === 'DEDUCT'
        ? 'Xuất kho / Hủy hàng'
        : 'Kiểm kê điều chỉnh tồn kho';

    const log: InventoryLogRecord = {
      id: `invlog-${Date.now()}`,
      storeId: prod.storeId,
      branchId,
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      mode: mode as InventoryAdjustMode,
      previousStock,
      delta,
      newStock: nextStock,
      reason: String(reason || '').trim() || defaultReason,
      actorName: user ? user.name : 'Quản lý kho',
      createdAt: new Date().toISOString(),
    };
    inventoryLogs.unshift(log);

    const cat = categories.find((c) => c.id === prod.categoryId);

    return res.json({
      item: {
        productId: prod.id,
        branchId,
        name: prod.name,
        sku: prod.sku,
        brand: prod.brand,
        categoryId: prod.categoryId,
        categoryName: cat ? cat.name : 'Chưa phân loại',
        unit: prod.unit,
        price: prod.price,
        imageUrl: prod.imageUrl,
        stock: inv.stock,
      },
      log,
    });
  });

  // --- BRANCHES CRUD ---
  const enrichBranch = (b: BranchRecord) => ({
    ...b,
    employeeCount: users.filter((u) => u.branchId === b.id).length,
    activeShiftCount: shifts.filter(
      (s) => s.branchId === b.id && s.status === 'OPEN'
    ).length,
  });

  app.get('/api/branches', (req, res) => {
    const storeId = String(req.query.storeId || 'store-1');
    const q = String(req.query.q || '').trim().toLowerCase();
    let list = branches.filter((b) => b.storeId === storeId);
    if (q) {
      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.code.toLowerCase().includes(q) ||
          b.address.toLowerCase().includes(q) ||
          b.managerName.toLowerCase().includes(q) ||
          b.phone.toLowerCase().includes(q)
      );
    }
    return res.json(list.map(enrichBranch));
  });

  app.post('/api/branches', (req, res) => {
    const {
      storeId = 'store-1',
      name,
      code,
      address,
      phone,
      workingDays = 'Thứ 2 – Chủ nhật',
      openTime = '07:00',
      closeTime = '22:00',
      managerName = '',
    } = req.body || {};

    const cleanName = String(name || '').trim();
    const cleanCode = String(code || '').trim().toUpperCase();
    const cleanAddress = String(address || '').trim();
    const cleanPhone = String(phone || '').trim();

    if (!cleanName || !cleanCode || !cleanAddress || !cleanPhone) {
      return res.status(400).json({
        error: 'Vui lòng nhập đầy đủ tên, mã chi nhánh, địa chỉ và số điện thoại.',
      });
    }

    const duplicateCode = branches.some(
      (b) =>
        b.storeId === storeId &&
        b.code.toLowerCase() === cleanCode.toLowerCase()
    );
    if (duplicateCode) {
      return res
        .status(409)
        .json({ error: `Mã chi nhánh "${cleanCode}" đã tồn tại.` });
    }

    const created: BranchRecord = {
      id: `branch-${Date.now()}`,
      storeId: String(storeId),
      name: cleanName,
      code: cleanCode,
      address: cleanAddress,
      phone: cleanPhone,
      workingDays: String(workingDays || 'Thứ 2 – Chủ nhật').trim(),
      openTime: String(openTime || '07:00').trim(),
      closeTime: String(closeTime || '22:00').trim(),
      managerName: String(managerName || 'Chưa phân công').trim(),
    };
    branches.push(created);

    // Initialize branch inventory records for all existing store products
    for (const p of products) {
      if (p.storeId === created.storeId) {
        inventory.push({
          productId: p.id,
          branchId: created.id,
          stock: 0,
        });
      }
    }

    return res.status(201).json(enrichBranch(created));
  });

  app.put('/api/branches/:id', (req, res) => {
    const { id } = req.params;
    const branch = branches.find((b) => b.id === id);
    if (!branch) {
      return res.status(404).json({ error: 'Không tìm thấy chi nhánh.' });
    }

    const {
      name,
      code,
      address,
      phone,
      workingDays,
      openTime,
      closeTime,
      managerName,
    } = req.body || {};

    const cleanName = String(name ?? branch.name).trim();
    const cleanCode = String(code ?? branch.code).trim().toUpperCase();
    const cleanAddress = String(address ?? branch.address).trim();
    const cleanPhone = String(phone ?? branch.phone).trim();

    if (!cleanName || !cleanCode || !cleanAddress || !cleanPhone) {
      return res.status(400).json({
        error: 'Tên, mã chi nhánh, địa chỉ và số điện thoại không được để trống.',
      });
    }

    const duplicateCode = branches.some(
      (b) =>
        b.id !== id &&
        b.storeId === branch.storeId &&
        b.code.toLowerCase() === cleanCode.toLowerCase()
    );
    if (duplicateCode) {
      return res
        .status(409)
        .json({ error: `Mã chi nhánh "${cleanCode}" đã được sử dụng.` });
    }

    branch.name = cleanName;
    branch.code = cleanCode;
    branch.address = cleanAddress;
    branch.phone = cleanPhone;
    branch.workingDays = String(workingDays ?? branch.workingDays).trim();
    branch.openTime = String(openTime ?? branch.openTime).trim();
    branch.closeTime = String(closeTime ?? branch.closeTime).trim();
    branch.managerName =
      String(managerName ?? branch.managerName).trim() || 'Chưa phân công';

    for (const s of shifts) {
      if (s.branchId === branch.id && s.status === 'OPEN') {
        s.branchName = branch.name;
      }
    }

    return res.json(enrichBranch(branch));
  });

  app.delete('/api/branches/:id', (req, res) => {
    const { id } = req.params;
    const idx = branches.findIndex((b) => b.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy chi nhánh.' });
    }
    const target = branches[idx];
    const storeBranchCount = branches.filter(
      (b) => b.storeId === target.storeId
    ).length;
    if (storeBranchCount <= 1) {
      return res.status(400).json({
        error: 'Cửa hàng cần duy trì tối thiểu 1 chi nhánh đang hoạt động.',
      });
    }
    const hasOpenShift = shifts.some(
      (s) => s.branchId === id && s.status === 'OPEN'
    );
    if (hasOpenShift) {
      return res.status(400).json({
        error: 'Không thể xóa chi nhánh đang có ca làm việc mở.',
      });
    }
    const staffCount = users.filter((u) => u.branchId === id).length;
    if (staffCount > 0) {
      return res.status(400).json({
        error: `Không thể xóa chi nhánh đang có ${staffCount} nhân viên trực thuộc. Hãy điều chuyển nhân sự trước.`,
      });
    }

    branches.splice(idx, 1);
    for (let i = inventory.length - 1; i >= 0; i--) {
      if (inventory[i].branchId === id) {
        inventory.splice(i, 1);
      }
    }
    return res.json({ deletedId: id });
  });

  // --- EMPLOYEES CRUD ---
  const enrichEmployee = (u: UserRecord) => {
    const br = u.branchId ? branches.find((b) => b.id === u.branchId) : null;
    const isOnShift = shifts.some(
      (s) => s.cashierId === u.id && s.status === 'OPEN'
    );
    return {
      ...sanitizeUser(u),
      branchName: br ? br.name : 'Toàn chuỗi (Cấp cửa hàng)',
      isOnShift,
    };
  };

  app.get('/api/employees', (req, res) => {
    const storeId = String(req.query.storeId || 'store-1');
    const branchId = req.query.branchId ? String(req.query.branchId) : 'ALL';
    const role = req.query.role ? String(req.query.role) : 'ALL';
    const q = String(req.query.q || '').trim().toLowerCase();

    let list = users.filter((u) => u.storeId === storeId && u.role !== 'ADMIN');
    if (branchId === 'STORE_LEVEL') {
      list = list.filter((u) => u.branchId === null);
    } else if (branchId && branchId !== 'ALL') {
      list = list.filter((u) => u.branchId === branchId);
    }
    if (role && role !== 'ALL') {
      list = list.filter((u) => u.role === role);
    }
    if (q) {
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.phone.toLowerCase().includes(q)
      );
    }
    return res.json(list.map(enrichEmployee));
  });

  app.post('/api/employees', (req, res) => {
    const {
      storeId = 'store-1',
      branchId = null,
      name,
      email,
      phone = '',
      password,
      role = 'BRANCH_CASHIER',
      status = 'ACTIVE',
    } = req.body || {};

    const cleanName = String(name || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPhone = String(phone || '').trim();
    const cleanPassword = String(password || '');

    if (!cleanName || !cleanEmail) {
      return res
        .status(400)
        .json({ error: 'Vui lòng nhập đầy đủ họ tên và email nhân viên.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Định dạng email không hợp lệ.' });
    }
    if (cleanPassword.length < 6) {
      return res
        .status(400)
        .json({ error: 'Mật khẩu khởi tạo phải có ít nhất 6 ký tự.' });
    }

    const allowedRoles: UserRole[] = [
      'STORE_MANAGER',
      'BRANCH_MANAGER',
      'BRANCH_CASHIER',
    ];
    if (!allowedRoles.includes(role)) {
      return res
        .status(400)
        .json({ error: 'Vai trò nhân viên không hợp lệ.' });
    }

    const duplicateEmail = users.some(
      (u) => u.email.toLowerCase() === cleanEmail
    );
    if (duplicateEmail) {
      return res
        .status(409)
        .json({ error: `Email "${cleanEmail}" đã được sử dụng trong hệ thống.` });
    }

    let resolvedBranchId: string | null = null;
    if (role === 'BRANCH_MANAGER' || role === 'BRANCH_CASHIER') {
      const br = branches.find(
        (b) => b.id === branchId && b.storeId === storeId
      );
      if (!br) {
        return res
          .status(400)
          .json({ error: 'Vui lòng chọn chi nhánh trực thuộc hợp lệ.' });
      }
      resolvedBranchId = br.id;
    }

    const newEmp: UserRecord = {
      id: `usr-${Date.now()}`,
      name: cleanName,
      email: cleanEmail,
      password: cleanPassword,
      phone: cleanPhone || '0900 000 000',
      role,
      storeId: String(storeId),
      branchId: resolvedBranchId,
      status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    };
    users.push(newEmp);
    return res.status(201).json(enrichEmployee(newEmp));
  });

  app.put('/api/employees/:id', (req, res) => {
    const { id } = req.params;
    const emp = users.find((u) => u.id === id && u.role !== 'ADMIN');
    if (!emp) {
      return res.status(404).json({ error: 'Không tìm thấy nhân viên.' });
    }

    const { name, email, phone, role, branchId, status, password } =
      req.body || {};

    const cleanName = String(name ?? emp.name).trim();
    const cleanEmail = String(email ?? emp.email).trim().toLowerCase();
    const cleanPhone = String(phone ?? emp.phone).trim();

    if (!cleanName || !cleanEmail) {
      return res
        .status(400)
        .json({ error: 'Họ tên và email nhân viên không được để trống.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Định dạng email không hợp lệ.' });
    }
    if (password && String(password).length < 6) {
      return res
        .status(400)
        .json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
    }

    const duplicateEmail = users.some(
      (u) => u.id !== id && u.email.toLowerCase() === cleanEmail
    );
    if (duplicateEmail) {
      return res
        .status(409)
        .json({ error: `Email "${cleanEmail}" đã thuộc về tài khoản khác.` });
    }

    const nextRole: UserRole =
      emp.role === 'STORE_ADMIN'
        ? 'STORE_ADMIN'
        : ['STORE_MANAGER', 'BRANCH_MANAGER', 'BRANCH_CASHIER'].includes(role)
        ? role
        : emp.role;

    let nextBranchId: string | null = emp.branchId;
    if (nextRole === 'STORE_ADMIN' || nextRole === 'STORE_MANAGER') {
      nextBranchId = null;
    } else {
      const targetBranchId = branchId !== undefined ? branchId : emp.branchId;
      const br = branches.find(
        (b) => b.id === targetBranchId && b.storeId === emp.storeId
      );
      if (!br) {
        return res
          .status(400)
          .json({ error: 'Vui lòng chọn chi nhánh trực thuộc hợp lệ.' });
      }
      nextBranchId = br.id;
    }

    const nextStatus: EmployeeStatus =
      emp.role === 'STORE_ADMIN'
        ? 'ACTIVE'
        : status === 'INACTIVE'
        ? 'INACTIVE'
        : 'ACTIVE';

    emp.name = cleanName;
    emp.email = cleanEmail;
    emp.phone = cleanPhone || '0900 000 000';
    emp.role = nextRole;
    emp.branchId = nextBranchId;
    emp.status = nextStatus;
    if (password && String(password).trim().length >= 6) {
      emp.password = String(password);
    }

    return res.json(enrichEmployee(emp));
  });

  app.delete('/api/employees/:id', (req, res) => {
    const actor = getUserFromAuthHeader(req);
    const { id } = req.params;
    const idx = users.findIndex((u) => u.id === id && u.role !== 'ADMIN');
    if (idx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy nhân viên.' });
    }
    const target = users[idx];
    if (target.role === 'STORE_ADMIN') {
      return res.status(400).json({
        error: 'Không thể xóa tài khoản Chủ cửa hàng.',
      });
    }
    if (actor && actor.id === target.id) {
      return res.status(400).json({
        error: 'Không thể tự xóa tài khoản đang đăng nhập.',
      });
    }
    const hasOpenShift = shifts.some(
      (s) => s.cashierId === target.id && s.status === 'OPEN'
    );
    if (hasOpenShift) {
      return res.status(400).json({
        error: 'Không thể xóa nhân viên đang có ca làm việc mở.',
      });
    }

    users.splice(idx, 1);
    return res.json({ deletedId: id });
  });

  // --- CUSTOMERS ---
  const enrichCustomer = (c: CustomerRecord) => {
    const customerOrders = orders
      .filter((o) => o.customerId === c.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      ...c,
      lastVisitAt: customerOrders[0]?.createdAt || null,
    };
  };

  app.get('/api/customers', (req, res) => {
    const storeId = String(req.query.storeId || 'store-1');
    const q = String(req.query.q || '').trim().toLowerCase();
    let list = customers.filter((c) => c.storeId === storeId);
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q)
      );
    }
    return res.json(list.map(enrichCustomer));
  });

  app.get('/api/customers/:id', (req, res) => {
    const { id } = req.params;
    const customer = customers.find((c) => c.id === id);
    if (!customer) {
      return res.status(404).json({ error: 'Không tìm thấy khách hàng.' });
    }
    const customerOrders = orders
      .filter((o) => o.customerId === customer.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return res.json({
      customer: enrichCustomer(customer),
      orders: customerOrders,
    });
  });

  app.post('/api/customers', (req, res) => {
    const { storeId = 'store-1', name, phone, email = '' } = req.body || {};
    const cleanName = String(name || '').trim();
    const cleanPhone = String(phone || '').trim();
    const cleanEmail = String(email || '').trim();
    if (!cleanName || !cleanPhone) {
      return res
        .status(400)
        .json({ error: 'Vui lòng nhập tên và số điện thoại khách hàng.' });
    }
    const normalizedPhone = cleanPhone.replace(/\s+/g, '');
    const duplicatePhone = customers.some(
      (c) =>
        c.storeId === storeId &&
        c.phone.replace(/\s+/g, '') === normalizedPhone
    );
    if (duplicatePhone) {
      return res.status(409).json({
        error: `Số điện thoại "${cleanPhone}" đã được đăng ký cho khách hàng khác.`,
      });
    }
    const created: CustomerRecord = {
      id: `cust-${Date.now()}`,
      storeId: String(storeId),
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      points: 0,
      totalSpent: 0,
      visitCount: 0,
    };
    customers.unshift(created);
    return res.status(201).json(enrichCustomer(created));
  });

  app.put('/api/customers/:id', (req, res) => {
    const { id } = req.params;
    const customer = customers.find((c) => c.id === id);
    if (!customer) {
      return res.status(404).json({ error: 'Không tìm thấy khách hàng.' });
    }
    const { name, phone, email, points } = req.body || {};
    const cleanName = String(name ?? customer.name).trim();
    const cleanPhone = String(phone ?? customer.phone).trim();
    const cleanEmail = String(email ?? customer.email).trim();

    if (!cleanName || !cleanPhone) {
      return res
        .status(400)
        .json({ error: 'Tên và số điện thoại khách hàng không được để trống.' });
    }

    const normalizedPhone = cleanPhone.replace(/\s+/g, '');
    const duplicatePhone = customers.some(
      (c) =>
        c.id !== id &&
        c.storeId === customer.storeId &&
        c.phone.replace(/\s+/g, '') === normalizedPhone
    );
    if (duplicatePhone) {
      return res.status(409).json({
        error: `Số điện thoại "${cleanPhone}" đã thuộc về khách hàng khác.`,
      });
    }

    customer.name = cleanName;
    customer.phone = cleanPhone;
    customer.email = cleanEmail;
    if (points !== undefined && Number.isFinite(Number(points))) {
      customer.points = Math.max(0, Math.floor(Number(points)));
    }

    for (const o of orders) {
      if (o.customerId === customer.id) {
        o.customerName = customer.name;
      }
    }

    return res.json(enrichCustomer(customer));
  });

  app.delete('/api/customers/:id', (req, res) => {
    const { id } = req.params;
    const idx = customers.findIndex((c) => c.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy khách hàng.' });
    }
    customers.splice(idx, 1);
    return res.json({ deletedId: id });
  });

  // --- SHIFTS ---
  app.get('/api/shifts', (req, res) => {
    const storeId = req.query.storeId ? String(req.query.storeId) : null;
    const branchId = req.query.branchId ? String(req.query.branchId) : null;
    let list = [...shifts];
    if (storeId) {
      list = list.filter((s) => s.storeId === storeId);
    }
    if (branchId && branchId !== 'ALL') {
      list = list.filter((s) => s.branchId === branchId);
    }
    return res.json(
      list
        .sort((a, b) => b.openedAt.localeCompare(a.openedAt))
        .map(computeShiftSummary)
    );
  });

  app.get('/api/shifts/active', (req, res) => {
    const user = getUserFromAuthHeader(req);
    const cashierId = user ? user.id : String(req.query.cashierId || '');
    const active = shifts.find(
      (s) => s.cashierId === cashierId && s.status === 'OPEN'
    );
    return res.json(active ? computeShiftSummary(active) : null);
  });

  app.post('/api/shifts/open', (req, res) => {
    const user = getUserFromAuthHeader(req);
    const {
      cashierId,
      cashierName,
      storeId = 'store-1',
      branchId = 'branch-1',
      registerName = 'Quầy POS 01',
      openingCash = 0,
      openingNote = '',
    } = req.body || {};

    const resolvedCashierId = user ? user.id : cashierId;
    const resolvedCashierName = user ? user.name : cashierName || 'Thu ngân';

    const existing = shifts.find(
      (s) => s.cashierId === resolvedCashierId && s.status === 'OPEN'
    );
    if (existing) {
      return res.json(computeShiftSummary(existing));
    }

    const branch = branches.find((b) => b.id === branchId);
    const shiftNumber = String(shifts.length + 1).padStart(3, '0');
    const newShift: ShiftRecord = {
      id: `shift-${Date.now()}`,
      shiftCode: `CA-${shiftNumber}`,
      storeId,
      branchId,
      branchName: branch ? branch.name : 'Chi nhánh chính',
      registerName,
      cashierId: resolvedCashierId,
      cashierName: resolvedCashierName,
      status: 'OPEN',
      openedAt: new Date().toISOString(),
      closedAt: null,
      openingCash: Math.max(0, Number(openingCash) || 0),
      actualCash: null,
      openingNote: String(openingNote || ''),
      closingNote: '',
    };
    shifts.unshift(newShift);
    return res.status(201).json(computeShiftSummary(newShift));
  });

  app.post('/api/shifts/:id/close', (req, res) => {
    const { id } = req.params;
    const { actualCash, closingNote = '' } = req.body || {};
    const shift = shifts.find((s) => s.id === id);
    if (!shift) return res.status(404).json({ error: 'Không tìm thấy ca làm việc.' });
    if (shift.status === 'CLOSED') {
      return res.json(computeShiftSummary(shift));
    }

    shift.status = 'CLOSED';
    shift.closedAt = new Date().toISOString();
    shift.actualCash = Math.max(0, Number(actualCash) || 0);
    shift.closingNote = String(closingNote || '');

    return res.json(computeShiftSummary(shift));
  });

  // --- ORDERS ---
  app.get('/api/orders', (req, res) => {
    const storeId = req.query.storeId ? String(req.query.storeId) : null;
    const shiftId = req.query.shiftId ? String(req.query.shiftId) : null;
    const branchId = req.query.branchId ? String(req.query.branchId) : null;

    let list = [...orders];
    if (storeId) {
      list = list.filter((o) => o.storeId === storeId);
    }
    if (shiftId) {
      list = list.filter((o) => o.shiftId === shiftId);
    } else if (branchId && branchId !== 'ALL') {
      list = list.filter((o) => o.branchId === branchId);
    }
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return res.json(list.map(enrichOrder));
  });

  app.post('/api/orders', (req, res) => {
    const user = getUserFromAuthHeader(req);
    const {
      storeId = 'store-1',
      branchId = 'branch-1',
      shiftId,
      customerId = null,
      items = [],
      discountAmount = 0,
      discountLabel = '',
      paymentMethod = 'CASH',
      cashTendered = 0,
      paymentRef = '',
    } = req.body || {};

    if (!shiftId) {
      return res.status(400).json({ error: 'Chưa có ca làm việc đang mở.' });
    }
    const shift = shifts.find((s) => s.id === shiftId && s.status === 'OPEN');
    if (!shift) {
      return res.status(400).json({ error: 'Ca làm việc không hợp lệ hoặc đã đóng.' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Giỏ hàng trống, không thể tạo đơn.' });
    }

    const orderItems: OrderItemRecord[] = [];
    let subtotal = 0;

    for (const raw of items) {
      const prod = products.find((p) => p.id === raw.productId);
      if (!prod) continue;
      const qty = Math.max(1, Number(raw.quantity) || 1);
      const lineTotal = prod.price * qty;
      subtotal += lineTotal;
      orderItems.push({
        id: `oi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId: prod.id,
        name: prod.name,
        sku: prod.sku,
        unitPrice: prod.price,
        quantity: qty,
        lineTotal,
        note: String(raw.note || ''),
      });

      // Decrement branch inventory safely
      const inv = inventory.find(
        (i) => i.productId === prod.id && i.branchId === branchId
      );
      if (inv) {
        inv.stock = Math.max(0, inv.stock - qty);
      }
    }

    const safeDiscount = Math.min(subtotal, Math.max(0, Number(discountAmount) || 0));
    const totalAmount = Math.max(0, subtotal - safeDiscount);
    const resolvedTendered =
      paymentMethod === 'CASH'
        ? Math.max(totalAmount, Number(cashTendered) || totalAmount)
        : totalAmount;
    const changeDue =
      paymentMethod === 'CASH' ? Math.max(0, resolvedTendered - totalAmount) : 0;

    const customer = customerId
      ? customers.find((c) => c.id === customerId) || null
      : null;

    if (customer) {
      customer.visitCount += 1;
      customer.totalSpent += totalAmount;
      customer.points += Math.floor(totalAmount / 10000);
    }

    const seq = String(orders.length + 1).padStart(3, '0');
    const now = new Date();
    const dateStamp = `${String(now.getFullYear()).slice(2)}${String(
      now.getMonth() + 1
    ).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

    const newOrder: OrderRecord = {
      id: `ord-${Date.now()}`,
      receiptCode: `HD-${dateStamp}-${seq}`,
      storeId,
      branchId,
      shiftId,
      cashierId: user ? user.id : shift.cashierId,
      cashierName: user ? user.name : shift.cashierName,
      customerId: customer ? customer.id : null,
      customerName: customer ? customer.name : 'Khách lẻ',
      items: orderItems,
      subtotal,
      discountAmount: safeDiscount,
      discountLabel: String(discountLabel || ''),
      taxAmount: 0,
      totalAmount,
      paymentMethod,
      cashTendered: resolvedTendered,
      changeDue,
      paymentRef: String(paymentRef || ''),
      status: 'COMPLETED',
      refundedAmount: 0,
      createdAt: now.toISOString(),
    };

    orders.unshift(newOrder);

    return res.status(201).json({
      order: enrichOrder(newOrder),
      shift: computeShiftSummary(shift),
    });
  });

  // --- REFUNDS ---
  app.get('/api/refunds', (req, res) => {
    const storeId = req.query.storeId ? String(req.query.storeId) : null;
    const shiftId = req.query.shiftId ? String(req.query.shiftId) : null;
    const branchId = req.query.branchId ? String(req.query.branchId) : null;
    let list = [...refunds];
    if (storeId) list = list.filter((r) => r.storeId === storeId);
    if (shiftId) list = list.filter((r) => r.shiftId === shiftId);
    else if (branchId && branchId !== 'ALL')
      list = list.filter((r) => r.branchId === branchId);
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return res.json(list.map(enrichRefund));
  });

  app.post('/api/refunds', (req, res) => {
    const user = getUserFromAuthHeader(req);
    const {
      orderId,
      shiftId,
      amount,
      reason,
      note = '',
      method = 'CASH',
    } = req.body || {};

    const order = orders.find((o) => o.id === orderId);
    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' });

    const remaining = order.totalAmount - order.refundedAmount;
    const refundAmt = Math.max(0, Number(amount) || 0);
    if (refundAmt <= 0 || refundAmt > remaining) {
      return res.status(400).json({
        error: `Số tiền hoàn phải lớn hơn 0 và không vượt quá ${remaining.toLocaleString('vi-VN')} ₫.`,
      });
    }

    const activeShiftId = shiftId || order.shiftId;
    const seq = String(refunds.length + 1).padStart(3, '0');
    const cleanReason = String(reason || '').trim() || 'Khách yêu cầu hoàn tiền';
    const cleanNote = String(note || '').trim();
    const combinedReason = cleanNote ? `${cleanReason} — ${cleanNote}` : cleanReason;

    const newRefund: RefundRecord = {
      id: `ref-${Date.now()}`,
      refundCode: `HT-${seq}`,
      orderId: order.id,
      receiptCode: order.receiptCode,
      storeId: order.storeId,
      branchId: order.branchId,
      shiftId: activeShiftId,
      cashierId: user ? user.id : order.cashierId,
      cashierName: user ? user.name : order.cashierName,
      amount: refundAmt,
      reason: combinedReason,
      method,
      createdAt: new Date().toISOString(),
    };

    refunds.unshift(newRefund);
    order.refundedAmount += refundAmt;
    order.status =
      order.refundedAmount >= order.totalAmount
        ? 'REFUNDED'
        : 'PARTIALLY_REFUNDED';

    const shift = shifts.find((s) => s.id === activeShiftId);

    return res.status(201).json({
      refund: enrichRefund(newRefund),
      order: enrichOrder(order),
      shift: shift ? computeShiftSummary(shift) : null,
    });
  });

  // Vite middleware in development, static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Omni Nexus POS server listening on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
