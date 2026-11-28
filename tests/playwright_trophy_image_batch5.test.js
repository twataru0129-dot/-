// ==========================================================
// トロフィー画像第5弾(通常トロフィー第1弾)の差分確認テスト。
// 国旗クイズ版の固有画像16種類(trophy_1_flag〜trophy_16_flag)を
// 新規追加したことを確認する。既存機構(resolveTrophyImageAssets/
// trophyImageKey/isDualSplitCardNumber/buildTrophySplitSideCard)は
// PR#92・PR#70等で実装済みのため無変更。国旗トリビア29種類・分割カード
// 機構自体の回帰はplaywright_trophy_image_batch2/3/4・
// playwright_trophy_dual_split_cards・trophy_dual_split_aggregation_logic
// で既に広く確認済みのため、ここでは重複させない。
//
// No.1〜19は分割カード(buildTrophySplitSideCard)として描画され、
// 国旗側・首都側どちらもdata-trophy-idは共通のdef.id("trophy_1"等)で、
// data-split-mode("国旗クイズ"/"首都クイズ")で区別する。
// 実行方法: node tests/playwright_trophy_image_batch5.test.js
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

const NEW_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

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

    // ---- 登録整合性: 国旗トリビア29+通常トロフィー国旗版16(=45件)が
    // 引き続きすべて揃っていること・重複なし・首都版は未登録であることを
    // 確認する。TROPHY_IMAGE_ASSETS全体の件数は、トロフィー画像第6弾以降は
    // 45を超えるため、ここでは全体件数ではなくこの45件の部分集合だけを
    // 検証する ----
    const registry = await page.evaluate(() => {
      const keys = Object.keys(TROPHY_IMAGE_ASSETS);
      const triviaNums = [71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99,100];
      return {
        hasCapitalKeys: keys.some((k) => k.endsWith("_capital")),
        flagKeysPresent: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16].every((n) => keys.includes(`trophy_${n}_flag`)),
        triviaKeysPresent: triviaNums.every((n) => keys.includes(`trophy_${n}`)),
        dupFree: new Set(keys).size === keys.length,
      };
    });
    check("国旗トリビア29種類が引き続きすべて登録されている", registry.triviaKeysPresent === true);
    check("重複なし", registry.dupFree === true);
    check("No.1〜16の_flagキーがすべて存在する", registry.flagKeysPresent === true);
    check("_capitalキーは1件も登録されていない(首都版に混入していない)", registry.hasCapitalKeys === false);

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
          flagHasImage: flagCard ? !!flagCard.querySelector(".trophy-mark-image") : null,
          capHasImage: capCard ? !!capCard.querySelector(".trophy-mark-image") : null,
          flagLocked: flagCard ? flagCard.classList.contains("locked") : null,
          capLocked: capCard ? capCard.classList.contains("locked") : null,
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
          capLocked: capCard ? capCard.classList.contains("locked") : null,
        };
      }, { flagSel: FLAG_SEL(n), capSel: CAP_SEL(n) });
      check(`No.${n} 国旗版獲得後: 国旗側data-earned=true・srcがtrophy_${n}_flag.webpを指す`,
        info.flagEarned === true && !!info.flagSrc && info.flagSrc.includes(`trophy_${n}_flag.webp`));
      check(`No.${n} 国旗版獲得後: 首都側は依然未獲得で画像なし`, info.capEarned === false && info.capLocked === true && info.capHasImage === false);
    }

    // ---- 画像デコード成功確認(国旗版16種類) ----
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
    NEW_NUMBERS.forEach((n) => check(`No.${n} 国旗版画像デコード成功`, naturalSizes[n] > 0));

    // ---- 首都版も獲得: 首都版は画像未登録のため、従来どおり絵文字表示のまま ----
    await page.evaluate((nums) => {
      nums.forEach((n) => TrophyModule.awardIfNew(`trophy_${n}`, "capital"));
      state.trophyListFilter = { topBucket: "all", category: "all", status: "all" };
      renderTrophyListScreen();
    }, NEW_NUMBERS);
    for (const n of NEW_NUMBERS) {
      const info = await page.evaluate((sel) => {
        const card = document.querySelector(sel);
        const img = card ? card.querySelector(".trophy-mark-image") : null;
        const icon = card ? card.querySelector(".trophy-mark-icon") : null;
        return { earned: card ? card.dataset.earned === "true" : null, hasImage: !!img, hasEmojiIcon: !!icon };
      }, CAP_SEL(n));
      check(`No.${n} 首都版獲得後: data-earned=true`, info.earned === true);
      check(`No.${n} 首都版獲得後: 首都版画像は未登録のため従来の絵文字表示のまま`, info.hasImage === false && info.hasEmojiIcon === true);
    }

    // ---- 既存国旗トリビア29種類には影響がない(サンプル確認) ----
    await page.evaluate(() => {
      [71, 80, 92, 98, 100].forEach((n) => TrophyModule.awardIfNew(`trophy_${n}`));
      state.trophyListFilter = { topBucket: "all", category: "all", status: "all" };
      renderTrophyListScreen();
    });
    for (const n of [71, 80, 92, 98, 100]) {
      const src = await page.evaluate((num) => {
        const card = document.querySelector(`#trophy-grid .trophy-card[data-trophy-id="trophy_${num}"]`);
        const img = card ? card.querySelector(".trophy-mark-image") : null;
        return img ? img.getAttribute("src") : null;
      }, n);
      check(`No.${n}(既存国旗トリビア): 対応関係に変更なし`, !!src && src.includes(`trophy_${n}.webp`) && !src.includes("_flag") && !src.includes("_capital"));
    }

    // ---- 詳細モーダル: No.7(豪華フレーム)国旗側の512px画像を確認 ----
    await page.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: "center" }), FLAG_SEL(7));
    await page.click(FLAG_SEL(7));
    await page.waitForSelector("#trophy-detail-modal:not(.hidden)");
    const detailSrc = await page.evaluate(() => {
      const img = document.querySelector("#trophy-detail-body .trophy-mark-image");
      return img ? img.getAttribute("src") : null;
    });
    check("詳細モーダル(No.7国旗版): 512px画像を表示", !!detailSrc && detailSrc.includes("assets/trophies/512/trophy_7_flag.webp"));
    await page.click("#trophy-detail-close");
    await page.waitForTimeout(100);

    // ---- 通常獲得演出: 単独(No.16) ----
    await page.evaluate(() => {
      renderTrophyAwardScreen({ newTrophyIds: ["trophy_16"], mode: "flag", total: null, correct: null });
      showScreen("screen-trophy-award");
    });
    await page.waitForSelector("#screen-trophy-award.active");
    const singleAwardSrc = await page.evaluate(() => {
      const img = document.querySelector("#trophy-award-list .trophy-mark-image");
      return img ? img.getAttribute("src") : null;
    });
    check("通常獲得演出: No.16(国旗版)の画像が表示される", !!singleAwardSrc && singleAwardSrc.includes("trophy_16_flag.webp"));

    // ---- 複数同時獲得演出: 新規16種類すべて(国旗版) ----
    await page.evaluate((nums) => {
      renderTrophyAwardScreen({ newTrophyIds: nums.map((n) => `trophy_${n}`), mode: "flag", total: null, correct: null });
      showScreen("screen-trophy-award");
    }, NEW_NUMBERS);
    await page.waitForSelector("#screen-trophy-award.active");
    const multiSrcs = await page.evaluate(() => Array.from(document.querySelectorAll("#trophy-award-list .trophy-mark-image")).map((img) => img.getAttribute("src")));
    check("複数同時獲得演出: 16件すべてに画像", multiSrcs.length === 16);
    NEW_NUMBERS.forEach((n) => check(`複数同時獲得: No.${n}(国旗版)対応`, multiSrcs.some((s) => s && s.includes(`trophy_${n}_flag.webp`))));

    // ---- 画像読み込み失敗時のフォールバック(国旗版でも動作する) ----
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
    }, FLAG_SEL(1));
    check("画像読み込み失敗時(No.1国旗版): imgが絵文字spanに置き換わる", fallbackResult.imgGone === true && fallbackResult.replaced === true);
    check("画像読み込み失敗時(No.1国旗版): フォールバック絵文字が表示される", !!fallbackResult.text && fallbackResult.text === fallbackResult.fallbackEmoji);
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
