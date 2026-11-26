// ==========================================================
// PR #89 第4回②: 謎解きトロフィーの一覧(リスト)表示専用レイアウトのテスト
//
// 対象: トロフィー一覧(#screen-trophy-list)を「一覧(リスト)」表示に
// 切り替えたときの謎解きカード(.trophy-card-puzzle)。以下を確認する。
//   - 問題文(.trophy-cond.trophy-puzzle-question)がカード幅いっぱいまで
//     広がり、1〜2文字ずつ折り返されるような極端な幅になっていない
//   - 「この謎に挑む」ボタンが十分な横幅・通常の高さで表示される
//     (文字が縦に流れるような極端な幅になっていない)
//   - 上段(番号・カテゴリー)→中段(アイコン+名前)→下段(問題文・ボタン)の
//     3段構成になっている(中段ではアイコンが左、名前が右)
//   - 獲得済みカードでも解説文・注釈が同様にカード幅いっぱいで表示される
//   - 通常(謎解き以外)のトロフィーカードの一覧表示レイアウトは変更されて
//     いない(既存の横一列レイアウトのまま)
//   - 詳細モーダルは一覧表示用CSSの影響を受けない(flex列化されない)
//   - グリッド表示に戻しても崩れない(既存のplaywright_puzzle_trophy_
//     layout.test.jsで別途確認済みだが、本ファイルでも切替直後を確認する)
//
// 実行方法: node tests/playwright_puzzle_list_view_layout.test.js
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

async function gotoTop(page, base) {
  await page.goto(`${base}?puzzleDev=1`, { waitUntil: "load" });
  await page.waitForSelector("#screen-top.active");
}

async function openTrophyListInListView(page, bucket) {
  await page.click("#btn-trophy-list");
  await page.waitForSelector("#screen-trophy-list.active");
  if (bucket) {
    await page.click(`.trophy-category-chip[data-bucket="${bucket}"]`);
  }
  await page.click('.trophy-view-btn[data-view="list"]');
  await page.waitForTimeout(150);
}

async function solveViaDevEntry(page, questionId) {
  await page.click("#btn-trophy-list");
  await page.waitForSelector("#screen-trophy-list.active");
  await page.click("#btn-dev-puzzle-entry");
  await page.waitForSelector(`.puzzle-dev-question-btn[data-question-id="${questionId}"]`);
  await page.click(`.puzzle-dev-question-btn[data-question-id="${questionId}"]`);
  await page.waitForSelector("#screen-puzzle-flag-select.active");
  await page.waitForTimeout(300);
  const ids = await page.evaluate((qid) => PUZZLE_QUESTIONS_BY_ID[qid].answerIds.slice(), questionId);
  for (const id of ids) {
    await page.click(`.puzzle-flag-card[data-id="${id}"]`);
  }
  await page.click("#puzzle-answer-submit");
  await page.waitForSelector("#screen-puzzle-trophy-award.active", { timeout: 5000 });
  await page.click("#btn-puzzle-award-close");
  await page.waitForSelector("#screen-puzzle-flag-select.active");
  await page.click("#btn-puzzle-back");
  await page.waitForSelector("#screen-top.active");
}

(async () => {
  const browser = await chromium.launch();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const consoleErrors = [];

  // ========================================================
  // テスト1: 未獲得の謎解きカードが一覧表示で崩れない
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await gotoTop(page, base);
    await openTrophyListInListView(page, "puzzle");

    const info = await page.evaluate(() => {
      const card = document.querySelector("#trophy-grid .trophy-card-puzzle");
      const cardRect = card.getBoundingClientRect();
      const cond = card.querySelector(".trophy-cond.trophy-puzzle-question");
      const condRect = cond.getBoundingClientRect();
      const btn = card.querySelector(".btn-puzzle-challenge");
      const btnRect = btn.getBoundingClientRect();
      const top = card.querySelector(".trophy-card-top");
      const heading = card.querySelector(".trophy-puzzle-heading");
      const marks = card.querySelector(".trophy-marks");
      const name = card.querySelector(".trophy-name");
      return {
        cardWidth: cardRect.width,
        condWidth: condRect.width,
        condHeight: condRect.height,
        condLineHeight: parseFloat(getComputedStyle(cond).lineHeight) || 1,
        btnWidth: btnRect.width,
        btnHeight: btnRect.height,
        topBottom: top.getBoundingClientRect().bottom,
        headingTop: heading.getBoundingClientRect().top,
        marksLeft: marks.getBoundingClientRect().left,
        nameLeft: name.getBoundingClientRect().left,
        overflowsCard: condRect.right > cardRect.right + 1 || btnRect.right > cardRect.right + 1,
      };
    });

    check("テスト1: 問題文がカード幅の大部分(80%以上)まで広がっている(極端な折り返し崩れが無い)", info.condWidth >= info.cardWidth * 0.8);
    check("テスト1: 問題文の高さが1行の高さの3倍未満(1〜2文字ずつの異常な折り返しではない)", info.condHeight < info.condLineHeight * 6);
    check("テスト1: 挑戦ボタンがカード幅の大部分まで広がっている", info.btnWidth >= info.cardWidth * 0.8);
    check("テスト1: 挑戦ボタンの高さが通常範囲(30〜60px、文字が縦に流れていない)", info.btnHeight >= 30 && info.btnHeight <= 60);
    check("テスト1: 上段(番号/カテゴリー)が中段(アイコン+名前)より上に表示されている", info.topBottom <= info.headingTop + 1);
    check("テスト1: 中段でアイコンが名前より左に表示されている", info.marksLeft < info.nameLeft);
    check("テスト1: 問題文・ボタンがカード幅からあふれていない", info.overflowsCard === false);

    check("テスト1: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト2: 獲得済みの謎解きカード(解説文・注釈あり)も一覧表示で崩れない
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await gotoTop(page, base);
    await solveViaDevEntry(page, "puzzle-02");
    await openTrophyListInListView(page, "puzzle");

    const info = await page.evaluate(() => {
      const def = TrophyModule.getAllDefinitions().find((d) => d.puzzleQuestionId === "puzzle-02");
      const card = document.querySelector(`#trophy-grid [data-trophy-id="${def.id}"]`);
      const cardRect = card.getBoundingClientRect();
      const desc = card.querySelector(".trophy-description");
      const note = card.querySelector(".trophy-note");
      const btn = card.querySelector(".btn-puzzle-challenge");
      return {
        earned: card.dataset.earned,
        cardWidth: cardRect.width,
        descWidth: desc.getBoundingClientRect().width,
        descAlign: getComputedStyle(desc).textAlign,
        noteExists: !!note,
        noteWidth: note ? note.getBoundingClientRect().width : null,
        btnExists: !!btn,
        descText: desc.textContent,
        noteText: note ? note.textContent : null,
      };
    });

    check("テスト2: 獲得済みカードであること", info.earned === "true");
    check("テスト2: 解説文がカード幅の大部分まで広がっている", info.descWidth >= info.cardWidth * 0.8);
    check("テスト2: 解説文は左揃え", info.descAlign === "left");
    check("テスト2: 注釈(.trophy-note)が存在する(No.02には注釈がある)", info.noteExists === true);
    check("テスト2: 注釈もカード幅の大部分まで広がっている", info.noteWidth >= info.cardWidth * 0.8);
    check("テスト2: 獲得済みカードには挑戦ボタンが無い(既存仕様の維持)", info.btnExists === false);
    check("テスト2: 解説文の内容が省略・改変されていない", info.descText.length > 10);
    check("テスト2: 注釈の内容が省略・改変されていない", info.noteText.includes("国連"));

    check("テスト2: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト3: 通常(謎解き以外)のトロフィーカードの一覧表示は変更されていない
  // (既存の横一列レイアウトのまま)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await gotoTop(page, base);
    await openTrophyListInListView(page, "findcountry");

    const info = await page.evaluate(() => {
      const card = document.querySelector('#trophy-grid .trophy-card[data-category="findcountry"]');
      return {
        display: getComputedStyle(card).display,
        flexDirection: getComputedStyle(card).flexDirection,
        alignItems: getComputedStyle(card).alignItems,
      };
    });
    check("テスト3: 通常カードは一覧表示で引き続き横一列flex(display:flex)", info.display === "flex");
    check("テスト3: 通常カードのflex-directionは引き続き横方向(row、謎解き専用の縦積みcolumnではない)", info.flexDirection === "row");
    check("テスト3: 通常カードのalign-itemsは引き続きcenter(謎解き専用のstretchではない)", info.alignItems === "center");

    check("テスト3: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト4: 詳細モーダルは一覧表示用CSSの影響を受けない
  // (.trophy-grid-listの子孫ではないため、縦積みレイアウトに変化しない)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await gotoTop(page, base);
    await openTrophyListInListView(page, "puzzle");
    const def = await page.evaluate(() => TrophyModule.getAllDefinitions().find((d) => d.puzzleQuestionId === "puzzle-01").id);
    await page.evaluate((id) => document.querySelector(`#trophy-grid [data-trophy-id="${id}"]`).click(), def);
    await page.waitForSelector("#trophy-detail-modal:not(.hidden)");

    const info = await page.evaluate(() => {
      const content = document.querySelector("#trophy-detail-body .trophy-detail-content");
      const cs = getComputedStyle(content);
      return {
        display: cs.display,
        flexDirection: cs.flexDirection,
        hasLeftoverHeading: !!content.querySelector(".trophy-puzzle-heading"),
        hasLeftoverBody: !!content.querySelector(".trophy-puzzle-body"),
        condVisible: content.querySelector(".trophy-cond.trophy-puzzle-question").getBoundingClientRect().width > 0,
      };
    });
    check("テスト4: 詳細モーダルのカードはflex化されていない(display:block)", info.display === "block");
    check("テスト4: 一覧表示専用のラッパー(trophy-puzzle-heading)の空の抜け殻が残っていない", info.hasLeftoverHeading === false);
    check("テスト4: 一覧表示専用のラッパー(trophy-puzzle-body)の空の抜け殻が残っていない", info.hasLeftoverBody === false);
    check("テスト4: 問題文が正しく表示されている", info.condVisible === true);

    check("テスト4: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト5: iPhone・iPad・PCで謎解きカードの一覧表示が崩れない
  // ========================================================
  {
    const widths = [
      { width: 320, height: 568, label: "iPhone SE" },
      { width: 375, height: 812, label: "iPhone" },
      { width: 810, height: 1080, label: "iPad" },
      { width: 1440, height: 900, label: "PC" },
    ];
    for (const w of widths) {
      const page = await newPage(browser, consoleErrors, { width: w.width, height: w.height });
      await gotoTop(page, base);
      await openTrophyListInListView(page, "puzzle");

      const info = await page.evaluate((viewportWidth) => {
        const card = document.querySelector("#trophy-grid .trophy-card-puzzle");
        const rect = card.getBoundingClientRect();
        const cond = card.querySelector(".trophy-cond.trophy-puzzle-question");
        const condRect = cond.getBoundingClientRect();
        return {
          overflow: rect.right <= viewportWidth + 1 && rect.left >= -1,
          condWidth: condRect.width,
          cardWidth: rect.width,
        };
      }, w.width);
      check(`テスト5(${w.label}): 謎解きカードが画面幅からあふれない`, info.overflow === true);
      check(`テスト5(${w.label}): 問題文がカード幅の大部分まで広がっている`, info.condWidth >= info.cardWidth * 0.75);

      await page.close();
    }
    check("テスト5: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
  }

  // ========================================================
  // テスト6: グリッド表示に戻すと従来どおりの中央揃えレイアウトに戻る
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await gotoTop(page, base);
    await openTrophyListInListView(page, "puzzle");
    await page.click('.trophy-view-btn[data-view="grid"]');
    await page.waitForTimeout(150);

    const info = await page.evaluate(() => {
      const card = document.querySelector("#trophy-grid .trophy-card-puzzle");
      const marks = card.querySelector(".trophy-marks");
      const name = card.querySelector(".trophy-name");
      return {
        marksJustify: getComputedStyle(marks).justifyContent,
        nameAlign: getComputedStyle(name).textAlign,
      };
    });
    check("テスト6: グリッド表示に戻すとアイコンは中央揃えに戻る", info.marksJustify === "center");
    check("テスト6: グリッド表示に戻すと名前は中央揃えに戻る", info.nameAlign === "center");

    check("テスト6: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  await browser.close();
  server.close();

  console.log("\nTotal:", pass + fail, "Pass:", pass, "Fail:", fail);
  process.exit(fail > 0 ? 1 : 0);
})();
