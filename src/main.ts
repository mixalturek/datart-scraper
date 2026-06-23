import http from 'node:http';
import { setTimeout } from 'node:timers/promises';

import { CheerioCrawler } from '@crawlee/cheerio';
import { Actor, log } from 'apify';

import { isProductUrl, labelStartUrls, router, type StartUrl } from './routes.js';
import { initStandbyCrawler, scrapeProductUrl, teardownStandbyCrawler } from './scrape.js';

interface Input {
    startUrls?: StartUrl[];
    maxRequestsPerCrawl?: number;
    proxyConfiguration?: {
        useApifyProxy?: boolean;
        apifyProxyGroups?: string[];
        apifyProxyCountry?: string;
    };
}

await Actor.init();

Actor.on('aborting', async () => {
    await teardownStandbyCrawler();
    await setTimeout(1000);
    await Actor.exit();
});

const {
    startUrls,
    maxRequestsPerCrawl = 200,
    proxyConfiguration: proxyConfig,
} = (await Actor.getInput<Input>()) ?? ({} as Input);

const proxyConfiguration = proxyConfig?.useApifyProxy ? await Actor.createProxyConfiguration(proxyConfig) : undefined;
const enableStandby = Actor.config.get('metaOrigin') === 'STANDBY';

if (enableStandby) {
    await initStandbyCrawler(proxyConfiguration);

    const port = Number(process.env.ACTOR_WEB_SERVER_PORT) || 4321;

    const server = http.createServer(async (req, res) => {
        if (req.headers['x-apify-container-server-readiness-probe']) {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Readiness probe OK\n');
            return;
        }

        const reqUrl = new URL(req.url ?? '/', `http://localhost:${port}`);

        if (req.method === 'GET' && reqUrl.pathname === '/') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Actor is ready\n');
            return;
        }

        if (req.method === 'GET' && reqUrl.pathname === '/scrape-product') {
            const url = reqUrl.searchParams.get('url');
            if (!url) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing query parameter: url' }));
                return;
            }

            let parsedUrl: URL;
            try {
                parsedUrl = new URL(url);
            } catch {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid URL' }));
                return;
            }

            if (!isProductUrl(parsedUrl)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'URL is not a valid Datart product URL' }));
                return;
            }

            try {
                log.info('Standby scraping product', { url });
                const data = await scrapeProductUrl(url);

                const { eventChargeLimitReached } = await Actor.charge({ eventName: 'scraped-product' });
                if (eventChargeLimitReached) {
                    log.info('Charge limit reached', { url });
                    res.writeHead(402, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Charge limit reached' }));
                    await teardownStandbyCrawler();
                    await Actor.exit();
                    return;
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(data));
                log.info('Standby scraped product', { url });
            } catch (err) {
                log.exception(err as Error, 'Standby scrape failed', { url });
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Scraping failed', details: String(err) }));
            }
            return;
        }

        res.writeHead(404);
        res.end();
    });

    server.listen(port, () => {
        log.info('Standby server listening', { port });
    });
}

const urlsToScrape = startUrls ?? (enableStandby ? [] : [{ url: 'https://www.datart.cz/zamky-na-kolo.html' }]);

if (urlsToScrape.length > 0) {
    const crawler = new CheerioCrawler({
        proxyConfiguration,
        maxRequestsPerCrawl,
        minConcurrency: 5,
        maxConcurrency: 20,
        requestHandler: router,
    });

    await crawler.run(labelStartUrls(urlsToScrape));
}

if (!enableStandby) {
    await Actor.exit();
}
