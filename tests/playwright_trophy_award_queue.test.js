// ==========================================================
// PR #62 レビュー対応: 図鑑・地図連携などクイズ結果画面を介さない
// トロフィー獲得通知(notifyNonQuizTrophyAward)が、短時間に複数回
// トリガーされた場合にキューで順番に表示されることを確認するテスト。
// 実行方法: node tests/playwright_trophy_award_queue.test.js
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
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });

  try {
    // ---- 1. 複数イベント連続発生時、古い通知が破棄されず全て表示されること ----
    await page.goto(base, { waitUntil: "load" });
    await page.click("#btn-mode-encyclopedia");
    await page.waitForSelector("#ency-grid .ency-card");
    await page.waitForSelector("#screen-encyclopedia-list.active");

    // 図鑑一覧の画面にいる状態から、短時間に3件連続でnotifyNonQuizTrophyAwardを
    // 呼ぶ(2件目・3件目は1件目の通知がまだ表示されている間に発生する想定)。
    // 3件目は1件目と同じidを含めて重複通知が無視されることも同時に確認する
    await page.evaluate(() => {
      notifyNonQuizTrophyAward(["trophy_1"]);
      notifyNonQuizTrophyAward(["trophy_2"]);
      notifyNonQuizTrophyAward(["trophy_1", "trophy_3"]); // trophy_1は重複、trophy_3のみ新規
    });

    await page.waitForSelector("#screen-trophy-award.active");
    let listText = await page.textContent("#trophy-award-list");
    check("1件目の通知(trophy_1)が破棄されずに最初に表示される", (listText || "").includes("はじめの一歩"));
    check("1件目の通知には2件目(trophy_2)が混ざっていない", !(listText || "").includes("クイズ好き"));

    // ---- 2. 現在の通知を閉じた後、次の通知が順番に表示されること ----
    await page.click("#btn-trophy-award-continue");
    await page.waitForTimeout(150);
    check("1件目を閉じた後もscreen-trophy-awardのまま(キューの2件目へ)", await page.$eval(".screen.active", (el) => el.id) === "screen-trophy-award");
    listText = await page.textContent("#trophy-award-list");
    check("2件目の通知(trophy_2)が表示される", (listText || "").includes("クイズ好き"));
    check("2件目の通知には1件目(trophy_1)が混ざっていない", !(listText || "").includes("はじめの一歩"));

    // ---- 3. 同じトロフィーIDを重複して通知しない ----
    await page.click("#btn-trophy-award-continue");
    await page.waitForTimeout(150);
    listText = await page.textContent("#trophy-award-list");
    check("3件目(trophy_3のみ、trophy_1の重複は除外される)が表示される", !(listText || "").includes("はじめの一歩"));
    check("3件目の通知の件数表示が1件のみ", (await page.textContent("#trophy-award-count") || "").includes("1件"));

    // ---- 5. 通知を全て閉じた後、元の画面(図鑑一覧)へ正しく戻る ----
    await page.click("#btn-trophy-award-continue");
    await page.waitForTimeout(150);
    check("全ての通知を閉じた後、元の画面(図鑑一覧)へ戻る", await page.$eval(".screen.active", (el) => el.id) === "screen-encyclopedia-list");

    // ---- 4. キュー内にNo.158「世界の叡智」が含まれる場合も専用演出が表示されること ----
    await page.evaluate(() => {
      notifyNonQuizTrophyAward(["trophy_4"]);
      notifyNonQuizTrophyAward(["trophy_158"]);
    });
    await page.waitForSelector("#screen-trophy-award.active");
    listText = await page.textContent("#trophy-award-list");
    check("キュー1件目(trophy_4)が先に表示される", !(listText || "").includes("世界の叡智"));
    await page.click("#btn-trophy-award-continue");
    await page.waitForTimeout(150);
    check("キュー2件目(trophy_158)の通知が表示される", await page.$eval(".screen.active", (el) => el.id) === "screen-trophy-award");
    listText = await page.textContent("#trophy-award-list");
    check('trophy_158の獲得通知には正式名称「世界の叡智」が表示される(獲得の瞬間なので「？？？？？？」のままではない)', (listText || "").includes("世界の叡智"));
    check('trophy_158の通知に隠しトロフィー発見のラベルが付く', (listText || "").includes("隠しトロフィー発見"));
    await page.click("#btn-trophy-award-continue");
    await page.waitForTimeout(150);
    check("No.158専用演出画面(screen-trophy-legend)へ正しく遷移する", await page.$eval(".screen.active", (el) => el.id) === "screen-trophy-legend");
    const legendHeading = await page.textContent("#trophy-legend-heading");
    check('専用演出の見出しが「世界図鑑 完全制覇！」になる', (legendHeading || "").includes("世界図鑑 完全制覇"));
    const legendBtnLabel = await page.textContent("#btn-trophy-legend-continue");
    check('専用演出のボタンが図鑑へ戻る文言になる', (legendBtnLabel || "").includes("図鑑"));

    // ---- 5(続き). 専用演出を閉じた後も、キューが残っていれば継続し、
    // 最終的に元の画面(図鑑一覧)へ正しく戻ること ----
    await page.click("#btn-trophy-legend-continue");
    await page.waitForTimeout(150);
    check("専用演出を閉じた後、元の画面(図鑑一覧)へ戻る", await page.$eval(".screen.active", (el) => el.id) === "screen-encyclopedia-list");

    // ---- 6a. 既存の国旗/首都クイズの獲得通知フローを壊していないこと ----
    // (クイズ経由はtrophyAwardOnContinueを使わないため、図鑑経由の
    // キュー処理が全て終わった後でもクイズ結果画面からの遷移は
    // 従来どおり「結果画面へ」に戻ることを確認する)
    await page.evaluate(() => {
      state.lastResult = { correct: 5, total: 10, rate: 0.5, mode: "flag", newTrophyIds: ["trophy_5"], wrongIds: [], titleObj: null, isNewTitle: false, best: null };
      renderTrophyAwardScreen();
      showScreen("screen-trophy-award");
    });
    await page.waitForSelector("#screen-trophy-award.active");
    const quizContinueLabel = await page.textContent("#btn-trophy-award-continue");
    check('クイズ経由の通知ボタンは従来どおり「結果画面へ」のまま', (quizContinueLabel || "").trim() === "結果画面へ");
    await page.click("#btn-trophy-award-continue");
    await page.waitForTimeout(150);
    check("クイズ経由の通知を閉じると結果画面(screen-result)へ戻る(図鑑側の戻り先に影響されない)", await page.$eval(".screen.active", (el) => el.id) === "screen-result");

    // ---- 6b. 既存の#142「都の神話」専用演出がクイズ経由で壊れていないこと ----
    await page.evaluate(() => {
      state.lastResult = { correct: 10, total: 10, rate: 1, mode: "capital", newTrophyIds: ["trophy_142"], wrongIds: [], titleObj: null, isNewTitle: false, best: null };
      renderTrophyAwardScreen();
      showScreen("screen-trophy-award");
    });
    await page.waitForSelector("#screen-trophy-award.active");
    await page.click("#btn-trophy-award-continue");
    await page.waitForTimeout(150);
    check("#142はクイズ経由でも専用演出画面(screen-trophy-legend)に遷移する", await page.$eval(".screen.active", (el) => el.id) === "screen-trophy-legend");
    const legendHeading142 = await page.textContent("#trophy-legend-heading");
    check('#142の見出しは従来どおり「首都トリビア完全制覇！」のまま', (legendHeading142 || "").includes("首都トリビア完全制覇"));
    const legendBtnLabel142 = await page.textContent("#btn-trophy-legend-continue");
    check('#142のボタンは従来どおり「結果画面へ」のまま(図鑑経由ではないため)', (legendBtnLabel142 || "").trim() === "結果画面へ");
    await page.click("#btn-trophy-legend-continue");
    await page.waitForTimeout(150);
    check("#142の専用演出を閉じると結果画面(screen-result)へ戻る", await page.$eval(".screen.active", (el) => el.id) === "screen-result");

    check("no uncaught console/page errors during the whole flow", consoleErrors.length === 0);
    if (consoleErrors.length) consoleErrors.forEach((e) => console.log("  console error:", e));
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\nTotal: ${pass + fail}, Pass: ${pass}, Fail: ${fail}`);
  process.exitCode = fail > 0 ? 1 : 0;
})();
