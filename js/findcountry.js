// ==========================================================
// 第4段階「世界の国どこかな？」第4段階: 得点・ライフ・タイマー・ゲームオーバー
//
// 今回実装するのは、制限時間のカウントダウン・ライフ管理・誤答/パス/
// 時間切れの処理・ゲームオーバー・現在/最大連続正解数・一時停止/画面離脱/
// バックグラウンド移行時のタイマー整合性・結果画面の拡張。
// 得点計算は、過去の会話・リポジトリ・GitHub Issue/PRを調査したが、
// 基礎点・時間ボーナス・連続正解ボーナス等の具体的な配点ルールが
// 確定した仕様は見つからなかった(既存の国旗/首都クイズのstate.scoreも
// 単なる正解数カウントであり、ポイント制の得点計算は存在しない)。
// そのため、得点計算は独立した関数(computeScore)として呼び出し口だけを
// 用意し、確定した配点が無い間は常にnull(未確定)を返す。架空の得点を
// 結果画面に表示することはしない。
//
// PRO専用の開始条件・特別な得点・演出・称号は今回追加しない。PROも
// 通常コースと全く同じ共通のタイマー・ライフ・正誤処理を使う
// (パス不可・216件1回ずつ出題は第3段階までで実装済み)。
//
// 3D地球儀はPR #43で地図モードが使っているものをそのまま再利用する。
// 別の地球儀インスタンスを作らず、既存の#map-globe-container/#screen-map
// をクイズ画面としても使い回し、MapModuleの新APIだけを呼び出す。
// ==========================================================

const FindCountryModule = (() => {
  function $(id) { return document.getElementById(id); }

  // ---------- 難易度・コース定義 ----------
  const DIFFICULTIES = [
    { id: "beginner", label: "初級", count: 100, seconds: 30, icon: "🌱" },
    { id: "intermediate", label: "中級", count: 198, seconds: 25, icon: "⭐" },
    { id: "advanced", label: "上級", count: 212, seconds: 20, icon: "🔥" },
    { id: "pro", label: "PRO", count: 216, seconds: 15, icon: "👑", special: true },
  ];
  const QUESTION_COUNTS = [5, 10, 20, 30];
  const PRO_DIFFICULTY_ID = "pro";
  const MAX_LIVES = 3;
  // 残り時間の警告しきい値(秒)。難易度(15〜30秒)によらず固定の絶対値を使う。
  // 具体的な秒数の確定仕様は見当たらなかったため、既存の国旗/首都クイズの
  // 5秒カウントダウン(warn-3/warn-2/warn-1)と同じ「色・文字の両方で警告する」
  // 考え方だけを踏襲し、このモード向けの妥当な値として独自に決めている
  const TIMER_WARNING_SECONDS = 10;
  const TIMER_CRITICAL_SECONDS = 5;

  function difficultyById(id) {
    return DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES[0];
  }

  // 上級(212)は、PRO(216)からこの4地域(国家としての地位が定まっていない、
  // または国ではない地域。js/map-regions.jsでrandomEligible:falseが
  // 付いている4件と同じ)を除いた件数。既存のrandomEligible自体は
  // 「ランダムな国へ」専用のフラグのため一切変更せず、ここでは出題対象の
  // 除外だけを別途このID一覧で行う
  const ADVANCED_EXCLUDED_IDS = ["antarctica", "cyn", "sol", "kas"];

  // 初級100件の確定リスト。このタスク開始前の調査時点でリポジトリ内には
  // 実データとして存在しなかったため新規に選び直すことはせず、過去の会話で
  // 利用者自身が明示的に提示し、全件が既存countries.jsのidと一致し重複・
  // 欠落も無いことを確認済みの、この100件をそのまま確定リストとして使う
  // (地域内訳: アジア28/ヨーロッパ25/アフリカ24/アメリカ19/オセアニア4)
  const BEGINNER_100_IDS = [
    "jp", "cn", "kr", "kp", "mn", "tw", "in", "pk", "bd", "np",
    "af", "ir", "iq", "sa", "tr", "il", "jo", "kz", "uz", "th",
    "vn", "kh", "mm", "my", "id", "ph", "lk", "la",
    "gb", "ie", "fr", "de", "es", "pt", "it", "ch", "at", "be",
    "nl", "dk", "no", "se", "fi", "is", "pl", "cz", "hu", "gr",
    "ua", "ro", "bg", "rs", "ru",
    "eg", "ly", "dz", "ma", "tn", "sd", "et", "ke", "tz", "so",
    "ng", "gh", "ci", "ml", "ne", "td", "cm", "cd", "ao", "na",
    "za", "mg", "mz", "zm",
    "us", "ca", "mx", "gt", "ni", "pa", "cu", "cr", "br", "ar",
    "cl", "pe", "co", "ve", "bo", "ec", "py", "uy", "do",
    "au", "nz", "pg", "fj",
  ];

  // ---------- 出題対象プールの構築 ----------
  // COUNTRIES(198件、quiz.js/encyclopedia.jsと同じ国旗/首都クイズ対象)と
  // MAP_ONLY_REGIONS(18件、地図専用地域)の合算パターンは、既存の
  // encyclopedia.js/map.jsが使っているものと同じ動的な合算にする
  // (新モード専用に198件を複製しない)
  function allMapIdCountries() {
    return COUNTRIES.concat(typeof MAP_ONLY_REGIONS !== "undefined" ? MAP_ONLY_REGIONS : []);
  }

  function buildPoolIds(difficultyId) {
    const allIds = allMapIdCountries().map((c) => c.id);
    switch (difficultyId) {
      case "beginner":
        return BEGINNER_100_IDS.slice();
      case "intermediate":
        return COUNTRIES.map((c) => c.id);
      case "advanced":
        return allIds.filter((id) => !ADVANCED_EXCLUDED_IDS.includes(id));
      case "pro":
        return allIds;
      default:
        return COUNTRIES.map((c) => c.id);
    }
  }

  function buildPoolCountries(difficultyId) {
    const byId = new Map(allMapIdCountries().map((c) => [c.id, c]));
    return buildPoolIds(difficultyId)
      .map((id) => byId.get(id))
      .filter(Boolean);
  }

  // ---------- 出題対象データの自己検証(既存のjs/app.js冒頭にある
  // console.assertベースの検証パターンを踏襲)。問題が無ければ何も出力しない ----------
  function validatePools() {
    const all = allMapIdCountries();
    const allIds = new Set(all.map((c) => c.id));
    console.assert(all.length === 216, `世界の国どこかな？: 出題対象の全件数が216件ではありません(実際: ${all.length}件)`);
    console.assert(allIds.size === all.length, "世界の国どこかな？: 全216件のIDに重複があります");

    DIFFICULTIES.forEach((d) => {
      const ids = buildPoolIds(d.id);
      console.assert(ids.length === d.count, `世界の国どこかな？: 難易度「${d.label}」の出題対象数が${d.count}件ではありません(実際: ${ids.length}件)`);
      console.assert(new Set(ids).size === ids.length, `世界の国どこかな？: 難易度「${d.label}」の出題対象にID重複があります`);
      const invalidIds = ids.filter((id) => !allIds.has(id));
      console.assert(invalidIds.length === 0, `世界の国どこかな？: 難易度「${d.label}」の出題対象に不正なIDがあります: ${invalidIds.join(", ")}`);
    });

    const advancedIds = new Set(buildPoolIds("advanced"));
    const wronglyIncluded = ADVANCED_EXCLUDED_IDS.filter((id) => advancedIds.has(id));
    console.assert(wronglyIncluded.length === 0, `世界の国どこかな？: 上級に除外対象の地域が含まれています: ${wronglyIncluded.join(", ")}`);

    const proIds = new Set(buildPoolIds("pro"));
    const missingFromPro = ADVANCED_EXCLUDED_IDS.filter((id) => !proIds.has(id));
    console.assert(missingFromPro.length === 0, `世界の国どこかな？: PROに南極大陸・北キプロス・ソマリランド・シアチェン氷河が含まれていません: ${missingFromPro.join(", ")}`);
  }
  validatePools();

  // ---------- 制限時間タイマー ----------
  // js/quiz.jsのQuestionTimerと同じ設計方針(performance.now()基準で経過時間
  // から残り時間を計算し、setIntervalの回数を数える方式は使わない。
  // pause()/resume()はstartTimeを一時停止していた分だけ後ろにずらすことで、
  // 一時停止中の経過時間を残り時間の計算に含めない)を踏襲する。
  // QuestionTimerはQuizEngine.TOTAL_SECONDS固定・thinking/countdownの
  // 2フェーズ専用で国旗/首都クイズ専用の作りのため複製・流用はせず、
  // 任意の秒数を受け取れる汎用クラスとしてこのモード専用に新規定義する
  // (js/quiz.js自体は一切変更しない)。
  class FindCountryTimer {
    constructor(totalSeconds, callbacks) {
      // callbacks: { onTick(secondsLeftFloat), onTimeout() }
      this.totalSeconds = totalSeconds;
      this.callbacks = callbacks;
      this.rafId = null;
      this.startTime = null;
      this.stopped = true;
      this.paused = false;
      this.pausedAt = null;
      this.loop = this.loop.bind(this);
    }

    start() {
      this.stop(); // 二重起動防止。既存のタイマーが残っていれば必ず先に止める
      this.stopped = false;
      this.paused = false;
      this.pausedAt = null;
      this.startTime = performance.now();
      this.rafId = requestAnimationFrame(this.loop);
    }

    loop(now) {
      if (this.stopped || this.paused) return;
      const elapsed = (now - this.startTime) / 1000;
      const remaining = this.totalSeconds - elapsed;
      if (remaining <= 0) {
        this.stop();
        this.callbacks.onTimeout();
        return;
      }
      this.callbacks.onTick(remaining);
      this.rafId = requestAnimationFrame(this.loop);
    }

    // 一時停止・画面離脱・バックグラウンド移行時に呼ぶ。resume()で
    // 続きから再開できる(stop()と違い、経過時間を保持したまま止める)
    pause() {
      if (this.stopped || this.paused) return; // 連打・多重呼び出しに対する安全策
      this.paused = true;
      this.pausedAt = performance.now();
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }

    resume() {
      if (this.stopped || !this.paused) return;
      const pausedDuration = performance.now() - this.pausedAt;
      this.startTime += pausedDuration;
      this.paused = false;
      this.pausedAt = null;
      this.rafId = requestAnimationFrame(this.loop);
    }

    // 回答確定時・時間切れ時・問題切替時・ゲーム終了時・画面離脱時に必ず呼ぶ
    stop() {
      this.stopped = true;
      this.paused = false;
      this.pausedAt = null;
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }

    // 一時停止中でも(freezeされた時点の値のまま)安全に読める残り秒数。
    // バックグラウンド移行時、rAFが止まっていても実際の経過時間を
    // 確認するために使う(handleVisibilityChange参照)
    remainingSeconds() {
      if (this.stopped) return 0;
      const now = this.paused ? this.pausedAt : performance.now();
      return Math.max(0, this.totalSeconds - (now - this.startTime) / 1000);
    }
  }

  // ---------- 得点計算(未確定) ----------
  // 過去の会話・リポジトリ(js/quiz.js・js/storage.js等)・GitHubのIssue/PR/
  // コミット履歴を調査したが、基礎点・時間ボーナス・連続正解ボーナスなどの
  // 具体的な配点ルールが確定した仕様は見つからなかった。既存の国旗/首都
  // クイズのstate.scoreも「正解数のカウント(+1ずつ)」であり、ポイント制の
  // 得点計算そのものが存在しない。独断で正式な配点を決めることは避け、
  // 呼び出し口(difficultyId/result/secondsLeft/totalSeconds/currentStreakを
  // 既に渡せる構造)だけを用意し、常にnull(未確定)を返す。配点が確定した
  // 際は、呼び出し元を一切変更せずこの関数の中身だけを差し替えれば済む
  function computeScore(context) {
    // context: { difficultyId, result, secondsLeft, totalSeconds, currentStreak }
    return null;
  }

  // ---------- 画面遷移をまたいで保持するコース選択(成績としては保存しない) ----------
  const selection = {
    difficultyId: null,
    questionCount: null,
  };

  // ---------- 今回のプレイ中だけメモリ上で保持するクイズの進行状態 ----------
  // 成績としてlocalStorageへは一切保存しない(仕様どおり、今回のプレイ限り)
  const quizState = {
    difficultyId: null,
    sequence: [], // 出題順に並んだ国・地域オブジェクトの配列(同一プレイ中は重複しない)
    currentIndex: 0, // 0始まり
    currentCountry: null,
    answered: false, // 今の問題について既に回答確定済み(タップ・パス・時間切れ)かどうか
    results: [], // {questionNumber, countryId, answeredId, result, secondsLeft, points, livesAfter, streakAfter}
    lives: MAX_LIVES,
    currentStreak: 0,
    maxStreak: 0,
    gameOver: false, // ライフ0で終了したか(結果画面の表示分岐・最終問題判定に使う)
  };

  // 現在アクティブな制限時間タイマー(問題ごとに作り直す。1問につき1個だけ
  // 存在し、次の問題・画面離脱の際に必ずstop()してから作り直す/破棄する)
  let timer = null;
  // renderQuestion()を呼ぶたびに増やす。地球儀(globe.gl、1.9MB)の初回読み込み中に
  // タイマー開始を遅延させている間に、利用者が次の問題へ進んだり画面を離れたり
  // した場合、古い遅延開始コールバックが誤って新しいタイマーを起動しないようにする
  let renderToken = 0;

  // ---------- 難易度選択画面 ----------
  function renderDifficultyScreen() {
    const grid = $("findcountry-difficulty-options");
    grid.innerHTML = "";
    DIFFICULTIES.forEach((d) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "count-card difficulty-card" + (d.special ? " special" : "");
      const metaText = d.special
        ? `${d.count}の国・地域・1回ずつ出題`
        : `${d.count}の国・地域`;
      card.innerHTML = d.special
        ? `<div class="count-crown">${d.icon}</div><div class="count-num">${d.label}</div><div class="count-complete">PRO MODE</div><div class="difficulty-card-meta">${metaText}・制限時間${d.seconds}秒</div>`
        : `<div class="count-num">${d.icon} ${d.label}</div><div class="difficulty-card-meta">${metaText}・制限時間${d.seconds}秒</div>`;
      card.addEventListener("click", () => {
        selection.difficultyId = d.id;
        if (d.id === PRO_DIFFICULTY_ID) {
          // PROは問題数選択を経由しない別枠。216件を1回ずつ出題する
          selection.questionCount = null;
          startQuiz(d.id, null);
          return;
        }
        selection.questionCount = null;
        renderCountScreen(d.id);
        showScreen("screen-findcountry-count");
      });
      grid.appendChild(card);
    });
  }

  // ---------- 問題数選択画面 ----------
  function renderCountScreen(difficultyId) {
    const d = difficultyById(difficultyId);
    $("findcountry-count-lead").textContent = `${d.icon} ${d.label}(${d.count}の国・地域)`;
    const grid = $("findcountry-count-options");
    grid.innerHTML = "";
    QUESTION_COUNTS.forEach((count) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "count-card";
      card.innerHTML = `<div class="count-num">${count}</div><div class="count-unit">問</div>`;
      card.addEventListener("click", () => {
        selection.questionCount = count;
        startQuiz(difficultyId, count);
      });
      grid.appendChild(card);
    });
  }

  // ---------- 出題順の決定(ランダム抽選) ----------
  // Fisher-Yatesシャッフル(js/quiz.jsの既存のshuffleArray/pickRandom、
  // QuizEngineの外にある素のグローバル関数)を再利用し、新たに別の
  // シャッフル処理を実装しない。シャッフル元の配列には同じidが一度ずつしか
  // 含まれないため(buildPoolCountries参照)、slice()した結果も同一プレイ中に
  // 重複が生じない。PROは問題数を選ばず、216件をシャッフルした全件を使う
  function buildQuestionSequence(difficultyId, questionCount) {
    const pool = buildPoolCountries(difficultyId);
    if (difficultyId === PRO_DIFFICULTY_ID) {
      return shuffleArray(pool);
    }
    const count = Math.max(1, Math.min(questionCount || pool.length, pool.length));
    return pickRandom(pool, count);
  }

  // ---------- クイズ画面(既存の#screen-map/3D地球儀を再利用) ----------
  function startQuiz(difficultyId, questionCount) {
    quizState.difficultyId = difficultyId;
    quizState.sequence = buildQuestionSequence(difficultyId, questionCount);
    quizState.currentIndex = 0;
    quizState.results = [];
    quizState.answered = false;
    quizState.lives = MAX_LIVES;
    quizState.currentStreak = 0;
    quizState.maxStreak = 0;
    quizState.gameOver = false;

    showScreen("screen-map");
    enterFindCountryMapMode();
    hidePauseOverlay();

    // 前回の通常の地図探索モード・前回のクイズ結果の強調表示が残っていないか
    // 確実に確認してから、クイズ用のタップ判定取得API(PR #43)を登録する
    MapModule.clearQuizSelection();
    MapModule.clearQuizResultHighlight();
    MapModule.setTapResultHandler(handleTap);

    renderQuestion();
  }

  // クイズ専用ヘッダー/出題文/フッターの表示・非表示。.hidden(全体共通の
  // ユーティリティクラス、display:none !important)はfindcountry-modeの
  // CSSより優先度が高いため、CSSの切り替えだけに頼らずここで確実に
  // 付け外しする
  function setFindCountryChromeVisible(visible) {
    ["findcountry-quiz-header", "findcountry-quiz-prompt", "findcountry-quiz-footer"].forEach((id) => {
      $(id).classList.toggle("hidden", !visible);
    });
  }

  function enterFindCountryMapMode() {
    $("screen-map").classList.add("findcountry-mode");
    setFindCountryChromeVisible(true);
    // 既存の世界地図モードと全く同じ初期化・再開ロジック(ensureReady/
    // resumeAnimation等)を呼ぶだけで、別の地球儀は一切作らない
    MapModule.open();
  }

  // 既存の世界地図モードへ戻った際、通常の地図操作が完全に復元されるよう、
  // クイズ専用のタップハンドラー・強調表示・選択状態を必ず元に戻す。
  // タイマーも画面離脱時に必ず止める(バックグラウンドで動き続けない)
  function leaveFindCountryMapMode() {
    if (timer) {
      timer.stop();
      timer = null;
    }
    // 地球儀の初回読み込み待ち(beginTimerWhenGlobeReady)の途中で画面を
    // 離れた場合、その待機処理はfindcountry-modeクラスの有無でも自ら
    // 停止するが、ここでもrenderTokenを即座に進めておく。こうすることで
    // 離脱直後に新しいゲームを開始しても、古い待機処理が「離脱前と同じ
    // token」のまま次のrenderQuestion()の値と偶然一致する余地を作らず、
    // 離脱した瞬間に確実に無効化できる(新しいタイマーを上書きする事故の防止)
    renderToken += 1;
    MapModule.clearTapResultHandler();
    MapModule.clearQuizResultHighlight();
    MapModule.clearQuizSelection();
    MapModule.close();
    $("screen-map").classList.remove("findcountry-mode");
    setFindCountryChromeVisible(false);
  }

  // ---------- ライフ表示の更新 ----------
  function updateLivesDisplay() {
    const filled = "❤️".repeat(Math.max(0, quizState.lives));
    const empty = "🤍".repeat(Math.max(0, MAX_LIVES - quizState.lives));
    $("findcountry-quiz-lives").textContent = filled + empty;
  }

  // ---------- 残り時間表示の更新(色だけでなく数字・記号も変化させる) ----------
  function updateTimerDisplay(secondsLeftFloat) {
    const el = $("findcountry-quiz-timer");
    const rounded = Math.max(0, Math.ceil(secondsLeftFloat));
    el.classList.remove("is-warning", "is-critical");
    if (rounded <= TIMER_CRITICAL_SECONDS) {
      el.classList.add("is-critical");
      el.textContent = `⏰ ${rounded}`;
    } else if (rounded <= TIMER_WARNING_SECONDS) {
      el.classList.add("is-warning");
      el.textContent = `⏱ ${rounded}`;
    } else {
      el.textContent = `⏱ ${rounded}`;
    }
  }

  // ---------- 出題画面の表示更新 ----------
  function renderQuestion() {
    const d = difficultyById(quizState.difficultyId);
    const total = quizState.sequence.length;
    quizState.currentCountry = quizState.sequence[quizState.currentIndex];
    quizState.answered = false;

    // 正解の自動ハイライト・自動カメラ移動・国名ラベル・情報カードは
    // 一切行わない(クイズ専用の強調表示を必ず解除してから次の問題を出す)
    MapModule.clearQuizResultHighlight();
    MapModule.clearQuizSelection();

    $("findcountry-quiz-difficulty").textContent = `${d.icon} ${d.label}`;
    $("findcountry-quiz-progress").textContent = `第${quizState.currentIndex + 1} / ${total}問`;
    $("findcountry-quiz-country-name").textContent = quizState.currentCountry.name;
    updateLivesDisplay();

    const resultText = $("findcountry-quiz-result-text");
    resultText.classList.add("hidden");
    resultText.classList.remove("is-correct", "is-wrong");
    resultText.textContent = "";

    $("findcountry-quiz-pass").classList.toggle("hidden", d.id === PRO_DIFFICULTY_ID);
    $("findcountry-quiz-pass").disabled = false;
    $("findcountry-quiz-next").classList.add("hidden");
    $("findcountry-quiz-hint").classList.remove("hidden");

    if (DEBUG_MODE) {
      $("findcountry-quiz-dev-tap").classList.remove("hidden");
      $("findcountry-quiz-dev-tap").textContent = "(開発用) タップ結果: まだありません";
    } else {
      $("findcountry-quiz-dev-tap").classList.add("hidden");
    }

    // 制限時間タイマーを問題ごとに必ず作り直す(二重起動防止はstart()内の
    // stop()呼び出しでも保証されるが、ここでも明示的に古いタイマーを捨てる)。
    // 地球儀(globe.gl本体・GeoJSON)の初回読み込みには数秒かかることがあり、
    // ここで即座にタイマーを開始すると、利用者がまだ地球儀を見られない間に
    // 制限時間だけが減っていく不公平が生じる。そのため、地球儀のcanvasが
    // 実際に存在する(=タップ可能になる)のを確認してから開始する
    if (timer) timer.stop();
    timer = null;
    updateTimerDisplay(d.seconds);
    renderToken += 1;
    beginTimerWhenGlobeReady(renderToken, d.seconds);
  }

  // 地球儀のcanvasが存在するまで(初回読み込み中は存在しない)requestAnimationFrameで
  // 待ってからタイマーを開始する。待っている間に次の問題へ進んだり画面を
  // 離れたりした場合は、tokenの不一致・findcountry-modeクラスの有無で
  // 判定し、古い問題のタイマーを誤って起動しない。
  // さらに、同じ問題のまま(token・findcountry-modeは一致したまま)
  // パスボタン等で既に回答確定済み(quizState.answered===true)になっていた
  // 場合も開始しない。パスボタンは地球儀のcanvasが無くても押せるため、
  // 「読み込み待ちの間にパスして回答確定→その直後に読み込みが完了」という
  // 順序が起こり得る。ここでanswered済みかを確認しないと、既に結果表示
  // (フィードバック画面)を見ている最中に新しいタイマーが裏で動き出し、
  // 回答していないはずの時間切れ扱いにはならない(handleTimeUp側のガードは
  // 効く)ものの、残り時間の表示だけが意味もなく進行してしまう
  function beginTimerWhenGlobeReady(token, totalSeconds) {
    if (token !== renderToken) return;
    if (!$("screen-map").classList.contains("findcountry-mode")) return;
    if (quizState.answered) return;
    if (!document.querySelector("#map-globe-container canvas")) {
      requestAnimationFrame(() => beginTimerWhenGlobeReady(token, totalSeconds));
      return;
    }
    timer = new FindCountryTimer(totalSeconds, {
      onTick: (secondsLeft) => updateTimerDisplay(secondsLeft),
      onTimeout: handleTimeUp,
    });
    timer.start();
    // 地球儀の読み込み完了がちょうど一時停止中のタイミングだった場合、
    // タイマーがオーバーレイの裏で動き続けないよう直後に一時停止する
    if (!$("findcountry-pause-overlay").classList.contains("hidden")) {
      timer.pause();
    }
  }

  // ---------- 回答確定(タップ・パス・時間切れを1つの処理に集約) ----------
  // ライフ減少・連続正解の更新・得点計算・結果記録を、この関数の中だけで
  // 行うことで「同じ問題で2回以上ライフが減る/加点される」事故を防ぐ。
  // 呼び出し元(handleTap/handlePass/handleTimeUp)は、quizState.answeredの
  // ガードとタイマー停止だけを担当し、ここでは二重には呼ばれない前提で動く
  // secondsLeft: 回答確定時点の残り秒数。呼び出し元がtimer.stop()を呼ぶ
  // "前"のtimer.remainingSeconds()の値を渡す(FindCountryTimer.stop()後は
  // remainingSeconds()が常に0を返す設計のため、ここで読み直すと正解・
  // 不正解・パス時の残り時間が常に0として記録されてしまう)。時間切れは
  // 呼び出し元から明示的に0を渡す
  function finalizeAnswer(result, answeredId, secondsLeft) {
    const d = difficultyById(quizState.difficultyId);

    if (result === "correct") {
      quizState.currentStreak += 1;
      if (quizState.currentStreak > quizState.maxStreak) {
        quizState.maxStreak = quizState.currentStreak;
      }
    } else {
      // 不正解・パス・時間切れは、その後に正解位置を確認しても
      // 連続正解としては扱わない(回答確定の時点で即座に0にする)
      quizState.currentStreak = 0;
      quizState.lives = Math.max(0, quizState.lives - 1);
    }

    const points = computeScore({
      difficultyId: quizState.difficultyId,
      result,
      secondsLeft,
      totalSeconds: d.seconds,
      currentStreak: quizState.currentStreak,
    });

    quizState.results.push({
      questionNumber: quizState.currentIndex + 1,
      countryId: quizState.currentCountry.id,
      answeredId: answeredId || null,
      result, // "correct" | "wrong" | "pass" | "timeout"
      secondsLeft: Math.max(0, Math.round(secondsLeft)),
      points, // 配点確定時のみ数値、それ以外はnull(架空の得点を記録しない)
      livesAfter: quizState.lives,
      streakAfter: quizState.currentStreak,
    });

    if (quizState.lives <= 0) {
      quizState.gameOver = true;
    }

    updateLivesDisplay();
    showFeedback(result, answeredId);
  }

  // ---------- 正誤判定の表示(kind: "correct" | "wrong" | "pass" | "timeout") ----------
  function showFeedback(kind, tappedId) {
    const correctId = quizState.currentCountry.id;
    const correctName = quizState.currentCountry.name;

    const resultText = $("findcountry-quiz-result-text");
    resultText.classList.remove("hidden", "is-correct", "is-wrong");

    if (kind === "correct") {
      resultText.classList.add("is-correct");
      resultText.textContent = `✅ 正解！ ここが「${correctName}」です`;
    } else if (kind === "wrong") {
      resultText.classList.add("is-wrong");
      resultText.textContent = `❌ 残念！不正解……正解は「${correctName}」でした`;
    } else if (kind === "timeout") {
      resultText.classList.add("is-wrong");
      resultText.textContent = `⏰ 時間切れ……正解は「${correctName}」でした`;
    } else {
      resultText.classList.add("is-wrong");
      resultText.textContent = `⏭ パスしました……正解は「${correctName}」でした`;
    }

    // 正解の位置を地球儀上で確認できるようにする。selectCountryForQuiz()を
    // {autoZoom:true}で呼び、国・地域の実際の大きさに応じた自動ズームで
    // カメラを移動しつつ、📍を強制的に表示・拡大する(情報カードは開かない)。
    // これによりバヌアツ・コモロのような固定ピン対象外の小国・島しょ地域や
    // 南極大陸でも位置を確認しやすくする。setQuizResultHighlight()で
    // 正解(緑)・実際にタップして不正解だった国(赤、タップがある場合のみ)を
    // 色分けする。色だけに頼らないよう、上記の文字・記号による表示を必ず
    // 併用する。既存の世界地図の色分け・国境線はこの間だけ一時的に変わり、
    // 次の問題・退出時に必ず元へ戻す
    MapModule.selectCountryForQuiz(correctId, { autoZoom: true });
    MapModule.setQuizResultHighlight(correctId, kind === "wrong" ? tappedId : null);

    $("findcountry-quiz-pass").classList.add("hidden");
    $("findcountry-quiz-hint").classList.add("hidden");
    // ゲームオーバーの場合、予定していた問題がまだ残っていても
    // ここで打ち切り、「結果を見る」に切り替える
    const isFinalQuestion = quizState.gameOver || quizState.currentIndex + 1 >= quizState.sequence.length;
    const nextBtn = $("findcountry-quiz-next");
    nextBtn.textContent = isFinalQuestion ? "結果を見る" : "次の問題へ ▶";
    nextBtn.classList.remove("hidden");

    if (DEBUG_MODE) {
      $("findcountry-quiz-dev-tap").textContent = `(開発用) タップ結果: ${tappedId || "(パス/時間切れ)"}`;
    }
  }

  // ---------- タップ回答(PR #43のMapModule.setTapResultHandlerから呼ばれる) ----------
  // 海上タップ・地球儀ドラッグ・ピンチはhandleMapTap内の既存ガードで
  // この関数に到達する前に除外済みのため、ここに渡るidは必ず実在の国・地域。
  // 1問につき回答は1回だけ受け付け、回答確定後(answered===true)の
  // 追加タップは無視して結果を変化させない
  function handleTap(tappedId) {
    if (quizState.answered) return;
    quizState.answered = true;
    // timer.stop()を呼ぶと以降remainingSeconds()は常に0を返すため、
    // 停止"前"に残り秒数を読み取ってから止める
    const secondsLeft = timer ? timer.remainingSeconds() : 0;
    if (timer) timer.stop();
    const correctId = quizState.currentCountry.id;
    const isCorrect = tappedId === correctId;
    finalizeAnswer(isCorrect ? "correct" : "wrong", tappedId, secondsLeft);
  }

  // ---------- パスボタン(通常コースのみ。PROでは表示されず、呼び出しても無効) ----------
  function handlePass() {
    if (quizState.answered) return;
    if (quizState.difficultyId === PRO_DIFFICULTY_ID) return;
    quizState.answered = true;
    const secondsLeft = timer ? timer.remainingSeconds() : 0;
    if (timer) timer.stop();
    finalizeAnswer("pass", null, secondsLeft);
  }

  // ---------- 時間切れ(FindCountryTimerのonTimeoutコールバック) ----------
  // タイマー自身がonTimeoutを呼ぶ直前に必ずstop()済みのため、ここで
  // 改めてtimer.stop()を呼ぶ必要はない。時間切れ後に地球儀をタップしても
  // quizState.answered===trueによりhandleTapが無視するため、結果は変わらない。
  // 時間切れの残り秒数は必ず0として記録する
  function handleTimeUp() {
    if (quizState.answered) return; // 念のための二重発火防止
    quizState.answered = true;
    finalizeAnswer("timeout", null, 0);
  }

  // ---------- 「次の問題へ」/「結果を見る」ボタン ----------
  function handleNextClick() {
    if (!quizState.answered) return; // 回答確定前はこのボタンは表示されない(念のためのガード)
    const isFinalQuestion = quizState.gameOver || quizState.currentIndex + 1 >= quizState.sequence.length;
    if (isFinalQuestion) {
      showResult();
      return;
    }
    quizState.currentIndex += 1;
    renderQuestion();
  }

  // ---------- 一時停止(手動ボタン・タブ切り替え/バックグラウンド移行の両方から呼ぶ) ----------
  function showPauseOverlay() {
    $("findcountry-pause-overlay").classList.remove("hidden");
    if (timer) timer.pause();
  }
  function hidePauseOverlay() {
    $("findcountry-pause-overlay").classList.add("hidden");
    if (timer) timer.resume();
  }

  // タブ切り替え・アプリのバックグラウンド移行を検知し、自動的に一時停止する。
  // 復帰時に勝手にタイマーが進行しないよう、再開は既存の「▶ 再開」ボタンの
  // 操作だけで行う(可視化に戻ったタイミングで自動再開はしない)。
  // rAFはタブが非表示の間スロットリングされ発火しない(=onTimeoutが
  // 呼ばれない)ため、隠れる直前の時点でperformance.now()基準の正確な
  // 残り時間を確認し、既に0以下であれば時間切れを不正に回避させず
  // その場で確定させる
  function handleVisibilityChange() {
    if (!document.hidden) return;
    if (!$("screen-map").classList.contains("findcountry-mode")) return;
    if (!timer || quizState.answered || quizState.gameOver) return;
    if (timer.remainingSeconds() <= 0) {
      timer.stop();
      handleTimeUp();
    } else {
      showPauseOverlay();
    }
  }

  // ---------- 終了・戻る ----------
  async function handleQuizBackClick() {
    const ok = await showConfirm("「世界の国どこかな？」を終了しますか？");
    if (!ok) return;
    backToCourseSelect();
  }

  function backToCourseSelect() {
    leaveFindCountryMapMode();
    if (selection.difficultyId === PRO_DIFFICULTY_ID || !selection.difficultyId) {
      showScreen("screen-findcountry-difficulty");
    } else {
      renderCountScreen(selection.difficultyId);
      showScreen("screen-findcountry-count");
    }
  }

  function backToHome() {
    leaveFindCountryMapMode();
    showScreen("screen-top");
  }

  // ---------- 結果画面(今回のプレイの実際の回答結果を集計して表示) ----------
  function showResult() {
    leaveFindCountryMapMode();
    const d = difficultyById(quizState.difficultyId);
    const planned = quizState.sequence.length; // 予定していた問題数
    const answered = quizState.results.length; // 実際に回答(タップ・パス・時間切れ含む)した数
    const correctCount = quizState.results.filter((r) => r.result === "correct").length;
    const rate = answered > 0 ? Math.round((correctCount / answered) * 100) : 0;

    $("findcountry-result-title").textContent = quizState.gameOver ? "ゲームオーバー" : "結果発表";
    const gameoverNote = $("findcountry-result-gameover-note");
    if (quizState.gameOver) {
      gameoverNote.textContent = `${MAX_LIVES}回間違えたため、ここで終了です`;
      gameoverNote.classList.remove("hidden");
    } else {
      gameoverNote.classList.add("hidden");
      gameoverNote.textContent = "";
    }

    $("findcountry-result-course").textContent = `${d.icon} ${d.label}`;
    $("findcountry-result-planned").textContent = `予定問題数：${planned}問`;
    $("findcountry-result-answered").textContent = `実際の回答数：${answered}問`;
    $("findcountry-result-score-fraction").textContent = `${answered}問中${correctCount}問正解！`;
    $("findcountry-result-rate").textContent = `正答率 ${rate}%`;
    $("findcountry-result-streak").textContent = `最大連続正解 ${quizState.maxStreak}`;
    $("findcountry-result-lives").textContent =
      `残りライフ ${"❤️".repeat(Math.max(0, quizState.lives))}${"🤍".repeat(Math.max(0, MAX_LIVES - quizState.lives))}`;

    // 得点は配点が確定した場合のみ表示する(今回は未確定のため常に非表示)
    const anyScoreConfirmed = quizState.results.some((r) => r.points !== null);
    const pointsEl = $("findcountry-result-points");
    if (anyScoreConfirmed) {
      const totalPoints = quizState.results.reduce((sum, r) => sum + (r.points || 0), 0);
      pointsEl.textContent = `得点 ${totalPoints}点`;
      pointsEl.classList.remove("hidden");
    } else {
      pointsEl.classList.add("hidden");
      pointsEl.textContent = "";
    }

    showScreen("screen-findcountry-result");
  }

  // ---------- 初期化(一度だけ呼ぶ。画面遷移を繰り返しても再登録しない) ----------
  function initEvents() {
    $("findcountry-quiz-back").addEventListener("click", handleQuizBackClick);
    $("findcountry-quiz-pause").addEventListener("click", showPauseOverlay);
    $("findcountry-quiz-pass").addEventListener("click", handlePass);
    $("findcountry-quiz-next").addEventListener("click", handleNextClick);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    $("findcountry-pause-resume").addEventListener("click", hidePauseOverlay);
    $("findcountry-pause-to-select").addEventListener("click", () => {
      hidePauseOverlay();
      backToCourseSelect();
    });
    $("findcountry-pause-to-home").addEventListener("click", () => {
      hidePauseOverlay();
      backToHome();
    });

    $("btn-findcountry-result-retry").addEventListener("click", () => {
      if (selection.difficultyId) {
        startQuiz(selection.difficultyId, selection.questionCount);
      } else {
        renderDifficultyScreen();
        showScreen("screen-findcountry-difficulty");
      }
    });
    $("btn-findcountry-result-to-select").addEventListener("click", () => {
      if (selection.difficultyId && selection.difficultyId !== PRO_DIFFICULTY_ID) {
        renderCountScreen(selection.difficultyId);
        showScreen("screen-findcountry-count");
      } else {
        renderDifficultyScreen();
        showScreen("screen-findcountry-difficulty");
      }
    });
    $("btn-findcountry-result-to-home").addEventListener("click", () => {
      showScreen("screen-top");
    });
  }

  // ---------- 外部から呼ぶ入口(トップ画面のモードカードから呼ばれる) ----------
  function openDifficultyScreen() {
    renderDifficultyScreen();
    showScreen("screen-findcountry-difficulty");
  }

  return { initEvents, openDifficultyScreen };
})();
