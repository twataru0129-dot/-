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
//   - judgeMode:"ordered"(将来の順番指定問題用)は選択順も一致を要求する。
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

  // 将来の「順番指定」問題用。選択順も含めて完全に一致するかを判定する
  function isSameSequence(a, b) {
    if (a.length !== b.length) return false;
    return a.every((value, i) => value === b[i]);
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

    const answerIds = question.answerIds || [];
    const correct =
      question.judgeMode === "ordered"
        ? isSameSequence(answerIds, selectedIds)
        : isSameMultiset(answerIds, selectedIds);

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
