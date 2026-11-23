// ==========================================================
// 謎解き正解判定処理(第2段階)
//
// 問題データ(js/puzzle-questions.jsのPUZZLE_QUESTIONS)にも、国旗選択の
// 画面操作(js/puzzle.js)にも依存しない、「判定ロジックだけ」の責務。
// 3問専用のif文・switch文は持たず、PUZZLE_QUESTIONSの件数が何問に
// 増えても judge(questionId, selectedIds) という同じ1つの入口だけで
// 対応できる(将来40問・50問・100問以上に増やす場合もこのファイルの
// 変更は不要で、js/puzzle-questions.jsに要素を追加するだけでよい)。
//
// 判定ルール:
//   - 挑戦中の問題ID(questionId)に対応する問題だけを対象に判定する。
//     他の問題の正解条件と比較することは絶対に行わない(問題Aに挑戦中に
//     問題Bの正解を入力しても、問題Bの正誤判定自体を実行しない)。
//   - 正解の国・地域がすべて選択され、余分がなく、選択回数(重複選択も
//     含む)も一致した場合のみ正解とする(多重集合としての一致)。
//   - judgeMode:"unordered"(順不同)は選択順を問わない。
//   - judgeMode:"ordered"(順番指定)は選択順も一致を要求する。
//   - judgeMode:"grouped"(一部順不同、謎解きトロフィー118問追加で新設):
//     問題データのanswerGroups(グループの配列。例: [["mn","cn"],["cl"],
//     ["na"],["in","pk"]])を、先頭から順に、各グループの件数ぶんだけ
//     選択を区切って多重集合として比較する。グループの並び順(どのグループが
//     何番目か)は固定だが、同じグループ内の複数国は順不同(どちらを先に
//     選んでも正解)。
//   - judgeMode:"initial-letter-ordered"(英語国名の頭文字一致、謎解き
//     トロフィー118問追加で新設): 問題データのrequiredInitials(例:
//     ["J","A","P","A","N"])の各位置に、英語国名(js/countries.jsの
//     COUNTRIES・js/map-regions.jsのMAP_ONLY_REGIONSが持つenglishName、
//     既存データをそのまま使い、専用の辞書は複製しない)の頭文字(大文字化)が
//     一致する国・地域を、指定された順序で選択した場合に正解とする。
//     同じ国を複数の位置で選ぶことも許可する(例: JAPANのAが2回)。
//
// トロフィーの獲得・保存・解放処理はこのファイルの責務に含めない
// (将来、別のファイルで実装する。ここでは正誤と、正解時に表示する
// 正式名称・解説文を返すだけで、保存処理は一切行わない)。
// ==========================================================

const PuzzleJudgeModule = (() => {
  function sortedCopy(arr) {
    return arr.slice().sort();
  }

  // 「正解の国・地域がすべて選択され、余分がなく、選択回数も一致」を
  // 選択順を問わずに判定する(多重集合としての一致)
  function isSameMultiset(a, b) {
    if (a.length !== b.length) return false;
    const sa = sortedCopy(a);
    const sb = sortedCopy(b);
    return sa.every((value, i) => value === sb[i]);
  }

  // 順番指定問題用。選択順も含めて完全に一致するかを判定する
  function isSameSequence(a, b) {
    if (a.length !== b.length) return false;
    return a.every((value, i) => value === b[i]);
  }

  // 「一部順不同」問題用(例: No.114「砂漠の四つの顔」)。answerGroupsの
  // 各グループの件数ぶんだけ、selectedIdsを先頭から順に切り出し、その
  // 区間が当該グループと多重集合として一致するかを順番に確認する。
  // グループ自体の並び順は固定、グループ内は順不同。選択合計数が
  // グループ合計件数と異なる場合は、切り出す前に不一致として扱う
  function isSameGroupedSequence(groups, selectedIds) {
    const totalExpected = groups.reduce((sum, g) => sum + g.length, 0);
    if (selectedIds.length !== totalExpected) return false;
    let offset = 0;
    for (const group of groups) {
      const chunk = selectedIds.slice(offset, offset + group.length);
      if (!isSameMultiset(group, chunk)) return false;
      offset += group.length;
    }
    return true;
  }

  // 英語国名の頭文字一致(大文字)を確認するための一覧。js/countries.js・
  // js/map-regions.jsが持つenglishNameをそのまま使うだけで、専用の辞書を
  // 新たに複製しない。呼び出しのたびに作り直さず、初回だけ構築してキャッシュする
  let initialLetterIndexCache = null;
  function buildInitialLetterIndex() {
    const list = []
      .concat(typeof COUNTRIES !== "undefined" ? COUNTRIES : [])
      .concat(typeof MAP_ONLY_REGIONS !== "undefined" ? MAP_ONLY_REGIONS : []);
    const index = {};
    list.forEach((c) => {
      const name = (c.englishName || "").trim();
      if (!name) return;
      const letter = name.charAt(0).toUpperCase();
      if (!index[letter]) index[letter] = new Set();
      index[letter].add(c.id);
    });
    return index;
  }
  function countryMatchesInitial(id, letter) {
    if (!initialLetterIndexCache) initialLetterIndexCache = buildInitialLetterIndex();
    const set = initialLetterIndexCache[letter];
    return !!set && set.has(id);
  }

  // 英語国名頭文字一致問題用(No.092「世界を解く暗号」・No.116「四文字の
  // 道標」)。requiredInitialsと同じ長さの選択を、指定された順序で、
  // 各位置の国・地域の英語名頭文字が一致する場合のみ正解とする。
  // 同じ国を複数の位置で選んでも、各位置の判定は独立に行うため問題ない
  function isSameInitialLetterSequence(requiredInitials, selectedIds) {
    if (selectedIds.length !== requiredInitials.length) return false;
    return requiredInitials.every((letter, i) => countryMatchesInitial(selectedIds[i], letter));
  }

  function findQuestion(questionId) {
    if (typeof PUZZLE_QUESTIONS_BY_ID === "undefined") return null;
    return PUZZLE_QUESTIONS_BY_ID[questionId] || null;
  }

  // questionIdに対応する問題だけを対象に判定する。questionIdが未登録
  // (問題データが見つからない)場合は、安全側に倒して常に不正解とする
  function judge(questionId, selectedIds) {
    const question = findQuestion(questionId);
    if (!question) {
      return { correct: false };
    }

    let correct;
    if (question.judgeMode === "grouped") {
      correct = isSameGroupedSequence(question.answerGroups || [], selectedIds);
    } else if (question.judgeMode === "initial-letter-ordered") {
      correct = isSameInitialLetterSequence(question.requiredInitials || [], selectedIds);
    } else {
      const answerIds = question.answerIds || [];
      correct =
        question.judgeMode === "ordered"
          ? isSameSequence(answerIds, selectedIds)
          : isSameMultiset(answerIds, selectedIds);
    }

    if (!correct) {
      return { correct: false };
    }
    return {
      correct: true,
      questionId: question.id,
      title: question.title,
      explanationText: question.explanationText,
    };
  }

  return { judge };
})();
