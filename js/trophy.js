// ==========================================================
// トロフィー刷新 第1段階+第2段階: 新トロフィーシステム(107項目)の土台
//
// 目的: 既存の称号(js/quiz.jsのTITLES/CAPITAL_TITLES、国旗6件+首都6件=
// 計12件)には一切手を加えず、それとは完全に独立した新しいトロフィー
// システムの「定義・保存・読み込み・重複獲得防止」の基本機能(第1段階)に、
// 「判定エンジン・モード区別・既存データからの導出ヘルパー・実クイズへの
// 接続」(第2段階)を追加する。
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
// 第2段階でも行っていないこと(未確定のまま):
// - トロフィー専用の新しい表示画面
// - 「プレイ回数」「累計正解数」「過去の誤答履歴」「国旗/首都の回答速度」等、
//   新しい永続記録が必要な判定の実装(保存領域の追加は未実施。設計方針の
//   みreportで検討している)
// - 107項目のうち1件も、正式な名称・獲得条件・numberへの割り当てが
//   提供されていないため、実際にconfirmed:trueになっているスロットは
//   ゼロ件のまま
//
// 企画の確定仕様: 既存12項目+新規95項目の合計107項目。通し番号は
// 1〜112で、50・55・56・57・90番が欠番(112-5=107件)。
//
// 重要: この107項目それぞれの正式名称・獲得条件はまだ提供されていない
// (リポジトリ内・PR#56のコメント・過去のやり取りのいずれにも実際の一覧は
// 無いことを第2段階開始時に確認済み)。そのため、ここでは107個分の
// 「通し番号の枠(スロット)」だけを用意し、name/condition/category/hidden/
// mode/checkはすべて null(未確定)のままにしている。正式な一覧を受け取り
// 次第、このTROPHIESの中身だけを更新すればよい構成にしてあり、保存・
// 読み込み・重複防止・判定エンジンのAPI(TrophyModuleの公開関数)自体は
// 変更が不要なはずである。
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

  // 企画の確定仕様どおりの欠番(50・55・56・57・90)
  const SKIPPED_NUMBERS = [50, 55, 56, 57, 90];

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
    // 第2段階時点では正式な条件が1件も確認できていないため、
    // confirmed:trueになっているスロットが無いことも併せて確認する
    // (推測で埋めていないことの自己チェック)
    const confirmedCount = TROPHIES.filter((t) => t.confirmed).length;
    console.assert(confirmedCount === 0, `未確定のはずのトロフィーがconfirmed:trueになっています(${confirmedCount}件)`);
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

  // 獲得済みトロフィーを { [id]: { earnedAt } } の形で読み取り専用に返す。
  // 不正なid(定義に存在しないid)のエントリーはここで除外する
  // (js/storage.jsのgetFindCountryCollection()と同じ防御的な考え方)
  function getEarned() {
    const data = loadTrophyData();
    const sanitized = {};
    Object.keys(data.earned).forEach((id) => {
      const entry = data.earned[id];
      if (isValidTrophyId(id) && entry && typeof entry.earnedAt === "string" && !Number.isNaN(Date.parse(entry.earnedAt))) {
        sanitized[id] = { earnedAt: entry.earnedAt };
      }
    });
    return sanitized;
  }

  function isEarned(id) {
    return Object.prototype.hasOwnProperty.call(getEarned(), id);
  }

  // 新規獲得として記録する。戻り値: 実際に新規記録できればtrue。
  // 不正なid・既に獲得済み・保存失敗のいずれでもfalseを返し、何も変えない
  // (同じidで何度呼んでも安全。js/storage.jsのawardTitleIfNew()・
  // captureFindCountryEntry()と同じ重複防止の考え方)
  function awardIfNew(id) {
    try {
      if (!isValidTrophyId(id)) return false;
      const data = loadTrophyData();
      if (data.earned[id]) return false;
      data.earned[id] = { earnedAt: new Date().toISOString() };
      return saveTrophyData(data);
    } catch (e) {
      console.warn("トロフィーの獲得記録に失敗しました", e);
      return false;
    }
  }

  // 獲得数の概要(将来の一覧画面での「n / 107 獲得」のような表示を想定した
  // 補助関数。今回はまだどこからも呼ばれない)
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
  function evaluate(context) {
    const awardedIds = [];
    TROPHIES.forEach((t) => {
      if (!t.confirmed || typeof t.check !== "function") return;
      if (isEarned(t.id)) return; // 既に獲得済みなら判定自体を省略する
      let qualifies = false;
      try {
        qualifies = !!t.check(context);
      } catch (e) {
        console.warn(`トロフィー判定関数でエラーが発生しました(number=${t.number})`, e);
        qualifies = false;
      }
      if (qualifies && awardIfNew(t.id)) {
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

  return {
    getAllDefinitions,
    getDefinition,
    getDefinitionByNumber,
    getEarned,
    isEarned,
    awardIfNew,
    getProgressSummary,
    isModeTitlePerfectEarned,
    isBothModesTitlePerfectEarned,
    getFindCountryRegionProgress,
    arePairCorrect,
    evaluate,
    evaluateQuizFinish,
    evaluateFindCountryResult,
  };
})();
