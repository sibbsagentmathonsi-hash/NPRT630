import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';

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
  dialectOptions: { ssl: false },
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
});
