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
  let currentListIds = []; // 現在の検索・フィルター結果(五十音順)。一覧画面の描画にのみ使う
  // 現在開いている詳細画面の「前へ/次へ」に使うid列。一覧から開いた場合は
  // currentListIdsと同じ内容になるが、地図から直接開いた場合(openDetailById)は
  // 一覧側のcategory/searchQuery/regionFilterを一切変更せずに独立して計算した
  // 列を入れる。一覧画面の状態(カテゴリー・検索語・地域フィルター・スクロール
  // 位置)を、地図からの表示によって書き換えないようにするための分離
  let detailListIds = [];
  let currentDetailId = null;
  let listScrollTop = 0; // 一覧へ戻った時にスクロール位置を復元するため
  let initialized = false;
  // 世界地図モードとの双方向連携(第2段階)用。詳細画面を開くたびに
  // 無条件で上書きする(前回の値と部分合成しない)ため、戻るボタンが
  // 古い遷移元を指し続けることはない
  let detailBackLabel = "← 図鑑一覧に戻る";
  let detailOnBack = null; // nullなら既定(図鑑一覧)に戻る
  // 世界図鑑トロフィー(No.156・157「復習」)用: 現在開いている詳細画面(前へ/
  // 次への移動を含む)が、復習画面(js/review.js)から開かれたセッションかどうか。
  // openDetail()・openDetailById()(通常の一覧・地図からの直接表示)では常に
  // falseにリセットし、openDetailWithList()にoptions.reviewSessionが
  // 渡された場合のみtrueにする。goAdjacent()はこの変数を一切変更しないため、
  // 復習画面から開いた国を「前へ/次へ」で移動する間はtrueのまま保持される
  let currentSessionIsReview = false;

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

  function matchesSearch(entry, normalizedQuery) {
    return !normalizedQuery || haystackFor(entry).includes(normalizedQuery);
  }

  // 現在のカテゴリー・地域フィルター・検索語に合致する一覧を、
  // 読み仮名を基準にIntl.Collator("ja")で五十音順に並べて返す。
  // overridesを渡すと、一覧側のcategory/regionFilter/searchQuery(モジュール
  // 変数)を一切変更せずに、別条件での一覧を計算できる(地図から直接開いた
  // 詳細画面の「前へ/次へ」用の一覧を、一覧画面の状態を書き換えずに求めるため)
  function computeList(overrides) {
    const cat = (overrides && overrides.category) || category;
    const filter = overrides && "regionFilter" in overrides ? overrides.regionFilter : regionFilter;
    const query = overrides && "searchQuery" in overrides ? overrides.searchQuery : searchQuery;
    const normalizedQuery = query ? normalizeForSearch(query) : "";
    const pool = entriesFor(cat).filter(
      (e) => (filter === "all" || e.region === filter) && matchesSearch(e, normalizedQuery)
    );
    return pool.slice().sort((a, b) => collator.compare(getYomigana(a.id), getYomigana(b.id)));
  }

  // ---------- 一覧画面 ----------
  // entry.id が閲覧済み(Storage.hasEncyclopediaVisited())かどうかを見て、
  // カードの右上にチェックマークを重ねる。MAP_ONLY_REGIONS(地図専用地域)の
  // idはStorage側(COUNTRIES専用の確定id集合)で常にfalseになるため、
  // category==="region"のカードには結果的に一切表示されない(ここでの
  // 分岐は不要)。チェックマークはカードの通常レイアウトに追加するだけで、
  // 既存の国旗画像・国名・クリック領域(ボタン全体)には一切手を加えない
  function buildCard(entry) {
    const { label, value } = resolveCapitalDisplay(entry);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "ency-card";
    card.dataset.id = entry.id;
    const alt = entry.isFlagImage === false ? `${entry.name}のアイコン` : `${entry.name}の国旗`;
    const visited = typeof Storage !== "undefined" && Storage.hasEncyclopediaVisited(entry.id);
    card.innerHTML = `
      <img class="ency-card-flag" src="${entry.flag}" alt="${alt}" loading="lazy">
      ${visited ? `<span class="ency-card-visited" aria-label="閲覧済み" title="閲覧済み">✓</span>` : ""}
      <span class="ency-card-name">${entry.name}</span>
      <span class="ency-card-capital">${label}：${value}</span>
    `;
    card.addEventListener("click", () => openDetail(entry.id));
    return card;
  }

  // 世界図鑑トロフィー(No.143〜158)用: 一覧画面の進捗表示
  // (「世界図鑑の探索記録 n / 198」+進捗バー、地域フィルター選択時は
  // その地域の進捗も併記)。対象はCOUNTRIES(198件)のみのため、
  // category==="region"(MAP_ONLY_REGIONS、18件)のタブでは非表示にする
  // (地図専用地域は198件の進捗に含まれないことを明確にするため)。
  // 対応するHTML要素が無い場合(将来の変更・テスト環境等)でも例外を
  // 出さずに安全に何もしない
  function renderProgressSummary() {
    const wrap = $("ency-progress-summary");
    if (!wrap) return;
    if (category !== "country" || typeof Storage === "undefined") {
      wrap.classList.add("hidden");
      return;
    }
    wrap.classList.remove("hidden");
    const visited = Storage.getEncyclopediaVisited();
    const visitedCount = Object.keys(visited).length;
    const total = COUNTRIES.length;
    const pct = total > 0 ? Math.round((visitedCount / total) * 100) : 0;
    $("ency-progress-text").textContent = `世界図鑑の探索記録　${visitedCount} / ${total}`;
    const barFill = $("ency-progress-bar-fill");
    barFill.style.width = `${pct}%`;
    const barTrack = $("ency-progress-bar");
    if (barTrack) barTrack.setAttribute("aria-valuenow", String(pct));

    const regionWrap = $("ency-progress-region");
    if (!regionWrap) return;
    if (regionFilter === "all") {
      regionWrap.classList.add("hidden");
      regionWrap.textContent = "";
      return;
    }
    const idsInRegion = COUNTRIES.filter((c) => c.region === regionFilter).map((c) => c.id);
    const regionVisitedCount = idsInRegion.filter((id) => visited[id] === true).length;
    const regionLabel = (REGION_LABELS[regionFilter] || regionFilter).replace(/^[^\s]+\s*/, "");
    regionWrap.textContent = `${regionLabel}　閲覧済み ${regionVisitedCount} / ${idsInRegion.length}`;
    regionWrap.classList.remove("hidden");
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

    renderProgressSummary();
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

  // 選択肢はrole="option"を持つ<li>とし、キーボード操作はWAI-ARIAの
  // listboxパターン(ロービングtabindex)に沿って実装する。スマホでは
  // 従来どおりタップ(click)で選べる
  function selectRegionOption(region, label) {
    regionFilter = region;
    updateRegionHighlight();
    $("ency-region-btn-label").textContent = label;
    closeRegionList();
    renderList();
  }
  function buildRegionList() {
    const list = $("ency-region-list");
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
    Array.from($("ency-region-list").children).forEach((li) => {
      const isActive = li.dataset.region === regionFilter;
      li.classList.toggle("active", isActive);
      li.setAttribute("aria-selected", String(isActive));
    });
  }
  function regionItems() { return Array.from($("ency-region-list").children); }
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
      $("ency-region-btn").focus();
    }
  }
  function openRegionList() {
    $("ency-region-list").classList.remove("hidden");
    $("ency-region-btn").setAttribute("aria-expanded", "true");
    const items = regionItems();
    const current = items.find((li) => li.dataset.region === regionFilter) || items[0];
    if (current) focusRegionItem(current);
  }
  function closeRegionList() {
    $("ency-region-list").classList.add("hidden");
    $("ency-region-btn").setAttribute("aria-expanded", "false");
  }
  function toggleRegionList() {
    if ($("ency-region-list").classList.contains("hidden")) openRegionList(); else closeRegionList();
  }

  // 世界図鑑トロフィー(No.143〜158)用: 詳細ページが実際に表示される
  // (=呼び出し元のrenderDetail()でentryが実在すると確定した)瞬間だけを
  // 「閲覧した」と記録する唯一の入口。MAP_ONLY_REGIONS(地図専用地域、
  // 18件)のidはStorage側(COUNTRIES専用の確定id集合)で記録されず常に
  // falseが返るため、ここでカテゴリー判定をする必要はない。
  // currentSessionIsReviewがtrueの間(復習画面から開いた国、前へ/次へでの
  // 移動も含む)は復習記録も同時に行う。新しく記録された事実が1件も無い
  // (単なる再訪問・既に全て記録済み)場合は、無駄な判定を一切走らせない。
  // 判定で新規にトロフィーが獲得された場合の通知は、showDetailScreen()の
  // 直後のshowScreen("screen-encyclopedia-detail")呼び出しが先に完了して
  // 画面が確定した後に出す必要があるため、setTimeoutで1tick遅らせて
  // dispatchする(即時dispatchすると、通知画面に切り替わった直後に
  // showDetailScreen()の残りの処理が詳細画面へ戻してしまい、通知が一瞬で
  // 消えてしまう)
  function recordEncyclopediaVisitFacts(id) {
    if (typeof Storage === "undefined") return;
    let changed = false;
    try {
      if (Storage.recordEncyclopediaVisit(id)) changed = true;
      if (currentSessionIsReview && Storage.recordEncyclopediaReview(id)) changed = true;
    } catch (e) {
      console.warn("世界図鑑の閲覧記録に失敗しました", e);
      return;
    }
    if (!changed) return;
    try {
      if (typeof TrophyModule === "undefined" || typeof TrophyModule.evaluateEncyclopediaVisit !== "function") return;
      const result = TrophyModule.evaluateEncyclopediaVisit();
      if (result && Array.isArray(result.awardedIds) && result.awardedIds.length) {
        const awardedIds = result.awardedIds;
        setTimeout(() => {
          document.dispatchEvent(new CustomEvent("trophymodule:non-quiz-award", { detail: { ids: awardedIds } }));
        }, 0);
      }
    } catch (e) {
      console.warn("世界図鑑トロフィーの判定に失敗しました", e);
    }
  }

  // ---------- 詳細画面 ----------
  function renderDetail(id) {
    const entry = entriesFor(category).find((e) => e.id === id) || COUNTRIES.find((e) => e.id === id) || MAP_ONLY_REGIONS.find((e) => e.id === id);
    if (!entry) return;
    currentDetailId = id;
    recordEncyclopediaVisitFacts(id);

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

    // 首都クイズで使っている既存のcapitalNote(南アフリカ・ボリビア・
    // ナウル等19件)をそのまま表示する。capitals配列による補足(上の
    // ency-detail-supplement)とは別の情報のため、どちらも維持する
    const noteEl = $("ency-detail-note");
    if (entry.capitalNote) {
      noteEl.textContent = entry.capitalNote;
      noteEl.classList.remove("hidden");
    } else {
      noteEl.textContent = "";
      noteEl.classList.add("hidden");
    }

    // 前へ/次への有効・無効は、一覧画面自体の状態(currentListIds)ではなく、
    // 今開いている詳細画面専用のdetailListIdsで判定する。地図から開いた
    // 詳細画面は、一覧側のcategory/searchQuery/regionFilterを変更しないため、
    // currentListIdsを参照すると一覧側の条件に対象が無く不整合が起きうる
    const idx = detailListIds.indexOf(id);
    $("ency-detail-prev").disabled = idx <= 0;
    $("ency-detail-next").disabled = idx < 0 || idx >= detailListIds.length - 1;

    // 一覧から開いた場合だけでなく、「前へ/次へ」で画面を切り替えない場合も
    // 必ず先頭までスクロールを戻す
    window.scrollTo(0, 0);
  }

  // 詳細画面を表示する低レベル処理(戻り先・前後移動用リストの設定はしない。
  // 一覧側のスクロール位置(listScrollTop)も更新しない)。一覧からの通常の
  // 遷移(openDetail)・地図からの直接表示(openDetailById)のいずれからも使う
  function showDetailScreen(id) {
    renderDetail(id);
    showScreen("screen-encyclopedia-detail");
  }

  // 一覧のカードクリックなど、通常の経路で開く場合は常に既定の戻り先
  // (図鑑一覧)にリセットする。地図から開かれた詳細画面が「前へ/次へ」で
  // 移動してもこの既定には戻らないよう、goAdjacent()はここを経由しない。
  // 一覧から実際に離れるのはこの経路だけなので、スクロール位置の保存と
  // 前後移動用リスト(detailListIds = 一覧と同じ内容)の設定もここで行う
  function openDetail(id) {
    listScrollTop = document.scrollingElement ? document.scrollingElement.scrollTop : 0;
    detailListIds = currentListIds;
    detailBackLabel = "← 図鑑一覧に戻る";
    detailOnBack = null;
    currentSessionIsReview = false; // 通常の一覧からの表示は常に復習扱いしない
    $("btn-ency-detail-back").textContent = detailBackLabel;
    showDetailScreen(id);
  }

  function defaultDetailOnBack() {
    // 世界図鑑トロフィー(No.143〜158)用: 詳細画面での閲覧(・地図連携・復習)
    // によって閲覧済みチェックマーク・進捗表示が変わっている可能性がある
    // ため、一覧に戻る際は再描画する。検索文字・カテゴリー・地域フィルターは
    // モジュール内の変数のまま(renderList()はそれらをそのまま使って再計算
    // するだけ)なので、一覧の内容・順序自体は変わらない
    renderList();
    showScreen("screen-encyclopedia-list");
    // スクロール位置は再描画後に復元する(再描画でスクロールがリセットされる
    // ため、スクロール位置の復元はこの後で行う必要がある)
    requestAnimationFrame(() => {
      if (document.scrollingElement) document.scrollingElement.scrollTop = listScrollTop;
    });
  }

  function closeDetail() {
    (detailOnBack || defaultDetailOnBack)();
  }

  // id(198件のCOUNTRIES、または18件のMAP_ONLY_REGIONS)がどちらの
  // カテゴリーに属するかを判定する。世界地図モードからの直接表示
  // (openDetailById)で、正しいタブ・データセットを選ぶために使う
  function categoryForId(id) {
    if (COUNTRIES.some((e) => e.id === id)) return "country";
    if (typeof MAP_ONLY_REGIONS !== "undefined" && MAP_ONLY_REGIONS.some((e) => e.id === id)) return "region";
    return null;
  }

  // 世界地図モードから、あいまい検索ではなく正確なidを指定して詳細画面を
  // 直接開く。元の図鑑一覧の状態(カテゴリー・検索語・地域フィルター・
  // スクロール位置・一覧の描画内容)は一切変更しない。前へ/次へ用の一覧
  // (detailListIds)だけは、現在の一覧条件に対象が含まれていればそれを
  // そのまま使い、含まれていなければ一覧側の状態には触れずに対象の
  // カテゴリー全体(フィルター無し)を独立して計算する
  function openDetailById(id, options) {
    const cat = categoryForId(id);
    if (!cat) {
      console.warn(`世界図鑑に存在しないID「${id}」が指定されました`);
      return;
    }

    let list = computeList();
    if (!list.some((e) => e.id === id)) {
      list = computeList({ category: cat, regionFilter: "all", searchQuery: "" });
    }
    // 地図上で直接選んだ国は、復習対象かどうかに関わらず常に通常の図鑑の
    // 範囲で開く(呼び出し元から渡されたoptionsにreviewSessionが混ざって
    // いても、ここで明示的にfalseに上書きして無視する)
    openDetailWithList(id, list.map((e) => e.id), Object.assign({}, options, { reviewSession: false }));
  }

  // id(前へ/次への移動対象)の集まりを明示して詳細画面を開く低レベル処理。
  // 一覧側の状態(category/searchQuery/regionFilter/currentListIds/
  // listScrollTop)には一切触れない。世界地図からの再表示(detailListIdsの
  // スナップショットをそのまま引き継ぐ場合、js/app.js参照)や、第3段階A案の
  // 復習リスト(間違えた国・地域だけのid列)から詳細画面を開く場合に使う
  function openDetailWithList(id, listIds, options) {
    ensureInitialized();
    detailListIds = listIds;
    const opts = options || {};
    detailBackLabel = opts.backLabel || "← 図鑑一覧に戻る";
    detailOnBack = opts.onBack || null;
    // 世界図鑑トロフィー(No.156・157「復習」)用: 復習画面(js/review.js)から
    // 開かれた場合のみopts.reviewSessionがtrueになる。それ以外(地図からの
    // 再表示等)はfalsyのため、!!で確実にbooleanへ正規化する
    currentSessionIsReview = !!opts.reviewSession;
    $("btn-ency-detail-back").textContent = detailBackLabel;
    showDetailScreen(id);
  }

  // idの集まり(例: 復習リストの対象)を、図鑑の一覧と同じ検索・地域
  // フィルター・五十音順ロジックで絞り込んで返す。一覧側の状態
  // (category/searchQuery/regionFilter)には一切触れない、副作用の無い
  // 関数。第3段階A案の復習リスト画面から、既存の検索・並び替えロジックを
  // 再利用するために公開する
  function filterAndSortByIds(ids, options) {
    const opts = options || {};
    const query = opts.query || "";
    const filter = opts.regionFilter || "all";
    const normalizedQuery = query ? normalizeForSearch(query) : "";
    const entryById = new Map(COUNTRIES.concat(typeof MAP_ONLY_REGIONS !== "undefined" ? MAP_ONLY_REGIONS : []).map((e) => [e.id, e]));
    const pool = ids
      .map((id) => entryById.get(id))
      .filter((e) => e && (filter === "all" || e.region === filter) && matchesSearch(e, normalizedQuery));
    return pool.slice().sort((a, b) => collator.compare(getYomigana(a.id), getYomigana(b.id)));
  }

  function goAdjacent(delta) {
    const idx = detailListIds.indexOf(currentDetailId);
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= detailListIds.length) return;
    renderDetail(detailListIds[nextIdx]);
  }

  // ---------- 初期化 ----------
  // 216件分のカードDOM構築は負荷が小さくないため、国旗クイズ等で遊ぶだけの
  // 利用者には一切コストをかけないよう、実際に図鑑を開いたタイミングで
  // 初めて構築する(世界地図モードのensureReady()と同じ遅延初期化の考え方)
  function ensureInitialized() {
    if (!initialized) {
      initialized = true;
      buildRegionList();
      setCategory("country");
    }
  }

  function open() {
    ensureInitialized();
  }

  function initEvents() {
    $("ency-tab-country").addEventListener("click", () => setCategory("country"));
    $("ency-tab-region").addEventListener("click", () => setCategory("region"));

    $("ency-detail-map-btn").addEventListener("click", () => {
      if (!currentDetailId) return;
      // detailListIdsのスナップショットも一緒に渡す。地図から戻ってきた
      // ときに、この詳細画面がどの範囲(通常の図鑑一覧、または復習リスト
      // などの一部)で前へ/次へを行っていたかを正しく引き継ぐため
      document.dispatchEvent(
        new CustomEvent("encyclopediamodule:view-on-map", {
          detail: { id: currentDetailId, listIds: detailListIds.slice(), isReview: currentSessionIsReview },
        })
      );
    });

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

  return { open, initEvents, openDetailById, openDetailWithList, filterAndSortByIds };
})();

document.addEventListener("DOMContentLoaded", () => EncyclopediaModule.initEvents());
