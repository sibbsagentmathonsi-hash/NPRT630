import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Client } = require('pg');

dotenv.config();

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = Number(process.env.DB_PORT || 5432);
const dbUser = process.env.DB_USER || 'postgres';
const dbPassword = process.env.DB_PASSWORD || 'M@th0nsi';
const dbName = process.env.DB_NAME || 'inventory_db';

export const sequelize = new Sequelize(dbName, dbUser, dbPassword, {
  host: dbHost,
  port: dbPort,
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: false,
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

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
    const [{ ProductModel, seedProducts }, { SupplierModel, seedSuppliers }, { StockMovementModel, seedStockMovements }] = await Promise.all([
      import('../models/Product'),
      import('../models/Supplier'),
      import('../models/StockMovement'),
    ]);

    // Step 3: Authenticate and synchronize tables
    await sequelize.authenticate();
    await ProductModel.sync({ alter: true });
    await SupplierModel.sync({ alter: true });
    await StockMovementModel.sync({ alter: true });

    // Step 4: Seed initial data if empty
    await seedProducts();
    await seedSuppliers();
    await seedStockMovements();

    console.log(`Successfully connected to actual PostgreSQL database "${dbName}" on ${dbHost}:${dbPort}`);
    return true;
  } catch (error) {
    console.warn('PostgreSQL connection attempt failed. Falling back to high-performance in-memory store.');
    console.warn(error instanceof Error ? error.message : 'Unknown database error');
    return false;
  }
};
