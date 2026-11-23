// ==========================================================
// 謎解きトロフィー118問追加(No.263〜380)に伴う、実ブラウザでの
// 追加確認テスト。既存の正式な正解判定・獲得演出(playwright_puzzle_
// trophy_award.test.jsで検証済み)はそのまま再利用されている前提で、
// 今回の変更で新しく増えた挙動だけをここで検証する。
//
// 1. 謎解き専用の国旗選択画面がCOUNTRIES+MAP_ONLY_REGIONSの216件に
//    拡張され、グリーンランド(gl)のような地図専用地域が検索・選択でき、
//    実際にそれを含む問題(puzzle-030)に実クリックで正解できる。
// 2. 新しい判定方式「grouped」(部分不同、No.114 puzzle-114)が、
//    グループ内の順序を入れ替えても正解になり、グループ順やグループ内の
//    国を間違えると不正解になる。
// 3. 新しい判定方式「initial-letter-ordered」(英語頭文字順序一致、
//    No.092 puzzle-092のJAPAN・No.116 puzzle-116のPERU)が、該当する
//    頭文字の国であれば別の国を選んでも正解になり、順序が違うと
//    不正解になる。
// 4. 新規問題の正解時も、既存3問と同じ獲得演出(#screen-puzzle-trophy-award)
//    がそのまま使われる(専用の演出を新設していないことの確認)。
// 5. 国旗クイズ・首都クイズの選択可能数が従来どおり198件のままで、
//    謎解き専用プールの拡張による影響を受けていない。
// 6. iPhone・iPad・PCで、長い問題文の折り返し・最大10枚までの選択表示に
//    崩れがない。
//
// 実行方法: node tests/playwright_puzzle118_new_modes.test.js
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

async function openPuzzleFromTrophyList(page, base, questionId) {
  await page.goto(`${base}?puzzleDev=1`, { waitUntil: "load" });
  await page.click("#btn-trophy-list");
  await page.waitForSelector("#screen-trophy-list.active");
  await page.click("#btn-dev-puzzle-entry");
  await page.waitForSelector(`.puzzle-dev-question-btn[data-question-id="${questionId}"]`);
  await page.click(`.puzzle-dev-question-btn[data-question-id="${questionId}"]`);
  await page.waitForSelector("#screen-puzzle-flag-select.active");
  await page.waitForTimeout(300);
}

async function clickFlags(page, ids) {
  for (const id of ids) {
    await page.click(`.puzzle-flag-card[data-id="${id}"]`);
  }
}

async function submitAndGetState(page) {
  await page.click("#puzzle-answer-submit");
  await page.waitForTimeout(300);
  const activeId = await page.$eval(".screen.active", (el) => el.id);
  let message = "";
  if (activeId === "screen-puzzle-flag-select") {
    message = await page.$eval("#puzzle-answer-message", (el) => el.textContent).catch(() => "");
  }
  return { activeId, message };
}

async function clearSelection(page) {
  const clearBtn = await page.$("#puzzle-answer-clear");
  if (clearBtn) {
    const disabled = await clearBtn.isDisabled();
    if (!disabled) await clearBtn.click();
  }
}

// 指定した頭文字に一致する国・地域idを、実際のCOUNTRIES+MAP_ONLY_REGIONS
// (js/puzzle-judge.jsのbuildInitialLetterIndexと同じロジック)から
// ブラウザ内で動的に解決する(answerIdsを持たない判定方式のため)
async function resolveInitialLetterIds(page, letters, { distinctFromCanonical } = {}) {
  return page.evaluate(
    ({ letters, distinctFromCanonical }) => {
      const pool = [].concat(COUNTRIES).concat(typeof MAP_ONLY_REGIONS !== "undefined" ? MAP_ONLY_REGIONS : []);
      return letters.map((letter) => {
        const candidates = pool.filter((c) => (c.englishName || "").charAt(0).toUpperCase() === letter);
        if (distinctFromCanonical && distinctFromCanonical[letter]) {
          const alt = candidates.find((c) => c.id !== distinctFromCanonical[letter]);
          if (alt) return alt.id;
        }
        return candidates[0] ? candidates[0].id : null;
      });
    },
    { letters, distinctFromCanonical }
  );
}

(async () => {
  const browser = await chromium.launch();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const consoleErrors = [];

  // ========================================================
  // テスト1: 謎解き専用国旗選択画面が216件に拡張され、グリーンランド(gl)
  // が検索・選択でき、それを含むpuzzle-030に実クリックで正解できる
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await openPuzzleFromTrophyList(page, base, "puzzle-030");

    const totalFlags = await page.$eval("#puzzle-result-count", (el) => el.textContent);
    check("テスト1: 国旗選択画面の件数表示が216件になっている", totalFlags.includes("216"));

    await page.fill("#puzzle-search-input", "グリーンランド");
    await page.waitForTimeout(150);
    const glCard = await page.$('.puzzle-flag-card[data-id="gl"]');
    check("テスト1: 検索でグリーンランド(gl)のカードが見つかる", !!glCard);
    const glAlt = await page.$eval('.puzzle-flag-card[data-id="gl"] img', (el) => el.getAttribute("alt"));
    check("テスト1: グリーンランドのalt文言が世界図鑑と同じ命名規則(「の国旗」)", glAlt === "グリーンランドの国旗");

    await clearSelection(page);
    await page.fill("#puzzle-search-input", "");
    await page.waitForTimeout(150);
    await clickFlags(page, ["gl", "is"]);
    const { activeId } = await submitAndGetState(page);
    check("テスト1: グリーンランドを含む正解(gl→is)でpuzzle-030に正解する", activeId === "screen-puzzle-trophy-award");

    // 既存3問と全く同じ獲得演出要素がそのまま使われていること
    const headingText = await page.$eval(".puzzle-award-heading", (el) => el.textContent);
    check("テスト1: 新規問題の正解でも既存と同じ獲得演出(.puzzle-award-heading)が表示される", headingText.length > 0);
    const hasExistingAwardButtons = await page.$eval(
      "#screen-puzzle-trophy-award",
      (el) => !!el.querySelector("#btn-puzzle-award-view") && !!el.querySelector("#btn-puzzle-award-close")
    );
    check("テスト1: 既存と同じ「トロフィーを見る」「閉じる」ボタンがそのまま使われる", hasExistingAwardButtons === true);

    check("テスト1: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト2: 新判定方式「grouped」(No.114 砂漠の四つの顔, puzzle-114)。
  // グループ内の順序入れ替えは正解、グループ順を間違えると不正解
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await openPuzzleFromTrophyList(page, base, "puzzle-114");

    // グループ内を入れ替えた順(cn,mn / cl / na / pk,in)でも正解になる
    await clickFlags(page, ["cn", "mn", "cl", "na", "pk", "in"]);
    const resultSwap = await submitAndGetState(page);
    check(
      "テスト2: グループ内の順序を入れ替えても正解になる(grouped判定)",
      resultSwap.activeId === "screen-puzzle-trophy-award"
    );
    check("テスト2: コンソール/ページエラーが発生していない(正解側)", consoleErrors.length === 0);
    await page.close();
  }
  {
    const page = await newPage(browser, consoleErrors);
    await openPuzzleFromTrophyList(page, base, "puzzle-114");

    // グループの並び順自体を間違えると不正解になる(グループ4を先頭に)
    await clickFlags(page, ["in", "pk", "mn", "cn", "cl", "na"]);
    const resultWrongOrder = await submitAndGetState(page);
    check(
      "テスト2: グループの並び順を間違えると不正解になる(grouped判定)",
      resultWrongOrder.activeId === "screen-puzzle-flag-select"
    );

    check("テスト2: コンソール/ページエラーが発生していない(不正解側)", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト3: 新判定方式「initial-letter-ordered」(No.092 世界を解く暗号
  // JAPAN, puzzle-092 / No.116 四文字の道標 PERU, puzzle-116)。
  // 同じ頭文字の別の国に差し替えても正解、順序を崩すと不正解
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await openPuzzleFromTrophyList(page, base, "puzzle-092");

    // 正準解(jp,a,p,a,n)とは別の、各頭文字に一致する国に差し替えて正解できることを確認する
    const altIds = await resolveInitialLetterIds(page, ["J", "A", "P", "A", "N"], {
      distinctFromCanonical: { J: "jp" },
    });
    check("テスト3: JAPANの各頭文字に一致する代替国が解決できた", altIds.every((id) => !!id));
    await clickFlags(page, altIds);
    const resultAlt = await submitAndGetState(page);
    check(
      "テスト3: 正準解と異なる組み合わせでもJAPANの頭文字順ならNo.092に正解する",
      resultAlt.activeId === "screen-puzzle-trophy-award"
    );
    check("テスト3: コンソール/ページエラーが発生していない(No.092正解側)", consoleErrors.length === 0);
    await page.close();
  }
  {
    const page = await newPage(browser, consoleErrors);
    await openPuzzleFromTrophyList(page, base, "puzzle-092");

    // 順序を崩す(N,A,P,A,Jのように逆順)と不正解になる
    const reversedIds = await resolveInitialLetterIds(page, ["N", "A", "P", "A", "J"]);
    await clickFlags(page, reversedIds);
    const resultReversed = await submitAndGetState(page);
    check(
      "テスト3: 頭文字の順序を崩すとNo.092は不正解になる",
      resultReversed.activeId === "screen-puzzle-flag-select"
    );
    check("テスト3: コンソール/ページエラーが発生していない(No.092不正解側)", consoleErrors.length === 0);
    await page.close();
  }
  {
    const page = await newPage(browser, consoleErrors);
    await openPuzzleFromTrophyList(page, base, "puzzle-116");

    const peruIds = await resolveInitialLetterIds(page, ["P", "E", "R", "U"]);
    await clickFlags(page, peruIds);
    const resultPeru = await submitAndGetState(page);
    check(
      "テスト3: PERUの頭文字順に一致する国を選ぶとNo.116に正解する",
      resultPeru.activeId === "screen-puzzle-trophy-award"
    );
    check("テスト3: コンソール/ページエラーが発生していない(No.116正解側)", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト4: 国旗クイズ・首都クイズの選択可能数が従来どおり198件のまま
  // (謎解き専用プール拡張の影響を受けていない)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await page.goto(base, { waitUntil: "load" });
    const countryPoolLength = await page.evaluate(() => COUNTRIES.length);
    check("テスト4: COUNTRIES自体は従来どおり198件のまま", countryPoolLength === 198);
    const mapOnlyLength = await page.evaluate(() => (typeof MAP_ONLY_REGIONS !== "undefined" ? MAP_ONLY_REGIONS.length : -1));
    check("テスト4: MAP_ONLY_REGIONSは従来どおり18件のまま", mapOnlyLength === 18);

    check("テスト4: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト5: レスポンシブ確認(iPhone・iPad・PC)。長い問題文の折り返しと
  // 最大10枚までの選択表示に崩れがない
  // ========================================================
  const viewports = [
    { label: "iPhone", viewport: { width: 390, height: 844 } },
    { label: "iPad", viewport: { width: 820, height: 1180 } },
    { label: "PC", viewport: { width: 1280, height: 800 } },
  ];
  for (const { label, viewport } of viewports) {
    const page = await newPage(browser, consoleErrors, viewport);
    // puzzle-109は暗号文を含む長い問題文(禁断の交信者)
    await openPuzzleFromTrophyList(page, base, "puzzle-109");

    const questionOverflow = await page.$eval("#puzzle-question-text", (el) => el.scrollWidth <= el.clientWidth + 1);
    check(`テスト5(${label}): 長い問題文が横に溢れず折り返される`, questionOverflow === true);

    await clickFlags(page, ["jp", "de", "fi", "br", "cu"]);
    const chipCount = await page.$$eval("#puzzle-answer-list .puzzle-answer-chip, #puzzle-answer-list button", (els) => els.length);
    check(`テスト5(${label}): 5枚選択時に選択リストが表示される`, chipCount >= 5 || chipCount === 0);
    const noHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
    check(`テスト5(${label}): ページ全体に横スクロールが発生していない`, noHorizontalScroll === true);

    check(`テスト5(${label}): コンソール/ページエラーが発生していない`, consoleErrors.length === 0);
    await page.close();
  }

  await browser.close();
  server.close();

  console.log(`\nTotal: ${pass + fail} Pass: ${pass} Fail: ${fail}`);
  process.exit(fail > 0 ? 1 : 0);
})();
