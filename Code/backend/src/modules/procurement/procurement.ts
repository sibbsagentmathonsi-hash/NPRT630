import { createReceiving, findProductBySku, getLowStockProducts, type StockMovement } from '../../inventory';
import { belongsToCompany, currentCompanyId, DEFAULT_COMPANY_ID } from '../../config/tenancy';

export type Supplier = {
  id: number;
  companyId?: string;
  name: string;
  contact: string;
  leadTimeDays: number;
};

export type PurchaseOrderStatus = 'DRAFT' | 'APPROVED' | 'SENT' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

export type PurchaseOrder = {
  id: number;
  companyId?: string;
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
  receivingMovement?: StockMovement;
  supplierReview?: SupplierReview;
  canReviewSupplier: boolean;
};

export type SupplierReview = {
  id: string;
  companyId: string;
  purchaseOrderId: number;
  supplierId: number;
  reviewerId: string;
  reviewerName: string;
  deliveryScore: number;
  qualityScore: number;
  communicationScore: number;
  feedback?: string;
  createdAt: string;
};

export class SupplierReviewError extends Error {
  constructor(message: string, public readonly statusCode: 400 | 404 | 409) {
    super(message);
    this.name = 'SupplierReviewError';
  }
}

type SupplierReviewInput = Pick<
  SupplierReview,
  'deliveryScore' | 'qualityScore' | 'communicationScore' | 'feedback' | 'reviewerId' | 'reviewerName'
>;

const supplierReviews: SupplierReview[] = [];

const reviewForPurchaseOrder = (purchaseOrderId: number): SupplierReview | undefined =>
  supplierReviews.find((review) => belongsToCompany(review.companyId) && review.purchaseOrderId === purchaseOrderId);

const average = (values: number[]): number =>
  values.length ? Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(2)) : 0;

export const validateSupplierReview = (purchaseOrderId: number, input: SupplierReviewInput): SupplierReview => {
  const order = purchaseOrders.find((entry) => belongsToCompany(entry.companyId) && entry.id === purchaseOrderId);
  if (!order) {
    throw new SupplierReviewError('Purchase order not found', 404);
  }
  if (order.status !== 'RECEIVED' || order.receivedQuantity !== order.quantity) {
    throw new SupplierReviewError('Only fully received purchase orders can be reviewed', 400);
  }
  if (reviewForPurchaseOrder(purchaseOrderId)) {
    throw new SupplierReviewError('This purchase order has already been reviewed', 409);
  }

  for (const [label, score] of [
    ['Delivery', input.deliveryScore],
    ['Product quality', input.qualityScore],
    ['Communication', input.communicationScore],
  ] as const) {
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      throw new SupplierReviewError(`${label} score must be a whole number from 1 to 5`, 400);
    }
  }
  if (!input.reviewerId.trim() || !input.reviewerName.trim()) {
    throw new SupplierReviewError('Reviewer identity is required', 400);
  }
  if (input.feedback && input.feedback.length > 2000) {
    throw new SupplierReviewError('Feedback must be 2000 characters or fewer', 400);
  }

  return {
    id: `${currentCompanyId()}-${purchaseOrderId}`,
    companyId: currentCompanyId(),
    purchaseOrderId,
    supplierId: order.supplierId,
    reviewerId: input.reviewerId,
    reviewerName: input.reviewerName.trim(),
    deliveryScore: input.deliveryScore,
    qualityScore: input.qualityScore,
    communicationScore: input.communicationScore,
    feedback: input.feedback?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };
};

export const addSupplierReview = (review: SupplierReview): SupplierReview => {
  if (reviewForPurchaseOrder(review.purchaseOrderId)) {
    throw new SupplierReviewError('This purchase order has already been reviewed', 409);
  }
  supplierReviews.push(review);
  return review;
};

export const hydrateSupplierReviews = (storedReviews: SupplierReview[]): void => {
  supplierReviews.splice(
    0,
    supplierReviews.length,
    ...storedReviews.map((review) => ({ ...review, createdAt: new Date(review.createdAt).toISOString() }))
  );
};

export const suppliers: Supplier[] = [
  { id: 1, name: 'Fresh Foods Co.', contact: 'orders@freshfoods.co', leadTimeDays: 3 },
  { id: 2, name: 'Bulk Supply Ltd.', contact: 'hello@bulksupply.co', leadTimeDays: 5 },
  { id: 3, name: 'ElectroTech Wholesale', contact: 'sales@electrotech.local', leadTimeDays: 7 },
  { id: 4, name: 'Metro Office & Apparel', contact: 'supply@metropack.local', leadTimeDays: 4 },
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

for (const supplier of suppliers) supplier.companyId ??= DEFAULT_COMPANY_ID;
for (const order of purchaseOrders) order.companyId ??= DEFAULT_COMPANY_ID;

let purchaseOrderId = purchaseOrders.length + 1;

const assertPositiveInteger = (quantity: number): void => {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Quantity must be a positive whole number');
  }
};

const getSupplierById = (supplierId: number): Supplier => {
  return suppliers.find((supplier) => belongsToCompany(supplier.companyId) && supplier.id === supplierId) || suppliers.find((supplier) => belongsToCompany(supplier.companyId)) || suppliers[0];
};

const toPurchaseOrderView = (order: PurchaseOrder): PurchaseOrderView => ({
  ...order,
  supplierName: getSupplierById(order.supplierId)?.name ?? 'Primary Supplier',
  remainingQuantity: order.quantity - order.receivedQuantity,
  supplierReview: reviewForPurchaseOrder(order.id),
  canReviewSupplier: order.status === 'RECEIVED' && !reviewForPurchaseOrder(order.id),
});

const addDays = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

export const getPurchaseOrders = (): PurchaseOrderView[] => purchaseOrders.filter((order) => belongsToCompany(order.companyId)).map(toPurchaseOrderView);

export const hydratePurchaseOrders = (storedOrders: PurchaseOrder[]): void => {
  if (storedOrders.length === 0) return;
  purchaseOrders.splice(0, purchaseOrders.length, ...storedOrders.map((order) => ({ ...order, companyId: order.companyId ?? DEFAULT_COMPANY_ID })));
  purchaseOrderId = Math.max(...storedOrders.map((order) => order.id), 0) + 1;
};

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
    companyId: currentCompanyId(),
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
  const order = purchaseOrders.find((entry) => belongsToCompany(entry.companyId) && entry.id === id);
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
  const order = purchaseOrders.find((entry) => belongsToCompany(entry.companyId) && entry.id === id);
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
  const order = purchaseOrders.find((entry) => belongsToCompany(entry.companyId) && entry.id === id);
  if (!order) {
    throw new Error('Purchase order not found');
  }

  if (['RECEIVED', 'CANCELLED'].includes(order.status)) {
    throw new Error('Purchase order is already closed');
  }

  order.status = 'CANCELLED';
  return toPurchaseOrderView(order);
};

export const receivePurchaseOrder = (
  id: number,
  quantity: number,
  actor = 'Warehouse Staff',
  warehouseId?: string,
  binCode?: string,
): PurchaseOrderView => {
  assertPositiveInteger(quantity);

  const order = purchaseOrders.find((entry) => belongsToCompany(entry.companyId) && entry.id === id);
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

  const receipt = createReceiving(
    product.id,
    quantity,
    `Received against purchase order PO-${order.id}`,
    actor,
    `PO-${order.id}`,
    warehouseId,
    binCode,
  );

  return { ...toPurchaseOrderView(order), receivingMovement: receipt.movement };
};

export const getSupplierPerformance = () => {
  return suppliers.filter((supplier) => belongsToCompany(supplier.companyId)).map((supplier) => {
    const reviews = supplierReviews.filter(
      (review) => belongsToCompany(review.companyId) && review.supplierId === supplier.id
    );
    const rating = average(reviews.map((review) =>
      (review.deliveryScore + review.qualityScore + review.communicationScore) / 3
    ));
    return {
      ...supplier,
      rating,
      reviewCount: reviews.length,
      averageDeliveryScore: average(reviews.map((review) => review.deliveryScore)),
      averageQualityScore: average(reviews.map((review) => review.qualityScore)),
      averageCommunicationScore: average(reviews.map((review) => review.communicationScore)),
      suggestedPriority: reviews.length === 0 ? 'Unrated' : rating >= 4.6 ? 'High' : 'Medium',
      risk: reviews.length === 0 ? 'Unrated' : average(reviews.map((review) => review.deliveryScore)) < 3 ? 'Watch' : 'Normal',
    };
  });
};
