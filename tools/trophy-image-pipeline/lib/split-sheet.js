"use strict";

const {
  computeBrightness,
  floodFillBackgroundFromBorder,
  labelForegroundComponents,
  countForegroundInRow,
  forceBackgroundRect,
} = require("./foreground-mask");

/**
 * シート全体を解析し、検出された前景の塊(連結成分)一覧を返す。
 * 単純な等分割は一切行わない。実際のピクセル配置から塊を検出する。
 */
function analyzeSheet(data, width, height, channels, options) {
  const { analyzeForeground } = require("./foreground-mask");
  return analyzeForeground(data, width, height, channels, options);
}

function significantComponents(components, width, height, minComponentSizeRatio) {
  const minSize = width * height * minComponentSizeRatio;
  const sig = components.filter((c) => c.size >= minSize);
  sig.sort((a, b) => b.size - a.size);
  return sig;
}

/**
 * 「列は正しく分離できているが、列の中で複数行が装飾の接触によって
 * 1個の塊に融合してしまっている」ケースを検出し、各列の中で
 * 隣接セルの装飾が最も細くくびれている箇所(=実際に接触している
 * 一番狭い断面)をピンポイントで探して切断する。
 *
 * これは「均等分割」ではない。期待される行境界のおおよその位置の
 * 近傍だけを探索範囲とし、その範囲内で実際にピクセル断面が最も細い
 * 場所を見つけて、そこだけを切る。見つけた切断箇所はすべて
 * cutsAppliedとして記録し、どこを・なぜ切ったかを報告できるようにする。
 *
 * @returns {{
 *   ok: boolean,
 *   components?: Array,
 *   labels?: Int32Array,
 *   cutsApplied?: Array,
 *   reason?: string
 * }}
 */
function analyzeSheetWithAutoSeamCuts(data, width, height, channels, rows, cols, options) {
  const opts = options || {};
  const darkThreshold = typeof opts.darkThreshold === "number" ? opts.darkThreshold : 18;
  const minComponentSizeRatio = typeof opts.minComponentSizeRatio === "number" ? opts.minComponentSizeRatio : 0.0015;
  const cutHalfHeight = typeof opts.seamCutHalfHeight === "number" ? opts.seamCutHalfHeight : 5;
  const searchRadiusRatio = typeof opts.seamSearchRadiusRatio === "number" ? opts.seamSearchRadiusRatio : 0.45;

  const brightness = computeBrightness(data, width, height, channels);
  const isBackground = floodFillBackgroundFromBorder(brightness, width, height, darkThreshold);
  const first = labelForegroundComponents(isBackground, width, height);
  const firstSignificant = significantComponents(first.components, width, height, minComponentSizeRatio);

  if (firstSignificant.length === rows * cols) {
    return { ok: true, components: firstSignificant, labels: first.labels, cutsApplied: [] };
  }

  if (rows <= 1 || firstSignificant.length !== cols) {
    return {
      ok: false,
      reason:
        `検出された前景の塊が${firstSignificant.length}個でした(期待値${rows * cols}個)。` +
        `列が${cols}個に分離できる状態でもないため、自動くびれ検出は適用できません。` +
        `darkThreshold等の調整、またはシートの再生成が必要です。`,
      components: firstSignificant,
    };
  }

  // 列ごとに、行境界のおおよその位置の近傍でくびれ(最も断面が細い行)を探して切る
  const columnsSorted = firstSignificant.slice().sort((a, b) => a.centroidX - b.centroidX);
  const cutsApplied = [];
  columnsSorted.forEach((col, ci) => {
    const colHeight = col.maxY - col.minY + 1;
    for (let k = 1; k < rows; k++) {
      const yApprox = col.minY + (colHeight * k) / rows;
      const searchRadius = (colHeight / rows) * searchRadiusRatio;
      const ylo = Math.max(col.minY, Math.round(yApprox - searchRadius));
      const yhi = Math.min(col.maxY, Math.round(yApprox + searchRadius));

      let minCount = Infinity;
      let waistY = Math.round(yApprox);
      for (let y = ylo; y <= yhi; y++) {
        const c = countForegroundInRow(isBackground, width, col.minX, col.maxX, y);
        if (c < minCount) {
          minCount = c;
          waistY = y;
        }
      }

      const cutYStart = waistY - cutHalfHeight;
      const cutYEnd = waistY + cutHalfHeight;
      forceBackgroundRect(isBackground, width, height, col.minX, col.maxX, cutYStart, cutYEnd);
      cutsApplied.push({
        column: ci,
        boundaryIndex: k,
        waistY,
        waistForegroundPixelCount: minCount,
        searchRange: [ylo, yhi],
        cutRange: [Math.max(col.minY, cutYStart), Math.min(col.maxY, cutYEnd)],
        columnXRange: [col.minX, col.maxX],
      });
    }
  });

  const second = labelForegroundComponents(isBackground, width, height);
  const secondSignificant = significantComponents(second.components, width, height, minComponentSizeRatio);

  if (secondSignificant.length !== rows * cols) {
    return {
      ok: false,
      reason:
        `自動くびれ検出による切断を適用しましたが、前景の塊が${secondSignificant.length}個になりました` +
        `(期待値${rows * cols}個)。接触箇所が想定より複雑である可能性があります。`,
      components: secondSignificant,
      cutsApplied,
    };
  }

  return { ok: true, components: secondSignificant, labels: second.labels, cutsApplied };
}

/**
 * 検出した連結成分を、設定ファイルで指定した行数×列数の読み順
 * (左→右、上→下)に割り当てる。
 *
 * 単純に「期待されるセル中心に最も近い成分」を割り当てるのではなく、
 * 実際に検出された成分の重心を上から下へ行方向にグルーピングし、
 * 各行内で左から右へソートする。これにより、行の境界が多少ずれていても
 * 実際の配置に追従できる。
 *
 * 成分数が rows*cols と一致しない場合は、無理に割り当てず
 * { ok:false, reason } を返す(ユーザー要求: 正確な分割ができない場合は
 * 無理に加工しない)。
 *
 * @param {Array} components - analyzeForeground()が返すcomponents(サイズ降順)
 * @param {number} rows
 * @param {number} cols
 * @returns {{ ok: true, ordered: Array } | { ok: false, reason: string, components: Array }}
 */
function matchComponentsToGridOrder(components, rows, cols) {
  const expected = rows * cols;
  if (components.length !== expected) {
    return {
      ok: false,
      reason:
        `検出された前景の塊が${components.length}個でした(設定上の期待値は` +
        `${rows}行×${cols}列=${expected}個)。darkThreshold等の調整が必要な可能性があります。`,
      components,
    };
  }

  const byY = components.slice().sort((a, b) => a.centroidY - b.centroidY);
  const ordered = [];
  for (let r = 0; r < rows; r++) {
    const rowItems = byY.slice(r * cols, (r + 1) * cols);
    rowItems.sort((a, b) => a.centroidX - b.centroidX);
    ordered.push(...rowItems);
  }

  // 整合性チェック: 行方向のグルーピングが本当に妥当か
  // (ある行の全メンバーのY範囲が、次の行の全メンバーのY範囲と
  //  大きく重なっていないか)を確認する。重なっている場合は
  // グリッド検出の信頼性が低いので警告を返す。
  const warnings = [];
  for (let r = 0; r < rows - 1; r++) {
    const thisRow = ordered.slice(r * cols, (r + 1) * cols);
    const nextRow = ordered.slice((r + 1) * cols, (r + 2) * cols);
    const thisMaxY = Math.max(...thisRow.map((c) => c.maxY));
    const nextMinY = Math.min(...nextRow.map((c) => c.minY));
    if (thisMaxY > nextMinY) {
      warnings.push(
        `${r + 1}行目と${r + 2}行目の縦方向の範囲が重なっています` +
          `(${r + 1}行目最大Y=${thisMaxY}, ${r + 2}行目最小Y=${nextMinY})。` +
          `行の自動判定が誤っている可能性があります。`
      );
    }
  }

  return { ok: true, ordered, warnings };
}

module.exports = { analyzeSheet, matchComponentsToGridOrder, analyzeSheetWithAutoSeamCuts };
