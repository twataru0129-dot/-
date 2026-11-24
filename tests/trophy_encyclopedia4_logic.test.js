// ==========================================================
// 世界図鑑トロフィー追加分(No.259〜262、計4件)のロジック層テスト。
// js/countries.js・js/map-regions.js・js/capital-display.js・
// js/puzzle-questions.js・js/storage.js・js/trophy.jsをNodeのvmモジュール
// でロードし(DOM不要)、TrophyModule.evaluateEncyclopediaVisit()を直接
// 呼んで検証する。
//
// 検証項目:
//   - No.259「未知なる領域の探究者」: MAP_ONLY_REGIONS(18件)の閲覧記録が
//     18件そろった時点で自動獲得。17件では未獲得。同じ地域を重複記録しても
//     カウントが増えない。
//   - No.260「世界を結ぶ地図師」: Storage.recordEncyclopediaMapChecked()
//     (既存のNo.154・155と共有する記録)が異なる30件に達した時点で自動獲得。
//   - No.261「知識の道しるべ」: Storage.recordEncyclopediaSearchOpened()
//     (新規、COUNTRIES+MAP_ONLY_REGIONS対象)が異なる30件に達した時点で
//     自動獲得。
//   - No.262「世界の大賢者」: 自分自身を除く世界図鑑トロフィー19種類
//     (No.143〜158・259〜261)がすべて獲得済みの状態で初めて自動獲得される。
//     19種類のうち1種類でも欠けていれば獲得しない。
//   - 既存トロフィー(250件、世界図鑑既存16件を含む)の獲得状態・判定条件には
//     影響がないこと。
//
// 実行方法: node tests/trophy_encyclopedia4_logic.test.js
// ==========================================================
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const FILES = [
  "js/countries.js",
  "js/map-regions.js",
  "js/capital-display.js",
  "js/puzzle-questions.js",
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
  code += "\nvar __exports__ = { TrophyModule: TrophyModule, Storage: Storage, MAP_ONLY_REGIONS: MAP_ONLY_REGIONS, COUNTRIES: COUNTRIES };";
  vm.runInContext(code, sandbox, { filename: "bundle.js" });
  return {
    assertFailures,
    Trophy: sandbox.__exports__.TrophyModule,
    Storage: sandbox.__exports__.Storage,
    regions: sandbox.__exports__.MAP_ONLY_REGIONS,
    countries: sandbox.__exports__.COUNTRIES,
  };
}

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass += 1; console.log("PASS:", name); }
  else { fail += 1; console.log("FAIL:", name); }
}

function idFor(def) { return `trophy_${def.number}`; }
function findDef(Trophy, number) {
  return Trophy.getAllDefinitions().find((d) => d.number === number);
}

// ---- シナリオA: No.259「未知なる領域の探究者」 ----
{
  const { Trophy, Storage, regions, assertFailures } = freshSandbox();
  const def = findDef(Trophy, 259);
  check("A: 自己検証のassertFailuresが0件", assertFailures.length === 0);
  check("A: No.259の名称が正しい", def.name === "未知なる領域の探究者");
  check("A: No.259のcategoryがencyclopedia", def.category === "encyclopedia");

  // 17地域だけ記録 → 未獲得
  regions.slice(0, 17).forEach((r) => Storage.recordEncyclopediaRegionVisit(r.id));
  let result = Trophy.evaluateEncyclopediaVisit();
  check("A: 17地域では未獲得", !Trophy.isEarned(idFor(def)));
  check("A: 17地域ではawardedIdsに含まれない", !result.awardedIds.includes(idFor(def)));

  // 同じ地域を重複記録してもカウントは増えない
  Storage.recordEncyclopediaRegionVisit(regions[0].id);
  check("A: 重複記録してもカウントは17のまま", Storage.getEncyclopediaRegionVisitedCount() === 17);

  // 18番目を記録 → 獲得
  Storage.recordEncyclopediaRegionVisit(regions[17].id);
  result = Trophy.evaluateEncyclopediaVisit();
  check("A: 18地域で獲得", Trophy.isEarned(idFor(def)));
  check("A: 18地域目でawardedIdsに含まれる", result.awardedIds.includes(idFor(def)));
}

// ---- シナリオB: No.260「世界を結ぶ地図師」(既存No.154・155と記録を共有) ----
{
  const { Trophy, Storage, countries, assertFailures } = freshSandbox();
  const def = findDef(Trophy, 260);
  check("B: 自己検証のassertFailuresが0件", assertFailures.length === 0);
  check("B: No.260の名称が正しい", def.name === "世界を結ぶ地図師");

  countries.slice(0, 29).forEach((c) => Storage.recordEncyclopediaMapChecked(c.id));
  let result = Trophy.evaluateEncyclopediaVisit();
  check("B: 29件では未獲得", !Trophy.isEarned(idFor(def)));
  // 既存No.154(1件)・No.155(50件)はこの時点でどちらも影響を受けていないことを確認
  check("B: 既存No.154(1件)は29件の時点で獲得済み", Trophy.isEarned("trophy_154"));
  check("B: 既存No.155(50件)は29件の時点で未獲得", !Trophy.isEarned("trophy_155"));

  Storage.recordEncyclopediaMapChecked(countries[29].id);
  result = Trophy.evaluateEncyclopediaVisit();
  check("B: 30件で獲得", Trophy.isEarned(idFor(def)));
  check("B: 30件目でawardedIdsに含まれる", result.awardedIds.includes(idFor(def)));
}

// ---- シナリオC: No.261「知識の道しるべ」 ----
{
  const { Trophy, Storage, countries, assertFailures } = freshSandbox();
  const def = findDef(Trophy, 261);
  check("C: 自己検証のassertFailuresが0件", assertFailures.length === 0);
  check("C: No.261の名称が正しい", def.name === "知識の道しるべ");

  countries.slice(0, 29).forEach((c) => Storage.recordEncyclopediaSearchOpened(c.id));
  let result = Trophy.evaluateEncyclopediaVisit();
  check("C: 29件では未獲得", !Trophy.isEarned(idFor(def)));

  Storage.recordEncyclopediaSearchOpened(countries[29].id);
  result = Trophy.evaluateEncyclopediaVisit();
  check("C: 30件で獲得", Trophy.isEarned(idFor(def)));
  check("C: 30件目でawardedIdsに含まれる", result.awardedIds.includes(idFor(def)));
}

// ---- シナリオD: No.262「世界の大賢者」 ----
{
  const { Trophy, Storage, regions, countries, assertFailures } = freshSandbox();
  const def = findDef(Trophy, 262);
  check("D: 自己検証のassertFailuresが0件", assertFailures.length === 0);
  check("D: No.262の名称が正しい", def.name === "世界の大賢者");

  // 既存16件(No.143〜158)をすべて達成する
  countries.forEach((c) => Storage.recordEncyclopediaVisit(c.id)); // No.143〜147・158の閲覧要件(198件)
  countries.slice(0, 50).forEach((c) => Storage.recordEncyclopediaMapChecked(c.id)); // No.154・155(50件)
  countries.slice(0, 50).forEach((c) => Storage.recordEncyclopediaReview(c.id)); // No.156・157(50件)
  let result = Trophy.evaluateEncyclopediaVisit();
  for (let n = 143; n <= 158; n++) {
    check(`D: 既存No.${n}が獲得済み`, Trophy.isEarned(`trophy_${n}`));
  }
  check("D: 既存16件だけでは世界の大賢者はまだ未獲得(259〜261が残っている)", !Trophy.isEarned(idFor(def)));

  // 259・260は満たしたが261がまだ → 未獲得のまま
  regions.forEach((r) => Storage.recordEncyclopediaRegionVisit(r.id));
  countries.slice(0, 30).forEach((c) => Storage.recordEncyclopediaMapChecked(c.id));
  result = Trophy.evaluateEncyclopediaVisit();
  check("D: 259獲得済み", Trophy.isEarned("trophy_259"));
  check("D: 260獲得済み", Trophy.isEarned("trophy_260"));
  check("D: 261がまだ未獲得のため世界の大賢者は未獲得", !Trophy.isEarned(idFor(def)));

  // 最後に261も満たす → 19種類すべて揃い、同じevaluate()呼び出し内で
  // 世界の大賢者も自動獲得される(#142・#158と同じ「同一パス内の即時解放」)
  countries.slice(0, 30).forEach((c) => Storage.recordEncyclopediaSearchOpened(c.id));
  result = Trophy.evaluateEncyclopediaVisit();
  check("D: 261獲得済み", Trophy.isEarned("trophy_261"));
  check("D: 19種類すべて揃った時点で世界の大賢者が自動獲得される", Trophy.isEarned(idFor(def)));
  check("D: 同一evaluate()呼び出し内でawardedIdsに含まれる", result.awardedIds.includes(idFor(def)));
}

// ---- シナリオE: 既存トロフィー(250件)・世界図鑑既存16件への無影響 ----
// 【謎解きトロフィー118問追加(#263〜380)・高難度5問追加(#381〜385)に
// 伴う期待値更新】このテストは実際のjs/puzzle-questions.jsを読み込むため、
// 謎解きトロフィーが3問(#256〜258)から126問(#256〜258・263〜380・381〜385)
// に増えたことで総数が257→380、dual-split計算を含むtotalCountが289→412に
// 変わった
{
  const { Trophy, assertFailures } = freshSandbox();
  check("E: 自己検証のassertFailuresが0件", assertFailures.length === 0);
  const total = Trophy.getAllDefinitions().length;
  check("E: トロフィー総数が380件(既存254件+謎解き126件)", total === 380);
  const summary = Trophy.getProgressSummary();
  check("E: getProgressSummary().totalCountが412件", summary.totalCount === 412);
  const existing16 = [143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158];
  check("E: 既存世界図鑑16件すべてが引き続きTROPHIESに存在する", existing16.every((n) => !!Trophy.getDefinition(`trophy_${n}`)));
}

console.log(`\nTotal: ${pass + fail} Pass: ${pass} Fail: ${fail}`);
process.exit(fail > 0 ? 1 : 0);
