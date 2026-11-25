// ==========================================================
// 共通トロフィーテストラボ: 起動処理(本番配信物には含めない開発専用ファイル)
//
// dev/seven-wonders-lab-boot.jsと全く同じ仕組み(index.htmlの<body>を
// そのまま取得して#wfq-lab-app-rootへ注入し、本番と同じ<script>群を同じ
// 順序で読み込む)。本番のfile一覧が変わった場合は、7不思議ラボ側の
// PRODUCTION_SCRIPTSと合わせてこちらも更新すること。
//
// fetch("index.html")を使うため、file://で直接このファイルを開いても
// 動作しない。ローカルのHTTPサーバー経由で開くこと。
// ==========================================================
(function () {
  "use strict";

  const PRODUCTION_SCRIPTS = [
    "js/countries.js",
    "js/puzzle-questions.js",
    "js/seven-wonders-questions.js",
    "js/map-regions.js",
    "js/map-colors.js",
    "js/map-uk-regions.js",
    "js/capital-display.js",
    "js/encyclopedia-data.js",
    "js/storage.js",
    "js/trophy.js",
    "js/sound.js",
    "js/quiz.js",
    "js/certificate.js",
    "js/map.js",
    "js/encyclopedia.js",
    "js/review.js",
    "js/findcountry.js",
    "js/puzzle-judge.js",
    "js/puzzle.js",
    "js/app.js",
  ];

  function loadScriptsSequentially(srcs, index, onDone, onError) {
    if (index >= srcs.length) { onDone(); return; }
    const el = document.createElement("script");
    el.src = srcs[index];
    el.onload = () => loadScriptsSequentially(srcs, index + 1, onDone, onError);
    el.onerror = () => onError(srcs[index]);
    document.body.appendChild(el);
  }

  function showFatalError(message) {
    const panel = document.getElementById("wfq-lab-panel");
    if (panel) {
      panel.innerHTML = `<p class="wfq-lab-error">⚠️ ${message}</p>`;
    }
  }

  async function boot() {
    let html;
    try {
      const res = await fetch("index.html");
      if (!res.ok) throw new Error(`index.htmlの取得に失敗しました(HTTP ${res.status})`);
      html = await res.text();
    } catch (e) {
      showFatalError(
        "index.htmlを取得できませんでした。file://で直接このファイルを開いていませんか？" +
        "ローカルのHTTPサーバー(例: python3 -m http.server)経由で開いてください。" +
        `(詳細: ${e && e.message ? e.message : e})`
      );
      return;
    }

    const parsed = new DOMParser().parseFromString(html, "text/html");
    parsed.querySelectorAll("script").forEach((el) => el.remove());

    const root = document.getElementById("wfq-lab-app-root");
    root.innerHTML = parsed.body.innerHTML;

    loadScriptsSequentially(
      PRODUCTION_SCRIPTS,
      0,
      () => {
        if (typeof window.initApp === "function") {
          window.initApp();
        }
        if (typeof window.initCommonTrophyLab === "function") {
          window.initCommonTrophyLab();
        }
      },
      (failedSrc) => {
        showFatalError(`スクリプトの読み込みに失敗しました: ${failedSrc}`);
      }
    );
  }

  boot();
})();
