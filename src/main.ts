import { setTimeout } from 'node:timers/promises';

import { CheerioCrawler } from '@crawlee/cheerio';
import { Actor } from 'apify';

import { labelStartUrls, router, type StartUrl } from './routes.js';

interface Input {
    startUrls: StartUrl[];
    maxRequestsPerCrawl: number;
    proxyConfiguration?: {
        useApifyProxy?: boolean;
        apifyProxyGroups?: string[];
        apifyProxyCountry?: string;
    };
}

await Actor.init();

Actor.on('aborting', async () => {
    await setTimeout(1000);
    await Actor.exit();
});

const {
    startUrls = [{ url: 'https://www.datart.cz/televize.html' }],
    maxRequestsPerCrawl = 200,
    proxyConfiguration: proxyConfig,
} = (await Actor.getInput<Input>()) ?? ({} as Input);

const proxyConfiguration = proxyConfig?.useApifyProxy ? await Actor.createProxyConfiguration(proxyConfig) : undefined;

const crawler = new CheerioCrawler({
    proxyConfiguration,
    maxRequestsPerCrawl,
    minConcurrency: 5,
    maxConcurrency: 20,
    requestHandler: router,
});

await crawler.run(labelStartUrls(startUrls));
await Actor.exit();
