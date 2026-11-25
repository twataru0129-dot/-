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

// 連続プレイ日数(月末・年末・うるう年・日付逆行等)のテスト用。sandbox内の
// Date(js/trophy.jsのgetLocalDateString()が引数なしで呼ぶnew Date()を含む)
// だけを、setClockDate()で指定した「端末の現在日時」に差し替える。
// new Date(文字列)等、引数ありの呼び出しは本物のDateと同じ挙動を保つ(
// dateStringDiffDays()の日付パース処理に影響を与えないため)
function freshSandboxWithClock(initialDateStr) {
  const RealDate = Date;
  let nowMs = new RealDate(`${initialDateStr}T00:00:00`).getTime();
  class MockDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) return new RealDate(nowMs);
      return new RealDate(...args);
    }
    static now() { return nowMs; }
  }
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.Date = MockDate;
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
  return {
    assertFailures,
    Trophy: sandbox.__exports__.TrophyModule,
    Storage: sandbox.__exports__.Storage,
    setClockDate(dateStr) { nowMs = new RealDate(`${dateStr}T00:00:00`).getTime(); },
  };
}

// 1プレイ完了(国旗クイズ10問パーフェクト)を記録させるための最小呼び出し
function playFlagQuizOnce(Trophy) {
  Trophy.evaluateQuizFinish({ mode: "flag", total: 10, correct: 10, rate: 100, perfect: true, wrongIds: [], correctIds: [], questionIds: [] });
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
  Trophy.evaluateFindCountryResult({ difficultyId: "beginner", correctCount: 5, answered: 5, target: 5, maxLives: 5, maxStreak: 5, isNormalClear: true, isProComplete: false, noMistakes: false, endReason: "clear" });
  check("三位一体: 同日に3クイズすべてクリアで獲得される", Trophy.isEarned("trophy_417"));
}
// ---- 三位一体: どこかな？がゲームオーバー(クリアではない)の場合は、
// 国旗・首都を同日にクリアしていても獲得されないことを確認する(レビュー
// 指摘事項: 「プレイ完了」(ゲームオーバーを含む)と「クリア」を区別する) ----
{
  const { Trophy } = freshSandbox();
  Trophy.evaluateQuizFinish({ mode: "flag", total: 10, correct: 10, rate: 100, perfect: true, wrongIds: [], correctIds: [], questionIds: [] });
  Trophy.evaluateQuizFinish({ mode: "capital", total: 10, correct: 10, rate: 100, perfect: true, wrongIds: [], correctIds: [], questionIds: [] });
  // isNormalClear/isProCompleteがどちらもfalse(規定ミス数到達によるゲーム
  // オーバー)の、実際のjs/findcountry.js側のendReason計算と同じ値を渡す
  Trophy.evaluateFindCountryResult({ difficultyId: "beginner", correctCount: 2, answered: 5, target: 5, maxLives: 5, maxStreak: 2, isNormalClear: false, isProComplete: false, noMistakes: false, gameOver: true, endReason: "gameover" });
  check("三位一体: どこかな？がゲームオーバー(クリアではない)の場合は未獲得のまま", !Trophy.isEarned("trophy_417"));
  // 累計プレイ完了回数(#407等)には、クリアかどうかに関わらずゲームオーバーも
  // 1回として数える(国旗1+首都1+どこかな？のゲームオーバー1=合計3回)
  check("累計プレイ完了回数には、どこかな？のゲームオーバーも1回として数えられている", Trophy.getCommonTrophyProgress(407).current === 3);
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

// ---- 既存ユーザーへの遡及付与: 既存の保存データから確実に証明できる
// 実績(30問パーフェクト・198問クリア・どこかな？30問パーフェクト・
// どこかな？上級30問クリア・世界地図の使用経験)が、推測なしで正しく
// 復元されることを確認する。特にトリプルスリー(#404)・三冠王(#405)は、
// 既に条件を満たしているユーザーに不要な再プレイを要求してはならない ----
{
  const { Trophy, Storage } = freshSandbox();
  // トリプルスリー(#404): 国旗・首都の既存ベスト記録(30問パーフェクト)+
  // どこかな？のノーミスクリア記録(初級30問)から、再プレイなしで獲得される
  Storage.updateBestRecord(30, 30, 30, "flag");
  Storage.updateBestRecord(30, 30, 30, "capital");
  Storage.markFindCountryCourseCleared(Storage.findCountryCourseKey("beginner", 30));
  Storage.markFindCountryCourseNoMissCleared(Storage.findCountryCourseKey("beginner", 30));
  Trophy.evaluateCommonTrophiesCatchUp();
  check("トリプルスリー: 既存の30問パーフェクト記録(国旗・首都・どこかな？初級)から再プレイなしで獲得される", Trophy.isEarned("trophy_404") === true);
}
{
  // トリプルスリーの否定側: 国旗・首都はパーフェクトでも、どこかな？の
  // 該当コースがノーミスクリアされていなければ遡及付与されないこと
  const { Trophy, Storage } = freshSandbox();
  Storage.updateBestRecord(30, 30, 30, "flag");
  Storage.updateBestRecord(30, 30, 30, "capital");
  Storage.markFindCountryCourseCleared(Storage.findCountryCourseKey("beginner", 30)); // 通常クリアのみ(ノーミスではない)
  Trophy.evaluateCommonTrophiesCatchUp();
  check("トリプルスリー: どこかな？がノーミスクリアでない場合は遡及付与されない", Trophy.isEarned("trophy_404") === false);
}
{
  // 三冠王(#405): 国旗・首都の198問コース完了記録(パーフェクト不要)+
  // どこかな？上級30問の通常クリア記録(パーフェクト不要)から、
  // 再プレイなしで獲得される
  const { Trophy, Storage } = freshSandbox();
  Storage.updateBestRecord(198, 150, 198, "flag"); // パーフェクトではないが完了した記録
  Storage.updateBestRecord(198, 198, 198, "capital");
  Storage.markFindCountryCourseCleared(Storage.findCountryCourseKey("advanced", 30)); // パーフェクトではない通常クリア
  Trophy.evaluateCommonTrophiesCatchUp();
  check("三冠王: 既存の198問クリア記録(パーフェクト不要)+どこかな？上級30問クリア記録から再プレイなしで獲得される", Trophy.isEarned("trophy_405") === true);
}
{
  // 世界地図の使用経験(四つの扉用usedMap): 世界図鑑の「地図で場所を見る」
  // 利用記録(#154と同じデータ)から遡及復元され、他の4条件も満たせば
  // 四つの扉が再プレイなしで獲得されることを確認する
  const { Trophy, Storage } = freshSandbox();
  Storage.recordEncyclopediaMapChecked("jp");
  ["flag", "capital", "findcountry", "encyclopedia"].forEach((k) => Trophy.recordCommonModeUsed(k));
  Trophy.evaluateCommonTrophiesCatchUp();
  check("四つの扉: 世界図鑑の地図連携利用記録からusedMapが遡及復元され獲得される", Trophy.isEarned("trophy_403") === true);
}
{
  // usedMapの否定側: 地図連携の利用記録が一切無い場合は、他の4条件を
  // 満たしても四つの扉は獲得されない(推測で補完しないことの確認)
  const { Trophy } = freshSandbox();
  ["flag", "capital", "findcountry", "encyclopedia"].forEach((k) => Trophy.recordCommonModeUsed(k));
  Trophy.evaluateCommonTrophiesCatchUp();
  check("四つの扉: 世界地図の利用記録が無い場合は遡及付与されない", Trophy.isEarned("trophy_403") === false);
}
{
  // getCommonTrophyProgress経由でも、遡及復元したperfect30Achieved/
  // clear198Achieved/clearAdvanced30Achievedが実際に保存されていることを
  // 直接確認する(トリプルスリー・三冠王の内部フラグの検証)
  const { Trophy, Storage } = freshSandbox();
  Storage.updateBestRecord(30, 30, 30, "flag");
  Storage.updateBestRecord(198, 100, 198, "flag");
  Trophy.evaluateCommonTrophiesCatchUp();
  Storage.updateBestRecord(30, 30, 30, "capital");
  Storage.updateBestRecord(198, 198, 198, "capital");
  Storage.markFindCountryCourseNoMissCleared(Storage.findCountryCourseKey("intermediate", 30));
  Storage.markFindCountryCourseCleared(Storage.findCountryCourseKey("advanced", 30));
  Trophy.evaluateCommonTrophiesCatchUp();
  check("遡及復元後、トリプルスリー(#404)が獲得される(中級30問のノーミスクリアでも成立)", Trophy.isEarned("trophy_404") === true);
  check("遡及復元後、三冠王(#405)が獲得される", Trophy.isEarned("trophy_405") === true);
}

// ==========================================================
// 連続プレイ日数(recordCommonDatePlayed)のレビュー指摘事項テスト。
// #413(7日連続)・#414(30日連続)のgetCommonTrophyProgress().current
// (=currentStreakDaysのmin)、#415(累計プレイ日数)のcurrentで検証する。
// ==========================================================
{
  // 同日重複: 同じ日に何度プレイ完了しても、連続日数・累計日数は1回しか増えない
  const { Trophy, setClockDate } = freshSandboxWithClock("2024-06-10");
  playFlagQuizOnce(Trophy);
  playFlagQuizOnce(Trophy);
  playFlagQuizOnce(Trophy);
  check("同日重複: 同じ日に3回プレイしても連続日数は1のまま", Trophy.getCommonTrophyProgress(413).current === 1);
  check("同日重複: 同じ日に3回プレイしても累計プレイ日数は1日のまま", Trophy.getCommonTrophyProgress(415).current === 1);
}
{
  // 日付逆行: 端末時刻が過去の未記録日付に戻った場合、累計プレイ日数には
  // その日が1回だけ追加されるが、連続日数(currentStreakDays)は破壊されない
  const { Trophy, setClockDate } = freshSandboxWithClock("2024-06-10");
  playFlagQuizOnce(Trophy);
  check("日付逆行・前提: 2024-06-10プレイ直後は連続日数1", Trophy.getCommonTrophyProgress(413).current === 1);
  setClockDate("2024-06-05"); // 端末時刻が逆行(未記録の過去日付)
  playFlagQuizOnce(Trophy);
  check("日付逆行: 過去の未記録日付でのプレイ後も、連続日数が1のまま破壊されない", Trophy.getCommonTrophyProgress(413).current === 1);
  check("日付逆行: 過去の未記録日付も累計プレイ日数には1日として追加される(2日になる)", Trophy.getCommonTrophyProgress(415).current === 2);
  setClockDate("2024-06-11"); // 最新の記録日(06-10)の翌日に進める
  playFlagQuizOnce(Trophy);
  check("日付逆行からの復帰: 逆行前の最新記録日(06-10)を基準に連続日数が正しく2に伸びる", Trophy.getCommonTrophyProgress(413).current === 2);
}
{
  // 日付復帰(間隔あり): 連続日数が途切れた場合は、意図通り1にリセットされる
  // (「既存の連続記録を不必要に破壊しない」とは、ガード漏れによる誤リセット
  // (日付逆行時)を指すのであって、実際に間隔が空いた場合の正しいリセットは
  // 妨げない)。また、累計プレイ日数(playedDates)は間隔が空いても正しく
  // 積み上げられ続けることを確認する
  const { Trophy, setClockDate } = freshSandboxWithClock("2024-01-01");
  for (let i = 0; i < 5; i++) {
    setClockDate(`2024-01-${String(1 + i).padStart(2, "0")}`);
    playFlagQuizOnce(Trophy);
  }
  check("日付復帰・前提: 5日連続プレイで連続日数5", Trophy.getCommonTrophyProgress(413).current === 5);
  setClockDate("2024-01-10"); // 5日空けてプレイ(連続日数は途切れる)
  playFlagQuizOnce(Trophy);
  check("日付復帰: 間隔が空いた後のプレイでは、現在の連続日数は1にリセットされる", Trophy.getCommonTrophyProgress(413).current === 1);
  check("日付復帰: 間隔が空いた日も累計プレイ日数には加算される(5日+1日=6日)", Trophy.getCommonTrophyProgress(415).current === 6);
}
{
  // 月末境界: 1/31→2/1のように月をまたいでも「翌日」として正しく連続と判定される
  const { Trophy, setClockDate } = freshSandboxWithClock("2024-01-31");
  playFlagQuizOnce(Trophy);
  setClockDate("2024-02-01");
  playFlagQuizOnce(Trophy);
  check("月末境界: 1/31→2/1のプレイが連続日数2としてカウントされる", Trophy.getCommonTrophyProgress(413).current === 2);
}
{
  // 年末境界: 12/31→1/1のように年をまたいでも「翌日」として正しく連続と判定される
  const { Trophy, setClockDate } = freshSandboxWithClock("2023-12-31");
  playFlagQuizOnce(Trophy);
  setClockDate("2024-01-01");
  playFlagQuizOnce(Trophy);
  check("年末境界: 2023-12-31→2024-01-01のプレイが連続日数2としてカウントされる", Trophy.getCommonTrophyProgress(413).current === 2);
}
{
  // うるう年境界: うるう年の2/28→2/29→3/1が、いずれも「翌日」として
  // 正しく連続と判定される(2/29が存在しない年と誤認しない)
  const { Trophy, setClockDate } = freshSandboxWithClock("2024-02-28");
  playFlagQuizOnce(Trophy); // うるう年(2024年)の2/28
  setClockDate("2024-02-29"); // うるう日
  playFlagQuizOnce(Trophy);
  setClockDate("2024-03-01");
  playFlagQuizOnce(Trophy);
  check("うるう年境界: 2/28→2/29(うるう日)→3/1が連続日数3としてカウントされる", Trophy.getCommonTrophyProgress(413).current === 3);
}
{
  // うるう年境界(平年): 平年(2023年)は2/29が存在しないため、2/28の翌日は
  // 3/1になる。この場合も正しく「翌日」として連続と判定されることを確認する
  const { Trophy, setClockDate } = freshSandboxWithClock("2023-02-28");
  playFlagQuizOnce(Trophy); // 平年(2023年)の2/28
  setClockDate("2023-03-01"); // 平年なので2/29は存在せず、翌日は3/1
  playFlagQuizOnce(Trophy);
  check("うるう年境界(平年): 2023年(平年)の2/28→3/1が連続日数2としてカウントされる", Trophy.getCommonTrophyProgress(413).current === 2);
}

console.log(`\n合計: ${pass + fail}件 / 成功: ${pass}件 / 失敗: ${fail}件`);
process.exit(fail > 0 ? 1 : 0);
