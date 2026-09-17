// ==========================================================
// localStorage を使った保存データの管理
// 効果音設定・称号・挑戦回数・最高記録などをここで扱う
// ==========================================================

const STORAGE_PREFIX = "wfq_v1_";

const StorageKeys = {
  SOUND: STORAGE_PREFIX + "sound_enabled",
  TITLES: STORAGE_PREFIX + "earned_titles",
  ATTEMPTS: STORAGE_PREFIX + "attempts_count",
  BEST_RATE: STORAGE_PREFIX + "best_rate",
  BEST_RECORDS: STORAGE_PREFIX + "best_records",
};

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

  // ---- 称号 ----
  getEarnedTitles() {
    const raw = safeGet(StorageKeys.TITLES);
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch (e) {
      return {};
    }
  },
  // 称号獲得条件を確認し、未獲得なら記録する。戻り値: 初取得ならtrue
  awardTitleIfNew(titleId) {
    const titles = this.getEarnedTitles();
    if (titles[titleId]) return false;
    titles[titleId] = { earnedAt: new Date().toISOString() };
    safeSet(StorageKeys.TITLES, JSON.stringify(titles));
    return true;
  },
  hasTitle(titleId) {
    const titles = this.getEarnedTitles();
    return !!titles[titleId];
  },

  // ---- 挑戦回数 ----
  incrementAttempts() {
    const n = parseInt(safeGet(StorageKeys.ATTEMPTS) || "0", 10) + 1;
    safeSet(StorageKeys.ATTEMPTS, String(n));
    return n;
  },
  getAttempts() {
    return parseInt(safeGet(StorageKeys.ATTEMPTS) || "0", 10);
  },

  // ---- 最高正答率 ----
  updateBestRate(rate) {
    const current = parseFloat(safeGet(StorageKeys.BEST_RATE) || "0");
    if (rate > current) {
      safeSet(StorageKeys.BEST_RATE, String(rate));
      return rate;
    }
    return current;
  },
  getBestRate() {
    return parseFloat(safeGet(StorageKeys.BEST_RATE) || "0");
  },

  // ---- 問題数ごとの最高記録 ----
  getBestRecords() {
    const raw = safeGet(StorageKeys.BEST_RECORDS);
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch (e) {
      return {};
    }
  },
  updateBestRecord(questionCount, correct, total) {
    const records = this.getBestRecords();
    const key = String(questionCount);
    const existing = records[key];
    if (!existing || correct > existing.correct) {
      records[key] = { correct, total };
      safeSet(StorageKeys.BEST_RECORDS, JSON.stringify(records));
      return records[key];
    }
    return existing;
  },

  // ---- データリセット ----
  resetAll() {
    Object.values(StorageKeys).forEach((k) => {
      try { localStorage.removeItem(k); } catch (e) { /* noop */ }
    });
  },
};
