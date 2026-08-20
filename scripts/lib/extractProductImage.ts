import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { FeedProvider } from '../../types/product';

const execFileAsync = promisify(execFile);

const CHROME_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const ACCEPT_HTML =
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8';

const MIN_USABLE_HTML_BYTES = 20_000;

const PRODUCT_CDN_PATTERN =
  /dsmcdn\.com|trendyol|hepsiburada\.net|productimages/i;

const REJECT_IMAGE_PATTERN =
  /logo|banner|icon|favicon|splash|apple-icon|sfweb|carelabel|charts|storefront|footer|\.svg(?:\?|$)/i;

export type ProductImageSource =
  | 'og'
  | 'jsonld'
  | 'next_data'
  | 'img'
  | 'fallback';

export interface ExtractedProductImage {
  imageUrl: string;
  source: ProductImageSource;
  httpStatus: number;
}

interface FetchHtmlResult {
  html: string;
  httpStatus: number;
}

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': CHROME_USER_AGENT,
  Accept: ACCEPT_HTML,
  'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'Upgrade-Insecure-Requests': '1',
};

const unescapeHtml = (value: string): string =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const normalizeImageUrl = (raw: string): string | null => {
  const trimmed = unescapeHtml(raw.trim());
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.startsWith('http://')) {
    return `https://${trimmed.slice('http://'.length)}`;
  }
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }
  return `https:${trimmed}`;
};

const isProductImageUrl = (raw: string): boolean => {
  const normalized = normalizeImageUrl(raw);
  if (!normalized) {
    return false;
  }
  if (!PRODUCT_CDN_PATTERN.test(normalized)) {
    return false;
  }
  if (REJECT_IMAGE_PATTERN.test(normalized)) {
    return false;
  }
  return true;
};

const firstProductImage = (candidates: string[]): string | null => {
  for (const candidate of candidates) {
    if (!isProductImageUrl(candidate)) {
      continue;
    }
    return normalizeImageUrl(candidate);
  }
  return null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const collectImageFieldValue = (value: unknown, acc: string[]): void => {
  if (typeof value === 'string') {
    acc.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectImageFieldValue(item, acc));
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  const nested = [value.contentUrl, value.url, value.src, value['@id']];
  nested.forEach((item) => collectImageFieldValue(item, acc));
};

const collectJsonLdImageFields = (value: unknown, acc: string[]): void => {
  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonLdImageFields(item, acc));
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  if ('image' in value) {
    collectImageFieldValue(value.image, acc);
  }
  Object.entries(value).forEach(([key, nested]) => {
    if (key === 'image') {
      return;
    }
    collectJsonLdImageFields(nested, acc);
  });
};

const collectStringUrls = (value: unknown, acc: string[]): void => {
  if (typeof value === 'string') {
    acc.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStringUrls(item, acc));
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  Object.values(value).forEach((nested) => collectStringUrls(nested, acc));
};

const parseJsonSafe = (raw: string): unknown | null => {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};

const extractOgImage = ($: CheerioAPI): string | null => {
  const propertyContent = $('meta[property="og:image"]').first().attr('content');
  const nameContent = $('meta[name="og:image"]').first().attr('content');
  return firstProductImage(
    [propertyContent, nameContent].filter((value): value is string =>
      Boolean(value),
    ),
  );
};

const extractJsonLdImage = ($: CheerioAPI): string | null => {
  const candidates: string[] = [];
  $('script[type="application/ld+json"]').each((_index, element) => {
    const parsed = parseJsonSafe($(element).text());
    if (parsed === null) {
      return;
    }
    collectJsonLdImageFields(parsed, candidates);
  });
  return firstProductImage(candidates);
};

const extractNextDataImage = ($: CheerioAPI): string | null => {
  const raw = $('#__NEXT_DATA__').text();
  if (!raw) {
    return null;
  }
  const parsed = parseJsonSafe(raw);
  if (parsed === null) {
    return null;
  }
  const strings: string[] = [];
  collectStringUrls(parsed, strings);
  const marketplaceHits = strings.filter(
    (value) => /dsmcdn|trendyol/i.test(value) && isProductImageUrl(value),
  );
  return firstProductImage(marketplaceHits);
};

const extractImgTagImage = (
  $: CheerioAPI,
  provider: FeedProvider,
): string | null => {
  const candidates: string[] = [];
  $('img').each((_index, element) => {
    const node = $(element);
    const src = node.attr('src');
    const dataSrc = node.attr('data-src');
    if (src) {
      candidates.push(src);
    }
    if (dataSrc) {
      candidates.push(dataSrc);
    }
  });

  if (provider === 'hepsiburada') {
    const hbHits = candidates.filter((value) =>
      /productimages|hepsiburada\.net/i.test(value),
    );
    return firstProductImage(hbHits);
  }

  return firstProductImage(candidates);
};

const isUsableHtml = (html: string, httpStatus: number): boolean =>
  httpStatus >= 200 &&
  httpStatus < 300 &&
  html.length >= MIN_USABLE_HTML_BYTES;

const fetchHtmlViaNode = async (productUrl: string): Promise<FetchHtmlResult> => {
  try {
    const response = await fetch(productUrl, {
      headers: BROWSER_HEADERS,
      redirect: 'follow',
    });
    const html = await response.text();
    return { html, httpStatus: response.status };
  } catch {
    return { html: '', httpStatus: 0 };
  }
};

const fetchHtmlViaCurl = async (productUrl: string): Promise<FetchHtmlResult> => {
  const curlBin = process.platform === 'win32' ? 'curl.exe' : 'curl';
  const dir = await mkdtemp(path.join(os.tmpdir(), 'kabin-product-html-'));
  const filePath = path.join(dir, 'page.html');
  try {
    const { stdout } = await execFileAsync(
      curlBin,
      [
        '-sS',
        '-L',
        '--max-time',
        '30',
        '-A',
        CHROME_USER_AGENT,
        '-H',
        'Accept-Language: tr-TR,tr;q=0.9,en;q=0.8',
        '-H',
        `Accept: ${ACCEPT_HTML}`,
        '-o',
        filePath,
        '-w',
        '%{http_code}',
        productUrl,
      ],
      { maxBuffer: 20 * 1024 * 1024 },
    );
    const html = await readFile(filePath, 'utf8');
    const httpStatus = Number.parseInt(stdout.trim(), 10);
    return {
      html,
      httpStatus: Number.isNaN(httpStatus) ? 0 : httpStatus,
    };
  } catch {
    return { html: '', httpStatus: 0 };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

const fetchProductHtml = async (productUrl: string): Promise<FetchHtmlResult> => {
  const nodeResult = await fetchHtmlViaNode(productUrl);
  if (isUsableHtml(nodeResult.html, nodeResult.httpStatus)) {
    return nodeResult;
  }
  const curlResult = await fetchHtmlViaCurl(productUrl);
  if (isUsableHtml(curlResult.html, curlResult.httpStatus)) {
    return curlResult;
  }
  return nodeResult.html.length >= curlResult.html.length
    ? nodeResult
    : curlResult;
};

export const extractProductImage = async (
  productUrl: string,
  provider: FeedProvider,
  fallbackUrl: string,
): Promise<ExtractedProductImage> => {
  const { html, httpStatus } = await fetchProductHtml(productUrl);
  const $ = cheerio.load(html);

  const ogImage = extractOgImage($);
  if (ogImage) {
    return { imageUrl: ogImage, source: 'og', httpStatus };
  }

  const jsonLdImage = extractJsonLdImage($);
  if (jsonLdImage) {
    return { imageUrl: jsonLdImage, source: 'jsonld', httpStatus };
  }

  if (provider === 'trendyol') {
    const nextDataImage = extractNextDataImage($);
    if (nextDataImage) {
      return { imageUrl: nextDataImage, source: 'next_data', httpStatus };
    }
  }

  const imgTagImage = extractImgTagImage($, provider);
  if (imgTagImage) {
    return { imageUrl: imgTagImage, source: 'img', httpStatus };
  }

  return { imageUrl: fallbackUrl, source: 'fallback', httpStatus };
};
