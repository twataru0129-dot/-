// ==========================================================
// 世界7不思議テストラボ(dev/seven-wonders-lab.html、本番配信物には
// 含めない開発専用ページ)の動作確認テスト。
//
// 確認項目:
//   1. 保存データの隔離: ラボでの操作が本番の保存キー(wfq_v1_で始まり
//      wfq_v1_lab_で始まらないキー)を一切作らないこと。
//   2. ラボの操作パネルから、通常126問の一括正解・世界7不思議への挑戦・
//      正解記録・7日間ロック・ロック解除・進捗だけの初期化・全初期化が
//      行えること。
//   3. 本番(index.html)はwindow.__WFQ_LAB_STORAGE_PREFIX__を一切
//      設定しないため、保存キーの接頭辞が従来どおり"wfq_v1_"のままで
//      あること(今回のjs/storage.js変更による本番への影響が無いこと)。
//
// 実行方法: node tests/playwright_seven_wonders_lab.test.js
// (dev/seven-wonders-lab.htmlはfetch("index.html")を使うため、他の
// テストと同じNodeのhttp.createServerによるローカルサーバー経由で開く
// 必要がある。file://では動作しない)
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

(async () => {
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();

  // ---------- テスト1: 本番(index.html)は今回の変更後も保存キーの
  // 接頭辞が"wfq_v1_"のまま(ラボ専用のwindow変数を設定しないため) ----------
  {
    const page = await browser.newPage();
    await page.goto(base, { waitUntil: "load" });
    const prefixInfoProd = await page.evaluate(() => ({
      labFlag: window.__WFQ_LAB_STORAGE_PREFIX__,
    }));
    check("本番ページはwindow.__WFQ_LAB_STORAGE_PREFIX__を設定しない", prefixInfoProd.labFlag === undefined);
    // 効果音設定を切り替えて実際に1件保存させ、そのキーが従来どおり
    // "wfq_v1_"接頭辞のままであることを確認する(今回のjs/storage.js
    // 変更が本番の保存キーに一切影響しないことの確認)
    await page.evaluate(() => Storage.setSoundEnabled(false));
    const keysAfterSave = await page.evaluate(() => Object.keys(localStorage));
    const hasExpectedProdKey = keysAfterSave.includes("wfq_v1_sound_enabled");
    const hasNoLabPrefixedKey = keysAfterSave.every((k) => !k.startsWith("wfq_v1_lab_"));
    check("本番の保存キーが従来どおり\"wfq_v1_\"接頭辞のまま保存される", hasExpectedProdKey && hasNoLabPrefixedKey);
    await page.close();
  }

  // ---------- テスト2: テストラボを開き、保存データが完全に隔離されている ----------
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  await page.goto(`${base}dev/seven-wonders-lab.html`, { waitUntil: "load" });
  await page.waitForSelector("#screen-trophy-list.active", { timeout: 10000 });
  await page.waitForSelector(".wfq-lab-question-row", { timeout: 10000 });
  check("テストラボが起動し、トロフィー一覧(世界7不思議タブ)が表示される", true);

  const initialInfo = await page.evaluate(() => ({
    keys: Object.keys(localStorage),
    prefix: window.__WFQ_LAB_STORAGE_PREFIX__,
    unlocked: typeof TrophyModule !== "undefined" ? TrophyModule.isSevenWondersUnlocked() : null,
  }));
  check("ラボ専用の保存接頭辞(wfq_v1_lab_)が設定されている", initialInfo.prefix === "wfq_v1_lab_");
  check("ラボの初期状態で本番キー・ラボキーのどちらも存在しない(まっさらな状態)", initialInfo.keys.length === 0);
  check("ラボの初期状態では世界7不思議は未解放", initialInfo.unlocked === false);

  // ---------- テスト3: 「通常126問をすべて正解にする」で解放条件を満たす ----------
  await page.click('button[data-action="complete-126"]');
  await page.waitForTimeout(100);
  const unlockedAfter = await page.evaluate(() => TrophyModule.isSevenWondersUnlocked());
  check("「通常126問をすべて正解にする」で世界7不思議が解放される", unlockedAfter === true);
  const keysAfterComplete = await page.evaluate(() => Object.keys(localStorage));
  const allLabPrefixed = keysAfterComplete.every((k) => k.startsWith("wfq_v1_lab_"));
  check("保存されたキーがすべてwfq_v1_lab_接頭辞になっている(本番キーが一切無い)", allLabPrefixed && keysAfterComplete.length > 0);

  // ---------- テスト4: 「挑戦する」から実際の画面でwonder-01に正解できる ----------
  await page.click('button[data-action="challenge"][data-id="wonder-01"]');
  await page.waitForSelector("#screen-puzzle-flag-select.active");
  await page.click('.puzzle-flag-card[data-id="pe"]');
  await page.click("#puzzle-answer-submit");
  await page.waitForSelector("#screen-puzzle-trophy-award.active", { timeout: 4000 });
  const earned386 = await page.evaluate(() => TrophyModule.isEarned("trophy_386"));
  check("ラボの「挑戦する」から実際の画面で正解し、トロフィーを獲得できる", earned386 === true);
  await page.click("#btn-puzzle-award-close");
  await page.waitForTimeout(200);

  // ---------- テスト5: 7日間ロック・解除1分前・解除済みの状態を再現できる ----------
  await page.click('button[data-action="lock"][data-id="wonder-02"]');
  await page.waitForTimeout(50);
  let state02 = await page.evaluate(() => TrophyModule.getSevenWonderState("wonder-02"));
  check("「7日間ロックする」でwonder-02がcooldownになる", state02 === "cooldown");

  await page.click('button[data-action="lock-soon"][data-id="wonder-03"]');
  await page.waitForTimeout(50);
  const unlockAt03 = await page.evaluate(() => TrophyModule.getSevenWonderUnlockAt("wonder-03"));
  const remaining03Min = unlockAt03 ? (unlockAt03 - Date.now()) / 60000 : null;
  check("「解除1分前にする」で残り時間が約1分になる", remaining03Min !== null && remaining03Min > 0 && remaining03Min <= 1.5);

  await page.click('button[data-action="unlock-now"][data-id="wonder-02"]');
  await page.waitForTimeout(50);
  state02 = await page.evaluate(() => TrophyModule.getSevenWonderState("wonder-02"));
  check("「ロック解除済みにする」でwonder-02がavailableに戻る", state02 === "available");

  // ---------- テスト6: 「正解記録(演出なし)」で即座に獲得済みにできる ----------
  await page.click('button[data-action="correct"][data-id="wonder-04"]');
  await page.waitForTimeout(50);
  const state04 = await page.evaluate(() => TrophyModule.getSevenWonderState("wonder-04"));
  check("「正解記録(演出なし)」でwonder-04が即座にcompletedになる", state04 === "completed");

  // ---------- テスト7: 特別演出のプレビューがエラーなく開ける ----------
  // (ミステリーハンターはテスト3の「通常126問をすべて正解にする」の時点で
  // 既に獲得済みになっている、既存の仕様どおりの挙動。ここではプレビュー
  // 操作そのものが、現在の獲得状態を書き換えない(=演出を見るだけ)ことを、
  // 全知全能の神(この時点ではまだ未獲得のトロフィー)で確認する)
  const omniscientBeforePreview = await page.evaluate(() => TrophyModule.isEarned(`trophy_${TrophyModule.OMNISCIENT_GOD_NUMBER}`));
  check("プレビュー前は全知全能の神が未獲得", omniscientBeforePreview === false);
  await page.click('button[data-action="preview-mystery-hunter"]');
  await page.waitForSelector("#screen-puzzle-trophy-award.active", { timeout: 3000 });
  check("ミステリーハンター獲得演出のプレビューが開ける", true);
  await page.click("#btn-puzzle-award-close");
  await page.waitForTimeout(100);
  await page.click('button[data-action="preview-omniscient-award"]');
  await page.waitForSelector("#screen-puzzle-trophy-award.active", { timeout: 3000 });
  const omniscientAfterPreview = await page.evaluate(() => TrophyModule.isEarned(`trophy_${TrophyModule.OMNISCIENT_GOD_NUMBER}`));
  check("演出プレビューだけでは全知全能の神は実際には獲得済みにならない", omniscientAfterPreview === false);
  await page.click("#btn-puzzle-award-close");
  await page.waitForTimeout(100);

  // ---------- テスト8: 「世界7不思議の進捗だけ初期化」で7問・特別2種だけ戻り、126問の進捗は保持される ----------
  await page.click('button[data-action="open-trophy-list"]');
  await page.waitForTimeout(100);
  await page.click('button[data-action="reset-seven-wonders"]');
  await page.waitForTimeout(100);
  const afterReset = await page.evaluate(() => ({
    wonder01: TrophyModule.getSevenWonderState("wonder-01"),
    wonder04: TrophyModule.getSevenWonderState("wonder-04"),
    unlocked: TrophyModule.isSevenWondersUnlocked(),
  }));
  check("「世界7不思議の進捗だけ初期化」でwonder-01の獲得記録が消える", afterReset.wonder01 === "available");
  check("「世界7不思議の進捗だけ初期化」でwonder-04の獲得記録も消える", afterReset.wonder04 === "available");
  check("「世界7不思議の進捗だけ初期化」後も通常126問の達成(解放状態)は維持される", afterReset.unlocked === true);

  // ---------- テスト9: 「テストラボの保存データをすべて初期化」で完全に空へ戻る ----------
  page.once("dialog", (d) => d.accept());
  await page.click('button[data-action="reset-all"]');
  await page.waitForTimeout(100);
  const afterFullReset = await page.evaluate(() => ({
    keys: Object.keys(localStorage),
    unlocked: TrophyModule.isSevenWondersUnlocked(),
  }));
  check("「テストラボの保存データをすべて初期化」で未解放状態に戻る", afterFullReset.unlocked === false);

  check("テストラボ操作中、コンソール/ページエラーが発生していない", consoleErrors.length === 0);
  if (consoleErrors.length) consoleErrors.forEach((e) => console.log("console error:", e));

  await page.close();
  await browser.close();
  server.close();
  console.log(`\n合計: ${pass + fail}件 / 成功: ${pass}件 / 失敗: ${fail}件`);
  process.exit(fail > 0 ? 1 : 0);
})();
