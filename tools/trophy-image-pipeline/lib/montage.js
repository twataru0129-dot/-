"use strict";

const sharp = require("sharp");

/**
 * 加工結果を目視確認するためのプレビュー画像(コンタクトシート)を作る。
 * 各トロフィーについて:
 *  - 市松模様(チェッカーボード)の背景の上に正方形画像をそのまま表示
 *    (背景透明化が正しくできているか確認するため)
 *  - 実際のアプリと同じ円形クロップでの見た目のミニプレビュー
 *    (48px表示での視認性確認用。装飾が欠けていないか確認するため)
 *  - 画像制作専用キーのラベル
 * をタイル状に並べる。
 *
 * @param {Array<{key: string, pngBuffer: Buffer, side: number}>} cells
 * @param {{cols?: number}} [config]
 * @returns {Promise<Buffer>} PNG画像バッファ
 */
async function buildMontage(cells, config) {
  const cols = (config && config.cols) || Math.ceil(Math.sqrt(cells.length));
  const rows = Math.ceil(cells.length / cols);

  const cellSize = 220;
  const circleSize = 64;
  const padding = 18;
  const labelHeight = 24;
  const tileW = cellSize + padding * 2;
  const tileH = cellSize + padding * 2 + circleSize + labelHeight + 16;

  const totalW = tileW * cols;
  const totalH = tileH * rows + 40;

  const imageTags = [];
  const defsClipPaths = [];

  cells.forEach((cell, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const tileX = col * tileW;
    const tileY = row * tileH + 40;

    const b64 = cell.pngBuffer.toString("base64");
    const imgX = tileX + padding;
    const imgY = tileY + padding;
    const circleX = tileX + (tileW - circleSize) / 2;
    const circleY = imgY + cellSize + 14;
    const clipId = `clip${i}`;

    defsClipPaths.push(
      `<clipPath id="${clipId}"><circle cx="${circleX + circleSize / 2}" cy="${circleY + circleSize / 2}" r="${circleSize / 2}" /></clipPath>`
    );

    imageTags.push(`
      <rect x="${imgX}" y="${imgY}" width="${cellSize}" height="${cellSize}" fill="url(#checker)" stroke="#999" stroke-width="1"/>
      <image href="data:image/png;base64,${b64}" x="${imgX}" y="${imgY}" width="${cellSize}" height="${cellSize}" preserveAspectRatio="xMidYMid meet"/>
      <circle cx="${circleX + circleSize / 2}" cy="${circleY + circleSize / 2}" r="${circleSize / 2}" fill="url(#checker)" stroke="#666" stroke-width="1"/>
      <image href="data:image/png;base64,${b64}" x="${circleX}" y="${circleY}" width="${circleSize}" height="${circleSize}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>
      <circle cx="${circleX + circleSize / 2}" cy="${circleY + circleSize / 2}" r="${circleSize / 2}" fill="none" stroke="#333" stroke-width="1.5"/>
      <text x="${tileX + tileW / 2}" y="${circleY + circleSize + labelHeight}" font-size="15" font-family="sans-serif" text-anchor="middle" fill="#222">${escapeXml(cell.key)}</text>
    `);
  });

  const svg = `
    <svg width="${totalW}" height="${totalH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="checker" width="16" height="16" patternUnits="userSpaceOnUse">
          <rect width="16" height="16" fill="#f0f0f0"/>
          <rect width="8" height="8" fill="#d0d0d0"/>
          <rect x="8" y="8" width="8" height="8" fill="#d0d0d0"/>
        </pattern>
        ${defsClipPaths.join("\n")}
      </defs>
      <rect width="100%" height="100%" fill="#ffffff"/>
      <text x="16" y="26" font-size="18" font-family="sans-serif" fill="#111">trophy-image-pipeline preview montage (${cells.length} cells)</text>
      ${imageTags.join("\n")}
    </svg>
  `;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
}

module.exports = { buildMontage };
