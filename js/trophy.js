// ==========================================================
// トロフィー刷新 第1段階+第2段階+Stage A+Stage B: 新トロフィーシステム(107項目)
//
// 目的: 既存の称号(js/quiz.jsのTITLES/CAPITAL_TITLES、国旗6件+首都6件=
// 計12件)には一切手を加えず、それとは完全に独立した新しいトロフィー
// システムの「定義・保存・読み込み・重複獲得防止」の基本機能(第1段階)に、
// 「判定エンジン・モード区別・既存データからの導出ヘルパー・実クイズへの
// 接続」(第2段階)を追加する。
//
// Stage A(docs/trophy-spec-final.md参照)で追加したこと:
// - 共通/国旗別/首都別(デュアル状態)を正しく管理できる保存基盤
//   (awardIfNew/isEarnedがmode引数を受け取れるようになった。mode省略時は
//   従来どおり単一の共通状態として扱われ、第1・第2段階の挙動は一切変わらない)
// - #101〜112を「参照型」として扱う仕組み(REFERENCE_TITLE_MAP)。これらの
//   番号は新規に書き込まれず、既存のStorage.hasTitle()/getEarnedTitles()を
//   都度参照するだけになる(二重保存の防止)
// - wfq_v1_trophy_stats(新規)の保存・読み込み・初期化処理の骨組み
//   (#58等の新しい累計カウンタ用。実際に値を書き込む判定ロジックは
//   Stage C以降で実装する。Stage Aでは入れ物だけを用意する)
// - js/storage.jsのStorage.resetAll()から呼ばれるTrophyModule.resetAll()
//   (新トロフィーの獲得記録・統計も全データリセットの対象に含める)
//
// Stage Aでも行っていないこと:
// - 107項目の名称・獲得条件・check関数の登録(Stage Bで実施)
// - 回答時間計測・国別履歴の収集ロジック(Stage D・E)
// - トロフィー一覧画面(Stage G)
//
// Stage B(docs/trophy-spec-final.md参照)で追加したこと:
// - 既存の保存データ(称号・挑戦回数・最高記録・そのプレイ自身の結果)
//   だけで判定でき、新しい統計収集・回答時間計測・プレイ開始時刻判定を
//   必要としない79項目(#1〜19、#40〜49・51〜54・59、#61・62・65・67、
//   #71〜89・91〜100、#101〜112)に、正式な名称・獲得条件・mode・check
//   関数を設定し、confirmed:trueにした(STAGE_B_DEFINITIONS参照)
// - #101〜112はStage Aで実装済みの参照型の挙動(既存称号を都度参照、
//   二重保存なし)をそのまま維持し、名称・条件・modeのみ補完した
//   (checkは今後も設定しない。getEarned/isEarned/awardIfNewが
//   referenceTitleFor()経由で別扱いするため)
// - 残り28項目(#20〜39、#58、#60、#63・64・66・68〜70)は、新規の
//   回答時間計測・国別正解履歴・開始時刻判定・新規カウンタのいずれかが
//   必要なため、Stage B時点ではまだconfirmed:falseのまま
//   (Stage C〜Fで段階的に実装する)
//
// Stage Bでも行っていないこと:
// - 新しい統計収集・回答時間計測・プレイ開始時刻の判定(Stage C〜F)
// - トロフィー専用の新しい表示画面(Stage G)
// - 国旗・首都クイズの出題・採点・ランキング、世界地図・世界図鑑・
//   「世界の国どこかな？」の既存の保存・判定ロジックの変更(一切行っていない)
//
// 第2段階で行ったこと:
// - 各スロットに mode(flag/capital/both/findcountry/null)・check(判定
//   関数、未確定の間はnull)フィールドを追加(値そのものはまだ推測しない)
// - evaluate()/evaluateQuizFinish()/evaluateFindCountryResult(): クイズ
//   結果確定後に呼ばれる汎用判定エンジン。confirmed:trueかつcheckが
//   設定されたスロットだけを対象にするため、現時点(confirmed:true が
//   1件も無い)では必ず何も獲得されない「安全な空振り」になる
// - 既存データ(称号・ランキング・コレクション)だけから導出できる判定
//   ヘルパー関数を用意(isModeTitlePerfectEarned/isBothModesTitlePerfectEarned/
//   getFindCountryRegionProgress/arePairCorrect)。どれも新しい保存領域を
//   一切追加しない読み取り専用の純粋関数
// - js/app.js(finishQuiz)・js/findcountry.js(showResult)から、結果確定後に
//   1回だけevaluateQuizFinish()/evaluateFindCountryResult()を呼ぶように
//   接続(try/catchで囲み、万一の例外でも既存のスコア・称号・ランキング・
//   画面遷移には一切影響しない)
//
// 第2段階でも行っていないこと(第2段階時点では未確定だったもの。Stage Bで
// 79項目分は解消した):
// - トロフィー専用の新しい表示画面(Stage G)
// - 「過去の誤答履歴」「国旗/首都の回答速度」「プレイ開始時刻」等、新しい
//   永続記録・新しい統合ポイントが必要な残り28項目の判定(Stage C〜F)
//
// 企画の確定仕様: 既存12項目+新規95項目の合計107項目。通し番号は
// 1〜112で、50・55・56・57・90番が欠番(112-5=107件)。名称・獲得条件は
// docs/trophy-spec-final.mdで107件すべて確定済み。Stage Bで79件分を
// name/condition/mode/check(confirmed:true)として反映し、残り28件は
// Stage C〜Fで段階的に反映する(category/hiddenは全107件とも依然未確定)。
// ==========================================================

const TrophyModule = (() => {
  // 既存のjs/storage.jsのStorageKeys/CapitalStorageKeys/FINDCOUNTRY_*とは
  // 完全に別のキーにする(既存の保存データには一切触れない)。
  // STORAGE_PREFIX・safeGet/safeSet はjs/storage.js(IIFEで囲まれていない
  // ため同じグローバルスコープを共有する既存のファイル群)で既に定義されて
  // いるものをそのまま再利用し、保存処理を複製しない。script読み込み順は
  // index.html上でjs/storage.jsの直後にしてあるため、参照時点で必ず
  // 定義済みになる。
  const TROPHY_KEY = STORAGE_PREFIX + "trophy_earned";
  const TROPHY_VERSION = 1;
  // Stage A: 新しい累計カウンタ・履歴用の保存領域(既存のTROPHY_KEYとは別の
  // 新規キー)。中身を実際に書き込む判定ロジックはStage C以降で実装する
  const TROPHY_STATS_KEY = STORAGE_PREFIX + "trophy_stats";
  const TROPHY_STATS_VERSION = 1;

  // 企画の確定仕様どおりの欠番(50・55・56・57・90)
  const SKIPPED_NUMBERS = [50, 55, 56, 57, 90];

  // #101〜112は既存12称号(js/quiz.jsのTITLES/CAPITAL_TITLES)をそのまま
  // 参照する「参照型」スロット。新規にwfq_v1_trophy_earnedへ書き込むことは
  // 一切せず、常にStorage.hasTitle()/getEarnedTitles()を都度参照する
  // (docs/trophy-spec-final.md 2章の対応表と完全に一致させる)
  const REFERENCE_TITLE_MAP = {
    101: { id: "beginner", mode: "flag" },
    102: { id: "challenger", mode: "flag" },
    103: { id: "traveler", mode: "flag" },
    104: { id: "expert", mode: "flag" },
    105: { id: "master", mode: "flag" },
    106: { id: "legend", mode: "flag" },
    107: { id: "cap_beginner", mode: "capital" },
    108: { id: "cap_challenger", mode: "capital" },
    109: { id: "cap_traveler", mode: "capital" },
    110: { id: "cap_expert", mode: "capital" },
    111: { id: "cap_master", mode: "capital" },
    112: { id: "cap_legend", mode: "capital" },
  };
  function referenceTitleFor(number) {
    return REFERENCE_TITLE_MAP[number] || null;
  }

  // ========================================================
  // Stage B: 既存の保存データ(称号・挑戦回数・最高記録・そのプレイ自身の
  // 結果)だけで判定できるトロフィーの獲得条件(docs/trophy-spec-final.md
  // 2章)。check関数はStorage/getTitleByCount等の既存APIを読み取るだけで、
  // 新しい保存領域には一切書き込まない(読み取り専用)。
  // ========================================================
  const ALL_COURSE_COUNTS = [10, 20, 30, 50, 100, 198]; // 既存6コース(#8〜19・47〜49・59用)
  const ALL_QUIZ_REGIONS = ["asia", "europe", "africa", "namerica", "samerica", "oceania"]; // #62用

  // 指定モード・指定問題数の称号(全問正解)が、指定したcounts全てで
  // 獲得済みかどうか(#15〜17・41〜49・59用)。isModeTitlePerfectEarned()
  // (第2段階で追加済みの既存ヘルパー)をそのまま複数件分呼ぶだけ
  function hasAllTitles(mode, counts) {
    return counts.every((count) => isModeTitlePerfectEarned(count, mode));
  }

  // 指定モード・指定問題数コースの過去最高正解数(#8〜14・47・48用)。
  // そのコースを1度もプレイしていない場合はnullを返す
  function bestCorrectAtCount(mode, count) {
    const rec = Storage.getBestRecords(mode)[String(count)];
    return rec && Number.isFinite(rec.correct) ? rec.correct : null;
  }

  // 指定モード・指定問題数コースの過去最高正答率(0〜1、#18・19用)。
  // そのコースを1度もプレイしていない場合はnullを返す
  function bestAccuracyAtCount(mode, count) {
    const rec = Storage.getBestRecords(mode)[String(count)];
    if (!rec || !Number.isFinite(rec.correct) || !Number.isFinite(rec.total) || rec.total <= 0) return null;
    return rec.correct / rec.total;
  }

  // 国idから地域(region)を調べる(#62用)。js/countries.jsのCOUNTRIESを
  // そのまま参照し、データを複製しない(js/storage.jsの
  // findCountryCollectionValidIds()と同じ、初回アクセス時のみキャッシュする考え方)
  let countryRegionByIdCache = null;
  function countryRegionById(id) {
    if (!countryRegionByIdCache) {
      countryRegionByIdCache = new Map();
      (typeof COUNTRIES !== "undefined" ? COUNTRIES : []).forEach((c) => countryRegionByIdCache.set(c.id, c.region));
    }
    return countryRegionByIdCache.get(id) || null;
  }

  // 「同じクイズプレイで指定した2か国が両方正解」判定(#71〜100用)の
  // check関数を作る。flagOnly指定時は国旗クイズのプレイのみを対象にする
  // (#75・86〜89「国旗限定」)。国旗/首都のどちらのクイズでも、質問の
  // idは共通してjs/countries.jsの国idのため、モードを区別せず同じロジックで
  // 判定できる(js/quiz.jsのbuildQuestionSet()参照)。「世界の国どこかな？」
  // からの呼び出し(context.source==="findcountry")は対象外にする
  // (条件が「同じ国旗・首都クイズのプレイ」を前提にしているため)
  function pairCheck(idA, idB, options) {
    const flagOnly = !!(options && options.flagOnly);
    return function (context) {
      if (!context || context.source !== "quiz") return false;
      if (flagOnly && context.mode !== "flag") return false;
      if (!Array.isArray(context.correctIds)) return false;
      return arePairCorrect(idA, idB, new Set(context.correctIds));
    };
  }

  // 番号 -> { name, condition, mode, check } (#101〜112はcheckを持たない
  // 参照型のため省略。mode凡例: "both"=国旗/首都を分離管理するデュアル状態
  // (#1〜19)、"common"=共通1個またはAND条件(#40〜70。両モードの既存データを
  // 読む場合でも単一の共通状態として管理する)、"flag_only"=国旗クイズの
  // プレイのみ対象(#75・86〜89)、"flag"/"capital"=既存称号の参照型(#101〜112))
  const STAGE_B_DEFINITIONS = {
    // ---- #1〜19: 既存データ(デュアル状態。国旗/首都を分離管理) ----
    1: { name: "はじめの一歩", condition: "初回完了", mode: "both", check: (ctx) => Storage.getAttempts(ctx.mode) >= 1 },
    2: { name: "クイズ好き", condition: "10回完了", mode: "both", check: (ctx) => Storage.getAttempts(ctx.mode) >= 10 },
    3: { name: "世界への挑戦者", condition: "30回完了", mode: "both", check: (ctx) => Storage.getAttempts(ctx.mode) >= 30 },
    4: { name: "世界を旅する人", condition: "50回完了", mode: "both", check: (ctx) => Storage.getAttempts(ctx.mode) >= 50 },
    5: { name: "百戦錬磨", condition: "100回完了", mode: "both", check: (ctx) => Storage.getAttempts(ctx.mode) >= 100 },
    6: { name: "不屈の探究者", condition: "200回完了", mode: "both", check: (ctx) => Storage.getAttempts(ctx.mode) >= 200 },
    7: { name: "伝説の挑戦者", condition: "500回完了", mode: "both", check: (ctx) => Storage.getAttempts(ctx.mode) >= 500 },
    8: {
      name: "ナイスチャレンジ", condition: "10問コースで8問以上正解(過去最高)", mode: "both",
      check: (ctx) => { const c = bestCorrectAtCount(ctx.mode, 10); return c !== null && c >= 8; },
    },
    9: {
      name: "安定の実力者", condition: "20問コースで16問以上正解(過去最高)", mode: "both",
      check: (ctx) => { const c = bestCorrectAtCount(ctx.mode, 20); return c !== null && c >= 16; },
    },
    10: {
      name: "知識の探究者", condition: "30問コースで24問以上正解(過去最高)", mode: "both",
      check: (ctx) => { const c = bestCorrectAtCount(ctx.mode, 30); return c !== null && c >= 24; },
    },
    11: {
      name: "実力派プレイヤー", condition: "50問コースで40問以上正解(過去最高)", mode: "both",
      check: (ctx) => { const c = bestCorrectAtCount(ctx.mode, 50); return c !== null && c >= 40; },
    },
    12: {
      name: "世界の優等生", condition: "100問コースで90問以上正解(過去最高)", mode: "both",
      check: (ctx) => { const c = bestCorrectAtCount(ctx.mode, 100); return c !== null && c >= 90; },
    },
    13: {
      name: "世界の知識人", condition: "198問コースで150問以上正解(過去最高)", mode: "both",
      check: (ctx) => { const c = bestCorrectAtCount(ctx.mode, 198); return c !== null && c >= 150; },
    },
    14: {
      name: "世界の達人", condition: "198問コースで190問以上正解(過去最高)", mode: "both",
      check: (ctx) => { const c = bestCorrectAtCount(ctx.mode, 198); return c !== null && c >= 190; },
    },
    15: { name: "三つ星チャレンジャー", condition: "10・20・30問コースで全問正解", mode: "both", check: (ctx) => hasAllTitles(ctx.mode, [10, 20, 30]) },
    16: { name: "五つ星マスター", condition: "10・20・30・50・100問コースで全問正解", mode: "both", check: (ctx) => hasAllTitles(ctx.mode, [10, 20, 30, 50, 100]) },
    17: { name: "完全制覇", condition: "全6コース(10・20・30・50・100・198問)で全問正解", mode: "both", check: (ctx) => hasAllTitles(ctx.mode, ALL_COURSE_COUNTS) },
    18: {
      name: "バランスの達人", condition: "全6コースの過去最高正答率が各80%以上", mode: "both",
      check: (ctx) => ALL_COURSE_COUNTS.every((count) => { const a = bestAccuracyAtCount(ctx.mode, count); return a !== null && a >= 0.8; }),
    },
    19: {
      name: "安定の世界マスター", condition: "全6コースの過去最高正答率が各90%以上", mode: "both",
      check: (ctx) => ALL_COURSE_COUNTS.every((count) => { const a = bestAccuracyAtCount(ctx.mode, count); return a !== null && a >= 0.9; }),
    },

    // ---- #40〜59: 既存データ中心(共通1個・AND条件。単一の共通状態) ----
    40: { name: "二つの扉を開く者", condition: "国旗・首都それぞれ1回以上完了", mode: "common", check: () => Storage.getAttempts("flag") >= 1 && Storage.getAttempts("capital") >= 1 },
    41: { name: "ダブルビギナー", condition: "国旗・首都10問両方満点", mode: "common", check: () => isModeTitlePerfectEarned(10, "flag") && isModeTitlePerfectEarned(10, "capital") },
    42: { name: "ダブルチャレンジャー", condition: "国旗・首都20問両方満点", mode: "common", check: () => isModeTitlePerfectEarned(20, "flag") && isModeTitlePerfectEarned(20, "capital") },
    43: { name: "ダブルトラベラー", condition: "国旗・首都30問両方満点", mode: "common", check: () => isModeTitlePerfectEarned(30, "flag") && isModeTitlePerfectEarned(30, "capital") },
    44: { name: "ダブルエキスパート", condition: "国旗・首都50問両方満点", mode: "common", check: () => isModeTitlePerfectEarned(50, "flag") && isModeTitlePerfectEarned(50, "capital") },
    45: { name: "ダブルマスター", condition: "国旗・首都100問両方満点", mode: "common", check: () => isModeTitlePerfectEarned(100, "flag") && isModeTitlePerfectEarned(100, "capital") },
    46: { name: "世界知識の王者", condition: "国旗・首都198問両方満点", mode: "common", check: () => isModeTitlePerfectEarned(198, "flag") && isModeTitlePerfectEarned(198, "capital") },
    47: {
      name: "世界を読み解く者", condition: "国旗・首都100問で各90問以上正解(過去最高)", mode: "common",
      check: () => { const f = bestCorrectAtCount("flag", 100); const c = bestCorrectAtCount("capital", 100); return f !== null && f >= 90 && c !== null && c >= 90; },
    },
    48: {
      name: "世界の知識王", condition: "国旗・首都198問で各190問以上正解(過去最高)", mode: "common",
      check: () => { const f = bestCorrectAtCount("flag", 198); const c = bestCorrectAtCount("capital", 198); return f !== null && f >= 190 && c !== null && c >= 190; },
    },
    49: { name: "究極の世界マスター", condition: "国旗・首都の全12コースで満点", mode: "common", check: () => hasAllTitles("flag", ALL_COURSE_COUNTS) && hasAllTitles("capital", ALL_COURSE_COUNTS) },
    51: { name: "知識の番人", condition: "国旗・首都それぞれ50回以上完了", mode: "common", check: () => Storage.getAttempts("flag") >= 50 && Storage.getAttempts("capital") >= 50 },
    52: { name: "表と裏の達人", condition: "国旗198問満点+首都10問満点(別プレイ可)", mode: "common", check: () => isModeTitlePerfectEarned(198, "flag") && isModeTitlePerfectEarned(10, "capital") },
    53: {
      name: "奇跡の一問", condition: "198問で197問正解", mode: "common",
      check: (ctx) => ctx.source === "quiz" && ctx.total === 198 && ctx.correct === 197,
    },
    54: {
      name: "あきらめない挑戦者", condition: "国旗・首都合算の完了回数が100回以上になったそのプレイで満点", mode: "common",
      check: (ctx) => ctx.source === "quiz" && Number.isFinite(ctx.correct) && Number.isFinite(ctx.total) && ctx.correct === ctx.total
        && (Storage.getAttempts("flag") + Storage.getAttempts("capital")) >= 100,
    },
    59: {
      name: "世界の伝説", condition: "国旗・首都の全12称号+国旗・首都それぞれ200回以上完了", mode: "common",
      check: () => hasAllTitles("flag", ALL_COURSE_COUNTS) && hasAllTitles("capital", ALL_COURSE_COUNTS)
        && Storage.getAttempts("flag") >= 200 && Storage.getAttempts("capital") >= 200,
    },

    // ---- #61・62・65・67: 既存データ(そのプレイ自身の結果のみ) ----
    61: {
      name: "ラストワンの魔法", condition: "10問で最初の9問正解・最後の1問のみ不正解", mode: "common",
      check: (ctx) => ctx.source === "quiz" && ctx.total === 10 && Array.isArray(ctx.wrongIds) && ctx.wrongIds.length === 1
        && Array.isArray(ctx.questionIds) && ctx.questionIds.length === 10
        && ctx.questionIds[ctx.questionIds.length - 1] === ctx.wrongIds[0],
    },
    62: {
      name: "虹の架け橋", condition: "1プレイで6地域すべて1問以上正解", mode: "common",
      check: (ctx) => {
        if (!ctx || ctx.source !== "quiz" || !Array.isArray(ctx.correctIds)) return false;
        const covered = new Set();
        ctx.correctIds.forEach((id) => { const r = countryRegionById(id); if (r) covered.add(r); });
        return ALL_QUIZ_REGIONS.every((r) => covered.has(r));
      },
    },
    65: { name: "奇跡の数字", condition: "198問でちょうど100問正解", mode: "common", check: (ctx) => ctx.source === "quiz" && ctx.total === 198 && ctx.correct === 100 },
    67: { name: "世界の反対側", condition: "1プレイで日本・ブラジルを正解", mode: "common", check: pairCheck("jp", "br") },

    // ---- #71〜100: 同一プレイの国ペア判定(既存データのみ) ----
    71: { name: "太陽と月の出会い", condition: "1プレイで日本・パラオを正解", mode: "common", check: pairCheck("jp", "pw") },
    72: { name: "そっくりさん発見！", condition: "1プレイでルーマニア・チャドを正解", mode: "common", check: pairCheck("ro", "td") },
    73: { name: "白と赤の双子", condition: "1プレイでインドネシア・モナコを正解", mode: "common", check: pairCheck("id", "mc") },
    74: { name: "南十字星のきずな", condition: "1プレイでオーストラリア・ニュージーランドを正解", mode: "common", check: pairCheck("au", "nz") },
    75: { name: "型破りな国旗たち", condition: "国旗クイズ1プレイでネパール・バチカン市国を正解", mode: "flag_only", check: pairCheck("np", "va", { flagOnly: true }) },
    76: { name: "島から島へ", condition: "1プレイでアイスランド・マダガスカルを正解", mode: "common", check: pairCheck("is", "mg") },
    77: { name: "南北のロングラン", condition: "1プレイでカナダ・チリを正解", mode: "common", check: pairCheck("ca", "cl") },
    78: { name: "ピラミッドの謎", condition: "1プレイでエジプト・メキシコを正解", mode: "common", check: pairCheck("eg", "mx") },
    79: { name: "火山の国を巡る", condition: "1プレイで日本・イタリアを正解", mode: "common", check: pairCheck("jp", "it") },
    80: { name: "海を越えた言葉", condition: "1プレイでブラジル・ポルトガルを正解", mode: "common", check: pairCheck("br", "pt") },
    81: { name: "巨人と小人", condition: "1プレイでロシア・バチカン市国を正解", mode: "common", check: pairCheck("ru", "va") },
    82: { name: "国の中の国", condition: "1プレイで南アフリカ・レソトを正解", mode: "common", check: pairCheck("za", "ls") },
    83: { name: "一つの半島、二つの国", condition: "1プレイで韓国・北朝鮮を正解", mode: "common", check: pairCheck("kr", "kp") },
    84: { name: "色が逆さま！", condition: "1プレイでアイルランド・コートジボワールを正解", mode: "common", check: pairCheck("ie", "ci") },
    85: { name: "三色旗の秘密", condition: "1プレイでフランス・オランダを正解", mode: "common", check: pairCheck("fr", "nl") },
    86: { name: "国旗の中に武器!?", condition: "国旗クイズ1プレイでモザンビーク・グアテマラを正解", mode: "flag_only", check: pairCheck("mz", "gt", { flagOnly: true }) },
    87: { name: "国旗の動物園", condition: "国旗クイズ1プレイでドミニカ国・ウガンダを正解", mode: "flag_only", check: pairCheck("dm", "ug", { flagOnly: true }) },
    88: { name: "国旗の中の地図", condition: "国旗クイズ1プレイでキプロス・コソボを正解", mode: "flag_only", check: pairCheck("cy", "xk", { flagOnly: true }) },
    89: { name: "国旗が語りかける", condition: "国旗クイズ1プレイでサウジアラビア・ブラジルを正解", mode: "flag_only", check: pairCheck("sa", "br", { flagOnly: true }) },
    91: { name: "左側通行の仲間", condition: "1プレイで日本・イギリスを正解", mode: "common", check: pairCheck("jp", "gb") },
    92: { name: "独立を守った国々", condition: "1プレイでエチオピア・リベリアを正解", mode: "common", check: pairCheck("et", "lr") },
    93: { name: "10億人の世界", condition: "1プレイで中国・インドを正解", mode: "common", check: pairCheck("cn", "in") },
    94: { name: "同じ言葉、遠い国", condition: "1プレイでスペイン・アルゼンチンを正解", mode: "common", check: pairCheck("es", "ar") },
    95: { name: "海を越えたフランス語", condition: "1プレイでフランス・カナダを正解", mode: "common", check: pairCheck("fr", "ca") },
    96: { name: "海まで二つの国", condition: "1プレイでウズベキスタン・リヒテンシュタインを正解", mode: "common", check: pairCheck("uz", "li") },
    97: { name: "イタリアの中の国", condition: "1プレイでイタリア・サンマリノを正解", mode: "common", check: pairCheck("it", "sm") },
    98: { name: "二つの大陸をまたぐ国", condition: "1プレイでトルコ・ロシアを正解", mode: "common", check: pairCheck("tr", "ru") },
    99: { name: "細長い国の秘密", condition: "1プレイでチリ・ノルウェーを正解", mode: "common", check: pairCheck("cl", "no") },
    100: { name: "太平洋の島々", condition: "1プレイでキリバス・フィジーを正解", mode: "common", check: pairCheck("ki", "fj") },

    // ---- #101〜112: 既存12称号の参照(Stage Aで実装済み。名称・モードのみ補完) ----
    101: { name: "国旗ビギナー", condition: "10問全問正解", mode: "flag" },
    102: { name: "国旗チャレンジャー", condition: "20問全問正解", mode: "flag" },
    103: { name: "国旗トラベラー", condition: "30問全問正解", mode: "flag" },
    104: { name: "国旗エキスパート", condition: "50問全問正解", mode: "flag" },
    105: { name: "国旗マスター", condition: "100問全問正解", mode: "flag" },
    106: { name: "国旗レジェンド", condition: "198問全問正解(WORLD COMPLETE)", mode: "flag" },
    107: { name: "首都ビギナー", condition: "10問全問正解", mode: "capital" },
    108: { name: "首都チャレンジャー", condition: "20問全問正解", mode: "capital" },
    109: { name: "世界都市トラベラー", condition: "30問全問正解", mode: "capital" },
    110: { name: "首都エキスパート", condition: "50問全問正解", mode: "capital" },
    111: { name: "首都マスター", condition: "100問全問正解", mode: "capital" },
    112: { name: "首都レジェンド", condition: "198問全問正解(WORLD CAPITAL COMPLETE)", mode: "capital" },
  };

  // TROPHIESの該当スロットにSTAGE_B_DEFINITIONSの内容を反映する。
  // 定義に無い番号(Stage C以降に回した28項目)はnull/未確定のまま変更しない
  function applyStageBDefinitions(trophies, definitions) {
    const byNumber = new Map(trophies.map((t) => [t.number, t]));
    Object.keys(definitions).forEach((key) => {
      const number = Number(key);
      const t = byNumber.get(number);
      if (!t) return; // 欠番等で実在しない番号は無視(自己検証側で別途不整合を検出する)
      const def = definitions[key];
      t.name = def.name;
      t.condition = def.condition;
      t.mode = def.mode;
      t.check = typeof def.check === "function" ? def.check : null; // #101〜112は参照型のためcheckを持たない
      t.confirmed = true;
    });
  }

  // 1〜112の通し番号から欠番を除いた107個のスロットを作る。
  // id は "trophy_<number>" で固定する(番号自体が企画側の一意な識別子の
  // ため、番号から機械的に作れるidにしておけば、後で正式な名称を
  // 当てはめる際にもidを振り直す必要がない)。
  function buildTrophyDefinitions() {
    const skipped = new Set(SKIPPED_NUMBERS);
    const list = [];
    for (let number = 1; number <= 112; number++) {
      if (skipped.has(number)) continue;
      list.push({
        number,
        id: `trophy_${number}`,
        // 正式な獲得条件が確認できていないため、推測で埋めずすべてnullのまま
        // にしておく(確定ではない名前・条件文を書かないため)。
        name: null,
        condition: null,
        category: null,
        hidden: null, // 隠しトロフィーかどうかも未確定
        // 第2段階で追加: どのモードの記録かを区別するためのフィールド。
        // "flag" | "capital" | "both"(国旗・首都両方の組合せ) |
        // "findcountry" | null(未確定)。値自体はまだ1件も確定していない
        mode: null,
        // 第2段階で追加: 実際の判定関数(confirmed:trueになって初めて
        // 設定される想定)。シグネチャは check(context) => boolean。
        // context の形は evaluate() 内のコメントを参照
        check: null,
        confirmed: false, // 正式な定義が確認できたらtrueにする
      });
    }
    return list;
  }

  const TROPHIES = buildTrophyDefinitions();
  applyStageBDefinitions(TROPHIES, STAGE_B_DEFINITIONS);
  const TROPHY_BY_ID = new Map(TROPHIES.map((t) => [t.id, t]));

  // ---------- 自己検証(既存のjs/app.js冒頭・js/findcountry.jsのvalidatePools()
  // と同じ、console.assertベースの開発時チェック。問題が無ければ何も出力しない) ----------
  (function validateTrophyDefinitions() {
    console.assert(TROPHIES.length === 107, `トロフィー定義が107件ではありません(実際: ${TROPHIES.length}件)`);
    const numbers = new Set(TROPHIES.map((t) => t.number));
    console.assert(numbers.size === TROPHIES.length, "トロフィー定義のnumberに重複があります");
    const ids = new Set(TROPHIES.map((t) => t.id));
    console.assert(ids.size === TROPHIES.length, "トロフィー定義のidに重複があります");
    SKIPPED_NUMBERS.forEach((n) => {
      console.assert(!numbers.has(n), `欠番(${n})がトロフィー定義に含まれています`);
    });
    // Stage B: STAGE_B_DEFINITIONSに列挙した件数だけがconfirmed:trueになって
    // いることを確認する(Stage C以降に回した残り28項目を誤って確定させて
    // いないか、またSTAGE_B_DEFINITIONSの反映漏れが無いかの自己チェック)
    const confirmedCount = TROPHIES.filter((t) => t.confirmed).length;
    const expectedConfirmedCount = Object.keys(STAGE_B_DEFINITIONS).length;
    console.assert(confirmedCount === expectedConfirmedCount, `Stage Bで確定したはずのトロフィー件数が一致しません(期待値: ${expectedConfirmedCount}件、実際: ${confirmedCount}件)`);
    // confirmed:trueのトロフィーは、参照型(#101〜112、checkを持たない)を
    // 除き、必ずcheck関数を持つこと(新規仕様書どおりに実装できていることの確認)
    console.assert(
      TROPHIES.every((t) => !t.confirmed || referenceTitleFor(t.number) || typeof t.check === "function"),
      "confirmed:trueなのにcheck関数が設定されていないトロフィーがあります"
    );
    // confirmed:trueのトロフィーは、必ずname/condition/modeの3項目とも
    // 設定されていること(推測で埋めていない・反映漏れが無いことの確認)
    console.assert(
      TROPHIES.every((t) => !t.confirmed || (typeof t.name === "string" && typeof t.condition === "string" && typeof t.mode === "string")),
      "confirmed:trueなのにname/condition/modeが未設定のトロフィーがあります"
    );
    // Stage A: #101〜112の参照型マップが、欠番を含まずちょうど12件で
    // TROPHIESに実在する番号だけを指していることを確認する
    const refNumbers = Object.keys(REFERENCE_TITLE_MAP).map(Number);
    console.assert(refNumbers.length === 12, `参照型トロフィーの件数が12件ではありません(実際: ${refNumbers.length}件)`);
    refNumbers.forEach((n) => {
      console.assert(numbers.has(n), `参照型トロフィー#${n}がTROPHIESに存在しません`);
    });
    // Stage A: 統計データの初期値が、自分自身のバリデータを通ることを確認する
    // (生成関数と検証関数の定義ミスによる食い違いを早期に検出するため)
    console.assert(isValidTrophyStats(emptyTrophyStats()), "emptyTrophyStats()の初期値がisValidTrophyStats()を通りません");
  })();

  function isValidTrophyId(id) {
    return typeof id === "string" && TROPHY_BY_ID.has(id);
  }

  function emptyTrophyData() {
    return { version: TROPHY_VERSION, earned: {} };
  }

  // バージョン不一致(将来の形式変更・壊れたデータ等)の場合は安全側に倒し、
  // 空データとして扱う(既存のfindcountry系ストレージ関数と同じ考え方。
  // js/storage.jsのloadFindCountryRankingData()等を参照)。
  function loadTrophyData() {
    const raw = safeGet(TROPHY_KEY);
    if (!raw) return emptyTrophyData();
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || parsed.version !== TROPHY_VERSION
        || !parsed.earned || typeof parsed.earned !== "object") {
        return emptyTrophyData();
      }
      return parsed;
    } catch (e) {
      console.warn("トロフィー獲得データの読み込みに失敗しました。保存データを初期化します", e);
      return emptyTrophyData();
    }
  }

  function saveTrophyData(data) {
    return safeSet(TROPHY_KEY, JSON.stringify(data));
  }

  // ========================================================
  // Stage A: 新しい累計カウンタ・履歴の保存領域(wfq_v1_trophy_stats)。
  // ここでは「保存・読み込み・初期化」の骨組みだけを用意し、実際に値を
  // 書き込む判定ロジック(#58の満点回数カウント等)はStage C以降で実装する。
  // 形はdocs/trophy-spec-final.md 3章の設計案に合わせてある。
  // ========================================================
  function emptyTrophyStats() {
    return {
      version: TROPHY_STATS_VERSION,
      perfectCounts: { flag: 0, capital: 0 }, // #58用
      fastAnswerCounts: { flag: {}, capital: {} }, // #21・#26・#27用
      partialStreakCounts: { flag: 0, capital: 0 }, // #60用(合算して使う想定)
      countryCorrectEver: { flag: {}, capital: {} }, // #30〜38用
      countryCorrectCount: { flag: {}, capital: {} }, // #39用
      countryWrongEver: { flag: {}, capital: {} }, // #63・#68用
      lastCourseResult: { flag: {}, capital: {} }, // #66用
    };
  }

  function isPlainObject(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }

  // バージョン不一致・壊れたデータ・旧形式のいずれでも安全側に倒し、
  // 空の初期データとして扱う(既存のloadTrophyData()と同じ考え方)。
  // 各フィールドの形まで確認し、1つでも想定と違えば丸ごと初期化する
  // (部分的に壊れたデータを中途半端に信用しない)
  function isValidTrophyStats(data) {
    return isPlainObject(data)
      && data.version === TROPHY_STATS_VERSION
      && isPlainObject(data.perfectCounts)
      && isPlainObject(data.fastAnswerCounts)
      && isPlainObject(data.partialStreakCounts)
      && isPlainObject(data.countryCorrectEver)
      && isPlainObject(data.countryCorrectCount)
      && isPlainObject(data.countryWrongEver)
      && isPlainObject(data.lastCourseResult);
  }

  function loadTrophyStats() {
    const raw = safeGet(TROPHY_STATS_KEY);
    if (!raw) return emptyTrophyStats();
    try {
      const parsed = JSON.parse(raw);
      if (!isValidTrophyStats(parsed)) return emptyTrophyStats();
      return parsed;
    } catch (e) {
      console.warn("トロフィー統計データの読み込みに失敗しました。保存データを初期化します", e);
      return emptyTrophyStats();
    }
  }

  function saveTrophyStats(data) {
    return safeSet(TROPHY_STATS_KEY, JSON.stringify(data));
  }

  // 読み取り専用のコピーを返す(呼び出し元が直接書き換えても内部状態や
  // localStorageには影響しない)。Stage C以降、実際に統計を書き込む
  // 判定ロジックが追加されるまでは、常に空の初期値が返る
  function getStats() {
    return JSON.parse(JSON.stringify(loadTrophyStats()));
  }

  // ---------- 公開API ----------
  // 107件すべての定義を返す(読み取り専用の用途を想定。将来の一覧画面・
  // 判定処理の両方がここを参照する想定だが、今回はまだどこからも呼ばれない)
  function getAllDefinitions() {
    return TROPHIES.slice();
  }

  function getDefinition(id) {
    return TROPHY_BY_ID.get(id) || null;
  }

  function getDefinitionByNumber(number) {
    return TROPHIES.find((t) => t.number === number) || null;
  }

  function isValidEarnedAtValue(v) {
    return isPlainObject(v) && typeof v.earnedAt === "string" && !Number.isNaN(Date.parse(v.earnedAt));
  }

  // 1件分の獲得データを安全な形に正規化する。common型(mode省略で獲得した
  // もの)は { earnedAt }、デュアル型(mode指定で獲得したもの)は
  // { flag: {earnedAt} } / { capital: {earnedAt} } / 両方、のいずれかの形を
  // 許容する。どちらの形としても解釈できない壊れたデータはnullを返す
  function sanitizeEarnedEntry(entry) {
    if (isValidEarnedAtValue(entry)) return { earnedAt: entry.earnedAt };
    if (isPlainObject(entry)) {
      const out = {};
      if (isValidEarnedAtValue(entry.flag)) out.flag = { earnedAt: entry.flag.earnedAt };
      if (isValidEarnedAtValue(entry.capital)) out.capital = { earnedAt: entry.capital.earnedAt };
      if (Object.keys(out).length > 0) return out;
    }
    return null;
  }

  // 獲得済みトロフィーを { [id]: { earnedAt } | { flag?, capital? } } の形で
  // 読み取り専用に返す。#101〜112(参照型)は新規保存領域を見ず、既存の
  // Storage.hasTitle()/getEarnedTitles()から都度合成する(二重保存しない)。
  // それ以外のidは、不正なエントリー(壊れたデータ・定義に無いid)をここで
  // 除外する(js/storage.jsのgetFindCountryCollection()と同じ防御的な考え方)
  function getEarned() {
    const data = loadTrophyData();
    const sanitized = {};
    TROPHIES.forEach((t) => {
      const ref = referenceTitleFor(t.number);
      if (ref) {
        if (typeof Storage === "undefined") return;
        try {
          const titles = Storage.getEarnedTitles(ref.mode);
          const rec = titles && titles[ref.id];
          if (rec && typeof rec.earnedAt === "string") {
            sanitized[t.id] = { earnedAt: rec.earnedAt };
          }
        } catch (e) {
          // 既存称号の読み込みに失敗しても、この番号を未獲得扱いにするだけで
          // 他のトロフィーの判定・画面表示は止めない
        }
        return;
      }
      const entry = sanitizeEarnedEntry(data.earned[t.id]);
      if (entry) sanitized[t.id] = entry;
    });
    return sanitized;
  }

  // mode省略時: common型の獲得状態を返す。mode指定時: そのモード(flag/
  // capital)だけの獲得状態を返す(デュアル型トロフィー用)。#101〜112は
  // referenceTitleForの時点でmode引数を無視し、常にその番号固有の既存称号
  // モードを参照する(getEarned()が既に正しいモードで合成しているため)
  function isEarned(id, mode) {
    const entry = getEarned()[id];
    if (!entry) return false;
    if (mode === "flag" || mode === "capital") return !!entry[mode];
    return !!entry.earnedAt;
  }

  // 新規獲得として記録する。戻り値: 実際に新規記録できればtrue。
  // 不正なid・参照型id(#101〜112、二重保存を防ぐため常に拒否)・
  // 既に獲得済み・保存失敗のいずれでもfalseを返し、何も変えない
  // (同じidで何度呼んでも安全。js/storage.jsのawardTitleIfNew()・
  // captureFindCountryEntry()と同じ重複防止の考え方)。
  // mode省略時はcommon型(単一の共通状態)、"flag"/"capital"指定時は
  // そのモードだけの状態をデュアル型として記録する
  function awardIfNew(id, mode) {
    try {
      if (!isValidTrophyId(id)) return false;
      const def = getDefinition(id);
      if (referenceTitleFor(def.number)) return false; // 参照型は新規書き込みしない
      if (mode !== undefined && mode !== null && mode !== "flag" && mode !== "capital") return false;
      const data = loadTrophyData();
      const existing = sanitizeEarnedEntry(data.earned[id]);
      if (mode === "flag" || mode === "capital") {
        if (existing && existing[mode]) return false; // そのモードは既に獲得済み
        const merged = (existing && !existing.earnedAt) ? Object.assign({}, existing) : {};
        merged[mode] = { earnedAt: new Date().toISOString() };
        data.earned[id] = merged;
      } else {
        if (existing) return false; // 既にcommon型として獲得済み
        data.earned[id] = { earnedAt: new Date().toISOString() };
      }
      return saveTrophyData(data);
    } catch (e) {
      console.warn("トロフィーの獲得記録に失敗しました", e);
      return false;
    }
  }

  // 獲得数の概要(将来の一覧画面での「n / 107 獲得」のような表示を想定した
  // 補助関数。今回はまだどこからも呼ばれない)。デュアル型は国旗・首都の
  // どちらか一方でも獲得していれば「獲得済み」として数える(1枚のカードに
  // 2つの達成マークを出すStage Gの表示方針と整合させるため)
  function getProgressSummary() {
    const earnedCount = Object.keys(getEarned()).length;
    return { earnedCount, totalCount: TROPHIES.length };
  }

  // ========================================================
  // 第2段階: 既存データだけから導出できる判定ヘルパー(読み取り専用の
  // 純粋関数)。どれも新しい保存領域を追加しない。将来、正式な107項目の
  // 内容が確定した際に、各トロフィーのcheck関数の中からこれらを呼び出す
  // ことを想定している(現時点ではどの番号にも割り当てていない)。
  // ========================================================

  // 国旗/首都いずれか一方の「指定した問題数での全問正解」称号(既存の
  // js/quiz.jsのTITLES/CAPITAL_TITLES、js/storage.jsのawardTitleIfNew()で
  // 既に記録されているもの)が獲得済みかどうかを調べる。
  // getTitleByCount()はjs/quiz.jsのグローバル関数をそのまま利用する
  // (複製しない)。count は10/20/30/50/100/198のいずれか
  function isModeTitlePerfectEarned(count, mode) {
    if (typeof getTitleByCount !== "function" || typeof Storage === "undefined") return false;
    const titleObj = getTitleByCount(count, mode);
    if (!titleObj) return false;
    return Storage.hasTitle(titleObj.id, mode);
  }

  // 「国旗クイズと首都クイズの両方」で、同じ問題数の称号(全問正解)が
  // 揃って獲得済みかどうか。「国旗と首都の両方での達成」系の将来の
  // トロフィーが、既存データだけで判定できることを示す例
  function isBothModesTitlePerfectEarned(count) {
    return isModeTitlePerfectEarned(count, "flag") && isModeTitlePerfectEarned(count, "capital");
  }

  // 「世界の国どこかな？」のコレクション(Storage.getFindCountryCollection()、
  // 正解した国・地域の記録)を、指定した地域(region、例: "asia")だけに
  // 絞って集計する。「地域別の全問正解」系の将来のトロフィーが、既存の
  // コレクション機能だけで判定できることを示す例。対象はCOUNTRIES(198件)+
  // MAP_ONLY_REGIONS(18件、定義されていれば)の計216件のうち、該当地域の件数
  function getFindCountryRegionProgress(region) {
    const all = (typeof COUNTRIES !== "undefined" ? COUNTRIES : [])
      .concat(typeof MAP_ONLY_REGIONS !== "undefined" ? MAP_ONLY_REGIONS : []);
    const regionEntries = all.filter((c) => c.region === region);
    const totalCount = regionEntries.length;
    if (totalCount === 0 || typeof Storage === "undefined") {
      return { region, capturedCount: 0, totalCount, allCaptured: false };
    }
    const collection = Storage.getFindCountryCollection();
    const capturedCount = regionEntries.filter((c) => Object.prototype.hasOwnProperty.call(collection, c.id)).length;
    return { region, capturedCount, totalCount, allCaptured: capturedCount === totalCount };
  }

  // 「指定された2か国を同じプレイで正解」系の判定補助。呼び出し側
  // (evaluateQuizFinish/evaluateFindCountryResult)が、そのプレイで実際に
  // 正解した国・地域idの集合(Set)を組み立てて渡す。この関数自体は
  // 「2つのidが両方ともその集合に含まれているか」を調べるだけの汎用的な
  // 純粋関数で、どの2か国を対象にするかは将来の正式な条件が決まってから
  // 各トロフィーのcheck関数側で指定する
  function arePairCorrect(idA, idB, correctIdSet) {
    if (!correctIdSet || typeof correctIdSet.has !== "function") return false;
    return correctIdSet.has(idA) && correctIdSet.has(idB);
  }

  // ========================================================
  // 第2段階: 判定エンジン(クイズ結果確定後に1回だけ呼ばれる想定)。
  // confirmed:trueかつcheck関数が設定されているスロットだけを対象にする。
  // 現時点ではconfirmed:trueのスロットが1件も無いため、このevaluate()は
  // 必ず{ awardedIds: [] }を返す「安全な空振り」になる(自己検証
  // validateTrophyDefinitions()のconfirmedCount===0のチェックと対応)。
  // 正式な107項目の内容が決まり、各トロフィーにcheck関数を設定した段階で、
  // 呼び出し元(js/app.js・js/findcountry.js)のコードを変更せずに機能し出す
  // 設計にしてある。
  // ========================================================
  // Stage A: t.mode==="both"のトロフィーはデュアル型として扱い、
  // context.mode("flag"|"capital")に対応する側だけを判定・記録する。
  // それ以外(mode未設定のcommon型・Stage A時点では存在しない)は従来どおり
  // 単一の共通状態として扱う。今回はconfirmed:trueのスロットが1件も無い
  // ため、この分岐が実際に通ることはない(安全な空振りのまま)
  function evaluate(context) {
    const awardedIds = [];
    TROPHIES.forEach((t) => {
      if (!t.confirmed || typeof t.check !== "function") return;
      const isDual = t.mode === "both";
      const subMode = isDual ? (context && context.mode) : undefined;
      if (isDual && subMode !== "flag" && subMode !== "capital") return; // デュアル型は対象モードのcontextでしか判定しない
      if (isEarned(t.id, subMode)) return; // 既に獲得済みなら判定自体を省略する
      let qualifies = false;
      try {
        qualifies = !!t.check(context);
      } catch (e) {
        console.warn(`トロフィー判定関数でエラーが発生しました(number=${t.number})`, e);
        qualifies = false;
      }
      if (qualifies && awardIfNew(t.id, subMode)) {
        awardedIds.push(t.id);
      }
    });
    return { awardedIds };
  }

  // 国旗クイズ・首都クイズ(js/app.jsのfinishQuiz())からの呼び出し専用。
  // context: { mode("flag"|"capital"), total, correct, rate, perfect,
  //            wrongIds(配列), correctIds(配列), questionIds(配列) }
  function evaluateQuizFinish(context) {
    return evaluate(Object.assign({ source: "quiz" }, context));
  }

  // 「世界の国どこかな？」(js/findcountry.jsのshowResult())からの呼び出し
  // 専用。context: { difficultyId, correctCount, answered, maxStreak,
  //                   isNormalClear, isProComplete, gameOver, results(配列) }
  function evaluateFindCountryResult(context) {
    return evaluate(Object.assign({ source: "findcountry" }, context));
  }

  // Stage A: 「全データリセット」から呼ばれる。新トロフィーの獲得記録
  // (wfq_v1_trophy_earned)・統計(wfq_v1_trophy_stats)の両方を削除する。
  // #101〜112は参照型のためこのキーには元々含まれておらず、既存の称号
  // データ(js/storage.jsのStorage.resetAll()が別途削除する)が消えれば
  // 連動して未獲得表示に戻る。呼び出し元のjs/storage.jsはこの関数の存在を
  // 確認してから呼ぶため、ここでは単純にキーを消すだけでよい
  function resetAll() {
    try { localStorage.removeItem(TROPHY_KEY); } catch (e) { /* noop */ }
    try { localStorage.removeItem(TROPHY_STATS_KEY); } catch (e) { /* noop */ }
  }

  return {
    getAllDefinitions,
    getDefinition,
    getDefinitionByNumber,
    getEarned,
    isEarned,
    awardIfNew,
    getProgressSummary,
    getStats,
    resetAll,
    isModeTitlePerfectEarned,
    isBothModesTitlePerfectEarned,
    getFindCountryRegionProgress,
    arePairCorrect,
    evaluate,
    evaluateQuizFinish,
    evaluateFindCountryResult,
  };
})();
