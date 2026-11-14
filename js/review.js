// ==========================================================
// 世界の国旗クイズ｜第3段階A案: 間違えた国・地域を世界図鑑で復習する
// 国旗クイズ・首都クイズの結果画面からだけ開かれる専用の一覧画面。
// 新しいデータは作らず、既存のCOUNTRIES/MAP_ONLY_REGIONSと、
// 世界図鑑(EncyclopediaModule)の検索・並び替えロジック
// (filterAndSortByIds)・詳細画面(openDetailWithList)をそのまま再利用する。
// 永続保存はしない(ページ再読み込みで復習リストは消える)。
// ==========================================================

const ReviewModule = (() => {
  let wrongIds = []; // このクイズ結果で間違えた国・地域のid
  let modeLabel = "flag"; // "flag"(国旗クイズ) | "capital"(首都クイズ)
  // 直前にopen()したidsと同じ配列(=同じクイズ結果)ならば検索・地域
  // フィルター・スクロール位置を維持し、新しいクイズの結果(別の配列)
  // であれば初期状態に戻す
  let lastOpenedIds = null;
  let regionFilter = "all";
  let searchQuery = "";
  let reviewListIds = []; // 現在の検索・地域フィルター結果(五十音順)
  let scrollTop = 0;
  let initialized = false;

  function $(id) { return document.getElementById(id); }

  // ---------- 地域フィルター(世界地図・世界図鑑と同じregion値・ラベルを再利用) ----------
  const REGION_ORDER = (typeof MapModule !== "undefined" && MapModule.REGION_ORDER) || ["all"];
  const REGION_LABELS = (typeof MapModule !== "undefined" && MapModule.REGION_LABELS) || { all: "🌍 すべての地域" };

  // 世界図鑑の一覧カードと同じ見た目(CSSクラスを共有)にする。
  // 首都表示はresolveCapitalDisplay()(js/capital-display.js)を再利用する
  function buildCard(entry) {
    const { label, value } = resolveCapitalDisplay(entry);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "ency-card";
    card.dataset.id = entry.id;
    const alt = entry.isFlagImage === false ? `${entry.name}のアイコン` : `${entry.name}の国旗`;
    card.innerHTML = `
      <img class="ency-card-flag" src="${entry.flag}" alt="${alt}" loading="lazy">
      <span class="ency-card-name">${entry.name}</span>
      <span class="ency-card-capital">${label}：${value}</span>
    `;
    card.addEventListener("click", () => openDetail(entry.id));
    return card;
  }

  function renderList() {
    // 検索・五十音順の並び替えは、世界図鑑と全く同じロジック
    // (EncyclopediaModule.filterAndSortByIds)を再利用する。復習対象の
    // idだけを渡すため、図鑑の一覧・検索条件には一切影響しない
    const list = EncyclopediaModule.filterAndSortByIds(wrongIds, { query: searchQuery, regionFilter });
    reviewListIds = list.map((e) => e.id);

    const grid = $("review-grid");
    grid.innerHTML = "";
    const frag = document.createDocumentFragment();
    list.forEach((entry) => frag.appendChild(buildCard(entry)));
    grid.appendChild(frag);

    $("review-empty").classList.toggle("hidden", list.length > 0);
    $("review-result-count").textContent = searchQuery || regionFilter !== "all"
      ? `${list.length}件 / 全${wrongIds.length}件`
      : `全${wrongIds.length}件`;
  }

  function selectRegionOption(region, label) {
    regionFilter = region;
    updateRegionHighlight();
    $("review-region-btn-label").textContent = label;
    closeRegionList();
    renderList();
  }
  function buildRegionList() {
    const list = $("review-region-list");
    list.innerHTML = "";
    REGION_ORDER.forEach((region) => {
      const li = document.createElement("li");
      li.className = "ency-region-item";
      li.setAttribute("role", "option");
      li.tabIndex = -1;
      const label = region === "all" ? "🌍 すべての地域" : REGION_LABELS[region];
      li.textContent = label;
      li.dataset.region = region;
      li.addEventListener("click", () => selectRegionOption(region, label));
      li.addEventListener("keydown", (e) => handleRegionItemKeydown(e, region, label));
      list.appendChild(li);
    });
    updateRegionHighlight();
  }
  function updateRegionHighlight() {
    Array.from($("review-region-list").children).forEach((li) => {
      const isActive = li.dataset.region === regionFilter;
      li.classList.toggle("active", isActive);
      li.setAttribute("aria-selected", String(isActive));
    });
  }
  function regionItems() { return Array.from($("review-region-list").children); }
  function focusRegionItem(li) {
    regionItems().forEach((item) => { item.tabIndex = item === li ? 0 : -1; });
    li.focus();
  }
  function handleRegionItemKeydown(e, region, label) {
    const items = regionItems();
    const currentIdx = items.indexOf(e.currentTarget);
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      selectRegionOption(region, label);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      focusRegionItem(items[Math.min(currentIdx + 1, items.length - 1)]);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusRegionItem(items[Math.max(currentIdx - 1, 0)]);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusRegionItem(items[0]);
    } else if (e.key === "End") {
      e.preventDefault();
      focusRegionItem(items[items.length - 1]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeRegionList();
      $("review-region-btn").focus();
    }
  }
  function openRegionList() {
    $("review-region-list").classList.remove("hidden");
    $("review-region-btn").setAttribute("aria-expanded", "true");
    const items = regionItems();
    const current = items.find((li) => li.dataset.region === regionFilter) || items[0];
    if (current) focusRegionItem(current);
  }
  function closeRegionList() {
    $("review-region-list").classList.add("hidden");
    $("review-region-btn").setAttribute("aria-expanded", "false");
  }
  function toggleRegionList() {
    if ($("review-region-list").classList.contains("hidden")) openRegionList(); else closeRegionList();
  }

  function ensureInitialized() {
    if (!initialized) {
      initialized = true;
      buildRegionList();
    }
  }

  // 結果画面の「📖 間違えた◯問を復習」から呼ばれる。idsが前回開いた時と
  // 同じ配列(=同じクイズ結果画面を行き来しているだけ)であれば検索・
  // 地域フィルター・スクロール位置を維持し、新しいクイズ結果(finishQuiz()
  // のたびに新しく作られる別の配列)であれば初期状態に戻す
  function open(ids, mode) {
    ensureInitialized();
    if (ids !== lastOpenedIds) {
      lastOpenedIds = ids;
      wrongIds = ids || [];
      modeLabel = mode || "flag";
      regionFilter = "all";
      searchQuery = "";
      scrollTop = 0;
      $("review-search-input").value = "";
      $("review-search-clear").classList.add("hidden");
      $("review-region-btn-label").textContent = "🌍 すべての地域";
      updateRegionHighlight();
    }
    $("review-subtitle").textContent = `${modeLabel === "capital" ? "首都クイズ" : "国旗クイズ"}｜間違えた${wrongIds.length}件`;
    renderList();
    showList();
  }

  // 画面を表示するだけで、検索語・地域フィルター・一覧の内容は変更しない。
  // 詳細画面・地図を経由して戻ってきた場合に使う(js/app.js参照)
  function showList() {
    showScreen("screen-review-list");
    requestAnimationFrame(() => {
      if (document.scrollingElement) document.scrollingElement.scrollTop = scrollTop;
    });
  }

  // 復習リストのカードをタップした時の処理。既存の世界図鑑の詳細画面を、
  // 復習対象だけのid列(reviewListIds)で「前へ/次へ」するよう明示して開く。
  // 通常の図鑑の一覧・検索条件には一切触れない
  function openDetail(id) {
    scrollTop = document.scrollingElement ? document.scrollingElement.scrollTop : 0;
    // 復習リストへの戻り先をナビゲーションスタック(js/app.js)に積んでから
    // 詳細画面を開く。地図を経由して何度往復しても、このpush/popの
    // 対応関係によって必ず復習リストへ戻れる(PR #39と同じ仕組み)
    pushMapEncyclopediaNav({ screen: "review-list" });
    // 世界図鑑トロフィー(No.156・157「復習」)用: 復習リストから開いたことを
    // 図鑑側(EncyclopediaModule)に伝える。既存の戻り先options
    // (encyclopediaBackOptionsFromStack())はそのまま維持し、
    // reviewSession:trueだけを追加で合成する
    EncyclopediaModule.openDetailWithList(id, reviewListIds, Object.assign({}, encyclopediaBackOptionsFromStack(), { reviewSession: true }));
  }

  function initEvents() {
    $("review-search-input").addEventListener("input", (e) => {
      searchQuery = e.target.value;
      $("review-search-clear").classList.toggle("hidden", searchQuery.length === 0);
      renderList();
    });
    $("review-search-clear").addEventListener("click", () => {
      searchQuery = "";
      $("review-search-input").value = "";
      $("review-search-clear").classList.add("hidden");
      $("review-search-input").focus();
      renderList();
    });
    $("review-region-btn").addEventListener("click", toggleRegionList);
  }

  return { open, showList, initEvents };
})();

document.addEventListener("DOMContentLoaded", () => ReviewModule.initEvents());
