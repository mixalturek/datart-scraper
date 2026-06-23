import { randomUUID } from 'node:crypto';

import { CheerioCrawler, RequestQueue } from '@crawlee/cheerio';
import type { ProxyConfiguration } from 'apify';
import { log } from 'apify';

import { extractProduct, type ProductData } from './extract.js';

type PendingEntry = {
    resolve: (data: ProductData) => void;
    reject: (err: Error) => void;
};

const pendingRequests = new Map<string, PendingEntry>();
let standbyCrawler: CheerioCrawler | undefined;

export async function initStandbyCrawler(proxyConfiguration?: ProxyConfiguration): Promise<void> {
    const requestQueue = await RequestQueue.open();

    standbyCrawler = new CheerioCrawler({
        proxyConfiguration,
        requestQueue,
        minConcurrency: 1,
        maxConcurrency: 7,
        autoscaledPoolOptions: {
            isFinishedFunction: async () => false,
        },
        requestHandler: async ({ request, $ }) => {
            const { correlationId } = request.userData as { correlationId: string };
            const pending = pendingRequests.get(correlationId);
            if (!pending) return;
            pendingRequests.delete(correlationId);
            try {
                pending.resolve(extractProduct(request.loadedUrl ?? request.url, $));
            } catch (e) {
                pending.reject(e as Error);
            }
        },
        failedRequestHandler: async ({ request }, err) => {
            const { correlationId } = request.userData as { correlationId: string };
            const pending = pendingRequests.get(correlationId);
            if (!pending) return;
            pendingRequests.delete(correlationId);
            pending.reject(err instanceof Error ? err : new Error(String(err)));
        },
    });

    standbyCrawler.run().catch((err: Error) => {
        log.exception(err, 'Standby crawler exited unexpectedly');
    });
}

export async function teardownStandbyCrawler(): Promise<void> {
    await standbyCrawler?.autoscaledPool?.abort();
    const shutdownError = new Error('Crawler is shutting down');
    for (const pending of pendingRequests.values()) {
        pending.reject(shutdownError);
    }
    pendingRequests.clear();
}

export async function scrapeProductUrl(url: string): Promise<ProductData> {
    if (!standbyCrawler) {
        throw new Error('Standby crawler not initialized');
    }

    const correlationId = randomUUID();

    return new Promise((resolve, reject) => {
        pendingRequests.set(correlationId, { resolve, reject });
        standbyCrawler!.addRequests([{ url, uniqueKey: correlationId, userData: { correlationId } }]).catch(reject);
    });
}
