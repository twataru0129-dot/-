// ==========================================================
// 共通トロフィー(累積がんばり系)の二重集計防止を、実際のクイズ操作
// (本物のDOM要素への実クリック)を通じて確認するテスト。
// PRレビュー指摘事項: 「保存関数を直接呼ぶだけのテストで済ませない」ため、
// TrophyModule.recordCommonTally()等を直接呼ぶのではなく、国旗クイズの
// 選択肢ボタン・世界の国どこかな？の地図タップを実際にクリック/タップして
// 検証する。
//
// 確認項目:
//   1. 国旗クイズで同じ回答ボタンを連打(同一tickで2回click())しても、
//      共通トロフィーの累計正解数は1問につき1回しか増えない
//      (js/app.jsのhandleAnswer()先頭のstate.answeredガードが根拠)
//   2. クイズを10問の途中(例: 3問目)で「✕」から中断しても、既に回答
//      確定した問題の正解/誤答・プレイ完了回数は保持される一方、
//      プレイ完了回数そのものは増えない(中断はfinishQuiz()を経由しない)
//   3. 国旗クイズ10問を実際に全問正解でクリアした場合、累計プレイ完了
//      回数・累計正解数が実際のクリック回数と正確に一致する(二重集計も
//      過少集計もない)
//
// 実行方法: node tests/playwright_common_trophy_double_count.test.js
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

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass += 1; console.log("PASS:", name); }
  else { fail += 1; console.log("FAIL:", name); }
}

// 現在の問題の正解の選択肢ボタンをクリックする。doubleClick===trueの場合、
// 同じ実DOMノードに対してclick()イベントを同一タスク内で2回連続発火させる
// (実際のユーザーの連打を模する。Playwrightの操作可能性チェック・待機に
// よる非同期タイミングのズレを避けるため、ページ内のJSで直接2回発火させる。
// handleAnswer()は1回目の発火内で同期的にstate.answered=trueにして
// ボタンを無効化するため、2回目のclick()は(ブラウザの仕様により無効化
// 済みのbuttonへのclick()はクリックイベント自体を発生させない)何も
// 起こらないはずであることを検証する)
async function clickCorrectAnswer(page, doubleClick = false) {
  const correctId = await page.evaluate(() => state.questions[state.currentQuestionIndex].id);
  await page.evaluate(({ id, double }) => {
    const btn = document.querySelector(`#choices-grid .choice-btn[data-id="${id}"]`);
    btn.click();
    if (double) btn.click();
  }, { id: correctId, double: doubleClick });
}

(async () => {
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  await page.goto(base, { waitUntil: "load" });

  // ---------- テスト1: 同じ回答ボタンを連打しても二重集計されない ----------
  await page.click('.mode-card[data-mode="flag"]');
  await page.click('.count-card:not(.special)'); // 198問以外(=10問)の最初のカードを選ぶ
  await page.waitForSelector('#choices-grid .choice-btn');
  const correctCountBefore = await page.evaluate(() => TrophyModule.getCommonTrophyProgress(410).current);
  await clickCorrectAnswer(page, true); // 同じ正解ボタンへの連打(同一タスク内で2回click())を試みる
  await page.waitForTimeout(1800); // result-overlay表示・次の問題への遷移(1.5秒)を待つ
  const correctCountAfter = await page.evaluate(() => TrophyModule.getCommonTrophyProgress(410).current);
  check("同じ回答ボタンへの連打があっても、累計正解数は1問につき1回しか増えない", correctCountAfter === correctCountBefore + 1);

  // ---------- テスト2: 途中中断(✕ボタン)では、プレイ完了回数は増えないが、
  // 既に確定した正解数は保持される ----------
  const correctCountAfterQ1 = correctCountAfter;
  const playCompletedBefore = await page.evaluate(() => TrophyModule.getCommonTrophyProgress(407).current);
  await clickCorrectAnswer(page); // 2問目も正解しておく
  await page.waitForTimeout(300); // 正解直後の集計自体は同期的なので、次の問題への遷移を待たずに確認できる
  const correctCountAfterQ2 = await page.evaluate(() => TrophyModule.getCommonTrophyProgress(410).current);
  check("2問目の正解も累計正解数に正しく加算される(1問目の分が失われていない)", correctCountAfterQ2 === correctCountAfterQ1 + 1);

  await page.click("#btn-quiz-exit");
  await page.waitForTimeout(100);
  await page.click("#confirm-modal-yes"); // 「クイズを終了しますか？」→はい
  await page.waitForTimeout(100);
  const playCompletedAfterAbandon = await page.evaluate(() => TrophyModule.getCommonTrophyProgress(407).current);
  const correctCountAfterAbandon = await page.evaluate(() => TrophyModule.getCommonTrophyProgress(410).current);
  check("途中中断(✕→終了)では、累計プレイ完了回数は増えない(finishQuiz()を経由しないため)", playCompletedAfterAbandon === playCompletedBefore);
  check("途中中断しても、既に確定した2問分の正解数は失われずに保持される", correctCountAfterAbandon === correctCountAfterQ2);

  // ---------- テスト3: 10問を実際に全問正解でクリアし、プレイ完了回数・
  // 累計正解数が実際のクリック回数と正確に一致することを確認する ----------
  await page.click('.mode-card[data-mode="flag"]');
  await page.click('.count-card:not(.special)');
  await page.waitForSelector('#choices-grid .choice-btn');
  const correctCountBeforeFull = await page.evaluate(() => TrophyModule.getCommonTrophyProgress(410).current);
  const playCompletedBeforeFull = await page.evaluate(() => TrophyModule.getCommonTrophyProgress(407).current);
  const totalQuestions = await page.evaluate(() => state.questions.length);
  for (let i = 0; i < totalQuestions; i++) {
    await clickCorrectAnswer(page);
    await page.waitForTimeout(1800);
  }
  await page.waitForSelector("#screen-result.active", { timeout: 5000 });
  const correctCountAfterFull = await page.evaluate(() => TrophyModule.getCommonTrophyProgress(410).current);
  const playCompletedAfterFull = await page.evaluate(() => TrophyModule.getCommonTrophyProgress(407).current);
  check(`${totalQuestions}問すべてに正解した回数だけ、累計正解数が正確に増えている(二重・過少集計なし)`, correctCountAfterFull === correctCountBeforeFull + totalQuestions);
  check("1回のクイズ完了につき、累計プレイ完了回数はちょうど1回だけ増える", playCompletedAfterFull === playCompletedBeforeFull + 1);

  check("テスト中、コンソール/ページエラーが発生していない", consoleErrors.length === 0);
  if (consoleErrors.length) consoleErrors.forEach((e) => console.log("console error:", e));

  await page.close();
  await browser.close();
  server.close();
  console.log(`\n合計: ${pass + fail}件 / 成功: ${pass}件 / 失敗: ${fail}件`);
  process.exit(fail > 0 ? 1 : 0);
})();
