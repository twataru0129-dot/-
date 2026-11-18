// ==========================================================
// 世界地図モード限定: イギリス4構成国(イングランド・スコットランド・
// ウェールズ・北アイルランド)の表示機能のテスト。
//
// 対象: js/map.js(isUkOverlayActiveNow()による世界地図モード限定の
// 表示制御)・js/map-uk-regions.js(表示専用の境界線・ラベル位置データ)・
// index.html/css/map.css(紹介カード内セクション・ラベル/指示線レイヤー)。
//
// 最重要確認事項: この機能が「世界の国どこかな？」(findcountry.js)の
// 出題・タップ判定・トロフィー・コレクションに一切影響しないこと。
// 実行方法: node tests/playwright_map_uk_constituents.test.js
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
  const page = await browser.newPage({ viewport: viewport || { width: 390, height: 844 } });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  return page;
}

async function openMapAndSelectUk(page) {
  await page.click("#btn-mode-map");
  await page.waitForSelector("#map-globe-container canvas", { timeout: 15000 });
  await page.waitForTimeout(3200);
  await page.fill("#map-search-input", "イギリス");
  await page.waitForTimeout(300);
  await page.click("#map-search-results li, #map-search-results button");
  await page.waitForTimeout(1800);
}

(async () => {
  const consoleErrors = [];
  const browser = await chromium.launch();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/`;

  // ========================================================
  // テスト1: 世界地図モードでイギリス未選択時は、既存の表示のまま
  // (4構成国の境界線・名称・紹介カード内セクションは一切見えない)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await page.goto(base, { waitUntil: "load" });
    await page.click("#btn-mode-map");
    await page.waitForSelector("#map-globe-container canvas", { timeout: 15000 });
    await page.waitForTimeout(3200);

    const linesHidden = await page.$eval("#map-uk-region-lines", (el) => el.classList.contains("hidden"));
    check("テスト1: 未選択時は境界線オーバーレイが非表示", linesHidden);
    const labelsHidden = await page.$eval("#map-uk-region-labels", (el) => el.classList.contains("hidden"));
    check("テスト1: 未選択時は名称ラベルオーバーレイが非表示", labelsHidden);
    const sectionHidden = await page.$eval("#map-uk-constituents-section", (el) => el.classList.contains("hidden"));
    check("テスト1: 未選択時は紹介カード内セクションが非表示", sectionHidden);

    check("テスト1: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト2: イギリスを選択すると、4構成国の境界線・名称ラベル・
  // 紹介カード内セクション(4枚のカード)が表示される
  // ========================================================
  {
    consoleErrors.length = 0;
    const page = await newPage(browser, consoleErrors);
    await page.goto(base, { waitUntil: "load" });
    await openMapAndSelectUk(page);

    const linesVisible = await page.$eval("#map-uk-region-lines", (el) => !el.classList.contains("hidden"));
    check("テスト2: イギリス選択時は境界線オーバーレイが表示される", linesVisible);
    const labelsVisible = await page.$eval("#map-uk-region-labels", (el) => !el.classList.contains("hidden"));
    check("テスト2: イギリス選択時は名称ラベルオーバーレイが表示される", labelsVisible);
    const labelTexts = await page.$$eval("#map-uk-region-labels .map-uk-region-label:not(.hidden)", (els) => els.map((e) => e.textContent).sort());
    check(
      "テスト2: 4つの名称ラベル(イングランド・スコットランド・ウェールズ・北アイルランド)が揃っている",
      JSON.stringify(labelTexts) === JSON.stringify(["イングランド", "ウェールズ", "スコットランド", "北アイルランド"].sort())
    );

    const sectionVisible = await page.$eval("#map-uk-constituents-section", (el) => !el.classList.contains("hidden"));
    check("テスト2: 紹介カード内セクションが表示される", sectionVisible);
    const cardCount = await page.$$eval("#map-uk-constituents-grid .map-uk-constituent-card", (els) => els.length);
    check("テスト2: 構成国カードが4枚ある", cardCount === 4);
    const capitalTexts = await page.$$eval("#map-uk-constituents-grid .map-uk-constituent-capital", (els) => els.map((e) => e.textContent));
    check(
      "テスト2: 各カードの首都表示が正しい(ロンドン・エディンバラ・カーディフ・ベルファスト)",
      capitalTexts.some((t) => t.includes("ロンドン")) &&
        capitalTexts.some((t) => t.includes("エディンバラ")) &&
        capitalTexts.some((t) => t.includes("カーディフ")) &&
        capitalTexts.some((t) => t.includes("ベルファスト"))
    );
    // 北アイルランドには現在、独自の単一の公式な地域旗が無いため、歴史的な
    // アルスター・バナー(assets/flags/gb-nir-ulster-banner.svg)を、現在の
    // 公式旗ではないことを明記したうえで表示する
    const niFlagImg = await page.$('#map-uk-constituents-grid .map-uk-constituent-card[data-uk-constituent-key="northern_ireland"] .map-uk-constituent-flag');
    check("テスト2: 北アイルランドも旗画像(<img>)で表示される", !!niFlagImg);
    const niFlagSrc = niFlagImg ? await niFlagImg.getAttribute("src") : "";
    check("テスト2: 北アイルランドの旗はアルスター・バナーのSVG", niFlagSrc.includes("gb-nir-ulster-banner.svg"));
    const niFlagAlt = niFlagImg ? await niFlagImg.getAttribute("alt") : "";
    check("テスト2: 北アイルランドの旗のalt文言に「歴史的」が含まれる(現在の公式旗ではないことの明示)", niFlagAlt.includes("歴史的"));
    const ukNote = await page.$eval(".map-uk-constituents-note", (el) => el.textContent);
    check(
      "テスト2: アルスター・バナーについての補足説明が表示される",
      ukNote.includes("現在") && ukNote.includes("公式旗") && ukNote.includes("アルスター・バナー") && ukNote.includes("歴史的")
    );

    // イギリス自体の基本情報(国旗・国名・首都・解説・図鑑ボタン)は
    // 既存どおり表示されている(今回の追加で消えていないことの回帰確認)
    const gbName = await page.$eval("#map-card-name", (el) => el.textContent.trim());
    check("テスト2: イギリス自体の国名表示は従来どおり", gbName === "イギリス");
    const encyclopediaBtnVisible = await page.$eval("#map-card-encyclopedia-btn", (el) => !el.classList.contains("hidden") && el.offsetParent !== null);
    check("テスト2: 「世界図鑑で見る」ボタンは従来どおり表示されている", encyclopediaBtnVisible);

    check("テスト2: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト3: 構成国カードをタップすると、その国だけが個別に選択状態
  // (aria-pressed/selectedクラス)になり、再タップで解除される
  // ========================================================
  {
    consoleErrors.length = 0;
    const page = await newPage(browser, consoleErrors, { width: 1280, height: 900 });
    await page.goto(base, { waitUntil: "load" });
    await openMapAndSelectUk(page);

    await page.click('button[data-uk-constituent-key="scotland"]');
    await page.waitForTimeout(1000);
    let selected = await page.$eval('button[data-uk-constituent-key="scotland"]', (el) => el.classList.contains("selected") && el.getAttribute("aria-pressed") === "true");
    check("テスト3: スコットランドをタップすると選択状態になる", selected);
    let othersNotSelected = await page.$$eval(
      '#map-uk-constituents-grid .map-uk-constituent-card:not([data-uk-constituent-key="scotland"])',
      (els) => els.every((e) => !e.classList.contains("selected"))
    );
    check("テスト3: 他の3カードは選択状態にならない", othersNotSelected);

    // 他国を選んでいないので、イギリス全体の選択(紹介カード)は維持されたまま
    const gbStillOpen = await page.$eval("#map-info-card", (el) => el.classList.contains("open"));
    check("テスト3: 個別選択中もイギリスの紹介カード自体は閉じない", gbStillOpen);

    // もう一度同じカードをタップすると個別選択が解除される(イギリス全体の
    // 表示=境界線・名称ラベルは維持されたまま)
    await page.click('button[data-uk-constituent-key="scotland"]');
    await page.waitForTimeout(500);
    selected = await page.$eval('button[data-uk-constituent-key="scotland"]', (el) => el.classList.contains("selected"));
    check("テスト3: 再タップで個別選択が解除される", !selected);
    const linesStillVisible = await page.$eval("#map-uk-region-lines", (el) => !el.classList.contains("hidden"));
    check("テスト3: 個別選択を解除しても境界線・名称ラベルは表示されたまま", linesStillVisible);

    // 別の構成国(ウェールズ)をタップすると、選択がそちらへ切り替わる
    await page.click('button[data-uk-constituent-key="wales"]');
    await page.waitForTimeout(1000);
    const walesSelected = await page.$eval('button[data-uk-constituent-key="wales"]', (el) => el.classList.contains("selected"));
    const scotlandStillSelected = await page.$eval('button[data-uk-constituent-key="scotland"]', (el) => el.classList.contains("selected"));
    check("テスト3: ウェールズをタップすると選択がウェールズへ切り替わる", walesSelected && !scotlandStillSelected);

    check("テスト3: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト4: 他の国を選択する、または情報カードを閉じると、4構成国の
  // 表示(境界線・名称ラベル・紹介カード内セクション・個別選択状態)が
  // すべて解除される
  // ========================================================
  {
    consoleErrors.length = 0;
    const page = await newPage(browser, consoleErrors);
    await page.goto(base, { waitUntil: "load" });
    await openMapAndSelectUk(page);
    await page.click('button[data-uk-constituent-key="scotland"]');
    await page.waitForTimeout(800);

    // 別の国(フランス)を検索して選択する
    await page.fill("#map-search-input", "フランス");
    await page.waitForTimeout(300);
    await page.click("#map-search-results li, #map-search-results button");
    await page.waitForTimeout(1800);

    const sectionHiddenAfterSwitch = await page.$eval("#map-uk-constituents-section", (el) => el.classList.contains("hidden"));
    check("テスト4: 他国(フランス)を選択するとUK構成国セクションが非表示になる", sectionHiddenAfterSwitch);
    const linesHiddenAfterSwitch = await page.$eval("#map-uk-region-lines", (el) => el.classList.contains("hidden"));
    check("テスト4: 他国選択で境界線オーバーレイも非表示になる", linesHiddenAfterSwitch);
    const labelsHiddenAfterSwitch = await page.$eval("#map-uk-region-labels", (el) => el.classList.contains("hidden"));
    check("テスト4: 他国選択で名称ラベルオーバーレイも非表示になる", labelsHiddenAfterSwitch);
    const franceName = await page.$eval("#map-card-name", (el) => el.textContent.trim());
    check("テスト4: フランス自体は正しく選択されている(既存機能の回帰確認)", franceName === "フランス");

    // 再度イギリスを選び直すと、個別選択(スコットランド)はリセットされ、
    // 4構成国セクションが「全体表示」の状態で出てくる
    await page.fill("#map-search-input", "イギリス");
    await page.waitForTimeout(300);
    await page.click("#map-search-results li, #map-search-results button");
    await page.waitForTimeout(1800);
    const sectionVisibleAgain = await page.$eval("#map-uk-constituents-section", (el) => !el.classList.contains("hidden"));
    check("テスト4: イギリスを選び直すとUK構成国セクションが再表示される", sectionVisibleAgain);
    const noneSelectedFresh = await page.$$eval("#map-uk-constituents-grid .map-uk-constituent-card", (els) => els.every((e) => !e.classList.contains("selected")));
    check("テスト4: 他国を経由して選び直すと、個別選択状態はリセットされている", noneSelectedFresh);

    // 情報カードを閉じても同様に全て解除される
    await page.click("#map-card-close");
    await page.waitForTimeout(500);
    const sectionHiddenAfterClose = await page.$eval("#map-uk-constituents-section", (el) => el.classList.contains("hidden"));
    check("テスト4: 情報カードを閉じるとUK構成国セクションが非表示になる", sectionHiddenAfterClose);
    const linesHiddenAfterClose = await page.$eval("#map-uk-region-lines", (el) => el.classList.contains("hidden"));
    check("テスト4: 情報カードを閉じると境界線オーバーレイも非表示になる", linesHiddenAfterClose);

    check("テスト4: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト5: 世界図鑑との連携は、イギリス自体の「世界図鑑で見る」が
  // 従来どおり"gb"を対象に動作する(構成国専用の図鑑ページは作らない)
  // ========================================================
  {
    consoleErrors.length = 0;
    const page = await newPage(browser, consoleErrors);
    await page.goto(base, { waitUntil: "load" });
    await openMapAndSelectUk(page);

    const detail = await page.evaluate(() => {
      return new Promise((resolve) => {
        document.addEventListener("mapmodule:view-in-encyclopedia", (e) => resolve(e.detail), { once: true });
        document.getElementById("map-card-encyclopedia-btn").click();
      });
    });
    check("テスト5: 「世界図鑑で見る」はイギリス全体(id:gb)を対象にする(構成国個別のidにはならない)", detail && detail.id === "gb");

    check("テスト5: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト6(最重要): 「世界の国どこかな？」への影響が無いことの確認。
  // クイズ中は常にUK構成国の表示が出ない。実際にgbをタップ判定させても
  // (MapModule.selectCountryForQuiz経由でも)表示は一切出ない
  // ========================================================
  {
    consoleErrors.length = 0;
    const page = await newPage(browser, consoleErrors);
    await page.goto(base, { waitUntil: "load" });
    await page.click("#btn-mode-findcountry");
    await page.waitForSelector("#screen-findcountry-difficulty.active");
    const cards = await page.$$("#findcountry-difficulty-options .difficulty-card");
    await cards[0].click();
    await page.waitForSelector("#screen-findcountry-count.active");
    const countCards = await page.$$("#findcountry-count-options .count-card");
    await countCards[0].click();
    await page.waitForSelector("#screen-map.findcountry-mode", { timeout: 15000 });
    await page.waitForSelector("#map-globe-container canvas", { timeout: 15000 });
    await page.waitForTimeout(500);

    let sectionHidden = await page.$eval("#map-uk-constituents-section", (el) => el.classList.contains("hidden"));
    check("テスト6: クイズ出題中、UK構成国セクションは非表示", sectionHidden);
    let linesHidden = await page.$eval("#map-uk-region-lines", (el) => el.classList.contains("hidden"));
    check("テスト6: クイズ出題中、境界線オーバーレイは非表示", linesHidden);

    // 本番のhandleTapと同一経路で"gb"を正解/不正解いずれかとして判定させる。
    // MapModule.selectCountryForQuiz("gb", ...)またはsetQuizResultHighlight()
    // が呼ばれるケースを再現し、イギリスが選択状態になってもUK構成国の
    // 表示が一切出ないことを確認する(モードの判定条件=tapResultHandlerの
    // 有無による明示的な無効化が機能していることの確認)
    await page.evaluate(() => FindCountryModule.simulateTapForTest("gb"));
    await page.waitForTimeout(800);

    sectionHidden = await page.$eval("#map-uk-constituents-section", (el) => el.classList.contains("hidden"));
    check("テスト6: 「gb」を判定させた後もUK構成国セクションは非表示のまま", sectionHidden);
    linesHidden = await page.$eval("#map-uk-region-lines", (el) => el.classList.contains("hidden"));
    check("テスト6: 「gb」を判定させた後も境界線オーバーレイは非表示のまま", linesHidden);
    const labelsHidden = await page.$eval("#map-uk-region-labels", (el) => el.classList.contains("hidden"));
    check("テスト6: 「gb」を判定させた後も名称ラベルオーバーレイは非表示のまま", labelsHidden);
    const infoCardOpen = await page.$eval("#map-info-card", (el) => el.classList.contains("open"));
    check("テスト6: 「gb」を判定させても情報カード自体は開かない(既存仕様どおり正解が見えない)", !infoCardOpen);

    check("テスト6: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト7(最重要): イギリス4構成国のタップ領域を実際にタップしても、
  // 従来どおり"gb"としてだけ正解判定される(構成国が新たな出題対象や
  // 正解対象として扱われることは無い)。地図モードでも同様に、実体は
  // 常に"gb"であることをタップで確認する
  // ========================================================
  {
    consoleErrors.length = 0;
    const page = await newPage(browser, consoleErrors);
    await page.goto(base, { waitUntil: "load" });
    await openMapAndSelectUk(page);

    const anchorLine = await page.$eval(
      '#map-uk-region-lines .map-uk-region-line[data-uk-constituent-key="scotland"]',
      (el) => ({ x1: el.getAttribute("x1"), y1: el.getAttribute("y1") })
    );
    await page.click("#map-card-close");
    await page.waitForTimeout(400);
    // 再度選択し直して(閉じると選択解除されるため)、スコットランドの
    // 実アンカー位置を直接タップする
    await page.fill("#map-search-input", "イギリス");
    await page.waitForTimeout(300);
    await page.click("#map-search-results li, #map-search-results button");
    await page.waitForTimeout(1800);
    await page.click("#map-card-close");
    await page.waitForTimeout(400);

    const wrapRect = await page.$eval(".map-wrap", (el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top };
    });
    await page.mouse.click(wrapRect.left + parseFloat(anchorLine.x1), wrapRect.top + parseFloat(anchorLine.y1));
    await page.waitForTimeout(1000);

    const cardOpen = await page.$eval("#map-info-card", (el) => el.classList.contains("open"));
    check("テスト7: スコットランド領域の直接タップでカードが開く(タップが命中している)", cardOpen);
    const cardName = await page.$eval("#map-card-name", (el) => el.textContent.trim());
    check("テスト7: スコットランド領域を直接タップしても、実体は常に「イギリス」として判定される", cardName === "イギリス");
    const sectionVisible = await page.$eval("#map-uk-constituents-section", (el) => !el.classList.contains("hidden"));
    check("テスト7: 直接タップ後もUK構成国セクションが正しく再表示される", sectionVisible);

    check("テスト7: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト8: レスポンシブ表示(スマホ320〜430px・iPad・PC)で、文字切れ・
  // カードの重なり・横スクロールが発生しない
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
    await openMapAndSelectUk(page);

    const noHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
    check(`テスト8[${vp.label}]: ページ全体に横スクロールが発生していない`, noHorizontalScroll);

    // 4枚のカードが、情報カード(縦はスクロール可、横幅は固定)の幅に
    // きちんと収まっている(右端があふれていない)ことを確認する
    const cardOverflow = await page.evaluate(() => {
      const panel = document.getElementById("map-info-card");
      const panelRect = panel.getBoundingClientRect();
      const cards = Array.from(document.querySelectorAll("#map-uk-constituents-grid .map-uk-constituent-card"));
      return cards.some((c) => c.getBoundingClientRect().right > panelRect.right + 1);
    });
    check(`テスト8[${vp.label}]: 構成国カードが紹介カードの幅からはみ出していない`, !cardOverflow);

    // カード同士が重なっていないか(2列×2行なので、同じ行の2枚のleft/rightが
    // 交差しない、異なる行同士が縦に重ならないことを簡易に確認する)
    const cardRects = await page.$$eval("#map-uk-constituents-grid .map-uk-constituent-card", (els) =>
      els.map((e) => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; })
    );
    let anyOverlap = false;
    for (let i = 0; i < cardRects.length; i++) {
      for (let j = i + 1; j < cardRects.length; j++) {
        const a = cardRects[i], b = cardRects[j];
        const overlapX = a.left < b.right - 1 && b.left < a.right - 1;
        const overlapY = a.top < b.bottom - 1 && b.top < a.bottom - 1;
        if (overlapX && overlapY) anyOverlap = true;
      }
    }
    check(`テスト8[${vp.label}]: 構成国カード同士が重なっていない`, !anyOverlap);

    // 名称・首都のテキストが要素の中に収まっている(スクロール幅が
    // クライアント幅を超えていない=はみ出し折り返しできている)ことを確認
    const textOverflow = await page.$$eval(
      "#map-uk-constituents-grid .map-uk-constituent-name, #map-uk-constituents-grid .map-uk-constituent-capital",
      (els) => els.some((e) => e.scrollWidth > e.clientWidth + 2)
    );
    check(`テスト8[${vp.label}]: 構成国名・首都の文字が要素内に収まっている(文字切れなし)`, !textOverflow);

    check(`テスト8[${vp.label}]: コンソール/ページエラーが発生していない`, consoleErrors.length === 0);
    await page.close();
  }

  await browser.close();
  server.close();

  console.log(`\nTotal: ${pass + fail}, Pass: ${pass}, Fail: ${fail}`);
  process.exit(fail > 0 ? 1 : 0);
})();
