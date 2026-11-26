// ==========================================================
// PR #89 第4回④: 謎解き挑戦画面からトロフィー一覧への戻り導線・状態復元のテスト
//
// 対象: トロフィー一覧(一覧カード・詳細モーダルいずれか)から謎解き挑戦画面
// (#screen-puzzle-flag-select)へ入り、#btn-puzzle-backで戻る導線。
// 以下を確認する。
//   - 一覧カードから挑戦し、未回答のまま「戻る」で一覧に戻ると、カテゴリー・
//     絞り込み・検索語・スクロール位置が復元される
//   - 詳細モーダルの「この謎に挑む」から挑戦した場合も同様に戻れ、モーダルは
//     戻った時点で閉じている
//   - 正解して獲得演出を「閉じる」→挑戦画面→「戻る」の経路でも同様に戻り、
//     新しく獲得したトロフィーの状態(獲得済みマーク)がすぐに反映される
//   - 獲得直後の状態が現在の絞り込み(例:「未獲得」フィルター)で除外される
//     場合は、無理に表示せず、絞り込みはそのまま維持し、挑戦前のおおよその
//     スクロール位置に戻すだけに留める
//   - 「トロフィーを見る」(既存の獲得演出からの別経路)で一覧に移動した後は、
//     記録が残らない(次に世界7不思議などの別の挑戦を始めても、古い戻り先
//     情報で一覧へ誤って戻ったりしない)
//   - 世界7不思議の専用挑戦画面(#screen-puzzle-flag-selectを共有)は、
//     この変更の影響を受けず、「戻る」で従来どおりトップ画面
//     (screen-top)へ戻る
//   - 開発用入口(#btn-dev-puzzle-entry)経由の挑戦も、トロフィー一覧を
//     経由していないため、従来どおりトップ画面へ戻る
//
// 実行方法: node tests/playwright_puzzle_back_navigation.test.js
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

async function newPage(browser, consoleErrors, viewport) {
  const page = await browser.newPage({ viewport: viewport || { width: 390, height: 844 } });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  return page;
}

async function gotoTrophyList(page, base) {
  await page.goto(`${base}?puzzleDev=1`, { waitUntil: "load" });
  await page.waitForSelector("#screen-top.active");
  await page.click("#btn-trophy-list");
  await page.waitForSelector("#screen-trophy-list.active");
}

async function answerQuestion(page, questionId) {
  await page.waitForSelector("#screen-puzzle-flag-select.active");
  const ids = await page.evaluate((qid) => PUZZLE_QUESTIONS_BY_ID[qid].answerIds.slice(), questionId);
  for (const id of ids) {
    await page.click(`.puzzle-flag-card[data-id="${id}"]`);
  }
  await page.click("#puzzle-answer-submit");
  await page.waitForSelector("#screen-puzzle-trophy-award.active", { timeout: 5000 });
  await page.click("#btn-puzzle-award-close");
  await page.waitForSelector("#screen-puzzle-flag-select.active");
}

(async () => {
  const browser = await chromium.launch();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const consoleErrors = [];

  // ========================================================
  // テスト1: 一覧カードから挑戦→未回答のまま「戻る」で、絞り込み・検索語・
  // スクロール位置が復元される
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await gotoTrophyList(page, base);
    await page.click('.trophy-category-chip[data-bucket="puzzle"]');
    await page.waitForTimeout(100);

    const def01 = await page.evaluate(() => TrophyModule.getAllDefinitions().find((d) => d.puzzleQuestionId === "puzzle-01").id);
    // 未獲得のためトロフィー名は「？？？？？」に伏せられ検索対象にならないので、
    // 検索条件には常に表示される番号(.trophy-number)の一部を使う
    const numberText = await page.evaluate((id) => document.querySelector(`#trophy-grid [data-trophy-id="${id}"] .trophy-number`).textContent, def01);
    await page.fill("#trophy-search-input", numberText);
    await page.waitForTimeout(100);
    const visible = await page.evaluate((id) => !document.querySelector(`#trophy-grid [data-trophy-id="${id}"]`).classList.contains("hidden"), def01);
    check("テスト1: 前提確認(番号での検索で対象カードが表示されている)", visible === true);

    await page.evaluate((id) => document.querySelector(`#trophy-grid [data-trophy-id="${id}"]`).scrollIntoView({ block: "center" }), def01);
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.evaluate((id) => document.querySelector(`#trophy-grid [data-trophy-id="${id}"] .btn-puzzle-challenge`).click(), def01);
    await page.waitForSelector("#screen-puzzle-flag-select.active");

    await page.click("#btn-puzzle-back");
    await page.waitForSelector("#screen-trophy-list.active");
    await page.waitForTimeout(300);

    const info = await page.evaluate(() => ({
      topBucket: state.trophyListFilter.topBucket,
      search: state.trophyListFilter.search,
      searchInputValue: document.getElementById("trophy-search-input").value,
      scrollY: window.scrollY,
    }));
    check("テスト1: 上位分類(謎解き)の絞り込みが維持されている", info.topBucket === "puzzle");
    check("テスト1: 検索語が維持されている", info.search === numberText);
    check("テスト1: 検索入力欄にも検索語が復元されている", info.searchInputValue === numberText);
    check("テスト1: スクロール位置がおおよそ元の位置に復元されている(±400px)", Math.abs(info.scrollY - scrollBefore) < 400);

    check("テスト1: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト2: 詳細モーダルの「この謎に挑む」から挑戦した場合も同様に戻れ、
  // モーダルは戻った時点で閉じている
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await gotoTrophyList(page, base);
    const def04 = await page.evaluate(() => TrophyModule.getAllDefinitions().find((d) => d.puzzleQuestionId === "puzzle-04").id);
    await page.evaluate((id) => document.querySelector(`#trophy-grid [data-trophy-id="${id}"]`).click(), def04);
    await page.waitForSelector("#trophy-detail-modal:not(.hidden)");
    await page.click("#trophy-detail-body .btn-puzzle-challenge");
    await page.waitForSelector("#screen-puzzle-flag-select.active");
    const modalHiddenDuringChallenge = await page.evaluate(() => document.getElementById("trophy-detail-modal").classList.contains("hidden"));
    check("テスト2: 挑戦画面へ遷移した時点でモーダルは閉じている", modalHiddenDuringChallenge === true);

    await page.click("#btn-puzzle-back");
    await page.waitForSelector("#screen-trophy-list.active");
    const modalHiddenAfterBack = await page.evaluate(() => document.getElementById("trophy-detail-modal").classList.contains("hidden"));
    check("テスト2: 一覧に戻った後もモーダルは閉じたまま", modalHiddenAfterBack === true);

    check("テスト2: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト3: 正解→獲得演出「閉じる」→挑戦画面→「戻る」の経路でも一覧に
  // 戻り、新しく獲得したトロフィーの状態がすぐに反映される(ハイライトも
  // 表示される)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await gotoTrophyList(page, base);
    const def02 = await page.evaluate(() => TrophyModule.getAllDefinitions().find((d) => d.puzzleQuestionId === "puzzle-02").id);
    await page.evaluate((id) => document.querySelector(`#trophy-grid [data-trophy-id="${id}"] .btn-puzzle-challenge`).click(), def02);
    await answerQuestion(page, "puzzle-02");
    await page.click("#btn-puzzle-back");
    await page.waitForSelector("#screen-trophy-list.active");
    // カードが一覧の下の方にあると、prefers-reduced-motionが無効な環境では
    // smoothスクロールのアニメーションに時間がかかるため、十分な時間を待つ
    await page.waitForTimeout(1500);

    const info = await page.evaluate((id) => {
      const card = document.querySelector(`#trophy-grid [data-trophy-id="${id}"]`);
      return {
        earned: card.dataset.earned,
        hasHighlight: card.classList.contains("trophy-card-highlight"),
        inViewport: card.getBoundingClientRect().top < window.innerHeight && card.getBoundingClientRect().bottom > 0,
      };
    }, def02);
    check("テスト3: 正解した謎解きトロフィーが即座に獲得済み状態になっている", info.earned === "true");
    check("テスト3: 獲得したカードが画面内に見える位置にある", info.inViewport === true);
    check("テスト3: 獲得したカードがハイライトされている", info.hasHighlight === true);

    check("テスト3: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト4: 獲得直後の状態が現在の絞り込み(「未獲得」フィルター)で除外
  // される場合、無理に表示せず絞り込みを維持する
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await gotoTrophyList(page, base);
    await page.click('.trophy-category-chip[data-bucket="puzzle"]');
    await page.click('#trophy-status-filter .trophy-status-btn[data-status="locked"]');
    await page.waitForTimeout(100);

    const def01 = await page.evaluate(() => TrophyModule.getAllDefinitions().find((d) => d.puzzleQuestionId === "puzzle-01").id);
    await page.evaluate((id) => document.querySelector(`#trophy-grid [data-trophy-id="${id}"] .btn-puzzle-challenge`).click(), def01);
    await answerQuestion(page, "puzzle-01");
    await page.click("#btn-puzzle-back");
    await page.waitForSelector("#screen-trophy-list.active");
    await page.waitForTimeout(300);

    const info = await page.evaluate((id) => {
      const card = document.querySelector(`#trophy-grid [data-trophy-id="${id}"]`);
      return {
        status: state.trophyListFilter.status,
        earned: card.dataset.earned,
        hiddenByFilter: card.classList.contains("hidden"),
      };
    }, def01);
    check("テスト4: 「未獲得」フィルターが維持されている(自動で「すべて」等に変更されない)", info.status === "locked");
    check("テスト4: トロフィーは獲得済みになっている", info.earned === "true");
    check("テスト4: 獲得済みになったことで「未獲得」フィルターにより非表示になっている(無理に表示していない)", info.hiddenByFilter === true);

    check("テスト4: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト5: 「トロフィーを見る」経路で一覧に移動した後は戻り先情報が
  // 残らず、その後の世界7不思議の挑戦には影響しない
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await gotoTrophyList(page, base);
    const def01 = await page.evaluate(() => TrophyModule.getAllDefinitions().find((d) => d.puzzleQuestionId === "puzzle-01").id);
    await page.evaluate((id) => document.querySelector(`#trophy-grid [data-trophy-id="${id}"] .btn-puzzle-challenge`).click(), def01);
    await page.waitForSelector("#screen-puzzle-flag-select.active");
    const ids = await page.evaluate(() => PUZZLE_QUESTIONS_BY_ID["puzzle-01"].answerIds.slice());
    for (const id of ids) { await page.click(`.puzzle-flag-card[data-id="${id}"]`); }
    await page.click("#puzzle-answer-submit");
    await page.waitForSelector("#screen-puzzle-trophy-award.active", { timeout: 5000 });
    await page.click("#btn-puzzle-award-view");
    await page.waitForSelector("#screen-trophy-list.active");

    const contextAfterView = await page.evaluate(() => state.puzzleReturnContext);
    check("テスト5: 「トロフィーを見る」経路後は戻り先情報が残っていない", contextAfterView === null || contextAfterView === undefined);

    // 残りの謎解き問題を全て正解済みにし、世界7不思議を解放する
    await page.evaluate(() => {
      const defs = TrophyModule.getAllDefinitions().filter((d) => d.category === "puzzle" && d.puzzleQuestionId && d.puzzleQuestionId !== "puzzle-01");
      defs.forEach((d) => TrophyModule.evaluatePuzzleAnswer({ questionId: d.puzzleQuestionId, correct: true }));
    });
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector("#screen-top.active");
    await page.click("#btn-trophy-list");
    await page.waitForSelector("#screen-trophy-list.active");
    await page.click('.trophy-category-chip[data-bucket="sevenWonders"]');
    await page.waitForTimeout(100);

    const swQuestionId = await page.evaluate(() => SEVEN_WONDERS_QUESTIONS[0].id);
    const swDefId = await page.evaluate((qid) => TrophyModule.getAllDefinitions().find((d) => d.puzzleQuestionId === qid).id, swQuestionId);
    await page.evaluate((id) => document.querySelector(`#trophy-grid [data-trophy-id="${id}"] .btn-sevenwonder-challenge`).click(), swDefId);
    await page.waitForSelector("#screen-puzzle-flag-select.active");

    const contextAtSw = await page.evaluate(() => state.puzzleReturnContext);
    check("テスト5: 世界7不思議の挑戦画面では戻り先情報が設定されていない", contextAtSw === null || contextAtSw === undefined);

    await page.click("#btn-puzzle-back");
    await page.waitForSelector("#screen-top.active");
    check("テスト5: 世界7不思議の「戻る」は従来どおりトップ画面へ戻る(影響を受けていない)", true);

    check("テスト5: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト6: 開発用入口(#btn-dev-puzzle-entry)経由の挑戦は、トロフィー
  // 一覧を経由していないため、従来どおりトップ画面へ戻る
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await gotoTrophyList(page, base);
    await page.click("#btn-dev-puzzle-entry");
    await page.waitForSelector('.puzzle-dev-question-btn[data-question-id="puzzle-01"]');
    await page.click('.puzzle-dev-question-btn[data-question-id="puzzle-01"]');
    await page.waitForSelector("#screen-puzzle-flag-select.active");
    await page.click("#btn-puzzle-back");
    await page.waitForSelector("#screen-top.active");
    check("テスト6: 開発用入口経由の「戻る」は従来どおりトップ画面へ戻る", true);

    check("テスト6: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  await browser.close();
  server.close();

  console.log("\nTotal:", pass + fail, "Pass:", pass, "Fail:", fail);
  process.exit(fail > 0 ? 1 : 0);
})();
