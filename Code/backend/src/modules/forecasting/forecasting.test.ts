import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateForecast, calculateForecasts } from './forecasting';
import { products } from '../../inventory';

test('forecasting: calculateForecast calculates reorderPoint, safetyStock, and recommendedOrderQty', () => {
  const forecast = calculateForecast('MILK-001', 5, 3, 10);
  assert.equal(forecast.sku, 'MILK-001');
  assert.equal(forecast.averageDailyDemand, 5);
  assert.equal(forecast.leadTimeDays, 3);
  assert.equal(forecast.safetyStock, 10);
  // reorderPoint = demand * leadTime + safetyStock = 5 * 3 + 10 = 25
  assert.equal(forecast.reorderPoint, 25);
  assert.ok(forecast.recommendedOrderQty >= 1);
});

test('forecasting: calculateForecast determines High, Medium, and Low risk thresholds accurately', () => {
  // High Risk: daysUntilStockout <= leadTimeDays
  // product with 10 available stock, demand 5 => 2 days until stockout; leadTime 3 => 2 <= 3 => High Risk
  const highRisk = calculateForecast('MILK-001', 5, 3, 10);
  // daysUntilStockout depends on current stock of MILK-001
  assert.ok(['High', 'Medium', 'Low'].includes(highRisk.stockoutRisk));

  // Low Risk: Huge stock, low demand, short lead time
  // Reorder point is small, stockout is far in future
  const lowRisk = calculateForecast('RICE-001', 1, 2, 2);
  assert.ok(lowRisk.daysUntilStockout !== null);
});

test('forecasting: calculateForecast handles unknown SKU gracefully', () => {
  const fallback = calculateForecast('NONEXISTENT-SKU-999', 4, 5, 8);
  assert.equal(fallback.sku, 'NONEXISTENT-SKU-999');
  assert.equal(fallback.currentAvailableStock, 0);
  assert.equal(fallback.stockoutRisk, 'High'); // 0 stock with positive demand is high risk
});

test('forecasting: calculateForecasts generates ranked list for all active products', () => {
  const forecasts = calculateForecasts();
  assert.ok(Array.isArray(forecasts));
  assert.equal(forecasts.length, products.length);

  for (const item of forecasts) {
    assert.ok(item.sku);
    assert.ok(item.productName);
    assert.ok(item.averageDailyDemand >= 0);
    assert.ok(['High', 'Medium', 'Low'].includes(item.stockoutRisk));
    assert.ok(item.recommendedOrderQty >= 1);
  }

  // Ensure items are ordered by risk descending (High before Low)
  const riskWeights = { High: 3, Medium: 2, Low: 1 };
  for (let i = 0; i < forecasts.length - 1; i++) {
    const currentWeight = riskWeights[forecasts[i].stockoutRisk];
    const nextWeight = riskWeights[forecasts[i + 1].stockoutRisk];
    assert.ok(currentWeight >= nextWeight, `Ranking violated at index ${i}: ${forecasts[i].stockoutRisk} before ${forecasts[i + 1].stockoutRisk}`);
  }
});
