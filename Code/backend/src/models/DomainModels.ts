import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/sequelize';

export type UserRoleName = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'WAREHOUSE_STAFF' | 'PROCUREMENT_STAFF';

class RoleModel extends Model {
  declare id: number;
  declare name: UserRoleName;
}

RoleModel.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(40), allowNull: false, unique: true },
  },
  { sequelize, tableName: 'roles', timestamps: true }
);

export interface UserAttributes {
  id: number;
  employeeId: string;
  name: string;
  email: string;
  role: UserRoleName;
  sector: string;
  status: string;
  isFirstLogin: boolean;
  mfaEnabled: boolean;
  emailVerified: boolean;
  mfaSecret?: string;
  passwordHash: string;
  lastLoginAt?: Date;
}

class UserModel extends Model<UserAttributes, Optional<UserAttributes, 'id' | 'lastLoginAt'>> implements UserAttributes {
  declare id: number;
  declare employeeId: string;
  declare name: string;
  declare email: string;
  declare role: UserRoleName;
  declare sector: string;
  declare status: string;
  declare isFirstLogin: boolean;
  declare mfaEnabled: boolean;
  declare emailVerified: boolean;
  declare passwordHash: string;
  declare lastLoginAt?: Date;
}

UserModel.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    employeeId: { type: DataTypes.STRING(40), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(150), allowNull: false },
    email: { type: DataTypes.STRING(254), allowNull: false, unique: true },
    role: { type: DataTypes.STRING(40), allowNull: false },
    sector: { type: DataTypes.STRING(100), allowNull: false },
    status: { type: DataTypes.STRING(30), allowNull: false },
    isFirstLogin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    mfaEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    emailVerified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    mfaSecret: { type: DataTypes.STRING(64), allowNull: true },
    passwordHash: { type: DataTypes.STRING(255), allowNull: false },
    lastLoginAt: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, tableName: 'users', timestamps: true }
);

class AuditLogModel extends Model {
  declare id: string;
  declare timestamp: Date;
  declare actor: string;
  declare actorRole: string;
  declare eventType: string;
  declare targetUserId?: string;
  declare details: string;
  declare ipAddress?: string;
  declare status: string;
}

AuditLogModel.init(
  {
    id: { type: DataTypes.STRING(60), primaryKey: true },
    timestamp: { type: DataTypes.DATE, allowNull: false },
    actor: { type: DataTypes.STRING(150), allowNull: false },
    actorRole: { type: DataTypes.STRING(40), allowNull: false },
    eventType: { type: DataTypes.STRING(60), allowNull: false },
    targetUserId: { type: DataTypes.STRING(80), allowNull: true },
    details: { type: DataTypes.TEXT, allowNull: false },
    ipAddress: { type: DataTypes.STRING(80), allowNull: true },
    status: { type: DataTypes.STRING(20), allowNull: false },
  },
  { sequelize, tableName: 'security_audit_logs', timestamps: true }
);

class WarehouseModel extends Model {
  declare id: string;
  declare name: string;
  declare city: string;
  declare binsCount: number;
  declare activeSkus: number;
  declare capacityPct: number;
  declare supervisor: string;
  declare status: string;
}

WarehouseModel.init(
  {
    id: { type: DataTypes.STRING(30), primaryKey: true },
    name: { type: DataTypes.STRING(150), allowNull: false },
    city: { type: DataTypes.STRING(120), allowNull: false },
    binsCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    activeSkus: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    capacityPct: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    supervisor: { type: DataTypes.STRING(150), allowNull: false, defaultValue: 'Unassigned' },
    status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'STANDBY' },
  },
  { sequelize, tableName: 'warehouses', timestamps: true }
);

class SaleModel extends Model {
  declare id: number;
  declare receiptNumber: string;
  declare subtotal: number;
  declare vatAmount: number;
  declare discountAmount: number;
  declare total: number;
  declare paymentMethod: string;
  declare tenderAmount?: number;
  declare changeAmount?: number;
  declare cashierName: string;
  declare cashierEmployeeId: string;
  declare notes?: string;
}

SaleModel.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    receiptNumber: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    vatAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    discountAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    paymentMethod: { type: DataTypes.STRING(20), allowNull: false },
    tenderAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    changeAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    cashierName: { type: DataTypes.STRING(150), allowNull: false },
    cashierEmployeeId: { type: DataTypes.STRING(40), allowNull: false },
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, tableName: 'sales', timestamps: true }
);

class SaleItemModel extends Model {
  declare id: number;
  declare saleId: number;
  declare productId: number;
  declare sku: string;
  declare name: string;
  declare quantity: number;
  declare unitPrice: number;
  declare lineTotal: number;
}

SaleItemModel.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    saleId: { type: DataTypes.INTEGER, allowNull: false },
    productId: { type: DataTypes.INTEGER, allowNull: false },
    sku: { type: DataTypes.STRING(50), allowNull: false },
    name: { type: DataTypes.STRING(150), allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    unitPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    lineTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  },
  { sequelize, tableName: 'sale_items', timestamps: true }
);

class ReturnModel extends Model {
  declare id: number;
  declare returnNumber: string;
  declare receiptNumber?: string;
  declare refundAmount: number;
  declare reason: string;
  declare notes?: string;
  declare actor?: string;
}

ReturnModel.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    returnNumber: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    receiptNumber: { type: DataTypes.STRING(50), allowNull: true },
    refundAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    reason: { type: DataTypes.STRING(100), allowNull: false },
    notes: { type: DataTypes.TEXT, allowNull: true },
    actor: { type: DataTypes.STRING(150), allowNull: true },
  },
  { sequelize, tableName: 'returns', timestamps: true }
);

class ReturnItemModel extends Model {
  declare id: number;
  declare returnId: number;
  declare productId: number;
  declare sku: string;
  declare quantity: number;
  declare unitPrice: number;
}

ReturnItemModel.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    returnId: { type: DataTypes.INTEGER, allowNull: false },
    productId: { type: DataTypes.INTEGER, allowNull: false },
    sku: { type: DataTypes.STRING(50), allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    unitPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  },
  { sequelize, tableName: 'return_items', timestamps: true }
);

class PurchaseOrderModel extends Model {
  declare id: number;
  declare supplierId: number;
  declare status: string;
  declare totalQuantity: number;
  declare receivedQuantity: number;
  declare approvedAt?: Date;
  declare sentAt?: Date;
  declare expectedDeliveryDate?: Date;
  declare notes?: string;
}

PurchaseOrderModel.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    supplierId: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.STRING(30), allowNull: false },
    totalQuantity: { type: DataTypes.INTEGER, allowNull: false },
    receivedQuantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    approvedAt: { type: DataTypes.DATE, allowNull: true },
    sentAt: { type: DataTypes.DATE, allowNull: true },
    expectedDeliveryDate: { type: DataTypes.DATE, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, tableName: 'purchase_orders', timestamps: true }
);

class PurchaseOrderItemModel extends Model {
  declare id: number;
  declare purchaseOrderId: number;
  declare productId?: number;
  declare sku: string;
  declare itemName: string;
  declare quantity: number;
  declare receivedQuantity: number;
}

PurchaseOrderItemModel.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    purchaseOrderId: { type: DataTypes.INTEGER, allowNull: false },
    productId: { type: DataTypes.INTEGER, allowNull: true },
    sku: { type: DataTypes.STRING(50), allowNull: false },
    itemName: { type: DataTypes.STRING(150), allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    receivedQuantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  { sequelize, tableName: 'purchase_order_items', timestamps: true }
);

class InventoryReservationModel extends Model {
  declare id: number;
  declare customerOrderId: number;
  declare productId: number;
  declare quantity: number;
  declare status: string;
}

InventoryReservationModel.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    customerOrderId: { type: DataTypes.INTEGER, allowNull: false },
    productId: { type: DataTypes.INTEGER, allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'RESERVED' },
  },
  { sequelize, tableName: 'inventory_reservations', timestamps: true }
);

class CustomerOrderModel extends Model {
  declare id: number;
  declare orderNumber: string;
  declare customerName: string;
  declare status: string;
  declare total: number;
  declare trackingNumber?: string;
  declare shippingAddress?: string;
}

CustomerOrderModel.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    orderNumber: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    customerName: { type: DataTypes.STRING(150), allowNull: false },
    status: { type: DataTypes.STRING(30), allowNull: false },
    total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    trackingNumber: { type: DataTypes.STRING(80), allowNull: true },
    shippingAddress: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, tableName: 'customer_orders', timestamps: true }
);

class CustomerOrderItemModel extends Model {
  declare id: number;
  declare customerOrderId: number;
  declare productId: number;
  declare sku: string;
  declare name: string;
  declare quantity: number;
  declare unitPrice: number;
  declare lineTotal: number;
}

CustomerOrderItemModel.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    customerOrderId: { type: DataTypes.INTEGER, allowNull: false },
    productId: { type: DataTypes.INTEGER, allowNull: false },
    sku: { type: DataTypes.STRING(50), allowNull: false },
    name: { type: DataTypes.STRING(150), allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    unitPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    lineTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  },
  { sequelize, tableName: 'customer_order_items', timestamps: true }
);

RoleModel.hasMany(UserModel, { foreignKey: 'role', sourceKey: 'name', constraints: false });
SaleModel.hasMany(SaleItemModel, { foreignKey: 'saleId', as: 'items' });
SaleItemModel.belongsTo(SaleModel, { foreignKey: 'saleId' });
ReturnModel.hasMany(ReturnItemModel, { foreignKey: 'returnId', as: 'items' });
ReturnItemModel.belongsTo(ReturnModel, { foreignKey: 'returnId' });
PurchaseOrderModel.hasMany(PurchaseOrderItemModel, { foreignKey: 'purchaseOrderId', as: 'items' });
PurchaseOrderItemModel.belongsTo(PurchaseOrderModel, { foreignKey: 'purchaseOrderId' });
CustomerOrderModel.hasMany(CustomerOrderItemModel, { foreignKey: 'customerOrderId', as: 'items' });
CustomerOrderItemModel.belongsTo(CustomerOrderModel, { foreignKey: 'customerOrderId' });
CustomerOrderModel.hasMany(InventoryReservationModel, { foreignKey: 'customerOrderId', as: 'reservations' });
InventoryReservationModel.belongsTo(CustomerOrderModel, { foreignKey: 'customerOrderId' });

export {
  RoleModel,
  UserModel,
  AuditLogModel,
  WarehouseModel,
  SaleModel,
  SaleItemModel,
  ReturnModel,
  ReturnItemModel,
  PurchaseOrderModel,
  PurchaseOrderItemModel,
  InventoryReservationModel,
  CustomerOrderModel,
  CustomerOrderItemModel,
};
