// ==========================================================
// 共通トロフィー31種類(#395〜425)のロジック層テスト。
// js/storage.js・js/trophy.jsをNodeのvmモジュールでロードし(DOM不要)、
// TrophyModule公開APIを直接呼んで検証する。
// 依存パッケージ不要(node tests/trophy_common_logic.test.js で実行)。
// ==========================================================
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const FILES = [
  "js/countries.js",
  "js/puzzle-questions.js",
  "js/seven-wonders-questions.js",
  "js/map-regions.js",
  "js/capital-display.js",
  "js/encyclopedia-data.js",
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
  code += "\nvar __exports__ = { TrophyModule: TrophyModule, Storage: Storage };";
  vm.runInContext(code, sandbox, { filename: "bundle.js" });
  return { assertFailures, Trophy: sandbox.__exports__.TrophyModule, Storage: sandbox.__exports__.Storage };
}

let pass = 0, fail = 0;
function check(name, cond) { if (cond) { pass += 1; } else { fail += 1; console.log("FAIL:", name); } }

// ---- 自己検証(js/trophy.js内のconsole.assert)が0件であること ----
{
  const { assertFailures } = freshSandbox();
  check("trophy.js self-validation has zero failures", assertFailures.length === 0);
}

// ---- 定義の基本構造 ----
{
  const { Trophy } = freshSandbox();
  const defs = Trophy.getAllDefinitions();
  check("TROPHIES.length === 420 (389+31)", defs.length === 420);
  check("getProgressSummary().totalCount === 452 (421+31)", Trophy.getProgressSummary().totalCount === 452);
  const commonDefs = defs.filter((d) => d.category === "common");
  check("共通トロフィーは31件", commonDefs.length === 31);
  check("共通トロフィーの番号は395〜425", JSON.stringify(commonDefs.map((d) => d.number).sort((a, b) => a - b)) === JSON.stringify(Array.from({ length: 31 }, (_, i) => 395 + i)));
  check("共通トロフィーはすべてhidden:false(未獲得でも名称・条件を表示)", commonDefs.every((d) => d.hidden === false));
  check("共通トロフィーはすべてconfirmed:trueかつcheck関数を持つ", commonDefs.every((d) => d.confirmed === true && typeof d.check === "function"));
  check("既存No.393/394は変更されていない(category: puzzle/sevenWonders)", Trophy.getDefinition("trophy_393").category === "puzzle" && Trophy.getDefinition("trophy_394").category === "sevenWonders");
}

// ---- 対象集合の件数(実測値。企画書どおりの件数と一致すること) ----
{
  const { Trophy } = freshSandbox();
  check("万国の覇者(#419)の対象は67件", Trophy.getCommonTrophyProgress(419).total === 67);
  check("万都の支配者(#420)の対象は68件", Trophy.getCommonTrophyProgress(420).total === 68);
  check("世界を統べる者(#421)の対象は97件", Trophy.getCommonTrophyProgress(421).total === 97);
  check("全知の探究者(#422)の対象は155件", Trophy.getCommonTrophyProgress(422).total === 155);
  check("世界の果てまで/殿堂入りの分母(全有効単位)は452件", Trophy.getCommonTrophyProgress(423).total === 452);
  check("世界の真理(#425)の分母(自身を除く)は451件", Trophy.getCommonTrophyProgress(425).total === 451);
}

// ---- 累計獲得数8種類: 閾値の直前・到達の境界(自分自身を対象に含めない) ----
{
  const { Trophy, Storage } = freshSandbox();
  // mode:"both"の32種類(dual split)はflag/capitalを独立した単位として
  // awardIfNewで獲得させ、1個ずつ単位を積み上げる
  const dualNumbers = Array.from({ length: 19 }, (_, i) => i + 1).concat([21, 26, 27], Array.from({ length: 10 }, (_, i) => 30 + i));
  let earnedUnits = 0;
  const THRESHOLDS = [[395, 10], [396, 50], [397, 100], [398, 200], [399, 300], [400, 350], [401, 400], [402, 420]];
  let ti = 0;
  function advanceThresholds() {
    while (ti < THRESHOLDS.length && earnedUnits === THRESHOLDS[ti][1] - 1) {
      check(`#${THRESHOLDS[ti][0]}: しきい値${THRESHOLDS[ti][1]}の1個手前では未獲得`, !Trophy.isEarned(`trophy_${THRESHOLDS[ti][0]}`));
      ti++;
    }
    while (ti < THRESHOLDS.length && earnedUnits === THRESHOLDS[ti][1]) {
      // award済みなので、chain評価が自動的に走るよう直接evaluateを1回呼ぶ
      Trophy.evaluateCommonTrophiesCatchUp();
      check(`#${THRESHOLDS[ti][0]}: しきい値${THRESHOLDS[ti][1]}に到達すると獲得される`, Trophy.isEarned(`trophy_${THRESHOLDS[ti][0]}`));
      ti++;
    }
  }
  for (const n of dualNumbers) {
    if (earnedUnits < 420) { Trophy.awardIfNew(`trophy_${n}`, "flag"); earnedUnits++; }
    advanceThresholds();
    if (earnedUnits < 420) { Trophy.awardIfNew(`trophy_${n}`, "capital"); earnedUnits++; }
    advanceThresholds();
  }
  // 称号参照型12件(#101〜112)はawardIfNew()では(重複防止の既存仕様により)
  // 一切付与されないため、本番でapp.jsが呼ぶ経路と同じStorage.awardTitleIfNew()
  // 経由で獲得させる(これも「獲得単位」としてgetProgressSummary()に数えられる)
  const TITLE_IDS = {
    flag: ["beginner", "challenger", "traveler", "expert", "master", "legend"],
    capital: ["cap_beginner", "cap_challenger", "cap_traveler", "cap_expert", "cap_master", "cap_legend"],
  };
  for (const mode of ["flag", "capital"]) {
    for (const id of TITLE_IDS[mode]) {
      if (earnedUnits >= 420) break;
      Storage.awardTitleIfNew(id, mode);
      earnedUnits++;
      advanceThresholds();
    }
  }
  // 32件×2=64単位+称号12単位=76単位しか積めないため、残りは他カテゴリーの
  // 単発トロフィーで積む(称号参照型#101〜112とNo.142は上で/専用テストで扱うため除外)
  const otherSingles = Trophy.getAllDefinitions()
    .filter((d) => d.category !== "common" && !Trophy.isDualSplitCardNumber(d.number) && d.number !== 142 && !(d.number >= 101 && d.number <= 112))
    .map((d) => d.number);
  for (const n of otherSingles) {
    if (earnedUnits >= 420) break;
    if (Trophy.awardIfNew(`trophy_${n}`)) {
      earnedUnits++;
      advanceThresholds();
    }
  }
  check("累計獲得数8種類すべての境界を確認した", ti === THRESHOLDS.length);
}

// ---- 四つの扉・トリプルスリー・三冠王・三位一体: 条件を1つ欠く状態では未獲得 ----
{
  const { Trophy } = freshSandbox();
  Trophy.recordCommonModeUsed("flag");
  Trophy.recordCommonModeUsed("capital");
  Trophy.recordCommonModeUsed("findcountry");
  Trophy.recordCommonModeUsed("map");
  Trophy.evaluateCommonTrophiesCatchUp();
  check("四つの扉: 5項目中4項目(図鑑が未使用)では未獲得", !Trophy.isEarned("trophy_403"));
  Trophy.recordCommonModeUsed("encyclopedia");
  Trophy.evaluateCommonTrophiesCatchUp();
  check("四つの扉: 5項目すべて使用すると獲得される", Trophy.isEarned("trophy_403"));
}
{
  const { Trophy } = freshSandbox();
  Trophy.evaluateQuizFinish({ mode: "flag", total: 30, correct: 30, rate: 100, perfect: true, wrongIds: [], correctIds: [], questionIds: [] });
  Trophy.evaluateQuizFinish({ mode: "capital", total: 30, correct: 30, rate: 100, perfect: true, wrongIds: [], correctIds: [], questionIds: [] });
  check("トリプルスリー: 国旗・首都のみパーフェクト(どこかな？未達成)では未獲得", !Trophy.isEarned("trophy_404"));
  Trophy.evaluateFindCountryResult({ difficultyId: "beginner", correctCount: 30, answered: 30, target: 30, maxLives: 5, maxStreak: 30, isNormalClear: true, isProComplete: false, noMistakes: true });
  check("トリプルスリー: 3クイズすべて30問パーフェクトで獲得される", Trophy.isEarned("trophy_404"));
}
{
  const { Trophy } = freshSandbox();
  Trophy.evaluateQuizFinish({ mode: "flag", total: 198, correct: 150, rate: 75, perfect: false, wrongIds: [], correctIds: [], questionIds: [] });
  Trophy.evaluateQuizFinish({ mode: "capital", total: 198, correct: 198, rate: 100, perfect: true, wrongIds: [], correctIds: [], questionIds: [] });
  check("三冠王: どこかな？上級30問が未達成では未獲得", !Trophy.isEarned("trophy_405"));
  Trophy.evaluateFindCountryResult({ difficultyId: "advanced", correctCount: 30, answered: 30, target: 30, maxLives: 3, maxStreak: 30, isNormalClear: true, isProComplete: false, noMistakes: false });
  check("三冠王: 198問完了(パーフェクト不要)+上級30問クリアで獲得される", Trophy.isEarned("trophy_405"));
}
{
  const { Trophy } = freshSandbox();
  Trophy.evaluateQuizFinish({ mode: "flag", total: 10, correct: 10, rate: 100, perfect: true, wrongIds: [], correctIds: [], questionIds: [] });
  Trophy.evaluateQuizFinish({ mode: "capital", total: 10, correct: 10, rate: 100, perfect: true, wrongIds: [], correctIds: [], questionIds: [] });
  check("三位一体: 2クイズのみクリア(どこかな？未クリア)では未獲得", !Trophy.isEarned("trophy_417"));
  Trophy.evaluateFindCountryResult({ difficultyId: "beginner", correctCount: 5, answered: 5, target: 5, maxLives: 5, maxStreak: 5, isNormalClear: true, isProComplete: false, noMistakes: false });
  check("三位一体: 同日に3クイズすべてクリアで獲得される", Trophy.isEarned("trophy_417"));
}

// ---- 累積がんばり系: 誤答のうちパス・時間切れは数えない ----
{
  const { Trophy } = freshSandbox();
  Trophy.recordCommonTally("findcountry", "wrong");
  Trophy.recordCommonTally("findcountry", null); // パス・時間切れはresultが"wrong"/"correct"以外で渡され、無視される
  Trophy.recordCommonTally("findcountry", "correct");
  const p418 = Trophy.getCommonTrophyProgress(418);
  check("七転び八起き: 誤答1回だけがカウントされる(null=パス/時間切れは含めない)", p418.current === 1);
}

// ---- 四天王: 境界(各19個では未獲得、20個で獲得) ----
{
  const { Trophy, Storage } = freshSandbox();
  // 称号参照型(#101〜112)はawardIfNew()では付与されない(重複防止の既存仕様)ため、
  // ここでの単発award対象からは除外し、別途Storage.awardTitleIfNew()で扱う
  const isReferenceNumber = (n) => n >= 101 && n <= 112;
  const flagOnly = Trophy.getAllDefinitions().filter((d) => (d.mode === "flag" || d.mode === "flag_only") && !isReferenceNumber(d.number)).map((d) => d.number); // 29+6件中、称号6件を除く29件
  // 19個だけ獲得
  flagOnly.slice(0, 19).forEach((n) => Trophy.awardIfNew(`trophy_${n}`));
  const capOnly = Trophy.getAllDefinitions().filter((d) => (d.mode === "capital" || d.mode === "capital_only") && !isReferenceNumber(d.number)).map((d) => d.number).concat([142]);
  capOnly.slice(0, 19).forEach((n) => Trophy.awardIfNew(`trophy_${n}`));
  const fcOnly = Trophy.getAllDefinitions().filter((d) => d.mode === "findcountry").map((d) => d.number);
  fcOnly.slice(0, 19).forEach((n) => Trophy.awardIfNew(`trophy_${n}`));
  const encOnly = Trophy.getAllDefinitions().filter((d) => d.mode === "encyclopedia").map((d) => d.number);
  encOnly.slice(0, 19).forEach((n) => Trophy.awardIfNew(`trophy_${n}`));
  Trophy.evaluateCommonTrophiesCatchUp();
  check("四天王: 各分野19件では未獲得", !Trophy.isEarned("trophy_406"));
  Trophy.awardIfNew(`trophy_${flagOnly[19]}`);
  Trophy.awardIfNew(`trophy_${capOnly[19]}`);
  Trophy.awardIfNew(`trophy_${fcOnly[19]}`);
  Trophy.awardIfNew(`trophy_${encOnly[19]}`);
  Trophy.evaluateCommonTrophiesCatchUp();
  check("四天王: 各分野20件で獲得される", Trophy.isEarned("trophy_406"));
}

console.log(`\n合計: ${pass + fail}件 / 成功: ${pass}件 / 失敗: ${fail}件`);
process.exit(fail > 0 ? 1 : 0);
