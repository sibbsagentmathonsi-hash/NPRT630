import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/sequelize';

export interface CompanyAttributes {
  id: string;
  legalName: string;
  tradingName: string;
  registrationNumber?: string;
  taxNumber?: string;
  currency: string;
  timezone: string;
  subscriptionStatus: string;
}

export class CompanyModel extends Model<CompanyAttributes> implements CompanyAttributes {
  declare id: string;
  declare legalName: string;
  declare tradingName: string;
  declare registrationNumber?: string;
  declare taxNumber?: string;
  declare currency: string;
  declare timezone: string;
  declare subscriptionStatus: string;
}

export class CompanyPolicyModel extends Model {
  declare companyId: string;
  declare configuration: object;
}

CompanyPolicyModel.init(
  {
    companyId: { type: DataTypes.STRING(80), primaryKey: true },
    configuration: { type: DataTypes.JSONB, allowNull: false },
  },
  { sequelize, tableName: 'company_policies', timestamps: true }
);

CompanyModel.init(
  {
    id: { type: DataTypes.STRING(80), primaryKey: true },
    legalName: { type: DataTypes.STRING(200), allowNull: false },
    tradingName: { type: DataTypes.STRING(150), allowNull: false },
    registrationNumber: { type: DataTypes.STRING(100), allowNull: true },
    taxNumber: { type: DataTypes.STRING(100), allowNull: true },
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'ZAR' },
    timezone: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'Africa/Johannesburg' },
    subscriptionStatus: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'ACTIVE' },
  },
  { sequelize, tableName: 'companies', timestamps: true }
);

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
  companyId: string;
  isPlatformAdmin: boolean;
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
  declare companyId: string;
  declare isPlatformAdmin: boolean;
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
    companyId: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'company-default' },
    isPlatformAdmin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    employeeId: { type: DataTypes.STRING(40), allowNull: false },
    name: { type: DataTypes.STRING(150), allowNull: false },
    email: { type: DataTypes.STRING(254), allowNull: false },
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
  { sequelize, tableName: 'users', timestamps: true, indexes: [{ unique: true, fields: ['companyId', 'employeeId'] }, { unique: true, fields: ['companyId', 'email'] }] }
);

class AuditLogModel extends Model {
  declare id: string;
  declare companyId?: string;
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
    companyId: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'company-default' },
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
  declare companyId?: string;
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
    companyId: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'company-default' },
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

class InventoryItemModel extends Model {
  declare id: string;
  declare companyId?: string;
  declare productId: number;
  declare warehouseId: string;
  declare binCode: string;
  declare qtyOnHand: number;
  declare qtyReserved: number;
  declare updatedAt: Date;
}

InventoryItemModel.init(
  {
    id: { type: DataTypes.STRING(200), primaryKey: true },
    companyId: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'company-default' },
    productId: { type: DataTypes.INTEGER, allowNull: false },
    warehouseId: { type: DataTypes.STRING(30), allowNull: false },
    binCode: { type: DataTypes.STRING(40), allowNull: false },
    qtyOnHand: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    qtyReserved: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'inventory_items',
    timestamps: false,
    indexes: [{ unique: true, fields: ['productId', 'warehouseId', 'binCode'] }],
  }
);

class CycleCountModel extends Model {
  declare id: number;
  declare companyId?: string;
  declare auditNumber: string;
  declare warehouseId: string;
  declare binCode: string;
  declare items: unknown[];
  declare status: string;
  declare performedBy: string;
  declare performedAt: Date;
  declare managerNotes?: string;
}

CycleCountModel.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    companyId: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'company-default' },
    auditNumber: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    warehouseId: { type: DataTypes.STRING(30), allowNull: false },
    binCode: { type: DataTypes.STRING(40), allowNull: false },
    items: { type: DataTypes.JSONB, allowNull: false },
    status: { type: DataTypes.STRING(30), allowNull: false },
    performedBy: { type: DataTypes.STRING(150), allowNull: false },
    performedAt: { type: DataTypes.DATE, allowNull: false },
    managerNotes: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, tableName: 'cycle_counts', timestamps: false }
);

class SaleModel extends Model {
  declare id: number;
  declare companyId?: string;
  declare receiptNumber: string;
  declare subtotal: number;
  declare vatAmount: number;
  declare discountAmount: number;
  declare total: number;
  declare paymentMethod: string;
  declare paymentReference?: string;
  declare tenderAmount?: number;
  declare changeAmount?: number;
  declare cashierName: string;
  declare cashierEmployeeId: string;
  declare notes?: string;
}

SaleModel.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    companyId: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'company-default' },
    receiptNumber: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    vatAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    discountAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    paymentMethod: { type: DataTypes.STRING(20), allowNull: false },
    paymentReference: { type: DataTypes.STRING(120), allowNull: true },
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
  declare companyId?: string;
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
    companyId: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'company-default' },
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
  declare companyId?: string;
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
    companyId: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'company-default' },
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
  declare companyId?: string;
  declare returnId: number;
  declare productId: number;
  declare sku: string;
  declare quantity: number;
  declare unitPrice: number;
}

ReturnItemModel.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    companyId: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'company-default' },
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
  declare companyId?: string;
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
    companyId: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'company-default' },
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
  declare companyId?: string;
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
    companyId: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'company-default' },
    purchaseOrderId: { type: DataTypes.INTEGER, allowNull: false },
    productId: { type: DataTypes.INTEGER, allowNull: true },
    sku: { type: DataTypes.STRING(50), allowNull: false },
    itemName: { type: DataTypes.STRING(150), allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    receivedQuantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  { sequelize, tableName: 'purchase_order_items', timestamps: true }
);

class SupplierReviewModel extends Model {
  declare id: number;
  declare companyId: string;
  declare purchaseOrderId: number;
  declare supplierId: number;
  declare reviewerId: string;
  declare reviewerName: string;
  declare deliveryScore: number;
  declare qualityScore: number;
  declare communicationScore: number;
  declare feedback?: string;
  declare createdAt: Date;
}

SupplierReviewModel.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    companyId: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'company-default' },
    purchaseOrderId: { type: DataTypes.INTEGER, allowNull: false },
    supplierId: { type: DataTypes.INTEGER, allowNull: false },
    reviewerId: { type: DataTypes.STRING(80), allowNull: false },
    reviewerName: { type: DataTypes.STRING(150), allowNull: false },
    deliveryScore: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 5 } },
    qualityScore: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 5 } },
    communicationScore: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 5 } },
    feedback: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    tableName: 'supplier_reviews',
    timestamps: true,
    indexes: [{ unique: true, fields: ['companyId', 'purchaseOrderId'] }],
  }
);

class InventoryReservationModel extends Model {
  declare id: number;
  declare companyId?: string;
  declare customerOrderId: number;
  declare productId: number;
  declare quantity: number;
  declare status: string;
}

InventoryReservationModel.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    companyId: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'company-default' },
    customerOrderId: { type: DataTypes.INTEGER, allowNull: false },
    productId: { type: DataTypes.INTEGER, allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'RESERVED' },
  },
  { sequelize, tableName: 'inventory_reservations', timestamps: true }
);

class CustomerOrderModel extends Model {
  declare id: number;
  declare companyId?: string;
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
    companyId: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'company-default' },
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
  declare companyId?: string;
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
    companyId: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'company-default' },
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
  InventoryItemModel,
  CycleCountModel,
  SaleModel,
  SaleItemModel,
  ReturnModel,
  ReturnItemModel,
  PurchaseOrderModel,
  PurchaseOrderItemModel,
  SupplierReviewModel,
  InventoryReservationModel,
  CustomerOrderModel,
  CustomerOrderItemModel,
};
