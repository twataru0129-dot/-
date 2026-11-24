// ==========================================================
// 謎解きトロフィー118問追加実装のロジック層テスト。
// js/countries.js・js/map-regions.js・js/capital-display.js・js/storage.js・
// js/puzzle-questions.js・js/puzzle-judge.js・js/trophy.jsをNodeのvmモジュール
// でロードし(DOM不要)、以下を確認する。
//   - データ整合性(118問・番号範囲・重複なし・既存3問維持・全項目完備)
//   - 回答判定(単独・順不同・指定順・一部順不同(グループ)・
//     英語国名頭文字一致の5方式すべて)
//   - 他問題のトロフィーが誤って解放されないこと
// 実行方法: node tests/trophy_puzzle118_logic.test.js
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
  code += "\nvar __exports__ = { TrophyModule: TrophyModule, Storage: Storage, PuzzleJudgeModule: PuzzleJudgeModule, PUZZLE_QUESTIONS: PUZZLE_QUESTIONS, PUZZLE_QUESTIONS_BY_ID: PUZZLE_QUESTIONS_BY_ID, COUNTRIES: COUNTRIES, MAP_ONLY_REGIONS: MAP_ONLY_REGIONS };";
  vm.runInContext(code, sandbox, { filename: "bundle.js" });
  return { assertFailures, ...sandbox.__exports__ };
}

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass += 1; }
  else { fail += 1; console.log("FAIL:", name); }
}

const { assertFailures, TrophyModule: Trophy, Storage, PuzzleJudgeModule: Judge, PUZZLE_QUESTIONS, PUZZLE_QUESTIONS_BY_ID, COUNTRIES, MAP_ONLY_REGIONS } = buildSandbox();

// ========================================================
// A. データ整合性
// ========================================================
{
  check("自己検証(trophy.js)のassertFailuresが0件", assertFailures.length === 0);

  // 【高難度謎解き5問追加(No.381〜385)後も、この118問固有のチェックが
  // 対象をずらさないよう、trophyNumberの範囲(263〜380)で絞り込む】
  const newQuestions = PUZZLE_QUESTIONS.filter((q) => q.trophyNumber >= 263 && q.trophyNumber <= 380);
  check("新規登録数が118問", newQuestions.length === 118);

  const newTrophyNumbers = newQuestions.map((q) => q.trophyNumber).sort((a, b) => a - b);
  const expectedNumbers = Array.from({ length: 118 }, (_, i) => 263 + i);
  check("新規トロフィー番号が263〜380の連番", JSON.stringify(newTrophyNumbers) === JSON.stringify(expectedNumbers));

  const allTrophyNumbers = PUZZLE_QUESTIONS.map((q) => q.trophyNumber);
  check("トロフィー番号の重複なし(既存3問込み)", new Set(allTrophyNumbers).size === allTrophyNumbers.length);

  const allIds = PUZZLE_QUESTIONS.map((q) => q.id);
  check("内部IDの重複なし(既存3問込み)", new Set(allIds).size === allIds.length);

  // 既存3問が変更されていないこと
  const existing = {
    "puzzle-01": { trophyNumber: 256, title: "世界三大料理", answerIds: ["fr", "cn", "tr"] },
    "puzzle-02": { trophyNumber: 257, title: "人口の双璧", answerIds: ["in", "cn"] },
    "puzzle-04": { trophyNumber: 258, title: "双子の旗", answerIds: ["id", "mc"] },
  };
  Object.entries(existing).forEach(([id, expect]) => {
    const q = PUZZLE_QUESTIONS_BY_ID[id];
    check(`既存${id}のtrophyNumberが維持されている`, q && q.trophyNumber === expect.trophyNumber);
    check(`既存${id}のtitleが維持されている`, q && q.title === expect.title);
    check(`既存${id}のanswerIdsが維持されている`, q && JSON.stringify(q.answerIds) === JSON.stringify(expect.answerIds));
  });

  // 全問題に問題文・解説・判定方式があること
  const validIds = new Set(COUNTRIES.map((c) => c.id).concat(MAP_ONLY_REGIONS.map((r) => r.id)));
  let allHaveText = true;
  let allAnswerIdsValid = true;
  let allWithinMax10 = true;
  let answerCountMatchesText = true;
  PUZZLE_QUESTIONS.forEach((q) => {
    if (!q.questionText || !q.explanationText || !q.judgeMode) allHaveText = false;
    let answerIdList = [];
    if (q.judgeMode === "grouped") {
      answerIdList = q.answerGroups.flat();
    } else if (q.judgeMode === "initial-letter-ordered") {
      answerIdList = null; // 頭文字一致は固定idを持たない
    } else {
      answerIdList = q.answerIds;
    }
    if (answerIdList) {
      if (!answerIdList.every((id) => validIds.has(id))) allAnswerIdsValid = false;
      if (answerIdList.length > 10) allWithinMax10 = false;
    } else if (q.requiredInitials) {
      if (q.requiredInitials.length > 10) allWithinMax10 = false;
    }
  });
  check("全問題に問題文・解説・判定方式がある", allHaveText);
  check("正解の国・地域IDがすべて有効(COUNTRIES+MAP_ONLY_REGIONS)", allAnswerIdsValid);
  check("各問題の選択数が最大10枚以内", allWithinMax10);

  // judgeMode別の件数確認
  const modeCounts = {};
  PUZZLE_QUESTIONS.forEach((q) => { modeCounts[q.judgeMode] = (modeCounts[q.judgeMode] || 0) + 1; });
  check("initial-letter-orderedが2問(No.092・116)", modeCounts["initial-letter-ordered"] === 2);
  check("groupedが1問(No.114)", modeCounts["grouped"] === 1);
}

// ========================================================
// B. 回答判定: 単独回答
// ========================================================
{
  const q = PUZZLE_QUESTIONS.find((x) => x.title === "赤い葉の国旗");
  check("単独回答(赤い葉の国旗): 正解(カナダ)で正解判定", Judge.judge(q.id, ["ca"]).correct === true);
  check("単独回答: 不正解の国では不正解判定", Judge.judge(q.id, ["fr"]).correct === false);
  check("単独回答: 正解数が0では不正解判定", Judge.judge(q.id, []).correct === false);
  check("単独回答: 余分な国旗が含まれると不正解判定", Judge.judge(q.id, ["ca", "fr"]).correct === false);
}

// ========================================================
// C. 回答判定: 順不同・指定順
// ========================================================
{
  const unordered = PUZZLE_QUESTIONS.find((x) => x.title === "カカオの国"); // ci, gh
  check("順不同: 正しい組み合わせ(正順)で正解", Judge.judge(unordered.id, ["ci", "gh"]).correct === true);
  check("順不同: 正しい組み合わせ(逆順)でも正解", Judge.judge(unordered.id, ["gh", "ci"]).correct === true);
  check("順不同: 片方だけでは不正解", Judge.judge(unordered.id, ["ci"]).correct === false);
  check("順不同: 余分な国が含まれると不正解", Judge.judge(unordered.id, ["ci", "gh", "jp"]).correct === false);

  const ordered = PUZZLE_QUESTIONS.find((x) => x.title === "初代世界王者"); // uy -> it
  check("指定順: 正しい順序で正解", Judge.judge(ordered.id, ["uy", "it"]).correct === true);
  check("指定順: 順序が逆だと不正解", Judge.judge(ordered.id, ["it", "uy"]).correct === false);
  check("指定順: 件数が合わないと不正解", Judge.judge(ordered.id, ["uy"]).correct === false);

  const ordered3 = PUZZLE_QUESTIONS.find((x) => x.title === "方角の支配者"); // mk,tl,ss,eh (地図専用地域ehを含む)
  check("指定順(4か国・地図専用地域含む): 正しい順序で正解", Judge.judge(ordered3.id, ["mk", "tl", "ss", "eh"]).correct === true);
  check("指定順(4か国): 1か所でも入れ替わると不正解", Judge.judge(ordered3.id, ["mk", "ss", "tl", "eh"]).correct === false);
}

// ========================================================
// D. 回答判定: 一部順不同(グループ、No.114)
// ========================================================
{
  const grouped = PUZZLE_QUESTIONS.find((x) => x.title === "砂漠の四つの顔");
  check("一部順不同: 正しいグループ順・グループ内正順で正解", Judge.judge(grouped.id, ["mn", "cn", "cl", "na", "in", "pk"]).correct === true);
  check("一部順不同: グループ内の順序を入れ替えても正解(第1グループ)", Judge.judge(grouped.id, ["cn", "mn", "cl", "na", "in", "pk"]).correct === true);
  check("一部順不同: グループ内の順序を入れ替えても正解(第4グループ)", Judge.judge(grouped.id, ["mn", "cn", "cl", "na", "pk", "in"]).correct === true);
  check("一部順不同: グループ同士の順序が入れ替わると不正解", Judge.judge(grouped.id, ["cl", "mn", "cn", "na", "in", "pk"]).correct === false);
  check("一部順不同: 件数が不足すると不正解", Judge.judge(grouped.id, ["mn", "cn", "cl", "na", "in"]).correct === false);
  check("一部順不同: 件数が超過すると不正解", Judge.judge(grouped.id, ["mn", "cn", "cl", "na", "in", "pk", "jp"]).correct === false);
  check("一部順不同: 他グループの国で代用すると不正解", Judge.judge(grouped.id, ["mn", "jp", "cl", "na", "in", "pk"]).correct === false);
}

// ========================================================
// E. 回答判定: 英語国名頭文字一致(No.092・116)
// ========================================================
{
  const japan = PUZZLE_QUESTIONS.find((x) => x.title === "世界を解く暗号"); // J,A,P,A,N
  check("頭文字一致(JAPAN): 代表的な組み合わせで正解", Judge.judge(japan.id, ["jp", "ao", "pe", "at", "ng"]).correct === true);
  check("頭文字一致(JAPAN): 別の組み合わせでも正解", Judge.judge(japan.id, ["jp", "ar", "pe", "au", "ng"]).correct === true);
  check("頭文字一致(JAPAN): 同じ国の複数回選択も正解として許容", (() => {
    // J=Japan, A=Jordan? 要件はA=頭文字Aの国。Japanを複数回使う例: J位置と...
    // 実際の仕様は「同一国の再選択」を許容するだけなので、ここでは異なる位置に
    // 同じ国(頭文字が異なる場合は不正解になる)を使うのではなく、要件どおり
    // 「同じ国を複数の位置で選んでも、各位置の頭文字さえ合えば正解」を検証する。
    // アルゼンチン(Argentina)はA・Aの両方で使える
    return Judge.judge(japan.id, ["jp", "ar", "pe", "ar", "ng"]).correct === true;
  })());
  check("頭文字一致(JAPAN): 1か所でも頭文字が違うと不正解", Judge.judge(japan.id, ["jp", "ar", "pe", "au", "mx"]).correct === false);
  check("頭文字一致(JAPAN): 順序が違うと不正解", Judge.judge(japan.id, ["ar", "jp", "pe", "au", "ng"]).correct === false);
  check("頭文字一致(JAPAN): 件数が合わないと不正解", Judge.judge(japan.id, ["jp", "ar", "pe", "au"]).correct === false);

  const peru = PUZZLE_QUESTIONS.find((x) => x.title === "四文字の道標"); // P,E,R,U
  check("頭文字一致(PERU): 代表的な組み合わせで正解", Judge.judge(peru.id, ["pe", "eg", "ru", "us"]).correct === true);
  check("頭文字一致(PERU): 別の有効な組み合わせでも正解", Judge.judge(peru.id, ["pt", "ec", "ro", "ug"]).correct === true);
  check("頭文字一致(PERU): 順序が違うと不正解", Judge.judge(peru.id, ["eg", "pe", "ru", "us"]).correct === false);
}

// ========================================================
// F. 他問題への誤判定がないこと
// ========================================================
{
  const q1 = PUZZLE_QUESTIONS.find((x) => x.title === "赤い葉の国旗"); // ca
  const q2 = PUZZLE_QUESTIONS.find((x) => x.title === "杉の木を探せ"); // lb
  check("問題Aに挑戦中、問題Bの正解を入力しても問題Aとしては不正解", Judge.judge(q1.id, ["lb"]).correct === false);
  check("未登録の問題IDは常に不正解", Judge.judge("puzzle-not-exist", ["ca"]).correct === false);
}

// ========================================================
// G. トロフィー獲得: 新規問題の正解でトロフィーが解放される
// ========================================================
{
  const q = PUZZLE_QUESTIONS.find((x) => x.title === "赤い葉の国旗");
  const before = Trophy.isEarned(`trophy_${q.trophyNumber}`);
  check("獲得前は未獲得", before === false);
  const result = Trophy.evaluatePuzzleAnswer({ questionId: q.id, correct: true });
  check("正解でそのトロフィーが新規獲得される", result.awardedIds.includes(`trophy_${q.trophyNumber}`));
  const after = Trophy.isEarned(`trophy_${q.trophyNumber}`);
  check("獲得後はisEarnedがtrueになる", after === true);
  const second = Trophy.evaluatePuzzleAnswer({ questionId: q.id, correct: true });
  check("既に獲得済みの問題への再正解は新規獲得にならない", second.awardedIds.length === 0);

  // 別の問題のトロフィーは解放されない
  const other = PUZZLE_QUESTIONS.find((x) => x.title === "杉の木を探せ");
  check("別の問題のトロフィーは解放されない", Trophy.isEarned(`trophy_${other.trophyNumber}`) === false);
}

console.log(`\nTotal: ${pass + fail}, Pass: ${pass}, Fail: ${fail}`);
process.exit(fail > 0 ? 1 : 0);
