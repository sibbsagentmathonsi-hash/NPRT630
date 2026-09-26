import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { users } from '../modules/auth/auth';
import { sequelize } from './sequelize';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Client } = require('pg');

dotenv.config();

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = Number(process.env.DB_PORT || 5432);
const dbUser = process.env.DB_USER || 'postgres';
const dbPassword = process.env.DB_PASSWORD || 'M@th0nsi';
const dbName = process.env.DB_NAME || 'inventory_db';

const ensureDatabaseExists = async (): Promise<void> => {
  const client = new Client({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: 'postgres',
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
    await client.end().catch(() => {});
  }
};

export const connectDatabase = async (): Promise<boolean> => {
  try {
    // Step 1: Ensure database exists
    await ensureDatabaseExists();

    // Step 2: Import models
    const [{ ProductModel, seedProducts }, { SupplierModel, seedSuppliers }, { StockMovementModel, seedStockMovements }, domainModels] = await Promise.all([
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
      ReturnItemModel,
      ReturnModel,
      RoleModel,
      SaleItemModel,
      SaleModel,
      UserModel,
      AuditLogModel,
      WarehouseModel,
    } = domainModels;

    // Step 3: Authenticate and synchronize tables
    await sequelize.authenticate();
    await ProductModel.sync({ alter: true });
    await SupplierModel.sync({ alter: true });
    await StockMovementModel.sync({ alter: true });
    await RoleModel.sync({ alter: true });
    await UserModel.sync({ alter: true });
    await AuditLogModel.sync({ alter: true });
    await WarehouseModel.sync({ alter: true });

    await WarehouseModel.bulkCreate([
      { id: 'JHB-01', name: 'Johannesburg Central Distribution Hub', city: 'Johannesburg, Gauteng', binsCount: 48, activeSkus: 8, capacityPct: 78, supervisor: 'Jayden Khoza (EMP-MGR-101)', status: 'OPERATIONAL' },
      { id: 'CPT-02', name: 'Cape Town Coastal Fulfillment Facility', city: 'Cape Town, Western Cape', binsCount: 36, activeSkus: 5, capacityPct: 62, supervisor: 'Hlonela Dlamini (EMP-WRH-301)', status: 'OPERATIONAL' },
      { id: 'DBN-01', name: 'Durban Port Logistics Depot', city: 'Durban, KwaZulu-Natal', binsCount: 24, activeSkus: 3, capacityPct: 45, supervisor: 'Unassigned', status: 'STANDBY' },
    ], { ignoreDuplicates: true });
    await SaleModel.sync({ alter: true });
    await SaleItemModel.sync({ alter: true });
    await ReturnModel.sync({ alter: true });
    await ReturnItemModel.sync({ alter: true });
    await PurchaseOrderModel.sync({ alter: true });
    await PurchaseOrderItemModel.sync({ alter: true });
    await CustomerOrderModel.sync({ alter: true });
    await CustomerOrderItemModel.sync({ alter: true });
    await InventoryReservationModel.sync({ alter: true });

    const roles = ['ADMIN', 'MANAGER', 'CASHIER', 'WAREHOUSE_STAFF', 'PROCUREMENT_STAFF'];
    await RoleModel.bulkCreate(roles.map((name) => ({ name })), { ignoreDuplicates: true });

    for (const user of users) {
      await UserModel.findOrCreate({
        where: { employeeId: user.employeeId },
        defaults: {
          employeeId: user.employeeId,
          name: user.name,
          email: user.email,
          role: user.role,
          sector: user.sector,
          status: user.status,
          isFirstLogin: user.isFirstLogin,
          mfaEnabled: user.mfaEnabled,
          emailVerified: user.emailVerified,
          passwordHash: await bcrypt.hash(user.password ?? '', 12),
          lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : undefined,
        },
      });
    }

    // Step 4: Seed initial data if empty
    await seedProducts();
    await seedSuppliers();
    await seedStockMovements();

    const { hydrateProducts } = await import('../inventory');
    const storedProducts = await ProductModel.findAll();
    hydrateProducts(storedProducts.map((product) => product.toJSON() as any));

    console.log(`Successfully connected to actual PostgreSQL database "${dbName}" on ${dbHost}:${dbPort}`);
    return true;
  } catch (error) {
    console.warn('PostgreSQL connection attempt failed. Falling back to high-performance in-memory store.');
    console.warn(error instanceof Error ? error.message : 'Unknown database error');
    return false;
  }
};
