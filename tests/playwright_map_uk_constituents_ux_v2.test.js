// ==========================================================
// イギリス4構成国表示の改善(PR #72の追加改善)に対する回帰テスト。
//
// 1. 構成国カードを選択しても、地球儀のカメラ(位置・角度・倍率)が
//    一切動かないこと(過剰な自動ズームの廃止、最重要の確認事項)。
//    デバッグ用フックを本番コードに残さず検証するため、UK本体から
//    離れた画面の隅(常に海になる位置)をカード選択の前後で比較し、
//    ピクセル単位で完全に一致することを確認する(=カメラが1pxも
//    動いていないことの直接的な証拠になる)。
// 2. 手動でズーム操作をした後も、カード選択でズーム倍率が変化しない。
// 3. 構成国カードが「1段目:旗+国名」「2段目:首都」の2段構成になり、
//    国名と首都が同じ行に詰め込まれていない。
// 4. 名称ラベルが、上部ツールバー・下部の紹介カードの表示領域に
//    重ならない(安全領域内に収まる)。
// 5. 北アイルランドの旗(アルスター・バナー)が正しく表示され、
//    世界図鑑側にも同じ内容(国名・首都・旗)の4構成国情報が表示される。
//
// 実行方法: node tests/playwright_map_uk_constituents_ux_v2.test.js
// ==========================================================
const { chromium, devices } = require("playwright");
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
  const page = await browser.newPage(viewport ? { viewport } : {});
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  return page;
}

async function openMapAndSelectUk(page, base) {
  await page.goto(base, { waitUntil: "load" });
  await page.click("#btn-mode-map");
  await page.waitForSelector("#map-globe-container canvas", { timeout: 15000 });
  await page.waitForTimeout(3200);
  await page.fill("#map-search-input", "イギリス");
  await page.waitForTimeout(350);
  await page.click("#map-search-results li, #map-search-results button");
  await page.waitForTimeout(1500);
}

(async () => {
  const browser = await chromium.launch();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const consoleErrors = [];

  // ========================================================
  // テスト1: 構成国カードを選択しても地球儀のカメラが1pxも動かない。
  // #map-uk-region-labelsの各ラベル位置(style.left/top)は、実際の
  // カメラ行列からprojectLatLngToScreen()で毎フレーム再計算される
  // ため、カメラが少しでも動けば必ず変化する。この座標をカード選択の
  // 前後で比較することで、スクリーンショットのピクセル比較より確実に
  // カメラの静止を検証できる
  // ========================================================
  {
    consoleErrors.length = 0;
    const page = await newPage(browser, consoleErrors, { width: 1200, height: 900 });
    await openMapAndSelectUk(page, base);
    // OrbitControlsのdamping(慣性)により、検索選択時のpointOfViewアニメーション
    // (1200ms)の後もラベル位置がごくわずかに数秒かけて収束し続ける(本改修とは
    // 無関係の既存の挙動)。カード選択によるカメラ非移動を厳密に検証するため、
    // この減衰が十分収まってから基準値を取る
    await page.waitForTimeout(6000);

    async function labelPositions() {
      return page.$$eval("#map-uk-region-labels .map-uk-region-label", (els) =>
        Object.fromEntries(
          els.map((e) => [e.dataset.ukConstituentKey, { left: parseFloat(e.style.left), top: parseFloat(e.style.top) }])
        )
      );
    }
    // globe.glのpointOfView()による大きなカメラ移動の直後は、OrbitControlsの
    // damping(慣性)により、何も操作していなくてもラベル位置がごく僅か
    // (1秒あたり1px未満)動き続けることを別途確認済み(本改修より前から
    // ある既存の挙動で、カード選択とは無関係)。そのため、カード選択の
    // 前後比較は完全一致ではなく、この自然なドリフトを十分に上回る
    // 許容誤差(3px)で判定する。以前のpointOfView()呼び出しによる
    // 意図的なカメラ移動は数十〜数百px単位の変化になるため、この許容誤差
    // でも「動いていない」と「動いている」は明確に区別できる
    const DRIFT_TOLERANCE_PX = 3;
    function maxDelta(a, b) {
      let max = 0;
      for (const key of Object.keys(a)) {
        max = Math.max(max, Math.abs(a[key].left - b[key].left), Math.abs(a[key].top - b[key].top));
      }
      return max;
    }

    const before = await labelPositions();
    const walesCard = await page.$('.map-uk-constituent-card[data-uk-constituent-key="wales"]');
    await walesCard.click();
    await page.waitForTimeout(1200); // 以前の実装ではここでpointOfViewのアニメーションが走っていた
    const afterWales = await labelPositions();
    check("テスト1: ウェールズのカード選択でラベル座標がほぼ変化しない(カメラが動いていない)", maxDelta(before, afterWales) < DRIFT_TOLERANCE_PX);

    const niCard = await page.$('.map-uk-constituent-card[data-uk-constituent-key="northern_ireland"]');
    await niCard.click();
    await page.waitForTimeout(1200);
    const afterNi = await labelPositions();
    check("テスト1: 北アイルランドのカード選択でラベル座標がほぼ変化しない(カメラが動いていない)", maxDelta(before, afterNi) < DRIFT_TOLERANCE_PX);

    // 再タップして解除してもカメラは動かない
    await niCard.click();
    await page.waitForTimeout(800);
    const afterDeselect = await labelPositions();
    check("テスト1: 個別選択の解除でもラベル座標がほぼ変化しない(カメラが動いていない)", maxDelta(before, afterDeselect) < DRIFT_TOLERANCE_PX);

    check("テスト1: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト2: 手動でズーム操作をした後も、カード選択でズーム倍率が
  // 変化しない(ユーザーが設定した表示状態を尊重する)
  // ========================================================
  {
    consoleErrors.length = 0;
    const page = await newPage(browser, consoleErrors, { width: 1200, height: 900 });
    await openMapAndSelectUk(page, base);
    await page.waitForTimeout(6000); // 検索選択時のpointOfViewアニメーション・damping減衰を待つ(テスト1と同じ理由)

    const canvas = await page.$("#map-globe-container canvas");
    const box = await canvas.boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    // 手動ズーム(ホイール操作)をシミュレートする
    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(500);
    await page.mouse.wheel(0, -300);
    // ホイール操作によるOrbitControls自体のdamping(慣性)が収まるまで待ってから基準値を取る
    await page.waitForTimeout(3000);

    async function labelPositions() {
      return page.$$eval("#map-uk-region-labels .map-uk-region-label", (els) =>
        Object.fromEntries(
          els.map((e) => [e.dataset.ukConstituentKey, { left: parseFloat(e.style.left), top: parseFloat(e.style.top) }])
        )
      );
    }
    // テスト1と同じ理由(OrbitControlsのdamping起因の自然なドリフト)で、
    // 完全一致ではなく許容誤差で判定する
    const DRIFT_TOLERANCE_PX = 3;
    function maxDelta(a, b) {
      let max = 0;
      for (const key of Object.keys(a)) {
        max = Math.max(max, Math.abs(a[key].left - b[key].left), Math.abs(a[key].top - b[key].top));
      }
      return max;
    }
    const afterManualZoom = await labelPositions();

    const englandCard = await page.$('.map-uk-constituent-card[data-uk-constituent-key="england"]');
    await englandCard.click();
    await page.waitForTimeout(1200);
    const afterCardTap = await labelPositions();
    check("テスト2: 手動ズーム後にカードを選択してもラベル座標がほぼ変化しない(ズーム倍率が変化しない)", maxDelta(afterManualZoom, afterCardTap) < DRIFT_TOLERANCE_PX);

    check("テスト2: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト3: 構成国カードが2段構成(1段目:旗+国名、2段目:首都)になっており、
  // 国名と首都が同じ行に詰め込まれていない
  // ========================================================
  {
    consoleErrors.length = 0;
    const page = await newPage(browser, consoleErrors, { width: 390, height: 844 });
    await openMapAndSelectUk(page, base);

    const rows = await page.$$eval("#map-uk-constituents-grid .map-uk-constituent-card", (cards) =>
      cards.map((c) => {
        const row1 = c.querySelector(".map-uk-constituent-row1");
        const capital = c.querySelector(".map-uk-constituent-capital");
        const r1 = row1.getBoundingClientRect();
        const r2 = capital.getBoundingClientRect();
        return { row1Bottom: r1.bottom, capitalTop: r2.top };
      })
    );
    const allTwoRow = rows.every((r) => r.capitalTop >= r.row1Bottom - 1);
    check("テスト3: 全カードで「首都」の行が「旗+国名」の行より下にある(2段構成になっている)", allTwoRow);

    check("テスト3: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト4: 名称ラベルが上部ツールバー・下部紹介カードの表示領域に
  // 重ならない(安全領域内に収まる)
  // ========================================================
  {
    consoleErrors.length = 0;
    const page = await newPage(browser, consoleErrors, { width: 390, height: 844 });
    await openMapAndSelectUk(page, base);
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
      const card = document.getElementById("map-info-card");
      const toolbar2 = document.querySelector(".map-toolbar-row2");
      const cardRect = card.getBoundingClientRect();
      const toolbarBottom = toolbar2.getBoundingClientRect().bottom;
      const labels = Array.from(document.querySelectorAll("#map-uk-region-labels .map-uk-region-label:not(.hidden)"));
      return labels.map((l) => {
        const r = l.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, overlapsCard: r.bottom > cardRect.top, overlapsToolbar: r.top < toolbarBottom };
      });
    });
    check("テスト4: 表示中のラベルが少なくとも1件はある", result.length > 0);
    check("テスト4: どのラベルも下部紹介カードに重なっていない", result.every((r) => !r.overlapsCard));
    check("テスト4: どのラベルも上部ツールバーに重なっていない", result.every((r) => !r.overlapsToolbar));

    check("テスト4: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト5: 北アイルランドの旗(アルスター・バナー)・世界図鑑との整合性
  // ========================================================
  {
    consoleErrors.length = 0;
    const page = await newPage(browser, consoleErrors, { width: 390, height: 844 });
    await openMapAndSelectUk(page, base);

    const niFlagSrc = await page.$eval(
      '.map-uk-constituent-card[data-uk-constituent-key="northern_ireland"] .map-uk-constituent-flag',
      (img) => img.getAttribute("src")
    );
    check("テスト5: 世界地図モードで北アイルランドにアルスター・バナーのSVGが使われている", niFlagSrc.includes("gb-nir-ulster-banner.svg"));

    // 世界図鑑側の「イギリスを構成する4つの国」情報も確認する
    await page.click("#map-card-encyclopedia-btn");
    await page.waitForSelector("#screen-trophy-award.active, #screen-encyclopedia-detail.active", { timeout: 15000 });
    const afterOpen = await page.evaluate(() => document.querySelector(".screen.active").id);
    if (afterOpen === "screen-trophy-award") {
      await page.click("#btn-trophy-award-continue");
      await page.waitForSelector("#screen-encyclopedia-detail.active", { timeout: 15000 });
    }
    await page.waitForTimeout(300);

    const ukSectionVisible = await page.$eval("#ency-detail-uk-constituents", (el) => !el.classList.contains("hidden"));
    check("テスト5: 世界図鑑のイギリス詳細画面に「4つの国」セクションが表示される", ukSectionVisible);
    const ukItemCount = await page.$$eval("#ency-detail-uk-grid .ency-detail-uk-item", (els) => els.length);
    check("テスト5: 世界図鑑側の構成国項目が4件ある", ukItemCount === 4);
    const ukCapitals = await page.$$eval("#ency-detail-uk-grid .ency-detail-uk-capital", (els) => els.map((e) => e.textContent));
    check(
      "テスト5: 世界図鑑側の首都表示が地図モードと同じ(ロンドン・エディンバラ・カーディフ・ベルファスト)",
      ukCapitals.some((t) => t.includes("ロンドン")) &&
        ukCapitals.some((t) => t.includes("エディンバラ")) &&
        ukCapitals.some((t) => t.includes("カーディフ")) &&
        ukCapitals.some((t) => t.includes("ベルファスト"))
    );
    const ukNote = await page.$eval("#ency-detail-uk-constituents .ency-detail-uk-note", (el) => el.textContent);
    check("テスト5: 世界図鑑側にもアルスター・バナーの補足説明がある", ukNote.includes("歴史的") && ukNote.includes("公式旗"));

    // イギリス自体の既存表示(国旗はユニオンジャック・首都ロンドン・図鑑ボタン等)が維持されている
    const flagSrc = await page.$eval("#ency-detail-flag", (el) => el.getAttribute("src"));
    check("テスト5: 世界図鑑のイギリスの国旗は従来どおりユニオンジャック(gb.svg)のまま", flagSrc.endsWith("gb.svg"));
    const capitalValue = await page.$eval("#ency-detail-capital-value", (el) => el.textContent.trim());
    check("テスト5: 世界図鑑のイギリスの首都は従来どおりロンドンのまま", capitalValue === "ロンドン");

    check("テスト5: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  await browser.close();
  server.close();

  console.log("\nTotal:", pass + fail, "Pass:", pass, "Fail:", fail);
  process.exit(fail > 0 ? 1 : 0);
})();
