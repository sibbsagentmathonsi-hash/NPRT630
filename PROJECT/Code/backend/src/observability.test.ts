import test from 'node:test';
import assert from 'node:assert/strict';

import { getRequestMetrics, recordRequestMetric } from './observability';

test('observability: aggregates route counts, failures, average, and p95 latency', () => {
    const route = 'TEST GET /metrics';
    recordRequestMetric(route, 200, 10);
    recordRequestMetric(route, 503, 30);

    const metrics = getRequestMetrics().find((entry) => entry.route === route);
    assert.ok(metrics);
    assert.equal(metrics.requests, 2);
    assert.equal(metrics.serverErrors, 1);
    assert.equal(metrics.averageMs, 20);
    assert.equal(metrics.p95Ms, 30);
});