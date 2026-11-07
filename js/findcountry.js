// ==========================================================
// 第4段階「世界の国どこかな？」第2段階: 基本画面の実装
//
// 今回のPRで実装するのは画面・画面遷移・地図操作の土台だけ。
// 出題の抽選、正誤判定、タイマーのカウントダウン、ライフ減少、
// パス処理、得点計算、最大連続正解の記録、一時停止時のタイマー制御、
// ランキング、コレクション、PRO専用ゲームロジックは一切実装しない
// (この段階ではすべて画面確認用の仮データで代替する)。
//
// 3D地球儀はPR #43で地図モードが使っているものをそのまま再利用する。
// 別の地球儀インスタンスを作らず、既存の#map-globe-container/#screen-map
// をクイズ画面としても使い回し、MapModuleの新APIだけを呼び出す。
// ==========================================================

const FindCountryModule = (() => {
  function $(id) { return document.getElementById(id); }

  // ---------- 難易度・コース定義 ----------
  // 件数・制限時間はユーザー提示の確定仕様の値をそのまま使う。
  // 上級(212)はPRO(216)からrandomEligible:falseの4地域(南極大陸・
  // 北キプロス・ソマリランド・シアチェン氷河)を除いた件数に一致する
  // (216-4=212)。ここではその4地域を除外する実際の抽選処理は
  // 実装しない(次のPR以降)。既存のrandomEligible:falseは一切変更しない
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

  // ---------- 画面遷移をまたいで保持するコース選択(成績としては保存しない) ----------
  const selection = {
    difficultyId: null,
    questionCount: null,
  };

  // ---------- 今回の画面確認用の仮データ(MOCK) ----------
  // 実際の出題処理と混同しないよう、関数名・変数名に必ずmock/Mockを付ける。
  // 次のPRで本物の出題抽選に置き換える際、ここを参照している箇所だけを
  // 差し替えれば済むよう、画面の更新ロジックとは分離してある
  const MOCK_QUESTION_NAMES = ["ブラジル", "日本", "フランス", "ケニア", "インド"];
  const mockQuiz = {
    difficultyId: null,
    questionCount: null,
    currentIndex: 0, // 0始まり
    lives: 3,
  };

  function mockCountryNameFor(index) {
    return MOCK_QUESTION_NAMES[index % MOCK_QUESTION_NAMES.length];
  }

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
          // PROは問題数選択を経由しない別枠。問題数・開始条件の詳細な
          // 確定仕様が無いため、今回は全216件・1回ずつという前提だけを
          // 仮表示する(勝手に確定しない)
          selection.questionCount = null;
          startMockQuiz(d.id, null);
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
        startMockQuiz(difficultyId, count);
      });
      grid.appendChild(card);
    });
  }

  // ---------- クイズ画面(既存の#screen-map/3D地球儀を再利用) ----------
  function startMockQuiz(difficultyId, questionCount) {
    mockQuiz.difficultyId = difficultyId;
    mockQuiz.questionCount = questionCount; // PROはnullのまま(今回は仮実装)
    mockQuiz.currentIndex = 0;
    mockQuiz.lives = 3;

    showScreen("screen-map");
    enterFindCountryMapMode();
    renderMockQuestion();
    hidePauseOverlay();

    // 前回の通常の地図探索モードの選択状態が残っていないようにしてから
    // クイズ用のタップ判定取得APIを登録する(PR #43のsetTapResultHandler)。
    // 今回は正誤判定を実装しないため、開発・画面確認用にタップされた
    // id(内部値)だけを記録する。一般利用者向けの画面には表示しない
    MapModule.clearQuizSelection();
    MapModule.setTapResultHandler((id) => {
      showMockDevTap(id);
    });
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
    // resumeAnimation等)を呼ぶだけで、別の地球儀は一切作らない。
    // 既存の検索・地域フィルター・ランダムボタン・通常ピン切替ボタンの
    // 戻るボタン(backLabel/onBack)は、クイズ画面では独自の戻るボタンを
    // 使うため使われない(押されないボタンに紐付くだけで無害)
    MapModule.open();
  }

  // 既存の世界地図モードへ戻った際、通常の地図操作が完全に復元されるよう、
  // クイズ専用のタップハンドラー・UIモードを必ず元に戻す
  function leaveFindCountryMapMode() {
    MapModule.clearTapResultHandler();
    MapModule.close();
    $("screen-map").classList.remove("findcountry-mode");
    setFindCountryChromeVisible(false);
  }

  function renderMockQuestion() {
    const d = difficultyById(mockQuiz.difficultyId);
    const total = mockQuiz.questionCount || d.count;
    $("findcountry-quiz-difficulty").textContent = `${d.icon} ${d.label}`;
    $("findcountry-quiz-progress").textContent = `第${mockQuiz.currentIndex + 1} / ${total}問`;
    $("findcountry-quiz-lives").textContent = "❤️".repeat(Math.max(0, mockQuiz.lives));
    $("findcountry-quiz-timer").textContent = `⏱ ${d.seconds}`;
    $("findcountry-quiz-country-name").textContent = mockCountryNameFor(mockQuiz.currentIndex);

    // パスボタンはPROでは使用不可(確定仕様)。今回はボタン自体の表示/非表示だけを
    // 実装し、実際のパス処理(ライフ減少・連続正解リセット等)は次のPR以降で行う
    $("findcountry-quiz-pass").classList.toggle("hidden", d.id === PRO_DIFFICULTY_ID);

    if (DEBUG_MODE) {
      $("findcountry-quiz-dev-tap").classList.remove("hidden");
      $("findcountry-quiz-dev-tap").textContent = "(開発用) タップ結果: まだありません";
    } else {
      $("findcountry-quiz-dev-tap").classList.add("hidden");
    }
  }

  function showMockDevTap(id) {
    if (!DEBUG_MODE) return;
    $("findcountry-quiz-dev-tap").textContent = `(開発用) タップ結果: ${id}`;
  }

  // パスボタン: 今回は正誤判定・ライフ減少・連続正解リセットを一切行わない、
  // 「問題の切り替え」という画面遷移だけを確認するための仮実装。
  // 最後の問題でパスすると、画面確認用に結果画面(仮データ)へ進める
  function handleMockPass() {
    const d = difficultyById(mockQuiz.difficultyId);
    const total = mockQuiz.questionCount || d.count;
    mockQuiz.currentIndex += 1;
    if (mockQuiz.currentIndex >= total) {
      showMockResult();
      return;
    }
    renderMockQuestion();
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

  // ---------- 結果画面(仮データ) ----------
  function showMockResult() {
    leaveFindCountryMapMode();
    const d = difficultyById(mockQuiz.difficultyId);
    const total = mockQuiz.questionCount || d.count;
    const mockCorrect = Math.max(0, total - 1); // 画面確認用の仮の正解数
    const mockRate = total > 0 ? Math.round((mockCorrect / total) * 100) : 0;
    $("findcountry-result-course").textContent = `${d.icon} ${d.label}・${total}問`;
    $("findcountry-result-score-fraction").textContent = `${total}問中${mockCorrect}問正解！`;
    $("findcountry-result-rate").textContent = `正答率 ${mockRate}%`;
    $("findcountry-result-streak").textContent = `最大連続正解 ${Math.max(0, mockCorrect - 1)}`;
    $("findcountry-result-points").textContent = `得点 ${mockCorrect * 850}点`;
    showScreen("screen-findcountry-result");
  }

  // ---------- 初期化(一度だけ呼ぶ。画面遷移を繰り返しても再登録しない) ----------
  function initEvents() {
    $("findcountry-quiz-back").addEventListener("click", handleQuizBackClick);
    $("findcountry-quiz-pause").addEventListener("click", showPauseOverlay);
    $("findcountry-quiz-pass").addEventListener("click", handleMockPass);

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
        startMockQuiz(selection.difficultyId, selection.questionCount);
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

    // 開発用の確認手段(本番画面には表示しない): 結果画面(仮データ)へ
    // すぐ進める。通常のプレイ(パスを繰り返す)でも最終的に到達できるが、
    // 確認を早めるためDEBUG_MODE時だけ追加する
    if (DEBUG_MODE) {
      const devBtn = document.createElement("button");
      devBtn.type = "button";
      devBtn.className = "findcountry-quiz-dev-skip-btn";
      devBtn.textContent = "(開発用) 結果画面へ";
      devBtn.addEventListener("click", showMockResult);
      $("findcountry-quiz-footer").appendChild(devBtn);
    }
  }

  // ---------- 外部から呼ぶ入口(トップ画面のモードカードから呼ばれる) ----------
  function openDifficultyScreen() {
    renderDifficultyScreen();
    showScreen("screen-findcountry-difficulty");
  }

  return { initEvents, openDifficultyScreen };
})();
