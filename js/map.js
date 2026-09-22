// ==========================================================
// 世界地図モード(第1版)
// 3D地球儀を自由に回転・拡大縮小し、国をタップ/検索して
// 国旗・国名・首都・地域・簡単な解説を見られる「見るだけ」のモード。
// クイズではないため、得点・タイマー・正誤判定・効果音は使用しない。
// 国旗クイズ・首都クイズのコードとは完全に分離してある。
// ==========================================================

const MapModule = (() => {
  // globe.gl本体(1.9MB)とGeoJSON(約250KB)は、このモードを開いた
  // タイミングで初めて読み込む(国旗/首都クイズの初期表示を重くしないため)
  const GLOBE_LIB_URL = "./assets/vendor/globe.gl.min.js";
  const GEOJSON_URL = "./assets/map/world-countries.geojson";

  let globeInstance = null;
  let geoFeatures = [];
  let allMapCountries = []; // COUNTRIES(198件、クイズ対象) + MAP_ONLY_REGIONS(地図モード専用の追加地域)
  let countryByMapCode = null;
  let countryById = null;
  let countryAngularSize = null; // country.id -> 実ポリゴンのバウンディングボックス角度(度)
  let selectedCountryId = null;
  let selectedShowsLabel = false; // 選択中の国が「ピン→ラベル切り替え」対象かどうか(選択した瞬間に固定する)
  let initPromise = null;
  let hasInteracted = false;
  let labelRAF = null;
  let normalPinEls = null; // id -> HTMLElement(通常ピンの📍要素)。基準ズーム確定時に一度だけ構築する
  let visibleNormalPinIds = new Set(); // 現在「論理的に表示すべき」通常ピンのID集合(位置追従RAFが参照する)
  let normalPinsRAF = null;
  let pinAnchorById = new Map(); // id -> {lat,lng}。実ポリゴン上の代表点(GeoJSON読み込み時に一度だけ算出)

  // ---------- 地域フィルター(v1.2) ----------
  // "all"のときは既存(v1.1以前)の見た目・挙動を完全に維持する。
  // countries.js / map-regions.jsのregionフィールドをそのまま再利用するため、
  // 新しいデータ構造は追加していない
  const REGION_ORDER = ["all", "asia", "europe", "africa", "namerica", "samerica", "oceania", "antarctica"];
  const REGION_LABELS = {
    all: "🌍 全世界",
    asia: "🌏 アジア",
    europe: "🌍 ヨーロッパ",
    africa: "🌍 アフリカ",
    namerica: "🌎 北アメリカ・中央アメリカ・カリブ",
    samerica: "🌎 南アメリカ",
    oceania: "🌏 オセアニア",
    antarctica: "🧊 南極",
  };
  let currentRegionFilter = "all";
  let regionCenters = null; // region -> {lat,lng,altitude}。allMapCountriesから一度だけ算出する
  let randomFlightTimer = null;
  let previousRandomIds = []; // 直近に選ばれたID(最大5件)を保持し、連続・近接重複を避ける

  // ---------- 通常の小国ピン ON/OFF ----------
  // 見た目(HTML要素の📍)だけを切り替える。PIN_TARGET_IDS/tapAssistIdsや
  // 近接タップ判定(handleContainerClick)はこのフラグに関係なく常に生きたままにする
  const PINS_VISIBLE_STORAGE_KEY = "wfq_v1_map_pins_visible";
  function loadPinsVisiblePref() {
    try {
      const saved = localStorage.getItem(PINS_VISIBLE_STORAGE_KEY);
      if (saved === "1") return true;
      if (saved === "0") return false;
    } catch (e) {
      // localStorageが使えない環境では既定値を使う
    }
    return false; // 既定はOFF(カリブ海など小国密集地域でも見た目がすっきりするように)
  }
  function savePinsVisiblePref(value) {
    try {
      localStorage.setItem(PINS_VISIBLE_STORAGE_KEY, value ? "1" : "0");
    } catch (e) {
      // 保存できなくても表示切替そのものは継続する
    }
  }
  let pinsVisible = loadPinsVisiblePref();

  // 実ポリゴンが極小で、基準ズームでの角度サイズ判定だけでは信頼できない
  // (≒常にタップ補助が必要な)国・地域。この集合は下記tapAssistIds(タップ
  // 補助対象)の算出にのみ使う。赤い📍を表示する対象はPIN_TARGET_IDS
  // (固定リスト、下記)で別途管理しており、この集合とは目的が異なる。
  // nu(ニウエ)は実ポリゴンの角度サイズ自体が極小、ck(クック諸島)は
  // 散らばった離島まで含むバウンディングボックスが非常に広く、画面上サイズに
  // 基づく判定(estimateApparentPx)だとほぼ「大きい国」扱いになって
  // タップ補助対象から外れてしまうため、常時タップ補助対象に加えている
  const ALWAYS_PIN_IDS = new Set(["va", "mc", "sm", "mv", "nr", "tv", "nu", "ck"]);

  // ---------- 見た目の通常ピン対象(固定リスト) ----------
  // 「ズームしても場所や形が分かりづらい、本当に小さい国・地域」だけを
  // 手動で選定した固定リスト。国の面積・見かけサイズから自動的に対象を
  // 増減させる仕組みは通常ピンの表示には使わない(タップ補助用の
  // tapAssistIdsとは別物で、ズーム操作によって増減することもない)。
  // 通常ピン(赤い📍)・選択中のピン+国名ラベルの対象は、どちらもこの
  // リストだけを見る(コスタリカ等、実際に形が見える国は含めない)。
  const PIN_TARGET_IDS = new Set([
    // ヨーロッパ
    "va", "mc", "sm", "li", "ad", "mt",
    // アジア
    "sg", "hk", "mo",
    // インド洋・太平洋
    "mv", "nr", "tv", "mh", "fm", "pw", "sc", "nu", "ck", "guam",
    // カリブ海
    "kn", "ag", "dm", "lc", "vc", "gd", "bb", "curacao",
    // 遠隔地で位置が分かりづらい地図専用地域
    "gs",
  ]);

  // 画面上のおおよその見かけサイズ(px)がこの値を下回る国を、世界地図モードを
  // 開いたときの基準ズーム(INITIAL_VIEW_ALTITUDE)で一度だけ判定し、
  // タップ補助対象(tapAssistIds)として確定する。これは「近くをタップすると
  // 選択しやすくなる」ための内部判定であり、赤い📍の表示/非表示には一切
  // 連動しない(📍の表示はPIN_TARGET_IDSだけで決まる)。以前はズーム操作の
  // たびにこの判定をやり直して対象を増減させていたため、ピンONのまま拡大縮小
  // するとピンが消える不具合があったが、tapAssistIdsは表示に使わなくなった
  // ため、その心配自体が無くなっている
  const PIN_SHOW_PX = 25;
  let tapAssistIds = new Set();

  // ピンはHTML要素(#map-normal-pins配下)で描画しているため、グラフィック自体は
  // クリックを受け取れない。ピン表示中の国をタップできるように、緯度経度の近さで
  // 判定する専用のヒット半径(度)を持たせる(実ポリゴンが小さすぎて直接タップしづらい国ほど広め)
  const HIT_RADIUS_DEG = { va: 1.6, mc: 1.5, sm: 1.4, mv: 1.5, nr: 1.3, tv: 1.3, nu: 1.5, ck: 1.5 };
  const DEFAULT_HIT_RADIUS_DEG = 1.4;
  const GLOBE_RADIUS = 100; // globe.glの基準球半径(getCoords()の結果から実測して確認済み)
  const INITIAL_VIEW_ALTITUDE = 2.3; // 世界地図モードを開いたときの初期ズーム(tapAssistIdsの基準にも使う)

  function $(id) { return document.getElementById(id); }

  function hasWebGL() {
    try {
      const canvas = document.createElement("canvas");
      return !!(
        window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
      );
    } catch (e) {
      return false;
    }
  }

  // globe.glのスクリプトタグを一度だけ挿入する(複数回openしても再読み込みしない)
  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      if (window.Globe) { resolve(); return; }
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error("globe.glの読み込みに失敗しました")));
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("globe.glの読み込みに失敗しました"));
      document.body.appendChild(script);
    });
  }

  function buildCountryIndex() {
    // クイズ対象の198件(COUNTRIES)は絶対に変更せず、地図モードでの検索・タップ用に
    // 表示専用の追加地域(MAP_ONLY_REGIONS、mapOnly:true)だけをこのモジュール内でのみ合算する。
    // COUNTRIES自体には触れないため、国旗クイズ・首都クイズ側の198件には一切影響しない。
    allMapCountries = COUNTRIES.concat(
      typeof MAP_ONLY_REGIONS !== "undefined" ? MAP_ONLY_REGIONS : []
    );
    countryByMapCode = new Map();
    countryById = new Map();
    allMapCountries.forEach((c) => {
      countryById.set(c.id, c);
      if (c.mapCode) countryByMapCode.set(c.mapCode, c);
    });
    buildAngularSizeIndex();
    buildRegionCenters();
  }

  // 地域フィルター選択時にカメラを移動する先を、実際のデータから算出しておく。
  // 経度は日付変更線をまたぐ地域(オセアニア等)でも正しく中心が出るよう
  // 単純平均ではなく円周(sin/cos)平均を使う
  function buildRegionCenters() {
    regionCenters = {};
    const byRegion = new Map();
    allMapCountries.forEach((c) => {
      if (!byRegion.has(c.region)) byRegion.set(c.region, []);
      byRegion.get(c.region).push(c);
    });
    byRegion.forEach((list, region) => {
      let latSum = 0, sinSum = 0, cosSum = 0, minLat = 90, maxLat = -90;
      list.forEach((c) => {
        latSum += c.lat;
        const rad = (c.lng * Math.PI) / 180;
        sinSum += Math.sin(rad);
        cosSum += Math.cos(rad);
        if (c.lat < minLat) minLat = c.lat;
        if (c.lat > maxLat) maxLat = c.lat;
      });
      const lat = latSum / list.length;
      const lng = (Math.atan2(sinSum, cosSum) * 180) / Math.PI;
      // 縦方向の広がりに応じて、大陸全体をある程度見渡せる高度にする
      // (極端な拡大/縮小を避けるため1.7〜2.6の範囲に収める)
      const altitude = Math.min(2.6, Math.max(1.7, 1.1 + (maxLat - minLat) / 70));
      regionCenters[region] = { lat, lng, altitude };
    });
    // 南極大陸は南極点を囲む特殊な形状で、経度の円周平均が不安定になりうる
    // ため、南極地域(メンバーは南極大陸1件のみ)だけは専用の中心・高度を
    // 固定で使う。大陸全体が画面に収まるよう、通常の地域より高めのズームにする
    if (regionCenters.antarctica) {
      regionCenters.antarctica = { lat: -82, lng: 0, altitude: 2.2 };
    }
  }

  // 各国の実ポリゴンのバウンディングボックス角度(緯度幅・経度幅の大きい方)を
  // 一度だけ計算しておく
  function buildAngularSizeIndex() {
    countryAngularSize = new Map();
    geoFeatures.forEach((f) => {
      const c = countryByMapCode.get(f.id);
      if (!c) return;
      let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
      const polys = f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [f.geometry.coordinates];
      polys.forEach((poly) => {
        poly.forEach((ring) => {
          ring.forEach(([lng, lat]) => {
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
          });
        });
      });
      countryAngularSize.set(c.id, Math.max(maxLat - minLat, maxLng - minLng));
    });
  }

  // ---------- 通常ピン・選択用マーカーの表示位置(実ポリゴン上のアンカー) ----------
  // 以前はcountry.lat/lngをそのままピン位置に使っていたが、この値は検索・
  // カメラ移動用の代表座標であり、実ポリゴンの外(海上)にずれていることが
  // ある。地球儀を真正面から見ている間は目立たなくても、回転させると遠近感
  // により見た目のズレが拡大する。そのため、GeoJSON読み込み時に一度だけ、
  // 実ポリゴン上(内部または境界上)の代表点を計算しておき、以降はこの値だけを使う。
  function ringSignedArea(ring) {
    let sum = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i]; const [x2, y2] = ring[i + 1];
      sum += x1 * y2 - x2 * y1;
    }
    return sum / 2;
  }
  // 面積で重み付けした多角形の重心(シューレース公式)。符号付き面積aを使うため、
  // 頂点の巻き方向(CW/CCW)に関わらず正しい重心が求まる
  function ringCentroid(ring) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i]; const [x2, y2] = ring[i + 1];
      const cross = x1 * y2 - x2 * y1;
      a += cross;
      cx += (x1 + x2) * cross;
      cy += (y1 + y2) * cross;
    }
    a *= 0.5;
    if (Math.abs(a) < 1e-12) {
      // 面積がほぼ0(退化した形状)の場合は単純な頂点平均にフォールバックする
      let sx = 0, sy = 0;
      const n = ring.length - 1;
      for (let i = 0; i < n; i++) { sx += ring[i][0]; sy += ring[i][1]; }
      return { lng: sx / n, lat: sy / n };
    }
    return { lng: cx / (6 * a), lat: cy / (6 * a) };
  }
  // 標準的なレイキャスティング法による点内外判定(ringは閉じている前提、
  // GeoJSONの慣習どおり先頭点=末尾点)
  function pointInRing(lng, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 2; i < ring.length - 1; j = i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];
      const intersect = (yi > lat) !== (yj > lat) &&
        lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }
  // poly = [外周リング, 穴リング1, 穴リング2, ...] (GeoJSON Polygonの1要素の形)
  function pointInPolygonWithHoles(lng, lat, poly) {
    if (!pointInRing(lng, lat, poly[0])) return false;
    for (let i = 1; i < poly.length; i++) {
      if (pointInRing(lng, lat, poly[i])) return false; // 穴の中は「内部」とみなさない
    }
    return true;
  }
  // 重心がポリゴンの外(凹型の湾など)に出てしまった場合、外周上で重心に最も
  // 近い頂点を代わりに使う(必ず実ポリゴンの境界上に来る)
  function nearestRingVertex(lng, lat, ring) {
    let best = null, bestDist = Infinity;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x, y] = ring[i];
      const d = (x - lng) * (x - lng) + (y - lat) * (y - lat);
      if (d < bestDist) { bestDist = d; best = { lng: x, lat: y }; }
    }
    return best;
  }
  // PIN_TARGET_IDSの各国・地域について、実ポリゴン上の代表点を一度だけ計算する。
  // モルディブ・マーシャル諸島・クック諸島のように離島が散らばっている
  // MultiPolygonでは、単純平均は取らず「面積が最大のサブポリゴン(代表ポリゴン)」
  // だけを対象にする
  function computePinAnchorById() {
    const anchors = new Map();
    geoFeatures.forEach((f) => {
      const c = countryByMapCode.get(f.id);
      if (!c || !PIN_TARGET_IDS.has(c.id)) return;
      const polys = f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [f.geometry.coordinates];
      let primary = polys[0];
      let bestArea = 0;
      polys.forEach((poly) => {
        const area = Math.abs(ringSignedArea(poly[0]));
        if (area > bestArea) { bestArea = area; primary = poly; }
      });
      const centroid = ringCentroid(primary[0]);
      const anchor = pointInPolygonWithHoles(centroid.lng, centroid.lat, primary)
        ? centroid
        : nearestRingVertex(centroid.lng, centroid.lat, primary[0]);
      anchors.set(c.id, anchor);
    });
    // 万一実ポリゴンが見つからなかった場合の安全策(理論上は起きないはずだが、
    // データ上の代表座標にフォールバックして、ピン自体が消えないようにする)
    PIN_TARGET_IDS.forEach((id) => {
      if (anchors.has(id)) return;
      const c = countryById.get(id);
      if (c) anchors.set(id, { lat: c.lat, lng: c.lng });
    });
    return anchors;
  }

  function setStatus(text, isError) {
    const el = $("map-status");
    if (!text) {
      el.classList.add("hidden");
      return;
    }
    el.textContent = text;
    el.classList.toggle("map-status-error", !!isError);
    el.classList.remove("hidden");
  }

  // スクリプト・地図データの読み込みと地球儀の初期構築(初回のみ実行される)
  function ensureReady() {
    if (initPromise) return initPromise;

    if (!hasWebGL()) {
      $("map-unsupported").classList.remove("hidden");
      initPromise = Promise.reject(new Error("WebGL unsupported"));
      return initPromise;
    }

    setStatus("世界地図を読み込んでいます…", false);
    initPromise = Promise.all([
      loadScriptOnce(GLOBE_LIB_URL),
      fetch(GEOJSON_URL).then((res) => {
        if (!res.ok) throw new Error("GeoJSONの読み込みに失敗しました");
        return res.json();
      }),
    ])
      .then(([, geo]) => {
        // geometryを持たないデータ(面積の小さい国など)が混ざっているとglobe.glが
        // 描画時にエラーになるため、念のためここでも取り除いておく
        geoFeatures = geo.features.filter((f) => f && f.geometry);
        buildCountryIndex();
        // タップ補助対象を基準ズームで一度だけ確定する(近接タップ判定専用、
        // 赤い📍の表示対象PIN_TARGET_IDSとは別物)。通常ピンのHTML要素は
        // PIN_TARGET_IDS(固定リスト)から作る
        tapAssistIds = computeTapAssistIds();
        // 通常ピン・選択用マーカーが実ポリゴン上に来るよう、代表点を一度だけ算出する
        pinAnchorById = computePinAnchorById();
        buildNormalPinElements();
        buildGlobe();
        setStatus(null);
      })
      .catch((e) => {
        console.error("世界地図の読み込みに失敗しました", e);
        setStatus("世界地図データを読み込めませんでした。もう一度お試しください。", true);
        throw e;
      });
    return initPromise;
  }

  // ---------- 国のハイライト表示 ----------
  // 通常の国は緑系、選択中の国だけオレンジ系にする(他の国の色は変えない)。
  // 以前は極小国のタップ判定に「透明・高高度の合成円」を重ねていたが、
  // 透明(alpha=0)なのに周辺国より高い高度を持つポリゴンはWebGLの深度バッファに
  // 書き込みだけ行って可視化はされないため、真下にある隣国(モナコ→フランス、
  // バチカン/サンマリノ→イタリア等)の描画が深度テストに負けて海の色が透けて
  // 見えてしまう不具合の原因になっていた。極小国も含め全ポリゴンが実形状の
  // GeoJSONを持つようになったため、この合成円・透明化・高高度化の仕組みは廃止し、
  // 全ポリゴンに同一のシンプルな色・高度ロジックだけを適用する。
  function isSelected(feat) {
    const c = countryByMapCode.get(feat.id);
    if (!c) return false;
    if (c.id === selectedCountryId) return true;
    // ハワイはアメリカ合衆国の一部でもあるため、アメリカ合衆国(countries.js側の
    // 通常の国)が選択されている間は、ハワイの実ポリゴンも本土・アラスカと
    // 一緒にオレンジ表示にする。ハワイ単独が選択されている場合はここに該当せず、
    // 上のc.id === selectedCountryIdだけがtrueになるため、ハワイだけが色付く
    if (c.parentQuizId && c.parentQuizId === selectedCountryId) return true;
    return false;
  }
  // 地域フィルターが有効なとき、選択中の地域に属する国かどうか。
  // フィルターが"all"のときは常にtrue(＝既存の見た目を完全に維持する)
  function isInActiveRegion(feat) {
    if (currentRegionFilter === "all") return true;
    const c = countryByMapCode.get(feat.id);
    return !!c && c.region === currentRegionFilter;
  }
  function polygonCapColor(feat) {
    if (isSelected(feat)) return "#ffb100";
    if (currentRegionFilter === "all") return "rgba(139, 195, 143, 0.95)";
    return isInActiveRegion(feat) ? "rgba(150, 214, 154, 0.97)" : "rgba(150, 178, 150, 0.28)";
  }
  function polygonSideColor(feat) {
    if (isSelected(feat)) return "rgba(255, 177, 0, 0.45)";
    if (currentRegionFilter === "all") return "rgba(90, 130, 100, 0.25)";
    return isInActiveRegion(feat) ? "rgba(90, 140, 100, 0.32)" : "rgba(110, 130, 110, 0.08)";
  }
  function polygonStrokeColor(feat) {
    if (isSelected(feat)) return "#8a5500";
    if (currentRegionFilter === "all") return "#3f5c4c";
    return isInActiveRegion(feat) ? "#345a42" : "rgba(90, 110, 95, 0.35)";
  }
  // 選択中の国だけ高度を上げていたが、地球儀を斜めから見たときに側面が
  // 立体的な柱のように伸びて見えるため、選択の有無に関わらず全ポリゴンを
  // 同じ高さ(通常国と同じ0.006)にする。選択の強調はcapColor/strokeColorのみで行う
  function polygonAltitude() {
    return 0.006;
  }
  function refreshPolygonStyles() {
    if (!globeInstance) return;
    globeInstance
      .polygonCapColor(polygonCapColor)
      .polygonSideColor(polygonSideColor)
      .polygonStrokeColor(polygonStrokeColor)
      .polygonAltitude(polygonAltitude);
  }

  // ---------- 小国ピン(見た目)。タップ判定はscreenToLatLngによる近接判定が担当する ----------
  // 選択中の国の位置に表示する赤い📍マーカー(#map-selected-marker)と全く同じ方式
  // (HTML要素 + projectLatLngToScreenでの画面座標追従)を使い、通常ピンも本物の
  // 📍として表示する。以前はglobe.gl自体のpointsDataレイヤー(WebGLの円柱)を
  // 使っていたが、ズームすると大きな円柱に見えてしまい📍らしくならないため、
  // 選択中マーカーと同じ仕組みに統一した。対象はPIN_TARGET_IDS(手動で選定した
  // 固定リスト、数十件程度)だけなので、198件全体を毎フレーム計算するような
  // 重い処理にはならない。選択中の国はここでは表示しない(選択用の
  // 赤📍+国名ラベル+実ポリゴンのオレンジ表示で位置・形を示すため)。
  function buildNormalPinElements() {
    const container = $("map-normal-pins");
    container.innerHTML = "";
    normalPinEls = new Map();
    PIN_TARGET_IDS.forEach((id) => {
      const c = countryById.get(id);
      if (!c) return;
      const el = document.createElement("div");
      el.className = "map-normal-pin hidden";
      el.textContent = "📍";
      container.appendChild(el);
      normalPinEls.set(id, el);
    });
  }
  // ピンON/OFF・地域フィルター・選択中の国が変わったときだけ呼ぶ。「論理的に
  // 表示すべきID集合」を作り直し、非表示になった要素を即座に隠し、表示すべき
  // ものが1件でもあれば位置追従用RAFループを開始する(無ければ止めて休ませる)
  function refreshNormalPinVisibility() {
    if (!normalPinEls) return;
    const next = new Set();
    if (pinsVisible) {
      PIN_TARGET_IDS.forEach((id) => {
        if (id === selectedCountryId) return; // 選択中の国は選択用マーカー側に任せる
        const c = countryById.get(id);
        if (!c) return;
        // 地域フィルター中は、他地域の小国ピンを非表示にして画面がピンだらけに
        // ならないようにする("all"のときは全ピンを従来どおり表示する)
        if (currentRegionFilter !== "all" && c.region !== currentRegionFilter) return;
        next.add(id);
      });
    }
    visibleNormalPinIds = next;
    normalPinEls.forEach((el, id) => {
      if (!visibleNormalPinIds.has(id)) el.classList.add("hidden");
    });
    if (visibleNormalPinIds.size > 0) {
      if (normalPinsRAF === null) tickNormalPins();
    } else if (normalPinsRAF !== null) {
      cancelAnimationFrame(normalPinsRAF);
      normalPinsRAF = null;
    }
  }
  function updateNormalPinPositions() {
    if (!visibleNormalPinIds.size) return;
    const container = $("map-globe-container");
    const wrap = document.querySelector(".map-wrap");
    const cRect = container.getBoundingClientRect();
    const wRect = wrap.getBoundingClientRect();
    visibleNormalPinIds.forEach((id) => {
      const el = normalPinEls.get(id);
      const anchor = pinAnchorById.get(id);
      if (!el || !anchor) return;
      const pos = projectLatLngToScreen(anchor.lat, anchor.lng, 0.02);
      if (!pos) {
        el.classList.add("hidden"); // 地球の裏側にある間だけ一時的に隠す
        return;
      }
      el.classList.remove("hidden");
      el.style.left = `${cRect.left - wRect.left + pos.x}px`;
      el.style.top = `${cRect.top - wRect.top + pos.y}px`;
    });
  }
  function tickNormalPins() {
    updateNormalPinPositions();
    normalPinsRAF = requestAnimationFrame(tickNormalPins);
  }
  function stopNormalPinsLoop() {
    if (normalPinsRAF !== null) {
      cancelAnimationFrame(normalPinsRAF);
      normalPinsRAF = null;
    }
  }

  // ---------- 通常の小国ピン ON/OFFボタン ----------
  function updatePinsToggleButton() {
    const btn = $("map-pins-toggle-btn");
    btn.textContent = pinsVisible ? "📍 ピン ON" : "📍 ピン OFF";
    btn.classList.toggle("active", pinsVisible);
    btn.setAttribute("aria-pressed", pinsVisible ? "true" : "false");
  }
  function togglePinsVisible() {
    pinsVisible = !pinsVisible;
    savePinsVisiblePref(pinsVisible);
    updatePinsToggleButton();
    refreshNormalPinVisibility();
  }
  // ボタンは地球儀コンテナのDOM構造の外(兄弟要素)に置いているため、
  // コンテナの実寸に合わせて右上の位置をJS側で計算する(ラベル/マーカーと同じ手法)
  function positionPinsToggleButton() {
    const btn = $("map-pins-toggle-btn");
    const container = $("map-globe-container");
    const wrap = document.querySelector(".map-wrap");
    if (!container || !wrap) return;
    const cRect = container.getBoundingClientRect();
    const wRect = wrap.getBoundingClientRect();
    btn.style.top = `${cRect.top - wRect.top + 10}px`;
    btn.style.right = `${wRect.right - cRect.right + 10}px`;
  }

  // ---------- PC・タブレット版 国情報カードの開始位置 ----------
  // PC版(min-width:700px)はCSSでtop:0固定だったため、上部2段のツールバーと
  // カードが重なっていた。ツールバーの高さは端末・文字サイズ等で変わりうるため、
  // 固定値ではなく地球儀コンテナの実際の位置(positionPinsToggleButtonと同じ手法)
  // から動的に算出する。モバイル(下からのシート表示)では効かないよう、
  // 幅がPCレイアウトのときだけstyle.topを設定し、それ以外は打ち消す
  function positionInfoCardForDesktop() {
    const card = $("map-info-card");
    const container = $("map-globe-container");
    const wrap = document.querySelector(".map-wrap");
    if (!card || !container || !wrap) return;
    if (!window.matchMedia("(min-width: 700px)").matches) {
      card.style.top = ""; // モバイルは既存の下シート表示(bottom基準)に戻す
      return;
    }
    const cRect = container.getBoundingClientRect();
    const wRect = wrap.getBoundingClientRect();
    card.style.top = `${cRect.top - wRect.top}px`;
  }

  // ---------- タップ補助対象の判定(基準ズームで一度だけ) ----------
  // globe.glの透視投影を簡易近似した式(fov≈50°相当で較正)で、実ポリゴンの
  // おおよその画面上サイズ(px)を見積もる。世界地図モードを開いた直後の
  // 基準ズーム(INITIAL_VIEW_ALTITUDE)で一度だけ判定し、以降はズーム操作を
  // 行ってもこの判定をやり直さない。この結果(tapAssistIds)は近接タップ
  // 判定の候補集合としてのみ使い、赤い📍の表示対象(PIN_TARGET_IDS)には
  // 一切影響しない
  function estimateApparentPx(angularSizeDeg, altitude) {
    const CALIBRATION_K = 15.6;
    return (CALIBRATION_K * angularSizeDeg) / (1 + altitude);
  }
  function computeTapAssistIds() {
    const ids = new Set(ALWAYS_PIN_IDS);
    if (countryAngularSize) {
      countryAngularSize.forEach((deg, id) => {
        if (estimateApparentPx(deg, INITIAL_VIEW_ALTITUDE) < PIN_SHOW_PX) ids.add(id);
      });
    }
    return ids;
  }

  // ---------- 選択中の国名ラベル(ピンの代わりに表示する) ----------
  // カスタムのHTML<div>を自前のスクリーン座標計算で追従させる。以前は
  // globe.gl自身のhtmlElementsDataレイヤー(標準のHTML要素オーバーレイ機能)への
  // 移行を試みたが、このリポジトリにvendorしているglobe.glビルドでは、
  // .htmlElementsData()/.htmlLat()/.htmlLng()/.htmlElement()等のメソッド自体は
  // 呼び出せてエラーにもならないものの、実際にはDOM要素が一切挿入されない
  // (コンテナの子要素数・innerHTMLが増えないことを実機で確認済み)ことが分かった。
  // そのため、地球儀本体(globe.gl)が持つ画面座標変換メソッド
  // globeInstance.getScreenCoords(lat, lng, altitude) を使う方式に切り替えた。
  // 自前で行列計算をやり直すのではなく、globe.gl自身に現在のカメラ状態での
  // 投影結果を問い合わせるため、WebGL描画側との整合性がより確実になる。
  // 計算対象は「現在選択中の1地点」だけであり、198件全体を毎フレーム計算するような
  // 重い処理ではないため、requestAnimationFrameで継続更新してもパフォーマンス上問題ない。
  function normalizeVec(v) {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }
  function dotVec(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }
  // 緯度経度(+高度)をスクリーン上のピクセル座標に変換する。
  // 地球の裏側にある場合や画面外に大きく外れる場合はnullを返す。
  function projectLatLngToScreen(lat, lng, altitude) {
    if (!globeInstance) return null;
    const camera = globeInstance.camera();
    if (!camera || typeof globeInstance.getScreenCoords !== "function") return null;

    // OrbitControlsが更新したcamera.position/quaternionから、matrixWorldを
    // 念のため最新化しておく(getScreenCoords自体が内部で行っている場合でも、
    // 呼んでおいて害はない安全策)
    camera.updateMatrixWorld(true);

    const world = globeInstance.getCoords(lat, lng, altitude);
    // カメラから見て地球の裏側(水平線の向こう)にある地点は表示しない。
    // getScreenCoords自体にはこの判定が無いため、引き続き自前で行う
    const camDir = normalizeVec(camera.position);
    const pointDir = normalizeVec(world);
    if (dotVec(camDir, pointDir) < 0.15) return null;

    const screen = globeInstance.getScreenCoords(lat, lng, altitude);
    if (!screen || !Number.isFinite(screen.x) || !Number.isFinite(screen.y)) return null;

    const container = $("map-globe-container");
    const w = container.clientWidth;
    const h = container.clientHeight;
    // 画面から大きく外れた位置(以前のNDC±1.15相当のマージン)は非表示にする
    if (screen.x < -0.15 * w || screen.x > 1.15 * w || screen.y < -0.15 * h || screen.y > 1.15 * h) return null;

    return { x: screen.x, y: screen.y };
  }
  // 通常ピンと同じ実ポリゴン上のアンカー座標(pinAnchorById)を使う。これにより、
  // 「通常ピン→選択して消える→選択用ピン+ラベルに切り替わる」際に、📍の
  // 先端位置が全く動かない(通常ピン対象=PIN_TARGET_IDSのときだけ呼ばれるため、
  // 基本的にアンカーは必ず存在するが、念のためcountry.lat/lngにフォールバックする)
  function pinAnchorFor(country) {
    return pinAnchorById.get(country.id) || { lat: country.lat, lng: country.lng };
  }
  function updateLabelPosition(country) {
    const labelEl = $("map-country-label");
    const anchor = pinAnchorFor(country);
    const pos = projectLatLngToScreen(anchor.lat, anchor.lng, 0.02);
    if (!pos) {
      labelEl.classList.add("hidden");
      return;
    }
    labelEl.classList.remove("hidden");
    const container = $("map-globe-container");
    const wrap = document.querySelector(".map-wrap");
    const cRect = container.getBoundingClientRect();
    const wRect = wrap.getBoundingClientRect();
    labelEl.style.left = `${cRect.left - wRect.left + pos.x}px`;
    // 赤い📍マーカーがラベルの少し下(選択地点そのもの)に表示されるため、
    // マーカーと重ならないよう従来より少し高い位置に上げる
    labelEl.style.top = `${cRect.top - wRect.top + pos.y - 30}px`;
  }
  // 選択中の極小国の実位置に表示する赤い📍マーカー。国名ラベルと全く同じ
  // 画面座標計算(projectLatLngToScreen)を使い、同じRAFループで追従させる
  function updateMarkerPosition(country) {
    const markerEl = $("map-selected-marker");
    const anchor = pinAnchorFor(country);
    const pos = projectLatLngToScreen(anchor.lat, anchor.lng, 0.02);
    if (!pos) {
      markerEl.classList.add("hidden");
      return;
    }
    markerEl.classList.remove("hidden");
    const container = $("map-globe-container");
    const wrap = document.querySelector(".map-wrap");
    const cRect = container.getBoundingClientRect();
    const wRect = wrap.getBoundingClientRect();
    markerEl.style.left = `${cRect.left - wRect.left + pos.x}px`;
    markerEl.style.top = `${cRect.top - wRect.top + pos.y}px`;
  }
  function stopLabelTracking() {
    if (labelRAF !== null) {
      cancelAnimationFrame(labelRAF);
      labelRAF = null;
    }
    $("map-country-label").classList.add("hidden");
    $("map-selected-marker").classList.add("hidden");
  }
  function startLabelTracking(country) {
    stopLabelTracking();
    const labelEl = $("map-country-label");
    labelEl.textContent = country.name;
    const tick = () => {
      updateLabelPosition(country);
      updateMarkerPosition(country);
      labelRAF = requestAnimationFrame(tick);
    };
    tick();
  }

  // ---------- ピン表示中の国をタップできるようにする近接判定 ----------
  // pointsDataレイヤーはこのglobe.glビルドではクリックイベントを受け取れないため、
  // 地球儀コンテナへの生のclickイベントから「画面上のどの地点をタップしたか」を
  // 緯度経度に変換し、現在ピン表示されている国の座標に近ければその国を選択する。
  // 透明・高高度ポリゴンを使わないため、深度バッファを汚染する副作用が一切ない。
  function screenToLatLng(px, py) {
    if (!globeInstance) return null;
    const camera = globeInstance.camera();
    const container = $("map-globe-container");
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h || !camera) return null;

    const fovRad = ((camera.fov || 50) * Math.PI) / 180;
    const aspect = camera.aspect || w / h;
    const ndcX = (px / w) * 2 - 1;
    const ndcY = 1 - (py / h) * 2;
    const halfH = Math.tan(fovRad / 2);
    const halfW = halfH * aspect;
    const dCam = { x: ndcX * halfW, y: ndcY * halfH, z: -1 };

    // カメラのワールド回転(matrixWorldInverseの上3x3の転置)でワールド空間の方向に変換する
    const e = camera.matrixWorldInverse.elements;
    const dir = normalizeVec({
      x: e[0] * dCam.x + e[1] * dCam.y + e[2] * dCam.z,
      y: e[4] * dCam.x + e[5] * dCam.y + e[6] * dCam.z,
      z: e[8] * dCam.x + e[9] * dCam.y + e[10] * dCam.z,
    });
    const origin = camera.position;

    // 原点中心・半径GLOBE_RADIUSの球とのレイの交点を求める
    const b = origin.x * dir.x + origin.y * dir.y + origin.z * dir.z;
    const c = origin.x * origin.x + origin.y * origin.y + origin.z * origin.z - GLOBE_RADIUS * GLOBE_RADIUS;
    const disc = b * b - c;
    if (disc < 0) return null; // 地球の外(背景)をタップした
    const t = -b - Math.sqrt(disc);
    if (t < 0) return null;
    const hit = { x: origin.x + t * dir.x, y: origin.y + t * dir.y, z: origin.z + t * dir.z };

    const iLen = Math.sqrt(hit.x * hit.x + hit.y * hit.y + hit.z * hit.z) || 1;
    const s = Math.acos(hit.y / iLen);
    const a = Math.atan2(hit.z, hit.x);
    const lat = 90 - (180 * s) / Math.PI;
    let lng = 90 - (180 * a) / Math.PI;
    if (a < -Math.PI / 2) lng -= 360;
    return { lat, lng };
  }
  function handleContainerClick(evt) {
    if (!globeInstance || !countryById) return;
    const container = $("map-globe-container");
    const rect = container.getBoundingClientRect();
    const px = evt.clientX - rect.left;
    const py = evt.clientY - rect.top;
    // globe.gl自身のonPolygonClickが、このイベントより後(または別タイミング)で
    // 選択を上書きしてしまうことがあるため、ピンとの近接一致による選択は
    // 次のタスクに遅延させ、必ず最後に(=確実に)反映されるようにする
    setTimeout(() => {
      const geo = screenToLatLng(px, py);
      if (!geo) return;

      let candidateIds = new Set(tapAssistIds);
      candidateIds.delete(selectedCountryId); // 選択中の国はタップ補助対象外
      if (currentRegionFilter !== "all") {
        // 非表示にしているピンは近接判定の対象からも外す(見えないピンがタップに反応すると混乱するため)
        candidateIds = new Set(
          [...candidateIds].filter((id) => {
            const c = countryById.get(id);
            return c && c.region === currentRegionFilter;
          })
        );
      }

      let best = null;
      let bestDist = Infinity;
      candidateIds.forEach((id) => {
        const c = countryById.get(id);
        if (!c) return;
        const dLat = geo.lat - c.lat;
        let dLng = geo.lng - c.lng;
        if (dLng > 180) dLng -= 360;
        if (dLng < -180) dLng += 360;
        const dist = Math.sqrt(dLat * dLat + dLng * dLng);
        const radius = HIT_RADIUS_DEG[id] || DEFAULT_HIT_RADIUS_DEG;
        if (dist <= radius && dist < bestDist) {
          best = c;
          bestDist = dist;
        }
      });
      // 一致するピンが無ければ何もしない(onPolygonClickが選択した内容をそのまま活かす)
      if (best) selectCountry(best, { moveCamera: false });
    }, 0);
  }

  function buildGlobe() {
    const container = $("map-globe-container");
    const Globe = window.Globe;

    globeInstance = new Globe(container)
      .backgroundColor("rgba(0,0,0,0)")
      .showAtmosphere(true)
      .atmosphereColor("#bfe4ff")
      .atmosphereAltitude(0.18)
      .polygonsData(geoFeatures)
      .polygonCapColor(polygonCapColor)
      .polygonSideColor(polygonSideColor)
      .polygonStrokeColor(polygonStrokeColor)
      .polygonAltitude(polygonAltitude)
      .polygonsTransitionDuration(200)
      .onPolygonClick(handlePolygonClick)
      .onGlobeReady(() => {
        resizeGlobe();
        globeInstance.pointOfView({ lat: 15, lng: 30, altitude: INITIAL_VIEW_ALTITUDE }, 0);
        startAutoRotate();
        refreshNormalPinVisibility();
      });

    // 衛星写真ではなく、国境が見やすい明るい水色の海にする。
    // このglobe.glビルドはwindow.THREEを公開していないため、new THREE.Material(...)は使えない。
    // 代わりにglobeMaterial()を引数なしで呼び、既存のマテリアルインスタンスを取得して
    // その場でcolorだけ書き換える(Kapsuleアクセサの取得/設定パターン)
    const material = globeInstance.globeMaterial();
    if (material && material.color && typeof material.color.set === "function") {
      material.color.set("#8ecae6");
      if ("shininess" in material) material.shininess = 6;
    }

    const controls = globeInstance.controls();
    controls.enableDamping = true;
    controls.minDistance = 120;
    controls.maxDistance = 500;

    // 通常ピンの表示対象(PIN_TARGET_IDS)は固定リストなので、
    // ドラッグ回転・ピンチ/ホイールズームのたびに再計算する必要はない。
    // 通常ピンの画面座標そのものはtickNormalPins()のRAFループが毎フレーム追従する。

    // 通常ピン(HTML要素)自体はクリックを受け取れないため、コンテナ側のclickで
    // 近接判定を行う。globe.gl自身のonPolygonClickはcanvas(コンテナの子要素)側で
    // 先に発火してからこのイベントがバブリングしてくるため、ピンに近い場合だけ
    // ここで選択内容を上書きする形になる
    container.addEventListener("click", handleContainerClick);
    // 地球儀を直接操作し始めたら、開いたままの地域ドロップダウンは閉じる
    container.addEventListener("pointerdown", closeRegionList, { passive: true });

    // 最初にユーザーが触れた瞬間だけ自動回転を止める
    ["pointerdown", "wheel", "touchstart"].forEach((evt) => {
      container.addEventListener(evt, stopAutoRotateOnce, { passive: true });
    });

    window.addEventListener("resize", resizeGlobe);
  }

  function resizeGlobe() {
    if (!globeInstance) return;
    const container = $("map-globe-container");
    globeInstance.width(container.clientWidth);
    globeInstance.height(container.clientHeight);
    positionPinsToggleButton();
    positionInfoCardForDesktop();
  }

  function startAutoRotate() {
    if (hasInteracted || !globeInstance) return;
    const controls = globeInstance.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;
  }
  function stopAutoRotateOnce() {
    if (hasInteracted || !globeInstance) return;
    hasInteracted = true;
    globeInstance.controls().autoRotate = false;
  }

  // 地球儀への直接タップは「今見ている画面をユーザーが自分で作った状態」として
  // 一切動かさない。検索からの選択だけ、その国までカメラを移動してよい
  function handlePolygonClick(feature) {
    const country = feature && countryByMapCode.get(feature.id);
    if (!country) return;
    selectCountry(country, { moveCamera: false });
  }

  // 地図タップ・検索のどちらから来ても、この共通処理で国を選択する。
  // moveCameraをfalseにすると、選択状態の更新と情報カード表示だけを行い、
  // 現在のズーム倍率・向き・位置には一切触れない
  // 選択用の赤📍+国名ラベルを出す対象かどうかは、赤い📍を表示する対象と
  // 同じPIN_TARGET_IDSで判定する。コスタリカなど普通に形が見える国を選択
  // した場合は、黄色いポリゴン+情報カードだけでよく、この表示は出さない
  function isPinEligible(id) {
    return PIN_TARGET_IDS.has(id);
  }

  function selectCountry(country, options) {
    const moveCamera = !options || options.moveCamera !== false;
    hasInteracted = true;
    selectedCountryId = country.id;
    // 選択した瞬間のピン対象状態を固定する。選択中にズームが変わっても
    // ラベル表示・非表示が途中で切り替わってちらつかないようにするため
    selectedShowsLabel = isPinEligible(country.id);

    if (globeInstance) {
      globeInstance.controls().autoRotate = false;
      refreshPolygonStyles();
      refreshNormalPinVisibility();
      if (selectedShowsLabel) {
        startLabelTracking(country);
      } else {
        stopLabelTracking();
      }
      if (moveCamera) {
        // 現在の視点を大きく失わない程度に、対象の国へゆっくり移動する。
        // 南極大陸は他の国よりはるかに広いため、通常の1.5では画面に収まりきらない。
        // 大陸全体が見える高めのズームにする
        const altitude = country.id === "antarctica" ? 2.0 : 1.5;
        globeInstance.pointOfView({ lat: country.lat, lng: country.lng, altitude }, 1200);
      }
    }
    renderInfoCard(country);
    closeSearchSuggestions();
  }

  function renderInfoCard(country) {
    const flagImg = $("map-card-flag");
    flagImg.src = country.flag;
    // 南極大陸は国家ではなく、公式な国旗が存在しないため「国旗」とは呼ばない
    // (実際に表示しているのは中立的なアイコンで、国旗の代わりではない)
    flagImg.alt = country.id === "antarctica" ? `${country.name}のアイコン` : `${country.name}の国旗`;
    $("map-card-name").textContent = country.name;
    $("map-card-region").textContent = country.regionJa;

    // 通常の国は「首都：〇〇」、香港・マカオは「区分：中国の特別行政区」、
    // グリーンランド・フェロー諸島は「中心都市：〇〇」のように、
    // 国・地域ごとに見出しと値を切り替えられるようにする
    $("map-card-capital-label-text").textContent = country.infoLabel || "首都";
    let valueText;
    if (country.infoValue) {
      valueText = country.infoValue;
    } else if (country.capitals && country.capitals.length) {
      valueText = country.capitals.map((c) => `${c.name}(${c.type})`).join(" / ");
    } else {
      valueText = country.capital;
    }
    $("map-card-capital").textContent = valueText;
    $("map-card-desc").textContent = country.description;

    $("map-info-card").classList.remove("hidden");
    // 既にカードが開いている状態で別の国を選んだ場合も、
    // 閉じ直さずそのまま内容だけ切り替わる
    requestAnimationFrame(() => $("map-info-card").classList.add("open"));
  }

  function closeInfoCard() {
    $("map-info-card").classList.remove("open");
    selectedCountryId = null;
    selectedShowsLabel = false;
    stopLabelTracking();
    refreshPolygonStyles();
    refreshNormalPinVisibility();
  }

  // ---------- 検索 ----------
  // ひらがな⇔カタカナの表記ゆれを吸収するため、カタカナに正規化してから比較する
  // (例:「に」と入力しても「ニュージーランド」等のカタカナ国名にヒットさせる)
  function toKatakana(str) {
    return str.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
  }

  function matchesQuery(country, query) {
    const q = toKatakana(query);
    const ql = query.toLowerCase();
    if (toKatakana(country.name).includes(q)) return true;
    if (country.aliases && country.aliases.some((a) => toKatakana(a).includes(q))) return true;
    if (country.englishName && country.englishName.toLowerCase().includes(ql)) return true;
    return false;
  }

  function renderSearchResults(query) {
    const list = $("map-search-results");
    list.innerHTML = "";
    if (!query) {
      list.classList.add("hidden");
      return;
    }
    // 国名が検索語で「始まる」候補を先に、それ以外(語の途中に含む)は後に表示する
    const q = toKatakana(query);
    const startsWith = [];
    const contains = [];
    allMapCountries.forEach((c) => {
      if (!matchesQuery(c, query)) return;
      if (toKatakana(c.name).startsWith(q)) startsWith.push(c);
      else contains.push(c);
    });
    const matches = [...startsWith, ...contains].slice(0, 8);
    if (!matches.length) {
      const li = document.createElement("li");
      li.className = "map-search-empty";
      li.textContent = "見つかりませんでした";
      list.appendChild(li);
      list.classList.remove("hidden");
      return;
    }
    matches.forEach((c) => {
      const li = document.createElement("li");
      li.className = "map-search-item";
      const img = document.createElement("img");
      img.src = c.flag;
      img.alt = "";
      img.className = "map-search-flag";
      const span = document.createElement("span");
      span.textContent = c.name;
      li.appendChild(img);
      li.appendChild(span);
      li.addEventListener("click", () => {
        $("map-search-input").value = "";
        // 「検索したのにフィルターのせいで見えない」という混乱を防ぐため、
        // 検索からの選択は常に地域フィルターを全世界に戻してから移動する
        if (currentRegionFilter !== "all") applyRegionFilter("all", { moveCamera: false });
        selectCountry(c);
      });
      list.appendChild(li);
    });
    list.classList.remove("hidden");
  }

  function closeSearchSuggestions() {
    $("map-search-results").classList.add("hidden");
    $("map-search-results").innerHTML = "";
  }

  // ---------- 地域フィルター(v1.2) ----------
  function updateRegionListHighlight() {
    const list = $("map-region-list");
    Array.from(list.children).forEach((li) => {
      li.classList.toggle("active", li.dataset.region === currentRegionFilter);
    });
  }
  function buildRegionList() {
    const list = $("map-region-list");
    list.innerHTML = "";
    REGION_ORDER.forEach((region) => {
      const li = document.createElement("li");
      li.className = "map-region-item";
      li.textContent = REGION_LABELS[region];
      li.dataset.region = region;
      li.addEventListener("click", () => selectRegion(region));
      list.appendChild(li);
    });
    updateRegionListHighlight();
  }
  function openRegionList() {
    closeSearchSuggestions();
    $("map-region-list").classList.remove("hidden");
    $("map-region-btn").setAttribute("aria-expanded", "true");
  }
  function closeRegionList() {
    $("map-region-list").classList.add("hidden");
    $("map-region-btn").setAttribute("aria-expanded", "false");
  }
  function toggleRegionList() {
    if ($("map-region-list").classList.contains("hidden")) openRegionList();
    else closeRegionList();
  }
  function selectRegion(region) {
    applyRegionFilter(region);
    closeRegionList();
  }
  // 地域フィルターの本体。"all"のときは色・ピンとも既存の見た目に完全に戻す。
  // moveCameraをfalseにすると、フィルターの見た目だけ変えてカメラは動かさない
  // (検索選択時に「全世界へ戻す」ためだけに使う内部的な呼び出し用)
  function applyRegionFilter(region, options) {
    const moveCamera = !options || options.moveCamera !== false;
    currentRegionFilter = region;
    $("map-region-btn-label").textContent = REGION_LABELS[region];
    updateRegionListHighlight();
    refreshPolygonStyles();
    refreshNormalPinVisibility();
    if (moveCamera && globeInstance && region !== "all") {
      const center = regionCenters && regionCenters[region];
      if (center) {
        hasInteracted = true;
        globeInstance.controls().autoRotate = false;
        globeInstance.pointOfView({ lat: center.lat, lng: center.lng, altitude: center.altitude }, 1400);
      }
    }
  }

  // ---------- ランダムな国へ(v1.2) ----------
  // 現在の地域フィルターに応じた候補プールから1件選ぶ。直近に選ばれた
  // 最大5件は優先的に除外し、候補が尽きたら段階的に除外条件を緩める
  function getRegionPool(region) {
    const pool = region === "all" ? allMapCountries : allMapCountries.filter((c) => c.region === region);
    // 南極大陸のように国ではない項目(randomEligible: false)は
    // 「ランダムな国へ」の候補から除外する
    return pool.filter((c) => c.randomEligible !== false);
  }
  function pickRandomCountry() {
    const pool = getRegionPool(currentRegionFilter);
    if (!pool.length) return null;
    let candidates = pool.filter((c) => !previousRandomIds.includes(c.id));
    if (!candidates.length) candidates = pool.filter((c) => c.id !== previousRandomIds[0]);
    if (!candidates.length) candidates = pool;
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    previousRandomIds.unshift(chosen.id);
    previousRandomIds = previousRandomIds.slice(0, 5);
    return chosen;
  }
  function handleRandomClick() {
    const btn = $("map-random-btn");
    if (btn.disabled) return;
    const country = pickRandomCountry();
    if (!country) return;
    closeRegionList();
    closeSearchSuggestions();
    // ボタン連打で複数のカメラアニメーションが競合しないよう、
    // 移動アニメーション中はボタンを一時的に無効化する
    btn.disabled = true;
    clearTimeout(randomFlightTimer);
    randomFlightTimer = setTimeout(() => { btn.disabled = false; }, 1300);
    // 検索選択と全く同じ経路(moveCamera:true)で選択するため、到着後の状態
    // (選択表示・ピン非表示・ラベル・情報カード)は検索と完全に同一になる
    selectCountry(country, { moveCamera: true });
  }

  // ---------- 画面の開閉(タブを行き来してもデータは再取得しない) ----------
  function open() {
    ensureReady()
      .then(() => {
        if (globeInstance) {
          globeInstance.resumeAnimation();
          resizeGlobe();
          // close()で止めた通常ピンの位置追従ループを再開する
          refreshNormalPinVisibility();
        }
      })
      .catch(() => {
        // エラー・非対応時のメッセージはensureReady内で表示済み。
        // 世界地図画面には留まれるので、他モードへの影響はない。
      });
  }

  // 画面を離れるときはレンダリングを止めてバッテリー消費を抑える
  function close() {
    if (globeInstance) globeInstance.pauseAnimation();
    stopLabelTracking();
    stopNormalPinsLoop();
    closeSearchSuggestions();
    closeRegionList();
  }

  function initEvents() {
    $("btn-map-back").addEventListener("click", () => {
      close();
      showScreen("screen-top");
    });
    $("map-unsupported-back").addEventListener("click", () => showScreen("screen-top"));
    $("map-card-close").addEventListener("click", closeInfoCard);
    $("map-search-input").addEventListener("input", (e) => {
      renderSearchResults(e.target.value.trim());
    });
    $("map-search-input").addEventListener("focus", closeRegionList);
    buildRegionList();
    $("map-region-btn").addEventListener("click", toggleRegionList);
    $("map-random-btn").addEventListener("click", handleRandomClick);
    updatePinsToggleButton();
    $("map-pins-toggle-btn").addEventListener("click", togglePinsVisible);
  }

  return { open, close, initEvents };
})();

document.addEventListener("DOMContentLoaded", () => MapModule.initEvents());
