import { createCheerioRouter } from '@crawlee/cheerio';

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

function isProductUrl(url: URL): boolean {
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

                log.info(`Not a product, skipping: ${req.url}`);
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

    const title = $('h1').first().text().trim();
    const bodyText = $('body').text();

    // Price — "Cena s DPH: 9 490 Kč"
    const priceMatch = bodyText.match(/Cena s DPH:\s*([\d\s]+)\s*Kč/);
    const price = priceMatch ? parseInt(priceMatch[1].replace(/\s/g, ''), 10) : null;

    // Product code and internal ID — "Kód: SAMQE43Q7FA ID: 1915141"
    const skuMatch = bodyText.match(/Kód:\s*([A-Z0-9]+)/);
    const idMatch = bodyText.match(/\bID:\s*(\d+)/);
    const sku = skuMatch?.[1] ?? null;
    const internalId = idMatch?.[1] ?? null;

    // Images — use data-src on gallery items (lazy-loaded, highest quality 800px)
    const seenProductIds = new Set<string>();
    const images: string[] = [];
    $('[data-src*="image.datart.cz/foto/"]').each((_, el) => {
        const src = $(el).attr('data-src');
        if (!src || !src.includes('product_')) return;
        const idMatch2 = src.match(/product_(\d+)/);
        if (idMatch2 && !seenProductIds.has(idMatch2[1])) {
            seenProductIds.add(idMatch2[1]);
            images.push(src);
        }
    });
    // Fallback to main product image if gallery was empty
    if (images.length === 0) {
        const mainImg = $('img[data-qa="product-gallery-main-image"]').attr('src');
        if (mainImg) images.push(mainImg);
    }

    // Rating — link to "#recenze" contains "4.8 (188)"
    let rating: number | null = null;
    let ratingCount: number | null = null;
    $('a[href*="#recenze"]')
        .first()
        .each((_, el) => {
            const match = $(el)
                .text()
                .trim()
                .match(/([\d,.]+)\s*\((\d+)\)/);
            if (match) {
                rating = parseFloat(match[1].replace(',', '.'));
                ratingCount = parseInt(match[2], 10);
            }
        });

    // Availability status
    const availMatch = bodyText.match(
        /(Ihned k odeslání|Skladem v \d+ prodejnách|Není skladem|U dodavatele|K vyzvednutí v prodejně)/,
    );
    const availability = availMatch?.[1] ?? null;

    // Specifications — table with th[scope="row"] for name, td for value
    const specifications: Record<string, string> = {};
    $('.product-property-table th[scope="row"]').each((_, th) => {
        // Key: text content of th (strip inline SVG whitespace)
        const key = $(th).text().trim().replace(/\s+/g, ' ');
        const value = $(th).closest('tr').find('td').first().text().trim();
        if (key && value) specifications[key] = value;
    });

    // Breadcrumbs
    const breadcrumbs: { text: string; url: string }[] = [];
    $('[class*="breadcrumb"] a, nav[aria-label*="breadcrumb"] a, [itemtype*="BreadcrumbList"] a').each((_, el) => {
        const text = $(el).text().trim();
        const href = $(el).attr('href');
        if (text && href) breadcrumbs.push({ text, url: new URL(href, url).toString() });
    });

    await pushData({
        url,
        title,
        sku,
        internalId,
        price,
        images,
        rating,
        ratingCount,
        availability,
        specifications,
        breadcrumbs,
        scrapedAt: new Date().toISOString(),
    });

    log.info('Scraped product', { title, url });
});
