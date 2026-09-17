// ==========================================================
// メダル画像・認定証画像の生成(Canvas APIで直接描画)
// 端末間の安定性を優先し、html2canvas等の外部ライブラリに
// 依存しない構成にしている
// ==========================================================

const MEDAL_COLORS = {
  "medal-bronze": ["#e6b27e", "#a9642e"],
  "medal-green": ["#9be89b", "#2f9e44"],
  "medal-blue": ["#9ccbff", "#1f6fd6"],
  "medal-purple": ["#d9b8ff", "#7c3aed"],
  "medal-gold": ["#ffe89a", "#d4a017"],
  "medal-legend": ["#fff6c8", "#d4a017"],
};

function isIOSDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function formatJapaneseDate(date) {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  } catch (e) {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawMedalCircle(ctx, cx, cy, radius, medalClass) {
  const colors = MEDAL_COLORS[medalClass] || MEDAL_COLORS["medal-gold"];
  const grad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(1, colors[1]);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = radius * 0.09;
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.stroke();
  ctx.font = `${Math.floor(radius * 0.9)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🏅", cx, cy + radius * 0.05);
  if (medalClass === "medal-legend") {
    ctx.font = `${Math.floor(radius * 0.6)}px system-ui, sans-serif`;
    ctx.fillText("👑", cx, cy - radius * 1.15);
  }
  ctx.restore();
}

function fitText(ctx, text, maxWidth, baseSize, fontWeight = "800") {
  let size = baseSize;
  ctx.font = `${fontWeight} ${size}px "Noto Sans JP", "Hiragino Sans", "Yu Gothic", system-ui, sans-serif`;
  while (ctx.measureText(text).width > maxWidth && size > 12) {
    size -= 2;
    ctx.font = `${fontWeight} ${size}px "Noto Sans JP", "Hiragino Sans", "Yu Gothic", system-ui, sans-serif`;
  }
  return size;
}

// ---------- メダル画像 ----------
function renderMedalCanvas({ titleName, medalClass, name, questionCount, dateStr }) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const W = 720, H = 960;
  const canvas = document.createElement("canvas");
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  // 背景グラデーション
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#1f3a8f");
  bg.addColorStop(0.6, "#2f6fed");
  bg.addColorStop(1, "#7fb8ff");
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, W, H, 36);
  ctx.fill();

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";

  ctx.font = "700 22px system-ui, sans-serif";
  ctx.globalAlpha = 0.85;
  ctx.save();
  ctx.letterSpacing = "6px";
  ctx.fillText("WORLD FLAG QUIZ", W / 2, 130);
  ctx.restore();
  ctx.globalAlpha = 1;

  drawMedalCircle(ctx, W / 2, 320, 130, medalClass);

  const titleSize = fitText(ctx, titleName, W - 120, 46);
  ctx.font = `800 ${titleSize}px "Noto Sans JP", "Hiragino Sans", "Yu Gothic", system-ui, sans-serif`;
  ctx.fillStyle = "#ffe27a";
  ctx.fillText(titleName, W / 2, 540);

  const nameText = name ? `${name} さん` : "挑戦者 さん";
  const nameSize = fitText(ctx, nameText, W - 120, 34);
  ctx.font = `700 ${nameSize}px "Noto Sans JP", "Hiragino Sans", "Yu Gothic", system-ui, sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(nameText, W / 2, 610);

  ctx.font = "600 26px system-ui, sans-serif";
  ctx.fillText(`${questionCount}問`, W / 2, 680);
  ctx.font = "800 28px system-ui, sans-serif";
  ctx.fillStyle = "#ffe27a";
  ctx.fillText("PERFECT!", W / 2, 720);

  ctx.font = "500 20px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(dateStr, W / 2, 900);

  return canvas;
}

// ---------- 認定証画像 ----------
function renderCertificateCanvas({ certTitle, bodyLines, dateStr }) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const W = 900, H = 1273; // A4比率に近い縦長
  const canvas = document.createElement("canvas");
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  ctx.fillStyle = "#fffaf0";
  ctx.fillRect(0, 0, W, H);

  // 二重の金色枠
  ctx.strokeStyle = "#d4a017";
  ctx.lineWidth = 6;
  ctx.strokeRect(30, 30, W - 60, H - 60);
  ctx.lineWidth = 2;
  ctx.strokeRect(46, 46, W - 92, H - 92);

  ctx.textAlign = "center";
  ctx.fillStyle = "#3a2c00";

  ctx.font = "800 52px \"Noto Sans JP\", \"Hiragino Sans\", \"Yu Gothic\", system-ui, sans-serif";
  ctx.fillText(certTitle, W / 2, 160);

  ctx.font = "500 30px \"Noto Sans JP\", \"Hiragino Sans\", \"Yu Gothic\", system-ui, sans-serif";
  let y = 300;
  const lineHeight = 58;
  bodyLines.forEach((line) => {
    ctx.fillText(line, W / 2, y);
    y += lineHeight;
  });

  ctx.font = "500 26px system-ui, sans-serif";
  ctx.fillText(dateStr, W / 2, H - 140);
  ctx.font = "600 22px system-ui, sans-serif";
  ctx.fillStyle = "#8a6100";
  ctx.fillText("世界の国旗クイズ", W / 2, H - 95);

  return canvas;
}

function buildCertificateBodyLines(titleObj, questionCount, name) {
  const nameText = name ? `${name} 様` : "挑戦者 様";
  if (questionCount === 198) {
    return [
      nameText,
      "",
      "あなたは『世界の国旗クイズ』において、",
      "198の国・地域すべての国旗を見事正解し、",
      "完全制覇を達成しました。",
      "その卓越した知識と努力をたたえ、",
      "ここに最高位称号",
      "『国旗レジェンド』",
      "を認定します。",
    ];
  }
  return [
    nameText,
    "",
    "あなたは『世界の国旗クイズ』において、",
    `${questionCount}問コースを見事全問正解しました。`,
    "その努力とすぐれた知識をたたえ、",
    `ここに『${titleObj.name}』の称号を認定します。`,
  ];
}

// キャンバスをPNGとして保存する。iOSでは新しいタブで開き長押し保存を案内する
function saveCanvasAsPNG(canvas, filename) {
  try {
    const dataUrl = canvas.toDataURL("image/png");
    if (isIOSDevice()) {
      const w = window.open();
      if (w) {
        w.document.write(
          `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${filename}</title></head>` +
          `<body style="margin:0;background:#222;display:flex;align-items:center;justify-content:center;min-height:100vh;">` +
          `<img src="${dataUrl}" style="max-width:100%;height:auto;" alt="${filename}"></body></html>`
        );
        w.document.close();
      } else {
        window.location.href = dataUrl;
      }
      return "ios";
    }
    // data:URLだとブラウザによってファイル名(download属性)が無視されるため
    // Blob + ObjectURLを使ってファイル名を確実に反映させる
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }, "image/png");
    return "download";
  } catch (e) {
    console.error("画像の保存に失敗しました", e);
    return "error";
  }
}
