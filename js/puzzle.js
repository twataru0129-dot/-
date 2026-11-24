// ==========================================================
// 謎への挑戦: 国旗選択画面
// (第1段階の画面操作 + 第2段階の正解判定連携 + 第3段階のトロフィー連携)
//
// 今後実装予定の「世界図鑑×謎解きトロフィー」(企画段階では32問としているが、
// これは現時点の目安であり、将来40問・50問・100問以上に増える可能性がある)
// で共通利用する、国旗選択専用のUI。
//
// このファイルが担うのは「国旗を選ぶ・選択を管理する・回答を送信し、正解
// 時にトロフィー獲得処理を呼ぶ」ところまでで、以下はこのファイルの責務に
// 含めない(別のファイルに分離)。
//   - 問題データそのもの(問題文・正解条件・解説文): js/puzzle-questions.js
//   - 正解判定処理(順番指定/順不同): js/puzzle-judge.js
//   - トロフィーの獲得条件・定義・保存・一覧表示: js/trophy.js
//   - トロフィー獲得演出画面の表示: js/app.js(showPuzzleTrophyAward())
// awardTrophyIfNew()は、TrophyModule.evaluatePuzzleAnswer()という1箇所の
// 呼び出しに判定・保存を完全に委譲し、新規獲得があった場合だけjs/app.jsの
// 演出表示関数を呼ぶだけの薄い接続点にしている。
//
// 問題数が何問に増えても、この画面自体は一切修正が不要であるように設計する。
//   - 問題はopen({questionId, questionText})のように「id」で受け取り、
//     判定もjs/puzzle-judge.jsのjudge(questionId, 選択id配列)に、挑戦中の
//     questionIdをそのまま渡すだけ。32問(以上)固定の配列やswitch文を
//     このファイルの中に持たない。
//   - 選択結果は国・地域の安定したid(js/countries.jsのCOUNTRIES[].id)の
//     配列として保持する。同じidが複数回含まれてよい(「10種類」ではなく
//     「10回」選べる仕様のため)。
//   - 国旗一覧はjs/countries.js(COUNTRIES、198件)とjs/map-regions.js
//     (MAP_ONLY_REGIONS、18件、世界図鑑専用の地域)を合わせた計216件
//     (PUZZLE_FLAG_POOL)をそのまま参照するだけで、別データを複製しない
//     (謎解きトロフィー118問追加分、グリーンランド等を正解とする問題に
//     対応するための拡張。既存の国旗・首都クイズの出題対象(COUNTRIES、
//     198件のみ)には一切手を加えない)。読み仮名データ
//     (js/encyclopedia-data.js、COUNTRIES+MAP_ONLY_REGIONSの216件分が
//     既存)にも手を加えない。
// ==========================================================

const PuzzleModule = (() => {
  // ============ 開発用・一時的な設定(本番非公開) ============
  // この画面はまだ正式な入口(各謎解きトロフィーの詳細画面の「この謎に挑む」
  // ボタン)を持たない。開発確認用の仮ボタン(#btn-dev-puzzle-entry)は、
  // 一般利用者には常に非表示にしつつ、開発・動作確認のときだけ安全に
  // 表示できるよう、この定数ではなくURLのクエリパラメータで制御する
  // (isPuzzleDevEntryRequested()参照)。
  // 正式な入口を実装したら、この定数・isPuzzleDevEntryRequested()・
  // ボタンのHTML(index.html内の該当コメント参照)をまとめて削除してよい。
  const PUZZLE_DEV_ENTRY_ENABLED = false;

  // 通常のURL(クエリパラメータなし)でアクセスした一般利用者には、
  // 開発用ボタンを絶対に表示しない。開発・動作確認時だけ、URLの末尾に
  // "?puzzleDev=1" を付けてアクセスすることで、そのページ表示に限り
  // 開発用ボタンを表示できる(コードの変更・再公開は不要)。
  function isPuzzleDevEntryRequested() {
    try {
      return new URLSearchParams(window.location.search).get("puzzleDev") === "1";
    } catch (e) {
      return false;
    }
  }

  // 1問あたりの国旗選択数の上限。将来15回・20回等に変更する場合は
  // この定数だけを変更すればよい
  const MAX_SELECTIONS = 10;

  // 問題IDが指定されなかったときに表示するダミーの問題文(open()を
  // questionId省略で呼んだ場合の保険。現在の開発確認用の仮入口は、
  // 必ずPUZZLE_QUESTIONSの中から問題を選んでから開くため、通常は
  // 使われない)
  const DEFAULT_QUESTION_TEXT =
    "(これはテスト用の仮の問題文です) むかしむかし、世界のどこかに伝わる言い伝えによると、" +
    "ある4つの国の国旗には、決して忘れてはならない秘密の順番が隠されているという。" +
    "地図を頼りに、その国旗を選んだ順番どおりに並べ、謎を解き明かせ。";

  // 地域フィルターのタブ。js/countries.js(COUNTRIES)のregion値をそのまま
  // キーに使う(独自の分類を新たに作らない)。表示ラベルだけ、タブ1つ分の
  // 横幅に収まるよう短い表記にしている(「北米」「南米」は仕様の指定表記)
  const REGION_TABS = [
    { region: "all", label: "すべて" },
    { region: "asia", label: "アジア" },
    { region: "europe", label: "ヨーロッパ" },
    { region: "africa", label: "アフリカ" },
    { region: "namerica", label: "北米" },
    { region: "samerica", label: "南米" },
    { region: "oceania", label: "オセアニア" },
  ];

  // ---------- 状態(すべてこの画面を開いている間だけの一時的なもの。
  // 永続保存は行わない。問題と連動する正解判定・トロフィー獲得が
  // 実装されるまで、保存すべき対象がそもそも存在しないため) ----------
  let currentQuestionId = null;
  let currentQuestionText = DEFAULT_QUESTION_TEXT;
  let selectedIds = []; // 選択順そのまま。同じidが複数回入ってよい
  let searchQuery = "";
  let regionFilter = "all";
  let initialized = false;

  function $(id) { return document.getElementById(id); }

  // ---------- 検索の表記ゆれ吸収(js/encyclopedia.jsと同じ考え方を
  // この画面専用に複製したもの。モジュール間の依存を増やさないため) ----------
  function toHiragana(str) {
    return str.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
  }
  function normalizeForSearch(str) {
    return toHiragana(String(str).normalize("NFKC")).toLowerCase();
  }

  const collator = new Intl.Collator("ja");
  function getYomigana(id) {
    return (typeof ENCYCLOPEDIA_YOMIGANA !== "undefined" && ENCYCLOPEDIA_YOMIGANA[id]) || "";
  }

  const haystackCache = new Map();
  function haystackFor(country) {
    if (haystackCache.has(country.id)) return haystackCache.get(country.id);
    const parts = [country.name, country.englishName, getYomigana(country.id)];
    if (country.aliases) parts.push(...country.aliases);
    const haystack = normalizeForSearch(parts.filter(Boolean).join(" "));
    haystackCache.set(country.id, haystack);
    return haystack;
  }

  // 謎解きトロフィー118問追加分: 正解にMAP_ONLY_REGIONS(地図専用18地域、
  // グリーンランド・ニューカレドニア・西サハラ・ニウエ等)を含む問題が
  // あるため、この画面の選択対象をCOUNTRIES(198件)単独から、世界図鑑と
  // 同じCOUNTRIES+MAP_ONLY_REGIONS(計216件)に拡張する。対象を拡張する
  // のはこの謎解き専用画面だけで、国旗クイズ・首都クイズ(どちらも
  // COUNTRIES単独)には一切手を加えない
  const PUZZLE_FLAG_POOL = COUNTRIES.concat(typeof MAP_ONLY_REGIONS !== "undefined" ? MAP_ONLY_REGIONS : []);

  // 216件を、現在の検索語・地域フィルターで絞り込み、既存の図鑑と同じ
  // 読み仮名基準の五十音順(Intl.Collator("ja"))で並べて返す
  function computeList() {
    const normalizedQuery = searchQuery ? normalizeForSearch(searchQuery) : "";
    return PUZZLE_FLAG_POOL.filter(
      (c) =>
        (regionFilter === "all" || c.region === regionFilter) &&
        (!normalizedQuery || haystackFor(c).includes(normalizedQuery))
    ).sort((a, b) => collator.compare(getYomigana(a.id), getYomigana(b.id)));
  }

  // ---------- 問題文表示エリア ----------
  function renderQuestionText() {
    const textEl = $("puzzle-question-text");
    const toggleEl = $("puzzle-question-toggle");
    if (!textEl || !toggleEl) return;
    textEl.textContent = currentQuestionText;
    textEl.classList.remove("expanded");
    toggleEl.textContent = "続きを読む";
    // 折りたたみが必要なほど長い文章かどうかは、実際にクランプされて
    // scrollHeightがclientHeightを超えているかで判定する(文字数の
    // 固定しきい値に頼らない)
    requestAnimationFrame(() => {
      const needsToggle = textEl.scrollHeight - textEl.clientHeight > 2;
      toggleEl.classList.toggle("hidden", !needsToggle);
    });
  }
  function toggleQuestionText() {
    const textEl = $("puzzle-question-text");
    const toggleEl = $("puzzle-question-toggle");
    const expanded = textEl.classList.toggle("expanded");
    toggleEl.textContent = expanded ? "閉じる" : "続きを読む";
  }

  // ---------- 地域フィルタータブ ----------
  function renderRegionTabs() {
    const wrap = $("puzzle-region-tabs");
    if (!wrap) return;
    wrap.innerHTML = "";
    REGION_TABS.forEach((tab) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "puzzle-region-tab" + (tab.region === regionFilter ? " active" : "");
      btn.textContent = tab.label;
      btn.dataset.region = tab.region;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", String(tab.region === regionFilter));
      btn.addEventListener("click", () => {
        if (regionFilter === tab.region) return;
        regionFilter = tab.region;
        renderRegionTabs();
        renderGrid();
      });
      wrap.appendChild(btn);
    });
  }

  // ---------- 国旗一覧(スクロールするのはこのグリッドだけ) ----------
  function buildFlagCard(country) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "puzzle-flag-card";
    card.dataset.id = country.id;
    card.setAttribute("aria-label", `${country.name}を選ぶ`);
    // MAP_ONLY_REGIONSの一部(南極大陸・北キプロス・ソマリランド・シアチェン
    // 氷河)は国旗ではなくアイコン画像のため、既存の世界図鑑(js/encyclopedia.js)
    // と同じくisFlagImage===falseの場合だけalt文言を変える
    const alt = country.isFlagImage === false ? `${country.name}のアイコン` : `${country.name}の国旗`;
    card.innerHTML = `
      <img class="puzzle-flag-img" src="${country.flag}" alt="${alt}" loading="lazy">
      <span class="puzzle-flag-name">${country.name}</span>
    `;
    // 選択済みでも無効化しない(同じ国旗を何度でも選べる仕様のため)
    card.addEventListener("click", () => addSelection(country.id));
    return card;
  }

  function renderGrid() {
    const grid = $("puzzle-grid");
    const empty = $("puzzle-empty");
    const countEl = $("puzzle-result-count");
    if (!grid) return;
    const list = computeList();
    grid.innerHTML = "";
    const frag = document.createDocumentFragment();
    list.forEach((c) => frag.appendChild(buildFlagCard(c)));
    grid.appendChild(frag);
    if (empty) empty.classList.toggle("hidden", list.length > 0);
    if (countEl) countEl.textContent = `${list.length}件`;
  }

  // ---------- 選択済み国旗(画面下部に固定) ----------
  function addSelection(id) {
    if (selectedIds.length >= MAX_SELECTIONS) return;
    selectedIds.push(id);
    renderAnswerBar();
  }
  function removeSelectionAt(index) {
    if (index < 0 || index >= selectedIds.length) return;
    selectedIds.splice(index, 1);
    renderAnswerBar();
  }
  function clearSelections() {
    if (!selectedIds.length) return;
    selectedIds = [];
    renderAnswerBar();
  }

  function countryById(id) {
    return PUZZLE_FLAG_POOL.find((c) => c.id === id);
  }

  function renderAnswerBar() {
    const listEl = $("puzzle-answer-list");
    const countEl = $("puzzle-answer-count");
    const submitBtn = $("puzzle-answer-submit");
    const clearBtn = $("puzzle-answer-clear");
    if (!listEl || !countEl || !submitBtn) return;

    countEl.textContent = `${selectedIds.length} / ${MAX_SELECTIONS}`;

    listEl.innerHTML = "";
    if (!selectedIds.length) {
      const hint = document.createElement("p");
      hint.className = "puzzle-answer-empty-hint";
      hint.textContent = "国旗をタップして選んでください";
      listEl.appendChild(hint);
    } else {
      const frag = document.createDocumentFragment();
      selectedIds.forEach((id, index) => {
        const country = countryById(id);
        if (!country) return; // 万一idが見つからない場合は描画をスキップする(データ不整合時の保険)
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "puzzle-answer-chip";
        chip.setAttribute("aria-label", `${index + 1}番目に選んだ${country.name}を削除`);
        chip.innerHTML = `
          <span class="puzzle-answer-chip-num">${index + 1}</span>
          <img class="puzzle-answer-chip-flag" src="${country.flag}" alt="${country.name}の国旗">
        `;
        chip.addEventListener("click", () => removeSelectionAt(index));
        frag.appendChild(chip);
      });
      listEl.appendChild(frag);
    }

    if (clearBtn) clearBtn.disabled = selectedIds.length === 0;
    submitBtn.disabled = selectedIds.length === 0;

    // 選択内容が変わったら、直前の回答メッセージ(テスト表示)は消す
    hideAnswerMessage();
  }

  // ---------- 回答確定 ----------
  // 判定そのもの(js/puzzle-judge.js)には依存を持たず、ここでは
  // 「挑戦中の問題ID(currentQuestionId)と選択中の回答をまとめて判定
  // モジュールに渡し、結果に応じた表示を行う」ことだけを行う。
  // currentQuestionIdだけを渡すことで、他の問題の正解条件と混ざることは
  // 構造上発生しない(js/puzzle-judge.jsが挑戦中の問題だけを見て判定する)。
  function judgeAnswer(questionId, answerIds) {
    if (typeof PuzzleJudgeModule === "undefined") {
      // 判定モジュールが読み込まれていない場合の保険(通常は発生しない)
      return { correct: false };
    }
    return PuzzleJudgeModule.judge(questionId, answerIds);
  }

  // 正解時のトロフィー獲得処理(第3段階)。js/trophy.jsのevaluatePuzzleAnswer()
  // に、挑戦中のquestionIdだけを渡す(他の問題のトロフィーが誤って獲得
  // されることは構造上発生しない)。新規に獲得したトロフィーがあった場合
  // (初回正解時だけ)に限り、js/app.jsの専用演出画面を呼ぶ。2回目以降の
  // 正解(既に獲得済み)はawardedIdsが常に空になるため、演出は再実行されない
  function awardTrophyIfNew(questionId) {
    if (typeof TrophyModule === "undefined" || typeof TrophyModule.evaluatePuzzleAnswer !== "function") return;
    const result = TrophyModule.evaluatePuzzleAnswer({ questionId, correct: true });
    const awardedId = result && result.awardedIds && result.awardedIds[0];
    if (!awardedId) return;
    const def = TrophyModule.getDefinition(awardedId);
    if (def && typeof showPuzzleTrophyAward === "function") {
      showPuzzleTrophyAward(def);
    }
  }

  function handleSubmit() {
    if (!selectedIds.length) return;
    // 【PR #81追加修正】既存のjs/app.js(モード選択ボタン)と同じく、ユーザー
    // 操作(このボタンのクリック)の中でSoundManager.unlock()を呼ぶ。
    // 「国旗/首都クイズを一度も選んでいない」経路(トロフィー一覧→この謎に
    // 挑む、で直接ここへ来た場合)でもAudioContextが未初期化のままだと、
    // 効果音ONでも謎解きトロフィー獲得時のファンファーレ(SoundManager.
    // playFanfare())が音として鳴らない。unlock()自体は毎回呼んでも安全
    // (生成済みなら何もせず、suspendedならresumeを試みるだけ)で、
    // 正解・不正解のどちらでも呼んで構わない(既存のunlock()呼び出しと
    // 同じく、効果音のON/OFF自体はSoundManager側(safePlay()の
    // enabledチェック)が判定するため、ここで二重に判定しない)
    SoundManager.unlock();
    const result = judgeAnswer(currentQuestionId, selectedIds.slice());
    if (result.correct) {
      showAnswerMessage(`「${result.title}」\n${result.explanationText}`, "correct");
      awardTrophyIfNew(currentQuestionId);
    } else {
      // 不正解でも選択内容は一切変更しない(保持したまま修正・再挑戦できる)
      showAnswerMessage("しかし、何も起こらなかった……", "wrong");
    }
  }
  function showAnswerMessage(message, variant) {
    const el = $("puzzle-answer-message");
    if (!el) return;
    el.textContent = message;
    el.classList.remove("hidden", "puzzle-answer-message--correct", "puzzle-answer-message--wrong");
    if (variant === "correct") el.classList.add("puzzle-answer-message--correct");
    if (variant === "wrong") el.classList.add("puzzle-answer-message--wrong");
  }
  function hideAnswerMessage() {
    const el = $("puzzle-answer-message");
    if (!el) return;
    el.classList.add("hidden");
    el.classList.remove("puzzle-answer-message--correct", "puzzle-answer-message--wrong");
  }

  // ---------- 検索 ----------
  function handleSearchInput(value) {
    searchQuery = value;
    $("puzzle-search-clear").classList.toggle("hidden", !value);
    renderGrid();
  }
  function clearSearch() {
    $("puzzle-search-input").value = "";
    handleSearchInput("");
    $("puzzle-search-input").focus();
  }

  // ---------- 初期化・画面を開く ----------
  function initEvents() {
    if (initialized) return;
    initialized = true;

    $("puzzle-search-input").addEventListener("input", (e) => handleSearchInput(e.target.value));
    $("puzzle-search-clear").addEventListener("click", clearSearch);
    $("puzzle-question-toggle").addEventListener("click", toggleQuestionText);
    $("puzzle-answer-clear").addEventListener("click", clearSelections);
    $("puzzle-answer-submit").addEventListener("click", handleSubmit);

    // ============ 開発用・一時的な入口(本番非公開) ============
    // ボタンを押すと、PUZZLE_QUESTIONS(js/puzzle-questions.js)に登録されて
    // いる問題から1つを選べる一覧を表示する。一覧はデータから動的に
    // 生成するため、問題が何件に増えても(3問専用のif文を増やさずに)
    // そのまま対応できる
    const devEntryBtn = $("btn-dev-puzzle-entry");
    const devPicker = $("puzzle-dev-question-picker");
    if (devEntryBtn && (PUZZLE_DEV_ENTRY_ENABLED || isPuzzleDevEntryRequested())) {
      devEntryBtn.classList.remove("hidden");
      renderDevQuestionPicker(devPicker);
      devEntryBtn.addEventListener("click", () => {
        if (devPicker) devPicker.classList.toggle("hidden");
      });
    }
  }

  function renderDevQuestionPicker(container) {
    if (!container) return;
    container.innerHTML = "";
    if (typeof PUZZLE_QUESTIONS === "undefined") return;
    PUZZLE_QUESTIONS.forEach((q) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "puzzle-dev-question-btn";
      btn.dataset.questionId = q.id;
      btn.textContent = `No.${String(q.number).padStart(2, "0")} ${q.title}`;
      btn.addEventListener("click", () => {
        container.classList.add("hidden");
        open({ questionId: q.id, questionText: q.questionText });
        if (typeof showScreen === "function") showScreen("screen-puzzle-flag-select");
      });
      container.appendChild(btn);
    });
  }

  // options.questionId / options.questionText: 将来、各謎解きトロフィーの
  // 詳細画面の「この謎に挑む」ボタンから、挑戦する問題のidと問題文を渡して
  // 開く想定(今回は未連動なので、呼び出し側は省略してよい)。
  // 開くたびに選択状態・検索・地域フィルターを初期状態にリセットする
  // (1回の挑戦ごとに新しい回答をゼロから作るのが自然な挙動のため)
  function open(options) {
    const opts = options || {};
    currentQuestionId = opts.questionId || null;
    currentQuestionText = opts.questionText || DEFAULT_QUESTION_TEXT;
    selectedIds = [];
    searchQuery = "";
    regionFilter = "all";
    const searchInput = $("puzzle-search-input");
    if (searchInput) searchInput.value = "";
    const searchClear = $("puzzle-search-clear");
    if (searchClear) searchClear.classList.add("hidden");

    renderQuestionText();
    renderRegionTabs();
    renderGrid();
    renderAnswerBar();
  }

  return { initEvents, open, MAX_SELECTIONS };
})();
