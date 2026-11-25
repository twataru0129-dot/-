// ==========================================================
// 謎解きトロフィー(第3段階)の番号・ID固定化のロジック層テスト(PR #81追加修正)。
//
// js/countries.js・js/map-regions.js・js/capital-display.js・js/storage.js・
// js/trophy.jsをNodeのvmモジュールでロードし(DOM不要)、PUZZLE_QUESTIONSを
// テストごとに差し替えて、以下を確認する。
//   - 各問題のtrophyNumberがそのままトロフィー番号になること(配列index
//     からは計算されないこと)
//   - PUZZLE_QUESTIONSの配列の並び順を変えても、既存のtrophyNumberが
//     変化しないこと
//   - 新しい問題(例: No.03)を配列の途中に追加しても、既存の問題の
//     trophyNumberが変化しないこと
//   - trophyNumberの重複・範囲外の値・未登録の欠番を自己検証
//     (console.assert)が検出すること
//
// 実行方法: node tests/trophy_puzzle_numbering_logic.test.js
// ==========================================================
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const BASE_FILES = ["js/countries.js", "js/map-regions.js", "js/capital-display.js", "js/storage.js"];

// 本番のjs/puzzle-questions.js(PR #81時点)と同じtrophyNumber割り当て
const REAL_PUZZLE_01 = `{ id: "puzzle-01", number: 1, trophyNumber: 256, title: "世界三大料理", genre: "g", judgeMode: "unordered", answerIds: ["fr","cn","tr"], questionText: "q1", explanationText: "e1" }`;
const REAL_PUZZLE_02 = `{ id: "puzzle-02", number: 2, trophyNumber: 257, title: "人口の双璧", genre: "g", judgeMode: "unordered", answerIds: ["in","cn"], questionText: "q2", explanationText: "e2" }`;
const REAL_PUZZLE_04 = `{ id: "puzzle-04", number: 4, trophyNumber: 258, title: "双子の旗", genre: "g", judgeMode: "unordered", answerIds: ["id","mc"], questionText: "q4", explanationText: "e4" }`;
// 将来追加されうる新規問題(No.03)を模したダミー。既存の256〜258や、
// 世界図鑑トロフィー追加分(#259〜262)とも重複せず、かつ連続して
// 隙間を作らない新しい番号(263、#259〜262の直後)を割り振る想定
const NEW_PUZZLE_03 = `{ id: "puzzle-03", number: 3, trophyNumber: 263, title: "ダミー問題03", genre: "g", judgeMode: "unordered", answerIds: ["jp"], questionText: "q3", explanationText: "e3" }`;

function buildSandbox(puzzleQuestionsArrayLiteral) {
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
  BASE_FILES.forEach((f) => { code += fs.readFileSync(path.join(ROOT, f), "utf8") + "\n"; });
  code += `\nconst PUZZLE_QUESTIONS = [${puzzleQuestionsArrayLiteral}];\n`;
  code += `const PUZZLE_QUESTIONS_BY_ID = PUZZLE_QUESTIONS.reduce((m,q)=>{m[q.id]=q;return m;},{});\n`;
  code += fs.readFileSync(path.join(ROOT, "js/trophy.js"), "utf8") + "\n";
  code += "\nvar __exports__ = { TrophyModule: TrophyModule };";
  vm.runInContext(code, sandbox, { filename: "bundle.js" });
  return { assertFailures, Trophy: sandbox.__exports__.TrophyModule };
}

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass += 1; console.log("PASS:", name); }
  else { fail += 1; console.log("FAIL:", name); }
}

function trophyIdByQuestionId(Trophy, questionId) {
  const def = Trophy.getAllDefinitions().find((d) => d.puzzleQuestionId === questionId);
  return def ? def.id : null;
}

// ---- シナリオA: 本番と同じ並び順(基準) ----
{
  const { assertFailures, Trophy } = buildSandbox([REAL_PUZZLE_01, REAL_PUZZLE_02, REAL_PUZZLE_04].join(","));
  check("シナリオA: No.01がtrophy_256になっている", trophyIdByQuestionId(Trophy, "puzzle-01") === "trophy_256");
  check("シナリオA: No.02がtrophy_257になっている", trophyIdByQuestionId(Trophy, "puzzle-02") === "trophy_257");
  check("シナリオA: No.04がtrophy_258になっている", trophyIdByQuestionId(Trophy, "puzzle-04") === "trophy_258");
  check("シナリオA: 自己検証のassertFailuresが0件", assertFailures.length === 0);
}

// ---- シナリオB: 配列の並び順を変更しても番号が変わらない ----
{
  const { assertFailures, Trophy } = buildSandbox([REAL_PUZZLE_04, REAL_PUZZLE_02, REAL_PUZZLE_01].join(","));
  check("シナリオB(並び順変更): No.01は依然trophy_256", trophyIdByQuestionId(Trophy, "puzzle-01") === "trophy_256");
  check("シナリオB(並び順変更): No.02は依然trophy_257", trophyIdByQuestionId(Trophy, "puzzle-02") === "trophy_257");
  check("シナリオB(並び順変更): No.04は依然trophy_258", trophyIdByQuestionId(Trophy, "puzzle-04") === "trophy_258");
  check("シナリオB: 自己検証のassertFailuresが0件", assertFailures.length === 0);
}

// ---- シナリオC: 途中にNo.03を新規追加しても既存の番号が変わらない ----
{
  const { assertFailures, Trophy } = buildSandbox([REAL_PUZZLE_01, NEW_PUZZLE_03, REAL_PUZZLE_02, REAL_PUZZLE_04].join(","));
  check("シナリオC(No.03追加): No.01は依然trophy_256", trophyIdByQuestionId(Trophy, "puzzle-01") === "trophy_256");
  check("シナリオC(No.03追加): No.02は依然trophy_257", trophyIdByQuestionId(Trophy, "puzzle-02") === "trophy_257");
  check("シナリオC(No.03追加): No.04は依然trophy_258(変更されない)", trophyIdByQuestionId(Trophy, "puzzle-04") === "trophy_258");
  check("シナリオC(No.03追加): 新規No.03はtrophy_263になる", trophyIdByQuestionId(Trophy, "puzzle-03") === "trophy_263");
  check("シナリオC: 自己検証のassertFailuresが0件", assertFailures.length === 0);
  const total = Trophy.getAllDefinitions().length;
  check("シナリオC: トロフィー総数が289件(254+4問+共通トロフィー31件)になっている", total === 289);
}

// ---- シナリオD: trophyNumberの重複は自己検証で検出される ----
{
  const DUP_PUZZLE_04 = `{ id: "puzzle-04", number: 4, trophyNumber: 257, title: "双子の旗", genre: "g", judgeMode: "unordered", answerIds: ["id","mc"], questionText: "q4", explanationText: "e4" }`;
  const { assertFailures } = buildSandbox([REAL_PUZZLE_01, REAL_PUZZLE_02, DUP_PUZZLE_04].join(","));
  check("シナリオD(重複257): 自己検証がtrophyNumberの重複を検出する", assertFailures.some((m) => m.includes("trophyNumber") && m.includes("重複")));
}

// ---- シナリオE: trophyNumberが範囲外(255以下)の場合を検出する ----
{
  const OUT_OF_RANGE = `{ id: "puzzle-99", number: 99, trophyNumber: 100, title: "不正な問題", genre: "g", judgeMode: "unordered", answerIds: ["jp"], questionText: "q", explanationText: "e" }`;
  const { assertFailures } = buildSandbox([REAL_PUZZLE_01, OUT_OF_RANGE].join(","));
  check("シナリオE(範囲外100): 自己検証がtrophyNumberの範囲外を検出する", assertFailures.some((m) => m.includes("trophyNumber") && m.includes("不正")));
}

// ---- シナリオF: SKIPPED_NUMBERSに登録されていない欠番を検出する ----
{
  // 270は世界図鑑トロフィー追加分(#259〜262)とも重複しない未使用の番号
  const GAP_PUZZLE = `{ id: "puzzle-gap", number: 9, trophyNumber: 270, title: "欠番確認用", genre: "g", judgeMode: "unordered", answerIds: ["jp"], questionText: "q", explanationText: "e" }`;
  // 256のみ使用、257〜269は未登録のままMAX=270まで枠が広がるため欠番になる
  const { assertFailures } = buildSandbox([REAL_PUZZLE_01, GAP_PUZZLE].join(","));
  check("シナリオF(未登録の欠番257〜269): 自己検証が欠番を検出する", assertFailures.some((m) => m.includes("未定義のまま枠だけ作られています")));
}

// ---- シナリオG: 問題が1件も無い場合(PUZZLE_QUESTIONS未読込相当)は謎解きトロフィー0件 ----
{
  const { assertFailures, Trophy } = buildSandbox("");
  check("シナリオG(0件): 謎解きトロフィーが0件でも既存254件(世界図鑑追加分込み)+共通トロフィー31件は壊れない", Trophy.getAllDefinitions().length === 285);
  check("シナリオG: 自己検証のassertFailuresが0件", assertFailures.length === 0);
}

console.log(`\nTotal: ${pass + fail} Pass: ${pass} Fail: ${fail}`);
process.exit(fail > 0 ? 1 : 0);
