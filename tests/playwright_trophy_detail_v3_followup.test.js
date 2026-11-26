// ==========================================================
// PR#89フォロー(第3ラウンド)専用テスト:
// ①獲得条件・説明文等の左揃え/未獲得カードの視認性
// ②下位カテゴリーが1種類以下のときの選択欄非表示(共通ルール)
// ③詳細モーダルの再構成(重複表示の排除・非公開情報の非漏洩)
// 実行方法: node tests/playwright_trophy_detail_v3_followup.test.js
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
  return page;
}

async function openTrophyList(page, base) {
  await page.goto(base, { waitUntil: "load" });
  await page.click("#btn-trophy-list");
  await page.waitForSelector("#trophy-grid .trophy-card");
}

async function openByTrophyId(page, id) {
  await page.evaluate((id) => {
    document.querySelector(`#trophy-grid .trophy-card[data-trophy-id="${id}"]`).click();
  }, id);
  await page.waitForSelector("#trophy-detail-modal:not(.hidden)", { timeout: 5000 });
  await page.waitForTimeout(100);
}
async function closeModal(page) {
  await page.click("#trophy-detail-close");
  await page.waitForSelector("#trophy-detail-modal", { state: "hidden" });
}

(async () => {
  const consoleErrors = [];
  const browser = await chromium.launch();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/`;

  // ========================================================
  // テスト1: 下位カテゴリーが1種類以下のとき選択欄が非表示になる
  // (謎解き・世界7不思議は、上位分類そのものが単一の内部カテゴリーと
  // 1対1対応するため、実質的な下位カテゴリーが1種類しかない)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await openTrophyList(page, base);

    await page.click('#trophy-bucket-grid [data-bucket="puzzle"]');
    await page.waitForTimeout(150);
    let hidden = await page.evaluate(() => document.getElementById("trophy-subcategory-row").classList.contains("hidden"));
    let childCount = await page.evaluate(() => document.getElementById("trophy-subcategory-row").children.length);
    check("テスト1: 「謎解き」は下位カテゴリー選択欄が非表示", hidden === true);
    check("テスト1: 「謎解き」は選択欄の中身も空(余白が残らない)", childCount === 0);
    let visibleCount = await page.$$eval("#trophy-grid .trophy-card", (els) => els.filter((e) => !e.classList.contains("hidden")).length);
    check("テスト1: 「謎解き」は絞り込みなしで127件表示", visibleCount === 127);

    await page.click('#trophy-bucket-grid [data-bucket="sevenWonders"]');
    await page.waitForTimeout(150);
    hidden = await page.evaluate(() => document.getElementById("trophy-subcategory-row").classList.contains("hidden"));
    check("テスト1: 「世界7不思議」も下位カテゴリー選択欄が非表示(同じ共通ルール)", hidden === true);
    visibleCount = await page.$$eval("#trophy-grid .trophy-card", (els) => els.filter((e) => !e.classList.contains("hidden")).length);
    check("テスト1: 「世界7不思議」は絞り込みなしで8件表示", visibleCount === 8);

    check("テスト1: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト2: 下位カテゴリーが2種類以上のときは従来どおり表示される
  // (回帰確認: どこかな？・世界図鑑・共通)
  // ========================================================
  {
    consoleErrors.length = 0;
    const page = await newPage(browser, consoleErrors);
    await openTrophyList(page, base);

    await page.click('#trophy-bucket-grid [data-bucket="findcountry"]');
    await page.waitForTimeout(150);
    let hidden = await page.evaluate(() => document.getElementById("trophy-subcategory-row").classList.contains("hidden"));
    let chipCount = await page.$$eval("#trophy-subcategory-row .trophy-subcategory-chip", (els) => els.length);
    check("テスト2: 「どこかな？」は下位カテゴリー選択欄が表示される", hidden === false);
    check("テスト2: 「どこかな？」の下位チップは「すべて」+2種類=3個", chipCount === 3);

    await page.click('#trophy-bucket-grid [data-bucket="common"]');
    await page.waitForTimeout(150);
    hidden = await page.evaluate(() => document.getElementById("trophy-subcategory-row").classList.contains("hidden"));
    chipCount = await page.$$eval("#trophy-subcategory-row .trophy-subcategory-chip", (els) => els.length);
    check("テスト2: 「共通」は下位カテゴリー選択欄が表示される", hidden === false);
    check("テスト2: 「共通」の下位チップは「すべて」+2グループ=3個", chipCount === 3);
    const labels = await page.$$eval("#trophy-subcategory-row .trophy-subcategory-chip .trophy-category-chip-label", (els) => els.map((e) => e.textContent));
    check("テスト2: 「共通」の下位グループが国旗・首都共通/全体共通", labels.includes("国旗・首都共通") && labels.includes("全体共通"));

    check("テスト2: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト3: カテゴリー切り替え時に古い下位カテゴリーの絞り込みが残らない
  // (findcountry_hiddenを選んだ状態のまま謎解きへ切り替えても127件表示)
  // ========================================================
  {
    consoleErrors.length = 0;
    const page = await newPage(browser, consoleErrors);
    await openTrophyList(page, base);

    await page.click('#trophy-bucket-grid [data-bucket="findcountry"]');
    await page.waitForTimeout(150);
    await page.click('#trophy-subcategory-row [data-category="findcountry_hidden"]');
    await page.waitForTimeout(150);
    let visibleCount = await page.$$eval("#trophy-grid .trophy-card", (els) => els.filter((e) => !e.classList.contains("hidden")).length);
    check("テスト3: findcountry_hidden選択直後は61件", visibleCount === 61);

    await page.click('#trophy-bucket-grid [data-bucket="puzzle"]');
    await page.waitForTimeout(150);
    visibleCount = await page.$$eval("#trophy-grid .trophy-card", (els) => els.filter((e) => !e.classList.contains("hidden")).length);
    check("テスト3: 謎解きへ切り替えると、古い下位カテゴリー絞り込みが残らず127件表示", visibleCount === 127);

    check("テスト3: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト4: 全体452件・上位8分類の件数は従来どおり(表示専用の
  // 再構成が集計ロジックに影響していないことの回帰確認)
  // ========================================================
  {
    consoleErrors.length = 0;
    const page = await newPage(browser, consoleErrors);
    await openTrophyList(page, base);
    const totalCount = await page.$$eval("#trophy-grid .trophy-card", (els) => els.length);
    check("テスト4: トロフィー総数452件", totalCount === 452);
    const counts = {};
    for (const b of ["all", "flag", "capital", "findcountry", "encyclopedia", "puzzle", "sevenWonders", "common"]) {
      counts[b] = await page.$eval(`#trophy-bucket-grid [data-bucket="${b}"] .trophy-category-chip-count`, (el) => el.textContent.trim());
    }
    check("テスト4: すべて=0 / 452", counts.all === "0 / 452");
    check("テスト4: 国旗=0 / 67", counts.flag === "0 / 67");
    check("テスト4: 首都=0 / 68", counts.capital === "0 / 68");
    check("テスト4: どこかな？=0 / 97", counts.findcountry === "0 / 97");
    check("テスト4: 世界図鑑=0 / 20", counts.encyclopedia === "0 / 20");
    check("テスト4: 謎解き=0 / 127", counts.puzzle === "0 / 127");
    check("テスト4: 世界7不思議=0 / 8", counts.sevenWonders === "0 / 8");
    check("テスト4: 共通=0 / 65", counts.common === "0 / 65");
    check("テスト4: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト5: 詳細モーダルで情報が重複表示されない・左揃えになっている
  // ========================================================
  {
    consoleErrors.length = 0;
    const page = await newPage(browser, consoleErrors);
    await openTrophyList(page, base);

    const ids = await page.evaluate(() => {
      const defs = TrophyModule.getAllDefinitions();
      return {
        puzzle: defs.find((d) => d.category === "puzzle" && !d.hidden).id,
        hidden: defs.find((d) => d.hidden === true).id,
        common: defs.find((d) => d.category === "common").id,
        legend142: "trophy_142",
      };
    });

    // 未獲得の標準カード: 旧statusBadge/categoryElが廃止され、重複が無いこと
    await openByTrophyId(page, ids.common);
    let dup = await page.evaluate(() => ({
      statusBadge: !!document.querySelector(".trophy-detail-status"),
      categoryEl: !!document.querySelector(".trophy-detail-category"),
      categoryBadgeCount: document.querySelectorAll("#trophy-detail-body .trophy-category-badge").length,
      condAlign: (() => { const el = document.querySelector("#trophy-detail-body .trophy-cond"); return el ? getComputedStyle(el).textAlign : null; })(),
    }));
    check("テスト5: 旧statusBadge要素が存在しない(重複排除)", dup.statusBadge === false);
    check("テスト5: 旧categoryEl要素が存在しない(重複排除)", dup.categoryEl === false);
    check("テスト5: カテゴリーバッジはモーダル内に1つだけ", dup.categoryBadgeCount === 1);
    check("テスト5: モーダル内の獲得条件は左揃え", dup.condAlign === "left");
    await closeModal(page);

    // 謎解き未獲得: 問題文が左揃え、挑戦ボタンが末尾にあり機能する
    await openByTrophyId(page, ids.puzzle);
    const puzzleInfo = await page.evaluate(() => {
      const q = document.querySelector("#trophy-detail-body .trophy-puzzle-question");
      const btn = document.querySelector("#trophy-detail-body .btn-puzzle-challenge");
      return {
        qAlign: q ? getComputedStyle(q).textAlign : null,
        hasBtn: !!btn,
        btnIsLastChild: btn ? btn === btn.parentElement.lastElementChild : false,
      };
    });
    check("テスト5: 謎解きの問題文は左揃え", puzzleInfo.qAlign === "left");
    check("テスト5: 「この謎に挑む」ボタンが存在する", puzzleInfo.hasBtn === true);
    await page.click("#trophy-detail-body .btn-puzzle-challenge");
    await page.waitForSelector("#screen-puzzle-flag-select.active", { timeout: 5000 });
    check("テスト5: 挑戦ボタンから国旗選択画面へ遷移する", true);
    const modalClosedAfterChallenge = await page.evaluate(() => document.getElementById("trophy-detail-modal").classList.contains("hidden"));
    check("テスト5: 挑戦開始時にモーダルが閉じている", modalClosedAfterChallenge === true);
    await page.evaluate(() => showScreen("screen-top"));
    await page.click("#btn-trophy-list");
    await page.waitForSelector("#trophy-grid .trophy-card");

    // 隠しトロフィー未発見: 情報パネル自体が存在しない(非公開情報ゼロ)
    await openByTrophyId(page, ids.hidden);
    const hiddenLeak = await page.evaluate(() => ({
      hasInfoPanel: !!document.querySelector("#trophy-detail-body .trophy-detail-info"),
      nameText: document.querySelector("#trophy-detail-body .trophy-name").textContent.trim(),
      bodyHtmlHasCond: document.getElementById("trophy-detail-body").innerHTML.includes("trophy-cond"),
    }));
    check("テスト5: 未発見の隠しトロフィーは詳細情報パネル自体が出ない", hiddenLeak.hasInfoPanel === false);
    check("テスト5: 未発見の隠しトロフィーの名前は？？？？？？のまま", hiddenLeak.nameText === "？？？？？？");
    check("テスト5: 未発見の隠しトロフィーに.trophy-cond自体が出力されていない", hiddenLeak.bodyHtmlHasCond === false);
    await closeModal(page);

    // #142(legend)獲得済み: 専用デザインのクラスが維持されている
    await page.evaluate((ids) => { TrophyModule.awardIfNew(ids.legend142); }, ids);
    await page.evaluate(() => renderTrophyListScreen());
    await openByTrophyId(page, ids.legend142);
    const legendClassOk = await page.evaluate(() => {
      const content = document.querySelector("#trophy-detail-body .trophy-detail-content");
      return content ? content.classList.contains("trophy-card-legend") : false;
    });
    check("テスト5: #142の詳細モーダルでも専用デザインクラス(trophy-card-legend)が維持される", legendClassOk === true);
    await closeModal(page);

    check("テスト5: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト6: 未獲得カードの文字コントラスト(カード全体へのopacity/filterを
  // 廃止し、アイコンのみ減光する)
  // ========================================================
  {
    consoleErrors.length = 0;
    const page = await newPage(browser, consoleErrors);
    await openTrophyList(page, base);
    const style = await page.evaluate(() => {
      const card = document.querySelector("#trophy-grid .trophy-card.locked");
      const mark = card.querySelector(".trophy-mark.locked");
      const cs = getComputedStyle(card);
      const markCs = getComputedStyle(mark);
      return { cardOpacity: cs.opacity, cardFilter: cs.filter, markFilter: markCs.filter };
    });
    check("テスト6: 未獲得カード自体のopacityは1(文字を薄くしない)", style.cardOpacity === "1");
    check("テスト6: 未獲得カード自体にfilterがかかっていない", style.cardFilter === "none");
    check("テスト6: アイコン(.trophy-mark.locked)にはgrayscaleがかかっている", style.markFilter.includes("grayscale"));

    check("テスト6: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  await browser.close();
  server.close();

  console.log(`\nTotal: ${pass + fail}, Pass: ${pass}, Fail: ${fail}`);
  process.exitCode = fail > 0 ? 1 : 0;
})();
