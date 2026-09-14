/* Product scraper for Gülay's Wardrobe.
   Given a product URL from a store, pulls the name, brand, price and image(s)
   using the structured data that shops publish (JSON-LD Product + Open Graph +
   Twitter card + microdata). This is a per-product fetch, on demand — not a crawler. */

const cheerio = require('cheerio');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

async function fetchWithTimeout(url, opts = {}, ms = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function asArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function pickImages(node) {
  return asArray(node.image)
    .map((i) => (typeof i === 'string' ? i : i && (i.url || i.contentUrl)))
    .filter(Boolean);
}

async function scrapeProduct(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('That does not look like a valid link.');
  }
  if (!/^https?:$/.test(parsed.protocol)) throw new Error('Only http(s) links are supported.');

  const res = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(
      res.status === 403 || res.status === 429
        ? 'The store blocked the request (anti-bot). Try saving the photo manually.'
        : `Could not open the page (error ${res.status}).`
    );
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const data = { name: '', brand: '', price: '', currency: '', image: '', images: [], sourceUrl: url };

  // 1) JSON-LD Product (the most reliable source)
  $('script[type="application/ld+json"]').each((_, el) => {
    let json;
    try {
      json = JSON.parse($(el).contents().text());
    } catch {
      return;
    }
    const nodes = [];
    for (const entry of asArray(json)) {
      if (entry && entry['@graph']) nodes.push(...asArray(entry['@graph']));
      else nodes.push(entry);
    }
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      const types = asArray(node['@type']).map((t) => String(t).toLowerCase());
      if (!types.includes('product')) continue;
      if (node.name && !data.name) data.name = String(node.name).trim();
      if (node.brand && !data.brand) {
        data.brand = typeof node.brand === 'string' ? node.brand : node.brand.name || '';
      }
      data.images.push(...pickImages(node));
      for (const off of asArray(node.offers)) {
        const o = off && off['@type'] === 'AggregateOffer' ? { ...off, price: off.lowPrice || off.price } : off;
        if (o && o.price && !data.price) {
          data.price = String(o.price);
          data.currency = o.priceCurrency || data.currency;
        }
      }
    }
  });

  // 2) Open Graph / Twitter / product meta fallbacks
  const meta = (sel) => ($(sel).attr('content') || '').trim();
  if (!data.name) data.name = meta('meta[property="og:title"]') || $('title').first().text().trim();
  if (!data.brand) data.brand = meta('meta[property="og:site_name"]') || meta('meta[name="author"]') || parsed.hostname.replace(/^www\./, '');
  if (!data.images.length) {
    const og = meta('meta[property="og:image:secure_url"]') || meta('meta[property="og:image"]') || meta('meta[name="twitter:image"]');
    if (og) data.images.push(og);
  }
  if (!data.price) {
    data.price = meta('meta[property="product:price:amount"]') || meta('meta[property="og:price:amount"]') || meta('meta[itemprop="price"]');
    data.currency = data.currency || meta('meta[property="product:price:currency"]') || meta('meta[property="og:price:currency"]');
  }

  // 3) last-ditch image: largest <img> in the page head area
  if (!data.images.length) {
    const first = $('img[src]').first().attr('src');
    if (first) data.images.push(first);
  }

  // Normalize: absolute URLs, deduped, cleaned
  const toAbs = (u) => {
    try {
      return new URL(u, url).href;
    } catch {
      return null;
    }
  };
  data.images = [...new Set(data.images.map(toAbs).filter(Boolean))];
  data.image = data.images[0] || '';
  data.name = (data.name || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  data.brand = (data.brand || '').replace(/\s+/g, ' ').trim().slice(0, 60);

  if (!data.image) throw new Error('Could not find a product image on that page.');
  return data;
}

async function downloadImage(imageUrl, destDir, path, fs, crypto) {
  const res = await fetchWithTimeout(imageUrl, { headers: { 'User-Agent': UA, Accept: 'image/*,*/*;q=0.8' } });
  if (!res.ok) throw new Error('Could not download the product image.');
  const type = (res.headers.get('content-type') || '').toLowerCase();
  const ext = type.includes('png') ? '.png'
    : type.includes('webp') ? '.webp'
    : type.includes('avif') ? '.avif'
    : type.includes('gif') ? '.gif'
    : '.jpg';
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 20 * 1024 * 1024) throw new Error('That image is too large.');
  const filename = crypto.randomUUID() + ext;
  fs.writeFileSync(path.join(destDir, filename), buf);
  return '/uploads/' + filename;
}

module.exports = { scrapeProduct, downloadImage };
