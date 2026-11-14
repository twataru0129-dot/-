// ==========================================================
// 称号コレクション「画面」廃止の回帰テスト。
// 重要: 称号12種類の定義・獲得判定・保存データ・トロフィーNo.101〜112との
// 連動は一切変更していないことを、実際のクイズ終了処理(finishQuiz)を
// 直接呼び出して検証する(モックではなく本物のコードパスを通す)。
// 実行方法: node tests/playwright_title_collection_removed.test.js
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
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}/`;

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", headless: true, args: ["--headless", "--no-sandbox"] });

  // ---- A. UI: ホーム画面・トロフィー一覧 ----
  for (const [label, viewport] of [["iPhone", { width: 390, height: 844 }], ["iPad", { width: 834, height: 1194 }], ["PC", { width: 1280, height: 800 }]]) {
    const page = await browser.newPage({ viewport });
    const consoleErrors = [];
    page.on("pageerror", (e) => consoleErrors.push(String(e)));
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });

    await page.goto(base, { waitUntil: "load" });

    check(`[${label}] #btn-collectionがホーム画面に存在しない`, (await page.$("#btn-collection")) === null);
    check(`[${label}] #screen-collectionがDOMに存在しない`, (await page.$("#screen-collection")) === null);

    const modeIds = ["#btn-mode-flag", "#btn-mode-capital", "#btn-mode-map", "#btn-mode-encyclopedia", "#btn-mode-findcountry", "#btn-trophy-list", "#btn-sound-toggle", "#btn-reset-data"];
    let allVisible = true;
    for (const sel of modeIds) {
      const visible = await page.isVisible(sel).catch(() => false);
      if (!visible) { allVisible = false; console.log(`  missing/invisible: ${sel}`); }
    }
    check(`[${label}] 他の既存メニュー(国旗/首都/地図/図鑑/どこかな/トロフィー一覧/音/リセット)が全て表示される`, allVisible);

    // レイアウト崩れの簡易確認: モード選択グリッドとトロフィー一覧ボタンの間隔が
    // 自然な範囲(0〜120px、重なりなし)に収まっていること
    const gridBox = await page.$eval(".mode-select-grid", (el) => el.getBoundingClientRect());
    const trophyBtnBox = await page.$eval("#btn-trophy-list", (el) => el.getBoundingClientRect());
    const gap = trophyBtnBox.top - gridBox.bottom;
    check(`[${label}] モード選択とトロフィー一覧ボタンの間隔が自然(0〜120px、重なりなし): ${gap.toFixed(1)}px`, gap >= 0 && gap <= 120);

    // トロフィー一覧が正常に開き、固定ヘッダー・153件・9カテゴリー・隠し14件が維持されている
    await page.click("#btn-trophy-list");
    await page.waitForSelector("#trophy-grid .trophy-card");
    check(`[${label}] トロフィー一覧の固定ヘッダーが維持されている`, (await page.$(".trophy-list-header")) !== null);
    const totalCount = await page.$$eval("#trophy-grid .trophy-card", (els) => els.length);
    check(`[${label}] トロフィー総数が153件のまま`, totalCount === 153);
    const legacyTab = await page.$('#trophy-category-tabs [data-category="legacy"]');
    check(`[${label}] 「称号コレクション」カテゴリータブ(#101〜112、legacy)が維持されている`, !!legacyTab);
    if (legacyTab) {
      await legacyTab.click();
      await page.waitForTimeout(150);
      const legacyCount = await page.$$eval("#trophy-grid .trophy-card", (els) => els.filter((e) => !e.classList.contains("hidden")).length);
      check(`[${label}] 称号コレクションカテゴリーが12件のまま`, legacyCount === 12);
    }
    await page.click(".trophy-list-header .btn-back");
    await page.waitForSelector("#screen-top.active");

    check(`[${label}] ここまででコンソール/ページエラーが発生していない`, consoleErrors.length === 0);
    if (consoleErrors.length) consoleErrors.forEach((e) => console.log(`  [${label}] console error:`, e));
    await page.close();
  }

  // ---- B. データ・判定: 称号獲得判定が画面廃止後も従来どおり機能すること ----
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const consoleErrors = [];
    page.on("pageerror", (e) => consoleErrors.push(String(e)));
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    await page.goto(base, { waitUntil: "load" });

    const before = await page.evaluate(() => ({
      hasTitle: Storage.hasTitle("beginner", "flag"),
      attempts: Storage.getAttempts("flag"),
      trophy101: TrophyModule.isEarned("trophy_101"),
      // #1「はじめの一歩」はmode:"both"のデュアル型トロフィーのため、
      // 対象モード("flag")を明示して判定する(省略するとcommon型扱いの
      // entry.earnedAtを見てしまい、常にfalseになる)
      trophy1: TrophyModule.isEarned("trophy_1", "flag"),
    }));
    check("初期状態: 称号未獲得・挑戦回数0・トロフィー#101/#1未獲得", !before.hasTitle && before.attempts === 0 && !before.trophy101 && !before.trophy1);


    // 国旗クイズ10問コースで全問正解したものとして、実際のクイズ終了処理
    // (finishQuiz)を直接呼び出す。これは称号コレクション画面とは無関係の
    // コードパスであり、本来のゲームプレイと同じ経路を通る
    await page.evaluate(() => {
      state.mode = "flag";
      state.questions = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}` }));
      state.score = 10;
      state.wrongIds = new Set();
      state.quizStartedAt = new Date().toISOString();
      state.answerTimings = [];
      finishQuiz();
    });
    await page.waitForSelector("#screen-result.active");

    const after = await page.evaluate(() => ({
      hasTitle: Storage.hasTitle("beginner", "flag"),
      attempts: Storage.getAttempts("flag"),
      bestRecord: Storage.getBestRecords("flag")["10"],
      trophy101: TrophyModule.isEarned("trophy_101"),
      trophy1: TrophyModule.isEarned("trophy_1", "flag"),
    }));
    check("称号「国旗ビギナー」が獲得される(Storage.hasTitle)", after.hasTitle === true);
    check("挑戦回数が1回に増える", after.attempts === 1);
    check("10問モードの最高記録が10/10で保存される", after.bestRecord && after.bestRecord.correct === 10 && after.bestRecord.total === 10);
    check("トロフィー#101(称号コレクション参照型)が連動して獲得される", after.trophy101 === true);
    check("トロフィー#1(はじめの一歩)も獲得される", after.trophy1 === true);

    const viewTitleBtnVisible = await page.isVisible("#btn-result-view-title");
    const memorialBtnVisible = await page.isVisible("#btn-result-memorial");
    check('結果画面の「🏅 称号を見る」ボタンが表示される', viewTitleBtnVisible);
    check('結果画面の「🖼 記念画像を作る」ボタンが表示される', memorialBtnVisible);

    await page.click("#btn-result-view-title");
    await page.waitForSelector("#screen-title-award.active");
    const titleName = await page.textContent("#award-title-name");
    check('称号獲得画面に「国旗ビギナー」が表示される', (titleName || "").includes("国旗ビギナー"));

    await page.click("#btn-award-memorial");
    await page.waitForSelector("#screen-memorial.active");
    check("記念画像作成画面が正常に開く", true);

    // トロフィー一覧でも#101が獲得済みとして表示されることを確認
    await page.evaluate(() => showScreen("screen-top"));
    await page.click("#btn-trophy-list");
    await page.waitForSelector("#trophy-grid .trophy-card");
    const card101Earned = await page.$eval('#trophy-grid .trophy-card[data-earned="true"]', () => true).catch(() => false);
    check("トロフィー一覧に獲得済みのカードが表示される(#101反映の確認)", card101Earned);

    check("この一連の操作でコンソール/ページエラーが発生していない", consoleErrors.length === 0);
    if (consoleErrors.length) consoleErrors.forEach((e) => console.log("  console error:", e));
    await page.close();
  }

  // ---- C. 既存データの保護: 更新前からの保存データがそのまま読み込めること ----
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(base, { waitUntil: "load" });
    const earnedAt = "2024-01-01T00:00:00.000Z";
    await page.evaluate((iso) => {
      localStorage.setItem("wfq_v1_earned_titles", JSON.stringify({ beginner: { earnedAt: iso }, master: { earnedAt: iso } }));
      localStorage.setItem("wfq_v1_attempts_count", "42");
      localStorage.setItem("wfq_v1_best_rate", "87.5");
      localStorage.setItem("wfq_v1_best_records", JSON.stringify({ 10: { correct: 10, total: 10 }, 100: { correct: 95, total: 100 } }));
    }, earnedAt);
    await page.reload({ waitUntil: "load" });

    const loaded = await page.evaluate(() => ({
      titles: Storage.getEarnedTitles("flag"),
      attempts: Storage.getAttempts("flag"),
      bestRate: Storage.getBestRate("flag"),
      bestRecords: Storage.getBestRecords("flag"),
      trophy101: TrophyModule.isEarned("trophy_101"),
      trophy105: TrophyModule.isEarned("trophy_105"),
    }));
    check("更新前に保存されていた称号データがそのまま読み込める", loaded.titles.beginner && loaded.titles.beginner.earnedAt === earnedAt && loaded.titles.master && loaded.titles.master.earnedAt === earnedAt);
    check("更新前の挑戦回数が保持される(42回)", loaded.attempts === 42);
    check("更新前の最高正答率が保持される(87.5%)", loaded.bestRate === 87.5);
    check("更新前の最高記録が保持される", loaded.bestRecords["10"].correct === 10 && loaded.bestRecords["100"].correct === 95);
    check("既存の称号データと連動してトロフィー#101(国旗ビギナー)が獲得済みとして読み込める", loaded.trophy101 === true);
    check("既存の称号データと連動してトロフィー#105(国旗マスター)が獲得済みとして読み込める", loaded.trophy105 === true);

    // 保存データが「意図せず変化していない」こと(読み込んだだけで書き換わっていないか)
    const rawAfterLoad = await page.evaluate(() => ({
      titles: localStorage.getItem("wfq_v1_earned_titles"),
      attempts: localStorage.getItem("wfq_v1_attempts_count"),
    }));
    check("称号データを読み込んだだけでは保存内容が書き換わらない", JSON.parse(rawAfterLoad.titles).beginner.earnedAt === earnedAt);
    check("挑戦回数を読み込んだだけでは保存内容が書き換わらない", rawAfterLoad.attempts === "42");

    await page.close();
  }

  // ---- D. リセット機能: 称号データも含めて従来どおりリセットされること(変更していないことの確認) ----
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(base, { waitUntil: "load" });
    await page.evaluate(() => {
      Storage.awardTitleIfNew("beginner", "flag");
      Storage.incrementAttempts("flag");
      Storage.updateBestRate(100, "flag");
      Storage.updateBestRecord(10, 10, 10, "flag");
    });
    const before = await page.evaluate(() => ({ hasTitle: Storage.hasTitle("beginner", "flag"), attempts: Storage.getAttempts("flag") }));
    check("リセット前は称号・挑戦回数が記録されている", before.hasTitle === true && before.attempts === 1);
    await page.evaluate(() => Storage.resetAll());
    const after = await page.evaluate(() => ({ hasTitle: Storage.hasTitle("beginner", "flag"), attempts: Storage.getAttempts("flag"), trophy101: TrophyModule.isEarned("trophy_101") }));
    check("resetAll()で称号データも従来どおり削除される(新しい孤立データを残していない)", after.hasTitle === false && after.attempts === 0 && after.trophy101 === false);
    await page.close();
  }

  await browser.close();
  server.close();

  console.log(`\nTotal: ${pass + fail}, Pass: ${pass}, Fail: ${fail}`);
  process.exitCode = fail > 0 ? 1 : 0;
})();
