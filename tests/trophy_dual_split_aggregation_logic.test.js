// ==========================================================
// トロフィー一覧の集計方式A案(国旗・首都を独立した2枠として数える)の
// ロジック層テスト。js/storage.js・js/trophy.jsをNodeのvmモジュールで
// ロードし(DOM不要)、TrophyModule.getProgressSummary()/
// isDualSplitCardNumber()を直接呼んで検証する。
// 第1弾(No.1〜19)に続き、追加修正で#21・26・27・30〜39の13種類を対象に
// 加え、合計32種類・282件(250+32)になった状態を検証する。
// 依存パッケージ不要(node tests/trophy_dual_split_aggregation_logic.test.js で実行)。
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
  code += "\nvar __exports__ = { TrophyModule: TrophyModule, Storage: Storage };";
  vm.runInContext(code, sandbox, { filename: "bundle.js" });
  return { assertFailures, Trophy: sandbox.__exports__.TrophyModule, Storage: sandbox.__exports__.Storage };
}

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass += 1; }
  else { fail += 1; console.log("FAIL:", name); }
}

// ---- 自己検証(js/trophy.js内のconsole.assert)が0件であること ----
{
  const { assertFailures } = freshSandbox();
  if (assertFailures.length) console.log("self-validation failures:", assertFailures);
  check("trophy.js self-validation has zero failures", assertFailures.length === 0);
}

// ---- isDualSplitCardNumber(): No.1〜19・#21・26・27・30〜39(合計32件)がtrue ----
{
  const { Trophy } = freshSandbox();
  for (let n = 1; n <= 19; n++) {
    check(`isDualSplitCardNumber(${n}) === true`, Trophy.isDualSplitCardNumber(n) === true);
  }
  [21, 26, 27].forEach((n) => {
    check(`isDualSplitCardNumber(${n}) === true(追加修正で対象に追加)`, Trophy.isDualSplitCardNumber(n) === true);
  });
  for (let n = 30; n <= 39; n++) {
    check(`isDualSplitCardNumber(${n}) === true(追加修正で対象に追加)`, Trophy.isDualSplitCardNumber(n) === true);
  }
  // 対象外(mode==="both"ではない、または参照型等)は従来どおりfalseのまま
  [0, 20, 22, 23, 24, 25, 28, 29, 40, 100, 159, 194, 195, 250].forEach((n) => {
    check(`isDualSplitCardNumber(${n}) === false`, Trophy.isDualSplitCardNumber(n) === false);
  });
}

// ---- 定義総数は250件のまま変更がないこと ----
{
  const { Trophy } = freshSandbox();
  check("getAllDefinitions().length === 250(変更なし)", Trophy.getAllDefinitions().length === 250);
}

// ---- getProgressSummary(): 初期状態(未獲得)でtotalCount===282 ----
{
  const { Trophy } = freshSandbox();
  const summary = Trophy.getProgressSummary();
  check("初期状態: totalCount === 282 (250 + 32種類の追加枠)", summary.totalCount === 282);
  check("初期状態: earnedCount === 0", summary.earnedCount === 0);
}

// ---- No.1〜19: 国旗のみ獲得 → +1、両方獲得 → +2 ----
{
  const { Trophy } = freshSandbox();
  const before = Trophy.getProgressSummary().earnedCount;
  check("獲得前のearnedCountは0", before === 0);

  Trophy.awardIfNew("trophy_1", "flag");
  const afterFlagOnly = Trophy.getProgressSummary();
  check("No.1の国旗のみ獲得でearnedCountが1増える", afterFlagOnly.earnedCount === before + 1);
  check("国旗のみ獲得でもtotalCountは変わらない(282)", afterFlagOnly.totalCount === 282);

  Trophy.awardIfNew("trophy_1", "capital");
  const afterBoth = Trophy.getProgressSummary();
  check("No.1の首都も獲得するとearnedCountがさらに1増える(合計+2)", afterBoth.earnedCount === before + 2);

  // 既に両方獲得済みのNo.1へ再度awardIfNewしても、二重に加算されないこと
  const dupFlag = Trophy.awardIfNew("trophy_1", "flag");
  const dupCapital = Trophy.awardIfNew("trophy_1", "capital");
  check("既に獲得済みの国旗側へのawardIfNewは新規登録されない(false)", dupFlag === false);
  check("既に獲得済みの首都側へのawardIfNewは新規登録されない(false)", dupCapital === false);
  const afterDup = Trophy.getProgressSummary();
  check("重複呼び出し後もearnedCountは変わらない", afterDup.earnedCount === before + 2);
}

// ---- 追加修正で対象に加わった13種類(#21・26・27・30〜39)も、No.1〜19と
//      同じくそれぞれ独立した2枠として数えること ----
{
  const { Trophy } = freshSandbox();
  [21, 26, 27, 30, 39].forEach((n) => {
    const before = Trophy.getProgressSummary().earnedCount;
    Trophy.awardIfNew(`trophy_${n}`, "flag");
    const afterFlagOnly = Trophy.getProgressSummary();
    check(`No.${n}の国旗のみ獲得でearnedCountが1増える`, afterFlagOnly.earnedCount === before + 1);
    Trophy.awardIfNew(`trophy_${n}`, "capital");
    const afterBoth = Trophy.getProgressSummary();
    check(`No.${n}の首都も獲得するとearnedCountがさらに1増える(合計+2)`, afterBoth.earnedCount === before + 2);
    check(`No.${n}の両方獲得後もtotalCountは変わらない(282)`, afterBoth.totalCount === 282);
  });
}

// ---- 単一モードの非デュアルトロフィー(例: No.159)は従来どおり1個として数える ----
{
  const { Trophy } = freshSandbox();
  const before = Trophy.getProgressSummary().earnedCount;
  Trophy.awardIfNew("trophy_159");
  const after = Trophy.getProgressSummary();
  check("No.159(非デュアル)の獲得でearnedCountが1増える", after.earnedCount === before + 1);
}

// ---- No.1〜19すべての国旗側だけを獲得した場合、earnedCountは19になり、
//      totalCountは282のまま変わらないこと ----
{
  const { Trophy } = freshSandbox();
  for (let n = 1; n <= 19; n++) {
    Trophy.awardIfNew(`trophy_${n}`, "flag");
  }
  const summary = Trophy.getProgressSummary();
  check("No.1〜19の国旗側19件獲得でearnedCount === 19", summary.earnedCount === 19);
  check("この状態でもtotalCount === 282のまま", summary.totalCount === 282);

  // さらに首都側も全て獲得すると38になること
  for (let n = 1; n <= 19; n++) {
    Trophy.awardIfNew(`trophy_${n}`, "capital");
  }
  const summaryBoth = Trophy.getProgressSummary();
  check("No.1〜19の国旗・首都38件すべて獲得でearnedCount === 38", summaryBoth.earnedCount === 38);
}

// ---- 対象32種類すべての国旗・首都を獲得すると、earnedCountが64(32×2)になること ----
{
  const { Trophy } = freshSandbox();
  const splitNumbers = [...Array.from({ length: 19 }, (_, i) => i + 1), 21, 26, 27, ...Array.from({ length: 10 }, (_, i) => 30 + i)];
  check("対象32種類の件数が32件であること(テストの前提確認)", splitNumbers.length === 32);
  splitNumbers.forEach((n) => {
    Trophy.awardIfNew(`trophy_${n}`, "flag");
    Trophy.awardIfNew(`trophy_${n}`, "capital");
  });
  const summary = Trophy.getProgressSummary();
  check("対象32種類すべての国旗・首都64件獲得でearnedCount === 64", summary.earnedCount === 64);
  check("totalCountは282のまま変わらない", summary.totalCount === 282);
}

// ---- 既存の獲得履歴・獲得日時がそのまま保持されること(getEarned経由で確認) ----
{
  const { Trophy } = freshSandbox();
  Trophy.awardIfNew("trophy_1", "flag");
  const earnedBefore = Trophy.getEarned();
  const earnedAtBefore = earnedBefore.trophy_1.flag.earnedAt;
  check("獲得日時が記録されている", typeof earnedAtBefore === "string" && earnedAtBefore.length > 0);

  // getProgressSummary()を何度呼んでも、既存の獲得日時を書き換えないこと
  Trophy.getProgressSummary();
  Trophy.getProgressSummary();
  const earnedAfter = Trophy.getEarned();
  check("getProgressSummary()を繰り返し呼んでも獲得日時が変化しない", earnedAfter.trophy_1.flag.earnedAt === earnedAtBefore);
}

console.log(`\nTotal: ${pass + fail}, Pass: ${pass}, Fail: ${fail}`);
process.exit(fail > 0 ? 1 : 0);
