// ==========================================================
// 謎解きトロフィー獲得演出の効果音制御テスト(PR #81追加修正)。
//
// js/app.jsのrenderPuzzleTrophyAwardScreen()はSoundManager.playFanfare()を
// 呼ぶが、これ自体は既存のSoundManager.safePlay()が持つ「効果音設定
// (Storage.isSoundEnabled())がOFFなら何もしない」というガードを素通りで
// 使っているだけで、二重の有効/無効判定は追加していない(js/app.jsの既存の
// 他のSoundManager.playFanfare()呼び出し箇所と同じ形)。
//
// 本テストでは、AudioContext.prototype.createOscillator()をスパイして
// 実際に音を生成する処理が走ったかどうかを確認することで、
//   - 効果音OFF時は謎解きトロフィー獲得時に一切音を生成しないこと
//   - 効果音ON時は実際に音を生成すること(js/puzzle.jsのhandleSubmit()に
//     追加したSoundManager.unlock()が正しく働いていること)
//   - どちらの場合もエラーが発生しないこと(iPhone Safariの自動再生制限を
//     想定したtry/catch・resume処理の確認)
// を確認する。
//
// 実行方法: node tests/playwright_puzzle_trophy_sound.test.js
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

async function newPage(browser, consoleErrors) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  // createOscillator()を一度でも呼んだかをwindow.__oscCountに記録する
  // (AudioContext生成前に仕込むため、addInitScriptでページ読み込みの
  // 最初から有効にする)
  await page.addInitScript(() => {
    window.__oscCount = 0;
    const patch = () => {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC || AC.prototype.__oscPatched) return;
      const orig = AC.prototype.createOscillator;
      AC.prototype.createOscillator = function (...args) {
        window.__oscCount++;
        return orig.apply(this, args);
      };
      AC.prototype.__oscPatched = true;
    };
    patch();
  });
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

async function solveCorrectly(page, questionId) {
  const ids = await page.evaluate((qid) => PUZZLE_QUESTIONS_BY_ID[qid].answerIds.slice(), questionId);
  for (const id of ids) {
    await page.click(`.puzzle-flag-card[data-id="${id}"]`);
  }
  await page.click("#puzzle-answer-submit");
}

(async () => {
  const browser = await chromium.launch();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const consoleErrors = [];

  // ========================================================
  // テスト1: 効果音OFF時は謎解きトロフィー獲得時に音を生成しない
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await openPuzzleFromTrophyList(page, base, "puzzle-02");
    await page.evaluate(() => SoundManager.setEnabled(false));
    const enabledAfterOff = await page.evaluate(() => SoundManager.isEnabled());
    check("テスト1: SoundManager.setEnabled(false)が反映される", enabledAfterOff === false);

    await solveCorrectly(page, "puzzle-02");
    await page.waitForSelector("#screen-puzzle-trophy-award.active", { timeout: 5000 });
    await page.waitForTimeout(200);
    const oscCount = await page.evaluate(() => window.__oscCount);
    check("テスト1: 効果音OFF時は獲得演出でoscillatorが1つも生成されない", oscCount === 0);

    check("テスト1: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト2: 効果音ON(デフォルト)時は謎解きトロフィー獲得時に音を生成する
  // (js/puzzle.jsのhandleSubmit()に追加したSoundManager.unlock()が
  // 正しく機能し、国旗/首都クイズを一度も選んでいない経路でもAudioContext
  // が初期化されることを確認する)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await openPuzzleFromTrophyList(page, base, "puzzle-04");
    const enabledDefault = await page.evaluate(() => SoundManager.isEnabled());
    check("テスト2: 効果音はデフォルトでONになっている", enabledDefault === true);

    await solveCorrectly(page, "puzzle-04");
    await page.waitForSelector("#screen-puzzle-trophy-award.active", { timeout: 5000 });
    await page.waitForTimeout(200);
    const oscCount = await page.evaluate(() => window.__oscCount);
    check("テスト2: 効果音ON時は獲得演出でoscillatorが生成される(ファンファーレが実際に鳴る)", oscCount > 0);

    check("テスト2: コンソール/ページエラーが発生していない(自動再生制限環境でもエラーにならない)", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト3: UIの効果音トグルボタンでOFFにした場合も同様に無音になる
  // (実際のユーザー操作経路: トップ画面の#btn-sound-toggleを押す)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await page.goto(`${base}?puzzleDev=1`, { waitUntil: "load" });
    await page.click("#btn-sound-toggle");
    const pressed = await page.getAttribute("#btn-sound-toggle", "aria-pressed");
    check("テスト3: 効果音トグルボタンでOFFになる(aria-pressed=false)", pressed === "false");

    await page.click("#btn-trophy-list");
    await page.waitForSelector("#screen-trophy-list.active");
    await page.click("#btn-dev-puzzle-entry");
    await page.waitForSelector('.puzzle-dev-question-btn[data-question-id="puzzle-01"]');
    await page.click('.puzzle-dev-question-btn[data-question-id="puzzle-01"]');
    await page.waitForSelector("#screen-puzzle-flag-select.active");
    await page.waitForTimeout(300);
    await solveCorrectly(page, "puzzle-01");
    await page.waitForSelector("#screen-puzzle-trophy-award.active", { timeout: 5000 });
    await page.waitForTimeout(200);
    const oscCount = await page.evaluate(() => window.__oscCount);
    check("テスト3: UIトグルでOFFにした場合も獲得演出で無音になる", oscCount === 0);

    // 設定が保存され、再読み込み後も維持されること
    await page.reload({ waitUntil: "load" });
    const enabledAfterReload = await page.evaluate(() => SoundManager.isEnabled());
    check("テスト3: 効果音OFF設定は再読み込み後も保持される", enabledAfterReload === false);

    check("テスト3: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  await browser.close();
  server.close();

  console.log("\nTotal:", pass + fail, "Pass:", pass, "Fail:", fail);
  process.exit(fail > 0 ? 1 : 0);
})();
