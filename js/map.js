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
  let selectedCountryId = null;
  let selectedShowsLabel = false; // 選択中の国が「ピン→ラベル切り替え」対象かどうか(選択した瞬間に固定する)
  let tempSearchMarkerId = null; // 検索・ランダム選択時、自動ズームしても極小のため一時的な目印(📍)を出す対象の国id(それ以外はnull)
  let initPromise = null;
  // 世界地図画面が実際に表示されているかどうか。open()/close()でだけ
  // 更新する。読み込み完了(ensureReady()のthen/onGlobeReady)が、ユーザーが
  // 既にトップへ戻った後に遅れて発火した場合でも、この値をそのタイミングで
  // 読むことで「今の画面状態」を正しく判定できる(呼び出し時点の値を
  // 変数にコピーして使い回すと、古い状態のまま判定してしまうため避ける)
  let isMapScreenActive = false;
  let isRandomFlightInProgress = false; // ランダム移動のカメラアニメーション中だけtrue
  let hasInteracted = false;
  let trackedCountry = null; // 選択中で、国名ラベルを追従させる対象(非選択時はnull)
  let countryGeoById = new Map(); // id -> {lat,lng,area,sizeDeg,minLat,maxLat,minLng,maxLng,polys}(GeoJSON読み込み時に一度だけ算出、下記computeCountryGeoInfo参照)
  let pinAnchorById = new Map(); // id -> {lat,lng}。countryGeoByIdのうちPIN_TARGET_IDSだけを抜き出したもの(📍表示用)
  let pinClasses = null; // 📍の3Dオブジェクト構築に使うThree.jsクラス一式(起動時に一度だけ取得する、下記参照)
  let currentPinData = []; // 現在objectsData()に渡しているピンのデータ(描画直前のサイズ調整に使う)
  let tapDebugEnabled = false; // タップ診断モード(下記「タップ診断モード」セクション参照)
  let tapDebugLog = [];
  let tapDebugPendingDown = null; // {x,y} | null。pointerdown後にclickが来たかどうかの判定に使う

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
  // 見た目(📍の3Dオブジェクト)だけを切り替える。PIN_TARGET_IDSや
  // タップ判定(handleMapTap)はこのフラグに関係なく常に生きたままにする
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

  // ---------- 見た目の通常ピン対象(固定リスト) ----------
  // 「ズームしても場所や形が分かりづらい、本当に小さい国・地域」だけを
  // 手動で選定した固定リスト。国の面積・見かけサイズから自動的に対象を
  // 増減させる仕組みは通常ピンの表示には使わない(タップ判定は別の仕組み
  // (下記、全ての国・地域が対象)で行うため、こことは目的が異なる)。
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

  // ---------- タップ判定(v3、全国・地域を対象にした一般化版) ----------
  // 画面上の見かけサイズ(px)がこの値を下回る国・地域は「タップしづらい小さな
  // 対象」とみなし、下記のタップ補助(画面座標ベースの近接判定)の対象になる。
  // PIN_TARGET_IDSのような固定リストではなく、現在のズーム状態から毎回動的に
  // 判定するため、将来国・地域が追加されても自動的に対応し、ズームすれば
  // 自然に補助対象から外れる(直接タップだけで選択できるようになる)
  const TAP_ASSIST_ELIGIBLE_PX = 30;
  // タップ補助の実際のヒット半径(画面CSSピクセル)。指で押しやすい範囲を
  // 確保しつつ、近接する小国同士(グレナダ/セントビンセント、香港/マカオ等)で
  // 誤判定が起きないよう、実測を踏まえて小さめに抑えている
  const TAP_ASSIST_RADIUS_PX = 20;
  // (旧)タップ補助の候補と実ポリゴンへの直接ヒットが別の国・地域を指している
  // 場合に補助側を優先してよいと判断していた距離(px)のしきい値は廃止した。
  // アンカーからの単純な円形の距離だけでは、📍の絵が実際には描かれていない
  // 方向(例えば真横や真下)へのタップまで「ピン自体を狙った」と誤判定して
  // しまう(例: 中国本土を正しくタップしても、香港のアンカーから17px以内なら
  // 香港が選ばれてしまう)。代わりに、下記isNearPinShape()で📍の実際の
  // 見た目の形状(頭の円+針の先細りする円錐)に対してタップ地点を判定する
  // タップ(クリック)とドラッグ/ピンチ操作を区別するための移動量のしきい値。
  // pointerdown〜click(≒pointerup)の間にこれを超えて指/マウスが動いていたら、
  // 回転・ズーム操作とみなしてタップ選択は行わない
  const TAP_MAX_MOVE_PX = 10;
  const GLOBE_RADIUS = 100; // globe.glの基準球半径(getCoords()の結果から実測して確認済み)
  const INITIAL_VIEW_ALTITUDE = 2.3; // 世界地図モードを開いたときの初期ズーム

  // ---------- タップ診断モード(開発・実機調査用、既定では常に無効) ----------
  // URLに ?mapTapDebug=1 を付けて開いたときだけ有効になる、タップ判定の内部
  // 状態を画面上に表示するための開発者向け機能。通常の利用では一切表示されず、
  // 外部への送信も行わない(画面上の表示とクリップボードへのコピーのみ)。
  // iPhone本体だけで「実際に何が起きたか」を確認できるようにするための機能で、
  // ブラウザの開発者ツールが使えない環境(実機のSafari等)での原因調査を想定している
  const TAP_DEBUG_QUERY_PARAM = "mapTapDebug";
  const TAP_DEBUG_MAX_ENTRIES = 40; // ログが無限に増え続けないよう直近の件数だけ保持
  const TAP_DEBUG_PENDING_TIMEOUT_MS = 900; // pointerdown後、この時間内にclickが来なければ「click未発生」として記録

  // ---------- 📍ピンの3Dオブジェクト化(v2) ----------
  // 国ポリゴン(polygonAltitude、下記)と同じ高度にすることで、ピンの先端
  // (針の先、下記buildPinObject参照)がちょうどポリゴン表面に接する
  const PIN_OBJECT_ALTITUDE = 0.006;
  const PIN_NEEDLE_COLOR = 0xb91c1c;
  const PIN_HEAD_COLOR = 0xe53935;
  const PIN_SELECTED_SCALE = 1.3; // 選択中の国のピンは少し大きくし、選択状態を分かりやすくする
  // 📍の画面上の高さ(CSSピクセル)。iPhoneの文章中に表示される絵文字「📍」程度の
  // 大きさを基準にする。ワールド座標の固定サイズだと、ズームインで巨大化・
  // ズームアウトで極小化するため、描画直前にカメラとの距離から3Dオブジェクトの
  // スケールを毎フレーム計算し直し、画面上の見かけの大きさを一定に保つ
  // (CSSピクセル基準なので、iPhone・iPad・PCで見た目の大きさがほぼ揃う)。
  // スケールの基準点はGroup原点(=針の先端)なので、拡大縮小しても先端の位置は動かない
  const PIN_SCREEN_HEIGHT_PX = 18;
  // 📍本体(球形の頭+円錐の針)の形状パラメータ。buildPinObject()と、下記の
  // 「タップ地点が📍の実際の見た目の形の上にあるか」の判定(isNearPinShape)の
  // 両方で共有する(数値の二重管理を避けるため、ここで一度だけ定義する)
  const PIN_SHAPE = (() => {
    const headR = 0.3, needleH = 0.48, needleBaseR = 0.085;
    const headCenterY = needleH + headR * 0.75; // 頭と針の付け根を少し重ねる
    const totalH = headCenterY + headR; // =1.005 → 1に正規化
    return { headR, needleH, needleBaseR, headCenterY, totalH, k: 1 / totalH };
  })();
  // PIN_SHAPEの形状を、実際の画面上の高さ(PIN_SCREEN_HEIGHT_PX)まで拡大した
  // ときの、各部位の画面ピクセル単位での寸法。ズーム倍率に関わらず常に一定
  // (group.scaleが常にPIN_SCREEN_HEIGHT_PX相当になるよう毎フレーム調整される
  // ため)なので、一度だけ計算しておける
  const PIN_SCREEN_SHAPE = (() => {
    const { headR, needleH, needleBaseR, headCenterY, k } = PIN_SHAPE;
    return {
      headRadiusPx: headR * k * PIN_SCREEN_HEIGHT_PX,
      headOffsetPx: headCenterY * k * PIN_SCREEN_HEIGHT_PX,
      needleLenPx: needleH * k * PIN_SCREEN_HEIGHT_PX,
      needleBaseRadiusPx: needleBaseR * k * PIN_SCREEN_HEIGHT_PX,
    };
  })();
  // 📍の実際のグラフィック(頭の半径・針の太さは数pxしかない)に対し、指で
  // 押しやすいようふくらませる許容量(px)。この値を大きくしすぎると、
  // 近くの別の国の地形を直接タップした場合でも📍に奪われやすくなるため、
  // 「指1本で狙える程度」の範囲にとどめている
  const TAP_PIN_SHAPE_TOLERANCE_PX = 8;

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

  // globe.glのスクリプトタグを一度だけ挿入する(複数回openしても再読み込みしない)。
  // 一度読み込みに失敗したタグは、二度とload/errorイベントが発火しないため、
  // 残したままだと再試行時にPromiseが永遠に解決しなくなる。そのため、
  // 前回失敗したタグだけは取り除いてから新しく作り直す(読み込み中のタグは
  // そのまま再利用し、二重にリクエストしない)
  let globeScriptEl = null;
  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      if (window.Globe) { resolve(); return; }
      if (globeScriptEl && globeScriptEl.dataset.loadFailed === "1") {
        globeScriptEl.remove();
        globeScriptEl = null;
      }
      if (globeScriptEl) {
        globeScriptEl.addEventListener("load", () => resolve());
        globeScriptEl.addEventListener("error", () => reject(new Error("globe.glの読み込みに失敗しました")));
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => {
        script.dataset.loadFailed = "1";
        reject(new Error("globe.glの読み込みに失敗しました"));
      };
      document.body.appendChild(script);
      globeScriptEl = script;
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
  // 全ての国・地域について、実ポリゴンに基づく情報を一度だけまとめて計算する。
  // 以前は📍の表示対象(PIN_TARGET_IDSのみ)の代表点(computePinAnchorById)と、
  // タップ補助の判定基準(固定リストの角度サイズ)を別々に計算していたが、
  // タップ補助を「固定リストに限定しない、全ての国・地域を対象にした仕組み」へ
  // 一般化するにあたり、両方を1つの処理にまとめた。各国・地域について:
  //   - lat/lng: 実ポリゴン上の代表点(面積最大のサブポリゴンの重心、または
  //     重心が外に出た場合はその外周上の最近傍点)。📍の表示位置にも使う
  //   - area: 代表サブポリゴンの面積(度²、他国との相対比較のみに使う)。
  //     バチカン/サンマリノのようにイタリアの中に完全に囲まれる飛び地で、
  //     タップ地点がどちらのポリゴンにも内包される場合、面積が小さい方(＝より
  //     具体的な方)を優先して選ぶために使う
  //   - sizeDeg: 代表サブポリゴンのバウンディングボックス角度(緯度幅・経度幅の
  //     大きい方)。離島が散らばる国(クック諸島等)で、全体のバウンディング
  //     ボックスを使うと「大きい国」と誤判定されてしまう問題を避けるため、
  //     代表サブポリゴンだけを見る
  //   - minLat/maxLat/minLng/maxLng: 全サブポリゴンを含む外側のバウンディング
  //     ボックス(タップ判定での高速な足切りに使う。日付変更線をまたぐ国では
  //     正確な範囲にならないが、影響は限定的なため現時点では許容する)
  //   - polys: GeoJSONのポリゴン配列(タップ判定の点内外テストにそのまま使う)
  function computeCountryGeoInfo() {
    const info = new Map();
    geoFeatures.forEach((f) => {
      const c = countryByMapCode.get(f.id);
      if (!c) return;
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
      // セントビンセント・グレナディーンやグレナダのように、本土から数十〜100km近く
      // 離れた小島(飛び地)を持つ国・地域では、タップ補助(findNearestTapAssistCandidate)が
      // anchor(本島など最大の島1つだけの代表点)との画面距離だけで判定すると、本島から
      // 離れた小島をタップした際にその距離が候補失格ラインを超えてしまい、たまたま画面上
      // 近くに見える別の国(例: グレナダのアンカーの方が近く見える)に誤って奪われることが
      // ある。これを避けるため、全てのサブポリゴン(飛び地含む)それぞれの代表点も保持し、
      // タップ補助側では「その国の中で最も近い島」との距離で判定できるようにする
      const subAnchors = polys.map((poly) => {
        const subCentroid = ringCentroid(poly[0]);
        return pointInPolygonWithHoles(subCentroid.lng, subCentroid.lat, poly)
          ? subCentroid
          : nearestRingVertex(subCentroid.lng, subCentroid.lat, poly[0]);
      });

      let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
      let pMinLat = 90, pMaxLat = -90, pMinLng = 180, pMaxLng = -180;
      polys.forEach((poly) => {
        const isPrimary = poly === primary;
        poly[0].forEach(([lng, lat]) => {
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (isPrimary) {
            if (lat < pMinLat) pMinLat = lat;
            if (lat > pMaxLat) pMaxLat = lat;
            if (lng < pMinLng) pMinLng = lng;
            if (lng > pMaxLng) pMaxLng = lng;
          }
        });
      });

      info.set(c.id, {
        lat: anchor.lat,
        lng: anchor.lng,
        subAnchors,
        area: bestArea,
        sizeDeg: Math.max(pMaxLat - pMinLat, pMaxLng - pMinLng),
        minLat, maxLat, minLng, maxLng,
        polys,
      });
    });
    // 万一実ポリゴンが見つからなかった場合の安全策(理論上は起きないはずだが、
    // データ上の代表座標にフォールバックして、ピン・タップ補助の対象から
    // 漏れないようにする)。polysが空なので直接タップ判定の対象にはならないが、
    // タップ補助(画面座標ベースの近接判定)の対象としては機能する
    allMapCountries.forEach((c) => {
      if (info.has(c.id)) return;
      info.set(c.id, {
        lat: c.lat, lng: c.lng, subAnchors: [{ lat: c.lat, lng: c.lng }], area: 0, sizeDeg: 0,
        minLat: c.lat, maxLat: c.lat, minLng: c.lng, maxLng: c.lng, polys: [],
      });
    });
    return info;
  }

  function showMapLoading() {
    $("map-status-text").textContent = "世界地図を読み込んでいます…";
    $("map-status").classList.remove("map-status-error");
    $("map-status-retry").classList.add("hidden");
    $("map-status").classList.remove("hidden");
  }
  function clearMapStatus() {
    $("map-status").classList.add("hidden");
  }
  function showMapError() {
    $("map-status-text").textContent = "世界地図を読み込めませんでした。電波状況をご確認のうえ、もう一度お試しください。";
    $("map-status").classList.add("map-status-error");
    const retryBtn = $("map-status-retry");
    retryBtn.classList.remove("hidden");
    retryBtn.disabled = false; // 前回の再試行中のまま無効化が残らないようにする
    $("map-status").classList.remove("hidden");
  }

  // スクリプト・地図データの読み込みと地球儀の初期構築。
  // 成功した場合のみinitPromiseを保持し続け、2回目以降のopen()では
  // 再取得せずそのまま使い回す。失敗した場合はinitPromiseをnullに戻し、
  // 次にensureReady()が呼ばれたとき(=再試行ボタン押下時)に最初から
  // やり直せるようにする(通信エラーからの復旧)。
  // WebGL非対応は端末自体の制約で再試行しても変わらないため、この分岐だけは
  // 失敗したPromiseをそのままキャッシュし続け、再試行ボタンも出さない
  function ensureReady() {
    if (initPromise) return initPromise;

    if (!hasWebGL()) {
      $("map-unsupported").classList.remove("hidden");
      initPromise = Promise.reject(new Error("WebGL unsupported"));
      return initPromise;
    }

    showMapLoading();
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
        // allMapCountriesがここで初めて埋まるため、initEvents()時点では
        // 「データ0件」で無効と判定されていた「ランダムな国へ」ボタンの状態を
        // ここで正しい状態に更新し直す
        updateRandomButtonState();
        // 全ての国・地域について、実ポリゴンに基づくアンカー・サイズ・形状を
        // 一度だけ算出する(タップ判定・📍の表示位置の両方で使う)
        countryGeoById = computeCountryGeoInfo();
        // 📍の表示対象(PIN_TARGET_IDS、固定リスト)だけを抜き出しておく
        pinAnchorById = new Map();
        PIN_TARGET_IDS.forEach((id) => {
          const info = countryGeoById.get(id);
          if (info) pinAnchorById.set(id, { lat: info.lat, lng: info.lng });
        });
        buildGlobe();
        clearMapStatus();
      })
      .catch((e) => {
        console.error("世界地図の読み込みに失敗しました", e);
        // 失敗したPromiseを保持したままだと次回のensureReady()が同じ失敗を
        // 返すだけで再試行にならないため、ここでリセットする
        initPromise = null;
        showMapError();
        throw e;
      });
    return initPromise;
  }

  // 読み込み完了(初回成功・再試行成功のどちらでも)の後に呼ぶ共通処理。
  // 読み込み中にユーザーが既にトップへ戻っていた場合は、ここで初めて
  // 「今現在、世界地図画面が表示されているか」を確認するため、
  // 古い非同期処理が今の画面状態を勝手に上書きすることはない
  function resumeMapIfScreenActive() {
    if (!isMapScreenActive || !globeInstance) return;
    globeInstance.resumeAnimation();
    resizeGlobe();
    refreshPinLayer();
  }

  function retryMapLoad() {
    const btn = $("map-status-retry");
    if (btn.disabled) return;
    btn.disabled = true; // 再試行中の連打による二重初期化を防ぐ
    ensureReady()
      .then(resumeMapIfScreenActive)
      .catch(() => {
        // エラー表示はensureReady側(showMapError)で再度出している
      });
  }

  // ---------- 国のハイライト表示 ----------
  // 通常の国はjs/map-colors.jsの事前生成データ(国境を共有する国どうしは
  // 必ず別の色になるよう、グラフ彩色アルゴリズムDSATURで決めた6色の
  // パステルカラー)で塗り分け、選択中の国だけオレンジ系にする(他の国の
  // 色は変えない)。以前は単純に地域フィルターの有無だけで緑一色/地域内外の
  // 2パターンしか出し分けていなかったが、国ごとの配色データが増えた今は、
  // 地域フィルターで対象外になった国も「その国自身の色を薄くする」形に
  // 変える(緑一色に潰さない)。
  // 以前は極小国のタップ判定に「透明・高高度の合成円」を重ねていたが、
  // 透明(alpha=0)なのに周辺国より高い高度を持つポリゴンはWebGLの深度バッファに
  // 書き込みだけ行って可視化はされないため、真下にある隣国(モナコ→フランス、
  // バチカン/サンマリノ→イタリア等)の描画が深度テストに負けて海の色が透けて
  // 見えてしまう不具合の原因になっていた。極小国も含め全ポリゴンが実形状の
  // GeoJSONを持つようになったため、この合成円・透明化・高高度化の仕組みは廃止し、
  // 全ポリゴンに同一のシンプルな色・高度ロジックだけを適用する。
  const FALLBACK_FILL_COLOR = "#BFD9A8"; // MAP_COUNTRY_COLORSに無いfeat.id(理論上は起きないはずの安全策)
  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m
      ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
      : { r: 191, g: 217, b: 168 };
  }
  function rgba(hex, alpha) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  // 国・地域ごとに固定された基本色(js/map-colors.jsで事前生成、実行時の計算なし)
  function baseFillColor(feat) {
    if (typeof MAP_COUNTRY_COLORS !== "undefined" && MAP_COUNTRY_COLORS[feat.id]) {
      return MAP_COUNTRY_COLORS[feat.id];
    }
    return FALLBACK_FILL_COLOR;
  }
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
    const base = baseFillColor(feat);
    if (currentRegionFilter === "all") return rgba(base, 0.95);
    // 地域フィルターで対象外になった国も、緑一色に潰さずその国自身の色を薄くする
    return isInActiveRegion(feat) ? rgba(base, 0.97) : rgba(base, 0.25);
  }
  // 国ポリゴンは、地球儀の球面(半径100)から高度0.006(=0.6単位)だけ押し出した
  // 「薄い板」として描画される。以前はこの板の側面(高さ0〜0.6の壁)を国の色の
  // 半透明(40%)で塗っていたが、画面中央から外れた海岸線や斜め視点では、この壁が
  // 上面(国の形)の外側に帯状に見え、半透明の国色と海の水色が混ざって灰色っぽい
  // 縁＝「輪郭が二重にずれて見える」原因になっていた(側面だけを消すと縁が消え、
  // 国境線を消しても縁が残ることをスクリーンショット比較で確認済み)。
  // そこで側面の色をnullにする。globe.glは側面の色・マテリアルが無いとき、
  // 側面ジオメトリ自体を生成しない(includeSides:false)ため、透明な壁が深度
  // バッファに残るといった副作用も無い。上面の高さ(polygonAltitude)は
  // 地球儀表面とのZファイティングを避けるため従来どおり0.006のまま維持し、
  // 📍の先端の高さ(PIN_OBJECT_ALTITUDE)との一致も崩さない
  function polygonSideColor() {
    return null;
  }
  // 国境線は国ごとの色に関わらず、やさしい単色(#7E9A8A)で統一し、
  // 地図全体の国境が細く自然に見えるようにする
  const BORDER_STROKE_COLOR = "#7E9A8A";
  function polygonStrokeColor(feat) {
    if (isSelected(feat)) return "#8a5500";
    if (currentRegionFilter === "all") return BORDER_STROKE_COLOR;
    return isInActiveRegion(feat) ? BORDER_STROKE_COLOR : "rgba(126, 154, 138, 0.3)";
  }
  // 選択中の国だけ高度を上げていたが、地球儀を斜めから見たときに側面が
  // 立体的な柱のように伸びて見えるため、選択の有無に関わらず全ポリゴンを
  // 同じ高さ(通常国と同じ0.006)にする。選択の強調はcapColor/strokeColorのみで行う
  function polygonAltitude() {
    return PIN_OBJECT_ALTITUDE;
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
  // 以前はHTML要素(📍)をJS側の画面座標計算(projectLatLngToScreen)で毎フレーム
  // 追従させていたが、この方式は「地球儀が実際に描画した直後の最新カメラ状態」を
  // 読めてはいても、HTML要素自体はWebGLの深度バッファ・透視変換の外側にある
  // 別レイヤーであるため、原理的に数ピクセル単位のズレが生じうる(カリブ海の
  // ような小島密集地域、iPhone実機でこのズレが visible な不具合として繰り返し
  // 報告された)。そこで、ピンそのものをglobe.gl/three.jsの3D空間に実オブジェクトとして
  // 配置するobjectsData()レイヤーに全面移行した。objectLat/objectLng/objectAltitudeで
  // 指定した緯度経度・高度は、国ポリゴン(polygonsData)と全く同じ3Dシーン・同じ
  // カメラ行列で描画されるため、回転・ズーム中であっても地球儀本体の地形とズレる
  // 余地が無い。このvendor版globe.glはwindow.THREEを公開していないため、
  // Three.jsのクラス(Group/Mesh/SphereGeometry等)はbootstrapPinClasses()で
  // 間接的に一度だけ取得する(下記参照)。
  function dumpSceneUuids() {
    const result = [];
    function walk(obj) {
      result.push(obj.uuid);
      (obj.children || []).forEach(walk);
    }
    walk(globeInstance.scene());
    return result;
  }
  function findMeshByUuid(uuid, obj) {
    if (obj.uuid === uuid && obj.type === "Mesh") return obj;
    for (const child of obj.children || []) {
      const found = findMeshByUuid(uuid, child);
      if (found) return found;
    }
    return null;
  }
  // beforeUuidsに無い新規ノードの中からMeshを見つかるまでrequestAnimationFrameで
  // 待つ(固定時間sleepではなく、実際にKapsule側の描画ダイジェストが完了して
  // シーングラフにメッシュが追加されたことを確認してから次に進むため、
  // 環境によるタイミングのばらつきに左右されない)
  function waitForNewMesh(beforeUuids, maxFrames) {
    const beforeSet = new Set(beforeUuids);
    return new Promise((resolve) => {
      let frames = 0;
      function check() {
        frames++;
        const afterUuids = dumpSceneUuids();
        let mesh = null;
        for (const uuid of afterUuids) {
          if (beforeSet.has(uuid)) continue;
          mesh = findMeshByUuid(uuid, globeInstance.scene());
          if (mesh) break;
        }
        if (mesh || frames >= maxFrames) {
          resolve(mesh);
          return;
        }
        requestAnimationFrame(check);
      }
      requestAnimationFrame(check);
    });
  }
  // window.THREEが存在しないため、objectsData/pointsDataにカスタムの
  // objectThreeObjectを渡さず一度だけ「既定の見た目」で描画させ、その結果
  // 生成される実際のThree.jsインスタンスからconstructorを借りる。objectsDataと
  // pointsDataを同時に走らせるとどちらの新規メッシュか区別できなくなるため、
  // 必ず1つ目の描画完了(waitForNewMesh解決)を待ってから2つ目を投入する
  function bootstrapPinClasses() {
    if (pinClasses) return Promise.resolve(pinClasses);
    const before1 = dumpSceneUuids();
    globeInstance.objectsData([{ lat: 0, lng: 0 }]).objectLat("lat").objectLng("lng").objectAltitude(10);
    return waitForNewMesh(before1, 180).then((objMesh) => {
      const before2 = dumpSceneUuids();
      globeInstance.pointsData([{ lat: 0, lng: 0 }]).pointLat("lat").pointLng("lng").pointAltitude(10).pointRadius(0.001);
      return waitForNewMesh(before2, 180).then((ptMesh) => {
        globeInstance.objectsData([]);
        globeInstance.pointsData([]);
        if (!objMesh || !ptMesh) return null;
        pinClasses = {
          Group: objMesh.parent.constructor,
          Mesh: objMesh.constructor,
          SphereGeometry: objMesh.geometry.constructor,
          MeshLambertMaterial: objMesh.material.constructor,
          CylinderGeometry: ptMesh.geometry.constructor,
        };
        return pinClasses;
      });
    });
  }
  // 📍本体(球形の頭+円錐の針)を構築する。Group原点(=objectLat/Lng/Altitudeで
  // 指定した地点)がちょうど針の先端に来るよう、各メッシュをy方向にオフセットする。
  // globe.glはこのGroupを位置合わせ用の外側Groupで包み、原点を指定地点に置く。
  // (旧メモ: 内側Group単体のローカル+Y軸だけを見ると、球面の外向き法線とは
  // 一致しない=地表に沿った向きに見えることがある。ただし、実際に描画された
  // 頭・針メッシュのワールド座標を実測すると、外側Groupによる変換を経た最終的な
  // 画面上の向きは、カメラ位置・ズーム・地球儀の回転に関わらずcamera.upベクトルを
  // アンカー付近に適用して投影した方向とほぼ一致する=常にカメラに対して正立する
  // ビルボード的な見た目になっている。タップ判定(下記isNearPinShape)の
  // 「上方向」はこの実測結果に基づき、camera.upベースで計算している)
  // どの向きでも針の先端=原点が指定した緯度経度・高度の1点に固定される
  // 形状は「全高=1(ワールド単位)」に正規化して作り、実際の大きさは
  // updatePinScreenScales()が描画直前にgroup.scaleで決める。
  // 絵文字「📍」に近づけるため、丸い頭+細く短い針のシンプルな形にし、
  // 陰影が強く出すぎないよう自己発光(emissive)で明るさを底上げして平面的に見せる
  function buildPinObject(d) {
    const C = pinClasses;
    const group = new C.Group();
    const { headR, needleH, needleBaseR, headCenterY, k } = PIN_SHAPE;
    const needleGeom = new C.CylinderGeometry(needleBaseR * k, 0, needleH * k, 10);
    const needleMat = new C.MeshLambertMaterial({ color: PIN_NEEDLE_COLOR });
    if (needleMat.emissive) needleMat.emissive.setHex(0x5a0d0d);
    const needleMesh = new C.Mesh(needleGeom, needleMat);
    needleMesh.position.y = (needleH * k) / 2;
    const headGeom = new C.SphereGeometry(headR * k, 20, 16);
    const headMat = new C.MeshLambertMaterial({ color: PIN_HEAD_COLOR });
    if (headMat.emissive) headMat.emissive.setHex(0x7a1414);
    const headMesh = new C.Mesh(headGeom, headMat);
    headMesh.position.y = headCenterY * k;
    group.add(needleMesh);
    group.add(headMesh);
    // 通常ピン・選択中ピンとも同じ基準(PIN_SCREEN_HEIGHT_PX)で大きさを決め、
    // 選択中だけPIN_SELECTED_SCALE倍にする。初回描画前に一瞬大きく出ないよう、
    // ここでも一度スケールを計算しておく
    group.userData.pinSizeFactor = d && d.selected ? PIN_SELECTED_SCALE : 1;
    // globe.glはこのGroupを位置合わせ用の外側のGroupで包むため、
    // スケールを掛ける対象(=この内側のGroup)をデータ側に直接覚えておく
    if (d) d.pinGroup = group;
    applyPinScreenScale(group, d);
    return group;
  }
  // 1ピン分のスケールを、現在のカメラ状態から計算する。
  // 透視投影では「画面の高さ(CSSpx)＝視錐台の高さ(=2·距離·tan(fov/2))」なので、
  // 1ワールド単位あたりのpx数はH/(2·d·tan(fov/2))。目標px数をこれで割ればスケールになる
  function applyPinScreenScale(group, d) {
    if (!globeInstance || !group || !d) return;
    const camera = globeInstance.camera();
    const container = $("map-globe-container");
    const viewH = container ? container.clientHeight : 0;
    if (!camera || !viewH) return;
    const p = globeInstance.getCoords(d.lat, d.lng, PIN_OBJECT_ALTITUDE);
    const cp = camera.position;
    const dist = Math.sqrt((cp.x - p.x) ** 2 + (cp.y - p.y) ** 2 + (cp.z - p.z) ** 2);
    if (!Number.isFinite(dist) || dist <= 0) return;
    const fovRad = ((camera.fov || 50) * Math.PI) / 180;
    const pxPerUnit = viewH / (2 * dist * Math.tan(fovRad / 2));
    const factor = group.userData.pinSizeFactor || 1;
    group.scale.setScalar((PIN_SCREEN_HEIGHT_PX * factor) / pxPerUnit);
  }
  // 描画の直前(hookRendererForLabelSync参照)に毎回呼ぶ。ピンは最大30件弱なので軽い
  function updatePinScreenScales() {
    if (!globeInstance || !currentPinData.length) return;
    for (const d of currentPinData) {
      applyPinScreenScale(d.pinGroup, d);
    }
  }
  // ピンON/OFF・地域フィルター・選択中の国が変わったときに呼ぶ。表示すべき
  // ピンのデータ配列を作り直し、objectsData()に渡し直す(globe.glは配列の
  // 参照が変わるたびobjectThreeObjectを呼び直すため、これだけで再構築される)。
  // 選択中の国はpinsVisible/地域フィルターの状態に関わらず常に表示する
  // (以前の選択中マーカーも同じ扱いだった)
  function refreshPinLayer() {
    if (!globeInstance || !pinClasses) return;
    const data = [];
    PIN_TARGET_IDS.forEach((id) => {
      const anchor = pinAnchorById.get(id);
      const c = countryById.get(id);
      if (!anchor || !c) return;
      const isSelectedPin = id === selectedCountryId;
      if (!isSelectedPin) {
        if (!pinsVisible) return;
        if (currentRegionFilter !== "all" && c.region !== currentRegionFilter) return;
      }
      data.push({ id, lat: anchor.lat, lng: anchor.lng, selected: isSelectedPin });
    });
    // 検索・ランダム選択時、自動ズームしても極小のため一時的な目印が必要と
    // 判定された国・地域(tempSearchMarkerId)を追加する。PIN_TARGET_IDSは
    // 一切変更せず、別の仕組み(selectCountry内のcomputeAutoZoom)で判定した
    // 一時的な対象だけをここに足す。選択解除・別の国の選択でnullに戻るため、
    // 古い目印がこの配列に残ることはない
    if (tempSearchMarkerId) {
      const info = countryGeoById.get(tempSearchMarkerId);
      const c = countryById.get(tempSearchMarkerId);
      if (info && c && !data.some((d) => d.id === tempSearchMarkerId)) {
        data.push({ id: tempSearchMarkerId, lat: info.lat, lng: info.lng, selected: true });
      }
    }
    currentPinData = data;
    globeInstance
      .objectsData(data)
      .objectLat("lat")
      .objectLng("lng")
      .objectAltitude(PIN_OBJECT_ALTITUDE)
      .objectThreeObject(buildPinObject);
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
    refreshPinLayer();
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

  // ---------- タップ補助対象の判定(タップのたびに現在のズームで判定) ----------
  // 国・地域の現在の画面上サイズ(px)を、実際のカメラ位置・視野角・その地点
  // までの3D距離から直接計算する。以前は「角度サイズとaltitudeだけを使う
  // 簡易近似式(fov≈50°相当で較正した定数Kを(1+altitude)で割る形)」を
  // 使っていたが、実際の見かけの大きさはおおよそ1/altitudeで大きくなるのに
  // 対し、この式は1/(1+altitude)という頭打ちになる形をしており、altitudeが
  // 1前後の通常ズームでは近い値になるものの、altitudeが0に近い(地表すれすれの)
  // 最大ズーム付近では実際の見かけサイズを大きく過小評価してしまうことが実測で
  // 判明した(グレナダで検証したところ、altitude=0.0667での真の見かけサイズは
  // 約76pxだったのに対し、旧式の推定値は約3.5pxしかなかった)。そのため、
  // 📍のスクリーンスケール計算(applyPinScreenScale)と同じ「カメラから対象
  // 地点までの実際の3D距離」に基づく透視投影の式に置き換えた。これにより、
  // 新しい最大ズーム(約3倍)でも、画面上十分に大きく見える国・地域が
  // 誤ってタップ補助の対象のままになる(＝直接タップより補助が優先され続ける)
  // ことがなくなる
  function estimateApparentPx(info, camera, viewH) {
    if (!globeInstance || !camera || !viewH) return Infinity; // 計算できない場合は安全側(十分大きい扱い=補助を発火させない)に倒す
    const p = globeInstance.getCoords(info.lat, info.lng, 0.02);
    const cp = camera.position;
    const dist = Math.sqrt((cp.x - p.x) ** 2 + (cp.y - p.y) ** 2 + (cp.z - p.z) ** 2);
    if (!Number.isFinite(dist) || dist <= 0) return Infinity;
    const fovRad = ((camera.fov || 50) * Math.PI) / 180;
    const pxPerUnit = viewH / (2 * dist * Math.tan(fovRad / 2));
    const worldUnitsPerDeg = (GLOBE_RADIUS * Math.PI) / 180; // 球面上、緯度経度1度あたりのワールド単位(円周/360)
    return pxPerUnit * info.sizeDeg * worldUnitsPerDeg;
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
  // ワールド座標(three.jsのXYZ)の1点を、現在のカメラでスクリーンのピクセル座標に
  // 投影する。globeInstance.getScreenCoords()は緯度経度+高度しか受け付けないため、
  // 緯度経度で表せない任意の点(isNearPinShape()でcamera.upベクトル方向にずらした
  // 点など)を投影する場合はこちらを使う。camera.position自体がThree.jsの
  // Vector3インスタンスであることを利用して、そのコンストラクタから同種の
  // Vector3を作り、camera.project()と同じ正規化デバイス座標(NDC)変換を行う
  function projectWorldPointToScreen(worldXYZ) {
    if (!globeInstance) return null;
    const camera = globeInstance.camera();
    if (!camera || !camera.position || typeof camera.position.constructor !== "function") return null;
    camera.updateMatrixWorld(true);
    const Vec3 = camera.position.constructor;
    const v = new Vec3(worldXYZ.x, worldXYZ.y, worldXYZ.z);
    v.project(camera);
    if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) return null;
    const container = $("map-globe-container");
    if (!container) return null;
    const w = container.clientWidth;
    const h = container.clientHeight;
    return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h };
  }
  // 通常ピンと同じ実ポリゴン上のアンカー座標(pinAnchorById)を使う。これにより、
  // 「通常ピン→選択して消える→選択用ピン+ラベルに切り替わる」際に、📍の
  // 先端位置が全く動かない(通常ピン対象=PIN_TARGET_IDSのときはpinAnchorByIdに
  // 必ず存在する)。PIN_TARGET_IDSに無い国・地域(検索時の自動ズームでtempSearchMarkerId
  // が一時的に対象になる場合)は、refreshPinLayer()が📍自体の位置に使っているのと
  // 同じanchorForCountry()(実ポリゴンの代表点、無ければcountry.lat/lng)にフォールバック
  // する。以前はここだけcountry.lat/lngに直接フォールバックしていたため、📍の実際の
  // 位置(実ポリゴン基準)と国名ラベルの位置(データ上の代表座標基準)がずれる
  // 国・地域があった(例: キリバスは最大の島の代表地点が西経約157度なのに対し、
  // データ上の代表座標は東経173度で、約30度も離れていた)
  function pinAnchorFor(country) {
    return pinAnchorById.get(country.id) || anchorForCountry(country);
  }
  function updateLabelPosition(country) {
    const labelEl = $("map-country-label");
    const anchor = pinAnchorFor(country);
    // 📍の実際の高さ(PIN_OBJECT_ALTITUDE)と同じ高度で投影する。以前は0.02という
    // 別の値を使っており、通常のズームでは誤差が目立たなかったが、検索時の
    // 自動ズーム(一時的な目印)で最大ズーム付近・かつ情報カードを避けるために
    // 注視点をずらした状態(cardAvoidanceTarget)になると、カメラが地点の真上から
    // 見ていないため、この高度差がそのまま📍とラベルの画面上のズレとして
    // 大きく現れることが分かった
    const pos = projectLatLngToScreen(anchor.lat, anchor.lng, PIN_OBJECT_ALTITUDE);
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
  function stopLabelTracking() {
    trackedCountry = null;
    $("map-country-label").classList.add("hidden");
  }
  function startLabelTracking(country) {
    trackedCountry = country;
    const labelEl = $("map-country-label");
    labelEl.textContent = country.name;
    // カメラが止まっている間は次の描画が起きるとは限らないため、ここでも
    // 一度だけ即座に位置を合わせておく(以降はonAfterRender()が追従する)
    updateLabelPosition(country);
  }
  // ---------- 地球儀の実際の描画タイミングに同期したラベル位置更新 ----------
  // 📍本体は3Dオブジェクト化(objectsData、上記)したため、国ポリゴンと全く同じ
  // カメラ行列で描画され、個別の位置追従コードは不要になった。国名ラベルだけは
  // 従来どおりHTML要素(黒いピル型)なので、画面座標への変換・追従が引き続き必要。
  // 以前は独立したrequestAnimationFrameループで追従させていたが、地球儀本体
  // (three.js)自身の「オンデマンド」描画(変化があったときだけ再描画)とは
  // 完全には同期しておらず、回転の慣性が残っている間などにわずかなタイミングの
  // ズレが生じうる。そのため、レンダラー自身のrender()呼び出しを直接フックし、
  // 「実際に描画されたのと全く同じタイミング・同じカメラ状態」でラベル位置を
  // 再計算する
  function hookRendererForLabelSync() {
    if (!globeInstance) return;
    const renderer = globeInstance.renderer();
    if (!renderer || typeof renderer.render !== "function" || renderer.__wfqPinSyncHooked) return;
    const originalRender = renderer.render.bind(renderer);
    renderer.render = function (...args) {
      // 📍の見かけの大きさは、これから描画するのと同じカメラ状態で決める
      // (描画後に直すと1フレーム遅れて大きさが揺れるため、必ず描画の直前に行う)
      updatePinScreenScales();
      const result = originalRender(...args);
      onAfterRender();
      return result;
    };
    renderer.__wfqPinSyncHooked = true;
  }
  function onAfterRender() {
    if (trackedCountry) updateLabelPosition(trackedCountry);
  }

  // ---------- タップ判定(v3、1つの同期処理に統合) ----------
  // 以前はglobe.gl自身のonPolygonClick(3Dオブジェクトへのレイキャスト)と、
  // 自前のhandleContainerClick(setTimeout(0)で遅延実行する近接判定)という
  // 2つの独立した選択処理が存在していた。この2つが同じタップ操作に対して
  // 競合し、以下の不具合を引き起こしていた:
  //   1. onPolygonClickは、globe.glの汎用レイキャスト・クリックシステム
  //      (シーン内の全オブジェクトを対象に最も近い交差物を1つだけ採用し、
  //      その種類に対応するコールバックだけを呼ぶ実装)に乗っているため、
  //      📍の3Dオブジェクト(objectsDataレイヤー、カメラに最も近い)がタップ地点の
  //      手前にあると、交差判定はピン自体にヒットしてしまい(ピンにはクリック
  //      コールバックを登録していないため)、ポリゴン側のonPolygonClickが
  //      そもそも呼ばれない。グレナダ・セントビンセント・香港・マカオは
  //      いずれも📍が表示される対象であり、ピンの頭や針をタップするとこの
  //      現象が起きていたと考えられる。
  //   2. 仮にonPolygonClickが正しく発火しても、遅延実行されるhandleContainerClick
  //      側が緯度経度の固定角度半径(最大1.4度、カリブ海や香港/マカオ間の
  //      実際の距離に対して広すぎる)で近隣の別の小国を拾ってしまい、
  //      正しく選択された国を後から上書きすることがあった。
  // この2つを廃止し、1回のクリックイベント内で同期的に完結する単一の判定に
  // 統合した。globe.glのレイキャストには一切頼らず、タップ地点の緯度経度を
  // 自前で計算した上で、(a)実ポリゴンへの直接ヒット判定、(b)画面ピクセル距離
  // ベースのタップ補助、の順で評価する。ピンは3Dオブジェクトだが、この判定
  // 自体はメッシュへのレイキャストを一切行わないため、ピンがタップ判定を
  // 遮ることは原理的に無くなる。
  // pointsDataレイヤーはこのglobe.glビルドではクリックイベントを受け取れないため、
  // 地球儀コンテナへの生のclickイベントから「画面上のどの地点をタップしたか」を
  // 緯度経度に変換する。透明・高高度ポリゴンを使わないため、深度バッファを
  // 汚染する副作用が一切ない。
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

    // 原点中心の球とのレイの交点を求める。国ポリゴン(polygonAltitude、下記
    // polygonAltitude()参照)は地球儀の基準球(半径GLOBE_RADIUS、高度0)からPIN_OBJECT_ALTITUDE
    // だけ外側に押し出した位置に描画されるため、交点判定も同じ半径(POLYGON_SURFACE_RADIUS)の
    // 球を使う。画面中央をタップした場合はどちらの半径でも結果は変わらないが、画面中央から
    // 離れた位置(典型的には海岸線や小さな島)をタップした場合、視線がこの2つの球面を
    // 斜めに貫くため、半径0のまま判定すると実際に表示されている地形の緯度経度から
    // 数km単位でずれる(最大ズーム・画面端に近いほど顕著)。実際に見えている地形の
    // 真上をタップしたと判定するには、その地形と同じ高度の球を使う必要がある
    const POLYGON_SURFACE_RADIUS = GLOBE_RADIUS * (1 + PIN_OBJECT_ALTITUDE);
    const b = origin.x * dir.x + origin.y * dir.y + origin.z * dir.z;
    const c = origin.x * origin.x + origin.y * origin.y + origin.z * origin.z - POLYGON_SURFACE_RADIUS * POLYGON_SURFACE_RADIUS;
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
  // タップ地点(緯度経度)が実際にどの国・地域のポリゴンの内側にあるかを判定する。
  // 全geoFeaturesに対してバウンディングボックスで高速に足切りしたあと、
  // 候補として残ったものだけ実際の点内外判定(pointInPolygonWithHoles)を行う
  // ため、ロシア・カナダのような頂点数の多い国が混ざっていても軽い。
  // バチカン/サンマリノのようにイタリアの領域に完全に囲まれる飛び地では、
  // タップ地点が両方のポリゴンに内包されることがあるため、複数ヒットした
  // 場合は面積が最も小さい(＝最も具体的な)ものを採用する
  function findDirectPolygonHit(lat, lng) {
    if (!countryGeoById.size) return null;
    let bestId = null;
    let bestArea = Infinity;
    countryGeoById.forEach((info, id) => {
      if (!info.polys.length) return;
      if (lat < info.minLat || lat > info.maxLat || lng < info.minLng || lng > info.maxLng) return;
      let inside = false;
      for (const poly of info.polys) {
        if (pointInPolygonWithHoles(lng, lat, poly)) { inside = true; break; }
      }
      if (!inside) return;
      if (info.area < bestArea) {
        bestArea = info.area;
        bestId = id;
      }
    });
    return bestId ? countryById.get(bestId) : null;
  }
  // 現在のズームで画面上小さく見える国・地域の中から、タップ地点(画面ピクセル
  // 座標)に最も近いものを探す。実ポリゴンへの直接タップがわずかに外れた場合
  // (📍の頭をタップした場合も含む)の補助として使う。PIN_TARGET_IDSのような
  // 固定リストではなく全ての国・地域を対象にするため、将来追加される国・地域にも
  // 自動的に対応する。複数の候補が範囲内にある場合は最も近いものを優先し、
  // 地球の裏側にある国はprojectLatLngToScreenが自動的にnullを返すため対象外になる。
  // 距離の判定自体は、本島だけでなくその国・地域が持つ全ての島(subAnchors、
  // computeCountryGeoInfo参照)の中で最も近いものを使う。セントビンセント・
  // グレナディーンのように本島から離れた小島(飛び地)を持つ場合、本島だけを
  // 基準にすると距離が候補失格ライン(TAP_ASSIST_RADIUS_PX)を超えてしまい、
  // たまたま画面上近くに見える別の国に奪われることがあるため。
  // 各島の代表点を投影する高度は、実際に描画される地形・📍の先端と同じ
  // PIN_OBJECT_ALTITUDEを使う(screenToLatLngと同じ理由。画面中央から離れた
  // 位置では、高度が違うだけで投影先の画面座標が数十px単位でずれるため、
  // 実際に見えている島の位置とタップ補助の基準点がずれてしまう)
  function findNearestTapAssistCandidate(px, py) {
    if (!countryGeoById.size || !globeInstance) return null;
    const camera = globeInstance.camera();
    const container = $("map-globe-container");
    const viewH = container ? container.clientHeight : 0;
    let best = null;
    let bestInfo = null;
    let bestDist = Infinity;
    countryGeoById.forEach((info, id) => {
      if (estimateApparentPx(info, camera, viewH) >= TAP_ASSIST_ELIGIBLE_PX) return;
      if (currentRegionFilter !== "all") {
        const c = countryById.get(id);
        if (!c || c.region !== currentRegionFilter) return; // 非表示の地域は補助対象外
      }
      const anchors = info.subAnchors && info.subAnchors.length ? info.subAnchors : [{ lat: info.lat, lng: info.lng }];
      let nearestDist = Infinity;
      for (const a of anchors) {
        const pos = projectLatLngToScreen(a.lat, a.lng, PIN_OBJECT_ALTITUDE);
        if (!pos) continue;
        const dx = pos.x - px;
        const dy = pos.y - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) nearestDist = dist;
      }
      if (nearestDist <= TAP_ASSIST_RADIUS_PX && nearestDist < bestDist) {
        bestDist = nearestDist;
        best = countryById.get(id);
        bestInfo = info;
      }
    });
    return best ? { country: best, info: bestInfo, dist: bestDist } : null;
  }
  // 指定した国・地域の📍が、現在実際に画面上に描かれているかを判定する。
  // refreshPinLayer()が📍を表示する条件(選択中は常に表示/それ以外はpinsVisible
  // かつ地域フィルターに合致)と同じ基準で判定する。PIN_TARGET_IDS対象外の国
  // (タップ補助自体は全国・地域が対象だが、📍の3Dオブジェクトが無い)や、
  // ピンOFF中・地域フィルターで隠れている📍については、そもそも「ピン自体を
  // 狙ってタップした」という判定の根拠になる見た目が存在しないため、常にfalseになる
  function isPinActuallyVisible(id) {
    if (!PIN_TARGET_IDS.has(id)) return false;
    if (id === selectedCountryId) return true;
    if (!pinsVisible) return false;
    if (currentRegionFilter !== "all") {
      const c = countryById.get(id);
      if (!c || c.region !== currentRegionFilter) return false;
    }
    return true;
  }
  // タップ地点(画面px)が、補助候補(id/info)の実際に表示されている📍の見た目の
  // 形状(球形の頭+円錐の針、buildPinObject参照)の上にあるかを判定する。
  // 「アンカーから単純な円形の距離がX px以内」という判定だと、📍の絵が実際には
  // 描かれていない方向(真横・真下など)へのタップまで「ピン自体を狙った」と
  // 誤判定してしまう(香港のアンカー脇の中国本土タップ等)。これを避けるため、
  // 📍の実シルエットに対して判定する。
  //   1. 📍のGroup自体はbuildPinObject内のコメントの実測どおり、ローカル+Y軸が
  //      設置点の球面の「外向き法線」に一致するとは限らない(地表に沿った
  //      向きになることが実測で確認されている)。しかし描画結果(実際の頭・針の
  //      画面上の向き)を実測すると、どのカメラ位置・ズーム・回転でも常に
  //      「camera.upベクトルを世界座標でアンカー付近に適用して投影した方向」と
  //      ほぼ一致する(= いわゆるビルボード的に、常にカメラのupを基準に画面上で
  //      立って見えるよう描画されている)。そのため、アンカーの地点から
  //      camera.up方向にわずかにずらした点を別途projectWorldPointToScreen()で
  //      投影し、画面上でのその方向を「上方向」として使う(以前はaltitude方向に
  //      ずらした点を投影していたが、カメラがちょうどその地点を向いている
  //      ときに限り、ずらした点がほぼ同じ画面座標に投影されてしまい(視線方向と
  //      ほぼ平行なため)、方向が不定・不正確になる問題があったため変更した)
  //   2. タップ地点のアンカーからのオフセットを、この(上方向, それに直交する
  //      横方向)の2軸に分解する
  //   3. PIN_SCREEN_SHAPE(ズーム倍率に関わらず画面px単位で一定)の頭の円・
  //      針の円錐の断面と比較し、指のタップ分の許容(TAP_PIN_SHAPE_TOLERANCE_PX)
  //      を加えて内側にあるか判定する
  function isNearPinShape(px, py, id, info) {
    if (!isPinActuallyVisible(id)) return false;
    const anchorPos = projectLatLngToScreen(info.lat, info.lng, PIN_OBJECT_ALTITUDE);
    if (!anchorPos) return false;
    let upX = 0, upY = -1; // 投影できない場合は画面の上方向を安全側のフォールバックにする
    const camera = globeInstance.camera();
    if (camera && camera.up) {
      const anchorWorld = globeInstance.getCoords(info.lat, info.lng, PIN_OBJECT_ALTITUDE);
      const upLen = Math.sqrt(camera.up.x ** 2 + camera.up.y ** 2 + camera.up.z ** 2) || 1;
      const upWorld = {
        x: anchorWorld.x + (camera.up.x / upLen) * 0.3,
        y: anchorWorld.y + (camera.up.y / upLen) * 0.3,
        z: anchorWorld.z + (camera.up.z / upLen) * 0.3,
      };
      const upProbe = projectWorldPointToScreen(upWorld);
      if (upProbe) {
        const dx = upProbe.x - anchorPos.x;
        const dy = upProbe.y - anchorPos.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0.001) { upX = dx / len; upY = dy / len; }
      }
    }
    const acrossX = -upY, acrossY = upX; // 上方向に直交する単位ベクトル

    const offX = px - anchorPos.x;
    const offY = py - anchorPos.y;
    const along = offX * upX + offY * upY;
    const across = offX * acrossX + offY * acrossY;

    const scale = id === selectedCountryId ? PIN_SELECTED_SCALE : 1;
    const tol = TAP_PIN_SHAPE_TOLERANCE_PX;

    // 頭(円): alongがheadOffsetPx付近、距離がheadRadiusPx+許容以内
    const headOffset = PIN_SCREEN_SHAPE.headOffsetPx * scale;
    const headR = PIN_SCREEN_SHAPE.headRadiusPx * scale + tol;
    const headDist = Math.sqrt((along - headOffset) ** 2 + across * across);
    if (headDist <= headR) return true;

    // 針: アンカー(along=0、半径0)から先細りに太くなり、along=needleLenPxで
    // 半径needleBaseRadiusPxになる円錐。along方向にも許容分だけ範囲を広げる
    const needleLen = PIN_SCREEN_SHAPE.needleLenPx * scale;
    const needleBaseR = PIN_SCREEN_SHAPE.needleBaseRadiusPx * scale;
    if (along >= -tol && along <= needleLen + tol) {
      const t = needleLen > 0 ? Math.max(0, Math.min(1, along / needleLen)) : 0;
      if (Math.abs(across) <= needleBaseR * t + tol) return true;
    }
    return false;
  }
  // ---------- タップ診断モード本体 ----------
  // URLクエリパラメータだけで判定する(localStorageに保存しない)。意図せず
  // 有効なままになって一般利用者の画面に表示され続ける事故を避けるため、
  // 毎回明示的に ?mapTapDebug=1 を付けて開いたときだけ有効にする
  function isTapDebugRequested() {
    try {
      return new URLSearchParams(location.search).get(TAP_DEBUG_QUERY_PARAM) === "1";
    } catch (e) {
      return false;
    }
  }
  // 現在のズームで画面上小さく見える国・地域について、タップ地点からの距離
  // (その国・地域が持つ全ての島のうち最も近いもの、findNearestTapAssistCandidate
  // と同じ基準)を、実際に補助として採用されるかどうかに関わらず近い順にlimit件
  // 集める。診断表示専用で、選択結果そのものには一切影響しない
  function collectTapAssistCandidatesForDebug(px, py, limit) {
    if (!countryGeoById.size || !globeInstance) return [];
    const camera = globeInstance.camera();
    const container = $("map-globe-container");
    const viewH = container ? container.clientHeight : 0;
    const results = [];
    countryGeoById.forEach((info, id) => {
      if (estimateApparentPx(info, camera, viewH) >= TAP_ASSIST_ELIGIBLE_PX) return;
      if (currentRegionFilter !== "all") {
        const c = countryById.get(id);
        if (!c || c.region !== currentRegionFilter) return;
      }
      const anchors = info.subAnchors && info.subAnchors.length ? info.subAnchors : [{ lat: info.lat, lng: info.lng }];
      let nearestDist = Infinity;
      anchors.forEach((a) => {
        // findNearestTapAssistCandidateと同じ高度(PIN_OBJECT_ALTITUDE)を使う。
        // 診断表示用の距離が実際の判定と食い違わないようにするため
        const pos = projectLatLngToScreen(a.lat, a.lng, PIN_OBJECT_ALTITUDE);
        if (!pos) return;
        const dx = pos.x - px, dy = pos.y - py;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < nearestDist) nearestDist = d;
      });
      if (Number.isFinite(nearestDist)) {
        const c = countryById.get(id);
        results.push({ id, name: c ? c.name : id, dist: nearestDist });
      }
    });
    results.sort((a, b) => a.dist - b.dist);
    return results.slice(0, limit);
  }
  function formatTapDebugEntry(e) {
    const lines = [];
    const time = new Date().toISOString().slice(11, 23);
    lines.push(`[${time}] ${e.kind}`);
    if (e.kind === "pointerdown-no-click") {
      lines.push(`  pointerdown座標: (${e.x.toFixed(0)}, ${e.y.toFixed(0)})`);
      lines.push(`  → ${TAP_DEBUG_PENDING_TIMEOUT_MS}ms以内にclickイベントが発生しませんでした`);
      return lines.join("\n");
    }
    lines.push(`  タップ座標(コンテナ内px): (${e.px?.toFixed?.(1)}, ${e.py?.toFixed?.(1)})`);
    if (e.pov) {
      lines.push(`  カメラ: lat=${e.pov.lat.toFixed(3)} lng=${e.pov.lng.toFixed(3)} altitude=${e.pov.altitude.toFixed(4)}`);
    }
    if (e.camPos) {
      lines.push(`  カメラ位置(xyz): (${e.camPos.x.toFixed(1)}, ${e.camPos.y.toFixed(1)}, ${e.camPos.z.toFixed(1)})`);
    }
    if (e.kind === "ignored-drag") {
      lines.push(`  → ドラッグ/回転操作と判定しタップ選択を行いませんでした(移動量 ${e.moveDist.toFixed(1)}px > ${TAP_MAX_MOVE_PX}px)`);
      return lines.join("\n");
    }
    if (e.kind === "ignored-multi-pointer") {
      lines.push("  → ピンチ操作の名残のclickと判定し、タップ選択を行いませんでした");
      return lines.join("\n");
    }
    if (e.kind === "no-geo") {
      lines.push("  screenToLatLng: null(地球の外・背景をタップ)");
      lines.push("  → 選択結果なし(理由: 地球儀の外をタップした)");
      return lines.join("\n");
    }
    lines.push(`  screenToLatLng: lat=${e.geo.lat.toFixed(4)} lng=${e.geo.lng.toFixed(4)}`);
    lines.push(`  findDirectPolygonHit: ${e.directHitName || "なし"}`);
    if (e.candidates && e.candidates.length) {
      const list = e.candidates.map((c) => `${c.name}(${c.dist.toFixed(1)}px${c.dist <= TAP_ASSIST_RADIUS_PX ? "・圏内" : "・圏外"})`).join(", ");
      lines.push(`  タップ補助候補(近い順、上位${e.candidates.length}件): ${list}`);
    } else {
      lines.push("  タップ補助候補: なし(現在のズームで補助対象になる小さな国・地域が無い)");
    }
    if (e.assistName) {
      lines.push(`  → 採用されたタップ補助候補: ${e.assistName}(${e.assistDist.toFixed(1)}px)`);
    }
    if (e.bboxContainsTap !== undefined) {
      lines.push(`  bboxContainsTap(飛び地救済): ${e.bboxContainsTap}`);
    }
    if (e.isNearPinShapeResult !== undefined) {
      lines.push(`  isNearPinShape: ${e.isNearPinShapeResult}`);
    }
    if (e.target) {
      lines.push(`  → 選択結果: ${e.target}`);
    } else {
      lines.push(`  → 選択結果なし(理由: ${e.noSelectionReason || "直接ヒットなし・タップ補助候補も無しまたは不採用"})`);
    }
    return lines.join("\n");
  }
  function renderTapDebugPanel() {
    const textarea = $("map-tap-debug-log");
    if (!textarea) return;
    textarea.value = tapDebugLog.map(formatTapDebugEntry).join("\n\n");
    textarea.scrollTop = textarea.scrollHeight;
  }
  function logTapDebug(entry) {
    if (!tapDebugEnabled) return;
    tapDebugLog.push(entry);
    if (tapDebugLog.length > TAP_DEBUG_MAX_ENTRIES) tapDebugLog.shift();
    renderTapDebugPanel();
  }
  // コピー・クリア・閉じるボタンの初期化(診断モード有効時のみ呼ばれる)。
  // navigator.clipboard.writeText()が使えない場合(古いSafari等)は、
  // textarea自体を選択してdocument.execCommand("copy")にフォールバックする。
  // いずれの方法でも外部への送信は発生しない(ブラウザのクリップボードのみ)
  function setupTapDebugUI() {
    const panel = $("map-tap-debug-panel");
    if (!panel) return;
    panel.classList.remove("hidden");
    panel.setAttribute("aria-hidden", "false");
    const copyBtn = $("map-tap-debug-copy");
    const clearBtn = $("map-tap-debug-clear");
    const closeBtn = $("map-tap-debug-close");
    const textarea = $("map-tap-debug-log");
    if (copyBtn) {
      copyBtn.addEventListener("click", async () => {
        const text = textarea ? textarea.value : "";
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
          } else {
            throw new Error("clipboard API unavailable");
          }
          copyBtn.textContent = "コピーしました";
        } catch (e) {
          if (textarea) {
            textarea.focus();
            textarea.select();
            document.execCommand("copy");
          }
          copyBtn.textContent = "コピーしました";
        }
        setTimeout(() => { copyBtn.textContent = "コピー"; }, 1500);
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        tapDebugLog = [];
        renderTapDebugPanel();
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        panel.classList.add("hidden");
        panel.setAttribute("aria-hidden", "true");
      });
    }
  }
  // タップとドラッグ/ピンチ操作を区別するため、pointerdownの位置を記録しておく。
  // 2本目の指が触れたら(ピンチ操作)、その後のclickはタップ選択の対象外にする
  let tapPointerDownPos = null;
  let tapMultiPointerActive = false;
  function handleContainerPointerDown(evt) {
    if (evt.isPrimary) {
      tapPointerDownPos = { x: evt.clientX, y: evt.clientY };
      tapMultiPointerActive = false;
      // タップ診断モード: pointerdownはあったがclick(=handleMapTap)が一度も
      // 発生しない「指離しのタイミングで選択が起きなかった」ケースを検出する。
      // 新しいpointerdownが来た時点で前回分の判定は意味を失うため、同じ
      // オブジェクト参照を使い捨てタイマーの有効性チェックに利用する
      if (tapDebugEnabled) {
        const downInfo = { x: evt.clientX, y: evt.clientY };
        tapDebugPendingDown = downInfo;
        setTimeout(() => {
          if (tapDebugPendingDown === downInfo) {
            logTapDebug({ kind: "pointerdown-no-click", x: downInfo.x, y: downInfo.y });
            tapDebugPendingDown = null;
          }
        }, TAP_DEBUG_PENDING_TIMEOUT_MS);
      }
    } else {
      tapMultiPointerActive = true;
      tapPointerDownPos = null;
    }
  }
  // タップ操作1回につき1度だけ、同期的に国・地域を決定する。実際にタップした
  // 地形(実ポリゴンへの直接ヒット)を基本的に尊重しつつ、小国のピン・補助範囲を
  // タップした場合は正しくその小国を選べるよう優先順位を調整する(詳細は下記)。
  // 大きな国の通常のタップ操作は、そもそもタップ補助が発火しない(画面上十分に
  // 大きく見えるため)ので、常に直接ヒットどおりに選択され、この優先順位の
  // 影響を受けない
  function handleMapTap(evt) {
    if (!globeInstance || !countryById) return;
    tapDebugPendingDown = null; // clickが発生した(=pointerdown-no-clickの対象外)
    const downPos = tapPointerDownPos;
    const wasMultiPointer = tapMultiPointerActive;
    tapPointerDownPos = null;
    tapMultiPointerActive = false;
    const camPos = tapDebugEnabled ? globeInstance.camera().position : null;
    const pov = tapDebugEnabled ? globeInstance.pointOfView() : null;
    if (wasMultiPointer) {
      logTapDebug({ kind: "ignored-multi-pointer", px: evt.clientX, py: evt.clientY, pov, camPos });
      return; // ピンチ操作の名残のclickは無視する
    }
    if (downPos) {
      const dx = evt.clientX - downPos.x;
      const dy = evt.clientY - downPos.y;
      const moveDist = Math.sqrt(dx * dx + dy * dy);
      if (moveDist > TAP_MAX_MOVE_PX) {
        logTapDebug({ kind: "ignored-drag", px: evt.clientX, py: evt.clientY, moveDist, pov, camPos });
        return; // 回転・ドラッグ操作とみなす
      }
    }

    const container = $("map-globe-container");
    const rect = container.getBoundingClientRect();
    const px = evt.clientX - rect.left;
    const py = evt.clientY - rect.top;
    const geo = screenToLatLng(px, py);
    if (!geo) {
      logTapDebug({ kind: "no-geo", px, py, pov, camPos });
      return; // 地球の外(背景)をタップした
    }

    const directHit = findDirectPolygonHit(geo.lat, geo.lng);
    const assist = findNearestTapAssistCandidate(px, py);

    // 実際にタップした地形(directHit)を基本的に尊重しつつ、小国のピン・
    // 補助範囲をタップした場合は正しくその小国を選べるようにする。
    //   - 補助候補が無ければ、直接ヒットをそのまま使う
    //   - 補助候補があり、直接ヒットが無い、または直接ヒットと同じ国なら、
    //     そのまま補助候補(=直接ヒットと一致)を使う
    //   - 補助候補と直接ヒットが「別の国」を指している場合だけ、以下のどちら
    //     かに該当するときだけ補助候補を優先する。それ以外は直接ヒット
    //     (実際にタップした地形)を優先し、近くの小国に誤って奪われないようにする
    //       (a) タップ地点の緯度経度が、補助候補の実ポリゴンの外側バウンディング
    //           ボックスには入っている場合。これはバチカン/サンマリノのように
    //           イタリアの中に完全に囲まれる極小の飛び地で、画面→球面交点への
    //           変換のわずかな誤差により厳密な点内外判定だけがはみ出してしまう
    //           典型パターンで、補助側の判定のほうが正しい
    //       (b) タップ地点が、補助候補の📍の実際に表示されている見た目の形状
    //           (頭の円・針の円錐)の上にある場合(isNearPinShape)。単純な
    //           「アンカーから一定距離以内」という円形の判定ではなく、📍の
    //           実シルエットに対して判定することで、ユーザーが明らかにその
    //           📍自体を狙ってタップしたとみなせる場合だけに限定している
    //     これにより、例えば香港・マカオのすぐ近くの中国本土を直接タップした
    //     場合や、バチカンの近くのイタリア市街を直接タップした場合は、たまたま
    //     画面上で小国の📍アンカーに近くても、その小国の📍自体の絵の上を
    //     タップしたのでない限り、直接タップした国(中国・イタリア)が
    //     そのまま選ばれる
    let target = directHit;
    let bboxContainsTap, isNearPinShapeResult;
    if (assist && (!directHit || assist.country.id !== directHit.id)) {
      const info = assist.info;
      bboxContainsTap =
        info && geo.lat >= info.minLat && geo.lat <= info.maxLat &&
        geo.lng >= info.minLng && geo.lng <= info.maxLng;
      isNearPinShapeResult = !directHit ? undefined : isNearPinShape(px, py, assist.country.id, info);
      if (!directHit || bboxContainsTap || isNearPinShapeResult) {
        target = assist.country;
      }
    }
    if (target) selectCountry(target, { moveCamera: false });

    if (tapDebugEnabled) {
      let noSelectionReason;
      if (!target) {
        if (!assist) noSelectionReason = "直接ヒットも補助候補も無し";
        else noSelectionReason = "補助候補はあったが不採用、かつ直接ヒットも無し";
      }
      logTapDebug({
        kind: "tap", px, py, pov, camPos, geo,
        directHitName: directHit ? directHit.name : null,
        candidates: collectTapAssistCandidatesForDebug(px, py, 5),
        assistName: assist ? assist.country.name : null,
        assistDist: assist ? assist.dist : null,
        bboxContainsTap,
        isNearPinShapeResult,
        target: target ? target.name : null,
        noSelectionReason,
      });
    }
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
      .onGlobeReady(() => {
        resizeGlobe();
        globeInstance.pointOfView({ lat: 15, lng: 30, altitude: INITIAL_VIEW_ALTITUDE }, 0);
        startAutoRotate();
        hookRendererForLabelSync();
        // 📍の3Dオブジェクト化に使うThree.jsクラスをここで一度だけ取得してから、
        // 実際のピンレイヤーを構築する(取得完了まで📍は一時的に表示されない)
        bootstrapPinClasses().then((classes) => {
          if (!classes) {
            console.error("📍の3Dオブジェクト化に必要なThree.jsクラスを取得できませんでした");
            return;
          }
          refreshPinLayer();
        });
      });

    // 衛星写真ではなく、国境が見やすい明るい水色の海にする。
    // 陸地を国ごとのやさしいパステルカラーで塗り分けるのに合わせ、海も
    // 落ち着いたパステル寄りの水色(#A9D3E8)にする。
    // このglobe.glビルドはwindow.THREEを公開していないため、new THREE.Material(...)は使えない。
    // 代わりにglobeMaterial()を引数なしで呼び、既存のマテリアルインスタンスを取得して
    // その場でcolorだけ書き換える(Kapsuleアクセサの取得/設定パターン)
    const material = globeInstance.globeMaterial();
    if (material && material.color && typeof material.color.set === "function") {
      material.color.set("#A9D3E8");
      if ("shininess" in material) material.shininess = 6;
    }

    const controls = globeInstance.controls();
    controls.enableDamping = true;
    // 以前は120(=GLOBE_RADIUS+20、地表からの距離20)が最大ズームイン時の
    // カメラ距離だった。モナコ・バチカン・サンマリノ等の小さな国が見づらいとの
    // 要望に対応し、見かけの拡大率(画面上のサイズ)が約3倍になるよう、
    // 地表からの距離を1/3にする(透視投影では画面上のサイズは距離にほぼ反比例するため)
    controls.minDistance = GLOBE_RADIUS + (120 - GLOBE_RADIUS) / 3; // ≈106.67
    controls.maxDistance = 500;

    // 国・地域の選択は、globe.gl自身のレイキャスト・クリックシステムには頼らず
    // handleMapTap(上記)に一本化している。pointerdownでタップ開始位置を記録し
    // (ドラッグ/ピンチとの区別、複数指の検出に使う)、実際の判定はclick
    // (=pointerup相当、タップ/クリックのみで発火しドラッグ操作とは区別される)で行う
    container.addEventListener("pointerdown", handleContainerPointerDown, { passive: true });
    container.addEventListener("click", handleMapTap);
    // 地球儀を直接操作し始めたら、開いたままの地域ドロップダウンは閉じる
    container.addEventListener("pointerdown", closeRegionList, { passive: true });

    // 最初にユーザーが触れた瞬間だけ自動回転を止める
    ["pointerdown", "wheel", "touchstart"].forEach((evt) => {
      container.addEventListener(evt, stopAutoRotateOnce, { passive: true });
    });

    window.addEventListener("resize", resizeGlobe);

    // globe.glはインスタンス生成と同時に描画ループを開始する。読み込みが
    // 完了した時点で、ユーザーが既にトップへ戻っていた場合は、ここで即座に
    // 止めておく(その後onGlobeReady()が遅れて発火しても、pauseAnimation()で
    // 止まった描画ループ自体は再開しないため、カメラ位置などの一回限りの
    // 初期化処理は従来どおり実行させてよい)
    if (!isMapScreenActive) globeInstance.pauseAnimation();
  }

  function resizeGlobe() {
    if (!globeInstance) return;
    const container = $("map-globe-container");
    globeInstance.width(container.clientWidth);
    globeInstance.height(container.clientHeight);
    positionPinsToggleButton();
    positionInfoCardForDesktop();
    // リサイズ直後、カメラが静止していて次の描画が起きるとは限らないため、
    // ここでも一度だけ即座にピン・ラベル位置を合わせておく
    onAfterRender();
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

  // 地図タップ・検索のどちらから来ても、この共通処理で国を選択する。
  // 地球儀への直接タップ(handleMapTap)は「今見ている画面をユーザーが自分で
  // 作った状態」として一切動かさない(moveCamera:false)。検索からの選択だけ、
  // その国までカメラを移動してよい
  // moveCameraをfalseにすると、選択状態の更新と情報カード表示だけを行い、
  // 現在のズーム倍率・向き・位置には一切触れない
  // 選択用の赤📍+国名ラベルを出す対象かどうかは、赤い📍を表示する対象と
  // 同じPIN_TARGET_IDSで判定する。コスタリカなど普通に形が見える国を選択
  // した場合は、黄色いポリゴン+情報カードだけでよく、この表示は出さない
  function isPinEligible(id) {
    return PIN_TARGET_IDS.has(id);
  }

  // ---------- 検索・ランダム選択時の自動ズーム(国・地域の実際の大きさに応じて調整) ----------
  // 以前はmoveCamera時のaltitudeが南極大陸を除き常に1.5固定だったため、
  // バチカンのような極小国では位置が、ロシアのような巨大国では逆に
  // 寄りすぎて全体像が、それぞれ分かりづらかった。PIN_TARGET_IDSのような
  // 固定の国名リストは使わず、computeCountryGeoInfo()が全216件について
  // 既に計算済みのsizeDeg(離島を含む全体のバウンディングボックスではなく、
  // 最大の島・主な地形=代表サブポリゴンだけのバウンディングボックス角度。
  // 離島が散らばる国で「全体」を基準にすると過度に引いてしまうのを避けるため)
  // から、対象の最大の地形がだいたい画面の高さのAUTO_ZOOM_TARGET_FRACTION
  // 程度を占めるような距離を逆算する。
  const AUTO_ZOOM_TARGET_FRACTION = 0.42;
  const AUTO_ZOOM_FALLBACK_SIZE_DEG = 8; // ポリゴン情報が無い場合のみ使う、中規模国相当のデフォルト
  function computeAutoZoom(country) {
    if (country.id === "antarctica") {
      // 南極大陸は極付近を囲む特殊な形状で、sizeDeg(緯度経度の単純な角度幅)が
      // 実際の見かけの大きさを表さないため、従来どおり専用の広域表示を維持する
      return { altitude: 2.0, needsMarker: false };
    }
    const camera = globeInstance && globeInstance.camera();
    const fovRad = ((camera && camera.fov) || 50) * (Math.PI / 180);
    const worldUnitsPerDeg = (GLOBE_RADIUS * Math.PI) / 180;
    const info = countryGeoById.get(country.id);
    const sizeDeg = info && info.sizeDeg > 0 ? info.sizeDeg : AUTO_ZOOM_FALLBACK_SIZE_DEG;
    const objectWorldSize = sizeDeg * worldUnitsPerDeg;
    // altitudeは「地表からの距離 ÷ GLOBE_RADIUS」(pointOfViewの定義、
    // controls.minDistance/maxDistanceが表す「球の中心からの距離」とは異なる)。
    // 見かけの大きさは地表からの距離(GLOBE_RADIUS*altitude)で決まるため、
    // ここで求めるのもその「地表からの理想距離」であることに注意
    const idealAltitude =
      objectWorldSize / (2 * AUTO_ZOOM_TARGET_FRACTION * Math.tan(fovRad / 2)) / GLOBE_RADIUS;
    const controls = globeInstance && globeInstance.controls();
    // 既存の最大ズーム制限(controls.minDistance、球の中心からの距離)をaltitudeに
    // 換算したものより内側には絶対に入らない。広げすぎないよう、
    // INITIAL_VIEW_ALTITUDE(地図を開いた時の初期値)を上限にする
    const minAltitude = controls && controls.minDistance ? controls.minDistance / GLOBE_RADIUS - 1 : 0.0667;
    const maxAltitude = INITIAL_VIEW_ALTITUDE;
    const altitude = Math.max(minAltitude, Math.min(maxAltitude, idealAltitude));
    return {
      altitude,
      // 理想のaltitude(idealAltitude)が既存の最大ズーム制限(minAltitude)より
      // 小さい(＝もっと寄りたい)場合、これ以上大きく見せられない「極小」の対象とみなす
      needsMarker: idealAltitude < minAltitude - 0.001,
    };
  }
  // 実ポリゴンの代表点(より正確)を優先し、無ければ従来どおりデータ上の
  // 緯度経度にフォールバックする。香港のように、データ上の代表座標が
  // 実際のポリゴンよりわずかに外側になっているケースでも、検索時はこちらを
  // 使うことでカメラがより正確に対象の実際の地形へ向く
  function anchorForCountry(country) {
    const info = countryGeoById.get(country.id);
    return info ? { lat: info.lat, lng: info.lng } : { lat: country.lat, lng: country.lng };
  }
  function prefersReducedMotion() {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
      return false;
    }
  }
  // ---------- 情報カードに隠れないよう、検索・ランダム選択時の注視点をずらす ----------
  // pointOfView()は指定した緯度経度を必ず画面中央に置くため、画面下(スマホ、
  // 下からのシート)・右側(PC/タブレット、固定パネル)を覆う情報カードが開くと、
  // 対象がその真裏に隠れてしまう。カメラの向きではなく、情報カードで隠れない
  // 側にわずかにずらした地点を「注視点」にすることで、実際の対象(ハイライト・
  // 目印)は画面上、カードに隠れない位置に表示される(対象そのものの位置は
  // 一切動かさない。あくまでカメラが見る中心をずらすだけ)
  function cardAvoidanceTarget(lat, lng, altitude) {
    if (!globeInstance) return { lat, lng };
    const camera = globeInstance.camera();
    const container = $("map-globe-container");
    if (!camera || !container) return { lat, lng };
    const fovRad = ((camera.fov || 50) * Math.PI) / 180;
    // 見かけの大きさ・視野の広さは「地表からの距離」(GLOBE_RADIUS*altitude)で
    // 決まる(球の中心からの距離 GLOBE_RADIUS*(1+altitude) ではない。
    // computeAutoZoomと同じ注意点)
    const dist = GLOBE_RADIUS * altitude;
    const worldUnitsPerDeg = (GLOBE_RADIUS * Math.PI) / 180;
    const halfViewWorldY = dist * Math.tan(fovRad / 2); // 画面中央〜上端のワールド単位
    let isDesktopLayout = false;
    try {
      isDesktopLayout = window.matchMedia("(min-width: 700px)").matches;
    } catch (e) {
      // matchMediaが使えない環境ではモバイル(下シート)扱いのままにする
    }
    if (!isDesktopLayout) {
      // スマホ: 画面下からのシート(最大46vh)に隠れないよう、対象が画面
      // 中央よりやや上に見えるよう注視点を少し南(緯度を下げる)にずらす
      const shiftWorld = halfViewWorldY * 0.22;
      const deltaLat = shiftWorld / worldUnitsPerDeg;
      return { lat: Math.max(-85, Math.min(85, lat - deltaLat)), lng };
    }
    // PC/タブレット: 右側の固定パネル(320px)に隠れないよう、対象が画面
    // 左寄りに見えるよう注視点を少し東(経度を上げる)にずらす
    const aspect = camera.aspect || container.clientWidth / container.clientHeight || 1;
    const halfViewWorldX = halfViewWorldY * aspect;
    const shiftWorldX = halfViewWorldX * 0.16;
    const cosLat = Math.cos((lat * Math.PI) / 180) || 0.0001;
    const deltaLng = shiftWorldX / (worldUnitsPerDeg * cosLat);
    return { lat, lng: lng + deltaLng };
  }

  function selectCountry(country, options) {
    const moveCamera = !options || options.moveCamera !== false;
    hasInteracted = true;
    selectedCountryId = country.id;

    // 自動ズーム・一時的な目印の要否は、カメラを動かす(検索・ランダム)場合
    // だけ計算する。地図への直接タップ(moveCamera:false)の既存動作は変えない
    const zoom = moveCamera ? computeAutoZoom(country) : null;
    const needsSearchMarker = !!(zoom && zoom.needsMarker && !isPinEligible(country.id));
    tempSearchMarkerId = needsSearchMarker ? country.id : null;
    // 選択した瞬間のピン対象状態を固定する。選択中にズームが変わっても
    // ラベル表示・非表示が途中で切り替わってちらつかないようにするため。
    // 既存の固定リスト(PIN_TARGET_IDS)に加え、今回の自動ズームで「最大ズーム
    // でも十分な大きさにできない」と判定された国・地域も対象にする
    selectedShowsLabel = isPinEligible(country.id) || needsSearchMarker;

    if (globeInstance) {
      globeInstance.controls().autoRotate = false;
      refreshPolygonStyles();
      refreshPinLayer();
      if (selectedShowsLabel) {
        startLabelTracking(country);
      } else {
        stopLabelTracking();
      }
      if (moveCamera) {
        // 現在の視点を大きく失わない程度に、対象の国へゆっくり移動する。
        // 実ポリゴンに基づく代表点(anchorForCountry)へ、国・地域の実際の
        // 大きさに応じたズーム(computeAutoZoom)で移動し、情報カードに隠れない
        // 側へ注視点を少しずらす(cardAvoidanceTarget、対象自体の位置は動かさない)
        const anchor = anchorForCountry(country);
        const target = cardAvoidanceTarget(anchor.lat, anchor.lng, zoom.altitude);
        const duration = prefersReducedMotion() ? 0 : 1200;
        globeInstance.pointOfView({ lat: target.lat, lng: target.lng, altitude: zoom.altitude }, duration);
      }
    }
    renderInfoCard(country);
    closeSearchSuggestions();
  }

  function renderInfoCard(country) {
    const flagImg = $("map-card-flag");
    flagImg.src = country.flag;
    // isFlagImage:falseの国・地域(南極大陸、北キプロス、ソマリランド、
    // シアチェン氷河など)は、公式な国旗が存在しない、または国旗と呼ぶと
    // 誤解を招くため「国旗」とは呼ばない(実際に表示しているのは中立的なアイコン)
    flagImg.alt = country.isFlagImage === false ? `${country.name}のアイコン` : `${country.name}の国旗`;
    $("map-card-name").textContent = country.name;

    // 地域名(regionJa)は地域フィルター・検索専用のデータとして残しつつ、
    // 見出しからは省略する。首都の見出しラベル・値・補足情報の算出は
    // 世界図鑑モードとも共通のロジック(js/capital-display.js)を使う
    const { label, value, supplementEntries } = resolveCapitalDisplay(country);
    $("map-card-capital-label-text").textContent = label;
    $("map-card-capital").textContent = value;

    const supplementEl = $("map-card-supplement");
    supplementEl.innerHTML = "";
    if (supplementEntries.length) {
      supplementEntries.forEach((entry) => {
        const li = document.createElement("li");
        li.textContent = `${entry.type}：${entry.name}`;
        supplementEl.appendChild(li);
      });
      supplementEl.classList.remove("hidden");
    } else {
      supplementEl.classList.add("hidden");
    }

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
    tempSearchMarkerId = null; // 一時的な目印も選択解除と同時に消す(古い目印を残さない)
    stopLabelTracking();
    refreshPolygonStyles();
    refreshPinLayer();
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
    refreshPinLayer();
    // 南極のように「ランダムな国へ」の候補が1件もない地域に切り替えた場合は
    // ボタンを無効化し、他の地域(候補が戻る)に切り替えたら自動的に有効へ戻す
    updateRandomButtonState();
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
  // ボタンの無効状態には2つの独立した理由がある:
  //   1. isRandomFlightInProgress: カメラ移動アニメーション中の一時的な無効化
  //   2. 現在の地域フィルターに候補が1件も無い(南極など)ことによる無効化
  // この2つはORで合成するだけで競合しない。「1.」はsetTimeoutで解除される
  // 際にこの関数を呼び直すだけにし、直接disabled=falseを代入しない。これにより、
  // アニメーション終了時点でまだ候補0件の地域のままなら無効状態が正しく保たれる。
  // 南極を個別にif判定するのではなく候補数で判定するため、今後ほかの地域の
  // データがrandomEligible:falseだけになった場合も自動的に対応できる
  function updateRandomButtonState() {
    const btn = $("map-random-btn");
    const poolEmpty = getRegionPool(currentRegionFilter).length === 0;
    btn.disabled = isRandomFlightInProgress || poolEmpty;
    if (poolEmpty) {
      const label = (REGION_LABELS[currentRegionFilter] || "この地域").replace(/^\S+\s*/, "");
      btn.textContent = `🎲 ${label}には国がありません`;
      btn.title = `${label}にはランダム選択できる国がありません`;
    } else {
      btn.textContent = "🎲 ランダムな国へ";
      btn.title = "";
    }
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
    isRandomFlightInProgress = true;
    updateRandomButtonState();
    clearTimeout(randomFlightTimer);
    randomFlightTimer = setTimeout(() => {
      isRandomFlightInProgress = false;
      // タイマー終了時点で地域フィルターが変わっていても(例: アニメーション中に
      // 南極へ切り替えた場合)、候補数に応じた正しい状態に戻す
      updateRandomButtonState();
    }, 1300);
    // 検索選択と全く同じ経路(moveCamera:true)で選択するため、到着後の状態
    // (選択表示・ピン非表示・ラベル・情報カード)は検索と完全に同一になる
    selectCountry(country, { moveCamera: true });
  }

  // ---------- 画面の開閉(タブを行き来してもデータは再取得しない) ----------
  function open() {
    isMapScreenActive = true;
    if (!tapDebugEnabled && isTapDebugRequested()) {
      tapDebugEnabled = true;
      setupTapDebugUI();
    }
    ensureReady()
      .then(resumeMapIfScreenActive)
      .catch(() => {
        // エラー・非対応時のメッセージはensureReady内で表示済み。
        // 世界地図画面には留まれるので、他モードへの影響はない。
      });
  }

  // 画面を離れるときはレンダリングを止めてバッテリー消費を抑える。
  // ピン・ラベルの位置更新はonAfterRender()(実際の描画に同期したフック)が
  // 行うため、pauseAnimation()で描画自体が止まれば自動的に更新も止まる。
  // isMapScreenActiveをfalseにしておくことで、読み込みがこの後に完了
  // しても(ensureReady()のthenやonGlobeReady()が遅れて発火しても)、
  // 描画が勝手に再開しないようにする
  function close() {
    isMapScreenActive = false;
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
    $("map-status-retry").addEventListener("click", retryMapLoad);
    $("map-card-close").addEventListener("click", closeInfoCard);
    $("map-search-input").addEventListener("input", (e) => {
      renderSearchResults(e.target.value.trim());
    });
    $("map-search-input").addEventListener("focus", closeRegionList);
    buildRegionList();
    $("map-region-btn").addEventListener("click", toggleRegionList);
    $("map-random-btn").addEventListener("click", handleRandomClick);
    updateRandomButtonState();
    updatePinsToggleButton();
    $("map-pins-toggle-btn").addEventListener("click", togglePinsVisible);
  }

  // REGION_ORDER/REGION_LABELSは世界図鑑モード(js/encyclopedia.js)の地域
  // フィルターでも再利用する。country.regionの値そのもの(分類)は変えず、
  // 表示用のラベル一覧だけを公開する
  return { open, close, initEvents, REGION_ORDER, REGION_LABELS };
})();

document.addEventListener("DOMContentLoaded", () => MapModule.initEvents());
