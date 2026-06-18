# Datart.cz Product Scraper

**Datart.cz Product Scraper** extracts structured product data — prices, specifications, images, ratings, and availability — from [datart.cz](https://www.datart.cz/), one of the largest Czech consumer electronics retailers. Start from the homepage to crawl the entire catalog, or point it at a single category page to scope your run.

Run it directly in [Apify Console](https://console.apify.com) — no coding required. Results are stored in a dataset you can export as JSON, CSV, or Excel and connect to any downstream system via the Apify API.

## Why use Datart.cz Product Scraper?

- **Price monitoring** — track price changes across product categories over time
- **Competitor research** — collect structured product specs and pricing for analysis
- **Catalog synchronization** — keep an external database in sync with live product data
- **Market analysis** — aggregate ratings and availability across thousands of products

## How to use Datart.cz Product Scraper

1. Go to the Actor page on Apify Console and click **Try for free**.
2. In the **Start URLs** field, enter one or more URLs:
   - `https://www.datart.cz/` — crawl all categories and products
   - `https://www.datart.cz/televize.html` — crawl only TVs
   - `https://www.datart.cz/notebooky-a-it-technika.html` — crawl only laptops & IT
3. Set **Max Requests per Crawl** to limit run size (200 = roughly 150–180 products).
4. Click **Save & Run**.
5. When finished, open the **Output** tab or download the dataset.

## Input

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `startUrls` | array | URLs to start crawling from | `https://www.datart.cz/` |
| `maxRequestsPerCrawl` | integer | Max pages fetched (0 = unlimited) | `200` |
| `proxyConfiguration` | object | Proxy settings (Apify Proxy or custom) | disabled |

**Example input:**
```json
{
  "startUrls": [{ "url": "https://www.datart.cz/televize.html" }],
  "maxRequestsPerCrawl": 500
}
```

## Output

Each product is stored as one record in the default dataset. You can download the dataset in various formats such as JSON, HTML, CSV, or Excel.

**Example output item:**
```json
{
  "url": "https://www.datart.cz/televize-samsung-qe50q7f",
  "title": "Televize Samsung QE50Q7F",
  "category": "televize",
  "sku": "SAMQE50Q7FA",
  "internalId": "1915142",
  "price": 9490,
  "images": [
    "https://image.datart.cz/foto/500/0/5/7/product_7421750.jpg"
  ],
  "rating": 4.8,
  "ratingCount": 188,
  "availability": "Ihned k odeslání",
  "specifications": {
    "Technologie displeje": "QLED",
    "Úhlopříčka obrazovky": "125 cm (50\")",
    "Rozlišení": "3840 x 2160 (Ultra HD 4K)"
  },
  "breadcrumbs": [
    { "text": "TV, foto, audio, video", "url": "https://www.datart.cz/tv-audio-video" },
    { "text": "Televize", "url": "https://www.datart.cz/televize.html" }
  ],
  "scrapedAt": "2026-06-17T10:00:00.000Z"
}
```

## Data table

| Field | Type | Description |
|-------|------|-------------|
| `url` | string | Canonical product URL |
| `title` | string | Full product name |
| `sku` | string | Datart product code (`Kód:`) |
| `internalId` | string | Datart internal ID (`ID:`) |
| `price` | number | Price in CZK including VAT |
| `images` | array | Product image URLs (500px size) |
| `rating` | number | Average customer rating (0–5) |
| `ratingCount` | number | Number of customer ratings |
| `availability` | string | Stock/delivery status in Czech |
| `specifications` | object | Technical specs as key/value pairs |
| `breadcrumbs` | array | Navigation path objects `{text, url}` |
| `scrapedAt` | string | ISO 8601 timestamp of when data was collected |

## Pricing / Cost estimation

This Actor uses **CheerioCrawler** (HTTP-based, no browser) making it very fast and cost-efficient. Each page fetch consumes minimal compute units.

Approximate cost estimates on Apify platform:
- **200 requests** (~150 products): ~$0.01–0.02
- **5,000 requests** (~4,000 products): ~$0.20–0.40
- **Full catalog crawl** (tens of thousands of products): ~$2–5

New Apify accounts include a free tier that typically covers hundreds of product scraping runs per month.

## Tips

- **Scope by category**: provide a specific category URL (e.g. `/notebooky-a-it-technika.html`) to focus the run and reduce cost.
- **Large-scale runs**: enable Apify Proxy in the `proxyConfiguration` field to avoid IP-based rate limiting when crawling thousands of products.
- **Scheduled monitoring**: use Apify's scheduler to run this Actor daily/weekly for price tracking.
- **Filtering**: use `maxRequestsPerCrawl` during testing (e.g. 50) to preview results before a full run.

## FAQ, disclaimers, and support

**Is it legal to scrape datart.cz?**
This Actor collects only publicly available product information. Respect datart.cz's Terms of Service and robots.txt directives. Do not use the collected data for commercial redistribution without permission.

**Some fields are null — why?**
A few products may have non-standard page layouts. The scraper uses content-based selectors; a null value means the field wasn't found in the expected format on that page.

**Need a custom solution?**
Contact [Apify](https://apify.com/contact) for enterprise-grade custom scrapers with SLA support.

**Found a bug or have feedback?**
Open an issue in the [Issues tab](../../issues) on this Actor's page.
