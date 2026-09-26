import { DataTypes, Model, Optional } from 'sequelize';

import { sequelize } from '../config/sequelize';

export interface SupplierAttributes {
  id: number;
  name: string;
  contact: string;
  leadTimeDays: number;
  rating: number;
}

export type SupplierCreationAttributes = Optional<SupplierAttributes, 'id'>;

export class SupplierModel extends Model<SupplierAttributes, SupplierCreationAttributes> implements SupplierAttributes {
  public id!: number;
  public name!: string;
  public contact!: string;
  public leadTimeDays!: number;
  public rating!: number;
}

SupplierModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    contact: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    leadTimeDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3,
    },
    rating: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 4.5,
    },
  },
  {
    sequelize,
    tableName: 'suppliers',
    timestamps: true,
  },
);

export const seedSuppliers = async (): Promise<void> => {
  const count = await SupplierModel.count();
  if (count > 0) {
    return;
  }

  await SupplierModel.bulkCreate([
    { name: 'Fresh Foods Co.', contact: 'orders@freshfoods.co', leadTimeDays: 3, rating: 4.8 },
    { name: 'Bulk Supply Ltd.', contact: 'hello@bulksupply.co', leadTimeDays: 5, rating: 4.6 },
  ]);
};
