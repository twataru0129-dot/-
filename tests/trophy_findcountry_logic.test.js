// ==========================================================
// 「世界の国どこかな？」専用トロフィー36種類(#159〜194)のロジック層テスト。
// js/storage.js・js/trophy.jsをNodeのvmモジュールでロードし(DOM不要)、
// 実際の判定関数(evaluateFindCountryResult/evaluateFindCountryAnswer)を
// 合成したcontextで直接呼んで検証する。findcountry.js自身が組み立てる
// resultsの形([{result,firstTryCorrect,elapsedSeconds,secondsLeft,
// livesAfter,countryId}, ...])と同じ形を手で組み立てて渡す。
// 依存パッケージ不要(node tests/trophy_findcountry_logic.test.js で実行)。
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
  code += "\nvar __exports__ = { TrophyModule: TrophyModule, Storage: Storage, COUNTRIES: COUNTRIES, MAP_ONLY_REGIONS: MAP_ONLY_REGIONS };";
  vm.runInContext(code, sandbox, { filename: "bundle.js" });
  return {
    assertFailures,
    Trophy: sandbox.__exports__.TrophyModule,
    Storage: sandbox.__exports__.Storage,
    COUNTRIES: sandbox.__exports__.COUNTRIES,
    MAP_ONLY_REGIONS: sandbox.__exports__.MAP_ONLY_REGIONS,
  };
}

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass += 1; } else { fail += 1; console.log("FAIL:", name); }
}

// 既存のfindcountry.jsと同じ形の「初回正解」の1件を作る
function ok(countryId, opts) {
  opts = opts || {};
  return {
    questionNumber: opts.questionNumber || 1,
    countryId,
    answeredId: countryId,
    result: "correct",
    firstTryCorrect: opts.firstTryCorrect !== false,
    elapsedSeconds: opts.elapsedSeconds !== undefined ? opts.elapsedSeconds : 1,
    secondsLeft: opts.secondsLeft !== undefined ? opts.secondsLeft : 10,
    points: 1000,
    livesAfter: opts.livesAfter !== undefined ? opts.livesAfter : 5,
    streakAfter: opts.streakAfter !== undefined ? opts.streakAfter : 1,
  };
}
function miss(kind, opts) {
  opts = opts || {};
  return {
    questionNumber: opts.questionNumber || 1,
    countryId: opts.countryId || "zz",
    answeredId: opts.answeredId || null,
    result: kind, // "wrong" | "pass" | "timeout"
    firstTryCorrect: false,
    elapsedSeconds: opts.elapsedSeconds !== undefined ? opts.elapsedSeconds : 5,
    secondsLeft: opts.secondsLeft !== undefined ? opts.secondsLeft : 0,
    points: 0,
    livesAfter: opts.livesAfter !== undefined ? opts.livesAfter : 4,
    streakAfter: 0,
  };
}

// ---- 自己検証(js/trophy.js内のconsole.assert)が0件であること ----
{
  const { assertFailures } = freshSandbox();
  if (assertFailures.length) console.log("self-validation failures:", assertFailures);
  check("trophy.js self-validation has zero failures", assertFailures.length === 0);
}

// ---- 10-1: 定義テスト ----
{
  const { Trophy } = freshSandbox();
  const defs = Trophy.getAllDefinitions();
  check("total trophies = 189", defs.length === 189);
  const cats = Trophy.getCategories();
  check("category count = 10", cats.length === 10);
  check("findcountry category exists", cats.some((c) => c.id === "findcountry"));
  const fcDefs = defs.filter((d) => d.number >= 159 && d.number <= 194);
  check("findcountry defs count = 36", fcDefs.length === 36);
  check("no duplicate ids among 36", new Set(fcDefs.map((d) => d.id)).size === 36);
  check("rarity split 14/12/10", fcDefs.filter((d) => d.rarity === "normal").length === 14
    && fcDefs.filter((d) => d.rarity === "rare").length === 12
    && fcDefs.filter((d) => d.rarity === "super_rare").length === 10);
  check("all 36 have name+condition", fcDefs.every((d) => typeof d.name === "string" && d.name && typeof d.condition === "string" && d.condition));
  check("all 36 are not hidden", fcDefs.every((d) => d.hidden === false));
  check("#194 name is 新世界の神", defs.find((d) => d.number === 194).name === "新世界の神");
  check("hidden trophy count stays 14 (unchanged)", defs.filter((d) => d.hidden).length === 14);
}

// ---- 10-2: 通常モード系(course clear / no-miss) ----
{
  const { Trophy, Storage } = freshSandbox();
  // beginner_5クリア => No.160(159+1)
  Storage.markFindCountryCourseCleared("beginner_5");
  let r = Trophy.evaluateFindCountryResult({ difficultyId: "beginner", results: [] });
  check("No.160 awarded on beginner_5 cleared (retroactive from storage)", r.awardedIds.includes("trophy_160"));
  check("No.160 is earned", Trophy.isEarned("trophy_160"));
}
{
  const { Trophy, Storage } = freshSandbox();
  ["beginner_5", "beginner_10", "beginner_20", "beginner_30"].forEach((k) => Storage.markFindCountryCourseCleared(k));
  const r = Trophy.evaluateFindCountryResult({ difficultyId: "beginner", results: [] });
  check("No.173 (beginner complete) awarded when all 4 beginner courses cleared", r.awardedIds.includes("trophy_173"));
}
{
  const { Trophy } = freshSandbox();
  // パーフェクトナビ: 20問ノーミスクリア
  const results = Array.from({ length: 20 }, (_, i) => ok("id" + i, { questionNumber: i + 1 }));
  const r = Trophy.evaluateFindCountryResult({
    difficultyId: "intermediate", target: 20, isNormalClear: true, noMistakes: true, maxStreak: 20, results,
  });
  check("No.176 (perfect 20) awarded", r.awardedIds.includes("trophy_176"));
}
{
  const { Trophy } = freshSandbox();
  const results = Array.from({ length: 20 }, (_, i) => ok("id" + i, { questionNumber: i + 1 }));
  // ノーミスでないため獲得しないこと
  const r = Trophy.evaluateFindCountryResult({
    difficultyId: "intermediate", target: 20, isNormalClear: true, noMistakes: false, maxStreak: 20, results,
  });
  check("No.176 NOT awarded when noMistakes=false", !r.awardedIds.includes("trophy_176"));
}
{
  const { Trophy } = freshSandbox();
  const results = Array.from({ length: 30 }, (_, i) => ok("id" + i, { questionNumber: i + 1 }));
  const r = Trophy.evaluateFindCountryResult({
    difficultyId: "advanced", target: 30, isNormalClear: true, noMistakes: true, maxStreak: 30, results,
  });
  check("No.177 (advanced 30 no-miss) awarded", r.awardedIds.includes("trophy_177"));
}

// ---- 10-27: 地球の支配者(12コース全てノーミス) ----
{
  const { Trophy, Storage } = freshSandbox();
  const keys = [
    "beginner_5", "beginner_10", "beginner_20", "beginner_30",
    "intermediate_5", "intermediate_10", "intermediate_20", "intermediate_30",
    "advanced_5", "advanced_10", "advanced_20", "advanced_30",
  ];
  keys.slice(0, 11).forEach((k) => Storage.markFindCountryCourseNoMissCleared(k));
  let r = Trophy.evaluateFindCountryResult({ difficultyId: "advanced", results: [] });
  check("No.185 NOT awarded with 11/12 no-miss courses", !r.awardedIds.includes("trophy_185"));
  Storage.markFindCountryCourseNoMissCleared(keys[11]);
  r = Trophy.evaluateFindCountryResult({ difficultyId: "advanced", results: [] });
  check("No.185 awarded with 12/12 no-miss courses", r.awardedIds.includes("trophy_185"));
}

// ---- 10-3: 回答速度系 ----
{
  const { Trophy } = freshSandbox();
  // 10問連続、各10秒以内 => No.178。途中1問だけ11秒(リセット)で不成立
  const results = Array.from({ length: 10 }, (_, i) => ok("id" + i, { questionNumber: i + 1, elapsedSeconds: i === 4 ? 11 : 5 }));
  const r1 = Trophy.evaluateFindCountryResult({ difficultyId: "beginner", results });
  check("No.178 NOT awarded when one question exceeds 10s (streak resets)", !r1.awardedIds.includes("trophy_178"));

  const results2 = Array.from({ length: 10 }, (_, i) => ok("id" + i, { questionNumber: i + 1, elapsedSeconds: 10 }));
  const r2 = Trophy.evaluateFindCountryResult({ difficultyId: "beginner", results: results2 });
  check("No.178 awarded when exactly 10.0s boundary for all 10", r2.awardedIds.includes("trophy_178"));
}
{
  const { Trophy } = freshSandbox();
  // 奇跡の16連撃: PRO, 16問連続各8秒以内
  const results = Array.from({ length: 16 }, (_, i) => ok("id" + i, { questionNumber: i + 1, elapsedSeconds: 8 }));
  const r = Trophy.evaluateFindCountryResult({ difficultyId: "pro", results });
  check("No.193 awarded for 16-streak each <=8s in PRO", r.awardedIds.includes("trophy_193"));
  const results15 = Array.from({ length: 15 }, (_, i) => ok("id" + i, { questionNumber: i + 1, elapsedSeconds: 8 }));
  const r2 = Trophy.evaluateFindCountryResult({ difficultyId: "pro", results: results15 });
  check("No.193 NOT awarded with only 15-streak", !r2.awardedIds.includes("trophy_193"));
}
{
  const { Trophy } = freshSandbox();
  // ラスト1秒の奇跡: secondsLeftが0<secondsLeft<1
  const results = [ok("jp", { secondsLeft: 0.5 })];
  const r = Trophy.evaluateFindCountryResult({ difficultyId: "beginner", results });
  check("No.188 awarded when secondsLeft is 0.5", r.awardedIds.includes("trophy_188"));

  const resultsExactly1 = [ok("jp", { secondsLeft: 1.0 })];
  const r2 = Trophy.evaluateFindCountryResult({ difficultyId: "beginner", results: resultsExactly1 });
  check("No.188 NOT awarded when secondsLeft is exactly 1.0", !r2.awardedIds.includes("trophy_188"));

  const resultsZero = [ok("jp", { secondsLeft: 0 })];
  const r3 = Trophy.evaluateFindCountryResult({ difficultyId: "beginner", results: resultsZero });
  check("No.188 NOT awarded when secondsLeft is 0 (timeout boundary)", !r3.awardedIds.includes("trophy_188"));

  // PROは対象外
  const resultsPro = [ok("jp", { secondsLeft: 0.5 })];
  const r4 = Trophy.evaluateFindCountryResult({ difficultyId: "pro", results: resultsPro });
  check("No.188 NOT awarded in PRO mode", !r4.awardedIds.includes("trophy_188"));
}

// ---- 10-4: 特別トロフィー ----
{
  const { Trophy } = freshSandbox();
  // 不死鳥の逆転劇: 第10問までに累計2ミス、11問目から30問目まで全て初回正解
  const results = [];
  for (let i = 1; i <= 8; i++) results.push(ok("id" + i, { questionNumber: i, livesAfter: 5 }));
  results.push(miss("wrong", { questionNumber: 9, livesAfter: 4 }));
  results.push(miss("wrong", { questionNumber: 10, livesAfter: 3 }));
  for (let i = 11; i <= 30; i++) results.push(ok("id" + i, { questionNumber: i, livesAfter: 3 }));
  const r = Trophy.evaluateFindCountryResult({
    difficultyId: "advanced", target: 30, maxLives: 5, isNormalClear: true, results,
  });
  check("No.187 (phoenix comeback) awarded", r.awardedIds.includes("trophy_187"));

  // 3ミス目が発生するケースは不成立
  const results2 = results.slice(0, 15).concat([miss("wrong", { questionNumber: 16, livesAfter: 2 })]).concat(
    Array.from({ length: 14 }, (_, i) => ok("id" + (17 + i), { questionNumber: 17 + i, livesAfter: 2 }))
  );
  const r2 = Trophy.evaluateFindCountryResult({
    difficultyId: "advanced", target: 30, maxLives: 5, isNormalClear: false, results: results2,
  });
  check("No.187 NOT awarded when a 3rd mistake occurs", !r2.awardedIds.includes("trophy_187"));
}
{
  const { Trophy } = freshSandbox();
  // 迷いなき一撃: advanced, zoom未使用, 10問連続初回正解
  const results = Array.from({ length: 10 }, (_, i) => ok("id" + i, { questionNumber: i + 1 }));
  const r = Trophy.evaluateFindCountryResult({ difficultyId: "advanced", zoomUsedThisPlay: false, results });
  check("No.190 awarded when no zoom used", r.awardedIds.includes("trophy_190"));
  const r2 = Trophy.evaluateFindCountryResult({ difficultyId: "advanced", zoomUsedThisPlay: true, results });
  check("No.190 NOT awarded when zoom was used", !r2.awardedIds.includes("trophy_190"));
}
{
  const { Trophy } = freshSandbox();
  // 世界一周の奇跡: 6地域それぞれ1問以上初回正解(実在idを使う)
  const results = [
    ok("jp"), // asia
    ok("fr"), // europe
    ok("eg"), // africa
    ok("ca"), // namerica
    ok("br"), // samerica
    ok("au"), // oceania
  ];
  const r = Trophy.evaluateFindCountryResult({ difficultyId: "beginner", results });
  check("No.191 (6-region sweep) awarded", r.awardedIds.includes("trophy_191"));
  const r2 = Trophy.evaluateFindCountryResult({ difficultyId: "beginner", results: results.slice(0, 5) });
  check("No.191 NOT awarded with only 5 regions", !r2.awardedIds.includes("trophy_191"));
}
{
  const { Trophy, Storage } = freshSandbox();
  // 小さな巨人: PRO専用5か国
  ["mc", "sm", "li", "nr"].forEach((id) => Storage.recordFindCountryProTinyCapture(id));
  let r = Trophy.evaluateFindCountryResult({ difficultyId: "pro", results: [] });
  check("No.189 NOT awarded with 4/5 tiny countries", !r.awardedIds.includes("trophy_189"));
  Storage.recordFindCountryProTinyCapture("tv");
  r = Trophy.evaluateFindCountryResult({ difficultyId: "pro", results: [] });
  check("No.189 awarded with 5/5 tiny countries", r.awardedIds.includes("trophy_189"));
}

// ---- 10-5: PRO216完全クリア(No.194) ----
{
  const { Trophy } = freshSandbox();
  const r = Trophy.evaluateFindCountryResult({
    difficultyId: "pro", isProComplete: true, maxStreak: 216, results: Array.from({ length: 216 }, (_, i) => ok("id" + i)),
  });
  check("No.194 (216/216 PRO complete) awarded", r.awardedIds.includes("trophy_194"));

  const r2 = Trophy.evaluateFindCountryResult({
    difficultyId: "pro", isProComplete: false, maxStreak: 215, results: Array.from({ length: 215 }, (_, i) => ok("id" + i)),
  });
  check("No.194 NOT awarded for 215/216", !r2.awardedIds.includes("trophy_194"));
}
// PROの王(30連続) / PROへの挑戦(10連続)
{
  const { Trophy } = freshSandbox();
  let r = Trophy.evaluateFindCountryResult({ difficultyId: "pro", maxStreak: 10, results: [] });
  check("No.184 (PRO 10-streak) awarded", r.awardedIds.includes("trophy_184"));
  r = Trophy.evaluateFindCountryResult({ difficultyId: "pro", maxStreak: 30, results: [] });
  check("No.192 (PRO 30-streak) awarded", r.awardedIds.includes("trophy_192"));
}

// ---- 即時付与(No.159・172)・コレクション系(No.180〜183) ----
{
  const { Trophy, Storage } = freshSandbox();
  check("No.159 NOT awarded with empty collection", !Trophy.evaluateFindCountryResult({ difficultyId: "beginner", results: [] }).awardedIds.includes("trophy_159"));
  Storage.captureFindCountryEntry("jp", new Date().toISOString());
  const r = Trophy.evaluateFindCountryAnswer({ difficultyId: "beginner" });
  check("No.159 awarded via evaluateFindCountryAnswer once collection has an entry", r.awardedIds.includes("trophy_159"));
}
{
  const { Trophy } = freshSandbox();
  const r = Trophy.evaluateFindCountryAnswer({ difficultyId: "pro", result: "correct" });
  check("No.172 awarded on first PRO correct answer event", r.awardedIds.includes("trophy_172"));
  const r2 = Trophy.evaluateFindCountryAnswer({ difficultyId: "beginner", result: "correct" });
  check("No.172 NOT awarded on non-PRO answer event", !r2.awardedIds.includes("trophy_172"));
}
{
  const { Trophy, Storage, COUNTRIES, MAP_ONLY_REGIONS } = freshSandbox();
  const allIds = COUNTRIES.concat(MAP_ONLY_REGIONS).map((c) => c.id);
  allIds.slice(0, 49).forEach((id) => Storage.captureFindCountryEntry(id, new Date().toISOString()));
  let r = Trophy.evaluateFindCountryResult({ difficultyId: "beginner", results: [] });
  check("No.180 (50 collected) NOT awarded at 49", !r.awardedIds.includes("trophy_180"));
  Storage.captureFindCountryEntry(allIds[49], new Date().toISOString());
  r = Trophy.evaluateFindCountryResult({ difficultyId: "beginner", results: [] });
  check("No.180 (50 collected) awarded at 50", r.awardedIds.includes("trophy_180"));
}
{
  const { Trophy, Storage, COUNTRIES, MAP_ONLY_REGIONS } = freshSandbox();
  // No.182: 基本198件のみ(地図専用18件を含めても198件止まりでは不成立)
  const basicIds = COUNTRIES.map((c) => c.id);
  const mapOnlyIds = MAP_ONLY_REGIONS.map((c) => c.id);
  mapOnlyIds.forEach((id) => Storage.captureFindCountryEntry(id, new Date().toISOString()));
  basicIds.slice(0, 197).forEach((id) => Storage.captureFindCountryEntry(id, new Date().toISOString()));
  let r = Trophy.evaluateFindCountryResult({ difficultyId: "beginner", results: [] });
  check("No.182 (basic 198) NOT awarded at 197/198", !r.awardedIds.includes("trophy_182"));
  check("No.183 (all 216) NOT awarded while basic incomplete", !r.awardedIds.includes("trophy_183"));
  Storage.captureFindCountryEntry(basicIds[197], new Date().toISOString());
  r = Trophy.evaluateFindCountryResult({ difficultyId: "beginner", results: [] });
  check("No.182 (basic 198) awarded at 198/198", r.awardedIds.includes("trophy_182"));
  check("No.183 (all 216) awarded once basic198+mapOnly18=216 all captured", r.awardedIds.includes("trophy_183"));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
