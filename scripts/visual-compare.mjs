import { readFileSync, writeFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const REMOTE_ORIGIN = process.env.REMOTE_ORIGIN || "https://khotaikhoan.net";
const LOCAL_ORIGIN = process.env.LOCAL_ORIGIN || "http://localhost:3000";
const OUT_DIR = path.join(process.cwd(), ".artifacts", "visual");
const ROUTES = (
  process.env.ROUTES ||
  "/,/ung-dung-phan-mem-khac/cong-cu-ai,/tai-khoan-chatgpt-plus,/canva-pro,/gioi-thieu"
)
  .split(",")
  .map((route) => route.trim())
  .filter(Boolean);

const VIEWPORTS = [
  { name: "desktop", width: 1365, height: 768 },
  { name: "mobile", width: 390, height: 844 },
];

function fileSafe(value) {
  return value
    .replace(/^\/$/, "home")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "");
}

async function preparePage(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        scroll-behavior: auto !important;
      }
      .sfs-side-floating-wrap,
      .ktk-contact-icons-wrapper,
      .wd-toolbar,
      .wd-scroll-top,
      iframe[src*="facebook"],
      iframe[src*="zalo"] {
        visibility: hidden !important;
      }
    `,
  });
}

async function screenshot(browser, origin, route, viewport, label) {
  const page = await browser.newPage({ viewport });
  await page.goto(`${origin}${route}`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await preparePage(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1500);

  const name = `${fileSafe(route)}-${viewport.name}-${label}.png`;
  const filePath = path.join(OUT_DIR, name);
  await page.screenshot({ path: filePath, fullPage: false });
  await page.close();
  return filePath;
}

function compareImages(expectedPath, actualPath, diffPath) {
  const expected = PNG.sync.read(readFileSync(expectedPath));
  const actual = PNG.sync.read(readFileSync(actualPath));
  const width = Math.min(expected.width, actual.width);
  const height = Math.min(expected.height, actual.height);
  const expectedCrop = new PNG({ width, height });
  const actualCrop = new PNG({ width, height });

  PNG.bitblt(expected, expectedCrop, 0, 0, width, height, 0, 0);
  PNG.bitblt(actual, actualCrop, 0, 0, width, height, 0, 0);

  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(
    expectedCrop.data,
    actualCrop.data,
    diff.data,
    width,
    height,
    { threshold: 0.12 },
  );

  writeFileSync(diffPath, PNG.sync.write(diff));

  const totalPixels = width * height;
  return {
    width,
    height,
    diffPixels,
    totalPixels,
    matchPercent: Number(
      (((totalPixels - diffPixels) / totalPixels) * 100).toFixed(2),
    ),
  };
}

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const report = [];

for (const route of ROUTES) {
  for (const viewport of VIEWPORTS) {
    const expectedPath = await screenshot(
      browser,
      REMOTE_ORIGIN,
      route,
      viewport,
      "remote",
    );
    const actualPath = await screenshot(
      browser,
      LOCAL_ORIGIN,
      route,
      viewport,
      "local",
    );
    const diffPath = path.join(
      OUT_DIR,
      `${fileSafe(route)}-${viewport.name}-diff.png`,
    );
    const result = compareImages(expectedPath, actualPath, diffPath);

    report.push({
      route,
      viewport: viewport.name,
      expectedPath,
      actualPath,
      diffPath,
      ...result,
    });

    console.log(
      `${route} ${viewport.name}: ${result.matchPercent}% match (${result.diffPixels}/${result.totalPixels})`,
    );
  }
}

await browser.close();

const reportPath = path.join(OUT_DIR, "report.json");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`Report: ${reportPath}`);
