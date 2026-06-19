import { CheerioCrawler } from '@crawlee/cheerio';
import type { ProxyConfiguration } from 'apify';

import { extractProduct, type ProductData } from './extract.js';

export async function scrapeProductUrl(url: string, proxyConfiguration?: ProxyConfiguration): Promise<ProductData> {
    let result: ProductData | undefined;

    const crawler = new CheerioCrawler({
        proxyConfiguration,
        maxRequestsPerCrawl: 1,
        requestHandler: async ({ request, $ }) => {
            result = extractProduct(request.loadedUrl ?? request.url, $);
        },
    });

    await crawler.run([{ url }]);

    if (!result) {
        throw new Error(`Failed to scrape product: ${url}`);
    }

    return result;
}
