// ==========================================================
// 世界図鑑トロフィー(第5段階、No.143〜158)のUI統合スモークテスト。
// 静的ファイルをローカルHTTPサーバーで配信し、Playwright(Chromium)で
// 実際の画面操作を再現して確認する。
// 実行方法: node tests/playwright_encyclopedia_smoke.test.js
// ==========================================================
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split("?")[0]);
      if (p === "/") p = "/index.html";
      const full = path.join(ROOT, p);
      fs.readFile(full, (err, data) => {
        if (err) { res.writeHead(404); res.end("not found"); return; }
        res.writeHead(200, { "Content-Type": MIME[path.extname(full)] || "application/octet-stream" });
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass += 1; console.log("PASS:", name); }
  else { fail += 1; console.log("FAIL:", name); }
}

(async () => {
  const server = await startServer();
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}/`;

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", headless: true, args: ["--headless", "--no-sandbox"] });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });

  // トロフィー獲得通知(screen-trophy-award)が表示されていれば「続ける」を
  // 押して消す。今回の操作で新規に何か獲得したかどうかはテストの本題では
  // ないケースでも、初回の図鑑閲覧(#143)・初回の地図連携(#154)は必ず
  // 新規獲得になるため、本題の確認に進む前にこのヘルパーで通知を片付ける
  async function dismissAwardIfShown() {
    const active = await page.$eval(".screen.active", (el) => el.id);
    if (active === "screen-trophy-award") {
      await page.click("#btn-trophy-award-continue");
      await page.waitForTimeout(100);
      const next = await page.$eval(".screen.active", (el) => el.id);
      if (next === "screen-trophy-legend") {
        await page.click("#btn-trophy-legend-continue");
      }
      await page.waitForTimeout(100);
    }
  }

  try {
    await page.goto(base, { waitUntil: "load" });

    // ---- 世界図鑑を開く ----
    await page.click("#btn-mode-encyclopedia");
    await page.waitForSelector("#ency-grid .ency-card");

    // 初期状態: 進捗表示が 0 / 198
    const initialProgress = await page.textContent("#ency-progress-text");
    check("initial progress text shows 0 / 198", /0\s*\/\s*198/.test(initialProgress || ""));

    const firstCardId = await page.getAttribute("#ency-grid .ency-card", "data-id");
    check("first card has a data-id", !!firstCardId);

    // ---- 1件目の詳細を開く(閲覧記録が発生するはず)。
    // この最初の1件は必ず#143「はじめての探検」の新規獲得にもなるため、
    // 通知(screen-trophy-award)が割り込むことを想定して先に片付ける ----
    await page.click("#ency-grid .ency-card");
    await page.waitForSelector("#screen-trophy-award.active, #screen-encyclopedia-detail.active", { timeout: 15000 });
    const afterFirstOpen = await page.$eval(".screen.active", (el) => el.id);
    check("#143 award notification appears on the very first ever visit", afterFirstOpen === "screen-trophy-award");
    await dismissAwardIfShown();
    await page.waitForSelector("#screen-encyclopedia-detail.active", { timeout: 10000 });
    await page.click("#btn-ency-detail-back");
    await page.waitForSelector("#screen-encyclopedia-list.active");

    const progressAfterOne = await page.textContent("#ency-progress-text");
    check("progress text updates to 1 / 198 after opening one detail", /1\s*\/\s*198/.test(progressAfterOne || ""));

    const firstCardVisited = await page.$(`#ency-grid .ency-card[data-id="${firstCardId}"] .ency-card-visited`);
    check("visited checkmark appears on the opened card", !!firstCardVisited);

    // 再度同じ国を開いても、重複記録されないこと(進捗は1のまま)
    await page.click(`#ency-grid .ency-card[data-id="${firstCardId}"]`);
    await page.waitForSelector("#screen-encyclopedia-detail.active");
    await page.click("#btn-ency-detail-back");
    await page.waitForSelector("#screen-encyclopedia-list.active");
    const progressAfterRevisit = await page.textContent("#ency-progress-text");
    check("revisiting the same country does not double-count", /1\s*\/\s*198/.test(progressAfterRevisit || ""));

    // ---- 地図連携: 詳細→地図→詳細の往復。
    // この最初の地図連携は必ず#154「未知への好奇心」の新規獲得にもなるため、
    // 通知(screen-trophy-award)が割り込むことを想定して先に片付ける ----
    await page.click(`#ency-grid .ency-card[data-id="${firstCardId}"]`);
    await page.waitForSelector("#screen-encyclopedia-detail.active");
    await page.click("#ency-detail-map-btn");
    await page.waitForSelector("#screen-map.active, #screen-trophy-award.active", { timeout: 20000 });
    // #154は地図上での選択確定(非同期の地球儀初期化後)を待って発火するため、
    // 通知が出るまで少し待ってから一度だけ確認・片付ける
    await page.waitForTimeout(500);
    const duringMapLink = await page.$eval(".screen.active", (el) => el.id);
    check("#154 award notification appears on the first-ever map-link usage", duringMapLink === "screen-trophy-award");
    await dismissAwardIfShown();
    await page.waitForSelector("#screen-map.active", { timeout: 20000 });
    const mapBackLabel = await page.textContent("#btn-map-back");
    check('map back button says "図鑑に戻る" after coming from encyclopedia', (mapBackLabel || "").includes("図鑑"));
    await page.click("#btn-map-back");
    await page.waitForSelector("#screen-encyclopedia-detail.active", { timeout: 20000 });
    const detailNameAfterMapRoundTrip = await page.textContent("#ency-detail-name");
    check("round trip via map returns to the SAME detail screen", !!detailNameAfterMapRoundTrip && detailNameAfterMapRoundTrip.trim().length > 0);
    await page.click("#btn-ency-detail-back");
    await page.waitForSelector("#screen-encyclopedia-list.active");

    // ---- トロフィー一覧: #158「世界の叡智」が未獲得状態で正しく隠されているか ----
    await page.click("#btn-ency-back");
    await page.waitForSelector("#screen-top.active");
    await page.click("#btn-trophy-list");
    await page.waitForSelector("#trophy-grid .trophy-card");

    const specialTab = await page.$('#trophy-category-tabs [data-category="special"]');
    check('trophy list has a "特別チャレンジ" (special) category tab', !!specialTab);
    if (specialTab) {
      await specialTab.click();
      await page.waitForTimeout(150);
    }
    const hiddenNames = await page.$$eval(".trophy-card.trophy-card-secret .trophy-name", (els) => els.map((e) => e.textContent));
    check(
      'unearned hidden trophies show the name as exactly "？？？？？？"',
      hiddenNames.length > 0 && hiddenNames.every((t) => (t || "").trim() === "？？？？？？")
    );
    const encTab = await page.$('#trophy-category-tabs [data-category="encyclopedia"]');
    check('trophy list has a "世界図鑑" category tab', !!encTab);
    if (encTab) {
      await encTab.click();
      await page.waitForTimeout(150);
      const encCount = await page.$$eval("#trophy-grid .trophy-card", (els) => els.filter((e) => !e.classList.contains("hidden")).length);
      check('"世界図鑑" category shows 15 trophies (#143-157)', encCount === 15);
    }

    // ---- リセット確認ダイアログの文言 ----
    await page.goBack().catch(() => {});
    await page.goto(base, { waitUntil: "load" });
    await page.click("#btn-reset-data");
    await page.waitForSelector("#reset-confirm-modal:not(.hidden)", { timeout: 5000 }).catch(() => {});
    const resetSubtext = await page.textContent("#reset-confirm-subtext").catch(() => "");
    check('reset confirmation dialog mentions "世界図鑑の探索記録"', (resetSubtext || "").includes("世界図鑑の探索記録"));

    // ---- 復習記録(No.156・157)の区別: 復習画面経由だけが復習として
    // 記録され、通常の一覧から同じ国を開いても復習扱いにならないこと ----
    await page.goto(base, { waitUntil: "load" });
    await page.evaluate(() => { ReviewModule.open(["jp", "us", "fr"], "flag"); });
    await page.waitForSelector("#screen-review-list.active");
    await page.click('#screen-review-list .ency-card[data-id="jp"]');
    await page.waitForSelector("#screen-trophy-award.active, #screen-encyclopedia-detail.active", { timeout: 15000 });
    await dismissAwardIfShown();
    await page.waitForSelector("#screen-encyclopedia-detail.active");
    const backLabelFromReview = await page.textContent("#btn-ency-detail-back");
    check('opening a country from the review list shows "復習リストに戻る"', (backLabelFromReview || "").includes("復習リスト"));
    const reviewedAfterReviewOpen = await page.evaluate(() => Storage.getEncyclopediaReviewedCount());
    check("opening via the review list records exactly 1 reviewed country", reviewedAfterReviewOpen === 1);

    await page.click("#btn-ency-detail-back");
    await page.waitForSelector("#screen-review-list.active");
    await page.evaluate(() => showScreen("screen-top"));
    await page.click("#btn-mode-encyclopedia");
    await page.waitForSelector("#ency-grid .ency-card");
    await page.click('#ency-grid .ency-card[data-id="us"]');
    await page.waitForSelector("#screen-trophy-award.active, #screen-encyclopedia-detail.active", { timeout: 15000 });
    await dismissAwardIfShown();
    const reviewedAfterNormalOpen = await page.evaluate(() => Storage.getEncyclopediaReviewedCount());
    check(
      "opening the SAME wrong-answered country from the normal list does NOT count as a review",
      reviewedAfterNormalOpen === 1
    );

    check("no uncaught console/page errors during the whole flow", consoleErrors.length === 0);
    if (consoleErrors.length) consoleErrors.forEach((e) => console.log("  console error:", e));
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\nTotal: ${pass + fail}, Pass: ${pass}, Fail: ${fail}`);
  process.exitCode = fail > 0 ? 1 : 0;
})();
