// ==========================================================
// 隠しトロフィー61種類(#195〜255、第2段階)のロジック層テスト。
// js/storage.js・js/trophy.jsをNodeのvmモジュールでロードし(DOM不要)、
// TrophyModule.evaluateFindCountryHiddenProgress()を合成したcontextで
// 直接呼んで検証する。各トロフィーについて、同一のfreshSandbox()内で
// 先に「未達成ケース」、その後に「達成ケース」を確認する(isEarned()の
// 重複防止ガードが干渉しないようにするため、達成ケースは必ず最後に置く)。
// 依存パッケージ不要(node tests/trophy_hidden61_logic.test.js で実行)。
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

// 標準的な1問分のresults要素を組み立てる(デフォルトは満点・初回正解・
// 残り時間たっぷり)。overridesで必要な項目だけ上書きする
function mkR(n, overrides) {
  return Object.assign({
    questionNumber: n, countryId: "c" + n, answeredId: "c" + n, result: "correct",
    firstTryCorrect: true, wrongAttempts: 0, zoomUsed: false,
    elapsedSeconds: 1, secondsLeft: 10, points: 1000, livesAfter: 5, streakAfter: n,
  }, overrides || {});
}

function mkMistake(order, questionNumber, countryId, kind, livesAfter) {
  return { order, questionNumber, countryId, kind, livesAfter };
}

// 1プレイの基本context(大半のトロフィーで共通の最小構成)
function baseCtx(overrides) {
  return Object.assign({
    source: "findcountry", difficultyId: "beginner", correctCount: 0, answered: 0,
    target: 5, maxLives: 5, maxStreak: 0, isNormalClear: false, isProComplete: false,
    noMistakes: true, noMissClear: false, perfectClear: false, endReason: "pool_exhausted",
    lifeAtOneMoment: null, mistakeEvents: [], gameOver: false, results: [],
  }, overrides || {});
}

function awarded(Trophy, ctx) {
  return Trophy.evaluateFindCountryHiddenProgress(ctx).hiddenAwardedIds;
}

// ---- 自己検証(0件失敗を確認) ----
{
  const { assertFailures } = freshSandbox();
  check("trophy.js self-validation has zero failures", assertFailures.length === 0);
}

// ==========================================================
// #195〜228: 最終得点系(34件)。「正式なクリアまたはゲームオーバー」のみ
// 判定し、途中中断(isNormalClear/isProComplete/gameOverが全てfalse)では
// 判定しないことを#195で代表的に確認し、残りは各条件値だけを確認する
// ==========================================================
const finalScoreCases = [
  [195, 7777, "trophy_195"],
  [196, 12345, "trophy_196"],
  [197, 666, "trophy_197"],
  [198, 777, "trophy_198"],
  [199, 11618, "trophy_199"],
  [200, 31415, "trophy_200"],
  [202, 11235, "trophy_202"],
  [203, 2359, "trophy_203"],
  [205, 1808, "trophy_205"],
  [206, 2291, "trophy_206"],
  [208, 1729, "trophy_208"],
  [209, 6174, "trophy_209"],
  [210, 8640, "trophy_210"],
  [211, 129, "trophy_211"],
  [212, 101, "trophy_212"],
  [213, 1231, "trophy_213"],
  [214, 9999, "trophy_214"],
  [215, 1977, "trophy_215"],
  [216, 1905, "trophy_216"],
  [217, 404, "trophy_217"],
  [218, 8848, "trophy_218"],
  [219, 3776, "trophy_219"],
  [220, 634, "trophy_220"],
  [221, 333, "trophy_221"],
  [222, 2112, "trophy_222"],
  [223, 151, "trophy_223"],
  [224, 2019, "trophy_224"],
  [225, 108, "trophy_225"],
  [226, 1025, "trophy_226"],
  [227, 1001, "trophy_227"],
  [228, 8888, "trophy_228"],
];
finalScoreCases.forEach(([num, total, id]) => {
  const { Trophy } = freshSandbox();
  const resultsNeg = [mkR(1, { points: Math.max(0, total - 1) })];
  const ctxNeg = baseCtx({ isNormalClear: false, gameOver: false, results: resultsNeg });
  check(`#${num} 未達成(クリアもゲームオーバーもしていない場合は判定しない)`, !awarded(Trophy, ctxNeg).includes(id));

  const ctxNegWrongTotal = baseCtx({ isNormalClear: true, results: [mkR(1, { points: total - 1 })] });
  check(`#${num} 未達成(得点が条件と異なる)`, !awarded(Trophy, ctxNegWrongTotal).includes(id));

  const ctxPos = baseCtx({ isNormalClear: true, results: [mkR(1, { points: total })] });
  check(`#${num} 達成(クリア時に合計得点が条件を満たす)`, awarded(Trophy, ctxPos).includes(id));
});

// #201 素数の孤独: 専用(合計が素数かどうか)
{
  const { Trophy } = freshSandbox();
  const ctxNeg = baseCtx({ isNormalClear: true, results: [mkR(1, { points: 1000 })] }); // 1000は素数ではない
  check("#201 未達成(合計1000は素数ではない)", !awarded(Trophy, ctxNeg).includes("trophy_201"));
  const ctxPos = baseCtx({ isNormalClear: true, results: [mkR(1, { points: 997 })] }); // 997は素数
  check("#201 達成(合計997は素数)", awarded(Trophy, ctxPos).includes("trophy_201"));
}

// #204 奇跡の一致: ローカル日付のMMDDと一致
{
  const { Trophy } = freshSandbox();
  const now = new Date();
  const mmdd = (now.getMonth() + 1) * 100 + now.getDate();
  const ctxNeg = baseCtx({ isNormalClear: true, results: [mkR(1, { points: (mmdd + 1) % 10000 === mmdd ? mmdd + 2 : mmdd + 1 })] });
  check("#204 未達成(下4桁が今日の日付と異なる)", !awarded(Trophy, ctxNeg).includes("trophy_204"));
  const ctxPos = baseCtx({ isNormalClear: true, results: [mkR(1, { points: mmdd })] });
  check("#204 達成(下4桁が今日の日付と一致)", awarded(Trophy, ctxPos).includes("trophy_204"));
}

// #207 マラソンマン: 下5桁42195、または下4桁4219のいずれか
{
  const { Trophy } = freshSandbox();
  const ctxNeg = baseCtx({ isNormalClear: true, results: [mkR(1, { points: 4218 })] });
  check("#207 未達成", !awarded(Trophy, ctxNeg).includes("trophy_207"));
  const { Trophy: T2 } = freshSandbox();
  const ctxPos1 = baseCtx({ isNormalClear: true, results: [mkR(1, { points: 4219 })] });
  check("#207 達成(下4桁4219)", awarded(T2, ctxPos1).includes("trophy_207"));
}

// ==========================================================
// #229〜249: プレイ中の正解・時間・連続記録系(21件)
// ==========================================================

// #229 エンペラータイム: 3問連続1000点
{
  const { Trophy } = freshSandbox();
  const ctxNeg = baseCtx({ results: [mkR(1, { points: 1000 }), mkR(2, { points: 999 }), mkR(3, { points: 1000 })] });
  check("#229 未達成(連続が途切れる)", !awarded(Trophy, ctxNeg).includes("trophy_229"));
  const ctxPos = baseCtx({ results: [mkR(1, { points: 1000 }), mkR(2, { points: 1000 }), mkR(3, { points: 1000 })] });
  check("#229 達成(3問連続1000点)", awarded(Trophy, ctxPos).includes("trophy_229"));
}

// #230 閃光のように: 残り時間0<secondsLeft<=0.5で正解
{
  const { Trophy } = freshSandbox();
  const ctxNeg = baseCtx({ results: [mkR(1, { secondsLeft: 0.6 })] });
  check("#230 未達成(残り0.6秒)", !awarded(Trophy, ctxNeg).includes("trophy_230"));
  const ctxPos = baseCtx({ results: [mkR(1, { secondsLeft: 0.3 })] });
  check("#230 達成(残り0.3秒で正解)", awarded(Trophy, ctxPos).includes("trophy_230"));
}

// #231 最速最強: 5問連続、初回正解かつ5秒以内
{
  const { Trophy } = freshSandbox();
  const resultsNeg = [1, 2, 3, 4, 5].map((n) => mkR(n, { elapsedSeconds: n === 3 ? 6 : 1 }));
  check("#231 未達成(1問だけ6秒)", !awarded(Trophy, baseCtx({ results: resultsNeg })).includes("trophy_231"));
  const resultsPos = [1, 2, 3, 4, 5].map((n) => mkR(n, { elapsedSeconds: 5 }));
  check("#231 達成(5問連続5秒以内)", awarded(Trophy, baseCtx({ results: resultsPos })).includes("trophy_231"));
}

// #232 WWL: ノーミスで異なる20か国正解
{
  const { Trophy } = freshSandbox();
  const results19 = Array.from({ length: 19 }, (_, i) => mkR(i + 1, { countryId: "c" + i }));
  check("#232 未達成(19か国)", !awarded(Trophy, baseCtx({ noMistakes: true, results: results19 })).includes("trophy_232"));
  const { Trophy: T2 } = freshSandbox();
  const results20 = Array.from({ length: 20 }, (_, i) => mkR(i + 1, { countryId: "c" + i }));
  check("#232 未達成(20か国だがノーミスではない)", !awarded(T2, baseCtx({ noMistakes: false, results: results20 })).includes("trophy_232"));
  const { Trophy: T3 } = freshSandbox();
  check("#232 達成(ノーミスで20か国)", awarded(T3, baseCtx({ noMistakes: true, results: results20 })).includes("trophy_232"));
}

// #233 そして伝説へ…: 通常30問コース全30問ノーミス正解
{
  const { Trophy } = freshSandbox();
  const results30 = Array.from({ length: 30 }, (_, i) => mkR(i + 1));
  check("#233 未達成(PRO)", !awarded(Trophy, baseCtx({ difficultyId: "pro", target: 30, isNormalClear: true, noMistakes: true, results: results30 })).includes("trophy_233"));
  const { Trophy: T2 } = freshSandbox();
  check("#233 未達成(ノーミスでない)", !awarded(T2, baseCtx({ difficultyId: "advanced", target: 30, isNormalClear: true, noMistakes: false, results: results30 })).includes("trophy_233"));
  const { Trophy: T3 } = freshSandbox();
  check("#233 達成(通常30問を全てノーミス正解)", awarded(T3, baseCtx({ difficultyId: "advanced", target: 30, isNormalClear: true, noMistakes: true, results: results30 })).includes("trophy_233"));
}

// #234 遥かなる時の彼方へ: PROで100問連続正解
{
  const { Trophy } = freshSandbox();
  check("#234 未達成(99連続)", !awarded(Trophy, baseCtx({ difficultyId: "pro", maxStreak: 99 })).includes("trophy_234"));
  const { Trophy: T2 } = freshSandbox();
  check("#234 達成(PROで100連続)", awarded(T2, baseCtx({ difficultyId: "pro", maxStreak: 100 })).includes("trophy_234"));
}

// #235 やきとり: 正解0のままゲームオーバー
{
  const { Trophy } = freshSandbox();
  check("#235 未達成(1問正解してからゲームオーバー)", !awarded(Trophy, baseCtx({ gameOver: true, correctCount: 1 })).includes("trophy_235"));
  const { Trophy: T2 } = freshSandbox();
  check("#235 達成(1問も正解せずゲームオーバー)", awarded(T2, baseCtx({ gameOver: true, correctCount: 0 })).includes("trophy_235"));
}

// #236 ハットトリック: 3問連続900〜999点
{
  const { Trophy } = freshSandbox();
  const resultsNeg = [mkR(1, { points: 900 }), mkR(2, { points: 1000 }), mkR(3, { points: 950 })];
  check("#236 未達成", !awarded(Trophy, baseCtx({ results: resultsNeg })).includes("trophy_236"));
  const resultsPos = [mkR(1, { points: 900 }), mkR(2, { points: 950 }), mkR(3, { points: 999 })];
  check("#236 達成(3問連続900〜999点)", awarded(Trophy, baseCtx({ results: resultsPos })).includes("trophy_236"));
}

// #237 ロスタイムの奇跡: 残り2秒以下の正解を3回
{
  const { Trophy } = freshSandbox();
  const resultsNeg = [mkR(1, { secondsLeft: 2 }), mkR(2, { secondsLeft: 1.5 })];
  check("#237 未達成(2回)", !awarded(Trophy, baseCtx({ results: resultsNeg })).includes("trophy_237"));
  const resultsPos = [mkR(1, { secondsLeft: 2 }), mkR(2, { secondsLeft: 1.5 }), mkR(3, { secondsLeft: 0.1 }), mkR(4, { secondsLeft: 10 })];
  check("#237 達成(3回経験)", awarded(Trophy, baseCtx({ results: resultsPos })).includes("trophy_237"));
}

// #238 サイクルヒット: 1000/900台/800台/700台を各1回
{
  const { Trophy } = freshSandbox();
  const resultsNeg = [mkR(1, { points: 1000 }), mkR(2, { points: 950 }), mkR(3, { points: 850 })]; // 700台が無い
  check("#238 未達成(700台が無い)", !awarded(Trophy, baseCtx({ results: resultsNeg })).includes("trophy_238"));
  const resultsPos = [mkR(1, { points: 1000 }), mkR(2, { points: 950 }), mkR(3, { points: 850 }), mkR(4, { points: 750 })];
  check("#238 達成(4段階すべて獲得)", awarded(Trophy, baseCtx({ results: resultsPos })).includes("trophy_238"));
}

// #239 ボレロ: 5問連続で得点が厳密に上昇し、5問目940以上
{
  const { Trophy } = freshSandbox();
  const resultsNeg = [100, 200, 300, 400, 500].map((p, i) => mkR(i + 1, { points: p })); // 5問目が940未満
  check("#239 未達成(5問目が940未満)", !awarded(Trophy, baseCtx({ results: resultsNeg })).includes("trophy_239"));
  const { Trophy: T2 } = freshSandbox();
  const resultsNeg2 = [500, 400, 600, 700, 950].map((p, i) => mkR(i + 1, { points: p })); // 単調増加していない
  check("#239 未達成(単調増加していない)", !awarded(T2, baseCtx({ results: resultsNeg2 })).includes("trophy_239"));
  const { Trophy: T3 } = freshSandbox();
  const resultsPos = [100, 300, 500, 700, 940].map((p, i) => mkR(i + 1, { points: p }));
  check("#239 達成(5問連続上昇、5問目940以上)", awarded(T3, baseCtx({ results: resultsPos })).includes("trophy_239"));
}

// #240 ロット乱し: 5問連続、各問残り3秒以下で正解
{
  const { Trophy } = freshSandbox();
  const resultsNeg = [1, 2, 3, 4, 5].map((n) => mkR(n, { secondsLeft: n === 2 ? 4 : 2 }));
  check("#240 未達成", !awarded(Trophy, baseCtx({ results: resultsNeg })).includes("trophy_240"));
  const resultsPos = [1, 2, 3, 4, 5].map((n) => mkR(n, { secondsLeft: 3 }));
  check("#240 達成(5問連続残り3秒以下)", awarded(Trophy, baseCtx({ results: resultsPos })).includes("trophy_240"));
}

// #241 罪と罰: 誤答・パス・時間切れを各1回、3種類目でゲームオーバー
{
  const { Trophy } = freshSandbox();
  const mistakesNeg = [mkMistake(1, 1, "c1", "wrong", 4), mkMistake(2, 2, "c2", "pass", 3)]; // 2種類のみ
  check("#241 未達成(2種類のみ経験)", !awarded(Trophy, baseCtx({ gameOver: true, mistakeEvents: mistakesNeg })).includes("trophy_241"));
  const { Trophy: T2 } = freshSandbox();
  const mistakesNeg2 = [mkMistake(1, 1, "c1", "wrong", 2), mkMistake(2, 2, "c2", "pass", 1), mkMistake(3, 3, "c3", "wrong", 0)]; // 3件目が既存kind
  check("#241 未達成(3件目が新しい種類ではない)", !awarded(T2, baseCtx({ gameOver: true, mistakeEvents: mistakesNeg2 })).includes("trophy_241"));
  const { Trophy: T3 } = freshSandbox();
  const mistakesPos = [mkMistake(1, 1, "c1", "wrong", 2), mkMistake(2, 2, "c2", "pass", 1), mkMistake(3, 3, "c3", "timeout", 0)];
  check("#241 達成(誤答→パス→時間切れでゲームオーバー)", awarded(T3, baseCtx({ gameOver: true, mistakeEvents: mistakesPos })).includes("trophy_241"));
}

// #242 ギルティ: 4問連続、各問の初回回答が誤答(再挑戦後の正解は許容)
{
  const { Trophy } = freshSandbox();
  const resultsNeg = [mkR(1, { wrongAttempts: 1 }), mkR(2, { wrongAttempts: 0 }), mkR(3, { wrongAttempts: 1 }), mkR(4, { wrongAttempts: 1 })];
  check("#242 未達成(2問目が初回正解)", !awarded(Trophy, baseCtx({ results: resultsNeg })).includes("trophy_242"));
  const resultsPos = [mkR(1, { wrongAttempts: 1, result: "correct" }), mkR(2, { wrongAttempts: 2, result: "correct" }), mkR(3, { wrongAttempts: 1, result: "wrong" }), mkR(4, { wrongAttempts: 1, result: "correct" })];
  check("#242 達成(4問連続、各問初回誤答)", awarded(Trophy, baseCtx({ results: resultsPos })).includes("trophy_242"));
}

// #243 サバイバー: ライフ1になった後、5問連続で初回正解
{
  const { Trophy } = freshSandbox();
  const results = Array.from({ length: 8 }, (_, i) => mkR(i + 1));
  check("#243 未達成(lifeAtOneMomentが無い)", !awarded(Trophy, baseCtx({ lifeAtOneMoment: null, results })).includes("trophy_243"));
  const { Trophy: T2 } = freshSandbox();
  const resultsNeg = Array.from({ length: 8 }, (_, i) => mkR(i + 1, { firstTryCorrect: i === 5 ? false : true }));
  check("#243 未達成(ライフ1になった後5問中1問が初回正解ではない)", !awarded(T2, baseCtx({ lifeAtOneMoment: { questionNumber: 3, countryId: "c3" }, results: resultsNeg })).includes("trophy_243"));
  const { Trophy: T3 } = freshSandbox();
  const resultsPos = Array.from({ length: 8 }, (_, i) => mkR(i + 1));
  check("#243 達成(ライフ1になった後5問連続初回正解)", awarded(T3, baseCtx({ lifeAtOneMoment: { questionNumber: 3, countryId: "c3" }, results: resultsPos })).includes("trophy_243"));
}

// #244 神々のトライフォース: 初中上級の各30問コースを全てノーミスクリア(ストレージ依存)
{
  const { Trophy, Storage } = freshSandbox();
  check("#244 未達成(1コースのみノーミスクリア)", (() => {
    Storage.markFindCountryCourseNoMissCleared("beginner_30");
    return !awarded(Trophy, baseCtx()).includes("trophy_244");
  })());
  Storage.markFindCountryCourseNoMissCleared("intermediate_30");
  Storage.markFindCountryCourseNoMissCleared("advanced_30");
  check("#244 達成(初中上級30問を全てノーミスクリア)", awarded(Trophy, baseCtx()).includes("trophy_244"));
}

// #245 ナイツオブラウンド: 13問連続、初回正解かつ8秒以内
{
  const { Trophy } = freshSandbox();
  const resultsNeg = Array.from({ length: 13 }, (_, i) => mkR(i + 1, { elapsedSeconds: i === 7 ? 9 : 1 }));
  check("#245 未達成(1問だけ9秒)", !awarded(Trophy, baseCtx({ results: resultsNeg })).includes("trophy_245"));
  const resultsPos = Array.from({ length: 13 }, (_, i) => mkR(i + 1, { elapsedSeconds: 8 }));
  check("#245 達成(13問連続初回正解かつ8秒以内)", awarded(Trophy, baseCtx({ results: resultsPos })).includes("trophy_245"));
}

// #246 光と闇: 1000点と200点未満の正解をそれぞれ1回以上
{
  const { Trophy } = freshSandbox();
  const resultsNeg = [mkR(1, { points: 1000 }), mkR(2, { points: 500 })];
  check("#246 未達成(200点未満が無い)", !awarded(Trophy, baseCtx({ results: resultsNeg })).includes("trophy_246"));
  const resultsPos = [mkR(1, { points: 1000 }), mkR(2, { points: 199 })];
  check("#246 達成(1000点と200点未満の両方)", awarded(Trophy, baseCtx({ results: resultsPos })).includes("trophy_246"));
}

// #247 ミッション・インポッシブル: ライフ1後10問連続初回正解
{
  const { Trophy } = freshSandbox();
  const resultsNeg = Array.from({ length: 10 }, (_, i) => mkR(i + 1));
  check("#247 未達成(9問しか続かない設定)", !awarded(Trophy, baseCtx({ lifeAtOneMoment: { questionNumber: 2, countryId: "c2" }, results: resultsNeg.slice(0, 9) })).includes("trophy_247"));
  const { Trophy: T2 } = freshSandbox();
  const resultsPos = Array.from({ length: 11 }, (_, i) => mkR(i + 1));
  check("#247 達成(ライフ1後10問連続初回正解)", awarded(T2, baseCtx({ lifeAtOneMoment: { questionNumber: 1, countryId: "c1" }, results: resultsPos })).includes("trophy_247"));
}

// #248 伝説の始まり: PROで50問連続正解
{
  const { Trophy } = freshSandbox();
  check("#248 未達成(49連続)", !awarded(Trophy, baseCtx({ difficultyId: "pro", maxStreak: 49 })).includes("trophy_248"));
  const { Trophy: T2 } = freshSandbox();
  check("#248 達成(PROで50連続)", awarded(T2, baseCtx({ difficultyId: "pro", maxStreak: 50 })).includes("trophy_248"));
}

// #249 チート疑惑: ノーミスクリアかつ全問1000点(PRO完全クリアも対象)
{
  const { Trophy } = freshSandbox();
  check("#249 未達成(perfectClearがfalse)", !awarded(Trophy, baseCtx({ perfectClear: false })).includes("trophy_249"));
  const { Trophy: T2 } = freshSandbox();
  check("#249 達成(perfectClearがtrue)", awarded(T2, baseCtx({ perfectClear: true })).includes("trophy_249"));
}

// ==========================================================
// #250〜255: 国の組み合わせ系(6件)
// ==========================================================
const comboCases = [
  [250, ["au", "fr", "gb", "us"], "trophy_250"],
  [251, ["pt", "es", "nl", "gb"], "trophy_251"],
  [252, ["us", "ru"], "trophy_252"],
  [253, ["tr", "gr", "ir", "eg"], "trophy_253"],
  [254, ["es", "mx", "pe", "ph"], "trophy_254"],
  [255, ["eg", "iq", "in", "cn"], "trophy_255"],
];
comboCases.forEach(([num, ids, id]) => {
  const { Trophy } = freshSandbox();
  const partial = ids.slice(0, ids.length - 1).map((cid, i) => mkR(i + 1, { countryId: cid }));
  check(`#${num} 未達成(1か国不足)`, !awarded(Trophy, baseCtx({ results: partial })).includes(id));

  const { Trophy: T2 } = freshSandbox();
  const full = ids.map((cid, i) => mkR(i + 1, { countryId: cid }));
  check(`#${num} 達成(対象国を全て正解)`, awarded(T2, baseCtx({ results: full })).includes(id));

  // 順序は問わず、途中のミスも許容する(誤答が混在していても正解した国だけ見る)
  const { Trophy: T3 } = freshSandbox();
  const shuffledWithMistakes = ids.slice().reverse().map((cid, i) => mkR(i + 1, { countryId: cid }))
    .concat([mkR(ids.length + 1, { result: "wrong", countryId: "zz" })]);
  check(`#${num} 達成(順序が逆でも誤答が混在していても成立する)`, awarded(T3, baseCtx({ results: shuffledWithMistakes })).includes(id));
});

// ==========================================================
// アーキテクチャ確認: 新61種類が既存の呼び出し経路に混入しないこと
// ==========================================================
{
  const { Trophy } = freshSandbox();
  const results3x1000 = [mkR(1, { points: 1000 }), mkR(2, { points: 1000 }), mkR(3, { points: 1000 })];
  const ctx = baseCtx({ isNormalClear: true, results: results3x1000 });
  const rOld = Trophy.evaluateFindCountryResult(ctx);
  check("既存のevaluateFindCountryResult()は新61種類を一切awardedIdsに含まない", !rOld.awardedIds.some((id) => {
    const def = Trophy.getDefinition(id);
    return def && def.number >= 195 && def.number <= 255;
  }));
  check("既存のevaluateFindCountryResult()はhiddenAwardedIdsも常に空", rOld.hiddenAwardedIds.length === 0);

  const { Trophy: T2 } = freshSandbox();
  const rHidden = T2.evaluateFindCountryHiddenProgress(ctx);
  check("evaluateFindCountryHiddenProgress()のawardedIdsは常に空(通知経路に混入しない)", rHidden.awardedIds.length === 0);
  check("evaluateFindCountryHiddenProgress()は新61種類だけをhiddenAwardedIdsに入れる", rHidden.hiddenAwardedIds.every((id) => {
    const def = T2.getDefinition(id);
    return def && def.number >= 195 && def.number <= 255;
  }));
}

// ==========================================================
// 重複保存されないこと・同時複数獲得できることの確認
// ==========================================================
{
  const { Trophy } = freshSandbox();
  const ctx = baseCtx({ isNormalClear: true, results: [mkR(1, { points: 7777 })] });
  const r1 = awarded(Trophy, ctx);
  check("#195運命の数字: 1回目で獲得できる", r1.includes("trophy_195"));
  const r2 = awarded(Trophy, ctx);
  check("#195運命の数字: 2回目は重複して獲得されない(awardedIdsに含まれない)", !r2.includes("trophy_195"));
  check("#195運命の数字: isEarnedが獲得済みを正しく返す", Trophy.isEarned("trophy_195") === true);
}
{
  // 複数トロフィーを同時に獲得できる(例: #229エンペラータイム+#197悪魔の契約相当の下3桁666は
  // 1000点固定のため666にならないため、別の組み合わせで確認する: #229(3連続1000点)と
  // #232(ノーミス20か国)が同一のresultsから同時に成立し得ることを確認する)
  const { Trophy } = freshSandbox();
  const results = Array.from({ length: 20 }, (_, i) => mkR(i + 1, { countryId: "c" + i, points: 1000 }));
  const ids = awarded(Trophy, baseCtx({ noMistakes: true, results }));
  check("複数トロフィーを同時に獲得できる(#229と#232が同時に成立)", ids.includes("trophy_229") && ids.includes("trophy_232"));
}

console.log(`\nTotal: ${pass + fail}, Pass: ${pass}, Fail: ${fail}`);
process.exit(fail > 0 ? 1 : 0);
