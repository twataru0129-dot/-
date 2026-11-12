// ==========================================================
// トロフィー刷新 第1段階: 新トロフィーシステム(107項目)の土台
//
// 目的: 既存の称号(js/quiz.jsのTITLES/CAPITAL_TITLES、国旗6件+首都6件=
// 計12件)には一切手を加えず、それとは完全に独立した新しいトロフィー
// システムの「定義・保存・読み込み・重複獲得防止」の基本機能だけを
// 用意する。
//
// 今回の段階で行わないこと(次の段階以降の作業):
// - 既存クイズ(国旗/首都/「世界の国どこかな？」)の正誤判定・結果画面
//   からこのモジュールを呼び出す接続処理
// - トロフィー専用の新しい表示画面(一覧・獲得演出等)
// - 「プレイ回数」「累計正解数」等、判定に使う新しい累計記録の実装
//   (この段階では保存の入れ物すら作らない。必要になった段階で、その
//   記録は導入後の挙動からのみ計測を開始する設計にする想定)
//
// 企画の確定仕様: 既存12項目+新規95項目の合計107項目。通し番号は
// 1〜112で、50・55・56・57・90番が欠番(112-5=107件)。
//
// 重要: 2024年時点でこの107項目それぞれの正式名称・獲得条件は
// まだ提供されていない(調査段階で「詳細な107項目の獲得条件は別途
// 提供します」とされたのみで、実際の一覧はまだ受け取っていない)。
// そのため、ここでは107個分の「通し番号の枠(スロット)」だけを用意し、
// name/condition/category/hiddenはすべて null(未確定)のままにしている。
// 正式な一覧を受け取り次第、このTROPHIESの中身だけを更新すればよい
// 構成にしてあり、保存・読み込み・重複防止のAPI(TrophyModuleの公開
// 関数)自体は変更が不要なはずである。
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

  return {
    getAllDefinitions,
    getDefinition,
    getDefinitionByNumber,
    getEarned,
    isEarned,
    awardIfNew,
    getProgressSummary,
  };
})();
