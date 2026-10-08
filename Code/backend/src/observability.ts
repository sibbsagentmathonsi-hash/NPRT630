import type { NextFunction, Request, Response } from 'express';

type RouteMetrics = {
    requests: number;
    serverErrors: number;
    durationsMs: number[];
};

const metricsByRoute = new Map<string, RouteMetrics>();

export const recordRequestMetric = (route: string, statusCode: number, durationMs: number): void => {
    const metrics = metricsByRoute.get(route) ?? { requests: 0, serverErrors: 0, durationsMs: [] };
    metrics.requests += 1;
    if (statusCode >= 500) metrics.serverErrors += 1;
    metrics.durationsMs.push(Math.max(0, durationMs));
    if (metrics.durationsMs.length > 1000) metrics.durationsMs.shift();
    metricsByRoute.set(route, metrics);
};

export const getRequestMetrics = (): Array<{
    route: string;
    requests: number;
    serverErrors: number;
    averageMs: number;
    p95Ms: number;
}> => Array.from(metricsByRoute, ([route, metrics]) => {
    const sortedDurations = [...metrics.durationsMs].sort((left, right) => left - right);
    const p95Index = Math.max(0, Math.ceil(sortedDurations.length * 0.95) - 1);
    const averageMs = sortedDurations.length
        ? sortedDurations.reduce((total, duration) => total + duration, 0) / sortedDurations.length
        : 0;

    return {
        route,
        requests: metrics.requests,
        serverErrors: metrics.serverErrors,
        averageMs: Number(averageMs.toFixed(2)),
        p95Ms: Number((sortedDurations[p95Index] ?? 0).toFixed(2)),
    };
});

export const requestMetricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const startedAt = performance.now();
    res.on('finish', () => {
        const routePath = req.route?.path ?? req.path;
        const route = `${req.method} ${req.baseUrl}${routePath}`;
        recordRequestMetric(route, res.statusCode, performance.now() - startedAt);
    });
    next();
};