import { setTimeout } from 'node:timers/promises';

import { CheerioCrawler } from '@crawlee/cheerio';
import { Actor } from 'apify';

import { router } from './routes.js';

interface Input {
    startUrls: { url: string; userData?: Record<string, unknown> }[];
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
    startUrls = [{ url: 'https://www.datart.cz/' }],
    maxRequestsPerCrawl = 200,
    proxyConfiguration: proxyConfig,
} = (await Actor.getInput<Input>()) ?? ({} as Input);

const proxyConfiguration = proxyConfig?.useApifyProxy
    ? await Actor.createProxyConfiguration(proxyConfig)
    : undefined;

const crawler = new CheerioCrawler({
    proxyConfiguration,
    maxRequestsPerCrawl,
    minConcurrency: 5,
    maxConcurrency: 20,
    requestHandler: router,
});

// Label start URLs so the router can handle them correctly:
// - category pages (.html) → CATEGORY handler
// - product pages (no .html, has dashes) → PRODUCT handler
// - everything else (homepage) → default handler
const labeledStartUrls = startUrls.map((urlDef) => {
    try {
        const parsedUrl = new URL(urlDef.url);
        const path = parsedUrl.pathname;
        if (path.endsWith('.html')) {
            return { ...urlDef, userData: { ...urlDef.userData, label: 'CATEGORY' } };
        }
        if (path !== '/' && path.includes('-') && /^\/[a-z0-9-]+$/i.test(path)) {
            return { ...urlDef, userData: { ...urlDef.userData, label: 'PRODUCT' } };
        }
    } catch { /* invalid URL, let default handler deal with it */ }
    return urlDef;
});

await crawler.run(labeledStartUrls);
await Actor.exit();
