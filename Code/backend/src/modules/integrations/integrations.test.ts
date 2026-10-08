import test from 'node:test';
import assert from 'node:assert/strict';

import { authorizeElectronicPayment, refundElectronicPayment, setPaymentProvider } from './contracts';

test('electronic payments fail closed when no provider is configured', async () => {
    setPaymentProvider(undefined);
    await assert.rejects(
        authorizeElectronicPayment({ amount: 10, currency: 'ZAR', method: 'CARD', idempotencyKey: 'sale-1' }),
        /configure a payment provider/
    );
});

test('provider authorization must cover the full sale amount', async () => {
    let voidedReference = '';
    setPaymentProvider({
        authorize: async () => ({ reference: 'auth-1', authorizedAmount: 9.99 }),
        voidAuthorization: async (reference) => { voidedReference = reference; },
        refund: async () => { },
    });

    await assert.rejects(
        authorizeElectronicPayment({ amount: 10, currency: 'ZAR', method: 'QR', idempotencyKey: 'sale-2' }),
        /full transaction amount/
    );
    assert.equal(voidedReference, 'auth-1');
    setPaymentProvider(undefined);
});

test('electronic refunds fail closed when no provider is configured', async () => {
    setPaymentProvider(undefined);
    await assert.rejects(refundElectronicPayment('auth-1', 10, 'return-1'), /provider is not configured/);
});