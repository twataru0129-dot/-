// ==========================================================
// 隠しトロフィー61種類(#195〜255)の「結果確定後にまとめて通知する」修正の
// 統合テスト。修正前はjs/findcountry.jsのshowResult()が、プレイ中に
// quizState.hiddenAwardedIdsThisPlayへ積まれた新61種類の新規獲得idを、
// 結果確定時の通知配列(findCountryTrophyAwardedIds)へ一度も合流させて
// いなかった(=獲得しても利用者に一切通知されなかった)バグの修正を確認する。
// 実行方法: node tests/playwright_findcountry_hidden61_end_of_play_notify.test.js
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

async function proceedPastNameEntryIfShown(page) {
  const nameEntryActive = await page.$(".screen.active#screen-findcountry-name-entry");
  if (nameEntryActive) {
    await page.click("#findcountry-name-entry-submit");
    await page.waitForTimeout(200);
  }
}

async function passAndAdvance(page) {
  await page.click("#findcountry-quiz-pass");
  await page.waitForTimeout(150);
  await drainTrophyAwardScreens(page);
  await clickNext(page);
  await proceedPastNameEntryIfShown(page);
  await drainTrophyAwardScreens(page);
}

// globe.glの地球儀コールドスタート分を計測から除くため、使い捨てのタップを
// 何回か行って地球儀を温めておく。コースを完走させてしまうと、その過程で
// No.159・No.160等の既存トロフィーが先に獲得され、「このコースクリアで
// 何が新規に通知されるか」を検証するテストに使えなくなるため、クリアする
// 前に中断(何も保存しない)してから、同じコース(難易度・問題数)を
// 選び直して計測対象のプレイを開始する
async function lightlyWarmGlobeThenRestartSameCourse(page) {
  await tapCorrect(page);
  await page.waitForTimeout(150);
  await drainTrophyAwardScreens(page);
  await clickNext(page);
  await tapCorrect(page);
  await page.waitForTimeout(150);
  await drainTrophyAwardScreens(page);
  await clickNext(page);

  await page.click("#findcountry-quiz-back");
  await page.waitForSelector("#confirm-modal:not(.hidden)", { timeout: 5000 });
  await page.click("#confirm-modal-yes");
  await page.waitForTimeout(200);

  // 中断すると難易度は維持されたまま問題数選択画面に戻るため、
  // 同じ問題数(5問)を選び直すだけで同じコースを再開できる
  await page.waitForSelector("#screen-findcountry-count.active");
  const countCards = await page.$$("#findcountry-count-options .count-card");
  await countCards[0].click();
  await page.waitForSelector("#screen-map.findcountry-mode", { timeout: 15000 });
  await page.waitForTimeout(300);
}

async function isEarned(page, id) {
  return page.evaluate((trophyId) => TrophyModule.isEarned(trophyId), id);
}

async function readAwardScreenItems(page) {
  return page.evaluate(() => {
    const items = Array.from(document.querySelectorAll("#trophy-award-list .trophy-award-item"));
    return items.map((el) => ({
      number: el.querySelector(".trophy-award-number") ? el.querySelector(".trophy-award-number").textContent.trim() : null,
      name: el.querySelector(".trophy-award-name") ? el.querySelector(".trophy-award-name").textContent.trim() : null,
      cond: el.querySelector(".trophy-award-cond") ? el.querySelector(".trophy-award-cond").textContent.trim() : null,
      isSecret: el.classList.contains("trophy-award-item-secret"),
    }));
  });
}

(async () => {
  const consoleErrors = [];
  const browser = await chromium.launch();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/`;

  // ========================================================
  // テストA: 正式なクリアで、既存35種類(No.160)と隠しトロフィー#229を
  // 同時に新規獲得した場合、結果画面へ切り替わった直後にまとめて1回の
  // 獲得演出で通知され、重複表示が無いことを確認する
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await startCourse(page, base, 0, 5); // 初級5問
    await lightlyWarmGlobeThenRestartSameCourse(page);

    check("テストA前提: #229は開始時点で未獲得", (await isEarned(page, "trophy_229")) === false);
    check("テストA前提: No.160(はじめての発見)は開始時点で未獲得", (await isEarned(page, "trophy_160")) === false);

    // 5問すべて素早く正解し、3問連続1000点(#229)と5問コースクリア(No.160)を
    // 同時に満たす。この時点では既にNo.159(初めての正解)が獲得済みのため
    // (warmUpGlobe内で獲得済み)、mid-playの即時通知は発生しない。隠し
    // トロフィー#229自体がmid-playで通知を一切発生させないことは既存の
    // playwright_hidden61_integration.test.jsで確認済みのため、ここでは
    // 画面がscreen-mapのまま進行することだけを確認する
    for (let i = 0; i < 4; i++) {
      await tapCorrect(page);
      await page.waitForTimeout(150);
      const activeDuringPlay = await page.$eval(".screen.active", (el) => el.id);
      check(`テストA: ${i + 1}問目正解後も画面はscreen-mapのまま(新61種類による画面停止なし)`, activeDuringPlay === "screen-map");
      await clickNext(page);
    }
    await tapCorrect(page); // 5問目(クリア確定)
    await page.waitForTimeout(200);
    await clickNext(page); // 「結果を見る」
    await proceedPastNameEntryIfShown(page);

    await page.waitForSelector("#screen-trophy-award.active", { timeout: 5000 });
    const items = await readAwardScreenItems(page);
    const ids = items.map((it) => it.number);
    check("テストA: 結果確定直後に獲得演出画面が表示される", items.length > 0);
    check("テストA: 既存のNo.160(はじめての発見)が通知に含まれる", ids.includes("No.160"));
    check("テストA: 隠しトロフィー#229(エンペラータイム)も同じ通知に含まれる", ids.includes("No.229"));
    check("テストA: 通知内にid(トロフィー番号)の重複が無い", new Set(ids).size === ids.length);
    const item229 = items.find((it) => it.number === "No.229");
    check("テストA: #229は正式名称「エンペラータイム」で表示される", !!item229 && item229.name === "エンペラータイム");
    check("テストA: #229は獲得条件も表示される", !!item229 && !!item229.cond && item229.cond.includes("連続"));
    check("テストA: #229は「隠しトロフィー発見」の見た目になっている", !!item229 && item229.isSecret === true);

    await drainTrophyAwardScreens(page);
    const activeAfterDrain = await page.$eval(".screen.active", (el) => el.id);
    check("テストA: 通知を閉じると結果画面(screen-findcountry-result)に戻る(ランキング・PRO解放演出と衝突しない)", activeAfterDrain === "screen-findcountry-result");

    check("テストA: #229が実際に獲得済みになっている", (await isEarned(page, "trophy_229")) === true);
    check("テストA: No.160も実際に獲得済みになっている", (await isEarned(page, "trophy_160")) === true);

    check("テストA: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テストB: ゲームオーバーで終了した場合でも、隠しトロフィー#235が
  // 結果確定後にまとめて通知されることを確認する(クリアだけでなく
  // ゲームオーバー経路でも通知が合流していることの確認)
  // ========================================================
  {
    consoleErrors.length = 0;
    const page = await newPage(browser, consoleErrors);
    await startCourse(page, base, 0, 5);

    check("テストB前提: #235は開始時点で未獲得", (await isEarned(page, "trophy_235")) === false);

    // 1問も正解しないまま5回連続で誤答し、ライフ0でゲームオーバーにする
    for (let i = 0; i < 5; i++) {
      await tapWrong(page);
      await page.waitForTimeout(120);
      const retryVisible = await page.$("#findcountry-quiz-retry:not(.hidden)");
      if (retryVisible) {
        await page.click("#findcountry-quiz-retry");
        await page.waitForTimeout(100);
      }
    }
    await page.waitForTimeout(150);
    const awardDuringPlay = await page.$(".screen.active#screen-trophy-award");
    check("テストB: ゲームオーバー確定時点でもプレイ中に獲得通知が発生しない", !awardDuringPlay);

    await clickNext(page); // 「結果を見る」
    await proceedPastNameEntryIfShown(page);
    await page.waitForSelector("#screen-trophy-award.active", { timeout: 5000 });
    const items = await readAwardScreenItems(page);
    const ids = items.map((it) => it.number);
    check("テストB: ゲームオーバー後に#235(やきとり)がまとめて通知される", ids.includes("No.235"));
    const item235 = items.find((it) => it.number === "No.235");
    check("テストB: #235は正式名称「やきとり」で表示される", !!item235 && item235.name === "やきとり");

    await drainTrophyAwardScreens(page);
    const activeAfterDrain = await page.$eval(".screen.active", (el) => el.id);
    check("テストB: 通知を閉じるとゲームオーバーの結果画面に戻る", activeAfterDrain === "screen-findcountry-result");
    check("テストB: #235が実際に獲得済みになっている", (await isEarned(page, "trophy_235")) === true);

    check("テストB: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テストC: 途中中断では通知しないが、獲得状態は保持される
  // ========================================================
  {
    consoleErrors.length = 0;
    const page = await newPage(browser, consoleErrors);
    await startCourse(page, base, 0, 5);

    // 5回連続で誤答し、ライフが残り1になった状態(ゲームオーバー手前)で中断する
    for (let i = 0; i < 4; i++) {
      await tapWrong(page);
      await page.waitForTimeout(120);
      const retryVisible = await page.$("#findcountry-quiz-retry:not(.hidden)");
      if (retryVisible) {
        await page.click("#findcountry-quiz-retry");
        await page.waitForTimeout(100);
      }
    }
    await page.waitForTimeout(150);
    const hiddenIdsBeforeAbandon = await page.evaluate(() => FindCountryModule.getHiddenAwardedIdsThisPlay());
    check("テストC前提: 中断前に何らかの隠しトロフィーの新規獲得は無い(#241罪と罰等は別シナリオのため0件)", Array.isArray(hiddenIdsBeforeAbandon));

    await page.click("#findcountry-quiz-back");
    await page.waitForSelector("#confirm-modal:not(.hidden)", { timeout: 5000 });
    await page.click("#confirm-modal-yes");
    await page.waitForTimeout(300);

    const activeAfterAbandon = await page.$eval(".screen.active", (el) => el.id);
    check("テストC: 中断後は結果画面・獲得演出画面のどちらにも遷移しない", activeAfterAbandon !== "screen-findcountry-result" && activeAfterAbandon !== "screen-trophy-award");
    const awardShown = await page.$(".screen.active#screen-trophy-award");
    check("テストC: 中断時に獲得演出画面が表示されない", !awardShown);

    check("テストC: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テストD1: mid-playの既存即時通知(No.159)が今回の修正後も変わらず
  // 表示されること(新しい合流処理が既存の即時付与経路に影響しないことの確認)
  // ========================================================
  {
    consoleErrors.length = 0;
    const page = await newPage(browser, consoleErrors);
    await startCourse(page, base, 0, 5);

    await tapCorrect(page);
    await page.waitForSelector("#screen-trophy-award.active", { timeout: 5000 });
    const firstAwardItems = await readAwardScreenItems(page);
    check("テストD1: mid-playのNo.159即時通知が今回の修正後も変わらず表示される", firstAwardItems.some((it) => it.number === "No.159"));

    check("テストD1: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テストD2: 隠しトロフィーを何も獲得しないクリアでは、通知内容が既存
  // 35種類のidだけになること(今回の合流処理がidを増やしたり壊したり
  // していないことの確認)。地球儀を温めてから計測することで、
  // ヘッドレス環境特有のコールドスタート遅延による得点異常(1問目だけ
  // 極端に低得点になる)で#246「光と闇」等が誤って混入することを避ける
  // ========================================================
  {
    consoleErrors.length = 0;
    const page = await newPage(browser, consoleErrors);
    await startCourse(page, base, 0, 5);
    await lightlyWarmGlobeThenRestartSameCourse(page);

    // このコースは正解数ベースでクリア判定されるため(パスは消化数に
    // 数えない)、2問正解するたびにパスを挟んで「○問連続」系の隠しトロフィー
    // の連続記録を途切れさせながら、結果画面(クリア確定による獲得演出)に
    // 到達するまで続ける。既存のNo.159はlightlyWarmGlobeThenRestart
    // SameCourse内で既に獲得済みのため、このプレイ中に再度mid-playの
    // 即時通知が割り込むことはない
    let correctStreak = 0;
    for (let i = 0; i < 20; i++) {
      const award = await page.$(".screen.active#screen-trophy-award");
      if (award) break;
      const resultOnly = await page.$(".screen.active#screen-findcountry-result");
      if (resultOnly) break;
      if (correctStreak >= 2) {
        await page.click("#findcountry-quiz-pass");
        correctStreak = 0;
      } else {
        await tapCorrect(page);
        correctStreak += 1;
      }
      await page.waitForTimeout(150);
      await clickNext(page);
      await proceedPastNameEntryIfShown(page);
    }
    await page.waitForSelector("#screen-trophy-award.active", { timeout: 5000 });
    const resultItems = await readAwardScreenItems(page);
    const resultIds = resultItems.map((it) => it.number);
    check("テストD2: 隠しトロフィーを何も獲得しないクリアでは、通知に隠しトロフィー(#195以降)が含まれない", resultIds.every((n) => Number(n.replace("No.", "")) < 195));
    check("テストD2: この場合でも既存のNo.160(はじめての発見)は従来どおり通知される", resultIds.includes("No.160"));

    check("テストD2: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テストE: iPhone幅・PC幅のどちらでも獲得演出画面の表示が崩れない
  // ========================================================
  for (const vp of [{ width: 390, height: 844, label: "iPhone" }, { width: 1280, height: 900, label: "PC" }]) {
    consoleErrors.length = 0;
    const page = await newPage(browser, consoleErrors, { width: vp.width, height: vp.height });
    await startCourse(page, base, 0, 5);
    await lightlyWarmGlobeThenRestartSameCourse(page);

    for (let i = 0; i < 4; i++) {
      await tapCorrect(page);
      await page.waitForTimeout(150);
      await clickNext(page);
    }
    await tapCorrect(page);
    await page.waitForTimeout(200);
    await clickNext(page);
    await proceedPastNameEntryIfShown(page);
    await page.waitForSelector("#screen-trophy-award.active", { timeout: 5000 });

    const overflow = await page.evaluate(() => {
      const el = document.querySelector("#trophy-award-list");
      return el ? el.scrollWidth - el.clientWidth : 0;
    });
    check(`[${vp.label}] 獲得演出一覧が横方向にはみ出していない(overflow=${overflow}px)`, overflow <= 2);
    const itemBoxes = await page.$$eval("#trophy-award-list .trophy-award-item", (els) => els.map((e) => e.getBoundingClientRect().width));
    check(`[${vp.label}] 獲得演出カードが画面幅に収まっている`, itemBoxes.every((w) => w <= vp.width));
    const continueBtnVisible = await page.isVisible("#btn-trophy-award-continue");
    check(`[${vp.label}] 「続ける」ボタンが表示されている`, continueBtnVisible);

    await drainTrophyAwardScreens(page);
    check(`[${vp.label}] コンソール/ページエラーが発生していない`, consoleErrors.length === 0);
    await page.close();
  }

  await browser.close();
  server.close();

  console.log(`\nTotal: ${pass + fail}, Pass: ${pass}, Fail: ${fail}`);
  process.exit(fail > 0 ? 1 : 0);
})();
