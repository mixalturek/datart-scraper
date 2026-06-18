import { CheerioCrawler, purgeDefaultStorages } from '@crawlee/cheerio';
import { beforeAll, describe, expect, it } from 'vitest';

import { labelStartUrls, router } from '../src/routes.js';

describe('CheerioCrawler', () => {
    beforeAll(async () => {
        await purgeDefaultStorages();
    });

    it('should crawl a page and extract data to dataset', async () => {
        const crawler = new CheerioCrawler({
            maxRequestsPerCrawl: 10,
            requestHandler: router,
        });

        await crawler.run(labelStartUrls([{ url: 'https://www.datart.cz/zamky-na-kolo.html' }]));

        expect(crawler.stats.state.requestsFinished).toBeGreaterThanOrEqual(1);

        const { items } = await crawler.getData();
        expect(items.length).toBeGreaterThan(0);
        expect(items[0].url).toContain('datart.cz');
    }, 30_000);
});
