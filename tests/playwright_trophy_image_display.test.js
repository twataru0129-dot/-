// ==========================================================
// トロフィー画像表示機構(TROPHY_IMAGE_ASSETS)の試験実装テスト。
// 国旗トリビア9種類(No.71/74/75/78/79/87/88/98/100、うち75/87/88は
// 隠しトロフィー)を対象に、一覧・詳細・獲得演出での画像表示、
// 未獲得/隠し時のネタバレ防止、画像読み込み失敗時のフォールバック、
// 452件集計への影響なしを確認する。
// PR #92フォロー(表示デザイン改善)で以下を追加:
// 固有画像表示時の既存アイコン装飾(金色背景・枠・光沢)の撤去、
// グリッド/詳細モーダル/獲得演出の表示サイズ拡大、複数トロフィー
// 同時獲得時の表示、国旗/首都分割カードの単一モード絞り込み時の
// フル幅化。
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

    // ---- 9.5. 固有画像表示時の金色背景・枠の撤去(修正2/3) ----
    // (No.71は直前のフォールバックテストで意図的に画像読み込みを失敗させ、
    // 既に絵文字表示に置き換わっているため、ここでは画像が壊れていない
    // No.74(獲得済み・section 8で獲得)を使って一覧画面に戻して確認する)
    await page.evaluate(() => {
      // renderTrophyAwardScreen()は演出表示用の呼び出しのみで実際の獲得
      // 記録(TrophyModule.awardIfNew)は行わないため、一覧側の確認用に
      // ここで明示的に獲得済みにする
      TrophyModule.awardIfNew("trophy_74");
      TrophyModule.awardIfNew("trophy_19", "capital");
      state.trophyListFilter = { topBucket: "all", category: "all", status: "all" };
      renderTrophyListScreen();
      showScreen("screen-trophy-list");
    });
    await page.waitForSelector("#screen-trophy-list.active");

    // 画像ありの獲得済みマーク(No.74)は、既存の金色円形背景・枠・光沢が
    // 完全に外れ、画像自身の透明背景・フレームがそのまま見える状態になる
    const imageChrome = await page.evaluate(() => {
      const card = document.querySelector('#trophy-grid .trophy-card[data-trophy-id="trophy_74"]');
      const mark = card.querySelector(".trophy-mark.earned");
      const cs = getComputedStyle(mark);
      return { bg: cs.backgroundImage, border: cs.borderStyle, boxShadow: cs.boxShadow };
    });
    check("No.74(画像あり)獲得済みマーク: 金色背景が除去されている", imageChrome.bg === "none");
    check("No.74(画像あり)獲得済みマーク: 既存の枠線が除去されている", imageChrome.border === "none");
    check("No.74(画像あり)獲得済みマーク: 既存の光沢box-shadowが除去されている", imageChrome.boxShadow === "none");

    // 画像が無い(絵文字のみ)の獲得済みマークは、既存の金色チップ表示が
    // そのまま残ることを確認する(国旗/首都分割カードNo.19の首都側を獲得。
    // 分割対象32種類すべての国旗側はトロフィー画像第5/6弾で固有画像登録
    // 済みのため、ここでは引き続き未登録の首都側を例に使う)
    const noImageChrome = await page.evaluate(() => {
      const card = document.querySelector('#trophy-grid .trophy-card-split[data-trophy-id="trophy_19"][data-split-mode="首都クイズ"]');
      const mark = card ? card.querySelector(".trophy-mark.earned") : null;
      if (!mark) return null;
      const cs = getComputedStyle(mark);
      return { bg: cs.backgroundImage, hasImage: !!mark.querySelector(".trophy-mark-image") };
    });
    check("No.19首都側(画像なし)獲得済みマーク: 画像は表示されない", !!noImageChrome && noImageChrome.hasImage === false);
    check("No.19首都側(画像なし)獲得済みマーク: 既存の金色背景は維持される", !!noImageChrome && noImageChrome.bg !== "none");

    // ---- 9.6. 表示サイズ拡大の確認(修正1) ----
    const sizeCheck = await page.evaluate(() => {
      const gridMark = document.querySelector('#trophy-grid .trophy-card[data-trophy-id="trophy_74"] .trophy-mark');
      const r = gridMark.getBoundingClientRect();
      return { w: r.width, h: r.height };
    });
    check("一覧グリッドの固有画像サイズが80px以上(拡大済み)", sizeCheck.w >= 80 && sizeCheck.h >= 80);

    await page.click('#trophy-grid .trophy-card[data-trophy-id="trophy_74"]');
    await page.waitForSelector("#trophy-detail-modal:not(.hidden)");
    const detailSize = await page.evaluate(() => {
      const mark = document.querySelector("#trophy-detail-body .trophy-mark");
      const r = mark.getBoundingClientRect();
      return { w: r.width, h: r.height };
    });
    check("詳細モーダルの固有画像サイズが180px以上(拡大済み)", detailSize.w >= 180 && detailSize.h >= 180);
    await page.click("#trophy-detail-close");
    await page.waitForSelector("#trophy-detail-modal.hidden", { state: "attached" });

    // ---- 9.7. 獲得演出アイコンの拡大・金色背景撤去(修正2/3) ----
    await page.evaluate(() => {
      renderTrophyAwardScreen({ newTrophyIds: ["trophy_74"], mode: "flag_only", total: null, correct: null });
      showScreen("screen-trophy-award");
    });
    await page.waitForSelector("#screen-trophy-award.active");
    const awardMarkInfo = await page.evaluate(() => {
      const mark = document.querySelector("#trophy-award-list .trophy-award-mark");
      const r = mark.getBoundingClientRect();
      const cs = getComputedStyle(mark);
      return { w: r.width, h: r.height, bg: cs.backgroundImage, boxShadow: cs.boxShadow };
    });
    check("通常獲得演出アイコンのサイズが96px以上(拡大済み)", awardMarkInfo.w >= 96 && awardMarkInfo.h >= 96);
    check("通常獲得演出アイコン(画像あり): 金色背景が除去されている", awardMarkInfo.bg === "none");
    check("通常獲得演出アイコン(画像あり): 光沢box-shadowが除去されている", awardMarkInfo.boxShadow === "none");

    // ---- 9.8. 複数トロフィー同時獲得時も正常に表示される(修正4) ----
    await page.evaluate(() => {
      renderTrophyAwardScreen({ newTrophyIds: ["trophy_74", "trophy_78", "trophy_79"], mode: "flag_only", total: null, correct: null });
      showScreen("screen-trophy-award");
    });
    await page.waitForSelector("#screen-trophy-award.active");
    const multiAward = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll("#trophy-award-list .trophy-award-item"));
      return items.map((item) => {
        const img = item.querySelector(".trophy-mark-image");
        const mark = item.querySelector(".trophy-award-mark");
        const r = mark.getBoundingClientRect();
        return { hasImage: !!img, src: img ? img.getAttribute("src") : null, w: r.width };
      });
    });
    check("複数同時獲得: 3件すべてのアイテムが表示される", multiAward.length === 3);
    check("複数同時獲得: 各アイテムに固有画像(96px以上)が表示される", multiAward.every((m) => m.hasImage && m.w >= 96));
    check(
      "複数同時獲得: No.74/78/79の画像がそれぞれ正しく対応する",
      multiAward.some((m) => m.src && m.src.includes("trophy_74")) &&
        multiAward.some((m) => m.src && m.src.includes("trophy_78")) &&
        multiAward.some((m) => m.src && m.src.includes("trophy_79"))
    );

    // ---- 9.9. 国旗/首都分割カードの単一モード表示時フル幅化(修正1) ----
    await page.evaluate(() => {
      state.trophyListFilter = { topBucket: "flag", category: "all", status: "all" };
      renderTrophyListScreen();
      showScreen("screen-trophy-list");
    });
    await page.waitForSelector("#screen-trophy-list.active");
    const singleModeWidths = await page.evaluate(() => {
      const pair = document.querySelector("#trophy-grid .trophy-dual-pair");
      const splitCard = pair ? pair.querySelector(".trophy-card-split:not(.hidden)") : null;
      const normalCard = document.querySelector("#trophy-grid .trophy-card:not(.trophy-card-split):not(.hidden)");
      return {
        hasSingleModeClass: pair ? pair.classList.contains("trophy-dual-pair-single-mode") : null,
        splitW: splitCard ? splitCard.getBoundingClientRect().width : null,
        normalW: normalCard ? normalCard.getBoundingClientRect().width : null,
      };
    });
    check("国旗モード絞り込み時: trophy-dual-pair-single-modeが付与される", singleModeWidths.hasSingleModeClass === true);
    check(
      "国旗モード絞り込み時: 分割カード幅が通常カードとほぼ一致する(差10px未満)",
      singleModeWidths.splitW !== null &&
        singleModeWidths.normalW !== null &&
        Math.abs(singleModeWidths.splitW - singleModeWidths.normalW) < 10
    );

    await page.evaluate(() => {
      state.trophyListFilter = { topBucket: "all", category: "all", status: "all" };
      renderTrophyListScreen();
    });
    const allModeClass = await page.evaluate(() => {
      const pair = document.querySelector("#trophy-grid .trophy-dual-pair");
      return pair ? pair.classList.contains("trophy-dual-pair-single-mode") : null;
    });
    check("「すべて」表示時: trophy-dual-pair-single-modeは付与されない(従来どおり)", allModeClass === false);

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
