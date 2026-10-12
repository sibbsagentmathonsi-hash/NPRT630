import assert from 'node:assert/strict';
import test from 'node:test';
import { getCurrentPolicy, setCurrentPolicy, updateSystemPolicy } from './policies';

test('policy changes are staged before persistence and merge control statuses by id', () => {
  const companyId = 'policy-unit-test-company';
  const current = getCurrentPolicy(companyId);
  const proposed = updateSystemPolicy({
    vatRate: 12,
    controls: [{ id: 'negative-inventory', name: '', description: '', status: 'DISABLED' }],
  }, 'test-admin', companyId);

  assert.equal(current.vatRate, 15);
  assert.equal(getCurrentPolicy(companyId).vatRate, 15);
  assert.equal(proposed.vatRate, 12);
  assert.equal(proposed.controls.length, current.controls.length);
  assert.equal(proposed.controls.find((control) => control.id === 'negative-inventory')?.status, 'DISABLED');
  assert.equal(proposed.controls.find((control) => control.id === 'returns-verification')?.status, 'ENFORCED');
  assert.equal(proposed.password.firstLoginChangeRequired, true);

  const firstLoginDisabled = updateSystemPolicy({
    controls: [{ id: 'first-login-password', name: '', description: '', status: 'DISABLED' }],
  }, 'test-admin', companyId);
  assert.equal(firstLoginDisabled.password.firstLoginChangeRequired, false);

  setCurrentPolicy(companyId, proposed);
  assert.equal(getCurrentPolicy(companyId).vatRate, 12);
});
