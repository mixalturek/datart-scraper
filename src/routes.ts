import { createCheerioRouter } from '@crawlee/cheerio';

import { extractProduct } from './extract.js';

export type StartUrl = { url: string; userData?: Record<string, unknown> };

const DISALLOWED_PATHS = [
    '/kosik',
    '/rezervace',
    '/zakaznik',
    '/uzivatel',
    '/zakaznicka-sekce',
    '/vyhledavani',
    '/ai-asistent',
];

const DISALLOWED_PARAMS = ['tab', 'listType', 'mobile', 'desktop', 'uiShowFilter', 'orderBY', 'do'];

/**
 * Label start URLs so the router can handle them correctly:
 */
export function labelStartUrls(urls: StartUrl[]): StartUrl[] {
    return urls.map((urlDef) => {
        try {
            const parsedUrl = new URL(urlDef.url);

            if (parsedUrl.pathname !== '/') {
                return { ...urlDef, userData: { ...urlDef.userData, label: 'CATEGORY' } };
            }
        } catch {
            /* invalid URL, let default handler deal with it */
        }

        // Everything else (homepage) → default handler
        return urlDef;
    });
}

export function isProductUrl(url: URL): boolean {
    if (url.hostname !== 'www.datart.cz') {
        return false;
    }

    const { pathname, searchParams } = url;

    if (pathname === '/') {
        return false;
    }

    if (DISALLOWED_PATHS.some((p) => pathname.startsWith(p))) {
        return false;
    }

    if (!pathname.includes('-') || !/^(\/bazar)?\/[a-z0-9-]+(\.html)?$/i.test(pathname)) {
        return false;
    }

    if (DISALLOWED_PARAMS.some((p) => searchParams.has(p))) {
        return false;
    }

    return true;
}

export const router = createCheerioRouter();

// Homepage and other unrecognized pages — discover category links
router.addDefaultHandler(async ({ enqueueLinks, request, log }) => {
    log.info('Discovering categories', { url: request.loadedUrl });
    await enqueueLinks({
        globs: ['https://www.datart.cz/*.html'],
        label: 'CATEGORY',
    });
});

// Category listing pages — enqueue product detail pages and paginate
router.addHandler('CATEGORY', async ({ request, enqueueLinks, log }) => {
    log.info('Processing category page', { url: request.loadedUrl });

    await enqueueLinks({
        selector: '.product-box-list a[href]',
        transformRequestFunction: (req) => {
            try {
                if (isProductUrl(new URL(req.url))) {
                    req.userData = { ...req.userData, label: 'PRODUCT' };
                    return req;
                }

                log.info('Skipping, not a product', { url: req.url });
            } catch (e) {
                log.warning('Exception while processing category page', { e });
            }
            return false;
        },
    });

    await enqueueLinks({
        selector: 'a[href*="page="]',
        label: 'CATEGORY',
        transformRequestFunction: (req) => {
            try {
                const u = new URL(req.url);
                if (u.hostname === 'www.datart.cz' && u.pathname.endsWith('.html')) return req;
            } catch (e) {
                log.warning('Exception while processing category page', { e });
            }
            return false;
        },
    });
});

// Product detail pages — extract and store all product data
router.addHandler('PRODUCT', async ({ request, $, pushData, log }) => {
    const url = request.loadedUrl ?? request.url;
    log.info('Processing product', { url });

    const data = extractProduct(url, $, log);
    await pushData(data);

    log.info('Scraped product', { url });
});
