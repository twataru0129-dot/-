// ==========================================================
// 謎解きトロフィーの文章レイアウト統一・注釈表示のテスト(PR #81最終調整)。
//
// 対象: トロフィー一覧(#screen-trophy-list)の謎解き専用カード
// (.trophy-card-puzzle)。以下を確認する。
//   - アイコン(.trophy-marks)・トロフィー名(.trophy-name)は中央揃えのまま
//   - 問題文(.trophy-cond.trophy-puzzle-question)・解説文
//     (.trophy-description)は左揃えに変更されている
//   - 出典・注釈(.trophy-note)は解説文より小さい文字で、別要素として
//     表示される(本文に埋め込まれていない)
//   - 注釈の無い問題(No.01・04)では.trophy-note自体がDOMに存在しない
//     (余計な空白・ラベルも出ない)
//   - 個別の問題用CSSではなく、.trophy-card-puzzleという共通クラスだけで
//     実現しているため、将来追加される問題にも自動適用される(No.02と
//     No.04の両方が同じCSSルールで正しく描画されることで確認する)
//   - 他のトロフィーカテゴリー(findcountry等)の.trophy-cond中央揃えには
//     影響していない(既存デザインの回帰確認)
//   - iPhone/iPad/PCでレイアウトが崩れない
//   - 獲得記録(名称・解説文・注釈)が再読み込み後も保持される
//
// 実行方法: node tests/playwright_puzzle_trophy_layout.test.js
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

async function openTrophyList(page) {
  await page.click("#btn-trophy-list");
  await page.waitForSelector("#screen-trophy-list.active");
}

// screen-topから開始し、開発用入口経由で指定の問題を正解し、screen-topに
// 戻るところまでを1セットで行う(複数回連続で呼んでも干渉しないよう、
// 必ずscreen-topから始めてscreen-topで終わる)
async function solveViaDevEntry(page, questionId) {
  await openTrophyList(page);
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

function cardSelectorForQuestion(questionId) {
  return `#trophy-grid .trophy-card-puzzle[data-trophy-id]`;
}

async function getCardStyleInfo(page, questionId) {
  return page.evaluate((qid) => {
    const def = TrophyModule.getAllDefinitions().find((d) => d.puzzleQuestionId === qid);
    const card = document.querySelector(`#trophy-grid [data-trophy-id="${def.id}"]`);
    const marksEl = card.querySelector(".trophy-marks");
    const nameEl = card.querySelector(".trophy-name");
    const condEl = card.querySelector(".trophy-cond.trophy-puzzle-question");
    const descEl = card.querySelector(".trophy-description");
    const noteEl = card.querySelector(".trophy-note");
    const cs = (el) => (el ? getComputedStyle(el) : null);
    return {
      marksJustify: cs(marksEl) ? cs(marksEl).justifyContent : null,
      nameAlign: cs(nameEl) ? cs(nameEl).textAlign : null,
      condAlign: cs(condEl) ? cs(condEl).textAlign : null,
      descAlign: cs(descEl) ? cs(descEl).textAlign : null,
      descFontSize: cs(descEl) ? parseFloat(cs(descEl).fontSize) : null,
      noteExists: !!noteEl,
      noteAlign: cs(noteEl) ? cs(noteEl).textAlign : null,
      noteFontSize: cs(noteEl) ? parseFloat(cs(noteEl).fontSize) : null,
      noteText: noteEl ? noteEl.textContent : null,
      descText: descEl ? descEl.textContent : null,
    };
  }, questionId);
}

(async () => {
  const browser = await chromium.launch();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const consoleErrors = [];

  // ========================================================
  // テスト1: 未獲得時でも問題文(.trophy-puzzle-question)は左揃え、
  // アイコン・トロフィー名は中央揃え
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await gotoTop(page, base);
    await openTrophyList(page);
    const info = await getCardStyleInfo(page, "puzzle-01");
    check("テスト1: アイコン(.trophy-marks)は中央揃え(justify-content:center)", info.marksJustify === "center");
    check("テスト1: トロフィー名(.trophy-name)は中央揃え", info.nameAlign === "center");
    check("テスト1: 問題文(.trophy-puzzle-question)は左揃え", info.condAlign === "left");

    check("テスト1: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト2: 獲得後、解説文は左揃え。注釈(No.02)は解説文より小さい文字で
  // 別要素として表示される
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await gotoTop(page, base);
    await solveViaDevEntry(page, "puzzle-02");
    await openTrophyList(page);

    const info = await getCardStyleInfo(page, "puzzle-02");
    check("テスト2: 獲得後の解説文(.trophy-description)は左揃え", info.descAlign === "left");
    check("テスト2: 注釈(.trophy-note)がDOMに存在する(No.02には注釈がある)", info.noteExists === true);
    check("テスト2: 注釈は左揃え", info.noteAlign === "left");
    check("テスト2: 注釈は解説文より小さい文字", info.noteFontSize < info.descFontSize);
    check("テスト2: 注釈の内容が指定どおり(出典を含む)", info.noteText.includes("国連") && info.noteText.includes("世界人口推計"));
    check("テスト2: 解説文に注釈の内容が混入していない(別要素として分離されている)", !info.descText.includes("出典"));
    check("テスト2: 解説文の内容が更新後のものになっている", info.descText.includes("2026年の推計"));

    check("テスト2: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト3: 注釈の無い問題(No.01・No.04)では.trophy-note自体が
  // DOMに存在しない(将来の追加問題にも同じ共通CSSが自動適用されることを
  // No.02(注釈あり)とNo.04(注釈なし)の両方で確認することで示す)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await gotoTop(page, base);
    await solveViaDevEntry(page, "puzzle-01");
    await solveViaDevEntry(page, "puzzle-04");
    await openTrophyList(page);

    const info01 = await getCardStyleInfo(page, "puzzle-01");
    const info04 = await getCardStyleInfo(page, "puzzle-04");
    check("テスト3: No.01(注釈なし)は.trophy-noteが存在しない", info01.noteExists === false);
    check("テスト3: No.04(注釈なし)も.trophy-noteが存在しない", info04.noteExists === false);
    check("テスト3: No.01も解説文は左揃え(共通CSSが問題ごとに個別実装されていないことの確認)", info01.descAlign === "left");
    check("テスト3: No.04も解説文は左揃え", info04.descAlign === "left");

    check("テスト3: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト4: 他のトロフィーカテゴリー(世界の国どこかな？専用等)の
  // .trophy-condにも、PR#89フォロー(第3ラウンド)の指示で導入された
  // 「獲得条件は左揃え」という共通ルールが適用されている(アイコン・
  // 名前・獲得状態の中央揃えは変更していない)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await gotoTop(page, base);
    await openTrophyList(page);
    const otherCondAlign = await page.evaluate(() => {
      const card = document.querySelector('#trophy-grid .trophy-card[data-category="findcountry"] .trophy-cond');
      return card ? getComputedStyle(card).textAlign : null;
    });
    check("テスト4: 謎解き以外のトロフィーカード(findcountry)の.trophy-condも左揃え(共通ルール)", otherCondAlign === "left");

    check("テスト4: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト5: iPhone・iPad・PCでレイアウトが崩れない(カードが画面幅を
  // 超えてオーバーフローしない、問題文・解説文・注釈が見える)
  // ========================================================
  {
    const widths = [
      { width: 375, height: 812, label: "iPhone" },
      { width: 810, height: 1080, label: "iPad" },
      { width: 1440, height: 900, label: "PC" },
    ];
    for (const w of widths) {
      const page = await newPage(browser, consoleErrors, { width: w.width, height: w.height });
      await gotoTop(page, base);
      await solveViaDevEntry(page, "puzzle-02");
      await openTrophyList(page);

      const overflow = await page.evaluate((w2) => {
        const def = TrophyModule.getAllDefinitions().find((d) => d.puzzleQuestionId === "puzzle-02");
        const card = document.querySelector(`#trophy-grid [data-trophy-id="${def.id}"]`);
        const rect = card.getBoundingClientRect();
        return rect.right <= w2 + 1 && rect.left >= -1;
      }, w.width);
      check(`テスト5(${w.label}): 謎解きカードが画面幅からあふれない`, overflow === true);

      const noteVisible = await page.evaluate(() => {
        const def = TrophyModule.getAllDefinitions().find((d) => d.puzzleQuestionId === "puzzle-02");
        const card = document.querySelector(`#trophy-grid [data-trophy-id="${def.id}"]`);
        const note = card.querySelector(".trophy-note");
        return !!note && note.getBoundingClientRect().width > 0;
      });
      check(`テスト5(${w.label}): 注釈が見える状態で表示される`, noteVisible === true);

      await page.close();
    }
    check("テスト5: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
  }

  // ========================================================
  // テスト6: 再読み込み後も獲得記録(名称・解説文・注釈)が保持される
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await gotoTop(page, base);
    await solveViaDevEntry(page, "puzzle-02");
    await page.reload({ waitUntil: "load" });
    await openTrophyList(page);
    const info = await getCardStyleInfo(page, "puzzle-02");
    check("テスト6: 再読み込み後も解説文が保持される", info.descText.includes("2026年の推計"));
    check("テスト6: 再読み込み後も注釈が保持される", !!info.noteText && info.noteText.includes("国連"));

    check("テスト6: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  await browser.close();
  server.close();

  console.log("\nTotal:", pass + fail, "Pass:", pass, "Fail:", fail);
  process.exit(fail > 0 ? 1 : 0);
})();
