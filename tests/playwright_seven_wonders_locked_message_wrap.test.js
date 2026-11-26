// ==========================================================
// 世界7不思議: ロック中タップ案内モーダル「全ての謎を解き明かした者のみが
// 挑戦できる」の表示微調整(1行表示・見切れ/横スクロール防止)のテスト。
//
// 対象: #seven-wonder-locked-modal。以下を確認する。
//   - 320/375/390/430/768/1280pxのいずれでも、メッセージが1行で
//     表示される(実際の文字の描画矩形を基準に判定する)
//   - 中央揃えが維持されている
//   - 画面幅からの見切れ・横スクロールが発生しない
//   - 文言・鍵アイコン・閉じるボタンは変更されていない
//   - 他のモーダル(.modal-text/.modal-boxを使う既存の確認ダイアログ等)の
//     文字サイズ・幅には影響していない
//
// 実行方法: node tests/playwright_seven_wonders_locked_message_wrap.test.js
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

async function newPage(browser, consoleErrors, viewport) {
  const page = await browser.newPage({ viewport: viewport || { width: 390, height: 844 } });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  return page;
}

async function openLockedModalViaRealFlow(page, base) {
  await page.goto(base, { waitUntil: "load" });
  await page.click("#btn-trophy-list");
  await page.waitForSelector("#screen-trophy-list.active");
  await page.click('#trophy-bucket-grid .trophy-category-chip[data-bucket="sevenWonders"]');
  await page.waitForTimeout(150);
  const lockedCard = await page.$(".trophy-card-sevenwonder-locked");
  await lockedCard.click();
  await page.waitForSelector("#seven-wonder-locked-modal:not(.hidden)", { timeout: 3000 });
}

(async () => {
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const consoleErrors = [];

  // ========================================================
  // テスト1: 320/375/390/430/768/1280pxで、実際の鍵付きロックカードを
  // タップして開いた案内モーダルが1行表示・見切れ無し・横スクロール無し・
  // 中央揃えであることを確認する
  // ========================================================
  const widths = [
    { width: 320, height: 568, label: "320px" },
    { width: 375, height: 812, label: "375px" },
    { width: 390, height: 844, label: "390px" },
    { width: 430, height: 932, label: "430px" },
    { width: 768, height: 1024, label: "768px" },
    { width: 1280, height: 800, label: "1280px" },
  ];
  for (const w of widths) {
    const page = await newPage(browser, consoleErrors, { width: w.width, height: w.height });
    await openLockedModalViaRealFlow(page, base);

    const info = await page.evaluate(() => {
      const modal = document.getElementById("seven-wonder-locked-modal");
      const box = modal.querySelector(".modal-box");
      const text = modal.querySelector(".modal-text");
      const icon = modal.querySelector(".seven-wonder-locked-icon");
      const closeBtn = document.getElementById("seven-wonder-locked-close");
      const range = document.createRange();
      range.selectNodeContents(text);
      const rects = Array.from(range.getClientRects());
      const boxRect = box.getBoundingClientRect();
      const overflowsBox = rects.some((r) => r.left < boxRect.left - 0.5 || r.right > boxRect.right + 0.5);
      const textLeft = Math.min(...rects.map((r) => r.left));
      const textRight = Math.max(...rects.map((r) => r.right));
      const textMid = (textLeft + textRight) / 2;
      const boxMid = boxRect.left + boxRect.width / 2;
      return {
        text: text.textContent,
        lineCount: rects.length,
        overflowsBox,
        hasHScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
        centerDrift: Math.abs(textMid - boxMid),
        iconText: icon.textContent,
        closeBtnText: closeBtn.textContent.trim(),
      };
    });

    check(`${w.label}: 案内文が1行で表示されている`, info.lineCount === 1);
    check(`${w.label}: 案内文がモーダルの箱からはみ出していない`, info.overflowsBox === false);
    check(`${w.label}: ページ全体で横スクロールが発生していない`, info.hasHScroll === false);
    check(`${w.label}: 案内文の中央揃えが維持されている(ずれ2px未満)`, info.centerDrift < 2);
    check(`${w.label}: 文言が変更されていない`, info.text === "全ての謎を解き明かした者のみが挑戦できる");
    check(`${w.label}: 鍵アイコンが維持されている`, info.iconText === "🔒");
    check(`${w.label}: 閉じるボタンの文言が維持されている`, info.closeBtnText === "閉じる");

    await page.click("#seven-wonder-locked-close");
    await page.waitForSelector("#seven-wonder-locked-modal", { state: "hidden", timeout: 3000 });
    check(`${w.label}: コンソール/ページエラーが発生していない`, consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト2: 他のモーダル(.modal-text/.modal-boxを使う既存の確認
  // ダイアログ)の文字サイズ・箱の幅には影響していない
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await page.goto(base, { waitUntil: "load" });
    const info = await page.evaluate(() => {
      const modal = document.getElementById("confirm-modal");
      const text = document.getElementById("confirm-modal-text");
      const box = text.closest(".modal-box");
      return {
        fontSize: getComputedStyle(text).fontSize,
        maxWidth: getComputedStyle(box).maxWidth,
        paddingLeft: getComputedStyle(box).paddingLeft,
        hasLockedClass: box.classList.contains("seven-wonder-locked-box"),
      };
    });
    check("他のモーダル(終了確認)の文字サイズは16pxのまま", info.fontSize === "16px");
    check("他のモーダル(終了確認)の箱の最大幅は340pxのまま", info.maxWidth === "340px");
    check("他のモーダル(終了確認)の左右余白は24pxのまま", info.paddingLeft === "24px");
    check("他のモーダル(終了確認)の箱にロックモーダル専用クラスが付いていない", info.hasLockedClass === false);

    check("他のモーダル確認中、コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  await browser.close();
  server.close();

  console.log("\nTotal:", pass + fail, "Pass:", pass, "Fail:", fail);
  process.exit(fail > 0 ? 1 : 0);
})();
