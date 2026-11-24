// ==========================================================
// 通常の高難度謎解き5問追加(trophyNumber 381〜385)のロジック層テスト。
// js/countries.js・js/map-regions.js・js/capital-display.js・js/storage.js・
// js/puzzle-questions.js・js/puzzle-judge.js・js/trophy.jsをNodeのvmモジュール
// でロードし(DOM不要)、以下を確認する。
//   - データ整合性(5問・番号範囲381〜385・重複なし・既存126問(既存3問+
//     謎解き118問)が維持されていること)
//   - 回答判定(5問とも既存のjudgeMode:"unordered"のみで実装。過不足なく
//     正解国を選んだ場合のみ正解になること)
//   - 他問題(既存121問・新規他4問)への誤判定がないこと
//   - トロフィー獲得・冪等性・再読み込み後の保持
//   - No.385「歴史の分岐点」のquestionTextが、説明文を含まず数字の図の
//     4行だけであること
// 実行方法: node tests/trophy_puzzle_hard5_logic.test.js
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
  "js/puzzle-questions.js",
  "js/puzzle-judge.js",
  "js/trophy.js",
];

function buildSandbox() {
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
  code += "\nvar __exports__ = { TrophyModule: TrophyModule, Storage: Storage, PuzzleJudgeModule: PuzzleJudgeModule, PUZZLE_QUESTIONS: PUZZLE_QUESTIONS, PUZZLE_QUESTIONS_BY_ID: PUZZLE_QUESTIONS_BY_ID };";
  vm.runInContext(code, sandbox, { filename: "bundle.js" });
  return { assertFailures, ...sandbox.__exports__ };
}

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass += 1; }
  else { fail += 1; console.log("FAIL:", name); }
}

const { assertFailures, TrophyModule: Trophy, PuzzleJudgeModule: Judge, PUZZLE_QUESTIONS, PUZZLE_QUESTIONS_BY_ID } = buildSandbox();

check("自己検証: 読み込み時のassertFailuresが0件", assertFailures.length === 0);

const HARD5_IDS = ["puzzle-hard-01", "puzzle-hard-02", "puzzle-hard-03", "puzzle-hard-04", "puzzle-hard-05"];

// ========================================================
// A. データ整合性
// ========================================================
{
  check("PUZZLE_QUESTIONSが126件(既存3問+謎解き118問+高難度5問)", PUZZLE_QUESTIONS.length === 126);
  const hard5 = HARD5_IDS.map((id) => PUZZLE_QUESTIONS_BY_ID[id]);
  check("高難度5問すべてがPUZZLE_QUESTIONS_BY_IDに存在する", hard5.every((q) => !!q));

  const trophyNumbers = hard5.map((q) => q.trophyNumber).sort((a, b) => a - b);
  check("トロフィー番号が381〜385の5件(欠番・重複なし)", JSON.stringify(trophyNumbers) === JSON.stringify([381, 382, 383, 384, 385]));
  check("5問とも judgeMode が既存の unordered である(新規判定方式を追加していない)", hard5.every((q) => q.judgeMode === "unordered"));

  // 既存121問(既存3問+謎解き118問、trophyNumber 256〜380)が変更されず
  // 残っていることを確認する
  const existing121 = PUZZLE_QUESTIONS.filter((q) => q.trophyNumber >= 256 && q.trophyNumber <= 380);
  check("既存121問(trophyNumber 256〜380)がそのまま残っている", existing121.length === 121);
}

// ========================================================
// B. 回答判定(5問とも unordered: 過不足なく正解国を選んだ場合のみ正解)
// ========================================================
{
  const cases = [
    { id: "puzzle-hard-01", correct: ["om", "ae"], wrongMissing: ["om"], wrongExtra: ["om", "ae", "sa"], wrongSwap: ["sa", "ae"] },
    { id: "puzzle-hard-02", correct: ["mc"], wrongMissing: [], wrongExtra: ["mc", "mo"], wrongSwap: ["mo"] },
    { id: "puzzle-hard-03", correct: ["ws"], wrongMissing: [], wrongExtra: ["ws", "to"], wrongSwap: ["to"] },
    { id: "puzzle-hard-04", correct: ["id", "my", "bn"], wrongMissing: ["id", "my"], wrongExtra: ["id", "my", "bn", "ph"], wrongSwap: ["ph", "my", "bn"] },
    { id: "puzzle-hard-05", correct: ["de", "cz", "sk"], wrongMissing: ["de", "cz"], wrongExtra: ["de", "cz", "sk", "at"], wrongSwap: ["at", "cz", "sk"] },
  ];
  cases.forEach(({ id, correct, wrongMissing, wrongExtra, wrongSwap }) => {
    check(`[${id}] 正解国をちょうど選ぶと正解になる`, Judge.judge(id, correct).correct === true);
    if (correct.length > 1) {
      const reversed = correct.slice().reverse();
      check(`[${id}] 順不同のため逆順でも正解になる`, Judge.judge(id, reversed).correct === true);
    }
    check(`[${id}] 不足(1件少ない)では不正解になる`, Judge.judge(id, wrongMissing).correct === false);
    check(`[${id}] 余分(1件多い)では不正解になる`, Judge.judge(id, wrongExtra).correct === false);
    check(`[${id}] 無関係な国に差し替えると不正解になる`, Judge.judge(id, wrongSwap).correct === false);
  });
}

// ========================================================
// C. 他問題への誤判定がないこと(高難度5問どうし・既存問題との両方)
// ========================================================
{
  // puzzle-hard-02(モナコ)挑戦中にpuzzle-hard-03(サモア)の正解(ws)を
  // 入力しても、puzzle-hard-02としては不正解になる
  check("問題間の誤判定: hard-02挑戦中にhard-03の正解国を入れても不正解", Judge.judge("puzzle-hard-02", ["ws"]).correct === false);
  // 既存のNo.120「星を刻む南の旗」(puzzle-120, 正解ws)とpuzzle-hard-03は
  // 同じ正解国(サモア)を共有するが、問題IDが異なるため互いに影響しない
  const q120 = PUZZLE_QUESTIONS.find((q) => q.title === "星を刻む南の旗");
  check("既存No.120(サモア)が存在し、hard-03とは別問題である", !!q120 && q120.id !== "puzzle-hard-03");
  check("既存No.120の正解(ws)はhard-03でも正解になる(同じ国を答えとする別問題同士の判定が独立していることの確認)", Judge.judge("puzzle-hard-03", ["ws"]).correct === true);
  check("未登録の問題IDは常に不正解", Judge.judge("puzzle-not-exist", ["mc"]).correct === false);
}

// ========================================================
// D. トロフィー獲得・冪等性・他トロフィーへの非解放
// ========================================================
HARD5_IDS.forEach((id) => {
  const q = PUZZLE_QUESTIONS_BY_ID[id];
  const trophyId = `trophy_${q.trophyNumber}`;
  check(`[${id}] 獲得前は未獲得`, Trophy.isEarned(trophyId) === false);
  const result = Trophy.evaluatePuzzleAnswer({ questionId: id, correct: true });
  check(`[${id}] 正解でそのトロフィーが新規獲得される`, result.awardedIds.includes(trophyId));
  check(`[${id}] 獲得後はisEarnedがtrueになる`, Trophy.isEarned(trophyId) === true);
  const second = Trophy.evaluatePuzzleAnswer({ questionId: id, correct: true });
  check(`[${id}] 既に獲得済みの問題への再正解は新規獲得にならない`, second.awardedIds.length === 0);
});
{
  // 5問すべて正解した後も、互いの獲得状態が独立していること・他の
  // 既存問題のトロフィーを誤って解放していないことを確認する
  const allHardEarned = HARD5_IDS.every((id) => Trophy.isEarned(`trophy_${PUZZLE_QUESTIONS_BY_ID[id].trophyNumber}`));
  check("高難度5問すべてが独立して獲得済みになっている", allHardEarned);
  const q01 = PUZZLE_QUESTIONS.find((x) => x.title === "赤い葉の国旗"); // 既存118問の1つ(ca)
  check("高難度5問の獲得は既存の謎解き118問側のトロフィーに影響しない", Trophy.isEarned(`trophy_${q01.trophyNumber}`) === false);
}

// ========================================================
// E. No.385「歴史の分岐点」: 説明文・ヒント文を含まず、数字の図のみを
// questionTextとして保持していること
// ========================================================
{
  const q385 = PUZZLE_QUESTIONS_BY_ID["puzzle-hard-05"];
  const lines = q385.questionText.split("\n");
  check("No.385のquestionTextが改行区切りで4行である", lines.length === 4);
  check("No.385のquestionTextに年号1949・1990・1918・1993がすべて含まれる", ["1949", "1990", "1918", "1993"].every((y) => q385.questionText.includes(y)));
  check("No.385のquestionTextに矢印(→)が4回含まれる(各行1回)", (q385.questionText.match(/→/g) || []).length === 4);
  check("No.385のquestionTextに国名(ドイツ・チェコ・スロバキア等)が含まれない(正解を直接明かさない)", !/ドイツ|チェコ|スロバキア/.test(q385.questionText));
  check("No.385のexplanationTextには正解に対応する歴史的説明が含まれる", /1949/.test(q385.explanationText) && /1993/.test(q385.explanationText));
}

console.log(`\nTotal: ${pass + fail}, Pass: ${pass}, Fail: ${fail}`);
process.exit(fail > 0 ? 1 : 0);
