// ==========================================================
// PR #66追加修正: 隠しトロフィー判定用イベント記録の補強
//
// quizState.mistakeEvents(ライフが減った出来事を発生順序どおりに積む
// 履歴。{order, questionNumber, countryId, kind("wrong"|"pass"|"timeout"),
// livesAfter})が、実際のゲーム処理経路(FindCountryModule.simulateTapForTest
// = 本番のhandleTapと同一関数)を通して正しく記録されることを確認する。
//
// 実行方法: node tests/playwright_findcountry_mistake_events.test.js
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

async function newPage(browser, consoleErrors) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("dialog", (d) => d.dismiss().catch(() => {}));
  return page;
}

async function startCourse(page, base, difficultyIndex, questionCount) {
  await page.goto(base, { waitUntil: "load" });
  await page.click("#btn-mode-findcountry");
  await page.waitForSelector("#screen-findcountry-difficulty.active");
  const cards = await page.$$("#findcountry-difficulty-options .difficulty-card");
  await cards[difficultyIndex].click();
  await page.waitForSelector("#screen-findcountry-count.active");
  const countIndex = [5, 10, 20, 30].indexOf(questionCount);
  const countCards = await page.$$("#findcountry-count-options .count-card");
  await countCards[countIndex].click();
  await page.waitForSelector("#screen-map.findcountry-mode", { timeout: 15000 });
  await page.waitForSelector("#map-globe-container canvas", { timeout: 15000 });
  await page.waitForTimeout(400);
}

async function tapCorrect(page) {
  return page.evaluate(() => {
    const id = FindCountryModule.getCurrentCountryId();
    FindCountryModule.simulateTapForTest(id);
    return id;
  });
}

async function tapWrong(page) {
  return page.evaluate(() => {
    const correctId = FindCountryModule.getCurrentCountryId();
    const wrongId = correctId === "jp" ? "fr" : "jp";
    FindCountryModule.simulateTapForTest(wrongId);
    return wrongId;
  });
}

async function clickRetry(page) {
  await page.waitForSelector("#findcountry-quiz-retry:not(.hidden)", { timeout: 5000 });
  await page.click("#findcountry-quiz-retry");
  await page.waitForTimeout(100);
}

async function tapPass(page) {
  await page.click("#findcountry-quiz-pass");
  await page.waitForTimeout(100);
}

async function clickNext(page) {
  await page.click("#findcountry-quiz-next");
  await page.waitForTimeout(150);
}

async function proceedPastNameEntryIfShown(page) {
  const nameEntryActive = await page.$(".screen.active#screen-findcountry-name-entry");
  if (nameEntryActive) {
    await page.click("#findcountry-name-entry-submit");
    await page.waitForTimeout(200);
  }
}

async function drainTrophyAwardScreens(page, maxIterations) {
  for (let i = 0; i < (maxIterations || 30); i++) {
    const active = await page.$(".screen.active#screen-trophy-award");
    if (!active) return;
    await page.click("#btn-trophy-award-continue");
    await page.waitForTimeout(150);
  }
}

// 現在の問題を正解タップで確定し、「次の問題へ」/「結果を見る」を押して
// 進める(名前入力・トロフィー獲得通知が挟まっても自動で抜ける)
async function answerCorrectAndAdvance(page) {
  await tapCorrect(page);
  await page.waitForTimeout(150);
  await drainTrophyAwardScreens(page);
  await clickNext(page);
  await proceedPastNameEntryIfShown(page);
  await drainTrophyAwardScreens(page);
}

async function getMistakeEvents(page) {
  return page.evaluate(() => FindCountryModule.getMistakeEvents());
}

async function readLastPlayRecord(page) {
  return page.evaluate(() => FindCountryModule.getLastPlayRecordForTest());
}

(async () => {
  const consoleErrors = [];
  const browser = await chromium.launch();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/`;

  // ========================================================
  // テスト1: 同じ問題で2回誤答した場合、wrongイベントが2件記録される
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await startCourse(page, base, 0, 5); // 初級5問

    await tapWrong(page);
    await clickRetry(page);
    await tapWrong(page);
    await clickRetry(page);
    await tapCorrect(page); // 3回目でようやく正解、Q1を確定させる

    const events = await getMistakeEvents(page);
    const wrongEventsQ1 = events.filter((e) => e.kind === "wrong" && e.questionNumber === 1);
    check("テスト1: 同じ問題で2回誤答するとwrongイベントが2件記録される", wrongEventsQ1.length === 2);
    check("テスト1: 2件のorderが1,2の順になっている", wrongEventsQ1[0] && wrongEventsQ1[1] && wrongEventsQ1[0].order === 1 && wrongEventsQ1[1].order === 2);
    check("テスト1: ライフが4→3と正しく減っている", wrongEventsQ1[0] && wrongEventsQ1[0].livesAfter === 4 && wrongEventsQ1[1].livesAfter === 3);

    await page.close();
  }

  // ========================================================
  // テスト2: 誤答後に正解しても、wrongイベントが残る
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await startCourse(page, base, 0, 5);

    await tapWrong(page);
    await clickRetry(page);
    const correctId = await page.evaluate(() => FindCountryModule.getCurrentCountryId());
    await page.evaluate((id) => FindCountryModule.simulateTapForTest(id), correctId);
    await page.waitForTimeout(150);
    await drainTrophyAwardScreens(page);
    await clickNext(page);
    await proceedPastNameEntryIfShown(page);
    await drainTrophyAwardScreens(page);
    // 残りの4問をすべて正解してコースをクリアする
    for (let i = 0; i < 4; i++) await answerCorrectAndAdvance(page);

    const record = await readLastPlayRecord(page);
    const wrongEvents = record.mistakeEvents.filter((e) => e.kind === "wrong");
    check("テスト2: コースクリア後もwrongイベントが削除されずに残っている", wrongEvents.length === 1);
    check("テスト2: ノーミス判定は引き続き正しくfalseになる(results[]が全件correctでも誤判定しない)", record.noMistakes === false);

    await page.close();
  }

  // ========================================================
  // テスト3: 誤答→パス→時間切れの順序が正しく記録される
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await startCourse(page, base, 0, 5);

    // Q1: 誤答→再挑戦→正解(誤答イベントを1件発生させてからQ1を確定)
    await tapWrong(page);
    await clickRetry(page);
    const q1CorrectId = await page.evaluate(() => FindCountryModule.getCurrentCountryId());
    await page.evaluate((id) => FindCountryModule.simulateTapForTest(id), q1CorrectId);
    await page.waitForTimeout(150);
    await drainTrophyAwardScreens(page);
    await clickNext(page);
    await proceedPastNameEntryIfShown(page);
    await drainTrophyAwardScreens(page);

    // Q2: パス
    await tapPass(page);
    await drainTrophyAwardScreens(page);
    await clickNext(page);
    await proceedPastNameEntryIfShown(page);
    await drainTrophyAwardScreens(page);

    // Q3: 時間切れ(上級20秒より短い初級30秒だと待ちが長いため、ここだけ
    // advancedコースに切り替えるのではなく、初級のまま実時間31秒待つ)
    await page.waitForTimeout(31000);
    await drainTrophyAwardScreens(page);
    await clickNext(page);
    await proceedPastNameEntryIfShown(page);
    await drainTrophyAwardScreens(page);

    const events = await getMistakeEvents(page);
    const kinds = events.map((e) => e.kind);
    check("テスト3: 誤答→パス→時間切れの順序で記録される", kinds.length >= 3 && kinds[0] === "wrong" && kinds[1] === "pass" && kinds[2] === "timeout");
    check("テスト3: orderも1,2,3の順になっている", events[0].order === 1 && events[1].order === 2 && events[2].order === 3);

    await page.close();
  }

  // ========================================================
  // テスト4: ライフ0になった最後のミスも記録される(beginner_5、5回連続誤答)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await startCourse(page, base, 0, 5);

    for (let i = 0; i < 4; i++) {
      await tapWrong(page);
      await clickRetry(page);
    }
    // 5回目(最後のライフ)の誤答。再挑戦ボタンは出ずゲームオーバーになる
    await tapWrong(page);
    await page.waitForTimeout(200);

    const events = await getMistakeEvents(page);
    check("テスト4: ゲームオーバーまでの5回の誤答がすべて記録される", events.length === 5);
    const last = events[events.length - 1];
    check("テスト4: 最後のミスのlivesAfterが0になっている", last && last.livesAfter === 0 && last.kind === "wrong");

    await page.close();
  }

  // ========================================================
  // テスト5: 新しいゲーム開始時に記録が初期化される
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await startCourse(page, base, 0, 5);
    await tapWrong(page);
    await clickRetry(page);
    const eventsBeforeRestart = await getMistakeEvents(page);
    check("テスト5(前提): 1回目のプレイでミスイベントが記録されている", eventsBeforeRestart.length === 1);

    // コースをクリアして結果画面から「もう一度遊ぶ」で同じコースを再開する
    const correctId = await page.evaluate(() => FindCountryModule.getCurrentCountryId());
    await page.evaluate((id) => FindCountryModule.simulateTapForTest(id), correctId);
    await page.waitForTimeout(150);
    await drainTrophyAwardScreens(page);
    await clickNext(page);
    await proceedPastNameEntryIfShown(page);
    await drainTrophyAwardScreens(page);
    for (let i = 0; i < 4; i++) await answerCorrectAndAdvance(page);

    await page.click("#btn-findcountry-result-retry");
    await page.waitForSelector("#screen-map.findcountry-mode", { timeout: 15000 });
    await page.waitForTimeout(300);

    const eventsAfterRestart = await getMistakeEvents(page);
    check("テスト5: 新しいプレイ開始時にミスイベントが初期化される(0件)", eventsAfterRestart.length === 0);
    const recordAfterRestart = await readLastPlayRecord(page);
    check("テスト5: lastPlayRecordForTestも新しいプレイ開始時にnullへ初期化される", recordAfterRestart === null);

    await page.close();
  }

  // ========================================================
  // テスト6: 途中中断後に古いプレイの結果が残らない
  // (1プレイ目を完走させてlastPlayRecordForTestを確定させた後、2プレイ目を
  // 開始して1問だけ正解した状態で中断する。中断時にshowResult()自体が
  // 呼ばれないため、lastPlayRecordForTestは「1プレイ目の結果」のまま
  // 古い値を保持し続けるのではなく、2プレイ目の開始時点でnullにリセット
  // されていることを確認する)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await startCourse(page, base, 0, 5);
    for (let i = 0; i < 5; i++) await answerCorrectAndAdvance(page);

    const recordAfterPlay1 = await readLastPlayRecord(page);
    check("テスト6(前提): 1プレイ目完走後はlastPlayRecordForTestが記録されている", recordAfterPlay1 !== null);

    await page.click("#btn-findcountry-result-retry");
    await page.waitForSelector("#screen-map.findcountry-mode", { timeout: 15000 });
    await page.waitForTimeout(300);

    const recordRightAfterStart = await readLastPlayRecord(page);
    check("テスト6: 2プレイ目開始直後、1プレイ目の古い結果が残っていない(null)", recordRightAfterStart === null);

    // 2プレイ目を1問だけ正解した状態で中断する
    await tapCorrect(page);
    await page.waitForTimeout(150);
    await drainTrophyAwardScreens(page);
    await page.click("#findcountry-quiz-back");
    await page.waitForSelector("#confirm-modal:not(.hidden)", { timeout: 5000 });
    await page.click("#confirm-modal-yes");
    await page.waitForTimeout(300);

    const recordAfterAbandon = await readLastPlayRecord(page);
    check("テスト6: 中断後も(showResultが呼ばれないため)lastPlayRecordForTestはnullのまま、1プレイ目の古い結果と誤認しない", recordAfterAbandon === null);

    await page.close();
  }

  check("全テストでコンソール/ページエラーが発生していない", consoleErrors.length === 0);
  if (consoleErrors.length) console.log("consoleErrors:", consoleErrors);

  await browser.close();
  server.close();
  console.log(`\nTotal: ${pass + fail}, Pass: ${pass}, Fail: ${fail}`);
  process.exit(fail > 0 ? 1 : 0);
})();
