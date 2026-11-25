// ==========================================================
// 世界7不思議テストラボ: 起動処理(本番配信物には含めない開発専用ファイル)
//
// 本番(index.html)の<body>をそのまま取得して#wfq-lab-app-rootへ注入し、
// 続けて本番と同じ<script>群を同じ順序で読み込むことで、「共通の画面
// コンポーネント」を複製せずに完全に再利用する。index.html自体への
// 変更はここでは一切行わない。
//
// fetch("index.html")を使うため、file://で直接このファイルを開いても
// 動作しない(多くのブラウザがfile://経由のfetchをブロックするため)。
// 必ずローカルのHTTPサーバー経由で開くこと(完了報告のiPhone/iPad実機
// テスト手順を参照)。
// ==========================================================
(function () {
  "use strict";

  // index.htmlの<script src="./js/xxx.js">と同じ並び・同じ本数を保つこと。
  // このテストラボは本番ビルドに含めないため、index.html側に自動追従する
  // 仕組みは持たない(js/app.jsにスクリプトを追加・削除した場合は、
  // このリストも必ず同じように更新すること)
  // このファイルはdev/seven-wonders-lab.htmlの<base href="../">の効果下で
  // 読み込まれるため、相対パスはすべてリポジトリのルート(index.htmlと
  // 同じ階層)基準で解決される
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
    // scriptタグはこちらで正しいパス("../js/...")に付け替えて自前で
    // 読み込むため、注入前に取り除いておく(そのままinnerHTMLに渡しても
    // 実行はされないが、パスの異なる無効なタグを残さないようにする)
    parsed.querySelectorAll("script").forEach((el) => el.remove());

    const root = document.getElementById("wfq-lab-app-root");
    root.innerHTML = parsed.body.innerHTML;

    loadScriptsSequentially(
      PRODUCTION_SCRIPTS,
      0,
      () => {
        // app.jsはdocument.addEventListener("DOMContentLoaded", initApp)で
        // 初期化される設計だが、このページ自体のDOMContentLoadedはとっくに
        // 発火済みのため、ここで明示的に呼び出す
        if (typeof window.initApp === "function") {
          window.initApp();
        }
        // 世界7不思議テストラボの操作パネルを初期化する
        // (dev/seven-wonders-lab.js、このファイルの直後に読み込む)
        if (typeof window.initSevenWondersLab === "function") {
          window.initSevenWondersLab();
        }
      },
      (failedSrc) => {
        showFatalError(`スクリプトの読み込みに失敗しました: ${failedSrc}`);
      }
    );
  }

  boot();
})();
