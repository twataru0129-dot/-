// ==========================================================
// マージ前最終点検2: 企画書「謎解き121問.docx」(確定版2026年11月24日)の
// 問題番号⇔トロフィー番号No.263〜380の対応表を検証する。
//
// tests/fixtures/puzzle118_doc_mapping.json は、企画書をpandocで変換した
// Markdown(doc.md)を機械的にパースして作成した「企画書の原本どおりの
// 正解条件」のスナップショットで、118問すべてについて
//   - 企画書の問題番号(docNum)と名称(title)
//   - 正解の国・地域id列(answerIds。No.092・114・116は専用判定方式の
//     ため対象外。既にtests/trophy_puzzle118_logic.test.js・
//     tests/trophy_puzzle118_full_judge_verification.test.jsで個別検証済み)
// を凍結保持している。本ファイルは、js/puzzle-questions.jsの実データが
// このスナップショットと(名称・正解国の集合・指定順問題の並び順まで)
// 完全に一致すること、トロフィー番号No.263〜380に欠番・重複がないことを
// 検証する。
//
// 実行方法: node tests/trophy_puzzle118_doc_mapping.test.js
// ==========================================================
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const FIXTURE_PATH = path.join(__dirname, "fixtures", "puzzle118_doc_mapping.json");

function freshSandbox() {
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.console = { assert() {}, warn() {}, log() {} };
  vm.createContext(sandbox);
  let code = "";
  ["js/countries.js", "js/map-regions.js", "js/puzzle-questions.js"].forEach((f) => {
    code += fs.readFileSync(path.join(ROOT, f), "utf8") + "\n";
  });
  code += "\nvar __exports__ = { PUZZLE_QUESTIONS: PUZZLE_QUESTIONS };";
  vm.runInContext(code, sandbox, { filename: "bundle.js" });
  return sandbox.__exports__.PUZZLE_QUESTIONS;
}

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass += 1; }
  else { fail += 1; console.log("FAIL:", name); }
}

const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
const questions = freshSandbox();
const byDocNum = {};
questions.forEach((q) => {
  const m = /^puzzle-(\d{3})$/.exec(q.id);
  if (m) byDocNum[m[1]] = q;
});

check("フィクスチャが企画書どおり118件である", fixture.length === 118);

fixture.forEach((f) => {
  const q = byDocNum[f.docNum];
  check(`[${f.docNum}] ${f.title}: js/puzzle-questions.jsに存在する`, !!q);
  if (!q) return;

  check(`[${f.docNum}] ${f.title}: 名称が企画書と一致`, q.title === f.title);
  check(`[${f.docNum}] ${f.title}: トロフィー番号が企画書対応表と一致(${f.trophyNumber})`, q.trophyNumber === f.trophyNumber);
  check(`[${f.docNum}] ${f.title}: judgeModeが企画書対応表と一致(${f.judgeMode})`, q.judgeMode === f.judgeMode);

  if (f.answerIds) {
    const actual = q.answerIds || [];
    const sortedExpected = f.answerIds.slice().sort();
    const sortedActual = actual.slice().sort();
    const setMatches =
      sortedExpected.length === sortedActual.length && sortedExpected.every((id, i) => id === sortedActual[i]);
    check(`[${f.docNum}] ${f.title}: 正解国の集合が企画書と一致`, setMatches);

    if (f.judgeMode === "ordered") {
      const orderMatches = f.answerIds.length === actual.length && f.answerIds.every((id, i) => id === actual[i]);
      check(`[${f.docNum}] ${f.title}: 指定順の並びが企画書と一致`, orderMatches);
    }
  }
});

// トロフィー番号の欠番・重複チェック(263〜380)
const newTrophyNumbers = fixture.map((f) => f.trophyNumber).filter((n) => n !== null);
check("企画書対応表から得たトロフィー番号が118件すべて揃っている", newTrophyNumbers.length === 118);
const sortedNumbers = newTrophyNumbers.slice().sort((a, b) => a - b);
const expectedRange = [];
for (let n = 263; n <= 380; n++) expectedRange.push(n);
const missing = expectedRange.filter((n) => !sortedNumbers.includes(n));
check("トロフィー番号No.263〜380に欠番がない", missing.length === 0);
const dupCounts = {};
sortedNumbers.forEach((n) => { dupCounts[n] = (dupCounts[n] || 0) + 1; });
const duplicates = Object.entries(dupCounts).filter(([, c]) => c > 1);
check("トロフィー番号No.263〜380に重複がない", duplicates.length === 0);

// 既存3問(No.256〜258)が企画書対応表に含まれず、別番号系列のまま
// 独立していることも確認する
const existingThree = questions.filter((q) => [256, 257, 258].includes(q.trophyNumber));
check("既存3問(No.256〜258)はjs/puzzle-questions.jsに引き続き存在する", existingThree.length === 3);
check("既存3問は企画書対応表(No.263〜380)のtrophyNumberと重複しない", existingThree.every((q) => !newTrophyNumbers.includes(q.trophyNumber)));

console.log(`\n対応表件数: ${fixture.length}件`);
console.log(`Total: ${pass + fail} Pass: ${pass} Fail: ${fail}`);
process.exit(fail > 0 ? 1 : 0);
