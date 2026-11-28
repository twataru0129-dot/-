"use strict";

const sharp = require("sharp");

/**
 * 画像ファイルを読み込み、RGB(A)の生ピクセルデータに変換する。
 * アルファチャンネルが無い場合は3チャンネルのまま返す(背景判定には
 * 不要なため、あえてensureAlphaしない)。
 * @param {string} filePath
 * @returns {Promise<{data: Buffer, width: number, height: number, channels: number}>}
 */
async function loadRawRgb(filePath) {
  const img = sharp(filePath);
  const metadata = await img.metadata();
  const { data, info } = await img
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    data,
    width: info.width,
    height: info.height,
    channels: info.channels,
    originalMetadata: metadata,
  };
}

module.exports = { loadRawRgb };
