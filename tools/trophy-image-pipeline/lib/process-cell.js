"use strict";

const sharp = require("sharp");

/**
 * ラベルマップ全体(前景=label!=0, 背景=0)から、1pxだけ単純な
 * ぼかしをかけたアルファ値(0-255)を作る。これはエッジのジャギーを
 * 滑らかにするためだけに使う。成分同士の間には十分な暗い隙間がある
 * ことを確認済みなので、ここでぼかしても隣接成分と混ざる心配はない
 * (抽出時にlabelの完全一致チェックを別途行うため、万一混ざっても
 * 他成分のピクセルは必ずalpha=0に強制される)。
 */
async function buildSmoothedAlpha(labels, width, height, blurSigma) {
  const n = width * height;
  const binary = Buffer.alloc(n);
  for (let i = 0; i < n; i++) binary[i] = labels[i] !== 0 ? 255 : 0;
  if (!blurSigma || blurSigma <= 0) return binary;
  const blurred = await sharp(binary, { raw: { width, height, channels: 1 } })
    .blur(blurSigma)
    .raw()
    .toBuffer();
  return blurred;
}

/**
 * 1つの連結成分(=1トロフィー装飾)を、
 *  1. 自分自身のラベル以外は透明にする(他成分の混入を完全排除)
 *  2. タイトな外接矩形(bbox)を基準に、円形クロップ時に装飾の先端が
 *     欠けないよう余白(circleSafetyMargin)を付けた正方形キャンバスに
 *     中央配置する
 * という手順でRGBA生ピクセルのBufferを作る。
 *
 * @returns {{ buffer: Buffer, side: number, bboxW: number, bboxH: number, featherPad: number }}
 */
function extractComponentSquare(sheetData, sheetWidth, sheetHeight, channels, labels, smoothAlpha, component, options) {
  const opts = options || {};
  const circleSafetyMargin = typeof opts.circleSafetyMargin === "number" ? opts.circleSafetyMargin : 0.1;
  const featherPad = typeof opts.featherPad === "number" ? opts.featherPad : 4;

  const bboxW = component.maxX - component.minX + 1;
  const bboxH = component.maxY - component.minY + 1;

  const exMinX = Math.max(0, component.minX - featherPad);
  const exMinY = Math.max(0, component.minY - featherPad);
  const exMaxX = Math.min(sheetWidth - 1, component.maxX + featherPad);
  const exMaxY = Math.min(sheetHeight - 1, component.maxY + featherPad);
  const exW = exMaxX - exMinX + 1;
  const exH = exMaxY - exMinY + 1;

  let side = Math.ceil(Math.max(bboxW, bboxH) * (1 + circleSafetyMargin));
  side = Math.max(side, exW, exH);

  const canvas = Buffer.alloc(side * side * 4, 0);
  const offsetX = Math.floor((side - exW) / 2);
  const offsetY = Math.floor((side - exH) / 2);

  for (let y = 0; y < exH; y++) {
    const srcY = exMinY + y;
    for (let x = 0; x < exW; x++) {
      const srcX = exMinX + x;
      const srcIdx = srcY * sheetWidth + srcX;
      const srcOff = srcIdx * channels;
      const dstIdx = (offsetY + y) * side + (offsetX + x);
      const dstOff = dstIdx * 4;
      canvas[dstOff] = sheetData[srcOff];
      canvas[dstOff + 1] = sheetData[srcOff + 1];
      canvas[dstOff + 2] = sheetData[srcOff + 2];
      canvas[dstOff + 3] = labels[srcIdx] === component.id ? smoothAlpha[srcIdx] : 0;
    }
  }

  return { buffer: canvas, side, bboxW, bboxH, exW, exH, featherPad, circleSafetyMargin };
}

/**
 * 円形表示(border-radius:50%)で実際に見える範囲(内接円)の外側に、
 * 不透明なピクセルが実在しないかを実データで直接確認する。
 * bboxの対角線などから推定するのではなく、実際に書き出した正方形
 * キャンバスのアルファ値を1px単位で走査するため、推定の誤差がない。
 * @param {Buffer} canvasBuffer - RGBA生ピクセル(side x side)
 * @param {number} side
 * @param {{alphaThreshold?: number}} [options]
 * @returns {{ ok: boolean, outsidePixelCount: number, maxExcessPx: number, maxExcessPoint: [number,number]|null }}
 */
function checkCircleSafety(canvasBuffer, side, options) {
  const alphaThreshold = (options && options.alphaThreshold) || 20;
  const cx = side / 2;
  const cy = side / 2;
  const r = side / 2;
  let outsidePixelCount = 0;
  let maxExcessPx = 0;
  let maxExcessPoint = null;
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const o = (y * side + x) * 4;
      const a = canvasBuffer[o + 3];
      if (a <= alphaThreshold) continue;
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > r) {
        outsidePixelCount++;
        const excess = dist - r;
        if (excess > maxExcessPx) {
          maxExcessPx = excess;
          maxExcessPoint = [x, y];
        }
      }
    }
  }
  return { ok: outsidePixelCount === 0, outsidePixelCount, maxExcessPx, maxExcessPoint };
}

/**
 * 正方形RGBAキャンバスから、original/128/256/512の各WebPを書き出す。
 * @returns {Promise<Array<{tier:string, path:string, width:number, height:number, bytes:number, upscaled:boolean}>>}
 */
async function exportTiers(canvasBuffer, side, outDirsByTier, fileName, resolutions, webpOptions) {
  const results = [];
  const base = sharp(canvasBuffer, { raw: { width: side, height: side, channels: 4 } });
  const wo = webpOptions || {};
  const quality = typeof wo.quality === "number" ? wo.quality : 90;
  const alphaQuality = typeof wo.alphaQuality === "number" ? wo.alphaQuality : 100;
  const effort = typeof wo.effort === "number" ? wo.effort : 6;

  // original: 最大解像度をそのまま保持。可逆(lossless)WebPで劣化なし。
  {
    const outPath = require("path").join(outDirsByTier.original, fileName);
    await base.clone().webp({ lossless: true }).toFile(outPath);
    const st = require("fs").statSync(outPath);
    results.push({ tier: "original", path: outPath, width: side, height: side, bytes: st.size, upscaled: false });
  }

  for (const res of resolutions) {
    const upscaled = side < res;
    const outPath = require("path").join(outDirsByTier[String(res)], fileName);
    await base
      .clone()
      .resize(res, res, { kernel: "lanczos3" })
      .webp({ quality, alphaQuality, effort })
      .toFile(outPath);
    const st = require("fs").statSync(outPath);
    results.push({ tier: String(res), path: outPath, width: res, height: res, bytes: st.size, upscaled });
  }

  return results;
}

module.exports = { buildSmoothedAlpha, extractComponentSquare, checkCircleSafety, exportTiers };
