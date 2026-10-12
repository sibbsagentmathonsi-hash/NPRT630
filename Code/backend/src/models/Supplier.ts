import { DataTypes, Model, Optional } from 'sequelize';

import { sequelize } from '../config/sequelize';

export interface SupplierAttributes {
  id: number;
  companyId?: string;
  name: string;
  contact: string;
  leadTimeDays: number;
  rating: number;
  isArchived: boolean;
}

export type SupplierCreationAttributes = Optional<SupplierAttributes, 'id' | 'rating' | 'isArchived'>;

export class SupplierModel extends Model<SupplierAttributes, SupplierCreationAttributes> implements SupplierAttributes {
  public id!: number;
  public companyId?: string;
  public name!: string;
  public contact!: string;
  public leadTimeDays!: number;
  public rating!: number;
  public isArchived!: boolean;
}

SupplierModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    companyId: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'company-default' },
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
    },
    rating: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    isArchived: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: 'suppliers',
    timestamps: true,
  },
);

export const removeSampleSuppliers = async (): Promise<void> => {
  const samples = [
    ['Fresh Foods Co.', 'orders@freshfoods.co'],
    ['Bulk Supply Ltd.', 'hello@bulksupply.co'],
  ];
  for (const [name, contact] of samples) {
    await SupplierModel.destroy({ where: { companyId: 'company-default', name, contact } });
  }
};
