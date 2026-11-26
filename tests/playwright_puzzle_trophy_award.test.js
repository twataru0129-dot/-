// ==========================================================
// 謎解きトロフィー 正式な獲得処理・獲得演出・一覧連動(第3段階)のテスト。
//
// PR #80までで完成した謎解き正解判定システム(js/puzzle.js・
// js/puzzle-judge.js・js/puzzle-questions.js)に、No.01・02・04の3問を
// 対象とした正式なトロフィー獲得処理(js/trophy.js)・豪華な獲得演出画面
// (screen-puzzle-trophy-award)・既存のトロフィー一覧画面(screen-trophy-list)
// との連動を追加した。このテストでは以下を検証する。
//
// 1. トロフィー一覧: 未獲得時は正式名称を「？？？？？」で隠し、問題文を
//    表示し、「この謎に挑む」ボタンから専用画面を開ける。正解の国旗・
//    解説文は表示しない。
// 2. 獲得後: 正式名称が公開され、獲得済みとして表示され、問題文・解説文
//    を閲覧できる。
// 3. 初回正解時だけ豪華な獲得演出画面が表示され、タップでスキップできる。
//    「トロフィーを見る」でトロフィー一覧の該当カードまで遷移・ハイライト
//    される。「閉じる」は国旗選択画面に戻る。
// 4. 獲得情報は保存され、ページを再読み込みしても保持される。再挑戦で
//    正解しても初回獲得演出は再実行されない。
// 5. 問題ごとの獲得状態は独立している。
// 6. 既存のトロフィー一覧(件数・カテゴリ・既存カードの表示)に悪影響が
//    ないこと。
// 7. iPhone・iPad・PCでのレイアウト(タップ領域・ボタン表示)。
//
// 実行方法: node tests/playwright_puzzle_trophy_award.test.js
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

async function openTrophyList(page, base, query) {
  await page.goto(query ? `${base}${query}` : base, { waitUntil: "load" });
  await page.click("#btn-trophy-list");
  await page.waitForSelector("#screen-trophy-list.active");
}

// トロフィー一覧から、?puzzleDev=1の開発用問題選択一覧経由でquestionIdの
// 謎解き問題を開く(PR#79/#80で実装済みの開発用入口をそのまま使う)
async function openPuzzleFromTrophyList(page, base, questionId) {
  await openTrophyList(page, base, "?puzzleDev=1");
  await page.click("#btn-dev-puzzle-entry");
  await page.waitForSelector(`.puzzle-dev-question-btn[data-question-id="${questionId}"]`);
  await page.click(`.puzzle-dev-question-btn[data-question-id="${questionId}"]`);
  await page.waitForSelector("#screen-puzzle-flag-select.active");
  await page.waitForTimeout(300);
}

async function solveCorrectly(page, questionId) {
  const ids = await page.evaluate((qid) => PUZZLE_QUESTIONS_BY_ID[qid].answerIds.slice(), questionId);
  for (const id of ids) {
    await page.click(`.puzzle-flag-card[data-id="${id}"]`);
  }
  await page.click("#puzzle-answer-submit");
}

function puzzleCardSelector(questionId) {
  return `#trophy-grid .trophy-card-puzzle[data-trophy-id]`;
}

async function getPuzzleCardInfo(page, questionId) {
  return page.evaluate((qid) => {
    const def = TrophyModule.getAllDefinitions().find((d) => d.puzzleQuestionId === qid);
    const card = document.querySelector(`#trophy-grid [data-trophy-id="${def.id}"]`);
    if (!card) return null;
    return {
      name: card.querySelector(".trophy-name").textContent,
      question: card.querySelector(".trophy-puzzle-question").textContent,
      hasDescription: !!card.querySelector(".trophy-description"),
      hasChallengeBtn: !!card.querySelector(".btn-puzzle-challenge"),
      earned: card.dataset.earned,
      trophyId: def.id,
    };
  }, questionId);
}

(async () => {
  const browser = await chromium.launch();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const consoleErrors = [];

  // ========================================================
  // テスト1: 未獲得時のトロフィー一覧表示(名称は隠す、問題文は見せる、
  // 解説文は見せない、「この謎に挑む」ボタンがある)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await openTrophyList(page, base);

    const info01 = await getPuzzleCardInfo(page, "puzzle-01");
    check("テスト1: 未獲得時は正式名称が「？？？？？」で隠される", info01.name === "？？？？？");
    check("テスト1: 未獲得時でも問題文は表示される", info01.question.includes("三つの食卓"));
    check("テスト1: 未獲得時は解説文を表示しない", info01.hasDescription === false);
    check("テスト1: 未獲得時は「この謎に挑む」ボタンがある", info01.hasChallengeBtn === true);
    check("テスト1: data-earnedがfalseになっている", info01.earned === "false");

    const puzzleCategoryExists = await page.evaluate(() => TrophyModule.getCategories().some((c) => c.id === "puzzle"));
    check("テスト1: カテゴリー一覧に「puzzle」が追加されている", puzzleCategoryExists === true);
    const puzzleTab = await page.$('#trophy-bucket-grid .trophy-category-chip[data-bucket="puzzle"]');
    check("テスト1: カテゴリータブに謎解きトロフィーのタブが表示される", !!puzzleTab);

    check("テスト1: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト2: 「この謎に挑む」ボタンから画面を開き、正解すると豪華な獲得
  // 演出が表示され、タップでスキップできる
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await openTrophyList(page, base);

    await page.click('#trophy-grid [data-trophy-id] .btn-puzzle-challenge');
    await page.waitForSelector("#screen-puzzle-flag-select.active");
    const questionText = await page.$eval("#puzzle-question-text", (el) => el.textContent);
    check("テスト2: 「この謎に挑む」から国旗選択画面が開く", questionText.length > 0);

    await solveCorrectly(page, "puzzle-01");
    await page.waitForSelector("#screen-puzzle-trophy-award.active", { timeout: 5000 });

    // 段階的な表示(スキップ前): 見出しは透明度0から始まるアニメーション中
    const headingOpacityBefore = await page.$eval(".puzzle-award-heading", (el) => getComputedStyle(el).animationName);
    check("テスト2: スキップ前は段階的な表示アニメーションが設定されている", headingOpacityBefore === "puzzleAwardFadeUp");

    // タップでスキップ: ボタン以外の場所をタップすると、即座に最終状態になる
    await page.click(".puzzle-award-panel", { position: { x: 10, y: 10 } });
    await page.waitForTimeout(100);
    const skipApplied = await page.$eval(".puzzle-award-panel", (el) => el.classList.contains("puzzle-award-skip"));
    check("テスト2: ボタン以外をタップすると演出がスキップされる", skipApplied === true);
    const headingVisible = await page.$eval(".puzzle-award-heading", (el) => getComputedStyle(el).opacity);
    check("テスト2: スキップ後は見出しが即座に見える状態になる", headingVisible === "1");

    const viewBtnVisible = await page.$eval("#btn-puzzle-award-view", (el) => getComputedStyle(el).opacity);
    check("テスト2: スキップ後は「トロフィーを見る」ボタンも見える状態になる", viewBtnVisible === "1");

    check("テスト2: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト3: 「トロフィーを見る」でトロフィー一覧へ遷移し、獲得済みの
  // カードが表示される(正式名称公開・獲得済み表示・問題文/解説文を
  // 閲覧できる)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await openPuzzleFromTrophyList(page, base, "puzzle-02");
    await solveCorrectly(page, "puzzle-02");
    await page.waitForSelector("#screen-puzzle-trophy-award.active", { timeout: 5000 });

    await page.click("#btn-puzzle-award-view");
    await page.waitForSelector("#screen-trophy-list.active");

    const info02 = await getPuzzleCardInfo(page, "puzzle-02");
    check("テスト3: 獲得後は正式名称「人口の双璧」が公開される", info02.name === "人口の双璧");
    check("テスト3: 獲得後はdata-earnedがtrueになる(獲得済み表示)", info02.earned === "true");
    check("テスト3: 獲得後は問題文を閲覧できる", info02.question.includes("数え切れぬ命"));
    check("テスト3: 獲得後は解説文を閲覧できる", info02.hasDescription === true);
    check("テスト3: 獲得後は「この謎に挑む」ボタンが表示されない", info02.hasChallengeBtn === false);

    // 遷移直後、該当カードにハイライト用クラスが付与されている
    const highlighted = await page.$eval(`#trophy-grid [data-trophy-id="${info02.trophyId}"]`, (el) => el.classList.contains("trophy-card-highlight"));
    check("テスト3: 「トロフィーを見る」遷移直後は対象カードがハイライトされる", highlighted === true);

    check("テスト3: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト4: 「閉じる」は国旗選択画面に戻る
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await openPuzzleFromTrophyList(page, base, "puzzle-04");
    await solveCorrectly(page, "puzzle-04");
    await page.waitForSelector("#screen-puzzle-trophy-award.active", { timeout: 5000 });
    await page.click("#btn-puzzle-award-close");
    await page.waitForSelector("#screen-puzzle-flag-select.active");
    check("テスト4: 「閉じる」で国旗選択画面に戻る", true);

    check("テスト4: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト5: 保存と再読み込み(獲得情報が保持され、再起動後も獲得済みの
  // 名称・解説文を表示する)。再挑戦で正解しても初回獲得演出は
  // 再実行されない
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await openPuzzleFromTrophyList(page, base, "puzzle-01");
    await solveCorrectly(page, "puzzle-01");
    await page.waitForSelector("#screen-puzzle-trophy-award.active", { timeout: 5000 });
    await page.click("#btn-puzzle-award-close");
    await page.waitForSelector("#screen-puzzle-flag-select.active");

    // ページを再読み込み(アプリを閉じて再起動したことに相当)
    await page.reload({ waitUntil: "load" });
    await page.click("#btn-trophy-list");
    await page.waitForSelector("#screen-trophy-list.active");
    const infoAfterReload = await getPuzzleCardInfo(page, "puzzle-01");
    check("テスト5: 再読み込み後も獲得済みのまま(正式名称が表示される)", infoAfterReload.name === "世界三大料理");
    check("テスト5: 再読み込み後も解説文を閲覧できる", infoAfterReload.hasDescription === true);

    // 再挑戦して正解しても、初回獲得演出(screen-puzzle-trophy-award)は
    // 再実行されない
    await page.click('#trophy-grid [data-trophy-id="' + infoAfterReload.trophyId + '"]');
    // 獲得済みのカードをクリックすると、UI刷新で追加された詳細モーダルが
    // 開くだけで、謎解き画面への遷移は起きない(「この謎に挑む」ボタンが
    // 無いため)。モーダルを閉じてから、開発用入口から同じ問題を開いて再挑戦する
    await page.waitForSelector("#trophy-detail-modal:not(.hidden)", { timeout: 3000 });
    await page.click("#trophy-detail-close");
    await page.waitForSelector("#trophy-detail-modal", { state: "hidden", timeout: 3000 });
    await page.click("#screen-trophy-list .btn-back");
    await page.waitForSelector("#screen-top.active");
    await openPuzzleFromTrophyList(page, base, "puzzle-01");
    await solveCorrectly(page, "puzzle-01");
    await page.waitForTimeout(300);
    const activeAfterResolve = await page.$eval(".screen.active", (el) => el.id);
    check("テスト5: 再挑戦で正解しても初回獲得演出は再実行されない", activeAfterResolve === "screen-puzzle-flag-select");
    const msgAfterResolve = await page.$eval("#puzzle-answer-message", (el) => el.textContent);
    check("テスト5: 再挑戦の正解メッセージ自体は通常どおり表示される", msgAfterResolve.includes("世界三大料理"));

    check("テスト5: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト6: 既存トロフィーへの影響がないこと(件数・カテゴリ・既存カードの
  // 表示)。世界図鑑で正解国を閲覧しただけでは獲得しないことも再確認する
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await openTrophyList(page, base);

    const totalCards = await page.$$eval("#trophy-grid .trophy-card", (els) => els.length);
    check("テスト6: トロフィー総数が452件になっている(既存286件+謎解き126件+世界7不思議9件+共通トロフィー31件)", totalCards === 452);

    const summary = await page.evaluate(() => TrophyModule.getProgressSummary());
    check("テスト6: getProgressSummary().totalCountが452になっている", summary.totalCount === 452);

    const puzzleCardCount = await page.$$eval("#trophy-grid .trophy-card-puzzle", (els) => els.length);
    check("テスト6: 謎解きトロフィーのカードが126件描画される(既存3件+謎解き118件+高難度5件)", puzzleCardCount === 126);

    // 既存の隠しトロフィー(secretLocked)の表示は変更されていない
    const secretCard = await page.$eval("#trophy-grid .trophy-card-secret .trophy-name", (el) => el.textContent);
    check("テスト6: 既存の隠しトロフィーは従来どおり「？？？？？？」(6つの？)で隠される", secretCard === "？？？？？？");

    // 世界図鑑で正解国を閲覧しただけでは獲得しない(PR#80から継続する要件)
    await page.click("#screen-trophy-list .btn-back");
    await page.waitForSelector("#screen-top.active");
    await page.click('.mode-card[data-mode="encyclopedia"]');
    await page.waitForSelector("#screen-encyclopedia-list.active");
    await page.click('.ency-card[data-id="fr"]');
    await page.waitForSelector("#screen-trophy-award.active, #screen-encyclopedia-detail.active", { timeout: 15000 });
    let active = await page.$eval(".screen.active", (el) => el.id);
    if (active === "screen-trophy-award") {
      await page.click("#btn-trophy-award-continue");
      await page.waitForTimeout(100);
    }
    const puzzle01Earned = await page.evaluate(() => {
      const def = TrophyModule.getAllDefinitions().find((d) => d.puzzleQuestionId === "puzzle-01");
      return TrophyModule.isEarned(def.id);
    });
    check("テスト6: 世界図鑑でNo.01の正解国(フランス)を閲覧しただけでは獲得しない", puzzle01Earned === false);

    check("テスト6: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト7: レスポンシブ(iPhone・iPad・PC)。「この謎に挑む」ボタン・
  // 獲得演出画面のボタンのタップ領域が44x44px以上であること
  // ========================================================
  {
    const widths = [
      { width: 390, height: 844, label: "iPhone" },
      { width: 820, height: 1180, label: "iPad" },
      { width: 1440, height: 900, label: "PC" },
    ];
    for (const w of widths) {
      const page = await newPage(browser, consoleErrors, { width: w.width, height: w.height });
      await openPuzzleFromTrophyList(page, base, "puzzle-02");

      const btnBox = await page.$eval("#puzzle-answer-submit", (el) => {
        const r = el.getBoundingClientRect();
        return { width: r.width, height: r.height };
      });
      check(`テスト7(${w.label}): 回答確定ボタンのタップ領域が44x44px以上`, btnBox.width >= 44 && btnBox.height >= 44);

      await solveCorrectly(page, "puzzle-02");
      await page.waitForSelector("#screen-puzzle-trophy-award.active", { timeout: 5000 });
      const viewBox = await page.$eval("#btn-puzzle-award-view", (el) => {
        const r = el.getBoundingClientRect();
        return { width: r.width, height: r.height };
      });
      check(`テスト7(${w.label}): 「トロフィーを見る」ボタンのタップ領域が44x44px以上`, viewBox.width >= 44 && viewBox.height >= 44);
      const closeBox = await page.$eval("#btn-puzzle-award-close", (el) => {
        const r = el.getBoundingClientRect();
        return { width: r.width, height: r.height };
      });
      check(`テスト7(${w.label}): 「閉じる」ボタンのタップ領域が44x44px以上`, closeBox.width >= 44 && closeBox.height >= 44);

      await page.close();
    }
    check("テスト7: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
  }

  await browser.close();
  server.close();

  console.log("\nTotal:", pass + fail, "Pass:", pass, "Fail:", fail);
  process.exit(fail > 0 ? 1 : 0);
})();
