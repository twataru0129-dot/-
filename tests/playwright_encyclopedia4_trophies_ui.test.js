// ==========================================================
// 世界図鑑トロフィー追加分(No.259〜262)のUI統合テスト。
// 静的ファイルをローカルHTTPサーバーで配信し、Playwright(Chromium)で
// 実際の画面操作(地図専用地域の閲覧・検索からの詳細閲覧・地図連携・
// 他トロフィーの集計)を再現して確認する。
// 30件・18件まとめて必要な箇所は、既存テスト(playwright_encyclopedia_smoke等)
// と同じく直接Storage/TrophyModuleを呼んで状態を作った上で、最後の1件だけ
// 実際のUI操作(クリック)で獲得をトリガーし、本番の通知経路まで確認する。
// 実行方法: node tests/playwright_encyclopedia4_trophies_ui.test.js
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
  const page = await browser.newPage();
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  return page;
}

async function dismissAwardIfShown(page) {
  let dismissed = false;
  for (let i = 0; i < 10; i++) {
    const active = await page.$eval(".screen.active", (el) => el.id);
    if (active === "screen-trophy-award") {
      await page.click("#btn-trophy-award-continue");
      await page.waitForTimeout(100);
      dismissed = true;
    } else if (active === "screen-trophy-legend") {
      await page.click("#btn-trophy-legend-continue");
      await page.waitForTimeout(100);
      dismissed = true;
    } else {
      break;
    }
  }
  return dismissed;
}

// カードをクリックして詳細画面を開く。既存の他トロフィー(#143「はじめての
// 探検」等)が同じ操作で新規獲得になり、通知(screen-trophy-award)が割り込む
// ケースがあるため、先に「通知 or 詳細」のどちらかを待ち、通知が出ていれば
// 片付けてから詳細画面に進む。戻り値は、この操作で通知が表示されたかどうか
async function openDetailAndSettle(page, selector) {
  await page.click(selector);
  await page.waitForSelector("#screen-trophy-award.active, #screen-encyclopedia-detail.active", { timeout: 15000 });
  // 獲得通知はsetTimeout(0)で次のティックに遅延発火するため、詳細画面が
  // 先に(同期的に)表示された直後の一瞬だけを見て判定しないよう、既存の
  // #154テストと同じく少し待ってから最終的な画面を確認する
  await page.waitForTimeout(250);
  const activeNow = await page.$eval(".screen.active", (el) => el.id);
  const awardShown = activeNow === "screen-trophy-award";
  await dismissAwardIfShown(page);
  await page.waitForSelector("#screen-encyclopedia-detail.active", { timeout: 10000 });
  return awardShown;
}

async function openTrophyList(page) {
  await page.evaluate(() => showScreen("screen-top"));
  await page.click("#btn-trophy-list");
  await page.waitForSelector("#trophy-grid .trophy-card");
}

async function openEncyclopedia(page) {
  await page.evaluate(() => showScreen("screen-top"));
  await page.click("#btn-mode-encyclopedia");
  await page.waitForSelector("#screen-encyclopedia-list.active");
}

(async () => {
  const server = await startServer();
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}/`;
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", headless: true, args: ["--headless", "--no-sandbox"] });

  // ======================================================
  // テスト1: 初期状態の表示(一覧タブ件数・4件の名称/条件/未獲得表記)
  // ======================================================
  {
    const consoleErrors = [];
    const page = await newPage(browser, consoleErrors);
    await page.goto(base, { waitUntil: "load" });
    await openTrophyList(page);

    const encTab = await page.$('#trophy-category-tabs [data-category="encyclopedia"]');
    check("テスト1: 「世界図鑑」カテゴリータブが存在する", !!encTab);
    await encTab.click();
    await page.waitForTimeout(150);

    const NEW_TROPHY_NAMES = ["未知なる領域の探究者", "世界を結ぶ地図師", "知識の道しるべ", "世界の大賢者"];
    const encCards = await page.$$eval(
      '#trophy-grid [data-category="encyclopedia"]',
      (els) => els.map((e) => ({
        name: e.querySelector(".trophy-name").textContent.trim(),
        cond: e.querySelector(".trophy-cond") ? e.querySelector(".trophy-cond").textContent.trim() : null,
        locked: e.classList.contains("locked"),
      }))
    );
    const newCards = encCards.filter((c) => NEW_TROPHY_NAMES.includes(c.name));
    check("テスト1: 新規4件のカードが世界図鑑タブに存在する", newCards.length === 4);
    check(
      "テスト1: 新規4件は名称がマスクされず正式名称で表示される(通常の図鑑トロフィーと同じ扱い)",
      newCards.every((c) => c.name !== "？？？？？？" && c.name.length > 0)
    );
    check("テスト1: 新規4件は未獲得状態(lockedクラス)で表示される", newCards.every((c) => c.locked));
    check("テスト1: 新規4件は獲得条件(.trophy-cond)が表示される", newCards.every((c) => !!c.cond));
    const names = newCards.map((c) => c.name).sort();
    check(
      "テスト1: 4件の名称が仕様どおり(未知なる領域の探究者/世界を結ぶ地図師/知識の道しるべ/世界の大賢者)",
      JSON.stringify(names) === JSON.stringify(NEW_TROPHY_NAMES.slice().sort())
    );

    check("テスト1: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ======================================================
  // テスト2: #259「未知なる領域の探究者」— 地図専用18地域をすべて閲覧
  // ======================================================
  {
    const consoleErrors = [];
    const page = await newPage(browser, consoleErrors);
    await page.goto(base, { waitUntil: "load" });
    await openEncyclopedia(page);
    await page.click("#ency-tab-region");
    await page.waitForTimeout(150);

    const regionIds = await page.$$eval("#ency-grid .ency-card", (els) => els.map((e) => e.dataset.id));
    check("テスト2(前提): 「その他の地域」タブに18件のカードがある", regionIds.length === 18);

    // 17件まで開く(まだ未獲得のはず)
    for (let i = 0; i < 17; i++) {
      await openDetailAndSettle(page, `.ency-card[data-id="${regionIds[i]}"]`);
      await page.click("#btn-ency-detail-back");
      await page.waitForSelector("#screen-encyclopedia-list.active");
    }
    const countAfter17 = await page.evaluate(() => Storage.getEncyclopediaRegionVisitedCount());
    check("テスト2: 17件閲覧した時点でカウントが17", countAfter17 === 17);
    const earnedAfter17 = await page.evaluate(() => TrophyModule.isEarned("trophy_259"));
    check("テスト2: 17件の時点では#259は未獲得", earnedAfter17 === false);

    // 同じ地域を再訪しても増えない(重複防止)
    await openDetailAndSettle(page, `.ency-card[data-id="${regionIds[0]}"]`);
    await page.click("#btn-ency-detail-back");
    await page.waitForSelector("#screen-encyclopedia-list.active");
    const countAfterDup = await page.evaluate(() => Storage.getEncyclopediaRegionVisitedCount());
    check("テスト2: 既に閲覧済みの地域を再訪してもカウントが増えない(17のまま)", countAfterDup === 17);

    // 18件目(未訪問)を開いて獲得をトリガー
    const awardShown = await openDetailAndSettle(page, `.ency-card[data-id="${regionIds[17]}"]`);
    check("テスト2: 18件目の閲覧で獲得通知画面が表示される", awardShown);
    const earnedAfter18 = await page.evaluate(() => TrophyModule.isEarned("trophy_259"));
    check("テスト2: 18件すべて閲覧後、#259が獲得済みになる", earnedAfter18 === true);

    // 再読み込み後も保持されること
    await page.reload({ waitUntil: "load" });
    const earnedAfterReload = await page.evaluate(() => TrophyModule.isEarned("trophy_259"));
    check("テスト2: 再読み込み後も#259の獲得状態が保持される", earnedAfterReload === true);
    const countAfterReload = await page.evaluate(() => Storage.getEncyclopediaRegionVisitedCount());
    check("テスト2: 再読み込み後も地域閲覧カウントが18のまま保持される", countAfterReload === 18);

    check("テスト2: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ======================================================
  // テスト3: #261「知識の道しるべ」— 検索結果から異なる30件の詳細を開く
  // ======================================================
  {
    const consoleErrors = [];
    const page = await newPage(browser, consoleErrors);
    await page.goto(base, { waitUntil: "load" });
    await openEncyclopedia(page);

    // 検索しただけ(詳細を開かない)ではカウントされないこと
    await page.fill("#ency-search-input", "日本");
    await page.waitForTimeout(150);
    const countAfterSearchOnly = await page.evaluate(() => Storage.getEncyclopediaSearchOpenedCount());
    check("テスト3: 検索しただけ(詳細を開いていない)ではカウントされない", countAfterSearchOnly === 0);

    // 検索結果から実際に詳細を開くとカウントされること
    // (jpは初めて開く国のため、#143「はじめての探検」の通知が割り込む)
    await openDetailAndSettle(page, '#ency-grid .ency-card[data-id="jp"]');
    const countAfterFirstOpen = await page.evaluate(() => Storage.getEncyclopediaSearchOpenedCount());
    check("テスト3: 検索結果から詳細を開くと1件カウントされる", countAfterFirstOpen === 1);
    await page.click("#btn-ency-detail-back");
    await page.waitForSelector("#screen-encyclopedia-list.active");
    await page.click("#ency-search-clear");

    // 検索をクリアして通常一覧から同じ国(jp)を開いても、既に検索経由で
    // 開いているため重複カウントされないこと
    await openDetailAndSettle(page, '#ency-grid .ency-card[data-id="jp"]');
    const countAfterNormalReopen = await page.evaluate(() => Storage.getEncyclopediaSearchOpenedCount());
    check("テスト3: 同じ国を通常一覧(検索なし)から開いても重複カウントされない", countAfterNormalReopen === 1);
    await page.click("#btn-ency-detail-back");
    await page.waitForSelector("#screen-encyclopedia-list.active");

    // 残り28件を直接Storageで積み増す(実際の1件ずつの挙動は上で確認済み。
    // ここでは30件到達時の自動獲得だけを本物のUI操作で確認する)
    const otherIds = await page.evaluate(() =>
      COUNTRIES.map((c) => c.id).filter((id) => id !== "jp").slice(0, 28)
    );
    await page.evaluate((ids) => {
      ids.forEach((id) => Storage.recordEncyclopediaSearchOpened(id));
    }, otherIds);
    const countAfter29 = await page.evaluate(() => Storage.getEncyclopediaSearchOpenedCount());
    check("テスト3: 29件まで積み増した時点でカウントが29", countAfter29 === 29);
    const earnedAt29 = await page.evaluate(() => TrophyModule.isEarned("trophy_261"));
    check("テスト3: 29件の時点では#261は未獲得", earnedAt29 === false);

    // 30件目を検索結果から実際に開いて獲得をトリガー
    await page.fill("#ency-search-input", "アメリカ");
    await page.waitForTimeout(150);
    const usCard = await page.$('#ency-grid .ency-card[data-id="us"]');
    check("テスト3(前提): 「アメリカ」検索でアメリカのカードが見つかる", !!usCard);
    if (usCard) {
      // usも初めて開く国のため、#143の通知が先に割り込んでから#261が
      // 続けて表示される可能性がある(dismissAwardIfShownは複数件を
      // 連続して片付けられる実装のため、ここでは最終的にawardedIdsで
      // #261自体の獲得を確認する)
      await openDetailAndSettle(page, '#ency-grid .ency-card[data-id="us"]');
    }
    const earnedAfter30 = await page.evaluate(() => TrophyModule.isEarned("trophy_261"));
    check("テスト3: 30件到達で#261が獲得済みになる", earnedAfter30 === true);

    await page.reload({ waitUntil: "load" });
    const earnedAfterReload = await page.evaluate(() => TrophyModule.isEarned("trophy_261"));
    check("テスト3: 再読み込み後も#261の獲得状態が保持される", earnedAfterReload === true);

    check("テスト3: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ======================================================
  // テスト4: #260「世界を結ぶ地図師」— 図鑑→地図連携で異なる30件を確認
  // (記録メカニズム自体は既存#154/#155と共有。しきい値30だけを確認する)
  // ======================================================
  {
    const consoleErrors = [];
    const page = await newPage(browser, consoleErrors);
    await page.goto(base, { waitUntil: "load" });
    await openEncyclopedia(page);

    const ids29 = await page.evaluate(() => COUNTRIES.map((c) => c.id).slice(0, 29));
    await page.evaluate((ids) => { ids.forEach((id) => Storage.recordEncyclopediaMapChecked(id)); }, ids29);
    const countAfter29 = await page.evaluate(() => Storage.getEncyclopediaMapCheckedCount());
    check("テスト4: 29件まで積み増した時点でカウントが29", countAfter29 === 29);
    const earnedAt29 = await page.evaluate(() => TrophyModule.isEarned("trophy_260"));
    check("テスト4: 29件の時点では#260は未獲得", earnedAt29 === false);

    // 既存#154(1件)・#155(50件)としきい値が違うだけで判定経路は共通のため、
    // 30件目は実際の図鑑→地図連携の操作で獲得をトリガーする
    const thirtiethId = await page.evaluate(() => COUNTRIES.map((c) => c.id)[29]);
    // thirtiethIdも初めて開く国のため、#143「はじめての探検」の通知が割り込む
    await openDetailAndSettle(page, `#ency-grid .ency-card[data-id="${thirtiethId}"]`);
    const mapLinkBtn = await page.$("#ency-detail-map-btn");
    check("テスト4(前提): 詳細画面に「地図で場所を見る」ボタンがある", !!mapLinkBtn);
    if (mapLinkBtn) {
      await mapLinkBtn.click();
      // 既存#154と同じく、地図連携での獲得判定は地球儀の非同期初期化後に
      // 発火するため、通知(screen-trophy-award)が地図画面より先に割り込む
      await page.waitForSelector("#screen-map.active, #screen-trophy-award.active", { timeout: 20000 });
      await page.waitForTimeout(500);
      await dismissAwardIfShown(page);
      await page.waitForSelector("#screen-map.active", { timeout: 20000 });
      await page.click("#btn-map-back");
      await page.waitForSelector("#screen-encyclopedia-detail.active", { timeout: 20000 });
    }
    const countAfter30 = await page.evaluate(() => Storage.getEncyclopediaMapCheckedCount());
    check("テスト4: 30件目を図鑑→地図連携で確認するとカウントが30になる", countAfter30 === 30);
    const earnedAfter30 = await page.evaluate(() => TrophyModule.isEarned("trophy_260"));
    check("テスト4: 30件到達で#260が獲得済みになる", earnedAfter30 === true);

    check("テスト4: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ======================================================
  // テスト5: #262「世界の大賢者」— 他の世界図鑑トロフィー19種類すべて獲得
  // ======================================================
  {
    const consoleErrors = [];
    const page = await newPage(browser, consoleErrors);
    await page.goto(base, { waitUntil: "load" });
    await openEncyclopedia(page);

    // 既存16件(#143〜158)のうち15件だけを直接獲得させ、259〜261も獲得させる
    await page.evaluate(() => {
      for (let n = 143; n <= 157; n++) TrophyModule.awardIfNew(`trophy_${n}`);
      MAP_ONLY_REGIONS.forEach((r) => Storage.recordEncyclopediaRegionVisit(r.id));
      COUNTRIES.slice(0, 30).forEach((c) => { Storage.recordEncyclopediaSearchOpened(c.id); Storage.recordEncyclopediaMapChecked(c.id); });
      TrophyModule.evaluateEncyclopediaVisit();
    });
    const earned259to261 = await page.evaluate(() => [259, 260, 261].every((n) => TrophyModule.isEarned(`trophy_${n}`)));
    check("テスト5(前提): #259〜261がこの時点で獲得済みになっている", earned259to261);
    const earned15Existing = await page.evaluate(() => {
      const nums = [];
      for (let n = 143; n <= 157; n++) nums.push(n);
      return nums.every((n) => TrophyModule.isEarned(`trophy_${n}`));
    });
    check("テスト5(前提): 既存#143〜157(15件)が獲得済みになっている", earned15Existing);
    const earned262Before = await page.evaluate(() => TrophyModule.isEarned("trophy_262"));
    check("テスト5: 残り1件(#158)が未獲得の時点では#262はまだ獲得されない", earned262Before === false);

    // 最後の1件(#158)を獲得させ、同じevaluateパスで#262も自動獲得されることを確認
    const awardedIds = await page.evaluate(() => {
      TrophyModule.awardIfNew("trophy_158");
      const r = TrophyModule.evaluateEncyclopediaVisit();
      return r && r.awardedIds;
    });
    check("テスト5: #158獲得と同じevaluateパスで#262も即座に獲得される", Array.isArray(awardedIds) && awardedIds.includes("trophy_262"));
    const earned262After = await page.evaluate(() => TrophyModule.isEarned("trophy_262"));
    check("テスト5: 19種類すべて獲得後、#262(世界の大賢者)が獲得済みになる", earned262After === true);

    // 冪等性: 再度評価しても二重付与やエラーが起きない
    const secondEval = await page.evaluate(() => TrophyModule.evaluateEncyclopediaVisit());
    check("テスト5: 獲得済みの状態で再評価しても追加の獲得が発生しない(冪等性)", !secondEval.awardedIds || secondEval.awardedIds.length === 0);

    await page.reload({ waitUntil: "load" });
    const earnedAfterReload = await page.evaluate(() => TrophyModule.isEarned("trophy_262"));
    check("テスト5: 再読み込み後も#262の獲得状態が保持される", earnedAfterReload === true);

    check("テスト5: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ======================================================
  // テスト6: #262の否定ケース(19種類のうち1つでも欠けると獲得しない)
  // ======================================================
  {
    const consoleErrors = [];
    const page = await newPage(browser, consoleErrors);
    await page.goto(base, { waitUntil: "load" });
    await openEncyclopedia(page);
    await page.evaluate(() => {
      // 既存16件のうち158だけをわざと外す(15件のみ獲得)
      for (let n = 143; n <= 157; n++) TrophyModule.awardIfNew(`trophy_${n}`);
      MAP_ONLY_REGIONS.forEach((r) => Storage.recordEncyclopediaRegionVisit(r.id));
      COUNTRIES.slice(0, 30).forEach((c) => { Storage.recordEncyclopediaSearchOpened(c.id); Storage.recordEncyclopediaMapChecked(c.id); });
      TrophyModule.evaluateEncyclopediaVisit();
    });
    const earned262 = await page.evaluate(() => TrophyModule.isEarned("trophy_262"));
    check("テスト6: 19種類のうち#158が欠けている間は#262が獲得されない", earned262 === false);
    check("テスト6: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ======================================================
  // テスト7: 既存機能への影響がないこと(簡易スモーク)
  // ======================================================
  {
    const consoleErrors = [];
    const page = await newPage(browser, consoleErrors);
    await page.goto(base, { waitUntil: "load" });
    await page.click("#btn-mode-flag");
    await page.waitForSelector("#screen-select.active", { timeout: 10000 });
    const activeAfterFlag = await page.$eval(".screen.active", (el) => el.id);
    check("テスト7: 国旗クイズ画面(問題数選択)への遷移が従来どおり機能する", activeAfterFlag === "screen-select");
    check("テスト7: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ======================================================
  // テスト8: レスポンシブ表示(iPhone SE/iPad/PC)で新規4件のカードが
  // 画面幅に収まり、テキストが見切れていないこと
  // ======================================================
  {
    const consoleErrors = [];
    const viewports = [
      { label: "iPhone SE", width: 375, height: 667 },
      { label: "iPad", width: 768, height: 1024 },
      { label: "PC", width: 1280, height: 800 },
    ];
    for (const vp of viewports) {
      const page = await newPage(browser, consoleErrors);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(base, { waitUntil: "load" });
      await openTrophyList(page);
      const encTab = await page.$('#trophy-category-tabs [data-category="encyclopedia"]');
      await encTab.click();
      await page.waitForTimeout(150);

      const newTrophyNames = ["未知なる領域の探究者", "世界を結ぶ地図師", "知識の道しるべ", "世界の大賢者"];
      const boxes = await page.$$eval(
        '#trophy-grid [data-category="encyclopedia"]',
        (els, names) => els
          .filter((e) => names.includes(e.querySelector(".trophy-name").textContent.trim()))
          .map((e) => e.getBoundingClientRect())
          .map((r) => ({ right: r.right, left: r.left, width: r.width })),
        newTrophyNames
      );
      const noOverflow = boxes.every((b) => b.right <= vp.width + 1 && b.left >= -1);
      check(`[${vp.label}] 新規4件のカードが画面右端からはみ出していない`, noOverflow);

      const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
      check(`[${vp.label}] ページ全体に横スクロールが発生していない`, !hasHorizontalScroll);
      await page.close();
    }
    check("テスト8: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
  }

  await browser.close();
  server.close();

  console.log(`\nTotal: ${pass + fail}, Pass: ${pass}, Fail: ${fail}`);
  process.exit(fail > 0 ? 1 : 0);
})();
