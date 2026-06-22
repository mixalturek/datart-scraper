import { CheerioCrawler } from '@crawlee/cheerio';
import type { ProxyConfiguration } from 'apify';

import { extractProduct, type ProductData } from './extract.js';

export async function scrapeProductUrl(url: string, proxyConfiguration?: ProxyConfiguration): Promise<ProductData> {
    let result: ProductData | undefined;
    let errorResult: Error | undefined;

    const crawler = new CheerioCrawler({
        proxyConfiguration,
        maxRequestsPerCrawl: 1,
        requestHandler: async ({ request, $, log }) => {
            try {
                result = extractProduct(request.loadedUrl ?? request.url, $, log);
            } catch (e) {
                errorResult = e as Error;
            }
        },
    });

    await crawler.run([{ url }]);

    if (errorResult !== undefined) {
        throw errorResult;
    }

    if (!result) {
        throw new Error(`Failed to scrape product: ${url}`);
    }

    return result;
}
