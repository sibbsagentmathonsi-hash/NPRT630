import assert from 'node:assert/strict';
import test from 'node:test';
import { belongsToCompany, runInCompany } from './config/tenancy';
import { getCurrentPolicy } from './config/policies';
import { createProduct, getProductSnapshots } from './inventory';

test('tenant context keeps company policies independent', () => {
  const first = getCurrentPolicy('company-a');
  const second = getCurrentPolicy('company-b');
  assert.notStrictEqual(first, second);
  assert.notStrictEqual(first.controls, second.controls);
});

test('product snapshots do not cross company boundaries', () => {
  const sku = `TENANT-${Date.now()}`;
  runInCompany('company-a', () => {
    createProduct({ sku, barcode: '', name: 'Tenant A Product', category: 'Test', supplierId: 1, stock: 5, reorderPoint: 1, reorderQuantity: 2, unitCost: 1, price: 2, binLocation: 'T-01' });
    assert.ok(getProductSnapshots(true).some((product) => product.sku === sku));
  });
  runInCompany('company-b', () => {
    assert.equal(getProductSnapshots(true).some((product) => product.sku === sku), false);
    assert.equal(belongsToCompany('company-a'), false);
  });
});
