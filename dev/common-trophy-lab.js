// ==========================================================
// 共通トロフィー31種類(#395〜425)テストラボ: 操作パネル
// (本番配信物には含めない開発専用ファイル)
//
// ここで呼んでいるTrophyModule.*/Storage.*/showScreen()等は、すべて
// dev/common-trophy-lab-boot.jsが読み込む本番と同じjs/*.jsの関数を
// そのまま使う。js/trophy.jsへこのラボ専用の新しいトロフィー獲得APIは
// 一切追加していない。
//
// 例外は1点だけ: 累積プレイ日数・連続日数(ストリーク)は、実機で複数日に
// 分けて検証するのが現実的でないため、このファイル(dev/common-trophy-lab.js、
// 本番配信物には含めない)に限り、このラボ専用の隔離済み保存領域
// (STORAGE_PREFIX="wfq_v1_lab_"、本番の"wfq_v1_"とは別名前空間)に対して、
// js/trophy.js内部のCOMMON_PROGRESS_KEYと同一のスキーマ(version 1)で
// 直接値を書き込む。書き込んだ後は必ずTrophyModule.evaluateCommonTrophiesCatchUp()
// (本物の判定ロジック)を呼んで初めてトロフィーが付与される、という経路は
// 変えていない。STORAGE_PREFIXはjs/storage.js側のトップレベルconstで、
// 同じページ内で後から読み込まれる<script>からも(ES Modulesではないため)
// そのまま参照できる。
//
// window.initCommonTrophyLab()は、dev/common-trophy-lab-boot.jsが本番の
// 全スクリプト読み込み+initApp()実行を終えた直後に1回だけ呼ぶ
// ==========================================================
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  function commonProgressKey() {
    // js/trophy.js内部のCOMMON_PROGRESS_KEYと同一の式(このラボ専用の
    // STORAGE_PREFIX="wfq_v1_lab_"が効くため、本番データには触れない)
    return STORAGE_PREFIX + "common_progress";
  }

  function readRawCommonProgress() {
    try {
      const raw = localStorage.getItem(commonProgressKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return (parsed && typeof parsed === "object") ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function writeRawCommonProgress(data) {
    try {
      localStorage.setItem(commonProgressKey(), JSON.stringify(data));
    } catch (e) {
      window.alert("保存に失敗しました: " + (e && e.message ? e.message : e));
    }
  }

  // 本番のjs/trophy.js側のemptyCommonProgress()と同じ形(版数1)。構造が
  // 食い違うと本物の判定ロジック(loadCommonProgress)が安全側に倒して
  // 初期値へ戻してしまうため、このラボでも必ず同じ形で書き込む
  function emptyProgressForLab() {
    return {
      version: 1,
      playCompletedCount: { flag: 0, capital: 0, findcountry: 0 },
      correctCount: { flag: 0, capital: 0, findcountry: 0 },
      wrongCount: { flag: 0, capital: 0, findcountry: 0 },
      perfect30Achieved: { flag: false, capital: false, findcountry: false },
      clear198Achieved: { flag: false, capital: false },
      clearAdvanced30Achieved: false,
      playedDates: {},
      lastPlayedDate: null,
      currentStreakDays: 0,
      maxStreakDays: 0,
      dailyClear: { date: null, flag: false, capital: false, findcountry: false },
      usedFlag: false, usedCapital: false, usedFindCountry: false, usedMap: false, usedEncyclopedia: false,
    };
  }

  function patchCommonProgress(patchFn) {
    const current = readRawCommonProgress() || emptyProgressForLab();
    patchFn(current);
    writeRawCommonProgress(current);
    const awarded = TrophyModule.evaluateCommonTrophiesCatchUp();
    renderPanel();
    if (awarded.length > 0) {
      window.alert(`連鎖判定により新規に${awarded.length}件のトロフィーを獲得しました:\n` +
        awarded.map((id) => TrophyModule.getDefinition(id).name).join("\n"));
    }
  }

  // 称号参照型12件(#101〜112、国旗6種+首都6種)は本番でもTrophyModule.
  // awardIfNew()では付与されないため(重複防止の既存仕様)、本番のjs/app.jsと
  // 同じStorage.awardTitleIfNew()経路で獲得させる
  const TITLE_IDS = {
    flag: ["beginner", "challenger", "traveler", "expert", "master", "legend"],
    capital: ["cap_beginner", "cap_challenger", "cap_traveler", "cap_expert", "cap_master", "cap_legend"],
  };

  // 共通トロフィー以外の獲得単位を、正規のTrophyModule.awardIfNew()/
  // Storage.awardTitleIfNew()経由でtarget個になるまで積む(すでにtarget以上
  // 獲得済みなら何もしない)。「累計獲得数8種類」「90%/95%/世界の真理」の
  // 境界をテストラボ上で素早く再現するための一括操作
  function awardOtherUnitsUpTo(target) {
    let count = TrophyModule.getAllDefinitions()
      .filter((d) => d.category !== "common")
      .reduce((n, d) => {
        if (TrophyModule.isDualSplitCardNumber(d.number)) {
          return n + (TrophyModule.isEarned(d.id, "flag") ? 1 : 0) + (TrophyModule.isEarned(d.id, "capital") ? 1 : 0);
        }
        return n + (TrophyModule.isEarned(d.id) ? 1 : 0);
      }, 0);
    if (count >= target) return count;

    const dualNumbers = TrophyModule.getAllDefinitions().filter((d) => TrophyModule.isDualSplitCardNumber(d.number)).map((d) => d.number);
    for (const n of dualNumbers) {
      if (count >= target) break;
      if (TrophyModule.awardIfNew(`trophy_${n}`, "flag")) count++;
      if (count >= target) break;
      if (TrophyModule.awardIfNew(`trophy_${n}`, "capital")) count++;
    }
    ["flag", "capital"].forEach((mode) => {
      TITLE_IDS[mode].forEach((id) => {
        if (count >= target) return;
        const wasEarned = TrophyModule.isEarned(id);
        Storage.awardTitleIfNew(id, mode);
        if (!wasEarned && TrophyModule.isEarned(id)) count++;
      });
    });
    const otherSingles = TrophyModule.getAllDefinitions()
      .filter((d) => d.category !== "common" && !TrophyModule.isDualSplitCardNumber(d.number) && !(d.number >= 101 && d.number <= 112))
      .map((d) => d.number);
    for (const n of otherSingles) {
      if (count >= target) break;
      if (TrophyModule.awardIfNew(`trophy_${n}`)) count++;
    }
    return count;
  }

  function setOtherUnitsAndReevaluate(target) {
    const achieved = awardOtherUnitsUpTo(target);
    const awarded = TrophyModule.evaluateCommonTrophiesCatchUp();
    renderPanel();
    let msg = `共通トロフィー以外の獲得単位数: ${achieved}件`;
    if (achieved < target) msg += `\n(獲得可能な単位が尽きたため、指定の${target}件には届きませんでした)`;
    if (awarded.length > 0) msg += `\n連鎖判定により新規に${awarded.length}件の共通トロフィーを獲得しました。`;
    window.alert(msg);
  }

  // 日付キーをYYYY-MM-DD(ローカル日付)で作る。日数系の境界(百日の冒険等)を
  // 再現するため、playedDatesに「今日から数えてcount日分」のユニークな
  // 過去日付をまとめて入れる(厳密に連続している必要はない。カウントだけを見る)
  function fillPastPlayedDates(data, count) {
    data.playedDates = data.playedDates || {};
    const base = new Date();
    for (let i = 0; i < count; i++) {
      const d = new Date(base.getTime() - i * 86400000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      data.playedDates[key] = true;
    }
  }

  function openTrophyListOnCommon() {
    if (typeof renderTrophyListScreen === "function") renderTrophyListScreen();
    showScreen("screen-trophy-list");
    const tab = document.querySelector('.trophy-tab[data-category="common"]');
    if (tab) tab.click();
  }

  function previewTruthAward() {
    // #142「都の神話」の演出プレビューと同様、実際の獲得(awardIfNew)は
    // 一切行わない「見た目だけ」のプレビュー。データには一切影響しない
    if (typeof renderLegendAwardScreen !== "function") return;
    renderLegendAwardScreen(425);
    showScreen("screen-trophy-legend");
  }

  function numInput(id, value) {
    return `<input type="number" id="${id}" value="${value}" min="0" style="width:72px;">`;
  }

  function renderPanel() {
    const panel = $("wfq-lab-panel");
    if (!panel) return;

    const summary = TrophyModule.getProgressSummary();
    const progress = readRawCommonProgress() || emptyProgressForLab();
    const cumulativeNumbers = [395, 396, 397, 398, 399, 400, 401, 402];
    const cumulativeRows = cumulativeNumbers.map((n) => {
      const def = TrophyModule.getDefinition(`trophy_${n}`);
      const p = TrophyModule.getCommonTrophyProgress(n);
      const earned = TrophyModule.isEarned(`trophy_${n}`);
      return `<p>#${n} ${def.name}: ${earned ? "🏆獲得済み" : `${p.current}/${p.total}`}</p>`;
    }).join("");

    const crossModeNumbers = [403, 404, 405, 406, 417];
    const crossModeRows = crossModeNumbers.map((n) => {
      const def = TrophyModule.getDefinition(`trophy_${n}`);
      const earned = TrophyModule.isEarned(`trophy_${n}`);
      return `<p>#${n} ${def.name}: ${earned ? "🏆獲得済み" : "未獲得"}</p>`;
    }).join("");

    const completionNumbers = [419, 420, 421, 422, 423, 424, 425];
    const completionRows = completionNumbers.map((n) => {
      const def = TrophyModule.getDefinition(`trophy_${n}`);
      const p = TrophyModule.getCommonTrophyProgress(n);
      const earned = TrophyModule.isEarned(`trophy_${n}`);
      const text = earned ? "🏆獲得済み" : (typeof p.percent === "number" ? `現在${p.percent.toFixed(1)}%(${p.current}/${p.total})` : `${p.current}/${p.total}`);
      return `<p>#${n} ${def.name}: ${text}</p>`;
    }).join("");

    panel.innerHTML = `
      <section class="wfq-lab-section">
        <h2>現在の状態</h2>
        <p>トロフィー総数(一覧画面と同じ集計単位): ${summary.earnedCount} / ${summary.totalCount}(${((summary.earnedCount / summary.totalCount) * 100).toFixed(1)}%)</p>
        <p>プレイ完了回数: 国旗${progress.playCompletedCount.flag} / 首都${progress.playCompletedCount.capital} / どこかな${progress.playCompletedCount.findcountry}(合計${progress.playCompletedCount.flag + progress.playCompletedCount.capital + progress.playCompletedCount.findcountry})</p>
        <p>累計正解: 国旗${progress.correctCount.flag} / 首都${progress.correctCount.capital} / どこかな${progress.correctCount.findcountry}(合計${progress.correctCount.flag + progress.correctCount.capital + progress.correctCount.findcountry})</p>
        <p>累計誤答(合計): ${progress.wrongCount.flag + progress.wrongCount.capital + progress.wrongCount.findcountry}</p>
        <p>連続プレイ日数: 現在${progress.currentStreakDays}日 / 最長${progress.maxStreakDays}日 ／ 累計プレイ日数: ${Object.keys(progress.playedDates || {}).length}日</p>
        <p>利用済み: 国旗${progress.usedFlag ? "✅" : "―"} 首都${progress.usedCapital ? "✅" : "―"} どこかな${progress.usedFindCountry ? "✅" : "―"} 地図${progress.usedMap ? "✅" : "―"} 図鑑${progress.usedEncyclopedia ? "✅" : "―"}</p>
      </section>

      <section class="wfq-lab-section">
        <h2>累計獲得数8種類(#395〜402)</h2>
        ${cumulativeRows}
        <p>共通トロフィー以外の獲得単位数を指定して一括設定(正規のawardIfNew経由):</p>
        <button type="button" data-action="units" data-target="9">9件(全部未獲得)</button>
        <button type="button" data-action="units" data-target="10">10件</button>
        <button type="button" data-action="units" data-target="49">49件</button>
        <button type="button" data-action="units" data-target="50">50件</button>
        <button type="button" data-action="units" data-target="99">99件</button>
        <button type="button" data-action="units" data-target="100">100件</button>
        <button type="button" data-action="units" data-target="419">419件</button>
        <button type="button" data-action="units" data-target="420">420件</button>
        <br>
        ${numInput("lab-units-input", 0)}
        <button type="button" data-action="units-custom">指定件数にする</button>
      </section>

      <section class="wfq-lab-section">
        <h2>モード横断型4種+三位一体(#403〜406, #417)</h2>
        ${crossModeRows}
        <button type="button" data-action="cross-four-doors">四つの扉: 5項目すべて利用済みにする</button>
        <button type="button" data-action="cross-triple-three">トリプルスリー: 3クイズとも30問パーフェクトにする</button>
        <button type="button" data-action="cross-triple-crown">三冠王: 198問×2+上級30問クリアにする</button>
        <button type="button" data-action="cross-trinity">三位一体: 今日3クイズともクリア済みにする</button>
        <button type="button" data-action="cross-four-kings">四天王: 国旗・首都・どこかな？・図鑑を各20件獲得済みにする</button>
      </section>

      <section class="wfq-lab-section">
        <h2>累積プレイ・努力系12種類(#407〜418)</h2>
        <p>プレイ完了回数(合計で#407/408/409の100/500/1000回判定)</p>
        国旗 ${numInput("lab-play-flag", progress.playCompletedCount.flag)}
        首都 ${numInput("lab-play-capital", progress.playCompletedCount.capital)}
        どこかな ${numInput("lab-play-find", progress.playCompletedCount.findcountry)}
        <button type="button" data-action="set-play-count">保存して再評価</button>
        <p>累計正解数(合計で#410/411/412の1万/5万/10万問判定)</p>
        国旗 ${numInput("lab-correct-flag", progress.correctCount.flag)}
        首都 ${numInput("lab-correct-capital", progress.correctCount.capital)}
        どこかな ${numInput("lab-correct-find", progress.correctCount.findcountry)}
        <button type="button" data-action="set-correct-count">保存して再評価</button>
        <p>累計誤答数(合計で#418の1,000回判定。どこかなに集約して設定)</p>
        ${numInput("lab-wrong-find", progress.wrongCount.findcountry)}
        <button type="button" data-action="set-wrong-count">保存して再評価</button>
        <p>連続プレイ日数(#413/414の7日/30日判定)・累計プレイ日数(#415の100日判定)</p>
        連続日数 ${numInput("lab-streak", progress.currentStreakDays)}
        累計日数 ${numInput("lab-played-days", Object.keys(progress.playedDates || {}).length)}
        <button type="button" data-action="set-streak-days">保存して再評価</button>
        <p>#416「世界一周の旅」(198か国・地域すべて国旗・首都両方正解)</p>
        <button type="button" data-action="set-world-tour">198か国すべて国旗・首都正解済みにする(recordQuizStats経由)</button>
      </section>

      <section class="wfq-lab-section">
        <h2>各モード完全制覇4種+最終到達3種(#419〜425)</h2>
        ${completionRows}
        <button type="button" data-action="units" data-target="406">共通以外を406件(90%の1件手前)にする</button>
        <button type="button" data-action="units" data-target="407">共通以外を407件(90%ちょうど)にする</button>
        <button type="button" data-action="units" data-target="429">共通以外を429件(95%の1件手前)にする</button>
        <button type="button" data-action="units" data-target="430">共通以外を430件(95%ちょうど)にする</button>
        <button type="button" data-action="units" data-target="420">全421件(共通以外の最大)を獲得済みにする(世界の真理の1件手前)</button>
        <button type="button" data-action="units" data-target="421">共通以外421件すべて獲得済みにする</button>
      </section>

      <section class="wfq-lab-section">
        <h2>世界の真理(#425)専用演出</h2>
        <button type="button" data-action="preview-truth">専用演出をプレビュー(実際には獲得しません)</button>
      </section>

      <section class="wfq-lab-section">
        <h2>一括操作</h2>
        <button type="button" data-action="reevaluate">連鎖判定(evaluateCommonTrophiesCatchUp)を今すぐ実行</button>
        <button type="button" data-action="open-trophy-list">トロフィー一覧(共通トロフィータブ)を開く</button>
        <button type="button" data-action="reset-all" class="wfq-lab-danger">テストラボの保存データをすべて初期化</button>
      </section>
    `;
  }

  function onPanelClick(e) {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    switch (action) {
      case "units":
        setOtherUnitsAndReevaluate(Number(btn.dataset.target));
        return;
      case "units-custom": {
        const v = Number($("lab-units-input").value);
        if (Number.isFinite(v) && v >= 0) setOtherUnitsAndReevaluate(v);
        return;
      }
      case "cross-four-doors":
        ["flag", "capital", "findcountry", "map", "encyclopedia"].forEach((k) => TrophyModule.recordCommonModeUsed(k));
        TrophyModule.evaluateCommonTrophiesCatchUp();
        renderPanel();
        return;
      case "cross-triple-three":
        TrophyModule.evaluateQuizFinish({ mode: "flag", total: 30, correct: 30, rate: 100, perfect: true, wrongIds: [], correctIds: [], questionIds: [] });
        TrophyModule.evaluateQuizFinish({ mode: "capital", total: 30, correct: 30, rate: 100, perfect: true, wrongIds: [], correctIds: [], questionIds: [] });
        TrophyModule.evaluateFindCountryResult({ difficultyId: "beginner", correctCount: 30, answered: 30, target: 30, maxLives: 5, maxStreak: 30, isNormalClear: true, isProComplete: false, noMistakes: true });
        renderPanel();
        return;
      case "cross-triple-crown":
        TrophyModule.evaluateQuizFinish({ mode: "flag", total: 198, correct: 198, rate: 100, perfect: true, wrongIds: [], correctIds: [], questionIds: [] });
        TrophyModule.evaluateQuizFinish({ mode: "capital", total: 198, correct: 198, rate: 100, perfect: true, wrongIds: [], correctIds: [], questionIds: [] });
        TrophyModule.evaluateFindCountryResult({ difficultyId: "advanced", correctCount: 30, answered: 30, target: 30, maxLives: 3, maxStreak: 30, isNormalClear: true, isProComplete: false, noMistakes: false });
        renderPanel();
        return;
      case "cross-trinity":
        TrophyModule.evaluateQuizFinish({ mode: "flag", total: 10, correct: 10, rate: 100, perfect: true, wrongIds: [], correctIds: [], questionIds: [] });
        TrophyModule.evaluateQuizFinish({ mode: "capital", total: 10, correct: 10, rate: 100, perfect: true, wrongIds: [], correctIds: [], questionIds: [] });
        TrophyModule.evaluateFindCountryResult({ difficultyId: "beginner", correctCount: 5, answered: 5, target: 5, maxLives: 5, maxStreak: 5, isNormalClear: true, isProComplete: false, noMistakes: false });
        renderPanel();
        return;
      case "cross-four-kings": {
        // 称号参照型(#101〜112、国旗6種+首都6種)はawardIfNew()では付与され
        // ない(重複防止の既存仕様)ため、ここでの単発award対象からは除外する
        // (除外しないと、国旗/首都の先頭20件の中に参照型が混ざり、実際に
        // 付与されるのが20件未満になってしまう)
        const isReferenceNumber = (n) => n >= 101 && n <= 112;
        const award20 = (defs) => defs.filter((d) => !isReferenceNumber(d.number)).slice(0, 20).forEach((d) => TrophyModule.awardIfNew(d.id));
        award20(TrophyModule.getAllDefinitions().filter((d) => d.mode === "flag" || d.mode === "flag_only"));
        award20(TrophyModule.getAllDefinitions().filter((d) => d.mode === "capital" || d.mode === "capital_only"));
        award20(TrophyModule.getAllDefinitions().filter((d) => d.mode === "findcountry"));
        award20(TrophyModule.getAllDefinitions().filter((d) => d.mode === "encyclopedia"));
        TrophyModule.evaluateCommonTrophiesCatchUp();
        renderPanel();
        return;
      }
      case "set-play-count":
        patchCommonProgress((data) => {
          data.playCompletedCount = {
            flag: Number($("lab-play-flag").value) || 0,
            capital: Number($("lab-play-capital").value) || 0,
            findcountry: Number($("lab-play-find").value) || 0,
          };
        });
        return;
      case "set-correct-count":
        patchCommonProgress((data) => {
          data.correctCount = {
            flag: Number($("lab-correct-flag").value) || 0,
            capital: Number($("lab-correct-capital").value) || 0,
            findcountry: Number($("lab-correct-find").value) || 0,
          };
        });
        return;
      case "set-wrong-count":
        patchCommonProgress((data) => {
          data.wrongCount = { flag: data.wrongCount.flag || 0, capital: data.wrongCount.capital || 0, findcountry: Number($("lab-wrong-find").value) || 0 };
        });
        return;
      case "set-streak-days":
        patchCommonProgress((data) => {
          const streak = Number($("lab-streak").value) || 0;
          const days = Number($("lab-played-days").value) || 0;
          data.currentStreakDays = streak;
          data.maxStreakDays = Math.max(data.maxStreakDays || 0, streak);
          fillPastPlayedDates(data, days);
        });
        return;
      case "set-world-tour":
        if (typeof COUNTRIES !== "undefined") {
          const ids = COUNTRIES.map((c) => c.id);
          TrophyModule.recordQuizStats({ mode: "flag", total: 198, correct: 198, correctIds: ids });
          TrophyModule.recordQuizStats({ mode: "capital", total: 198, correct: 198, correctIds: ids });
          TrophyModule.evaluateCommonTrophiesCatchUp();
          renderPanel();
        }
        return;
      case "preview-truth": previewTruthAward(); return;
      case "reevaluate": {
        const awarded = TrophyModule.evaluateCommonTrophiesCatchUp();
        renderPanel();
        window.alert(awarded.length > 0 ? `新規に${awarded.length}件獲得しました。` : "新規獲得はありませんでした。");
        return;
      }
      case "open-trophy-list": openTrophyListOnCommon(); return;
      case "reset-all":
        if (window.confirm("テストラボの保存データ(このラボ専用の名前空間)をすべて初期化します。よろしいですか？")) {
          Storage.resetAll();
          renderPanel();
        }
        return;
      default: break;
    }
  }

  window.initCommonTrophyLab = function initCommonTrophyLab() {
    openTrophyListOnCommon();
    renderPanel();
    const panel = $("wfq-lab-panel");
    if (panel) panel.addEventListener("click", onPanelClick);
  };
})();
