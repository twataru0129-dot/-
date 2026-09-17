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
  COUNTRIES.forEach((c) => {
    if (ids.has(c.id) || codes.has(c.code) || flags.has(c.flag)) dup = true;
    ids.add(c.id); codes.add(c.code); flags.add(c.flag);
  });
  console.assert(!dup, "countriesデータにid/code/flagの重複があります");
})();

const QUESTION_COUNTS = [10, 20, 30, 50, 100, 198];

// アプリ全体の状態
const state = {
  screenStack: ["screen-top"],
  selectedCount: 20,
  questions: [],
  currentQuestionIndex: 0,
  score: 0,
  answered: false,
  timer: null,
  lastResult: null, // { correct, total, rate, titleObj, isNewTitle }
  memorialType: "medal",
  memorialName: "",
};

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

  $("btn-start").addEventListener("click", () => {
    SoundManager.unlock(); // 最初のユーザー操作でAudioContextを有効化
    showScreen("screen-select");
  });

  $("btn-collection").addEventListener("click", () => {
    renderCollectionScreen();
    showScreen("screen-collection");
  });

  $("btn-sound-toggle").addEventListener("click", () => {
    SoundManager.setEnabled(!SoundManager.isEnabled());
    updateSoundButton();
  });

  $("btn-reset-data").addEventListener("click", async () => {
    const ok = await showConfirm("保存データ(称号・記録)をすべてリセットしますか？\nこの操作は取り消せません。");
    if (ok) {
      Storage.resetAll();
      alert("データをリセットしました");
    }
  });

  document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => showScreen(btn.dataset.back));
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
function initSelectScreen() {
  const grid = $("count-options");
  grid.innerHTML = "";
  QUESTION_COUNTS.forEach((count) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "count-card" + (count === 198 ? " special" : "");
    if (count === 198) {
      card.innerHTML = `<div class="count-crown">👑</div><div class="count-num">198問</div><div class="count-complete">WORLD COMPLETE 全ての国旗</div>`;
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
  showScreen("screen-quiz");
  renderQuestion();
}

function renderQuestion() {
  state.answered = false;
  const idx = state.currentQuestionIndex;
  const total = state.questions.length;
  const country = state.questions[idx];

  $("quiz-progress-text").textContent = `問題 ${idx + 1} / ${total}`;
  $("quiz-score-text").textContent = `正解 ${state.score}`;
  $("progress-bar-inner").style.width = `${Math.round((idx / total) * 100)}%`;

  $("flag-error").classList.add("hidden");
  const img = $("quiz-flag-img");
  img.src = country.flag;
  img.alt = "国旗クイズ(国名は選択肢から選んでください)";
  img.onerror = () => { $("flag-error").classList.remove("hidden"); };

  // 「よく見て考えよう！」とカウントダウンは同じ表示エリアを共有するため
  // 常にthinking側を表示・countdown側を非表示にリセットしてから開始する
  $("thinking-message").classList.remove("hidden");
  const countdownDisplay = $("countdown-display");
  countdownDisplay.classList.add("hidden");
  countdownDisplay.classList.remove("warn-3", "warn-2", "warn-1");

  $("result-overlay").classList.add("hidden");

  const excludeIds = state.questions.map((q) => q.id);
  const question = QuizEngine.buildQuestion(country, excludeIds);
  renderChoices(question.choices, country);

  if (state.timer) state.timer.stop();
  state.timer = new QuestionTimer({
    onTick: (phase, secondsLeft) => handleTimerTick(phase, secondsLeft),
    onTimeout: () => handleAnswer(null),
  });
  state.timer.start();
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
  }
}

function renderChoices(choices, correctCountry) {
  const grid = $("choices-grid");
  grid.innerHTML = "";
  choices.forEach((c) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice-btn";
    btn.textContent = c.name;
    btn.dataset.id = c.id;
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
    overlay.classList.add("wrong");
    $("result-mark").textContent = "×";
    $("result-text").textContent = isTimeout ? "時間切れ！" : "不正解！";
    $("result-answer").textContent = `正解は『${correctCountry.name}』です`;
    SoundManager.playWrong();
  }

  $("quiz-score-text").textContent = `正解 ${state.score}`;

  setTimeout(() => {
    goToNextQuestion();
  }, 1500);
}

function goToNextQuestion() {
  state.currentQuestionIndex += 1;
  if (state.currentQuestionIndex >= state.questions.length) {
    finishQuiz();
  } else {
    renderQuestion();
  }
}

function initQuizExit() {
  $("btn-quiz-exit").addEventListener("click", async () => {
    const ok = await showConfirm("クイズを終了しますか？");
    if (ok) {
      if (state.timer) state.timer.stop();
      showScreen("screen-top");
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

  Storage.incrementAttempts();
  Storage.updateBestRate(rate);
  const best = Storage.updateBestRecord(total, correct, total);

  const perfect = correct === total;
  const titleObj = perfect ? getTitleByCount(total) : null;
  let isNewTitle = false;
  if (titleObj) {
    isNewTitle = Storage.awardTitleIfNew(titleObj.id);
  }

  state.lastResult = { correct, total, rate, titleObj, isNewTitle, best };
  renderResultScreen();
  showScreen("screen-result");
}

function renderResultScreen() {
  const { correct, total, rate, titleObj, best } = state.lastResult;
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
}

function initResultScreen() {
  $("btn-result-retry").addEventListener("click", () => startQuiz(state.selectedCount));
  $("btn-result-change-count").addEventListener("click", () => showScreen("screen-select"));
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
function renderCollectionScreen() {
  const grid = $("collection-grid");
  grid.innerHTML = "";
  const earned = Storage.getEarnedTitles();

  TITLES.forEach((t) => {
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

  const recordList = $("record-list");
  const records = Storage.getBestRecords();
  const attempts = Storage.getAttempts();
  const bestRate = Storage.getBestRate();
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
    TITLES.forEach((t) => {
      const btn = document.createElement("button");
      btn.className = "btn btn-plain";
      btn.style.marginRight = "6px";
      btn.style.marginBottom = "6px";
      btn.textContent = `Test: ${t.name}`;
      btn.addEventListener("click", () => {
        state.lastResult = { correct: t.count, total: t.count, rate: 100, titleObj: t, isNewTitle: true, best: { correct: t.count, total: t.count } };
        renderTitleAwardScreen();
        showScreen("screen-title-award");
      });
      debugBox.appendChild(btn);
    });
    recordList.appendChild(debugBox);
  }
}

// ==========================================================
// メダル・賞状作成画面
// ==========================================================
function openMemorialScreen() {
  const nameInput = $("memorial-name");
  nameInput.value = state.memorialName;
  updateMemorialPreview();
  showScreen("screen-memorial");
}

function currentMemorialData() {
  const { titleObj, total } = state.lastResult || {};
  const name = $("memorial-name").value.trim();
  state.memorialName = name;
  const dateObj = new Date();
  return {
    titleObj: titleObj || TITLES[0],
    total: total || state.selectedCount,
    name,
    dateObj,
  };
}

function updateMemorialPreview() {
  const { titleObj, total, name, dateObj } = currentMemorialData();
  const dateStr = formatJapaneseDate(dateObj);

  $("mc-medal").className = `medal medal-lg ${titleObj.medalClass}`;
  $("mc-title").textContent = titleObj.name;
  $("mc-name").textContent = `${name || "挑戦者"} さん`;
  $("mc-count").innerHTML = `${total}問 <span class="mc-perfect">PERFECT!</span>`;
  $("mc-date").textContent = dateStr.replace(/年|月/g, ".").replace("日", "");

  const isLegend = total === 198;
  $("cert-title").textContent = isLegend ? "特別認定証" : "認定証";
  const lines = buildCertificateBodyLines(titleObj, total, name);
  $("cert-body").textContent = lines.join("\n");
  $("cert-date").textContent = dateStr;
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

  $("btn-save-image").addEventListener("click", () => {
    const { titleObj, total, name, dateObj } = currentMemorialData();
    const dateStr = formatJapaneseDate(dateObj);
    let canvas, filename;
    if (state.memorialType === "medal") {
      canvas = renderMedalCanvas({
        titleName: titleObj.name,
        medalClass: titleObj.medalClass,
        name,
        questionCount: total,
        dateStr: dateStr.replace(/年|月/g, ".").replace("日", ""),
      });
      // ファイル名は端末やブラウザによって日本語が正しく扱われない場合があるためASCIIにする
      filename = `world-flag-quiz_medal_${titleObj.id}.png`;
    } else {
      const isLegend = total === 198;
      canvas = renderCertificateCanvas({
        certTitle: isLegend ? "特別認定証" : "認定証",
        bodyLines: buildCertificateBodyLines(titleObj, total, name),
        dateStr,
      });
      filename = `world-flag-quiz_certificate_${titleObj.id}.png`;
    }
    const result = saveCanvasAsPNG(canvas, filename);
    $("ios-save-hint").classList.toggle("hidden", result !== "ios");
  });
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
// 初期化
// ==========================================================
function initApp() {
  initTopScreen();
  initSelectScreen();
  initQuizExit();
  initResultScreen();
  initTitleAwardScreen();
  initMemorialScreen();
  showScreen("screen-top");
}

document.addEventListener("DOMContentLoaded", initApp);
