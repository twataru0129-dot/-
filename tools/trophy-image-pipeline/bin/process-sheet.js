#!/usr/bin/env node
"use strict";

// トロフィー画像加工パイプラインのCLIエントリーポイント。
// 使い方: node bin/process-sheet.js [config/sheets/<name>.json]
// 既存アプリには一切依存しない、独立したツール。

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const { loadRawRgb } = require("../lib/sheet-io");
const { analyzeSheetWithAutoSeamCuts, matchComponentsToGridOrder } = require("../lib/split-sheet");
const { buildSmoothedAlpha, extractComponentSquare, checkCircleSafety, exportTiers } = require("../lib/process-cell");
const { buildMontage } = require("../lib/montage");

const ROOT = path.join(__dirname, "..");

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function main() {
  const sheetConfigPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(ROOT, "config", "sheets", "sample-flag-trivia-9.json");

  const defaults = loadJson(path.join(ROOT, "config", "defaults.json"));
  const sheetConfig = loadJson(sheetConfigPath);
  const opts = Object.assign({}, defaults, sheetConfig);

  const sheetPath = path.resolve(ROOT, sheetConfig.sheet);
  console.log(`[1/6] シート読み込み: ${sheetPath}`);
  const { data, width, height, channels, originalMetadata } = await loadRawRgb(sheetPath);
  console.log(`      ${width}x${height}px, channels=${channels}, format=${originalMetadata.format}`);

  console.log(`[2/6] 前景検出(外周フラッドフィル + 連結成分ラベリング)`);
  const analysis = analyzeSheetWithAutoSeamCuts(data, width, height, channels, sheetConfig.rows, sheetConfig.cols, {
    darkThreshold: opts.darkThreshold,
    minComponentSizeRatio: opts.minComponentSizeRatio,
    seamCutHalfHeight: opts.seamCutHalfHeight,
    seamSearchRadiusRatio: opts.seamSearchRadiusRatio,
    alphaBackgroundThreshold: opts.alphaBackgroundThreshold,
  });

  const report = {
    generatedAt: new Date().toISOString(),
    sheetConfigPath,
    sheetPath,
    sheetSize: { width, height },
    darkThreshold: opts.darkThreshold,
    expectedCellCount: sheetConfig.cells.length,
    problems: [],
    warnings: [],
    cells: [],
    seamCutsApplied: analysis.cutsApplied || [],
  };

  if (!analysis.ok) {
    report.problems.push(analysis.reason);
    report.detectedComponents = (analysis.components || []).map((c) => ({
      size: c.size,
      bbox: [c.minX, c.minY, c.maxX, c.maxY],
      width: c.maxX - c.minX + 1,
      height: c.maxY - c.minY + 1,
      centroid: [Math.round(c.centroidX), Math.round(c.centroidY)],
    }));
    const outDir = path.join(ROOT, "output");
    ensureDir(outDir);
    fs.writeFileSync(path.join(outDir, "quality-report.json"), JSON.stringify(report, null, 2), "utf8");
    console.error("\n[問題] 正確な分割ができませんでした。無理な加工は行っていません。");
    console.error(analysis.reason);
    console.error(`詳細は ${path.join(outDir, "quality-report.json")} を確認してください。`);
    process.exitCode = 1;
    return;
  }

  console.log(`      検出された前景の塊: ${analysis.components.length}個`);
  analysis.components.forEach((c, i) => {
    console.log(
      `        [${i}] size=${c.size} bbox=(${c.minX},${c.minY})-(${c.maxX},${c.maxY}) ` +
        `${c.maxX - c.minX + 1}x${c.maxY - c.minY + 1} centroid=(${c.centroidX.toFixed(1)},${c.centroidY.toFixed(1)})`
    );
  });
  if (analysis.cutsApplied && analysis.cutsApplied.length) {
    console.log(`      自動くびれ検出による切断: ${analysis.cutsApplied.length}箇所`);
    analysis.cutsApplied.forEach((cut) => {
      console.log(
        `        列${cut.column} 境界${cut.boundaryIndex}: waistY=${cut.waistY} ` +
          `(探索範囲${cut.searchRange[0]}-${cut.searchRange[1]}内で前景ピクセル数最小=${cut.waistForegroundPixelCount})`
      );
    });
  }

  const match = matchComponentsToGridOrder(analysis.components, sheetConfig.rows, sheetConfig.cols);

  if (!match.ok) {
    report.problems.push(match.reason);
    report.detectedComponents = analysis.components.map((c) => ({
      size: c.size,
      bbox: [c.minX, c.minY, c.maxX, c.maxY],
      width: c.maxX - c.minX + 1,
      height: c.maxY - c.minY + 1,
      centroid: [Math.round(c.centroidX), Math.round(c.centroidY)],
    }));
    const outDir = path.join(ROOT, "output");
    ensureDir(outDir);
    fs.writeFileSync(path.join(outDir, "quality-report.json"), JSON.stringify(report, null, 2), "utf8");
    console.error("\n[問題] 正確な分割ができませんでした。無理な加工は行っていません。");
    console.error(match.reason);
    console.error(`詳細は ${path.join(outDir, "quality-report.json")} を確認してください。`);
    process.exitCode = 1;
    return;
  }

  if (match.warnings && match.warnings.length) {
    match.warnings.forEach((w) => report.warnings.push(w));
  }

  if (match.ordered.length !== sheetConfig.cells.length) {
    report.problems.push(
      `並び替え後の成分数(${match.ordered.length})がセル設定数(${sheetConfig.cells.length})と一致しません。`
    );
  }

  console.log(`[3/6] 読み順(左→右・上→下)への割り当て完了`);

  console.log(`[4/6] アルファマスク生成(エッジぼかし sigma=${opts.alphaBlurSigma})`);
  const smoothAlpha = await buildSmoothedAlpha(analysis.labels, width, height, opts.alphaBlurSigma);

  const outDirsByTier = {
    original: path.join(ROOT, "output", "original"),
    "128": path.join(ROOT, "output", "128"),
    "256": path.join(ROOT, "output", "256"),
    "512": path.join(ROOT, "output", "512"),
  };
  Object.values(outDirsByTier).forEach(ensureDir);
  const previewDir = path.join(ROOT, "output", "preview");
  ensureDir(previewDir);

  console.log(`[5/6] セルごとの切り出し・透明化・正方形化・リサイズ・WebP書き出し`);
  const seenFileNames = new Set();
  const montageCells = [];

  for (let i = 0; i < sheetConfig.cells.length; i++) {
    const cellCfg = sheetConfig.cells[i];
    const component = match.ordered[i];
    const fileName = `${cellCfg.key}.webp`;

    const cellReport = {
      key: cellCfg.key,
      number: cellCfg.number,
      name: cellCfg.name,
      detectedBbox: [component.minX, component.minY, component.maxX, component.maxY],
      detectedSize: component.size,
    };

    if (seenFileNames.has(fileName)) {
      report.problems.push(`ファイル名の重複: ${fileName}`);
    }
    seenFileNames.add(fileName);

    const extracted = extractComponentSquare(data, width, height, channels, analysis.labels, smoothAlpha, component, {
      circleSafetyMargin: opts.circleSafetyMargin,
      featherPad: opts.featherPad,
    });

    const safety = checkCircleSafety(extracted.buffer, extracted.side);
    cellReport.side = extracted.side;
    cellReport.bbox = { width: extracted.bboxW, height: extracted.bboxH };
    cellReport.circleSafety = safety;
    if (!safety.ok) {
      const w = `${cellCfg.key}: 円形表示(内接円)の外側に不透明ピクセルが${safety.outsidePixelCount}個あります` +
        `(最大はみ出し量${safety.maxExcessPx.toFixed(1)}px, 座標${JSON.stringify(safety.maxExcessPoint)})。` +
        `48px等の円形表示で装飾の先端が欠ける可能性があります。`;
      report.warnings.push(w);
      cellReport.circleSafetyWarning = true;
    } else {
      cellReport.circleSafetyWarning = false;
    }

    const tierResults = await exportTiers(extracted.buffer, extracted.side, outDirsByTier, fileName, opts.resolutions, opts.webp);
    cellReport.tiers = tierResults.map((t) => ({
      tier: t.tier,
      path: path.relative(ROOT, t.path),
      pixelSize: `${t.width}x${t.height}`,
      bytes: t.bytes,
      upscaled: t.upscaled,
    }));

    tierResults.forEach((t) => {
      if (t.upscaled) {
        report.warnings.push(
          `${cellCfg.key}: ${t.tier}px出力は元のbbox(${extracted.bboxW}x${extracted.bboxH})より大きいため` +
            `アップスケールが発生しています(画質劣化の可能性)。`
        );
      }
      const target = opts.targetFileSizeBytes && opts.targetFileSizeBytes[t.tier];
      if (target && t.bytes > target) {
        report.warnings.push(
          `${cellCfg.key}: ${t.tier}px出力(${t.bytes}bytes)が目標サイズ(${target}bytes)を超えています。`
        );
      }
    });

    // モンタージュ用の縮小PNG(配布物ではない、プレビュー専用)
    const previewPng = await sharp(extracted.buffer, { raw: { width: extracted.side, height: extracted.side, channels: 4 } })
      .resize(200, 200)
      .png()
      .toBuffer();
    montageCells.push({ key: cellCfg.key, pngBuffer: previewPng, side: extracted.side });

    report.cells.push(cellReport);
    console.log(
      `      ${cellCfg.key} (No.${cellCfg.number} ${cellCfg.name}): bbox=${extracted.bboxW}x${extracted.bboxH} ` +
        `canvas=${extracted.side}px circleOutside=${safety.outsidePixelCount}px`
    );
  }

  const avgCanvasSide = Math.round(
    report.cells.reduce((sum, c) => sum + c.side, 0) / report.cells.length
  );
  report.sourceResolutionNote =
    `このシート(${width}x${height}px, ${sheetConfig.rows}行${sheetConfig.cols}列)から検出した各トロフィーの` +
    `正方形キャンバスは平均${avgCanvasSide}px角。512px出力はこれより大きいため全セルで軽度のアップスケール` +
    `(約${Math.round((512 / avgCanvasSide - 1) * 100)}%拡大)が発生している。次回シート生成時は、` +
    `1セルあたりネイティブ解像度が512px角以上になるよう、より高解像度(例: 3x3なら2048x2048px以上)で` +
    `生成することを推奨する。`;

  console.log(`[6/6] プレビューモンタージュ作成・品質レポート書き出し`);
  const montageBuffer = await buildMontage(montageCells, { cols: opts.montageCols });
  fs.writeFileSync(path.join(previewDir, "montage.png"), montageBuffer);

  report.montagePath = path.relative(ROOT, path.join(previewDir, "montage.png"));
  report.ok = report.problems.length === 0;
  fs.writeFileSync(path.join(ROOT, "output", "quality-report.json"), JSON.stringify(report, null, 2), "utf8");

  console.log(`\n完了。 problems=${report.problems.length} warnings=${report.warnings.length}`);
  console.log(`品質レポート: ${path.join(ROOT, "output", "quality-report.json")}`);
  console.log(`プレビュー: ${path.join(previewDir, "montage.png")}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
