import { randomUUID } from 'node:crypto';

import { CheerioCrawler, RequestQueue } from '@crawlee/cheerio';
import type { ProxyConfiguration } from 'apify';

import { extractProduct, type ProductData } from './extract.js';

export async function scrapeProductUrl(url: string, proxyConfiguration?: ProxyConfiguration): Promise<ProductData> {
    let result: ProductData | undefined;
    let errorResult: Error | undefined;

    // Each invocation gets a fresh queue so the same URL is never treated as
    // already-handled by Crawlee's deduplication logic (which persists across runs).
    const requestQueue = await RequestQueue.open(randomUUID());
    await requestQueue.addRequest({ url });

    const crawler = new CheerioCrawler({
        proxyConfiguration,
        maxRequestsPerCrawl: 1,
        requestQueue,
        requestHandler: async ({ request, $ }) => {
            try {
                result = extractProduct(request.loadedUrl ?? request.url, $);
            } catch (e) {
                errorResult = e as Error;
            }
        },
    });

    await crawler.run();
    await requestQueue.drop();

    if (errorResult !== undefined) {
        throw errorResult;
    }

    if (!result) {
        throw new Error(`Failed to scrape product: ${url}`);
    }

    return result;
}
