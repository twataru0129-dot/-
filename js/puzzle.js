// ==========================================================
// 謎への挑戦: 国旗選択画面(第1段階)
//
// 今後実装予定の「世界図鑑×謎解きトロフィー」(企画段階では32問としているが、
// これは現時点の目安であり、将来40問・50問・100問以上に増える可能性がある)
// で共通利用する、国旗選択専用のUI。
//
// このファイルが担うのは「国旗を選ぶ・選択を管理する・回答を送信する」という
// 画面操作だけで、以下はこのファイルの責務に含めない(将来、別のファイルで
// 実装する)。
//   - 32問(以上)の問題データそのもの(問題文・正解条件)
//   - 正解判定処理(順番指定/順不同)
//   - トロフィーの獲得・保存・解放処理
// submitAnswer()は、将来この3つを実装するときに置き換えやすいよう、
// judgeAnswerStub()という1箇所の呼び出しだけで完結させている。
//
// 問題数が何問に増えても、この画面自体は一切修正が不要であるように設計する。
//   - 問題はopen({questionId, questionText})のように「id」で受け取る想定にし、
//     32問固定の配列やswitch文をこのファイルの中に持たない。
//   - 選択結果は国・地域の安定したid(js/countries.jsのCOUNTRIES[].id)の
//     配列として保持する。同じidが複数回含まれてよい(「10種類」ではなく
//     「10回」選べる仕様のため)。
//   - 国旗一覧はjs/countries.js(COUNTRIES、198件)をそのまま参照するだけで、
//     別データを複製しない。既存の国旗・首都クイズの出題対象(COUNTRIES)や
//     読み仮名データ(js/encyclopedia-data.js)には一切手を加えない。
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

  // 問題IDが指定されなかったとき(今回の開発確認用の仮入口など)に表示する
  // ダミーの問題文。将来、トロフィー画面から実際の問題文が渡されるように
  // なれば、この文章が使われることはなくなる
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

  // 198件を、現在の検索語・地域フィルターで絞り込み、既存の図鑑と同じ
  // 読み仮名基準の五十音順(Intl.Collator("ja"))で並べて返す
  function computeList() {
    const normalizedQuery = searchQuery ? normalizeForSearch(searchQuery) : "";
    return COUNTRIES.filter(
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
    card.innerHTML = `
      <img class="puzzle-flag-img" src="${country.flag}" alt="${country.name}の国旗" loading="lazy">
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
    return COUNTRIES.find((c) => c.id === id);
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

  // ---------- 回答確定(今回は正解判定・トロフィー獲得処理を一切行わない) ----------
  // 将来、問題IDに紐づく正解判定処理(順番指定/順不同)とトロフィー獲得処理が
  // 実装されたら、この関数の中身だけを置き換える想定。呼び出し側
  // (handleSubmit)からは判定結果のmessageだけを受け取って表示する
  function judgeAnswerStub(questionId, answerIds) {
    return { message: "回答を受け付けました(テスト表示)" };
  }

  function handleSubmit() {
    if (!selectedIds.length) return;
    const result = judgeAnswerStub(currentQuestionId, selectedIds.slice());
    showAnswerMessage(result.message);
  }
  function showAnswerMessage(message) {
    const el = $("puzzle-answer-message");
    if (!el) return;
    el.textContent = message;
    el.classList.remove("hidden");
  }
  function hideAnswerMessage() {
    const el = $("puzzle-answer-message");
    if (!el) return;
    el.classList.add("hidden");
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
    const devEntryBtn = $("btn-dev-puzzle-entry");
    if (devEntryBtn && (PUZZLE_DEV_ENTRY_ENABLED || isPuzzleDevEntryRequested())) {
      devEntryBtn.classList.remove("hidden");
      devEntryBtn.addEventListener("click", () => {
        open();
        if (typeof showScreen === "function") showScreen("screen-puzzle-flag-select");
      });
    }
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
