import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/sequelize';

export interface ProductAttributes {
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
}

export type ProductCreationAttributes = Optional<ProductAttributes, 'id'>;

export class ProductModel extends Model<ProductAttributes, ProductCreationAttributes> implements ProductAttributes {
  public id!: number;
  public sku!: string;
  public barcode!: string;
  public name!: string;
  public category!: string;
  public supplierId!: number;
  public stock!: number;
  public qtyReserved!: number;
  public reorderPoint!: number;
  public reorderQuantity!: number;
  public unitCost!: number;
  public price!: number;
  public warehouse!: string;
  public warehouseId!: string;
  public binLocation!: string;
  public imageUrl?: string;
  public isActive!: boolean;
}

ProductModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    sku: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    barcode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: '',
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    supplierId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    qtyReserved: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    reorderPoint: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    reorderQuantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    unitCost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    warehouse: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'Johannesburg Central (JHB-01)',
    },
    warehouseId: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'JHB-01',
    },
    binLocation: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'A-01',
    },
    imageUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: 'products',
    timestamps: true,
  }
);

export const seedProducts = async (): Promise<void> => {
  const count = await ProductModel.count();
  if (count > 0) {
    return;
  }

  await ProductModel.bulkCreate([
    {
      sku: 'MILK-001',
      barcode: '6001001000011',
      name: 'Fresh Full Cream Milk 1L',
      category: 'Dairy & Fresh',
      supplierId: 1,
      stock: 42,
      qtyReserved: 2,
      reorderPoint: 20,
      reorderQuantity: 48,
      unitCost: 17.2,
      price: 25.5,
      warehouse: 'Johannesburg Central (JHB-01)',
      warehouseId: 'JHB-01',
      binLocation: 'A-01',
      imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=200&auto=format&fit=crop&q=60',
      isActive: true,
    },
    {
      sku: 'BREAD-001',
      barcode: '6001001000028',
      name: 'White Bread Loaf (Sliced)',
      category: 'Bakery',
      supplierId: 1,
      stock: 18,
      qtyReserved: 0,
      reorderPoint: 25,
      reorderQuantity: 60,
      unitCost: 11.4,
      price: 18.2,
      warehouse: 'Johannesburg Central (JHB-01)',
      warehouseId: 'JHB-01',
      binLocation: 'A-03',
      imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=200&auto=format&fit=crop&q=60',
      isActive: true,
    },
    {
      sku: 'RICE-001',
      barcode: '6001001000035',
      name: 'Long Grain Parboiled Rice 2kg',
      category: 'Groceries & Dry Goods',
      supplierId: 2,
      stock: 64,
      qtyReserved: 4,
      reorderPoint: 30,
      reorderQuantity: 36,
      unitCost: 29.5,
      price: 42.0,
      warehouse: 'Cape Town Facility (CPT-02)',
      warehouseId: 'CPT-02',
      binLocation: 'B-04',
      imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=200&auto=format&fit=crop&q=60',
      isActive: true,
    },
    {
      sku: 'ELEC-003',
      barcode: '6001001000042',
      name: 'Portable Bluetooth Speaker',
      category: 'Electronics & Audio',
      supplierId: 3,
      stock: 7,
      qtyReserved: 1,
      reorderPoint: 10,
      reorderQuantity: 20,
      unitCost: 450.0,
      price: 899.99,
      warehouse: 'Johannesburg Central (JHB-01)',
      warehouseId: 'JHB-01',
      binLocation: 'C3-042',
      imageUrl: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=200&auto=format&fit=crop&q=60',
      isActive: true,
    },
    {
      sku: 'FOOD-002',
      barcode: '6001001000059',
      name: 'Green Tea Collection Box 50s',
      category: 'Beverages & Coffee',
      supplierId: 2,
      stock: 3,
      qtyReserved: 0,
      reorderPoint: 10,
      reorderQuantity: 25,
      unitCost: 65.0,
      price: 129.99,
      warehouse: 'Johannesburg Central (JHB-01)',
      warehouseId: 'JHB-01',
      binLocation: 'B-02',
      imageUrl: 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=200&auto=format&fit=crop&q=60',
      isActive: true,
    },
    {
      sku: 'OFF-001',
      barcode: '6001001000066',
      name: 'A4 Executive Notebook 5-Pack',
      category: 'Office Supplies',
      supplierId: 4,
      stock: 4,
      qtyReserved: 0,
      reorderPoint: 10,
      reorderQuantity: 30,
      unitCost: 45.0,
      price: 89.0,
      warehouse: 'Cape Town Facility (CPT-02)',
      warehouseId: 'CPT-02',
      binLocation: 'D-01',
      imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=200&auto=format&fit=crop&q=60',
      isActive: true,
    },
    {
      sku: 'HLTH-001',
      barcode: '6001001000073',
      name: 'Natural Hydrating Face Moisturizer 100ml',
      category: 'Health & Beauty',
      supplierId: 3,
      stock: 39,
      qtyReserved: 3,
      reorderPoint: 15,
      reorderQuantity: 40,
      unitCost: 140.0,
      price: 289.99,
      warehouse: 'Johannesburg Central (JHB-01)',
      warehouseId: 'JHB-01',
      binLocation: 'C-01',
      imageUrl: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=200&auto=format&fit=crop&q=60',
      isActive: true,
    },
    {
      sku: 'FOOD-001',
      barcode: '6001001000080',
      name: 'Organic Arabica Coffee Beans 1kg',
      category: 'Beverages & Coffee',
      supplierId: 2,
      stock: 50,
      qtyReserved: 5,
      reorderPoint: 20,
      reorderQuantity: 30,
      unitCost: 85.0,
      price: 170.0,
      warehouse: 'Johannesburg Central (JHB-01)',
      warehouseId: 'JHB-01',
      binLocation: 'B-01',
      imageUrl: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=200&auto=format&fit=crop&q=60',
      isActive: true,
    },
  ]);
};
