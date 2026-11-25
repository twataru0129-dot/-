// ==========================================================
// 世界7不思議(7問+隠し特別トロフィー2種)の統合テスト。
//
// 検証項目(企画書の受け入れテスト19項目のうち、UI操作を伴うもの):
//   1. 通常謎解き125/126の状態では世界7不思議の7枚は全てロック表示
//      (「？？？？？？」・鍵アイコン)で、タップしても回答画面を開かず、
//      「全ての謎を解き明かしたい者のみが挑戦できる」の案内だけが出ること。
//   2. 126問目に正解した瞬間、(a)その問題のトロフィー獲得演出→
//      (b)世界7不思議解放演出(「世界の七不思議が解放された」)の順に
//      画面が進み、閉じるとトロフィー一覧に戻ること。ミステリーハンターが
//      隠し特別トロフィーとして新規獲得されること。
//   3. 解放後、7枚のカードが本来の名称・問題文・「この謎に挑む」ボタンを
//      持つ通常カードとして表示されること(No.386「暗号作戦634」で確認)。
//   4. 不正解時: 確認ダイアログが表示され、キャンセルすれば何もロックされず
//      再挑戦できること。確定すればその問題だけがロックされ、他の問題は
//      挑戦可能なままであること。
//   5. 正解時: 専用の獲得演出(premiumクラス付与)が表示され、閉じると
//      一覧でその問題が獲得済み表示になること。
//   6. 7問目に正解した瞬間、全知全能の神の全制覇演出が表示されること。
//   7. No.220「東京スカイツリー」が、未獲得でも名称・条件を表示すること
//      (他の隠しトロフィーとは異なる表示仕様)。
//   8. トップ画面の6つの固定国旗(日本/フランス/ブラジル/南アフリカ/
//      オーストラリア/カナダ)の表示順が変更されていないこと(回帰確認)。
//   9. 既存の謎解き(No.263「世界最大の砂漠」等)の挑戦・正解演出が
//      従来どおり動作すること(回帰確認)。
//
// 実行方法: node tests/playwright_seven_wonders.test.js
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

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass += 1; console.log("PASS:", name); }
  else { fail += 1; console.log("FAIL:", name); }
}

async function newPage(browser, consoleErrors) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  return page;
}

// UI刷新: カテゴリー別進捗カードは既定で8枚までの折りたたみ表示になる
// ため、sevenWonders/findcountry_hiddenのように折りたたみ範囲外の
// カテゴリーをクリックする前に「すべて表示」を開いておく
async function expandCategorySection(page) {
  const toggle = await page.$("#trophy-category-toggle");
  if (!toggle) return;
  const alreadyExpanded = await toggle.evaluate((el) => el.textContent.includes("少なく"));
  if (!alreadyExpanded) await toggle.click();
}

async function openTrophyList(page, base) {
  await page.goto(base, { waitUntil: "load" });
  await page.click("#btn-trophy-list");
  await page.waitForSelector("#screen-trophy-list.active");
  await expandCategorySection(page);
  await page.click('.trophy-category-chip[data-category="sevenWonders"]');
  await page.waitForTimeout(150);
}

async function answerCurrentFlagScreen(page, answerIds) {
  for (const id of answerIds) {
    await page.click(`.puzzle-flag-card[data-id="${id}"]`);
  }
  await page.click("#puzzle-answer-submit");
}

(async () => {
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const consoleErrors = [];

  // ---------- テスト1: 未解放時のロック表示・ロック中タップ案内 ----------
  {
    const page = await newPage(browser, consoleErrors);
    await openTrophyList(page, base);
    const lockedCards = await page.$$(".trophy-card-sevenwonder-locked");
    check("未解放時: ロック中のカードが7枚(問題分)以上ある", lockedCards.length >= 7);
    const firstLocked = lockedCards[0];
    const nameText = await firstLocked.$eval(".trophy-name", (el) => el.textContent.trim());
    check("ロック中カードの名称が？？？？？？で伏せられている", nameText === "？？？？？？");
    await firstLocked.click();
    await page.waitForSelector("#seven-wonder-locked-modal:not(.hidden)", { timeout: 3000 });
    const lockedText = await page.$eval("#seven-wonder-locked-modal .modal-text", (el) => el.textContent.trim());
    check("ロック中タップ案内の文言が正確", lockedText === "全ての謎を解き明かしたい者のみが挑戦できる");
    await page.click("#seven-wonder-locked-close");
    await page.waitForSelector("#seven-wonder-locked-modal", { state: "hidden", timeout: 3000 });
    await page.close();
  }

  // ---------- テスト2: No.220が未獲得でも名称・条件を表示する ----------
  {
    const page = await newPage(browser, consoleErrors);
    await page.goto(base, { waitUntil: "load" });
    await page.click("#btn-trophy-list");
    await page.waitForSelector("#screen-trophy-list.active");
    await expandCategorySection(page);
    await page.click('.trophy-category-chip[data-category="findcountry_hidden"]');
    await page.waitForTimeout(150);
    // 汎用カード(buildTrophyCardElement)はdata-trophy-id属性を持たないため、
    // 表示中の.trophy-number「No.220」を含むカードをテキストで特定する
    const text220 = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("#trophy-grid .trophy-card"));
      const card = cards.find((c) => {
        const num = c.querySelector(".trophy-number");
        return num && num.textContent.trim() === "No.220";
      });
      return card ? card.textContent : "";
    });
    check("No.220は未獲得でも名称が表示される", text220.includes("東京スカイツリー"));
    check("No.220は未獲得でも条件が表示される", text220.includes("634"));
    await page.close();
  }

  // ---------- テスト3: トップ画面の固定6国旗の表示順(回帰確認) ----------
  {
    const page = await newPage(browser, consoleErrors);
    await page.goto(base, { waitUntil: "load" });
    const flagSrcs = await page.$$eval(".top-flags-deco img", (imgs) => imgs.map((i) => i.getAttribute("src")));
    check(
      "トップ画面の国旗表示順が jp/fr/br/za/au/ca のまま",
      JSON.stringify(flagSrcs) === JSON.stringify([
        "./assets/flags/jp.svg", "./assets/flags/fr.svg", "./assets/flags/br.svg",
        "./assets/flags/za.svg", "./assets/flags/au.svg", "./assets/flags/ca.svg",
      ])
    );
    await page.close();
  }

  // ---------- テスト4: 既存の通常謎解き(回帰確認) ----------
  {
    const page = await newPage(browser, consoleErrors);
    await page.goto(`${base}?puzzleDev=1`, { waitUntil: "load" });
    await page.click("#btn-trophy-list");
    await page.waitForSelector("#btn-dev-puzzle-entry:not(.hidden)");
    await page.click("#btn-dev-puzzle-entry");
    await page.waitForSelector('.puzzle-dev-question-btn[data-question-id="puzzle-01"]');
    await page.click('.puzzle-dev-question-btn[data-question-id="puzzle-01"]');
    await page.waitForSelector("#screen-puzzle-flag-select.active");
    const answerIds = await page.evaluate(() => PUZZLE_QUESTIONS_BY_ID["puzzle-01"].answerIds.slice());
    await answerCurrentFlagScreen(page, answerIds);
    await page.waitForSelector("#screen-puzzle-trophy-award.active", { timeout: 4000 });
    const isWonderStyled = await page.evaluate(() => document.getElementById("screen-puzzle-trophy-award").classList.contains("screen-puzzle-trophy-award-wonder"));
    check("既存の通常謎解き(puzzle-01)は従来どおり正解演出が出る", true);
    check("既存の通常謎解きには世界7不思議の専用デザインが付かない", !isWonderStyled);
    await page.close();
  }

  // ---------- テスト5: 126問全問正解→解放演出→ミステリーハンター ----------
  let sharedPage;
  {
    const page = await newPage(browser, consoleErrors);
    await page.goto(base, { waitUntil: "load" });
    // 125問を直接TrophyModule経由で正解済みにする(最後の1問だけ実際のUI操作で確定する)
    const result = await page.evaluate(() => {
      // 【トロフィーカテゴリー修正】ミステリーハンター(#393)の表示用
      // カテゴリーが「謎解きトロフィー」になったため、category === "puzzle"
      // だけで絞り込むと、挑戦先を持たない#393自身(puzzleQuestionId: null)が
      // 末尾(番号が最大)に混入してしまう。実際に挑戦できる通常謎解き126問
      // だけを対象にするため、puzzleQuestionIdを持つものだけに絞り込む
      const defs = TrophyModule.getAllDefinitions().filter((d) => d.category === "puzzle" && d.puzzleQuestionId);
      const last = defs[defs.length - 1];
      defs.slice(0, -1).forEach((d) => {
        TrophyModule.evaluatePuzzleAnswer({ questionId: d.puzzleQuestionId, correct: true });
      });
      return { lastQuestionId: last.puzzleQuestionId, lastAnswerIds: (typeof PUZZLE_QUESTIONS_BY_ID !== "undefined" ? PUZZLE_QUESTIONS_BY_ID[last.puzzleQuestionId].answerIds.slice() : []) };
    });
    const unlockedBefore = await page.evaluate(() => TrophyModule.isSevenWondersUnlocked());
    check("125/126時点では世界7不思議は未解放", unlockedBefore === false);

    // 最後の1問を実際のUI(開発入口)経由で解く
    await page.goto(`${base}?puzzleDev=1`, { waitUntil: "load" });
    await page.click("#btn-trophy-list");
    await page.waitForSelector("#btn-dev-puzzle-entry:not(.hidden)");
    await page.click("#btn-dev-puzzle-entry");
    await page.waitForSelector(`.puzzle-dev-question-btn[data-question-id="${result.lastQuestionId}"]`);
    await page.click(`.puzzle-dev-question-btn[data-question-id="${result.lastQuestionId}"]`);
    await page.waitForSelector("#screen-puzzle-flag-select.active");
    await answerCurrentFlagScreen(page, result.lastAnswerIds);
    await page.waitForSelector("#screen-puzzle-trophy-award.active", { timeout: 4000 });
    await page.click("#btn-puzzle-award-close");
    await page.waitForSelector("#screen-seven-wonders-unlock.active", { timeout: 4000 });
    const heading = await page.$eval("#screen-seven-wonders-unlock .seven-wonders-cinematic-heading", (el) => el.textContent.trim());
    check("126問目正解で世界7不思議の解放演出が表示される", heading === "世界の七不思議が解放された");
    const mysteryHunterEarned = await page.evaluate(() => TrophyModule.isEarned(`trophy_${TrophyModule.MYSTERY_HUNTER_NUMBER}`));
    check("ミステリーハンターが新規獲得される", mysteryHunterEarned === true);
    // 「続ける」は、謎解き獲得演出を開いた直前の画面(常にscreen-puzzle-flag-select)
    // へ戻る(screen-topへは戻らない。既存の謎解き獲得演出の「閉じる」と同じ戻り先)
    await page.click("#btn-seven-wonders-unlock-continue");
    await page.waitForSelector("#screen-puzzle-flag-select.active", { timeout: 4000 });
    sharedPage = page; // このページの状態(全問解放済み)を次のテストで使い回す
  }

  // ---------- テスト6: 解放後、7枚が通常カードとして表示される ----------
  {
    const page = sharedPage;
    await openTrophyList(page, base);
    const card386 = await page.$('.trophy-card[data-trophy-id="trophy_386"]');
    const text386 = card386 ? await card386.innerText() : "";
    check("解放後: No.386の名称が表示される", text386.includes("暗号作戦634"));
    check("解放後: No.386の問題文(ADFGVX表)が表示される", text386.includes("GFFAXFVG"));
    const challengeBtn = await card386.$(".btn-sevenwonder-challenge");
    check("解放後: 「この謎に挑む」ボタンがある", !!challengeBtn);
  }

  // ---------- テスト7: 不正解確定→確認ダイアログ→キャンセルでロックされない ----------
  {
    const page = sharedPage;
    await openTrophyList(page, base);
    await page.click('.trophy-card[data-trophy-id="trophy_386"] .btn-sevenwonder-challenge');
    await page.waitForSelector("#screen-puzzle-flag-select.active");
    // ペルー以外(誤答)を選ぶ
    await page.click('.puzzle-flag-card[data-id="jp"]');
    await page.click("#puzzle-answer-submit");
    await page.waitForSelector("#seven-wonder-confirm-modal:not(.hidden)", { timeout: 3000 });
    const confirmText = await page.$eval("#seven-wonder-confirm-modal .modal-text", (el) => el.innerText);
    check(
      "不正解確定ダイアログの文言が正確",
      confirmText.replace(/\s+/g, "") === "この答えで確定しますか？不正解の場合、この謎には7日間再挑戦できません。".replace(/\s+/g, "")
    );
    await page.click("#seven-wonder-confirm-cancel");
    await page.waitForSelector("#seven-wonder-confirm-modal", { state: "hidden", timeout: 3000 });
    const stateAfterCancel = await page.evaluate(() => TrophyModule.getSevenWonderState("wonder-01"));
    check("キャンセル後はロックされない(available維持)", stateAfterCancel === "available");
  }

  // ---------- テスト8: 不正解確定→ロック、他の問題は挑戦可能 ----------
  {
    const page = sharedPage;
    await page.click('.puzzle-flag-card[data-id="jp"]');
    await page.click("#puzzle-answer-submit");
    await page.waitForSelector("#seven-wonder-confirm-modal:not(.hidden)", { timeout: 3000 });
    await page.click("#seven-wonder-confirm-yes");
    await page.waitForSelector("#seven-wonder-confirm-modal", { state: "hidden", timeout: 3000 });
    const wrongMsg = await page.$eval("#puzzle-answer-message", (el) => el.textContent);
    check("確定後、7日間ロックされる旨のメッセージが表示される", wrongMsg.includes("7日間"));
    const stateWonder1 = await page.evaluate(() => TrophyModule.getSevenWonderState("wonder-01"));
    check("確定後、wonder-01はcooldown状態になる", stateWonder1 === "cooldown");
    const stateWonder2 = await page.evaluate(() => TrophyModule.getSevenWonderState("wonder-02"));
    check("他の問題(wonder-02)はavailableのまま", stateWonder2 === "available");
  }

  // ---------- テスト8.5: 不正解確定後、同じ画面で正解国に変更して
  // 再送信してもトロフィーを取得できない(PR#85レビュー指摘のセキュリティ
  // 回帰テスト)。テスト8の時点でwonder-01はcooldown済みで、画面は
  // まだ#screen-puzzle-flag-selectのまま(自動では遷移しない)ことを
  // 利用し、実際に「同じ画面で正解の国旗へ選び直して再送信する」操作を
  // 再現する ----------
  {
    const page = sharedPage;
    const lockBefore = await page.evaluate(() => TrophyModule.getSevenWonderUnlockAt("wonder-01"));
    await page.click(".puzzle-answer-chip"); // 誤答(jp)の選択を取り除く
    await page.click('.puzzle-flag-card[data-id="pe"]'); // 正解(ペルー)を選び直す
    await page.click("#puzzle-answer-submit");
    await page.waitForTimeout(200);
    const earnedAfterExploit = await page.evaluate(() => TrophyModule.isEarned("trophy_386"));
    check("不正解確定→同じ画面で正解国に変更→再送信してもトロフィーを獲得できない", earnedAfterExploit === false);
    const stateAfterExploit = await page.evaluate(() => TrophyModule.getSevenWonderState("wonder-01"));
    check("再送信を試みてもwonder-01はcooldown状態のまま", stateAfterExploit === "cooldown");
    const lockAfter = await page.evaluate(() => TrophyModule.getSevenWonderUnlockAt("wonder-01"));
    check("再送信してもロック解除時刻が変化しない(再ロック・延長されない)", lockAfter === lockBefore);
    const returnLinkVisible = await page.isVisible("#puzzle-seven-wonder-return");
    check("回答できない旨とトロフィー一覧へ戻るリンクが表示される", returnLinkVisible === true);

    // 連続で複数回再送信を試みても状態が変わらないことも確認する(多重送信対策)
    await page.click("#puzzle-answer-submit");
    await page.click("#puzzle-answer-submit");
    await page.waitForTimeout(200);
    const earnedAfterRepeated = await page.evaluate(() => TrophyModule.isEarned("trophy_386"));
    check("複数回連続で再送信してもトロフィーを獲得できない", earnedAfterRepeated === false);

    // 「トロフィー一覧へ戻る」リンクから実際にトロフィー一覧へ戻れる
    await page.click("#puzzle-seven-wonder-return");
    await page.waitForSelector("#screen-trophy-list.active", { timeout: 3000 });
    check("「トロフィー一覧へ戻る」でトロフィー一覧画面に戻る", true);
  }

  // ---------- テスト9: 一覧でcooldown表示、他の問題へ正解できる ----------
  {
    const page = sharedPage;
    await openTrophyList(page, base);
    const card386 = await page.$('.trophy-card[data-trophy-id="trophy_386"]');
    const text386 = card386 ? await card386.innerText() : "";
    check("一覧でcooldown中は残り時間の案内が表示される", text386.includes("7日間"));

    // wonder-02(エストニア=ee)に正解する
    const card387 = await page.$('.trophy-card[data-trophy-id="trophy_387"]');
    await card387.$eval(".btn-sevenwonder-challenge", (btn) => btn.click());
    await page.waitForSelector("#screen-puzzle-flag-select.active");
    await answerCurrentFlagScreen(page, ["ee"]);
    await page.waitForSelector("#screen-puzzle-trophy-award.active", { timeout: 4000 });
    const isWonderStyled = await page.evaluate(() => document.getElementById("screen-puzzle-trophy-award").classList.contains("screen-puzzle-trophy-award-wonder"));
    check("世界7不思議の正解演出には専用デザインが付く", isWonderStyled === true);
    await page.click("#btn-puzzle-award-close");
    await page.waitForSelector("#screen-puzzle-flag-select.active", { timeout: 4000 });
  }

  // ---------- テスト10: 残り5問を正解させ、7問目で全知全能の神 ----------
  {
    const page = sharedPage;
    // wonder-01はテスト8で意図的に不正解を確定させ、168時間ロック中のまま
    // (現実の時間を待てないため、ここではTrophyModule.evaluateSevenWonderAnswer()を
    // 直接呼んで「後日ロック解除後に正解した」ことを模す。ロック自体がUI層
    // (PuzzleModule.open()・一覧のボタン表示)の制御であり、判定関数自体には
    // ロックを強制する役割を持たせていないことは、テスト7・8で別途確認済み)
    const remaining = ["wonder-01", "wonder-03", "wonder-04", "wonder-05", "wonder-06"];
    for (const qid of remaining) {
      const r = await page.evaluate((id) => TrophyModule.evaluateSevenWonderAnswer({ questionId: id, correct: true }), qid);
      check(`${qid}を正解として記録できる`, Array.isArray(r.awardedIds) && r.awardedIds.length >= 1);
    }
    const omniscientBefore = await page.evaluate(() => TrophyModule.isEarned(`trophy_${TrophyModule.OMNISCIENT_GOD_NUMBER}`));
    check("6問目まででは全知全能の神は未獲得", omniscientBefore === false);

    // 7問目(wonder-07、ミクロネシア=fm)を実際のUIで正解する
    await openTrophyList(page, base);
    const card392 = await page.$('.trophy-card[data-trophy-id="trophy_392"]');
    await card392.$eval(".btn-sevenwonder-challenge", (btn) => btn.click());
    await page.waitForSelector("#screen-puzzle-flag-select.active");
    await answerCurrentFlagScreen(page, ["fm"]);
    await page.waitForSelector("#screen-puzzle-trophy-award.active", { timeout: 4000 });
    await page.click("#btn-puzzle-award-close");
    await page.waitForSelector("#screen-seven-wonders-omniscient.active", { timeout: 4000 });
    const omniHeading = await page.$eval("#screen-seven-wonders-omniscient .seven-wonders-cinematic-heading", (el) => el.textContent.trim());
    check("7問目正解で全知全能の神の全制覇演出が表示される", omniHeading === "全知全能の神");
    const omniscientAfter = await page.evaluate(() => TrophyModule.isEarned(`trophy_${TrophyModule.OMNISCIENT_GOD_NUMBER}`));
    check("全知全能の神が新規獲得される", omniscientAfter === true);
    await page.click("#btn-seven-wonders-omniscient-continue");
  }

  check("ページ内でコンソールエラーが発生していない", consoleErrors.length === 0);
  if (consoleErrors.length) consoleErrors.forEach((e) => console.log("console error:", e));

  await browser.close();
  server.close();
  console.log(`\n合計: ${pass + fail}件 / 成功: ${pass}件 / 失敗: ${fail}件`);
  process.exit(fail > 0 ? 1 : 0);
})();
