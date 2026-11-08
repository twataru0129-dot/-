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
const FINDCOUNTRY_RANKING_VERSION = 1;
const FINDCOUNTRY_RANKING_TOP_N = 5;

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
    && (r.questionCount === null || Number.isFinite(r.questionCount));
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

  // 1プレイ分の記録を該当コースのランキングに登録する。
  // record: { difficultyId, questionCount(PROはnull), score, correctCount,
  //           answeredCount, avgElapsedSeconds, maxStreak, playedAt(ISO文字列) }
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

  // ---- データリセット(国旗・首都両方の称号・記録だけを消す) ----
  // 効果音設定(StorageKeys.SOUND)は確認画面の文言(「称号・記録をリセット」)
  // に合わせて対象外にする。以前はStorageKeysの全キー(SOUNDを含む)を
  // 削除していたため、記録をリセットすると効果音設定まで初期化されてしまう
  // 不一致があった
  resetAll() {
    const keysToRemove = [
      StorageKeys.TITLES, StorageKeys.ATTEMPTS, StorageKeys.BEST_RATE, StorageKeys.BEST_RECORDS,
      ...Object.values(CapitalStorageKeys),
      FINDCOUNTRY_RANKING_KEY,
    ];
    keysToRemove.forEach((k) => {
      try { localStorage.removeItem(k); } catch (e) { /* noop */ }
    });
  },
};
