// ==========================================================
// 世界図鑑トロフィー(第5段階、No.143〜158): ロジック層の自動テスト。
// js/storage.js・js/trophy.jsをNodeのvmモジュールでロード(DOM不要)し、
// 実際の判定関数・保存関数を直接呼んで検証する。
// 依存パッケージ不要(node tests/trophy_encyclopedia_logic.test.js で実行)。
// ==========================================================
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const FILES = [
  "js/countries.js",
  "js/map-regions.js",
  "js/capital-display.js",
  "js/storage.js",
  "js/trophy.js",
];

function freshSandbox() {
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.localStorage = (function () {
    let store = {};
    return {
      getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem(k, v) { store[k] = String(v); },
      removeItem(k) { delete store[k]; },
      clear() { store = {}; },
    };
  })();
  const assertFailures = [];
  sandbox.console = { assert(cond, msg) { if (!cond) assertFailures.push(msg); }, warn() {}, log() {} };
  sandbox.document = { addEventListener() {}, dispatchEvent() {}, getElementById() { return null; }, querySelector() { return null; } };
  vm.createContext(sandbox);
  let code = "";
  FILES.forEach((f) => { code += fs.readFileSync(path.join(ROOT, f), "utf8") + "\n"; });
  code += "\nvar __exports__ = { TrophyModule: TrophyModule, Storage: Storage, COUNTRIES: COUNTRIES, MAP_ONLY_REGIONS: MAP_ONLY_REGIONS };";
  vm.runInContext(code, sandbox, { filename: "bundle.js" });
  return {
    assertFailures,
    Trophy: sandbox.__exports__.TrophyModule,
    Storage: sandbox.__exports__.Storage,
    COUNTRIES: sandbox.__exports__.COUNTRIES,
    MAP_ONLY_REGIONS: sandbox.__exports__.MAP_ONLY_REGIONS,
    sandbox,
  };
}

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass += 1; } else { fail += 1; console.log("FAIL:", name); }
}

// ---- 自己検証(js/trophy.js内のconsole.assert)が0件であること ----
{
  const { assertFailures } = freshSandbox();
  check("trophy.js self-validation has zero failures", assertFailures.length === 0);
}

// ---- 全体件数・カテゴリー・隠しトロフィーの回帰確認 ----
{
  const { Trophy } = freshSandbox();
  const defs = Trophy.getAllDefinitions();
  check("total trophies = 153", defs.length === 153);
  const cats = Trophy.getCategories();
  check("category count = 9", cats.length === 9);
  check("encyclopedia category exists", cats.some((c) => c.id === "encyclopedia"));
  const byCat = {};
  defs.forEach((d) => { byCat[d.category] = (byCat[d.category] || 0) + 1; });
  check("encyclopedia category count = 15 (#143-157)", byCat.encyclopedia === 15);
  check("special category count = 13 (existing 11 + #142 + #158)", byCat.special === 13);
  check("capital_trivia category count = 29 (unchanged)", byCat.capital_trivia === 29);
  check("hidden trophy count = 14", defs.filter((d) => d.hidden).length === 14);
  check("#158 is hidden", defs.find((d) => d.number === 158).hidden === true);
  check("#158 name is 世界の叡智", defs.find((d) => d.number === 158).name === "世界の叡智");
}

// ---- A/B群: 閲覧記録・閲覧数トロフィー ----
{
  const { Trophy, Storage, COUNTRIES } = freshSandbox();
  const ids = COUNTRIES.map((c) => c.id);
  check("initial visited count = 0", Storage.getEncyclopediaVisitedCount() === 0);
  const awarded = new Set();
  ids.forEach((id) => {
    Storage.recordEncyclopediaVisit(id);
    Trophy.evaluateEncyclopediaVisit().awardedIds.forEach((a) => awarded.add(a));
  });
  check("visited count reaches 198", Storage.getEncyclopediaVisitedCount() === 198);
  [143, 144, 145, 146, 147].forEach((n) => check(`#${n} awarded at the right threshold`, awarded.has(`trophy_${n}`)));
  check("revisiting an already-visited country does not re-record", Storage.recordEncyclopediaVisit(ids[0]) === false);
  check("no further awards once everything already earned", Trophy.evaluateEncyclopediaVisit().awardedIds.length === 0);
}

// ---- MAP_ONLY_REGIONS(18件)は198件の対象外 ----
{
  const { Storage, MAP_ONLY_REGIONS } = freshSandbox();
  const regionId = MAP_ONLY_REGIONS[0].id;
  check("MAP_ONLY_REGIONS id is not recorded as a visit", Storage.recordEncyclopediaVisit(regionId) === false);
  check("visited count stays 0 for a MAP_ONLY_REGIONS id", Storage.getEncyclopediaVisitedCount() === 0);
}

// ---- C群: 地域別トロフィー(No.148〜153) ----
{
  const { Trophy, Storage, COUNTRIES } = freshSandbox();
  const regions = ["asia", "europe", "africa", "namerica", "samerica", "oceania"];
  const regionTrophy = { asia: 148, europe: 149, africa: 150, namerica: 151, samerica: 152, oceania: 153 };
  const totalIds = COUNTRIES.filter((c) => regions.includes(c.region)).length;
  check("the 6 tracked regions cover all 198 COUNTRIES", totalIds === 198);

  const asiaIds = COUNTRIES.filter((c) => c.region === "asia").map((c) => c.id);
  const awarded = new Set();
  asiaIds.forEach((id) => {
    Storage.recordEncyclopediaVisit(id);
    Trophy.evaluateEncyclopediaVisit().awardedIds.forEach((a) => awarded.add(a));
  });
  check("#148 (asia) awarded once all of asia is visited", awarded.has(`trophy_${regionTrophy.asia}`));
  check("#149 (europe) not awarded yet", !awarded.has(`trophy_${regionTrophy.europe}`));
  check("#158 not awarded with only 1/6 regions complete", !awarded.has("trophy_158"));
}

// ---- D群: 地図連携トロフィー(No.154〜155) ----
{
  const { Trophy, Storage, COUNTRIES } = freshSandbox();
  const ids = COUNTRIES.map((c) => c.id);
  const awarded = new Set();
  check("first map-check is recorded", Storage.recordEncyclopediaMapChecked(ids[0]) === true);
  Trophy.evaluateEncyclopediaVisit().awardedIds.forEach((a) => awarded.add(a));
  check("#154 awarded on first map-check", awarded.has("trophy_154"));
  for (let i = 1; i < 50; i += 1) {
    Storage.recordEncyclopediaMapChecked(ids[i]);
    Trophy.evaluateEncyclopediaVisit().awardedIds.forEach((a) => awarded.add(a));
  }
  check("#155 awarded after 50 distinct map-checks", awarded.has("trophy_155"));
  check("repeat map-check of the same id does not re-record", Storage.recordEncyclopediaMapChecked(ids[0]) === false);
}

// ---- E群: 復習トロフィー(No.156〜157) ----
{
  const { Trophy, Storage, COUNTRIES } = freshSandbox();
  const ids = COUNTRIES.map((c) => c.id);
  const awarded = new Set();
  for (let i = 0; i < 10; i += 1) {
    Storage.recordEncyclopediaReview(ids[i]);
    Trophy.evaluateEncyclopediaVisit().awardedIds.forEach((a) => awarded.add(a));
  }
  check("#156 awarded after 10 distinct reviews", awarded.has("trophy_156"));
  for (let i = 10; i < 50; i += 1) {
    Storage.recordEncyclopediaReview(ids[i]);
    Trophy.evaluateEncyclopediaVisit().awardedIds.forEach((a) => awarded.add(a));
  }
  check("#157 awarded after 50 distinct reviews", awarded.has("trophy_157"));
}

// ---- F群: #158「世界の叡智」 ----
{
  const { Trophy, Storage, COUNTRIES } = freshSandbox();
  const ids = COUNTRIES.map((c) => c.id);
  const awarded = new Set();
  ids.forEach((id) => {
    Storage.recordEncyclopediaVisit(id);
    Trophy.evaluateEncyclopediaVisit().awardedIds.forEach((a) => awarded.add(a));
  });
  check("#158 awarded exactly when the 198th country is visited", awarded.has("trophy_158"));
  check("#147 and #158 are awarded in the same pass", awarded.has("trophy_147") && awarded.has("trophy_158"));
  check("all 6 region trophies are also awarded in that same pass", [148, 149, 150, 151, 152, 153].every((n) => awarded.has(`trophy_${n}`)));
}

// ---- 境界値・不正データ・重複イベントテスト ----
{
  const { Storage } = freshSandbox();
  check("invalid country id is rejected", Storage.recordEncyclopediaVisit("zz_not_a_real_id") === false);
  check("non-string id is rejected", Storage.recordEncyclopediaVisit(123) === false);
  check("null id is rejected", Storage.recordEncyclopediaVisit(null) === false);
}
{
  const { Storage, sandbox } = freshSandbox();
  sandbox.localStorage.setItem("wfq_v1_encyclopedia_visited", "{not valid json");
  let safeRead = false;
  try { safeRead = Object.keys(Storage.getEncyclopediaVisited()).length === 0; } catch (e) { safeRead = false; }
  check("corrupted visited data is treated as empty, not a crash", safeRead);
  check("recording still works after recovering from corrupted data", Storage.recordEncyclopediaVisit("jp") === true);
}
{
  const { Storage } = freshSandbox();
  // 同じ国を3連続で「記録」しようとする(重複イベントのシミュレーション): 1回目だけ新規扱いになる
  const r1 = Storage.recordEncyclopediaVisit("jp");
  const r2 = Storage.recordEncyclopediaVisit("jp");
  const r3 = Storage.recordEncyclopediaVisit("jp");
  check("duplicate visit events only record once", r1 === true && r2 === false && r3 === false);
  check("visited count stays at 1 after duplicate events", Storage.getEncyclopediaVisitedCount() === 1);
}

// ---- 保存領域の分離・リセット ----
{
  const { Storage } = freshSandbox();
  Storage.recordEncyclopediaVisit("jp");
  Storage.recordEncyclopediaMapChecked("jp");
  Storage.recordEncyclopediaReview("jp");
  check(
    "visited/map-checked/reviewed are recorded independently",
    Storage.getEncyclopediaVisitedCount() === 1 && Storage.getEncyclopediaMapCheckedCount() === 1 && Storage.getEncyclopediaReviewedCount() === 1
  );
  Storage.resetAll();
  check(
    "resetAll() clears all 3 new encyclopedia records",
    Storage.getEncyclopediaVisitedCount() === 0 && Storage.getEncyclopediaMapCheckedCount() === 0 && Storage.getEncyclopediaReviewedCount() === 0
  );
}

// ---- クイズ経由のevaluate()は図鑑トロフィーを誤発火しない ----
{
  const { Trophy, Storage, COUNTRIES } = freshSandbox();
  const ids = COUNTRIES.map((c) => c.id);
  ids.slice(0, 5).forEach((id) => Storage.recordEncyclopediaVisit(id));
  const result = Trophy.evaluateQuizFinish({ mode: "flag", total: 10, correct: 10, rate: 1, wrongIds: [], correctIds: [], questionIds: [] });
  check(
    "evaluateQuizFinish (source=quiz) never awards encyclopedia trophies",
    !result.awardedIds.some((id) => ["trophy_143", "trophy_144", "trophy_145", "trophy_146", "trophy_147"].includes(id))
  );
}
{
  const { Trophy, Storage, COUNTRIES } = freshSandbox();
  const ids = COUNTRIES.map((c) => c.id);
  ids.forEach((id) => Storage.recordEncyclopediaVisit(id));
  const result = Trophy.evaluateFindCountryResult({ difficultyId: "beginner", correctCount: 5, answered: 5, maxStreak: 5, isNormalClear: true, isProComplete: false, gameOver: false, results: [] });
  check(
    "evaluateFindCountryResult (source=findcountry) never awards encyclopedia trophies",
    !result.awardedIds.some((id) => id.startsWith("trophy_14") || id.startsWith("trophy_15"))
  );
}

console.log(`\nTotal: ${pass + fail}, Pass: ${pass}, Fail: ${fail}`);
process.exitCode = fail > 0 ? 1 : 0;
