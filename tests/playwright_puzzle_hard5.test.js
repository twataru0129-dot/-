// ==========================================================
// 通常の高難度謎解き5問追加(trophyNumber 381〜385)の実ブラウザテスト。
// 既存の謎解きトロフィー(既存3問・謎解き118問)の正解判定・獲得演出
// (playwright_puzzle_trophy_award.test.js等で検証済み)をそのまま再利用
// している前提で、今回追加した5問に固有の挙動だけを検証する。
//
// 1. 5問とも実クリックで正解すると、既存と同一の獲得演出
//    (#screen-puzzle-trophy-award)が表示され、トロフィーが獲得される。
// 2. 不正解では獲得演出が表示されず、トロフィーも獲得されない。
// 3. 複数国問題(hard-01・hard-04・hard-05)は、過不足なく正解国を選んだ
//    場合のみ正解になる。
// 4. 正解の国旗を別の問題で入力しても、別のトロフィーが誤解放されない。
// 5. 獲得後は再読み込みしても獲得状態が保持される。
// 6. No.385「歴史の分岐点」の数字の図が、トロフィー一覧の詳細(挑戦前)と
//    回答画面の両方で、説明文なしに正しく表示され、iPhone/iPad/PCで
//    崩れない(横スクロールが発生しない)。
//
// 実行方法: node tests/playwright_puzzle_hard5.test.js
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

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass += 1; console.log("PASS:", name); }
  else { fail += 1; console.log("FAIL:", name); }
}

async function newPage(browser, consoleErrors, viewport) {
  const page = await browser.newPage(viewport ? { viewport } : { viewport: { width: 390, height: 844 } });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  return page;
}

async function openPuzzleFromTrophyList(page, base, questionId) {
  await page.goto(`${base}?puzzleDev=1`, { waitUntil: "load" });
  await page.click("#btn-trophy-list");
  await page.waitForSelector("#screen-trophy-list.active");
  await page.click("#btn-dev-puzzle-entry");
  await page.waitForSelector(`.puzzle-dev-question-btn[data-question-id="${questionId}"]`);
  await page.click(`.puzzle-dev-question-btn[data-question-id="${questionId}"]`);
  await page.waitForSelector("#screen-puzzle-flag-select.active");
  await page.waitForTimeout(300);
}

async function clickFlags(page, ids) {
  for (const id of ids) {
    await page.click(`.puzzle-flag-card[data-id="${id}"]`);
  }
}

async function submitAndGetState(page) {
  await page.click("#puzzle-answer-submit");
  await page.waitForTimeout(300);
  const activeId = await page.$eval(".screen.active", (el) => el.id);
  return { activeId };
}

(async () => {
  const browser = await chromium.launch();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const consoleErrors = [];

  const CASES = [
    { id: "puzzle-hard-01", trophyNumber: 381, name: "国境の無限迷宮", correct: ["om", "ae"] },
    { id: "puzzle-hard-02", trophyNumber: 382, name: "三つの鍵と小さな王国", correct: ["mc"] },
    { id: "puzzle-hard-03", trophyNumber: 383, name: "時の消失点", correct: ["ws"] },
    { id: "puzzle-hard-04", trophyNumber: 384, name: "三旗が支配する島", correct: ["id", "my", "bn"] },
    { id: "puzzle-hard-05", trophyNumber: 385, name: "歴史の分岐点", correct: ["de", "cz", "sk"] },
  ];

  // ========================================================
  // テスト1: 5問とも実クリックで正解すると、既存と同一の獲得演出が
  // 表示され、トロフィーが獲得される
  // ========================================================
  for (const c of CASES) {
    const page = await newPage(browser, consoleErrors);
    await openPuzzleFromTrophyList(page, base, c.id);
    await clickFlags(page, c.correct);
    const { activeId } = await submitAndGetState(page);
    check(`テスト1[${c.id}]: 正解すると既存と同一の獲得演出画面になる`, activeId === "screen-puzzle-trophy-award");
    const awardName = await page.$eval("#puzzle-award-name", (el) => el.textContent).catch(() => "");
    check(`テスト1[${c.id}]: 獲得演出に正式名称「${c.name}」が表示される`, awardName === c.name);
    const earned = await page.evaluate((n) => TrophyModule.isEarned(`trophy_${n}`), c.trophyNumber);
    check(`テスト1[${c.id}]: トロフィーが実際に獲得される`, earned === true);
    check(`テスト1[${c.id}]: コンソール/ページエラーが発生していない`, consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト2: 不正解(不足・余分)では獲得演出が表示されず、トロフィーも
  // 獲得されない
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await openPuzzleFromTrophyList(page, base, "puzzle-hard-04");
    await clickFlags(page, ["id", "my"]); // 1件不足
    const { activeId } = await submitAndGetState(page);
    check("テスト2: 不足した選択では獲得演出に進まない(国旗選択画面のまま)", activeId === "screen-puzzle-flag-select");
    const earned = await page.evaluate(() => TrophyModule.isEarned("trophy_384"));
    check("テスト2: 不正解ではトロフィーが獲得されない", earned === false);
    const msg = await page.$eval("#puzzle-answer-message", (el) => el.textContent);
    check("テスト2: 既存と同じ不正解メッセージが表示される", msg === "しかし、何も起こらなかった……");

    await page.click("#puzzle-answer-clear");
    await clickFlags(page, ["id", "my", "bn", "ph"]); // 1件余分
    const result2 = await submitAndGetState(page);
    check("テスト2: 余分な選択でも不正解になる", result2.activeId === "screen-puzzle-flag-select");

    check("テスト2: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト3: 正解の国旗を別の問題で入力しても、別のトロフィーが
  // 誤解放されない(hard-03挑戦中にhard-02の正解国(mc)を入れる)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await openPuzzleFromTrophyList(page, base, "puzzle-hard-03");
    await clickFlags(page, ["mc"]);
    const { activeId } = await submitAndGetState(page);
    check("テスト3: 他問題の正解国を入力しても不正解になる(問題IDの独立性)", activeId === "screen-puzzle-flag-select");
    const earnedHard02 = await page.evaluate(() => TrophyModule.isEarned("trophy_382"));
    const earnedHard03 = await page.evaluate(() => TrophyModule.isEarned("trophy_383"));
    check("テスト3: hard-02のトロフィーは誤って解放されない", earnedHard02 === false);
    check("テスト3: hard-03のトロフィーも獲得されない(不正解のため)", earnedHard03 === false);

    check("テスト3: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト4: 獲得後は再読み込みしても獲得状態が保持される
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await openPuzzleFromTrophyList(page, base, "puzzle-hard-01");
    await clickFlags(page, ["om", "ae"]);
    await submitAndGetState(page);
    await page.waitForSelector("#screen-puzzle-trophy-award.active", { timeout: 5000 });
    await page.click("#btn-puzzle-award-close");

    await page.reload({ waitUntil: "load" });
    const earnedAfterReload = await page.evaluate(() => TrophyModule.isEarned("trophy_381"));
    check("テスト4: 再読み込み後もトロフィーの獲得状態が保持される", earnedAfterReload === true);

    check("テスト4: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト5: No.385「歴史の分岐点」の数字の図が、トロフィー一覧の詳細
  // (挑戦前)と回答画面の両方で正しく表示され、説明文を含まない
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await page.goto(base, { waitUntil: "load" });
    await page.click("#btn-trophy-list");
    await page.waitForSelector("#screen-trophy-list.active");
    const cardText = await page.$eval(
      '#trophy-grid [data-trophy-id="trophy_385"] .trophy-puzzle-question',
      (el) => el.textContent
    );
    check("テスト5: トロフィー一覧の詳細(挑戦前)に図の年号が表示される", ["1949", "1990", "1918", "1993"].every((y) => cardText.includes(y)));
    check("テスト5: トロフィー一覧の詳細に説明文(歴史的な出来事の明示)が含まれない", !/ドイツ|チェコ|スロバキア/.test(cardText));

    check("テスト5: コンソール/ページエラーが発生していない(一覧表示側)", consoleErrors.length === 0);
    await page.close();
  }

  const viewports = [
    { label: "iPhone", viewport: { width: 390, height: 844 } },
    { label: "iPad", viewport: { width: 820, height: 1180 } },
    { label: "PC", viewport: { width: 1280, height: 800 } },
  ];
  for (const { label, viewport } of viewports) {
    const page = await newPage(browser, consoleErrors, viewport);
    await openPuzzleFromTrophyList(page, base, "puzzle-hard-05");

    // 折りたたみが必要な場合は展開して全文(4行)を表示する(既存の
    // 「続きを読む」仕組みをそのまま使う)
    const toggleHidden = await page.$eval("#puzzle-question-toggle", (el) => el.classList.contains("hidden"));
    if (!toggleHidden) {
      await page.click("#puzzle-question-toggle");
      await page.waitForTimeout(100);
    }
    const questionText = await page.$eval("#puzzle-question-text", (el) => el.textContent);
    check(`テスト5(${label}): 回答画面に図の年号・矢印がすべて表示される`, ["1949", "1990", "1918", "1993"].every((y) => questionText.includes(y)) && (questionText.match(/→/g) || []).length === 4);
    const noOverflow = await page.$eval("#puzzle-question-text", (el) => el.scrollWidth <= el.clientWidth + 1);
    check(`テスト5(${label}): 図が横に溢れず折り返される`, noOverflow === true);
    const noHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
    check(`テスト5(${label}): ページ全体に横スクロールが発生していない`, noHorizontalScroll === true);

    await clickFlags(page, ["de", "cz", "sk"]);
    const { activeId } = await submitAndGetState(page);
    // newPage()はページごとに新しいブラウザコンテキスト(ストレージも
    // 分離)を作るため、各ビューポートで必ず初回正解の獲得演出になる
    check(`テスト5(${label}): 正解すると獲得演出に進む`, activeId === "screen-puzzle-trophy-award");

    check(`テスト5(${label}): コンソール/ページエラーが発生していない`, consoleErrors.length === 0);
    await page.close();
  }

  await browser.close();
  server.close();

  console.log(`\nTotal: ${pass + fail} Pass: ${pass} Fail: ${fail}`);
  process.exit(fail > 0 ? 1 : 0);
})();
