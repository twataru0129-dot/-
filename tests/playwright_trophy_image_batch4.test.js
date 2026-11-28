// ==========================================================
// トロフィー画像第4弾の差分確認テスト。
// 新規7種類(No.92/93/94/95/96/97/99)の追加と、既存2種類
// (No.87/88)の画像差し替えのみを対象に、必要最小限の項目を確認する。
// 全29種類の登録整合性・重複なし・既存20種類の無変更・452件集計・
// 未獲得非表示・フォールバック・各画面表示は既存テスト
// (playwright_trophy_image_batch2/3, playwright_trophy_image_display)
// で既に広く確認されているため、ここでは重複させない。
// 実行方法: node tests/playwright_trophy_image_batch4.test.js
// ==========================================================
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const MIME = {
  ".html": "text/html", ".js": "application/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".webp": "image/webp", ".geojson": "application/json",
};

const NEW_NUMBERS = [92, 93, 94, 95, 96, 97, 99];
const REPLACED_NUMBERS = [87, 88];
const UNCHANGED_SAMPLE = [71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 89, 91, 98, 100];

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
  const baseUrl = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const consoleErrors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });

  try {
    await page.goto(baseUrl);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector("#screen-top.active");

    // ---- 登録整合性: TROPHY_IMAGE_ASSETSが期待どおり29件・重複なし ----
    const registry = await page.evaluate(() => {
      const keys = Object.keys(TROPHY_IMAGE_ASSETS);
      const nums = keys.map((k) => parseInt(k.replace("trophy_", ""), 10)).sort((a, b) => a - b);
      return { count: keys.length, nums, dupFree: new Set(nums).size === nums.length };
    });
    const expected = [71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100];
    check("TROPHY_IMAGE_ASSETSが29件", registry.count === 29);
    check("重複なし", registry.dupFree === true);
    check("国旗トリビア29種類と完全一致", JSON.stringify(registry.nums) === JSON.stringify(expected));

    // ---- 452件集計が維持されている ----
    const total = await page.evaluate(() => TrophyModule.getProgressSummary().totalCount);
    check("総数452件のまま", total === 452);

    await page.click("#btn-trophy-list");
    await page.waitForSelector("#trophy-grid .trophy-card");

    // ---- 新規7種類+差し替え2種類: 未獲得時は非表示 ----
    for (const n of NEW_NUMBERS.concat(REPLACED_NUMBERS)) {
      const info = await page.evaluate((num) => {
        const card = document.querySelector(`#trophy-grid .trophy-card[data-trophy-id="trophy_${num}"]`);
        return { locked: card ? card.classList.contains("locked") : null, hasImage: card ? !!card.querySelector(".trophy-mark-image") : null };
      }, n);
      check(`No.${n} 未獲得時: lockedかつ画像非表示`, info.locked === true && info.hasImage === false);
    }

    // ---- 全9件(新規7+差し替え2)を獲得し、画像・src・デコードを確認 ----
    const allTargets = NEW_NUMBERS.concat(REPLACED_NUMBERS);
    await page.evaluate((nums) => {
      nums.forEach((n) => TrophyModule.awardIfNew(`trophy_${n}`));
      state.trophyListFilter = { topBucket: "all", category: "all", status: "all" };
      renderTrophyListScreen();
    }, allTargets);

    const totalAfter = await page.evaluate(() => TrophyModule.getProgressSummary().totalCount);
    check("獲得後も総数452件のまま", totalAfter === 452);

    for (const n of allTargets) {
      const info = await page.evaluate((num) => {
        const card = document.querySelector(`#trophy-grid .trophy-card[data-trophy-id="trophy_${num}"]`);
        const img = card ? card.querySelector(".trophy-mark-image") : null;
        return { earned: card ? card.dataset.earned === "true" : null, src: img ? img.getAttribute("src") : null };
      }, n);
      check(`No.${n} 獲得後: srcが対応するwebpを指す`, info.earned === true && !!info.src && info.src.includes(`trophy_${n}.webp`));
    }

    const naturalSizes = await page.evaluate(async (nums) => {
      const results = {};
      for (const n of nums) {
        const card = document.querySelector(`#trophy-grid .trophy-card[data-trophy-id="trophy_${n}"]`);
        const img = card ? card.querySelector(".trophy-mark-image") : null;
        if (!img) { results[n] = null; continue; }
        card.scrollIntoView({ block: "center" });
        if (!img.complete) {
          await Promise.race([
            new Promise((r) => { img.addEventListener("load", r, { once: true }); img.addEventListener("error", r, { once: true }); }),
            new Promise((r) => setTimeout(r, 5000)),
          ]);
        }
        results[n] = img.naturalWidth;
      }
      return results;
    }, allTargets);
    allTargets.forEach((n) => check(`No.${n} 画像デコード成功`, naturalSizes[n] > 0));

    // ---- 既存20種類(サンプル)には変更がない(srcの対応関係がそのまま) ----
    for (const n of UNCHANGED_SAMPLE) {
      await page.evaluate((num) => TrophyModule.awardIfNew(`trophy_${num}`), n);
    }
    await page.evaluate(() => {
      state.trophyListFilter = { topBucket: "all", category: "all", status: "all" };
      renderTrophyListScreen();
    });
    for (const n of UNCHANGED_SAMPLE) {
      const src = await page.evaluate((num) => {
        const card = document.querySelector(`#trophy-grid .trophy-card[data-trophy-id="trophy_${num}"]`);
        const img = card ? card.querySelector(".trophy-mark-image") : null;
        return img ? img.getAttribute("src") : null;
      }, n);
      check(`No.${n}(既存20種類): 対応関係に変更なし`, !!src && src.includes(`trophy_${n}.webp`));
    }

    // ---- 詳細モーダル: 差し替え後のNo.87が512pxで正しく表示される ----
    await page.click('#trophy-grid .trophy-card[data-trophy-id="trophy_87"]');
    await page.waitForSelector("#trophy-detail-modal:not(.hidden)");
    const detailSrc = await page.evaluate(() => {
      const img = document.querySelector("#trophy-detail-body .trophy-mark-image");
      return img ? img.getAttribute("src") : null;
    });
    check("詳細モーダル(No.87差し替え後): 512px画像を表示", !!detailSrc && detailSrc.includes("assets/trophies/512/trophy_87.webp"));
    await page.click("#trophy-detail-close");
    await page.waitForTimeout(100);

    // ---- 隠しトロフィー発見演出: 新規画像でも表示される ----
    await page.evaluate(() => {
      renderTrophyAwardScreen({ newTrophyIds: ["trophy_99"], mode: "flag_only", total: null, correct: null, hiddenAwardedIds: ["trophy_99"] });
      showScreen("screen-trophy-award");
    });
    await page.waitForSelector("#screen-trophy-award.active");
    const hiddenAwardInfo = await page.evaluate(() => {
      const img = document.querySelector("#trophy-award-list .trophy-mark-image");
      const banner = document.querySelector("#screen-trophy-award .trophy-award-hidden-banner, #screen-trophy-award [class*='hidden']");
      return { src: img ? img.getAttribute("src") : null, hasBanner: !!banner };
    });
    check("隠しトロフィー発見演出: No.99の画像が表示される", !!hiddenAwardInfo.src && hiddenAwardInfo.src.includes("trophy_99.webp"));

    // ---- 複数同時獲得演出: 新規7種類すべて ----
    await page.evaluate((nums) => {
      renderTrophyAwardScreen({ newTrophyIds: nums.map((n) => `trophy_${n}`), mode: "flag_only", total: null, correct: null });
      showScreen("screen-trophy-award");
    }, NEW_NUMBERS);
    await page.waitForSelector("#screen-trophy-award.active");
    const multiSrcs = await page.evaluate(() => Array.from(document.querySelectorAll("#trophy-award-list .trophy-mark-image")).map((img) => img.getAttribute("src")));
    check("複数同時獲得演出: 新規7件すべてに画像", multiSrcs.length === 7);
    NEW_NUMBERS.forEach((n) => check(`複数同時獲得: No.${n}対応`, multiSrcs.some((s) => s && s.includes(`trophy_${n}.webp`))));

    console.log(`\nconsoleErrors: ${consoleErrors.length}`);
    consoleErrors.forEach((e) => console.log("  -", e));
    check("JSエラーが発生していない", consoleErrors.length === 0);
  } finally {
    await page.close();
    await browser.close();
    server.close();
  }

  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`);
  process.exit(fail > 0 ? 1 : 0);
})();
