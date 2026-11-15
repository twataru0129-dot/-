// ==========================================================
// 「世界の国どこかな？」実際のゲーム処理を経由する統合テスト。
//
// PR #65レビューで「判定関数(TrophyModule)は正しいが、呼び出し側
// (js/findcountry.js)の引数が間違っていた」というNo.172の不具合が
// 自動テストで検出できなかった教訓を踏まえ、このテストは
// TrophyModule.evaluateFindCountryAnswer/evaluateFindCountryResult を
// 直接呼ぶのではなく、実際のタップ結果コールバック(FindCountryModule.
// simulateTapForTest、本番のタップ処理(handleTap)と全く同じ関数)を
// 経由して、正解判定→ライフ処理→連続正解→トロフィー判定→保存→
// 獲得通知→画面遷移までの実際の処理経路を1問ずつ通す。
//
// 3D地球儀上の「ピクセル座標から出題対象の国を特定する」工程だけは、
// ランダムな出題国へのピクセル単位のタップがPlaywrightで安定しないため
// 省略し、FindCountryModule.getCurrentCountryId()(本番では使われない
// テスト専用の読み取り専用アクセサ)で現在の出題idを直接取得する。
// それ以降の処理は本番と完全に同一の関数を経由する。
//
// 実行方法: node tests/playwright_findcountry_gameplay_integration.test.js
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

// PRO解放に必要な12コースを実際のStorage APIで全てクリア済みにする
// (alert()が出て止まらないようにするための事前準備。判定ロジック自体は
// 本番と同じStorage.markFindCountryCourseCleared()を使う)
async function unlockPro(page) {
  await page.evaluate(() => {
    const keys = [
      "beginner_5", "beginner_10", "beginner_20", "beginner_30",
      "intermediate_5", "intermediate_10", "intermediate_20", "intermediate_30",
      "advanced_5", "advanced_10", "advanced_20", "advanced_30",
    ];
    keys.forEach((k) => Storage.markFindCountryCourseCleared(k));
  });
}

async function openDifficulty(page, base) {
  await page.goto(base, { waitUntil: "load" });
  await page.click("#btn-mode-findcountry");
  await page.waitForSelector("#screen-findcountry-difficulty.active");
}

// difficultyIndex: 0=初級 1=中級 2=上級 3=PRO(DIFFICULTIES配列の順序どおり)
async function startCourse(page, difficultyIndex, questionCount) {
  // .count-card/.difficulty-cardは国旗クイズの問題数選択画面とクラス名を
  // 共有しているため(findcountryの難易度カードは"count-card difficulty-card"の
  // 2つを持つ)、グローバルにクエリすると非表示画面の要素まで混ざって
  // インデックスがずれる。findcountry専用のコンテナ内に絞って取得する
  const cards = await page.$$("#findcountry-difficulty-options .difficulty-card");
  await cards[difficultyIndex].click();
  if (questionCount === null) {
    // PRO: 問題数選択を経由せず即座にクイズ画面へ
    await page.waitForSelector("#screen-map.findcountry-mode", { timeout: 15000 });
    return;
  }
  await page.waitForSelector("#screen-findcountry-count.active");
  const countIndex = [5, 10, 20, 30].indexOf(questionCount);
  const countCards = await page.$$("#findcountry-count-options .count-card");
  await countCards[countIndex].click();
  await page.waitForSelector("#screen-map.findcountry-mode", { timeout: 15000 });
}

// 地球儀のcanvas生成(=MapModule側のwheel/touchリスナー登録含む)を待つ
async function waitGlobeReady(page) {
  await page.waitForSelector("#map-globe-container canvas", { timeout: 15000 });
  await page.waitForTimeout(400);
}

// 現在出題中の国を正解タップで確定する(本番のhandleTapと同一経路)
async function tapCorrect(page) {
  return page.evaluate(() => {
    const id = FindCountryModule.getCurrentCountryId();
    FindCountryModule.simulateTapForTest(id);
    return id;
  });
}
// 現在出題中の国と異なるidで不正解タップを行う(現在のidそのものは
// 誤答として扱われないよう、"zz"のような実在しないid以外に、対象外として
// 確実に不正解になるよう正解id以外の実在idを使う)
async function tapWrong(page) {
  return page.evaluate(() => {
    const correctId = FindCountryModule.getCurrentCountryId();
    const wrongId = correctId === "jp" ? "fr" : "jp";
    FindCountryModule.simulateTapForTest(wrongId);
    return wrongId;
  });
}

async function clickNext(page) {
  await page.click("#findcountry-quiz-next");
}

// ランキングの空き順位(TOP5)に入ると、結果画面の前に名前入力画面を挟む
// 既存仕様(第5段階前半)がある。フレッシュなテスト用ブラウザではランキングが
// 空のため、ほぼ毎回この画面を経由する。登場していれば「登録する」を押して
// 先へ進む(名前は空欄のままでよい、既存仕様で「ななし」に正規化される)
async function proceedPastNameEntryIfShown(page) {
  const nameEntryActive = await page.$(".screen.active#screen-findcountry-name-entry");
  if (nameEntryActive) {
    await page.click("#findcountry-name-entry-submit");
    await page.waitForTimeout(200);
  }
}

// 通知キューに複数バッチ積まれている場合(例: unlockPro()で12コースの
// クリア記録を直接書き込んだ後、PROの1プレイが終了してevaluateFindCountryResult()
// が走ると、通常12コースのクリア系トロフィー十数件が「過去実績の反映」として
// 一度に成立し得る、既存仕様どおりの正しい挙動)、表示されている間は
// 「続ける」を繰り返し押して全て閉じる
async function drainTrophyAwardScreens(page, maxIterations) {
  for (let i = 0; i < (maxIterations || 30); i++) {
    const active = await page.$(".screen.active#screen-trophy-award");
    if (!active) return;
    await page.click("#btn-trophy-award-continue");
    await page.waitForTimeout(150);
  }
}

(async () => {
  const consoleErrors = [];
  const browser = await chromium.launch();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/`;

  // ========================================================
  // テストA: No.172「秘境への扉」をPROモードの実タップ経路で獲得する
  // (finalizeAnswer→evaluateFindCountryAnswer→通知→画面復帰までを確認)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await page.goto(base, { waitUntil: "load" });
    await unlockPro(page);
    await page.click("#btn-mode-findcountry");
    await page.waitForSelector("#screen-findcountry-difficulty.active");
    await startCourse(page, 3, null); // PRO
    await waitGlobeReady(page);

    const beforeTap = await page.evaluate(() => TrophyModule.isEarned("trophy_172"));
    check("テストA: タップ前はNo.172未獲得", beforeTap === false);

    await tapCorrect(page);
    await page.waitForSelector("#screen-trophy-award.active", { timeout: 5000 });
    const awardText = await page.textContent("#trophy-award-list");
    check("テストA: PROモードの実タップでNo.172の獲得通知が表示される", (awardText || "").includes("秘境への扉"));

    await page.click("#btn-trophy-award-continue");
    await page.waitForTimeout(200);
    const screenAfterContinue = await page.$eval(".screen.active", (el) => el.id);
    check("テストA: 通知を閉じた後、クイズ画面(screen-map)へ正常に戻る", screenAfterContinue === "screen-map");
    const stillFindcountryMode = await page.$eval("#screen-map", (el) => el.classList.contains("findcountry-mode"));
    check("テストA: 戻った画面がfindcountry-modeのまま(ゲーム継続可能)", stillFindcountryMode === true);

    const afterTap = await page.evaluate(() => TrophyModule.isEarned("trophy_172"));
    check("テストA: 実タップ経由でNo.172が実際に獲得される(レビュー発見のバグの再発確認)", afterTap === true);

    // 2問目以降、再度正解しても二重に通知画面が出ない(既に獲得済みのため)
    await clickNext(page);
    await page.waitForTimeout(200);
    await tapCorrect(page);
    await page.waitForTimeout(300);
    const screenAfterSecondCorrect = await page.$eval(".screen.active", (el) => el.id);
    check("テストA: 既に獲得済みのNo.172は2問目の正解で再度通知されない(重複獲得防止)", screenAfterSecondCorrect === "screen-map");

    await page.close();
  }

  // ========================================================
  // テストB: PROモードで最初の正解がない(誤答で即終了)場合、No.172は
  // 獲得できないことを実タップ経路で確認する
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await page.goto(base, { waitUntil: "load" });
    await unlockPro(page);
    await page.click("#btn-mode-findcountry");
    await page.waitForSelector("#screen-findcountry-difficulty.active");
    await startCourse(page, 3, null); // PRO
    await waitGlobeReady(page);

    await tapWrong(page);
    await page.waitForTimeout(300);
    const earnedAfterWrong = await page.evaluate(() => TrophyModule.isEarned("trophy_172"));
    check("テストB: PROモードで最初に誤答した場合はNo.172を獲得しない", earnedAfterWrong === false);

    // PROはライフ1のため、この誤答1回で即ゲームオーバーになっているはず
    // (結果を見るボタンに切り替わっているため、クリックして結果画面まで進む。
    // フレッシュなテスト用ブラウザではランキングが空のため、TOP5入賞による
    // 名前入力画面(screen-findcountry-name-entry)を経由することが多い。
    // さらに、unlockPro()で12コースのクリア記録を直接書き込んだ副作用として、
    // 通常コースクリア系トロフィー十数件がこのタイミングで「過去実績の反映」
    // として一括成立する既存仕様どおりの正しい挙動のため、通知を全て閉じる)
    await clickNext(page);
    await page.waitForTimeout(200);
    await proceedPastNameEntryIfShown(page);
    await page.waitForTimeout(200);
    await drainTrophyAwardScreens(page);
    await page.waitForSelector("#screen-findcountry-result.active", { timeout: 5000 });
    const gameOverNoteVisible = await page.evaluate(() => {
      const el = document.getElementById("findcountry-result-gameover-note");
      return !!el && !el.classList.contains("hidden");
    });
    check("テストB: PROは1ミス即ゲームオーバーの既存仕様が実タップ経路でも維持されている", gameOverNoteVisible === true);
    const earnedAfterResult = await page.evaluate(() => TrophyModule.isEarned("trophy_172"));
    check("テストB: 結果画面到達後もNo.172は未獲得のまま", earnedAfterResult === false);

    await page.close();
  }

  // ========================================================
  // テストC: No.190「迷いなき一撃」を上級10問コースの実タップ経路で獲得する
  // (ズーム操作を一切行わず10問連続正解)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await openDifficulty(page, base);
    await startCourse(page, 2, 10); // 上級・10問
    await waitGlobeReady(page);

    for (let i = 0; i < 10; i++) {
      await tapCorrect(page);
      await page.waitForTimeout(80);
      // No.159「地図への第一歩」はこのプレイの最初の正解タップで即時付与
      // される(mid-play通知)ため、地図画面が隠れて「次の問題へ」が押せない
      // ことがある。次へ進む前に必ず閉じておく
      await drainTrophyAwardScreens(page);
      if (i < 9) {
        await clickNext(page);
        await page.waitForTimeout(150);
      }
    }
    await page.waitForTimeout(200);
    await clickNext(page); // 結果画面へ(TOP5入賞なら先に名前入力画面を経由する)
    await page.waitForTimeout(200);
    await proceedPastNameEntryIfShown(page);
    await page.waitForSelector("#screen-findcountry-result.active, #screen-trophy-award.active", { timeout: 5000 });

    const earned190 = await page.evaluate(() => TrophyModule.isEarned("trophy_190"));
    check("テストC: 上級10問をズームなしで実タップ完走 → No.190を獲得する", earned190 === true);

    // 獲得通知が出ている場合、閉じた後に正しく結果画面へ戻ることを確認する
    await drainTrophyAwardScreens(page);
    const finalScreen = await page.$eval(".screen.active", (el) => el.id);
    check("テストC: 通知の有無に関わらず最終的に結果画面(screen-findcountry-result)に到達する", finalScreen === "screen-findcountry-result");

    await page.close();
  }

  // ========================================================
  // テストD: 上級10問コースの途中で実際にwheelイベント(ズーム)を1回発生させた
  // 場合、No.190を獲得できないことを実タップ経路で確認する
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await openDifficulty(page, base);
    await startCourse(page, 2, 10); // 上級・10問
    await waitGlobeReady(page);

    for (let i = 0; i < 10; i++) {
      if (i === 4) {
        // 5問目の最中に実際にwheelイベントを発生させる(本物のズーム操作)
        await page.evaluate(() => {
          document.getElementById("map-globe-container")
            .dispatchEvent(new WheelEvent("wheel", { deltaY: -120, bubbles: true }));
        });
        await page.waitForTimeout(80);
      }
      await tapCorrect(page);
      await page.waitForTimeout(80);
      await drainTrophyAwardScreens(page); // No.159のmid-play即時付与に備える
      if (i < 9) {
        await clickNext(page);
        await page.waitForTimeout(150);
      }
    }
    await page.waitForTimeout(200);
    await clickNext(page);
    await page.waitForTimeout(200);
    await proceedPastNameEntryIfShown(page);
    await page.waitForSelector("#screen-findcountry-result.active, #screen-trophy-award.active", { timeout: 5000 });
    await drainTrophyAwardScreens(page);

    const earned190 = await page.evaluate(() => TrophyModule.isEarned("trophy_190"));
    check("テストD: 10問中1問で実際にズーム(wheel)操作 → No.190を獲得しない", earned190 === false);

    await page.close();
  }

  // ========================================================
  // テストE: 通常の初級5問コースを実タップ経路でノーミス完走し、
  // No.160(はじめての発見)が獲得され、通知を閉じた後に正しく
  // 結果画面へ戻ることを確認する(素朴なコースクリア系トロフィーの回帰)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await openDifficulty(page, base);
    await startCourse(page, 0, 5); // 初級・5問
    await waitGlobeReady(page);

    for (let i = 0; i < 5; i++) {
      await tapCorrect(page);
      await page.waitForTimeout(80);
      await drainTrophyAwardScreens(page); // No.159のmid-play即時付与に備える
      if (i < 4) {
        await clickNext(page);
        await page.waitForTimeout(150);
      }
    }
    await page.waitForTimeout(200);

    // 獲得通知(No.159「地図への第一歩」はこの時点までに即時付与されている
    // 可能性があるため、先に表示されていれば閉じる)
    await drainTrophyAwardScreens(page);
    await clickNext(page); // 結果画面へ(TOP5入賞なら先に名前入力画面を経由する)
    await page.waitForTimeout(200);
    await proceedPastNameEntryIfShown(page);
    await page.waitForTimeout(200);
    await drainTrophyAwardScreens(page);
    const finalScreen = await page.$eval(".screen.active", (el) => el.id);
    check("テストE: 初級5問を実タップでノーミス完走 → 最終的に結果画面に到達する", finalScreen === "screen-findcountry-result");

    const earned = await page.evaluate(() => ({
      no160: TrophyModule.isEarned("trophy_160"),
      no159: TrophyModule.isEarned("trophy_159"),
      no176: TrophyModule.isEarned("trophy_176"), // パーフェクトナビ(いずれかの難易度の20問ノーミス)は対象外(5問のため不成立のはず)
    }));
    check("テストE: 実タップ経由でNo.160(初級5問クリア)が実際に獲得される", earned.no160 === true);
    check("テストE: 実タップ経由でNo.159(初めての正解)も実際に獲得される", earned.no159 === true);
    check("テストE: 対象外のNo.176(20問コース)は5問クリアでは獲得されない", earned.no176 === false);

    await page.close();
  }

  check("全テストでコンソール/ページエラーが発生していない", consoleErrors.length === 0 || (() => { console.log(consoleErrors); return false; })());

  console.log(`\nTotal: ${pass + fail}, Pass: ${pass}, Fail: ${fail}`);
  await browser.close();
  server.close();
  process.exit(fail > 0 ? 1 : 0);
})();
