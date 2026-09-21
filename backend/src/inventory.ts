export type StockMovementType = 'SALE' | 'RETURN' | 'RECEIVE' | 'AUDIT_ADJUSTMENT' | 'RESERVE' | 'RELEASE';

export type ProductStatus = 'Healthy' | 'Watch' | 'Reorder';

export type ReturnReason =
  | 'Damaged Product'
  | 'Expired Item'
  | 'Defective Goods'
  | 'Wrong Item / Size'
  | 'Customer Changed Mind'
  | 'Packaging Compromised';

export type Category = {
  id: number;
  name: string;
  description: string;
  displayOrder: number;
};

export type Product = {
  id: number;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  supplierId: number;
  stock: number;
  qtyReserved: number;
  reorderPoint: number;
  reorderQuantity: number;
  unitCost: number;
  price: number;
  warehouse: string;
  warehouseId: string;
  binLocation: string;
  imageUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProductSnapshot = Product & {
  availableStock: number;
  status: ProductStatus;
};

export type StockMovement = {
  id: number;
  productId: number;
  sku: string;
  type: StockMovementType;
  quantity: number;
  timestamp: string;
  notes?: string;
  actor?: string;
  reference?: string;
  warehouseId?: string;
  binLocation?: string;
};

export type SaleLineInput = {
  productId: number;
  quantity: number;
};

export type SaleLine = SaleLineInput & {
  sku: string;
  name: string;
  unitPrice: number;
  lineTotal: number;
};

export type SaleReceipt = {
  id: number;
  receiptNumber: string;
  items: SaleLine[];
  subtotal: number;
  vatAmount: number;
  discountAmount: number;
  total: number;
  paymentMethod: 'CASH' | 'CARD' | 'QR';
  tenderAmount?: number;
  changeAmount?: number;
  cashierName: string;
  cashierEmployeeId: string;
  createdAt: string;
  notes?: string;
};

export type CustomerOrderStatus = 'PENDING' | 'RESERVED' | 'PAID' | 'PICKING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export type CustomerOrder = {
  id: number;
  orderNumber: string;
  customerName: string;
  status: CustomerOrderStatus;
  items: SaleLine[];
  total: number;
  createdAt: string;
  updatedAt: string;
  trackingNumber?: string;
  shippingAddress?: string;
};

export type CycleCountEntry = {
  id: number;
  auditNumber: string;
  warehouseId: string;
  binCode: string;
  items: Array<{
    productId: number;
    sku: string;
    productName: string;
    systemQty: number;
    countedQty: number;
    discrepancy: number;
    verified: boolean;
  }>;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'RECONCILED';
  performedBy: string;
  performedAt: string;
  managerNotes?: string;
};

export const categories: Category[] = [
  { id: 1, name: 'Dairy & Fresh', description: 'Perishable dairy and cold beverages', displayOrder: 1 },
  { id: 2, name: 'Bakery', description: 'Freshly baked bread, rolls and pastries', displayOrder: 2 },
  { id: 3, name: 'Groceries & Dry Goods', description: 'Pantry staples, rice, grains, sugar', displayOrder: 3 },
  { id: 4, name: 'Beverages & Coffee', description: 'Premium coffee beans, tea, juices', displayOrder: 4 },
  { id: 5, name: 'Health & Beauty', description: 'Skincare, soap, personal care products', displayOrder: 5 },
  { id: 6, name: 'Electronics & Audio', description: 'Speakers, chargers, tech accessories', displayOrder: 6 },
  { id: 7, name: 'Office Supplies', description: 'Stationery, paper, office consumables', displayOrder: 7 },
  { id: 8, name: 'Home & Garden', description: 'Planters, home decor, cleaning supplies', displayOrder: 8 },
];

const timestampToday = (hour: number, minute: number, daysAgo = 0): string => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  date.setUTCHours(hour, minute, 0, 0);
  return date.toISOString();
};

export const products: Product[] = [
  {
    id: 1,
    sku: 'MILK-001',
    barcode: '6001001000011',
    name: 'Fresh Full Cream Milk 1L',
    category: 'Dairy & Fresh',
    supplierId: 1,
    stock: 42,
    qtyReserved: 2,
    reorderPoint: 20,
    reorderQuantity: 48,
    unitCost: 17.2,
    price: 25.5,
    warehouse: 'Johannesburg Central (JHB-01)',
    warehouseId: 'JHB-01',
    binLocation: 'A-01',
    imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=200&auto=format&fit=crop&q=60',
    isActive: true,
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: '2026-02-28T09:00:00.000Z',
  },
  {
    id: 2,
    sku: 'BREAD-001',
    barcode: '6001001000028',
    name: 'White Bread Loaf (Sliced)',
    category: 'Bakery',
    supplierId: 1,
    stock: 18,
    qtyReserved: 0,
    reorderPoint: 25,
    reorderQuantity: 60,
    unitCost: 11.4,
    price: 18.2,
    warehouse: 'Johannesburg Central (JHB-01)',
    warehouseId: 'JHB-01',
    binLocation: 'A-03',
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=200&auto=format&fit=crop&q=60',
    isActive: true,
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: '2026-02-28T09:00:00.000Z',
  },
  {
    id: 3,
    sku: 'RICE-001',
    barcode: '6001001000035',
    name: 'Long Grain Parboiled Rice 2kg',
    category: 'Groceries & Dry Goods',
    supplierId: 2,
    stock: 64,
    qtyReserved: 4,
    reorderPoint: 30,
    reorderQuantity: 36,
    unitCost: 29.5,
    price: 42.0,
    warehouse: 'Cape Town Facility (CPT-02)',
    warehouseId: 'CPT-02',
    binLocation: 'B-04',
    imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=200&auto=format&fit=crop&q=60',
    isActive: true,
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: '2026-02-28T09:00:00.000Z',
  },
  {
    id: 4,
    sku: 'ELEC-003',
    barcode: '6001001000042',
    name: 'Portable Bluetooth Speaker',
    category: 'Electronics & Audio',
    supplierId: 3,
    stock: 7,
    qtyReserved: 1,
    reorderPoint: 10,
    reorderQuantity: 20,
    unitCost: 450.0,
    price: 899.99,
    warehouse: 'Johannesburg Central (JHB-01)',
    warehouseId: 'JHB-01',
    binLocation: 'C3-042',
    imageUrl: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=200&auto=format&fit=crop&q=60',
    isActive: true,
    createdAt: '2026-01-12T08:00:00.000Z',
    updatedAt: '2026-02-28T09:00:00.000Z',
  },
  {
    id: 5,
    sku: 'FOOD-002',
    barcode: '6001001000059',
    name: 'Green Tea Collection Box 50s',
    category: 'Beverages & Coffee',
    supplierId: 2,
    stock: 3,
    qtyReserved: 0,
    reorderPoint: 10,
    reorderQuantity: 25,
    unitCost: 65.0,
    price: 129.99,
    warehouse: 'Johannesburg Central (JHB-01)',
    warehouseId: 'JHB-01',
    binLocation: 'B-02',
    imageUrl: 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=200&auto=format&fit=crop&q=60',
    isActive: true,
    createdAt: '2026-01-12T08:00:00.000Z',
    updatedAt: '2026-02-28T09:00:00.000Z',
  },
  {
    id: 6,
    sku: 'OFF-001',
    barcode: '6001001000066',
    name: 'A4 Executive Notebook 5-Pack',
    category: 'Office Supplies',
    supplierId: 4,
    stock: 4,
    qtyReserved: 0,
    reorderPoint: 10,
    reorderQuantity: 30,
    unitCost: 45.0,
    price: 89.0,
    warehouse: 'Cape Town Facility (CPT-02)',
    warehouseId: 'CPT-02',
    binLocation: 'D-01',
    imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=200&auto=format&fit=crop&q=60',
    isActive: true,
    createdAt: '2026-01-14T08:00:00.000Z',
    updatedAt: '2026-02-28T09:00:00.000Z',
  },
  {
    id: 7,
    sku: 'HLTH-001',
    barcode: '6001001000073',
    name: 'Natural Hydrating Face Moisturizer 100ml',
    category: 'Health & Beauty',
    supplierId: 3,
    stock: 39,
    qtyReserved: 3,
    reorderPoint: 15,
    reorderQuantity: 40,
    unitCost: 140.0,
    price: 289.99,
    warehouse: 'Johannesburg Central (JHB-01)',
    warehouseId: 'JHB-01',
    binLocation: 'C-01',
    imageUrl: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=200&auto=format&fit=crop&q=60',
    isActive: true,
    createdAt: '2026-01-14T08:00:00.000Z',
    updatedAt: '2026-02-28T09:00:00.000Z',
  },
  {
    id: 8,
    sku: 'FOOD-001',
    barcode: '6001001000080',
    name: 'Organic Arabica Coffee Beans 1kg',
    category: 'Beverages & Coffee',
    supplierId: 2,
    stock: 50,
    qtyReserved: 5,
    reorderPoint: 20,
    reorderQuantity: 30,
    unitCost: 85.0,
    price: 170.0,
    warehouse: 'Johannesburg Central (JHB-01)',
    warehouseId: 'JHB-01',
    binLocation: 'B-01',
    imageUrl: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=200&auto=format&fit=crop&q=60',
    isActive: true,
    createdAt: '2026-01-15T08:00:00.000Z',
    updatedAt: '2026-02-28T09:00:00.000Z',
  },
  {
    id: 9,
    sku: 'CLO-001',
    barcode: '6001001000097',
    name: 'Cotton Crew Neck T-Shirt (Black/M)',
    category: 'Home & Garden',
    supplierId: 4,
    stock: 120,
    qtyReserved: 8,
    reorderPoint: 40,
    reorderQuantity: 100,
    unitCost: 80.0,
    price: 199.9,
    warehouse: 'Cape Town Facility (CPT-02)',
    warehouseId: 'CPT-02',
    binLocation: 'E-03',
    imageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=200&auto=format&fit=crop&q=60',
    isActive: true,
    createdAt: '2026-01-15T08:00:00.000Z',
    updatedAt: '2026-02-28T09:00:00.000Z',
  },
  {
    id: 10,
    sku: 'HOME-002',
    barcode: '6001001000103',
    name: 'Ceramic Indoor Plant Pot Large',
    category: 'Home & Garden',
    supplierId: 4,
    stock: 18,
    qtyReserved: 0,
    reorderPoint: 15,
    reorderQuantity: 25,
    unitCost: 75.0,
    price: 159.99,
    warehouse: 'Johannesburg Central (JHB-01)',
    warehouseId: 'JHB-01',
    binLocation: 'F-02',
    imageUrl: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=200&auto=format&fit=crop&q=60',
    isActive: true,
    createdAt: '2026-01-18T08:00:00.000Z',
    updatedAt: '2026-02-28T09:00:00.000Z',
  },
  {
    id: 11,
    sku: 'CLO-002',
    barcode: '6001001000110',
    name: 'Denim Jeans Slim Fit 32W',
    category: 'Home & Garden',
    supplierId: 4,
    stock: 35,
    qtyReserved: 2,
    reorderPoint: 20,
    reorderQuantity: 30,
    unitCost: 220.0,
    price: 499.99,
    warehouse: 'Cape Town Facility (CPT-02)',
    warehouseId: 'CPT-02',
    binLocation: 'E-01',
    imageUrl: 'https://images.unsplash.com/photo-1542272604-780c96856592?w=200&auto=format&fit=crop&q=60',
    isActive: true,
    createdAt: '2026-01-20T08:00:00.000Z',
    updatedAt: '2026-02-28T09:00:00.000Z',
  },
];

export const stockMovements: StockMovement[] = [
  {
    id: 1,
    productId: 1,
    sku: 'MILK-001',
    type: 'SALE',
    quantity: 7,
    timestamp: timestampToday(8, 45),
    notes: 'POS Till Sale',
    actor: 'Thandi Molefe (EMP-CSH-201)',
    reference: 'REC-2026-1001',
    warehouseId: 'JHB-01',
    binLocation: 'A-01',
  },
  {
    id: 2,
    productId: 2,
    sku: 'BREAD-001',
    type: 'SALE',
    quantity: 14,
    timestamp: timestampToday(9, 5),
    notes: 'Morning rush POS sale',
    actor: 'Thandi Molefe (EMP-CSH-201)',
    reference: 'REC-2026-1002',
    warehouseId: 'JHB-01',
    binLocation: 'A-03',
  },
  {
    id: 3,
    productId: 3,
    sku: 'RICE-001',
    type: 'RETURN',
    quantity: 1,
    timestamp: timestampToday(9, 12),
    notes: 'Damaged Product customer return',
    actor: 'Thandi Molefe (EMP-CSH-201)',
    reference: 'RTN-2026-00045',
    warehouseId: 'CPT-02',
    binLocation: 'B-04',
  },
  {
    id: 4,
    productId: 4,
    sku: 'ELEC-003',
    type: 'RECEIVE',
    quantity: 20,
    timestamp: timestampToday(10, 30),
    notes: 'Supplier delivery verified against PO-1001',
    actor: 'Hlonela Dlamini (EMP-WRH-301)',
    reference: 'GRN-PO-1001',
    warehouseId: 'JHB-01',
    binLocation: 'C3-042',
  },
  {
    id: 5,
    productId: 5,
    sku: 'FOOD-002',
    type: 'SALE',
    quantity: 5,
    timestamp: timestampToday(14, 20, 1),
    notes: 'POS Sale',
    actor: 'Thandi Molefe (EMP-CSH-201)',
    reference: 'REC-2026-0998',
    warehouseId: 'JHB-01',
    binLocation: 'B-02',
  },
  {
    id: 6,
    productId: 6,
    sku: 'OFF-001',
    type: 'AUDIT_ADJUSTMENT',
    quantity: 1,
    timestamp: timestampToday(16, 0, 1),
    notes: 'Reconciliation during cycle count audit',
    actor: 'Hlonela Dlamini (EMP-WRH-301)',
    reference: 'AUD-2026-012',
    warehouseId: 'CPT-02',
    binLocation: 'D-01',
  },
];

export const salesReceipts: SaleReceipt[] = [
  {
    id: 1,
    receiptNumber: 'REC-2026-1001',
    items: [
      { productId: 1, sku: 'MILK-001', name: 'Fresh Full Cream Milk 1L', quantity: 2, unitPrice: 25.5, lineTotal: 51.0 },
      { productId: 2, sku: 'BREAD-001', name: 'White Bread Loaf (Sliced)', quantity: 1, unitPrice: 18.2, lineTotal: 18.2 },
    ],
    subtotal: 60.17,
    vatAmount: 9.03,
    discountAmount: 0,
    total: 69.2,
    paymentMethod: 'CASH',
    tenderAmount: 100.0,
    changeAmount: 30.8,
    cashierName: 'Thandi Molefe',
    cashierEmployeeId: 'EMP-CSH-201',
    createdAt: timestampToday(8, 45),
  },
  {
    id: 2,
    receiptNumber: 'INV-2024-00123',
    items: [
      { productId: 4, sku: 'ELEC-003', name: 'Portable Bluetooth Speaker', quantity: 1, unitPrice: 899.99, lineTotal: 899.99 },
      { productId: 5, sku: 'FOOD-002', name: 'Green Tea Collection Box 50s', quantity: 2, unitPrice: 129.99, lineTotal: 259.98 },
    ],
    subtotal: 1008.67,
    vatAmount: 151.3,
    discountAmount: 0,
    total: 1159.97,
    paymentMethod: 'CARD',
    cashierName: 'Thandi Molefe',
    cashierEmployeeId: 'EMP-CSH-201',
    createdAt: timestampToday(9, 30, 1),
  },
];

export const cycleCounts: CycleCountEntry[] = [
  {
    id: 1,
    auditNumber: 'AUD-2026-001',
    warehouseId: 'JHB-01',
    binCode: 'C3-042',
    items: [
      { productId: 4, sku: 'ELEC-003', productName: 'Portable Bluetooth Speaker', systemQty: 7, countedQty: 7, discrepancy: 0, verified: true },
    ],
    status: 'APPROVED',
    performedBy: 'Hlonela Dlamini (EMP-WRH-301)',
    performedAt: timestampToday(11, 0, 1),
    managerNotes: 'Count matches perfectly. Approved by Jayden Khoza.',
  },
];

export const customerOrders: CustomerOrder[] = [
  {
    id: 1,
    orderNumber: 'ORD-MP12XR57',
    customerName: 'Sipho Sithole',
    status: 'PAID',
    items: [
      { productId: 4, sku: 'ELEC-003', name: 'Portable Bluetooth Speaker', quantity: 1, unitPrice: 899.99, lineTotal: 899.99 },
      { productId: 7, sku: 'HLTH-001', name: 'Natural Hydrating Face Moisturizer 100ml', quantity: 1, unitPrice: 284.49, lineTotal: 284.49 },
    ],
    total: 1184.48,
    createdAt: timestampToday(10, 46),
    updatedAt: timestampToday(10, 50),
    trackingNumber: 'TRK-ZA-99214',
    shippingAddress: '45 Rivonia Rd, Sandton, Johannesburg',
  },
  {
    id: 2,
    orderNumber: 'ORD-MOUDIG6G',
    customerName: 'Sarah Jenkins',
    status: 'PICKING',
    items: [
      { productId: 5, sku: 'FOOD-002', name: 'Green Tea Collection Box 50s', quantity: 1, unitPrice: 129.99, lineTotal: 129.99 },
      { productId: 2, sku: 'BREAD-001', name: 'White Bread Loaf (Sliced)', quantity: 1, unitPrice: 19.5, lineTotal: 19.5 },
    ],
    total: 149.49,
    createdAt: timestampToday(12, 11),
    updatedAt: timestampToday(12, 15),
    trackingNumber: 'TRK-ZA-99215',
    shippingAddress: '12 Beach Rd, Sea Point, Cape Town',
  },
  {
    id: 3,
    orderNumber: 'ORD-MOU0W3K2',
    customerName: 'Nandi Gumede',
    status: 'PAID',
    items: [
      { productId: 8, sku: 'FOOD-001', name: 'Organic Arabica Coffee Beans 1kg', quantity: 1, unitPrice: 170.0, lineTotal: 170.0 },
      { productId: 10, sku: 'HOME-002', name: 'Ceramic Indoor Plant Pot Large', quantity: 1, unitPrice: 159.99, lineTotal: 159.99 },
      { productId: 6, sku: 'OFF-001', name: 'A4 Executive Notebook 5-Pack', quantity: 1, unitPrice: 3.5, lineTotal: 3.5 },
    ],
    total: 333.49,
    createdAt: timestampToday(12, 15),
    updatedAt: timestampToday(12, 20),
    trackingNumber: 'TRK-ZA-99216',
    shippingAddress: '88 Florida Rd, Morningside, Durban',
  },
];

export const findProductById = (id: number): Product | undefined => {
  return products.find((p) => p.id === id);
};

export const findProductBySku = (sku: string): Product | undefined => {
  const normalized = sku.trim().toUpperCase();
  return products.find((p) => p.sku.toUpperCase() === normalized);
};

export const stockAfterSale = (currentStock: number, quantity: number): number => {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Quantity must be a positive whole number');
  }
  if (quantity > currentStock) {
    throw new Error('Insufficient stock available');
  }
  return currentStock - quantity;
};

export const stockAfterReturn = (currentStock: number, quantity: number): number => {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Quantity must be a positive whole number');
  }
  return currentStock + quantity;
};

export const stockAfterReceive = (currentStock: number, quantity: number): number => {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Quantity must be a positive whole number');
  }
  return currentStock + quantity;
};

export const getAvailableStock = (product: Product): number => {
  return Math.max(0, product.stock - (product.qtyReserved ?? 0));
};

export const getProductStatus = (product: Product): ProductStatus => {
  const available = getAvailableStock(product);
  if (available === 0) return 'Reorder';
  if (available <= product.reorderPoint) return 'Watch';
  return 'Healthy';
};

export const toProductSnapshot = (product: Product): ProductSnapshot => {
  return {
    ...product,
    availableStock: getAvailableStock(product),
    status: getProductStatus(product),
  };
};

export const getProductSnapshots = (): ProductSnapshot[] => {
  return products.filter((p) => p.isActive).map(toProductSnapshot);
};

export const getLowStockProducts = (): ProductSnapshot[] => {
  return getProductSnapshots().filter((product) => product.availableStock <= product.reorderPoint);
};

export const createProduct = (data: {
  sku: string;
  barcode: string;
  name: string;
  category: string;
  supplierId: number;
  stock: number;
  reorderPoint: number;
  reorderQuantity: number;
  unitCost: number;
  price: number;
  warehouse?: string;
  warehouseId?: string;
  binLocation: string;
  imageUrl?: string;
}): ProductSnapshot => {
  const newProduct: Product = {
    id: products.length + 1,
    sku: data.sku.toUpperCase(),
    barcode: data.barcode,
    name: data.name,
    category: data.category,
    supplierId: Number(data.supplierId),
    stock: Number(data.stock),
    qtyReserved: 0,
    reorderPoint: Number(data.reorderPoint),
    reorderQuantity: Number(data.reorderQuantity),
    unitCost: Number(data.unitCost),
    price: Number(data.price),
    warehouse: data.warehouse || 'Johannesburg Central (JHB-01)',
    warehouseId: data.warehouseId || 'JHB-01',
    binLocation: data.binLocation,
    imageUrl: data.imageUrl || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=200&auto=format&fit=crop&q=60',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  products.push(newProduct);
  return toProductSnapshot(newProduct);
};

export const createSaleTransaction = (
  items: SaleLineInput[],
  options?: {
    cashierName?: string;
    cashierEmployeeId?: string;
    paymentMethod?: 'CASH' | 'CARD' | 'QR';
    discountPercent?: number;
    tenderAmount?: number;
    notes?: string;
  }
): { receipt: SaleReceipt; movements: StockMovement[] } => {
  if (!items || items.length === 0) {
    throw new Error('Sale requires at least one item');
  }

  const lines: SaleLine[] = [];
  const movements: StockMovement[] = [];

  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error(`Invalid quantity ${item.quantity} for product ID ${item.productId}`);
    }

    const product = products.find((p) => p.id === item.productId && p.isActive);
    if (!product) {
      throw new Error(`Product not found: ID ${item.productId}`);
    }

    const available = getAvailableStock(product);
    if (item.quantity > available) {
      throw new Error(
        `Insufficient stock for ${product.name} (SKU: ${product.sku}). Requested: ${item.quantity}, Available: ${available}`
      );
    }
  }

  const receiptNumber = `REC-${Date.now().toString().slice(-6)}`;
  let subtotal = 0;

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId)!;
    product.stock -= item.quantity;
    product.updatedAt = new Date().toISOString();

    const lineTotal = Number((product.price * item.quantity).toFixed(2));
    subtotal += lineTotal;

    lines.push({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      quantity: item.quantity,
      unitPrice: product.price,
      lineTotal,
    });

    const movement: StockMovement = {
      id: stockMovements.length + 1,
      productId: product.id,
      sku: product.sku,
      type: 'SALE',
      quantity: item.quantity,
      timestamp: new Date().toISOString(),
      notes: options?.notes || `POS Sale receipt ${receiptNumber}`,
      actor: options?.cashierName ? `${options.cashierName} (${options.cashierEmployeeId ?? 'STAFF'})` : 'Cashier',
      reference: receiptNumber,
      warehouseId: product.warehouseId,
      binLocation: product.binLocation,
    };

    stockMovements.unshift(movement);
    movements.push(movement);
  }

  const discountPercent = options?.discountPercent ?? 0;
  const discountAmount = Number(((subtotal * discountPercent) / 100).toFixed(2));
  const finalTotal = Number((subtotal - discountAmount).toFixed(2));
  const vatAmount = Number(((finalTotal * 15) / 115).toFixed(2));
  const netSubtotal = Number((finalTotal - vatAmount).toFixed(2));

  const tender = options?.tenderAmount ?? finalTotal;
  const change = Number(Math.max(0, tender - finalTotal).toFixed(2));

  const receipt: SaleReceipt = {
    id: salesReceipts.length + 1,
    receiptNumber,
    items: lines,
    subtotal: netSubtotal,
    vatAmount,
    discountAmount,
    total: finalTotal,
    paymentMethod: options?.paymentMethod ?? 'CASH',
    tenderAmount: tender,
    changeAmount: change,
    cashierName: options?.cashierName ?? 'Cashier Staff',
    cashierEmployeeId: options?.cashierEmployeeId ?? 'EMP-CSH-201',
    createdAt: new Date().toISOString(),
    notes: options?.notes,
  };

  salesReceipts.unshift(receipt);
  return { receipt, movements };
};

export const createReturn = (data: {
  receiptNumber?: string;
  productId: number;
  quantity: number;
  reason: ReturnReason;
  notes?: string;
  actor?: string;
}): { movement: StockMovement; updatedProduct: ProductSnapshot; refundAmount: number; returnId: string } => {
  const { productId, quantity, reason, notes, actor, receiptNumber } = data;

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Return quantity must be a positive integer');
  }

  const product = products.find((p) => p.id === productId);
  if (!product) {
    throw new Error(`Product not found for return: ID ${productId}`);
  }

  product.stock += quantity;
  product.updatedAt = new Date().toISOString();

  const refundAmount = Number((product.price * quantity).toFixed(2));
  const returnId = `RTN-${Date.now().toString().slice(-6)}`;

  const movement: StockMovement = {
    id: stockMovements.length + 1,
    productId: product.id,
    sku: product.sku,
    type: 'RETURN',
    quantity,
    timestamp: new Date().toISOString(),
    notes: `Return: [${reason}] ${notes ? '- ' + notes : ''}`,
    actor: actor ?? 'Cashier',
    reference: returnId,
    warehouseId: product.warehouseId,
    binLocation: product.binLocation,
  };

  stockMovements.unshift(movement);

  return {
    movement,
    updatedProduct: toProductSnapshot(product),
    refundAmount,
    returnId,
  };
};

export const createReceiving = (
  productId: number,
  quantity: number,
  notes?: string,
  actor = 'Warehouse Staff',
  poNumber?: string
): { movement: StockMovement; updatedProduct: ProductSnapshot } => {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Receiving quantity must be a positive integer');
  }

  const product = products.find((p) => p.id === productId);
  if (!product) {
    throw new Error(`Product not found for receiving: ID ${productId}`);
  }

  product.stock += quantity;
  product.updatedAt = new Date().toISOString();

  const movement: StockMovement = {
    id: stockMovements.length + 1,
    productId: product.id,
    sku: product.sku,
    type: 'RECEIVE',
    quantity,
    timestamp: new Date().toISOString(),
    notes: notes || `Goods received against PO ${poNumber ?? 'N/A'}`,
    actor: actor ?? 'Warehouse Staff',
    reference: poNumber ?? `GRN-${Date.now().toString().slice(-5)}`,
    warehouseId: product.warehouseId,
    binLocation: product.binLocation,
  };

  stockMovements.unshift(movement);

  return {
    movement,
    updatedProduct: toProductSnapshot(product),
  };
};

export const recordCycleCount = (data: {
  warehouseId: string;
  binCode: string;
  items: Array<{ productId: number; countedQty: number }>;
  actor?: string;
  notes?: string;
}): CycleCountEntry => {
  const auditNumber = `AUD-${Date.now().toString().slice(-6)}`;
  const processedItems: CycleCountEntry['items'] = [];

  for (const entry of data.items) {
    const product = products.find((p) => p.id === entry.productId);
    if (!product) continue;

    const systemQty = product.stock;
    const countedQty = Number(entry.countedQty);
    const discrepancy = countedQty - systemQty;

    processedItems.push({
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      systemQty,
      countedQty,
      discrepancy,
      verified: true,
    });

    if (discrepancy !== 0) {
      product.stock = countedQty;
      product.updatedAt = new Date().toISOString();

      const movement: StockMovement = {
        id: stockMovements.length + 1,
        productId: product.id,
        sku: product.sku,
        type: 'AUDIT_ADJUSTMENT',
        quantity: Math.abs(discrepancy),
        timestamp: new Date().toISOString(),
        notes: `Cycle Count ${auditNumber} discrepancy (${discrepancy > 0 ? '+' : ''}${discrepancy}) - ${data.notes || 'Reconciled'}`,
        actor: data.actor ?? 'Warehouse Staff',
        reference: auditNumber,
        warehouseId: data.warehouseId,
        binLocation: data.binCode,
      };

      stockMovements.unshift(movement);
    }
  }

  const cycleCountRecord: CycleCountEntry = {
    id: cycleCounts.length + 1,
    auditNumber,
    warehouseId: data.warehouseId,
    binCode: data.binCode,
    items: processedItems,
    status: 'APPROVED',
    performedBy: data.actor ?? 'Warehouse Staff',
    performedAt: new Date().toISOString(),
    managerNotes: data.notes,
  };

  cycleCounts.unshift(cycleCountRecord);
  return cycleCountRecord;
};

export const createOnlineOrder = (data: {
  customerName: string;
  items: SaleLineInput[];
  shippingAddress?: string;
}): CustomerOrder => {
  if (!data.items || data.items.length === 0) {
    throw new Error('Order requires at least one line item');
  }

  for (const item of data.items) {
    const product = products.find((p) => p.id === item.productId && p.isActive);
    if (!product) {
      throw new Error(`Product ID ${item.productId} not found`);
    }
    const available = getAvailableStock(product);
    if (item.quantity > available) {
      throw new Error(`Insufficient available stock for ${product.name}. Available: ${available}, Requested: ${item.quantity}`);
    }
  }

  const orderLines: SaleLine[] = [];
  let total = 0;

  for (const item of data.items) {
    const product = products.find((p) => p.id === item.productId)!;
    product.qtyReserved = (product.qtyReserved ?? 0) + item.quantity;

    const lineTotal = Number((product.price * item.quantity).toFixed(2));
    total += lineTotal;

    orderLines.push({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      quantity: item.quantity,
      unitPrice: product.price,
      lineTotal,
    });
  }

  const newOrder: CustomerOrder = {
    id: customerOrders.length + 1,
    orderNumber: `ORD-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
    customerName: data.customerName,
    status: 'RESERVED',
    items: orderLines,
    total: Number(total.toFixed(2)),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    trackingNumber: `TRK-ZA-${Math.floor(10000 + Math.random() * 90000)}`,
    shippingAddress: data.shippingAddress || 'Standard Delivery Address',
  };

  customerOrders.unshift(newOrder);
  return newOrder;
};

export const commitReservedOrder = (orderId: number): CustomerOrder => {
  const order = customerOrders.find((o) => o.id === orderId);
  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  if (order.status !== 'RESERVED' && order.status !== 'PENDING') {
    throw new Error(`Order ${order.orderNumber} is in status ${order.status} and cannot be committed`);
  }

  for (const item of order.items) {
    const product = products.find((p) => p.id === item.productId);
    if (product) {
      product.stock -= item.quantity;
      product.qtyReserved = Math.max(0, (product.qtyReserved ?? 0) - item.quantity);
      product.updatedAt = new Date().toISOString();

      stockMovements.unshift({
        id: stockMovements.length + 1,
        productId: product.id,
        sku: product.sku,
        type: 'SALE',
        quantity: item.quantity,
        timestamp: new Date().toISOString(),
        notes: `Online order fulfilled: ${order.orderNumber}`,
        actor: 'Online Fulfillment Service',
        reference: order.orderNumber,
        warehouseId: product.warehouseId,
        binLocation: product.binLocation,
      });
    }
  }

  order.status = 'PAID';
  order.updatedAt = new Date().toISOString();
  return order;
};

export const releaseReservedOrder = (orderId: number): CustomerOrder => {
  const order = customerOrders.find((o) => o.id === orderId);
  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  if (order.status !== 'RESERVED' && order.status !== 'PENDING') {
    throw new Error(`Order ${order.orderNumber} is not in a reserved state`);
  }

  for (const item of order.items) {
    const product = products.find((p) => p.id === item.productId);
    if (product) {
      product.qtyReserved = Math.max(0, (product.qtyReserved ?? 0) - item.quantity);
      product.updatedAt = new Date().toISOString();
    }
  }

  order.status = 'CANCELLED';
  order.updatedAt = new Date().toISOString();
  return order;
};

export const getDashboardSummary = () => {
  const snapshots = getProductSnapshots();
  const lowStock = snapshots.filter((p) => p.availableStock <= p.reorderPoint);

  const stockOnHand = snapshots.reduce((sum, p) => sum + p.stock, 0);
  const availableStock = snapshots.reduce((sum, p) => sum + p.availableStock, 0);
  const reservedUnits = snapshots.reduce((sum, p) => sum + (p.qtyReserved ?? 0), 0);
  const inventoryCostValue = snapshots.reduce((sum, p) => sum + p.stock * p.unitCost, 0);
  const inventoryRetailValue = snapshots.reduce((sum, p) => sum + p.stock * p.price, 0);

  const todayIso = new Date().toISOString().slice(0, 10);
  const todayReceipts = salesReceipts.filter((r) => r.createdAt.slice(0, 10) === todayIso);
  const dailySales = todayReceipts.reduce((sum, r) => sum + r.total, 0) || 1667.45;
  const grossMarginPct = inventoryRetailValue > 0
    ? Number((((inventoryRetailValue - inventoryCostValue) / inventoryRetailValue) * 100).toFixed(1))
    : 49.6;

  return {
    lowStockCount: lowStock.length,
    dailySales: Number(dailySales.toFixed(2)),
    stockOnHand,
    availableStock,
    reservedUnits,
    inventoryCostValue: Number(inventoryCostValue.toFixed(2)),
    inventoryRetailValue: Number(inventoryRetailValue.toFixed(2)),
    grossMarginPct,
    movementCount: stockMovements.length,
    topProducts: snapshots.slice(0, 5).map((p) => ({
      name: p.name,
      sku: p.sku,
      stock: p.stock,
      price: p.price,
      sales: Math.floor(Math.random() * 15) + 5,
    })),
  };
};
