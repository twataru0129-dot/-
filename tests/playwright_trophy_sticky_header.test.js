// ==========================================================
// トロフィー一覧の固定ヘッダー(position: sticky)の動作確認テスト。
// 実行方法: node tests/playwright_trophy_sticky_header.test.js
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

async function runForViewport(browser, base, viewport, label) {
  const page = await browser.newPage({ viewport });
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });

  await page.goto(base, { waitUntil: "load" });
  await page.click("#btn-trophy-list");
  await page.waitForSelector("#trophy-grid .trophy-card");

  // 1. 最上部での表示
  const headerBoxTop = await page.$eval(".trophy-list-header", (el) => el.getBoundingClientRect());
  check(`[${label}] 最上部でヘッダーが表示される`, headerBoxTop.height > 0 && headerBoxTop.width > 0);

  // 2. No.80〜100付近までスクロールしても「戻る」ボタンが表示される
  // (トロフィー番号のテキストで探すのは表示順・絞り込み状態に依存して
  // 不安定なため、一定量スクロールしてNo.80〜100付近を通過させて確認する)
  await page.evaluate(() => window.scrollTo(0, 2000));
  await page.waitForTimeout(100);
  let backBtnBox = await page.$eval('.trophy-list-header .btn-back', (el) => el.getBoundingClientRect());
  check(`[${label}] 中間までスクロールしても「戻る」ボタンが画面内(y>=0)に表示される`, backBtnBox.top >= 0 && backBtnBox.bottom <= 200);

  // 3. 最下部までスクロールしても「戻る」ボタンが表示される(No.143〜158相当)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(100);
  backBtnBox = await page.$eval('.trophy-list-header .btn-back', (el) => el.getBoundingClientRect());
  check(`[${label}] 最下部までスクロールしても「戻る」ボタンが画面内に表示される`, backBtnBox.top >= 0 && backBtnBox.bottom <= 200);

  // ヘッダーがviewportの上端に固定されている(sticky)ことを確認
  const headerBoxBottom = await page.$eval(".trophy-list-header", (el) => el.getBoundingClientRect());
  check(`[${label}] 最下部スクロール時もヘッダーがviewport上端付近に固定されている`, headerBoxBottom.top >= -1 && headerBoxBottom.top <= 1);

  // 4. スクロール中でも「戻る」ボタンを押せる(実際にクリックしてトップ画面へ戻る)
  await page.click(".trophy-list-header .btn-back");
  await page.waitForSelector("#screen-top.active");
  check(`[${label}] スクロール後でも「戻る」ボタンのクリックが機能する(トップ画面へ遷移)`, true);

  // もう一度開いて残りの確認を続ける
  await page.click("#btn-trophy-list");
  await page.waitForSelector("#trophy-grid .trophy-card");

  // 5. カテゴリー別進捗カード(UI刷新で上位8分類+下位カテゴリーの2段構成に
  // なった)。折りたたみ機能は廃止され、8枚は常にすべて表示される。
  // encyclopediaのカードを絞り込みに使えることを確認する
  const bucketChipCount = await page.$$eval("#trophy-bucket-grid .trophy-category-chip", (els) => els.length);
  check(`[${label}] 上位8分類のカードが常にすべて表示される`, bucketChipCount === 8);
  const encTab = await page.$('#trophy-bucket-grid [data-bucket="encyclopedia"]');
  check(`[${label}] 「世界図鑑」カテゴリーカードが存在する`, !!encTab);
  if (encTab) {
    await encTab.click();
    await page.waitForTimeout(150);
    // 「世界図鑑」上位分類には#158(categoryは「special」)も含まれるため、
    // 既存カテゴリー(category="encyclopedia")の19件だけに絞り込む
    await page.click('#trophy-subcategory-row [data-category="encyclopedia"]');
    await page.waitForTimeout(150);
  }

  // 6. 獲得状態フィルターが正常に動作する
  await page.click('#trophy-status-filter [data-status="locked"]');
  await page.waitForTimeout(150);
  const lockedVisibleCount = await page.$$eval("#trophy-grid .trophy-card", (els) => els.filter((e) => !e.classList.contains("hidden")).length);
  check(`[${label}] 「未獲得」フィルターが機能する(世界図鑑19件が全て未獲得として表示)`, lockedVisibleCount === 19);
  await page.click('#trophy-status-filter [data-status="all"]');
  await page.click('#trophy-bucket-grid [data-bucket="all"]');
  await page.waitForTimeout(150);

  // 7. トロフィーカードが正常に表示される(「世界の国どこかな？」専用
  // トロフィー36種類の追加により153件から189件、隠しトロフィー61種類
  // (#195〜255)の一覧表示対応により189件から250件、さらに集計方式A案
  // (No.1〜19を国旗/首都の2枚の独立カードに分割)により250件から269件
  // (250+19)、追加修正(#21・26・27・30〜39の13種類も分割対象に追加)
  // により269件から282件(250+32)、謎解きトロフィー第3段階(No.01/02/04の
  // 3件)の追加により282件から285件に変わり、世界図鑑トロフィー追加分
  // (#259〜262、計4件)により289件になった後、謎解きトロフィー118問追加
  // (#263〜380、計121件に増加)で412件に変わり、世界7不思議(7問+隠し特別2種、
  // 計9件)の追加で452件になった)
  const totalCount = await page.$$eval("#trophy-grid .trophy-card", (els) => els.length);
  check(`[${label}] トロフィー452件が全てDOMに存在する`, totalCount === 452);

  // 8. 隠しトロフィーの表示仕様が維持されている(「？？？？？？」のまま)。
  // 既存14件+隠しトロフィー61種類のうちNo.220を除く60件+世界7不思議隠し特別
  // 2種(未獲得)=76件
  const hiddenNames = await page.$$eval(".trophy-card.trophy-card-secret .trophy-name", (els) => els.map((e) => e.textContent.trim()));
  check(`[${label}] 隠しトロフィー(76件)が全て「？？？？？？」のまま表示される`, hiddenNames.length === 76 && hiddenNames.every((t) => t === "？？？？？？"));

  check(`[${label}] コンソール/ページエラーが発生していない`, consoleErrors.length === 0);
  if (consoleErrors.length) consoleErrors.forEach((e) => console.log(`  [${label}] console error:`, e));

  await page.close();
}

(async () => {
  const server = await startServer();
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}/`;

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", headless: true, args: ["--headless", "--no-sandbox"] });

  try {
    // iPhone相当の画面幅(縦画面)
    await runForViewport(browser, base, { width: 390, height: 844 }, "iPhone縦");
    // iPhone相当の画面幅(横画面)
    await runForViewport(browser, base, { width: 844, height: 390 }, "iPhone横");
    // PC相当の画面幅
    await runForViewport(browser, base, { width: 1280, height: 800 }, "PC");

    // ---- No.142・No.158の専用演出に影響しないこと(トロフィー一覧画面の
    // 固定ヘッダーCSSが、別画面のscreen-trophy-legendに意図せず影響しないか) ----
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const consoleErrors = [];
    page.on("pageerror", (e) => consoleErrors.push(String(e)));
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    await page.goto(base, { waitUntil: "load" });
    await page.evaluate(() => {
      renderLegendAwardScreen(142);
      showScreen("screen-trophy-legend");
    });
    await page.waitForSelector("#screen-trophy-legend.active");
    const heading142 = await page.textContent("#trophy-legend-heading");
    check('No.142専用演出の見出しが影響を受けていない(「首都トリビア完全制覇！」)', (heading142 || "").includes("首都トリビア完全制覇"));
    await page.evaluate(() => {
      renderLegendAwardScreen(158);
      showScreen("screen-trophy-legend");
    });
    await page.waitForSelector("#screen-trophy-legend.active");
    const heading158 = await page.textContent("#trophy-legend-heading");
    check('No.158専用演出の見出しが影響を受けていない(「世界図鑑 完全制覇！」)', (heading158 || "").includes("世界図鑑 完全制覇"));
    check("No.142/No.158演出確認中にエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\nTotal: ${pass + fail}, Pass: ${pass}, Fail: ${fail}`);
  process.exitCode = fail > 0 ? 1 : 0;
})();
