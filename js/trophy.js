// ==========================================================
// トロフィー刷新 第1段階+第2段階+Stage A+Stage B+Stage C+Stage D: 新トロフィーシステム(107項目)
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
// Stage C(docs/trophy-spec-final.md参照)で追加したこと:
// - 新関数 recordQuizStats(context): wfq_v1_trophy_statsへの「統計の記録」
//   専用の入口。既存のevaluate()/evaluateQuizFinish()(判定・獲得エンジン)
//   とは完全に別の関数にすることで、Stage Cでは獲得判定に一切手を加えない
//   (#58・60・63・64・66・68の獲得可否は依然判定しない)
// - js/app.jsのfinishQuiz()から、evaluateQuizFinish()の直後(判定が確定した
//   後)に1回だけrecordQuizStats()を呼ぶように接続。完了していないプレイ
//   (「終了する」ボタンでの中断)ではfinishQuiz()自体が呼ばれないため、
//   統計も従来の「プレイ回数は完了時のみ加算」という原則と自動的に揃う
// - 記録する内容(すべてモード別。#60のみ合算して使う想定で分離保存):
//   - perfectCounts: 198問コースでの満点回数(#58)
//   - fastAnswerCounts: 正解かつ2秒/3秒以内だった回答の累計回数(#21・26・27)
//   - partialStreakCounts: 10問コースで9問正解だった回数(#60)
//   - countryCorrectEver/countryCorrectCount: 国別の生涯正解有無・回数(#30〜39)
//   - countryWrongEver: 国別の誤答履歴(#63は同モード、#68は国旗側の履歴を
//     首都プレイ側の判定が参照する想定のため、モードをまたいで読み取れる
//     ようあえて混ぜずモード別に保持する)
//   - lastCourseResult: 同一モード・同一コースの直前の完了プレイの結果(#66。
//     将来の判定ロジックはrecordQuizStats()が上書きする前の値を読む必要が
//     あるため、呼び出し順は必ず「判定(evaluateQuizFinish) → 統計記録
//     (recordQuizStats)」を守る、という前提で設計している)
// - js/app.jsのstartQuiz()でそのプレイの開始時刻(quizStartedAt)と、各問題の
//   回答時間配列(answerTimings)を記録し、finishQuiz()でトロフィー用の
//   contextに含めるようにした(#64・70の開始時刻判定、#20〜29・69の回答時間
//   判定に必要な「データ」のみを用意する。これらの番号のcheck関数・
//   confirmed:trueへの変更自体はまだ行わない)
// - isValidTrophyStats()を、各フィールドの中身(モード別の数値・国idごとの
//   真偽値/回数等)まで検証するように強化した(Stage Aでは骨組みのみで
//   実際に書き込まれることが無かったため簡易な検証で十分だったが、Stage C
//   で実際に書き込みが始まるため、壊れたデータを安全側に倒す検証を厚くした)
//
// Stage Cでも行っていないこと:
// - #20〜39・58・60・63・64・66・68〜70の獲得判定・check関数の登録
//   (いずれもStage D〜Fで実施)
// - トロフィー専用の新しい表示画面(Stage G)
// - 国旗・首都クイズの出題・採点・タイマー・ランキング、世界地図・世界図鑑・
//   「世界の国どこかな？」の変更(一切行っていない)
// - 既存データの削除・初期化(resetAll()以外の経路での削除は行っていない)
//
// Stage D(docs/trophy-spec-final.md参照)で追加したこと:
// - 残り28項目(#20〜39・58・60・63・64・66・68〜70)の獲得条件(check関数)を
//   登録し、confirmed:trueにした(STAGE_D_DEFINITIONS参照)。これにより
//   107件全てのconfirmed:true化が完了する
// - js/app.jsのfinishQuiz()は「判定(evaluateQuizFinish) → 統計記録
//   (recordQuizStats)」の順で呼ぶため、ここのcheck関数は統計を読む時点では
//   まだそのプレイ自身の結果が反映されていない。#21・26・27・58・60は
//   「保存済みの前回までの値」+「今回のプレイ分(contextから計算)」を
//   その場で合算して閾値判定することで、このプレイ自身が条件を満たす瞬間を
//   取り落とさないようにした。#66は逆に、合算も補完もせず「上書き前の
//   直前の値」とそのまま比較し、直前の記録が無ければ対象外にした
// - #63(同モードの誤答からのリベンジ)・#68(国旗の誤答→首都で正解)は、
//   countryWrongEver(Stage Cで記録済み)をそのまま参照する。評価の時点では
//   そのプレイ自身の誤答はまだ統計に入っていないため、過去のプレイの誤答
//   だけを見ることになる(同じプレイ内で同じ国が誤答と正解の両方になる
//   ことは無いため、自身の結果と衝突する心配もない)
// - #64・70(開始時刻判定)は、Stage Cで記録したcontext.startedAt(ISO文字列)
//   を、同じブラウザ内でDateとして再構築し、getHours()等でその場の
//   ローカルタイムゾーンの時刻を復元して判定する(新しい保存領域は追加しない)
// - #20〜29の回答時間系は、そのプレイ自身のcontext.answerTimings(永続化
//   していない生データ)から、単発(#20)・連続(#22・23)・平均(#24・25・
//   28・29)・最終1問(#69)をそれぞれ算出する。answerTimingsの件数が
//   出題数と一致しない(欠損がある)場合は、推測で補完せず判定しない
//
// Stage Dでも行っていないこと:
// - トロフィー専用の新しい表示画面(Stage G)
// - 国旗・首都クイズの出題・採点・タイマー・ランキング、世界地図・世界図鑑・
//   「世界の国どこかな？」の変更(一切行っていない)
// - 既存データの削除・初期化
//
// Stage E(ユーザー指示のStage E=ドキュメント上のStage G「画面・演出・
// 全体テスト」に相当)で追加したこと:
// - 各トロフィーのcategory(表示用の分類ラベル、TROPHY_CATEGORIES・
//   categoryForNumber())とhidden(当初は全107件false)を補完し、公開APIに
//   getCategories()を追加した。name/condition/mode/check(獲得条件・判定
//   ロジック)は一切変更していない
// - トロフィー一覧画面(js/app.jsのrenderTrophyListScreen()、既存の
//   「称号コレクション」画面とは別画面)と、複数トロフィー同時獲得に対応した
//   新しい獲得演出画面(renderTrophyAwardScreen())をjs/app.js側に追加した
//   (js/trophy.js自体の判定・保存ロジックへの変更はcategory/hidden補完の
//   みで、評価エンジン(evaluate/evaluateQuizFinish)・判定関数は無変更)
//
// Stage E追加検討(隠しトロフィー選定)で追加したこと:
// - 調査・比較検討の結果、ユーザー指示によりHIDDEN_TROPHY_NUMBERS(12件:
//   #53・61・62・64・65・67・70・75・86・87・88・89)を正式な隠しトロフィー
//   として確定した(検討時に挙げた36件案は不採用。docs/trophy-spec-final.md
//   「7. 隠しトロフィー仕様」参照)。hiddenフィールドをこの12件のみtrueに
//   変更。名称・条件・mode・check・番号・保存キーは一切変更していない
// - 表示側(js/app.js)で、hidden:trueかつ未獲得のトロフィーは名称「？？？？？？」・
//   条件非表示・鍵アイコン・状態「未発見」にする分岐と、新規獲得時の
//   「隠しトロフィー発見演出」を追加した(既存の獲得演出画面を拡張、保存形式は
//   無変更)
//
// Stage Eでも行っていないこと:
// - 既存の12称号の獲得履歴・保存形式・コレクション画面・獲得演出の変更
// - 国旗・首都クイズの出題・採点・ランキング、世界地図・世界図鑑・
//   「世界の国どこかな？」・PROモードの変更(一切行っていない)
// - 既存データの削除・初期化(Storage.resetAll()の対象範囲も変更していない)
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
// docs/trophy-spec-final.mdで107件すべて確定済み。Stage Bで79件分・
// Stage Dで残り28件分をname/condition/mode/check(confirmed:true)として
// 反映し、107件全てのconfirmed:true化が完了した。Stage Eでcategory
// (表示用分類)・hiddenを全107件に補完し、一覧画面(js/app.js側)を追加した。
// hiddenは正式確定した12件(#53・61・62・64・65・67・70・75・86・87・88・89)
// のみtrue、残り95件はfalse。
//
// 追加修正(国旗トリビア29件の国旗クイズ限定化): #71〜100(カテゴリー
// 「国旗トリビア」)のうち、当初は24件が国旗・首都共通(mode:"common")
// だったが、カテゴリー名と獲得方法を一致させるため、29件全てを国旗クイズ
// 限定(mode:"flag_only"+pairCheck(...,{flagOnly:true}))に統一した。
// 番号・名称・対象国・判定対象以外のロジックは変更していない。
// カテゴリーの内部id("trivia")・表示ラベル("国旗トリビア")・107件という
// 総数・#71〜100以外のトロフィーの獲得条件には一切影響しない。
//
// 首都トリビア追加(#113〜141、新規29件): 既存107件はそのまま維持し、
// 新カテゴリー「首都トリビア」として29件を追加、総数が136件になった。
// 獲得条件はmode:"capital_only"+pairCheck(...,{capitalOnly:true})
// (国旗トリビアのflag_only/flagOnlyと対になる、首都クイズ限定の判定)で、
// 既存のpairCheck()/arePairCorrect()をそのまま再利用し新しい判定コードは
// 追加していない。各トロフィーにdescription(正式解説文)・countries
// (対象2か国のid配列)を追加フィールドとして持たせ、一覧画面・獲得通知画面の
// 表示に用いる(#1〜112にはこれらのフィールドは設定されずnullのまま)。
// 既存107件の名称・獲得条件・mode・check・保存形式・称号コレクション
// (#101〜112参照型)には一切影響しない。
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
  // 首都トリビア29件(#113〜141)の追加により、通し番号の上限が112から141に
  // 拡張された(欠番は追加されていない。112-5+29=136件)
  const MAX_TROPHY_NUMBER = 141;

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

  // 「同じクイズプレイで指定した2か国が両方正解」判定(#71〜100・#113〜141用)の
  // check関数を作る。flagOnly指定時は国旗クイズのプレイのみ(#71〜100、2026年の
  // 追加修正で29件全て国旗限定に統一)、capitalOnly指定時は首都クイズの
  // プレイのみ(#113〜141「首都トリビア」)を対象にする。国旗/首都のどちらの
  // クイズでも、質問のidは共通してjs/countries.jsの国idのため、モードを
  // 区別せず同じロジックで判定できる(js/quiz.jsのbuildQuestionSet()参照)。
  // 「世界の国どこかな？」からの呼び出し(context.source==="findcountry")は
  // 対象外にする(条件が「同じ国旗・首都クイズのプレイ」を前提にしているため)。
  // 正解の配列(context.correctIds)の順序は見ないため、正解順序は問わない。
  // 別プレイのcorrectIdsを合算することもない(その都度のcontextだけを見るため)
  function pairCheck(idA, idB, options) {
    const flagOnly = !!(options && options.flagOnly);
    const capitalOnly = !!(options && options.capitalOnly);
    return function (context) {
      if (!context || context.source !== "quiz") return false;
      if (flagOnly && context.mode !== "flag") return false;
      if (capitalOnly && context.mode !== "capital") return false;
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

    // ---- #71〜100: 同一プレイの国ペア判定(既存データのみ、全件国旗クイズ限定)。
    // 当初は#75・86〜89の5件のみ国旗限定(mode:"flag_only")で、残り24件は
    // 国旗・首都共通(mode:"common")だったが、カテゴリー名「国旗トリビア」と
    // 獲得方法を一致させるため、29件全てをmode:"flag_only"+
    // pairCheck(...,{flagOnly:true})に統一した(首都クイズでの正解は対象外。
    // 国旗・首都の正解履歴を合算しない) ----
    71: { name: "太陽と月の出会い", condition: "国旗クイズ1プレイで日本・パラオを正解", mode: "flag_only", check: pairCheck("jp", "pw", { flagOnly: true }) },
    72: { name: "そっくりさん発見！", condition: "国旗クイズ1プレイでルーマニア・チャドを正解", mode: "flag_only", check: pairCheck("ro", "td", { flagOnly: true }) },
    73: { name: "白と赤の双子", condition: "国旗クイズ1プレイでインドネシア・モナコを正解", mode: "flag_only", check: pairCheck("id", "mc", { flagOnly: true }) },
    74: { name: "南十字星のきずな", condition: "国旗クイズ1プレイでオーストラリア・ニュージーランドを正解", mode: "flag_only", check: pairCheck("au", "nz", { flagOnly: true }) },
    75: { name: "型破りな国旗たち", condition: "国旗クイズ1プレイでネパール・バチカン市国を正解", mode: "flag_only", check: pairCheck("np", "va", { flagOnly: true }) },
    76: { name: "島から島へ", condition: "国旗クイズ1プレイでアイスランド・マダガスカルを正解", mode: "flag_only", check: pairCheck("is", "mg", { flagOnly: true }) },
    77: { name: "南北のロングラン", condition: "国旗クイズ1プレイでカナダ・チリを正解", mode: "flag_only", check: pairCheck("ca", "cl", { flagOnly: true }) },
    78: { name: "ピラミッドの謎", condition: "国旗クイズ1プレイでエジプト・メキシコを正解", mode: "flag_only", check: pairCheck("eg", "mx", { flagOnly: true }) },
    79: { name: "火山の国を巡る", condition: "国旗クイズ1プレイで日本・イタリアを正解", mode: "flag_only", check: pairCheck("jp", "it", { flagOnly: true }) },
    80: { name: "海を越えた言葉", condition: "国旗クイズ1プレイでブラジル・ポルトガルを正解", mode: "flag_only", check: pairCheck("br", "pt", { flagOnly: true }) },
    81: { name: "巨人と小人", condition: "国旗クイズ1プレイでロシア・バチカン市国を正解", mode: "flag_only", check: pairCheck("ru", "va", { flagOnly: true }) },
    82: { name: "国の中の国", condition: "国旗クイズ1プレイで南アフリカ・レソトを正解", mode: "flag_only", check: pairCheck("za", "ls", { flagOnly: true }) },
    83: { name: "一つの半島、二つの国", condition: "国旗クイズ1プレイで韓国・北朝鮮を正解", mode: "flag_only", check: pairCheck("kr", "kp", { flagOnly: true }) },
    84: { name: "色が逆さま！", condition: "国旗クイズ1プレイでアイルランド・コートジボワールを正解", mode: "flag_only", check: pairCheck("ie", "ci", { flagOnly: true }) },
    85: { name: "三色旗の秘密", condition: "国旗クイズ1プレイでフランス・オランダを正解", mode: "flag_only", check: pairCheck("fr", "nl", { flagOnly: true }) },
    86: { name: "国旗の中に武器!?", condition: "国旗クイズ1プレイでモザンビーク・グアテマラを正解", mode: "flag_only", check: pairCheck("mz", "gt", { flagOnly: true }) },
    87: { name: "国旗の動物園", condition: "国旗クイズ1プレイでドミニカ国・ウガンダを正解", mode: "flag_only", check: pairCheck("dm", "ug", { flagOnly: true }) },
    88: { name: "国旗の中の地図", condition: "国旗クイズ1プレイでキプロス・コソボを正解", mode: "flag_only", check: pairCheck("cy", "xk", { flagOnly: true }) },
    89: { name: "国旗が語りかける", condition: "国旗クイズ1プレイでサウジアラビア・ブラジルを正解", mode: "flag_only", check: pairCheck("sa", "br", { flagOnly: true }) },
    91: { name: "左側通行の仲間", condition: "国旗クイズ1プレイで日本・イギリスを正解", mode: "flag_only", check: pairCheck("jp", "gb", { flagOnly: true }) },
    92: { name: "独立を守った国々", condition: "国旗クイズ1プレイでエチオピア・リベリアを正解", mode: "flag_only", check: pairCheck("et", "lr", { flagOnly: true }) },
    93: { name: "10億人の世界", condition: "国旗クイズ1プレイで中国・インドを正解", mode: "flag_only", check: pairCheck("cn", "in", { flagOnly: true }) },
    94: { name: "同じ言葉、遠い国", condition: "国旗クイズ1プレイでスペイン・アルゼンチンを正解", mode: "flag_only", check: pairCheck("es", "ar", { flagOnly: true }) },
    95: { name: "海を越えたフランス語", condition: "国旗クイズ1プレイでフランス・カナダを正解", mode: "flag_only", check: pairCheck("fr", "ca", { flagOnly: true }) },
    96: { name: "海まで二つの国", condition: "国旗クイズ1プレイでウズベキスタン・リヒテンシュタインを正解", mode: "flag_only", check: pairCheck("uz", "li", { flagOnly: true }) },
    97: { name: "イタリアの中の国", condition: "国旗クイズ1プレイでイタリア・サンマリノを正解", mode: "flag_only", check: pairCheck("it", "sm", { flagOnly: true }) },
    98: { name: "二つの大陸をまたぐ国", condition: "国旗クイズ1プレイでトルコ・ロシアを正解", mode: "flag_only", check: pairCheck("tr", "ru", { flagOnly: true }) },
    99: { name: "細長い国の秘密", condition: "国旗クイズ1プレイでチリ・ノルウェーを正解", mode: "flag_only", check: pairCheck("cl", "no", { flagOnly: true }) },
    100: { name: "太平洋の島々", condition: "国旗クイズ1プレイでキリバス・フィジーを正解", mode: "flag_only", check: pairCheck("ki", "fj", { flagOnly: true }) },

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

  // ========================================================
  // Stage D: 残り28項目(#20〜39・58・60・63・64・66・68〜70)の獲得条件
  // (docs/trophy-spec-final.md 2章)。Stage Cで用意した統計
  // (wfq_v1_trophy_stats)・そのプレイ自身のcontext(answerTimings・
  // startedAt等)から判定する。これで107件全てのconfirmed:true化が完了する。
  //
  // 重要な設計方針:
  // - js/app.jsのfinishQuiz()は「判定(evaluateQuizFinish) → 統計記録
  //   (recordQuizStats)」の順で呼ぶため、ここのcheck関数がloadTrophyStats()
  //   を読む時点では、そのプレイ自身の結果はまだ統計に反映されていない
  //   (Stage CのrecordQuizStats()のコメント参照)。したがって「今回の
  //   プレイで初めて条件を満たす」ケース(#21・26・27・58・60)は、
  //   読み込んだ統計の値に、そのプレイ自身の分をcontextから計算して
  //   加算してから閾値判定する(「前回までの統計」+「今回のプレイ分」)。
  // - #66は逆に、統計を一切加算せず「上書き前の直前の値」とそのまま比較する
  //   (推測で前回値を作らず、記録が無い場合は対象外にする)。
  // - #63・68(誤答履歴)は、そのプレイの誤答がまだ統計に入っていない時点で
  //   読むため、過去のプレイの誤答だけを見ることが自然に保証される
  //   (同じプレイ内で同じ国が誤答と正解の両方になることは無いため、
  //   自分自身の誤答と衝突する心配もない)。
  // - 「過去の記録に存在しない情報を推測で補完しない」ため、answerTimingsの
  //   件数がtotalと一致しない(欠損がある)場合は平均・最終1問系の判定を
  //   行わない(null/falseを返す)。
  // ========================================================
  const ALL_COUNTRY_IDS = (() => {
    const list = (typeof COUNTRIES !== "undefined" ? COUNTRIES : []).map((c) => c.id);
    return list;
  })();

  // 地域(region) -> その地域に属する国idの一覧(#30〜39用)。
  // countryRegionById()と同じCOUNTRIESを参照するだけで、データを複製しない
  let regionCountryIdsCache = null;
  function countryIdsInRegion(region) {
    if (!regionCountryIdsCache) {
      regionCountryIdsCache = new Map();
      ALL_COUNTRY_IDS.forEach((id) => {
        const r = countryRegionById(id);
        if (!regionCountryIdsCache.has(r)) regionCountryIdsCache.set(r, []);
        regionCountryIdsCache.get(r).push(id);
      });
    }
    return regionCountryIdsCache.get(region) || [];
  }

  // 指定モードの「生涯正解した国idの集合」に、そのプレイ自身の正解国idを
  // 加えたもの(#30〜38用。recordQuizStats()で保存される前の値に、今回の
  // プレイ分を一時的に合算して判定するためのコピー。保存領域そのものは
  // 変更しない)
  function countryCorrectEverIncludingThisPlay(mode, context) {
    const combined = Object.assign({}, loadTrophyStats().countryCorrectEver[mode]);
    if (Array.isArray(context.correctIds)) {
      context.correctIds.forEach((id) => { if (isKnownCountryId(id)) combined[id] = true; });
    }
    return combined;
  }

  // 指定モードの「国別の生涯正解回数」に、そのプレイ自身の正解を加えたもの(#39用)
  function countryCorrectCountIncludingThisPlay(mode, context) {
    const combined = Object.assign({}, loadTrophyStats().countryCorrectCount[mode]);
    if (Array.isArray(context.correctIds)) {
      context.correctIds.forEach((id) => { if (isKnownCountryId(id)) combined[id] = (combined[id] || 0) + 1; });
    }
    return combined;
  }

  function isRegionMastered(region, correctEverSet) {
    const ids = countryIdsInRegion(region);
    return ids.length > 0 && ids.every((id) => correctEverSet[id] === true);
  }

  function areAllCountriesMastered(correctEverSet) {
    return ALL_QUIZ_REGIONS.every((r) => isRegionMastered(r, correctEverSet));
  }

  // そのプレイの回答時間配列(context.answerTimings)のうち、正解かつ
  // 指定秒数以内だった件数(#20〜21・26・27用)
  function countFastCorrectAnswers(context, thresholdSeconds) {
    if (!Array.isArray(context.answerTimings)) return 0;
    return context.answerTimings.filter((t) => t && t.correct === true && Number.isFinite(t.elapsedSeconds) && t.elapsedSeconds <= thresholdSeconds).length;
  }

  // そのプレイの回答時間配列のうち、正解かつ指定秒数以内だった「連続」の
  // 最長記録(#22・23用。プレイ順に並んでいるanswerTimingsをそのまま辿る)
  function longestFastCorrectStreak(context, thresholdSeconds) {
    if (!Array.isArray(context.answerTimings)) return 0;
    let longest = 0;
    let current = 0;
    context.answerTimings.forEach((t) => {
      if (t && t.correct === true && Number.isFinite(t.elapsedSeconds) && t.elapsedSeconds <= thresholdSeconds) {
        current += 1;
        if (current > longest) longest = current;
      } else {
        current = 0;
      }
    });
    return longest;
  }

  // そのプレイの平均回答時間(#24・25・28・29用)。answerTimingsの件数が
  // total(出題数)と一致しない(何らかの理由で記録が欠けている)場合は、
  // 推測で補完せずnullを返して判定を行わない
  function averageElapsedSeconds(context) {
    if (!Array.isArray(context.answerTimings) || !Number.isFinite(context.total) || context.answerTimings.length !== context.total) return null;
    const valid = context.answerTimings.filter((t) => t && Number.isFinite(t.elapsedSeconds));
    if (valid.length !== context.answerTimings.length) return null;
    const sum = valid.reduce((acc, t) => acc + t.elapsedSeconds, 0);
    return sum / valid.length;
  }

  function isAverageWithin(context, thresholdSeconds) {
    const avg = averageElapsedSeconds(context);
    return avg !== null && avg <= thresholdSeconds;
  }

  // プレイ開始時刻(context.startedAt、ISO文字列)から、現地(ブラウザの
  // ローカルタイムゾーン)の「その日の中での経過秒数」を求める(#64・70用)。
  // Date.toISOString()はUTCだが、同じブラウザ内でnew Date(iso)してから
  // getHours()等を呼ぶと、記録した瞬間と同じローカルタイムゾーンで
  // 解釈されるため、別途タイムゾーン情報を保存しなくても現地時間が復元できる
  function secondsOfDayFromIso(iso) {
    if (typeof iso !== "string") return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  }

  const STAGE_D_DEFINITIONS = {
    // ---- #20〜29: 回答時間(共通1個。#21・26・27のみモード別累計カウンタ) ----
    20: { name: "電光石火", condition: "1問を2秒以内に正解", mode: "common", check: (ctx) => ctx.source === "quiz" && countFastCorrectAnswers(ctx, 2) >= 1 },
    21: {
      name: "ロケット回答", condition: "3秒以内正解を累計10回", mode: "both",
      check: (ctx) => (loadTrophyStats().fastAnswerCounts[ctx.mode].within3s || 0) + countFastCorrectAnswers(ctx, 3) >= 10,
    },
    22: { name: "即答マスター", condition: "4秒以内正解が10問連続", mode: "common", check: (ctx) => ctx.source === "quiz" && longestFastCorrectStreak(ctx, 4) >= 10 },
    23: { name: "疾風の挑戦者", condition: "4秒以内正解が20問連続", mode: "common", check: (ctx) => ctx.source === "quiz" && longestFastCorrectStreak(ctx, 4) >= 20 },
    24: { name: "スピードキング", condition: "10問コース満点・平均4秒以内", mode: "common", check: (ctx) => ctx.source === "quiz" && ctx.total === 10 && ctx.correct === 10 && isAverageWithin(ctx, 4) },
    25: { name: "超速トラベラー", condition: "20問コース満点・平均4秒以内", mode: "common", check: (ctx) => ctx.source === "quiz" && ctx.total === 20 && ctx.correct === 20 && isAverageWithin(ctx, 4) },
    26: {
      name: "瞬間判断の達人", condition: "2秒以内正解を累計50回", mode: "both",
      check: (ctx) => (loadTrophyStats().fastAnswerCounts[ctx.mode].within2s || 0) + countFastCorrectAnswers(ctx, 2) >= 50,
    },
    27: {
      name: "反射神経の鬼", condition: "2秒以内正解を累計100回", mode: "both",
      check: (ctx) => (loadTrophyStats().fastAnswerCounts[ctx.mode].within2s || 0) + countFastCorrectAnswers(ctx, 2) >= 100,
    },
    28: { name: "秒速の王者", condition: "50問コース満点・平均4秒以内", mode: "common", check: (ctx) => ctx.source === "quiz" && ctx.total === 50 && ctx.correct === 50 && isAverageWithin(ctx, 4) },
    29: { name: "光速レジェンド", condition: "100問コース満点・平均4秒以内", mode: "common", check: (ctx) => ctx.source === "quiz" && ctx.total === 100 && ctx.correct === 100 && isAverageWithin(ctx, 4) },

    // ---- #30〜39: 国別生涯正解履歴(デュアル) ----
    30: { name: "アジアマスター", condition: "アジア全対象国を正解(累計)", mode: "both", check: (ctx) => isRegionMastered("asia", countryCorrectEverIncludingThisPlay(ctx.mode, ctx)) },
    31: { name: "ヨーロッパマスター", condition: "ヨーロッパ全対象国を正解(累計)", mode: "both", check: (ctx) => isRegionMastered("europe", countryCorrectEverIncludingThisPlay(ctx.mode, ctx)) },
    32: { name: "アフリカマスター", condition: "アフリカ全対象国を正解(累計)", mode: "both", check: (ctx) => isRegionMastered("africa", countryCorrectEverIncludingThisPlay(ctx.mode, ctx)) },
    33: { name: "北米マスター", condition: "北米全対象国を正解(累計、中米・カリブ含む)", mode: "both", check: (ctx) => isRegionMastered("namerica", countryCorrectEverIncludingThisPlay(ctx.mode, ctx)) },
    34: { name: "南米マスター", condition: "南米全対象国を正解(累計)", mode: "both", check: (ctx) => isRegionMastered("samerica", countryCorrectEverIncludingThisPlay(ctx.mode, ctx)) },
    35: { name: "オセアニアマスター", condition: "オセアニア全対象国を正解(累計)", mode: "both", check: (ctx) => isRegionMastered("oceania", countryCorrectEverIncludingThisPlay(ctx.mode, ctx)) },
    36: { name: "六大地域制覇", condition: "6地域すべて制覇(累計)", mode: "both", check: (ctx) => areAllCountriesMastered(countryCorrectEverIncludingThisPlay(ctx.mode, ctx)) },
    37: {
      name: "地域探検家", condition: "6地域のうち3地域を制覇(累計)", mode: "both",
      check: (ctx) => { const s = countryCorrectEverIncludingThisPlay(ctx.mode, ctx); return ALL_QUIZ_REGIONS.filter((r) => isRegionMastered(r, s)).length >= 3; },
    },
    38: { name: "世界一周達成", condition: "198か国・地域をすべて1回以上正解(累計)", mode: "both", check: (ctx) => areAllCountriesMastered(countryCorrectEverIncludingThisPlay(ctx.mode, ctx)) },
    39: {
      name: "地球の知識王", condition: "198か国・地域をそれぞれ3回以上正解(累計)", mode: "both",
      check: (ctx) => { const counts = countryCorrectCountIncludingThisPlay(ctx.mode, ctx); return ALL_COUNTRY_IDS.every((id) => (counts[id] || 0) >= 3); },
    },

    // ---- #58・60: 新規カウンタ(今回のプレイ分を加算して判定) ----
    58: {
      name: "真の世界王", condition: "国旗198問満点2回以上+首都198問満点2回以上", mode: "common",
      check: (ctx) => {
        const stats = loadTrophyStats();
        const thisFlagPerfect = ctx.source === "quiz" && ctx.mode === "flag" && ctx.total === 198 && ctx.correct === 198;
        const thisCapitalPerfect = ctx.source === "quiz" && ctx.mode === "capital" && ctx.total === 198 && ctx.correct === 198;
        const flagCount = stats.perfectCounts.flag + (thisFlagPerfect ? 1 : 0);
        const capitalCount = stats.perfectCounts.capital + (thisCapitalPerfect ? 1 : 0);
        return flagCount >= 2 && capitalCount >= 2;
      },
    },
    60: {
      name: "完璧じゃなくてもいい", condition: "10問で9問正解を国旗・首都合算で3回達成", mode: "common",
      check: (ctx) => {
        const stats = loadTrophyStats();
        const thisPlayQualifies = ctx.source === "quiz" && ctx.total === 10 && ctx.correct === 9;
        const flagCount = stats.partialStreakCounts.flag + (thisPlayQualifies && ctx.mode === "flag" ? 1 : 0);
        const capitalCount = stats.partialStreakCounts.capital + (thisPlayQualifies && ctx.mode === "capital" ? 1 : 0);
        return (flagCount + capitalCount) >= 3;
      },
    },

    // ---- #63・64・66・68〜70: そのプレイの結果+既存の統計・履歴 ----
    63: {
      name: "運命の再会", condition: "同じモードで過去に誤答した国を後のプレイで正解", mode: "common",
      check: (ctx) => {
        if (ctx.source !== "quiz" || !Array.isArray(ctx.correctIds)) return false;
        const everWrong = loadTrophyStats().countryWrongEver[ctx.mode] || {};
        return ctx.correctIds.some((id) => everWrong[id] === true);
      },
    },
    64: {
      name: "真夜中の探検家", condition: "開始時刻0:00〜2:59・そのプレイで満点", mode: "common",
      check: (ctx) => {
        if (ctx.source !== "quiz" || !Number.isFinite(ctx.total) || ctx.correct !== ctx.total) return false;
        const sec = secondsOfDayFromIso(ctx.startedAt);
        return sec !== null && sec < 3 * 3600;
      },
    },
    66: {
      name: "リベンジ成功！", condition: "同じモード・同じコースの直前の完了プレイより正解数が増加", mode: "common",
      check: (ctx) => {
        if (ctx.source !== "quiz" || !Number.isFinite(ctx.total) || !Number.isFinite(ctx.correct)) return false;
        const prev = loadTrophyStats().lastCourseResult[ctx.mode][String(ctx.total)];
        if (!prev || !Number.isFinite(prev.correct)) return false; // 直前の完了プレイが無ければ対象外(推測で前回値を作らない)
        return ctx.correct > prev.correct;
      },
    },
    68: {
      name: "逆転の天才", condition: "国旗で誤答した国を後の首都クイズで正解(同日不問)", mode: "common",
      check: (ctx) => {
        if (ctx.source !== "quiz" || ctx.mode !== "capital" || !Array.isArray(ctx.correctIds)) return false;
        const flagEverWrong = loadTrophyStats().countryWrongEver.flag || {};
        return ctx.correctIds.some((id) => flagEverWrong[id] === true);
      },
    },
    69: {
      name: "ラストの伝説", condition: "198問満点+最終問を3秒以内に正解", mode: "common",
      check: (ctx) => {
        if (ctx.source !== "quiz" || ctx.total !== 198 || ctx.correct !== 198) return false;
        if (!Array.isArray(ctx.answerTimings) || ctx.answerTimings.length !== 198) return false;
        const last = ctx.answerTimings[ctx.answerTimings.length - 1];
        return !!last && last.correct === true && Number.isFinite(last.elapsedSeconds) && last.elapsedSeconds <= 3;
      },
    },
    70: {
      name: "早朝の探検家", condition: "開始時刻5:00:00以上6:00:00未満", mode: "common",
      check: (ctx) => {
        if (ctx.source !== "quiz") return false;
        const sec = secondsOfDayFromIso(ctx.startedAt);
        return sec !== null && sec >= 5 * 3600 && sec < 6 * 3600;
      },
    },
  };

  // ==========================================================
  // 首都トリビア追加: 新規29件(#113〜141)。
  //
  // 既存のmode:"flag_only"+pairCheck(...,{flagOnly:true})(#71〜100)と
  // 対になる、mode:"capital_only"+pairCheck(...,{capitalOnly:true})として
  // 実装する。判定ロジックはpairCheck()/arePairCorrect()をそのまま再利用し、
  // 新しい判定コードは一切書かない(首都クイズの同一プレイ中に対象2か国を
  // 両方正解した場合のみ獲得。順序不問、国旗クイズ・「世界の国どこかな？」
  // では獲得不可、プレイをまたいだ合算もしない。これらはpairCheck()の
  // 既存ガード節がそのまま満たす)。
  //
  // description/countriesは、トロフィー一覧画面・獲得通知画面で
  // 「対象2か国+首都+正式解説文」を表示するための追加データ(#1〜112には
  // 設定しない。buildTrophyDefinitions()のデフォルト値nullのまま)。
  // ==========================================================
  const STAGE_CAPITAL_TRIVIA_DEFINITIONS = {
    113: {
      name: "選ばれし都", condition: "首都クイズ1プレイでオーストラリア・カナダを正解", mode: "capital_only",
      check: pairCheck("au", "ca", { capitalOnly: true }),
      description: "キャンベラとオタワは、どちらも国の最大都市ではありません。オーストラリアではシドニー、カナダではトロントが最大都市ですが、首都には別の都市が選ばれています。",
      countries: ["au", "ca"],
    },
    114: {
      name: "双都の謎", condition: "首都クイズ1プレイでボリビア・南アフリカを正解", mode: "capital_only",
      check: pairCheck("bo", "za", { capitalOnly: true }),
      description: "ボリビアではスクレが憲法上の首都で、ラパスに政府機関があります。南アフリカではプレトリア、ケープタウン、ブルームフォンテーンに主要な国家機能が分かれています。",
      countries: ["bo", "za"],
    },
    115: {
      name: "国家の名を継ぐ都", condition: "首都クイズ1プレイでシンガポール・ルクセンブルクを正解", mode: "capital_only",
      check: pairCheck("sg", "lu", { capitalOnly: true }),
      description: "シンガポールとルクセンブルクは、国名と首都名が同じです。国の名前をそのまま冠した都市が、政治の中心となっています。",
      countries: ["sg", "lu"],
    },
    116: {
      name: "新天地への遷都", condition: "首都クイズ1プレイでブラジル・ナイジェリアを正解", mode: "capital_only",
      check: pairCheck("br", "ng", { capitalOnly: true }),
      description: "ブラジルはリオデジャネイロからブラジリアへ、ナイジェリアはラゴスからアブジャへ首都を移しました。どちらも新しい首都の建設を進めた国です。",
      countries: ["br", "ng"],
    },
    117: {
      name: "設計された未来都市", condition: "首都クイズ1プレイでオーストラリア・ブラジルを正解", mode: "capital_only",
      check: pairCheck("au", "br", { capitalOnly: true }),
      description: "キャンベラとブラジリアは、首都として計画的に整備された都市です。道路や公共施設の配置にも、都市計画の考え方が反映されています。",
      countries: ["au", "br"],
    },
    118: {
      name: "天空の王座", condition: "首都クイズ1プレイでボリビア・エクアドルを正解", mode: "capital_only",
      check: pairCheck("bo", "ec", { capitalOnly: true }),
      description: "スクレとキトは、どちらもアンデス山脈の高地に位置する首都です。山々に囲まれた標高の高い場所に、国の政治の中心があります。",
      countries: ["bo", "ec"],
    },
    119: {
      name: "国境の守護都市", condition: "首都クイズ1プレイでスロバキア・コンゴ共和国を正解", mode: "capital_only",
      check: pairCheck("sk", "cg", { capitalOnly: true }),
      description: "ブラチスラバはオーストリアやハンガリーとの国境近くにあります。ブラザビルはコンゴ川を挟んで、コンゴ民主共和国の首都キンシャサと向かい合っています。",
      countries: ["sk", "cg"],
    },
    120: {
      name: "古代文明の継承者", condition: "首都クイズ1プレイでギリシャ・エジプトを正解", mode: "capital_only",
      check: pairCheck("gr", "eg", { capitalOnly: true }),
      description: "アテネのあるギリシャと、カイロのあるエジプトには、古代から続く豊かな歴史があります。二つの首都は、それぞれの国の歴史や文化を知るための重要な都市です。",
      countries: ["gr", "eg"],
    },
    121: {
      name: "帝国の記憶", condition: "首都クイズ1プレイでイタリア・トルコを正解", mode: "capital_only",
      check: pairCheck("it", "tr", { capitalOnly: true }),
      description: "ローマは古代ローマ帝国の中心地でした。一方、トルコにはオスマン帝国の歴史があります。現在の首都はアンカラですが、帝国時代の首都とは異なります。",
      countries: ["it", "tr"],
    },
    122: {
      name: "王冠の都", condition: "首都クイズ1プレイでイギリス・スペインを正解", mode: "capital_only",
      check: pairCheck("gb", "es", { capitalOnly: true }),
      description: "ロンドンとマドリードは、どちらも国王を元首とする国の首都です。王室に関わる歴史的な建物や文化が残っています。",
      countries: ["gb", "es"],
    },
    123: {
      name: "革命の炎", condition: "首都クイズ1プレイでフランス・アメリカを正解", mode: "capital_only",
      check: pairCheck("fr", "us", { capitalOnly: true }),
      description: "フランスとアメリカは、18世紀の革命を通じて国家のあり方を大きく変えました。パリとワシントンD.C.は、現在それぞれの国の政治の中心となっています。",
      countries: ["fr", "us"],
    },
    124: {
      name: "東西文明の交差点", condition: "首都クイズ1プレイでトルコ・ギリシャを正解", mode: "capital_only",
      check: pairCheck("tr", "gr", { capitalOnly: true }),
      description: "トルコとギリシャは、エーゲ海を挟んで向かい合う国々です。アンカラとアテネを首都とする両国には、長い歴史の中で文化が交流してきたつながりがあります。",
      countries: ["tr", "gr"],
    },
    125: {
      name: "新時代の首都", condition: "首都クイズ1プレイでパキスタン・ベリーズを正解", mode: "capital_only",
      check: pairCheck("pk", "bz", { capitalOnly: true }),
      description: "イスラマバードとベルモパンは、どちらも20世紀に新しい首都として整備された都市です。それぞれカラチ、ベリーズシティに代わって政治の中心となりました。",
      countries: ["pk", "bz"],
    },
    126: {
      name: "千年の都の系譜", condition: "首都クイズ1プレイで中国・日本を正解", mode: "capital_only",
      check: pairCheck("cn", "jp", { capitalOnly: true }),
      description: "北京と東京は、東アジアを代表する首都です。中国と日本は、長い歴史の中で政治や文化の中心地を築き、現在の首都へとつながっています。",
      countries: ["cn", "jp"],
    },
    127: {
      name: "ドナウの双璧", condition: "首都クイズ1プレイでオーストリア・ハンガリーを正解", mode: "capital_only",
      check: pairCheck("at", "hu", { capitalOnly: true }),
      description: "ウィーンとブダペストは、どちらもドナウ川沿いにある首都です。ヨーロッパを流れる大河が、二つの歴史ある都を結んでいます。",
      countries: ["at", "hu"],
    },
    128: {
      name: "大河の支配者", condition: "首都クイズ1プレイでエジプト・イラクを正解", mode: "capital_only",
      check: pairCheck("eg", "iq", { capitalOnly: true }),
      description: "カイロはナイル川沿い、バグダッドはチグリス川沿いにある首都です。どちらも大きな川と深い関わりを持ちながら発展してきました。",
      countries: ["eg", "iq"],
    },
    129: {
      name: "赤道の番人", condition: "首都クイズ1プレイでエクアドル・ウガンダを正解", mode: "capital_only",
      check: pairCheck("ec", "ug", { capitalOnly: true }),
      description: "キトとカンパラは、どちらも赤道に近い地域にある首都です。南米とアフリカという離れた大陸にありながら、赤道という共通点で結ばれています。",
      countries: ["ec", "ug"],
    },
    130: {
      name: "北極への扉", condition: "首都クイズ1プレイでアイスランド・フィンランドを正解", mode: "capital_only",
      check: pairCheck("is", "fi", { capitalOnly: true }),
      description: "レイキャビクとヘルシンキは、どちらもヨーロッパ北部に位置する首都です。北の地域ならではの長い夏の日照時間や、冬の日の短さが特徴です。",
      countries: ["is", "fi"],
    },
    131: {
      name: "太平洋の秘宝", condition: "首都クイズ1プレイでフィジー・サモアを正解", mode: "capital_only",
      check: pairCheck("fj", "ws", { capitalOnly: true }),
      description: "スバとアピアは、どちらも南太平洋の島国の首都です。海に囲まれた島々で、独自の文化や暮らしが育まれてきました。",
      countries: ["fj", "ws"],
    },
    132: {
      name: "大洋の孤島", condition: "首都クイズ1プレイでモルディブ・セーシェルを正解", mode: "capital_only",
      check: pairCheck("mv", "sc", { capitalOnly: true }),
      description: "マレとビクトリアは、どちらもインド洋の島国にある首都です。美しい海と島々に囲まれた国の政治の中心となっています。",
      countries: ["mv", "sc"],
    },
    133: {
      name: "カリブの覇者", condition: "首都クイズ1プレイでキューバ・ジャマイカを正解", mode: "capital_only",
      check: pairCheck("cu", "jm", { capitalOnly: true }),
      description: "ハバナとキングストンは、どちらもカリブ海地域の島国の首都です。音楽や文化が豊かな地域としても知られています。",
      countries: ["cu", "jm"],
    },
    134: {
      name: "南米の双星", condition: "首都クイズ1プレイでアルゼンチン・ウルグアイを正解", mode: "capital_only",
      check: pairCheck("ar", "uy", { capitalOnly: true }),
      description: "ブエノスアイレスとモンテビデオは、ラプラタ川の広い河口域を挟んで向かい合う首都です。南米の歴史や文化を共有する二つの都市です。",
      countries: ["ar", "uy"],
    },
    135: {
      name: "ゲルマンの双都", condition: "首都クイズ1プレイでドイツ・オーストリアを正解", mode: "capital_only",
      check: pairCheck("de", "at", { capitalOnly: true }),
      description: "ベルリンとウィーンは、どちらもドイツ語を公用語とする国の首都です。言葉だけでなく、音楽や歴史などにも共通する文化が見られます。",
      countries: ["de", "at"],
    },
    136: {
      name: "イベリアの王冠", condition: "首都クイズ1プレイでスペイン・ポルトガルを正解", mode: "capital_only",
      check: pairCheck("es", "pt", { capitalOnly: true }),
      description: "マドリードとリスボンは、イベリア半島にある二つの国の首都です。スペインとポルトガルは隣り合い、長い歴史を持っています。",
      countries: ["es", "pt"],
    },
    137: {
      name: "北欧の双星", condition: "首都クイズ1プレイでノルウェー・スウェーデンを正解", mode: "capital_only",
      check: pairCheck("no", "se", { capitalOnly: true }),
      description: "オスロとストックホルムは、スカンディナビア半島に広がる二つの国の首都です。ノルウェーとスウェーデンは国境を接し、歴史的にも深いつながりがあります。",
      countries: ["no", "se"],
    },
    138: {
      name: "メコンの絆", condition: "首都クイズ1プレイでラオス・カンボジアを正解", mode: "capital_only",
      check: pairCheck("la", "kh", { capitalOnly: true }),
      description: "ビエンチャンとプノンペンは、どちらもメコン川沿いにある首都です。東南アジアを流れる大河が、二つの国の暮らしや文化を支えています。",
      countries: ["la", "kh"],
    },
    139: {
      name: "砂漠の双璧", condition: "首都クイズ1プレイでカタール・バーレーンを正解", mode: "capital_only",
      check: pairCheck("qa", "bh", { capitalOnly: true }),
      description: "ドーハとマナーマは、どちらもペルシャ湾沿岸地域にある首都です。カタールとバーレーンは、アラビア半島周辺に位置する近隣の国々です。",
      countries: ["qa", "bh"],
    },
    140: {
      name: "中央アジアの覇者", condition: "首都クイズ1プレイでカザフスタン・ウズベキスタンを正解", mode: "capital_only",
      check: pairCheck("kz", "uz", { capitalOnly: true }),
      description: "アスタナとタシケントは、どちらも中央アジアにある首都です。カザフスタンとウズベキスタンは隣り合い、シルクロードや地域の歴史と深い関わりがあります。",
      countries: ["kz", "uz"],
    },
    141: {
      name: "世界の果ての双星", condition: "首都クイズ1プレイでニュージーランド・チリを正解", mode: "capital_only",
      check: pairCheck("nz", "cl", { capitalOnly: true }),
      description: "ウェリントンとサンティアゴは、どちらも南半球にある首都です。太平洋を挟んだ遠い地域にありながら、南半球という共通点を持っています。",
      countries: ["nz", "cl"],
    },
  };

  // ========================================================
  // Stage E: トロフィー一覧画面(新規)向けのカテゴリ分類。
  // docs/trophy-spec-final.md 2章の照合テーブルが採用している番号区分
  // (#1〜19・20〜29・30〜39・40〜59・60〜70・71〜100・101〜112)をそのまま
  // カテゴリ境界として使う(名称・獲得条件・check関数は一切変更しない。
  // 表示用の分類ラベルを追加するだけ)。
  // ========================================================
  const TROPHY_CATEGORIES = [
    { id: "progress", label: "挑戦の記録", range: "#1〜19" },
    { id: "speed", label: "スピードチャレンジ", range: "#20〜29" },
    { id: "region", label: "地域制覇", range: "#30〜39" },
    { id: "double", label: "国旗・首都制覇", range: "#40〜59" },
    { id: "special", label: "特別チャレンジ", range: "#60〜70" },
    { id: "trivia", label: "国旗トリビア", range: "#71〜100" },
    { id: "legacy", label: "称号コレクション", range: "#101〜112" },
    { id: "capital_trivia", label: "首都トリビア", range: "#113〜141" },
  ];
  function categoryForNumber(number) {
    if (number <= 19) return "progress";
    if (number <= 29) return "speed";
    if (number <= 39) return "region";
    if (number <= 59) return "double";
    if (number <= 70) return "special";
    if (number <= 100) return "trivia";
    if (number <= 112) return "legacy";
    return "capital_trivia";
  }
  function getCategories() {
    return TROPHY_CATEGORIES.slice();
  }

  // TROPHIESの該当スロットにSTAGE_B_DEFINITIONS/STAGE_D_DEFINITIONS/
  // STAGE_CAPITAL_TRIVIA_DEFINITIONS等の内容を反映する。定義に無い番号は
  // null/未確定のまま変更しない。description/countriesは首都トリビア
  // (#113〜141)用の追加フィールドで、定義に含まれない場合はnullのまま
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
      t.description = typeof def.description === "string" ? def.description : null;
      t.countries = Array.isArray(def.countries) ? def.countries.slice() : null;
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
    for (let number = 1; number <= MAX_TROPHY_NUMBER; number++) {
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
        // 首都トリビア(#113〜141)用: 長文の解説文(獲得後に表示)と、
        // 対象2か国のid配列(表示時にjs/countries.jsから国名・首都名を
        // 導出するための参照)。該当しないトロフィーはnullのまま
        description: null,
        countries: null,
        // 第2段階で追加: どのモードの記録かを区別するためのフィールド。
        // "flag" | "capital" | "both"(国旗・首都両方の組合せ) |
        // "flag_only" | "capital_only" | null(未確定)。
        // 値自体はまだ1件も確定していない
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

  // Stage E追加検討(隠しトロフィー調査)を経て、ユーザー指示により正式確定した
  // 隠しトロフィー12件(以前検討した36件案は不採用)。名称・条件・modeの値
  // そのものは一切変更せず、表示用のhiddenフラグのみをここで真にする。
  // #53奇跡の一問・#61ラストワンの魔法・#62虹の架け橋・#64真夜中の探検家・
  // #65奇跡の数字・#67世界の反対側・#70早朝の探検家・#75型破りな国旗たち・
  // #86国旗の中に武器!?・#87国旗の動物園・#88国旗の中の地図・
  // #89国旗が語りかける(docs/trophy-spec-final.md「7. 隠しトロフィー仕様」参照)
  const HIDDEN_TROPHY_NUMBERS = new Set([53, 61, 62, 64, 65, 67, 70, 75, 86, 87, 88, 89]);

  const TROPHIES = buildTrophyDefinitions();
  applyStageBDefinitions(TROPHIES, STAGE_B_DEFINITIONS);
  applyStageBDefinitions(TROPHIES, STAGE_D_DEFINITIONS);
  applyStageBDefinitions(TROPHIES, STAGE_CAPITAL_TRIVIA_DEFINITIONS);
  // category/hiddenのみをここで補完する(name/condition/mode/checkは
  // applyStageBDefinitions()が設定した値から一切変更しない)。
  // - category: 上記categoryForNumber()による分類(表示用ラベルのみ)
  // - hidden: 上記HIDDEN_TROPHY_NUMBERSの12件のみtrue、残り95件はfalse
  TROPHIES.forEach((t) => {
    t.category = categoryForNumber(t.number);
    t.hidden = HIDDEN_TROPHY_NUMBERS.has(t.number);
  });
  const TROPHY_BY_ID = new Map(TROPHIES.map((t) => [t.id, t]));

  // ---------- 自己検証(既存のjs/app.js冒頭・js/findcountry.jsのvalidatePools()
  // と同じ、console.assertベースの開発時チェック。問題が無ければ何も出力しない) ----------
  (function validateTrophyDefinitions() {
    console.assert(TROPHIES.length === 136, `トロフィー定義が136件ではありません(実際: ${TROPHIES.length}件)`);
    const numbers = new Set(TROPHIES.map((t) => t.number));
    console.assert(numbers.size === TROPHIES.length, "トロフィー定義のnumberに重複があります");
    const ids = new Set(TROPHIES.map((t) => t.id));
    console.assert(ids.size === TROPHIES.length, "トロフィー定義のidに重複があります");
    SKIPPED_NUMBERS.forEach((n) => {
      console.assert(!numbers.has(n), `欠番(${n})がトロフィー定義に含まれています`);
    });
    // Stage B・D・首都トリビアで列挙した件数の合計だけがconfirmed:trueに
    // なっていることを確認する(STAGE_B_DEFINITIONS 79件+STAGE_D_DEFINITIONS
    // 28件+STAGE_CAPITAL_TRIVIA_DEFINITIONS 29件=136件全てが確定するはず。
    // 反映漏れ・重複登録が無いかの自己チェック。既存107件分の内訳
    // (79件+28件=107件)は従来どおりの条件として残し、新規29件とは別に
    // 区別して検証できるようにしている)
    const confirmedCount = TROPHIES.filter((t) => t.confirmed).length;
    const stageBNumbers = Object.keys(STAGE_B_DEFINITIONS).map(Number);
    const stageDNumbers = Object.keys(STAGE_D_DEFINITIONS).map(Number);
    const capitalTriviaNumbers = Object.keys(STAGE_CAPITAL_TRIVIA_DEFINITIONS).map(Number);
    console.assert(
      stageBNumbers.every((n) => !stageDNumbers.includes(n)),
      "STAGE_B_DEFINITIONSとSTAGE_D_DEFINITIONSで番号が重複しています"
    );
    console.assert(
      capitalTriviaNumbers.every((n) => !stageBNumbers.includes(n) && !stageDNumbers.includes(n)),
      "STAGE_CAPITAL_TRIVIA_DEFINITIONSが既存のSTAGE_B_DEFINITIONS/STAGE_D_DEFINITIONSと番号が重複しています"
    );
    const existingConfirmedCount = stageBNumbers.length + stageDNumbers.length;
    console.assert(existingConfirmedCount === 107, `既存のStage B・Dで107件全てが確定するはずが、合計が107件になっていません(実際: ${existingConfirmedCount}件)`);
    console.assert(capitalTriviaNumbers.length === 29, `首都トリビアの定義が29件ではありません(実際: ${capitalTriviaNumbers.length}件)`);
    const expectedConfirmedCount = existingConfirmedCount + capitalTriviaNumbers.length;
    console.assert(confirmedCount === expectedConfirmedCount, `Stage B・D・首都トリビアで確定したはずのトロフィー件数が一致しません(期待値: ${expectedConfirmedCount}件、実際: ${confirmedCount}件)`);
    console.assert(expectedConfirmedCount === 136, `136件全てが確定するはずが、合計が136件になっていません(実際: ${expectedConfirmedCount}件)`);
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
    // Stage E+首都トリビア追加: 136件全てに有効なcategoryが設定されていること、
    // カテゴリの合計件数が136件と一致すること(分類漏れ・重複分類が無いことの確認)
    const categoryIds = new Set(TROPHY_CATEGORIES.map((c) => c.id));
    console.assert(categoryIds.size === TROPHY_CATEGORIES.length, "TROPHY_CATEGORIESのidに重複があります");
    console.assert(
      TROPHIES.every((t) => typeof t.category === "string" && categoryIds.has(t.category)),
      "カテゴリが未設定、または未知のカテゴリのトロフィーがあります"
    );
    const categoryTotal = TROPHY_CATEGORIES.reduce((sum, c) => sum + TROPHIES.filter((t) => t.category === c.id).length, 0);
    console.assert(categoryTotal === 136, `カテゴリ別件数の合計が136件になっていません(実際: ${categoryTotal}件)`);
    const capitalTriviaCategoryCount = TROPHIES.filter((t) => t.category === "capital_trivia").length;
    console.assert(capitalTriviaCategoryCount === 29, `首都トリビアカテゴリの件数が29件ではありません(実際: ${capitalTriviaCategoryCount}件)`);
    // 隠しトロフィーは正式確定した12件のみ(HIDDEN_TROPHY_NUMBERS)。それ以外の
    // 95件はhidden:falseであること、12件という件数そのものも確認する
    const hiddenDefs = TROPHIES.filter((t) => t.hidden === true);
    console.assert(hiddenDefs.length === 12, `隠しトロフィーが12件ではありません(実際: ${hiddenDefs.length}件)`);
    console.assert(
      hiddenDefs.every((t) => HIDDEN_TROPHY_NUMBERS.has(t.number)) && TROPHIES.filter((t) => !t.hidden).every((t) => !HIDDEN_TROPHY_NUMBERS.has(t.number)),
      "hiddenフラグが正式確定した12件(HIDDEN_TROPHY_NUMBERS)と一致していません"
    );
    console.assert(TROPHIES.every((t) => typeof t.hidden === "boolean"), "hiddenがboolean以外のトロフィーがあります");
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

  function isNonNegativeInteger(v) {
    return Number.isInteger(v) && v >= 0;
  }

  // 国idがjs/countries.jsのCOUNTRIES(198件)に実在するかどうか。
  // countryRegionById()が既に持つキャッシュをそのまま再利用し(#62用に
  // Stage Bで追加済み)、同じ探索をもう一つ作らない
  function isKnownCountryId(id) {
    return typeof id === "string" && countryRegionById(id) !== null;
  }

  // {flag: n, capital: n} の形(nは0以上の整数)かどうか(#58・60用)
  function isValidModeCountPair(v) {
    return isPlainObject(v) && isNonNegativeInteger(v.flag) && isNonNegativeInteger(v.capital);
  }

  // {countryId: true, ...} の形かどうか(未知のidや値がtrue以外のものは
  // 許容しない。#30〜38・63・68用)
  function isBooleanTrueMap(v) {
    if (!isPlainObject(v)) return false;
    return Object.keys(v).every((id) => isKnownCountryId(id) && v[id] === true);
  }

  // {countryId: n, ...} の形かどうか(nは0以上の整数。#39用)
  function isCountMap(v) {
    if (!isPlainObject(v)) return false;
    return Object.keys(v).every((id) => isKnownCountryId(id) && isNonNegativeInteger(v[id]));
  }

  // fastAnswerCountsのモード別バケット({within2s?, within3s?}。#21・26・27用)
  function isFastAnswerModeBucket(v) {
    if (!isPlainObject(v)) return false;
    return Object.keys(v).every((k) => (k === "within2s" || k === "within3s") && isNonNegativeInteger(v[k]));
  }

  // lastCourseResultのモード別マップ({"10":{correct,total}, ...}。#66用。
  // コースのキーは既存6コース(ALL_COURSE_COUNTS)のいずれかの文字列のみ許容する
  function isCourseResultMap(v) {
    if (!isPlainObject(v)) return false;
    const validKeys = ALL_COURSE_COUNTS.map(String);
    return Object.keys(v).every((k) => {
      if (!validKeys.includes(k)) return false;
      const rec = v[k];
      return isPlainObject(rec) && isNonNegativeInteger(rec.correct) && isNonNegativeInteger(rec.total) && rec.correct <= rec.total;
    });
  }

  // バージョン不一致・壊れたデータ・旧形式のいずれでも安全側に倒し、
  // 空の初期データとして扱う(既存のloadTrophyData()と同じ考え方)。
  // Stage Aでは骨組みのみで実際に書き込まれることが無かったため、各
  // フィールドの最上位がplain objectであることだけを確認していたが、
  // Stage Cから実際にrecordQuizStats()が書き込むようになったため、国idごとの
  // 値・モード別の数値まで形を確認し、1つでも想定と違えば丸ごと初期化する
  // (部分的に壊れたデータを中途半端に信用しない)
  function isValidTrophyStats(data) {
    return isPlainObject(data)
      && data.version === TROPHY_STATS_VERSION
      && isValidModeCountPair(data.perfectCounts)
      && isPlainObject(data.fastAnswerCounts) && isFastAnswerModeBucket(data.fastAnswerCounts.flag) && isFastAnswerModeBucket(data.fastAnswerCounts.capital)
      && isValidModeCountPair(data.partialStreakCounts)
      && isPlainObject(data.countryCorrectEver) && isBooleanTrueMap(data.countryCorrectEver.flag) && isBooleanTrueMap(data.countryCorrectEver.capital)
      && isPlainObject(data.countryCorrectCount) && isCountMap(data.countryCorrectCount.flag) && isCountMap(data.countryCorrectCount.capital)
      && isPlainObject(data.countryWrongEver) && isBooleanTrueMap(data.countryWrongEver.flag) && isBooleanTrueMap(data.countryWrongEver.capital)
      && isPlainObject(data.lastCourseResult) && isCourseResultMap(data.lastCourseResult.flag) && isCourseResultMap(data.lastCourseResult.capital);
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
  // localStorageには影響しない)。
  function getStats() {
    return JSON.parse(JSON.stringify(loadTrophyStats()));
  }

  // ========================================================
  // Stage C: 統計・履歴の記録(判定は一切行わない)。
  // js/app.jsのfinishQuiz()から、evaluateQuizFinish()(判定エンジン)の直後に
  // 1回だけ呼ばれる想定。完了していないプレイ(「終了する」での中断)では
  // finishQuiz()自体が呼ばれないため、ここに到達することもなく、既存の
  // 「プレイ回数は完了時のみ加算」という原則と自動的に揃う。
  //
  // context: evaluateQuizFinish()と同じ形に、Stage Cで追加した
  // startedAt(プレイ開始時刻のISO文字列)・answerTimings(各問題の
  // { countryId, correct, elapsedSeconds } 配列)を加えたもの。
  //
  // 重要: lastCourseResult(#66用)はこの関数が「直前の値を上書きする」。
  // 将来Stage C以降で#66の判定ロジックを実装する際は、そのロジックを
  // 必ずrecordQuizStats()より前(evaluateQuizFinish()の中、またはそれより
  // 前)に置き、上書き前の値を読むこと。呼び出し順を変えると「直前の
  // プレイ」の比較対象が自分自身になってしまう。
  // ========================================================
  function recordQuizStats(context) {
    try {
      if (!context || (context.mode !== "flag" && context.mode !== "capital")) return false;
      const mode = context.mode;
      const total = context.total;
      const correct = context.correct;
      if (!Number.isFinite(total) || !Number.isFinite(correct)) return false;
      const stats = loadTrophyStats();

      // #58用: 198問コースでの満点回数(モード別)
      if (total === 198 && correct === total) {
        stats.perfectCounts[mode] = stats.perfectCounts[mode] + 1;
      }

      // #60用: 10問コースで9問正解だった回数(モード別。判定時に合算する想定)
      if (total === 10 && correct === 9) {
        stats.partialStreakCounts[mode] = stats.partialStreakCounts[mode] + 1;
      }

      // #21・26・27用: 正解かつ2秒/3秒以内だった回答の累計回数(モード別)。
      // 2秒以内の正解は3秒以内の条件も満たすため、両方のカウンタに加算する
      if (Array.isArray(context.answerTimings)) {
        context.answerTimings.forEach((t) => {
          if (!t || !t.correct || !Number.isFinite(t.elapsedSeconds)) return;
          if (t.elapsedSeconds <= 3) stats.fastAnswerCounts[mode].within3s = (stats.fastAnswerCounts[mode].within3s || 0) + 1;
          if (t.elapsedSeconds <= 2) stats.fastAnswerCounts[mode].within2s = (stats.fastAnswerCounts[mode].within2s || 0) + 1;
        });
      }

      // #30〜39用: 国別の生涯正解履歴(真偽値+回数、モード別)
      if (Array.isArray(context.correctIds)) {
        context.correctIds.forEach((id) => {
          if (!isKnownCountryId(id)) return;
          stats.countryCorrectEver[mode][id] = true;
          stats.countryCorrectCount[mode][id] = (stats.countryCorrectCount[mode][id] || 0) + 1;
        });
      }

      // #63・68用: 国別の誤答履歴(モード別、真偽値のみ)。#63は同じモードの
      // 履歴を、#68は国旗側の履歴を首都プレイ側の判定が参照する想定のため、
      // モードをまたいで混ぜずそれぞれ別に保持する
      if (Array.isArray(context.wrongIds)) {
        context.wrongIds.forEach((id) => {
          if (!isKnownCountryId(id)) return;
          stats.countryWrongEver[mode][id] = true;
        });
      }

      // #66用: 同一モード・同一コースの「直前の完了プレイ」の結果を、
      // 今回の結果で上書きする(関数コメント参照。将来の判定はこの行より
      // 前で旧い値を読む必要がある)
      stats.lastCourseResult[mode][String(total)] = { correct, total };

      return saveTrophyStats(stats);
    } catch (e) {
      console.warn("トロフィー統計の記録に失敗しました", e);
      return false;
    }
  }

  // ---------- 公開API ----------
  // 136件すべての定義を返す(読み取り専用の用途を想定。一覧画面・
  // 判定処理の両方がここを参照する)
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
    getCategories,
    getEarned,
    isEarned,
    awardIfNew,
    getProgressSummary,
    getStats,
    recordQuizStats,
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
