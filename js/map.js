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
  let countryByMapCode = null;
  let countryById = null;
  let countryAngularSize = null; // country.id -> 実ポリゴンのバウンディングボックス角度(度)
  let selectedCountryId = null;
  let initPromise = null;
  let hasInteracted = false;
  let pinRecomputeTimer = null;

  // ポリゴン形状が無いために合成円(タップ判定専用、非表示。半径約1.6度)を
  // 使っている極小国は、ズームレベルに関わらず常に小さいピンで表示し続ける
  const ALWAYS_PIN_IDS = new Set(["va", "mc", "sm", "mv", "nr", "tv"]);
  // 画面上のおおよその見かけサイズ(px)がこの値を下回ったらピン表示、
  // 上回ったらピンを消す。25〜35pxの間は前回の表示状態を維持する(ヒステリシス)ことで
  // ズーム境界でピンが激しく点滅しないようにする
  const PIN_SHOW_PX = 25;
  const PIN_HIDE_PX = 35;
  let dynamicPinIds = new Set();

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
    countryByMapCode = new Map();
    countryById = new Map();
    COUNTRIES.forEach((c) => {
      countryById.set(c.id, c);
      if (c.mapCode) countryByMapCode.set(c.mapCode, c);
    });
    buildAngularSizeIndex();
  }

  // 各国の実ポリゴンのバウンディングボックス角度(緯度幅・経度幅の大きい方)を
  // 一度だけ計算しておく(タップ判定用の合成円しか持たない極小6か国は対象外)
  function buildAngularSizeIndex() {
    countryAngularSize = new Map();
    geoFeatures.forEach((f) => {
      if (f.properties && f.properties.isSyntheticMarker) return;
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
  // 通常の国は緑系、選択中の国だけオレンジ系にする(他の国の色は変えない)
  function isSelected(feat) {
    const c = countryByMapCode.get(feat.id);
    return !!c && c.id === selectedCountryId;
  }
  // 極小国のタップ判定用合成円は、大きな円としてそのまま見せると周囲の地図を
  // 隠してしまうため、常に透明にする(選択状態は下記のピンの見た目で示す)
  function isInvisibleHitArea(feat) {
    return !!(feat.properties && feat.properties.isSyntheticMarker);
  }
  function polygonCapColor(feat) {
    if (isInvisibleHitArea(feat)) return "rgba(0, 0, 0, 0)";
    return isSelected(feat) ? "#ffb100" : "rgba(139, 195, 143, 0.95)";
  }
  function polygonSideColor(feat) {
    if (isInvisibleHitArea(feat)) return "rgba(0, 0, 0, 0)";
    return isSelected(feat) ? "rgba(255, 177, 0, 0.45)" : "rgba(90, 130, 100, 0.25)";
  }
  function polygonStrokeColor(feat) {
    if (isInvisibleHitArea(feat)) return "rgba(0, 0, 0, 0)";
    return isSelected(feat) ? "#8a5500" : "#3f5c4c";
  }
  function polygonAltitude(feat) {
    // 透明なタップ判定円は、周辺国(高くても0.02)より確実に高く(＝カメラに近く)
    // しておかないと、重なった部分で隣国のポリゴンにタップを奪われてしまう
    if (isInvisibleHitArea(feat)) return 0.03;
    return isSelected(feat) ? 0.02 : 0.006;
  }
  function refreshPolygonStyles() {
    if (!globeInstance) return;
    globeInstance
      .polygonCapColor(polygonCapColor)
      .polygonSideColor(polygonSideColor)
      .polygonStrokeColor(polygonStrokeColor)
      .polygonAltitude(polygonAltitude);
  }

  // ---------- 小国ピン(見た目)。タップ判定は上のポリゴン(透明)側が担当する ----------
  // 白い縁取り(halo)+ オレンジの本体(fill)+ 選択時だけ薄い外側リング(ring)の
  // 3層を同じ緯度経度に重ねて描画し、シンプルなピンに見せる
  function pinColor(d) {
    if (d._pinKind === "ring") return "rgba(255, 177, 0, 0.28)";
    if (d._pinKind === "halo") return "#ffffff";
    return "#ffb100";
  }
  function pinRadius(d) {
    const sel = d._selected;
    if (d._pinKind === "ring") return 0.62;
    if (d._pinKind === "halo") return sel ? 0.4 : 0.3;
    return sel ? 0.3 : 0.2;
  }
  function pinAltitude(d) {
    if (d._pinKind === "ring") return 0.004;
    if (d._pinKind === "halo") return 0.009;
    return 0.013;
  }
  function buildPinData() {
    const ids = new Set(ALWAYS_PIN_IDS);
    dynamicPinIds.forEach((id) => ids.add(id));
    const data = [];
    ids.forEach((id) => {
      const c = countryById.get(id);
      if (!c) return;
      const selected = id === selectedCountryId;
      if (selected) data.push({ ...c, _pinKind: "ring", _selected: true });
      data.push({ ...c, _pinKind: "halo", _selected: selected });
      data.push({ ...c, _pinKind: "fill", _selected: selected });
    });
    return data;
  }
  function refreshPins() {
    if (!globeInstance) return;
    globeInstance
      .pointsData(buildPinData())
      .pointLat((d) => d.lat)
      .pointLng((d) => d.lng)
      .pointColor(pinColor)
      .pointRadius(pinRadius)
      .pointAltitude(pinAltitude)
      .pointResolution(16)
      .pointsMerge(false)
      .pointsTransitionDuration(0);
  }

  // ---------- ズームに応じたピン表示の切り替え ----------
  // globe.glの透視投影を簡易近似した式(fov≈50°相当で較正)で、実ポリゴンの
  // おおよその画面上サイズ(px)を見積もる。198件すべてに対して毎フレーム
  // 計算するのではなく、ユーザーの操作が一段落したタイミングでのみ実行する
  function estimateApparentPx(angularSizeDeg, altitude) {
    const CALIBRATION_K = 15.6;
    return (CALIBRATION_K * angularSizeDeg) / (1 + altitude);
  }
  function recomputePinVisibility() {
    if (!globeInstance || !countryAngularSize) return;
    const pov = globeInstance.pointOfView();
    const altitude = pov && typeof pov.altitude === "number" ? pov.altitude : 2.3;
    const next = new Set();
    countryAngularSize.forEach((deg, id) => {
      const px = estimateApparentPx(deg, altitude);
      if (px < PIN_SHOW_PX) next.add(id);
      else if (px <= PIN_HIDE_PX && dynamicPinIds.has(id)) next.add(id);
    });
    dynamicPinIds = next;
    refreshPins();
  }
  // ドラッグ/ピンチ中に毎フレーム再計算しないよう、操作が止まってから実行する
  function schedulePinRecompute(delay) {
    clearTimeout(pinRecomputeTimer);
    pinRecomputeTimer = setTimeout(recomputePinVisibility, delay);
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
        globeInstance.pointOfView({ lat: 15, lng: 30, altitude: 2.3 }, 0);
        startAutoRotate();
        recomputePinVisibility();
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

    // ドラッグ回転・ピンチ/ホイールズームのどれでも'change'が発火するので、
    // ここでピン表示の再計算をdebounceする(毎フレーム計算する重い設計を避ける)
    controls.addEventListener("change", () => schedulePinRecompute(200));

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
  function selectCountry(country, options) {
    const moveCamera = !options || options.moveCamera !== false;
    hasInteracted = true;
    selectedCountryId = country.id;

    if (globeInstance) {
      globeInstance.controls().autoRotate = false;
      refreshPolygonStyles();
      refreshPins();
      if (moveCamera) {
        // 現在の視点を大きく失わない程度に、対象の国へゆっくり移動する
        globeInstance.pointOfView({ lat: country.lat, lng: country.lng, altitude: 1.5 }, 1200);
        // 移動先でのズーム率に合わせて、ピン表示を移動完了後に再計算する
        schedulePinRecompute(1300);
      }
    }
    renderInfoCard(country);
    closeSearchSuggestions();
  }

  function renderInfoCard(country) {
    const flagImg = $("map-card-flag");
    flagImg.src = country.flag;
    flagImg.alt = `${country.name}の国旗`;
    $("map-card-name").textContent = country.name;
    $("map-card-region").textContent = country.regionJa;

    const capitalText =
      country.capitals && country.capitals.length
        ? country.capitals.map((c) => `${c.name}(${c.type})`).join(" / ")
        : country.capital;
    $("map-card-capital").textContent = capitalText;
    $("map-card-desc").textContent = country.description;

    $("map-info-card").classList.remove("hidden");
    // 既にカードが開いている状態で別の国を選んだ場合も、
    // 閉じ直さずそのまま内容だけ切り替わる
    requestAnimationFrame(() => $("map-info-card").classList.add("open"));
  }

  function closeInfoCard() {
    $("map-info-card").classList.remove("open");
    selectedCountryId = null;
    refreshPolygonStyles();
    refreshPins();
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
    COUNTRIES.forEach((c) => {
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

  // ---------- 画面の開閉(タブを行き来してもデータは再取得しない) ----------
  function open() {
    ensureReady()
      .then(() => {
        if (globeInstance) {
          globeInstance.resumeAnimation();
          resizeGlobe();
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
    closeSearchSuggestions();
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
  }

  return { open, close, initEvents };
})();

document.addEventListener("DOMContentLoaded", () => MapModule.initEvents());
