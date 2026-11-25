// ==========================================================
// 「世界の国どこかな？」専用トロフィー36種類(#159〜194)のUI・連携確認テスト。
// 3D地球儀への実タップ操作をPlaywrightで厳密に再現するのは現実的ではない
// ため(ランダムな出題国へのピクセル単位のタップ検証は不安定)、判定ロジック
// 自体の正しさはtests/trophy_findcountry_logic.test.js(Node vm)で検証する。
// このテストでは、実際のブラウザ(index.html)上で: ①トロフィー一覧の表示
// (カテゴリー・レア度・非隠し表示) ②findcountry.jsからtrophy.jsへの実際の
// 接続(window経由でTrophyModule.evaluateFindCountryResult等を直接呼べること)
// ③MapModuleのズーム検出APIが実際のDOMイベントで機能すること
// ④既存のfindcountry画面(難易度選択・コレクション・ランキング)が壊れていないこと
// を確認する。
// 実行方法: node tests/playwright_findcountry_trophies.test.js
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
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });

  await page.goto(base, { waitUntil: "load" });

  // ---- 1. トロフィー一覧: findcountryカテゴリー・レア度・非隠し表示 ----
  await page.click("#btn-trophy-list");
  await page.waitForSelector("#trophy-grid .trophy-card");
  // UI刷新: カテゴリー別進捗カードは既定で8枚までの折りたたみ表示になる
  // ため、findcountryのように折りたたみ範囲外のカテゴリーをクリックする
  // 前に「すべて表示」を開いておく
  const categoryToggle = await page.$("#trophy-category-toggle");
  if (categoryToggle) await categoryToggle.click();

  const fcTab = await page.$('#trophy-category-grid [data-category="findcountry"]');
  check('「世界の国どこかな？」カテゴリータブが存在する', !!fcTab);
  if (fcTab) {
    await fcTab.click();
    await page.waitForTimeout(150);
    const fcCount = await page.$$eval("#trophy-grid .trophy-card", (els) => els.filter((e) => !e.classList.contains("hidden")).length);
    check("findcountryカテゴリーが36件表示される", fcCount === 36);

    const names = await page.$$eval("#trophy-grid .trophy-card:not(.hidden) .trophy-name", (els) => els.map((e) => e.textContent.trim()));
    check("findcountry36件が全て実名で表示される(未獲得でも「？？？？？？」にならない)", names.length === 36 && names.every((n) => n !== "？？？？？？"));
    check('「新世界の神」が表示されている', names.includes("新世界の神"));

    const conds = await page.$$eval("#trophy-grid .trophy-card:not(.hidden) .trophy-cond", (els) => els.map((e) => e.textContent.trim()));
    check("findcountry36件全てに条件文が表示される(未獲得でも空にならない)", conds.length === 36 && conds.every((c) => c.length > 0));

    const rarityBadges = await page.$$eval("#trophy-grid .trophy-card:not(.hidden) .trophy-rarity-badge", (els) => els.map((e) => e.textContent.trim()));
    check("36件全てにレア度バッジが表示される", rarityBadges.length === 36);
    check("レア度の内訳が普通14/レア12/スーパーレア10",
      rarityBadges.filter((r) => r === "普通").length === 14
      && rarityBadges.filter((r) => r === "レア").length === 12
      && rarityBadges.filter((r) => r === "スーパーレア").length === 10);
  }

  // 既存カテゴリー(他カテゴリー)にはレア度バッジが出ないことの確認(既存表示を変えていない)
  const specialTab = await page.$('#trophy-category-grid [data-category="special"]');
  if (specialTab) {
    await specialTab.click();
    await page.waitForTimeout(150);
    const specialRarityBadges = await page.$$eval("#trophy-grid .trophy-card:not(.hidden) .trophy-rarity-badge", (els) => els.length);
    check("既存カテゴリー(特別チャレンジ)にはレア度バッジが出ない", specialRarityBadges === 0);
  }
  await page.click('#trophy-category-grid [data-category="all"]');
  await page.click(".trophy-list-header .btn-back");
  await page.waitForSelector("#screen-top.active");

  // ---- 2. findcountry.js -> trophy.js の実接続確認(合成contextで直接呼ぶ) ----
  const liveCheck = await page.evaluate(() => {
    const out = {};
    out.hasEvaluateResult = typeof TrophyModule.evaluateFindCountryResult === "function";
    out.hasEvaluateAnswer = typeof TrophyModule.evaluateFindCountryAnswer === "function";
    // No.172: PROモードで初めて1問正解
    const r1 = TrophyModule.evaluateFindCountryAnswer({ difficultyId: "pro", result: "correct" });
    out.awardsNo172 = r1.awardedIds.includes("trophy_172");
    // No.194: PRO216完全クリア
    const r2 = TrophyModule.evaluateFindCountryResult({ difficultyId: "pro", isProComplete: true, results: [] });
    out.awardsNo194 = r2.awardedIds.includes("trophy_194");
    out.isNo172Earned = TrophyModule.isEarned("trophy_172");
    out.isNo194Earned = TrophyModule.isEarned("trophy_194");
    return out;
  });
  check("TrophyModule.evaluateFindCountryResult/Answerが実際に呼べる", liveCheck.hasEvaluateResult && liveCheck.hasEvaluateAnswer);
  check("実ブラウザ上でNo.172(秘境への扉)が合成contextで獲得できる", liveCheck.awardsNo172 && liveCheck.isNo172Earned);
  check("実ブラウザ上でNo.194(新世界の神)が合成contextで獲得できる", liveCheck.awardsNo194 && liveCheck.isNo194Earned);

  // データリセットでNo.172/194の獲得状態も消えることを確認(新規キーがresetAllに含まれているか)
  await page.evaluate(() => Storage.resetAll());
  const afterReset = await page.evaluate(() => ({
    no172: TrophyModule.isEarned("trophy_172"),
    no194: TrophyModule.isEarned("trophy_194"),
  }));
  check("Storage.resetAll()後、No.172/194の獲得状態もリセットされる", !afterReset.no172 && !afterReset.no194);

  // ---- 3. MapModuleのズーム検出APIが実際のDOMイベントで機能する ----
  await page.click("#btn-mode-map");
  await page.waitForSelector("#map-globe-container canvas", { timeout: 15000 });
  await page.waitForTimeout(500);
  const zoomResult = await page.evaluate(() => {
    const out = {};
    MapModule.resetZoomTracking();
    out.beforeWheel = MapModule.wasZoomUsed();
    const container = document.getElementById("map-globe-container");
    container.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, bubbles: true }));
    out.afterWheel = MapModule.wasZoomUsed();
    MapModule.resetZoomTracking();
    out.afterReset = MapModule.wasZoomUsed();
    return out;
  });
  check("resetZoomTracking直後はwasZoomUsed=false", zoomResult.beforeWheel === false);
  check("wheelイベント後はwasZoomUsed=trueになる(ズーム検出)", zoomResult.afterWheel === true);
  check("再度resetZoomTrackingするとfalseに戻る", zoomResult.afterReset === false);
  await page.click("#btn-map-back").catch(() => {});

  // ---- 4. 既存findcountry画面の回帰確認(難易度選択・コレクション・ランキング) ----
  await page.goto(base, { waitUntil: "load" });
  await page.click("#btn-mode-findcountry");
  await page.waitForSelector("#screen-findcountry-difficulty.active");
  check("findcountry難易度選択画面が開く(回帰)", true);
  const difficultyCardCount = await page.$$eval(".difficulty-card", (els) => els.length);
  check("難易度カードが4件表示される(初級/中級/上級/PRO、回帰)", difficultyCardCount === 4);
  // DIFFICULTIES配列の先頭(初級)が常に1件目のカードになる
  await page.$eval(".difficulty-card", (el) => el.click());
  await page.waitForSelector("#screen-findcountry-count.active").catch(() => {});
  check("問題数選択画面へ遷移する(回帰)", (await page.$("#screen-findcountry-count.active")) !== null);

  check("このテスト全体でコンソール/ページエラーが発生していない", consoleErrors.length === 0 || (() => { console.log(consoleErrors); return false; })());

  console.log(`\nTotal: ${pass + fail}, Pass: ${pass}, Fail: ${fail}`);
  await browser.close();
  server.close();
  process.exit(fail > 0 ? 1 : 0);
})();
