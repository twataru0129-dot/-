// ==========================================================
// 共通トロフィーテストラボ(dev/common-trophy-lab.html、本番配信物には
// 含めない開発専用ページ)の動作確認テスト。playwright_seven_wonders_lab.test.js
// と全く同じサーバー起動方式(http.createServer、Node単体で実行可能)。
//
// 確認項目:
//   1. 保存データの隔離: 本番(index.html)は今回も__WFQ_LAB_STORAGE_PREFIX__
//      を一切設定せず、保存キーは従来どおり"wfq_v1_"のまま。
//   2. ラボの操作パネルから、累計獲得数の一括設定・モード横断型トロフィー・
//      累積がんばり系(プレイ回数/正解/誤答/連続日数)・四天王・世界の真理
//      専用演出プレビューが、すべて実際の判定ロジック(本物のTrophyModule
//      API)経由で動作すること。
//   3. 世界の真理の演出プレビューは実際の獲得(awardIfNew)を一切行わない
//      見た目だけのプレビューであること。
//
// 実行方法: node tests/playwright_common_trophy_lab.test.js
// ==========================================================
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".geojson": "application/json" };

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

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass += 1; console.log("PASS:", name); }
  else { fail += 1; console.log("FAIL:", name); }
}

(async () => {
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();

  // ---------- テスト1: 本番ページは今回もラボ専用フラグを設定しない ----------
  {
    const page = await browser.newPage();
    await page.goto(base, { waitUntil: "load" });
    const prodPrefix = await page.evaluate(() => window.__WFQ_LAB_STORAGE_PREFIX__);
    check("本番ページはwindow.__WFQ_LAB_STORAGE_PREFIX__を設定しない", prodPrefix === undefined);
    await page.close();
  }

  // ---------- テスト2: ラボが起動し、保存データが完全に隔離されている ----------
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  await page.goto(`${base}dev/common-trophy-lab.html`, { waitUntil: "load" });
  await page.waitForSelector("#screen-trophy-list.active", { timeout: 10000 });
  await page.waitForSelector(".wfq-lab-section", { timeout: 10000 });
  check("テストラボが起動し、トロフィー一覧(共通トロフィータブ)が表示される", true);

  const initialInfo = await page.evaluate(() => ({
    keys: Object.keys(localStorage),
    prefix: window.__WFQ_LAB_STORAGE_PREFIX__,
    summary: TrophyModule.getProgressSummary(),
  }));
  check("ラボ専用の保存接頭辞(wfq_v1_lab_)が設定されている", initialInfo.prefix === "wfq_v1_lab_");
  check("ラボの初期状態で保存キーが存在しない(まっさらな状態)", initialInfo.keys.length === 0);
  check("トロフィー総数は452件(421+共通31)", initialInfo.summary.totalCount === 452);
  check("ラボの初期状態では0件獲得", initialInfo.summary.earnedCount === 0);

  // ---------- テスト3: 「共通以外を10件にする」で#395(10個獲得)が獲得される ----------
  await page.click('button[data-action="units"][data-target="10"]');
  await page.waitForTimeout(100);
  const after10 = await page.evaluate(() => ({
    earned395: TrophyModule.isEarned("trophy_395"),
    keys: Object.keys(localStorage),
  }));
  check("「共通以外を10件にする」で#395(累計10個獲得)が自動的に獲得される", after10.earned395 === true);
  check("保存されたキーがすべてwfq_v1_lab_接頭辞になっている(本番キーが一切無い)", after10.keys.every((k) => k.startsWith("wfq_v1_lab_")) && after10.keys.length > 0);

  // ---------- テスト4: 累積がんばり系(プレイ完了回数)を直接設定できる ----------
  await page.fill("#lab-play-flag", "500");
  await page.fill("#lab-play-capital", "500");
  await page.fill("#lab-play-find", "0");
  await page.click('button[data-action="set-play-count"]');
  await page.waitForTimeout(100);
  const after1000Plays = await page.evaluate(() => TrophyModule.isEarned("trophy_409")); // 終わらない旅(1000回)
  check("プレイ完了回数を合計1000に設定すると#409(終わらない旅)が獲得される", after1000Plays === true);

  // ---------- テスト5: 累計正解数を1件手前(99999)に設定しても#412は未獲得 ----------
  await page.fill("#lab-correct-flag", "99999");
  await page.fill("#lab-correct-capital", "0");
  await page.fill("#lab-correct-find", "0");
  await page.click('button[data-action="set-correct-count"]');
  await page.waitForTimeout(100);
  let correctState = await page.evaluate(() => TrophyModule.isEarned("trophy_412"));
  check("累計正解99,999では#412(十万の軌跡)は未獲得", correctState === false);
  await page.fill("#lab-correct-flag", "100000");
  await page.click('button[data-action="set-correct-count"]');
  await page.waitForTimeout(100);
  correctState = await page.evaluate(() => TrophyModule.isEarned("trophy_412"));
  check("累計正解100,000で#412(十万の軌跡)が獲得される", correctState === true);

  // ---------- テスト6: 連続プレイ日数・累計プレイ日数を直接設定できる ----------
  await page.fill("#lab-streak", "30");
  await page.fill("#lab-played-days", "100");
  await page.click('button[data-action="set-streak-days"]');
  await page.waitForTimeout(100);
  const streakResult = await page.evaluate(() => ({
    d414: TrophyModule.isEarned("trophy_414"), // 継続は力なり(30日連続)
    d415: TrophyModule.isEarned("trophy_415"), // 百日の冒険(累計100日)
  }));
  check("連続日数30で#414(継続は力なり)が獲得される", streakResult.d414 === true);
  check("累計プレイ日数100で#415(百日の冒険)が獲得される", streakResult.d415 === true);

  // ---------- テスト7: 四天王の一括操作(20/20/20/20)で#406が獲得される ----------
  const before406 = await page.evaluate(() => TrophyModule.isEarned("trophy_406"));
  check("四天王一括操作前は#406は未獲得", before406 === false);
  await page.click('button[data-action="cross-four-kings"]');
  await page.waitForTimeout(100);
  const after406 = await page.evaluate(() => TrophyModule.isEarned("trophy_406"));
  check("「四天王: 各分野を20件獲得済みにする」で#406が獲得される", after406 === true);

  // ---------- テスト8: 世界の真理(#425)の演出プレビューは実際には獲得にならない ----------
  const before425 = await page.evaluate(() => TrophyModule.isEarned("trophy_425"));
  check("プレビュー前は#425(世界の真理)は未獲得", before425 === false);
  await page.click('button[data-action="preview-truth"]');
  await page.waitForSelector("#screen-trophy-legend.active", { timeout: 3000 });
  const headingText = await page.textContent("#trophy-legend-heading");
  check("世界の真理の専用演出画面が開き、専用の見出しが表示される", headingText.includes("コンプリート"));
  const hasTruthClass = await page.evaluate(() => document.querySelector(".legend-panel").classList.contains("legend-panel-truth"));
  check("専用のCSS装飾クラス(legend-panel-truth)が付与される", hasTruthClass === true);
  const after425Preview = await page.evaluate(() => TrophyModule.isEarned("trophy_425"));
  check("演出プレビューだけでは#425は実際には獲得済みにならない", after425Preview === false);
  await page.click("#btn-trophy-legend-continue");
  await page.waitForTimeout(100);

  // ---------- テスト9: 連鎖判定ボタン・トロフィー一覧を開くボタンがエラーなく動く ----------
  await page.click('button[data-action="open-trophy-list"]');
  await page.waitForTimeout(100);
  page.once("dialog", (d) => d.accept());
  await page.click('button[data-action="reevaluate"]');
  await page.waitForTimeout(100);
  check("連鎖判定ボタン・トロフィー一覧を開くボタンがエラーなく動作する", true);

  // ---------- テスト10: 「テストラボの保存データをすべて初期化」で完全に空へ戻る ----------
  page.once("dialog", (d) => d.accept());
  await page.click('button[data-action="reset-all"]');
  await page.waitForTimeout(100);
  const afterFullReset = await page.evaluate(() => ({
    keys: Object.keys(localStorage),
    summary: TrophyModule.getProgressSummary(),
  }));
  check("「テストラボの保存データをすべて初期化」で0件獲得の状態に戻る", afterFullReset.summary.earnedCount === 0);

  check("テストラボ操作中、コンソール/ページエラーが発生していない", consoleErrors.length === 0);
  if (consoleErrors.length) consoleErrors.forEach((e) => console.log("console error:", e));

  await page.close();
  await browser.close();
  server.close();
  console.log(`\n合計: ${pass + fail}件 / 成功: ${pass}件 / 失敗: ${fail}件`);
  process.exit(fail > 0 ? 1 : 0);
})();
