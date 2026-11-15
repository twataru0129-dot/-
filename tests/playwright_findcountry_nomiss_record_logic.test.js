// ==========================================================
// 隠しトロフィー61種類実装(第1段階): ノーミスの正式定義
// (開始から終了まで一度もライフが減らないこと)と、ノーミスクリア・
// 満点クリアの区別、プレイ終了理由の判定基盤を、実際のゲーム処理経路
// (FindCountryModule.simulateTapForTest = 本番のhandleTapと同一関数)を
// 通して検証する。
//
// 以前のnoMistakes判定は「quizState.results全件が"correct"かどうか」を
// 見ていたが、不正解→再挑戦→正解の問題はresults[]に最終結果("correct")
// だけが記録される(再挑戦中の不正解自体はresults[]に残らない)ため、
// ライフを1個以上失っていても誤ってノーミス扱いになっていた
// (js/findcountry.jsのlifeLostThisPlayフラグで修正)。このテストは
// その不具合が実際の処理経路で再現すること・修正後に正しく判定される
// ことの両方を確認する。
//
// 実行方法: node tests/playwright_findcountry_nomiss_record_logic.test.js
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

// difficultyIndex: 0=初級 1=中級 2=上級 3=PRO(DIFFICULTIES配列の順序どおり)
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

// 不正解→「もう一度さがす」→同じ問題に正解、という再挑戦1往復(ライフは1個
// 減ったまま回復しない確定仕様)。実際のhandleWrongTap/handleRetryClickの
// 経路をそのまま通す
async function tapWrongThenRetryCorrect(page) {
  const correctId = await page.evaluate(() => FindCountryModule.getCurrentCountryId());
  await tapWrong(page);
  await page.waitForSelector("#findcountry-quiz-retry:not(.hidden)", { timeout: 5000 });
  await page.click("#findcountry-quiz-retry");
  await page.waitForTimeout(100);
  await page.evaluate((id) => FindCountryModule.simulateTapForTest(id), correctId);
}

async function tapPass(page) {
  await page.click("#findcountry-quiz-pass");
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
// 進める(名前入力・トロフィー獲得通知が挟まっても自動で抜ける)。
// No.159「地図への第一歩」のようなmid-play即時通知は地図画面を覆って
// 「次の問題へ」ボタンを隠すため、必ずclickNextの前にdrainする
async function answerCorrectAndAdvance(page) {
  await tapCorrect(page);
  await page.waitForTimeout(150);
  await drainTrophyAwardScreens(page);
  await clickNext(page);
  await proceedPastNameEntryIfShown(page);
  await drainTrophyAwardScreens(page);
}

// globe.gl(3D地球儀)はページ内で最初に開いたときだけ初期化コストが
// かかり、その間も制限時間タイマー自体は動き続けるため、満点(1,000点=
// 3.00秒以内)を要求するテストではこのコールドスタート分が最初の1問だけ
// 不自然に遅くなってしまう。本番の実際のプレイ体験(アプリを開いてから
// 数秒待って操作する)とは無関係な、ヘッドレスブラウザのテスト実行環境
// 固有の初期化コストを測定対象から除くため、使い捨てのプレイを1回行って
// 地球儀を温めてから本来のテストを開始する
async function warmUpGlobe(page) {
  for (let i = 0; i < 5; i++) await answerCorrectAndAdvance(page);
  await page.click("#btn-findcountry-result-retry");
  await page.waitForSelector("#screen-map.findcountry-mode", { timeout: 15000 });
  await page.waitForTimeout(300);
}

async function readLastPlayRecord(page) {
  return page.evaluate(() => FindCountryModule.getLastPlayRecordForTest());
}

async function readNoMissProgress(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem("wfq_v1_findcountry_nomiss_progress");
    return raw ? JSON.parse(raw) : null;
  });
}

async function readClearProgress(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem("wfq_v1_findcountry_progress");
    return raw ? JSON.parse(raw) : null;
  });
}

(async () => {
  const consoleErrors = [];
  const browser = await chromium.launch();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/`;

  // ========================================================
  // テスト1: 全問初回正解 → ノーミス(beginner_5)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await startCourse(page, base, 0, 5);
    for (let i = 0; i < 5; i++) await answerCorrectAndAdvance(page);

    const record = await readLastPlayRecord(page);
    check("テスト1: 全問初回正解でnoMistakes===true", record && record.noMistakes === true);
    check("テスト1: ノーミスクリアとしても成立する(noMissClear===true)", record && record.noMissClear === true);

    const noMissProgress = await readNoMissProgress(page);
    check("テスト1: ノーミスクリア記録にbeginner_5が保存される", !!(noMissProgress && noMissProgress.noMissClearedCourses && noMissProgress.noMissClearedCourses.beginner_5));

    await page.close();
  }

  // ========================================================
  // テスト2: 誤答後に正解 → ノーミスではない(beginner_5、Q1だけ誤答→再挑戦)
  // (このテストが無かった場合、旧ロジックではresults[]の最終結果が
  // "correct"のみになるため誤ってノーミス扱いになっていた)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await startCourse(page, base, 0, 5);

    await tapWrongThenRetryCorrect(page);
    await page.waitForTimeout(150);
    await drainTrophyAwardScreens(page);
    await clickNext(page);
    await proceedPastNameEntryIfShown(page);
    await drainTrophyAwardScreens(page);
    for (let i = 0; i < 4; i++) await answerCorrectAndAdvance(page);

    const record = await readLastPlayRecord(page);
    check("テスト2: 誤答→再挑戦正解した場合、noMistakes===false(修正の直接確認)", record && record.noMistakes === false);
    check("テスト2: ノーミスクリアでもない(noMissClear===false)", record && record.noMissClear === false);

    const noMissProgress = await readNoMissProgress(page);
    check("テスト2: ノーミスクリア記録にbeginner_5は保存されない", !(noMissProgress && noMissProgress.noMissClearedCourses && noMissProgress.noMissClearedCourses.beginner_5));

    const clearProgress = await readClearProgress(page);
    check("テスト2: 通常のクリア記録(ノーミスとは無関係)は正常に保存される(既存機能への影響なし)", !!(clearProgress && clearProgress.clearedCourses && clearProgress.clearedCourses.beginner_5));

    await page.close();
  }

  // ========================================================
  // テスト3: パス後に継続 → ノーミスではない(beginner_5、Q1をパス)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await startCourse(page, base, 0, 5);

    await tapPass(page);
    await page.waitForTimeout(150);
    await clickNext(page);
    await proceedPastNameEntryIfShown(page);
    await drainTrophyAwardScreens(page);
    // パスは正解数に数えないため、目標の5正解に達するまで正解を続ける
    // (出題対象は動的に追加されるため、クリアまで繰り返す)
    for (let i = 0; i < 10; i++) {
      const active = await page.$eval(".screen.active", (el) => el.id).catch(() => null);
      if (active !== "screen-map") break;
      await answerCorrectAndAdvance(page);
    }

    const record = await readLastPlayRecord(page);
    check("テスト3: パス後に継続した場合、noMistakes===false", record && record.noMistakes === false);
    const noMissProgress = await readNoMissProgress(page);
    check("テスト3: ノーミスクリア記録にbeginner_5は保存されない", !(noMissProgress && noMissProgress.noMissClearedCourses && noMissProgress.noMissClearedCourses.beginner_5));
    const clearProgress = await readClearProgress(page);
    check("テスト3: 通常のクリア記録は正常に保存される", !!(clearProgress && clearProgress.clearedCourses && clearProgress.clearedCourses.beginner_5));

    await page.close();
  }

  // ========================================================
  // テスト4: 時間切れ後に継続 → ノーミスではない(advanced_5、Q1を時間切れ)
  // page.clock(仮想時間)のfastForwardは、globe.gl側のアニメーション
  // ループが時間のジャンプに追従できず「次の問題へ」ボタンの実寸が
  // 0x0になってしまう(テスト環境固有の副作用、本番では時間が常に連続的に
  // 進むため発生しない)ため使わず、実際の制限時間(上級20秒)を実時間で
  // 待つ(本番と同じ経路で時間切れを発生させるための確実な方法)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await startCourse(page, base, 2, 5); // 上級(制限時間20秒)

    await page.waitForTimeout(21000);
    const resultText = await page.textContent("#findcountry-quiz-result-text");
    check("テスト4: 制限時間超過で時間切れ表示になる", (resultText || "").includes("時間切れ"));
    await drainTrophyAwardScreens(page);
    await clickNext(page);
    await proceedPastNameEntryIfShown(page);
    await drainTrophyAwardScreens(page);
    for (let i = 0; i < 10; i++) {
      const active = await page.$eval(".screen.active", (el) => el.id).catch(() => null);
      if (active !== "screen-map") break;
      await answerCorrectAndAdvance(page);
    }

    const record = await readLastPlayRecord(page);
    check("テスト4: 時間切れ後に継続した場合、noMistakes===false", record && record.noMistakes === false);
    const noMissProgress = await readNoMissProgress(page);
    check("テスト4: ノーミスクリア記録にadvanced_5は保存されない", !(noMissProgress && noMissProgress.noMissClearedCourses && noMissProgress.noMissClearedCourses.advanced_5));

    await page.close();
  }

  // ========================================================
  // テスト5: 満点でクリア → 満点クリア(beginner_5、全問即タップで3秒以内)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await startCourse(page, base, 0, 5);
    await warmUpGlobe(page); // 地球儀のコールドスタート分を本来の計測から除く
    for (let i = 0; i < 5; i++) await answerCorrectAndAdvance(page);

    const record = await readLastPlayRecord(page);
    const allPerfectPoints = record && record.results.every((r) => r.points === 1000);
    check("テスト5: 即タップにより全問1,000点になっている(前提確認)", allPerfectPoints === true);
    check("テスト5: 満点クリアと判定される(perfectClear===true)", record && record.perfectClear === true);

    await page.close();
  }

  // ========================================================
  // テスト6: 途中で誤答し、最終得点だけ満点相当になった場合 → 満点クリアではない
  // (beginner_5、Q1だけ誤答→再挑戦即正解。再挑戦後の正解も即タップのため
  // その問題自体の得点は1,000点になり得るが、ライフを失っている時点で
  // noMissClearそのものが成立しないため、得点の一致だけでは満点クリアに
  // ならないことを確認する)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await startCourse(page, base, 0, 5);

    await tapWrongThenRetryCorrect(page);
    await page.waitForTimeout(150);
    await drainTrophyAwardScreens(page);
    await clickNext(page);
    await proceedPastNameEntryIfShown(page);
    await drainTrophyAwardScreens(page);
    for (let i = 0; i < 4; i++) await answerCorrectAndAdvance(page);

    const record = await readLastPlayRecord(page);
    check("テスト6: 誤答→再挑戦クリアは満点クリアではない(perfectClear===false)", record && record.perfectClear === false);
    check("テスト6: そもそもノーミスクリアでもない(noMissClear===false)", record && record.noMissClear === false);

    await page.close();
  }

  // ========================================================
  // テスト7: ライフが0になった場合 → ゲームオーバー(beginner_5、5回連続誤答)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await startCourse(page, base, 0, 5);

    for (let i = 0; i < 4; i++) {
      await tapWrong(page);
      await page.waitForSelector("#findcountry-quiz-retry:not(.hidden)", { timeout: 5000 });
      await page.click("#findcountry-quiz-retry");
      await page.waitForTimeout(100);
    }
    // 5回目(ライフ最後の1個)の誤答でゲームオーバーになる
    await tapWrong(page);
    await page.waitForTimeout(200);
    const resultText = await page.textContent("#findcountry-quiz-result-text");
    check("テスト7: ライフ0でゲームオーバーの不正解表示になる", (resultText || "").includes("まちがえ"));
    await clickNext(page);
    await proceedPastNameEntryIfShown(page);
    await drainTrophyAwardScreens(page);

    const record = await readLastPlayRecord(page);
    check("テスト7: endReasonが'gameover'になる", record && record.endReason === "gameover");
    check("テスト7: ゲームオーバーもノーミスではない", record && record.noMistakes === false);
    const clearProgress = await readClearProgress(page);
    check("テスト7: ゲームオーバーではクリア記録が保存されない(既存仕様どおり)", !(clearProgress && clearProgress.clearedCourses && clearProgress.clearedCourses.beginner_5));

    await page.close();
  }

  // ========================================================
  // テスト8: 途中中断 → クリア扱いにしない(beginner_5、1問正解した状態で中断)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await startCourse(page, base, 0, 5);
    await tapCorrect(page);
    await page.waitForTimeout(150);
    // No.159「地図への第一歩」のmid-play通知が地図画面を覆うため、
    // 終了ボタンを押す前に必ず閉じておく
    await drainTrophyAwardScreens(page);

    // 「終了する」ボタン(確認ダイアログはpage.on("dialog")で自動的に承諾)
    await page.click("#findcountry-quiz-back");
    await page.waitForTimeout(300);
    const activeScreen = await page.$eval(".screen.active", (el) => el.id);
    check("テスト8: 中断すると難易度/問題数選択画面へ戻る(結果画面を経由しない)", activeScreen === "screen-findcountry-count" || activeScreen === "screen-findcountry-difficulty");

    const clearProgress = await readClearProgress(page);
    check("テスト8: 中断した場合はクリア記録が保存されない", !(clearProgress && clearProgress.clearedCourses && clearProgress.clearedCourses.beginner_5));
    const noMissProgress = await readNoMissProgress(page);
    check("テスト8: 中断した場合はノーミスクリア記録も保存されない", !(noMissProgress && noMissProgress.noMissClearedCourses && noMissProgress.noMissClearedCourses.beginner_5));
    // showResult()自体が呼ばれていないため、前回プレイのスナップショットが
    // 残っていたとしても今回の中断分では更新されていないはず
    const record = await readLastPlayRecord(page);
    check("テスト8: 中断時はトロフィー判定用スナップショットも更新されない(nullのまま)", record === null);

    await page.close();
  }

  // ========================================================
  // テスト9(既存トロフィーへの修正反映確認): No.176「パーフェクトナビ」が
  // 誤答→再挑戦クリアでは獲得されず、全問初回正解クリアでは獲得されることを
  // 20問コースの実タップ経路で確認する(PR #65で追加済みの既存トロフィー)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await startCourse(page, base, 0, 20);

    await tapWrongThenRetryCorrect(page);
    await page.waitForTimeout(150);
    await drainTrophyAwardScreens(page);
    await clickNext(page);
    await proceedPastNameEntryIfShown(page);
    await drainTrophyAwardScreens(page);
    for (let i = 0; i < 19; i++) await answerCorrectAndAdvance(page);

    const earned176AfterMistake = await page.evaluate(() => TrophyModule.isEarned("trophy_176"));
    check("テスト9: 誤答→再挑戦ありの20問クリアではNo.176は獲得されない(修正の実トロフィーでの確認)", earned176AfterMistake === false);

    await page.close();
  }
  {
    const page = await newPage(browser, consoleErrors);
    await startCourse(page, base, 0, 20);
    for (let i = 0; i < 20; i++) await answerCorrectAndAdvance(page);

    const earned176Perfect = await page.evaluate(() => TrophyModule.isEarned("trophy_176"));
    check("テスト9: 全問初回正解の20問クリアではNo.176が獲得される(既存機能は壊れていない)", earned176Perfect === true);

    await page.close();
  }

  check("全テストでコンソール/ページエラーが発生していない", consoleErrors.length === 0);
  if (consoleErrors.length) console.log("consoleErrors:", consoleErrors);

  await browser.close();
  server.close();
  console.log(`\nTotal: ${pass + fail}, Pass: ${pass}, Fail: ${fail}`);
  process.exit(fail > 0 ? 1 : 0);
})();
