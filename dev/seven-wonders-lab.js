// ==========================================================
// 世界7不思議テストラボ: 操作パネル(本番配信物には含めない開発専用ファイル)
//
// ここで呼んでいるTrophyModule.*/Storage.*/showScreen()等は、すべて
// dev/seven-wonders-lab-boot.jsが読み込む本番と同じjs/*.jsの関数を
// そのまま使う(このファイル専用の判定ロジックは一切持たない)。
// 保存データの隔離はjs/storage.jsのSTORAGE_PREFIX切り替えだけで行われて
// いるため、ここでは普段どおりTrophyModule/Storageを呼ぶだけでよい。
//
// window.initSevenWondersLab()は、dev/seven-wonders-lab-boot.jsが本番の
// 全スクリプト読み込み+initApp()実行を終えた直後に1回だけ呼ぶ
// ==========================================================
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  function stateLabel(state) {
    switch (state) {
      case "locked": return "🔒 未解放";
      case "available": return "🟢 挑戦可能";
      case "cooldown": return "⏳ 7日間ロック中";
      case "completed": return "🏆 獲得済み";
      default: return state;
    }
  }

  function formatMs(ms) {
    if (!Number.isFinite(ms)) return "-";
    try {
      return new Intl.DateTimeFormat("ja-JP", {
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
      }).format(new Date(ms));
    } catch (e) {
      return String(new Date(ms));
    }
  }

  // 本番と全く同じ条件判定(evaluatePuzzleAnswer)を使って、通常謎解き
  // 126問をすべて正解済みにする(= 世界7不思議の解放条件を満たす)。
  // 「挑戦する」ボタンから、未解放の問題を即座に挑戦可能にするためにも使う
  function ensureNormalPuzzlesCompleted() {
    if (TrophyModule.isSevenWondersUnlocked()) return;
    // 【トロフィーカテゴリー修正】ミステリーハンター(#393)の表示用カテゴリーが
    // 「謎解きトロフィー」になったため、category === "puzzle"だけで絞り込むと
    // 挑戦先を持たない#393自身(puzzleQuestionId: null)も含まれてしまう。
    // 実際に挑戦できる通常謎解き126問だけを対象にする
    const defs = TrophyModule.getAllDefinitions().filter((d) => d.category === "puzzle" && d.puzzleQuestionId);
    defs.forEach((d) => TrophyModule.evaluatePuzzleAnswer({ questionId: d.puzzleQuestionId, correct: true }));
  }

  // 指定した問題のロックを解除する(=Storageの保存値上、ロック解除時刻を
  // 過去にする)。recordSevenWonderFailure自体は「不正解を確定した時刻」を
  // 保存するだけの関数で、過去の時刻を渡すこと自体は制限されていないため、
  // 新しいStorage APIを増やさずにこの用途へ転用できる
  function clearLock(questionId) {
    if (typeof Storage === "undefined" || typeof Storage.recordSevenWonderFailure !== "function") return;
    const past = Date.now() - Storage.SEVEN_WONDERS_LOCK_DURATION_MS - 1000;
    Storage.recordSevenWonderFailure(questionId, past);
  }

  function lockFor7Days(questionId) {
    Storage.recordSevenWonderFailure(questionId, Date.now());
  }
  function lockAboutToExpire(questionId) {
    // あと1分でロック解除
    Storage.recordSevenWonderFailure(questionId, Date.now() - Storage.SEVEN_WONDERS_LOCK_DURATION_MS + 60000);
  }

  function openTrophyListOnSevenWonders() {
    if (typeof renderTrophyListScreen === "function") renderTrophyListScreen();
    showScreen("screen-trophy-list");
    const tab = document.querySelector('.trophy-tab[data-category="sevenWonders"]');
    if (tab) tab.click();
  }

  function challengeQuestion(questionId) {
    ensureNormalPuzzlesCompleted();
    const before = TrophyModule.getSevenWonderState(questionId);
    if (before === "completed") {
      window.alert("この問題はすでに獲得済みです。「世界7不思議の進捗だけ初期化」を押してからもう一度お試しください。");
      return;
    }
    clearLock(questionId);
    const q = (typeof SEVEN_WONDERS_QUESTIONS_BY_ID !== "undefined") ? SEVEN_WONDERS_QUESTIONS_BY_ID[questionId] : null;
    if (!q) return;
    PuzzleModule.open({ questionId, questionText: q.questionText });
    showScreen("screen-puzzle-flag-select");
  }

  function previewAward(trophyId, options) {
    const def = TrophyModule.getDefinition(trophyId);
    if (!def) return;
    showPuzzleTrophyAward(def, options || {});
  }

  function renderPanel() {
    const panel = $("wfq-lab-panel");
    if (!panel) return;

    const unlocked = TrophyModule.isSevenWondersUnlocked();
    const mysteryEarned = TrophyModule.isEarned(`trophy_${TrophyModule.MYSTERY_HUNTER_NUMBER}`);
    const omniscientEarned = TrophyModule.isEarned(`trophy_${TrophyModule.OMNISCIENT_GOD_NUMBER}`);

    const rows = (typeof SEVEN_WONDERS_QUESTIONS !== "undefined" ? SEVEN_WONDERS_QUESTIONS : []).map((q) => {
      const state = TrophyModule.getSevenWonderState(q.id);
      const unlockAt = TrophyModule.getSevenWonderUnlockAt(q.id);
      const unlockAtText = state === "cooldown" && unlockAt ? `(解除: ${formatMs(unlockAt)})` : "";
      return `
        <div class="wfq-lab-question-row" data-question-id="${q.id}">
          <div class="wfq-lab-question-head">
            <span class="wfq-lab-question-title">No.${q.trophyNumber} ${q.title}</span>
            <span class="wfq-lab-question-state">${stateLabel(state)}${unlockAtText}</span>
          </div>
          <div class="wfq-lab-question-buttons">
            <button type="button" data-action="challenge" data-id="${q.id}">挑戦する</button>
            <button type="button" data-action="correct" data-id="${q.id}">正解記録(演出なし)</button>
            <button type="button" data-action="preview-award" data-id="${q.id}">獲得演出を見る</button>
            <button type="button" data-action="lock" data-id="${q.id}">7日間ロックする</button>
            <button type="button" data-action="lock-soon" data-id="${q.id}">解除1分前にする</button>
            <button type="button" data-action="unlock-now" data-id="${q.id}">ロック解除済みにする</button>
          </div>
        </div>`;
    }).join("");

    panel.innerHTML = `
      <section class="wfq-lab-section">
        <h2>現在の状態</h2>
        <p>世界7不思議: ${unlocked ? "🟢 解放済み" : "🔒 未解放(通常126問が未完了)"}</p>
        <p>ミステリーハンター: ${mysteryEarned ? "🏆 獲得済み" : "未獲得"} ／ 全知全能の神: ${omniscientEarned ? "🏆 獲得済み" : "未獲得"}</p>
      </section>

      <section class="wfq-lab-section">
        <h2>一括操作</h2>
        <button type="button" data-action="complete-126">通常126問をすべて正解にする(解放条件を満たす)</button>
        <button type="button" data-action="open-trophy-list">トロフィー一覧(世界7不思議タブ)を開く</button>
        <button type="button" data-action="reset-seven-wonders">世界7不思議の進捗だけ初期化(126問はそのまま)</button>
        <button type="button" data-action="reset-all" class="wfq-lab-danger">テストラボの保存データをすべて初期化</button>
      </section>

      <section class="wfq-lab-section">
        <h2>特別演出プレビュー</h2>
        <button type="button" data-action="play-unlock">解放演出(世界の七不思議が解放された)を見る</button>
        <button type="button" data-action="play-omniscient">全知全能の神の全制覇演出を見る</button>
        <button type="button" data-action="preview-mystery-hunter">ミステリーハンター獲得演出を見る</button>
        <button type="button" data-action="preview-omniscient-award">全知全能の神 獲得演出を見る</button>
      </section>

      <section class="wfq-lab-section">
        <h2>世界7不思議 7問</h2>
        ${rows}
      </section>
    `;
  }

  // パネル本体(#wfq-lab-panel)はrenderPanel()のたびにinnerHTMLだけを
  // 差し替え、要素自体は再生成しない。クリックの委譲をパネル本体に1回だけ
  // 登録すれば、再描画後の新しいボタンにも自動的に効く(リスナーの
  // 重複登録・解除忘れが構造上発生しない)
  function onPanelClick(e) {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    switch (action) {
      case "complete-126": ensureNormalPuzzlesCompleted(); break;
      case "open-trophy-list": openTrophyListOnSevenWonders(); return; // 画面遷移後は再描画しない
      case "reset-seven-wonders": TrophyModule.resetSevenWondersProgress(); break;
      case "reset-all":
        if (window.confirm("テストラボの保存データ(通常126問・世界7不思議・ロック状態すべて)を初期化します。よろしいですか？")) {
          Storage.resetAll();
        }
        break;
      case "play-unlock": showSevenWondersUnlockScreen(() => { showScreen("screen-trophy-list"); renderPanel(); }); return;
      case "play-omniscient": showSevenWondersOmniscientScreen(() => { showScreen("screen-trophy-list"); renderPanel(); }); return;
      case "preview-mystery-hunter": previewAward(`trophy_${TrophyModule.MYSTERY_HUNTER_NUMBER}`, {}); return;
      case "preview-omniscient-award": previewAward(`trophy_${TrophyModule.OMNISCIENT_GOD_NUMBER}`, { isSevenWonder: true }); return;
      case "challenge": challengeQuestion(id); return; // 画面遷移後は再描画しない
      case "correct": TrophyModule.evaluateSevenWonderAnswer({ questionId: id, correct: true }); break;
      case "preview-award": {
        const q = SEVEN_WONDERS_QUESTIONS_BY_ID[id];
        previewAward(`trophy_${q.trophyNumber}`, { isSevenWonder: true });
        return;
      }
      case "lock": lockFor7Days(id); break;
      case "lock-soon": lockAboutToExpire(id); break;
      case "unlock-now": clearLock(id); break;
      default: break;
    }
    renderPanel();
  }

  window.initSevenWondersLab = function initSevenWondersLab() {
    openTrophyListOnSevenWonders();
    renderPanel();
    const panel = $("wfq-lab-panel");
    if (panel) panel.addEventListener("click", onPanelClick);
  };
})();
