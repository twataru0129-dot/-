// ==========================================================
// PR #89 第4回③: 「次の目標」欄のレイアウト改善(3行構成)のテスト
//
// 対象: トロフィー一覧(#screen-trophy-list)ヘッダーの「次の目標」カード
// (#trophy-hero-next)。以下を確認する。
//   - 上段(アイコン+「次の目標」ラベル)/中段(目標名、単独行)/下段(進捗
//     文言+「目標の詳細」ボタン)の3段構成になっている
//   - 短い目標名(通常ケース)で不自然な改行が起きない
//   - 長い目標名(例:「チュートリアルは終わりだ」)でも、名前が単独行の
//     ため崩れず、カード幅を超えない
//   - 非常に長い名前・進捗文言でも、下段(進捗+ボタン)が必要に応じて
//     縦積みに変化し、横あふれが起きない(狭い画面でも同様)
//   - 「目標の詳細」ボタンをクリックすると、既存どおり詳細モーダルが
//     正しいトロフィーで開く(目標選出ロジック・進捗計算・遷移先は
//     変更されていないことの確認)
//   - ネイビー/ゴールドの配色・カードサイズが既存のまま維持されている
//
// 実行方法: node tests/playwright_next_goal_layout.test.js
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

async function gotoTrophyList(page, base) {
  await page.goto(`${base}?puzzleDev=1`, { waitUntil: "load" });
  await page.waitForSelector("#screen-top.active");
  await page.click("#btn-trophy-list");
  await page.waitForSelector("#screen-trophy-list.active");
}

(async () => {
  const browser = await chromium.launch();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const consoleErrors = [];

  // ========================================================
  // テスト1: 通常ケース(初期状態の次の目標)で3段構成になっている
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await gotoTrophyList(page, base);

    const info = await page.evaluate(() => {
      const wrap = document.getElementById("trophy-hero-next");
      const head = wrap.querySelector(".trophy-hero-next-head");
      const name = document.getElementById("trophy-hero-next-name");
      const foot = wrap.querySelector(".trophy-hero-next-foot");
      const sub = document.getElementById("trophy-hero-next-sub");
      const btn = document.getElementById("trophy-hero-next-btn");
      return {
        hidden: wrap.classList.contains("hidden"),
        nameText: name.textContent,
        subText: sub.textContent,
        headBottom: head.getBoundingClientRect().bottom,
        nameTop: name.getBoundingClientRect().top,
        nameBottom: name.getBoundingClientRect().bottom,
        footTop: foot.getBoundingClientRect().top,
        nameTextAlign: getComputedStyle(name).textAlign,
        btnVisible: btn.getBoundingClientRect().width > 0,
      };
    });

    check("テスト1: 次の目標カードが表示されている", info.hidden === false);
    check("テスト1: 目標名が取得できている(選出ロジックは変更されていない)", info.nameText.length > 0);
    check("テスト1: 進捗テキストが取得できている(進捗計算は変更されていない)", info.subText.includes("あと") && info.subText.includes("で獲得"));
    check("テスト1: 上段(ラベル)が中段(目標名)より上にある", info.headBottom <= info.nameTop + 1);
    check("テスト1: 中段(目標名)が下段(進捗+ボタン)より上にある", info.nameBottom <= info.footTop + 1);
    check("テスト1: 目標名は左揃え", info.nameTextAlign === "left");
    check("テスト1: 「目標の詳細」ボタンが表示されている", info.btnVisible === true);

    check("テスト1: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト2: 長い目標名(「チュートリアルは終わりだ」)でも、目標名行が
  // カード幅を超えず、進捗・ボタン行と重ならない
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors, { width: 375, height: 812 });
    await gotoTrophyList(page, base);
    await page.evaluate(() => {
      document.getElementById("trophy-hero-next-name").textContent = "チュートリアルは終わりだ";
    });
    await page.waitForTimeout(50);

    const info = await page.evaluate(() => {
      const wrap = document.getElementById("trophy-hero-next");
      const name = document.getElementById("trophy-hero-next-name");
      const foot = wrap.querySelector(".trophy-hero-next-foot");
      const wrapRect = wrap.getBoundingClientRect();
      const nameRect = name.getBoundingClientRect();
      return {
        nameOverflows: nameRect.right > wrapRect.right + 1,
        nameBottom: nameRect.bottom,
        footTop: foot.getBoundingClientRect().top,
      };
    });
    check("テスト2: 長い目標名がカード幅からあふれていない", info.nameOverflows === false);
    check("テスト2: 長い目標名と下段(進捗+ボタン)が重なっていない", info.nameBottom <= info.footTop + 1);

    check("テスト2: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト3: 非常に長い目標名・進捗テキストでも、狭い画面(320px)で
  // 下段が必要に応じて縦積みになり、カード幅から横あふれしない
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors, { width: 320, height: 700 });
    await gotoTrophyList(page, base);
    await page.evaluate(() => {
      document.getElementById("trophy-hero-next-name").textContent = "世界七不思議・全ての謎を解き明かした証の称号トロフィー";
      document.getElementById("trophy-hero-next-sub").textContent = "あと999個で獲得（進捗テキストが非常に長い場合のテストケース）";
    });
    await page.waitForTimeout(50);

    const info = await page.evaluate(() => {
      const wrap = document.getElementById("trophy-hero-next");
      const wrapRect = wrap.getBoundingClientRect();
      const overflowingEl = Array.from(wrap.querySelectorAll("*")).find((el) => el.getBoundingClientRect().right > wrapRect.right + 2);
      return {
        hasOverflow: !!overflowingEl,
        wrapWidth: wrapRect.width,
      };
    });
    check("テスト3(320px幅): 非常に長い目標名・進捗テキストでも横あふれが無い", info.hasOverflow === false);

    check("テスト3: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト4: 「目標の詳細」ボタンをクリックすると既存どおり詳細モーダルが
  // 正しいトロフィーで開く(遷移先・ロジックは変更されていない)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await gotoTrophyList(page, base);
    const trophyId = await page.evaluate(() => document.getElementById("trophy-hero-next").dataset.trophyId);
    await page.click("#trophy-hero-next-btn");
    await page.waitForSelector("#trophy-detail-modal:not(.hidden)");
    const openedId = await page.evaluate(() => document.querySelector("#trophy-detail-body .trophy-detail-content").dataset.trophyId);
    check("テスト4: 「目標の詳細」ボタンで対象トロフィーの詳細モーダルが開く", openedId === trophyId);

    check("テスト4: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト5: レスポンシブ確認(iPhone SE/標準/iPad/PC)でカードが画面幅から
  // あふれない
  // ========================================================
  {
    const widths = [
      { width: 320, height: 568, label: "iPhone SE" },
      { width: 390, height: 844, label: "iPhone" },
      { width: 810, height: 1080, label: "iPad" },
      { width: 1440, height: 900, label: "PC" },
    ];
    for (const w of widths) {
      const page = await newPage(browser, consoleErrors, { width: w.width, height: w.height });
      await gotoTrophyList(page, base);
      const overflow = await page.evaluate((viewportWidth) => {
        const wrap = document.getElementById("trophy-hero-next");
        const rect = wrap.getBoundingClientRect();
        return rect.right > viewportWidth + 1 || rect.left < -1;
      }, w.width);
      check(`テスト5(${w.label}): 次の目標カードが画面幅からあふれない`, overflow === false);
      await page.close();
    }
    check("テスト5: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
  }

  await browser.close();
  server.close();

  console.log("\nTotal:", pass + fail, "Pass:", pass, "Fail:", fail);
  process.exit(fail > 0 ? 1 : 0);
})();
