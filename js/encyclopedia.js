// ==========================================================
// 世界図鑑モード(第1段階): 一覧・検索・地域フィルター・詳細画面
// 国旗クイズ・首都クイズ・世界地図モードとは完全に独立したモジュール。
// js/countries.js(COUNTRIES、198件)とjs/map-regions.js
// (MAP_ONLY_REGIONS、18件)のデータをそのまま参照するだけで、
// 別管理のコピーは持たない(読み仮名だけjs/encyclopedia-data.jsで
// 専用に管理する)。
// ==========================================================

const EncyclopediaModule = (() => {
  // "country" = COUNTRIES(198件) / "region" = MAP_ONLY_REGIONS(18件)
  let category = "country";
  let regionFilter = "all"; // 既存のcountry.region値をそのまま使う("all"は全地域)
  let searchQuery = "";
  let currentListIds = []; // 現在の検索・フィルター結果(五十音順)。詳細画面の前後移動に使う
  let currentDetailId = null;
  let listScrollTop = 0; // 一覧へ戻った時にスクロール位置を復元するため
  let initialized = false;

  const collator = new Intl.Collator("ja");

  function $(id) { return document.getElementById(id); }

  function entriesFor(cat) {
    return cat === "region" ? MAP_ONLY_REGIONS : COUNTRIES;
  }

  function getYomigana(id) {
    return (typeof ENCYCLOPEDIA_YOMIGANA !== "undefined" && ENCYCLOPEDIA_YOMIGANA[id]) || "";
  }

  // ---------- 検索の表記ゆれ吸収 ----------
  // カタカナ→ひらがな、全角/半角・大文字小文字の違いを1つの形に揃えてから
  // 比較する。既存の国旗クイズ・首都クイズの出題処理(js/quiz.js)とは
  // 完全に独立した、図鑑専用の検索処理
  function toHiragana(str) {
    return str.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
  }
  function normalizeForSearch(str) {
    return toHiragana(String(str).normalize("NFKC")).toLowerCase();
  }

  const haystackCache = new Map();
  function haystackFor(entry) {
    if (haystackCache.has(entry.id)) return haystackCache.get(entry.id);
    const parts = [entry.name, entry.englishName, getYomigana(entry.id)];
    // 通常の国の首都、特殊な首都事情を持つ国の補足都市名(例: 南アフリカの
    // ケープタウン・ブルームフォンテーン)も検索対象にする。地図専用地域は
    // capitalを持たないため、ここで首都があるかのような誤ったデータを
    // 追加することはない(infoValueは実際の表示値そのもの)
    if (entry.capital) parts.push(entry.capital);
    if (entry.capitals) entry.capitals.forEach((c) => parts.push(c.name));
    if (entry.infoValue) parts.push(entry.infoValue);
    if (entry.aliases) parts.push(...entry.aliases);
    const haystack = normalizeForSearch(parts.filter(Boolean).join(" "));
    haystackCache.set(entry.id, haystack);
    return haystack;
  }

  function matchesRegion(entry) {
    return regionFilter === "all" || entry.region === regionFilter;
  }
  function matchesSearch(entry, normalizedQuery) {
    return !normalizedQuery || haystackFor(entry).includes(normalizedQuery);
  }

  // 現在のカテゴリー・地域フィルター・検索語に合致する一覧を、
  // 読み仮名を基準にIntl.Collator("ja")で五十音順に並べて返す
  function computeList() {
    const normalizedQuery = searchQuery ? normalizeForSearch(searchQuery) : "";
    const pool = entriesFor(category).filter((e) => matchesRegion(e) && matchesSearch(e, normalizedQuery));
    return pool.slice().sort((a, b) => collator.compare(getYomigana(a.id), getYomigana(b.id)));
  }

  // ---------- 一覧画面 ----------
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
    const list = computeList();
    currentListIds = list.map((e) => e.id);

    const grid = $("ency-grid");
    grid.innerHTML = "";
    const frag = document.createDocumentFragment();
    list.forEach((entry) => frag.appendChild(buildCard(entry)));
    grid.appendChild(frag);

    $("ency-empty").classList.toggle("hidden", list.length > 0);
    const total = entriesFor(category).length;
    $("ency-result-count").textContent = searchQuery || regionFilter !== "all"
      ? `${list.length}件 / 全${total}件`
      : `全${total}件`;
  }

  function setCategory(cat) {
    category = cat;
    $("ency-tab-country").classList.toggle("active", cat === "country");
    $("ency-tab-country").setAttribute("aria-selected", String(cat === "country"));
    $("ency-tab-region").classList.toggle("active", cat === "region");
    $("ency-tab-region").setAttribute("aria-selected", String(cat === "region"));
    renderList();
  }

  // ---------- 地域フィルター(世界地図モードと同じregion値・ラベルを再利用) ----------
  const REGION_ORDER = (typeof MapModule !== "undefined" && MapModule.REGION_ORDER) || ["all"];
  const REGION_LABELS = (typeof MapModule !== "undefined" && MapModule.REGION_LABELS) || { all: "🌍 すべての地域" };

  function buildRegionList() {
    const list = $("ency-region-list");
    list.innerHTML = "";
    REGION_ORDER.forEach((region) => {
      const li = document.createElement("li");
      li.className = "ency-region-item";
      li.textContent = region === "all" ? "🌍 すべての地域" : REGION_LABELS[region];
      li.dataset.region = region;
      li.addEventListener("click", () => {
        regionFilter = region;
        updateRegionHighlight();
        $("ency-region-btn-label").textContent = li.textContent;
        closeRegionList();
        renderList();
      });
      list.appendChild(li);
    });
    updateRegionHighlight();
  }
  function updateRegionHighlight() {
    Array.from($("ency-region-list").children).forEach((li) => {
      li.classList.toggle("active", li.dataset.region === regionFilter);
    });
  }
  function openRegionList() { $("ency-region-list").classList.remove("hidden"); $("ency-region-btn").setAttribute("aria-expanded", "true"); }
  function closeRegionList() { $("ency-region-list").classList.add("hidden"); $("ency-region-btn").setAttribute("aria-expanded", "false"); }
  function toggleRegionList() {
    if ($("ency-region-list").classList.contains("hidden")) openRegionList(); else closeRegionList();
  }

  // ---------- 詳細画面 ----------
  function renderDetail(id) {
    const entry = entriesFor(category).find((e) => e.id === id) || COUNTRIES.find((e) => e.id === id) || MAP_ONLY_REGIONS.find((e) => e.id === id);
    if (!entry) return;
    currentDetailId = id;

    const flagImg = $("ency-detail-flag");
    flagImg.src = entry.flag;
    flagImg.alt = entry.isFlagImage === false ? `${entry.name}のアイコン` : `${entry.name}の国旗`;
    $("ency-detail-name").textContent = entry.name;
    $("ency-detail-english").textContent = entry.englishName || "";

    const { label, value, supplementEntries } = resolveCapitalDisplay(entry);
    $("ency-detail-capital-label").textContent = label;
    $("ency-detail-capital-value").textContent = value;
    const supplementEl = $("ency-detail-supplement");
    supplementEl.innerHTML = "";
    if (supplementEntries.length) {
      supplementEntries.forEach((e) => {
        const li = document.createElement("li");
        li.textContent = `${e.type}：${e.name}`;
        supplementEl.appendChild(li);
      });
      supplementEl.classList.remove("hidden");
    } else {
      supplementEl.classList.add("hidden");
    }
    $("ency-detail-region").textContent = entry.regionJa || "";
    $("ency-detail-desc").textContent = entry.description || "";

    const idx = currentListIds.indexOf(id);
    $("ency-detail-prev").disabled = idx <= 0;
    $("ency-detail-next").disabled = idx < 0 || idx >= currentListIds.length - 1;

    // 一覧から開いた場合だけでなく、「前へ/次へ」で画面を切り替えない場合も
    // 必ず先頭までスクロールを戻す
    window.scrollTo(0, 0);
  }

  function openDetail(id) {
    listScrollTop = document.scrollingElement ? document.scrollingElement.scrollTop : 0;
    renderDetail(id);
    showScreen("screen-encyclopedia-detail");
  }

  function closeDetail() {
    showScreen("screen-encyclopedia-list");
    // 一覧側の検索文字・カテゴリー・地域フィルターはモジュール内の変数の
    // ままなので再描画は不要。スクロール位置だけ復元する
    requestAnimationFrame(() => {
      if (document.scrollingElement) document.scrollingElement.scrollTop = listScrollTop;
    });
  }

  function goAdjacent(delta) {
    const idx = currentListIds.indexOf(currentDetailId);
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= currentListIds.length) return;
    renderDetail(currentListIds[nextIdx]);
  }

  // ---------- 初期化 ----------
  // 216件分のカードDOM構築は負荷が小さくないため、国旗クイズ等で遊ぶだけの
  // 利用者には一切コストをかけないよう、実際に図鑑を開いたタイミングで
  // 初めて構築する(世界地図モードのensureReady()と同じ遅延初期化の考え方)
  function open() {
    if (!initialized) {
      initialized = true;
      buildRegionList();
      setCategory("country");
    }
  }

  function initEvents() {
    $("ency-tab-country").addEventListener("click", () => setCategory("country"));
    $("ency-tab-region").addEventListener("click", () => setCategory("region"));

    $("ency-search-input").addEventListener("input", (e) => {
      searchQuery = e.target.value;
      $("ency-search-clear").classList.toggle("hidden", searchQuery.length === 0);
      renderList();
    });
    $("ency-search-clear").addEventListener("click", () => {
      searchQuery = "";
      $("ency-search-input").value = "";
      $("ency-search-clear").classList.add("hidden");
      $("ency-search-input").focus();
      renderList();
    });

    $("ency-region-btn").addEventListener("click", toggleRegionList);

    $("btn-ency-detail-back").addEventListener("click", closeDetail);
    $("ency-detail-prev").addEventListener("click", () => goAdjacent(-1));
    $("ency-detail-next").addEventListener("click", () => goAdjacent(1));
  }

  return { open, initEvents };
})();

document.addEventListener("DOMContentLoaded", () => EncyclopediaModule.initEvents());
