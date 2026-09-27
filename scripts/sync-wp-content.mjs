import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ORIGIN = "https://khotaikhoan.net";
const OUT_DIR = path.join(process.cwd(), "src", "data", "generated");
const OUT_FILE = path.join(OUT_DIR, "wp-content.json");

const endpoints = [
  ["products", "/wp-json/wp/v2/product?_embed=wp:featuredmedia&per_page=100"],
  ["pages", "/wp-json/wp/v2/pages?_embed=wp:featuredmedia&per_page=100"],
  ["posts", "/wp-json/wp/v2/posts?_embed=wp:featuredmedia&per_page=100"],
  ["productCategories", "/wp-json/wp/v2/product_cat?per_page=100"],
];

function decodeHtml(value = "") {
  return value
    .replaceAll("&#038;", "&")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#8220;", "“")
    .replaceAll("&#8221;", "”")
    .replaceAll("&#8211;", "–")
    .replaceAll("&#8212;", "—")
    .replaceAll("&#8217;", "’")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function stripScripts(html = "") {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");
}

function rewriteInternalLinks(html = "") {
  return html
    .replaceAll(`href="${ORIGIN}/`, 'href="/')
    .replaceAll(`href='${ORIGIN}/`, "href='/")
    .replaceAll(`href="${ORIGIN}"`, 'href="/"')
    .replaceAll(`href='${ORIGIN}'`, "href='/'");
}

function stripHtml(html = "") {
  return decodeHtml(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function slugFromLink(link) {
  const url = new URL(link);
  return url.pathname.replace(/^\/|\/$/g, "");
}

function featuredImage(item) {
  return item?._embedded?.["wp:featuredmedia"]?.[0]?.source_url ?? null;
}

function excerptFrom(item) {
  return stripHtml(item.excerpt?.rendered || item.content?.rendered || "").slice(
    0,
    220,
  );
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 KTK Next Clone Sync",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed ${response.status} ${url}`);
  }

  return {
    data: await response.json(),
    totalPages: Number(response.headers.get("x-wp-totalpages") || "1"),
  };
}

async function fetchAll(endpoint) {
  const firstUrl = `${ORIGIN}${endpoint}`;
  const first = await fetchJson(firstUrl);
  const pages = [first.data];

  for (let page = 2; page <= first.totalPages; page += 1) {
    const separator = endpoint.includes("?") ? "&" : "?";
    const next = await fetchJson(`${ORIGIN}${endpoint}${separator}page=${page}`);
    pages.push(next.data);
  }

  return pages.flat();
}

function normalizePost(item, kind) {
  const pathName = slugFromLink(item.link);

  return {
    id: item.id,
    kind,
    slug: item.slug,
    path: pathName,
    link: item.link,
    title: decodeHtml(item.title?.rendered || ""),
    excerpt: excerptFrom(item),
    contentHtml: rewriteInternalLinks(stripScripts(item.content?.rendered || "")),
    featuredImage: featuredImage(item),
    modified: item.modified_gmt || item.modified || null,
    categories: item.product_cat || item.categories || [],
  };
}

function normalizeCategory(item) {
  return {
    id: item.id,
    kind: "productCategory",
    slug: item.slug,
    path: slugFromLink(item.link),
    link: item.link,
    title: decodeHtml(item.name || ""),
    excerpt: stripHtml(item.description || "").slice(0, 220),
    contentHtml: rewriteInternalLinks(stripScripts(item.description || "")),
    parent: item.parent || 0,
    count: item.count || 0,
  };
}

const result = {};

for (const [key, endpoint] of endpoints) {
  console.log(`Fetching ${key}...`);
  const data = await fetchAll(endpoint);
  result[key] = data;
}

const normalized = {
  generatedAt: new Date().toISOString(),
  origin: ORIGIN,
  products: result.products.map((item) => normalizePost(item, "product")),
  pages: result.pages.map((item) => normalizePost(item, "page")),
  posts: result.posts.map((item) => normalizePost(item, "post")),
  productCategories: result.productCategories.map(normalizeCategory),
};

normalized.routes = [
  ...normalized.products,
  ...normalized.pages,
  ...normalized.posts,
  ...normalized.productCategories,
]
  .filter((item) => item.path)
  .sort((a, b) => a.path.localeCompare(b.path));

await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT_FILE, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");

console.log(
  `Wrote ${normalized.routes.length} routes (${normalized.products.length} products, ${normalized.productCategories.length} categories, ${normalized.pages.length} pages, ${normalized.posts.length} posts).`,
);
