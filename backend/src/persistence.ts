import { Transaction } from 'sequelize';
import { sequelize } from './config/sequelize';
import {
  CustomerOrderItemModel,
  CustomerOrderModel,
  AuditLogModel,
  InventoryReservationModel,
  PurchaseOrderItemModel,
  PurchaseOrderModel,
  ReturnItemModel,
  ReturnModel,
  SaleItemModel,
  SaleModel,
  UserModel,
  WarehouseModel,
} from './models/DomainModels';
import { ProductModel } from './models/Product';
import { StockMovementModel } from './models/StockMovement';
import type { CustomerOrder, SaleReceipt, StockMovement } from './inventory';
import type { PurchaseOrderView } from './modules/procurement/procurement';
import type { PublicUser, User } from './modules/auth/auth';

let databaseReady = false;

export const setDatabaseReady = (ready: boolean): void => {
  databaseReady = ready;
};

const withDatabase = async <T>(operation: (transaction: Transaction) => Promise<T>): Promise<T | undefined> => {
  if (!databaseReady) return undefined;
  return sequelize.transaction(operation);
};

export const persistUser = async (user: User, passwordHash: string): Promise<void> => {
  await withDatabase(async (transaction) => {
    await UserModel.upsert(
      {
        id: user.id,
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
};

const persistMovement = async (movement: StockMovement, transaction: Transaction): Promise<void> => {
  await StockMovementModel.create(
    {
      id: movement.id,
      productId: movement.productId,
      sku: movement.sku,
      type: movement.type,
      quantity: movement.quantity,
      notes: [movement.notes, movement.actor, movement.reference].filter(Boolean).join(' | '),
    },
    { transaction }
  );
};

const persistProductStock = async (productId: number, stock: number, qtyReserved: number, transaction: Transaction): Promise<void> => {
  await ProductModel.update({ stock, qtyReserved }, { where: { id: productId }, transaction });
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
  });
};

export const persistReceiving = async (
  product: { id: number; stock: number; qtyReserved: number },
  movement: StockMovement
): Promise<void> => {
  await withDatabase(async (transaction) => {
    await persistMovement(movement, transaction);
    await persistProductStock(product.id, product.stock, product.qtyReserved, transaction);
  });
};

export const persistProduct = async (product: {
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
}): Promise<void> => {
  await withDatabase(async (transaction) => {
    await ProductModel.upsert({
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
  });
};

export const persistUserVerification = async (employeeId: string): Promise<void> => {
  await withDatabase(async (transaction) => {
    await UserModel.update({ emailVerified: true }, { where: { employeeId }, transaction });
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
      { where: { id: user.id }, transaction }
    );
  });
};

export const removeUser = async (userId: number): Promise<void> => {
  await withDatabase(async (transaction) => {
    await UserModel.destroy({ where: { id: userId }, transaction });
  });
};

export const persistAuditLog = async (log: {
  id: string;
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
    await AuditLogModel.upsert(
      {
        id: log.id,
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
  const logs = await AuditLogModel.findAll({ order: [['timestamp', 'DESC']], limit: 500 });
  return logs.map((log) => log.toJSON());
};

export const getWarehouses = async (): Promise<unknown[]> => {
  if (!databaseReady) return [];
  const warehouses = await WarehouseModel.findAll({ order: [['id', 'ASC']] });
  return warehouses.map((warehouse) => warehouse.toJSON());
};

export const saveWarehouse = async (warehouse: {
  id: string;
  name: string;
  city: string;
  binsCount: number;
  activeSkus: number;
  capacityPct: number;
  supervisor: string;
  status: string;
}): Promise<void> => {
  await withDatabase(async (transaction) => {
    await WarehouseModel.upsert(warehouse, { transaction });
  });
};

export const deleteWarehouse = async (id: string): Promise<void> => {
  await withDatabase(async (transaction) => {
    await WarehouseModel.destroy({ where: { id }, transaction });
  });
};

export const persistPurchaseOrder = async (order: PurchaseOrderView): Promise<void> => {
  await withDatabase(async (transaction) => {
    const [record] = await PurchaseOrderModel.findOrCreate({
      where: { id: order.id },
      defaults: {
        id: order.id,
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
      where: { purchaseOrderId: record.id },
      defaults: {
        purchaseOrderId: record.id,
        sku: order.sku,
        itemName: order.itemName,
        quantity: order.quantity,
        receivedQuantity: order.receivedQuantity,
      },
      transaction,
    });
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
  });
};

export const persistCustomerOrderStatus = async (
  order: CustomerOrder,
  products: Array<{ id: number; stock: number; qtyReserved: number }>
): Promise<void> => {
  await withDatabase(async (transaction) => {
    await CustomerOrderModel.update(
      { status: order.status, total: order.total, trackingNumber: order.trackingNumber, shippingAddress: order.shippingAddress },
      { where: { orderNumber: order.orderNumber }, transaction }
    );
    await InventoryReservationModel.update(
      { status: order.status === 'CANCELLED' ? 'RELEASED' : order.status === 'PAID' ? 'COMMITTED' : 'RESERVED' },
      { where: { customerOrderId: order.id }, transaction }
    );
    for (const product of products) await persistProductStock(product.id, product.stock, product.qtyReserved, transaction);
  });
};

export type PersistableUser = PublicUser;
