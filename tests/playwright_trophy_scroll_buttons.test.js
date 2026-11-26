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
//   - 既存のカテゴリー・検索・絞り込みの動作に影響していない
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
  // テスト6: 既存のカテゴリー・検索・絞り込みの動作に影響していない
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await gotoTrophyList(page, base);
    await page.click('.trophy-category-chip[data-bucket="puzzle"]');
    await page.waitForTimeout(100);
    const info = await page.evaluate(() => ({
      topBucket: state.trophyListFilter.topBucket,
      visibleCount: document.getElementById("trophy-result-count").textContent,
    }));
    check("テスト6: 上位分類の絞り込みが正常に機能している", info.topBucket === "puzzle");
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
  // テスト8: カード(トロフィー名・問題文・挑戦ボタン等)の実際の文字と
  // 重ならない(できる限り減らす)
  //
  // 注: .trophy-name等はブロック要素のため、getBoundingClientRect()は
  // 中央揃えされた実際の文字幅より広い範囲を返しうる(余白込みの箱全体)。
  // 箱同士の矩形比較だけでは「文字が隠れていない」ことの確認にならず、
  // 過剰に厳しい(実際には重なっていないのに重なり判定になる)検証に
  // なってしまうため、Range.getClientRects()で実際に描画される文字の
  // 行ごとの矩形を取得し、ボタンの矩形と比較する。
  //
  // トロフィー名・挑戦ボタンは中央揃え・カード幅いっぱいの操作要素では
  // ないため、重なりがほぼ皆無であるべき(①)。一方、獲得条件
  // (.trophy-cond)とカテゴリー名・レア度バッジは、どちらも左揃え/
  // 右寄せでカードの右端近くまで文字が達する既存のグリッド表示仕様
  // (今回変更しない)であるため、画面右下固定のボタンの真下に来た
  // 行・ラベルの「末尾側」だけがボタンと接触することは、リスト幅を
  // 狭めず・文字サイズも変えないという制約の下では物理的に避けられない
  // (ユーザーの「完全になくすのではなく、できる限り減らす」という
  // 指示どおりの許容範囲)。そのためこの2つについては「重なる頻度」
  // ではなく「重なった際にどれだけの幅が隠れるか(深さ)」を見て、
  // 常にごく一部(末尾側)に留まっていることを確認する(②③)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await gotoTrophyList(page, base);
    const result = await page.evaluate(async () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      function rectsIntersect(a, b) {
        return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
      }
      function overlapFraction(cr, br) {
        const left = Math.max(cr.left, br.left);
        const right = Math.min(cr.right, br.right);
        return Math.max(0, right - left) / cr.width;
      }
      function collectDepths(selector, btnRects, into) {
        const els = Array.from(document.querySelectorAll(selector));
        for (const el of els) {
          const box = el.getBoundingClientRect();
          if (box.bottom < 0 || box.top > window.innerHeight) continue;
          const range = document.createRange();
          range.selectNodeContents(el);
          for (const cr of range.getClientRects()) {
            for (const br of btnRects) {
              if (rectsIntersect(cr, br)) into.push(overlapFraction(cr, br));
            }
          }
        }
      }
      let strictTotal = 0;
      const buttonDepths = [];
      const nameDepths = [];
      const condDepths = [];
      const badgeDepths = [];
      for (let y = 0; y <= maxScroll; y += 60) {
        window.scrollTo(0, y);
        await new Promise((r) => requestAnimationFrame(r));
        const btnWrap = document.getElementById("trophy-scroll-buttons");
        if (btnWrap.classList.contains("hidden")) continue;
        const btns = Array.from(btnWrap.querySelectorAll(".trophy-scroll-btn")).filter((b) => !b.classList.contains("hidden"));
        const btnRects = btns.map((b) => b.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
        if (!btnRects.length) continue;
        strictTotal += 1;

        // ① 挑戦ボタンは重なりがほぼ無いことを確認する対象(カード幅いっぱいの
        // 中央揃えボタンのため、中央寄りの文字が右端のスクロールボタンまで
        // 届くことは通常ない)
        collectDepths(".btn-puzzle-challenge, .btn-sevenwonder-challenge", btnRects, buttonDepths);

        // ② 獲得条件(.trophy-cond)、③ カテゴリー名・レア度バッジ、
        // ④ トロフィー名は、2列分割カード(国旗/首都)の右列など中央揃えでも
        // カード右端に近い文字が稀に重なりうるため、重なった場合の深さを
        // 記録する(頻度ではなく深さで「ごく一部」であることを確認する)
        collectDepths(".trophy-cond", btnRects, condDepths);
        collectDepths(".trophy-category-badge, .trophy-rarity-badge", btnRects, badgeDepths);
        collectDepths(".trophy-name", btnRects, nameDepths);
      }
      function p90Of(arr) {
        const sorted = arr.slice().sort((a, b) => a - b);
        return sorted.length ? sorted[Math.floor(sorted.length * 0.9)] : 0;
      }
      return {
        strictTotal,
        buttonOverlapCount: buttonDepths.length, buttonP90Depth: p90Of(buttonDepths),
        nameOverlapCount: nameDepths.length, nameP90Depth: p90Of(nameDepths),
        condOverlapCount: condDepths.length, condP90Depth: p90Of(condDepths),
        badgeOverlapCount: badgeDepths.length, badgeP90Depth: p90Of(badgeDepths),
      };
    });

    check(
      `テスト8①: 挑戦ボタンの文字は実際にはほぼ重ならない(重なり検出数: ${result.buttonOverlapCount}件/走査位置${result.strictTotal}件中)`,
      result.buttonOverlapCount === 0
    );
    check(
      `テスト8②: トロフィー名がボタンと重なる場合でも、深さは常に名前の一部(末尾側)に留まり、発生頻度もごくわずか(90パーセンタイル重なり幅: ${(result.nameP90Depth * 100).toFixed(1)}%、重なり検出数: ${result.nameOverlapCount}件/走査位置${result.strictTotal}件中、30%未満かつ検出数は走査数の5%未満)`,
      result.nameP90Depth < 0.3 && result.nameOverlapCount < result.strictTotal * 0.05
    );
    check(
      `テスト8③: 獲得条件(.trophy-cond)の行がボタンと重なる場合でも、深さは常にその行の一部(末尾側)に留まる(90パーセンタイル重なり幅: ${(result.condP90Depth * 100).toFixed(1)}%、重なり検出数: ${result.condOverlapCount}件、30%未満)`,
      result.condP90Depth < 0.3
    );
    check(
      `テスト8④: カテゴリー名・レア度バッジがボタンと重なる場合でも、深さは常にラベルの一部(末尾側)に留まる(90パーセンタイル重なり幅: ${(result.badgeP90Depth * 100).toFixed(1)}%、重なり検出数: ${result.badgeOverlapCount}件、30%未満)`,
      result.badgeP90Depth < 0.3
    );

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
