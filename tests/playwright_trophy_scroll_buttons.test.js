// ==========================================================
// PR #89 第4回⑤: トロフィー一覧へのスクロール移動ボタン追加のテスト
//
// 対象: トロフィー一覧画面(#screen-trophy-list)右下固定のスクロール移動
// ボタン(#trophy-scroll-buttons、先頭へ/末尾へ)。以下を確認する。
//   - 一覧の先頭にいる時は「先頭へ」ボタンだけが隠れ、「末尾へ」は見える
//   - 一覧の末尾にいる時は「末尾へ」ボタンだけが隠れ、「先頭へ」は見える
//   - クリックするとそれぞれ一覧の先頭/末尾まで実際にスクロールする
//   - 絞り込みで表示件数が少なくスクロール可能な範囲が十分でない場合は、
//     ボタンごと非表示になる
//   - 詳細モーダルを開いている間は非表示になり、閉じると再表示される
//   - 謎解き挑戦画面など他の画面では表示されない(画面がアクティブで
//     ないため祖先ごと描画されない)
//   - 既存のカテゴリー・検索・絞り込み・表示形式(グリッド/一覧)の動作に
//     影響していない
//   - 適切なaria-labelが設定されている
//   - タップ領域が十分な大きさ(44px以上)である
//   - カード(トロフィー名・問題文・挑戦ボタン等)と重ならない
//
// 実行方法: node tests/playwright_trophy_scroll_buttons.test.js
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
  await page.waitForTimeout(150);
}

(async () => {
  const browser = await chromium.launch();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const consoleErrors = [];

  // ========================================================
  // テスト1: 先頭にいる時は「先頭へ」だけが隠れ、「末尾へ」は見える
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await gotoTrophyList(page, base);
    const info = await page.evaluate(() => ({
      wrapHidden: document.getElementById("trophy-scroll-buttons").classList.contains("hidden"),
      topHidden: document.getElementById("trophy-scroll-top-btn").classList.contains("hidden"),
      bottomHidden: document.getElementById("trophy-scroll-bottom-btn").classList.contains("hidden"),
    }));
    check("テスト1: ボタン全体は表示されている(452件規模で十分なスクロール範囲がある)", info.wrapHidden === false);
    check("テスト1: 先頭にいるので「先頭へ」ボタンは隠れている", info.topHidden === true);
    check("テスト1: 先頭にいても「末尾へ」ボタンは見える", info.bottomHidden === false);

    check("テスト1: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト2: 末尾にいる時は「末尾へ」だけが隠れ、「先頭へ」は見える。
  // 実際にボタンをクリックして末尾・先頭まで移動できる
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await gotoTrophyList(page, base);
    await page.click("#trophy-scroll-bottom-btn");
    await page.waitForTimeout(300);
    let info = await page.evaluate(() => {
      const doc = document.documentElement;
      return {
        scrollY: window.scrollY,
        maxScroll: doc.scrollHeight - window.innerHeight,
        topHidden: document.getElementById("trophy-scroll-top-btn").classList.contains("hidden"),
        bottomHidden: document.getElementById("trophy-scroll-bottom-btn").classList.contains("hidden"),
      };
    });
    check("テスト2: 「末尾へ」クリックで実際に一覧の末尾まで移動する", Math.abs(info.scrollY - info.maxScroll) < 5);
    check("テスト2: 末尾にいるので「末尾へ」ボタンは隠れている", info.bottomHidden === true);
    check("テスト2: 末尾にいても「先頭へ」ボタンは見える", info.topHidden === false);

    await page.click("#trophy-scroll-top-btn");
    await page.waitForTimeout(300);
    const scrollYAfterTop = await page.evaluate(() => window.scrollY);
    check("テスト2: 「先頭へ」クリックで実際に一覧の先頭(0)まで移動する", scrollYAfterTop === 0);

    check("テスト2: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト3: 絞り込みでスクロール可能な範囲が十分でない場合は非表示になる
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await gotoTrophyList(page, base);
    // ページ自体の高さを一時的に縮め、スクロール不要な状態を再現する
    // (検索結果を1件に絞っても、ヘッダー・ヒーロー・カテゴリー群だけで
    // スクロール範囲が生まれてしまうため、より直接的に閾値未満の状態を作る)
    await page.evaluate(() => {
      document.getElementById("trophy-grid").innerHTML = "";
      updateTrophyScrollButtons();
    });
    await page.waitForTimeout(100);
    const info = await page.evaluate(() => ({
      wrapHidden: document.getElementById("trophy-scroll-buttons").classList.contains("hidden"),
      maxScroll: document.documentElement.scrollHeight - window.innerHeight,
    }));
    check(`テスト3: スクロール可能範囲が閾値未満(${info.maxScroll}px)の場合はボタン全体が非表示になる`, info.wrapHidden === true);

    check("テスト3: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト4: 詳細モーダルを開いている間は非表示になり、閉じると再表示される
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await gotoTrophyList(page, base);
    await page.evaluate(() => document.querySelector("#trophy-grid .trophy-card:not(.hidden)").click());
    await page.waitForSelector("#trophy-detail-modal:not(.hidden)");
    const hiddenDuringModal = await page.evaluate(() => document.getElementById("trophy-scroll-buttons").classList.contains("hidden"));
    check("テスト4: 詳細モーダル表示中はスクロール移動ボタンが非表示", hiddenDuringModal === true);

    await page.click("#trophy-detail-close");
    await page.waitForTimeout(150);
    const hiddenAfterClose = await page.evaluate(() => document.getElementById("trophy-scroll-buttons").classList.contains("hidden"));
    check("テスト4: モーダルを閉じるとスクロール移動ボタンが再表示される", hiddenAfterClose === false);

    check("テスト4: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト5: 謎解き挑戦画面など他の画面では表示されない
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await gotoTrophyList(page, base);
    await page.click("#btn-dev-puzzle-entry");
    await page.waitForSelector('.puzzle-dev-question-btn[data-question-id="puzzle-01"]');
    await page.click('.puzzle-dev-question-btn[data-question-id="puzzle-01"]');
    await page.waitForSelector("#screen-puzzle-flag-select.active");
    const rect = await page.evaluate(() => {
      const el = document.getElementById("trophy-scroll-buttons");
      const r = el.getBoundingClientRect();
      return { width: r.width, height: r.height };
    });
    check("テスト5: 謎解き挑戦画面ではスクロール移動ボタンの表示領域が無い(幅0・高さ0)", rect.width === 0 && rect.height === 0);

    check("テスト5: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト6: 既存のカテゴリー・検索・絞り込み・表示形式の動作に影響して
  // いない
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await gotoTrophyList(page, base);
    await page.click('.trophy-category-chip[data-bucket="puzzle"]');
    await page.waitForTimeout(100);
    await page.click('.trophy-view-btn[data-view="list"]');
    await page.waitForTimeout(100);
    const info = await page.evaluate(() => ({
      topBucket: state.trophyListFilter.topBucket,
      view: state.trophyListFilter.view,
      visibleCount: document.getElementById("trophy-result-count").textContent,
    }));
    check("テスト6: 上位分類の絞り込みが正常に機能している", info.topBucket === "puzzle");
    check("テスト6: 表示形式の切り替えが正常に機能している", info.view === "list");
    check("テスト6: 絞り込み件数表示が正常(謎解き127件)", info.visibleCount.includes("127"));

    check("テスト6: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト7: aria-labelとタップ領域サイズの確認
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await gotoTrophyList(page, base);
    // 先頭にいると「先頭へ」ボタンが隠れているため、両方とも見える
    // 中間位置までスクロールしてからタップ領域を確認する
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(150);
    const info = await page.evaluate(() => {
      const top = document.getElementById("trophy-scroll-top-btn");
      const bottom = document.getElementById("trophy-scroll-bottom-btn");
      const topRect = top.getBoundingClientRect();
      const bottomRect = bottom.getBoundingClientRect();
      return {
        topLabel: top.getAttribute("aria-label"),
        bottomLabel: bottom.getAttribute("aria-label"),
        topSize: { w: topRect.width, h: topRect.height },
        bottomSize: { w: bottomRect.width, h: bottomRect.height },
      };
    });
    check("テスト7: 「先頭へ」ボタンに適切なaria-labelが設定されている", !!info.topLabel && info.topLabel.length > 0);
    check("テスト7: 「末尾へ」ボタンに適切なaria-labelが設定されている", !!info.bottomLabel && info.bottomLabel.length > 0);
    check("テスト7: 「先頭へ」ボタンのタップ領域が44px以上", info.topSize.w >= 44 && info.topSize.h >= 44);
    check("テスト7: 「末尾へ」ボタンのタップ領域が44px以上", info.bottomSize.w >= 44 && info.bottomSize.h >= 44);

    check("テスト7: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト8: カード(トロフィー名・問題文・挑戦ボタン等)と重ならない
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await gotoTrophyList(page, base);
    await page.evaluate(() => window.scrollTo(0, 3000));
    await page.waitForTimeout(150);
    const overlapping = await page.evaluate(() => {
      const btnRect = document.getElementById("trophy-scroll-buttons").getBoundingClientRect();
      const cards = Array.from(document.querySelectorAll("#trophy-grid .trophy-card:not(.hidden)"));
      const result = [];
      for (const card of cards) {
        const r = card.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) continue;
        const actionEl = card.querySelector(".btn-puzzle-challenge, .trophy-name");
        if (!actionEl) continue;
        const ar = actionEl.getBoundingClientRect();
        const intersects = !(ar.right < btnRect.left || ar.left > btnRect.right || ar.bottom < btnRect.top || ar.top > btnRect.bottom);
        if (intersects) result.push(card.dataset.trophyId);
      }
      return result;
    });
    check("テスト8: スクロール移動ボタンがカードの名前・ボタンと重なっていない", overlapping.length === 0);

    check("テスト8: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト9: レスポンシブ確認(iPhone SE/標準/iPad/PC)
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
      const rect = await page.evaluate(() => document.getElementById("trophy-scroll-buttons").getBoundingClientRect());
      check(`テスト9(${w.label}): スクロール移動ボタンが画面幅からあふれない`, rect.right <= w.width + 1 && rect.left >= -1);
      await page.close();
    }
    check("テスト9: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
  }

  await browser.close();
  server.close();

  console.log("\nTotal:", pass + fail, "Pass:", pass, "Fail:", fail);
  process.exit(fail > 0 ? 1 : 0);
})();
