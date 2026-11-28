// ==========================================================
// トロフィー画像表示機構(TROPHY_IMAGE_ASSETS)の試験実装テスト。
// 国旗トリビア9種類(No.71/74/75/78/79/87/88/98/100、うち75/87/88は
// 隠しトロフィー)を対象に、一覧・詳細・獲得演出での画像表示、
// 未獲得/隠し時のネタバレ防止、画像読み込み失敗時のフォールバック、
// 452件集計への影響なしを確認する。
// 実行方法: node tests/playwright_trophy_image_display.test.js
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

    // ---- 1. 未獲得時(通常トロフィー No.71): 画像は出ず、既存の絵文字/グレー表示のまま ----
    await openTrophyList(page);
    await page.evaluate(() => {
      state.trophyListFilter = { topBucket: "all", category: "all", status: "all" };
      renderTrophyListScreen();
    });
    const no71Before = await page.evaluate(() => {
      const card = document.querySelector('#trophy-grid .trophy-card[data-trophy-id="trophy_71"]');
      return {
        exists: !!card,
        locked: card ? card.classList.contains("locked") : null,
        hasImage: card ? !!card.querySelector(".trophy-mark-image") : null,
        hasEmoji: card ? !!card.querySelector(".trophy-mark-icon") : null,
      };
    });
    check("No.71 未獲得時: カードが存在する", no71Before.exists);
    check("No.71 未獲得時: lockedクラスを持つ", no71Before.locked === true);
    check("No.71 未獲得時: 画像(img)は表示されない", no71Before.hasImage === false);
    check("No.71 未獲得時: 既存の絵文字アイコンが表示される", no71Before.hasEmoji === true);

    // ---- 2. 隠しトロフィー No.87 未獲得時: 名称・条件・画像すべて非公開 ----
    const no87Before = await page.evaluate(() => {
      const card = document.querySelector('#trophy-grid .trophy-card[data-trophy-id="trophy_87"]');
      return {
        exists: !!card,
        secret: card ? card.classList.contains("trophy-card-secret") : null,
        hasImage: card ? !!card.querySelector(".trophy-mark-image") : null,
        nameText: card ? card.querySelector(".trophy-name").textContent : null,
        hasCond: card ? !!card.querySelector(".trophy-cond") : null,
      };
    });
    check("No.87(隠し) 未獲得時: trophy-card-secretを持つ", no87Before.secret === true);
    check("No.87(隠し) 未獲得時: 画像は表示されない", no87Before.hasImage === false);
    check("No.87(隠し) 未獲得時: 名称は伏せられる(？？？？？？)", no87Before.nameText === "？？？？？？");
    check("No.87(隠し) 未獲得時: 獲得条件要素自体が存在しない", no87Before.hasCond === false);

    // ---- 3. 452件集計が変化していないことを確認 ----
    const totalBefore = await page.evaluate(() => TrophyModule.getProgressSummary().totalCount);
    check("獲得前: 総数452件のまま", totalBefore === 452);

    // ---- 4. No.71・No.87・No.88・No.75を獲得済みにして再描画 ----
    await page.evaluate(() => {
      TrophyModule.awardIfNew("trophy_71");
      TrophyModule.awardIfNew("trophy_87");
      TrophyModule.awardIfNew("trophy_88");
      TrophyModule.awardIfNew("trophy_75");
      renderTrophyListScreen();
    });

    const totalAfter = await page.evaluate(() => TrophyModule.getProgressSummary().totalCount);
    check("獲得後: 総数452件のまま(集計に変化なし)", totalAfter === 452);

    for (const n of [71, 87, 88, 75]) {
      const info = await page.evaluate((num) => {
        const card = document.querySelector(`#trophy-grid .trophy-card[data-trophy-id="trophy_${num}"]`);
        const img = card ? card.querySelector(".trophy-mark-image") : null;
        return {
          exists: !!card,
          earned: card ? card.dataset.earned === "true" : null,
          hasImage: !!img,
          src: img ? img.getAttribute("src") : null,
          loading: img ? img.getAttribute("loading") : null,
          src256: img ? img.dataset.src256 : null,
          src512: img ? img.dataset.src512 : null,
          nameRevealed: card ? card.querySelector(".trophy-name").textContent !== "？？？？？？" : null,
        };
      }, n);
      check(`No.${n} 獲得後: data-earned=true`, info.earned === true);
      check(`No.${n} 獲得後: 画像(img.trophy-mark-image)が表示される`, info.hasImage === true);
      check(`No.${n} 獲得後: srcが128px画像を指す`, !!info.src && info.src.includes(`assets/trophies/128/trophy_${n}.webp`));
      check(`No.${n} 獲得後: loading=lazy(一覧の遅延読み込み)`, info.loading === "lazy");
      check(`No.${n} 獲得後: data-src-256/512を保持`, !!info.src256 && !!info.src512);
      check(`No.${n} 獲得後: 名称が公開される`, info.nameRevealed === true);
    }

    // ---- 5. 画像が実際にブラウザでデコード可能(壊れていない)ことを確認 ----
    // 一覧画像はloading="lazy"(遅延読み込み)のため、ビューポート付近に
    // スクロールしてから読み込みを待つ(無限待機を避けるため5秒でタイムアウト)
    const naturalSizes = await page.evaluate(async () => {
      const results = {};
      for (const n of [71, 87, 88, 75, 74, 78, 79, 98, 100]) {
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
    });
    // 75/87/88は獲得済みなので画像あり、71も獲得済み。他は未獲得なので画像なし(null)。
    [71, 75, 87, 88].forEach((n) => {
      check(`No.${n} 画像デコード成功(naturalWidth>0)`, naturalSizes[n] && naturalSizes[n].w > 0);
    });
    [74, 78, 79, 98, 100].forEach((n) => {
      check(`No.${n} 未獲得のため画像なし`, naturalSizes[n] === null);
    });

    // ---- 6. 詳細モーダル: 128px→256/512pxへ解像度が引き上がること ----
    await page.click('#trophy-grid .trophy-card[data-trophy-id="trophy_71"]');
    await page.waitForSelector("#trophy-detail-modal:not(.hidden)");
    const detailImg = await page.evaluate(() => {
      const img = document.querySelector("#trophy-detail-body .trophy-mark-image");
      return img ? { src: img.getAttribute("src"), srcset: img.getAttribute("srcset"), sizes: img.getAttribute("sizes"), loading: img.getAttribute("loading") } : null;
    });
    check("詳細モーダル: 画像が存在する", !!detailImg);
    check("詳細モーダル: srcが512px画像", !!detailImg && detailImg.src.includes("assets/trophies/512/trophy_71.webp"));
    check("詳細モーダル: srcsetに256pxと512pxを両方含む", !!detailImg && detailImg.srcset.includes("256") && detailImg.srcset.includes("512"));
    check("詳細モーダル: loading=eager(即時表示)", !!detailImg && detailImg.loading === "eager");
    await page.click("#trophy-detail-close");
    await page.waitForSelector("#trophy-detail-modal.hidden", { state: "attached" });

    // ---- 7. 画像読み込み失敗時のフォールバック(絵文字へ自動置換) ----
    const fallbackResult = await page.evaluate(() => {
      const card = document.querySelector('#trophy-grid .trophy-card[data-trophy-id="trophy_71"]');
      const img = card.querySelector(".trophy-mark-image");
      const fallbackEmoji = img.dataset.fallbackEmoji;
      // 実際の読み込み失敗を模すため、存在しないURLに差し替えてerrorイベントを待つ
      // (万一イベントが発火しなくても5秒でタイムアウトし、無限待機しない)
      return new Promise((resolve) => {
        const timeout = setTimeout(() => resolve({ timedOut: true }), 5000);
        img.addEventListener("error", () => {
          // captureフェーズの全体リスナーがDOM置換するのを1tick待つ
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
    check("画像読み込み失敗時: imgが絵文字spanに置き換わる", fallbackResult.imgGone === true && fallbackResult.replaced === true);
    check("画像読み込み失敗時: フォールバック絵文字が表示される", !!fallbackResult.text && fallbackResult.text === fallbackResult.fallbackEmoji);
    // 直前のステップで意図的に存在しないURLを読み込ませた404は想定内のため、
    // 以降のJSエラー検査からは除外する
    consoleErrors.length = 0;

    // ---- 8. 通常の獲得演出画面(screen-trophy-award)で画像が表示される ----
    await page.evaluate(() => {
      renderTrophyAwardScreen({ newTrophyIds: ["trophy_74"], mode: "flag_only", total: null, correct: null });
      showScreen("screen-trophy-award");
    });
    await page.waitForSelector("#screen-trophy-award.active");
    const awardImg = await page.evaluate(() => {
      const img = document.querySelector("#trophy-award-list .trophy-mark-image");
      return img ? { src: img.getAttribute("src"), srcset: img.getAttribute("srcset") } : null;
    });
    check("通常獲得演出: No.74の画像が表示される", !!awardImg && awardImg.src.includes("trophy_74.webp"));
    check("通常獲得演出: srcsetで512px基本・256px併記", !!awardImg && awardImg.srcset.includes("512") && awardImg.srcset.includes("256"));

    // ---- 9. 隠しトロフィーの「発見」演出(secretアニメーション経路)でも画像が表示される ----
    await page.evaluate(() => {
      renderTrophyAwardScreen({ newTrophyIds: ["trophy_88"], mode: "flag_only", total: null, correct: null });
      showScreen("screen-trophy-award");
    });
    const secretAwardImg = await page.evaluate(() => {
      const item = document.querySelector("#trophy-award-list .trophy-award-item-secret");
      const img = item ? item.querySelector(".trophy-mark-image") : null;
      return { hasSecretItem: !!item, hasImage: !!img, src: img ? img.getAttribute("src") : null };
    });
    check("隠しトロフィー発見演出: secretアイテムとして表示される", secretAwardImg.hasSecretItem === true);
    check("隠しトロフィー発見演出: 画像も表示される", secretAwardImg.hasImage === true && !!secretAwardImg.src && secretAwardImg.src.includes("trophy_88.webp"));

    // ---- 10. 既存の回帰: カテゴリー切り替え・検索・フィルターが動作する ----
    await page.evaluate(() => {
      state.trophyListFilter = { topBucket: "all", category: "all", status: "all" };
      renderTrophyListScreen();
      showScreen("screen-trophy-list");
    });
    await page.waitForSelector("#screen-trophy-list.active");
    await page.fill("#trophy-search-input", "太陽と月");
    const searchVisible = await page.evaluate(() => {
      const card = document.querySelector('#trophy-grid .trophy-card[data-trophy-id="trophy_71"]');
      return card && !card.classList.contains("hidden");
    });
    check("検索: 「太陽と月」で No.71 がヒットする", searchVisible === true);
    await page.fill("#trophy-search-input", "");

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
