import { Op, Transaction } from 'sequelize';
import { sequelize } from './config/sequelize';
import {
  CustomerOrderItemModel,
  CustomerOrderModel,
  AuditLogModel,
  CycleCountModel,
  InventoryItemModel,
  InventoryReservationModel,
  PurchaseOrderItemModel,
  PurchaseOrderModel,
  SupplierReviewModel,
  ReturnItemModel,
  ReturnModel,
  SaleItemModel,
  SaleModel,
  UserModel,
  WarehouseModel,
  CompanyModel,
  CompanyPolicyModel,
  type CompanyAttributes,
} from './models/DomainModels';
import { ProductModel } from './models/Product';
import { SupplierModel } from './models/Supplier';
import { StockMovementModel } from './models/StockMovement';
import { inventoryItems, stockMovements, type CustomerOrder, type CycleCountEntry, type SaleReceipt, type StockMovement } from './inventory';
import type { NewSupplier, PurchaseOrderView, Supplier, SupplierReview } from './modules/procurement/procurement';
import type { PublicUser, User } from './modules/auth/auth';
import { currentCompanyId, DEFAULT_COMPANY_ID, type CompanyStatus } from './config/tenancy';
import type { SystemPolicy } from './config/policies';

let databaseReady = false;

export const setDatabaseReady = (ready: boolean): void => {
  databaseReady = ready;
};

export const isDatabaseReady = (): boolean => databaseReady;

const requireDatabase = (operation: string): void => {
  if (!databaseReady) throw new Error(`PostgreSQL is unavailable; ${operation} cannot be saved.`);
};

export const persistSupplier = async (supplier: NewSupplier, productIds: number[] = []): Promise<Supplier> => {
  requireDatabase('Supplier');
  const record = await withDatabase(async (transaction) => {
    const createdSupplier = await SupplierModel.create(
      {
        ...supplier,
        companyId: currentCompanyId(),
        rating: 0,
        isArchived: false,
      },
      { transaction }
    );
    if (productIds.length > 0) {
      const [updatedCount] = await ProductModel.update(
        { supplierId: createdSupplier.id },
        { where: { id: { [Op.in]: productIds }, companyId: currentCompanyId() }, transaction }
      );
      if (updatedCount !== productIds.length) {
        throw new Error('One or more selected products could not be assigned to the supplier.');
      }
    }
    return createdSupplier;
  });
  if (!record) throw new Error('Supplier was not saved to PostgreSQL.');
  return {
    id: record.id,
    companyId: record.companyId,
    name: record.name,
    contact: record.contact,
    leadTimeDays: record.leadTimeDays,
    isArchived: record.isArchived,
  };
};

export const persistSupplierArchivedStatus = async (id: number, isArchived: boolean): Promise<boolean> => {
  requireDatabase('Supplier archive status');
  const updated = await withDatabase(async (transaction) => {
    const [updatedCount] = await SupplierModel.update(
      { isArchived },
      { where: { id, companyId: currentCompanyId() }, transaction }
    );
    return updatedCount === 1;
  });
  return updated ?? false;
};

export const deletePersistedSupplier = async (
  id: number,
): Promise<{ found: boolean; deleted: boolean; productCount: number; purchaseOrderCount: number }> => {
  requireDatabase('Supplier deletion');
  const result = await withDatabase(async (transaction) => {
    const supplier = await SupplierModel.findOne({
      where: { id, companyId: currentCompanyId() },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!supplier) return { found: false, deleted: false, productCount: 0, purchaseOrderCount: 0 };

    const [productCount, purchaseOrderCount] = await Promise.all([
      ProductModel.count({ where: { supplierId: id, companyId: currentCompanyId() }, transaction }),
      PurchaseOrderModel.count({ where: { supplierId: id, companyId: currentCompanyId() }, transaction }),
    ]);
    if (productCount > 0 || purchaseOrderCount > 0) {
      return { found: true, deleted: false, productCount, purchaseOrderCount };
    }

    await supplier.destroy({ transaction });
    return { found: true, deleted: true, productCount, purchaseOrderCount };
  });
  if (!result) throw new Error('Supplier deletion did not complete.');
  return result;
};

export const persistCompanyProfile = async (
  companyId: string,
  changes: Partial<Pick<CompanyAttributes, 'legalName' | 'tradingName' | 'registrationNumber' | 'taxNumber' | 'currency' | 'timezone'>>,
): Promise<void> => {
  requireDatabase('Company profile changes');
  if (companyId !== currentCompanyId()) throw new Error('Company profile changes must stay within the current company.');
  await withDatabase(async (transaction) => {
    const [updatedCount] = await CompanyModel.update(changes, { where: { id: companyId }, transaction });
    if (updatedCount !== 1) throw new Error('Company profile was not found in PostgreSQL.');
  });
};

export const persistCompanyStatus = async (companyId: string, subscriptionStatus: CompanyStatus): Promise<void> => {
  requireDatabase('Company status changes');
  if (companyId === DEFAULT_COMPANY_ID) throw new Error('The default company cannot be archived.');
  await withDatabase(async (transaction) => {
    const [updatedCount] = await CompanyModel.update(
      { subscriptionStatus },
      { where: { id: companyId }, transaction }
    );
    if (updatedCount !== 1) throw new Error('Company was not found in PostgreSQL.');
  });
};

export const persistCompanyPolicy = async (companyId: string, policy: SystemPolicy): Promise<void> => {
  requireDatabase('Policy changes');
  if (companyId !== currentCompanyId()) throw new Error('Policy changes must stay within the current company.');
  await withDatabase(async (transaction) => {
    await CompanyPolicyModel.upsert({ companyId, configuration: policy }, { transaction });
  });
};

const withDatabase = async <T>(operation: (transaction: Transaction) => Promise<T>): Promise<T | undefined> => {
  if (!databaseReady) return undefined;
  return sequelize.transaction(async (transaction) => {
    await sequelize.query("SELECT set_config('app.company_id', ?, true)", {
      replacements: [currentCompanyId()],
      transaction,
    });
    return operation(transaction);
  });
};

export const persistUser = async (user: User, passwordHash: string): Promise<void> => {
  try {
    await withDatabase(async (transaction) => {
      await UserModel.upsert(
        {
          id: user.id,
          companyId: user.companyId,
          isPlatformAdmin: user.isPlatformAdmin,
          employeeId: user.employeeId,
          name: user.name,
          email: user.email,
          role: user.role,
          sector: user.sector,
          status: user.status,
          isFirstLogin: user.isFirstLogin,
          mfaEnabled: user.mfaEnabled,
          emailVerified: user.emailVerified,
          mfaSecret: user.mfaSecret,
          passwordHash,
          lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : undefined,
        },
        { transaction }
      );
    });
  } finally {
    user.passwordHash = passwordHash;
    user.password = undefined;
  }
};

const persistMovement = async (movement: StockMovement, transaction: Transaction): Promise<void> => {
  await StockMovementModel.create(
    {
      id: movement.id,
      companyId: movement.companyId ?? currentCompanyId(),
      productId: movement.productId,
      sku: movement.sku,
      type: movement.type,
      quantity: movement.quantity,
      notes: movement.notes,
      actor: movement.actor,
      reference: movement.reference,
      warehouseId: movement.warehouseId,
      binLocation: movement.binLocation,
      createdAt: new Date(movement.timestamp),
    },
    { transaction }
  );
};

const persistProductStock = async (productId: number, stock: number, qtyReserved: number, transaction: Transaction): Promise<void> => {
  await ProductModel.update({ stock, qtyReserved }, { where: { id: productId, companyId: currentCompanyId() }, transaction });
};

const persistInventoryItems = async (productIds: number[], transaction: Transaction): Promise<void> => {
  const productIdSet = new Set(productIds);
  const records = inventoryItems.filter((item) => productIdSet.has(item.productId));
  if (records.length === 0) return;

  await InventoryItemModel.bulkCreate(
    records.map((item) => ({ ...item, updatedAt: new Date(item.updatedAt) })),
    { updateOnDuplicate: ['qtyOnHand', 'qtyReserved', 'updatedAt'], transaction }
  );
};

export const persistSale = async (receipt: SaleReceipt, movements: StockMovement[], products: Array<{ id: number; stock: number; qtyReserved: number }>): Promise<void> => {
  await withDatabase(async (transaction) => {
    const sale = await SaleModel.create(
      {
        id: receipt.id,
        receiptNumber: receipt.receiptNumber,
        subtotal: receipt.subtotal,
        vatAmount: receipt.vatAmount,
        discountAmount: receipt.discountAmount,
        total: receipt.total,
        paymentMethod: receipt.paymentMethod,
        paymentReference: receipt.paymentReference,
        tenderAmount: receipt.tenderAmount,
        changeAmount: receipt.changeAmount,
        cashierName: receipt.cashierName,
        cashierEmployeeId: receipt.cashierEmployeeId,
        notes: receipt.notes,
      },
      { transaction }
    );
    await SaleItemModel.bulkCreate(
      receipt.items.map((item) => ({
        saleId: sale.id,
        productId: item.productId,
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
      { transaction }
    );
    for (const movement of movements) await persistMovement(movement, transaction);
    for (const product of products) await persistProductStock(product.id, product.stock, product.qtyReserved, transaction);
    await persistInventoryItems(receipt.items.map((item) => item.productId), transaction);
  });
};

export const persistReturn = async (
  returnId: string,
  receiptNumber: string | undefined,
  product: { id: number; sku: string; price: number; stock: number; qtyReserved: number },
  quantity: number,
  reason: string,
  notes: string | undefined,
  actor: string | undefined,
  refundAmount: number,
  movement: StockMovement
): Promise<void> => {
  await withDatabase(async (transaction) => {
    const record = await ReturnModel.create({ returnNumber: returnId, receiptNumber, refundAmount, reason, notes, actor }, { transaction });
    await ReturnItemModel.create({ returnId: record.id, productId: product.id, sku: product.sku, quantity, unitPrice: product.price }, { transaction });
    await persistMovement(movement, transaction);
    await persistProductStock(product.id, product.stock, product.qtyReserved, transaction);
    await persistInventoryItems([product.id], transaction);
  });
};

export const persistReceiving = async (
  product: { id: number; stock: number; qtyReserved: number },
  movement: StockMovement
): Promise<void> => {
  await persistStockMovementAndInventory(product, movement);
};

export const persistStockAdjustment = async (
  product: { id: number; stock: number; qtyReserved: number },
  movement: StockMovement
): Promise<void> => {
  await persistStockMovementAndInventory(product, movement);
};

const persistStockMovementAndInventory = async (
  product: { id: number; stock: number; qtyReserved: number },
  movement: StockMovement
): Promise<void> => {
  await withDatabase(async (transaction) => {
    await persistMovement(movement, transaction);
    await persistProductStock(product.id, product.stock, product.qtyReserved, transaction);
    await persistInventoryItems([product.id], transaction);
  });
};

export const persistCycleCount = async (
  count: CycleCountEntry,
  products: Array<{ id: number; stock: number; qtyReserved: number }>
): Promise<void> => {
  await withDatabase(async (transaction) => {
    await CycleCountModel.create({
      auditNumber: count.auditNumber,
      warehouseId: count.warehouseId,
      binCode: count.binCode,
      items: count.items,
      status: count.status,
      performedBy: count.performedBy,
      performedAt: new Date(count.performedAt),
      managerNotes: count.managerNotes,
    }, { transaction });
    for (const movement of stockMovements.filter((entry) => entry.reference === count.auditNumber)) {
      await persistMovement(movement, transaction);
    }
    const productIds = count.items.map((item) => item.productId);
    for (const product of products.filter((entry) => productIds.includes(entry.id))) {
      await persistProductStock(product.id, product.stock, product.qtyReserved, transaction);
    }
    await persistInventoryItems(productIds, transaction);
  });
};

export const persistProduct = async (product: {
  id: number;
  companyId?: string;
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
}): Promise<void> => {
  await withDatabase(async (transaction) => {
    const companyId = product.companyId ?? currentCompanyId();
    const existingProduct = await ProductModel.findOne({
      where: { id: product.id, companyId },
      transaction,
    });
    if (!existingProduct || existingProduct.supplierId !== product.supplierId) {
      const supplier = await SupplierModel.findOne({
        where: { id: product.supplierId, companyId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!supplier || supplier.isArchived) {
        throw new Error('Products must be assigned to an active supplier in the current company.');
      }
    }
    await ProductModel.upsert({
      companyId,
      id: product.id,
      sku: product.sku,
      barcode: product.barcode,
      name: product.name,
      category: product.category,
      supplierId: product.supplierId,
      stock: product.stock,
      qtyReserved: product.qtyReserved,
      reorderPoint: product.reorderPoint,
      reorderQuantity: product.reorderQuantity,
      unitCost: product.unitCost,
      price: product.price,
      warehouse: product.warehouse,
      warehouseId: product.warehouseId,
      binLocation: product.binLocation,
      imageUrl: product.imageUrl,
      isActive: product.isActive,
    }, { transaction });
    await persistInventoryItems([product.id], transaction);
  });
};

export const persistUserVerification = async (userId: number, companyId: string): Promise<void> => {
  await withDatabase(async (transaction) => {
    await UserModel.update({ emailVerified: true }, { where: { id: userId, companyId }, transaction });
  });
};

export const persistUserState = async (user: User): Promise<void> => {
  await withDatabase(async (transaction) => {
    await UserModel.update(
      {
        name: user.name,
        email: user.email,
        role: user.role,
        sector: user.sector,
        status: user.status,
        isFirstLogin: user.isFirstLogin,
        mfaEnabled: user.mfaEnabled,
        emailVerified: user.emailVerified,
        mfaSecret: user.mfaSecret,
        lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : undefined,
      },
      { where: { id: user.id, companyId: user.companyId }, transaction }
    );
  });
};

export const persistMfaState = async (user: User): Promise<void> => {
  requireDatabase('MFA enrollment changes');
  if (user.companyId !== currentCompanyId()) throw new Error('MFA changes must stay within the current company.');
  await withDatabase(async (transaction) => {
    const [updatedCount] = await UserModel.update(
      { mfaEnabled: user.mfaEnabled, mfaSecret: user.mfaSecret },
      { where: { id: user.id, companyId: user.companyId }, transaction }
    );
    if (updatedCount !== 1) throw new Error('MFA account was not found in PostgreSQL.');
  });
};

export const removeUser = async (userId: number): Promise<void> => {
  await withDatabase(async (transaction) => {
    await UserModel.destroy({ where: { id: userId, companyId: currentCompanyId() }, transaction });
  });
};

export const persistAuditLog = async (log: {
  id: string;
  companyId?: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  eventType: string;
  targetUserId?: number | string;
  details: string;
  ipAddress?: string;
  status: string;
}): Promise<void> => {
  await withDatabase(async (transaction) => {
    await AuditLogModel.create(
      {
        id: log.id,
        companyId: log.companyId ?? currentCompanyId(),
        timestamp: new Date(log.timestamp),
        actor: log.actor,
        actorRole: log.actorRole,
        eventType: log.eventType,
        targetUserId: log.targetUserId ? String(log.targetUserId) : undefined,
        details: log.details,
        ipAddress: log.ipAddress,
        status: log.status,
      },
      { transaction }
    );
  });
};

export const getPersistedAuditLogs = async (): Promise<unknown[]> => {
  if (!databaseReady) return [];
  const logs = await AuditLogModel.findAll({ where: { companyId: currentCompanyId() }, order: [['timestamp', 'DESC']], limit: 500 });
  return logs.map((log) => log.toJSON());
};

export const getWarehouses = async (): Promise<unknown[]> => {
  if (!databaseReady) return [];
  const warehouses = await WarehouseModel.findAll({ where: { companyId: currentCompanyId() }, order: [['id', 'ASC']] });
  return warehouses.map((warehouse) => warehouse.toJSON());
};

export const saveWarehouse = async (warehouse: {
  id: string;
  companyId?: string;
  name: string;
  city: string;
  binsCount: number;
  activeSkus: number;
  capacityPct: number;
  supervisor: string;
  status: string;
}): Promise<void> => {
  await withDatabase(async (transaction) => {
    await WarehouseModel.upsert({ ...warehouse, companyId: warehouse.companyId ?? currentCompanyId() }, { transaction });
  });
};

export const deleteWarehouse = async (id: string): Promise<void> => {
  await withDatabase(async (transaction) => {
    await WarehouseModel.destroy({ where: { id, companyId: currentCompanyId() }, transaction });
  });
};

export const persistPurchaseOrder = async (order: PurchaseOrderView): Promise<void> => {
  await withDatabase(async (transaction) => {
    const companyId = order.companyId ?? currentCompanyId();
    const existingOrder = await PurchaseOrderModel.findOne({
      where: { id: order.id, companyId },
      transaction,
    });
    if (!existingOrder) {
      const supplier = await SupplierModel.findOne({
        where: { id: order.supplierId, companyId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!supplier || supplier.isArchived) {
        throw new Error('Purchase orders must use an active supplier in the current company.');
      }
    }
    const [record] = await PurchaseOrderModel.findOrCreate({
      where: { id: order.id, companyId },
      defaults: {
        id: order.id,
        companyId,
        supplierId: order.supplierId,
        status: order.status,
        totalQuantity: order.quantity,
        receivedQuantity: order.receivedQuantity,
        approvedAt: order.approvedAt ? new Date(order.approvedAt) : undefined,
        sentAt: order.sentAt ? new Date(order.sentAt) : undefined,
        expectedDeliveryDate: order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate) : undefined,
        notes: order.notes,
      },
      transaction,
    });
    await record.update(
      {
        supplierId: order.supplierId,
        status: order.status,
        totalQuantity: order.quantity,
        receivedQuantity: order.receivedQuantity,
        approvedAt: order.approvedAt ? new Date(order.approvedAt) : undefined,
        sentAt: order.sentAt ? new Date(order.sentAt) : undefined,
        expectedDeliveryDate: order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate) : undefined,
        notes: order.notes,
      },
      { transaction }
    );
    await PurchaseOrderItemModel.findOrCreate({
      where: { purchaseOrderId: record.id, companyId },
      defaults: {
        purchaseOrderId: record.id,
        companyId,
        sku: order.sku,
        itemName: order.itemName,
        quantity: order.quantity,
        receivedQuantity: order.receivedQuantity,
      },
      transaction,
    });
  });
};

export const persistSupplierReview = async (review: SupplierReview): Promise<void> => {
  if (review.companyId !== currentCompanyId()) {
    throw new Error('Supplier review company does not match the active tenant');
  }
  await withDatabase(async (transaction) => {
    await SupplierReviewModel.create(
      {
        companyId: review.companyId,
        purchaseOrderId: review.purchaseOrderId,
        supplierId: review.supplierId,
        reviewerId: review.reviewerId,
        reviewerName: review.reviewerName,
        deliveryScore: review.deliveryScore,
        qualityScore: review.qualityScore,
        communicationScore: review.communicationScore,
        feedback: review.feedback,
        createdAt: new Date(review.createdAt),
      },
      { transaction }
    );
  });
};

export const persistCustomerOrder = async (order: CustomerOrder, products: Array<{ id: number; stock: number; qtyReserved: number }>, movements: StockMovement[] = []): Promise<void> => {
  await withDatabase(async (transaction) => {
    const record = await CustomerOrderModel.create(
      {
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        status: order.status,
        total: order.total,
        trackingNumber: order.trackingNumber,
        shippingAddress: order.shippingAddress,
      },
      { transaction }
    );
    await CustomerOrderItemModel.bulkCreate(
      order.items.map((item) => ({
        customerOrderId: record.id,
        productId: item.productId,
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
      { transaction }
    );
    if (order.status === 'RESERVED') {
      await InventoryReservationModel.bulkCreate(
        order.items.map((item) => ({ customerOrderId: record.id, productId: item.productId, quantity: item.quantity, status: 'RESERVED' })),
        { transaction }
      );
    }
    for (const product of products) await persistProductStock(product.id, product.stock, product.qtyReserved, transaction);
    for (const movement of movements) await persistMovement(movement, transaction);
    await persistInventoryItems(order.items.map((item) => item.productId), transaction);
  });
};

export const persistCustomerOrderStatus = async (
  order: CustomerOrder,
  products: Array<{ id: number; stock: number; qtyReserved: number }>
): Promise<void> => {
  await withDatabase(async (transaction) => {
    await CustomerOrderModel.update(
      { status: order.status, total: order.total, trackingNumber: order.trackingNumber, shippingAddress: order.shippingAddress },
      { where: { orderNumber: order.orderNumber, companyId: order.companyId ?? currentCompanyId() }, transaction }
    );
    await InventoryReservationModel.update(
      { status: order.status === 'CANCELLED' ? 'RELEASED' : order.status === 'PAID' ? 'COMMITTED' : 'RESERVED' },
      { where: { customerOrderId: order.id, companyId: order.companyId ?? currentCompanyId() }, transaction }
    );
    for (const product of products) await persistProductStock(product.id, product.stock, product.qtyReserved, transaction);
    await persistInventoryItems(order.items.map((item) => item.productId), transaction);
  });
};

export type PersistableUser = PublicUser;
