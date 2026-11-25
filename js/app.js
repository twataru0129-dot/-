// ==========================================================
// アプリ全体の制御(画面遷移・状態管理)
// 状態遷移:
// START -> SELECT_COUNT -> QUIZ_THINKING -> QUIZ_COUNTDOWN
//   -> ANSWER_RESULT -> NEXT_QUESTION -> RESULT -> TITLE_AWARD
// ==========================================================

// 本番では必ず false にする(開発時のみ称号テスト用にtrueにできる)
const DEBUG_MODE = false;

console.assert(COUNTRIES.length === 198, `countriesデータが198件ではありません: ${COUNTRIES.length}`);
(function validateCountries() {
  const ids = new Set();
  const codes = new Set();
  const flags = new Set();
  let dup = false;
  let missingCapital = 0;
  COUNTRIES.forEach((c) => {
    if (ids.has(c.id) || codes.has(c.code) || flags.has(c.flag)) dup = true;
    ids.add(c.id); codes.add(c.code); flags.add(c.flag);
    if (!c.capital) missingCapital++;
  });
  console.assert(!dup, "countriesデータにid/code/flagの重複があります");
  console.assert(missingCapital === 0, `首都(capital)が未設定の国が${missingCapital}件あります`);
})();

const QUESTION_COUNTS = [10, 20, 30, 50, 100, 198];

// アプリ全体の状態
const state = {
  screenStack: ["screen-top"],
  mode: "flag", // "flag"(国旗クイズ) | "capital"(首都クイズ)
  selectedCount: 20,
  questions: [],
  currentQuestionIndex: 0,
  score: 0,
  answered: false,
  timer: null,
  nextQuestionTimeoutId: null, // 正誤判定後、次の問題に進むまでの1.5秒待ち(setTimeout)
  nextQuestionRemainingMs: null, // 終了確認モーダルを開いている間、上記待ちを一時停止するための残り時間
  nextQuestionScheduledAt: null, // 上記待ちを開始/再開したperformance.now()
  questionGeneration: 0, // 問題ごと・終了ごとに増やす世代番号。古い問題(または終了後)の画像読み込みイベントが現在のタイマーに影響しないようにする
  imageLoaded: false, // 現在の問題の画像読み込みが完了したか(onload/completeの二重発火を1回にまとめる・回答ボタン制御に使う)
  timerStarted: false, // 現在の問題でQuestionTimer.start()を既に呼んだか(二重開始防止)
  lastCountdownSecond: null, // カウントダウン効果音を秒が変わった瞬間だけ鳴らすための記録用
  lastResult: null, // { correct, total, rate, titleObj, isNewTitle, mode, wrongIds }
  // 間違えた問題の「正解だった国・地域」のidを記録する(第3段階A案:
  // 世界図鑑での復習機能)。選んだ誤答の国ではなく、出題された問題自体の
  // 正解国のidを入れる。Setにしているのは同一問題の二重記録を防ぐため
  // (1回のクイズでは同じ国が2回出題されないため実際には起きないが、
  // 念のための安全策)。永続保存はしない(ページ再読み込みで消える)
  wrongIds: new Set(),
  memorialType: "medal",
  memorialName: "",
  // トロフィー刷新 Stage C: そのプレイの開始時刻(ISO文字列、#64・70の
  // 開始時刻判定用データ)と、各問題の回答時間(#20〜29・69の回答時間
  // 判定用データ)。いずれも永続保存はせず、finishQuiz()でトロフィー用の
  // contextに渡すためだけのプレイ中限定の記録(startQuiz()でリセットする)
  quizStartedAt: null,
  answerTimings: [],
  // トロフィー一覧画面のカテゴリ・獲得状況・検索語・表示形式(グリッド/一覧)の
  // 絞り込み状態。画面を離れても値は保持し、次に開いたときに同じ絞り込みを
  // 再現する(永続保存はしない。ページ再読み込みでリセットされてよい表示上の
  // 状態のため)
  trophyListFilter: { topBucket: "all", category: "all", status: "all", search: "", view: "grid" },
};

function modeEmoji(mode) {
  return mode === "capital" ? "🏙️" : "🌍";
}

function $(id) { return document.getElementById(id); }

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((el) => el.classList.remove("active"));
  const target = $(id);
  if (target) target.classList.add("active");
  window.scrollTo(0, 0);
}

// ==========================================================
// トップ画面
// ==========================================================
function initTopScreen() {
  updateSoundButton();

  // 🌍国旗クイズ / 🏙️首都クイズ / 🌐世界地図、どちらのモードで始めるかをここで決める
  document.querySelectorAll(".mode-card").forEach((card) => {
    card.addEventListener("click", () => {
      const mode = card.dataset.mode;
      state.mode = mode;

      // 世界地図・世界図鑑はクイズではないので、問題数選択を経由せず直接開く。
      // 得点・タイマーを使わないため効果音の有効化も行わない。
      if (mode === "map") {
        showScreen("screen-map");
        MapModule.open();
        // 共通トロフィー(四つの扉): 世界地図モードの画面を実際に表示した
        // 時点で「世界地図を使用する」条件を満たす
        try {
          if (typeof TrophyModule !== "undefined" && typeof TrophyModule.recordCommonModeUsed === "function") {
            TrophyModule.recordCommonModeUsed("map");
          }
        } catch (e) { /* noop */ }
        return;
      }
      if (mode === "encyclopedia") {
        showScreen("screen-encyclopedia-list");
        EncyclopediaModule.open();
        return;
      }
      // 第4段階「世界の国どこかな？」(第2段階: 基本画面のみ)。
      // 既存の国旗/首都クイズのstate(questions/score/wrongIds等)とは
      // 完全に分離しており、ここではstate.modeをこれ以上使わない
      if (mode === "findcountry") {
        FindCountryModule.openDifficultyScreen();
        return;
      }

      SoundManager.unlock(); // 最初のユーザー操作でAudioContextを有効化
      renderSelectScreen();
      showScreen("screen-select");
    });
  });

  $("btn-trophy-list").addEventListener("click", () => {
    renderTrophyListScreen();
    showScreen("screen-trophy-list");
  });

  $("btn-sound-toggle").addEventListener("click", () => {
    SoundManager.setEnabled(!SoundManager.isEnabled());
    updateSoundButton();
  });

  $("btn-reset-data").addEventListener("click", handleResetDataClick);

  document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => {
      // 難易度選択画面へ戻る場合だけは、PRO解放状況(第6段階)が画面を
      // 離れている間に変わっている可能性があるため、必ず再描画してから表示する
      if (btn.dataset.back === "screen-findcountry-difficulty") {
        FindCountryModule.openDifficultyScreen();
        return;
      }
      showScreen(btn.dataset.back);
    });
  });
}

function updateSoundButton() {
  const enabled = SoundManager.isEnabled();
  $("btn-sound-toggle").setAttribute("aria-pressed", String(enabled));
  $("sound-icon").textContent = enabled ? "🔊" : "🔇";
  $("sound-label").textContent = enabled ? "効果音 ON" : "効果音 OFF";
}

// ==========================================================
// 問題数選択画面
// ==========================================================
// 国旗クイズ/首都クイズどちらのモードで来たかによって198問カードの
// 文言だけを変える。呼び出しごとに作り直すので、モード選択のたびに
// 正しい文言になる。
function renderSelectScreen() {
  const grid = $("count-options");
  grid.innerHTML = "";
  const isCapital = state.mode === "capital";
  QUESTION_COUNTS.forEach((count) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "count-card" + (count === 198 ? " special" : "");
    if (count === 198) {
      const completeLabel = isCapital ? "WORLD CAPITAL COMPLETE 全ての首都" : "WORLD COMPLETE 全ての国旗";
      card.innerHTML = `<div class="count-crown">👑</div><div class="count-num">198問</div><div class="count-complete">${completeLabel}</div>`;
    } else {
      card.innerHTML = `<div class="count-num">${count}</div><div class="count-unit">問</div>`;
    }
    card.addEventListener("click", () => {
      state.selectedCount = count;
      startQuiz(count);
    });
    grid.appendChild(card);
  });
}

// ==========================================================
// クイズ画面
// ==========================================================
function startQuiz(count) {
  state.questions = QuizEngine.buildQuestionSet(count);
  state.currentQuestionIndex = 0;
  state.score = 0;
  state.wrongIds = new Set(); // 前回の復習対象をクリアする(第3段階A案)
  // トロフィー刷新 Stage C: このプレイの開始時刻と回答時間記録をリセットする
  state.quizStartedAt = new Date().toISOString();
  state.answerTimings = [];
  // 共通トロフィー(四つの扉): 実際に問題を開始した時点(設定画面を開くだけ
  // では呼ばれない)で、国旗/首都クイズを使用したことを記録する
  try {
    if (typeof TrophyModule !== "undefined" && typeof TrophyModule.recordCommonModeUsed === "function") {
      TrophyModule.recordCommonModeUsed(state.mode);
    }
  } catch (e) { /* noop */ }
  showScreen("screen-quiz");
  renderQuestion();
}

// 首都クイズの問題文を作る。南アフリカ・ボリビア・ナウルのように、単純な
// 「○○の首都は？」では不正確・分かりにくくなる国は、countries.js側に
// capitalQuestionText(任意プロパティ)を設定しておけばそれを使う。
// 特定の国だけをidで判定する分岐を増やさずに済むため、今後同様の国が
// 増えてもここのコードを変更せずデータ追加だけで対応できる
function getCapitalQuestionText(country) {
  if (country.capitalQuestionText) return country.capitalQuestionText;
  return `${country.name}の首都は？`;
}

// 正誤判定後、次の問題に進むまでの1.5秒待ちを管理する。終了確認モーダルを
// 開いている間はこの待ちも一時停止し、「続ける」で残り時間から再開する
// (QuestionTimer.pause()/resume()と同じ考え方)
function scheduleNextQuestion(delayMs) {
  state.nextQuestionRemainingMs = delayMs;
  state.nextQuestionScheduledAt = performance.now();
  state.nextQuestionTimeoutId = setTimeout(() => {
    state.nextQuestionTimeoutId = null;
    state.nextQuestionRemainingMs = null;
    goToNextQuestion();
  }, delayMs);
}
function pausePendingNextQuestion() {
  if (state.nextQuestionTimeoutId === null) return;
  clearTimeout(state.nextQuestionTimeoutId);
  state.nextQuestionTimeoutId = null;
  const elapsed = performance.now() - state.nextQuestionScheduledAt;
  state.nextQuestionRemainingMs = Math.max(0, state.nextQuestionRemainingMs - elapsed);
}
function resumePendingNextQuestion() {
  if (state.nextQuestionRemainingMs === null || state.nextQuestionTimeoutId !== null) return;
  state.nextQuestionScheduledAt = performance.now();
  state.nextQuestionTimeoutId = setTimeout(() => {
    state.nextQuestionTimeoutId = null;
    state.nextQuestionRemainingMs = null;
    goToNextQuestion();
  }, state.nextQuestionRemainingMs);
}
// 問題切り替え・途中終了などで、次の問題への遷移が残らないようにする
function clearPendingNextQuestion() {
  if (state.nextQuestionTimeoutId !== null) {
    clearTimeout(state.nextQuestionTimeoutId);
    state.nextQuestionTimeoutId = null;
  }
  state.nextQuestionRemainingMs = null;
}

// 回答ボタンの有効/無効をまとめて切り替える。画像が読み込み終わる前は
// 操作できないようにし(読み込み完了後に有効化)、正誤判定後はhandleAnswer側で
// 個別に無効化する(そちらは変更しない)
function setChoicesEnabled(enabled) {
  document.querySelectorAll("#choices-grid .choice-btn").forEach((b) => {
    b.disabled = !enabled;
  });
}

// 画像読み込み完了後のタイマー開始を1本化する。state.timerStartedで
// 同一問題につき1回だけに制限し(onload/completeの二重発火、
// 終了確認「続ける」からの呼び出しの両方から安全に呼べる)
function beginCountdownNow() {
  if (state.timerStarted) return;
  state.timerStarted = true;
  $("thinking-message").classList.remove("hidden"); // 「よく見て考えよう！」をここで表示する
  state.timer.start();
}

function renderQuestion() {
  state.answered = false;
  clearPendingNextQuestion(); // 前の問題の「次へ」待ちが万一残っていても確実に解除する
  const idx = state.currentQuestionIndex;
  const total = state.questions.length;
  const country = state.questions[idx];
  const isCapitalMode = state.mode === "capital";
  // この問題専用の世代番号。画像の読み込みが遅れている間に(戻る/進む等で)
  // 別の問題に切り替わった場合、古い問題のonload/onerrorがその時点の
  // 「現在の問題」のタイマーを誤って開始させないようにするためのガード
  state.questionGeneration += 1;
  const generation = state.questionGeneration;
  state.imageLoaded = false;
  state.timerStarted = false;

  $("quiz-progress-text").textContent = `${modeEmoji(state.mode)} 問題 ${idx + 1} / ${total}`;
  $("quiz-score-text").textContent = `正解 ${state.score}`;
  $("progress-bar-inner").style.width = `${Math.round((idx / total) * 100)}%`;

  const countryNameEl = $("quiz-country-name");
  if (isCapitalMode) {
    countryNameEl.textContent = country.name;
    countryNameEl.classList.remove("hidden");
    $("quiz-instruction").textContent = getCapitalQuestionText(country);
  } else {
    countryNameEl.classList.add("hidden");
    $("quiz-instruction").textContent = "この国旗はどこの国？";
  }

  // 「よく見て考えよう！」とカウントダウンは同じ表示エリアを共有する。
  // どちらも画像の読み込み完了(=タイマー開始)まではいったん非表示にし、
  // 「考える時間」のつもりで表示されたまま画像がまだ見えていない、という
  // 状態を避ける(タイマー開始時にstartTimerIfCurrent()内で表示する)
  $("thinking-message").classList.add("hidden");
  const countdownDisplay = $("countdown-display");
  countdownDisplay.classList.add("hidden");
  countdownDisplay.classList.remove("warn-3", "warn-2", "warn-1");

  $("result-overlay").classList.add("hidden");
  $("result-note").classList.add("hidden");
  state.lastCountdownSecond = null; // カウントダウン効果音の重複再生防止用カウンタをリセット

  // 誤答候補はcountries全198件(現在の正解国のみ除外)から選ぶ。
  // このゲームで出題される他の国を除外しない(198問モードで
  // 誤答候補が0件になっていた不具合の原因だったため)。
  const question = isCapitalMode
    ? QuizEngine.buildCapitalQuestion(country)
    : QuizEngine.buildQuestion(country);
  renderChoices(question.choices, country); // ボタンは読み込み中は無効(renderChoices内でdisabled=true)

  if (state.timer) state.timer.stop();
  state.timer = new QuestionTimer({
    onTick: (phase, secondsLeft) => handleTimerTick(phase, secondsLeft),
    onTimeout: () => {
      // カウントダウンが0になった瞬間の合図音(ゲーム進行そのものには影響しない演出音)
      SoundManager.playCountdownEnd();
      handleAnswer(null);
    },
  });

  // 国旗画像の読み込みが完了するまで「考える3秒+カウントダウン5秒」を
  // 開始しない(通信が遅い環境で、画像が表示される前に時間が減っていくのを
  // 防ぐため)。すでにキャッシュされている画像はimg.completeが直後にtrueに
  // なるので待たせない。generationが変わっていたら(=既に別の問題に進んでいる)
  // この問題のタイマーを開始しない
  const img = $("quiz-flag-img");
  const loadingEl = $("flag-loading");
  const errorEl = $("flag-error");
  img.classList.remove("hidden");
  loadingEl.classList.add("hidden");
  errorEl.classList.add("hidden");
  img.onload = null;
  img.onerror = null;
  img.alt = isCapitalMode ? `${country.name}の国旗` : "国旗クイズ(国名は選択肢から選んでください)";

  function startTimerIfCurrent() {
    if (generation !== state.questionGeneration) return; // 古い問題(または終了後)の読み込み完了は無視
    if (state.imageLoaded) return; // img.onloadとimg.completeの両方から呼ばれても1回だけ処理する
    state.imageLoaded = true;
    loadingEl.classList.add("hidden");
    setChoicesEnabled(true); // 画像が見える状態になってから回答できるようにする
    if (quizExitConfirmOpen) return; // 終了確認中はタイマーを開始しない。「続ける」を選んだ時にinitQuizExit側で開始する
    beginCountdownNow();
  }

  img.onload = startTimerIfCurrent;
  img.onerror = () => {
    if (generation !== state.questionGeneration) return;
    loadingEl.classList.add("hidden");
    img.classList.add("hidden");
    errorEl.classList.remove("hidden");
    // 読み込みに失敗した場合はタイマーを開始しない(時間切れにしない)。
    // 「再読み込み」ボタン(initFlagRetry参照)で同じ問題のまま再試行できる
  };
  img.src = country.flag;

  if (img.complete && img.naturalWidth > 0) {
    // 既にブラウザキャッシュにある場合はonloadが発火しないことがあるため、
    // 直後に同期的にcompleteをチェックして即座に開始する
    startTimerIfCurrent();
  } else {
    loadingEl.classList.remove("hidden");
  }
}

function handleTimerTick(phase, secondsLeft) {
  // 「よく見て考えよう！」とカウントダウンは同じtimer-area内の
  // 同じ位置で表示を切り替えるだけで、エリアの高さ自体は変えない
  const thinking = $("thinking-message");
  const countdownDisplay = $("countdown-display");
  if (phase === "thinking") {
    thinking.classList.remove("hidden");
    countdownDisplay.classList.add("hidden");
  } else {
    thinking.classList.add("hidden");
    countdownDisplay.classList.remove("hidden");
    $("countdown-label").textContent = `残り${secondsLeft}秒！`;
    $("countdown-number").textContent = secondsLeft;
    countdownDisplay.classList.remove("warn-3", "warn-2", "warn-1");
    if (secondsLeft <= 1) countdownDisplay.classList.add("warn-1");
    else if (secondsLeft <= 2) countdownDisplay.classList.add("warn-2");
    else if (secondsLeft <= 3) countdownDisplay.classList.add("warn-3");

    // 数字が切り替わった瞬間だけ効果音を鳴らす(既存のタイマー構造は変更しない)
    if (state.lastCountdownSecond !== secondsLeft) {
      state.lastCountdownSecond = secondsLeft;
      if (secondsLeft >= 4) SoundManager.playCountdownLow();
      else SoundManager.playCountdownHigh();
    }
  }
}

function renderChoices(choices, correctCountry) {
  const grid = $("choices-grid");
  grid.innerHTML = "";
  const isCapitalMode = state.mode === "capital";
  choices.forEach((c) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice-btn";
    btn.textContent = isCapitalMode ? c.capital : c.name;
    btn.dataset.id = c.id;
    btn.disabled = true; // 画像の読み込みが終わるまでは回答できない(startTimerIfCurrentで有効化)
    btn.addEventListener("click", () => handleAnswer(c.id));
    grid.appendChild(btn);
  });
}

function handleAnswer(selectedId) {
  if (state.answered) return; // 高速連打・複数回答防止
  state.answered = true;

  if (state.timer) state.timer.stop(); // 回答時にタイマーを解除

  // すべての回答ボタンを無効化する
  const buttons = Array.from(document.querySelectorAll("#choices-grid .choice-btn"));
  buttons.forEach((b) => (b.disabled = true));

  const idx = state.currentQuestionIndex;
  const correctCountry = state.questions[idx];
  const isTimeout = selectedId === null;
  const isCorrect = !isTimeout && selectedId === correctCountry.id;
  const isCapitalMode = state.mode === "capital";
  const correctText = isCapitalMode ? correctCountry.capital : correctCountry.name;

  // トロフィー刷新 Stage C: この問題の回答時間(秒)を記録する(#20〜29・69の
  // 回答時間判定用データ)。timer.startTime はQuestionTimer.start()が
  // beginCountdownNow()から呼ばれた時点(画像読み込み完了・回答可能になった
  // 瞬間)のperformance.now()で、pause()/resume()時にも一時停止分を除いて
  // 補正されるため、そのまま「出題から回答までの経過時間」として使える。
  // 時間切れ(isTimeout)の回答も、約8秒(QuizEngine.TOTAL_SECONDS)として
  // そのまま記録する(不正解として扱われるため、どのみち速さの判定対象には
  // ならない)。永続保存はせず、このプレイのstate.answerTimingsに積むだけ
  if (state.timer && Number.isFinite(state.timer.startTime)) {
    const elapsedSeconds = (performance.now() - state.timer.startTime) / 1000;
    state.answerTimings.push({ countryId: correctCountry.id, correct: isCorrect, elapsedSeconds });
  }

  // 共通トロフィー(累積がんばり系): 回答確定時に記録し、中断しても
  // この問題までの正解・誤答は保持する。時間切れはパスと同じく誤答に
  // 数えない(企画書の指示どおり)
  try {
    if (typeof TrophyModule !== "undefined" && typeof TrophyModule.recordCommonTally === "function") {
      TrophyModule.recordCommonTally(state.mode, isCorrect ? "correct" : (isTimeout ? null : "wrong"));
    }
  } catch (e) { /* noop */ }

  buttons.forEach((b) => {
    if (b.dataset.id === correctCountry.id) {
      b.classList.add("is-correct");
    } else if (b.dataset.id === selectedId) {
      b.classList.add("is-wrong");
    } else {
      b.classList.add("is-dimmed");
    }
  });

  const overlay = $("result-overlay");
  overlay.classList.remove("hidden", "correct", "wrong");

  if (isCorrect) {
    state.score += 1;
    overlay.classList.add("correct");
    $("result-mark").textContent = "○";
    $("result-text").textContent = "正解！";
    $("result-answer").textContent = "";
    SoundManager.playCorrect();
  } else {
    // 不正解・時間切れのどちらも復習対象にする。選んだ誤答の国ではなく、
    // 問題として出題された正解国のidを記録する(第3段階A案)
    state.wrongIds.add(correctCountry.id);
    overlay.classList.add("wrong");
    $("result-mark").textContent = "×";
    $("result-text").textContent = isTimeout ? "時間切れ！" : "不正解！";
    $("result-answer").textContent = `正解は『${correctText}』です`;
    SoundManager.playWrong();
  }

  // 首都に特殊事情がある国は、正解・不正解に関わらず小さく補足を表示する
  // (例: 南アフリカは首都機能が複数都市に分かれている)
  const noteEl = $("result-note");
  const hasNote = isCapitalMode && !!correctCountry.capitalNote;
  if (hasNote) {
    noteEl.textContent = correctCountry.capitalNote;
    noteEl.classList.remove("hidden");
  } else {
    noteEl.classList.add("hidden");
  }

  $("quiz-score-text").textContent = `正解 ${state.score}`;

  // 補足説明(capitalNote)が無い通常の問題は従来どおり1.5秒。補足説明がある
  // 問題は読む時間を確保するため約4秒(長い説明は最大5秒まで)に延長する
  scheduleNextQuestion(hasNote ? computeNoteDisplayMs(correctCountry.capitalNote) : 1500);
}

// 補足説明(capitalNote)を読み終えるのに必要なおおよその時間を見積もる。
// 短い説明は一律4秒、長い説明(40文字超)はその分だけ延長し、5秒を上限にする
function computeNoteDisplayMs(note) {
  const BASE_MS = 4000;
  const MAX_MS = 5000;
  const READABLE_LENGTH = 40; // この文字数までは基準の4秒で読み切れると想定
  const MS_PER_EXTRA_CHAR = 15;
  const extra = Math.max(0, note.length - READABLE_LENGTH) * MS_PER_EXTRA_CHAR;
  return Math.min(MAX_MS, BASE_MS + extra);
}

function goToNextQuestion() {
  state.currentQuestionIndex += 1;
  if (state.currentQuestionIndex >= state.questions.length) {
    finishQuiz();
  } else {
    renderQuestion();
  }
}

let quizExitConfirmOpen = false; // 確認モーダルが開いている間、連打で二重に開かないようにする
// 国旗画像の読み込みに失敗したとき、同じ問題のまま再試行する。
// キャッシュに失敗状態が残っている場合に備え、クエリ文字列を付けて
// 強制的に再リクエストする(同一オリジンのローカル画像のみなのでCORSの問題はない)
function initFlagRetry() {
  $("flag-error-retry").addEventListener("click", () => {
    const country = state.questions[state.currentQuestionIndex];
    if (!country) return;
    const img = $("quiz-flag-img");
    const loadingEl = $("flag-loading");
    const errorEl = $("flag-error");
    errorEl.classList.add("hidden");
    img.classList.remove("hidden");
    loadingEl.classList.remove("hidden");
    img.src = `${country.flag}${country.flag.includes("?") ? "&" : "?"}retry=${Date.now()}`;
  });
}

function initQuizExit() {
  $("btn-quiz-exit").addEventListener("click", async () => {
    if (quizExitConfirmOpen) return;
    quizExitConfirmOpen = true;
    // 終了するか考えている間は、問題の進行(タイマー・正誤判定後の次問題への
    // 遷移)を一時停止する。state.timerが無い(=既にタイマーが無い)場合や、
    // 既にstop()済みの場合はpause()が何もしない安全な実装になっている
    if (state.timer) state.timer.pause();
    pausePendingNextQuestion();
    const ok = await showConfirm("クイズを終了しますか？");
    quizExitConfirmOpen = false;
    if (ok) {
      if (state.timer) state.timer.stop();
      clearPendingNextQuestion();
      // 世代番号を進めて、保留中(終了確認中に届いた/これから届く)の
      // img.onload・onerrorを「古い問題」として無効化する。これにより
      // 終了後に画像読み込みが完了してもタイマーが開始されない
      state.questionGeneration += 1;
      showScreen("screen-top");
    } else if (state.timer && state.timer.paused) {
      // タイマーが既に開始済み(=読み込み完了後に開いた)だった場合は、
      // 一時停止していた残り時間から再開する
      state.timer.resume();
      resumePendingNextQuestion();
    } else {
      // タイマー未開始のまま終了確認を開いていた場合。画像読み込みが
      // 確認中に完了していれば今ここで開始し(要件: 8秒から開始)、
      // まだ読み込み中なら何もせず、読み込み完了時のstartTimerIfCurrentが
      // (quizExitConfirmOpenが既にfalseなので)開始する
      if (state.imageLoaded) beginCountdownNow();
      resumePendingNextQuestion();
    }
  });
}

// ==========================================================
// 結果画面
// ==========================================================
function finishQuiz() {
  if (state.timer) state.timer.stop();
  const total = state.questions.length;
  const correct = state.score;
  const rate = Math.round((correct / total) * 100);
  const mode = state.mode;

  // 国旗クイズ・首都クイズの記録は完全に別のlocalStorageキーに保存されるため混同しない
  Storage.incrementAttempts(mode);
  Storage.updateBestRate(rate, mode);
  const best = Storage.updateBestRecord(total, correct, total, mode);

  const perfect = correct === total;
  const titleObj = perfect ? getTitleByCount(total, mode) : null;
  let isNewTitle = false;
  if (titleObj) {
    isNewTitle = Storage.awardTitleIfNew(titleObj.id, mode);
  }

  // トロフィー刷新 第2段階〜Stage B: 既存のスコア・称号判定がすべて確定した
  // 後、新トロフィーシステム(js/trophy.js)の判定を呼ぶ。Stage Bで既存
  // データのみで判定できる79件が確定しているため、条件を満たせばここで
  // 実際に獲得される。例外が起きても既存のクイズ結果には一切影響しないよう
  // 必ずtry/catchで囲む
  const trophyContext = {
    mode,
    total,
    correct,
    rate,
    perfect,
    wrongIds: Array.from(state.wrongIds),
    correctIds: state.questions.filter((q) => !state.wrongIds.has(q.id)).map((q) => q.id),
    questionIds: state.questions.map((q) => q.id),
    // トロフィー刷新 Stage C: 判定エンジン(evaluateQuizFinish)自体は
    // まだこの2項目を使わない(#64・70・20〜29・69のcheck関数は未登録の
    // ため)が、統計記録(recordQuizStats)で使うのでここで一度だけ作る
    startedAt: state.quizStartedAt,
    answerTimings: state.answerTimings.slice(),
  };
  // トロフィー刷新 Stage E: 今回のプレイで新規に獲得したトロフィーidを
  // 結果画面・獲得演出画面で使うために受け取る。evaluateQuizFinish()は
  // 既に獲得済みのトロフィーをawardedIdsに含めない(isEarned()チェック済み)
  // ため、ここで二重表示・再表示の心配をする必要はない
  let newTrophyIds = [];
  try {
    if (typeof TrophyModule !== "undefined") {
      const trophyResult = TrophyModule.evaluateQuizFinish(trophyContext);
      if (trophyResult && Array.isArray(trophyResult.awardedIds)) {
        newTrophyIds = trophyResult.awardedIds;
      }
    }
  } catch (e) {
    console.warn("トロフィー判定に失敗しました(クイズ結果には影響しません)", e);
  }
  // トロフィー刷新 Stage C: 判定(上記)が確定した後、統計・履歴
  // (wfq_v1_trophy_stats)を記録する。獲得可否の判定は一切行わない。
  // 判定と記録を別のtry/catchに分けているのは、片方で例外が起きても
  // もう片方(および既存のクイズ結果)に影響しないようにするため
  try {
    if (typeof TrophyModule !== "undefined" && typeof TrophyModule.recordQuizStats === "function") {
      TrophyModule.recordQuizStats(trophyContext);
    }
  } catch (e) {
    console.warn("トロフィー統計の記録に失敗しました(クイズ結果には影響しません)", e);
  }

  // 完了したクイズの復習対象として、このクイズ中に記録した不正解idの
  // スナップショットを持たせる(配列に変換。以後state.wrongIdsが新しい
  // クイズでリセットされても、この結果画面用のコピーには影響しない)
  state.lastResult = { correct, total, rate, titleObj, isNewTitle, best, mode, wrongIds: Array.from(state.wrongIds), newTrophyIds };
  renderResultScreen();
  showScreen("screen-result");
}

function renderResultScreen() {
  const { correct, total, rate, titleObj, best, wrongIds, newTrophyIds } = state.lastResult;
  $("result-score-fraction").textContent = `${total}問中${correct}問正解！`;
  $("result-score-rate").textContent = `正答率 ${rate}％`;

  let message;
  if (rate === 100) message = "パーフェクト！";
  else if (rate >= 80) message = "すごい！";
  else if (rate >= 60) message = "あと少し！";
  else message = "もう一度挑戦してみよう！";
  $("result-message").textContent = message;

  $("result-best-record").textContent = best ? `${total}問モードの最高記録：${best.correct} / ${best.total}` : "";

  const viewTitleBtn = $("btn-result-view-title");
  const memorialBtn = $("btn-result-memorial");
  if (titleObj) {
    viewTitleBtn.classList.remove("hidden");
    memorialBtn.classList.remove("hidden");
  } else {
    viewTitleBtn.classList.add("hidden");
    memorialBtn.classList.add("hidden");
  }

  // 間違いが1問も無ければ(全問正解)復習ボタンは表示しない(第3段階A案)
  const reviewBtn = $("btn-result-review");
  const wrongCount = (wrongIds && wrongIds.length) || 0;
  if (wrongCount > 0) {
    reviewBtn.textContent = `📖 間違えた${wrongCount}問を復習`;
    reviewBtn.classList.remove("hidden");
  } else {
    reviewBtn.classList.add("hidden");
  }

  // トロフィー刷新 Stage E: 今回新規に獲得したトロフィーがあれば、既存の
  // 「🏅 称号を見る」ボタン(古い12称号用、挙動は一切変更しない)とは別の
  // ボタンで新しいトロフィー獲得演出への入口を出す
  const trophyBtn = $("btn-result-view-trophies");
  const newTrophyCount = (newTrophyIds && newTrophyIds.length) || 0;
  if (newTrophyCount > 0) {
    trophyBtn.textContent = `🏆 新しいトロフィー(${newTrophyCount}件)`;
    trophyBtn.classList.remove("hidden");
  } else {
    trophyBtn.classList.add("hidden");
  }
}

function initResultScreen() {
  $("btn-result-review").addEventListener("click", () => {
    const { wrongIds, mode } = state.lastResult;
    ReviewModule.open(wrongIds, mode);
  });
  $("btn-result-retry").addEventListener("click", () => startQuiz(state.selectedCount));
  $("btn-result-change-count").addEventListener("click", () => {
    renderSelectScreen();
    showScreen("screen-select");
  });
  $("btn-result-top").addEventListener("click", () => showScreen("screen-top"));
  $("btn-result-view-title").addEventListener("click", () => {
    renderTitleAwardScreen();
    showScreen("screen-title-award");
  });
  $("btn-result-view-trophies").addEventListener("click", () => {
    renderTrophyAwardScreen();
    showScreen("screen-trophy-award");
  });
  $("btn-result-memorial").addEventListener("click", () => {
    openMemorialScreen();
  });
}

// ==========================================================
// 称号獲得画面
// ==========================================================
function renderTitleAwardScreen() {
  const { titleObj, isNewTitle, total } = state.lastResult;
  if (!titleObj) return;

  $("award-new-badge").classList.toggle("hidden", !isNewTitle);
  $("award-medal").className = `medal medal-lg ${titleObj.medalClass}`;
  $("award-title-name").textContent = titleObj.name;
  $("award-title-desc").textContent = titleObj.condition;

  const confettiWrap = $("confetti-canvas-wrap");
  confettiWrap.innerHTML = "";
  if (total === 198) {
    SoundManager.playFanfare();
    runConfetti(confettiWrap);
  }
}

function initTitleAwardScreen() {
  $("btn-award-memorial").addEventListener("click", () => openMemorialScreen());
  $("btn-award-continue").addEventListener("click", () => showScreen("screen-result"));
}

// 依存ライブラリなしの軽量な紙吹雪演出(198問全問正解時のみ)
function runConfetti(container) {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  container.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const colors = ["#ffd76a", "#d4a017", "#2f6fed", "#ff9800", "#1fa64c", "#e5384d"];
  const pieces = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * 0.5,
    size: 5 + Math.random() * 6,
    speed: 2 + Math.random() * 3,
    drift: (Math.random() - 0.5) * 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    rotation: Math.random() * 360,
    rotSpeed: (Math.random() - 0.5) * 10,
  }));
  let frame = 0;
  const maxFrames = 240;
  function draw() {
    frame++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach((p) => {
      p.y += p.speed;
      p.x += p.drift;
      p.rotation += p.rotSpeed;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });
    if (frame < maxFrames) {
      requestAnimationFrame(draw);
    } else {
      container.innerHTML = "";
    }
  }
  draw();
}

// 謎解きトロフィー専用の獲得演出(screen-puzzle-trophy-award、第3段階)で
// 使う、金色の光が画面中央に集まるCanvas 2Dエフェクト。runConfetti()
// (上から降る紙吹雪)とは見た目も用途も異なるため複製せず新規に用意したが、
// 実装方針(軽量なCanvas描画、prefers-reduced-motionなら即return、
// 一定フレーム数で自動的に消える)は完全に揃えている
function runGoldConverge(container) {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  container.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const colors = ["#ffd76a", "#ffe9a8", "#d4a017", "#fff6d6"];
  const cx = canvas.width / 2;
  const cy = canvas.height * 0.4; // アイコンの中心付近に収束させる
  const pieces = Array.from({ length: 70 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 120 + Math.random() * Math.max(canvas.width, canvas.height) * 0.4;
    return {
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      size: 2 + Math.random() * 4,
      speed: 0.02 + Math.random() * 0.02, // 収束の進み具合(0〜1の補間係数)
      t: 0,
      startX: cx + Math.cos(angle) * dist,
      startY: cy + Math.sin(angle) * dist,
      color: colors[Math.floor(Math.random() * colors.length)],
    };
  });
  let frame = 0;
  const maxFrames = 90;
  function draw() {
    frame++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach((p) => {
      p.t = Math.min(1, p.t + p.speed);
      p.x = p.startX + (cx - p.startX) * p.t;
      p.y = p.startY + (cy - p.startY) * p.t;
      const fade = 1 - p.t * 0.7;
      ctx.save();
      ctx.globalAlpha = Math.max(0, fade);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    if (frame < maxFrames) {
      requestAnimationFrame(draw);
    } else {
      container.innerHTML = "";
    }
  }
  draw();
}

// ==========================================================
// トロフィー刷新 Stage E: 新トロフィー獲得演出画面
// 既存の「称号獲得画面」(screen-title-award、古い12称号専用)とは完全に
// 別の画面・別の状態(state.lastResult.newTrophyIds)を使うため、古い画面の
// 挙動には一切影響しない。1プレイで複数件同時獲得した場合も、ここで全件
// まとめて表示する(1件ずつの連続表示にはしない。スクロールで全件確認できる)
// ==========================================================

// 特別な隠しトロフィー#142「都の神話」専用アイコン(金色の王冠+地球儀)。
// 外部画像・追加アセットを使わず、インラインSVGのみで表現する(viewBoxで
// 拡縮するため、一覧カードの小さい丸アイコン・獲得演出画面の大きいアイコンの
// どちらにも同じマークアップを使い回せる)
const LEGEND_TROPHY_NUMBER = 142;
const LEGEND_ICON_SVG = `<svg viewBox="0 0 100 100" class="legend-svg" aria-hidden="true" focusable="false">
  <circle cx="50" cy="58" r="32" class="legend-globe-outline"></circle>
  <ellipse cx="50" cy="58" rx="32" ry="13" class="legend-globe-outline"></ellipse>
  <ellipse cx="50" cy="58" rx="13" ry="32" class="legend-globe-outline"></ellipse>
  <line x1="18" y1="58" x2="82" y2="58" class="legend-globe-outline"></line>
  <path d="M27 32 L33 15 L41 28 L50 12 L59 28 L67 15 L73 32 Z" class="legend-crown"></path>
  <circle cx="33" cy="15" r="2.6" class="legend-crown-jewel"></circle>
  <circle cx="50" cy="12" r="2.8" class="legend-crown-jewel"></circle>
  <circle cx="67" cy="15" r="2.6" class="legend-crown-jewel"></circle>
</svg>`;

// 世界図鑑トロフィー#158「世界の叡智」専用アイコン(開いた黄金の書物+
// そこから浮かび上がる世界地図)。#142と同じく外部画像を使わずインライン
// SVGのみで表現する。#142の演出・判定には一切触れず、新しいアイコンを
// 追加するだけ
const GREAT_LEGEND_TROPHY_NUMBER = 158;
const GREAT_LEGEND_ICON_SVG = `<svg viewBox="0 0 100 100" class="legend-svg legend-svg-great" aria-hidden="true" focusable="false">
  <path d="M50 32 L50 80 Q31 72 13 78 L13 36 Q31 28 50 32 Z" class="great-legend-page-left"></path>
  <path d="M50 32 L50 80 Q69 72 87 78 L87 36 Q69 28 50 32 Z" class="great-legend-page-right"></path>
  <line x1="50" y1="32" x2="50" y2="80" class="great-legend-spine"></line>
  <circle cx="50" cy="27" r="15" class="great-legend-globe"></circle>
  <ellipse cx="50" cy="27" rx="15" ry="6" class="great-legend-globe-line"></ellipse>
  <ellipse cx="50" cy="27" rx="6" ry="15" class="great-legend-globe-line"></ellipse>
  <line x1="35" y1="27" x2="65" y2="27" class="great-legend-globe-line"></line>
  <g class="great-legend-sparkle">
    <circle cx="22" cy="18" r="1.8"></circle>
    <circle cx="78" cy="20" r="1.4"></circle>
    <circle cx="68" cy="8" r="1.2"></circle>
    <circle cx="30" cy="8" r="1.1"></circle>
  </g>
</svg>`;

// 共通トロフィー#425「世界の真理 ～アカシック・レコード～」専用アイコン
// (全トロフィーの頂点=宇宙・星・黄金の光をテーマに、八条の光を放つ星+
// その中心に地球儀)。#142・#158の演出・判定・アイコンには一切触れず、
// 対象が#425の時だけ新しいアイコンに切り替える(新しい画像・音声アセットは
// 追加せず、既存と同じインラインSVG+既存のfanfare/confettiのみで表現する)
const TRUTH_TROPHY_NUMBER = 425;
const TRUTH_ICON_SVG = `<svg viewBox="0 0 100 100" class="legend-svg legend-svg-truth" aria-hidden="true" focusable="false">
  <g class="truth-rays">
    <line x1="50" y1="2" x2="50" y2="18"></line>
    <line x1="50" y1="98" x2="50" y2="82"></line>
    <line x1="2" y1="50" x2="18" y2="50"></line>
    <line x1="98" y1="50" x2="82" y2="50"></line>
    <line x1="15" y1="15" x2="26" y2="26"></line>
    <line x1="85" y1="85" x2="74" y2="74"></line>
    <line x1="85" y1="15" x2="74" y2="26"></line>
    <line x1="15" y1="85" x2="26" y2="74"></line>
  </g>
  <circle cx="50" cy="50" r="24" class="truth-globe"></circle>
  <ellipse cx="50" cy="50" rx="24" ry="10" class="truth-globe-line"></ellipse>
  <ellipse cx="50" cy="50" rx="10" ry="24" class="truth-globe-line"></ellipse>
  <line x1="26" y1="50" x2="74" y2="50" class="truth-globe-line"></line>
  <g class="truth-stars">
    <circle cx="20" cy="30" r="1.6"></circle>
    <circle cx="80" cy="28" r="1.3"></circle>
    <circle cx="78" cy="72" r="1.5"></circle>
    <circle cx="22" cy="74" r="1.2"></circle>
  </g>
</svg>`;

// #142「都の神話」・#158「世界の叡智」・#425「世界の真理」はいずれも
// 最高級デザイン(専用アイコン+専用の達成演出画面screen-trophy-legend)を
// 使う特別なトロフィーのため、ここで3件を対象として扱う。#142・#158単体の
// 表示・判定は一切変更していない(対象をもう1件増やしただけ)
function isLegendTrophyId(id) {
  return id === `trophy_${LEGEND_TROPHY_NUMBER}` || id === `trophy_${GREAT_LEGEND_TROPHY_NUMBER}` || id === `trophy_${TRUTH_TROPHY_NUMBER}`;
}
function isLegendTrophyNumber(number) {
  return number === LEGEND_TROPHY_NUMBER || number === GREAT_LEGEND_TROPHY_NUMBER || number === TRUTH_TROPHY_NUMBER;
}
function legendIconSvgForNumber(number) {
  if (number === TRUTH_TROPHY_NUMBER) return TRUTH_ICON_SVG;
  return number === GREAT_LEGEND_TROPHY_NUMBER ? GREAT_LEGEND_ICON_SVG : LEGEND_ICON_SVG;
}

function trophyModeIcon(mode) {
  if (mode === "flag" || mode === "flag_only") return "🌍";
  if (mode === "capital" || mode === "capital_only") return "🏙️";
  if (mode === "findcountry") return "🧭"; // ホーム画面の「世界の国どこかな？」モードカードと同じアイコン
  return "🏆";
}

// 共通トロフィー31種類(#395〜425)用: 種類・達成難易度に応じたアイコン。
// #425「世界の真理」は専用の演出画面・専用アイコン(COMMON_TRUTH_ICON_SVG)を
// 別途使うため、ここでは一覧カードの小アイコンとしてのみ✨を割り当てる
function commonTrophyIcon(number) {
  if (number >= 395 && number <= 402) return "🏅"; // 累計獲得数系
  if (number >= 403 && number <= 406) return "🔑"; // モード横断系
  if (number >= 407 && number <= 418) return "⏳"; // 累積プレイ・努力系
  if (number >= 419 && number <= 422) return "👑"; // 各モード完全制覇
  if (number === 423 || number === 424) return "🌌"; // 最終到達(90%/95%)
  if (number === 425) return "✨"; // 世界の真理(最高難易度)
  return "🏆";
}

// 「世界の国どこかな？」専用トロフィー36種類(#159〜194)用のレア度表示
// ラベル。rarityが未設定(既存の#1〜158)の場合はnullを返し、呼び出し側で
// バッジ自体を出さない
function trophyRarityLabel(rarity) {
  if (rarity === "normal") return "普通";
  if (rarity === "rare") return "レア";
  if (rarity === "super_rare") return "スーパーレア";
  return null;
}

// 首都トリビア(#113〜141)用: def.countries(国idの配列)から
// 「国名(首都名)・国名(首都名)」形式の表示文字列を作る。COUNTRIESに
// 存在しないidが混ざっていた場合は安全側に倒してnullを返す(推測で
// 補わない)
function trophyCountryPairLabel(countryIds) {
  if (!Array.isArray(countryIds) || countryIds.length === 0) return null;
  const labels = countryIds.map((id) => {
    const c = COUNTRIES.find((entry) => entry.id === id);
    return c ? `${c.name}(${c.capital})` : null;
  });
  if (labels.some((l) => !l)) return null;
  return labels.join("・");
}

// 直近にこの画面へ表示したトロフィーid一覧。クイズ経由(state.lastResult)・
// 図鑑経由(notifyNonQuizTrophyAward、state.lastResultを持たない)の
// どちらからでも、この画面を閉じる時に「今回どれを表示したか」を同じ場所
// から参照できるようにするための保持(state.lastResultが無い図鑑経由の
// 呼び出しで参照エラーにならないようにする)
let lastTrophyAwardIds = [];
// 図鑑(js/encyclopedia.js・地図連携)経由でこの画面を表示した場合のみ
// 設定する、「閉じた後に戻る画面」を表すコールバック。nullなら既定
// (クイズ経由、結果画面へ戻る)の挙動を使う
let trophyAwardOnContinue = null;

// 図鑑経由の通知のキュー管理。短時間に複数の獲得イベント(例: 詳細ページを
// 開いた直後に地図連携も成立した等)が発生しても、古い通知を破棄せず
// 1件ずつ順番に表示するためのもの。
// - nonQuizAwardQueue: まだ表示していないバッチ(1回のnotifyNonQuizTrophyAward
//   呼び出し=1バッチ、複数idを含むことがある)の配列
// - nonQuizAwardShownIds: 今回のキュー処理(最初の1件を表示し始めてから、
//   キューが完全に空になるまで)で表示済み・表示予定のid集合。同じidが
//   複数のイベントから二重に届いても、ここで重複を検出して無視する
//   (awardIfNew()の仕組み上、同じidが2回新規獲得として届くことは本来
//   無いはずだが、念のための安全策)
// - nonQuizAwardReturnScreenId: このキュー処理が始まる直前(=何も表示・
//   待機していない状態)にいた画面。キュー内の全バッチを表示し終えたら
//   最後にこの画面へ戻る
// - nonQuizTrophyAwardShowing: 現在screen-trophy-award(または専用演出の
//   screen-trophy-legend)を表示中かどうか
let nonQuizAwardQueue = [];
let nonQuizAwardShownIds = new Set();
let nonQuizAwardReturnScreenId = null;
let nonQuizTrophyAwardShowing = false;

// 世界図鑑(js/encyclopedia.js)の詳細ページ表示・地図連携・復習画面からの
// 表示など、クイズの結果画面を経由しないトロフィー獲得をここで通知する。
// state.lastResultには一切触れない(クイズ専用の情報を前提にしない)ため、
// 図鑑側のコードが「クイズの結果情報が存在する」という誤った前提で
// エラーになることはない。表示中に新たな獲得が発生した場合は破棄せず
// キューに積み、現在の通知(・専用演出)を閉じた後に順番に表示する
function notifyNonQuizTrophyAward(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return;
  // このキュー処理中に既に表示済み・表示予定のidは除外する(重複通知防止)
  const newIds = ids.filter((id) => !nonQuizAwardShownIds.has(id));
  if (newIds.length === 0) return;
  newIds.forEach((id) => nonQuizAwardShownIds.add(id));

  if (!nonQuizTrophyAwardShowing && nonQuizAwardQueue.length === 0) {
    // 何も表示中・待機中でもない状態からの最初のバッチの場合のみ、
    // 戻り先の画面をここで確定する(2件目以降の呼び出し時点では、
    // 既にscreen-trophy-awardが表示されているため、ここで戻り先を
    // 取り直すと戻り先を取り違えてしまう)
    const activeScreen = document.querySelector(".screen.active");
    nonQuizAwardReturnScreenId = activeScreen ? activeScreen.id : "screen-encyclopedia-list";
  }
  nonQuizAwardQueue.push(newIds);
  if (!nonQuizTrophyAwardShowing) {
    showNextNonQuizTrophyAward();
  }
}

// キューの先頭を1件表示する。キューが空になったら、このキュー処理が
// 始まる前にいた画面へ戻り、状態を次回の呼び出しのためにリセットする
function showNextNonQuizTrophyAward() {
  if (nonQuizAwardQueue.length === 0) {
    nonQuizTrophyAwardShowing = false;
    const returnScreenId = nonQuizAwardReturnScreenId || "screen-encyclopedia-list";
    nonQuizAwardReturnScreenId = null;
    nonQuizAwardShownIds = new Set();
    // このキュー処理自体が終わったら必ずnullに戻す。そのままにすると、
    // この後に別途(クイズ経由で)結果画面から通知画面を開いた際、
    // trophyAwardOnContinueが残っていることが原因で「結果画面へ」の
    // 代わりに誤って図鑑側の戻り先へ遷移してしまう
    trophyAwardOnContinue = null;
    showScreen(returnScreenId);
    return;
  }
  nonQuizTrophyAwardShowing = true;
  const ids = nonQuizAwardQueue.shift();
  trophyAwardOnContinue = showNextNonQuizTrophyAward;
  renderTrophyAwardScreen({ newTrophyIds: ids, mode: null, total: null, correct: null });
  showScreen("screen-trophy-award");
}

// overrideDataを渡した場合はそれを使い、省略時はクイズ結果
// (state.lastResult)を使う。図鑑経由(notifyNonQuizTrophyAward)は
// mode/total/correctを持たないoverrideDataを渡すため、198問満点演出の
// 条件(total===198 && correct===total)はnull同士の比較になり安全にfalseに
// なる(クイズ専用の演出が図鑑経由で誤発火することはない)
function renderTrophyAwardScreen(overrideData) {
  const { newTrophyIds, mode, total, correct } = overrideData || state.lastResult;
  const ids = newTrophyIds || [];
  lastTrophyAwardIds = ids;
  const list = $("trophy-award-list");
  list.innerHTML = "";
  let hasSecret = false;

  ids.forEach((id) => {
    const def = TrophyModule.getDefinition(id);
    if (!def) return; // 不正なid・定義が無いidは安全側に倒して何も表示しない
    const isSecret = !!def.hidden; // 隠しトロフィーを今回初めて発見したかどうか
    if (isSecret) hasSecret = true;
    const isLegend = isLegendTrophyId(id); // #142「都の神話」のみ最高級デザインを追加で重ねる
    const item = document.createElement("div");
    item.className = "trophy-award-item" + (isSecret ? " trophy-award-item-secret" : "") + (isLegend ? " trophy-award-item-legend" : "");
    // modeが"both"(デュアル)のトロフィーは、このプレイがどちら側
    // (国旗/首都)の達成かをcontextのmodeで表す(evaluate()はcontext.modeに
    // 対応する側しか判定しないため、このプレイで新規獲得できるのは必ず
    // mode(今回プレイしたモード)側のみ)
    const markIcon = isLegend
      ? legendIconSvgForNumber(def.number)
      : (def.category === "common" ? commonTrophyIcon(def.number) : (def.mode === "both" ? trophyModeIcon(mode) : trophyModeIcon(def.mode)));
    const markLabel = def.mode === "both" ? (mode === "capital" ? "首都クイズで達成" : "国旗クイズで達成") : "";
    // 隠しトロフィーの発見演出: 鍵アイコンが外れて本来のトロフィーアイコンが
    // 現れるアニメーション(CSS側の@keyframesで表現、過度な点滅・長時間化は避ける)
    const markHtml = isSecret
      ? `<div class="trophy-award-mark trophy-award-mark-secret${isLegend ? " trophy-award-mark-legend" : ""}"><span class="trophy-award-mark-lock">🔓</span><span class="trophy-award-mark-icon">${markIcon}</span></div>`
      : `<div class="trophy-award-mark">${markIcon}</div>`;
    // 首都トリビア(#113〜141)・#142「都の神話」のみ、対象2か国+首都または
    // 正式解説文を追加表示する(def.descriptionが無い他のトロフィーには
    // 一切影響しない)
    const pairLabel = trophyCountryPairLabel(def.countries);
    const descHtml = def.description
      ? `
        ${pairLabel ? `<p class="trophy-award-pair">${pairLabel}</p>` : ""}
        <p class="trophy-award-description${isLegend ? " trophy-award-description-legend" : ""}">${def.description}</p>`
      : "";
    item.innerHTML = `
      ${markHtml}
      <div class="trophy-award-info">
        ${isSecret ? `<p class="trophy-award-secret-label">${isLegend ? "👑 特別な隠しトロフィー発見！" : "🔓 隠しトロフィー発見！"}</p>` : ""}
        <p class="trophy-award-number">No.${def.number}</p>
        <p class="trophy-award-name">${def.name}</p>
        <p class="trophy-award-cond">${def.condition}</p>
        ${markLabel ? `<p class="trophy-award-sub">${markLabel}</p>` : ""}
        ${descHtml}
      </div>`;
    list.appendChild(item);
  });

  const secretBanner = $("trophy-award-secret-banner");
  secretBanner.classList.toggle("hidden", !hasSecret);

  $("trophy-award-count").textContent = ids.length > 0 ? `${ids.length}件のトロフィーを獲得しました！` : "";
  // 図鑑経由(overrideData指定時)は結果画面に戻らないため、ボタンの
  // 文言もそれに合わせて変える(クイズ経由の見た目・文言は変更しない)
  $("btn-trophy-award-continue").textContent = overrideData ? "戻る" : "結果画面へ";

  // 198問満点時の特別演出(既存のSoundManager.playFanfare()・runConfetti()を
  // そのまま再利用する。正式仕様の「198問満点時の特別演出」を、古い称号
  // 画面と同じ条件(total===198かつ満点)でここにも適用する)
  const confettiWrap = $("trophy-award-confetti-wrap");
  confettiWrap.innerHTML = "";
  if (ids.length > 0 && total === 198 && correct === total) {
    SoundManager.playFanfare();
    runConfetti(confettiWrap);
  }
}

function initTrophyAwardScreen() {
  // #142「都の神話」・#158「世界の叡智」のいずれかが今回新規に含まれていた
  // 場合のみ、戻る前に専用の達成演出画面(screen-trophy-legend)を1度だけ
  // 経由する。既存の獲得通知(このトロフィー一覧そのもの)・遷移先の決定は
  // 変更しない(間に専用演出を挟むだけ)。newTrophyIdsに含まれるのは1回限り
  // (awardIfNew()の重複防止により同じトロフィーは二度と新規獲得されない)
  // ため、演出の多重起動は構造的に発生しない。
  // 戻り先は、図鑑経由(notifyNonQuizTrophyAward)ならtrophyAwardOnContinueが
  // 設定されているためそれを使い、クイズ経由(null)なら既定の結果画面に戻る
  $("btn-trophy-award-continue").addEventListener("click", () => {
    const ids = lastTrophyAwardIds;
    const legendId = ids.find((id) => isLegendTrophyId(id));
    if (legendId) {
      renderLegendAwardScreen(Number(legendId.replace("trophy_", "")));
      showScreen("screen-trophy-legend");
    } else if (trophyAwardOnContinue) {
      trophyAwardOnContinue();
    } else {
      showScreen("screen-result");
    }
  });
}

// #142「都の神話」・#158「世界の叡智」共通の達成演出画面。トロフィー獲得
// 通知(screen-trophy-award)の「続ける」から、いずれかを新規獲得した場合
// のみ遷移する(過去データの救済処理(js/trophy.js側、起動時に静かに獲得
// 登録)はevaluate()を経由しないため、ここには一切出てこない=アプリ起動
// のたびに演出を繰り返さない)。numberで対象を切り替えるだけで、#142自身の
// 見た目・文言・判定には一切手を加えていない
function renderLegendAwardScreen(number) {
  const n = number || LEGEND_TROPHY_NUMBER;
  const isGreat = n === GREAT_LEGEND_TROPHY_NUMBER;
  const isTruth = n === TRUTH_TROPHY_NUMBER; // #425「世界の真理」(トロフィー機能の最終到達点)
  const def = TrophyModule.getDefinition(`trophy_${n}`);
  // #425のみ、正式名称を大きく掲げたうえで、最終獲得数・100%達成の表示を
  // 解説文の下に追加する(getProgressSummary()は一覧画面と全く同じ集計元
  // のため、ここでも必ず「獲得数/総数(100%)」になる)
  let descriptionHtml = def ? def.description : "";
  if (isTruth) {
    const summary = TrophyModule.getProgressSummary();
    descriptionHtml += `<br><br><strong>最終獲得数: ${summary.earnedCount} / ${summary.totalCount}(100%)</strong>`;
  }
  $("trophy-legend-description").innerHTML = descriptionHtml;
  $("trophy-legend-heading").textContent = isTruth ? "全トロフィー コンプリート！" : (isGreat ? "世界図鑑 完全制覇！" : "首都トリビア完全制覇！");
  $("trophy-legend-subheading").innerHTML = isTruth
    ? "その名は――<strong>世界の真理 ～アカシック・レコード～</strong>。"
    : (isGreat ? "その名は――<strong>世界の叡智</strong>。" : "その名は――<strong>都の神話</strong>。");
  $("legend-icon-wrap").innerHTML = legendIconSvgForNumber(n);
  const panel = $("screen-trophy-legend").querySelector(".legend-panel");
  panel.classList.toggle("legend-panel-great", isGreat);
  panel.classList.toggle("legend-panel-truth", isTruth);
  // 図鑑経由(trophyAwardOnContinueが設定されている)は結果画面に戻らないため、
  // ボタンの文言もそれに合わせて変える(クイズ経由=#142の既存文言は変更しない)
  $("btn-trophy-legend-continue").textContent = trophyAwardOnContinue ? "図鑑に戻る" : "結果画面へ";
  // 既存の紙吹雪・ファンファーレをそのまま再利用する(新しい音声・画像アセットは追加しない)。
  // データ(獲得状態)の保存はこの演出より前に完了済みのため、万一ここで例外が
  // 発生しても獲得データ自体が失われることはないが、画面操作不能を避けるため
  // try/catchで囲み、失敗時も「続ける」ボタンは必ず機能する状態を保つ
  const confettiWrap = $("trophy-legend-confetti-wrap");
  confettiWrap.innerHTML = "";
  try {
    SoundManager.playFanfare();
    runConfetti(confettiWrap);
  } catch (e) {
    console.warn("達成演出(紙吹雪/ファンファーレ)の再生に失敗しました", e);
  }
}

function initLegendAwardScreen() {
  $("btn-trophy-legend-continue").addEventListener("click", () => {
    if (trophyAwardOnContinue) {
      trophyAwardOnContinue();
    } else {
      showScreen("screen-result");
    }
  });
}

// ==========================================================
// 謎解きトロフィー専用の獲得演出画面(screen-puzzle-trophy-award、第3段階)。
// 既存のscreen-trophy-award(複数件対応の通知キュー、notifyNonQuizTrophyAward)・
// screen-trophy-legend(#142「都の神話」等専用)のどちらにも接続しない、
// 完全に独立した画面。謎解き1問の正解で獲得できるトロフィーは常に最大1件
// のため、複数件を順番に表示するキュー機構は持たない。js/puzzle.jsの
// handleSubmit()が、初めて正解した瞬間だけshowPuzzleTrophyAward()を呼ぶ
// ==========================================================
let puzzleAwardReturnScreenId = "screen-puzzle-flag-select";
let lastPuzzleAwardTrophyId = null;
// 世界7不思議: このトロフィー獲得演出を閉じた直後に、解放演出・全制覇演出
// へ続けるべきかどうかのフラグ(js/puzzle.jsのawardTrophyIfNew()・
// awardSevenWonderTrophyIfNew()が、showPuzzleTrophyAward()のoptionsを
// 経由して設定する)
let pendingSevenWondersUnlockAfterAward = false;
let pendingOmniscientGodAfterAward = false;

function renderPuzzleTrophyAwardScreen(def, options) {
  const opts = options || {};
  lastPuzzleAwardTrophyId = def.id;
  $("puzzle-award-name").textContent = def.name;
  $("puzzle-award-description").textContent = def.description || "";
  const screenEl = $("screen-puzzle-trophy-award");
  const panel = screenEl.querySelector(".puzzle-award-panel");
  panel.classList.remove("puzzle-award-skip"); // 前回表示時のスキップ状態を引き継がない
  // 世界7不思議の問題は、既存の謎解き獲得演出より一段豪華な専用デザイン
  // (黒曜石・金)を追加で重ねる(構造・ボタン・動作はすべて共通のまま)
  screenEl.classList.toggle("screen-puzzle-trophy-award-wonder", !!opts.isSevenWonder);
  panel.classList.toggle("puzzle-award-panel-wonder", !!opts.isSevenWonder);
  const confettiWrap = $("puzzle-award-confetti-wrap");
  confettiWrap.innerHTML = "";
  runGoldConverge(confettiWrap);
  SoundManager.playFanfare();
}

// 謎解きの正解判定(js/puzzle.js)が初回獲得を検知した時だけ呼ぶ。
// 開く直前にいた画面(常にscreen-puzzle-flag-select)を記憶しておき、
// 「閉じる」はそこへ戻る。
// options.unlockedSevenWondersAfter: 通常謎解きの最後の1問に正解し、同じ
// 瞬間にミステリーハンターも新規獲得した場合にtrue。
// options.isSevenWonder/options.omniscientAfter: 世界7不思議の問題に
// 正解した場合、および同じ瞬間に全知全能の神も新規獲得した場合にtrue
function showPuzzleTrophyAward(def, options) {
  const opts = options || {};
  const activeScreen = document.querySelector(".screen.active");
  puzzleAwardReturnScreenId = activeScreen ? activeScreen.id : "screen-puzzle-flag-select";
  pendingSevenWondersUnlockAfterAward = !!opts.unlockedSevenWondersAfter;
  pendingOmniscientGodAfterAward = !!opts.omniscientAfter;
  renderPuzzleTrophyAwardScreen(def, opts);
  showScreen("screen-puzzle-trophy-award");
}

// この演出画面の「閉じる」「トロフィーを見る」どちらのボタンからも、
// 世界7不思議の解放演出・全制覇演出をはさむ必要があれば先にそちらを表示し、
// 無ければそのまま本来の行き先(nextFn)へ進む。該当する演出は最大1つ
// (解放と全制覇が同時に発生することは構造上無い: 解放はミステリーハンター
// =通常謎解き完了、全制覇は全知全能の神=世界7不思議7問完了で、互いに
// 排他的な条件のため)
function proceedAfterPuzzleTrophyAward(nextFn) {
  if (pendingOmniscientGodAfterAward) {
    pendingOmniscientGodAfterAward = false;
    showSevenWondersOmniscientScreen(nextFn);
    return;
  }
  if (pendingSevenWondersUnlockAfterAward) {
    pendingSevenWondersUnlockAfterAward = false;
    showSevenWondersUnlockScreen(nextFn);
    return;
  }
  nextFn();
}

// トロフィー一覧を開き、今回獲得したカードまでスクロールして一時的に
// ハイライトする。獲得直後は絞り込みフィルターの影響で対象カードが
// 非表示になっている可能性があるため、「すべて」に戻してから開く
// (ユーザーが戻った後に再び絞り込みたい場合は、一覧画面側で改めて
// タブを選べばよい。この画面遷移専用の一時的な初期化)
function openTrophyListAndHighlight(trophyId) {
  state.trophyListFilter = { topBucket: "all", category: "all", status: "all" };
  renderTrophyListScreen();
  showScreen("screen-trophy-list");
  requestAnimationFrame(() => {
    const card = document.querySelector(`#trophy-grid [data-trophy-id="${trophyId}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.add("trophy-card-highlight");
    setTimeout(() => card.classList.remove("trophy-card-highlight"), 2200);
  });
}

function initPuzzleTrophyAwardScreen() {
  const panel = document.querySelector("#screen-puzzle-trophy-award .puzzle-award-panel");
  // 演出中に画面(ボタン以外)をタップすると、段階的な表示アニメーションを
  // 即座に完了させる(「タップでスキップ可能」の実装。ボタン自体のタップは
  // 通常のクリック動作を優先するため対象外にする)
  panel.addEventListener("click", (e) => {
    if (e.target.closest("button")) return;
    panel.classList.add("puzzle-award-skip");
  });
  $("btn-puzzle-award-view").addEventListener("click", () => {
    proceedAfterPuzzleTrophyAward(() => openTrophyListAndHighlight(lastPuzzleAwardTrophyId));
  });
  $("btn-puzzle-award-close").addEventListener("click", () => {
    proceedAfterPuzzleTrophyAward(() => showScreen(puzzleAwardReturnScreenId));
  });
}

// ==========================================================
// 世界7不思議: 解放演出・全制覇演出(第5段階)
// どちらも「続ける」ボタン1つだけの単純な画面で、渡されたafterFn()を
// 呼ぶだけで元の行き先(トロフィー一覧ハイライト、または元の画面)へ戻る。
// prefers-reduced-motionはCSS側(.seven-wonders-seal等のanimation)で
// 対応するため、ここでは演出の有無を分岐しない(表示されるマークアップ自体は
// 同じで、アニメーションだけがCSSのメディアクエリで無効化される)
// ==========================================================
let afterSevenWondersUnlockScreen = null;
let afterSevenWondersOmniscientScreen = null;

function showSevenWondersUnlockScreen(afterFn) {
  afterSevenWondersUnlockScreen = typeof afterFn === "function" ? afterFn : null;
  const def = typeof TrophyModule !== "undefined" && typeof TrophyModule.MYSTERY_HUNTER_NUMBER === "number"
    ? TrophyModule.getDefinition(`trophy_${TrophyModule.MYSTERY_HUNTER_NUMBER}`)
    : null;
  $("seven-wonders-unlock-description").textContent = def ? (def.description || "") : "";
  showScreen("screen-seven-wonders-unlock");
}

function showSevenWondersOmniscientScreen(afterFn) {
  afterSevenWondersOmniscientScreen = typeof afterFn === "function" ? afterFn : null;
  const def = typeof TrophyModule !== "undefined" && typeof TrophyModule.OMNISCIENT_GOD_NUMBER === "number"
    ? TrophyModule.getDefinition(`trophy_${TrophyModule.OMNISCIENT_GOD_NUMBER}`)
    : null;
  $("seven-wonders-omniscient-description").textContent = def ? (def.description || "") : "";
  const confettiWrap = $("seven-wonders-omniscient-confetti-wrap");
  confettiWrap.innerHTML = "";
  runConfetti(confettiWrap);
  SoundManager.playFanfare();
  showScreen("screen-seven-wonders-omniscient");
}

function initSevenWondersCinematicScreens() {
  $("btn-seven-wonders-unlock-continue").addEventListener("click", () => {
    const fn = afterSevenWondersUnlockScreen;
    afterSevenWondersUnlockScreen = null;
    if (fn) fn(); else showScreen("screen-trophy-list");
  });
  $("btn-seven-wonders-omniscient-continue").addEventListener("click", () => {
    const fn = afterSevenWondersOmniscientScreen;
    afterSevenWondersOmniscientScreen = null;
    if (fn) fn(); else showScreen("screen-trophy-list");
  });
}

// アプリ起動時に1回だけ呼ぶ、追いつき判定(本更新より前からすでに通常
// 謎解き126問を全問獲得済みだった利用者の解放)。新規に解放された場合のみ
// trueを返す(呼び出し元のinitApp()が、その場合だけ解放演出を初期表示に
// 差し込む)
function runSevenWondersStartupCatchUp() {
  if (typeof TrophyModule === "undefined" || typeof TrophyModule.evaluateSevenWondersCatchUp !== "function") return false;
  const result = TrophyModule.evaluateSevenWondersCatchUp();
  const mysteryHunterId = typeof TrophyModule.MYSTERY_HUNTER_NUMBER === "number"
    ? `trophy_${TrophyModule.MYSTERY_HUNTER_NUMBER}` : null;
  return !!mysteryHunterId && result.awardedIds.includes(mysteryHunterId);
}

// ==========================================================
// 世界7不思議: 不正解確定前の確認モーダル・ロック中タップ案内モーダル
// ==========================================================
let sevenWonderConfirmYesBusy = false;
function showSevenWonderConfirm() {
  return new Promise((resolve) => {
    const modal = $("seven-wonder-confirm-modal");
    const yesBtn = $("seven-wonder-confirm-yes");
    const noBtn = $("seven-wonder-confirm-cancel");
    sevenWonderConfirmYesBusy = false;
    modal.classList.remove("hidden");
    function cleanup(result) {
      modal.classList.add("hidden");
      yesBtn.removeEventListener("click", onYes);
      noBtn.removeEventListener("click", onNo);
      resolve(result);
    }
    function onYes() {
      // ボタンを押した瞬間に自分自身を無効化し、二重タップでの多重処理
      // (7日間ロックの二重記録等)を防ぐ
      if (sevenWonderConfirmYesBusy) return;
      sevenWonderConfirmYesBusy = true;
      cleanup(true);
    }
    function onNo() { cleanup(false); }
    yesBtn.addEventListener("click", onYes);
    noBtn.addEventListener("click", onNo);
  });
}

function showSevenWonderLockedModal() {
  const modal = $("seven-wonder-locked-modal");
  modal.classList.remove("hidden");
  const closeBtn = $("seven-wonder-locked-close");
  function onClose() {
    modal.classList.add("hidden");
    closeBtn.removeEventListener("click", onClose);
  }
  closeBtn.addEventListener("click", onClose);
}

// ==========================================================
// トロフィー刷新 Stage E: トロフィー一覧画面(新規・既存の「称号コレクション」
// 画面とは別画面)。107件すべてをカテゴリ別・獲得状況で絞り込んで表示する。
// 性能のため、カードは画面を開くたびに一度だけ全件分DOM生成し、以降の
// 絞り込み切り替えはCSSクラスの切り替え(表示/非表示)のみで行う
// (107件程度ならinnerHTML再構築でも十分軽いが、絞り込み操作のたびに
// 107枚分のDOMを作り直さない方が明らかに無駄が無いため)
// ==========================================================
function trophyEarnedState(def, earnedEntry) {
  if (def.mode === "both") {
    return {
      dual: true,
      flagEarned: !!(earnedEntry && earnedEntry.flag),
      capitalEarned: !!(earnedEntry && earnedEntry.capital),
      flagEarnedAt: earnedEntry && earnedEntry.flag ? earnedEntry.flag.earnedAt : null,
      capitalEarnedAt: earnedEntry && earnedEntry.capital ? earnedEntry.capital.earnedAt : null,
    };
  }
  return {
    dual: false,
    earned: !!(earnedEntry && earnedEntry.earnedAt),
    earnedAt: earnedEntry ? earnedEntry.earnedAt : null,
  };
}

// 将来のトロフィー固有画像用の共通化: 番号をキーに画像URLを登録すると、
// 一覧・詳細画面の丸アイコンがその画像に差し替わる構造だけを用意する。
// 現時点ではどの番号も未登録(空のまま)のため、既存の絵文字アイコン表示は
// 一切変わらない。保存データ・判定ロジック(js/trophy.js)には関与しない、
// 表示専用のマッピングで、将来はここに{番号: 画像URL}を追加するだけでよい
const TROPHY_ICON_IMAGE_URLS = {};
function trophyIconGlyphHtml(emoji, number) {
  const url = typeof number === "number" ? TROPHY_ICON_IMAGE_URLS[number] : null;
  return url
    ? `<img src="${url}" alt="" class="trophy-mark-image">`
    : `<span class="trophy-mark-icon">${emoji}</span>`;
}

// isSecretLocked: このトロフィー全体が隠し(hidden:true)かつ未獲得の間、
// マーク自体も鍵アイコン・「未発見」表記にする(名称・条件を伏せるのと揃える)。
// numberは省略可(指定時のみTROPHY_ICON_IMAGE_URLSを参照する)
function buildTrophyMarkHtml(iconEarned, iconLocked, earned, dateStr, label, isSecretLocked, number) {
  const icon = earned ? iconEarned : (isSecretLocked ? "🔒" : iconLocked);
  const lockedText = isSecretLocked ? "未発見" : "未獲得";
  return `
    <div class="trophy-mark ${earned ? "earned" : "locked"}" title="${label}">
      ${trophyIconGlyphHtml(icon, number)}
    </div>
    <p class="trophy-mark-date">${earned ? `${dateStr} 取得` : lockedText}</p>`;
}

// トロフィー一覧の集計方式A案: No.1〜19は国旗/首都を独立した2枠として
// 数えるため、一覧の表示もこの2枠を完全に独立した2枚のカードに分割する
// (従来の和暦表示「2026年11月16日」は半分幅のカードには長すぎるため、
// 分割カードだけYYYY.MM.DD形式のコンパクトな日付表示にする)
function formatCompactDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}.${m}.${d}`;
}

// No.1〜19専用: 国旗クイズ側/首都クイズ側いずれか一方だけの獲得状態を持つ、
// 単一モードのミニカードを1枚作る
function buildTrophySplitSideCard(def, modeLabel, icon, earned, earnedAt) {
  const card = document.createElement("div");
  card.className = "trophy-card trophy-card-split" + (earned ? "" : " locked");
  card.dataset.category = def.category;
  card.dataset.earned = String(earned);
  card.dataset.hidden = "false";
  card.dataset.trophyId = def.id;
  card.dataset.splitMode = modeLabel;
  card.dataset.trophyMode = def.mode || "";
  const dateStr = earnedAt ? formatCompactDate(new Date(earnedAt)) : "";
  card.innerHTML = `
    <div class="trophy-card-top">
      <span class="trophy-number">No.${def.number}</span>
      <span class="trophy-split-mode-badge">${modeLabel}</span>
    </div>
    <div class="trophy-marks">
      <div class="trophy-mark-col">
        ${buildTrophyMarkHtml(icon, icon, earned, dateStr, modeLabel, false, def.number)}
      </div>
    </div>
    <p class="trophy-name">${def.name}</p>
    <p class="trophy-cond">${def.condition}</p>`;
  return card;
}

// No.1〜19専用: 同じ番号の国旗クイズカード・首都クイズカードを、それぞれ
// 完全に独立したdata-earned/data-categoryを持つ.trophy-card要素として
// 作り、2枚まとめて1つの.trophy-dual-pair(トロフィー一覧グリッドの
// 1マス分)に収める。獲得判定・獲得日時の取得(trophyEarnedState)自体は
// 既存のデュアル処理をそのまま使い、変更していない
function buildDualSplitCardPair(def, earnedEntry) {
  const st = trophyEarnedState(def, earnedEntry);
  const wrap = document.createElement("div");
  wrap.className = "trophy-dual-pair";
  wrap.appendChild(buildTrophySplitSideCard(def, "国旗クイズ", "🌍", st.flagEarned, st.flagEarnedAt));
  wrap.appendChild(buildTrophySplitSideCard(def, "首都クイズ", "🏙️", st.capitalEarned, st.capitalEarnedAt));
  return wrap;
}

// ========================================================
// 謎解きトロフィー(def.category === "puzzle"、#256〜、第3段階)専用のカード。
// 既存のbuildTrophyCardElement()(隠しトロフィーのsecretLocked処理等)は
// 一切変更せず、renderTrophyGrid()がcategoryで分岐してこの関数を呼ぶ。
//
// 既存の隠しトロフィー仕様(secretLocked: 名称・条件の両方を伏せる)とは
// 異なり、謎解きトロフィーは未獲得でも問題文(def.condition=PUZZLE_
// QUESTIONS[].questionText)を常に見せ、「この謎に挑む」ボタンから
// 専用の国旗選択画面(js/puzzle.js)を開けるようにする。正式名称だけを
// 「？？？？？」で伏せ、獲得後にのみ解説文(def.description=
// PUZZLE_QUESTIONS[].explanationText)を表示する
// ========================================================
function buildPuzzleTrophyCardElement(def, earnedEntry) {
  const st = trophyEarnedState(def, earnedEntry);
  const card = document.createElement("div");
  card.className = "trophy-card trophy-card-puzzle" + (st.earned ? "" : " locked");
  card.dataset.category = def.category;
  card.dataset.earned = String(st.earned);
  card.dataset.hidden = "false";
  card.dataset.trophyMode = def.mode || "";
  // 「トロフィーを見る」(screen-puzzle-trophy-award)からこのカードへ
  // スクロール・ハイライトするための識別子
  card.dataset.trophyId = def.id;

  const question = (typeof PUZZLE_QUESTIONS_BY_ID !== "undefined" && def.puzzleQuestionId)
    ? PUZZLE_QUESTIONS_BY_ID[def.puzzleQuestionId]
    : null;
  const questionText = question ? question.questionText : (def.condition || "");
  const dateStr = st.earnedAt ? formatJapaneseDate(new Date(st.earnedAt)) : "";
  const categoryLabel = TROPHY_CATEGORY_LABELS[def.category] || "";
  const nameHtml = st.earned ? def.name : "？？？？？";
  const descHtml = st.earned && def.description ? `<p class="trophy-description">${def.description}</p>` : "";
  // 【PR #81最終調整】出典・注釈(descriptionNote)は、解説文とは別の要素
  // として、指定がある場合だけ表示する(未指定の問題では何も出力しない。
  // 空の<p>やラベルも出さない)
  const noteHtml = st.earned && def.descriptionNote ? `<p class="trophy-note">${def.descriptionNote}</p>` : "";
  const actionHtml = st.earned
    ? ""
    : `<button type="button" class="btn-puzzle-challenge" data-question-id="${def.puzzleQuestionId}">この謎に挑む</button>`;

  card.innerHTML = `
    <div class="trophy-card-top">
      <span class="trophy-number">No.${def.number}</span>
      <div class="trophy-card-badges">
        <span class="trophy-category-badge">${categoryLabel}</span>
      </div>
    </div>
    <div class="trophy-marks">
      <div class="trophy-mark-col">
        ${buildTrophyMarkHtml("🧩", "🧩", st.earned, dateStr, "獲得マーク", false)}
      </div>
    </div>
    <p class="trophy-name">${nameHtml}</p>
    <p class="trophy-cond trophy-puzzle-question">${questionText}</p>
    ${descHtml}
    ${noteHtml}
    ${actionHtml}`;

  if (!st.earned) {
    card.querySelector(".btn-puzzle-challenge").addEventListener("click", (e) => {
      e.stopPropagation();
      PuzzleModule.open({ questionId: def.puzzleQuestionId, questionText });
      showScreen("screen-puzzle-flag-select");
    });
  }
  return card;
}

// ========================================================
// 世界7不思議(7問本体+隠し特別2種、#386〜394)専用のカード。
// 既存のbuildPuzzleTrophyCardElement()・buildTrophyCardElement()は一切
// 変更せず、renderTrophyGrid()がdef.stage/def.categoryで分岐してこの関数を
// 呼ぶ(【トロフィーカテゴリー修正】隠し特別2種はdef.stage ===
// "sevenWondersSpecial"で判定するため、#393のdef.categoryが「謎解き
// トロフィー」に変わっても、このカードの判定自体には影響しない)。
// 既存の謎解き・隠しトロフィーのどちらとも異なる、黒曜石・金を基調にした
// 専用デザイン(CSS側、trophy-card-sevenwonder系クラス)を使う。
//
// def.puzzleQuestionId(SEVEN_WONDERS_QUESTIONS[].id)がある方=7問自体、
// 無い方=隠し特別2種(ミステリーハンター・全知全能の神)として分岐する
// ========================================================
function formatSevenWonderDateTime(ms) {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(new Date(ms));
  } catch (e) {
    const d = new Date(ms);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
}
function formatSevenWonderRemaining(remainingMs) {
  const totalMinutes = Math.max(0, Math.ceil(remainingMs / 60000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days > 0) parts.push(`${days}日`);
  if (hours > 0 || days > 0) parts.push(`${hours}時間`);
  parts.push(`${minutes}分`);
  return parts.join("");
}

function buildSevenWonderPuzzleCard(card, def, st) {
  const question = (typeof SEVEN_WONDERS_QUESTIONS_BY_ID !== "undefined" && def.puzzleQuestionId)
    ? SEVEN_WONDERS_QUESTIONS_BY_ID[def.puzzleQuestionId]
    : null;
  const state = typeof TrophyModule.getSevenWonderState === "function"
    ? TrophyModule.getSevenWonderState(def.puzzleQuestionId)
    : (st.earned ? "completed" : "locked");
  card.classList.add(`trophy-card-sevenwonder-${state}`);
  card.dataset.earned = String(state === "completed");

  if (state === "locked") {
    card.innerHTML = `
      <div class="trophy-card-top">
        <span class="trophy-number">No.${def.number}</span>
        <div class="trophy-card-badges"><span class="trophy-category-badge">世界7不思議</span></div>
      </div>
      <div class="seven-wonder-card-seal" aria-hidden="true">🔒</div>
      <p class="trophy-name">？？？？？？</p>`;
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", "ロックされた謎");
    const openLockedModal = () => { if (typeof showSevenWonderLockedModal === "function") showSevenWonderLockedModal(); };
    card.addEventListener("click", openLockedModal);
    card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openLockedModal(); } });
    return;
  }

  const questionText = question ? question.questionText : (def.condition || "");
  const nameHtml = state === "locked" ? "？？？？？？" : def.name;
  const descHtml = state === "completed" && def.description ? `<p class="trophy-description">${def.description}</p>` : "";
  let actionHtml = "";
  if (state === "available") {
    actionHtml = `<button type="button" class="btn-puzzle-challenge btn-sevenwonder-challenge" data-question-id="${def.puzzleQuestionId}">この謎に挑む</button>`;
  } else if (state === "cooldown") {
    const unlockAt = typeof TrophyModule.getSevenWonderUnlockAt === "function"
      ? TrophyModule.getSevenWonderUnlockAt(def.puzzleQuestionId)
      : null;
    const remainingText = unlockAt ? formatSevenWonderRemaining(unlockAt - Date.now()) : "";
    const atText = unlockAt ? formatSevenWonderDateTime(unlockAt) : "";
    actionHtml = `
      <p class="seven-wonder-cooldown-text">この謎は7日間、再挑戦できない。<br>
      あと${remainingText}で再挑戦できる(${atText}〜)</p>`;
  }

  card.innerHTML = `
    <div class="trophy-card-top">
      <span class="trophy-number">No.${def.number}</span>
      <div class="trophy-card-badges"><span class="trophy-category-badge">世界7不思議</span></div>
    </div>
    <div class="trophy-marks">
      <div class="trophy-mark-col">
        ${buildTrophyMarkHtml("🗝️", "🗝️", state === "completed", st.earnedAt ? formatJapaneseDate(new Date(st.earnedAt)) : "", "獲得マーク", false)}
      </div>
    </div>
    <p class="trophy-name">${nameHtml}</p>
    <p class="trophy-cond trophy-puzzle-question">${questionText}</p>
    ${descHtml}
    ${actionHtml}`;

  if (state === "available") {
    card.querySelector(".btn-sevenwonder-challenge").addEventListener("click", (e) => {
      e.stopPropagation();
      PuzzleModule.open({ questionId: def.puzzleQuestionId, questionText });
      showScreen("screen-puzzle-flag-select");
    });
  }
}

function buildSevenWonderSpecialCard(card, def, st) {
  const secretLocked = !st.earned; // ミステリーハンター・全知全能の神は、獲得前は常に伏せる
  card.dataset.earned = String(st.earned);
  card.classList.add("trophy-card-sevenwonder-special");
  if (secretLocked) card.classList.add("trophy-card-secret");
  const nameHtml = secretLocked ? "？？？？？？" : def.name;
  const condHtml = secretLocked ? "" : `<p class="trophy-cond">${def.condition}</p>`;
  const descHtml = !secretLocked && def.description ? `<p class="trophy-description">${def.description}</p>` : "";
  const dateStr = st.earnedAt ? formatJapaneseDate(new Date(st.earnedAt)) : "";
  // 【トロフィーカテゴリー修正】カード上部のカテゴリーバッジは、従来の
  // 固定文字列「世界7不思議」ではなく、def.category(表示用タブ分類)に
  // 対応する実際のラベルを表示する。これにより、#393「ミステリーハンター」
  // (category: "puzzle")は「謎解きトロフィー」、#394「全知全能の神」
  // (category: "sevenWonders")は従来どおり「世界7不思議」と表示され、
  // バッジの見た目と一覧タブでの絞り込み結果が常に一致する
  const categoryBadgeLabel = TROPHY_CATEGORY_LABELS[def.category] || "世界7不思議";
  card.innerHTML = `
    <div class="trophy-card-top">
      <span class="trophy-number">No.${def.number}</span>
      <div class="trophy-card-badges"><span class="trophy-category-badge">${categoryBadgeLabel}</span></div>
    </div>
    <div class="trophy-marks">
      <div class="trophy-mark-col">
        ${buildTrophyMarkHtml("👑", "🔒", st.earned, dateStr, secretLocked ? "未発見のトロフィー" : "獲得マーク", secretLocked)}
      </div>
    </div>
    <p class="trophy-name">${nameHtml}</p>
    ${condHtml}
    ${descHtml}`;
}

function buildSevenWonderCardElement(def, earnedEntry) {
  const st = trophyEarnedState(def, earnedEntry);
  const card = document.createElement("div");
  card.className = "trophy-card trophy-card-sevenwonder" + (st.earned ? "" : " locked");
  card.dataset.category = def.category;
  card.dataset.hidden = "false";
  card.dataset.trophyId = def.id;
  card.dataset.trophyMode = def.mode || "";
  if (def.puzzleQuestionId) {
    buildSevenWonderPuzzleCard(card, def, st);
  } else {
    buildSevenWonderSpecialCard(card, def, st);
  }
  return card;
}

// 隠しトロフィー(def.hidden)の未獲得時は、正式名称・獲得条件を一切DOMに
// 出さない(HTML属性・ツールチップ等からも条件が漏れないようにする)。
// 獲得後は通常のトロフィーと全く同じ表示に戻る。番号・カテゴリは隠しでも表示する
function buildTrophyCardElement(def, earnedEntry) {
  const st = trophyEarnedState(def, earnedEntry);
  const card = document.createElement("div");
  const earnedOverall = st.dual ? (st.flagEarned || st.capitalEarned) : st.earned;
  const secretLocked = !!def.hidden && !earnedOverall; // 隠しトロフィーでまだ誰も(国旗/首都どちらも)獲得していない状態
  const isLegend = isLegendTrophyNumber(def.number); // #142「都の神話」・#158「世界の叡智」のみ最高級デザインを追加で重ねる
  card.className = "trophy-card" + (earnedOverall ? "" : " locked") + (secretLocked ? " trophy-card-secret" : "") + (isLegend && earnedOverall ? " trophy-card-legend" : "");
  card.dataset.category = def.category;
  card.dataset.earned = String(earnedOverall);
  card.dataset.hidden = String(!!def.hidden);
  card.dataset.trophyId = def.id;
  card.dataset.trophyMode = def.mode || "";

  let marksHtml;
  if (isLegend) {
    // #142・#158は既存の隠しトロフィー表示(secretLocked時は🔒・「未発見」)を
    // そのまま再利用しつつ、獲得後のアイコンだけ専用SVG(王冠+地球儀、
    // または黄金の書物+世界地図)に置き換える
    const dateStr = st.earnedAt ? formatJapaneseDate(new Date(st.earnedAt)) : "";
    const icon = st.earned ? legendIconSvgForNumber(def.number) : "🔒";
    marksHtml = `
      <div class="trophy-marks">
        <div class="trophy-mark-col">
          <div class="trophy-mark ${st.earned ? "earned trophy-mark-legend" : "locked"}" title="${secretLocked ? "未発見のトロフィー" : "獲得マーク"}">
            <span class="trophy-mark-icon">${icon}</span>
          </div>
          <p class="trophy-mark-date">${st.earned ? `${dateStr} 取得` : "未発見"}</p>
        </div>
      </div>`;
  } else if (st.dual) {
    // secretLocked(隠しトロフィー未発見)の間は、将来TROPHY_ICON_IMAGE_URLSに
    // 画像が登録されてもnumberを渡さず、既存どおり🔒のまま表示を変えない
    const imgNumber = secretLocked ? undefined : def.number;
    marksHtml = `
      <div class="trophy-marks trophy-marks-dual">
        <div class="trophy-mark-col">
          ${buildTrophyMarkHtml("🌍", "🌍", st.flagEarned, st.flagEarnedAt ? formatJapaneseDate(new Date(st.flagEarnedAt)) : "", "国旗クイズ", secretLocked, imgNumber)}
        </div>
        <div class="trophy-mark-col">
          ${buildTrophyMarkHtml("🏙️", "🏙️", st.capitalEarned, st.capitalEarnedAt ? formatJapaneseDate(new Date(st.capitalEarnedAt)) : "", "首都クイズ", secretLocked, imgNumber)}
        </div>
      </div>`;
  } else {
    const icon = def.category === "common" ? commonTrophyIcon(def.number) : trophyModeIcon(def.mode);
    const imgNumber = secretLocked ? undefined : def.number;
    marksHtml = `
      <div class="trophy-marks">
        <div class="trophy-mark-col">
          ${buildTrophyMarkHtml(icon, icon, st.earned, st.earnedAt ? formatJapaneseDate(new Date(st.earnedAt)) : "", secretLocked ? "未発見のトロフィー" : "獲得マーク", secretLocked, imgNumber)}
        </div>
      </div>`;
  }

  const categoryDef = TROPHY_CATEGORY_LABELS[def.category] || "";
  // 「世界の国どこかな？」専用トロフィー36種類(#159〜194)用のレア度バッジ。
  // 既存の#1〜158はdef.rarityが無いため何も表示しない(既存カードの見た目は
  // 一切変更しない)。36種は全て非隠し(hidden:false)のため、secretLockedで
  // 隠す必要がない
  const rarityLabel = trophyRarityLabel(def.rarity);
  const rarityBadgeHtml = rarityLabel
    ? `<span class="trophy-rarity-badge trophy-rarity-${def.rarity}">${rarityLabel}</span>`
    : "";
  const nameHtml = secretLocked ? "？？？？？？" : def.name;
  const condHtml = secretLocked ? "" : `<p class="trophy-cond">${def.condition}</p>`;
  // 首都トリビア(#113〜141)・#142「都の神話」の正式解説文は、獲得済みの
  // 場合のみ読めるようにする(未獲得時は既存の公開ルール通り、名称・条件
  // のみ表示して解説文は出さない)
  const pairLabel = earnedOverall && !secretLocked ? trophyCountryPairLabel(def.countries) : null;
  const descHtml = earnedOverall && !secretLocked && def.description
    ? `
      ${pairLabel ? `<p class="trophy-pair">${pairLabel}</p>` : ""}
      <p class="trophy-description${isLegend ? " trophy-description-legend" : ""}">${def.description}</p>`
    : "";
  // 共通トロフィー31種類(#395〜425)は未獲得でも名称・条件を表示する公開仕様
  // のため、達成状況の数値進捗もここで未獲得時のみ追加表示する(獲得済みは
  // 他のトロフィーと同じ「獲得マーク+日付」のみで十分なため省略する)
  const progressHtml = !earnedOverall && def.category === "common" ? buildCommonTrophyProgressHtml(def.number) : "";
  card.innerHTML = `
    <div class="trophy-card-top">
      <span class="trophy-number">No.${def.number}</span>
      <div class="trophy-card-badges">
        <span class="trophy-category-badge">${categoryDef}</span>
        ${rarityBadgeHtml}
      </div>
    </div>
    ${marksHtml}
    <p class="trophy-name">${nameHtml}</p>
    ${condHtml}
    ${progressHtml}
    ${descHtml}`;
  return card;
}

// 共通トロフィー31種類用の進捗表示HTML。TrophyModule.getCommonTrophyProgress()
// が返す形(単一current/total、または複数条件のparts配列、percent付き)の
// いずれにも対応する。対象外・取得失敗時は何も表示しない(推測で埋めない)
function buildCommonTrophyProgressHtml(number) {
  let p = null;
  try { p = TrophyModule.getCommonTrophyProgress(number); } catch (e) { p = null; }
  if (!p) return "";
  const rows = [];
  if (Array.isArray(p.parts)) {
    p.parts.forEach((part) => {
      if (typeof part.current === "number" && typeof part.total === "number") {
        rows.push(`<p class="trophy-common-progress-row">${part.label}: ${part.current}/${part.total}</p>`);
      } else {
        rows.push(`<p class="trophy-common-progress-row">${part.label}: ${part.done ? "達成" : "未達成"}</p>`);
      }
    });
  } else if (typeof p.current === "number" && typeof p.total === "number") {
    const unit = p.unit || "";
    const text = typeof p.percent === "number"
      ? `現在${p.percent.toFixed(1)}%(${p.current}/${p.total}${unit})`
      : `${p.current}/${p.total}${unit}`;
    rows.push(`<p class="trophy-common-progress-row">${text}</p>`);
  }
  if (rows.length === 0) return "";
  return `<div class="trophy-common-progress">${rows.join("")}</div>`;
}

let TROPHY_CATEGORY_LABELS = {};

// 上位8分類(表示専用)。プレイヤーが home 画面で認識するモード単位に
// まとめ直した分類で、TrophyModule側のcategory(15分類、判定・絞り込みに
// 実際に使われるid)は一切変更しない。既存の15分類は「下位カテゴリー」
// として、この8分類の中からさらに絞り込める(renderTrophySubCategoryRow)
const TOP_BUCKETS = [
  { id: "all", label: "すべて", icon: "🏆" },
  { id: "flag", label: "国旗", icon: "🌍" },
  { id: "capital", label: "首都", icon: "🏙️" },
  { id: "findcountry", label: "どこかな？", icon: "🧭" },
  { id: "encyclopedia", label: "世界図鑑", icon: "📖" },
  { id: "puzzle", label: "謎解き", icon: "🧩" },
  { id: "sevenWonders", label: "世界7不思議", icon: "🏔️" },
  { id: "common", label: "共通", icon: "👑" },
];
// 「共通」上位分類だけ、下位カテゴリーを既存の15分類からではなく、
// 以下の2つの合成グループで表示する("cross_mode_common"は既存の
// category idには存在しない、このバケット内だけで使う表示専用の値)
const COMMON_BUCKET_SUBGROUPS = [
  { id: "cross_mode_common", label: "国旗・首都共通" },
  { id: "common", label: "全体共通" },
];

// カテゴリー別進捗カード用の表示アイコン(純粋に見た目だけの対応表。
// 判定・分類そのものはTrophyModule.getCategories()のidを一切変更せず
// そのまま使うため、新しいカテゴリーが増えても未対応のidは🏅で表示される
// だけで、絞り込み自体は壊れない)
const TROPHY_CATEGORY_ICONS = {
  progress: "🚩", speed: "⚡", region: "🗺️", double: "🌐", special: "⭐",
  trivia: "🌍", legacy: "🎖️", capital_trivia: "🏛️", encyclopedia: "📖",
  findcountry: "🧭", findcountry_hidden: "🕵️", puzzle: "🧩",
  sevenWonders: "🏔️", common: "👑",
};

function renderTrophyFilterControls() {
  const categories = TrophyModule.getCategories();
  TROPHY_CATEGORY_LABELS = {};
  categories.forEach((c) => { TROPHY_CATEGORY_LABELS[c.id] = c.label; });

  document.querySelectorAll("#trophy-status-filter .trophy-status-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.trophyListFilter.status = btn.dataset.status;
      applyTrophyFilters();
    });
  });
}

// 表示専用の上位分類判定(mode/categoryから8分類のどれに属するかを決める
// だけの純粋関数。TrophyModule側のcategory・mode定義そのものは一切
// 変更しない)。国旗・首都どちらのプレイでも共通に達成できるトロフィー
// (スピードチャレンジ・国旗/首都制覇・特別チャレンジの一部、34件)は、
// データ上どちらか一方に決め打ちできないため「共通」に含める
function classifyTopBucket(mode, category) {
  if (category === "findcountry" || category === "findcountry_hidden") return "findcountry";
  if (category === "puzzle") return "puzzle";
  if (category === "sevenWonders") return "sevenWonders";
  if (mode === "flag" || mode === "flag_only") return "flag";
  if (mode === "capital" || mode === "capital_only" || mode === "legend") return "capital";
  if (mode === "encyclopedia") return "encyclopedia";
  return "common"; // commonTrophy(#395〜425)・common(モード横断34件)・想定外の値はすべて「共通」に含める
}

// 描画済みカード1枚がどの上位分類に属するかを、カードのdataset
// (category・trophyMode・splitMode、いずれも表示専用の追加属性)から
// 判定する。国旗/首都分割カードは、どちらの半分かをすでに持っている
// splitModeで直接判定する(mode="both"を再解釈する必要がない)
function cardTopBucket(card) {
  const splitMode = card.dataset.splitMode;
  if (splitMode === "国旗クイズ") return "flag";
  if (splitMode === "首都クイズ") return "capital";
  return classifyTopBucket(card.dataset.trophyMode, card.dataset.category);
}

// 上位8分類・下位カテゴリーそれぞれの獲得数/総数を、TrophyModuleの
// 既存公開API(getAllDefinitions/getEarned/isDualSplitCardNumber)だけから
// 1回の走査で算出する。国旗/首都分割カードは2枠として数える(集計方式A案と
// 同じ考え方)ため、二重計上や全体452件とのずれは生じない
function computeBucketProgress() {
  const defs = TrophyModule.getAllDefinitions();
  const earned = TrophyModule.getEarned();
  const buckets = {};
  const subcats = {}; // bucketId -> { subId -> {earnedCount,totalCount} }
  function bump(bucketId, subId, isEarned) {
    if (!buckets[bucketId]) buckets[bucketId] = { earnedCount: 0, totalCount: 0 };
    buckets[bucketId].totalCount += 1;
    if (isEarned) buckets[bucketId].earnedCount += 1;
    if (!subcats[bucketId]) subcats[bucketId] = {};
    if (!subcats[bucketId][subId]) subcats[bucketId][subId] = { earnedCount: 0, totalCount: 0 };
    subcats[bucketId][subId].totalCount += 1;
    if (isEarned) subcats[bucketId][subId].earnedCount += 1;
  }
  defs.forEach((def) => {
    if (TrophyModule.isDualSplitCardNumber(def.number)) {
      const entry = earned[def.id];
      bump("flag", def.category, !!(entry && entry.flag));
      bump("capital", def.category, !!(entry && entry.capital));
      return;
    }
    const bucketId = classifyTopBucket(def.mode, def.category);
    const subId = (bucketId === "common" && def.category !== "common") ? "cross_mode_common" : def.category;
    bump(bucketId, subId, !!earned[def.id]);
  });
  return { buckets, subcats };
}

// 「次の目標」用: 共通トロフィー31種類(#395〜425、常に非隠しで名称・条件を
// 公開している)のうち、TrophyModule.getCommonTrophyProgress()が返す数値
// 進捗(current/total)を持つ未獲得のものから、最も達成率が高い1件を選ぶ。
// 対象が無ければnullを返し、呼び出し側(renderTrophyHero)は「次の目標」
// 欄自体を表示しない(実績が無い場合に推測で埋めることはしない)
function computeNextGoal() {
  if (typeof TrophyModule.getCommonTrophyProgress !== "function") return null;
  const defs = TrophyModule.getAllDefinitions().filter((d) => d.category === "common");
  let best = null;
  defs.forEach((def) => {
    if (TrophyModule.isEarned(def.id)) return;
    let p = null;
    try { p = TrophyModule.getCommonTrophyProgress(def.number); } catch (e) { p = null; }
    if (!p || typeof p.current !== "number" || typeof p.total !== "number" || p.total <= 0) return;
    const remaining = p.total - p.current;
    if (remaining <= 0) return;
    const ratio = p.current / p.total;
    if (!best || ratio > best.ratio) best = { def, remaining, unit: p.unit || "", ratio };
  });
  return best;
}

function renderTrophyHero() {
  const summary = TrophyModule.getProgressSummary();
  const percent = summary.totalCount > 0 ? (summary.earnedCount / summary.totalCount) * 100 : 0;
  $("trophy-hero-earned").textContent = String(summary.earnedCount);
  $("trophy-hero-total").textContent = String(summary.totalCount);
  $("trophy-hero-percent").textContent = `${percent.toFixed(1)}%`;
  $("trophy-hero-bar-fill").style.width = `${Math.min(100, percent)}%`;

  // 円形プログレス: r=52のSVG円(index.html)に合わせた円周を基準に、
  // 達成率に応じてstroke-dashoffsetを動かすだけの純粋な表示計算
  const ringCircumference = 2 * Math.PI * 52;
  const ringFill = $("trophy-ring-fill");
  ringFill.style.strokeDasharray = `${ringCircumference}`;
  ringFill.style.strokeDashoffset = `${ringCircumference * (1 - Math.min(1, percent / 100))}`;

  const nextGoal = computeNextGoal();
  const nextWrap = $("trophy-hero-next");
  if (nextGoal) {
    nextWrap.classList.remove("hidden");
    $("trophy-hero-next-name").textContent = nextGoal.def.name;
    $("trophy-hero-next-sub").textContent = `あと${nextGoal.remaining}${nextGoal.unit}で獲得`;
    nextWrap.dataset.trophyId = nextGoal.def.id;
  } else {
    nextWrap.classList.add("hidden");
    delete nextWrap.dataset.trophyId;
  }
}

function updateBucketChipActiveState() {
  document.querySelectorAll("#trophy-bucket-grid .trophy-category-chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.bucket === state.trophyListFilter.topBucket);
  });
  document.querySelectorAll("#trophy-subcategory-row .trophy-subcategory-chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.category === state.trophyListFilter.category);
  });
}

function buildBucketOrCategoryChip(className, datasetKey, id, label, icon, earnedCount, totalCount, onClick) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = className;
  chip.dataset[datasetKey] = id;
  const percent = totalCount > 0 ? Math.min(100, Math.round((earnedCount / totalCount) * 100)) : 0;
  const iconHtml = icon ? `<span class="trophy-category-chip-icon" aria-hidden="true">${icon}</span>` : "";
  chip.innerHTML = `
    ${iconHtml}
    <span class="trophy-category-chip-label">${label}</span>
    <span class="trophy-category-chip-count">${earnedCount} / ${totalCount}</span>
    <span class="trophy-category-chip-bar-track"><span class="trophy-category-chip-bar-fill" style="width:${percent}%"></span></span>`;
  chip.addEventListener("click", onClick);
  return chip;
}

// 上位8分類(国旗/首都/どこかな？/世界図鑑/謎解き/世界7不思議/共通+すべて)の
// チップを描画する。分類をクリックすると、下位カテゴリーの絞り込み
// (state.trophyListFilter.category)は「すべて」にリセットしたうえで、
// renderTrophySubCategoryRow()でその分類専用の下位カテゴリー行を表示する
function renderTrophyBucketGrid() {
  const { buckets } = computeBucketProgress();
  const grid = $("trophy-bucket-grid");
  grid.innerHTML = "";

  const overall = TrophyModule.getProgressSummary();
  TOP_BUCKETS.forEach((b) => {
    const p = b.id === "all" ? overall : (buckets[b.id] || { earnedCount: 0, totalCount: 0 });
    const chip = buildBucketOrCategoryChip("trophy-category-chip", "bucket", b.id, b.label, b.icon, p.earnedCount, p.totalCount, () => {
      state.trophyListFilter.topBucket = b.id;
      state.trophyListFilter.category = "all";
      renderTrophySubCategoryRow();
      applyTrophyFilters();
    });
    grid.appendChild(chip);
  });

  updateBucketChipActiveState();
}

// 下位カテゴリー行(上位分類を選んだときだけ表示)。「共通」分類だけは
// 既存の15分類ではなく、国旗・首都共通34件/全体共通31件の2グループで
// 表示する(ユーザー指定の表示専用の分け方。内部categoryは変更しない)
function renderTrophySubCategoryRow() {
  const row = $("trophy-subcategory-row");
  const bucketId = state.trophyListFilter.topBucket;
  if (bucketId === "all") {
    row.classList.add("hidden");
    row.innerHTML = "";
    return;
  }
  const { subcats } = computeBucketProgress();
  const bucketSubcats = subcats[bucketId] || {};
  row.innerHTML = "";

  const bucketMeta = TOP_BUCKETS.find((b) => b.id === bucketId);
  const bucketTotal = Object.values(bucketSubcats).reduce(
    (acc, p) => ({ earnedCount: acc.earnedCount + p.earnedCount, totalCount: acc.totalCount + p.totalCount }),
    { earnedCount: 0, totalCount: 0 }
  );
  row.appendChild(buildBucketOrCategoryChip("trophy-subcategory-chip", "category", "all", `すべて(${bucketMeta ? bucketMeta.label : ""})`, "", bucketTotal.earnedCount, bucketTotal.totalCount, () => {
    state.trophyListFilter.category = "all";
    applyTrophyFilters();
  }));

  const subDefs = bucketId === "common"
    ? COMMON_BUCKET_SUBGROUPS
    : Object.keys(bucketSubcats).map((id) => ({ id, label: TROPHY_CATEGORY_LABELS[id] || id }));
  subDefs.forEach((s) => {
    const p = bucketSubcats[s.id] || { earnedCount: 0, totalCount: 0 };
    if (p.totalCount === 0) return;
    row.appendChild(buildBucketOrCategoryChip("trophy-subcategory-chip", "category", s.id, s.label, "", p.earnedCount, p.totalCount, () => {
      state.trophyListFilter.category = s.id;
      applyTrophyFilters();
    }));
  });

  row.classList.remove("hidden");
  updateBucketChipActiveState();
}

function renderTrophyGrid() {
  const grid = $("trophy-grid");
  grid.innerHTML = "";
  // 隠しトロフィー61種類(#195〜255)は、既存の隠しトロフィー(def.hidden)と
  // 同じ表示仕様(buildTrophyCardElement内のsecretLocked処理)で一覧に表示する。
  // 未獲得時は正式名称・条件を伏せ、獲得後は通常のトロフィーと同じ表示になる
  const defs = TrophyModule.getAllDefinitions();
  const earned = TrophyModule.getEarned();
  defs.forEach((def) => {
    // 世界7不思議 隠し特別2種(ミステリーハンター・全知全能の神、
    // def.stage === "sevenWondersSpecial")は、他のどの分岐よりも先に
    // 専用カード(buildSevenWonderCardElement→buildSevenWonderSpecialCard、
    // 未発見時は？？？？？？で完全に伏せる既存仕様)で描画する。
    // 【トロフィーカテゴリー修正】#393は一覧の表示用タブ分類(def.category)
    // こそ「謎解きトロフィー」に変わったが、カードの見た目・未発見時の
    // 伏せ方・獲得演出は従来の世界7不思議専用デザインのまま変更しない
    // ため、この判定はdef.categoryではなくdef.stage(カテゴリー変更の
    // 影響を受けない内部分類)を見て行う
    if (def.stage === "sevenWondersSpecial") {
      grid.appendChild(buildSevenWonderCardElement(def, earned[def.id]));
      return;
    }
    // 謎解きトロフィー(#256〜、第3段階)は、隠しトロフィーのsecretLocked
    // 処理とは異なる専用の表示(未獲得でも問題文を見せる)が必要なため、
    // 他のどの分岐よりも先にbuildPuzzleTrophyCardElement()へ回す
    if (def.category === "puzzle") {
      grid.appendChild(buildPuzzleTrophyCardElement(def, earned[def.id]));
      return;
    }
    // 世界7不思議7問(#386〜392)+#394は、通常の謎解き・隠しトロフィーの
    // どちらとも異なる専用カードで描画する
    if (def.category === "sevenWonders") {
      grid.appendChild(buildSevenWonderCardElement(def, earned[def.id]));
      return;
    }
    // 集計方式A案: No.1〜19のみ、国旗クイズ・首都クイズの2枚の独立カードに
    // 分割する。No.20以降(他のmode==="both"のデュアルトロフィーを含む)は
    // 既存どおり1枚のカードに2つの達成マークを並べる表示のまま変更しない
    if (TrophyModule.isDualSplitCardNumber(def.number)) {
      grid.appendChild(buildDualSplitCardPair(def, earned[def.id]));
    } else {
      grid.appendChild(buildTrophyCardElement(def, earned[def.id]));
    }
  });
}

// 検索: TrophyModule側のdef.name/def.conditionを直接見るのではなく、
// 実際に画面へ描画された文字(.trophy-name/.trophy-number)だけを対象に
// する。隠しトロフィー・未正解の謎解きカードは「？？？？？？」のまま
// 描画されているため、本物の名称で検索しても一致せず、番号や既に公開
// されている文字列でしか見つからない(検索機能を経由した情報漏れを防ぐ)
function cardMatchesSearch(card, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const nameEl = card.querySelector(".trophy-name");
  const numberEl = card.querySelector(".trophy-number");
  const haystack = `${nameEl ? nameEl.textContent : ""} ${numberEl ? numberEl.textContent : ""}`.toLowerCase();
  return haystack.includes(q);
}

function applyTrophyFilters() {
  const filter = state.trophyListFilter;
  const cards = document.querySelectorAll("#trophy-grid .trophy-card");
  let visibleCount = 0;
  cards.forEach((card) => {
    const matchBucket = filter.topBucket === "all" || cardTopBucket(card) === filter.topBucket;
    const matchCategory = filter.category === "all"
      || (filter.category === "cross_mode_common"
        ? (cardTopBucket(card) === "common" && card.dataset.category !== "common")
        : card.dataset.category === filter.category);
    const earnedOverall = card.dataset.earned === "true";
    const isHiddenTrophy = card.dataset.hidden === "true";
    const matchStatus = filter.status === "all"
      || (filter.status === "earned" && earnedOverall)
      || (filter.status === "locked" && !earnedOverall)
      || (filter.status === "hidden" && isHiddenTrophy);
    const matchSearch = cardMatchesSearch(card, filter.search || "");
    const visible = matchBucket && matchCategory && matchStatus && matchSearch;
    card.classList.toggle("hidden", !visible);
    if (visible) visibleCount++;
  });

  // 国旗・首都の分割カード: 2枚とも絞り込みで非表示になったペアだけ、
  // 外側の.trophy-dual-pairラッパーも非表示にして不自然な空白を
  // グリッドに残さない。片方だけ表示される場合はラッパー自体は
  // 表示したままにし、CSS側で残った1枚の幅を2枚表示時と同じ固定幅に
  // 保つ(flex-grow: 0)ため、幅いっぱいへは広がらず右半分は空白のまま
  document.querySelectorAll("#trophy-grid .trophy-dual-pair").forEach((pair) => {
    const anyVisible = !!pair.querySelector(".trophy-card:not(.hidden)");
    pair.classList.toggle("hidden", !anyVisible);
  });

  $("trophy-result-count").textContent = `${visibleCount}件を表示中`;
  $("trophy-empty-message").classList.toggle("hidden", visibleCount > 0);

  updateBucketChipActiveState();
  document.querySelectorAll("#trophy-status-filter .trophy-status-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.status === filter.status);
  });
}

// グリッド/一覧表示の切り替え。カードのDOM構造・判定・絞り込みは一切
// 変えず、#trophy-gridにCSSクラスを1つ付け外しするだけ(見た目はCSS側で
// 切り替える)
function setTrophyView(view) {
  const resolved = view === "list" ? "list" : "grid";
  state.trophyListFilter.view = resolved;
  $("trophy-grid").classList.toggle("trophy-grid-list", resolved === "list");
  document.querySelectorAll(".trophy-view-btn").forEach((btn) => {
    const active = btn.dataset.view === resolved;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
}

// ==========================================================
// トロフィー詳細モーダル(新規)。
// 各カード生成関数(標準/分割/謎解き)が既に正しく計算した「今表示して
// よい情報」をそのままDOM複製して大きく見せるだけで、新たに情報を
// 復元・推測することは一切しない。
// 世界7不思議(.trophy-card-sevenwonder、隠し特別2種を含む)は、
// ロック中タップの案内モーダル・7日間クールダウン表示・挑戦フローという
// 既存の専用インタラクションをそのまま使うため、このモーダルの対象外と
// する(それらの画面・演出には一切手を加えない)
// ==========================================================
function isTrophyDetailEligible(card) {
  return !!card && card.classList.contains("trophy-card") && !card.classList.contains("trophy-card-sevenwonder");
}

function closeTrophyDetailModal() {
  $("trophy-detail-modal").classList.add("hidden");
  $("trophy-detail-body").innerHTML = "";
}

function openTrophyDetailModal(card) {
  if (!isTrophyDetailEligible(card)) return;
  const body = $("trophy-detail-body");
  body.innerHTML = "";

  const earnedOverall = card.dataset.earned === "true";
  const isHiddenTrophy = card.dataset.hidden === "true";
  const statusBadge = document.createElement("div");
  statusBadge.className = `trophy-detail-status ${earnedOverall ? "earned" : "locked"}`;
  statusBadge.textContent = earnedOverall ? "✓ 獲得済み" : (isHiddenTrophy ? "未発見のトロフィー" : "未獲得");
  body.appendChild(statusBadge);

  const categoryLabel = TROPHY_CATEGORY_LABELS[card.dataset.category] || "";
  if (categoryLabel) {
    const categoryEl = document.createElement("p");
    categoryEl.className = "trophy-detail-category";
    categoryEl.textContent = categoryLabel;
    body.appendChild(categoryEl);
  }

  // cloneNode()はイベントリスナーを複製しないため、謎解きトロフィーの
  // 「この謎に挑む」ボタンだけ、既存ハンドラ(PuzzleModule.open→
  // screen-puzzle-flag-select)と同じ処理を付け直す。モーダルは別画面へ
  // 遷移する前に必ず閉じる(開いたまま裏に残らないようにする)
  const clone = card.cloneNode(true);
  clone.classList.add("trophy-detail-content");
  const challengeBtn = clone.querySelector(".btn-puzzle-challenge");
  if (challengeBtn) {
    const questionId = challengeBtn.dataset.questionId;
    const questionTextEl = clone.querySelector(".trophy-puzzle-question");
    const questionText = questionTextEl ? questionTextEl.textContent : "";
    challengeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeTrophyDetailModal();
      PuzzleModule.open({ questionId, questionText });
      showScreen("screen-puzzle-flag-select");
    });
  }
  body.appendChild(clone);

  $("trophy-detail-modal").classList.remove("hidden");
}

function initTrophyDetailModal() {
  $("trophy-detail-close").addEventListener("click", closeTrophyDetailModal);
  $("trophy-detail-modal").addEventListener("click", (e) => {
    if (e.target.id === "trophy-detail-modal") closeTrophyDetailModal(); // 背景タップでも閉じる
  });
  $("trophy-grid").addEventListener("click", (e) => {
    const card = e.target.closest(".trophy-card");
    if (card) openTrophyDetailModal(card);
  });
}

function renderTrophyListScreen() {
  renderTrophyHero();
  renderTrophyBucketGrid();
  renderTrophySubCategoryRow();
  renderTrophyGrid();
  $("trophy-search-input").value = state.trophyListFilter.search || "";
  setTrophyView(state.trophyListFilter.view || "grid");
  applyTrophyFilters();
}

function initTrophyListScreen() {
  renderTrophyFilterControls();
  initTrophyDetailModal();

  document.querySelectorAll(".trophy-view-btn").forEach((btn) => {
    btn.addEventListener("click", () => setTrophyView(btn.dataset.view));
  });

  $("trophy-search-input").addEventListener("input", (e) => {
    state.trophyListFilter.search = e.target.value;
    applyTrophyFilters();
  });

  // ヒーローカードの「目標の詳細」: 絞り込みを一旦リセットしてから
  // (非表示状態のカードを開けないようにするため)該当カードの詳細を開く
  $("trophy-hero-next-btn").addEventListener("click", () => {
    const trophyId = $("trophy-hero-next").dataset.trophyId;
    if (!trophyId) return;
    state.trophyListFilter.topBucket = "all";
    state.trophyListFilter.category = "all";
    state.trophyListFilter.status = "all";
    state.trophyListFilter.search = "";
    renderTrophyListScreen();
    requestAnimationFrame(() => {
      const card = document.querySelector(`#trophy-grid [data-trophy-id="${trophyId}"]`);
      if (card) openTrophyDetailModal(card);
    });
  });
}

// ==========================================================
// メダル・賞状作成画面
// ==========================================================
function openMemorialScreen() {
  const nameInput = $("memorial-name");
  nameInput.value = state.memorialName;
  updateMemorialPreview();
  $("ios-save-hint").classList.add("hidden");
  $("image-preview-modal").classList.add("hidden");
  showScreen("screen-memorial");
}

function currentMemorialData() {
  const { titleObj, total, mode } = state.lastResult || {};
  const name = $("memorial-name").value.trim();
  state.memorialName = name;
  const dateObj = new Date();
  const resolvedMode = mode || state.mode || "flag";
  return {
    titleObj: titleObj || getTitlesForMode(resolvedMode)[0],
    total: total || state.selectedCount,
    name,
    dateObj,
    mode: resolvedMode,
  };
}

function updateMemorialPreview() {
  const { titleObj, total, name, dateObj, mode } = currentMemorialData();
  const dateStr = formatJapaneseDate(dateObj);
  const brand = mode === "capital" ? "WORLD CAPITAL QUIZ" : "WORLD FLAG QUIZ";

  $("mc-brand").textContent = brand;
  $("mc-medal").className = `medal medal-lg ${titleObj.medalClass}`;
  $("mc-title").textContent = titleObj.name;
  $("mc-name").textContent = `${name || "挑戦者"} さん`;
  $("mc-count").innerHTML = `${total}問 <span class="mc-perfect">PERFECT!</span>`;
  $("mc-date").textContent = dateStr.replace(/年|月/g, ".").replace("日", "");

  const isLegend = total === 198;
  $("cert-title").textContent = isLegend ? "特別認定証" : "認定証";
  const lines = buildCertificateBodyLines(titleObj, total, name, mode);
  $("cert-body").textContent = lines.join("\n");
  $("cert-date").textContent = dateStr;
  $("cert-brand").textContent = mode === "capital" ? "世界の首都クイズ" : "世界の国旗クイズ";
}

// メダル/認定証のCanvasとファイル名を作る(保存ボタンがどちらでも
// 名前入力は共通のcurrentMemorialData()を使うので入力し直す必要はない)
function buildMemorialCanvas(type) {
  const { titleObj, total, name, dateObj, mode } = currentMemorialData();
  const dateStr = formatJapaneseDate(dateObj);
  const brand = mode === "capital" ? "WORLD CAPITAL QUIZ" : "WORLD FLAG QUIZ";
  const appPrefix = mode === "capital" ? "world-capital-quiz" : "world-flag-quiz";
  if (type === "medal") {
    const canvas = renderMedalCanvas({
      titleName: titleObj.name,
      medalClass: titleObj.medalClass,
      name,
      questionCount: total,
      dateStr: dateStr.replace(/年|月/g, ".").replace("日", ""),
      brand,
    });
    // ファイル名は端末やブラウザによって日本語が正しく扱われない場合があるためASCIIにする
    return { canvas, filename: `${appPrefix}_medal_${titleObj.id}.png` };
  }
  const isLegend = total === 198;
  const canvas = renderCertificateCanvas({
    certTitle: isLegend ? "特別認定証" : "認定証",
    bodyLines: buildCertificateBodyLines(titleObj, total, name, mode),
    dateStr,
    appName: mode === "capital" ? "世界の首都クイズ" : "世界の国旗クイズ",
  });
  return { canvas, filename: `${appPrefix}_certificate_${titleObj.id}.png` };
}

// 保存ボタン共通処理。iOSでは新しいタブを開かず、アプリ内モーダルに
// 画像を表示する(window.open()がブロックされた場合にアプリ画面が
// 丸ごと画像に置き換わり、戻れなくなる不具合を避けるため)。
// これにより画面は閉じず、続けてもう片方の画像も保存できる。
function saveMemorialImage(type) {
  const { canvas, filename } = buildMemorialCanvas(type);
  const result = saveCanvasAsPNG(canvas, filename);
  if (result.status === "ios") {
    $("image-preview-img").src = result.dataUrl;
    $("image-preview-modal").classList.remove("hidden");
    $("ios-save-hint").classList.remove("hidden");
  }
}

function initMemorialScreen() {
  $("memorial-name").addEventListener("input", updateMemorialPreview);

  document.querySelectorAll(".type-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".type-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      state.memorialType = tab.dataset.type;
      $("memorial-medal-card").classList.toggle("hidden", state.memorialType !== "medal");
      $("memorial-cert-card").classList.toggle("hidden", state.memorialType !== "certificate");
    });
  });

  // メダル・認定証はそれぞれ専用ボタンで、プレビュータブの選択状態に関わらず保存できる
  $("btn-save-medal").addEventListener("click", () => saveMemorialImage("medal"));
  $("btn-save-certificate").addEventListener("click", () => saveMemorialImage("certificate"));

  $("image-preview-close").addEventListener("click", () => {
    $("image-preview-modal").classList.add("hidden");
  });

  // 記念画像作成画面がどのボタンからも行き止まりにならないようにする
  $("btn-memorial-retry").addEventListener("click", () => {
    $("image-preview-modal").classList.add("hidden");
    startQuiz(state.selectedCount);
  });
  $("btn-memorial-back-result").addEventListener("click", () => {
    $("image-preview-modal").classList.add("hidden");
    showScreen("screen-result");
  });
  $("btn-memorial-top").addEventListener("click", () => {
    $("image-preview-modal").classList.add("hidden");
    showScreen("screen-top");
  });
}

// ==========================================================
// データリセット: 2段階確認(第6段階確定仕様)
// 既存の#confirm-modal(クイズ終了・「世界の国どこかな？」終了)は一切
// 変更せず、完全に別の専用モーダル(#reset-confirm-modal)を使う。
// 「キャンセル/いいえ」ボタンを押すか、ダイアログの外側(暗い背景)を
// タップした場合は必ず安全側(未削除)に倒す。第2段階の「はい」を押すまでは
// いかなる保存データも削除しない
// ==========================================================
function showResetConfirmStep(text, subtext, yesLabel, noLabel) {
  return new Promise((resolve) => {
    const modal = $("reset-confirm-modal");
    $("reset-confirm-text").textContent = text;
    $("reset-confirm-subtext").textContent = subtext;
    const yesBtn = $("reset-confirm-yes");
    const noBtn = $("reset-confirm-cancel");
    yesBtn.textContent = yesLabel;
    noBtn.textContent = noLabel;
    modal.classList.remove("hidden");
    function cleanup(result) {
      modal.classList.add("hidden");
      yesBtn.removeEventListener("click", onYes);
      noBtn.removeEventListener("click", onNo);
      modal.removeEventListener("click", onOverlay);
      resolve(result);
    }
    function onYes() { cleanup(true); }
    function onNo() { cleanup(false); }
    // ダイアログの外側(.modal-box の外、暗い背景部分)をタップした場合も
    // 安全側(キャンセル扱い)に倒す
    function onOverlay(e) { if (e.target === modal) cleanup(false); }
    yesBtn.addEventListener("click", onYes);
    noBtn.addEventListener("click", onNo);
    modal.addEventListener("click", onOverlay);
  });
}

// resetConfirmBusyは、「データをリセット」ボタンの連打でこのフロー自体が
// 多重に起動し、削除処理が重複実行されることを防ぐためのガード
let resetConfirmBusy = false;
async function handleResetDataClick() {
  if (resetConfirmBusy) return;
  resetConfirmBusy = true;
  try {
    const step1 = await showResetConfirmStep(
      "保存データをすべて削除しますか？",
      "称号・トロフィー・記録・ランキング・コレクション・世界図鑑の探索記録(閲覧・地図連携・復習)が削除されます。この操作は取り消せません。",
      "すべて削除する",
      "キャンセル"
    );
    if (!step1) return; // キャンセル: 何も削除しない

    const step2 = await showResetConfirmStep(
      "本当にリセットしますか？",
      "削除したデータは元に戻せません。",
      "はい",
      "いいえ"
    );
    if (!step2) return; // いいえ: 何も削除しない

    // 第2段階の「はい」を押した場合だけ、ここで初めて全削除処理を実行する。
    // 既存のStorage.resetAll()をそのまま再利用し、削除対象を独自に増減
    // させない(「世界の国どこかな？」の12コースクリア記録・PRO解放状態も
    // Storage.resetAll()側に既に含めているため、ここでは何も追加しない)
    Storage.resetAll();
    alert("データをリセットしました");
  } finally {
    resetConfirmBusy = false;
  }
}

// ==========================================================
// 確認モーダル(共通)
// ==========================================================
function showConfirm(text) {
  return new Promise((resolve) => {
    $("confirm-modal-text").textContent = text;
    $("confirm-modal").classList.remove("hidden");
    const yesBtn = $("confirm-modal-yes");
    const noBtn = $("confirm-modal-no");
    function cleanup(result) {
      $("confirm-modal").classList.add("hidden");
      yesBtn.removeEventListener("click", onYes);
      noBtn.removeEventListener("click", onNo);
      resolve(result);
    }
    function onYes() { cleanup(true); }
    function onNo() { cleanup(false); }
    yesBtn.addEventListener("click", onYes);
    noBtn.addEventListener("click", onNo);
  });
}

// ==========================================================
// 世界図鑑 ⇔ 世界地図 連携(第2段階)
// 両モジュールは互いの内部状態を直接書き換えず、カスタムイベントと
// それぞれの公開API(MapModule.open()/EncyclopediaModule.openDetailById())
// だけを介してやり取りする。この関数だけがその橋渡しを行う。
//
// 画面遷移の管理(PR #39レビュー対応): 🌍/📖ボタンで地図⇔図鑑詳細を
// 行き来するたびに、現在表示している画面を「次に戻ってきたら再表示する
// もの」として1件だけpushし、戻るボタンが押されるたびに1件popして
// 再表示する小さなスタック(mapEncyclopediaNavStack)で管理する。
// 以前は「戻り先」を単一の変数(backLabel/onBack)に無条件上書きしていたため、
// 地図→図鑑→地図→図鑑…と行き来するうちに、2つの画面同士が互いを
// 指し合ったまま、それより前にいた画面(トップや元の詳細画面)へ
// 戻る手段を失うことがあった。スタック化することで、戻るボタンを
// 押した回数だけ、実際に辿ってきた経路を逆順に戻れるようになり、
// 必ずどこかでスタックが空になってトップ(または図鑑一覧)へ natural に
// 戻り着く。往復(push→pop)のたびに正味の増減は無いため、同じ操作を
// 何度繰り返しても履歴が際限なく増え続けることはない。万一を考慮し、
// 想定を超えて深くなった場合のためだけに上限も設けておく
let mapEncyclopediaNavStack = [];
const MAP_ENCYCLOPEDIA_NAV_MAX_DEPTH = 8;

function pushMapEncyclopediaNav(entry) {
  mapEncyclopediaNavStack.push(entry);
  // 通常の利用では到達しない安全策(極端に深くpushし続けた場合のみ、
  // 一番古いものから捨てて際限のない増加を防ぐ)
  if (mapEncyclopediaNavStack.length > MAP_ENCYCLOPEDIA_NAV_MAX_DEPTH) {
    mapEncyclopediaNavStack.shift();
  }
}

// 今まさに表示しようとしている地図画面の戻るボタンの表記・動作を、
// スタックの最上位(=この後ろにある画面)に応じて決める
function mapOpenOptionsFromStack(selectId) {
  const top = mapEncyclopediaNavStack[mapEncyclopediaNavStack.length - 1];
  if (top && top.screen === "encyclopedia-detail") {
    return {
      selectId,
      backLabel: "← 図鑑に戻る",
      onBack: () => {
        mapEncyclopediaNavStack.pop();
        const opts = encyclopediaBackOptionsFromStack();
        // listIds(詳細画面を開いた時点のdetailListIdsのスナップショット)が
        // あれば、それをそのまま使って再表示する。復習リストから開いた
        // 詳細画面は復習対象だけのlistIdsを持つため、通常の図鑑一覧の
        // 範囲(openDetailByIdが内部で再計算する範囲)とは混ざらない。
        // 通常の図鑑から開いた場合もlistIdsは常に渡るが、内容は
        // openDetailByIdの再計算結果と同じになるため挙動は変わらない
        if (top.listIds && top.listIds.length) {
          // 世界図鑑トロフィー(No.156・157「復習」)用: 復習画面から地図を
          // 経由してこの詳細画面に戻ってきた場合も、積んでおいたisReviewを
          // そのまま引き継いでreviewSessionとして渡す。これにより「復習→
          // 地図→元の国に戻る」は復習記録のまま、「復習→地図→別の国を開く」
          // (この分岐を通らずopenDetailByIdの方を通る)は復習扱いしない
          EncyclopediaModule.openDetailWithList(top.id, top.listIds, Object.assign({}, opts, { reviewSession: !!top.isReview }));
        } else {
          EncyclopediaModule.openDetailById(top.id, opts);
        }
      },
    };
  }
  return { selectId, backLabel: "← トップへ戻る", onBack: () => showScreen("screen-top") };
}

// 今まさに表示しようとしている図鑑詳細画面の戻るボタンの表記・動作を、
// スタックの最上位(=この後ろにある画面)に応じて決める
function encyclopediaBackOptionsFromStack() {
  const top = mapEncyclopediaNavStack[mapEncyclopediaNavStack.length - 1];
  if (top && top.screen === "map") {
    return {
      backLabel: "← 地図に戻る",
      onBack: () => {
        mapEncyclopediaNavStack.pop();
        showScreen("screen-map");
        MapModule.open(mapOpenOptionsFromStack());
      },
    };
  }
  // 第3段階A案: クイズ結果画面の復習リストから詳細画面を開いた場合、
  // 地図を経由して戻ってきても復習リストへ正しく戻れるようにする
  if (top && top.screen === "review-list") {
    return {
      backLabel: "← 復習リストに戻る",
      onBack: () => {
        mapEncyclopediaNavStack.pop();
        ReviewModule.showList();
      },
    };
  }
  // 第5段階後半: 「世界の国どこかな？」コレクションから獲得済みの国・地域を
  // 開いた場合、地図を経由して戻ってきてもコレクションへ正しく戻れるようにする
  if (top && top.screen === "findcountry-collection") {
    return {
      backLabel: "← コレクションに戻る",
      onBack: () => {
        mapEncyclopediaNavStack.pop();
        FindCountryModule.showCollectionScreen();
      },
    };
  }
  return { backLabel: "← 図鑑一覧に戻る", onBack: null };
}

function initMapEncyclopediaLink() {
  // 図鑑の詳細画面「🌍 地図で場所を見る」→ 地図でその国・地域を選択表示する
  document.addEventListener("encyclopediamodule:view-on-map", (e) => {
    const id = e.detail && e.detail.id;
    if (!id) return;
    // 今表示している図鑑詳細画面(id)と、その前へ/次へ移動範囲
    // (listIds。通常の図鑑一覧の範囲、または復習リストの範囲)を、
    // 地図から戻ってきたときの再表示対象としてスタックに積む
    pushMapEncyclopediaNav({
      screen: "encyclopedia-detail",
      id,
      listIds: (e.detail && e.detail.listIds) || null,
      // 世界図鑑トロフィー(No.156・157「復習」)用: 復習画面から開いていた
      // 詳細画面かどうかを、地図との往復をまたいでここに保持しておく
      isReview: !!(e.detail && e.detail.isReview),
    });
    showScreen("screen-map");
    MapModule.open(mapOpenOptionsFromStack(id));
    // 共通トロフィー(四つの扉): 世界図鑑の詳細画面からの地図連携でも、
    // ホーム画面の「世界地図」カードから開いた場合と同じく、地図画面を
    // 実際に表示した時点で「世界地図を使用する」条件を満たす
    try {
      if (typeof TrophyModule !== "undefined" && typeof TrophyModule.recordCommonModeUsed === "function") {
        TrophyModule.recordCommonModeUsed("map");
      }
    } catch (e) { /* noop */ }
  });

  // 世界図鑑トロフィー(No.154・155「地図連携」)用: 図鑑の詳細画面から
  // 「🌍 地図で場所を見る」を実際に使って地図上でその国が選択表示された
  // 瞬間だけ発火する(js/map.jsのselectCountryByIdInternal参照。検索・
  // ランダム・タップ・クイズでの選択からは発火しない)。idがMAP_ONLY_REGIONS
  // (地図専用地域)の場合はStorage側で記録自体が行われずchangedがfalseの
  // ままになるため、ここでカテゴリー判定をする必要はない
  document.addEventListener("mapmodule:encyclopedia-link-selected", (e) => {
    const id = e.detail && e.detail.id;
    if (!id || typeof Storage === "undefined") return;
    let changed = false;
    try {
      changed = Storage.recordEncyclopediaMapChecked(id);
    } catch (err) {
      console.warn("世界図鑑の地図連携記録に失敗しました", err);
    }
    if (!changed) return;
    try {
      if (typeof TrophyModule === "undefined" || typeof TrophyModule.evaluateEncyclopediaVisit !== "function") return;
      const result = TrophyModule.evaluateEncyclopediaVisit();
      if (result && Array.isArray(result.awardedIds) && result.awardedIds.length) {
        notifyNonQuizTrophyAward(result.awardedIds);
      }
    } catch (err) {
      console.warn("世界図鑑トロフィーの判定に失敗しました", err);
    }
  });

  // 世界図鑑(js/encyclopedia.js)の詳細ページを開いた瞬間・復習画面から
  // 開いた瞬間に、図鑑トロフィーが新規に成立した場合はここで通知する
  // (js/encyclopedia.js側はstate.lastResult等のクイズ専用の状態を一切
  // 前提にできないため、このイベント経由で通知だけをapp.js側に依頼する)
  document.addEventListener("trophymodule:non-quiz-award", (e) => {
    const ids = e.detail && e.detail.ids;
    if (Array.isArray(ids) && ids.length) notifyNonQuizTrophyAward(ids);
  });

  // 地図の情報カード「📖 世界図鑑で見る」→ 図鑑の詳細画面をそのidで開く
  document.addEventListener("mapmodule:view-in-encyclopedia", (e) => {
    const id = e.detail && e.detail.id;
    if (!id) return;
    // 今表示している地図画面を、図鑑から戻ってきたときの再表示対象として
    // スタックに積む(地図自体は選択中の国・視点を保持したまま表示する
    // だけなので、idは不要)。地図上で直接選んだ国は復習対象かどうかに
    // 関わらず常に通常の図鑑の範囲(openDetailById)で開く
    pushMapEncyclopediaNav({ screen: "map" });
    MapModule.close();
    EncyclopediaModule.openDetailById(id, encyclopediaBackOptionsFromStack());
  });
}

// ==========================================================
// 初期化
// ==========================================================
function initApp() {
  initTopScreen();
  renderSelectScreen();
  initFlagRetry();
  initQuizExit();
  initResultScreen();
  initTitleAwardScreen();
  initTrophyAwardScreen();
  initLegendAwardScreen();
  initPuzzleTrophyAwardScreen();
  initSevenWondersCinematicScreens();
  initTrophyListScreen();
  initMemorialScreen();
  initMapEncyclopediaLink();
  FindCountryModule.initEvents();
  PuzzleModule.initEvents();
  // 世界7不思議: 本更新より前からすでに通常謎解き126問を全問獲得済みだった
  // 利用者を、次回起動時に静かに解放する。新規に解放された場合のみ、
  // トップ画面の代わりに解放演出を初期表示する(「続ける」でトップ画面へ)
  if (runSevenWondersStartupCatchUp()) {
    showSevenWondersUnlockScreen(() => showScreen("screen-top"));
  } else {
    showScreen("screen-top");
  }
  // 共通トロフィー31種類: 本更新より前からすでに条件を満たしていた利用者
  // (累計獲得数・各モード完全制覇・四天王・世界一周の旅・最終到達3種)を、
  // 次回起動時に静かに評価・付与する。画面がまだ何も表示されていない
  // 状態から直接演出を出すとレイアウトが崩れるため、screen-top(または
  // 世界7不思議の解放演出)の表示が確定した直後に呼ぶ
  try {
    if (typeof TrophyModule !== "undefined" && typeof TrophyModule.evaluateCommonTrophiesCatchUp === "function") {
      const commonCatchUpResult = TrophyModule.evaluateCommonTrophiesCatchUp();
      if (commonCatchUpResult && Array.isArray(commonCatchUpResult) && commonCatchUpResult.length) {
        notifyNonQuizTrophyAward(commonCatchUpResult);
      }
    }
  } catch (e) {
    console.warn("共通トロフィーの起動時評価に失敗しました", e);
  }
}

document.addEventListener("DOMContentLoaded", initApp);
