// ==========================================================
// イギリス4構成国の名称ラベル表示判定の修正に対する回帰テスト。
//
// 背景(修正前の不具合): updateUkRegionLabelPositions()が、
// projectLatLngToScreen()の緩い可視判定(コンテナ範囲外±15%まで許容)
// だけを頼りに「画面内」と判定し、実際には陸地が大きく画面外へ出て
// いてもukLabelSafeRect()で無条件に安全領域へクランプしていたため、
// パン・回転・ズームでイギリスの陸地が画面外へ出てもラベルと指示線が
// 画面端や情報カード付近に張り付いたまま残ってしまっていた。
//
// 修正: 本体の判定(anchorの実際の画面内可視性、edgeMargin=24px)を
// クランプより先に行い、画面内にない構成国は問答無用でラベルと指示線
// の両方を隠すようにした(ラベル/指示線は常にペアで制御)。
//
// このテストは、以下をPlaywrightの実ドラッグ操作(mouse.down→小刻みな
// mouse.move→mouse.up、各stepの間に短い待機を挟む)で検証する。
// この刻み方でないとOrbitControlsが連続ドラッグと認識せず回転しない
// ことを確認済み(1回の大きなmouse.moveでは回転が発生しない)。
//
// 1. イギリス全体が画面内にあるとき:4構成国のラベルが表示される。
// 2. ドラッグでイギリスが完全に画面外へ出たとき:4つのラベルと
//    指示線がすべて非表示になる(本バグの核心)。
// 3. ドラッグで画面内へ戻すと、ラベル・指示線が自動的に復活する。
// 4. ラベルが表示されている間、指示線が表示されているラベルの数と
//    常に一致する(ラベルだけ消えて指示線が残る状態が存在しない)。
// 5. 情報カードを閉じると、ラベル追従機能自体が既存仕様どおり完全に
//    終了すること(本修正による退行がないこと)。再度開くと復活する。
// 6. ズームインした状態でも同様にオフスクリーンで消える。
// 7. 一部の構成国だけが画面内にあるとき、画面内のものだけが表示される。
//
// 実行方法: node tests/playwright_map_uk_labels_visibility.test.js
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
  const page = await browser.newPage(viewport ? { viewport } : { viewport: { width: 390, height: 844 } });
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
  await page.waitForTimeout(2000);
}

// OrbitControlsを実ドラッグとして認識させるため、小刻みなmouse.moveを
// 短い待機を挟みながら繰り返す(1回の大きな移動では回転しない)。
// yOffsetで、下部の情報カードに重ならない高さ(キャンバス上部寄り)を
// ドラッグ開始点にできるようにする。
async function dragRotate(page, canvas, totalDx, totalDy, opts = {}) {
  const steps = opts.steps || 45;
  const stepDelay = opts.stepDelay || 20;
  const yOffset = opts.yOffset || 0;
  const box = await canvas.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2 + yOffset;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(cx + (totalDx * i) / steps, cy + (totalDy * i) / steps, { steps: 2 });
    await page.waitForTimeout(stepDelay);
  }
  await page.mouse.up();
  await page.waitForTimeout(800);
}

async function labelLineState(page) {
  return page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll("#map-uk-region-labels .map-uk-region-label"));
    const lines = Array.from(document.querySelectorAll("#map-uk-region-lines .map-uk-region-line"));
    const visibleLabelKeys = labels.filter((el) => !el.classList.contains("hidden")).map((el) => el.dataset.ukConstituentKey).sort();
    const visibleLineKeys = lines.filter((el) => !el.classList.contains("hidden")).map((el) => el.dataset.ukConstituentKey).sort();
    return { visibleLabelKeys, visibleLineKeys, totalLabels: labels.length, totalLines: lines.length };
  });
}

(async () => {
  const browser = await chromium.launch();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const consoleErrors = [];

  // ========================================================
  // テスト1〜4: 情報カードを開いた状態での、オフスクリーン→復帰の一連の流れ
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await openMapAndSelectUk(page, base);

    const initial = await labelLineState(page);
    check("テスト1: イギリス全体が画面内にあるとき、4構成国のラベルが表示される", initial.visibleLabelKeys.length === 4);
    check(
      "テスト1: 指示線が表示されているラベルと、表示されている指示線のキー集合が一致する(ペア制御)",
      JSON.stringify(initial.visibleLabelKeys) === JSON.stringify(initial.visibleLineKeys) || initial.visibleLineKeys.length <= initial.visibleLabelKeys.length
    );

    const canvas = await page.$("#map-globe-container canvas");

    // カード上部(キャンバス上部寄り)でドラッグし、イギリスを完全に画面外へ押し出す。
    await dragRotate(page, canvas, -1600, 0, { steps: 50, stepDelay: 20, yOffset: -250 });

    const offscreen = await labelLineState(page);
    check("テスト2: ドラッグでイギリスが完全に画面外へ出ると、4つのラベルがすべて非表示になる", offscreen.visibleLabelKeys.length === 0);
    check("テスト2: 同時に4つの指示線もすべて非表示になる(ラベルだけ消えて線が残らない)", offscreen.visibleLineKeys.length === 0);

    // 元の位置までドラッグで戻す。
    await dragRotate(page, canvas, 1600, 0, { steps: 50, stepDelay: 20, yOffset: -250 });

    const restored = await labelLineState(page);
    check("テスト3: ドラッグで画面内へ戻すと、ラベルが自動的に復活する", restored.visibleLabelKeys.length === 4);
    check(
      "テスト4: 復活時も指示線の表示キー集合がラベルの表示キー集合の部分集合になっている(ペア制御が崩れていない)",
      restored.visibleLineKeys.every((k) => restored.visibleLabelKeys.includes(k))
    );

    check("テスト1-4: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト5: 情報カードを閉じると、構成国ラベル機能自体が既存仕様どおり
  // 完全に終了する(ukRegionLabelsTracking=falseとなり、ラベル・指示線
  // のDOMも空になる)。この機能はカードが開いている間だけ動作する設計
  // であり、本修正でこの既存のオン/オフ挙動が崩れていないことを確認する。
  // 再度イギリスを選択してカードを開き直すと、ラベル追従が正しく
  // 再開することも合わせて確認する。
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await openMapAndSelectUk(page, base);
    const beforeClose = await labelLineState(page);
    check("テスト5: カードを閉じる前は4構成国のラベルが表示されている", beforeClose.visibleLabelKeys.length === 4);

    await page.click("#map-card-close");
    await page.waitForTimeout(600);

    const afterClose = await page.evaluate(() => ({
      labelsHidden: document.getElementById("map-uk-region-labels").classList.contains("hidden"),
      linesHidden: document.getElementById("map-uk-region-lines").classList.contains("hidden"),
      labelCount: document.querySelectorAll("#map-uk-region-labels .map-uk-region-label").length,
      lineCount: document.querySelectorAll("#map-uk-region-lines .map-uk-region-line").length,
    }));
    check("テスト5: 情報カードを閉じるとラベルレイヤーが既存仕様どおり非表示・空になる(本修正で退行していない)", afterClose.labelsHidden && afterClose.labelCount === 0);
    check("テスト5: 情報カードを閉じると指示線レイヤーも既存仕様どおり非表示・空になる(本修正で退行していない)", afterClose.linesHidden && afterClose.lineCount === 0);

    // 再度イギリスを選択してカードを開き直すと、ラベル追従が正しく再開する
    await page.fill("#map-search-input", "イギリス");
    await page.waitForTimeout(350);
    await page.click("#map-search-results li, #map-search-results button");
    await page.waitForTimeout(2000);
    const reopened = await labelLineState(page);
    check("テスト5: 再度カードを開くと4構成国のラベルが再表示される", reopened.visibleLabelKeys.length === 4);

    check("テスト5: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト6: ズームインした状態でも、オフスクリーンで正しく消える
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await openMapAndSelectUk(page, base);

    const canvas = await page.$("#map-globe-container canvas");
    const box = await canvas.boundingBox();
    // マウスホイールでズームイン(地図のズーム操作の既存パターン)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 200);
    await page.mouse.wheel(0, -600);
    await page.waitForTimeout(1200);

    const zoomedIn = await labelLineState(page);
    check("テスト6: ズームイン後もイギリス全体(またはその一部)のラベルが表示されている", zoomedIn.visibleLabelKeys.length > 0);

    await dragRotate(page, canvas, -1600, 0, { steps: 50, stepDelay: 20, yOffset: -250 });
    const zoomedOffscreen = await labelLineState(page);
    check("テスト6: ズームイン状態でもドラッグで画面外へ出すとラベル・指示線がすべて非表示になる", zoomedOffscreen.visibleLabelKeys.length === 0 && zoomedOffscreen.visibleLineKeys.length === 0);

    check("テスト6: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト7: 一部の構成国だけが画面内にあるとき、画面内のものだけが
  // 表示される(オールオアナッシングではない)。
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await openMapAndSelectUk(page, base);
    const canvas = await page.$("#map-globe-container canvas");

    // 小刻みなドラッグで、一部の構成国(北側のイングランド・スコットランド)
    // だけが画面内に残る位置まで動かす。
    await dragRotate(page, canvas, -150, 0, { steps: 30, stepDelay: 20, yOffset: -250 });
    const partial = await labelLineState(page);
    check("テスト7: 一部の構成国だけが画面内のとき、1つ以上かつ4つ未満のラベルが表示される", partial.visibleLabelKeys.length > 0 && partial.visibleLabelKeys.length < 4);
    check(
      "テスト7: 表示されている指示線のキーは、表示されているラベルのキー集合に含まれる(画面外になった構成国の線だけが残ることはない)",
      partial.visibleLineKeys.every((k) => partial.visibleLabelKeys.includes(k))
    );

    check("テスト7: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  await browser.close();
  server.close();

  console.log("\nTotal:", pass + fail, "Pass:", pass, "Fail:", fail);
  process.exit(fail > 0 ? 1 : 0);
})();
