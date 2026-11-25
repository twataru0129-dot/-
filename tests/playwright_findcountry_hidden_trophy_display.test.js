// ==========================================================
// 「世界の国どこかな？」隠しトロフィー61種類(#195〜255)の一覧画面表示テスト。
// 未獲得時は既存の隠しトロフィー(def.hidden)と同じ表示仕様
// (「？？？？？？」・🔒アイコン・条件非表示)になり、獲得後は正式名称・
// 条件が表示されることを、実際の一覧画面DOM・実タップ経由の獲得の両方で
// 確認する。実行方法: node tests/playwright_findcountry_hidden_trophy_display.test.js
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

async function openTrophyList(page) {
  await page.click("#btn-trophy-list");
  await page.waitForSelector("#trophy-grid .trophy-card");
  await expandCategorySection(page);
}

// UI刷新: カテゴリー別進捗カードは既定で8枚までの折りたたみ表示になるため、
// findcountry/findcountry_hiddenのように折りたたみ範囲外のカテゴリーを
// クリックする前に「すべて表示」を開いておく(既に展開済みなら何もしない)
async function expandCategorySection(page) {
  const toggle = await page.$("#trophy-category-toggle");
  if (!toggle) return;
  const alreadyExpanded = await toggle.evaluate((el) => el.textContent.includes("少なく"));
  if (!alreadyExpanded) await toggle.click();
}

// UI刷新: 旧#trophy-progress-summary(「🏆 X / Y 件 獲得」)は廃止され、
// 新ヒーローカードの#trophy-hero-earned/#trophy-hero-totalに分かれたため、
// 同じ形式の文字列を組み立てて返す(既存の正規表現マッチをそのまま使う)
async function readTrophyProgressText(page) {
  const earned = (await page.textContent("#trophy-hero-earned")).trim();
  const total = (await page.textContent("#trophy-hero-total")).trim();
  return `🏆 ${earned} / ${total} 件 獲得`;
}

async function openHiddenCategoryTab(page) {
  await page.click('#trophy-category-grid [data-category="findcountry_hidden"]');
  await page.waitForTimeout(150);
}

// 一部の隠しトロフィー61種類の正式名称(各カテゴリーから抜粋)。未獲得時に
// これらの文字列がページ内のどこにも(ツールチップ・title属性含め)
// 出てこないことを確認する用
const SAMPLE_HIDDEN_NAMES = ["エンペラータイム", "やきとり", "グランドスラム", "罪と罰", "光と闇"];

(async () => {
  const consoleErrors = [];
  const browser = await chromium.launch();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/`;

  // ========================================================
  // テスト1: 未獲得状態での一覧表示(フレッシュなlocalStorage)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await page.goto(base, { waitUntil: "load" });
    await openTrophyList(page);

    const totalCount = await page.$$eval("#trophy-grid .trophy-card", (els) => els.length);
    // 謎解きトロフィー第3段階(No.01/02/04の3件)の追加により282件→285件になり、
    // 世界図鑑トロフィー追加分(#259〜262、計4件)により289件になった後、
    // 謎解きトロフィー118問追加(#263〜380、計121件に増加)で412件(286+121)になり、
    // 世界7不思議(7問+隠し特別2種、計9件)の追加で452件になった
    check("テスト1: トロフィー総数が452件(既存189件+隠しトロフィー61件+分割対象32件+謎解き126件+世界図鑑追加4件+世界7不思議9件+共通トロフィー31件)", totalCount === 452);

    const hiddenTab = await page.$('#trophy-category-grid [data-category="findcountry_hidden"]');
    check("テスト1: 「世界の国どこかな？ 隠しトロフィー」カテゴリータブが存在する", !!hiddenTab);

    await openHiddenCategoryTab(page);
    const hiddenCardsAll = await page.$$eval(
      '#trophy-grid .trophy-card[data-category="findcountry_hidden"]:not(.hidden)',
      (els) => els.map((e) => ({
        number: e.querySelector(".trophy-number").textContent.trim(),
        name: e.querySelector(".trophy-name").textContent.trim(),
        hasCond: !!e.querySelector(".trophy-cond"),
        icon: e.querySelector(".trophy-mark-icon") ? e.querySelector(".trophy-mark-icon").textContent.trim() : null,
        dateText: e.querySelector(".trophy-mark-date") ? e.querySelector(".trophy-mark-date").textContent.trim() : null,
        isSecretClass: e.classList.contains("trophy-card-secret"),
      }))
    );
    check("テスト1: 隠しトロフィー61件が一覧に表示される", hiddenCardsAll.length === 61);
    // 世界7不思議Ⅰ「暗号作戦634」の手がかりとして、No.220「東京スカイツリー」
    // だけは例外的に名称・条件を常時公開する(他の60件は従来どおり伏せる)
    const no220Card = hiddenCardsAll.find((c) => c.number === "No.220");
    check("テスト1: No.220のみ名称が常時公開されている", !!no220Card && no220Card.name === "東京スカイツリー");
    check("テスト1: No.220のみ獲得条件(.trophy-cond)が常時公開されている", !!no220Card && no220Card.hasCond);
    const hiddenCards = hiddenCardsAll.filter((c) => c.number !== "No.220");
    check("テスト1: No.220を除く60件が「？？？？？？」表示になっている", hiddenCards.every((c) => c.name === "？？？？？？"));
    check("テスト1: No.220を除く60件で獲得条件(.trophy-cond)が表示されない", hiddenCards.every((c) => !c.hasCond));
    check("テスト1: No.220を除く60件がtrophy-card-secretクラスを持つ(未発見の見た目)", hiddenCards.every((c) => c.isSecretClass));
    check("テスト1: No.220を除く60件のアイコンが🔒(鍵マーク)になっている", hiddenCards.every((c) => c.icon === "🔒"));
    check("テスト1: No.220を除く60件が「未発見」表記になっている", hiddenCards.every((c) => c.dateText === "未発見"));

    // 正式名称・条件が、タイトル属性等を含めページ上のどこにも漏れていないこと
    const bodyHtml = await page.content();
    SAMPLE_HIDDEN_NAMES.forEach((name) => {
      check(`テスト1: 未獲得の正式名称「${name}」がページ内に一切出現しない`, !bodyHtml.includes(name));
    });

    // 既存の「世界の国どこかな？」専用36種類(非隠し)の表示に影響がないこと
    await page.click('#trophy-category-grid [data-category="findcountry"]');
    await page.waitForTimeout(150);
    const normalCards = await page.$$eval(
      '#trophy-grid .trophy-card[data-category="findcountry"]:not(.hidden)',
      (els) => els.map((e) => ({ name: e.querySelector(".trophy-name").textContent.trim(), secret: e.classList.contains("trophy-card-secret") }))
    );
    check("テスト1: 既存findcountry専用36件の表示件数が変わっていない", normalCards.length === 36);
    check("テスト1: 既存findcountry専用36件は正式名称のまま表示される(隠し扱いされていない)", normalCards.every((c) => c.name !== "？？？？？？" && !c.secret));

    // 進捗表示(🏆 X / 452 件 獲得)が新しい総数に追従していること
    const progressText = await readTrophyProgressText(page);
    check("テスト1: 進捗表示が「/ 452 件」になっている", /\/\s*452\s*件/.test(progressText || ""));

    check("テスト1: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト2: 実タップ経由で隠しトロフィー#235「やきとり」を獲得し、
  // 獲得後は正式名称・条件・アイコンが表示されること、通知が出ないこと、
  // 再読み込み後も保持されることを確認する
  // ========================================================
  {
    consoleErrors.length = 0;
    const page = await newPage(browser, consoleErrors);
    await page.goto(base, { waitUntil: "load" });

    // 獲得前の進捗件数を記録
    await openTrophyList(page);
    const before = await readTrophyProgressText(page);
    const beforeCount = Number((before || "").match(/🏆\s*(\d+)/)?.[1] || "-1");
    await page.click(".trophy-list-header .btn-back");
    await page.waitForTimeout(150);

    // 初級5問コースで、1問も正解せず5回連続で誤答してゲームオーバーにする
    // (#235「やきとり」: 1問も正解しないままライフが0になりゲームオーバー)
    await page.click("#btn-mode-findcountry");
    await page.waitForSelector("#screen-findcountry-difficulty.active");
    const cards = await page.$$("#findcountry-difficulty-options .difficulty-card");
    await cards[0].click();
    await page.waitForSelector("#screen-findcountry-count.active");
    const countCards = await page.$$("#findcountry-count-options .count-card");
    await countCards[0].click();
    await page.waitForSelector("#screen-map.findcountry-mode", { timeout: 15000 });
    await page.waitForSelector("#map-globe-container canvas", { timeout: 15000 });
    await page.waitForTimeout(400);

    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        const correctId = FindCountryModule.getCurrentCountryId();
        const wrongId = correctId === "jp" ? "fr" : "jp";
        FindCountryModule.simulateTapForTest(wrongId);
      });
      await page.waitForTimeout(120);
      const retryVisible = await page.$("#findcountry-quiz-retry:not(.hidden)");
      if (retryVisible) {
        await page.click("#findcountry-quiz-retry");
        await page.waitForTimeout(100);
      }
    }
    await page.waitForTimeout(200);

    const gameOverNoAward = await page.$(".screen.active#screen-trophy-award");
    check("テスト2: #235獲得時もプレイ中に獲得通知が表示されない", !gameOverNoAward);

    const earned235 = await page.evaluate(() => TrophyModule.isEarned("trophy_235"));
    check("テスト2: 実タップ経由で#235が獲得される(ゲームオーバー確定時点、結果画面を待たず即時保存)", earned235 === true);

    // 一覧画面で正式名称・条件・アイコンが表示されることを確認する
    // (ページを再読込して確実にホーム画面から一覧を開く)
    await page.goto(base, { waitUntil: "load" });
    await openTrophyList(page);
    await openHiddenCategoryTab(page);
    const card235Info = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('#trophy-grid .trophy-card'));
      const target = cards.find((c) => c.querySelector(".trophy-number") && c.querySelector(".trophy-number").textContent.trim() === "No.235");
      if (!target) return null;
      return {
        name: target.querySelector(".trophy-name").textContent.trim(),
        hasCond: !!target.querySelector(".trophy-cond"),
        condText: target.querySelector(".trophy-cond") ? target.querySelector(".trophy-cond").textContent.trim() : null,
        isSecret: target.classList.contains("trophy-card-secret"),
        icon: target.querySelector(".trophy-mark-icon") ? target.querySelector(".trophy-mark-icon").textContent.trim() : null,
      };
    });
    check("テスト2: 獲得後は#235カードがtrophy-card-secretクラスを持たない", !!card235Info && card235Info.isSecret === false);
    check("テスト2: 獲得後は正式名称「やきとり」が表示される", !!card235Info && card235Info.name === "やきとり");
    check("テスト2: 獲得後は獲得条件が表示される", !!card235Info && card235Info.hasCond && card235Info.condText.includes("ゲームオーバー"));
    check("テスト2: 獲得後はアイコンが🔒ではない", !!card235Info && card235Info.icon !== "🔒");

    // 進捗件数がちょうど1件増えていること
    const after = await readTrophyProgressText(page);
    const afterCount = Number((after || "").match(/🏆\s*(\d+)/)?.[1] || "-1");
    check("テスト2: 進捗の獲得件数がちょうど1件増えている", afterCount === beforeCount + 1);

    // 再読み込み後も獲得状態が保持されること
    await page.reload({ waitUntil: "load" });
    const earned235AfterReload = await page.evaluate(() => TrophyModule.isEarned("trophy_235"));
    check("テスト2: 再読み込み後も#235の獲得状態がTrophyModule.isEarned()で保持される", earned235AfterReload === true);
    await openTrophyList(page);
    await openHiddenCategoryTab(page);
    const card235AfterReload = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('#trophy-grid .trophy-card'));
      const target = cards.find((c) => c.querySelector(".trophy-number") && c.querySelector(".trophy-number").textContent.trim() === "No.235");
      return target ? target.querySelector(".trophy-name").textContent.trim() : null;
    });
    check("テスト2: 再読み込み後も一覧で正式名称「やきとり」が表示される", card235AfterReload === "やきとり");

    check("テスト2: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  await browser.close();
  server.close();

  console.log(`\nTotal: ${pass + fail}, Pass: ${pass}, Fail: ${fail}`);
  process.exit(fail > 0 ? 1 : 0);
})();
