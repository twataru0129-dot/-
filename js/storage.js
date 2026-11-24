// ==========================================================
// localStorage を使った保存データの管理
// 効果音設定・称号・挑戦回数・最高記録などをここで扱う
// ==========================================================

const STORAGE_PREFIX = "wfq_v1_";

// 国旗クイズ(既存)のキーは今までどおり据え置き、既存ユーザーのデータを壊さない。
// 首都クイズは "wfq_v1_capital_xxx" という別キーで完全に分けて保存する。
const StorageKeys = {
  SOUND: STORAGE_PREFIX + "sound_enabled", // 効果音設定はモード共通
  TITLES: STORAGE_PREFIX + "earned_titles",
  ATTEMPTS: STORAGE_PREFIX + "attempts_count",
  BEST_RATE: STORAGE_PREFIX + "best_rate",
  BEST_RECORDS: STORAGE_PREFIX + "best_records",
};

const CapitalStorageKeys = {
  TITLES: STORAGE_PREFIX + "capital_earned_titles",
  ATTEMPTS: STORAGE_PREFIX + "capital_attempts_count",
  BEST_RATE: STORAGE_PREFIX + "capital_best_rate",
  BEST_RECORDS: STORAGE_PREFIX + "capital_best_records",
};

// 「世界の国どこかな？」第5段階前半: ランキング・成績保存。国旗/首都クイズとは
// 完全に別のキーに保存し、既存のStorageKeys/CapitalStorageKeysには一切触れない
const FINDCOUNTRY_RANKING_KEY = STORAGE_PREFIX + "findcountry_ranking";
// 追加修正(名前入力・正解数ベースのクリア条件)でレコードの意味・出題数の
// 数え方が変わるため、バージョンを2に上げて旧形式のデータは読み込まない
// (テスト段階のため、互換性維持より確定仕様への統一を優先する)
const FINDCOUNTRY_RANKING_VERSION = 2;
const FINDCOUNTRY_RANKING_TOP_N = 5;
const FINDCOUNTRY_NAME_MAX_LENGTH = 12;

// 「世界の国どこかな？」第5段階後半: コレクション(正解した国・地域の収集)。
// ランキングともクイズのstate(wrongIds等)とも完全に独立した専用キーに保存する
const FINDCOUNTRY_COLLECTION_KEY = STORAGE_PREFIX + "findcountry_collection";
const FINDCOUNTRY_COLLECTION_VERSION = 1;

// 世界図鑑トロフィー(第5段階、No.143〜158)用: 図鑑での「閲覧した国・地域」
// 「地図連携から確認した国」「復習から見た国」の3種類の記録。いずれも
// COUNTRIES(198件)のみを対象にし、MAP_ONLY_REGIONS(18件、地図専用)は
// 対象外にする。トロフィー自体の獲得状態は既存のTROPHY_KEY(js/trophy.js)
// を引き続き使うため、ここは「何を見た・確認したか」という素の記録だけを持つ
const ENCYCLOPEDIA_VISITED_KEY = STORAGE_PREFIX + "encyclopedia_visited";
const ENCYCLOPEDIA_VISITED_VERSION = 1;
const ENCYCLOPEDIA_MAP_CHECKED_KEY = STORAGE_PREFIX + "encyclopedia_map_checked";
const ENCYCLOPEDIA_MAP_CHECKED_VERSION = 1;
const ENCYCLOPEDIA_REVIEWED_KEY = STORAGE_PREFIX + "encyclopedia_reviewed";
const ENCYCLOPEDIA_REVIEWED_VERSION = 1;
// 世界図鑑トロフィー追加分(No.259〜262)用の記録。既存の3キー(閲覧・地図
// 連携・復習、いずれもCOUNTRIES 198件のみ対象)とは別に、対象範囲が異なる
// 記録を2種類追加する。既存のキー・バージョン・対象範囲(COUNTRIES専用)は
// 一切変更しない
// - ENCYCLOPEDIA_REGION_VISITED: MAP_ONLY_REGIONS(18件、地図専用地域)の
//   閲覧記録。「未知なる領域の探究者」用
// - ENCYCLOPEDIA_SEARCH_OPENED: 図鑑の検索結果から詳細画面を開いた記録。
//   COUNTRIES+MAP_ONLY_REGIONS(216件)が対象。「知識の道しるべ」用
const ENCYCLOPEDIA_REGION_VISITED_KEY = STORAGE_PREFIX + "encyclopedia_region_visited";
const ENCYCLOPEDIA_REGION_VISITED_VERSION = 1;
const ENCYCLOPEDIA_SEARCH_OPENED_KEY = STORAGE_PREFIX + "encyclopedia_search_opened";
const ENCYCLOPEDIA_SEARCH_OPENED_VERSION = 1;

// 世界7不思議: 不正解確定による7日間(168時間)ロックの保存領域。既存の
// どの保存キーとも衝突しない新規キー(wfq_v1_seven_wonders_lock)。
// 「獲得済みの判定」自体はjs/trophy.js(TrophyModule.isEarned)の既存の
// 獲得記録をそのまま使うため、ここには一切記録しない(重複保存を避ける。
// セクション8の要求どおり)。ここで保存するのは「不正解が確定した時刻
// (failedAt)」と「それから168時間後に再挑戦できるようになる時刻
// (unlockAt)」だけで、問題id(SEVEN_WONDERS_QUESTIONS[].id)をキーとした
// 辞書として持つ(1問ごとに完全に独立。他の問題のロック状態には一切影響
// しない)。経過時間ベース(unlockAt = failedAt + 604800000ms)で判定する
// ため、カレンダー日付が変わったかどうかには依存しない
const SEVEN_WONDERS_LOCK_KEY = STORAGE_PREFIX + "seven_wonders_lock";
const SEVEN_WONDERS_LOCK_VERSION = 1;
const SEVEN_WONDERS_LOCK_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 168時間

function keysForMode(mode) {
  return mode === "capital" ? CapitalStorageKeys : StorageKeys;
}

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn("localStorageの読み込みに失敗しました", e);
    return null;
  }
}

// 戻り値は保存に成功したかどうか(true/false)。既存の呼び出し元の多くは
// この戻り値を使わず今までどおり「呼びっぱなし」のままで問題ないが、
// submitFindCountryRecord()のように保存の成否そのものを呼び出し元の
// 判断に使いたい箇所のために、例外を飲み込むだけでなく結果を返すようにする
function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.warn("localStorageの保存に失敗しました", e);
    return false;
  }
}

// ---------- 「世界の国どこかな？」ランキング: 保存データの読み書きヘルパー ----------
// 記録に必要な項目(得点・正解数・実際の回答数・平均回答時間・最大連続正解数・
// プレイ日時・難易度・問題数)がすべて正しい型であることを確認する。
// 1つでも欠けている/型が不正な記録は「破損データ」として無視し、アプリを
// 止めない(壊れた記録のせいでランキング画面自体が表示できなくなる事故を防ぐ)
function isValidFindCountryRecord(r) {
  return !!r && typeof r === "object"
    && Number.isFinite(r.score) && r.score >= 0
    && Number.isFinite(r.correctCount) && r.correctCount >= 0
    && Number.isFinite(r.answeredCount) && r.answeredCount >= 0
    && Number.isFinite(r.avgElapsedSeconds) && r.avgElapsedSeconds >= 0
    && Number.isFinite(r.maxStreak) && r.maxStreak >= 0
    && typeof r.playedAt === "string" && !Number.isNaN(Date.parse(r.playedAt))
    && typeof r.difficultyId === "string" && r.difficultyId.length > 0
    && (r.questionCount === null || Number.isFinite(r.questionCount))
    // 追加修正: TOP5入賞時の名前(呼び出し元が既にtrim・12文字以内・空なら
    // 「ななし」に正規化済みの文字列を渡す。ここでは型と長さだけ再確認する)
    && typeof r.name === "string" && r.name.length > 0 && r.name.length <= FINDCOUNTRY_NAME_MAX_LENGTH;
}

// 得点が高い方を上位に。同点なら平均回答時間が短い方、それも同じなら
// プレイ日時が新しい方を上位にする(確定仕様どおり)
function compareFindCountryRecords(a, b) {
  if (a.score !== b.score) return b.score - a.score;
  if (a.avgElapsedSeconds !== b.avgElapsedSeconds) return a.avgElapsedSeconds - b.avgElapsedSeconds;
  return Date.parse(b.playedAt) - Date.parse(a.playedAt);
}

function emptyFindCountryRankingData() {
  return { version: FINDCOUNTRY_RANKING_VERSION, courses: {} };
}

// バージョンが一致しない(未来の形式・壊れたデータ等)場合は安全側に倒して
// 空データとして扱う。既存の保存データを誤って上書きすることはなく、
// 次にsubmitFindCountryRecord()が呼ばれるまでstorage上のデータはそのまま残る
function loadFindCountryRankingData() {
  const raw = safeGet(FINDCOUNTRY_RANKING_KEY);
  if (!raw) return emptyFindCountryRankingData();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || parsed.version !== FINDCOUNTRY_RANKING_VERSION
      || !parsed.courses || typeof parsed.courses !== "object") {
      return emptyFindCountryRankingData();
    }
    return parsed;
  } catch (e) {
    console.warn("findcountryランキングデータの読み込みに失敗しました。保存データを初期化します", e);
    return emptyFindCountryRankingData();
  }
}

// 戻り値は保存に成功したかどうか。呼び出し元(submitFindCountryRecord)は
// これがfalseの場合、メモリ上でのみ算出した順位を「保存できた記録の順位」
// として扱わないようにする
function saveFindCountryRankingData(data) {
  return safeSet(FINDCOUNTRY_RANKING_KEY, JSON.stringify(data));
}

// ---------- 「世界の国どこかな？」コレクション: 保存データの読み書きヘルパー ----------
// 対象216件(COUNTRIES 198 + MAP_ONLY_REGIONS 18)の確定id集合。
// findcountry.js自身が出題プールを組み立てる際に参照しているのと同じ
// COUNTRIES/MAP_ONLY_REGIONSをそのまま参照するだけで、データを複製しない。
// 不正なID(タイプミス・旧バージョンの残骸・改ざん等)での登録を防ぐために使う。
// COUNTRIES/MAP_ONLY_REGIONSは実行時に変化しないため、初回アクセス時に1度
// だけ計算してキャッシュする
let findCountryCollectionValidIdsCache = null;
function findCountryCollectionValidIds() {
  if (!findCountryCollectionValidIdsCache) {
    const all = (typeof COUNTRIES !== "undefined" ? COUNTRIES : [])
      .concat(typeof MAP_ONLY_REGIONS !== "undefined" ? MAP_ONLY_REGIONS : []);
    findCountryCollectionValidIdsCache = new Set(all.map((c) => c.id));
  }
  return findCountryCollectionValidIdsCache;
}

function isValidFindCountryCaptureEntry(id, entry) {
  return typeof id === "string" && findCountryCollectionValidIds().has(id)
    && !!entry && typeof entry === "object"
    && typeof entry.firstCapturedAt === "string" && !Number.isNaN(Date.parse(entry.firstCapturedAt));
}

function emptyFindCountryCollectionData() {
  return { version: FINDCOUNTRY_COLLECTION_VERSION, entries: {} };
}

function loadFindCountryCollectionData() {
  const raw = safeGet(FINDCOUNTRY_COLLECTION_KEY);
  if (!raw) return emptyFindCountryCollectionData();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || parsed.version !== FINDCOUNTRY_COLLECTION_VERSION
      || !parsed.entries || typeof parsed.entries !== "object") {
      return emptyFindCountryCollectionData();
    }
    return parsed;
  } catch (e) {
    console.warn("findcountryコレクションデータの読み込みに失敗しました。保存データを初期化します", e);
    return emptyFindCountryCollectionData();
  }
}

function saveFindCountryCollectionData(data) {
  return safeSet(FINDCOUNTRY_COLLECTION_KEY, JSON.stringify(data));
}

// ---------- 「世界の国どこかな？」初級/中級/上級コースのクリア記録・PRO解放(第6段階) ----------
// ランキング・コレクションとは完全に独立した専用キーに保存し、どちらの
// 既存の保存形式にも一切手を加えない。courseKeyはStorage.findCountryCourseKey()と
// 同じ形式("beginner_5"等)の文字列
const FINDCOUNTRY_PROGRESS_KEY = STORAGE_PREFIX + "findcountry_progress";
// 追加修正で「クリア」の定義が出題数到達から正解数到達に変わったため、
// バージョンを2に上げて旧ルールでの記録を読み込まない(テスト段階のため
// 互換性維持より確定仕様への統一を優先する。PRO解放状態も連動して再ロックされる)
const FINDCOUNTRY_PROGRESS_VERSION = 2;
// PRO解放に必要な12コース(初級/中級/上級 × 5/10/20/30問)の確定キー一覧。
// PRO自身やそれ以外のキーがclearedCoursesに記録されていても、この一覧に
// 含まれないものは解放判定に使わない
const FINDCOUNTRY_PRO_UNLOCK_COURSE_KEYS = [
  "beginner_5", "beginner_10", "beginner_20", "beginner_30",
  "intermediate_5", "intermediate_10", "intermediate_20", "intermediate_30",
  "advanced_5", "advanced_10", "advanced_20", "advanced_30",
];

function emptyFindCountryProgressData() {
  return { version: FINDCOUNTRY_PROGRESS_VERSION, clearedCourses: {} };
}

function loadFindCountryProgressData() {
  const raw = safeGet(FINDCOUNTRY_PROGRESS_KEY);
  if (!raw) return emptyFindCountryProgressData();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || parsed.version !== FINDCOUNTRY_PROGRESS_VERSION
      || !parsed.clearedCourses || typeof parsed.clearedCourses !== "object") {
      return emptyFindCountryProgressData();
    }
    return parsed;
  } catch (e) {
    console.warn("findcountryのクリア記録の読み込みに失敗しました。保存データを初期化します", e);
    return emptyFindCountryProgressData();
  }
}

function saveFindCountryProgressData(data) {
  return safeSet(FINDCOUNTRY_PROGRESS_KEY, JSON.stringify(data));
}

function countClearedProUnlockCourses(clearedCourses) {
  return FINDCOUNTRY_PRO_UNLOCK_COURSE_KEYS.filter((k) => !!clearedCourses[k]).length;
}

// ---- トロフィーNo.27「地球の支配者」用: 通常12コースの「ノーミスクリア」記録 ----
// 既存のFINDCOUNTRY_PROGRESS_KEY(通常のクリア記録)とは別の専用キーに保存し、
// 既存のクリア記録・PRO解放判定には一切手を加えない(「通常クリア記録と
// ノーミスクリア記録は区別してください」という確定仕様に対応)。
// courseKeyは既存と同じ形式("beginner_5"等)、対象は同じ12コース
// (FINDCOUNTRY_PRO_UNLOCK_COURSE_KEYSを再利用し、対象一覧を複製しない)
const FINDCOUNTRY_NOMISS_KEY = STORAGE_PREFIX + "findcountry_nomiss_progress";
const FINDCOUNTRY_NOMISS_VERSION = 1;

function emptyFindCountryNoMissData() {
  return { version: FINDCOUNTRY_NOMISS_VERSION, noMissClearedCourses: {} };
}

function loadFindCountryNoMissData() {
  const raw = safeGet(FINDCOUNTRY_NOMISS_KEY);
  if (!raw) return emptyFindCountryNoMissData();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || parsed.version !== FINDCOUNTRY_NOMISS_VERSION
      || !parsed.noMissClearedCourses || typeof parsed.noMissClearedCourses !== "object") {
      return emptyFindCountryNoMissData();
    }
    return parsed;
  } catch (e) {
    console.warn("findcountryのノーミスクリア記録の読み込みに失敗しました。保存データを初期化します", e);
    return emptyFindCountryNoMissData();
  }
}

function saveFindCountryNoMissData(data) {
  return safeSet(FINDCOUNTRY_NOMISS_KEY, JSON.stringify(data));
}

function countClearedNoMissCourses(noMissClearedCourses) {
  return FINDCOUNTRY_PRO_UNLOCK_COURSE_KEYS.filter((k) => !!noMissClearedCourses[k]).length;
}

// ---- トロフィーNo.31「小さな巨人」用: PROモードで正解した5か国の記録 ----
// 既存のfindcountryコレクション(どの難易度で正解したかを区別しない)とは
// 完全に別の専用キーに保存する。「通常モードでの正解は対象外」という確定
// 仕様があるため、既存コレクションを流用すると難易度を区別できず正しく
// 判定できない(js/findcountry.js側がPROモードの正解時だけ記録を呼ぶ)
const FINDCOUNTRY_PRO_TINY_KEY = STORAGE_PREFIX + "findcountry_pro_tiny";
const FINDCOUNTRY_PRO_TINY_VERSION = 1;
// モナコ・サンマリノ・リヒテンシュタイン・ナウル・ツバル(内部id)。
// 対象はjs/countries.jsの実在id(mc/sm/li/nr/tv)で、全てPROの216件に含まれる
const FINDCOUNTRY_PRO_TINY_IDS = ["mc", "sm", "li", "nr", "tv"];

function emptyFindCountryProTinyData() {
  return { version: FINDCOUNTRY_PRO_TINY_VERSION, ids: {} };
}

function loadFindCountryProTinyData() {
  const raw = safeGet(FINDCOUNTRY_PRO_TINY_KEY);
  if (!raw) return emptyFindCountryProTinyData();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || parsed.version !== FINDCOUNTRY_PRO_TINY_VERSION
      || !parsed.ids || typeof parsed.ids !== "object") {
      return emptyFindCountryProTinyData();
    }
    return parsed;
  } catch (e) {
    console.warn("findcountryのPRO小国記録の読み込みに失敗しました。保存データを初期化します", e);
    return emptyFindCountryProTinyData();
  }
}

function saveFindCountryProTinyData(data) {
  return safeSet(FINDCOUNTRY_PRO_TINY_KEY, JSON.stringify(data));
}

// ---- 世界図鑑トロフィー(第5段階): 閲覧・地図確認・復習の記録(COUNTRIES 198件のみ対象) ----
// COUNTRIES専用の確定id集合。findCountryCollectionValidIds()はCOUNTRIES+
// MAP_ONLY_REGIONS(216件)を対象にしているため図鑑トロフィーには使えず、
// 別にCOUNTRIESのみ(198件)のキャッシュを持つ
let encyclopediaValidIdsCache = null;
function encyclopediaValidIds() {
  if (!encyclopediaValidIdsCache) {
    const all = typeof COUNTRIES !== "undefined" ? COUNTRIES : [];
    encyclopediaValidIdsCache = new Set(all.map((c) => c.id));
  }
  return encyclopediaValidIdsCache;
}

// 世界図鑑トロフィー追加分(No.259「未知なる領域の探究者」)用:
// MAP_ONLY_REGIONS(18件、地図専用地域)専用の確定id集合。既存の
// encyclopediaValidIds()(COUNTRIES専用)とは対象が違うため別キャッシュにする
let encyclopediaRegionValidIdsCache = null;
function encyclopediaRegionValidIds() {
  if (!encyclopediaRegionValidIdsCache) {
    const all = typeof MAP_ONLY_REGIONS !== "undefined" ? MAP_ONLY_REGIONS : [];
    encyclopediaRegionValidIdsCache = new Set(all.map((r) => r.id));
  }
  return encyclopediaRegionValidIdsCache;
}

// 閲覧済み・地図確認済み・復習済み・地域閲覧済み・検索由来閲覧済みはいずれも
// 「決まった対象idの集合から、含まれるidを重複なく記録するだけ」という同じ
// 形のため、読み書きロジックを1つの生成関数にまとめて複製しない。対象の
// 確定id集合は呼び出し側がvalidIdsGetterで指定する(省略時は既存どおり
// COUNTRIES専用のencyclopediaValidIds()を使うため、既存3種類の呼び出しは
// 一切変更しなくてよい)。返り値のrecord()は、idが不正/既に記録済み/保存
// 失敗のいずれかであればfalseを返す(=保存が実際に成功した場合のみtrueになる)
function makeEncyclopediaIdSetStore(key, version, validIdsGetter) {
  const getValidIds = typeof validIdsGetter === "function" ? validIdsGetter : encyclopediaValidIds;
  function empty() { return { version, ids: {} }; }
  function load() {
    const raw = safeGet(key);
    if (!raw) return empty();
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || parsed.version !== version
        || !parsed.ids || typeof parsed.ids !== "object") {
        return empty();
      }
      return parsed;
    } catch (e) {
      console.warn("世界図鑑の記録データの読み込みに失敗しました。保存データを初期化します", e);
      return empty();
    }
  }
  function save(data) { return safeSet(key, JSON.stringify(data)); }
  return {
    getAll() {
      const data = load();
      const sanitized = {};
      Object.keys(data.ids).forEach((id) => {
        if (data.ids[id] === true && getValidIds().has(id)) sanitized[id] = true;
      });
      return sanitized;
    },
    getCount() { return Object.keys(this.getAll()).length; },
    has(id) { return Object.prototype.hasOwnProperty.call(this.getAll(), id); },
    record(id) {
      try {
        if (typeof id !== "string" || !getValidIds().has(id)) return false;
        const data = load();
        if (data.ids[id] === true) return false;
        data.ids[id] = true;
        return !!save(data);
      } catch (e) {
        console.warn("世界図鑑の記録の保存に失敗しました", e);
        return false;
      }
    },
  };
}

const encyclopediaVisitedStore = makeEncyclopediaIdSetStore(ENCYCLOPEDIA_VISITED_KEY, ENCYCLOPEDIA_VISITED_VERSION);
const encyclopediaMapCheckedStore = makeEncyclopediaIdSetStore(ENCYCLOPEDIA_MAP_CHECKED_KEY, ENCYCLOPEDIA_MAP_CHECKED_VERSION);
const encyclopediaReviewedStore = makeEncyclopediaIdSetStore(ENCYCLOPEDIA_REVIEWED_KEY, ENCYCLOPEDIA_REVIEWED_VERSION);
// 「未知なる領域の探究者」用: MAP_ONLY_REGIONS(18件)専用の閲覧記録
const encyclopediaRegionVisitedStore = makeEncyclopediaIdSetStore(
  ENCYCLOPEDIA_REGION_VISITED_KEY, ENCYCLOPEDIA_REGION_VISITED_VERSION, encyclopediaRegionValidIds
);
// 「知識の道しるべ」用: 検索結果から開いた詳細画面の記録(COUNTRIES+
// MAP_ONLY_REGIONS、216件対象。既存のfindCountryCollectionValidIds()を
// そのまま再利用し、対象id集合を複製しない)
const encyclopediaSearchOpenedStore = makeEncyclopediaIdSetStore(
  ENCYCLOPEDIA_SEARCH_OPENED_KEY, ENCYCLOPEDIA_SEARCH_OPENED_VERSION, findCountryCollectionValidIds
);

// ---------- 世界7不思議: 7日間(168時間)ロックの読み書き ----------
function sevenWondersLockEmpty() { return { version: SEVEN_WONDERS_LOCK_VERSION, locks: {} }; }
function loadSevenWondersLock() {
  const raw = safeGet(SEVEN_WONDERS_LOCK_KEY);
  if (!raw) return sevenWondersLockEmpty();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || parsed.version !== SEVEN_WONDERS_LOCK_VERSION
      || !parsed.locks || typeof parsed.locks !== "object") {
      return sevenWondersLockEmpty();
    }
    return parsed;
  } catch (e) {
    console.warn("世界7不思議のロック状態の読み込みに失敗しました。保存データを初期化します", e);
    return sevenWondersLockEmpty();
  }
}
function saveSevenWondersLock(data) { return safeSet(SEVEN_WONDERS_LOCK_KEY, JSON.stringify(data)); }

const sevenWondersLockStore = {
  // 問題idの現在のロック状態({failedAt, unlockAt}、記録が無い/壊れている
  // 場合はnull)を返す。unlockAt自体の過去/未来判定はjs/puzzle.js・
  // js/app.js側(呼び出し時点のDate.now()と比較)が行う。ここでは保存
  // データの読み出しのみを行う
  get(questionId) {
    const data = loadSevenWondersLock();
    const entry = data.locks[questionId];
    if (!entry || typeof entry !== "object") return null;
    if (!Number.isFinite(entry.failedAt) || !Number.isFinite(entry.unlockAt)) return null;
    return { failedAt: entry.failedAt, unlockAt: entry.unlockAt };
  },
  // 不正解確定時に1回だけ呼ぶ。failedAtMsを明示的に受け取る(呼び出し側で
  // Date.now()を1回だけ評価し、保存とUI表示で同じ時刻を使えるようにする)。
  // すでに正解済みの問題をロックしてしまうことが無いよう、呼び出し側
  // (js/puzzle.js)がTrophyModule.isEarned()を確認した上でだけ呼ぶ想定
  recordFailure(questionId, failedAtMs) {
    try {
      if (typeof questionId !== "string" || !Number.isFinite(failedAtMs)) return false;
      const data = loadSevenWondersLock();
      data.locks[questionId] = { failedAt: failedAtMs, unlockAt: failedAtMs + SEVEN_WONDERS_LOCK_DURATION_MS };
      return !!saveSevenWondersLock(data);
    } catch (e) {
      console.warn("世界7不思議のロック状態の保存に失敗しました", e);
      return false;
    }
  },
};

const Storage = {
  // ---- 効果音設定 ----
  isSoundEnabled() {
    const v = safeGet(StorageKeys.SOUND);
    return v === null ? true : v === "true";
  },
  setSoundEnabled(enabled) {
    safeSet(StorageKeys.SOUND, enabled ? "true" : "false");
  },

  // ---- 称号(modeを省略すると国旗クイズ扱いになり、既存の挙動と完全に同じ) ----
  getEarnedTitles(mode = "flag") {
    const raw = safeGet(keysForMode(mode).TITLES);
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch (e) {
      return {};
    }
  },
  // 称号獲得条件を確認し、未獲得なら記録する。戻り値: 初取得ならtrue
  awardTitleIfNew(titleId, mode = "flag") {
    const titles = this.getEarnedTitles(mode);
    if (titles[titleId]) return false;
    titles[titleId] = { earnedAt: new Date().toISOString() };
    safeSet(keysForMode(mode).TITLES, JSON.stringify(titles));
    return true;
  },
  hasTitle(titleId, mode = "flag") {
    const titles = this.getEarnedTitles(mode);
    return !!titles[titleId];
  },

  // ---- 挑戦回数 ----
  incrementAttempts(mode = "flag") {
    const key = keysForMode(mode).ATTEMPTS;
    const n = parseInt(safeGet(key) || "0", 10) + 1;
    safeSet(key, String(n));
    return n;
  },
  getAttempts(mode = "flag") {
    return parseInt(safeGet(keysForMode(mode).ATTEMPTS) || "0", 10);
  },

  // ---- 最高正答率 ----
  updateBestRate(rate, mode = "flag") {
    const key = keysForMode(mode).BEST_RATE;
    const current = parseFloat(safeGet(key) || "0");
    if (rate > current) {
      safeSet(key, String(rate));
      return rate;
    }
    return current;
  },
  getBestRate(mode = "flag") {
    return parseFloat(safeGet(keysForMode(mode).BEST_RATE) || "0");
  },

  // ---- 問題数ごとの最高記録 ----
  getBestRecords(mode = "flag") {
    const raw = safeGet(keysForMode(mode).BEST_RECORDS);
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch (e) {
      return {};
    }
  },
  updateBestRecord(questionCount, correct, total, mode = "flag") {
    const records = this.getBestRecords(mode);
    const key = String(questionCount);
    const existing = records[key];
    if (!existing || correct > existing.correct) {
      records[key] = { correct, total };
      safeSet(keysForMode(mode).BEST_RECORDS, JSON.stringify(records));
      return records[key];
    }
    return existing;
  },

  // ---- 「世界の国どこかな？」ランキング(第5段階前半) ----
  // 13コース(初級/中級/上級×5・10・20・30問 + PRO固定216問)を、この関数
  // 1つで一意なキーに変換する。PROは問題数の選択自体が無いため常に"pro"
  findCountryCourseKey(difficultyId, questionCount) {
    return difficultyId === "pro" ? "pro" : `${difficultyId}_${questionCount}`;
  },

  // 指定コースのTOP5(1〜5位)を読み取り専用で返す。記録が無い/壊れている
  // 場合は短い配列(要素数0〜4)を返すだけで、呼び出し側は配列の長さで
  // 「何位まで記録があるか」を判断し、足りない分は「—」を表示する
  getFindCountryRanking(courseKey) {
    const data = loadFindCountryRankingData();
    const list = Array.isArray(data.courses[courseKey]) ? data.courses[courseKey] : [];
    return list.filter(isValidFindCountryRecord).slice(0, FINDCOUNTRY_RANKING_TOP_N);
  },

  // 追加修正: 名前入力画面を表示する前に、実際に登録せず「TOP5に入るか」
  // だけを調べるための読み取り専用プレビュー。submitFindCountryRecordと
  // 完全に同じ比較・並び替え・上位5件への絞り込みロジックを使うことで、
  // 「名前入力のために順位が変わる」ことが起こらないようにする
  // (名前入力の有無に関わらず、入る/入らないの判定自体は同じ基準)。
  // probe: { score, avgElapsedSeconds, playedAt(ISO文字列) }
  // 戻り値: 入賞すればその順位(1〜5)、入らなければnull。何も保存しない
  previewFindCountryRank(courseKey, probe) {
    try {
      if (!probe || !Number.isFinite(probe.score) || probe.score < 0) return null;
      if (!Number.isFinite(probe.avgElapsedSeconds) || probe.avgElapsedSeconds < 0) return null;
      if (typeof probe.playedAt !== "string" || Number.isNaN(Date.parse(probe.playedAt))) return null;
      const data = loadFindCountryRankingData();
      const existing = (Array.isArray(data.courses[courseKey]) ? data.courses[courseKey] : [])
        .filter(isValidFindCountryRecord);
      const marker = { score: probe.score, avgElapsedSeconds: probe.avgElapsedSeconds, playedAt: probe.playedAt };
      const merged = existing.concat([marker]).sort(compareFindCountryRecords).slice(0, FINDCOUNTRY_RANKING_TOP_N);
      const rank = merged.indexOf(marker);
      return rank === -1 ? null : rank + 1;
    } catch (e) {
      return null;
    }
  },

  // 1プレイ分の記録を該当コースのランキングに登録する。
  // record: { difficultyId, questionCount(PROはnull), score, correctCount,
  //           answeredCount, avgElapsedSeconds, maxStreak, playedAt(ISO文字列),
  //           name(追加修正: TOP5入賞時に入力された表示名、呼び出し元で正規化済み) }
  // 戻り値: 実際にlocalStorageへの保存まで成功し、かつTOP5にランクイン
  // していれば1〜5の順位、それ以外(ランク外、または保存自体に失敗した場合)
  // はnull。saveFindCountryRankingData()はlocalStorage.setItem()の成否を
  // そのまま返すため、ここで必ず確認する。確認しないと、容量超過等で
  // 保存できていないのに(メモリ上で計算しただけの)順位を返してしまい、
  // 結果画面に実際には記録されていない「ランクインしました」が表示される
  // 事故につながる。保存処理自体が例外を投げてもゲームを止めないよう、
  // ここで必ずcatchする
  submitFindCountryRecord(record) {
    try {
      if (!isValidFindCountryRecord(record)) return null;
      const data = loadFindCountryRankingData();
      const courseKey = this.findCountryCourseKey(record.difficultyId, record.questionCount);
      const existing = (Array.isArray(data.courses[courseKey]) ? data.courses[courseKey] : [])
        .filter(isValidFindCountryRecord);
      const merged = existing.concat([record]).sort(compareFindCountryRecords).slice(0, FINDCOUNTRY_RANKING_TOP_N);
      data.courses[courseKey] = merged;
      const saved = saveFindCountryRankingData(data);
      if (!saved) return null;
      const rank = merged.indexOf(record);
      return rank === -1 ? null : rank + 1;
    } catch (e) {
      console.warn("findcountryランキングの保存に失敗しました", e);
      return null;
    }
  },

  // ---- 「世界の国どこかな？」コレクション(第5段階後半) ----
  // 獲得済みの国・地域を { id: { firstCapturedAt } } の形で読み取り専用に返す。
  // 破損している/不正なidのエントリーはここで除外されるため、呼び出し側は
  // 常に「216件の確定idのみを対象にした、壊れていない獲得状況」を受け取れる
  getFindCountryCollection() {
    const data = loadFindCountryCollectionData();
    const sanitized = {};
    Object.keys(data.entries).forEach((id) => {
      const entry = data.entries[id];
      if (isValidFindCountryCaptureEntry(id, entry)) {
        sanitized[id] = { firstCapturedAt: entry.firstCapturedAt };
      }
    });
    return sanitized;
  },

  hasFindCountryCapture(id) {
    return Object.prototype.hasOwnProperty.call(this.getFindCountryCollection(), id);
  },

  // 正解した国・地域を1件だけ獲得として記録する。idが216件の確定リストに
  // 無い(不正なid)場合や、既に獲得済みの場合は何もせずfalseを返す。
  // これにより「同じ国・地域を再度正解しても重複登録しない」仕様と、
  // 呼び出し側が「今回が初獲得か」をそのまま判定できることの両方を満たす。
  // 保存に失敗した場合もfalseを返し、クイズの進行自体は止めない
  captureFindCountryEntry(id, capturedAtIso) {
    try {
      if (typeof id !== "string" || !findCountryCollectionValidIds().has(id)) return false;
      const data = loadFindCountryCollectionData();
      if (data.entries[id]) return false;
      const entry = { firstCapturedAt: capturedAtIso || new Date().toISOString() };
      if (!isValidFindCountryCaptureEntry(id, entry)) return false;
      data.entries[id] = entry;
      return saveFindCountryCollectionData(data);
    } catch (e) {
      console.warn("findcountryコレクションの保存に失敗しました", e);
      return false;
    }
  },

  // ---- 「世界の国どこかな？」初級/中級/上級12コースのクリア記録・PRO解放(第6段階) ----
  // 「クリア」したかどうかの判定自体(ライフを残して最後まで到達したか)は
  // 呼び出し元(js/findcountry.js)が行い、ここでは判定済みのcourseKeyを
  // 記録するだけにする(保存層に判定ロジックを持たせない)
  getFindCountryProUnlockProgress() {
    const data = loadFindCountryProgressData();
    const clearedCount = countClearedProUnlockCourses(data.clearedCourses);
    return {
      clearedCount,
      total: FINDCOUNTRY_PRO_UNLOCK_COURSE_KEYS.length,
      unlocked: clearedCount === FINDCOUNTRY_PRO_UNLOCK_COURSE_KEYS.length,
    };
  },
  isFindCountryProUnlocked() {
    return this.getFindCountryProUnlockProgress().unlocked;
  },

  // 指定コースをクリア済みとして記録する。既にクリア済みの場合や保存自体に
  // 失敗した場合は何もしない(何度呼んでも安全)。戻り値のjustUnlockedProは
  // 「この呼び出しによって初めて12コース全てがクリア済みになったか」を表し、
  // PRO解放のお知らせを1回だけ出すタイミングの判定に使う
  markFindCountryCourseCleared(courseKey) {
    try {
      const data = loadFindCountryProgressData();
      if (data.clearedCourses[courseKey]) return { justUnlockedPro: false };
      const wasUnlocked = countClearedProUnlockCourses(data.clearedCourses) === FINDCOUNTRY_PRO_UNLOCK_COURSE_KEYS.length;
      data.clearedCourses[courseKey] = true;
      const saved = saveFindCountryProgressData(data);
      if (!saved) return { justUnlockedPro: false };
      const nowUnlocked = countClearedProUnlockCourses(data.clearedCourses) === FINDCOUNTRY_PRO_UNLOCK_COURSE_KEYS.length;
      return { justUnlockedPro: !wasUnlocked && nowUnlocked };
    } catch (e) {
      console.warn("findcountryのクリア記録の保存に失敗しました", e);
      return { justUnlockedPro: false };
    }
  },
  // 指定コースが既にクリア済みかどうかを読むだけの関数(トロフィーNo.2〜13・
  // 15〜17用。過去にクリア済みのコースがあれば、新しい判定を追加した
  // この時点で即座に実績を反映できる)
  isFindCountryCourseCleared(courseKey) {
    const data = loadFindCountryProgressData();
    return !!data.clearedCourses[courseKey];
  },

  // ---- トロフィーNo.27「地球の支配者」用: 通常12コースのノーミスクリア記録 ----
  // 既存のmarkFindCountryCourseCleared/getFindCountryProUnlockProgressとは
  // 完全に独立しており、既存のクリア記録・PRO解放判定には一切影響しない
  markFindCountryCourseNoMissCleared(courseKey) {
    try {
      const data = loadFindCountryNoMissData();
      if (data.noMissClearedCourses[courseKey]) return false;
      data.noMissClearedCourses[courseKey] = true;
      return !!saveFindCountryNoMissData(data);
    } catch (e) {
      console.warn("findcountryのノーミスクリア記録の保存に失敗しました", e);
      return false;
    }
  },
  // 指定コースが既にノーミスクリア済みかどうかを読むだけの関数(隠しトロフィー
  // 61種類実装(第2段階)「神々のトライフォース」用。isFindCountryCourseCleared
  // と同じ考え方で、既存のallCleared集計(12コース全件)とは別に、特定の
  // 3コース(初級/中級/上級の各30問)だけを個別に参照できるようにする
  isFindCountryCourseNoMissCleared(courseKey) {
    const data = loadFindCountryNoMissData();
    return !!data.noMissClearedCourses[courseKey];
  },
  getFindCountryNoMissClearProgress() {
    const data = loadFindCountryNoMissData();
    const clearedCount = countClearedNoMissCourses(data.noMissClearedCourses);
    return {
      clearedCount,
      total: FINDCOUNTRY_PRO_UNLOCK_COURSE_KEYS.length,
      allCleared: clearedCount === FINDCOUNTRY_PRO_UNLOCK_COURSE_KEYS.length,
    };
  },

  // ---- トロフィーNo.31「小さな巨人」用: PROモードで正解した5か国の記録 ----
  // idがFINDCOUNTRY_PRO_TINY_IDSに含まれない場合や、既に記録済みの場合は
  // 何もせずfalseを返す(同じ国・地域を複数回正解しても1件として数える)
  recordFindCountryProTinyCapture(id) {
    try {
      if (typeof id !== "string" || !FINDCOUNTRY_PRO_TINY_IDS.includes(id)) return false;
      const data = loadFindCountryProTinyData();
      if (data.ids[id] === true) return false;
      data.ids[id] = true;
      return !!saveFindCountryProTinyData(data);
    } catch (e) {
      console.warn("findcountryのPRO小国記録の保存に失敗しました", e);
      return false;
    }
  },
  getFindCountryProTinyProgress() {
    const data = loadFindCountryProTinyData();
    const capturedCount = FINDCOUNTRY_PRO_TINY_IDS.filter((id) => data.ids[id] === true).length;
    return {
      capturedCount,
      total: FINDCOUNTRY_PRO_TINY_IDS.length,
      allCaptured: capturedCount === FINDCOUNTRY_PRO_TINY_IDS.length,
    };
  },

  // ---- 世界図鑑トロフィー(第5段階、No.143〜158): 閲覧・地図確認・復習の記録 ----
  // いずれも「実際にその事実が発生した国idの集合」を返す/記録するだけで、
  // トロフィーの判定自体はjs/trophy.js側(TrophyModule.evaluateEncyclopediaVisit)
  // が行う。record系はtrueを返した場合のみ「今回新たに記録された」ことを示す
  getEncyclopediaVisited() { return encyclopediaVisitedStore.getAll(); },
  getEncyclopediaVisitedCount() { return encyclopediaVisitedStore.getCount(); },
  hasEncyclopediaVisited(id) { return encyclopediaVisitedStore.has(id); },
  recordEncyclopediaVisit(id) { return encyclopediaVisitedStore.record(id); },

  getEncyclopediaMapChecked() { return encyclopediaMapCheckedStore.getAll(); },
  getEncyclopediaMapCheckedCount() { return encyclopediaMapCheckedStore.getCount(); },
  recordEncyclopediaMapChecked(id) { return encyclopediaMapCheckedStore.record(id); },

  getEncyclopediaReviewed() { return encyclopediaReviewedStore.getAll(); },
  getEncyclopediaReviewedCount() { return encyclopediaReviewedStore.getCount(); },
  recordEncyclopediaReview(id) { return encyclopediaReviewedStore.record(id); },

  // 世界図鑑トロフィー追加分(No.259〜261)用
  getEncyclopediaRegionVisited() { return encyclopediaRegionVisitedStore.getAll(); },
  getEncyclopediaRegionVisitedCount() { return encyclopediaRegionVisitedStore.getCount(); },
  recordEncyclopediaRegionVisit(id) { return encyclopediaRegionVisitedStore.record(id); },

  getEncyclopediaSearchOpenedCount() { return encyclopediaSearchOpenedStore.getCount(); },
  recordEncyclopediaSearchOpened(id) { return encyclopediaSearchOpenedStore.record(id); },

  // 世界7不思議: 7日間(168時間)ロックの読み書き
  getSevenWonderLock(questionId) { return sevenWondersLockStore.get(questionId); },
  recordSevenWonderFailure(questionId, failedAtMs) { return sevenWondersLockStore.recordFailure(questionId, failedAtMs); },
  SEVEN_WONDERS_LOCK_DURATION_MS,

  // ---- データリセット(国旗・首都両方の称号・記録だけを消す) ----
  // 効果音設定(StorageKeys.SOUND)は確認画面の文言(「称号・記録をリセット」)
  // に合わせて対象外にする。以前はStorageKeysの全キー(SOUNDを含む)を
  // 削除していたため、記録をリセットすると効果音設定まで初期化されてしまう
  // 不一致があった。
  // findcountryのランキング(第5段階前半)・コレクション(第5段階後半)・
  // 12コースのクリア記録とPRO解放状態(第6段階)も、称号・最高記録と同じ
  // 「実績・成績」の性質を持つデータのため、ここに含めて一緒にリセットできる
  // ようにする(このボタンでしか消せない孤立したデータを残さないため。
  // リセット後はPROが再び未解放に戻る)。その代わり、ユーザーが何を削除するか
  // 正しく分かるよう、呼び出し元(js/app.js)の確認ダイアログの文言に
  // 「ランキング・コレクション」も明記している
  resetAll() {
    const keysToRemove = [
      StorageKeys.TITLES, StorageKeys.ATTEMPTS, StorageKeys.BEST_RATE, StorageKeys.BEST_RECORDS,
      ...Object.values(CapitalStorageKeys),
      FINDCOUNTRY_RANKING_KEY,
      FINDCOUNTRY_COLLECTION_KEY,
      FINDCOUNTRY_PROGRESS_KEY,
      FINDCOUNTRY_NOMISS_KEY,
      FINDCOUNTRY_PRO_TINY_KEY,
      ENCYCLOPEDIA_VISITED_KEY,
      ENCYCLOPEDIA_MAP_CHECKED_KEY,
      ENCYCLOPEDIA_REVIEWED_KEY,
      ENCYCLOPEDIA_REGION_VISITED_KEY,
      ENCYCLOPEDIA_SEARCH_OPENED_KEY,
      SEVEN_WONDERS_LOCK_KEY,
    ];
    keysToRemove.forEach((k) => {
      try { localStorage.removeItem(k); } catch (e) { /* noop */ }
    });
    // トロフィー刷新 Stage A: 新トロフィー(107項目)の獲得記録・統計も、
    // 既存の称号・記録と同じ「実績・成績」データとしてここで一緒に削除
    // する。js/trophy.jsはこのファイルの直後に読み込まれるため、
    // resetAll()が実際に呼ばれる時点(ユーザー操作時)には必ず定義済みに
    // なっている。万一未定義でも例外でリセット処理全体が止まらないよう
    // 存在確認とtry/catchの両方で保護する
    try {
      if (typeof TrophyModule !== "undefined" && typeof TrophyModule.resetAll === "function") {
        TrophyModule.resetAll();
      }
    } catch (e) { /* noop */ }
  },
};
