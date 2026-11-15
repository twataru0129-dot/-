// ==========================================================
// 隠しトロフィー61種類(#195〜255、第2段階)の統合テスト。
// 実際のゲーム処理経路(FindCountryModule.simulateTapForTest = 本番の
// handleTapと同一関数)を通して、以下を確認する:
// - プレイ中に新しい61種類の獲得条件を満たしても、通知・ポップアップ・
//   画面停止が一切発生しない(既存トロフィーの通知経路とは完全に分離)
// - 条件を満たした瞬間にStorageへ即時保存され、途中中断しても保持される
// - 途中中断では最終得点系(#195〜228)が絶対に獲得されない
// - 既存トロフィー(例: No.159の即時通知)は新61種類の追加後も変わらず
//   通知される(既存の通知経路に影響が無いことの確認)
//
// 実行方法: node tests/playwright_hidden61_integration.test.js
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

async function clickNext(page) {
  await page.click("#findcountry-quiz-next");
  await page.waitForTimeout(150);
}

async function drainTrophyAwardScreens(page, maxIterations) {
  for (let i = 0; i < (maxIterations || 30); i++) {
    const active = await page.$(".screen.active#screen-trophy-award");
    if (!active) return;
    await page.click("#btn-trophy-award-continue");
    await page.waitForTimeout(150);
  }
}

async function isEarned(page, id) {
  return page.evaluate((trophyId) => TrophyModule.isEarned(trophyId), id);
}

async function getHiddenAwardedIdsThisPlay(page) {
  return page.evaluate(() => FindCountryModule.getHiddenAwardedIdsThisPlay());
}

(async () => {
  const consoleErrors = [];
  const browser = await chromium.launch();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/`;

  // ========================================================
  // テストA: 隠しトロフィー#229「エンペラータイム」(3問連続1000点)を
  // 実タップ経路で達成しても、通知・ポップアップ・画面停止が一切
  // 発生しないことを確認する。同じプレイの最初の正解はNo.159(既存、
  // 即時通知対象)にも該当するため、まずそちらの通知が正常に出ることを
  // 確認してから閉じ、その後の3問連続1000点では通知が出ないことを見る
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await startCourse(page, base, 0, 5); // 初級5問

    check("テストA前提: #229は開始時点で未獲得", (await isEarned(page, "trophy_229")) === false);

    // 1問目: 既存のNo.159(「地図への第一歩」、初めての正解)が即時通知される
    await tapCorrect(page);
    await page.waitForSelector("#screen-trophy-award.active", { timeout: 5000 });
    const awardText = await page.textContent("#trophy-award-list");
    check("テストA: 既存No.159の即時通知は新61種類の追加後も変わらず表示される", (awardText || "").includes("地図への第一歩"));
    await drainTrophyAwardScreens(page);
    await clickNext(page);

    // 2〜3問目: さらに2回連続1000点正解し、#229の条件(3問連続1000点)を満たす
    await tapCorrect(page);
    await page.waitForTimeout(150);
    const activeAfter2nd = await page.$eval(".screen.active", (el) => el.id);
    check("テストA: 2問目正解後も画面はscreen-mapのまま(新61種類による画面停止なし)", activeAfter2nd === "screen-map");
    await drainTrophyAwardScreens(page);
    await clickNext(page);

    await tapCorrect(page);
    await page.waitForTimeout(150);
    const activeAfter3rd = await page.$eval(".screen.active", (el) => el.id);
    check("テストA: #229の条件を満たす3問目正解後も通知・画面停止が発生しない(screen-mapのまま)", activeAfter3rd === "screen-map");

    check("テストA: #229が実際に獲得される(即時保存)", (await isEarned(page, "trophy_229")) === true);
    const hiddenIds = await getHiddenAwardedIdsThisPlay(page);
    check("テストA: getHiddenAwardedIdsThisPlay()で#229の新規獲得を取得できる", hiddenIds.includes("trophy_229"));

    await page.close();
  }

  // ========================================================
  // テストB: 隠しトロフィーを獲得した直後に途中中断しても、獲得状態が
  // 保持されることを確認する(保存はawardIfNewが即時に行うため、本来は
  // 画面遷移と無関係のはずだが、実際のUIの終了ボタン経路で確認する)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await startCourse(page, base, 0, 5);

    await tapCorrect(page);
    await drainTrophyAwardScreens(page);
    await clickNext(page);
    await tapCorrect(page);
    await drainTrophyAwardScreens(page);
    await clickNext(page);
    await tapCorrect(page);
    await page.waitForTimeout(150);
    check("テストB前提: #229が獲得済みになっている", (await isEarned(page, "trophy_229")) === true);

    // 終了ボタンで中断する(自前のconfirm-modal)
    await drainTrophyAwardScreens(page);
    await page.click("#findcountry-quiz-back");
    await page.waitForSelector("#confirm-modal:not(.hidden)", { timeout: 5000 });
    await page.click("#confirm-modal-yes");
    await page.waitForTimeout(300);

    check("テストB: 中断後も#229の獲得状態がTrophyModule.isEarned()で保持される", (await isEarned(page, "trophy_229")) === true);
    const stillEarnedAfterReload = await page.evaluate(() => {
      const raw = localStorage.getItem("wfq_v1_trophy_earned");
      if (!raw) return false;
      const data = JSON.parse(raw);
      return !!(data.earned && data.earned.trophy_229 && data.earned.trophy_229.earnedAt);
    });
    check("テストB: localStorageの保存データにも#229のearnedAtが残っている", stillEarnedAfterReload === true);

    await page.close();
  }

  // ========================================================
  // テストC: 途中中断では最終得点系(#195〜228)が絶対に獲得されない
  // (クリアもゲームオーバーもしていない状態で、たとえ合計得点が
  // 偶然条件に近い値になっていても判定自体が行われないことを、
  // 実際の中断操作で確認する)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await startCourse(page, base, 0, 5);

    // 5問コースのうち3問だけ正解し(クリアに届かない)、中断する
    await tapCorrect(page);
    await drainTrophyAwardScreens(page);
    await clickNext(page);
    await tapCorrect(page);
    await drainTrophyAwardScreens(page);
    await clickNext(page);
    await tapCorrect(page);
    await page.waitForTimeout(150);
    await drainTrophyAwardScreens(page);

    await page.click("#findcountry-quiz-back");
    await page.waitForSelector("#confirm-modal:not(.hidden)", { timeout: 5000 });
    await page.click("#confirm-modal-yes");
    await page.waitForTimeout(300);

    const anyFinalScoreEarned = await page.evaluate(() => {
      for (let n = 195; n <= 228; n++) {
        if (TrophyModule.isEarned("trophy_" + n)) return n;
      }
      return null;
    });
    check("テストC: 途中中断では最終得点系(#195〜228)が1件も獲得されない", anyFinalScoreEarned === null);

    await page.close();
  }

  check("全テストでコンソール/ページエラーが発生していない", consoleErrors.length === 0);
  if (consoleErrors.length) console.log("consoleErrors:", consoleErrors);

  await browser.close();
  server.close();
  console.log(`\nTotal: ${pass + fail}, Pass: ${pass}, Fail: ${fail}`);
  process.exit(fail > 0 ? 1 : 0);
})();
