"use strict";

// 背景(ほぼ黒・画像の外周から連結)と前景(トロフィーの装飾)を、
// 単純な明度しきい値ではなく「外周から黒をたどる連結成分」で切り分ける
// モジュール。
//
// なぜ単純な明度しきい値だけで透明化しないか:
//   背景は黒に近いが、トロフィー装飾の内部にも暗い部分(夜空・影・瞳など)が
//   存在する。明度だけで「暗い=透明」にすると、装飾内部の暗い部分まで
//   透明になってしまう(ユーザー指摘の「透明化による暗色部分の消失」)。
//   そこで「画像の外周から4近傍でたどれる暗いピクセルの連なり」だけを
//   背景と確定し、装飾に囲まれて外周と繋がっていない暗い部分は前景として
//   残す。
//
// 読み取り専用・副作用なしの純粋関数群。既存アプリのコードには一切依存しない。

/**
 * RGB(A)の生ピクセル列から、明度(0-255)の配列を作る。
 * @param {Buffer|Uint8Array} data - sharpのraw()で得られるインターリーブ配列
 * @param {number} width
 * @param {number} height
 * @param {number} channels - 3(RGB) or 4(RGBA)
 * @param {number} [alphaBackgroundThreshold] - channels===4の場合のみ有効。
 *   シート自体が本物のアルファチャンネルを持つ場合(例: AI生成ツールが
 *   直接透過PNGを書き出した場合)、カットアウト境界に「ほぼ透明だが
 *   RGBだけ明るい色が残っている」アンプリマルチプライド由来のゴミ
 *   ピクセルが点在することがある。これをRGB明度だけで判定すると、
 *   本来透明であるべきこの種のノイズが前景(=装飾の一部)として
 *   誤認識され、枠の外周にジャギーなノイズとして残ってしまう。
 *   この値が指定された場合、ネイティブのalphaがこの値未満のピクセルは
 *   RGBが何であれ強制的に「背景候補」として扱う(具体的な明度値は
 *   backgroundModeにより異なる。下記参照)。
 *   アルファチャンネルを持たない(channels===3)シートには一切影響しない。
 * @param {"dark"|"light"} [backgroundMode] - 既定"dark"。シートの地色が
 *   白に近い場合(例: 白背景で書き出された画像シート)は"light"を指定する。
 *   alphaBackgroundThresholdによる強制値がdarkでは0(暗い側)・lightでは
 *   255(明るい側)になる点以外、明度配列そのものの計算方法(RGB最大値)は
 *   変わらない。背景かどうかの判定(しきい値との比較方向)は
 *   floodFillBackgroundFromBorder側で行う。
 * @returns {Uint8Array} 長さ width*height の明度配列(各チャンネルの最大値)
 */
function computeBrightness(data, width, height, channels, alphaBackgroundThreshold, backgroundMode) {
  const n = width * height;
  const brightness = new Uint8Array(n);
  const hasAlphaGate = channels >= 4 && typeof alphaBackgroundThreshold === "number";
  const forcedValue = backgroundMode === "light" ? 255 : 0;
  for (let i = 0; i < n; i++) {
    const o = i * channels;
    if (hasAlphaGate && data[o + 3] < alphaBackgroundThreshold) {
      brightness[i] = forcedValue;
      continue;
    }
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    brightness[i] = r > g ? (r > b ? r : b) : (g > b ? g : b);
  }
  return brightness;
}

/**
 * 画像の外周(四辺)から、背景候補のピクセルだけをBFSでたどり、
 * 「外周とつながっている背景候補の領域=確定背景」を求める。
 *
 * mode==="dark"(既定、従来どおり)の場合は threshold 未満(暗い)の
 * ピクセルを背景候補とする。mode==="light" の場合は threshold を
 * 超える(明るい)ピクセルを背景候補とする(地色が白に近いシート用)。
 * いずれの場合も、装飾の内部にある同系統の明度の部分(dark時の夜空・
 * 影、light時の雲・ハイライト等)は、外周と繋がっていなければ背景
 * 扱いにならず前景として残る(本モジュールの基本方針どおり)。
 *
 * @returns {Uint8Array} 1=確定背景, 0=それ以外(前景候補)
 */
function floodFillBackgroundFromBorder(brightness, width, height, threshold, mode) {
  const n = width * height;
  const isBackground = new Uint8Array(n);
  const visited = new Uint8Array(n);
  // スタック方式のBFS/DFS(再帰を使わず、大きな画像でもスタックオーバーフローしない)
  const stack = new Int32Array(n);
  let sp = 0;

  const isCandidate = mode === "light"
    ? (idx) => brightness[idx] > threshold
    : (idx) => brightness[idx] < threshold;

  function trySeed(idx) {
    if (visited[idx]) return;
    if (!isCandidate(idx)) return;
    visited[idx] = 1;
    isBackground[idx] = 1;
    stack[sp++] = idx;
  }

  for (let x = 0; x < width; x++) {
    trySeed(x); // 上辺
    trySeed((height - 1) * width + x); // 下辺
  }
  for (let y = 0; y < height; y++) {
    trySeed(y * width); // 左辺
    trySeed(y * width + (width - 1)); // 右辺
  }

  while (sp > 0) {
    const idx = stack[--sp];
    const x = idx % width;
    const y = (idx - x) / width;
    // 4近傍
    if (x > 0) tryVisit(idx - 1);
    if (x < width - 1) tryVisit(idx + 1);
    if (y > 0) tryVisit(idx - width);
    if (y < height - 1) tryVisit(idx + width);
  }

  function tryVisit(idx) {
    if (visited[idx]) return;
    if (!isCandidate(idx)) return;
    visited[idx] = 1;
    isBackground[idx] = 1;
    stack[sp++] = idx;
  }

  return isBackground;
}

/**
 * 確定背景ではない全ピクセル(=前景候補。明るいピクセル+外周と繋がって
 * いない暗い穴)を対象に、4近傍での連結成分ラベリングを行う。
 * @returns {{ labels: Int32Array, components: Array<{id:number,size:number,minX:number,minY:number,maxX:number,maxY:number}> }}
 */
function labelForegroundComponents(isBackground, width, height) {
  const n = width * height;
  const labels = new Int32Array(n); // 0 = 背景 or 未割当, 1..k = 成分ID
  const components = [];
  const stack = new Int32Array(n);

  let nextLabel = 0;
  for (let start = 0; start < n; start++) {
    if (isBackground[start] || labels[start] !== 0) continue;
    nextLabel++;
    let sp = 0;
    stack[sp++] = start;
    labels[start] = nextLabel;
    let size = 0;
    let minX = width, maxX = -1, minY = height, maxY = -1;
    let sumX = 0, sumY = 0;
    while (sp > 0) {
      const idx = stack[--sp];
      const x = idx % width;
      const y = (idx - x) / width;
      size++;
      sumX += x; sumY += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      const neighbors = [
        x > 0 ? idx - 1 : -1,
        x < width - 1 ? idx + 1 : -1,
        y > 0 ? idx - width : -1,
        y < height - 1 ? idx + width : -1,
      ];
      for (const nb of neighbors) {
        if (nb < 0) continue;
        if (isBackground[nb] || labels[nb] !== 0) continue;
        labels[nb] = nextLabel;
        stack[sp++] = nb;
      }
    }
    components.push({
      id: nextLabel,
      size,
      minX, maxX, minY, maxY,
      centroidX: sumX / size,
      centroidY: sumY / size,
    });
  }
  return { labels, components };
}

/**
 * 画像全体(1枚のシート全体でも、1セル分の粗い切り出しでもよい)から、
 * 「外周から来た黒=背景」「それ以外=前景」を求め、サイズの大きい順に
 * 並べた連結成分一覧を返す。
 *
 * @param {Buffer|Uint8Array} data - raw pixel data (interleaved)
 * @param {number} width
 * @param {number} height
 * @param {number} channels
 * @param {{darkThreshold?: number, lightThreshold?: number, minComponentSizeRatio?: number}} [options]
 *   lightThresholdが指定された場合は地色が白に近いシートとして扱い
 *   (backgroundMode="light")、darkThresholdは無視する。未指定の場合は
 *   従来どおりdarkThresholdによる暗背景判定(backgroundMode="dark")。
 * @returns {{
 *   labels: Int32Array,
 *   width: number,
 *   height: number,
 *   components: Array<{id:number,size:number,minX:number,maxX:number,minY:number,maxY:number,centroidX:number,centroidY:number}>
 * }}
 */
function analyzeForeground(data, width, height, channels, options) {
  const opts = options || {};
  const minComponentSizeRatio = typeof opts.minComponentSizeRatio === "number" ? opts.minComponentSizeRatio : 0.0015;
  const backgroundMode = typeof opts.lightThreshold === "number" ? "light" : "dark";
  const threshold = backgroundMode === "light"
    ? opts.lightThreshold
    : (typeof opts.darkThreshold === "number" ? opts.darkThreshold : 18);

  const brightness = computeBrightness(data, width, height, channels, opts.alphaBackgroundThreshold, backgroundMode);
  const isBackground = floodFillBackgroundFromBorder(brightness, width, height, threshold, backgroundMode);
  const { labels, components } = labelForegroundComponents(isBackground, width, height);

  const minSize = width * height * minComponentSizeRatio;
  const significant = components.filter((c) => c.size >= minSize);
  significant.sort((a, b) => b.size - a.size);

  return { labels, width, height, components: significant, allComponents: components, isBackground };
}

/**
 * 指定した行(y)のうち、xMin..xMaxの範囲で前景(非背景)と判定された
 * ピクセル数を数える。セル境界の「くびれ(waist)」= 2つの隣接装飾が
 * 接触している最も細い断面を見つけるために使う。
 */
function countForegroundInRow(isBackground, width, xMin, xMax, y) {
  let count = 0;
  const base = y * width;
  for (let x = xMin; x <= xMax; x++) {
    if (!isBackground[base + x]) count++;
  }
  return count;
}

/**
 * isBackgroundを直接書き換えて、指定した矩形範囲を強制的に背景扱いにする。
 * 「2つの装飾が接触している最も細いくびれ」をラベリング前に意図的に
 * 切断するために使う(=安易な均等分割ではなく、実際に検出した接触点を
 * ピンポイントで切る)。
 */
function forceBackgroundRect(isBackground, width, height, xMin, xMax, yMin, yMax) {
  const x0 = Math.max(0, xMin);
  const x1 = Math.min(width - 1, xMax);
  const y0 = Math.max(0, yMin);
  const y1 = Math.min(height - 1, yMax);
  for (let y = y0; y <= y1; y++) {
    const base = y * width;
    for (let x = x0; x <= x1; x++) {
      isBackground[base + x] = 1;
    }
  }
}

module.exports = {
  computeBrightness,
  floodFillBackgroundFromBorder,
  labelForegroundComponents,
  analyzeForeground,
  countForegroundInRow,
  forceBackgroundRect,
};
