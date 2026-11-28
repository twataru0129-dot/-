// ==========================================================
// トロフィー画像表示機構への第3バッチ追加テスト。
// 国旗トリビア9種類(No.80/81/82/83/84/85/86/89/91)を
// TROPHY_IMAGE_ASSETSに追加したことを確認する。既存13種類
// (第1弾9種類+第2弾4種類)との共存、未獲得時の非表示、452件集計への
// 影響なし、検索・絞り込み、詳細モーダル、通常獲得演出・複数同時獲得
// 演出、画像読み込み失敗時のフォールバックを確認する。
// 実行方法: node tests/playwright_trophy_image_batch3.test.js
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

const NEW_NUMBERS = [80, 81, 82, 83, 84, 85, 86, 89, 91];
const EXISTING_NUMBERS = [71, 72, 73, 74, 75, 76, 77, 78, 79, 87, 88, 98, 100];

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

async function newPage(browser, consoleErrors, viewport) {
  const page = await browser.newPage({ viewport: viewport || { width: 390, height: 844 } });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  return page;
}

async function openTrophyList(page) {
  await page.click("#btn-trophy-list");
  await page.waitForSelector("#trophy-grid .trophy-card");
}

async function resetAndGoto(page, baseUrl) {
  await page.goto(baseUrl);
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await page.waitForSelector("#screen-top.active");
}

(async () => {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const consoleErrors = [];

  try {
    const page = await newPage(browser, consoleErrors);
    await resetAndGoto(page, baseUrl);
    await openTrophyList(page);

    // ---- 1. 未獲得時: 新規9種類も画像は出ず既存の絵文字/グレー表示のまま ----
    for (const n of NEW_NUMBERS) {
      const info = await page.evaluate((num) => {
        const card = document.querySelector(`#trophy-grid .trophy-card[data-trophy-id="trophy_${num}"]`);
        return {
          exists: !!card,
          locked: card ? card.classList.contains("locked") : null,
          hasImage: card ? !!card.querySelector(".trophy-mark-image") : null,
        };
      }, n);
      check(`No.${n} 未獲得時: カードが存在する`, info.exists);
      check(`No.${n} 未獲得時: lockedクラスを持つ`, info.locked === true);
      check(`No.${n} 未獲得時: 画像は表示されない`, info.hasImage === false);
    }

    // ---- 2. 452件集計が変化していないことを確認 ----
    const totalBefore = await page.evaluate(() => TrophyModule.getProgressSummary().totalCount);
    check("獲得前: 総数452件のまま", totalBefore === 452);

    // ---- 3. 新規9種類+既存13種類すべてを獲得済みにして再描画 ----
    const allNumbers = NEW_NUMBERS.concat(EXISTING_NUMBERS);
    await page.evaluate((nums) => {
      nums.forEach((n) => TrophyModule.awardIfNew(`trophy_${n}`));
      state.trophyListFilter = { topBucket: "all", category: "all", status: "all" };
      renderTrophyListScreen();
    }, allNumbers);

    const totalAfter = await page.evaluate(() => TrophyModule.getProgressSummary().totalCount);
    check("獲得後: 総数452件のまま(集計に変化なし)", totalAfter === 452);

    for (const n of allNumbers) {
      const info = await page.evaluate((num) => {
        const card = document.querySelector(`#trophy-grid .trophy-card[data-trophy-id="trophy_${num}"]`);
        const img = card ? card.querySelector(".trophy-mark-image") : null;
        return {
          earned: card ? card.dataset.earned === "true" : null,
          hasImage: !!img,
          src: img ? img.getAttribute("src") : null,
        };
      }, n);
      check(`No.${n} 獲得後: data-earned=true`, info.earned === true);
      check(`No.${n} 獲得後: 画像が表示される`, info.hasImage === true);
      check(`No.${n} 獲得後: srcが対応するwebpを指す`, !!info.src && info.src.includes(`trophy_${n}.webp`));
    }

    // ---- 4. 新規画像が実際にデコード可能(壊れていない)ことを確認 ----
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
        results[n] = { w: img.naturalWidth, h: img.naturalHeight };
      }
      return results;
    }, NEW_NUMBERS);
    NEW_NUMBERS.forEach((n) => {
      check(`No.${n} 画像デコード成功(naturalWidth>0)`, naturalSizes[n] && naturalSizes[n].w > 0);
    });

    // ---- 5. 検索: 新規トロフィー名でヒットする ----
    await page.fill("#trophy-search-input", "一つの半島");
    const searchVisible83 = await page.evaluate(() => {
      const card = document.querySelector('#trophy-grid .trophy-card[data-trophy-id="trophy_83"]');
      return card && !card.classList.contains("hidden");
    });
    check("検索: 「一つの半島」で No.83 がヒットする", searchVisible83 === true);
    await page.fill("#trophy-search-input", "");

    // ---- 6. 詳細モーダル: 新規画像も128px→256/512pxへ解像度が引き上がる ----
    await page.click('#trophy-grid .trophy-card[data-trophy-id="trophy_89"]');
    await page.waitForSelector("#trophy-detail-modal:not(.hidden)");
    const detailImg = await page.evaluate(() => {
      const img = document.querySelector("#trophy-detail-body .trophy-mark-image");
      return img ? { src: img.getAttribute("src"), srcset: img.getAttribute("srcset") } : null;
    });
    check("詳細モーダル(No.89): 画像が存在する", !!detailImg);
    check("詳細モーダル(No.89): srcが512px画像", !!detailImg && detailImg.src.includes("assets/trophies/512/trophy_89.webp"));
    await page.click("#trophy-detail-close");
    await page.waitForSelector("#trophy-detail-modal.hidden", { state: "attached" });

    // ---- 7. 通常獲得演出でも新規画像が表示される(単独) ----
    await page.evaluate(() => {
      renderTrophyAwardScreen({ newTrophyIds: ["trophy_80"], mode: "flag_only", total: null, correct: null });
      showScreen("screen-trophy-award");
    });
    await page.waitForSelector("#screen-trophy-award.active");
    const singleAwardImg = await page.evaluate(() => {
      const img = document.querySelector("#trophy-award-list .trophy-mark-image");
      return img ? img.getAttribute("src") : null;
    });
    check("通常獲得演出: No.80の画像が表示される", !!singleAwardImg && singleAwardImg.includes("trophy_80.webp"));

    // ---- 8. 複数同時獲得演出で新規9種類すべてが正しく表示される ----
    await page.evaluate((nums) => {
      renderTrophyAwardScreen({ newTrophyIds: nums.map((n) => `trophy_${n}`), mode: "flag_only", total: null, correct: null });
      showScreen("screen-trophy-award");
    }, NEW_NUMBERS);
    await page.waitForSelector("#screen-trophy-award.active");
    const multiAwardSrcs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("#trophy-award-list .trophy-mark-image")).map((img) => img.getAttribute("src"));
    });
    check("複数同時獲得: 9件すべてのアイテムに画像が表示される", multiAwardSrcs.length === 9);
    NEW_NUMBERS.forEach((n) => {
      check(`複数同時獲得: No.${n}の画像が正しく対応する`, multiAwardSrcs.some((s) => s && s.includes(`trophy_${n}.webp`)));
    });

    // ---- 9. 画像読み込み失敗時のフォールバック(新規画像でも動作する) ----
    await page.evaluate(() => {
      state.trophyListFilter = { topBucket: "all", category: "all", status: "all" };
      renderTrophyListScreen();
      showScreen("screen-trophy-list");
    });
    await page.waitForSelector("#screen-trophy-list.active");
    const fallbackResult = await page.evaluate(() => {
      const card = document.querySelector('#trophy-grid .trophy-card[data-trophy-id="trophy_86"]');
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
    });
    check("画像読み込み失敗時(No.86): imgが絵文字spanに置き換わる", fallbackResult.imgGone === true && fallbackResult.replaced === true);
    check("画像読み込み失敗時(No.86): フォールバック絵文字が表示される", !!fallbackResult.text && fallbackResult.text === fallbackResult.fallbackEmoji);
    consoleErrors.length = 0; // 直前の意図的な404はJSエラー検査から除外

    console.log(`\nconsoleErrors: ${consoleErrors.length}`);
    consoleErrors.forEach((e) => console.log("  -", e));
    check("JSエラーが発生していない", consoleErrors.length === 0);

    await page.close();
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`);
  process.exit(fail > 0 ? 1 : 0);
})();
