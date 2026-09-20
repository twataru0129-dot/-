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

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn("localStorageの保存に失敗しました", e);
  }
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

  // ---- データリセット(国旗・首都両方のデータと効果音設定をまとめて消す) ----
  resetAll() {
    [...Object.values(StorageKeys), ...Object.values(CapitalStorageKeys)].forEach((k) => {
      try { localStorage.removeItem(k); } catch (e) { /* noop */ }
    });
  },
};
