// ==========================================================
// 国・地域の「首都」表示を解決する共通ロジック
// 世界地図モード(js/map.js)と世界図鑑モード(js/encyclopedia.js)の
// 両方から呼び出す。首都の表示ラベル・値・補足情報の算出方法を
// 1箇所にまとめることで、データ更新時にどちらか一方だけ古い表示に
// なってしまう問題を防ぐ。
//
// 通常の国は「首都：〇〇」、香港・マカオなど地図専用地域は
// infoLabel/infoValue(例:「区分：中国の特別行政区」)、南アフリカ・
// ボリビア・スイス・ナウルなど特殊な首都事情を持つ国はcapitalInfoLabel
// またはcapitals配列のtypeから見出しラベルを切り替える。
// ==========================================================
function resolveCapitalDisplay(entry) {
  const capitals = entry.capitals || [];
  // capitals配列のうち、首都クイズの正解(entry.capital)と一致する項目を
  // 見出しの主表示に使い、残りは補足情報として扱う
  const primaryEntry = capitals.find((c) => c.name === entry.capital) || null;
  const supplementEntries = primaryEntry ? capitals.filter((c) => c !== primaryEntry) : [];
  const label = entry.capitalInfoLabel || (primaryEntry ? primaryEntry.type : null) || entry.infoLabel || "首都";
  const value = entry.infoValue || entry.capital || "";
  return { label, value, supplementEntries };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { resolveCapitalDisplay };
}
