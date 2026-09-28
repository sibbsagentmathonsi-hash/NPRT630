import { createReceiving, findProductBySku, getLowStockProducts } from '../../inventory';

export type Supplier = {
  id: number;
  name: string;
  contact: string;
  leadTimeDays: number;
  rating: number;
  onTimeDeliveryRate: number;
};

export type PurchaseOrderStatus = 'DRAFT' | 'APPROVED' | 'SENT' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

export type PurchaseOrder = {
  id: number;
  supplierId: number;
  sku: string;
  itemName: string;
  quantity: number;
  receivedQuantity: number;
  status: PurchaseOrderStatus;
  createdAt: string;
  approvedAt?: string;
  sentAt?: string;
  expectedDeliveryDate?: string;
  notes?: string;
};

export type PurchaseOrderView = PurchaseOrder & {
  supplierName: string;
  remainingQuantity: number;
};

export const suppliers: Supplier[] = [
  { id: 1, name: 'Fresh Foods Co.', contact: 'orders@freshfoods.co', leadTimeDays: 3, rating: 4.8, onTimeDeliveryRate: 96 },
  { id: 2, name: 'Bulk Supply Ltd.', contact: 'hello@bulksupply.co', leadTimeDays: 5, rating: 4.6, onTimeDeliveryRate: 91 },
  { id: 3, name: 'ElectroTech Wholesale', contact: 'sales@electrotech.local', leadTimeDays: 7, rating: 4.5, onTimeDeliveryRate: 92 },
  { id: 4, name: 'Metro Office & Apparel', contact: 'supply@metropack.local', leadTimeDays: 4, rating: 4.4, onTimeDeliveryRate: 88 },
];

export const purchaseOrders: PurchaseOrder[] = [
  {
    id: 1,
    supplierId: 1,
    sku: 'MILK-001',
    itemName: 'Fresh Full Cream Milk 1L',
    quantity: 40,
    receivedQuantity: 0,
    status: 'APPROVED',
    createdAt: '2026-08-10T08:00:00.000Z',
    approvedAt: '2026-08-10T08:20:00.000Z',
    expectedDeliveryDate: '2026-08-13T08:00:00.000Z',
  },
  {
    id: 2,
    supplierId: 2,
    sku: 'FOOD-002',
    itemName: 'Green Tea Collection Box 50s',
    quantity: 30,
    receivedQuantity: 0,
    status: 'DRAFT',
    createdAt: '2026-08-10T09:00:00.000Z',
  },
];

let purchaseOrderId = purchaseOrders.length + 1;

const assertPositiveInteger = (quantity: number): void => {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Quantity must be a positive whole number');
  }
};

const getSupplierById = (supplierId: number): Supplier => {
  return suppliers.find((supplier) => supplier.id === supplierId) || suppliers[0];
};

const toPurchaseOrderView = (order: PurchaseOrder): PurchaseOrderView => ({
  ...order,
  supplierName: getSupplierById(order.supplierId)?.name ?? 'Primary Supplier',
  remainingQuantity: order.quantity - order.receivedQuantity,
});

const addDays = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

export const getPurchaseOrders = (): PurchaseOrderView[] => purchaseOrders.map(toPurchaseOrderView);

export const createPurchaseOrder = (
  supplierId: number,
  sku: string,
  itemName: string,
  quantity: number,
  notes?: string
): PurchaseOrderView => {
  assertPositiveInteger(quantity);

  const supplier = getSupplierById(supplierId);
  const normalizedSku = sku.trim().toUpperCase();
  if (!normalizedSku || !itemName.trim()) {
    throw new Error('SKU and item name are required');
  }

  const order: PurchaseOrder = {
    id: purchaseOrderId++,
    supplierId: supplier.id,
    sku: normalizedSku,
    itemName: itemName.trim(),
    quantity,
    receivedQuantity: 0,
    status: 'DRAFT',
    createdAt: new Date().toISOString(),
    notes,
  };

  purchaseOrders.unshift(order);
  return toPurchaseOrderView(order);
};

export const generateLowStockPurchaseOrders = (): PurchaseOrderView[] => {
  const generated: PurchaseOrderView[] = [];

  for (const product of getLowStockProducts()) {
    const hasOpenOrder = purchaseOrders.some(
      (order) =>
        order.sku === product.sku &&
        !['RECEIVED', 'CANCELLED'].includes(order.status) &&
        order.quantity > order.receivedQuantity
    );

    if (hasOpenOrder) {
      continue;
    }

    const targetStock = product.reorderPoint + product.reorderQuantity;
    const suggestedQuantity = Math.max(targetStock - product.availableStock, product.reorderQuantity);

    generated.push(
      createPurchaseOrder(product.supplierId || 1, product.sku, product.name, suggestedQuantity, 'Generated from low-stock alert')
    );
  }

  return generated;
};

export const approvePurchaseOrder = (id: number): PurchaseOrderView => {
  const order = purchaseOrders.find((entry) => entry.id === id);
  if (!order) {
    throw new Error('Purchase order not found');
  }

  if (order.status !== 'DRAFT') {
    throw new Error('Only draft purchase orders can be approved');
  }

  const supplier = getSupplierById(order.supplierId);
  order.status = 'APPROVED';
  order.approvedAt = new Date().toISOString();
  order.expectedDeliveryDate = addDays(supplier?.leadTimeDays ?? 3);
  return toPurchaseOrderView(order);
};

export const sendPurchaseOrder = (id: number): PurchaseOrderView => {
  const order = purchaseOrders.find((entry) => entry.id === id);
  if (!order) {
    throw new Error('Purchase order not found');
  }

  if (order.status !== 'APPROVED') {
    throw new Error('Only approved purchase orders can be sent');
  }

  order.status = 'SENT';
  order.sentAt = new Date().toISOString();
  return toPurchaseOrderView(order);
};

export const cancelPurchaseOrder = (id: number): PurchaseOrderView => {
  const order = purchaseOrders.find((entry) => entry.id === id);
  if (!order) {
    throw new Error('Purchase order not found');
  }

  if (['RECEIVED', 'CANCELLED'].includes(order.status)) {
    throw new Error('Purchase order is already closed');
  }

  order.status = 'CANCELLED';
  return toPurchaseOrderView(order);
};

export const receivePurchaseOrder = (id: number, quantity: number, actor = 'Warehouse Staff'): PurchaseOrderView => {
  assertPositiveInteger(quantity);

  const order = purchaseOrders.find((entry) => entry.id === id);
  if (!order) {
    throw new Error('Purchase order not found');
  }

  if (!['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'].includes(order.status)) {
    throw new Error('Purchase order must be approved or sent before receiving');
  }

  const remainingQuantity = order.quantity - order.receivedQuantity;
  if (quantity > remainingQuantity) {
    throw new Error('Received quantity cannot exceed outstanding quantity');
  }

  const product = findProductBySku(order.sku);
  if (!product) {
    throw new Error('Product not found for purchase order SKU');
  }

  order.receivedQuantity += quantity;
  order.status = order.receivedQuantity === order.quantity ? 'RECEIVED' : 'PARTIALLY_RECEIVED';

  createReceiving(product.id, quantity, `Received against purchase order PO-${order.id}`, actor, `PO-${order.id}`);

  return toPurchaseOrderView(order);
};

export const getSupplierPerformance = () => {
  return suppliers.map((supplier) => ({
    ...supplier,
    suggestedPriority: supplier.rating >= 4.6 && supplier.onTimeDeliveryRate >= 90 ? 'High' : 'Medium',
    risk: supplier.onTimeDeliveryRate < 88 ? 'Watch' : 'Normal',
  }));
};
