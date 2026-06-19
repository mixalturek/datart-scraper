import type { CheerioCrawlingContext } from '@crawlee/cheerio';

type CheerioAPI = CheerioCrawlingContext['$'];

export interface ProductData {
    url: string;
    title: string;
    sku: string | null;
    internalId: string | null;
    price: number | null;
    images: string[];
    rating: number | null;
    ratingCount: number | null;
    availability: string | null;
    specifications: Record<string, string>;
    breadcrumbs: { text: string; url: string }[];
    scrapedAt: string;
}

export function extractProduct(url: string, $: CheerioAPI): ProductData {
    const title = $('h1').first().text().trim();
    const bodyText = $('body').text();

    const priceMatch = bodyText.match(/Cena s DPH:\s*([\d\s]+)\s*Kč/);
    const price = priceMatch ? parseInt(priceMatch[1].replace(/\s/g, ''), 10) : null;

    const skuMatch = bodyText.match(/Kód:\s*([A-Z0-9]+)/);
    const idMatch = bodyText.match(/\bID:\s*(\d+)/);
    const sku = skuMatch?.[1] ?? null;
    const internalId = idMatch?.[1] ?? null;

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
    if (images.length === 0) {
        const mainImg = $('img[data-qa="product-gallery-main-image"]').attr('src');
        if (mainImg) images.push(mainImg);
    }

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

    const availMatch = bodyText.match(
        /(Ihned k odeslání|Skladem v \d+ prodejnách|Není skladem|U dodavatele|K vyzvednutí v prodejně|Očekáváme do)/,
    );
    const availability = availMatch?.[1] ?? null;

    const specifications: Record<string, string> = {};
    $('.product-property-table th[scope="row"]').each((_, th) => {
        const key = $(th).text().trim().replace(/\s+/g, ' ');
        const value = $(th).closest('tr').find('td').first().text().trim();
        if (key && value) specifications[key] = value;
    });

    const breadcrumbs: { text: string; url: string }[] = [];
    $('[class*="breadcrumb"] a, nav[aria-label*="breadcrumb"] a, [itemtype*="BreadcrumbList"] a').each((_, el) => {
        const text = $(el).text().trim();
        const href = $(el).attr('href');
        if (text && href) breadcrumbs.push({ text, url: new URL(href, url).toString() });
    });

    return {
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
    };
}
