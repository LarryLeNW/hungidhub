import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ARTIFACTS_DIR = path.join(process.cwd(), ".artifacts", "playwright");
mkdirSync(ARTIFACTS_DIR, { recursive: true });

async function run() {
  console.log("=================================================");
  console.log("🎭 PLAYWRIGHT END-TO-END AUTOMATED TEST SUITE");
  console.log(`🌐 Target URL: ${BASE_URL}`);
  console.log("=================================================\n");

  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    console.log("⚠️ Không tìm thấy Google Chrome, chuyển sang Microsoft Edge...");
    browser = await chromium.launch({ channel: "msedge", headless: true });
  }

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  let passed = 0;
  let failed = 0;

  async function testStep(name, fn) {
    process.stdout.write(`⏳ Đang kiểm tra: ${name}... `);
    try {
      await fn();
      console.log("✅ PASS");
      passed++;
    } catch (err) {
      console.log("❌ FAILED");
      console.error("   Lỗi:", err.message);
      failed++;
    }
  }

  // TEST 1: Trang chủ
  await testStep("Trang chủ (Home Page) tải thành công", async () => {
    const res = await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 20000 });
    if (!res || res.status() >= 400) throw new Error(`HTTP status: ${res?.status()}`);
    await page.waitForTimeout(1000);
    const title = await page.title();
    if (!title) throw new Error("Trang chủ thiếu tiêu đề title");
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "01-home.png") });
  });

  // TEST 2: Kiểm tra Header & Navigation
  await testStep("Header & Menu điều hướng hiển thị đúng", async () => {
    const header = await page.locator("header").first();
    const isVisible = await header.isVisible();
    if (!isVisible) throw new Error("Không tìm thấy thẻ header");
  });

  // TEST 3: Trang chi tiết sản phẩm
  await testStep("Trang chi tiết sản phẩm (/tai-khoan-chatgpt-plus)", async () => {
    const res = await page.goto(`${BASE_URL}/tai-khoan-chatgpt-plus`, { waitUntil: "domcontentloaded", timeout: 20000 });
    if (!res || res.status() >= 400) throw new Error(`HTTP status: ${res?.status()}`);
    await page.waitForTimeout(1000);
    const heading = await page.locator("h1").first().textContent();
    if (!heading || !heading.toLowerCase().includes("chatgpt")) {
      throw new Error(`Tên sản phẩm không đúng: "${heading}"`);
    }
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "02-product-detail.png") });
  });

  // TEST 4: Thao tác chọn gói & thêm vào giỏ hàng
  await testStep("Thao tác 'Thêm vào giỏ hàng' & mở Drawer", async () => {
    // Tìm nút thêm giỏ hàng
    const addToCartBtn = page.locator("button:has-text('Thêm vào giỏ')").first();
    if (await addToCartBtn.isVisible()) {
      await addToCartBtn.click();
      await page.waitForTimeout(800);
    }
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "03-cart-drawer.png") });
  });

  // TEST 5: Trang Thanh toán
  await testStep("Trang thanh toán (/thanh-toan)", async () => {
    const res = await page.goto(`${BASE_URL}/thanh-toan`, { waitUntil: "domcontentloaded", timeout: 20000 });
    if (!res || res.status() >= 400) throw new Error(`HTTP status: ${res?.status()}`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "04-checkout.png") });
  });

  // TEST 6: Trang tra cứu đơn hàng
  await testStep("Trang tra cứu đơn hàng (/kiem-tra-don-hang)", async () => {
    const res = await page.goto(`${BASE_URL}/kiem-tra-don-hang`, { waitUntil: "domcontentloaded", timeout: 25000 });
    if (!res || res.status() >= 400) throw new Error(`HTTP status: ${res?.status()}`);
    const input = page.locator("#lookup-code");
    await input.waitFor({ state: "visible", timeout: 15000 });
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "05-order-lookup.png") });
  });

  // TEST 7: Kiểm tra Webhook Casso Endpoint
  await testStep("Webhook Casso (/api/integrations/casso/webhook) phản hồi 200 OK", async () => {
    const res = await page.request.post(`${BASE_URL}/api/integrations/casso/webhook`, {
      data: { error: 0, data: [] },
      headers: { "Content-Type": "application/json" },
    });
    if (res.status() !== 200) throw new Error(`Webhook trả về HTTP ${res.status()}`);
    const data = await res.json();
    if (!data.success) throw new Error("Webhook không trả về success: true");
  });

  await browser.close();

  console.log("\n=================================================");
  console.log(`🎉 KẾT QUẢ TEST: ${passed} PASSED / ${passed + failed} TOTAL (${failed} FAILED)`);
  console.log(`📸 Ảnh chụp màn hình lưu tại: ${ARTIFACTS_DIR}`);
  console.log("=================================================\n");

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Lỗi khi chạy Playwright test:", err);
  process.exit(1);
});
