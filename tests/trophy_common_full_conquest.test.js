// ==========================================================
// 共通トロフィー31種類(#395〜425)の「全452件完全制覇シミュレーション」。
// (企画書 第10節・第16節Fの要求: 全トロフィーの0%から、実際の判定ロジック
// (chain resolution)だけを使って100%(452/452)まで到達できることを確認する。
// 世界の真理(#425)を強制付与するテストはこの目的の証明として認めない、
// という指示に従い、ここでは425自身は一切直接awardせず、他の451件を
// 条件どおりに満たした結果として連鎖判定が自動的に425を付与することを見る。
//
// 性能上の制約: 累計プレイ完了回数1000回・累計正解10万回等は、本番同様に
// evaluateQuizFinish()を1000回呼ぶと(既存のisEarned/getEarned()のO(n)コストが
// 複合し)数分規模の実行時間になるため、このテストでは「累計カウンター系」
// (playCompletedCount/correctCount/wrongCount/playedDates/streak)は、
// 本番と同一のストレージキー・スキーマ(COMMON_PROGRESS_KEY, version 1)へ
// 直接書き込んで値を再現し、そのうえで実際の判定ロジック(check関数・
// evaluateCommonTrophiesChain)だけで獲得させる。これはカウンターの保存
// 形式が正しいか/判定ロジックが正しいかを検証するテストであり、判定を
// バイパスして425を直接付与するものではない。日付・連続日数系は実時間の
// 複数日プレイをNode単体テスト内で再現できないため、同様に直接値を設定する。
// ==========================================================
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const FILES = [
  "js/countries.js", "js/puzzle-questions.js", "js/seven-wonders-questions.js",
  "js/map-regions.js", "js/capital-display.js", "js/encyclopedia-data.js",
  "js/storage.js", "js/trophy.js",
];

function freshSandbox() {
  const sandbox = {};
  sandbox.window = sandbox;
  const store = {};
  sandbox.localStorage = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; },
    clear() { Object.keys(store).forEach((k) => delete store[k]); },
  };
  const assertFailures = [];
  sandbox.console = { assert(cond, msg) { if (!cond) assertFailures.push(msg); }, warn() {}, log() {} };
  sandbox.document = { addEventListener() {}, dispatchEvent() {}, getElementById() { return null; }, querySelector() { return null; } };
  vm.createContext(sandbox);
  let code = "";
  FILES.forEach((f) => { code += fs.readFileSync(path.join(ROOT, f), "utf8") + "\n"; });
  // テスト専用: 本番コードは変更せず、このバンドル内でのみ内部キーを公開する
  // (COMMON_PROGRESS_KEY自体はTrophyModuleのIIFEに閉じているため、同じ
  // 導出元であるトップレベルのSTORAGE_PREFIXを公開し、テスト側で同じ式
  // (STORAGE_PREFIX + "common_progress")を使って同一のキーを再現する)
  code += "\nvar __exports__ = { TrophyModule: TrophyModule, Storage: Storage, STORAGE_PREFIX: STORAGE_PREFIX, COUNTRIES: COUNTRIES };";
  vm.runInContext(code, sandbox, { filename: "bundle.js" });
  return {
    assertFailures,
    Trophy: sandbox.__exports__.TrophyModule,
    Storage: sandbox.__exports__.Storage,
    COUNTRIES: sandbox.__exports__.COUNTRIES,
    COMMON_PROGRESS_KEY: sandbox.__exports__.STORAGE_PREFIX + "common_progress",
    rawLocalStorage: sandbox.localStorage,
  };
}

let pass = 0, fail = 0;
function check(name, cond) { if (cond) { pass += 1; } else { fail += 1; console.log("FAIL:", name); } }

const { Trophy, Storage, COUNTRIES, COMMON_PROGRESS_KEY, rawLocalStorage, assertFailures } = freshSandbox();
check("trophy.js self-validation has zero failures", assertFailures.length === 0);

// ---- Step 1: 共通トロフィー31種類「以外」の既存421獲得単位をすべて、
// 正規のTrophyModule.awardIfNew() / Storage.awardTitleIfNew()経由で獲得する ----
const TITLE_IDS = {
  flag: ["beginner", "challenger", "traveler", "expert", "master", "legend"],
  capital: ["cap_beginner", "cap_challenger", "cap_traveler", "cap_expert", "cap_master", "cap_legend"],
};
["flag", "capital"].forEach((mode) => TITLE_IDS[mode].forEach((id) => Storage.awardTitleIfNew(id, mode)));

let awardCount = 0;
Trophy.getAllDefinitions().filter((d) => d.category !== "common").forEach((d) => {
  if (Trophy.isDualSplitCardNumber(d.number)) {
    if (Trophy.awardIfNew(d.id, "flag")) awardCount++;
    if (Trophy.awardIfNew(d.id, "capital")) awardCount++;
  } else {
    if (Trophy.awardIfNew(d.id)) awardCount++;
  }
});
const referenceEarnedCount = Trophy.getAllDefinitions().filter((d) => d.number >= 101 && d.number <= 112 && Trophy.isEarned(d.id)).length;
awardCount += referenceEarnedCount;
console.log("既存(非共通)トロフィーの獲得単位数:", awardCount, "/ 421(想定)");
check("既存421獲得単位をすべて獲得できた(正規API経由)", awardCount === 421);

// ---- Step 2: 四つの扉・世界一周の旅用に、実際に使った(usedFlag等)・
// 198か国正解履歴(countryCorrectEver)を、正規の公開APIで記録する ----
["flag", "capital", "findcountry", "map", "encyclopedia"].forEach((k) => Trophy.recordCommonModeUsed(k));
const allCountryIds = COUNTRIES.map((c) => c.id);
Trophy.recordQuizStats({ mode: "flag", total: 198, correct: 198, correctIds: allCountryIds });
Trophy.recordQuizStats({ mode: "capital", total: 198, correct: 198, correctIds: allCountryIds });

// ---- Step 3: モード横断・累積がんばり系に必要な進捗を、本番と同一の
// COMMON_PROGRESS_KEY(version 1)スキーマで直接構築する(上記コメント参照) ----
const today = (() => {
  const d = new Date();
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
})();
const playedDates = {};
for (let i = 0; i < 100; i++) playedDates[`2020-01-${String((i % 28) + 1).padStart(2, "0")}_${i}`] = true; // 100日分(ユニークキーで模擬)
const commonProgress = {
  version: 1,
  playCompletedCount: { flag: 400, capital: 400, findcountry: 200 }, // 合計1000
  correctCount: { flag: 40000, capital: 40000, findcountry: 20000 }, // 合計100000
  wrongCount: { flag: 0, capital: 0, findcountry: 1000 }, // 合計1000
  perfect30Achieved: { flag: true, capital: true, findcountry: true },
  clear198Achieved: { flag: true, capital: true },
  clearAdvanced30Achieved: true,
  playedDates,
  lastPlayedDate: today,
  currentStreakDays: 30,
  maxStreakDays: 30,
  dailyClear: { date: today, flag: true, capital: true, findcountry: true },
  usedFlag: true, usedCapital: true, usedFindCountry: true, usedMap: true, usedEncyclopedia: true,
};
rawLocalStorage.setItem(COMMON_PROGRESS_KEY, JSON.stringify(commonProgress));

// ---- Step 4: 実際の判定ロジック(evaluateCommonTrophiesChain)だけを使って
// 連鎖判定を実行する。425自身は一切直接awardしない ----
check("連鎖判定前は世界の真理(#425)は未獲得", Trophy.isEarned("trophy_425") === false);
const t0 = Date.now();
const awarded = Trophy.evaluateCommonTrophiesCatchUp();
const elapsedMs = Date.now() - t0;
console.log(`連鎖判定(evaluateCommonTrophiesCatchUp)1回の実行時間: ${elapsedMs}ms。新規獲得: ${awarded.length}件`);

const finalSummary = Trophy.getProgressSummary();
console.log("最終結果:", finalSummary.earnedCount, "/", finalSummary.totalCount, `(${((finalSummary.earnedCount / finalSummary.totalCount) * 100).toFixed(2)}%)`);

[395,396,397,398,399,400,401,402,403,404,405,406,407,408,409,410,411,412,413,414,415,416,417,418,419,420,421,422,423,424,425].forEach((n) => {
  const earned = Trophy.isEarned(`trophy_${n}`);
  if (!earned) console.log(`  未獲得: #${n} ${Trophy.getDefinition(`trophy_${n}`).name}`);
  check(`#${n} ${Trophy.getDefinition(`trophy_${n}`).name} が獲得されている`, earned);
});

check("最終的に452/452(100%)に到達した", finalSummary.earnedCount === 452 && finalSummary.totalCount === 452);
check("世界の真理(#425)は直接awardされず、連鎖判定の結果として自動的に獲得された", Trophy.isEarned("trophy_425") === true);

// ---- Step 5: 循環参照・無限ループなし(カタログ上の整合性再確認) ----
check("1回の連鎖判定呼び出しは有限時間で完了した(フリーズなし)", elapsedMs < 30000);

console.log(`\n合計: ${pass + fail}件 / 成功: ${pass}件 / 失敗: ${fail}件`);
process.exit(fail > 0 ? 1 : 0);
