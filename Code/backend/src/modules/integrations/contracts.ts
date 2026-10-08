export type ElectronicPaymentMethod = 'CARD' | 'QR';

export type PaymentAuthorizationRequest = {
    amount: number;
    currency: 'ZAR';
    method: ElectronicPaymentMethod;
    idempotencyKey: string;
};

export type PaymentAuthorization = {
    reference: string;
    authorizedAmount: number;
};

export interface PaymentProvider {
    authorize(request: PaymentAuthorizationRequest): Promise<PaymentAuthorization>;
    voidAuthorization(reference: string): Promise<void>;
    refund(reference: string, amount: number, idempotencyKey: string): Promise<void>;
}

export interface PointOfSaleAdapter {
    importSales(since: Date): Promise<Array<{ externalId: string; sku: string; quantity: number; total: number }>>;
}

export interface CommerceAdapter {
    fetchOrders(since: Date): Promise<Array<{ externalId: string; customerName: string; items: Array<{ sku: string; quantity: number }> }>>;
    updateAvailableStock(sku: string, quantity: number): Promise<void>;
}

export interface AccountingAdapter {
    recordSale(sale: { reference: string; total: number; tax: number; occurredAt: Date }): Promise<void>;
}

export interface ShippingAdapter {
    createShipment(order: { reference: string; address: string; items: Array<{ sku: string; quantity: number }> }): Promise<{ trackingNumber: string }>;
}

let paymentProvider: PaymentProvider | undefined;

export const setPaymentProvider = (provider: PaymentProvider | undefined): void => {
    paymentProvider = provider;
};

export const authorizeElectronicPayment = async (
    request: PaymentAuthorizationRequest
): Promise<PaymentAuthorization> => {
    if (!paymentProvider) {
        throw new Error('Electronic payments are unavailable: configure a payment provider before accepting Card or QR');
    }

    const authorization = await paymentProvider.authorize(request);
    if (!authorization.reference || Math.round(authorization.authorizedAmount * 100) !== Math.round(request.amount * 100)) {
        await paymentProvider.voidAuthorization(authorization.reference);
        throw new Error('Payment provider did not authorize the full transaction amount');
    }
    return authorization;
};

export const voidElectronicPayment = async (reference: string): Promise<void> => {
    if (!paymentProvider) throw new Error('Payment provider is unavailable to void the authorization');
    await paymentProvider.voidAuthorization(reference);
};

export const refundElectronicPayment = async (
    reference: string,
    amount: number,
    idempotencyKey: string,
): Promise<void> => {
    if (!paymentProvider) throw new Error('Electronic refunds are unavailable: payment provider is not configured');
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Refund amount must be positive');
    await paymentProvider.refund(reference, amount, idempotencyKey);
};