// ==========================================================
// 第4段階「世界の国どこかな？」第3段階: 出題・正誤判定の実装
//
// 今回実装するのは実際の出題抽選・タップ回答・正誤判定・結果集計のみ。
// 得点計算、ライフ減少、制限時間のカウントダウン、最大連続正解の正式集計、
// 成績の永続保存、ランキング、コレクション、PRO専用演出は実装しない
// (第2段階からの画面・画面遷移の土台はそのまま再利用する)。
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
    answered: false, // 今の問題について既に回答確定済み(タップ・パス)かどうか
    results: [], // {questionNumber, countryId, answeredId, result:"correct"|"wrong"|"pass"}
  };

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
    // ライフ・残り時間は今回のPRでは実装しない(常に固定値を表示し続けると
    // 利用者に誤解を与えるため、実装するまでは表示自体を隠す)
    $("findcountry-quiz-status").classList.add("hidden");
    // 既存の世界地図モードと全く同じ初期化・再開ロジック(ensureReady/
    // resumeAnimation等)を呼ぶだけで、別の地球儀は一切作らない
    MapModule.open();
  }

  // 既存の世界地図モードへ戻った際、通常の地図操作が完全に復元されるよう、
  // クイズ専用のタップハンドラー・強調表示・選択状態を必ず元に戻す
  function leaveFindCountryMapMode() {
    MapModule.clearTapResultHandler();
    MapModule.clearQuizResultHighlight();
    MapModule.clearQuizSelection();
    MapModule.close();
    $("screen-map").classList.remove("findcountry-mode");
    setFindCountryChromeVisible(false);
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
  }

  // ---------- 回答結果の一時記録(今回のプレイ中だけメモリ上で保持) ----------
  function recordResult(result, answeredId) {
    quizState.results.push({
      questionNumber: quizState.currentIndex + 1,
      countryId: quizState.currentCountry.id,
      answeredId: answeredId || null,
      result, // "correct" | "wrong" | "pass"(将来の得点計算等のために区別できる形式で保持)
    });
  }

  // ---------- 正誤判定の表示(kind: "correct" | "wrong" | "pass") ----------
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
    const isLastQuestion = quizState.currentIndex + 1 >= quizState.sequence.length;
    const nextBtn = $("findcountry-quiz-next");
    nextBtn.textContent = isLastQuestion ? "結果を見る" : "次の問題へ ▶";
    nextBtn.classList.remove("hidden");

    if (DEBUG_MODE) {
      $("findcountry-quiz-dev-tap").textContent = `(開発用) タップ結果: ${tappedId || "(パス)"}`;
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
    const correctId = quizState.currentCountry.id;
    const isCorrect = tappedId === correctId;
    recordResult(isCorrect ? "correct" : "wrong", tappedId);
    showFeedback(isCorrect ? "correct" : "wrong", tappedId);
  }

  // ---------- パスボタン(通常コースのみ。PROでは表示されず、呼び出しても無効) ----------
  function handlePass() {
    if (quizState.answered) return;
    if (quizState.difficultyId === PRO_DIFFICULTY_ID) return;
    quizState.answered = true;
    recordResult("pass", null);
    showFeedback("pass", null);
  }

  // ---------- 「次の問題へ」/「結果を見る」ボタン ----------
  function handleNextClick() {
    if (!quizState.answered) return; // 回答確定前はこのボタンは表示されない(念のためのガード)
    const isLastQuestion = quizState.currentIndex + 1 >= quizState.sequence.length;
    if (isLastQuestion) {
      showResult();
      return;
    }
    quizState.currentIndex += 1;
    renderQuestion();
  }

  // ---------- 一時停止 ----------
  function showPauseOverlay() {
    $("findcountry-pause-overlay").classList.remove("hidden");
  }
  function hidePauseOverlay() {
    $("findcountry-pause-overlay").classList.add("hidden");
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
    const total = quizState.results.length;
    const correctCount = quizState.results.filter((r) => r.result === "correct").length;
    const rate = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    $("findcountry-result-course").textContent = `${d.icon} ${d.label}・${total}問`;
    $("findcountry-result-score-fraction").textContent = `${total}問中${correctCount}問正解！`;
    $("findcountry-result-rate").textContent = `正答率 ${rate}%`;
    showScreen("screen-findcountry-result");
  }

  // ---------- 初期化(一度だけ呼ぶ。画面遷移を繰り返しても再登録しない) ----------
  function initEvents() {
    $("findcountry-quiz-back").addEventListener("click", handleQuizBackClick);
    $("findcountry-quiz-pause").addEventListener("click", showPauseOverlay);
    $("findcountry-quiz-pass").addEventListener("click", handlePass);
    $("findcountry-quiz-next").addEventListener("click", handleNextClick);

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
