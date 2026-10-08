import { findProductBySku, getAvailableStock, products, stockMovements } from '../../inventory';
import { suppliers } from '../procurement/procurement';

const { SimpleLinearRegression } = require('ml-regression') as {
  SimpleLinearRegression: new (x: number[], y: number[]) => { predict(value: number): number };
};

export type StockoutRisk = 'Low' | 'Medium' | 'High';
export type ForecastModel = 'linear-regression' | 'historical-average' | 'fallback' | 'manual-override';

export type ForecastContext = {
  promotionMultiplier?: number;
  seasonalMultiplier?: number;
};

export type ForecastContextProvider = (sku: string, targetDate: Date) => ForecastContext;

let forecastContextProvider: ForecastContextProvider | undefined;

export const setForecastContextProvider = (provider: ForecastContextProvider | undefined): void => {
  forecastContextProvider = provider;
};

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
  model: ForecastModel;
  trainingObservations: number;
  promotionMultiplier: number;
  seasonalMultiplier: number;
};

const roundOne = (value: number): number => Number(value.toFixed(1));

export const trainDailyDemandModel = (dailySales: number[]): {
  demand: number;
  model: ForecastModel;
  trainingObservations: number;
} => {
  const validObservations = dailySales.filter((quantity) => Number.isFinite(quantity) && quantity >= 0);
  const activeDays = validObservations.filter((quantity) => quantity > 0).length;
  if (activeDays === 0) return { demand: 4, model: 'fallback', trainingObservations: 0 };

  if (activeDays < 3 || validObservations.length < 3) {
    const mean = validObservations.reduce((total, quantity) => total + quantity, 0) / Math.max(activeDays, 1);
    return { demand: roundOne(mean), model: 'historical-average', trainingObservations: validObservations.length };
  }

  const x = validObservations.map((_, index) => index);
  const regression = new SimpleLinearRegression(x, validObservations);
  return {
    demand: roundOne(Math.max(0, regression.predict(validObservations.length))),
    model: 'linear-regression',
    trainingObservations: validObservations.length,
  };
};

const calculateForecastDemand = (sku: string) => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const dailySales = Array.from({ length: 730 }, () => 0);

  for (const movement of stockMovements) {
    if (movement.type !== 'SALE' || movement.sku.toLowerCase() !== sku.toLowerCase()) continue;
    const occurredAt = new Date(movement.timestamp);
    const daysAgo = Math.floor((today.getTime() - Date.UTC(occurredAt.getUTCFullYear(), occurredAt.getUTCMonth(), occurredAt.getUTCDate())) / 86400000);
    if (daysAgo >= 0 && daysAgo < dailySales.length) {
      dailySales[dailySales.length - daysAgo - 1] += movement.quantity;
    }
  }

  return trainDailyDemandModel(dailySales);
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
  suppliedContext?: ForecastContext,
): ForecastPoint => {
  const product = findProductBySku(sku);
  const supplier = product ? suppliers.find((entry) => entry.id === product.supplierId) : undefined;
  const estimate = averageDailyDemand === undefined
    ? calculateForecastDemand(sku)
    : { demand: averageDailyDemand, model: 'manual-override' as const, trainingObservations: 0 };
  const context = suppliedContext ?? forecastContextProvider?.(sku, new Date()) ?? {};
  const promotionMultiplier = Number.isFinite(context.promotionMultiplier) && (context.promotionMultiplier ?? 0) > 0
    ? context.promotionMultiplier!
    : 1;
  const seasonalMultiplier = Number.isFinite(context.seasonalMultiplier) && (context.seasonalMultiplier ?? 0) > 0
    ? context.seasonalMultiplier!
    : 1;
  const demand = roundOne(estimate.demand * promotionMultiplier * seasonalMultiplier);
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
    model: estimate.model,
    trainingObservations: estimate.trainingObservations,
    promotionMultiplier,
    seasonalMultiplier,
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
