// ==========================================================
// トロフィー一覧画面: No.1〜19を国旗クイズ・首都クイズの完全に独立した
// 2枚のカードに分割する表示修正と、集計方式A案(269件)の統合テスト。
// 実行方法: node tests/playwright_trophy_dual_split_cards.test.js
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

async function openTrophyList(page) {
  await page.click("#btn-trophy-list");
  await page.waitForSelector("#trophy-grid .trophy-card");
}

async function openCategory(page, categoryId) {
  await page.click(`#trophy-category-tabs [data-category="${categoryId}"]`);
  await page.waitForTimeout(150);
}

async function readProgressCards(page) {
  return page.evaluate(() => {
    const pairs = Array.from(document.querySelectorAll('#trophy-grid .trophy-dual-pair'));
    return pairs.map((pair) => {
      const sides = Array.from(pair.querySelectorAll('.trophy-card-split')).map((c) => ({
        number: c.querySelector('.trophy-number') ? c.querySelector('.trophy-number').textContent.trim() : null,
        modeBadge: c.querySelector('.trophy-split-mode-badge') ? c.querySelector('.trophy-split-mode-badge').textContent.trim() : null,
        name: c.querySelector('.trophy-name') ? c.querySelector('.trophy-name').textContent.trim() : null,
        cond: c.querySelector('.trophy-cond') ? c.querySelector('.trophy-cond').textContent.trim() : null,
        earned: c.dataset.earned === 'true',
        dateText: c.querySelector('.trophy-mark-date') ? c.querySelector('.trophy-mark-date').textContent.trim() : null,
        hidden: c.classList.contains('hidden'),
      }));
      return { pairHidden: pair.classList.contains('hidden'), sides };
    });
  });
}

(async () => {
  const consoleErrors = [];
  const browser = await chromium.launch();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/`;

  // ========================================================
  // テスト1: 初期状態(すべて未獲得)でNo.1〜19が19組・38枚の分割カードに
  // なっていること、進捗表示が269件になっていること
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await page.goto(base, { waitUntil: "load" });
    await openTrophyList(page);

    const progressText = await page.textContent("#trophy-progress-summary");
    check("テスト1: 進捗表示の分母が269件になっている", /\/\s*269\s*件/.test(progressText || ""));
    check("テスト1: 初期状態の獲得数は0件", /🏆\s*0\s*\/\s*269/.test(progressText || ""));

    await openCategory(page, "progress");
    const totalSplitCards = await page.$$eval('#trophy-grid .trophy-card-split', (els) => els.length);
    check("テスト1: 「挑戦の記録」カテゴリーに分割カードが38枚(19組×2)ある", totalSplitCards === 38);
    const pairCount = await page.$$eval('#trophy-grid .trophy-dual-pair', (els) => els.length);
    check("テスト1: .trophy-dual-pairラッパーが19組ある", pairCount === 19);

    const resultCountText = await page.textContent("#trophy-result-count");
    check("テスト1: 「○件を表示中」が38件になっている", resultCountText.includes("38件"));

    const cards = await readProgressCards(page);
    const no1 = cards.find((p) => p.sides[0].number === "No.1");
    check("テスト1: No.1の1枚目が国旗クイズカード", !!no1 && no1.sides[0].modeBadge === "国旗クイズ");
    check("テスト1: No.1の2枚目が首都クイズカード", !!no1 && no1.sides[1].modeBadge === "首都クイズ");
    check("テスト1: No.1の2枚目も番号はNo.1のまま(振り直しをしない)", !!no1 && no1.sides[1].number === "No.1");
    check("テスト1: No.1の国旗・首都は両方とも未獲得", !!no1 && !no1.sides[0].earned && !no1.sides[1].earned);
    check("テスト1: No.1の両方の名称・条件が一致している", !!no1 && no1.sides[0].name === no1.sides[1].name && no1.sides[0].cond === no1.sides[1].cond);
    check("テスト1: No.1の国旗・首都は「未獲得」表記", !!no1 && no1.sides[0].dateText === "未獲得" && no1.sides[1].dateText === "未獲得");

    check("テスト1: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト2: No.1は国旗のみ、No.5は国旗・首都の両方を獲得した状態での
  // 表示・フィルター動作を確認する(既存の獲得判定・保存キーは変更せず、
  // TrophyModule.awardIfNew()を直接呼んで状態だけ用意する)
  // ========================================================
  {
    consoleErrors.length = 0;
    const page = await newPage(browser, consoleErrors);
    await page.goto(base, { waitUntil: "load" });
    await page.evaluate(() => {
      TrophyModule.awardIfNew("trophy_1", "flag");
      TrophyModule.awardIfNew("trophy_5", "flag");
      TrophyModule.awardIfNew("trophy_5", "capital");
    });
    await page.reload({ waitUntil: "load" });

    await openTrophyList(page);
    const progressText = await page.textContent("#trophy-progress-summary");
    check("テスト2: 獲得数が3件(No.1国旗+No.5両方)になっている", /🏆\s*3\s*\/\s*269/.test(progressText || ""));

    await openCategory(page, "progress");
    const cards = await readProgressCards(page);
    const no1 = cards.find((p) => p.sides[0].number === "No.1");
    const no5 = cards.find((p) => p.sides[0].number === "No.5");
    check("テスト2: No.1は国旗側だけ獲得済み", !!no1 && no1.sides[0].earned === true && no1.sides[1].earned === false);
    check("テスト2: No.1の獲得日時がYYYY.MM.DD形式で表示される", !!no1 && /^\d{4}\.\d{2}\.\d{2}\s*取得$/.test(no1.sides[0].dateText || ""));
    check("テスト2: No.5は国旗・首都の両方が獲得済み", !!no5 && no5.sides[0].earned === true && no5.sides[1].earned === true);

    // 獲得済みフィルター: No.1の国旗側・No.5の両側=3枚だけが表示される
    await page.click('#trophy-status-filter [data-status="earned"]');
    await page.waitForTimeout(150);
    const earnedVisible = await page.$$eval('#trophy-grid .trophy-card-split:not(.hidden)', (els) => els.length);
    check("テスト2: 「獲得済み」フィルターで3枚だけ表示される", earnedVisible === 3);
    const earnedCountText = await page.textContent("#trophy-result-count");
    check("テスト2: 「獲得済み」時の表示件数が3件になっている", earnedCountText.includes("3件"));
    const no1EarnedFilterState = await page.evaluate(() => {
      const pairs = Array.from(document.querySelectorAll('#trophy-grid .trophy-dual-pair'));
      const target = pairs.find((p) => {
        const num = p.querySelector('.trophy-number');
        return num && num.textContent.trim() === 'No.1';
      });
      if (!target) return null;
      const sides = Array.from(target.querySelectorAll('.trophy-card-split'));
      return {
        pairHidden: target.classList.contains('hidden'),
        flagHidden: sides[0].classList.contains('hidden'),
        capitalHidden: sides[1].classList.contains('hidden'),
      };
    });
    check("テスト2: No.1のペア全体は非表示にならない(国旗側が表示対象のため)", !!no1EarnedFilterState && no1EarnedFilterState.pairHidden === false);
    check("テスト2: No.1の国旗側は表示される", !!no1EarnedFilterState && no1EarnedFilterState.flagHidden === false);
    check("テスト2: No.1の首都側は非表示になる(未獲得のため)", !!no1EarnedFilterState && no1EarnedFilterState.capitalHidden === true);

    // 未獲得フィルター: 38-3=35枚が表示される。No.1の首都側は表示され、国旗側は表示されない
    await page.click('#trophy-status-filter [data-status="locked"]');
    await page.waitForTimeout(150);
    const lockedVisible = await page.$$eval('#trophy-grid .trophy-card-split:not(.hidden)', (els) => els.length);
    check("テスト2: 「未獲得」フィルターで35枚表示される(38-3)", lockedVisible === 35);
    const no1LockedFilterState = await page.evaluate(() => {
      const pairs = Array.from(document.querySelectorAll('#trophy-grid .trophy-dual-pair'));
      const target = pairs.find((p) => {
        const num = p.querySelector('.trophy-number');
        return num && num.textContent.trim() === 'No.1';
      });
      if (!target) return null;
      const sides = Array.from(target.querySelectorAll('.trophy-card-split'));
      return { flagHidden: sides[0].classList.contains('hidden'), capitalHidden: sides[1].classList.contains('hidden') };
    });
    check("テスト2: 未獲得フィルターでNo.1国旗側は非表示", !!no1LockedFilterState && no1LockedFilterState.flagHidden === true);
    check("テスト2: 未獲得フィルターでNo.1首都側は表示される", !!no1LockedFilterState && no1LockedFilterState.capitalHidden === false);

    // すべてフィルターに戻す
    await page.click('#trophy-status-filter [data-status="all"]');
    await page.waitForTimeout(150);

    check("テスト2: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト3: No.20以降(他のmode==="both"のデュアルトロフィーを含む
  // 「地域制覇」カテゴリー、#30〜39)は分割されず、従来どおり1枚の
  // カードに2つの達成マークが並ぶ表示のままであること(回帰確認)
  // ========================================================
  {
    consoleErrors.length = 0;
    const page = await newPage(browser, consoleErrors);
    await page.goto(base, { waitUntil: "load" });
    await openTrophyList(page);
    await openCategory(page, "region");

    // .trophy-dual-pair自体はNo.1〜19分で常にDOM上に19組存在するため
    // (カテゴリー絞り込みでは.hiddenが付与されるだけ)、「表示中(非hidden)の
    // ペアが無いこと」を確認する
    const visibleDualPairCount = await page.$$eval('#trophy-grid .trophy-dual-pair:not(.hidden)', (els) => els.length);
    check("テスト3: 「地域制覇」カテゴリーに表示中の分割カード(.trophy-dual-pair)が無い", visibleDualPairCount === 0);
    const normalCardCount = await page.$$eval('#trophy-grid .trophy-card:not(.hidden)', (els) => els.length);
    check("テスト3: 「地域制覇」カテゴリーは従来どおり10枚(#30〜39)のまま", normalCardCount === 10);
    const visibleDualMarksCount = await page.$$eval('#trophy-grid .trophy-card:not(.hidden) .trophy-marks-dual', (els) => els.length);
    check("テスト3: #30〜39は従来どおり1枚のカードに2つの達成マーク(.trophy-marks-dual)が並ぶ", visibleDualMarksCount === 10);

    check("テスト3: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト4: 320/375/390/430px(スマホ)・768px(iPad)・1280px(PC)の
  // いずれでも、分割カードが横はみ出し・重なりなく表示され、
  // 2枚の高さが揃っていること
  // ========================================================
  const viewports = [
    { width: 320, height: 700, label: "320px" },
    { width: 375, height: 700, label: "375px" },
    { width: 390, height: 844, label: "390px" },
    { width: 430, height: 900, label: "430px" },
    { width: 768, height: 1024, label: "iPad" },
    { width: 1280, height: 900, label: "PC" },
  ];
  for (const vp of viewports) {
    consoleErrors.length = 0;
    const page = await newPage(browser, consoleErrors, { width: vp.width, height: vp.height });
    await page.goto(base, { waitUntil: "load" });
    await openTrophyList(page);
    await openCategory(page, "progress");

    const noHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
    check(`[${vp.label}] ページ全体に横スクロールが発生していない`, noHorizontalScroll);

    const pairMetrics = await page.$$eval('#trophy-grid .trophy-dual-pair', (pairs, viewportWidth) => pairs.map((pair) => {
      const pairBox = pair.getBoundingClientRect();
      const sides = Array.from(pair.querySelectorAll('.trophy-card-split')).map((s) => s.getBoundingClientRect());
      return {
        pairRight: pairBox.right,
        sideHeights: sides.map((s) => s.height),
        sideWidthsSum: sides.reduce((sum, s) => sum + s.width, 0),
        pairWidth: pairBox.width,
      };
    }), vp.width);

    const anyOverflow = pairMetrics.some((m) => m.pairRight > vp.width + 1);
    check(`[${vp.label}] 分割カードのペアが画面右端からはみ出していない`, !anyOverflow);

    const anyHeightMismatch = pairMetrics.some((m) => Math.abs(m.sideHeights[0] - m.sideHeights[1]) > 1);
    check(`[${vp.label}] 2枚のカードの高さが揃っている`, !anyHeightMismatch);

    const anyWidthOverflow = pairMetrics.some((m) => m.sideWidthsSum > m.pairWidth + 2);
    check(`[${vp.label}] 2枚合わせた幅がペアの幅に収まっている(重なりなし)`, !anyWidthOverflow);

    check(`[${vp.label}] コンソール/ページエラーが発生していない`, consoleErrors.length === 0);
    await page.close();
  }

  await browser.close();
  server.close();

  console.log(`\nTotal: ${pass + fail}, Pass: ${pass}, Fail: ${fail}`);
  process.exit(fail > 0 ? 1 : 0);
})();
