import { createReceiving, findProductBySku, getLowStockProducts, type StockMovement } from '../../inventory';
import { belongsToCompany, currentCompanyId, DEFAULT_COMPANY_ID } from '../../config/tenancy';

export type Supplier = {
  id: number;
  companyId?: string;
  name: string;
  contact: string;
  leadTimeDays: number;
  isArchived?: boolean;
};

export type NewSupplier = Pick<Supplier, 'name' | 'contact' | 'leadTimeDays'>;

export class SupplierError extends Error {
  constructor(message: string, public readonly statusCode: 400 | 409) {
    super(message);
    this.name = 'SupplierError';
  }
}

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

export const suppliers: Supplier[] = [];

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

for (const order of purchaseOrders) order.companyId ??= DEFAULT_COMPANY_ID;

let purchaseOrderId = purchaseOrders.length + 1;

export const hydrateSuppliers = (storedSuppliers: Supplier[]): void => {
  suppliers.splice(
    0,
    suppliers.length,
    ...storedSuppliers.map((supplier) => ({
      ...supplier,
      companyId: supplier.companyId ?? DEFAULT_COMPANY_ID,
      isArchived: supplier.isArchived ?? false,
    }))
  );
};

export const validateNewSupplier = (input: Partial<Record<keyof NewSupplier, unknown>>): NewSupplier => {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const contact = typeof input.contact === 'string' ? input.contact.trim() : '';
  const leadTimeDays = Number(input.leadTimeDays);

  if (!name || !contact || input.leadTimeDays === undefined || input.leadTimeDays === null || input.leadTimeDays === '') {
    throw new SupplierError('Supplier name, contact details, and lead time are required', 400);
  }
  if (name.length > 150 || contact.length > 255) {
    throw new SupplierError('Supplier name must be 150 characters or fewer and contact details 255 characters or fewer', 400);
  }
  if (!Number.isInteger(leadTimeDays) || leadTimeDays < 1 || leadTimeDays > 365) {
    throw new SupplierError('Lead time must be a whole number from 1 to 365 days', 400);
  }
  if (suppliers.some((supplier) =>
    belongsToCompany(supplier.companyId) &&
    (supplier.name.toLowerCase() === name.toLowerCase() || supplier.contact.toLowerCase() === contact.toLowerCase())
  )) {
    throw new SupplierError('A supplier with this name or contact already exists in this company', 409);
  }

  return { name, contact, leadTimeDays };
};

export const addSupplier = (supplier: Supplier): Supplier => {
  const validated = validateNewSupplier(supplier);
  const record = {
    ...validated,
    id: supplier.id,
    companyId: supplier.companyId ?? currentCompanyId(),
    isArchived: false,
  };
  suppliers.push(record);
  return record;
};

export const getSupplierById = (id: number): Supplier | undefined =>
  suppliers.find((supplier) => belongsToCompany(supplier.companyId) && supplier.id === id);

export const getActiveSupplierById = (id: number): Supplier | undefined => {
  const supplier = getSupplierById(id);
  return supplier && !supplier.isArchived ? supplier : undefined;
};

export const setSupplierArchived = (id: number, isArchived: boolean): Supplier | undefined => {
  const supplier = getSupplierById(id);
  if (supplier) supplier.isArchived = isArchived;
  return supplier;
};

export const removeSupplier = (id: number): Supplier | undefined => {
  const index = suppliers.findIndex((supplier) => belongsToCompany(supplier.companyId) && supplier.id === id);
  if (index === -1) return undefined;
  return suppliers.splice(index, 1)[0];
};

const assertPositiveInteger = (quantity: number): void => {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Quantity must be a positive whole number');
  }
};

const toPurchaseOrderView = (order: PurchaseOrder): PurchaseOrderView => ({
  ...order,
  supplierName: getSupplierById(order.supplierId)?.name ?? `Unregistered supplier #${order.supplierId}`,
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

  const supplier = getActiveSupplierById(supplierId);
  if (!supplier) {
    throw new Error('Choose an active supplier that is registered with this company');
  }
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
    const supplier = getActiveSupplierById(product.supplierId);
    if (!supplier) continue;

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
      createPurchaseOrder(supplier.id, product.sku, product.name, suggestedQuantity, 'Generated from low-stock alert')
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
