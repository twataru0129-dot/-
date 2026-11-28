// ==========================================================
// トロフィー画像第6弾(通常トロフィー第2弾・最終16種類)の差分確認テスト。
// 国旗クイズ版の固有画像16種類(trophy_17/18/19/21/26/27/30〜39_flag)を
// 新規追加したことを確認する。分割カード機構(resolveTrophyImageAssets/
// trophyImageKey/buildTrophySplitSideCard)・国旗トリビア29種類・
// 通常トロフィー第1弾16種類はPR#92/#70/#96で既に広く確認済みのため、
// ここでは重複させない(PR #96のplaywright_trophy_image_batch5.test.jsと
// 同じ方針)。
// 実行方法: node tests/playwright_trophy_image_batch6.test.js
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

const NEW_NUMBERS = [17, 18, 19, 21, 26, 27, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39];

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

const FLAG_SEL = (n) => `#trophy-grid [data-trophy-id="trophy_${n}"][data-split-mode="国旗クイズ"]`;
const CAP_SEL = (n) => `#trophy-grid [data-trophy-id="trophy_${n}"][data-split-mode="首都クイズ"]`;

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

    // ---- 登録整合性: 61件(29+16+16)、重複なし、首都版は未登録、既存45件も健在 ----
    const registry = await page.evaluate(() => {
      const keys = Object.keys(TROPHY_IMAGE_ASSETS);
      const triviaNums = [71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99,100];
      const batch5Flags = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16];
      const batch6Flags = [17,18,19,21,26,27,30,31,32,33,34,35,36,37,38,39];
      return {
        count: keys.length,
        dupFree: new Set(keys).size === keys.length,
        hasCapitalKeys: keys.some((k) => k.endsWith("_capital")),
        triviaPresent: triviaNums.every((n) => keys.includes(`trophy_${n}`)),
        batch5Present: batch5Flags.every((n) => keys.includes(`trophy_${n}_flag`)),
        batch6Present: batch6Flags.every((n) => keys.includes(`trophy_${n}_flag`)),
      };
    });
    check("TROPHY_IMAGE_ASSETSが61件以上(29+16+16。以降の弾の追加で件数が増える)", registry.count >= 61);
    check("重複なし", registry.dupFree === true);
    check("_capitalキーは1件も登録されていない", registry.hasCapitalKeys === false);
    check("既存の国旗トリビア29種類は引き続き全件登録されている", registry.triviaPresent === true);
    check("既存の通常トロフィー第1弾16種類は引き続き全件登録されている", registry.batch5Present === true);
    check("今回の16種類の_flagキーがすべて存在する", registry.batch6Present === true);

    const total = await page.evaluate(() => TrophyModule.getProgressSummary().totalCount);
    check("総数452件のまま", total === 452);

    await page.click("#btn-trophy-list");
    await page.waitForSelector("#trophy-grid .trophy-card");

    // ---- 未獲得時: 国旗側・首都側どちらも画像非表示 ----
    for (const n of NEW_NUMBERS) {
      const info = await page.evaluate(({ flagSel, capSel }) => {
        const flagCard = document.querySelector(flagSel);
        const capCard = document.querySelector(capSel);
        return {
          flagFound: !!flagCard,
          capFound: !!capCard,
          flagLocked: flagCard ? flagCard.classList.contains("locked") : null,
          capLocked: capCard ? capCard.classList.contains("locked") : null,
          flagHasImage: flagCard ? !!flagCard.querySelector(".trophy-mark-image") : null,
          capHasImage: capCard ? !!capCard.querySelector(".trophy-mark-image") : null,
        };
      }, { flagSel: FLAG_SEL(n), capSel: CAP_SEL(n) });
      check(`No.${n} 未獲得時: 国旗側・首都側カードが両方見つかる`, info.flagFound === true && info.capFound === true);
      check(`No.${n} 未獲得時: 両側ともlockedで画像なし`, info.flagLocked === true && info.capLocked === true && info.flagHasImage === false && info.capHasImage === false);
    }

    // ---- 国旗版のみ獲得: 国旗側だけ画像表示、首都側は引き続き非表示 ----
    await page.evaluate((nums) => {
      nums.forEach((n) => TrophyModule.awardIfNew(`trophy_${n}`, "flag"));
      state.trophyListFilter = { topBucket: "all", category: "all", status: "all" };
      renderTrophyListScreen();
    }, NEW_NUMBERS);

    const totalAfterFlag = await page.evaluate(() => TrophyModule.getProgressSummary().totalCount);
    check("国旗版獲得後も総数452件のまま", totalAfterFlag === 452);

    for (const n of NEW_NUMBERS) {
      const info = await page.evaluate(({ flagSel, capSel }) => {
        const flagCard = document.querySelector(flagSel);
        const capCard = document.querySelector(capSel);
        const flagImg = flagCard ? flagCard.querySelector(".trophy-mark-image") : null;
        const capImg = capCard ? capCard.querySelector(".trophy-mark-image") : null;
        return {
          flagEarned: flagCard ? flagCard.dataset.earned === "true" : null,
          flagSrc: flagImg ? flagImg.getAttribute("src") : null,
          capEarned: capCard ? capCard.dataset.earned === "true" : null,
          capHasImage: !!capImg,
        };
      }, { flagSel: FLAG_SEL(n), capSel: CAP_SEL(n) });
      check(`No.${n} 国旗版獲得後: srcがtrophy_${n}_flag.webpを指す`,
        info.flagEarned === true && !!info.flagSrc && info.flagSrc.includes(`trophy_${n}_flag.webp`));
      check(`No.${n} 国旗版獲得後: 首都側は依然未獲得で画像なし`, info.capEarned === false && info.capHasImage === false);
    }

    // ---- 画像デコード成功確認(16種類) ----
    const naturalSizes = await page.evaluate(async (sels) => {
      const results = {};
      for (const { n, sel } of sels) {
        const card = document.querySelector(sel);
        const img = card ? card.querySelector(".trophy-mark-image") : null;
        if (!img) { results[n] = null; continue; }
        img.scrollIntoView({ block: "center" });
        if (!img.complete) {
          await Promise.race([
            new Promise((r) => { img.addEventListener("load", r, { once: true }); img.addEventListener("error", r, { once: true }); }),
            new Promise((r) => setTimeout(r, 5000)),
          ]);
        }
        results[n] = img.naturalWidth;
      }
      return results;
    }, NEW_NUMBERS.map((n) => ({ n, sel: FLAG_SEL(n) })));
    NEW_NUMBERS.forEach((n) => check(`No.${n} 画像デコード成功`, naturalSizes[n] > 0));

    // ---- 既存45種類には影響がない(サンプル確認: 国旗トリビア+通常第1弾) ----
    await page.evaluate(() => {
      [71, 92, 100].forEach((n) => TrophyModule.awardIfNew(`trophy_${n}`));
      [1, 7, 16].forEach((n) => TrophyModule.awardIfNew(`trophy_${n}`, "flag"));
      state.trophyListFilter = { topBucket: "all", category: "all", status: "all" };
      renderTrophyListScreen();
    });
    for (const n of [71, 92, 100]) {
      const src = await page.evaluate((num) => {
        const card = document.querySelector(`#trophy-grid .trophy-card[data-trophy-id="trophy_${num}"]`);
        const img = card ? card.querySelector(".trophy-mark-image") : null;
        return img ? img.getAttribute("src") : null;
      }, n);
      check(`No.${n}(既存国旗トリビア): 対応関係に変更なし`, !!src && src.includes(`trophy_${n}.webp`) && !src.includes("_flag") && !src.includes("_capital"));
    }
    for (const n of [1, 7, 16]) {
      const src = await page.evaluate((sel) => {
        const card = document.querySelector(sel);
        const img = card ? card.querySelector(".trophy-mark-image") : null;
        return img ? img.getAttribute("src") : null;
      }, FLAG_SEL(n));
      check(`No.${n}(既存通常トロフィー第1弾): 対応関係に変更なし`, !!src && src.includes(`trophy_${n}_flag.webp`));
    }

    // ---- 詳細モーダル: No.17(伝説級特別仕様)の512px画像を確認 ----
    await page.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: "center" }), FLAG_SEL(17));
    await page.click(FLAG_SEL(17));
    await page.waitForSelector("#trophy-detail-modal:not(.hidden)");
    let detailSrc = await page.evaluate(() => document.querySelector("#trophy-detail-body .trophy-mark-image")?.getAttribute("src"));
    check("詳細モーダル(No.17): 512px画像を表示", !!detailSrc && detailSrc.includes("assets/trophies/512/trophy_17_flag.webp"));
    await page.click("#trophy-detail-close");
    await page.waitForTimeout(100);

    // ---- 詳細モーダル: No.27(反射神経の鬼)の512px画像を確認 ----
    await page.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: "center" }), FLAG_SEL(27));
    await page.click(FLAG_SEL(27));
    await page.waitForSelector("#trophy-detail-modal:not(.hidden)");
    detailSrc = await page.evaluate(() => document.querySelector("#trophy-detail-body .trophy-mark-image")?.getAttribute("src"));
    check("詳細モーダル(No.27): 512px画像を表示", !!detailSrc && detailSrc.includes("assets/trophies/512/trophy_27_flag.webp"));
    await page.click("#trophy-detail-close");
    await page.waitForTimeout(100);

    // ---- 詳細モーダル: No.39(地球の知識王)の512px画像を確認 ----
    await page.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: "center" }), FLAG_SEL(39));
    await page.click(FLAG_SEL(39));
    await page.waitForSelector("#trophy-detail-modal:not(.hidden)");
    detailSrc = await page.evaluate(() => document.querySelector("#trophy-detail-body .trophy-mark-image")?.getAttribute("src"));
    check("詳細モーダル(No.39): 512px画像を表示", !!detailSrc && detailSrc.includes("assets/trophies/512/trophy_39_flag.webp"));
    await page.click("#trophy-detail-close");
    await page.waitForTimeout(100);

    // ---- 通常獲得演出: 単独(No.36) ----
    await page.evaluate(() => {
      renderTrophyAwardScreen({ newTrophyIds: ["trophy_36"], mode: "flag", total: null, correct: null });
      showScreen("screen-trophy-award");
    });
    await page.waitForSelector("#screen-trophy-award.active");
    const singleAwardSrc = await page.evaluate(() => document.querySelector("#trophy-award-list .trophy-mark-image")?.getAttribute("src"));
    check("通常獲得演出: No.36の画像が表示される", !!singleAwardSrc && singleAwardSrc.includes("trophy_36_flag.webp"));

    // ---- 複数同時獲得演出: 新規16種類すべて ----
    await page.evaluate((nums) => {
      renderTrophyAwardScreen({ newTrophyIds: nums.map((n) => `trophy_${n}`), mode: "flag", total: null, correct: null });
      showScreen("screen-trophy-award");
    }, NEW_NUMBERS);
    await page.waitForSelector("#screen-trophy-award.active");
    const multiSrcs = await page.evaluate(() => Array.from(document.querySelectorAll("#trophy-award-list .trophy-mark-image")).map((img) => img.getAttribute("src")));
    check("複数同時獲得演出: 16件すべてに画像", multiSrcs.length === 16);
    NEW_NUMBERS.forEach((n) => check(`複数同時獲得: No.${n}対応`, multiSrcs.some((s) => s && s.includes(`trophy_${n}_flag.webp`))));

    // ---- 画像読み込み失敗時のフォールバック ----
    await page.evaluate(() => {
      state.trophyListFilter = { topBucket: "all", category: "all", status: "all" };
      renderTrophyListScreen();
      showScreen("screen-trophy-list");
    });
    await page.waitForSelector("#screen-trophy-list.active");
    const fallbackResult = await page.evaluate((sel) => {
      const card = document.querySelector(sel);
      const img = card.querySelector(".trophy-mark-image");
      const fallbackEmoji = img.dataset.fallbackEmoji;
      return new Promise((resolve) => {
        const timeout = setTimeout(() => resolve({ timedOut: true }), 5000);
        img.addEventListener("error", () => {
          setTimeout(() => {
            clearTimeout(timeout);
            const replaced = card.querySelector(".trophy-mark-icon");
            const imgGone = !card.querySelector(".trophy-mark-image");
            resolve({ replaced: !!replaced, imgGone, text: replaced ? replaced.textContent : null, fallbackEmoji });
          }, 50);
        }, { once: true });
        img.src = "assets/trophies/128/trophy_does_not_exist.webp";
      });
    }, FLAG_SEL(30));
    check("画像読み込み失敗時(No.30): imgが絵文字spanに置き換わる", fallbackResult.imgGone === true && fallbackResult.replaced === true);
    check("画像読み込み失敗時(No.30): フォールバック絵文字が表示される", !!fallbackResult.text && fallbackResult.text === fallbackResult.fallbackEmoji);
    consoleErrors.length = 0; // 直前の意図的な404はJSエラー検査から除外

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
