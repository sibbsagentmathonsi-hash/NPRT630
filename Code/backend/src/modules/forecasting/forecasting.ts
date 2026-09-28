import { findProductBySku, getAvailableStock, products, stockMovements } from '../../inventory';
import { suppliers } from '../procurement/procurement';

export type StockoutRisk = 'Low' | 'Medium' | 'High';

export type ForecastPoint = {
  sku: string;
  productName: string;
  averageDailyDemand: number;
  leadTimeDays: number;
  safetyStock: number;
  reorderPoint: number;
  currentAvailableStock: number;
  daysUntilStockout: number | null;
  recommendedOrderQty: number;
  stockoutRisk: StockoutRisk;
};

const roundOne = (value: number): number => Number(value.toFixed(1));

const calculateAverageDailyDemand = (sku: string): number => {
  const saleMovements = stockMovements
    .filter((movement) => movement.type === 'SALE' && movement.sku.toLowerCase() === sku.toLowerCase())
    .slice(0, 30);

  if (saleMovements.length === 0) {
    return 4;
  }

  const quantitiesByDate = saleMovements.reduce<Record<string, number>>((acc, movement) => {
    const day = new Date(movement.timestamp).toISOString().slice(0, 10);
    acc[day] = (acc[day] ?? 0) + movement.quantity;
    return acc;
  }, {});

  const observedDays = Math.max(Object.keys(quantitiesByDate).length, 1);
  const totalQuantity = Object.values(quantitiesByDate).reduce((total, quantity) => total + quantity, 0);

  return roundOne(totalQuantity / observedDays);
};

const calculateStockoutRisk = (daysUntilStockout: number | null, leadTimeDays: number): StockoutRisk => {
  if (daysUntilStockout === null) {
    return 'Low';
  }

  if (daysUntilStockout <= leadTimeDays) {
    return 'High';
  }

  if (daysUntilStockout <= leadTimeDays + 3) {
    return 'Medium';
  }

  return 'Low';
};

export const calculateForecast = (
  sku: string,
  averageDailyDemand?: number,
  leadTimeDays?: number,
  safetyStock?: number,
): ForecastPoint => {
  const product = findProductBySku(sku);
  const supplier = product ? suppliers.find((entry) => entry.id === product.supplierId) : undefined;
  const demand = averageDailyDemand ?? calculateAverageDailyDemand(sku);
  const leadTime = leadTimeDays ?? supplier?.leadTimeDays ?? 4;
  const bufferStock = safetyStock ?? Math.ceil(demand * 2);
  const reorderPoint = Math.ceil(demand * leadTime + bufferStock);
  const currentAvailableStock = product ? getAvailableStock(product) : 0;
  const daysUntilStockout = demand > 0 ? roundOne(currentAvailableStock / demand) : null;
  const recommendedOrderQty = Math.max(Math.ceil(reorderPoint + (product?.reorderQuantity ?? 0) - currentAvailableStock), 1);

  return {
    sku: sku.toUpperCase(),
    productName: product?.name ?? sku.toUpperCase(),
    averageDailyDemand: demand,
    leadTimeDays: leadTime,
    safetyStock: bufferStock,
    reorderPoint,
    currentAvailableStock,
    daysUntilStockout,
    recommendedOrderQty,
    stockoutRisk: calculateStockoutRisk(daysUntilStockout, leadTime),
  };
};

export const calculateForecasts = (): ForecastPoint[] => {
  return products
    .map((product) => calculateForecast(product.sku))
    .sort((a, b) => {
      const riskRank: Record<StockoutRisk, number> = { High: 3, Medium: 2, Low: 1 };
      return riskRank[b.stockoutRisk] - riskRank[a.stockoutRisk] || b.recommendedOrderQty - a.recommendedOrderQty;
    });
};
