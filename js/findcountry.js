// ==========================================================
// 第4段階「世界の国どこかな？」第4段階: 得点・ライフ・タイマー・ゲームオーバー
// (第4段階追加修正で得点計算式・回答時間計測・PRO専用ライフルールを確定)
//
// 制限時間のカウントダウン・ライフ管理・誤答/パス/時間切れの処理・
// ゲームオーバー・現在/最大連続正解数・一時停止/画面離脱/バックグラウンド
// 移行時のタイマー整合性・結果画面の拡張に加えて、以下の確定仕様を実装する。
//
// 得点計算(computeScore): 1問最高1,000点。3.00秒以内に正解で満点、
// 3.00秒を超えた分は1秒につき30点減点(下限0点)。不正解・パス・時間切れは
// 常に0点。時間ボーナス・連続正解倍率・難易度倍率は付けない。回答時間
// (elapsedSeconds)は0.01秒単位で扱い、一時停止中・地球儀の初回読み込み
// 待ち中の時間は含めない(FindCountryTimerが元々それらの時間を計測に
// 含めない設計のため、残り時間からの引き算だけで自然に満たせる)。
//
// PROはライフ1(1ミスで即ゲームオーバー)。通常コース(初級/中級/上級)は
// 難易度ごとに異なる最大ライフ(初級5/中級4/上級3)をDIFFICULTIESで一元管理する。
// それ以外のPRO専用の開始条件・特別な演出・称号は今回追加しない
// (パス不可・216件1回ずつ出題は第3段階までで実装済み)。
//
// 3D地球儀はPR #43で地図モードが使っているものをそのまま再利用する。
// 別の地球儀インスタンスを作らず、既存の#map-globe-container/#screen-map
// をクイズ画面としても使い回し、MapModuleの新APIだけを呼び出す。
// ==========================================================

const FindCountryModule = (() => {
  function $(id) { return document.getElementById(id); }

  // ---------- 難易度・コース定義 ----------
  // 難易度ごとの最大ライフ数(maxLives)もここで一元管理する。新しいゲーム
  // 開始時(startQuiz)にmaxLivesFor()で参照し、その値をquizState.livesの
  // 初期値として設定する。PROはパス不可・1ミスで即ゲームオーバーの確定仕様の
  // ためライフ1のまま変更しない
  const DIFFICULTIES = [
    { id: "beginner", label: "初級", count: 100, seconds: 30, icon: "🌱", maxLives: 5 },
    { id: "intermediate", label: "中級", count: 198, seconds: 25, icon: "⭐", maxLives: 4 },
    { id: "advanced", label: "上級", count: 212, seconds: 20, icon: "🔥", maxLives: 3 },
    { id: "pro", label: "PRO", count: 216, seconds: 15, icon: "👑", special: true, maxLives: 1 },
  ];
  const QUESTION_COUNTS = [5, 10, 20, 30];
  const PRO_DIFFICULTY_ID = "pro";
  function maxLivesFor(difficultyId) {
    return difficultyById(difficultyId).maxLives;
  }
  // パスは、不正解確認中(再挑戦待ち)かどうかに関わらず、残りライフが2個以上の
  // ときだけ表示・実行できる。ライフ1個でパスを許すとパスだけでライフ0=
  // ゲームオーバーになり得るため、ライフ1個は「もう一度さがす」でのみ
  // 粘れるようにする(PROはライフ1固定・パス不可の既存仕様のまま)
  const MIN_LIVES_TO_PASS = 2;
  function isPassAllowed() {
    return quizState.difficultyId !== PRO_DIFFICULTY_ID && quizState.lives >= MIN_LIVES_TO_PASS;
  }
  // 残り時間の警告しきい値(秒)。難易度(15〜30秒)によらず固定の絶対値を使う。
  // 具体的な秒数の確定仕様は見当たらなかったため、既存の国旗/首都クイズの
  // 5秒カウントダウン(warn-3/warn-2/warn-1)と同じ「色・文字の両方で警告する」
  // 考え方だけを踏襲し、このモード向けの妥当な値として独自に決めている
  const TIMER_WARNING_SECONDS = 10;
  const TIMER_CRITICAL_SECONDS = 5;

  // 不正解時の再挑戦(第5段階後半2回目の確定仕様)。通常コース(初級/中級/上級)は
  // ライフが残っている限り同じ問題に再挑戦できる(PROはライフ1のため、この
  // 再挑戦には入らず従来どおり即終了する)。間違えて選んだ国・地域は赤色で
  // 強調し、「もう一度さがす」ボタンを利用者が押すまで表示を保持する
  // (自動的な時間経過での再開は行わない。手動再挑戦方式)

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

  // ---------- 得点計算(確定仕様) ----------
  // 1問の最高得点は1,000点。3.00秒以内に正解で1,000点、3.00秒を超えた分は
  // 1秒につき30点減点(下限0点)。不正解・パス・時間切れは0点。
  // 時間ボーナス・連続正解倍率・難易度倍率は付けない(確定仕様外のため)。
  // elapsedSecondsは呼び出し元(finalizeAnswer)がタイマーの残り時間から
  // 0.01秒単位で算出して渡す(一時停止中・地球儀読み込み待ち中の時間は
  // タイマー自体が計測しないため、ここでも含まれない)
  function round2(value) {
    return Math.round(value * 100) / 100;
  }

  function computeScore(context) {
    // context: { result, elapsedSeconds }
    if (context.result !== "correct") return 0;
    const overSeconds = Math.max(0, context.elapsedSeconds - 3);
    return Math.max(0, Math.round(1000 - overSeconds * 30));
  }

  // ---------- PRO完全制覇の判定(純粋関数として分離し、結果画面の表示
  // ロジックとテストの両方から同じ条件式を参照できるようにする) ----------
  // PROはパス不可・1ミスで即ゲームオーバーの確定仕様のため、「ゲームオーバー
  // にならず、予定していた全問(totalCount)に回答し、その全問が正解」は
  // 「1問も間違えずに全問走りきった」ことと同値になる
  function isProCompleteRun(context) {
    // context: { difficultyId, gameOver, answered, correctCount, totalCount }
    return (
      context.difficultyId === PRO_DIFFICULTY_ID &&
      !context.gameOver &&
      context.answered === context.totalCount &&
      context.correctCount === context.totalCount
    );
  }

  // ---------- 通常コース(初級/中級/上級)のクリア判定(第6段階確定仕様) ----------
  // 「クリア」は正解率ではなく、ライフを残して出題予定数の最後まで到達した
  // かどうかで判定する(不正解・パスがあってもよい。全問正解は条件にしない)。
  // showResult()はこの問題が最終問題になった時点でしか呼ばれないため、
  // !gameOverであれば自動的に「ライフを1個以上残して予定数まで到達した」
  // ことと同値になる(answered===totalCountは一応の確認として残す)。
  // 途中でゲームをやめた場合は常にshowResult()自体が呼ばれないため、ここでは
  // 判定しない(backToCourseSelect経由であり、この関数に到達しない)。
  // PRO解放条件(12コースクリア)の判定にもこの関数をそのまま使い、結果画面の
  // 表示文言から判定を逆算する形にはしない
  function isNormalCourseClear(context) {
    // context: { difficultyId, gameOver, answered, totalCount }
    return (
      context.difficultyId !== PRO_DIFFICULTY_ID &&
      !context.gameOver &&
      context.answered === context.totalCount
    );
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
    answered: false, // 今の問題について既に回答確定済み(タップ・パス・時間切れ、または
    // 「もう一度さがす」ボタンを待っている間)で、追加のタップ・パスを受け付けない状態かどうか
    hasMistakeThisQuestion: false, // この問題で一度でも不正解タップがあったか(再挑戦後に
    // 正解しても連続正解には加算しない判定・既にリセット済みの連続正解の多重リセット防止に使う)
    canAdvance: false, // この問題の最終結果が確定し、「次の問題へ」/「結果を見る」ボタンで
    // 進んでよい状態かどうか(answeredは「もう一度さがす」を待っている間もtrueになるため別管理する)
    results: [], // {questionNumber, countryId, answeredId, result, elapsedSeconds, secondsLeft, points, livesAfter, streakAfter}
    lives: maxLivesFor(DIFFICULTIES[0].id), // 実際の値はstartQuiz()で必ず上書きされる仮の初期値
    currentStreak: 0,
    maxStreak: 0,
    gameOver: false, // ライフ0で終了したか(結果画面の表示分岐・最終問題判定に使う)
    rankingSubmitted: false, // このプレイの記録を既にランキングへ送信したか(二重保存防止)
    lastRank: null, // 送信した記録がTOP5に入った順位(1〜5)。入らなければnull
  };

  // 現在アクティブな制限時間タイマー(問題ごとに作り直す。1問につき1個だけ
  // 存在し、次の問題・画面離脱の際に必ずstop()してから作り直す/破棄する)
  let timer = null;
  // renderQuestion()を呼ぶたびに増やす。地球儀(globe.gl、1.9MB)の初回読み込み中に
  // タイマー開始を遅延させている間に、利用者が次の問題へ進んだり画面を離れたり
  // した場合、古い遅延開始コールバックが誤って新しいタイマーを起動しないようにする
  let renderToken = 0;

  // 不正解で選んだ国・地域を赤色で確認し、「もう一度さがす」ボタンを待っている間か
  // どうか。利用者がボタンを押すまで(自動的な時間経過では)解除しない。
  // 一時停止オーバーレイとは別の「一時停止したい理由」として扱い、どちらか片方でも
  // 真であればタイマーは止めたままにする(applyTimerPauseState参照)
  let retryFeedbackActive = false;

  // 一時停止オーバーレイの表示中・再挑戦待ちのどちらかであればタイマーを
  // 一時停止し、両方とも解消していれば再開する。呼び出し元がどちらの状態を
  // 変更した場合も、このまとめた判定だけを呼べば整合性が保てる
  function applyTimerPauseState() {
    if (!timer) return;
    const overlayOpen = !$("findcountry-pause-overlay").classList.contains("hidden");
    if (overlayOpen || retryFeedbackActive) {
      timer.pause();
    } else {
      timer.resume();
    }
  }

  // 問題の切り替え・クイズからの離脱時に、前の問題の再挑戦待ち状態
  // (赤色ハイライト・「もう一度さがす」ボタン)を確実に解消する。この関数自体は
  // タイマーの一時停止状態を変更しない(renderQuestion/leaveFindCountryMapMode側で
  // 別途タイマー自体を止める・作り直すため、ここではUI状態の後始末だけを行う)
  function cancelRetryFeedback() {
    retryFeedbackActive = false;
    $("findcountry-quiz-retry").classList.add("hidden");
    $("findcountry-quiz-retry").disabled = false;
  }

  // ---------- 難易度選択画面 ----------
  // PRO解放に必要な12コース(初級/中級/上級×5/10/20/30問)のクリア状況を
  // 毎回localStorageから読み直す(この画面が表示されるたびに最新の状態を
  // 反映するため、キャッシュしない)
  function renderDifficultyScreen() {
    const grid = $("findcountry-difficulty-options");
    grid.innerHTML = "";
    const proStatus = Storage.getFindCountryProUnlockProgress(); // {clearedCount, total, unlocked}
    DIFFICULTIES.forEach((d) => {
      const card = document.createElement("button");
      card.type = "button";
      const isPro = d.id === PRO_DIFFICULTY_ID;
      const locked = isPro && !proStatus.unlocked;
      card.className = "count-card difficulty-card" + (d.special ? " special" : "") + (locked ? " locked" : "");
      // 第6段階確定仕様: 初級/中級/上級/PROを同じ基本サイズの2列×2行にし、
      // カードごとに「国・地域数」「制限時間」「ライフ(♡)」を独立した3行で
      // 表示する(PROが未解放の場合は♡の行の代わりに進捗を表示する)
      const headIcon = locked ? "🔒" : d.icon;
      // 第6段階追加修正: ♡の行は未解放・解放済みに関わらず必ず表示し、
      // 未解放の場合はその下に小さくクリア進捗を追加する(♡の行自体は置き換えない)
      const livesLine = `<div class="difficulty-card-line difficulty-card-lives">♡ ${d.maxLives}</div>`;
      const progressLine = locked
        ? `<div class="difficulty-card-line difficulty-card-progress">クリア済み ${proStatus.clearedCount} / ${proStatus.total}コース</div>`
        : "";
      card.innerHTML =
        `<div class="difficulty-card-head">${headIcon} ${d.label}</div>` +
        `<div class="difficulty-card-line">${d.count}の国と地域</div>` +
        `<div class="difficulty-card-line">制限時間${d.seconds}秒</div>` +
        livesLine +
        progressLine;
      card.addEventListener("click", () => {
        if (locked) {
          // 画面上の無効化だけでなく分かりやすい案内も出す(タップ自体は
          // 妨げないが、この中でstartQuiz()を呼ばないため開始はしない)
          alert(`🔒 PROは12コースすべてをクリアすると解放されます(クリア済み ${proStatus.clearedCount} / ${proStatus.total}コース)`);
          return;
        }
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
    // 画面上の無効化(renderDifficultyScreenのロック表示)だけでなく、
    // この開始処理そのものでも未解放のPROを拒否する(内部関数の直接呼び出しや
    // 画面遷移の抜け道からPROが始まらないようにするための第6段階確定仕様)
    if (difficultyId === PRO_DIFFICULTY_ID && !Storage.isFindCountryProUnlocked()) {
      console.warn("世界の国どこかな？: PROは未解放のため開始できません");
      return;
    }
    quizState.difficultyId = difficultyId;
    quizState.sequence = buildQuestionSequence(difficultyId, questionCount);
    quizState.currentIndex = 0;
    quizState.results = [];
    quizState.answered = false;
    quizState.lives = maxLivesFor(difficultyId);
    quizState.currentStreak = 0;
    quizState.maxStreak = 0;
    quizState.gameOver = false;
    quizState.rankingSubmitted = false;
    quizState.lastRank = null;

    showScreen("screen-map");
    enterFindCountryMapMode();
    hidePauseOverlay();

    // 新しいゲームの第1問だけ、地球儀の向き・ズームを日本中心の標準視点に
    // 戻す(MapModule.resetInitialViewToCountry、第5段階後半4回目の確定仕様)。
    // 第2問以降(renderQuestion単独での呼び出し)・再挑戦・パス後・一時停止
    // 再開では呼ばないため、既存のカメラの向き・ズームはそのまま維持される。
    // 地球儀がこのセッションでまだ構築されていない場合は、MapModule側で
    // 構築完了後に反映されるよう予約だけされる(戻り値はfalseだが問題ない)
    MapModule.resetInitialViewToCountry("jp");

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
    // 追加修正の確定仕様: 対象の小国・地域のピンを常時ONにする。通常の
    // 世界地図モードのピン設定(localStorageの好み)は一切変更しない
    // (leaveFindCountryMapModeで必ずfalseに戻す、このモードだけの一時状態)
    MapModule.setPinsForcedVisible(true);
    // 既存の世界地図モードと全く同じ初期化・再開ロジック(ensureReady/
    // resumeAnimation等)を呼ぶだけで、別の地球儀は一切作らない
    MapModule.open();
  }

  // 既存の世界地図モードへ戻った際、通常の地図操作が完全に復元されるよう、
  // クイズ専用のタップハンドラー・強調表示・選択状態を必ず元に戻す。
  // タイマーも画面離脱時に必ず止める(バックグラウンドで動き続けない)
  function leaveFindCountryMapMode() {
    cancelRetryFeedback();
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
    // 通常の世界地図モードへ戻る前に、ピンの強制表示を必ず解除する
    // (このモードだけの一時状態。通常モードのpinsVisible設定はそのまま)
    MapModule.setPinsForcedVisible(false);
    MapModule.close();
    $("screen-map").classList.remove("findcountry-mode");
    setFindCountryChromeVisible(false);
  }

  // ---------- ライフ表示の更新 ----------
  function updateLivesDisplay() {
    const maxLives = maxLivesFor(quizState.difficultyId);
    const filled = "❤️".repeat(Math.max(0, quizState.lives));
    const empty = "🤍".repeat(Math.max(0, maxLives - quizState.lives));
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
    quizState.hasMistakeThisQuestion = false;
    // 「次の問題へ」/「結果を見る」ボタンは実際には.hiddenで隠れているため
    // 通常のタップでは押せないが、念のための防御としてhandleNextClick側でも
    // 判定する。answeredは「もう一度さがす」を待っている間もtrueになるため、
    // 「この問題の最終結果が確定したか」はこのフラグで別途管理する
    // (showFeedbackでtrueにする)
    quizState.canAdvance = false;
    cancelRetryFeedback();

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
    $("findcountry-quiz-new-badge").classList.add("hidden");

    // パスは残りライフが2個以上のときだけ表示する(PROは既存どおり常に非表示)
    $("findcountry-quiz-pass").classList.toggle("hidden", !isPassAllowed());
    $("findcountry-quiz-pass").disabled = false;
    $("findcountry-quiz-wrong-actions").classList.remove("paired");
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
    applyTimerPauseState();
  }

  // ---------- 回答確定(タップ・パス・時間切れを1つの処理に集約) ----------
  // ライフ減少・連続正解の更新・得点計算・結果記録を、この関数の中だけで
  // 行うことで「同じ問題で2回以上ライフが減る/加点される」事故を防ぐ。
  // 呼び出し元(handleTap/handleWrongTap/handlePass/handleTimeUp)は、
  // quizState.answeredのガードとタイマー停止だけを担当し、ここでは二重には
  // 呼ばれない前提で動く。この関数へ到達するのは「その問題の最終結果」
  // (正解・パス・時間切れ・ライフが尽きたことによる不正解)の時だけで、
  // ライフが残っている不正解(再挑戦)はhandleWrongTap側で完結し、ここには
  // 来ない(quizState.resultsに積まれず、ランキングの回答数を水増ししない)
  // secondsLeft: 回答確定時点の残り秒数。呼び出し元がtimer.stop()を呼ぶ
  // "前"のtimer.remainingSeconds()の値を渡す(FindCountryTimer.stop()後は
  // remainingSeconds()が常に0を返す設計のため、ここで読み直すと正解・
  // 不正解・パス時の残り時間が常に0として記録されてしまう)。時間切れは
  // 呼び出し元から明示的に0を渡す
  // opts.livesAlreadyHandled: 再挑戦の末にライフが尽きた不正解(result==="wrong")で
  // true。この場合はhandleWrongTap側で既にライフを1減らしているため、ここでは
  // 二重に減らさない
  function finalizeAnswer(result, answeredId, secondsLeft, opts) {
    opts = opts || {};
    const d = difficultyById(quizState.difficultyId);
    // コレクションへの獲得登録は正解時のみ、この回答確定処理の中で一度だけ
    // 行う(二重タップはhandleTap/handlePass側のquizState.answeredガードで
    // そもそもfinalizeAnswerに到達しないため、ここで多重に呼ばれる心配はない)。
    // ランキングの記録(Storage.submitFindCountryRecord、結果画面でまとめて
    // 送信)とは異なり、こちらは問題ごとに独立して完結させる。既に獲得済みの
    // 国・地域はStorage.captureFindCountryEntry()がfalseを返すだけで何も
    // 起きない(重複登録防止)。保存に失敗してもクイズの進行自体は止めない
    let isNewCapture = false;
    if (result === "correct") {
      // 再挑戦の末に正解した問題(hasMistakeThisQuestion)は、一発正解として
      // 連続正解に加算しない(連続正解自体は最初の不正解タップの時点で
      // 既に0へリセット済みのため、ここでは単に加算しないだけでよい)
      if (!quizState.hasMistakeThisQuestion) {
        quizState.currentStreak += 1;
        if (quizState.currentStreak > quizState.maxStreak) {
          quizState.maxStreak = quizState.currentStreak;
        }
      }
      try {
        isNewCapture = Storage.captureFindCountryEntry(quizState.currentCountry.id, new Date().toISOString());
      } catch (e) {
        console.warn("世界の国どこかな？: コレクションの記録に失敗しました", e);
        isNewCapture = false;
      }
    } else {
      // 不正解・パス・時間切れは、その後に正解位置を確認しても
      // 連続正解としては扱わない(回答確定の時点で即座に0にする)
      quizState.currentStreak = 0;
      if (!opts.livesAlreadyHandled) {
        quizState.lives = Math.max(0, quizState.lives - 1);
      }
    }

    // 回答時間(0.01秒単位)。timer.remainingSeconds()は一時停止中の時間・
    // 地球儀読み込み待ち中の時間(タイマー自体が開始していない)を含まない
    // ため、ここでの引き算もそれらを自動的に除外した値になる。時間切れは
    // secondsLeftとして0を渡されるため、その問題の制限時間がそのまま
    // 回答時間として記録される
    const elapsedSeconds = round2(Math.min(d.seconds, Math.max(0, d.seconds - secondsLeft)));
    const points = computeScore({ result, elapsedSeconds });

    quizState.results.push({
      questionNumber: quizState.currentIndex + 1,
      countryId: quizState.currentCountry.id,
      answeredId: answeredId || null,
      result, // "correct" | "wrong" | "pass" | "timeout"
      elapsedSeconds, // 回答時間(0.01秒単位)
      secondsLeft: round2(Math.max(0, secondsLeft)), // 回答確定時の残り時間(0.01秒単位)
      points, // 得点(不正解・パス・時間切れは常に0)
      livesAfter: quizState.lives,
      streakAfter: quizState.currentStreak,
    });

    if (quizState.lives <= 0) {
      quizState.gameOver = true;
    }

    updateLivesDisplay();
    showFeedback(result, answeredId, isNewCapture);
  }

  // ---------- 正誤判定の表示(kind: "correct" | "wrong" | "pass" | "timeout") ----------
  function showFeedback(kind, tappedId, isNewCapture) {
    quizState.canAdvance = true; // この問題の最終結果が確定した(次へ進めてよい)
    const correctId = quizState.currentCountry.id;
    const correctName = quizState.currentCountry.name;

    const resultText = $("findcountry-quiz-result-text");
    resultText.classList.remove("hidden", "is-correct", "is-wrong");

    if (kind === "correct") {
      resultText.classList.add("is-correct");
      resultText.textContent = `✅ 正解！ ここが「${correctName}」です`;
    } else if (kind === "wrong") {
      // この分岐はライフが尽きてゲームオーバーになった最後の不正解タップの時だけ
      // 通る(ライフが残っている不正解はhandleWrongTap側で再挑戦させ、ここには
      // 来ない)。正解の国名は表示しないが、「従来どおり」地球儀上の位置は
      // 下のMapModule呼び出しで確認できるようにする(このelse ifブロックの外、
      // 既存のselectCountryForQuiz/setQuizResultHighlight呼び出しは変更しない)
      resultText.classList.add("is-wrong");
      resultText.textContent = "❌ ざんねん、まちがえだよ";
    } else if (kind === "timeout") {
      resultText.classList.add("is-wrong");
      resultText.textContent = `⏰ 時間切れ……正解は「${correctName}」でした`;
    } else {
      // 国名を含めない統一文言(第6段階確定仕様)。通常のパス・不正解確認中
      // からのパスのどちらもこの分岐を通るため、修正箇所はここ1箇所だけでよい
      resultText.classList.add("is-wrong");
      resultText.textContent = "⏭ パスしました。正解はこちら！";
    }

    // コレクション初獲得のお知らせ。正解表示の邪魔にならないよう、
    // 既存の文字列に埋め込まず独立した小さなバッジとして表示するだけに
    // とどめ、派手な演出やアニメーションは付けない(連続正解のテンポを
    // 損なわないため)
    const newBadge = $("findcountry-quiz-new-badge");
    if (kind === "correct" && isNewCapture) {
      newBadge.classList.remove("hidden");
    } else {
      newBadge.classList.add("hidden");
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
    $("findcountry-quiz-retry").classList.add("hidden"); // 念のための後始末(通常は既にhandleRetryClickで隠れている)
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
  // 1問につき回答は1回だけ受け付け、回答確定後(answered===true、「もう一度
  // さがす」を待っている間も含む)の追加タップは無視して結果を変化させない
  function handleTap(tappedId) {
    if (quizState.answered) return;
    const correctId = quizState.currentCountry.id;
    if (tappedId === correctId) {
      quizState.answered = true;
      // timer.stop()を呼ぶと以降remainingSeconds()は常に0を返すため、
      // 停止"前"に残り秒数を読み取ってから止める
      const secondsLeft = timer ? timer.remainingSeconds() : 0;
      if (timer) timer.stop();
      finalizeAnswer("correct", tappedId, secondsLeft);
      return;
    }
    handleWrongTap(tappedId);
  }

  // ---------- 不正解タップの処理(第5段階後半2回目: 不正解時の再挑戦) ----------
  // 通常コース(初級/中級/上級、maxLivesFor参照)は、ライフが残っている限り同じ問題に
  // 再挑戦できる。ライフは不正解のたびに必ず1減らし、連続正解もその時点で
  // 即座に0へリセットする(再挑戦後に正解しても一発正解としては加算しない)。
  // PROはライフ1のため、この関数の最初の不正解で必ずlives<=0側の分岐へ入り、
  // 従来どおりパス不可・1ミス即ゲームオーバーの仕様を変更しない
  function handleWrongTap(tappedId) {
    quizState.hasMistakeThisQuestion = true;
    quizState.currentStreak = 0;
    quizState.lives = Math.max(0, quizState.lives - 1);
    updateLivesDisplay();

    if (quizState.lives <= 0) {
      // ライフが尽きたら、この問題を最終結果として確定する(ゲームオーバー)。
      // ライフは既にここで減らし済みのため、finalizeAnswer側では二重に
      // 減らさないようlivesAlreadyHandledを伝える。従来どおり正解位置を
      // 確認できるようにしてから結果画面へ進める(showFeedback参照)
      quizState.answered = true;
      const secondsLeft = timer ? timer.remainingSeconds() : 0;
      if (timer) timer.stop();
      finalizeAnswer("wrong", tappedId, secondsLeft, { livesAlreadyHandled: true });
      return;
    }

    showWrongRetryFeedback(tappedId);
  }

  // 不正解だがライフが残っている間の表示。正解の国名・正解のハイライト・
  // 自動ズーム・自動カメラ移動は一切行わない(再挑戦の答えを教えてしまわない
  // ようにするため)。間違えて選んだ国・地域だけを赤色で強調し、利用者が
  // 「もう一度さがす」ボタンを押すまでその状態を保持する(自動的な時間経過
  // では解除しない、手動再挑戦方式)。表示中はタップ・パスを受け付けず、
  // 制限時間タイマーも一時停止して不公平な時間消費を防ぐ
  function showWrongRetryFeedback(tappedId) {
    quizState.answered = true;
    retryFeedbackActive = true;
    applyTimerPauseState();

    const resultText = $("findcountry-quiz-result-text");
    resultText.classList.remove("hidden", "is-correct");
    resultText.classList.add("is-wrong");
    resultText.textContent = "❌ ざんねん、まちがえだよ";
    $("findcountry-quiz-new-badge").classList.add("hidden");
    $("findcountry-quiz-hint").classList.add("hidden");
    // 残りライフが2個以上なら「もう一度さがす」と並べてパスも表示する
    // (どちらを押すまでも同じ不正解確認状態を保持する)。ライフ1個なら
    // パスはライフ0=ゲームオーバーにつながり得るため表示しない
    const showPassToo = isPassAllowed();
    $("findcountry-quiz-pass").classList.toggle("hidden", !showPassToo);
    $("findcountry-quiz-wrong-actions").classList.toggle("paired", showPassToo);

    // 間違えて選んだ国・地域だけを赤色で強調する。既存のMapModule.
    // setQuizResultHighlightをそのまま再利用し、correctIdにはnullを渡すことで
    // 正解側の緑ハイライトは一切出さない。selectCountryForQuiz(自動ズーム・
    // カメラ移動・📍強制表示)は呼ばない。タップできた時点でその国はすでに
    // 画面内に表示されているため、既存のカメラ位置を不必要に変更しない
    MapModule.setQuizResultHighlight(null, tappedId);

    const retryBtn = $("findcountry-quiz-retry");
    retryBtn.classList.remove("hidden");
    retryBtn.disabled = false;

    if (DEBUG_MODE) {
      $("findcountry-quiz-dev-tap").textContent = `(開発用) タップ結果: ${tappedId}(再挑戦待ち)`;
    }
  }

  // 「もう一度さがす」ボタン。赤色ハイライトを解除し、同じ問題に再びタップ
  // できる状態に戻す。retryFeedbackActiveをこの関数の最初で即座にfalseに
  // するため、連打しても2回目以降は何もしない(二重処理防止)
  function handleRetryClick() {
    // 1. 再挑戦待ち状態かどうかを確認する(連打による二重処理防止)。この時点では
    // まだretryFeedbackActiveをfalseにしない。2〜5が1つでも失敗した場合に
    // 再挑戦待ち状態をtrueのまま保持し、利用者が再度このボタンを押して
    // やり直せるようにするため(falseにするのは、全て成功した後の最後だけ)
    if (!retryFeedbackActive) return;

    try {
      // 2. 赤色ハイライトを解除する
      MapModule.clearQuizResultHighlight();

      // 3. 不正解メッセージを消す
      const resultText = $("findcountry-quiz-result-text");
      resultText.classList.add("hidden");
      resultText.classList.remove("is-wrong");
      resultText.textContent = "";

      // 4. 「もう一度さがす」ボタンを隠し、パスボタン・ヒントなどを元に戻す
      // (パスの表示は常にisPassAllowed()基準。再挑戦自体はライフを変えないため、
      // 値自体は不正解確認中に表示していたものと変わらない)
      $("findcountry-quiz-hint").classList.remove("hidden");
      $("findcountry-quiz-wrong-actions").classList.remove("paired");
      $("findcountry-quiz-pass").classList.toggle("hidden", !isPassAllowed());
      $("findcountry-quiz-retry").classList.add("hidden");

      // 5. 同じ問題のタップ回答を再び受け付ける
      quizState.answered = false;

      // 2〜5が全て成功した場合だけ、再挑戦待ち状態を解除し、
      // 6. 残り時間からタイマーを再開する(既存の一時停止オーバーレイが
      // 表示されている場合はapplyTimerPauseState内の判定でタイマーを再開しない)
      retryFeedbackActive = false;
      applyTimerPauseState();
    } catch (e) {
      // 2〜5のいずれかで例外が発生した場合、retryFeedbackActiveをtrueのまま
      // (タイマーも一時停止したまま)にして再挑戦待ち状態を保持する。
      // ここでapplyTimerPauseStateを呼ばない(=呼ばなければタイマーは
      // 一時停止したまま変化しない)ため、「正常に再挑戦準備が完了した場合だけ
      // タイマーを再開する」が保証される。利用者は再度「もう一度さがす」を
      // 押せば、quizState.answeredがまだtrueのため誤って地球儀をタップしても
      // 回答にはならず、安全にやり直せる
      console.warn("世界の国どこかな？: 再挑戦の準備中にエラーが発生しました", e);
    }
  }

  // ---------- パスボタン(通常コースのみ。PROでは表示されず、呼び出しても無効) ----------
  // パス確定の共通処理(通常のパス・不正解確認中のパスの両方から呼ぶ)。
  // timer.remainingSeconds()は停止"前"に読む必要があるため(timer.stop()後は
  // 常に0を返す)、呼び出し元のどちらの経路でも同じ順序(読み取り→停止→確定)
  // で呼べるようにこの関数にまとめる
  function finalizeCurrentAsPass() {
    const secondsLeft = timer ? timer.remainingSeconds() : 0;
    if (timer) timer.stop();
    finalizeAnswer("pass", null, secondsLeft);
  }

  function handlePass() {
    // 見た目(.hidden)だけでなく、処理側でも残りライフ1個以下でのパスを拒否する
    // (PROは常にisPassAllowed()がfalseになるため、既存どおりパス不可のまま)
    if (!isPassAllowed()) return;

    if (retryFeedbackActive) {
      // 不正解確認中のパス。不正解タップで既に1個減ったライフから、
      // パスによってさらに1個減らす(finalizeAnswer側の既存のpass分岐が
      // 行う)。再挑戦待ち状態はここで終了し、タイマーは再開せずfinalizeCurrentAsPass
      // 内でそのまま停止させる。quizState.answeredは元からtrueのままなので
      // (showWrongRetryFeedbackで設定済み、ここでは変更しない)、連打しても
      // retryFeedbackActiveが既にfalseになっていればここには二度と入らず、
      // 下のif (quizState.answered) returnで弾かれる(二重処理防止)
      retryFeedbackActive = false;
      finalizeCurrentAsPass();
      return;
    }

    if (quizState.answered) return;
    quizState.answered = true;
    finalizeCurrentAsPass();
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
    // 回答確定前・「もう一度さがす」を待っている間はこのボタンは実際には隠れているが、
    // 念のための防御として明示的にcanAdvanceを確認する(answeredだけでは
    // 再挑戦中かどうかを区別できないため)
    if (!quizState.canAdvance) return;
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
    applyTimerPauseState();
  }
  function hidePauseOverlay() {
    $("findcountry-pause-overlay").classList.add("hidden");
    // 再挑戦メッセージの表示中に一時停止を解除した場合、applyTimerPauseStateが
    // retryFeedbackActiveを見てタイマーを一時停止したままにする(再挑戦メッセージ
    // 自体の表示終了はhideWrongRetryFeedback()が別途行う)
    applyTimerPauseState();
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
      // 念のためPRO解放状態を最新に再描画してから表示する
      renderDifficultyScreen();
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
    const maxLives = maxLivesFor(quizState.difficultyId);
    const planned = quizState.sequence.length; // 予定していた問題数
    const answered = quizState.results.length; // 実際に回答(タップ・パス・時間切れ含む)した数
    const correctCount = quizState.results.filter((r) => r.result === "correct").length;
    const rate = answered > 0 ? Math.round((correctCount / answered) * 100) : 0;
    const totalPoints = quizState.results.reduce((sum, r) => sum + r.points, 0);
    // 平均回答時間は実際に回答した問題のみを対象にする(不正解・パス・
    // 時間切れも含める。ゲームオーバーで打ち切られた未出題分は、そもそも
    // quizState.resultsに積まれないため分母に含まれない)
    const avgElapsed = answered > 0
      ? quizState.results.reduce((sum, r) => sum + r.elapsedSeconds, 0) / answered
      : 0;
    const isProComplete = isProCompleteRun({
      difficultyId: quizState.difficultyId,
      gameOver: quizState.gameOver,
      answered,
      correctCount,
      totalCount: d.count,
    });
    const isNormalClear = isNormalCourseClear({
      difficultyId: quizState.difficultyId,
      gameOver: quizState.gameOver,
      answered,
      totalCount: planned,
    });

    $("findcountry-result-title").textContent = quizState.gameOver
      ? "ゲームオーバー"
      : isProComplete
        ? "完全制覇！"
        : "結果発表";

    const gameoverNote = $("findcountry-result-gameover-note");
    if (quizState.gameOver) {
      // ライフは不正解だけでなくパス・時間切れでも減るため、難易度別の
      // 最大ライフ数を使った「○回間違えたため」という表現は実際のプレイ
      // 内容と一致しない場合がある。難易度に関わらず同じ文言に統一する
      gameoverNote.textContent = "❤️ ライフがなくなったため、ゲームオーバー！";
      gameoverNote.classList.remove("hidden");
    } else {
      gameoverNote.classList.add("hidden");
      gameoverNote.textContent = "";
    }

    const completeNote = $("findcountry-result-complete-note");
    if (isProComplete) {
      completeNote.textContent = `🎉 PRO ${d.count}問すべてに正解しました！`;
      completeNote.classList.remove("hidden");
    } else {
      completeNote.classList.add("hidden");
      completeNote.textContent = "";
    }

    // 第6段階確定仕様: 通常コース(初級/中級/上級)をクリアした場合、正解数より
    // コースクリアを中心に表示する(全問正解は条件にしない。不正解・パスが
    // あってもライフを残して最後まで到達していればクリア)
    const clearNote = $("findcountry-result-clear-note");
    if (isNormalClear) {
      clearNote.textContent = `🎉 ${planned}問コースクリア！`;
      clearNote.classList.remove("hidden");
    } else {
      clearNote.classList.add("hidden");
      clearNote.textContent = "";
    }

    $("findcountry-result-course").textContent = `${d.icon} ${d.label}`;
    $("findcountry-result-planned").textContent = `予定問題数：${planned}問`;
    $("findcountry-result-answered").textContent = `実際の回答数：${answered}問`;
    $("findcountry-result-score-fraction").textContent = `${answered}問中${correctCount}問正解！`;
    $("findcountry-result-rate").textContent = `正答率 ${rate}%`;
    $("findcountry-result-points").textContent = `合計得点 ${totalPoints}点`;
    $("findcountry-result-avg-time").textContent = `平均回答時間 ${avgElapsed.toFixed(2)}秒`;
    $("findcountry-result-streak").textContent = `最大連続正解 ${quizState.maxStreak}`;
    $("findcountry-result-lives").textContent =
      `残りライフ ${"❤️".repeat(Math.max(0, quizState.lives))}${"🤍".repeat(Math.max(0, maxLives - quizState.lives))}`;

    // ランキングへの記録・12コースのクリア記録(第6段階)は1プレイにつき1回
    // だけ行う。この画面に複数回遷移しても(例: 「結果を見る」ボタンの連打)、
    // 2回目以降は送信済みのrankingSubmittedで弾き、直前に得た順位(lastRank)
    // をそのまま使い回す。保存処理自体はStorage側でも例外を捕捉しているが、
    // 念のためここでも囲み、記録に失敗してもゲームの進行自体は止めない
    let proUnlockJustHappened = false;
    if (!quizState.rankingSubmitted) {
      quizState.rankingSubmitted = true;
      try {
        quizState.lastRank = Storage.submitFindCountryRecord({
          difficultyId: quizState.difficultyId,
          questionCount: quizState.difficultyId === PRO_DIFFICULTY_ID ? null : planned,
          score: totalPoints,
          correctCount,
          answeredCount: answered,
          avgElapsedSeconds: round2(avgElapsed),
          maxStreak: quizState.maxStreak,
          playedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.warn("世界の国どこかな？: ランキング記録の保存に失敗しました", e);
        quizState.lastRank = null;
      }

      // 通常コースをクリアした場合だけ、PRO解放対象の12コースの記録として
      // 登録する(ランキングの順位・得点とは完全に独立した保存データ)
      if (isNormalClear) {
        try {
          const courseKey = Storage.findCountryCourseKey(quizState.difficultyId, planned);
          proUnlockJustHappened = Storage.markFindCountryCourseCleared(courseKey).justUnlockedPro;
        } catch (e) {
          console.warn("世界の国どこかな？: コースクリア記録の保存に失敗しました", e);
        }
      }
    }

    const rankBadge = $("findcountry-result-rank-badge");
    if (quizState.lastRank) {
      rankBadge.textContent = `🏆 このコースで第${quizState.lastRank}位にランクインしました！`;
      rankBadge.classList.remove("hidden");
    } else {
      rankBadge.classList.add("hidden");
      rankBadge.textContent = "";
    }

    // 12コース目をクリアした直後(この呼び出しで初めて解放された場合)だけ、
    // PRO解放のお知らせを表示する。justUnlockedProは解放が初めて成立した
    // その1回だけtrueになるため、再表示されることはない
    const proUnlockNote = $("findcountry-result-pro-unlock-note");
    if (proUnlockJustHappened) {
      proUnlockNote.textContent = "🎊 12コースクリア！ PROモードが解放されました！";
      proUnlockNote.classList.remove("hidden");
    } else {
      proUnlockNote.classList.add("hidden");
      proUnlockNote.textContent = "";
    }

    showScreen("screen-findcountry-result");
  }

  // ---------- ランキング画面(第5段階前半) ----------
  // 画面遷移をまたいで保持する「いまランキング画面で見ているコース」。
  // 初期値は初級・5問。難易度選択画面からの入口ではこの値(または前回見た
  // コース)をそのまま使い、結果画面からの入口では直前にプレイしたコースに
  // 上書きしてから開く
  const rankingSelection = { difficultyId: "beginner", questionCount: QUESTION_COUNTS[0] };

  function openRankingScreen(difficultyId, questionCount) {
    if (difficultyId) {
      rankingSelection.difficultyId = difficultyId;
      rankingSelection.questionCount = difficultyId === PRO_DIFFICULTY_ID ? null : questionCount;
    }
    renderRankingScreen();
    showScreen("screen-findcountry-ranking");
  }

  function renderRankingScreen() {
    renderRankingDifficultyTabs();
    renderRankingCountTabs();
    renderRankingList();
  }

  function renderRankingDifficultyTabs() {
    const wrap = $("findcountry-ranking-difficulty-tabs");
    wrap.innerHTML = "";
    DIFFICULTIES.forEach((d) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "findcountry-ranking-tab" + (d.id === rankingSelection.difficultyId ? " active" : "");
      btn.textContent = `${d.icon} ${d.label}`;
      btn.addEventListener("click", () => {
        rankingSelection.difficultyId = d.id;
        if (d.id === PRO_DIFFICULTY_ID) {
          rankingSelection.questionCount = null;
        } else if (!rankingSelection.questionCount) {
          rankingSelection.questionCount = QUESTION_COUNTS[0];
        }
        renderRankingScreen();
      });
      wrap.appendChild(btn);
    });
  }

  function renderRankingCountTabs() {
    const wrap = $("findcountry-ranking-count-tabs");
    wrap.innerHTML = "";
    if (rankingSelection.difficultyId === PRO_DIFFICULTY_ID) {
      wrap.classList.add("hidden");
      return;
    }
    wrap.classList.remove("hidden");
    QUESTION_COUNTS.forEach((count) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "findcountry-ranking-tab" + (count === rankingSelection.questionCount ? " active" : "");
      btn.textContent = `${count}問`;
      btn.addEventListener("click", () => {
        rankingSelection.questionCount = count;
        renderRankingScreen();
      });
      wrap.appendChild(btn);
    });
  }

  function formatRankingDate(isoString) {
    const dt = new Date(isoString);
    if (Number.isNaN(dt.getTime())) return "—";
    const pad = (n) => String(n).padStart(2, "0");
    return `${dt.getFullYear()}/${pad(dt.getMonth() + 1)}/${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  }

  function renderRankingList() {
    const d = difficultyById(rankingSelection.difficultyId);
    const courseKey = Storage.findCountryCourseKey(rankingSelection.difficultyId, rankingSelection.questionCount);
    $("findcountry-ranking-course-label").textContent = rankingSelection.difficultyId === PRO_DIFFICULTY_ID
      ? `${d.icon} ${d.label}(${d.count}問固定)`
      : `${d.icon} ${d.label}・${rankingSelection.questionCount}問`;

    // 破損データ等でStorage側の読み取り自体が想定外に失敗しても、
    // ランキング画面が真っ白/エラーになることなく「記録なし」として表示する
    let records = [];
    try {
      records = Storage.getFindCountryRanking(courseKey);
    } catch (e) {
      records = [];
    }

    const list = $("findcountry-ranking-list");
    list.innerHTML = "";
    for (let i = 0; i < FINDCOUNTRY_RANKING_TOP_N; i++) {
      const record = records[i];
      const row = document.createElement("div");
      row.className = "findcountry-rank-row" + (i === 0 ? " rank-1" : "") + (record ? "" : " empty");
      if (record) {
        row.innerHTML =
          `<span class="findcountry-rank-num">${i + 1}位</span>` +
          `<div class="findcountry-rank-main">` +
          `<span class="findcountry-rank-score">${record.score}点</span>` +
          `<span class="findcountry-rank-meta">正解 ${record.correctCount}/${record.answeredCount}問・平均${record.avgElapsedSeconds.toFixed(2)}秒・最大連続${record.maxStreak}</span>` +
          `<span class="findcountry-rank-date">${formatRankingDate(record.playedAt)}</span>` +
          `</div>`;
      } else {
        row.innerHTML =
          `<span class="findcountry-rank-num">${i + 1}位</span>` +
          `<div class="findcountry-rank-main">` +
          `<span class="findcountry-rank-score">—</span>` +
          `<span class="findcountry-rank-meta">記録がありません</span>` +
          `</div>`;
      }
      list.appendChild(row);
    }
  }

  // ---------- コレクション画面(第5段階後半) ----------
  // 対象は216件固定(COUNTRIES 198 + MAP_ONLY_REGIONS 18)。allMapIdCountries()は
  // 出題プール構築で既に使っている関数をそのまま再利用し、データを複製しない。
  // 一度計算すれば変わらないため、初回アクセス時にキャッシュする
  let collectionAllIdsCache = null;
  function collectionAllIds() {
    if (!collectionAllIdsCache) {
      collectionAllIdsCache = allMapIdCountries().map((c) => c.id);
    }
    return collectionAllIdsCache;
  }

  // 画面遷移をまたいで保持する地域フィルターとスクロール位置。地図・図鑑の
  // 詳細画面を経由して戻ってきても(showCollectionScreen経由)、フィルターと
  // 元のスクロール位置を維持する(第3段階A案の復習リストと同じ考え方)
  let collectionRegionFilter = "all";
  let collectionScrollTop = 0;

  function renderCollectionScreen() {
    // 破損データ等でStorage側の読み取り自体が想定外に失敗しても、
    // コレクション画面が真っ白/エラーになることなく「未獲得」として表示する
    let captured = {};
    try {
      captured = Storage.getFindCountryCollection();
    } catch (e) {
      captured = {};
    }
    const capturedIds = Object.keys(captured);
    const total = collectionAllIds().length;
    const rate = total > 0 ? Math.round((capturedIds.length / total) * 100) : 0;
    $("findcountry-collection-summary").textContent = `獲得数 ${capturedIds.length} / ${total}件・達成率 ${rate}%`;

    renderCollectionRegionTabs();
    renderCollectionGrid(captured);
  }

  function renderCollectionRegionTabs() {
    const wrap = $("findcountry-collection-region-tabs");
    wrap.innerHTML = "";
    // 世界地図・世界図鑑モードと同じregion値・ラベルをそのまま再利用し、
    // 地域分類の体系を独自に定義し直さない
    const order = (typeof MapModule !== "undefined" && MapModule.REGION_ORDER) || ["all"];
    const labels = (typeof MapModule !== "undefined" && MapModule.REGION_LABELS) || { all: "🌍 全世界" };
    order.forEach((region) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "findcountry-ranking-tab" + (region === collectionRegionFilter ? " active" : "");
      btn.textContent = labels[region] || region;
      btn.addEventListener("click", () => {
        collectionRegionFilter = region;
        renderCollectionScreen();
      });
      wrap.appendChild(btn);
    });
  }

  function renderCollectionGrid(captured) {
    // 世界図鑑(js/encyclopedia.js)の既存の地域フィルター・五十音順ロジックを
    // そのまま再利用する(第3段階A案の復習リストと同じ考え方)。新しい
    // 並び替え・絞り込みロジックは実装しない
    const entries = EncyclopediaModule.filterAndSortByIds(collectionAllIds(), { regionFilter: collectionRegionFilter });

    const grid = $("findcountry-collection-grid");
    grid.innerHTML = "";
    const frag = document.createDocumentFragment();
    entries.forEach((entry) => {
      const isCaptured = Object.prototype.hasOwnProperty.call(captured, entry.id);
      if (isCaptured) {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "ency-card findcountry-collection-card captured";
        card.dataset.id = entry.id;
        const alt = entry.isFlagImage === false ? `${entry.name}のアイコン` : `${entry.name}の国旗`;
        card.innerHTML =
          `<img class="ency-card-flag" src="${entry.flag}" alt="${alt}" loading="lazy">` +
          `<span class="ency-card-name">${entry.name}</span>`;
        card.addEventListener("click", () => openCollectionEntryDetail(entry.id));
        frag.appendChild(card);
      } else {
        // 未獲得は「？」のみで表示し、国旗画像自体は読み込まない。
        // どの国・地域が残っているかのネタバレを避け、収集する楽しさを残す
        const card = document.createElement("div");
        card.className = "ency-card findcountry-collection-card locked";
        card.setAttribute("aria-label", "未獲得");
        card.innerHTML =
          `<span class="findcountry-collection-locked-icon" aria-hidden="true">？</span>` +
          `<span class="ency-card-name">？？？</span>`;
        frag.appendChild(card);
      }
    });
    grid.appendChild(frag);

    $("findcountry-collection-empty").classList.toggle("hidden", entries.length > 0);
  }

  // 獲得済みの国・地域をタップした時の処理。既存の世界図鑑の詳細画面を
  // そのidで開く(図鑑対象外の地図専用地域もMAP_ONLY_REGIONSとして図鑑の
  // 「地域」カテゴリーに含まれているため、210件・6件を区別せず同じ経路で
  // 開ける)。戻り先はjs/app.jsの画面遷移スタック(mapEncyclopediaNavStack、
  // 第3段階A案の復習リストと同じ仕組み)に積み、地図を経由して何度
  // 往復してもコレクションへ正しく戻れるようにする
  function openCollectionEntryDetail(id) {
    collectionScrollTop = document.scrollingElement ? document.scrollingElement.scrollTop : 0;
    pushMapEncyclopediaNav({ screen: "findcountry-collection" });
    EncyclopediaModule.openDetailById(id, encyclopediaBackOptionsFromStack());
  }

  // 画面を表示するだけで、地域フィルターは変更しない。地図・図鑑の詳細画面を
  // 経由して戻ってきた場合に使う(js/app.jsのencyclopediaBackOptionsFromStack参照)
  function showCollectionScreen() {
    renderCollectionScreen();
    showScreen("screen-findcountry-collection");
    requestAnimationFrame(() => {
      if (document.scrollingElement) document.scrollingElement.scrollTop = collectionScrollTop;
    });
  }

  function openCollectionScreen() {
    collectionScrollTop = 0;
    showCollectionScreen();
  }

  // ---------- 初期化(一度だけ呼ぶ。画面遷移を繰り返しても再登録しない) ----------
  function initEvents() {
    $("findcountry-quiz-back").addEventListener("click", handleQuizBackClick);
    $("findcountry-quiz-pause").addEventListener("click", showPauseOverlay);
    $("findcountry-quiz-pass").addEventListener("click", handlePass);
    $("findcountry-quiz-retry").addEventListener("click", handleRetryClick);
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

    $("btn-findcountry-ranking-open").addEventListener("click", () => {
      openRankingScreen(rankingSelection.difficultyId, rankingSelection.questionCount);
    });
    $("btn-findcountry-result-ranking").addEventListener("click", () => {
      openRankingScreen(
        quizState.difficultyId,
        quizState.difficultyId === PRO_DIFFICULTY_ID ? null : quizState.sequence.length
      );
    });

    $("btn-findcountry-collection-open").addEventListener("click", () => {
      openCollectionScreen();
    });
    $("btn-findcountry-result-collection").addEventListener("click", () => {
      openCollectionScreen();
    });
  }

  // ---------- 外部から呼ぶ入口(トップ画面のモードカードから呼ばれる) ----------
  function openDifficultyScreen() {
    renderDifficultyScreen();
    showScreen("screen-findcountry-difficulty");
  }

  // computeScore/maxLivesFor/getResultsは、js/quiz.jsのQuizEngineが
  // buildQuestion等の純粋関数を公開しているのと同じ考え方で、テスト・
  // 将来の再利用のために公開する(新しい外部向け機能の追加ではない)。
  // getResultsは読み取り専用のコピーを返すため、呼び出し側が配列を
  // 書き換えてもquizState.results自体には影響しない
  function getResults() {
    return quizState.results.slice();
  }

  // showCollectionScreenは、js/app.jsの画面遷移スタック
  // (encyclopediaBackOptionsFromStack)が、地図・図鑑の詳細画面を経由して
  // コレクションへ戻る際に呼ぶための公開関数(ReviewModule.showList()と
  // 同じ役割)
  return {
    initEvents, openDifficultyScreen, computeScore, maxLivesFor, getResults, isProCompleteRun,
    isNormalCourseClear, showCollectionScreen,
  };
})();
