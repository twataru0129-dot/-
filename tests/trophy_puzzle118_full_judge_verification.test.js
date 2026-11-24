// ==========================================================
// マージ前最終点検1: 謎解きトロフィー118問追加(No.263〜380)の全数検証。
// 高難度謎解き5問追加(No.381〜385)後も、PUZZLE_QUESTIONS全体を機械的に
// 走査する本ファイルの仕組みは変更なしで新問題を自動的に対象に含める。
//
// tests/trophy_puzzle118_logic.test.js は代表的なケース・特殊問題
// (No.092・100・109・114・116等)を狙い撃ちで検証しているが、本ファイルは
// PUZZLE_QUESTIONSに登録されている全問題(既存3問+謎解き118問+高難度5問=
// 126問)を1問も漏らさず機械的に走査し、各問題について
//   1. 正解データ(answerIds/answerGroups/requiredInitials)から動的に
//      生成した有効な正解の組み合わせで、PuzzleJudgeModule.judge()が
//      correct===trueを返すこと
//   2. その正解から1件減らしただけの明確な不正解(選択数不一致)で
//      correct===falseを返すこと
// を検証する。judgeModeごとに分岐しているのは正解組み立て方法のみで、
// 判定そのものはjs/puzzle-judge.jsの実装をそのまま使う(判定ロジックの
// 重複実装はしない)。
//
// 実行方法: node tests/trophy_puzzle118_full_judge_verification.test.js
// ==========================================================
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const FILES = ["js/countries.js", "js/map-regions.js", "js/puzzle-questions.js", "js/puzzle-judge.js"];

function freshSandbox() {
  const sandbox = {};
  sandbox.window = sandbox;
  const assertFailures = [];
  sandbox.console = { assert(cond, msg) { if (!cond) assertFailures.push(msg); }, warn() {}, log() {} };
  vm.createContext(sandbox);
  let code = "";
  FILES.forEach((f) => { code += fs.readFileSync(path.join(ROOT, f), "utf8") + "\n"; });
  code += "\nvar __exports__ = { PuzzleJudgeModule: PuzzleJudgeModule, PUZZLE_QUESTIONS: PUZZLE_QUESTIONS, COUNTRIES: COUNTRIES, MAP_ONLY_REGIONS: MAP_ONLY_REGIONS };";
  vm.runInContext(code, sandbox, { filename: "bundle.js" });
  return {
    assertFailures,
    Judge: sandbox.__exports__.PuzzleJudgeModule,
    questions: sandbox.__exports__.PUZZLE_QUESTIONS,
    countries: sandbox.__exports__.COUNTRIES,
    regions: sandbox.__exports__.MAP_ONLY_REGIONS,
  };
}

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass += 1; }
  else { fail += 1; console.log("FAIL:", name); }
}

const { assertFailures, Judge, questions, countries, regions } = freshSandbox();
check("自己検証: puzzle-questions.js/puzzle-judge.js読み込み時のassertFailuresが0件", assertFailures.length === 0);
check("自己検証: PUZZLE_QUESTIONSが126件(既存3問+謎解き118問+高難度5問)", questions.length === 126);

// requiredInitials用: js/puzzle-judge.jsのbuildInitialLetterIndexと同じ
// ロジックを、テスト側でも独立に組み立てて正解を動的生成する(判定ロジック
// 自体はjudge()をそのまま呼ぶので、ここは「正解の作り方」だけの重複)
const initialLetterPool = [].concat(countries).concat(regions);
function firstIdForInitial(letter) {
  const found = initialLetterPool.find((c) => (c.englishName || "").trim().charAt(0).toUpperCase() === letter);
  return found ? found.id : null;
}

function buildCorrectAnswer(q) {
  if (q.judgeMode === "grouped") {
    return (q.answerGroups || []).reduce((acc, g) => acc.concat(g), []);
  }
  if (q.judgeMode === "initial-letter-ordered") {
    return (q.requiredInitials || []).map(firstIdForInitial);
  }
  // ordered・unordered共通: answerIdsをそのまま並べれば必ず正解になる
  // (orderedは定義順=正解順、unorderedは順不同なので定義順でも正解)
  return (q.answerIds || []).slice();
}

const missingInitialLetterIds = [];
const results = [];

questions.forEach((q) => {
  const correctAnswer = buildCorrectAnswer(q);

  if (q.judgeMode === "initial-letter-ordered" && correctAnswer.some((id) => id === null)) {
    missingInitialLetterIds.push(q.id);
  }

  const correctResult = Judge.judge(q.id, correctAnswer);
  check(`[${q.id}] No.${q.number} ${q.title}: 動的生成した正解でcorrect===trueになる`, correctResult.correct === true);
  if (correctResult.correct) {
    check(`[${q.id}] No.${q.number} ${q.title}: 正解時にexplanationTextが返る`, typeof correctResult.explanationText === "string" && correctResult.explanationText.length > 0);
  }

  // 明確な不正解: 正解から1件減らすだけで、どのjudgeModeでも
  // (length不一致により)必ず不正解になる
  const wrongAnswer = correctAnswer.slice(0, -1);
  const wrongResult = Judge.judge(q.id, wrongAnswer);
  check(`[${q.id}] No.${q.number} ${q.title}: 1件減らした明確な不正解でcorrect===falseになる`, wrongResult.correct === false);

  results.push({
    id: q.id,
    number: q.number,
    trophyNumber: q.trophyNumber,
    title: q.title,
    judgeMode: q.judgeMode,
    correctPass: correctResult.correct === true,
    wrongPass: wrongResult.correct === false,
  });
});

check("全126問でinitial-letter-ordered問題の頭文字に該当する国が1件も見つからない欠落がない", missingInitialLetterIds.length === 0);

const newProblems = results.filter((r) => r.trophyNumber >= 263 && r.trophyNumber <= 380);
check("謎解き118問が過不足なく対象に含まれる(trophyNumber 263〜380)", newProblems.length === 118);
check("謎解き118問すべてで正解判定が成功している", newProblems.every((r) => r.correctPass));
check("謎解き118問すべてで不正解判定も成功している(明確な不正解を誤って正解にしていない)", newProblems.every((r) => r.wrongPass));

const hardProblems = results.filter((r) => r.trophyNumber >= 381 && r.trophyNumber <= 385);
check("高難度5問が過不足なく対象に含まれる(trophyNumber 381〜385)", hardProblems.length === 5);
check("高難度5問すべてで正解判定が成功している", hardProblems.every((r) => r.correctPass));
check("高難度5問すべてで不正解判定も成功している(明確な不正解を誤って正解にしていない)", hardProblems.every((r) => r.wrongPass));

const allOk = results.every((r) => r.correctPass && r.wrongPass);
check("既存3問・謎解き118問・高難度5問を含む全126問で正解/不正解判定が両方とも想定どおり", allOk);

console.log(`\n対象問題数: ${results.length}件(うち新規118問: ${newProblems.length}件)`);
console.log(`Total: ${pass + fail} Pass: ${pass} Fail: ${fail}`);
process.exit(fail > 0 ? 1 : 0);
