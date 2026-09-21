import { DataTypes, Model, Optional } from 'sequelize';

import { sequelize } from '../config/database';

export interface StockMovementAttributes {
  id: number;
  productId: number;
  sku: string;
  type: 'SALE' | 'RETURN' | 'RECEIVE' | 'AUDIT_ADJUSTMENT' | 'RESERVE' | 'RELEASE';
  quantity: number;
  notes?: string;
}

export type StockMovementCreationAttributes = Optional<StockMovementAttributes, 'id'>;

export class StockMovementModel extends Model<StockMovementAttributes, StockMovementCreationAttributes> implements StockMovementAttributes {
  public id!: number;
  public productId!: number;
  public sku!: string;
  public type!: 'SALE' | 'RETURN' | 'RECEIVE' | 'AUDIT_ADJUSTMENT' | 'RESERVE' | 'RELEASE';
  public quantity!: number;
  public notes?: string;
}

StockMovementModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    sku: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('SALE', 'RETURN', 'RECEIVE', 'AUDIT_ADJUSTMENT', 'RESERVE', 'RELEASE'),
      allowNull: false,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    notes: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'stock_movements',
    timestamps: true,
  },
);

export const seedStockMovements = async (): Promise<void> => {
  const count = await StockMovementModel.count();
  if (count > 0) {
    return;
  }

  await StockMovementModel.bulkCreate([
    { productId: 1, sku: 'MILK-001', type: 'SALE', quantity: 7, notes: 'Day sale' },
    { productId: 2, sku: 'BREAD-001', type: 'RETURN', quantity: 3, notes: 'Customer return' },
    { productId: 4, sku: 'SOAP-001', type: 'RECEIVE', quantity: 20, notes: 'Supplier delivery' },
  ]);
};
