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

  $("btn-collection").addEventListener("click", () => {
    renderCollectionScreen();
    showScreen("screen-collection");
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

  // トロフィー刷新 第2段階: 既存のスコア・称号判定がすべて確定した後、
  // 新トロフィーシステム(js/trophy.js)の判定を呼ぶ。正式な107項目は
  // まだ1件も確定していないため、現時点では必ず何も獲得されない
  // (安全な空振り)。例外が起きても既存のクイズ結果には一切影響しないよう必ずtry/catchで囲む
  try {
    if (typeof TrophyModule !== "undefined") {
      TrophyModule.evaluateQuizFinish({
        mode,
        total,
        correct,
        rate,
        perfect,
        wrongIds: Array.from(state.wrongIds),
        correctIds: state.questions.filter((q) => !state.wrongIds.has(q.id)).map((q) => q.id),
        questionIds: state.questions.map((q) => q.id),
      });
    }
  } catch (e) {
    console.warn("トロフィー判定に失敗しました(クイズ結果には影響しません)", e);
  }

  // 完了したクイズの復習対象として、このクイズ中に記録した不正解idの
  // スナップショットを持たせる(配列に変換。以後state.wrongIdsが新しい
  // クイズでリセットされても、この結果画面用のコピーには影響しない)
  state.lastResult = { correct, total, rate, titleObj, isNewTitle, best, mode, wrongIds: Array.from(state.wrongIds) };
  renderResultScreen();
  showScreen("screen-result");
}

function renderResultScreen() {
  const { correct, total, rate, titleObj, best, wrongIds } = state.lastResult;
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

// ==========================================================
// 称号コレクション画面
// ==========================================================
// 国旗クイズ・首都クイズどちらの称号セクションも同じ描画処理を共有する
function renderCollectionSection(titles, mode, gridId, recordListId) {
  const grid = $(gridId);
  grid.innerHTML = "";
  const earned = Storage.getEarnedTitles(mode);

  titles.forEach((t) => {
    const data = earned[t.id];
    const card = document.createElement("div");
    card.className = "collection-card" + (data ? "" : " locked");
    if (data) {
      const dateStr = formatJapaneseDate(new Date(data.earnedAt));
      card.innerHTML = `
        <div class="medal ${t.medalClass}"></div>
        <div class="collection-info">
          <p class="collection-name">${t.name}</p>
          <p class="collection-cond">${t.condition}</p>
          <p class="collection-date">${dateStr} 取得</p>
        </div>`;
    } else {
      card.innerHTML = `
        <div class="medal locked"></div>
        <div class="collection-info">
          <p class="collection-name">？？？</p>
          <p class="collection-cond">${t.condition}で解放</p>
        </div>`;
    }
    grid.appendChild(card);
  });

  const recordList = $(recordListId);
  const records = Storage.getBestRecords(mode);
  const attempts = Storage.getAttempts(mode);
  const bestRate = Storage.getBestRate(mode);
  let html = `<h3>記録</h3>`;
  html += `<div class="record-row"><span>挑戦回数</span><span>${attempts} 回</span></div>`;
  html += `<div class="record-row"><span>最高正答率</span><span>${bestRate}％</span></div>`;
  QUESTION_COUNTS.forEach((count) => {
    const r = records[String(count)];
    html += `<div class="record-row"><span>${count}問モード 最高記録</span><span>${r ? `${r.correct} / ${r.total}` : "-"}</span></div>`;
  });
  recordList.innerHTML = html;

  if (DEBUG_MODE) {
    const debugBox = document.createElement("div");
    debugBox.style.marginTop = "16px";
    debugBox.innerHTML = "<p style='font-size:12px;color:#999;'>DEBUG: 称号を強制表示</p>";
    titles.forEach((t) => {
      const btn = document.createElement("button");
      btn.className = "btn btn-plain";
      btn.style.marginRight = "6px";
      btn.style.marginBottom = "6px";
      btn.textContent = `Test: ${t.name}`;
      btn.addEventListener("click", () => {
        state.mode = mode;
        state.lastResult = { correct: t.count, total: t.count, rate: 100, titleObj: t, isNewTitle: true, best: { correct: t.count, total: t.count }, mode };
        renderTitleAwardScreen();
        showScreen("screen-title-award");
      });
      debugBox.appendChild(btn);
    });
    recordList.appendChild(debugBox);
  }
}

// 称号コレクション画面: 国旗クイズ・首都クイズを2セクションに分けて表示する
// (称号・記録は別々のlocalStorageキーで管理されているため混同しない)
function renderCollectionScreen() {
  renderCollectionSection(TITLES, "flag", "collection-grid-flag", "record-list-flag");
  renderCollectionSection(CAPITAL_TITLES, "capital", "collection-grid-capital", "record-list-capital");
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
      "称号・トロフィー・記録・ランキング・コレクションが削除されます。この操作は取り消せません。",
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
          EncyclopediaModule.openDetailWithList(top.id, top.listIds, opts);
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
    pushMapEncyclopediaNav({ screen: "encyclopedia-detail", id, listIds: (e.detail && e.detail.listIds) || null });
    showScreen("screen-map");
    MapModule.open(mapOpenOptionsFromStack(id));
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
  initMemorialScreen();
  initMapEncyclopediaLink();
  FindCountryModule.initEvents();
  showScreen("screen-top");
}

document.addEventListener("DOMContentLoaded", initApp);
