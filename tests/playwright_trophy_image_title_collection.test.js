// ==========================================================
// トロフィー画像第7弾(称号コレクション12種類)の差分確認テスト。
// 新規12種類(No.101〜112、trophy_<番号>キー、_flag/_capital接尾辞なし)
// の追加のみを対象に、必要最小限の項目を確認する。登録整合性・既存73-12=61
// 種類の無変更・452件集計・未獲得非表示・フォールバック・各画面表示の
// 枠組みは既存テスト(playwright_trophy_image_batch2/3/4、
// playwright_trophy_image_display)で既に広く確認されているため、
// ここでは重複させない。
// No.101〜112は「参照型」(js/quiz.jsのTITLES/CAPITAL_TITLESをそのまま
// 参照)のため、awardIfNew()では獲得記録できない。既存
// tests/trophy_common_logic.test.jsと同じ方式(Storage.awardTitleIfNew())
// で獲得状態を模擬する。
// 実行方法: node tests/playwright_trophy_image_title_collection.test.js
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

// [number, referenceTitleId, mode]
const NEW_TITLES = [
  [101, "beginner", "flag"],
  [102, "challenger", "flag"],
  [103, "traveler", "flag"],
  [104, "expert", "flag"],
  [105, "master", "flag"],
  [106, "legend", "flag"],
  [107, "cap_beginner", "capital"],
  [108, "cap_challenger", "capital"],
  [109, "cap_traveler", "capital"],
  [110, "cap_expert", "capital"],
  [111, "cap_master", "capital"],
  [112, "cap_legend", "capital"],
];
const NEW_NUMBERS = NEW_TITLES.map((t) => t[0]);
// 既存サンプルは素の番号キー(trophy_<番号>)の国旗トリビアから選ぶ。
// 分割カード(No.1〜19・21・26・27・30〜39)はawardIfNew()にmode引数が
// 必要で別のDOM構造(data-split-mode)になるため、ここでは対象にしない
// (回帰確認は既存のplaywright_trophy_dual_split_cards.test.jsで別途実施済み)
const UNCHANGED_SAMPLE = [71, 72, 73, 80, 85, 89, 95, 100];

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

    // ---- 登録整合性: 称号コレクション12種類が素の番号キーで重複なく
    // 登録されていることを確認する ----
    const registry = await page.evaluate(() => {
      const keys = Object.keys(TROPHY_IMAGE_ASSETS).filter((k) => /^trophy_(10[1-9]|11[0-2])$/.test(k));
      const nums = keys.map((k) => parseInt(k.replace("trophy_", ""), 10)).sort((a, b) => a - b);
      return { count: keys.length, nums, dupFree: new Set(nums).size === nums.length };
    });
    check("称号コレクション用の素の番号キーが12件", registry.count === 12);
    check("重複なし", registry.dupFree === true);
    check("No.101〜112と完全一致", JSON.stringify(registry.nums) === JSON.stringify(NEW_NUMBERS));

    // ---- 452件集計が維持されている ----
    const total = await page.evaluate(() => TrophyModule.getProgressSummary().totalCount);
    check("総数452件のまま", total === 452);

    await page.click("#btn-trophy-list");
    await page.waitForSelector("#trophy-grid .trophy-card");

    // ---- 新規12種類: 未獲得時は非表示 ----
    for (const n of NEW_NUMBERS) {
      const info = await page.evaluate((num) => {
        const card = document.querySelector(`#trophy-grid .trophy-card[data-trophy-id="trophy_${num}"]`);
        return { locked: card ? card.classList.contains("locked") : null, hasImage: card ? !!card.querySelector(".trophy-mark-image") : null };
      }, n);
      check(`No.${n} 未獲得時: lockedかつ画像非表示`, info.locked === true && info.hasImage === false);
    }

    // ---- 参照型のため、既存称号(js/quiz.jsのTITLES/CAPITAL_TITLES)側を
    // Storage.awardTitleIfNew()で獲得済みにし、一覧を再描画する ----
    await page.evaluate((titles) => {
      titles.forEach(([, titleId, mode]) => Storage.awardTitleIfNew(titleId, mode));
      state.trophyListFilter = { topBucket: "all", category: "all", status: "all" };
      renderTrophyListScreen();
    }, NEW_TITLES);

    const totalAfter = await page.evaluate(() => TrophyModule.getProgressSummary().totalCount);
    check("獲得後も総数452件のまま", totalAfter === 452);

    for (const n of NEW_NUMBERS) {
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
    }, NEW_NUMBERS);
    NEW_NUMBERS.forEach((n) => check(`No.${n} 画像デコード成功`, naturalSizes[n] > 0));

    // ---- 既存(サンプル)には変更がない(srcの対応関係がそのまま) ----
    await page.evaluate((nums) => {
      nums.forEach((n) => TrophyModule.awardIfNew(`trophy_${n}`));
      state.trophyListFilter = { topBucket: "all", category: "all", status: "all" };
      renderTrophyListScreen();
    }, UNCHANGED_SAMPLE);
    for (const n of UNCHANGED_SAMPLE) {
      const src = await page.evaluate((num) => {
        const card = document.querySelector(`#trophy-grid .trophy-card[data-trophy-id="trophy_${num}"]`);
        const img = card ? card.querySelector(".trophy-mark-image") : null;
        return img ? img.getAttribute("src") : null;
      }, n);
      check(`No.${n}(既存): 対応関係に変更なし`, !!src && src.includes(`trophy_${n}.webp`));
    }

    // ---- 詳細モーダル: No.106・112(最高難易度の伝説級)が512pxで正しく表示される ----
    for (const n of [106, 112]) {
      await page.click(`#trophy-grid .trophy-card[data-trophy-id="trophy_${n}"]`);
      await page.waitForSelector("#trophy-detail-modal:not(.hidden)");
      const detailSrc = await page.evaluate(() => {
        const img = document.querySelector("#trophy-detail-body .trophy-mark-image");
        return img ? img.getAttribute("src") : null;
      });
      check(`詳細モーダル(No.${n}): 512px画像を表示`, !!detailSrc && detailSrc.includes(`assets/trophies/512/trophy_${n}.webp`));
      await page.click("#trophy-detail-close");
      await page.waitForTimeout(100);
    }

    // ---- 複数同時獲得演出: 称号コレクション12種類すべて ----
    await page.evaluate((nums) => {
      renderTrophyAwardScreen({ newTrophyIds: nums.map((n) => `trophy_${n}`), mode: "flag_only", total: null, correct: null });
      showScreen("screen-trophy-award");
    }, NEW_NUMBERS);
    await page.waitForSelector("#screen-trophy-award.active");
    const multiSrcs = await page.evaluate(() => Array.from(document.querySelectorAll("#trophy-award-list .trophy-mark-image")).map((img) => img.getAttribute("src")));
    check("複数同時獲得演出: 12件すべてに画像", multiSrcs.length === 12);
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
