// ==========================================================
// トロフィー刷新 第1段階+第2段階+Stage A: 新トロフィーシステム(107項目)の土台
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
