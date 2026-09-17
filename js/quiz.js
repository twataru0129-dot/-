// ==========================================================
// クイズのコアロジック
// 出題順のシャッフル、6択の生成、タイマー管理を担当する
// ==========================================================

const TITLES = [
  { count: 10, id: "beginner", name: "国旗ビギナー", medalClass: "medal-bronze", condition: "10問全問正解" },
  { count: 20, id: "challenger", name: "国旗チャレンジャー", medalClass: "medal-green", condition: "20問全問正解" },
  { count: 30, id: "traveler", name: "国旗トラベラー", medalClass: "medal-blue", condition: "30問全問正解" },
  { count: 50, id: "expert", name: "国旗エキスパート", medalClass: "medal-purple", condition: "50問全問正解" },
  { count: 100, id: "master", name: "国旗マスター", medalClass: "medal-gold", condition: "100問全問正解" },
  { count: 198, id: "legend", name: "国旗レジェンド", medalClass: "medal-legend", condition: "198問全問正解(WORLD COMPLETE)" },
];

function getTitleByCount(count) {
  return TITLES.find((t) => t.count === count) || null;
}

// Fisher-Yates shuffle: 偏りの少ないシャッフルアルゴリズム
function shuffleArray(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickRandom(array, n) {
  return shuffleArray(array).slice(0, n);
}

const QuizEngine = (() => {
  const THINK_SECONDS = 3;
  const COUNTDOWN_SECONDS = 5;
  const TOTAL_SECONDS = THINK_SECONDS + COUNTDOWN_SECONDS;

  let countryMap = null;
  function getCountryMap() {
    if (!countryMap) {
      countryMap = new Map(COUNTRIES.map((c) => [c.id, c]));
    }
    return countryMap;
  }

  // 出題する国のリストを作成する(同じ国が2回出題されないようにする)
  function buildQuestionSet(questionCount) {
    const shuffled = shuffleArray(COUNTRIES);
    return shuffled.slice(0, questionCount);
  }

  // 6択の候補を生成する
  // 優先順位: 1.似ている国 2.同じ地域の国 3.残りはランダム
  function buildChoices(correctCountry, excludeIds) {
    const map = getCountryMap();
    const used = new Set(excludeIds);
    used.add(correctCountry.id);
    const result = [];

    function addFrom(pool) {
      for (const c of pool) {
        if (result.length >= 5) break;
        if (!c || used.has(c.id)) continue;
        result.push(c);
        used.add(c.id);
      }
    }

    // 優先1: similarCountries(視覚的に混同しやすい国として設定済み)
    if (correctCountry.similarCountries && correctCountry.similarCountries.length) {
      const sims = shuffleArray(correctCountry.similarCountries).map((id) => map.get(id));
      addFrom(sims);
    }

    // 優先2: 同じ地域の国
    if (result.length < 5) {
      const sameRegion = COUNTRIES.filter((c) => c.region === correctCountry.region);
      addFrom(shuffleArray(sameRegion));
    }

    // 優先3(不足分): 完全ランダム
    if (result.length < 5) {
      addFrom(shuffleArray(COUNTRIES));
    }

    const choices = [correctCountry, ...result.slice(0, 5)];
    return shuffleArray(choices);
  }

  // 1問分のデータを作る
  function buildQuestion(country, allExcludeForThisGame) {
    const choices = buildChoices(country, allExcludeForThisGame || []);
    return { country, choices };
  }

  return {
    THINK_SECONDS,
    COUNTDOWN_SECONDS,
    TOTAL_SECONDS,
    buildQuestionSet,
    buildQuestion,
    buildChoices,
  };
})();

// ==========================================================
// タイマー管理クラス
// 「問題切り替え時」「回答時」「時間切れ時」に必ず解除する
// ==========================================================
class QuestionTimer {
  constructor(callbacks) {
    // callbacks: { onTick(phase, secondsLeftDisplay), onTimeout() }
    this.callbacks = callbacks;
    this.rafId = null;
    this.startTime = null;
    this.stopped = false;
  }

  start() {
    this.stopped = false;
    this.startTime = performance.now();
    const loop = (now) => {
      if (this.stopped) return;
      const elapsed = (now - this.startTime) / 1000;
      const remaining = QuizEngine.TOTAL_SECONDS - elapsed;

      if (remaining <= 0) {
        this.stop();
        this.callbacks.onTimeout();
        return;
      }

      if (elapsed < QuizEngine.THINK_SECONDS) {
        this.callbacks.onTick("thinking", null);
      } else {
        const secondsLeft = Math.ceil(remaining);
        this.callbacks.onTick("countdown", secondsLeft);
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  // 必ず問題切り替え・回答・時間切れの際に呼び出しタイマーを解除する
  stop() {
    this.stopped = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
