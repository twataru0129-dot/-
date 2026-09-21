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
  let pinRecomputeTimer = null;
  let labelRAF = null;

  // ---------- 地域フィルター(v1.2) ----------
  // "all"のときは既存(v1.1以前)の見た目・挙動を完全に維持する。
  // countries.js / map-regions.jsのregionフィールドをそのまま再利用するため、
  // 新しいデータ構造は追加していない
  const REGION_ORDER = ["all", "asia", "europe", "africa", "namerica", "samerica", "oceania"];
  const REGION_LABELS = {
    all: "🌍 全世界",
    asia: "🌏 アジア",
    europe: "🌍 ヨーロッパ",
    africa: "🌍 アフリカ",
    namerica: "🌎 北アメリカ・中央アメリカ・カリブ",
    samerica: "🌎 南アメリカ",
    oceania: "🌏 オセアニア",
  };
  let currentRegionFilter = "all";
  let regionCenters = null; // region -> {lat,lng,altitude}。allMapCountriesから一度だけ算出する
  let randomFlightTimer = null;
  let previousRandomIds = []; // 直近に選ばれたID(最大5件)を保持し、連続・近接重複を避ける

  // 実ポリゴンが極小で常にタップしづらい国・地域は、ズームレベルに関わらず
  // 常に小さいピンで表示し続ける(それ以外の国は下記の画面上サイズに応じた動的判定)
  const ALWAYS_PIN_IDS = new Set(["va", "mc", "sm", "mv", "nr", "tv"]);
  // 画面上のおおよその見かけサイズ(px)がこの値を下回ったらピン表示、
  // 上回ったらピンを消す。25〜35pxの間は前回の表示状態を維持する(ヒステリシス)ことで
  // ズーム境界でピンが激しく点滅しないようにする
  const PIN_SHOW_PX = 25;
  const PIN_HIDE_PX = 35;
  let dynamicPinIds = new Set();

  // ピンはpointsDataレイヤーで描画しているが、このglobe.glビルドではpointsData自体は
  // クリックを受け取れないため、ピン表示中の国をタップできるように、緯度経度の近さで
  // 判定する専用のヒット半径(度)を持たせる(実ポリゴンが小さすぎて直接タップしづらい国ほど広め)
  const HIT_RADIUS_DEG = { va: 1.6, mc: 1.5, sm: 1.4, mv: 1.5, nr: 1.3, tv: 1.3 };
  const DEFAULT_HIT_RADIUS_DEG = 1.4;
  const GLOBE_RADIUS = 100; // globe.glの基準球半径(getCoords()の結果から実測して確認済み)

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
  function polygonAltitude(feat) {
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

  // ---------- 小国ピン(見た目)。タップ判定はscreenToLatLngによる近接判定が担当する ----------
  // 白い縁取り(halo)+ オレンジの本体(fill)の2層を同じ緯度経度に重ねて描画し、
  // シンプルなピンに見せる。選択中の国はここには含めない(下記buildPinDataを参照)。
  // 選択中はピンの代わりに国名ラベルと実ポリゴンのオレンジ表示で位置・形を示す。
  function pinColor(d) {
    return d._pinKind === "halo" ? "#ffffff" : "#ffb100";
  }
  function pinRadius(d) {
    return d._pinKind === "halo" ? 0.3 : 0.2;
  }
  function pinAltitude(d) {
    return d._pinKind === "halo" ? 0.009 : 0.013;
  }
  function buildPinData() {
    const ids = new Set(ALWAYS_PIN_IDS);
    dynamicPinIds.forEach((id) => ids.add(id));
    // 選択中の国は、ズームレベルに関わらずピンを常に非表示にする(通常のズーム連動
    // ロジックをオーバーライドする)。ピンの位置に実際の国・地域があることを
    // ラベルと実ポリゴンのハイライトで示すため、ピンと同時には表示しない。
    ids.delete(selectedCountryId);
    const data = [];
    ids.forEach((id) => {
      const c = countryById.get(id);
      if (!c) return;
      // 地域フィルター中は、他地域の小国ピンを非表示にして画面がピンだらけに
      // ならないようにする("all"のときは全ピンを従来どおり表示する)
      if (currentRegionFilter !== "all" && c.region !== currentRegionFilter) return;
      data.push({ ...c, _pinKind: "halo" });
      data.push({ ...c, _pinKind: "fill" });
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

  // ---------- 選択中の国名ラベル(ピンの代わりに表示する) ----------
  // このglobe.glビルドのhtmlElementsData/labelレイヤーには背景色を付けられないため、
  // カスタムのHTML<div>を自前のスクリーン座標計算で追従させる。
  // 計算対象は「現在選択中の1地点」だけであり、198件全体を毎フレーム計算するような
  // 重い処理ではないため、requestAnimationFrameで継続更新してもパフォーマンス上問題ない。
  function normalizeVec(v) {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }
  function dotVec(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }
  // 4x4行列(three.jsのcolumn-major elements配列)とベクトルの掛け算
  function transformVec4(elements, x, y, z, w) {
    const e = elements;
    return {
      x: e[0] * x + e[4] * y + e[8] * z + e[12] * w,
      y: e[1] * x + e[5] * y + e[9] * z + e[13] * w,
      z: e[2] * x + e[6] * y + e[10] * z + e[14] * w,
      w: e[3] * x + e[7] * y + e[11] * z + e[15] * w,
    };
  }
  // 緯度経度(+高度)をスクリーン上のピクセル座標に変換する。
  // 地球の裏側にある場合や画面外に大きく外れる場合はnullを返す。
  function projectLatLngToScreen(lat, lng, altitude) {
    if (!globeInstance) return null;
    const camera = globeInstance.camera();
    if (!camera || !camera.matrixWorldInverse || !camera.projectionMatrix) return null;
    const world = globeInstance.getCoords(lat, lng, altitude);

    // カメラから見て地球の裏側(水平線の向こう)にある地点は表示しない
    const camDir = normalizeVec(camera.position);
    const pointDir = normalizeVec(world);
    if (dotVec(camDir, pointDir) < 0.15) return null;

    const view = transformVec4(camera.matrixWorldInverse.elements, world.x, world.y, world.z, 1);
    const clip = transformVec4(camera.projectionMatrix.elements, view.x, view.y, view.z, view.w);
    if (clip.w <= 0) return null;
    const ndcX = clip.x / clip.w;
    const ndcY = clip.y / clip.w;
    if (ndcX < -1.15 || ndcX > 1.15 || ndcY < -1.15 || ndcY > 1.15) return null;

    const container = $("map-globe-container");
    const w = container.clientWidth;
    const h = container.clientHeight;
    return { x: (ndcX * 0.5 + 0.5) * w, y: (1 - (ndcY * 0.5 + 0.5)) * h };
  }
  function updateLabelPosition(country) {
    const labelEl = $("map-country-label");
    const pos = projectLatLngToScreen(country.lat, country.lng, 0.02);
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
    labelEl.style.top = `${cRect.top - wRect.top + pos.y - 14}px`;
  }
  function stopLabelTracking() {
    if (labelRAF !== null) {
      cancelAnimationFrame(labelRAF);
      labelRAF = null;
    }
    $("map-country-label").classList.add("hidden");
  }
  function startLabelTracking(country) {
    stopLabelTracking();
    const labelEl = $("map-country-label");
    labelEl.textContent = country.name;
    const tick = () => {
      updateLabelPosition(country);
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

      let candidateIds = new Set(ALWAYS_PIN_IDS);
      dynamicPinIds.forEach((id) => candidateIds.add(id));
      candidateIds.delete(selectedCountryId); // 選択中の国はピンが無いので対象外
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

    // pointsData(ピン)自体はクリックを受け取れないため、コンテナ側のclickで
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
  function isPinEligible(id) {
    return ALWAYS_PIN_IDS.has(id) || dynamicPinIds.has(id);
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
      refreshPins();
      if (selectedShowsLabel) {
        startLabelTracking(country);
      } else {
        stopLabelTracking();
      }
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
    recomputePinVisibility();
    if (moveCamera && globeInstance && region !== "all") {
      const center = regionCenters && regionCenters[region];
      if (center) {
        hasInteracted = true;
        globeInstance.controls().autoRotate = false;
        globeInstance.pointOfView({ lat: center.lat, lng: center.lng, altitude: center.altitude }, 1400);
        schedulePinRecompute(1500);
      }
    }
  }

  // ---------- ランダムな国へ(v1.2) ----------
  // 現在の地域フィルターに応じた候補プールから1件選ぶ。直近に選ばれた
  // 最大5件は優先的に除外し、候補が尽きたら段階的に除外条件を緩める
  function getRegionPool(region) {
    if (region === "all") return allMapCountries;
    return allMapCountries.filter((c) => c.region === region);
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
  }

  return { open, close, initEvents };
})();

document.addEventListener("DOMContentLoaded", () => MapModule.initEvents());
