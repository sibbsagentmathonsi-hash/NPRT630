import bcrypt from 'bcryptjs';
import { hydrateUsers, users, validatePasswordStrength } from '../modules/auth/auth';
import { inventoryItems } from '../inventory';
import { loadEnvironment } from './environment';
import { getDatabaseSslOptions } from './databaseSecurity';
import { sequelize } from './sequelize';
import { DEFAULT_COMPANY_ID, companies, defaultCompany } from './tenancy';
import { hydratePolicies } from './policies';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Client } = require('pg');

loadEnvironment();

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = Number(process.env.DB_PORT || 5432);
const dbUser = process.env.DB_USER || 'postgres';
const dbPassword = process.env.DB_PASSWORD;
if (!dbPassword) {
  throw new Error('DB_PASSWORD must be set before initializing the database.');
}
const dbName = process.env.DB_NAME || 'inventory_db';
const storedDate = (value: Date | string): string => new Date(value).toISOString();

const ensureDatabaseExists = async (): Promise<void> => {
  const client = new Client({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: 'postgres',
    ssl: getDatabaseSslOptions(),
  });

  try {
    await client.connect();
    const res = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (res.rowCount === 0) {
      console.log(`Database "${dbName}" not found on PostgreSQL. Creating database...`);
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database "${dbName}" created successfully on PostgreSQL.`);
    }
  } catch (err) {
    console.warn('Could not verify/create database via postgres root db:', err instanceof Error ? err.message : err);
  } finally {
    await client.end().catch(() => { });
  }
};

export const connectDatabase = async (): Promise<boolean> => {
  try {
    // Step 1: Ensure database exists
    await ensureDatabaseExists();

    // Step 2: Import models
    const [{ ProductModel, seedProducts }, { SupplierModel, removeSampleSuppliers }, { StockMovementModel, seedStockMovements }, domainModels] = await Promise.all([
      import('../models/Product'),
      import('../models/Supplier'),
      import('../models/StockMovement'),
      import('../models/DomainModels'),
    ]);
    const {
      CustomerOrderItemModel,
      CustomerOrderModel,
      InventoryReservationModel,
      PurchaseOrderItemModel,
      PurchaseOrderModel,
      SupplierReviewModel,
      ReturnItemModel,
      ReturnModel,
      RoleModel,
      SaleItemModel,
      SaleModel,
      UserModel,
      AuditLogModel,
      CycleCountModel,
      InventoryItemModel,
      WarehouseModel,
      CompanyModel,
      CompanyPolicyModel,
    } = domainModels;

    // Step 3: Authenticate and synchronize tables
    await sequelize.authenticate();
    await CompanyModel.sync({ alter: true });
    await CompanyModel.findOrCreate({ where: { id: DEFAULT_COMPANY_ID }, defaults: defaultCompany as any });
    const storedCompanies = await CompanyModel.findAll();
    companies.splice(0, companies.length, ...storedCompanies.map((record) => record.toJSON() as any));
    await CompanyPolicyModel.sync({ alter: true });
    hydratePolicies((await CompanyPolicyModel.findAll()).map((record) => record.toJSON() as any));
    await ProductModel.sync({ alter: true });
    await SupplierModel.sync({ alter: true });
    await removeSampleSuppliers();
    await StockMovementModel.sync({ alter: true });
    await RoleModel.sync({ alter: true });
    await UserModel.sync({ alter: true });
      await UserModel.update({ isPlatformAdmin: true }, { where: { employeeId: 'ADM-001', companyId: DEFAULT_COMPANY_ID } });
    if (process.env.NODE_ENV !== 'production' && process.env.ADMIN_EMAIL?.trim()) {
      await UserModel.update(
        {
          email: process.env.ADMIN_EMAIL.trim().toLowerCase(),
          passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD || '@Arg3nt2003', 12),
        },
        { where: { employeeId: 'ADM-001', companyId: DEFAULT_COMPANY_ID } }
      );
    }
    await AuditLogModel.sync({ alter: true });
    await WarehouseModel.sync({ alter: true });
    await InventoryItemModel.sync({ alter: true });
    await CycleCountModel.sync({ alter: true });

    await WarehouseModel.bulkCreate([
      { id: 'JHB-01', name: 'Johannesburg Central Distribution Hub', city: 'Johannesburg, Gauteng', binsCount: 48, activeSkus: 8, capacityPct: 78, supervisor: 'Jayden Khoza (MGR-101)', status: 'OPERATIONAL' },
      { id: 'CPT-02', name: 'Cape Town Coastal Fulfillment Facility', city: 'Cape Town, Western Cape', binsCount: 36, activeSkus: 5, capacityPct: 62, supervisor: 'Hlonela Dlamini (WRH-301)', status: 'OPERATIONAL' },
      { id: 'DBN-01', name: 'Durban Port Logistics Depot', city: 'Durban, KwaZulu-Natal', binsCount: 24, activeSkus: 3, capacityPct: 45, supervisor: 'Unassigned', status: 'STANDBY' },
    ], { ignoreDuplicates: true });
    await SaleModel.sync({ alter: true });
    await SaleItemModel.sync({ alter: true });
    await ReturnModel.sync({ alter: true });
    await ReturnItemModel.sync({ alter: true });
    await PurchaseOrderModel.sync({ alter: true });
    await PurchaseOrderItemModel.sync({ alter: true });
    await SupplierReviewModel.sync({ alter: true });
    await CustomerOrderModel.sync({ alter: true });
    await CustomerOrderItemModel.sync({ alter: true });
    await InventoryReservationModel.sync({ alter: true });

    const roles = ['ADMIN', 'MANAGER', 'CASHIER', 'WAREHOUSE_STAFF', 'PROCUREMENT_STAFF'];
    await RoleModel.bulkCreate(roles.map((name) => ({ name })), { ignoreDuplicates: true });

    if (process.env.NODE_ENV === 'production') {
      if (await UserModel.count() === 0) {
        const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
        const adminPassword = process.env.ADMIN_PASSWORD;
        if (!adminEmail || !adminPassword) {
          throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD to bootstrap the first production administrator.');
        }
        const passwordValidation = validatePasswordStrength(adminPassword);
        if (!passwordValidation.isValid) {
          throw new Error(`ADMIN_PASSWORD does not meet the password policy: ${passwordValidation.errors.join(', ')}`);
        }

        await UserModel.create({
          companyId: DEFAULT_COMPANY_ID,
          isPlatformAdmin: true,
          employeeId: 'ADM-001',
          name: process.env.ADMIN_NAME?.trim() || 'System Administrator',
          email: adminEmail,
          role: 'ADMIN',
          sector: 'System Administration',
          status: 'PENDING_SETUP',
          isFirstLogin: true,
          mfaEnabled: false,
          emailVerified: true,
          passwordHash: await bcrypt.hash(adminPassword, 12),
        });
      }
    } else {
      for (const user of users) {
        const companyId = user.companyId || DEFAULT_COMPANY_ID;
        const email = user.email.trim().toLowerCase();
        const [employeeMatch, emailMatch] = await Promise.all([
          UserModel.findOne({ where: { companyId, employeeId: user.employeeId } }),
          UserModel.findOne({ where: { companyId, email } }),
        ]);

        if (employeeMatch && emailMatch && employeeMatch.id !== emailMatch.id) {
          throw new Error(`Conflicting existing users for development seed employee "${user.employeeId}" in company "${companyId}".`);
        }
        if (employeeMatch || emailMatch) continue;

        await UserModel.create({
          companyId,
          isPlatformAdmin: user.isPlatformAdmin,
          employeeId: user.employeeId,
          name: user.name,
          email,
          role: user.role,
          sector: user.sector,
          status: user.status,
          isFirstLogin: user.isFirstLogin,
          mfaEnabled: user.mfaEnabled,
          emailVerified: user.emailVerified,
          passwordHash: await bcrypt.hash(user.password ?? '', 12),
          lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : undefined,
        });
      }
    }

    // Step 4: Seed initial data if empty
    await seedProducts();
    await seedStockMovements();

    const {
      hydrateCustomerOrders,
      hydrateCycleCounts,
      hydrateInventoryItems,
      hydrateProducts,
      hydrateSalesReceipts,
      hydrateStockMovements,
    } = await import('../inventory');
    const { hydratePurchaseOrders, hydrateSupplierReviews, hydrateSuppliers } = await import('../modules/procurement/procurement');
    const storedProducts = await ProductModel.findAll();
    hydrateProducts(storedProducts.map((product) => product.toJSON() as any));
    const storedInventoryItems = await InventoryItemModel.findAll();
    if (storedInventoryItems.length === 0) {
      await InventoryItemModel.bulkCreate(inventoryItems.map((item) => ({ ...item, updatedAt: new Date(item.updatedAt) })));
    } else {
      hydrateInventoryItems(storedInventoryItems.map((item) => item.toJSON() as any));
    }

    const [storedUsers, storedSales, storedMovements, storedSuppliers, storedPurchaseOrders, storedSupplierReviews, storedCustomerOrders, storedCycleCounts] = await Promise.all([
      UserModel.findAll(),
      SaleModel.findAll({ include: [{ model: SaleItemModel, as: 'items' }] }),
      StockMovementModel.findAll({ order: [['id', 'ASC']] }),
      SupplierModel.findAll({ order: [['id', 'ASC']] }),
      PurchaseOrderModel.findAll({ include: [{ model: PurchaseOrderItemModel, as: 'items' }] }),
      SupplierReviewModel.findAll({ order: [['createdAt', 'DESC']] }),
      CustomerOrderModel.findAll({ include: [{ model: CustomerOrderItemModel, as: 'items' }] }),
      CycleCountModel.findAll({ order: [['id', 'ASC']] }),
    ]);
    if (process.env.NODE_ENV === 'production' && !storedUsers.some((user) => user.role === 'ADMIN')) {
      throw new Error('Production database must contain an administrator account.');
    }
    hydrateUsers(storedUsers.map((record) => record.toJSON() as any));
    hydrateSalesReceipts(storedSales.map((record) => record.toJSON() as any));
    hydrateStockMovements(storedMovements.map((record) => record.toJSON() as any));
    hydrateSuppliers(storedSuppliers.map((record) => ({
      id: Number(record.id),
      companyId: String(record.companyId ?? DEFAULT_COMPANY_ID),
      name: String(record.name),
      contact: String(record.contact),
      leadTimeDays: Number(record.leadTimeDays),
      isArchived: Boolean(record.isArchived),
    })));
    hydratePurchaseOrders(storedPurchaseOrders.map((record) => {
      const order = record.toJSON() as any;
      const item = order.items?.[0];
      return {
        id: Number(order.id),
        companyId: String(order.companyId ?? DEFAULT_COMPANY_ID),
        supplierId: Number(order.supplierId),
        sku: String(item?.sku ?? ''),
        itemName: String(item?.itemName ?? ''),
        quantity: Number(order.totalQuantity),
        receivedQuantity: Number(order.receivedQuantity),
        status: order.status,
        createdAt: storedDate(order.createdAt),
        approvedAt: order.approvedAt ? storedDate(order.approvedAt) : undefined,
        sentAt: order.sentAt ? storedDate(order.sentAt) : undefined,
        expectedDeliveryDate: order.expectedDeliveryDate ? storedDate(order.expectedDeliveryDate) : undefined,
        notes: order.notes ?? undefined,
      };
    }));
    hydrateSupplierReviews(storedSupplierReviews.map((record) => {
      const review = record.toJSON() as any;
      return {
        ...review,
        id: String(review.id),
        purchaseOrderId: Number(review.purchaseOrderId),
        supplierId: Number(review.supplierId),
        reviewerId: String(review.reviewerId),
        deliveryScore: Number(review.deliveryScore),
        qualityScore: Number(review.qualityScore),
        communicationScore: Number(review.communicationScore),
        createdAt: storedDate(review.createdAt),
      };
    }));
    hydrateCustomerOrders(storedCustomerOrders.map((record) => record.toJSON() as any));
    hydrateCycleCounts(storedCycleCounts.map((record) => record.toJSON() as any));

    console.log(`Successfully connected to actual PostgreSQL database "${dbName}" on ${dbHost}:${dbPort}`);
    return true;
  } catch (error) {
    console.warn('PostgreSQL connection attempt failed. Falling back to high-performance in-memory store.');
    console.warn(error instanceof Error ? error.message : 'Unknown database error');
    return false;
  }
};
