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

// 首都クイズ専用の称号(国旗クイズの称号とは完全に別管理)
const CAPITAL_TITLES = [
  { count: 10, id: "cap_beginner", name: "首都ビギナー", medalClass: "medal-bronze", condition: "10問全問正解" },
  { count: 20, id: "cap_challenger", name: "首都チャレンジャー", medalClass: "medal-green", condition: "20問全問正解" },
  { count: 30, id: "cap_traveler", name: "世界都市トラベラー", medalClass: "medal-blue", condition: "30問全問正解" },
  { count: 50, id: "cap_expert", name: "首都エキスパート", medalClass: "medal-purple", condition: "50問全問正解" },
  { count: 100, id: "cap_master", name: "首都マスター", medalClass: "medal-gold", condition: "100問全問正解" },
  { count: 198, id: "cap_legend", name: "首都レジェンド", medalClass: "medal-legend", condition: "198問全問正解(WORLD CAPITAL COMPLETE)" },
];

function getTitlesForMode(mode) {
  return mode === "capital" ? CAPITAL_TITLES : TITLES;
}

function getTitleByCount(count, mode = "flag") {
  return getTitlesForMode(mode).find((t) => t.count === count) || null;
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
  // 誤答候補は「countries全198件から現在の正解国を除いた197件」から選ぶ。
  // そのゲームで出題される他の国(正解問題として使われるかどうか)は
  // 誤答候補から除外しない。除外するのはこの問題の正解国だけ。
  // 優先順位: 1.似ている国 2.同じ地域の国 3.残りはランダム
  function buildChoices(correctCountry) {
    const map = getCountryMap();
    const used = new Set([correctCountry.id]);
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

    // 優先3(不足分): 完全ランダム(198件全体から)
    if (result.length < 5) {
      addFrom(shuffleArray(COUNTRIES));
    }

    const choices = [correctCountry, ...result.slice(0, 5)];

    // 最終安全チェック: 必ず6択・重複なしになっていることを保証する
    console.assert(choices.length === 6, `choicesが6件ではありません: ${choices.length}`);
    console.assert(new Set(choices.map((c) => c.id)).size === 6, "choicesに重複があります");

    return shuffleArray(choices);
  }

  // 1問分のデータを作る
  function buildQuestion(country) {
    const choices = buildChoices(country);
    return { country, choices };
  }

  // 首都クイズの6択候補を生成する。
  // 誤答候補は「countries全198件から現在の正解国を除いた197件」から選ぶ
  // (国旗クイズと同じ考え方。出題されなかった国だけに限定しない)。
  // 優先順位: 1.同じ地域の首都 2.似ている国(similarCountriesを流用) 3.残りはランダム
  // 表示文字列(capital)で重複が出ないよう、id と capital の両方で重複チェックする。
  function buildCapitalChoices(correctCountry) {
    const map = getCountryMap();
    const usedIds = new Set([correctCountry.id]);
    const usedCapitals = new Set([correctCountry.capital]);
    const result = [];

    function addFrom(pool) {
      for (const c of pool) {
        if (result.length >= 5) break;
        if (!c || usedIds.has(c.id) || usedCapitals.has(c.capital)) continue;
        result.push(c);
        usedIds.add(c.id);
        usedCapitals.add(c.capital);
      }
    }

    // 優先1+2: 同じ地域の首都を使うが、その中でも混同しやすい国
    // (similarCountriesデータを流用)を優先的に並べる。
    // 地域が大きい(ヨーロッパ・アジア・アフリカ等)場合、地域だけで
    // 5件埋まってしまい「混同しやすい国」が出てこなくなるのを防ぐため。
    const simIds = new Set(correctCountry.similarCountries || []);
    const sameRegion = COUNTRIES.filter((c) => c.region === correctCountry.region && c.id !== correctCountry.id);
    const prioritized = shuffleArray(sameRegion.filter((c) => simIds.has(c.id)));
    const restOfRegion = shuffleArray(sameRegion.filter((c) => !simIds.has(c.id)));
    addFrom([...prioritized, ...restOfRegion]);

    // 優先3: 似ている国が別地域にある場合の補完(不足時のみ)
    if (result.length < 5 && correctCountry.similarCountries && correctCountry.similarCountries.length) {
      const sims = shuffleArray(correctCountry.similarCountries).map((id) => map.get(id));
      addFrom(sims);
    }

    // 優先4(不足分): 完全ランダム(198件全体から)
    if (result.length < 5) {
      addFrom(shuffleArray(COUNTRIES));
    }

    const choices = [correctCountry, ...result.slice(0, 5)];

    // 最終安全チェック: 必ず6択・表示文字列の重複なしになっていることを保証する
    console.assert(choices.length === 6, `capital choicesが6件ではありません: ${choices.length}`);
    console.assert(new Set(choices.map((c) => c.capital)).size === 6, "capital choicesに重複があります");

    return shuffleArray(choices);
  }

  // 首都クイズの1問分のデータを作る
  function buildCapitalQuestion(country) {
    const choices = buildCapitalChoices(country);
    return { country, choices };
  }

  return {
    THINK_SECONDS,
    COUNTDOWN_SECONDS,
    TOTAL_SECONDS,
    buildQuestionSet,
    buildQuestion,
    buildChoices,
    buildCapitalQuestion,
    buildCapitalChoices,
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
