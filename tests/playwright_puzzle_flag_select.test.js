// ==========================================================
// 謎への挑戦: 国旗選択画面(第1段階)に対するテスト。
//
// この画面は、今後実装予定の「世界図鑑×謎解きトロフィー」(企画段階の
// 目安は32問だが、将来増減する可能性がある)で共通利用する、国旗選択
// 専用のUI。今回は正解判定・トロフィー獲得処理・実際の問題データとの
// 連動を行わないため、このテストでは以下だけを検証する。
//
// 1. 198件すべてが表示され、重複や欠落がなく、五十音順になっている。
// 2. 国旗をタップすると選択欄に追加され、同じ国旗を複数回選択できる
//    (「10種類」ではなく「10回」の仕様)。選択順が番号付きで保持される。
// 3. 最大10回で選択が止まり、11回目は追加されない。
// 4. 選択済みの個別削除・全削除が正しく動作し、削除後は番号が振り直され、
//    再び選択できる。
// 5. 国名検索・地域フィルターが正しく動作し、両方を併用でき、検索・地域
//    変更をしても選択内容が消えない。
// 6. 回答確定ボタンは0件選択時は押せず、1件以上で押せる。押すとテスト用の
//    メッセージが表示されるだけで、トロフィー獲得処理は一切発生しない。
// 7. 既存の世界図鑑・国旗/首都クイズ・トロフィー一覧など、既存機能の
//    スクリーンやデータに影響がないこと。
//
// 実行方法: node tests/playwright_puzzle_flag_select.test.js
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

// 本番では公開しない開発確認用の仮入口(#btn-dev-puzzle-entry)経由で画面を開く。
// 一般利用者向けの通常URLでは常に非表示のため、URLに"?puzzleDev=1"を付けて
// アクセスし、開発・動作確認時だけ表示されることを利用する
// (js/puzzle.jsのisPuzzleDevEntryRequested()参照)。
// 正式な「この謎に挑む」導線ができたら、この起動方法を差し替える
async function openPuzzleScreen(page, base) {
  await page.goto(`${base}?puzzleDev=1`, { waitUntil: "load" });
  await page.click("#btn-trophy-list");
  await page.waitForSelector("#btn-dev-puzzle-entry:not(.hidden)", { timeout: 5000 });
  await page.click("#btn-dev-puzzle-entry");
  await page.waitForSelector("#screen-puzzle-flag-select.active");
  await page.waitForTimeout(300);
}

async function gridIds(page) {
  return page.$$eval("#puzzle-grid .puzzle-flag-card", (els) => els.map((el) => el.dataset.id));
}
async function answerState(page) {
  return page.evaluate(() => ({
    count: document.getElementById("puzzle-answer-count").textContent,
    chips: Array.from(document.querySelectorAll("#puzzle-answer-list .puzzle-answer-chip")).map((el) => el.getAttribute("aria-label")),
    submitDisabled: document.getElementById("puzzle-answer-submit").disabled,
    clearDisabled: document.getElementById("puzzle-answer-clear").disabled,
  }));
}

(async () => {
  const browser = await chromium.launch();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const consoleErrors = [];

  // ========================================================
  // テスト1: 198件すべてが表示され、重複・欠落がなく、五十音順になっている
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await openPuzzleScreen(page, base);

    const info = await page.evaluate(() => {
      const ids = Array.from(document.querySelectorAll("#puzzle-grid .puzzle-flag-card")).map((el) => el.dataset.id);
      const countryIds = COUNTRIES.map((c) => c.id);
      const idSet = new Set(ids);
      const countrySet = new Set(countryIds);
      const missing = countryIds.filter((id) => !idSet.has(id));
      const extra = ids.filter((id) => !countrySet.has(id));
      const yomis = ids.map((id) => ENCYCLOPEDIA_YOMIGANA[id] || "");
      const collator = new Intl.Collator("ja");
      let sorted = true;
      for (let i = 1; i < yomis.length; i++) {
        if (collator.compare(yomis[i - 1], yomis[i]) > 0) { sorted = false; break; }
      }
      return { total: ids.length, unique: idSet.size, missingCount: missing.length, extraCount: extra.length, sorted };
    });
    check("テスト1: 198件すべてが表示される", info.total === 198);
    check("テスト1: 198件とも重複がない", info.unique === 198);
    check("テスト1: COUNTRIESに存在するのに表示されていない国がない", info.missingCount === 0);
    check("テスト1: COUNTRIESに存在しないidが混ざっていない", info.extraCount === 0);
    check("テスト1: 読み仮名基準の五十音順になっている", info.sorted);

    check("テスト1: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト2〜4: 選択・個別削除・全削除・上限10回
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await openPuzzleScreen(page, base);

    const jpCard = await page.$('.puzzle-flag-card[data-id="jp"]');
    const usCard = await page.$('.puzzle-flag-card[data-id="us"]');

    // 日本→アメリカ→カナダ→日本→アメリカ、の順で選択(同じ国旗を複数回)
    const caCard = await page.$('.puzzle-flag-card[data-id="ca"]');
    await jpCard.click();
    await usCard.click();
    await caCard.click();
    await jpCard.click();
    await usCard.click();

    const state1 = await answerState(page);
    check("テスト2: 5回選択すると5/10と表示される", state1.count === "5 / 10");
    check(
      "テスト2: 選択順どおりに番号付きで保持される(同じ国旗の複数回選択も独立した項目になる)",
      JSON.stringify(state1.chips) ===
        JSON.stringify([
          "1番目に選んだ日本を削除",
          "2番目に選んだアメリカを削除",
          "3番目に選んだカナダを削除",
          "4番目に選んだ日本を削除",
          "5番目に選んだアメリカを削除",
        ])
    );

    // 4番目(2つ目の日本)だけを削除 -> 1番目の日本は残る
    const chipsBeforeRemove = await page.$$("#puzzle-answer-list .puzzle-answer-chip");
    await chipsBeforeRemove[3].click();
    const state2 = await answerState(page);
    check(
      "テスト3: 個別削除で指定位置だけが消え、番号が振り直される(他の同じ国旗は残る)",
      JSON.stringify(state2.chips) ===
        JSON.stringify([
          "1番目に選んだ日本を削除",
          "2番目に選んだアメリカを削除",
          "3番目に選んだカナダを削除",
          "4番目に選んだアメリカを削除",
        ])
    );
    check("テスト3: 削除後は4/10になる", state2.count === "4 / 10");

    // 全削除
    await page.click("#puzzle-answer-clear");
    const state3 = await answerState(page);
    check("テスト3: 全削除で0/10に戻る", state3.count === "0 / 10");
    check("テスト3: 全削除後は選択欄が空になる", state3.chips.length === 0);
    check("テスト3: 全削除後は回答確定ボタンが押せない", state3.submitDisabled === true);

    // 削除後も再選択できる
    await jpCard.click();
    const state4 = await answerState(page);
    check("テスト3: 全削除後も再び選択できる", state4.count === "1 / 10");

    await page.click("#puzzle-answer-clear");

    // 上限10回のテスト: 同じ国旗を11回タップ
    for (let i = 0; i < 11; i++) {
      await jpCard.click();
    }
    const state5 = await answerState(page);
    check("テスト4: 10回選択すると10/10で止まり、11回目は追加されない", state5.count === "10 / 10");
    check("テスト4: 上限に達すると回答確定ボタンが押せる状態のまま", state5.submitDisabled === false);

    check("テスト2-4: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト5: 検索・地域フィルター(併用・選択内容の保持)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await openPuzzleScreen(page, base);

    // 選択してから検索・フィルターを操作しても、選択内容が消えないことを確認する
    await page.click('.puzzle-flag-card[data-id="jp"]');
    await page.click('.puzzle-flag-card[data-id="us"]');

    await page.fill("#puzzle-search-input", "にほん");
    await page.waitForTimeout(200);
    const searchIds = await gridIds(page);
    check("テスト5: ひらがな検索で日本だけに絞り込める", JSON.stringify(searchIds) === JSON.stringify(["jp"]));
    const stateAfterSearch = await answerState(page);
    check("テスト5: 検索中でも選択済みの回答(2件)は保持される", stateAfterSearch.count === "2 / 10");

    await page.click("#puzzle-search-clear");
    await page.waitForTimeout(200);
    const afterClearIds = await gridIds(page);
    check("テスト5: 検索をクリアすると198件の一覧に戻る", afterClearIds.length === 198);

    await page.click('.puzzle-region-tab[data-region="asia"]');
    await page.waitForTimeout(200);
    const asiaIds = await gridIds(page);
    const asiaCountInData = await page.evaluate(() => COUNTRIES.filter((c) => c.region === "asia").length);
    check("テスト5: 地域フィルター(アジア)が正しく絞り込める", asiaIds.length === asiaCountInData && asiaIds.length > 0);
    const stateAfterRegion = await answerState(page);
    check("テスト5: 地域フィルター変更後も選択済みの回答は保持される", stateAfterRegion.count === "2 / 10");

    // 検索と地域フィルターの併用
    await page.fill("#puzzle-search-input", "あ");
    await page.waitForTimeout(200);
    const combinedIds = await gridIds(page);
    const expectedCombined = await page.evaluate(() => {
      function toHiragana(str) { return str.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60)); }
      function norm(str) { return toHiragana(String(str).normalize("NFKC")).toLowerCase(); }
      return COUNTRIES.filter((c) => c.region === "asia" && norm([c.name, c.englishName, ENCYCLOPEDIA_YOMIGANA[c.id] || ""].join(" ")).includes(norm("あ"))).length;
    });
    check("テスト5: 検索と地域フィルターを併用できる", combinedIds.length === expectedCombined && combinedIds.length > 0 && combinedIds.length < asiaIds.length);

    check("テスト5: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト6: 回答確定ボタン(押せる/押せない、テストメッセージ、
  // トロフィー獲得処理が発生しないこと)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await openPuzzleScreen(page, base);

    const submitDisabledInitial = await page.$eval("#puzzle-answer-submit", (el) => el.disabled);
    check("テスト6: 0件選択時は回答確定ボタンが押せない", submitDisabledInitial === true);

    await page.click('.puzzle-flag-card[data-id="jp"]');
    const submitDisabledAfterOne = await page.$eval("#puzzle-answer-submit", (el) => el.disabled);
    check("テスト6: 1件選択すると回答確定ボタンが押せる", submitDisabledAfterOne === false);

    const trophyCountBefore = await page.evaluate(() => Object.keys(TrophyModule.getEarned()).length);
    await page.click("#puzzle-answer-submit");
    const msg = await page.$eval("#puzzle-answer-message", (el) => el.textContent);
    check("テスト6: 回答確定でテスト用メッセージが表示される", msg.includes("回答を受け付けました"));
    const trophyCountAfter = await page.evaluate(() => Object.keys(TrophyModule.getEarned()).length);
    check("テスト6: 回答確定ではトロフィー獲得処理が一切発生しない", trophyCountAfter === trophyCountBefore);

    // 選択を変更するとメッセージが消える
    await page.click('.puzzle-flag-card[data-id="us"]');
    const msgHidden = await page.$eval("#puzzle-answer-message", (el) => el.classList.contains("hidden"));
    check("テスト6: 選択内容を変更すると直前の回答メッセージが消える", msgHidden === true);

    check("テスト6: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト7: 再度開くと状態がリセットされる(1回の挑戦ごとに新しい回答)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await openPuzzleScreen(page, base);
    await page.click('.puzzle-flag-card[data-id="jp"]');
    await page.click('.puzzle-flag-card[data-id="us"]');
    const before = await answerState(page);
    check("テスト7: 事前準備として2件選択できている", before.count === "2 / 10");

    // 戻る→もう一度開く
    await page.click("#btn-puzzle-back");
    await page.waitForSelector("#screen-top.active");
    await page.click("#btn-trophy-list");
    await page.click("#btn-dev-puzzle-entry");
    await page.waitForSelector("#screen-puzzle-flag-select.active");
    await page.waitForTimeout(300);

    const after = await answerState(page);
    check("テスト7: 再度開くと選択状態が0/10にリセットされる", after.count === "0 / 10");

    check("テスト7: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト8: レスポンシブ(スマホ4列・タブレット6列・PC8列の目安)と
  // タップ領域(44x44px以上)
  // ========================================================
  {
    const widths = [
      { width: 390, height: 844, label: "スマホ", minCols: 3, maxCols: 5 },
      { width: 820, height: 1180, label: "タブレット", minCols: 5, maxCols: 7 },
      { width: 1440, height: 900, label: "PC", minCols: 7, maxCols: 9 },
    ];
    for (const w of widths) {
      const page = await newPage(browser, consoleErrors, { width: w.width, height: w.height });
      await openPuzzleScreen(page, base);
      const cols = await page.$eval("#puzzle-grid", (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
      check(`テスト8(${w.label}, ${w.width}px): 列数が目安の範囲内(${w.minCols}〜${w.maxCols}列)`, cols >= w.minCols && cols <= w.maxCols);

      const cardBox = await page.$eval(".puzzle-flag-card", (el) => {
        const r = el.getBoundingClientRect();
        return { width: r.width, height: r.height };
      });
      check(`テスト8(${w.label}): 国旗カードのタップ領域が44x44px以上`, cardBox.width >= 44 && cardBox.height >= 44);

      await page.close();
    }
    check("テスト8: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
  }

  // ========================================================
  // テスト9: 既存機能への影響がないこと(トロフィー一覧・世界図鑑・
  // 国旗クイズ・既存トロフィーデータ)
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);
    await page.goto(base, { waitUntil: "load" }); // クエリパラメータなしの通常URL

    // トロフィー一覧画面が従来どおり開ける(開発用ボタンが追加されているだけ)
    await page.click("#btn-trophy-list");
    await page.waitForSelector("#screen-trophy-list.active");
    const trophyGridCount = await page.$$eval("#trophy-grid > *", (els) => els.length);
    check("テスト9: トロフィー一覧画面が従来どおり描画される(カードが存在する)", trophyGridCount > 0);

    // 一般利用者向けの通常URL(?puzzleDev=1なし)では、開発確認用の仮ボタンが表示されない
    const devBtnHiddenForGeneralUsers = await page.$eval("#btn-dev-puzzle-entry", (el) => el.classList.contains("hidden"));
    check("テスト9: 通常URLでは開発用の仮入口ボタンが表示されない(一般利用者には非公開)", devBtnHiddenForGeneralUsers === true);

    await page.click("#screen-trophy-list .btn-back");
    await page.waitForSelector("#screen-top.active");

    // 世界図鑑が従来どおり開ける
    await page.click('.mode-card[data-mode="encyclopedia"]');
    await page.waitForSelector("#screen-encyclopedia-list.active");
    const encyCount = await page.$$eval("#ency-grid .ency-card", (els) => els.length);
    check("テスト9: 世界図鑑の一覧が従来どおり198件描画される", encyCount === 198);
    await page.click("#btn-ency-back");
    await page.waitForSelector("#screen-top.active");

    // 国旗クイズの問題数選択画面が従来どおり開ける
    await page.click('.mode-card[data-mode="flag"]');
    await page.waitForSelector("#screen-select.active");

    check("テスト9: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  // ========================================================
  // テスト10: 開発確認用の仮入口は"?puzzleDev=1"がある場合だけ表示され、
  // それ以外(通常URル・無関係なクエリパラメータ)では表示されない
  // ========================================================
  {
    const page = await newPage(browser, consoleErrors);

    // 10-1: 通常URL(クエリパラメータなし)
    await page.goto(base, { waitUntil: "load" });
    await page.click("#btn-trophy-list");
    await page.waitForSelector("#screen-trophy-list.active");
    const hiddenNoQuery = await page.$eval("#btn-dev-puzzle-entry", (el) => el.classList.contains("hidden"));
    check("テスト10: クエリパラメータなしでは開発用ボタンが非表示", hiddenNoQuery === true);
    await page.click("#screen-trophy-list .btn-back");
    await page.waitForSelector("#screen-top.active");

    // 10-2: 無関係なクエリパラメータだけでは表示されない(誤って表示されないことの確認)
    await page.goto(`${base}?foo=1`, { waitUntil: "load" });
    await page.click("#btn-trophy-list");
    await page.waitForSelector("#screen-trophy-list.active");
    const hiddenWrongQuery = await page.$eval("#btn-dev-puzzle-entry", (el) => el.classList.contains("hidden"));
    check("テスト10: 無関係なクエリパラメータでは開発用ボタンが非表示", hiddenWrongQuery === true);
    await page.click("#screen-trophy-list .btn-back");
    await page.waitForSelector("#screen-top.active");

    // 10-3: "?puzzleDev=1"を付けた場合だけ表示され、実際に画面を開けること
    await page.goto(`${base}?puzzleDev=1`, { waitUntil: "load" });
    await page.click("#btn-trophy-list");
    await page.waitForSelector("#btn-dev-puzzle-entry:not(.hidden)", { timeout: 5000 });
    await page.click("#btn-dev-puzzle-entry");
    await page.waitForSelector("#screen-puzzle-flag-select.active");
    check("テスト10: \"?puzzleDev=1\"を付けた場合は開発用ボタンが表示され、画面を開ける", true);

    check("テスト10: コンソール/ページエラーが発生していない", consoleErrors.length === 0);
    await page.close();
  }

  await browser.close();
  server.close();

  console.log("\nTotal:", pass + fail, "Pass:", pass, "Fail:", fail);
  process.exit(fail > 0 ? 1 : 0);
})();
