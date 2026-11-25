// ==========================================================
// トロフィー刷新 第1段階+第2段階+Stage A+Stage B+Stage C+Stage D: 新トロフィーシステム(107項目)
//
// 目的: 既存の称号(js/quiz.jsのTITLES/CAPITAL_TITLES、国旗6件+首都6件=
// 計12件)には一切手を加えず、それとは完全に独立した新しいトロフィー
// システムの「定義・保存・読み込み・重複獲得防止」の基本機能(第1段階)に、
// 「判定エンジン・モード区別・既存データからの導出ヘルパー・実クイズへの
// 接続」(第2段階)を追加する。
//
// Stage A(docs/trophy-spec-final.md参照)で追加したこと:
// - 共通/国旗別/首都別(デュアル状態)を正しく管理できる保存基盤
//   (awardIfNew/isEarnedがmode引数を受け取れるようになった。mode省略時は
//   従来どおり単一の共通状態として扱われ、第1・第2段階の挙動は一切変わらない)
// - #101〜112を「参照型」として扱う仕組み(REFERENCE_TITLE_MAP)。これらの
//   番号は新規に書き込まれず、既存のStorage.hasTitle()/getEarnedTitles()を
//   都度参照するだけになる(二重保存の防止)
// - wfq_v1_trophy_stats(新規)の保存・読み込み・初期化処理の骨組み
//   (#58等の新しい累計カウンタ用。実際に値を書き込む判定ロジックは
//   Stage C以降で実装する。Stage Aでは入れ物だけを用意する)
// - js/storage.jsのStorage.resetAll()から呼ばれるTrophyModule.resetAll()
//   (新トロフィーの獲得記録・統計も全データリセットの対象に含める)
//
// Stage Aでも行っていないこと:
// - 107項目の名称・獲得条件・check関数の登録(Stage Bで実施)
// - 回答時間計測・国別履歴の収集ロジック(Stage D・E)
// - トロフィー一覧画面(Stage G)
//
// Stage B(docs/trophy-spec-final.md参照)で追加したこと:
// - 既存の保存データ(称号・挑戦回数・最高記録・そのプレイ自身の結果)
//   だけで判定でき、新しい統計収集・回答時間計測・プレイ開始時刻判定を
//   必要としない79項目(#1〜19、#40〜49・51〜54・59、#61・62・65・67、
//   #71〜89・91〜100、#101〜112)に、正式な名称・獲得条件・mode・check
//   関数を設定し、confirmed:trueにした(STAGE_B_DEFINITIONS参照)
// - #101〜112はStage Aで実装済みの参照型の挙動(既存称号を都度参照、
//   二重保存なし)をそのまま維持し、名称・条件・modeのみ補完した
//   (checkは今後も設定しない。getEarned/isEarned/awardIfNewが
//   referenceTitleFor()経由で別扱いするため)
// - 残り28項目(#20〜39、#58、#60、#63・64・66・68〜70)は、新規の
//   回答時間計測・国別正解履歴・開始時刻判定・新規カウンタのいずれかが
//   必要なため、Stage B時点ではまだconfirmed:falseのまま
//   (Stage C〜Fで段階的に実装する)
//
// Stage Bでも行っていないこと:
// - 新しい統計収集・回答時間計測・プレイ開始時刻の判定(Stage C〜F)
// - トロフィー専用の新しい表示画面(Stage G)
// - 国旗・首都クイズの出題・採点・ランキング、世界地図・世界図鑑・
//   「世界の国どこかな？」の既存の保存・判定ロジックの変更(一切行っていない)
//
// Stage C(docs/trophy-spec-final.md参照)で追加したこと:
// - 新関数 recordQuizStats(context): wfq_v1_trophy_statsへの「統計の記録」
//   専用の入口。既存のevaluate()/evaluateQuizFinish()(判定・獲得エンジン)
//   とは完全に別の関数にすることで、Stage Cでは獲得判定に一切手を加えない
//   (#58・60・63・64・66・68の獲得可否は依然判定しない)
// - js/app.jsのfinishQuiz()から、evaluateQuizFinish()の直後(判定が確定した
//   後)に1回だけrecordQuizStats()を呼ぶように接続。完了していないプレイ
//   (「終了する」ボタンでの中断)ではfinishQuiz()自体が呼ばれないため、
//   統計も従来の「プレイ回数は完了時のみ加算」という原則と自動的に揃う
// - 記録する内容(すべてモード別。#60のみ合算して使う想定で分離保存):
//   - perfectCounts: 198問コースでの満点回数(#58)
//   - fastAnswerCounts: 正解かつ2秒/3秒以内だった回答の累計回数(#21・26・27)
//   - partialStreakCounts: 10問コースで9問正解だった回数(#60)
//   - countryCorrectEver/countryCorrectCount: 国別の生涯正解有無・回数(#30〜39)
//   - countryWrongEver: 国別の誤答履歴(#63は同モード、#68は国旗側の履歴を
//     首都プレイ側の判定が参照する想定のため、モードをまたいで読み取れる
//     ようあえて混ぜずモード別に保持する)
//   - lastCourseResult: 同一モード・同一コースの直前の完了プレイの結果(#66。
//     将来の判定ロジックはrecordQuizStats()が上書きする前の値を読む必要が
//     あるため、呼び出し順は必ず「判定(evaluateQuizFinish) → 統計記録
//     (recordQuizStats)」を守る、という前提で設計している)
// - js/app.jsのstartQuiz()でそのプレイの開始時刻(quizStartedAt)と、各問題の
//   回答時間配列(answerTimings)を記録し、finishQuiz()でトロフィー用の
//   contextに含めるようにした(#64・70の開始時刻判定、#20〜29・69の回答時間
//   判定に必要な「データ」のみを用意する。これらの番号のcheck関数・
//   confirmed:trueへの変更自体はまだ行わない)
// - isValidTrophyStats()を、各フィールドの中身(モード別の数値・国idごとの
//   真偽値/回数等)まで検証するように強化した(Stage Aでは骨組みのみで
//   実際に書き込まれることが無かったため簡易な検証で十分だったが、Stage C
//   で実際に書き込みが始まるため、壊れたデータを安全側に倒す検証を厚くした)
//
// Stage Cでも行っていないこと:
// - #20〜39・58・60・63・64・66・68〜70の獲得判定・check関数の登録
//   (いずれもStage D〜Fで実施)
// - トロフィー専用の新しい表示画面(Stage G)
// - 国旗・首都クイズの出題・採点・タイマー・ランキング、世界地図・世界図鑑・
//   「世界の国どこかな？」の変更(一切行っていない)
// - 既存データの削除・初期化(resetAll()以外の経路での削除は行っていない)
//
// Stage D(docs/trophy-spec-final.md参照)で追加したこと:
// - 残り28項目(#20〜39・58・60・63・64・66・68〜70)の獲得条件(check関数)を
//   登録し、confirmed:trueにした(STAGE_D_DEFINITIONS参照)。これにより
//   107件全てのconfirmed:true化が完了する
// - js/app.jsのfinishQuiz()は「判定(evaluateQuizFinish) → 統計記録
//   (recordQuizStats)」の順で呼ぶため、ここのcheck関数は統計を読む時点では
//   まだそのプレイ自身の結果が反映されていない。#21・26・27・58・60は
//   「保存済みの前回までの値」+「今回のプレイ分(contextから計算)」を
//   その場で合算して閾値判定することで、このプレイ自身が条件を満たす瞬間を
//   取り落とさないようにした。#66は逆に、合算も補完もせず「上書き前の
//   直前の値」とそのまま比較し、直前の記録が無ければ対象外にした
// - #63(同モードの誤答からのリベンジ)・#68(国旗の誤答→首都で正解)は、
//   countryWrongEver(Stage Cで記録済み)をそのまま参照する。評価の時点では
//   そのプレイ自身の誤答はまだ統計に入っていないため、過去のプレイの誤答
//   だけを見ることになる(同じプレイ内で同じ国が誤答と正解の両方になる
//   ことは無いため、自身の結果と衝突する心配もない)
// - #64・70(開始時刻判定)は、Stage Cで記録したcontext.startedAt(ISO文字列)
//   を、同じブラウザ内でDateとして再構築し、getHours()等でその場の
//   ローカルタイムゾーンの時刻を復元して判定する(新しい保存領域は追加しない)
// - #20〜29の回答時間系は、そのプレイ自身のcontext.answerTimings(永続化
//   していない生データ)から、単発(#20)・連続(#22・23)・平均(#24・25・
//   28・29)・最終1問(#69)をそれぞれ算出する。answerTimingsの件数が
//   出題数と一致しない(欠損がある)場合は、推測で補完せず判定しない
//
// Stage Dでも行っていないこと:
// - トロフィー専用の新しい表示画面(Stage G)
// - 国旗・首都クイズの出題・採点・タイマー・ランキング、世界地図・世界図鑑・
//   「世界の国どこかな？」の変更(一切行っていない)
// - 既存データの削除・初期化
//
// Stage E(ユーザー指示のStage E=ドキュメント上のStage G「画面・演出・
// 全体テスト」に相当)で追加したこと:
// - 各トロフィーのcategory(表示用の分類ラベル、TROPHY_CATEGORIES・
//   categoryForNumber())とhidden(当初は全107件false)を補完し、公開APIに
//   getCategories()を追加した。name/condition/mode/check(獲得条件・判定
//   ロジック)は一切変更していない
// - トロフィー一覧画面(js/app.jsのrenderTrophyListScreen()、既存の
//   「称号コレクション」画面とは別画面)と、複数トロフィー同時獲得に対応した
//   新しい獲得演出画面(renderTrophyAwardScreen())をjs/app.js側に追加した
//   (js/trophy.js自体の判定・保存ロジックへの変更はcategory/hidden補完の
//   みで、評価エンジン(evaluate/evaluateQuizFinish)・判定関数は無変更)
//
// Stage E追加検討(隠しトロフィー選定)で追加したこと:
// - 調査・比較検討の結果、ユーザー指示によりHIDDEN_TROPHY_NUMBERS(12件:
//   #53・61・62・64・65・67・70・75・86・87・88・89)を正式な隠しトロフィー
//   として確定した(検討時に挙げた36件案は不採用。docs/trophy-spec-final.md
//   「7. 隠しトロフィー仕様」参照)。hiddenフィールドをこの12件のみtrueに
//   変更。名称・条件・mode・check・番号・保存キーは一切変更していない
// - 表示側(js/app.js)で、hidden:trueかつ未獲得のトロフィーは名称「？？？？？？」・
//   条件非表示・鍵アイコン・状態「未発見」にする分岐と、新規獲得時の
//   「隠しトロフィー発見演出」を追加した(既存の獲得演出画面を拡張、保存形式は
//   無変更)
//
// Stage Eでも行っていないこと:
// - 既存の12称号の獲得履歴・保存形式・コレクション画面・獲得演出の変更
// - 国旗・首都クイズの出題・採点・ランキング、世界地図・世界図鑑・
//   「世界の国どこかな？」・PROモードの変更(一切行っていない)
// - 既存データの削除・初期化(Storage.resetAll()の対象範囲も変更していない)
//
// 第2段階で行ったこと:
// - 各スロットに mode(flag/capital/both/findcountry/null)・check(判定
//   関数、未確定の間はnull)フィールドを追加(値そのものはまだ推測しない)
// - evaluate()/evaluateQuizFinish()/evaluateFindCountryResult(): クイズ
//   結果確定後に呼ばれる汎用判定エンジン。confirmed:trueかつcheckが
//   設定されたスロットだけを対象にするため、現時点(confirmed:true が
//   1件も無い)では必ず何も獲得されない「安全な空振り」になる
// - 既存データ(称号・ランキング・コレクション)だけから導出できる判定
//   ヘルパー関数を用意(isModeTitlePerfectEarned/isBothModesTitlePerfectEarned/
//   getFindCountryRegionProgress/arePairCorrect)。どれも新しい保存領域を
//   一切追加しない読み取り専用の純粋関数
// - js/app.js(finishQuiz)・js/findcountry.js(showResult)から、結果確定後に
//   1回だけevaluateQuizFinish()/evaluateFindCountryResult()を呼ぶように
//   接続(try/catchで囲み、万一の例外でも既存のスコア・称号・ランキング・
//   画面遷移には一切影響しない)
//
// 第2段階でも行っていないこと(第2段階時点では未確定だったもの。Stage Bで
// 79項目分は解消した):
// - トロフィー専用の新しい表示画面(Stage G)
// - 「過去の誤答履歴」「国旗/首都の回答速度」「プレイ開始時刻」等、新しい
//   永続記録・新しい統合ポイントが必要な残り28項目の判定(Stage C〜F)
//
// 企画の確定仕様: 既存12項目+新規95項目の合計107項目。通し番号は
// 1〜112で、50・55・56・57・90番が欠番(112-5=107件)。名称・獲得条件は
// docs/trophy-spec-final.mdで107件すべて確定済み。Stage Bで79件分・
// Stage Dで残り28件分をname/condition/mode/check(confirmed:true)として
// 反映し、107件全てのconfirmed:true化が完了した。Stage Eでcategory
// (表示用分類)・hiddenを全107件に補完し、一覧画面(js/app.js側)を追加した。
// hiddenは正式確定した12件(#53・61・62・64・65・67・70・75・86・87・88・89)
// のみtrue、残り95件はfalse。
//
// 追加修正(国旗トリビア29件の国旗クイズ限定化): #71〜100(カテゴリー
// 「国旗トリビア」)のうち、当初は24件が国旗・首都共通(mode:"common")
// だったが、カテゴリー名と獲得方法を一致させるため、29件全てを国旗クイズ
// 限定(mode:"flag_only"+pairCheck(...,{flagOnly:true}))に統一した。
// 番号・名称・対象国・判定対象以外のロジックは変更していない。
// カテゴリーの内部id("trivia")・表示ラベル("国旗トリビア")・107件という
// 総数・#71〜100以外のトロフィーの獲得条件には一切影響しない。
//
// 首都トリビア追加(#113〜141、新規29件): 既存107件はそのまま維持し、
// 新カテゴリー「首都トリビア」として29件を追加、総数が136件になった。
// 獲得条件はmode:"capital_only"+pairCheck(...,{capitalOnly:true})
// (国旗トリビアのflag_only/flagOnlyと対になる、首都クイズ限定の判定)で、
// 既存のpairCheck()/arePairCorrect()をそのまま再利用し新しい判定コードは
// 追加していない。各トロフィーにdescription(正式解説文)・countries
// (対象2か国のid配列)を追加フィールドとして持たせ、一覧画面・獲得通知画面の
// 表示に用いる(#1〜112にはこれらのフィールドは設定されずnullのまま)。
// 既存107件の名称・獲得条件・mode・check・保存形式・称号コレクション
// (#101〜112参照型)には一切影響しない。
// ==========================================================

const TrophyModule = (() => {
  // 既存のjs/storage.jsのStorageKeys/CapitalStorageKeys/FINDCOUNTRY_*とは
  // 完全に別のキーにする(既存の保存データには一切触れない)。
  // STORAGE_PREFIX・safeGet/safeSet はjs/storage.js(IIFEで囲まれていない
  // ため同じグローバルスコープを共有する既存のファイル群)で既に定義されて
  // いるものをそのまま再利用し、保存処理を複製しない。script読み込み順は
  // index.html上でjs/storage.jsの直後にしてあるため、参照時点で必ず
  // 定義済みになる。
  const TROPHY_KEY = STORAGE_PREFIX + "trophy_earned";
  const TROPHY_VERSION = 1;
  // Stage A: 新しい累計カウンタ・履歴用の保存領域(既存のTROPHY_KEYとは別の
  // 新規キー)。中身を実際に書き込む判定ロジックはStage C以降で実装する
  const TROPHY_STATS_KEY = STORAGE_PREFIX + "trophy_stats";
  const TROPHY_STATS_VERSION = 1;

  // 企画の確定仕様どおりの欠番(50・55・56・57・90)
  const SKIPPED_NUMBERS = [50, 55, 56, 57, 90];
  // 首都トリビア29件(#113〜141)の追加により、通し番号の上限が112から141に
  // 拡張された(欠番は追加されていない。112-5+29=136件)。
  // さらに特別な隠しトロフィー#142「都の神話」(首都トリビア29種類を
  // すべて獲得した時点で自動獲得)の追加により、上限が141から142に
  // 拡張された(136+1=137件)
  // 「世界の国どこかな？」専用トロフィー36種類(#159〜194)の追加により、
  // 上限が158から194に拡張された(153+36=189件)
  // 隠しトロフィー61種類(#195〜255、第2段階)の追加により、上限が194から
  // 255に拡張された(189+61=250件)
  //
  // 謎解きトロフィー(第3段階)の追加により、#256以降にjs/puzzle-questions.js
  // (PUZZLE_QUESTIONS)の問題分だけ番号を割り振る。
  //
  // 【PR #81追加修正】番号は各問題のPUZZLE_QUESTIONS[].trophyNumber(問題
  // データ側に明示的に固定した恒久的な番号)をそのまま使う。配列の並び順
  // (index)や件数(length)からは一切計算しない。これにより、
  //   - 問題を途中に追加しても、既存の問題のtrophyNumberは変化しない
  //   - 配列の並び順を変更しても、既存の問題のtrophyNumberは変化しない
  //   - 問題番号(No.01等、PUZZLE_QUESTIONS[].number)とトロフィー管理番号
  //     (trophyNumber)は完全に別の値として管理される
  // 新しい問題を追加する場合は、既存のどのtrophyNumberとも重複しない
  // 未使用の番号を新しく割り振ること(重複・範囲外の値は下の
  // validateTrophyDefinitions()が検出する)。
  //
  // 問題を削除してtrophyNumberが欠番になる場合は、首都トリビア等の既存の
  // 欠番(50・55・56・57・90)と同じ扱いとして、その番号をSKIPPED_NUMBERSに
  // 追加すること(新しい問題に再利用しない)。欠番がSKIPPED_NUMBERSに
  // 追加されていない場合は、下のvalidateTrophyDefinitions()が「未定義の
  // まま枠だけ作られている番号」として検出する。
  //
  // (PUZZLE_QUESTIONSはjs/trophy.jsより前に読み込むようindex.htmlの
  // script順を変更済み。未読み込み・空配列の場合は謎解きトロフィーを
  // 0件として扱い、既存の255件には一切影響しない)
  const PUZZLE_TROPHY_NUMBER_BASE = 255;
  const PUZZLE_QUESTION_LIST = typeof PUZZLE_QUESTIONS !== "undefined" ? PUZZLE_QUESTIONS : [];
  const PUZZLE_TROPHY_NUMBERS = PUZZLE_QUESTION_LIST.map((q) => q.trophyNumber);

  // 世界図鑑トロフィー追加分(#259〜262、4件)。謎解きトロフィーとは異なり
  // 問題データファイルから動的に生成するものではないため、固定の番号配列と
  // して直接定義する。番号は謎解きトロフィーの番号(#256〜、現時点の最大は
  // #258)とも重複しない、現時点で未使用の番号を割り当てた。将来、謎解き
  // トロフィーがこれらの番号まで増えた場合に備え、categoryForNumber()は
  // 単純な範囲比較ではなくこの配列への実在チェックで「世界図鑑」と判定する
  // (下記参照)
  const ENCYCLOPEDIA4_NUMBERS = [259, 260, 261, 262];

  // 世界7不思議(7問、#386〜392)+隠し特別トロフィー2種(ミステリーハンター
  // #393・全知全能の神#394)。js/seven-wonders-questions.js
  // (SEVEN_WONDERS_QUESTIONS)から動的に生成する点は謎解きトロフィーと同じ。
  // この7問は意図的にPUZZLE_QUESTIONS(通常謎解き126問)とは別の配列に
  // 分離してあるため、「通常謎解きを全問獲得」の判定(isAllNormalPuzzlesEarned、
  // 下記)の対象に構造上絶対に混入しない(循環参照防止)。番号は既存の
  // どのトロフィー番号(謎解き#256〜385含む)とも重複しない、現時点で
  // 未使用の#386〜394を新しく割り振った
  const SEVEN_WONDERS_QUESTION_LIST = typeof SEVEN_WONDERS_QUESTIONS !== "undefined" ? SEVEN_WONDERS_QUESTIONS : [];
  const SEVEN_WONDERS_TROPHY_NUMBERS = SEVEN_WONDERS_QUESTION_LIST.map((q) => q.trophyNumber);
  const MYSTERY_HUNTER_NUMBER = 393;
  const OMNISCIENT_GOD_NUMBER = 394;
  // js/seven-wonders-questions.jsが読み込まれていない場合(未更新の既存
  // テストファイル等)は、PUZZLE_QUESTIONSが空の場合と同じく、世界7不思議
  // 関連の番号を一切予約しない(#393・#394も含め、既存の254+謎解き件数の
  // 構成に一切影響を与えない、完全な後方互換)
  const SEVEN_WONDERS_ALL_NUMBERS = SEVEN_WONDERS_TROPHY_NUMBERS.length
    ? SEVEN_WONDERS_TROPHY_NUMBERS.concat([MYSTERY_HUNTER_NUMBER, OMNISCIENT_GOD_NUMBER])
    : [];

  // 謎解きトロフィー自身が実際に占有している範囲の上限(PUZZLE_QUESTIONSが
  // 空の場合は255のまま)。全体の上限(MAX_TROPHY_NUMBER、下記)とは区別する。
  // 世界図鑑追加分(#259〜262)のように謎解きより後ろに固定番号の別の段階が
  // 追加されたことで、全体の上限が謎解き自身の範囲よりも先に進むことが
  // あるため、「謎解き自身の欠番チェック」は必ずこちらの値を基準にする
  // (PUZZLE_QUESTIONSが空の場合でも、無関係な後続の段階の番号を謎解きの
  // 欠番と誤認しないようにするため)
  const PUZZLE_OWN_MAX_NUMBER = PUZZLE_TROPHY_NUMBERS.length
    ? Math.max(PUZZLE_TROPHY_NUMBER_BASE, ...PUZZLE_TROPHY_NUMBERS)
    : PUZZLE_TROPHY_NUMBER_BASE;

  // 共通トロフィー31種類(#395〜425)。PR #87時点の最大番号(#394、世界7不思議
  // 隠し特別2種を含む)の直後に、企画書(共通トロフィー最終確定版)どおり
  // 連番で割り振る。既存の欠番(50・55・56・57・90)は再利用しない
  const COMMON_TROPHY_NUMBERS = Array.from({ length: 31 }, (_, i) => 395 + i);

  const MAX_TROPHY_NUMBER = Math.max(PUZZLE_OWN_MAX_NUMBER, ...ENCYCLOPEDIA4_NUMBERS, ...SEVEN_WONDERS_ALL_NUMBERS, ...COMMON_TROPHY_NUMBERS);

  // 謎解き自身の範囲(PUZZLE_OWN_MAX_NUMBERまで)と世界図鑑追加分
  // (ENCYCLOPEDIA4_NUMBERS)・世界7不思議(SEVEN_WONDERS_ALL_NUMBERS)・
  // 共通トロフィー(COMMON_TROPHY_NUMBERS)のどれにも属さない番号(例: PUZZLE_
  // QUESTIONSが空、または謎解きの件数が少ない状態で、#259より手前の番号が
  // 余ってしまう場合)は、スロット自体を作らない(confirmed:falseの未定義
  // スロットを残さない)。これにより、謎解きの件数に関わらずTROPHIES.length・
  // カテゴリ別集計が常に正しい値になる
  const UNCLAIMED_GAP_NUMBERS = [];
  for (let n = PUZZLE_OWN_MAX_NUMBER + 1; n <= MAX_TROPHY_NUMBER; n++) {
    if (!ENCYCLOPEDIA4_NUMBERS.includes(n) && !SEVEN_WONDERS_ALL_NUMBERS.includes(n) && !COMMON_TROPHY_NUMBERS.includes(n)) {
      UNCLAIMED_GAP_NUMBERS.push(n);
    }
  }

  // #101〜112は既存12称号(js/quiz.jsのTITLES/CAPITAL_TITLES)をそのまま
  // 参照する「参照型」スロット。新規にwfq_v1_trophy_earnedへ書き込むことは
  // 一切せず、常にStorage.hasTitle()/getEarnedTitles()を都度参照する
  // (docs/trophy-spec-final.md 2章の対応表と完全に一致させる)
  const REFERENCE_TITLE_MAP = {
    101: { id: "beginner", mode: "flag" },
    102: { id: "challenger", mode: "flag" },
    103: { id: "traveler", mode: "flag" },
    104: { id: "expert", mode: "flag" },
    105: { id: "master", mode: "flag" },
    106: { id: "legend", mode: "flag" },
    107: { id: "cap_beginner", mode: "capital" },
    108: { id: "cap_challenger", mode: "capital" },
    109: { id: "cap_traveler", mode: "capital" },
    110: { id: "cap_expert", mode: "capital" },
    111: { id: "cap_master", mode: "capital" },
    112: { id: "cap_legend", mode: "capital" },
  };
  function referenceTitleFor(number) {
    return REFERENCE_TITLE_MAP[number] || null;
  }

  // ========================================================
  // Stage B: 既存の保存データ(称号・挑戦回数・最高記録・そのプレイ自身の
  // 結果)だけで判定できるトロフィーの獲得条件(docs/trophy-spec-final.md
  // 2章)。check関数はStorage/getTitleByCount等の既存APIを読み取るだけで、
  // 新しい保存領域には一切書き込まない(読み取り専用)。
  // ========================================================
  const ALL_COURSE_COUNTS = [10, 20, 30, 50, 100, 198]; // 既存6コース(#8〜19・47〜49・59用)
  const ALL_QUIZ_REGIONS = ["asia", "europe", "africa", "namerica", "samerica", "oceania"]; // #62用

  // 指定モード・指定問題数の称号(全問正解)が、指定したcounts全てで
  // 獲得済みかどうか(#15〜17・41〜49・59用)。isModeTitlePerfectEarned()
  // (第2段階で追加済みの既存ヘルパー)をそのまま複数件分呼ぶだけ
  function hasAllTitles(mode, counts) {
    return counts.every((count) => isModeTitlePerfectEarned(count, mode));
  }

  // 指定モード・指定問題数コースの過去最高正解数(#8〜14・47・48用)。
  // そのコースを1度もプレイしていない場合はnullを返す
  function bestCorrectAtCount(mode, count) {
    const rec = Storage.getBestRecords(mode)[String(count)];
    return rec && Number.isFinite(rec.correct) ? rec.correct : null;
  }

  // 指定モード・指定問題数コースの過去最高正答率(0〜1、#18・19用)。
  // そのコースを1度もプレイしていない場合はnullを返す
  function bestAccuracyAtCount(mode, count) {
    const rec = Storage.getBestRecords(mode)[String(count)];
    if (!rec || !Number.isFinite(rec.correct) || !Number.isFinite(rec.total) || rec.total <= 0) return null;
    return rec.correct / rec.total;
  }

  // 国idから地域(region)を調べる(#62用)。js/countries.jsのCOUNTRIESを
  // そのまま参照し、データを複製しない(js/storage.jsの
  // findCountryCollectionValidIds()と同じ、初回アクセス時のみキャッシュする考え方)
  let countryRegionByIdCache = null;
  function countryRegionById(id) {
    if (!countryRegionByIdCache) {
      countryRegionByIdCache = new Map();
      (typeof COUNTRIES !== "undefined" ? COUNTRIES : []).forEach((c) => countryRegionByIdCache.set(c.id, c.region));
    }
    return countryRegionByIdCache.get(id) || null;
  }

  // 「同じクイズプレイで指定した2か国が両方正解」判定(#71〜100・#113〜141用)の
  // check関数を作る。flagOnly指定時は国旗クイズのプレイのみ(#71〜100、2026年の
  // 追加修正で29件全て国旗限定に統一)、capitalOnly指定時は首都クイズの
  // プレイのみ(#113〜141「首都トリビア」)を対象にする。国旗/首都のどちらの
  // クイズでも、質問のidは共通してjs/countries.jsの国idのため、モードを
  // 区別せず同じロジックで判定できる(js/quiz.jsのbuildQuestionSet()参照)。
  // 「世界の国どこかな？」からの呼び出し(context.source==="findcountry")は
  // 対象外にする(条件が「同じ国旗・首都クイズのプレイ」を前提にしているため)。
  // 正解の配列(context.correctIds)の順序は見ないため、正解順序は問わない。
  // 別プレイのcorrectIdsを合算することもない(その都度のcontextだけを見るため)
  function pairCheck(idA, idB, options) {
    const flagOnly = !!(options && options.flagOnly);
    const capitalOnly = !!(options && options.capitalOnly);
    return function (context) {
      if (!context || context.source !== "quiz") return false;
      if (flagOnly && context.mode !== "flag") return false;
      if (capitalOnly && context.mode !== "capital") return false;
      if (!Array.isArray(context.correctIds)) return false;
      return arePairCorrect(idA, idB, new Set(context.correctIds));
    };
  }

  // 番号 -> { name, condition, mode, check } (#101〜112はcheckを持たない
  // 参照型のため省略。mode凡例: "both"=国旗/首都を分離管理するデュアル状態
  // (#1〜19)、"common"=共通1個またはAND条件(#40〜70。両モードの既存データを
  // 読む場合でも単一の共通状態として管理する)、"flag_only"=国旗クイズの
  // プレイのみ対象(#75・86〜89)、"flag"/"capital"=既存称号の参照型(#101〜112))
  const STAGE_B_DEFINITIONS = {
    // ---- #1〜19: 既存データ(デュアル状態。国旗/首都を分離管理) ----
    1: { name: "はじめの一歩", condition: "初回完了", mode: "both", check: (ctx) => Storage.getAttempts(ctx.mode) >= 1 },
    2: { name: "クイズ好き", condition: "10回完了", mode: "both", check: (ctx) => Storage.getAttempts(ctx.mode) >= 10 },
    3: { name: "世界への挑戦者", condition: "30回完了", mode: "both", check: (ctx) => Storage.getAttempts(ctx.mode) >= 30 },
    4: { name: "世界を旅する人", condition: "50回完了", mode: "both", check: (ctx) => Storage.getAttempts(ctx.mode) >= 50 },
    5: { name: "百戦錬磨", condition: "100回完了", mode: "both", check: (ctx) => Storage.getAttempts(ctx.mode) >= 100 },
    6: { name: "不屈の探究者", condition: "200回完了", mode: "both", check: (ctx) => Storage.getAttempts(ctx.mode) >= 200 },
    7: { name: "伝説の挑戦者", condition: "500回完了", mode: "both", check: (ctx) => Storage.getAttempts(ctx.mode) >= 500 },
    8: {
      name: "ナイスチャレンジ", condition: "10問コースで8問以上正解(過去最高)", mode: "both",
      check: (ctx) => { const c = bestCorrectAtCount(ctx.mode, 10); return c !== null && c >= 8; },
    },
    9: {
      name: "安定の実力者", condition: "20問コースで16問以上正解(過去最高)", mode: "both",
      check: (ctx) => { const c = bestCorrectAtCount(ctx.mode, 20); return c !== null && c >= 16; },
    },
    10: {
      name: "知識の探究者", condition: "30問コースで24問以上正解(過去最高)", mode: "both",
      check: (ctx) => { const c = bestCorrectAtCount(ctx.mode, 30); return c !== null && c >= 24; },
    },
    11: {
      name: "実力派プレイヤー", condition: "50問コースで40問以上正解(過去最高)", mode: "both",
      check: (ctx) => { const c = bestCorrectAtCount(ctx.mode, 50); return c !== null && c >= 40; },
    },
    12: {
      name: "世界の優等生", condition: "100問コースで90問以上正解(過去最高)", mode: "both",
      check: (ctx) => { const c = bestCorrectAtCount(ctx.mode, 100); return c !== null && c >= 90; },
    },
    13: {
      name: "世界の知識人", condition: "198問コースで150問以上正解(過去最高)", mode: "both",
      check: (ctx) => { const c = bestCorrectAtCount(ctx.mode, 198); return c !== null && c >= 150; },
    },
    14: {
      name: "世界の達人", condition: "198問コースで190問以上正解(過去最高)", mode: "both",
      check: (ctx) => { const c = bestCorrectAtCount(ctx.mode, 198); return c !== null && c >= 190; },
    },
    15: { name: "三つ星チャレンジャー", condition: "10・20・30問コースで全問正解", mode: "both", check: (ctx) => hasAllTitles(ctx.mode, [10, 20, 30]) },
    16: { name: "五つ星マスター", condition: "10・20・30・50・100問コースで全問正解", mode: "both", check: (ctx) => hasAllTitles(ctx.mode, [10, 20, 30, 50, 100]) },
    17: { name: "完全制覇", condition: "全6コース(10・20・30・50・100・198問)で全問正解", mode: "both", check: (ctx) => hasAllTitles(ctx.mode, ALL_COURSE_COUNTS) },
    18: {
      name: "バランスの達人", condition: "全6コースの過去最高正答率が各80%以上", mode: "both",
      check: (ctx) => ALL_COURSE_COUNTS.every((count) => { const a = bestAccuracyAtCount(ctx.mode, count); return a !== null && a >= 0.8; }),
    },
    19: {
      name: "安定の世界マスター", condition: "全6コースの過去最高正答率が各90%以上", mode: "both",
      check: (ctx) => ALL_COURSE_COUNTS.every((count) => { const a = bestAccuracyAtCount(ctx.mode, count); return a !== null && a >= 0.9; }),
    },

    // ---- #40〜59: 既存データ中心(共通1個・AND条件。単一の共通状態) ----
    40: { name: "二つの扉を開く者", condition: "国旗・首都それぞれ1回以上完了", mode: "common", check: () => Storage.getAttempts("flag") >= 1 && Storage.getAttempts("capital") >= 1 },
    41: { name: "ダブルビギナー", condition: "国旗・首都10問両方満点", mode: "common", check: () => isModeTitlePerfectEarned(10, "flag") && isModeTitlePerfectEarned(10, "capital") },
    42: { name: "ダブルチャレンジャー", condition: "国旗・首都20問両方満点", mode: "common", check: () => isModeTitlePerfectEarned(20, "flag") && isModeTitlePerfectEarned(20, "capital") },
    43: { name: "ダブルトラベラー", condition: "国旗・首都30問両方満点", mode: "common", check: () => isModeTitlePerfectEarned(30, "flag") && isModeTitlePerfectEarned(30, "capital") },
    44: { name: "ダブルエキスパート", condition: "国旗・首都50問両方満点", mode: "common", check: () => isModeTitlePerfectEarned(50, "flag") && isModeTitlePerfectEarned(50, "capital") },
    45: { name: "ダブルマスター", condition: "国旗・首都100問両方満点", mode: "common", check: () => isModeTitlePerfectEarned(100, "flag") && isModeTitlePerfectEarned(100, "capital") },
    46: { name: "世界知識の王者", condition: "国旗・首都198問両方満点", mode: "common", check: () => isModeTitlePerfectEarned(198, "flag") && isModeTitlePerfectEarned(198, "capital") },
    47: {
      name: "世界を読み解く者", condition: "国旗・首都100問で各90問以上正解(過去最高)", mode: "common",
      check: () => { const f = bestCorrectAtCount("flag", 100); const c = bestCorrectAtCount("capital", 100); return f !== null && f >= 90 && c !== null && c >= 90; },
    },
    48: {
      name: "世界の知識王", condition: "国旗・首都198問で各190問以上正解(過去最高)", mode: "common",
      check: () => { const f = bestCorrectAtCount("flag", 198); const c = bestCorrectAtCount("capital", 198); return f !== null && f >= 190 && c !== null && c >= 190; },
    },
    49: { name: "究極の世界マスター", condition: "国旗・首都の全12コースで満点", mode: "common", check: () => hasAllTitles("flag", ALL_COURSE_COUNTS) && hasAllTitles("capital", ALL_COURSE_COUNTS) },
    51: { name: "知識の番人", condition: "国旗・首都それぞれ50回以上完了", mode: "common", check: () => Storage.getAttempts("flag") >= 50 && Storage.getAttempts("capital") >= 50 },
    52: { name: "表と裏の達人", condition: "国旗198問満点+首都10問満点(別プレイ可)", mode: "common", check: () => isModeTitlePerfectEarned(198, "flag") && isModeTitlePerfectEarned(10, "capital") },
    53: {
      name: "奇跡の一問", condition: "198問で197問正解", mode: "common",
      check: (ctx) => ctx.source === "quiz" && ctx.total === 198 && ctx.correct === 197,
    },
    54: {
      name: "あきらめない挑戦者", condition: "国旗・首都合算の完了回数が100回以上になったそのプレイで満点", mode: "common",
      check: (ctx) => ctx.source === "quiz" && Number.isFinite(ctx.correct) && Number.isFinite(ctx.total) && ctx.correct === ctx.total
        && (Storage.getAttempts("flag") + Storage.getAttempts("capital")) >= 100,
    },
    59: {
      name: "世界の伝説", condition: "国旗・首都の全12称号+国旗・首都それぞれ200回以上完了", mode: "common",
      check: () => hasAllTitles("flag", ALL_COURSE_COUNTS) && hasAllTitles("capital", ALL_COURSE_COUNTS)
        && Storage.getAttempts("flag") >= 200 && Storage.getAttempts("capital") >= 200,
    },

    // ---- #61・62・65・67: 既存データ(そのプレイ自身の結果のみ) ----
    61: {
      name: "ラストワンの魔法", condition: "10問で最初の9問正解・最後の1問のみ不正解", mode: "common",
      check: (ctx) => ctx.source === "quiz" && ctx.total === 10 && Array.isArray(ctx.wrongIds) && ctx.wrongIds.length === 1
        && Array.isArray(ctx.questionIds) && ctx.questionIds.length === 10
        && ctx.questionIds[ctx.questionIds.length - 1] === ctx.wrongIds[0],
    },
    62: {
      name: "虹の架け橋", condition: "1プレイで6地域すべて1問以上正解", mode: "common",
      check: (ctx) => {
        if (!ctx || ctx.source !== "quiz" || !Array.isArray(ctx.correctIds)) return false;
        const covered = new Set();
        ctx.correctIds.forEach((id) => { const r = countryRegionById(id); if (r) covered.add(r); });
        return ALL_QUIZ_REGIONS.every((r) => covered.has(r));
      },
    },
    65: { name: "奇跡の数字", condition: "198問でちょうど100問正解", mode: "common", check: (ctx) => ctx.source === "quiz" && ctx.total === 198 && ctx.correct === 100 },
    67: { name: "世界の反対側", condition: "1プレイで日本・ブラジルを正解", mode: "common", check: pairCheck("jp", "br") },

    // ---- #71〜100: 同一プレイの国ペア判定(既存データのみ、全件国旗クイズ限定)。
    // 当初は#75・86〜89の5件のみ国旗限定(mode:"flag_only")で、残り24件は
    // 国旗・首都共通(mode:"common")だったが、カテゴリー名「国旗トリビア」と
    // 獲得方法を一致させるため、29件全てをmode:"flag_only"+
    // pairCheck(...,{flagOnly:true})に統一した(首都クイズでの正解は対象外。
    // 国旗・首都の正解履歴を合算しない) ----
    71: { name: "太陽と月の出会い", condition: "国旗クイズ1プレイで日本・パラオを正解", mode: "flag_only", check: pairCheck("jp", "pw", { flagOnly: true }) },
    72: { name: "そっくりさん発見！", condition: "国旗クイズ1プレイでルーマニア・チャドを正解", mode: "flag_only", check: pairCheck("ro", "td", { flagOnly: true }) },
    73: { name: "白と赤の双子", condition: "国旗クイズ1プレイでインドネシア・モナコを正解", mode: "flag_only", check: pairCheck("id", "mc", { flagOnly: true }) },
    74: { name: "南十字星のきずな", condition: "国旗クイズ1プレイでオーストラリア・ニュージーランドを正解", mode: "flag_only", check: pairCheck("au", "nz", { flagOnly: true }) },
    75: { name: "型破りな国旗たち", condition: "国旗クイズ1プレイでネパール・バチカン市国を正解", mode: "flag_only", check: pairCheck("np", "va", { flagOnly: true }) },
    76: { name: "島から島へ", condition: "国旗クイズ1プレイでアイスランド・マダガスカルを正解", mode: "flag_only", check: pairCheck("is", "mg", { flagOnly: true }) },
    77: { name: "南北のロングラン", condition: "国旗クイズ1プレイでカナダ・チリを正解", mode: "flag_only", check: pairCheck("ca", "cl", { flagOnly: true }) },
    78: { name: "ピラミッドの謎", condition: "国旗クイズ1プレイでエジプト・メキシコを正解", mode: "flag_only", check: pairCheck("eg", "mx", { flagOnly: true }) },
    79: { name: "火山の国を巡る", condition: "国旗クイズ1プレイで日本・イタリアを正解", mode: "flag_only", check: pairCheck("jp", "it", { flagOnly: true }) },
    80: { name: "海を越えた言葉", condition: "国旗クイズ1プレイでブラジル・ポルトガルを正解", mode: "flag_only", check: pairCheck("br", "pt", { flagOnly: true }) },
    81: { name: "巨人と小人", condition: "国旗クイズ1プレイでロシア・バチカン市国を正解", mode: "flag_only", check: pairCheck("ru", "va", { flagOnly: true }) },
    82: { name: "国の中の国", condition: "国旗クイズ1プレイで南アフリカ・レソトを正解", mode: "flag_only", check: pairCheck("za", "ls", { flagOnly: true }) },
    83: { name: "一つの半島、二つの国", condition: "国旗クイズ1プレイで韓国・北朝鮮を正解", mode: "flag_only", check: pairCheck("kr", "kp", { flagOnly: true }) },
    84: { name: "色が逆さま！", condition: "国旗クイズ1プレイでアイルランド・コートジボワールを正解", mode: "flag_only", check: pairCheck("ie", "ci", { flagOnly: true }) },
    85: { name: "三色旗の秘密", condition: "国旗クイズ1プレイでフランス・オランダを正解", mode: "flag_only", check: pairCheck("fr", "nl", { flagOnly: true }) },
    86: { name: "国旗の中に武器!?", condition: "国旗クイズ1プレイでモザンビーク・グアテマラを正解", mode: "flag_only", check: pairCheck("mz", "gt", { flagOnly: true }) },
    87: { name: "国旗の動物園", condition: "国旗クイズ1プレイでドミニカ国・ウガンダを正解", mode: "flag_only", check: pairCheck("dm", "ug", { flagOnly: true }) },
    88: { name: "国旗の中の地図", condition: "国旗クイズ1プレイでキプロス・コソボを正解", mode: "flag_only", check: pairCheck("cy", "xk", { flagOnly: true }) },
    89: { name: "国旗が語りかける", condition: "国旗クイズ1プレイでサウジアラビア・ブラジルを正解", mode: "flag_only", check: pairCheck("sa", "br", { flagOnly: true }) },
    91: { name: "左側通行の仲間", condition: "国旗クイズ1プレイで日本・イギリスを正解", mode: "flag_only", check: pairCheck("jp", "gb", { flagOnly: true }) },
    92: { name: "独立を守った国々", condition: "国旗クイズ1プレイでエチオピア・リベリアを正解", mode: "flag_only", check: pairCheck("et", "lr", { flagOnly: true }) },
    93: { name: "10億人の世界", condition: "国旗クイズ1プレイで中国・インドを正解", mode: "flag_only", check: pairCheck("cn", "in", { flagOnly: true }) },
    94: { name: "同じ言葉、遠い国", condition: "国旗クイズ1プレイでスペイン・アルゼンチンを正解", mode: "flag_only", check: pairCheck("es", "ar", { flagOnly: true }) },
    95: { name: "海を越えたフランス語", condition: "国旗クイズ1プレイでフランス・カナダを正解", mode: "flag_only", check: pairCheck("fr", "ca", { flagOnly: true }) },
    96: { name: "海まで二つの国", condition: "国旗クイズ1プレイでウズベキスタン・リヒテンシュタインを正解", mode: "flag_only", check: pairCheck("uz", "li", { flagOnly: true }) },
    97: { name: "イタリアの中の国", condition: "国旗クイズ1プレイでイタリア・サンマリノを正解", mode: "flag_only", check: pairCheck("it", "sm", { flagOnly: true }) },
    98: { name: "二つの大陸をまたぐ国", condition: "国旗クイズ1プレイでトルコ・ロシアを正解", mode: "flag_only", check: pairCheck("tr", "ru", { flagOnly: true }) },
    99: { name: "細長い国の秘密", condition: "国旗クイズ1プレイでチリ・ノルウェーを正解", mode: "flag_only", check: pairCheck("cl", "no", { flagOnly: true }) },
    100: { name: "太平洋の島々", condition: "国旗クイズ1プレイでキリバス・フィジーを正解", mode: "flag_only", check: pairCheck("ki", "fj", { flagOnly: true }) },

    // ---- #101〜112: 既存12称号の参照(Stage Aで実装済み。名称・モードのみ補完) ----
    101: { name: "国旗ビギナー", condition: "10問全問正解", mode: "flag" },
    102: { name: "国旗チャレンジャー", condition: "20問全問正解", mode: "flag" },
    103: { name: "国旗トラベラー", condition: "30問全問正解", mode: "flag" },
    104: { name: "国旗エキスパート", condition: "50問全問正解", mode: "flag" },
    105: { name: "国旗マスター", condition: "100問全問正解", mode: "flag" },
    106: { name: "国旗レジェンド", condition: "198問全問正解(WORLD COMPLETE)", mode: "flag" },
    107: { name: "首都ビギナー", condition: "10問全問正解", mode: "capital" },
    108: { name: "首都チャレンジャー", condition: "20問全問正解", mode: "capital" },
    109: { name: "世界都市トラベラー", condition: "30問全問正解", mode: "capital" },
    110: { name: "首都エキスパート", condition: "50問全問正解", mode: "capital" },
    111: { name: "首都マスター", condition: "100問全問正解", mode: "capital" },
    112: { name: "首都レジェンド", condition: "198問全問正解(WORLD CAPITAL COMPLETE)", mode: "capital" },
  };

  // ========================================================
  // Stage D: 残り28項目(#20〜39・58・60・63・64・66・68〜70)の獲得条件
  // (docs/trophy-spec-final.md 2章)。Stage Cで用意した統計
  // (wfq_v1_trophy_stats)・そのプレイ自身のcontext(answerTimings・
  // startedAt等)から判定する。これで107件全てのconfirmed:true化が完了する。
  //
  // 重要な設計方針:
  // - js/app.jsのfinishQuiz()は「判定(evaluateQuizFinish) → 統計記録
  //   (recordQuizStats)」の順で呼ぶため、ここのcheck関数がloadTrophyStats()
  //   を読む時点では、そのプレイ自身の結果はまだ統計に反映されていない
  //   (Stage CのrecordQuizStats()のコメント参照)。したがって「今回の
  //   プレイで初めて条件を満たす」ケース(#21・26・27・58・60)は、
  //   読み込んだ統計の値に、そのプレイ自身の分をcontextから計算して
  //   加算してから閾値判定する(「前回までの統計」+「今回のプレイ分」)。
  // - #66は逆に、統計を一切加算せず「上書き前の直前の値」とそのまま比較する
  //   (推測で前回値を作らず、記録が無い場合は対象外にする)。
  // - #63・68(誤答履歴)は、そのプレイの誤答がまだ統計に入っていない時点で
  //   読むため、過去のプレイの誤答だけを見ることが自然に保証される
  //   (同じプレイ内で同じ国が誤答と正解の両方になることは無いため、
  //   自分自身の誤答と衝突する心配もない)。
  // - 「過去の記録に存在しない情報を推測で補完しない」ため、answerTimingsの
  //   件数がtotalと一致しない(欠損がある)場合は平均・最終1問系の判定を
  //   行わない(null/falseを返す)。
  // ========================================================
  const ALL_COUNTRY_IDS = (() => {
    const list = (typeof COUNTRIES !== "undefined" ? COUNTRIES : []).map((c) => c.id);
    return list;
  })();

  // 地域(region) -> その地域に属する国idの一覧(#30〜39用)。
  // countryRegionById()と同じCOUNTRIESを参照するだけで、データを複製しない
  let regionCountryIdsCache = null;
  function countryIdsInRegion(region) {
    if (!regionCountryIdsCache) {
      regionCountryIdsCache = new Map();
      ALL_COUNTRY_IDS.forEach((id) => {
        const r = countryRegionById(id);
        if (!regionCountryIdsCache.has(r)) regionCountryIdsCache.set(r, []);
        regionCountryIdsCache.get(r).push(id);
      });
    }
    return regionCountryIdsCache.get(region) || [];
  }

  // 世界図鑑トロフィー(No.148〜153、地域制覇)用: 指定地域に属する国
  // (countryIdsInRegion()、COUNTRIESのregionフィールドから動的に算出、
  // 対象数をハードコードしない)を、Storage.getEncyclopediaVisited()が
  // 1件残らず含んでいるかどうか。該当地域が1件も無い("antarctica"等、
  // COUNTRIESに実在しない地域名を渡した場合)は安全側に倒してfalseを返す
  function isEncyclopediaRegionComplete(region) {
    if (typeof Storage === "undefined") return false;
    const ids = countryIdsInRegion(region);
    if (ids.length === 0) return false;
    const visited = Storage.getEncyclopediaVisited();
    return ids.every((id) => visited[id] === true);
  }

  // 指定モードの「生涯正解した国idの集合」に、そのプレイ自身の正解国idを
  // 加えたもの(#30〜38用。recordQuizStats()で保存される前の値に、今回の
  // プレイ分を一時的に合算して判定するためのコピー。保存領域そのものは
  // 変更しない)
  function countryCorrectEverIncludingThisPlay(mode, context) {
    const combined = Object.assign({}, loadTrophyStats().countryCorrectEver[mode]);
    if (Array.isArray(context.correctIds)) {
      context.correctIds.forEach((id) => { if (isKnownCountryId(id)) combined[id] = true; });
    }
    return combined;
  }

  // 指定モードの「国別の生涯正解回数」に、そのプレイ自身の正解を加えたもの(#39用)
  function countryCorrectCountIncludingThisPlay(mode, context) {
    const combined = Object.assign({}, loadTrophyStats().countryCorrectCount[mode]);
    if (Array.isArray(context.correctIds)) {
      context.correctIds.forEach((id) => { if (isKnownCountryId(id)) combined[id] = (combined[id] || 0) + 1; });
    }
    return combined;
  }

  function isRegionMastered(region, correctEverSet) {
    const ids = countryIdsInRegion(region);
    return ids.length > 0 && ids.every((id) => correctEverSet[id] === true);
  }

  function areAllCountriesMastered(correctEverSet) {
    return ALL_QUIZ_REGIONS.every((r) => isRegionMastered(r, correctEverSet));
  }

  // そのプレイの回答時間配列(context.answerTimings)のうち、正解かつ
  // 指定秒数以内だった件数(#20〜21・26・27用)
  function countFastCorrectAnswers(context, thresholdSeconds) {
    if (!Array.isArray(context.answerTimings)) return 0;
    return context.answerTimings.filter((t) => t && t.correct === true && Number.isFinite(t.elapsedSeconds) && t.elapsedSeconds <= thresholdSeconds).length;
  }

  // そのプレイの回答時間配列のうち、正解かつ指定秒数以内だった「連続」の
  // 最長記録(#22・23用。プレイ順に並んでいるanswerTimingsをそのまま辿る)
  function longestFastCorrectStreak(context, thresholdSeconds) {
    if (!Array.isArray(context.answerTimings)) return 0;
    let longest = 0;
    let current = 0;
    context.answerTimings.forEach((t) => {
      if (t && t.correct === true && Number.isFinite(t.elapsedSeconds) && t.elapsedSeconds <= thresholdSeconds) {
        current += 1;
        if (current > longest) longest = current;
      } else {
        current = 0;
      }
    });
    return longest;
  }

  // そのプレイの平均回答時間(#24・25・28・29用)。answerTimingsの件数が
  // total(出題数)と一致しない(何らかの理由で記録が欠けている)場合は、
  // 推測で補完せずnullを返して判定を行わない
  function averageElapsedSeconds(context) {
    if (!Array.isArray(context.answerTimings) || !Number.isFinite(context.total) || context.answerTimings.length !== context.total) return null;
    const valid = context.answerTimings.filter((t) => t && Number.isFinite(t.elapsedSeconds));
    if (valid.length !== context.answerTimings.length) return null;
    const sum = valid.reduce((acc, t) => acc + t.elapsedSeconds, 0);
    return sum / valid.length;
  }

  function isAverageWithin(context, thresholdSeconds) {
    const avg = averageElapsedSeconds(context);
    return avg !== null && avg <= thresholdSeconds;
  }

  // プレイ開始時刻(context.startedAt、ISO文字列)から、現地(ブラウザの
  // ローカルタイムゾーン)の「その日の中での経過秒数」を求める(#64・70用)。
  // Date.toISOString()はUTCだが、同じブラウザ内でnew Date(iso)してから
  // getHours()等を呼ぶと、記録した瞬間と同じローカルタイムゾーンで
  // 解釈されるため、別途タイムゾーン情報を保存しなくても現地時間が復元できる
  function secondsOfDayFromIso(iso) {
    if (typeof iso !== "string") return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  }

  const STAGE_D_DEFINITIONS = {
    // ---- #20〜29: 回答時間(共通1個。#21・26・27のみモード別累計カウンタ) ----
    20: { name: "電光石火", condition: "1問を2秒以内に正解", mode: "common", check: (ctx) => ctx.source === "quiz" && countFastCorrectAnswers(ctx, 2) >= 1 },
    21: {
      name: "ロケット回答", condition: "3秒以内正解を累計10回", mode: "both",
      check: (ctx) => (loadTrophyStats().fastAnswerCounts[ctx.mode].within3s || 0) + countFastCorrectAnswers(ctx, 3) >= 10,
    },
    22: { name: "即答マスター", condition: "4秒以内正解が10問連続", mode: "common", check: (ctx) => ctx.source === "quiz" && longestFastCorrectStreak(ctx, 4) >= 10 },
    23: { name: "疾風の挑戦者", condition: "4秒以内正解が20問連続", mode: "common", check: (ctx) => ctx.source === "quiz" && longestFastCorrectStreak(ctx, 4) >= 20 },
    24: { name: "スピードキング", condition: "10問コース満点・平均4秒以内", mode: "common", check: (ctx) => ctx.source === "quiz" && ctx.total === 10 && ctx.correct === 10 && isAverageWithin(ctx, 4) },
    25: { name: "超速トラベラー", condition: "20問コース満点・平均4秒以内", mode: "common", check: (ctx) => ctx.source === "quiz" && ctx.total === 20 && ctx.correct === 20 && isAverageWithin(ctx, 4) },
    26: {
      name: "瞬間判断の達人", condition: "2秒以内正解を累計50回", mode: "both",
      check: (ctx) => (loadTrophyStats().fastAnswerCounts[ctx.mode].within2s || 0) + countFastCorrectAnswers(ctx, 2) >= 50,
    },
    27: {
      name: "反射神経の鬼", condition: "2秒以内正解を累計100回", mode: "both",
      check: (ctx) => (loadTrophyStats().fastAnswerCounts[ctx.mode].within2s || 0) + countFastCorrectAnswers(ctx, 2) >= 100,
    },
    28: { name: "秒速の王者", condition: "50問コース満点・平均4秒以内", mode: "common", check: (ctx) => ctx.source === "quiz" && ctx.total === 50 && ctx.correct === 50 && isAverageWithin(ctx, 4) },
    29: { name: "光速レジェンド", condition: "100問コース満点・平均4秒以内", mode: "common", check: (ctx) => ctx.source === "quiz" && ctx.total === 100 && ctx.correct === 100 && isAverageWithin(ctx, 4) },

    // ---- #30〜39: 国別生涯正解履歴(デュアル) ----
    30: { name: "アジアマスター", condition: "アジア全対象国を正解(累計)", mode: "both", check: (ctx) => isRegionMastered("asia", countryCorrectEverIncludingThisPlay(ctx.mode, ctx)) },
    31: { name: "ヨーロッパマスター", condition: "ヨーロッパ全対象国を正解(累計)", mode: "both", check: (ctx) => isRegionMastered("europe", countryCorrectEverIncludingThisPlay(ctx.mode, ctx)) },
    32: { name: "アフリカマスター", condition: "アフリカ全対象国を正解(累計)", mode: "both", check: (ctx) => isRegionMastered("africa", countryCorrectEverIncludingThisPlay(ctx.mode, ctx)) },
    33: { name: "北米マスター", condition: "北米全対象国を正解(累計、中米・カリブ含む)", mode: "both", check: (ctx) => isRegionMastered("namerica", countryCorrectEverIncludingThisPlay(ctx.mode, ctx)) },
    34: { name: "南米マスター", condition: "南米全対象国を正解(累計)", mode: "both", check: (ctx) => isRegionMastered("samerica", countryCorrectEverIncludingThisPlay(ctx.mode, ctx)) },
    35: { name: "オセアニアマスター", condition: "オセアニア全対象国を正解(累計)", mode: "both", check: (ctx) => isRegionMastered("oceania", countryCorrectEverIncludingThisPlay(ctx.mode, ctx)) },
    36: { name: "六大地域制覇", condition: "6地域すべて制覇(累計)", mode: "both", check: (ctx) => areAllCountriesMastered(countryCorrectEverIncludingThisPlay(ctx.mode, ctx)) },
    37: {
      name: "地域探検家", condition: "6地域のうち3地域を制覇(累計)", mode: "both",
      check: (ctx) => { const s = countryCorrectEverIncludingThisPlay(ctx.mode, ctx); return ALL_QUIZ_REGIONS.filter((r) => isRegionMastered(r, s)).length >= 3; },
    },
    38: { name: "世界一周達成", condition: "198か国・地域をすべて1回以上正解(累計)", mode: "both", check: (ctx) => areAllCountriesMastered(countryCorrectEverIncludingThisPlay(ctx.mode, ctx)) },
    39: {
      name: "地球の知識王", condition: "198か国・地域をそれぞれ3回以上正解(累計)", mode: "both",
      check: (ctx) => { const counts = countryCorrectCountIncludingThisPlay(ctx.mode, ctx); return ALL_COUNTRY_IDS.every((id) => (counts[id] || 0) >= 3); },
    },

    // ---- #58・60: 新規カウンタ(今回のプレイ分を加算して判定) ----
    58: {
      name: "真の世界王", condition: "国旗198問満点2回以上+首都198問満点2回以上", mode: "common",
      check: (ctx) => {
        const stats = loadTrophyStats();
        const thisFlagPerfect = ctx.source === "quiz" && ctx.mode === "flag" && ctx.total === 198 && ctx.correct === 198;
        const thisCapitalPerfect = ctx.source === "quiz" && ctx.mode === "capital" && ctx.total === 198 && ctx.correct === 198;
        const flagCount = stats.perfectCounts.flag + (thisFlagPerfect ? 1 : 0);
        const capitalCount = stats.perfectCounts.capital + (thisCapitalPerfect ? 1 : 0);
        return flagCount >= 2 && capitalCount >= 2;
      },
    },
    60: {
      name: "完璧じゃなくてもいい", condition: "10問で9問正解を国旗・首都合算で3回達成", mode: "common",
      check: (ctx) => {
        const stats = loadTrophyStats();
        const thisPlayQualifies = ctx.source === "quiz" && ctx.total === 10 && ctx.correct === 9;
        const flagCount = stats.partialStreakCounts.flag + (thisPlayQualifies && ctx.mode === "flag" ? 1 : 0);
        const capitalCount = stats.partialStreakCounts.capital + (thisPlayQualifies && ctx.mode === "capital" ? 1 : 0);
        return (flagCount + capitalCount) >= 3;
      },
    },

    // ---- #63・64・66・68〜70: そのプレイの結果+既存の統計・履歴 ----
    63: {
      name: "運命の再会", condition: "同じモードで過去に誤答した国を後のプレイで正解", mode: "common",
      check: (ctx) => {
        if (ctx.source !== "quiz" || !Array.isArray(ctx.correctIds)) return false;
        const everWrong = loadTrophyStats().countryWrongEver[ctx.mode] || {};
        return ctx.correctIds.some((id) => everWrong[id] === true);
      },
    },
    64: {
      name: "真夜中の探検家", condition: "開始時刻0:00〜2:59・そのプレイで満点", mode: "common",
      check: (ctx) => {
        if (ctx.source !== "quiz" || !Number.isFinite(ctx.total) || ctx.correct !== ctx.total) return false;
        const sec = secondsOfDayFromIso(ctx.startedAt);
        return sec !== null && sec < 3 * 3600;
      },
    },
    66: {
      name: "リベンジ成功！", condition: "同じモード・同じコースの直前の完了プレイより正解数が増加", mode: "common",
      check: (ctx) => {
        if (ctx.source !== "quiz" || !Number.isFinite(ctx.total) || !Number.isFinite(ctx.correct)) return false;
        const prev = loadTrophyStats().lastCourseResult[ctx.mode][String(ctx.total)];
        if (!prev || !Number.isFinite(prev.correct)) return false; // 直前の完了プレイが無ければ対象外(推測で前回値を作らない)
        return ctx.correct > prev.correct;
      },
    },
    68: {
      name: "逆転の天才", condition: "国旗で誤答した国を後の首都クイズで正解(同日不問)", mode: "common",
      check: (ctx) => {
        if (ctx.source !== "quiz" || ctx.mode !== "capital" || !Array.isArray(ctx.correctIds)) return false;
        const flagEverWrong = loadTrophyStats().countryWrongEver.flag || {};
        return ctx.correctIds.some((id) => flagEverWrong[id] === true);
      },
    },
    69: {
      name: "ラストの伝説", condition: "198問満点+最終問を3秒以内に正解", mode: "common",
      check: (ctx) => {
        if (ctx.source !== "quiz" || ctx.total !== 198 || ctx.correct !== 198) return false;
        if (!Array.isArray(ctx.answerTimings) || ctx.answerTimings.length !== 198) return false;
        const last = ctx.answerTimings[ctx.answerTimings.length - 1];
        return !!last && last.correct === true && Number.isFinite(last.elapsedSeconds) && last.elapsedSeconds <= 3;
      },
    },
    70: {
      name: "早朝の探検家", condition: "開始時刻5:00:00以上6:00:00未満", mode: "common",
      check: (ctx) => {
        if (ctx.source !== "quiz") return false;
        const sec = secondsOfDayFromIso(ctx.startedAt);
        return sec !== null && sec >= 5 * 3600 && sec < 6 * 3600;
      },
    },
  };

  // ==========================================================
  // 首都トリビア追加: 新規29件(#113〜141)。
  //
  // 既存のmode:"flag_only"+pairCheck(...,{flagOnly:true})(#71〜100)と
  // 対になる、mode:"capital_only"+pairCheck(...,{capitalOnly:true})として
  // 実装する。判定ロジックはpairCheck()/arePairCorrect()をそのまま再利用し、
  // 新しい判定コードは一切書かない(首都クイズの同一プレイ中に対象2か国を
  // 両方正解した場合のみ獲得。順序不問、国旗クイズ・「世界の国どこかな？」
  // では獲得不可、プレイをまたいだ合算もしない。これらはpairCheck()の
  // 既存ガード節がそのまま満たす)。
  //
  // description/countriesは、トロフィー一覧画面・獲得通知画面で
  // 「対象2か国+首都+正式解説文」を表示するための追加データ(#1〜112には
  // 設定しない。buildTrophyDefinitions()のデフォルト値nullのまま)。
  // ==========================================================
  const STAGE_CAPITAL_TRIVIA_DEFINITIONS = {
    113: {
      name: "選ばれし都", condition: "首都クイズ1プレイでオーストラリア・カナダを正解", mode: "capital_only",
      check: pairCheck("au", "ca", { capitalOnly: true }),
      description: "キャンベラとオタワは、どちらも国の最大都市ではありません。オーストラリアではシドニー、カナダではトロントが最大都市ですが、首都には別の都市が選ばれています。",
      countries: ["au", "ca"],
    },
    114: {
      name: "双都の謎", condition: "首都クイズ1プレイでボリビア・南アフリカを正解", mode: "capital_only",
      check: pairCheck("bo", "za", { capitalOnly: true }),
      description: "ボリビアではスクレが憲法上の首都で、ラパスに政府機関があります。南アフリカではプレトリア、ケープタウン、ブルームフォンテーンに主要な国家機能が分かれています。",
      countries: ["bo", "za"],
    },
    115: {
      name: "国家の名を継ぐ都", condition: "首都クイズ1プレイでシンガポール・ルクセンブルクを正解", mode: "capital_only",
      check: pairCheck("sg", "lu", { capitalOnly: true }),
      description: "シンガポールとルクセンブルクは、国名と首都名が同じです。国の名前をそのまま冠した都市が、政治の中心となっています。",
      countries: ["sg", "lu"],
    },
    116: {
      name: "新天地への遷都", condition: "首都クイズ1プレイでブラジル・ナイジェリアを正解", mode: "capital_only",
      check: pairCheck("br", "ng", { capitalOnly: true }),
      description: "ブラジルはリオデジャネイロからブラジリアへ、ナイジェリアはラゴスからアブジャへ首都を移しました。どちらも新しい首都の建設を進めた国です。",
      countries: ["br", "ng"],
    },
    117: {
      name: "設計された未来都市", condition: "首都クイズ1プレイでオーストラリア・ブラジルを正解", mode: "capital_only",
      check: pairCheck("au", "br", { capitalOnly: true }),
      description: "キャンベラとブラジリアは、首都として計画的に整備された都市です。道路や公共施設の配置にも、都市計画の考え方が反映されています。",
      countries: ["au", "br"],
    },
    118: {
      name: "天空の王座", condition: "首都クイズ1プレイでボリビア・エクアドルを正解", mode: "capital_only",
      check: pairCheck("bo", "ec", { capitalOnly: true }),
      description: "スクレとキトは、どちらもアンデス山脈の高地に位置する首都です。山々に囲まれた標高の高い場所に、国の政治の中心があります。",
      countries: ["bo", "ec"],
    },
    119: {
      name: "国境の守護都市", condition: "首都クイズ1プレイでスロバキア・コンゴ共和国を正解", mode: "capital_only",
      check: pairCheck("sk", "cg", { capitalOnly: true }),
      description: "ブラチスラバはオーストリアやハンガリーとの国境近くにあります。ブラザビルはコンゴ川を挟んで、コンゴ民主共和国の首都キンシャサと向かい合っています。",
      countries: ["sk", "cg"],
    },
    120: {
      name: "古代文明の継承者", condition: "首都クイズ1プレイでギリシャ・エジプトを正解", mode: "capital_only",
      check: pairCheck("gr", "eg", { capitalOnly: true }),
      description: "アテネのあるギリシャと、カイロのあるエジプトには、古代から続く豊かな歴史があります。二つの首都は、それぞれの国の歴史や文化を知るための重要な都市です。",
      countries: ["gr", "eg"],
    },
    121: {
      name: "帝国の記憶", condition: "首都クイズ1プレイでイタリア・トルコを正解", mode: "capital_only",
      check: pairCheck("it", "tr", { capitalOnly: true }),
      description: "ローマは古代ローマ帝国の中心地でした。一方、トルコにはオスマン帝国の歴史があります。現在の首都はアンカラですが、帝国時代の首都とは異なります。",
      countries: ["it", "tr"],
    },
    122: {
      name: "王冠の都", condition: "首都クイズ1プレイでイギリス・スペインを正解", mode: "capital_only",
      check: pairCheck("gb", "es", { capitalOnly: true }),
      description: "ロンドンとマドリードは、どちらも国王を元首とする国の首都です。王室に関わる歴史的な建物や文化が残っています。",
      countries: ["gb", "es"],
    },
    123: {
      name: "革命の炎", condition: "首都クイズ1プレイでフランス・アメリカを正解", mode: "capital_only",
      check: pairCheck("fr", "us", { capitalOnly: true }),
      description: "フランスとアメリカは、18世紀の革命を通じて国家のあり方を大きく変えました。パリとワシントンD.C.は、現在それぞれの国の政治の中心となっています。",
      countries: ["fr", "us"],
    },
    124: {
      name: "東西文明の交差点", condition: "首都クイズ1プレイでトルコ・ギリシャを正解", mode: "capital_only",
      check: pairCheck("tr", "gr", { capitalOnly: true }),
      description: "トルコとギリシャは、エーゲ海を挟んで向かい合う国々です。アンカラとアテネを首都とする両国には、長い歴史の中で文化が交流してきたつながりがあります。",
      countries: ["tr", "gr"],
    },
    125: {
      name: "新時代の首都", condition: "首都クイズ1プレイでパキスタン・ベリーズを正解", mode: "capital_only",
      check: pairCheck("pk", "bz", { capitalOnly: true }),
      description: "イスラマバードとベルモパンは、どちらも20世紀に新しい首都として整備された都市です。それぞれカラチ、ベリーズシティに代わって政治の中心となりました。",
      countries: ["pk", "bz"],
    },
    126: {
      name: "千年の都の系譜", condition: "首都クイズ1プレイで中国・日本を正解", mode: "capital_only",
      check: pairCheck("cn", "jp", { capitalOnly: true }),
      description: "北京と東京は、東アジアを代表する首都です。中国と日本は、長い歴史の中で政治や文化の中心地を築き、現在の首都へとつながっています。",
      countries: ["cn", "jp"],
    },
    127: {
      name: "ドナウの双璧", condition: "首都クイズ1プレイでオーストリア・ハンガリーを正解", mode: "capital_only",
      check: pairCheck("at", "hu", { capitalOnly: true }),
      description: "ウィーンとブダペストは、どちらもドナウ川沿いにある首都です。ヨーロッパを流れる大河が、二つの歴史ある都を結んでいます。",
      countries: ["at", "hu"],
    },
    128: {
      name: "大河の支配者", condition: "首都クイズ1プレイでエジプト・イラクを正解", mode: "capital_only",
      check: pairCheck("eg", "iq", { capitalOnly: true }),
      description: "カイロはナイル川沿い、バグダッドはチグリス川沿いにある首都です。どちらも大きな川と深い関わりを持ちながら発展してきました。",
      countries: ["eg", "iq"],
    },
    129: {
      name: "赤道の番人", condition: "首都クイズ1プレイでエクアドル・ウガンダを正解", mode: "capital_only",
      check: pairCheck("ec", "ug", { capitalOnly: true }),
      description: "キトとカンパラは、どちらも赤道に近い地域にある首都です。南米とアフリカという離れた大陸にありながら、赤道という共通点で結ばれています。",
      countries: ["ec", "ug"],
    },
    130: {
      name: "北極への扉", condition: "首都クイズ1プレイでアイスランド・フィンランドを正解", mode: "capital_only",
      check: pairCheck("is", "fi", { capitalOnly: true }),
      description: "レイキャビクとヘルシンキは、どちらもヨーロッパ北部に位置する首都です。北の地域ならではの長い夏の日照時間や、冬の日の短さが特徴です。",
      countries: ["is", "fi"],
    },
    131: {
      name: "太平洋の秘宝", condition: "首都クイズ1プレイでフィジー・サモアを正解", mode: "capital_only",
      check: pairCheck("fj", "ws", { capitalOnly: true }),
      description: "スバとアピアは、どちらも南太平洋の島国の首都です。海に囲まれた島々で、独自の文化や暮らしが育まれてきました。",
      countries: ["fj", "ws"],
    },
    132: {
      name: "大洋の孤島", condition: "首都クイズ1プレイでモルディブ・セーシェルを正解", mode: "capital_only",
      check: pairCheck("mv", "sc", { capitalOnly: true }),
      description: "マレとビクトリアは、どちらもインド洋の島国にある首都です。美しい海と島々に囲まれた国の政治の中心となっています。",
      countries: ["mv", "sc"],
    },
    133: {
      name: "カリブの覇者", condition: "首都クイズ1プレイでキューバ・ジャマイカを正解", mode: "capital_only",
      check: pairCheck("cu", "jm", { capitalOnly: true }),
      description: "ハバナとキングストンは、どちらもカリブ海地域の島国の首都です。音楽や文化が豊かな地域としても知られています。",
      countries: ["cu", "jm"],
    },
    134: {
      name: "南米の双星", condition: "首都クイズ1プレイでアルゼンチン・ウルグアイを正解", mode: "capital_only",
      check: pairCheck("ar", "uy", { capitalOnly: true }),
      description: "ブエノスアイレスとモンテビデオは、ラプラタ川の広い河口域を挟んで向かい合う首都です。南米の歴史や文化を共有する二つの都市です。",
      countries: ["ar", "uy"],
    },
    135: {
      name: "ゲルマンの双都", condition: "首都クイズ1プレイでドイツ・オーストリアを正解", mode: "capital_only",
      check: pairCheck("de", "at", { capitalOnly: true }),
      description: "ベルリンとウィーンは、どちらもドイツ語を公用語とする国の首都です。言葉だけでなく、音楽や歴史などにも共通する文化が見られます。",
      countries: ["de", "at"],
    },
    136: {
      name: "イベリアの王冠", condition: "首都クイズ1プレイでスペイン・ポルトガルを正解", mode: "capital_only",
      check: pairCheck("es", "pt", { capitalOnly: true }),
      description: "マドリードとリスボンは、イベリア半島にある二つの国の首都です。スペインとポルトガルは隣り合い、長い歴史を持っています。",
      countries: ["es", "pt"],
    },
    137: {
      name: "北欧の双星", condition: "首都クイズ1プレイでノルウェー・スウェーデンを正解", mode: "capital_only",
      check: pairCheck("no", "se", { capitalOnly: true }),
      description: "オスロとストックホルムは、スカンディナビア半島に広がる二つの国の首都です。ノルウェーとスウェーデンは国境を接し、歴史的にも深いつながりがあります。",
      countries: ["no", "se"],
    },
    138: {
      name: "メコンの絆", condition: "首都クイズ1プレイでラオス・カンボジアを正解", mode: "capital_only",
      check: pairCheck("la", "kh", { capitalOnly: true }),
      description: "ビエンチャンとプノンペンは、どちらもメコン川沿いにある首都です。東南アジアを流れる大河が、二つの国の暮らしや文化を支えています。",
      countries: ["la", "kh"],
    },
    139: {
      name: "砂漠の双璧", condition: "首都クイズ1プレイでカタール・バーレーンを正解", mode: "capital_only",
      check: pairCheck("qa", "bh", { capitalOnly: true }),
      description: "ドーハとマナーマは、どちらもペルシャ湾沿岸地域にある首都です。カタールとバーレーンは、アラビア半島周辺に位置する近隣の国々です。",
      countries: ["qa", "bh"],
    },
    140: {
      name: "中央アジアの覇者", condition: "首都クイズ1プレイでカザフスタン・ウズベキスタンを正解", mode: "capital_only",
      check: pairCheck("kz", "uz", { capitalOnly: true }),
      description: "アスタナとタシケントは、どちらも中央アジアにある首都です。カザフスタンとウズベキスタンは隣り合い、シルクロードや地域の歴史と深い関わりがあります。",
      countries: ["kz", "uz"],
    },
    141: {
      name: "世界の果ての双星", condition: "首都クイズ1プレイでニュージーランド・チリを正解", mode: "capital_only",
      check: pairCheck("nz", "cl", { capitalOnly: true }),
      description: "ウェリントンとサンティアゴは、どちらも南半球にある首都です。太平洋を挟んだ遠い地域にありながら、南半球という共通点を持っています。",
      countries: ["nz", "cl"],
    },
  };

  // ==========================================================
  // 特別な隠しトロフィー#142「都の神話」。
  // 首都トリビア(#113〜141)29種類すべてを獲得した時点で自動獲得する、
  // 単一(非デュアル)の特別な隠しトロフィー。複数回のプレイで集めてよく、
  // 国旗トリビア(#71〜100)の獲得状態には左右されない。判定は
  // allCapitalTriviaEarned()(29件のisEarned()を確認するだけの純粋関数)を
  // 呼ぶのみで、新しい保存領域・新しい判定の仕組みは追加しない。
  // evaluate()はTROPHIESをnumber昇順(1→142)でforEachするため、同じ
  // evaluate()呼び出し内で29種類目の首都トリビアがawardIfNew()され
  // 保存された直後に、この#142のcheckが(同じパス内で)その保存結果を
  // 読むことになり、「29種類目を獲得した直後にNo.142も獲得する」という
  // 要求を判定順序だけで満たせる(追加の同期処理は不要)。
  // ==========================================================
  const STAGE_LEGEND_DEFINITIONS = {
    142: {
      name: "都の神話",
      condition: "首都トリビアNo.113〜141の全29種類を獲得",
      mode: "legend",
      check: () => allCapitalTriviaEarned(),
      description:
        "世界の首都を巡り、29の絆を解き明かした者に贈られる究極の証。その知識は国境を越え、世界中の都をつなぐ。今ここに、都の神話が誕生した。",
      countries: null,
    },
  };

  // ==========================================================
  // 世界図鑑トロフィー(第5段階、No.143〜158、計16件)。
  // 対象はCOUNTRIES(198件)のみで、MAP_ONLY_REGIONS(18件、地図専用地域)は
  // 対象外にする。閲覧・地図確認・復習の「事実」はjs/storage.jsの専用キー
  // (wfq_v1_encyclopedia_visited等)に記録済みのものを読むだけで、ここでは
  // 新しい保存領域を一切追加しない(判定条件だけを定義する)。
  // No.143〜147(閲覧数)・No.154〜155(地図連携)・No.156〜157(復習)は
  // 単純な件数しきい値。No.148〜153(地域制覇)はisEncyclopediaRegionComplete()
  // (countryIdsInRegion()を再利用し、対象数をハードコードしない)で判定する。
  // No.158「世界の叡智」は特別な隠しトロフィーで、(1)COUNTRIES 198件全ての
  // 閲覧、(2)No.148〜153の地域制覇トロフィー6件全ての獲得、の両方を
  // 明示的に確認する。COUNTRIESの6地域(asia 48+europe 46+africa 54+
  // namerica 24+samerica 12+oceania 14=198)の合計が198件そのものと
  // 一致するため、198件目を閲覧した瞬間は数学的に必ず6地域とも制覇済みに
  // なるが、要求仕様どおり(1)(2)を両方実際に確認する。evaluate()は
  // TROPHIESをnumber昇順でforEachするため、同じevaluate()呼び出し内で
  // No.148〜153(とNo.147)がNo.158より先に判定・保存され、
  // 「198件目を開いた直後にNo.147とNo.158を同時獲得する」場合も
  // 判定順序だけで正しく処理できる(追加の同期処理は不要)。
  // いずれのcheckもcontext.source==="encyclopedia"の場合のみ判定する
  // (クイズ終了時の既存のevaluate()呼び出しに、図鑑専用の判定を
  // 無理に混ぜない)
  // ==========================================================
  const STAGE_ENCYCLOPEDIA_DEFINITIONS = {
    143: {
      name: "はじめての探検",
      condition: "世界図鑑で国・地域を1件閲覧",
      mode: "encyclopedia",
      check: (ctx) => ctx && ctx.source === "encyclopedia" && Storage.getEncyclopediaVisitedCount() >= 1,
      description: null,
      countries: null,
    },
    144: {
      name: "世界への第一歩",
      condition: "世界図鑑で異なる国・地域を10件閲覧",
      mode: "encyclopedia",
      check: (ctx) => ctx && ctx.source === "encyclopedia" && Storage.getEncyclopediaVisitedCount() >= 10,
      description: null,
      countries: null,
    },
    145: {
      name: "知識の探求者",
      condition: "世界図鑑で異なる国・地域を50件閲覧",
      mode: "encyclopedia",
      check: (ctx) => ctx && ctx.source === "encyclopedia" && Storage.getEncyclopediaVisitedCount() >= 50,
      description: null,
      countries: null,
    },
    146: {
      name: "世界を知る者",
      condition: "世界図鑑で異なる国・地域を100件閲覧",
      mode: "encyclopedia",
      check: (ctx) => ctx && ctx.source === "encyclopedia" && Storage.getEncyclopediaVisitedCount() >= 100,
      description: null,
      countries: null,
    },
    147: {
      name: "世界図鑑マスター",
      condition: "世界図鑑でCOUNTRIES全198件を閲覧",
      mode: "encyclopedia",
      check: (ctx) => ctx && ctx.source === "encyclopedia" && Storage.getEncyclopediaVisitedCount() >= 198,
      description: null,
      countries: null,
    },
    148: {
      name: "アジアの研究者",
      condition: "世界図鑑でアジア地域の国を全て閲覧",
      mode: "encyclopedia",
      check: (ctx) => ctx && ctx.source === "encyclopedia" && isEncyclopediaRegionComplete("asia"),
      description: null,
      countries: null,
    },
    149: {
      name: "ヨーロッパの研究者",
      condition: "世界図鑑でヨーロッパ地域の国を全て閲覧",
      mode: "encyclopedia",
      check: (ctx) => ctx && ctx.source === "encyclopedia" && isEncyclopediaRegionComplete("europe"),
      description: null,
      countries: null,
    },
    150: {
      name: "アフリカの研究者",
      condition: "世界図鑑でアフリカ地域の国を全て閲覧",
      mode: "encyclopedia",
      check: (ctx) => ctx && ctx.source === "encyclopedia" && isEncyclopediaRegionComplete("africa"),
      description: null,
      countries: null,
    },
    151: {
      name: "北米の研究者",
      condition: "世界図鑑で北米地域(中央アメリカ・カリブ海地域を含む)の国を全て閲覧",
      mode: "encyclopedia",
      check: (ctx) => ctx && ctx.source === "encyclopedia" && isEncyclopediaRegionComplete("namerica"),
      description: null,
      countries: null,
    },
    152: {
      name: "南米の研究者",
      condition: "世界図鑑で南米地域の国を全て閲覧",
      mode: "encyclopedia",
      check: (ctx) => ctx && ctx.source === "encyclopedia" && isEncyclopediaRegionComplete("samerica"),
      description: null,
      countries: null,
    },
    153: {
      name: "オセアニアの研究者",
      condition: "世界図鑑でオセアニア地域の国を全て閲覧",
      mode: "encyclopedia",
      check: (ctx) => ctx && ctx.source === "encyclopedia" && isEncyclopediaRegionComplete("oceania"),
      description: null,
      countries: null,
    },
    154: {
      name: "未知への好奇心",
      condition: "世界図鑑の詳細画面から「地図で場所を見る」を初めて利用",
      mode: "encyclopedia",
      check: (ctx) => ctx && ctx.source === "encyclopedia" && Storage.getEncyclopediaMapCheckedCount() >= 1,
      description: null,
      countries: null,
    },
    155: {
      name: "世界をつなぐ旅人",
      condition: "世界図鑑の詳細画面から「地図で場所を見る」で異なる国を50件確認",
      mode: "encyclopedia",
      check: (ctx) => ctx && ctx.source === "encyclopedia" && Storage.getEncyclopediaMapCheckedCount() >= 50,
      description: null,
      countries: null,
    },
    156: {
      name: "知識を力に",
      condition: "復習画面から世界図鑑の詳細を開いて、異なる国を10件復習",
      mode: "encyclopedia",
      check: (ctx) => ctx && ctx.source === "encyclopedia" && Storage.getEncyclopediaReviewedCount() >= 10,
      description: null,
      countries: null,
    },
    157: {
      name: "学び直しの達人",
      condition: "復習画面から世界図鑑の詳細を開いて、異なる国を50件復習",
      mode: "encyclopedia",
      check: (ctx) => ctx && ctx.source === "encyclopedia" && Storage.getEncyclopediaReviewedCount() >= 50,
      description: null,
      countries: null,
    },
    158: {
      name: "世界の叡智",
      condition: "世界図鑑でCOUNTRIES全198件を閲覧し、No.148〜153の地域制覇トロフィーを全て獲得",
      mode: "encyclopedia",
      check: (ctx) => {
        if (!ctx || ctx.source !== "encyclopedia") return false;
        if (Storage.getEncyclopediaVisitedCount() < 198) return false;
        return [148, 149, 150, 151, 152, 153].every((n) => isEarned(`trophy_${n}`));
      },
      description:
        "世界に広がる198の国と地域。そのすべてに目を向け、六つの地域を探究し尽くした者に贈られる究極の証。あなたが開いた一つひとつのページが、世界を知る力となった。今ここに、世界の叡智が輝く。",
      countries: null,
    },
  };

  // ========================================================
  // 「世界の国どこかな？」専用トロフィー36種類(#159〜194)用のヘルパー。
  // いずれも既存の判定・保存処理を複製せず、既存API(Storage/COUNTRIES/
  // MAP_ONLY_REGIONS/countryRegionById/FINDCOUNTRY_PRO_UNLOCK_COURSE_KEYS)
  // を読み取るだけの純粋関数にする
  // ========================================================

  // COUNTRIES(基本198件)だけのid集合。findCountryCollectionValidIds()
  // (js/storage.js、COUNTRIES+MAP_ONLY_REGIONSの216件)とは別に、基本198件の
  // 完全制覇(No.24相当)を判定するためだけに使う
  let findCountryBasicIdsCache = null;
  function findCountryBasicIds() {
    if (!findCountryBasicIdsCache) {
      findCountryBasicIdsCache = new Set((typeof COUNTRIES !== "undefined" ? COUNTRIES : []).map((c) => c.id));
    }
    return findCountryBasicIdsCache;
  }

  // 「世界の国どこかな？」コレクション(Storage.getFindCountryCollection())の
  // 件数。No.22・23(総数)・24(基本198件のみ)・25(216件全て)が、どれも
  // この1つの既存コレクションだけから判定できる(ストレージの拡張は不要。
  // 実装前調査で確認済み: findCountryCollectionValidIds()は元々COUNTRIES+
  // MAP_ONLY_REGIONSの216件を対象にしている)
  function findCountryCollectionCounts() {
    if (typeof Storage === "undefined") return { total: 0, basic: 0 };
    const ids = Object.keys(Storage.getFindCountryCollection());
    const basic = ids.filter((id) => findCountryBasicIds().has(id)).length;
    return { total: ids.length, basic };
  }

  // resultsの配列(questionNumber昇順)を先頭から順に見て、predicateを満たす
  // 連続回数がminCount以上になる箇所が1つでもあればtrueを返す。満たさない
  // 要素が出た時点で連続回数を0に戻す(No.20・21代替・26代替・32・35・193用の
  // 共通ロジック。「216という数字を複数の場所にハードコードしない」の方針と
  // 同様、この連続判定ロジックも1か所にまとめ、重複させない)
  function hasConsecutiveRun(results, minCount, predicate) {
    if (!Array.isArray(results)) return false;
    let streak = 0;
    for (let i = 0; i < results.length; i++) {
      if (predicate(results[i])) {
        streak += 1;
        if (streak >= minCount) return true;
      } else {
        streak = 0;
      }
    }
    return false;
  }

  // 「世界の国どこかな？」の1プレイの結果確定(evaluateFindCountryResult)から
  // 呼ばれたcontextかどうか。即時付与用のevaluateFindCountryAnswer(resultsを
  // 持たない)から呼ばれた場合はfalseになるため、1プレイ単位の判定(連続正解・
  // ノーミス・コレクション以外の大半)が誤ったタイミングで評価されない
  function isFindCountryPlayResult(ctx) {
    return !!ctx && ctx.source === "findcountry" && Array.isArray(ctx.results);
  }

  // No.187「不死鳥の逆転劇」用: 通常30問コースで、第10問までに累計2ミス
  // (ライフを2回失った状態)から、3ミス目を発生させずに最後まで初回正解で
  // クリアしたかどうか。ユーザー提示の推奨判定をそのまま実装する:
  // ①第10問までに2ミスしている ②2ミス目が発生した問題を正解して次へ進む
  // (=results上はその問題の最終結果が"correct"になる。再挑戦はresultsに
  // 中間結果を積まないため、この配列だけで自然に表現できる)
  // ③その次の問題から最後まで、すべて初回正解する ④3ミス目が発生しない
  function phoenixComeback(ctx) {
    if (!isFindCountryPlayResult(ctx)) return false;
    if (ctx.difficultyId === "pro" || !ctx.isNormalClear) return false;
    if (ctx.target !== 30 || ctx.results.length < 30) return false;
    if (!Number.isFinite(ctx.maxLives)) return false;
    const q10 = ctx.results[9];
    if (!q10 || !Number.isFinite(q10.livesAfter)) return false;
    const missesByQ10 = ctx.maxLives - q10.livesAfter;
    if (missesByQ10 !== 2) return false;
    for (let i = 10; i < 30; i++) {
      const r = ctx.results[i];
      if (!r || r.livesAfter < q10.livesAfter) return false; // 3ミス目(以降の追加ミス)が発生した
      if (!r.firstTryCorrect) return false; // 11問目以降は全て初回正解が必要
    }
    return true;
  }

  // No.191「世界一周の奇跡」用: 1プレイ中の初回正解だけを対象に、6地域
  // (ALL_QUIZ_REGIONS、既存の地域分類をそのまま再利用)すべてから1問以上
  // 初回正解しているかどうか。地図専用18地域(COUNTRIESに無いid)は
  // countryRegionByIdがnullを返すため、既存の地域分類の対象外として
  // 自然に無視される
  function findCountryRegionSweepAchieved(results) {
    if (!Array.isArray(results)) return false;
    const covered = new Set();
    results.forEach((r) => {
      if (r.result === "correct" && r.firstTryCorrect) {
        const region = countryRegionById(r.countryId);
        if (region) covered.add(region);
      }
    });
    return ALL_QUIZ_REGIONS.every((r) => covered.has(r));
  }

  // No.159〜194(「世界の国どこかな？」専用36種、2026年追加)。第4段階までの
  // 既存153件(#1〜158)は一切変更しない。rarityは今回新設する表示用
  // フィールド("normal"|"rare"|"super_rare")で、既存トロフィーには設定しない
  // (undefinedのまま)。mode:"findcountry"は第2段階で用意されていた予約値を
  // そのまま使う(common型と同じ単一状態として保存される、モードによる
  // デュアル分岐には入らない)
  const STAGE_FINDCOUNTRY_DEFINITIONS = {
    // ---- #159〜172: 普通トロフィー(14件) ----
    159: {
      name: "地図への第一歩", condition: "「どこかな？」で初めて1問正解する", mode: "findcountry", rarity: "normal",
      check: (ctx) => ctx && ctx.source === "findcountry" && findCountryCollectionCounts().total >= 1,
    },
    160: {
      name: "はじめての発見", condition: "初級5問コースをクリアする", mode: "findcountry", rarity: "normal",
      check: (ctx) => ctx && ctx.source === "findcountry" && Storage.isFindCountryCourseCleared("beginner_5"),
    },
    161: {
      name: "駆け出し探検家", condition: "初級10問コースをクリアする", mode: "findcountry", rarity: "normal",
      check: (ctx) => ctx && ctx.source === "findcountry" && Storage.isFindCountryCourseCleared("beginner_10"),
    },
    162: {
      name: "世界を歩く者", condition: "初級20問コースをクリアする", mode: "findcountry", rarity: "normal",
      check: (ctx) => ctx && ctx.source === "findcountry" && Storage.isFindCountryCourseCleared("beginner_20"),
    },
    163: {
      name: "初級マスター", condition: "初級30問コースをクリアする", mode: "findcountry", rarity: "normal",
      check: (ctx) => ctx && ctx.source === "findcountry" && Storage.isFindCountryCourseCleared("beginner_30"),
    },
    164: {
      name: "世界の探索者", condition: "中級5問コースをクリアする", mode: "findcountry", rarity: "normal",
      check: (ctx) => ctx && ctx.source === "findcountry" && Storage.isFindCountryCourseCleared("intermediate_5"),
    },
    165: {
      name: "国境を越えて", condition: "中級10問コースをクリアする", mode: "findcountry", rarity: "normal",
      check: (ctx) => ctx && ctx.source === "findcountry" && Storage.isFindCountryCourseCleared("intermediate_10"),
    },
    166: {
      name: "地理の冒険者", condition: "中級20問コースをクリアする", mode: "findcountry", rarity: "normal",
      check: (ctx) => ctx && ctx.source === "findcountry" && Storage.isFindCountryCourseCleared("intermediate_20"),
    },
    167: {
      name: "中級マスター", condition: "中級30問コースをクリアする", mode: "findcountry", rarity: "normal",
      check: (ctx) => ctx && ctx.source === "findcountry" && Storage.isFindCountryCourseCleared("intermediate_30"),
    },
    168: {
      name: "地球の挑戦者", condition: "上級5問コースをクリアする", mode: "findcountry", rarity: "normal",
      check: (ctx) => ctx && ctx.source === "findcountry" && Storage.isFindCountryCourseCleared("advanced_5"),
    },
    169: {
      name: "世界の案内人", condition: "上級10問コースをクリアする", mode: "findcountry", rarity: "normal",
      check: (ctx) => ctx && ctx.source === "findcountry" && Storage.isFindCountryCourseCleared("advanced_10"),
    },
    170: {
      name: "地図の達人", condition: "上級20問コースをクリアする", mode: "findcountry", rarity: "normal",
      check: (ctx) => ctx && ctx.source === "findcountry" && Storage.isFindCountryCourseCleared("advanced_20"),
    },
    171: {
      name: "上級マスター", condition: "上級30問コースをクリアする", mode: "findcountry", rarity: "normal",
      check: (ctx) => ctx && ctx.source === "findcountry" && Storage.isFindCountryCourseCleared("advanced_30"),
    },
    172: {
      // 既存コレクションは難易度を区別しないため、No.1と異なり過去実績からは
      // 判定できない(実装前調査で確認済み)。この時点以降のPRO初回正解からの
      // 即時付与のみとなる
      name: "秘境への扉", condition: "PROモードで初めて1問正解する", mode: "findcountry", rarity: "normal",
      check: (ctx) => !!ctx && ctx.source === "findcountry" && ctx.event === "answer"
        && ctx.result === "correct" && ctx.difficultyId === "pro",
    },

    // ---- #173〜184: レアトロフィー(12件) ----
    173: {
      name: "初級完全制覇", condition: "初級の4コース(5・10・20・30問)すべてをクリアする(別プレイ可)", mode: "findcountry", rarity: "rare",
      check: (ctx) => ctx && ctx.source === "findcountry"
        && FINDCOUNTRY_PRO_UNLOCK_COURSE_KEYS.filter((k) => k.indexOf("beginner_") === 0)
          .every((k) => Storage.isFindCountryCourseCleared(k)),
    },
    174: {
      name: "中級完全制覇", condition: "中級の4コース(5・10・20・30問)すべてをクリアする(別プレイ可)", mode: "findcountry", rarity: "rare",
      check: (ctx) => ctx && ctx.source === "findcountry"
        && FINDCOUNTRY_PRO_UNLOCK_COURSE_KEYS.filter((k) => k.indexOf("intermediate_") === 0)
          .every((k) => Storage.isFindCountryCourseCleared(k)),
    },
    175: {
      name: "上級完全制覇", condition: "上級の4コース(5・10・20・30問)すべてをクリアする(別プレイ可)", mode: "findcountry", rarity: "rare",
      check: (ctx) => ctx && ctx.source === "findcountry"
        && FINDCOUNTRY_PRO_UNLOCK_COURSE_KEYS.filter((k) => k.indexOf("advanced_") === 0)
          .every((k) => Storage.isFindCountryCourseCleared(k)),
    },
    176: {
      name: "パーフェクトナビ", condition: "通常モードの20問コースをノーミス(誤答・パス・時間切れ0回)でクリアする", mode: "findcountry", rarity: "rare",
      check: (ctx) => isFindCountryPlayResult(ctx) && ctx.isNormalClear && ctx.target === 20 && ctx.noMistakes,
    },
    177: {
      name: "地図の精密機械", condition: "上級30問コースをノーミス(誤答・パス・時間切れ0回)でクリアする", mode: "findcountry", rarity: "rare",
      check: (ctx) => isFindCountryPlayResult(ctx) && ctx.difficultyId === "advanced" && ctx.target === 30
        && ctx.isNormalClear && ctx.noMistakes,
    },
    178: {
      name: "疾風のナビゲーター", condition: "1プレイで10問連続、それぞれ10秒以内に初回正解する(通常・PRO共通)", mode: "findcountry", rarity: "rare",
      check: (ctx) => isFindCountryPlayResult(ctx)
        && hasConsecutiveRun(ctx.results, 10, (r) => r.result === "correct" && r.firstTryCorrect && r.elapsedSeconds <= 10),
    },
    179: {
      name: "迷わぬ旅人", condition: "1プレイで20問連続初回正解する(通常・PRO共通)", mode: "findcountry", rarity: "rare",
      check: (ctx) => isFindCountryPlayResult(ctx) && Number.isFinite(ctx.maxStreak) && ctx.maxStreak >= 20,
    },
    180: {
      name: "世界を知る者", condition: "「どこかな？」コレクションで異なる50の国・地域を獲得する", mode: "findcountry", rarity: "rare",
      check: (ctx) => ctx && ctx.source === "findcountry" && findCountryCollectionCounts().total >= 50,
    },
    181: {
      name: "地球の半分", condition: "「どこかな？」コレクションで異なる100の国・地域を獲得する", mode: "findcountry", rarity: "rare",
      check: (ctx) => ctx && ctx.source === "findcountry" && findCountryCollectionCounts().total >= 100,
    },
    182: {
      name: "世界の収集家", condition: "「どこかな？」コレクションで基本198の国・地域をすべて獲得する", mode: "findcountry", rarity: "rare",
      check: (ctx) => ctx && ctx.source === "findcountry" && findCountryCollectionCounts().basic >= findCountryBasicIds().size,
    },
    183: {
      name: "秘境コレクター", condition: "「どこかな？」コレクションで基本198+地図専用18地域の全216対象を獲得する", mode: "findcountry", rarity: "rare",
      check: (ctx) => ctx && ctx.source === "findcountry"
        && findCountryCollectionCounts().total >= (typeof MAP_ONLY_REGIONS !== "undefined" ? findCountryBasicIds().size + MAP_ONLY_REGIONS.length : Infinity),
    },
    184: {
      name: "PROへの挑戦", condition: "PROモードで10問連続正解する", mode: "findcountry", rarity: "rare",
      check: (ctx) => isFindCountryPlayResult(ctx) && ctx.difficultyId === "pro" && Number.isFinite(ctx.maxStreak) && ctx.maxStreak >= 10,
    },

    // ---- #185〜194: スーパーレアトロフィー(10件) ----
    185: {
      name: "地球の支配者", condition: "通常12コース(初級/中級/上級×5/10/20/30問)すべてをノーミスでクリアする(別プレイ可)", mode: "findcountry", rarity: "super_rare",
      check: (ctx) => ctx && ctx.source === "findcountry" && Storage.getFindCountryNoMissClearProgress().allCleared,
    },
    186: {
      name: "光速の地理学者", condition: "上級30問コースを全問12秒以内・ノーミスでクリアする", mode: "findcountry", rarity: "super_rare",
      check: (ctx) => isFindCountryPlayResult(ctx) && ctx.difficultyId === "advanced" && ctx.target === 30
        && ctx.isNormalClear && ctx.noMistakes && ctx.results.every((r) => r.elapsedSeconds <= 12),
    },
    187: {
      name: "不死鳥の逆転劇", condition: "通常30問コースで序盤(第10問まで)に累計2ミスした状態から、残りをすべて初回正解してクリアする", mode: "findcountry", rarity: "super_rare",
      check: phoenixComeback,
    },
    188: {
      name: "ラスト1秒の奇跡", condition: "通常モードで残り時間が0秒より大きく1秒未満の瞬間に正解する", mode: "findcountry", rarity: "super_rare",
      check: (ctx) => isFindCountryPlayResult(ctx) && ctx.difficultyId !== "pro"
        && ctx.results.some((r) => r.result === "correct" && r.secondsLeft > 0 && r.secondsLeft < 1),
    },
    189: {
      name: "小さな巨人", condition: "PROモードでモナコ・サンマリノ・リヒテンシュタイン・ナウル・ツバルをすべて正解する(複数プレイ可)", mode: "findcountry", rarity: "super_rare",
      check: (ctx) => ctx && ctx.source === "findcountry" && Storage.getFindCountryProTinyProgress().allCaptured,
    },
    190: {
      // 追加修正: 「プレイ全体でズーム禁止」ではなく「ズーム操作の無い10問連続
      // (初回正解)の区間が1つでも成立すればよい」という確定仕様に対応。
      // 各results要素のzoomUsed(js/findcountry.jsのfinalizeAnswer()が、
      // 問題ごとにMapModule.resetZoomTracking()/wasZoomUsed()で記録)を
      // hasConsecutiveRun()のpredicateに含めるだけで、「ズームした問題で
      // 連続記録が切れ、次の問題から新しく10問を目指せる」という挙動が
      // 既存のhasConsecutiveRun()のリセット動作だけで自然に実現できる
      // (判定ロジックを複製していない)
      name: "迷いなき一撃", condition: "上級モードで、ズーム操作のない10問連続で初回正解する", mode: "findcountry", rarity: "super_rare",
      check: (ctx) => isFindCountryPlayResult(ctx) && ctx.difficultyId === "advanced"
        && hasConsecutiveRun(ctx.results, 10, (r) => r.result === "correct" && r.firstTryCorrect && !r.zoomUsed),
    },
    191: {
      name: "世界一周の奇跡", condition: "1プレイ中にアジア/ヨーロッパ/アフリカ/北米/南米/オセアニアの6地域それぞれから1問以上初回正解する", mode: "findcountry", rarity: "super_rare",
      check: (ctx) => isFindCountryPlayResult(ctx) && findCountryRegionSweepAchieved(ctx.results),
    },
    192: {
      name: "PROの王", condition: "PROモードで30問連続正解する", mode: "findcountry", rarity: "super_rare",
      check: (ctx) => isFindCountryPlayResult(ctx) && ctx.difficultyId === "pro" && Number.isFinite(ctx.maxStreak) && ctx.maxStreak >= 30,
    },
    193: {
      name: "奇跡の16連撃", condition: "PROモードで16問連続、各問8秒以内に正解する", mode: "findcountry", rarity: "super_rare",
      check: (ctx) => isFindCountryPlayResult(ctx) && ctx.difficultyId === "pro"
        && hasConsecutiveRun(ctx.results, 16, (r) => r.result === "correct" && r.elapsedSeconds <= 8),
    },
    194: {
      // 既存のisProCompleteRun()(js/findcountry.js)の判定結果(isProComplete)を
      // そのまま参照するだけで、216という出題対象数をここで再定義・再計算
      // しない(isProCompleteRun自身がDIFFICULTIES[].countを参照して216を
      // 判定しているため、ここでは「PROかつisProComplete」の2条件だけでよい)
      name: "新世界の神", condition: "PROモード全216問を1プレイ中に1ミスもせず全問正解する", mode: "findcountry", rarity: "super_rare",
      check: (ctx) => isFindCountryPlayResult(ctx) && ctx.difficultyId === "pro" && ctx.isProComplete === true,
    },
  };

  // ========================================================
  // 隠しトロフィー61種類(#195〜255、第2段階)用の共通ヘルパー。
  // 既存のhasConsecutiveRun/isFindCountryPlayResult等は一切変更せず、
  // 新たに必要な分だけをここに追加する
  // ========================================================

  // 合計得点が素数かどうか(#201「素数の孤独」用)。totalPointsは
  // computeScore(js/findcountry.js)がMath.round()する整数のみを渡す前提
  function isPrimeNumber(n) {
    if (!Number.isInteger(n) || n < 2) return false;
    if (n % 2 === 0) return n === 2;
    for (let i = 3; i * i <= n; i += 2) {
      if (n % i === 0) return false;
    }
    return true;
  }

  // 「プレイ日」をローカル日付のMMDDを表す数値として返す(#204「奇跡の一致」用)。
  // 例: 1月29日→129、12月31日→1231。toISOString()はUTCになるため使わず、
  // Date#getMonth()/getDate()(呼び出し環境のローカルタイムゾーン)だけを使う
  function localTodayMMDDNumber() {
    const now = new Date();
    return (now.getMonth() + 1) * 100 + now.getDate();
  }

  // resultsの全要素のpointsを合計する(#195〜228の最終得点系用)
  function sumPoints(results) {
    if (!Array.isArray(results)) return 0;
    return results.reduce((sum, r) => sum + (Number(r.points) || 0), 0);
  }

  // 「世界の国どこかな？」の1プレイが、クリア(通常コース/PRO完全制覇)または
  // ゲームオーバーのいずれかで実際に終わっているかどうか(#195〜228の最終
  // 得点系用)。途中中断(showResult自体が呼ばれない)・出題対象を使い切った
  // だけの状態では絶対にtrueにならないため、最終得点系は中断時には判定されない
  function isFindCountryPlayConcluded(ctx) {
    return isFindCountryPlayResult(ctx) && (ctx.isNormalClear === true || ctx.isProComplete === true || ctx.gameOver === true);
  }

  // resultsの中で、length個の連続要素のpointsが厳密に単調増加しており、
  // かつ最後の要素のpointsがfinalMin以上であるような区間が1つでもあれば
  // trueを返す(#239「ボレロ」用)。hasConsecutiveRunとは異なり「直前の
  // 要素との関係」を見るため、別の走査ロジックとして用意する
  function hasStrictlyIncreasingRun(results, length, finalMin) {
    if (!Array.isArray(results) || results.length < length) return false;
    for (let start = 0; start + length <= results.length; start++) {
      let ok = true;
      for (let i = start + 1; i < start + length; i++) {
        if (!(results[i].points > results[i - 1].points)) { ok = false; break; }
      }
      if (ok && results[start + length - 1].points >= finalMin) return true;
    }
    return false;
  }

  // 1プレイ中に正解した国・地域idの集合(#232「WWL」・#250〜255の国の
  // 組み合わせ系用)。表示名からの推測ではなく、results[].countryId
  // (js/countries.js等の既存の正式id)だけを見る
  function correctlyAnsweredCountryIdSet(results) {
    const set = new Set();
    if (Array.isArray(results)) {
      results.forEach((r) => { if (r.result === "correct") set.add(r.countryId); });
    }
    return set;
  }
  function hasAllCountries(results, ids) {
    const set = correctlyAnsweredCountryIdSet(results);
    return ids.every((id) => set.has(id));
  }

  // ctx.lifeAtOneMoment(ライフが1になった問題番号)より後の問題だけを対象に
  // hasConsecutiveRunを適用する(#243「サバイバー」・#247「ミッション・
  // インポッシブル」用)。lifeAtOneMomentが無い(=一度もライフ1にならなかった
  // プレイ。PROはライフ1で開始するため該当しない)場合は常にfalse
  function hasConsecutiveRunAfterLifeOne(ctx, minCount, predicate) {
    if (!ctx || !ctx.lifeAtOneMoment || !Array.isArray(ctx.results)) return false;
    const idx = ctx.results.findIndex((r) => r.questionNumber === ctx.lifeAtOneMoment.questionNumber);
    if (idx === -1) return false;
    return hasConsecutiveRun(ctx.results.slice(idx + 1), minCount, predicate);
  }

  // #241「罪と罰」用: 誤答・パス・時間切れを1プレイ中に各1回以上経験し、
  // ちょうど3種類目の異なるミス種類が発生したタップでライフが0になった
  // (=ゲームオーバーになった)かどうか。mistakeEventsは発生順序どおりの
  // 配列のため、最後の要素の直前までに現れたkindの種類数で判定できる。
  // PROはパス不可・ライフ1(最初のミスで即ゲームオーバー)のため、
  // 3種類のミスを経験する前に必ずプレイが終わる=この条件には到達しない
  // (js/findcountry.jsのisPassAllowed()・DIFFICULTIESの既存仕様どおりの
  // 自然な結果であり、ここで難易度を特別扱いする必要はない)
  function sinAndPunishmentAchieved(ctx) {
    if (!isFindCountryPlayResult(ctx)) return false;
    if (ctx.gameOver !== true || !Array.isArray(ctx.mistakeEvents) || ctx.mistakeEvents.length < 3) return false;
    const last = ctx.mistakeEvents[ctx.mistakeEvents.length - 1];
    if (!last || last.livesAfter !== 0) return false;
    const priorKinds = new Set(ctx.mistakeEvents.slice(0, -1).map((e) => e.kind));
    return priorKinds.size === 2 && !priorKinds.has(last.kind);
  }

  // ========================================================
  // 隠しトロフィー61種類(#195〜255、第2段階)。一覧画面・獲得演出は今回
  // 実装しない(check関数による判定・即時保存までが対象)。プレイ中の通知・
  // ポップアップ・音・画面停止を発生させないため、t.stage==="hidden61"を
  // 持つ(TROPHIES組み立て後に付与)。これによりevaluate()は既定では
  // この61件を一切判定せず、専用の呼び出し経路(evaluateFindCountryHiddenProgress、
  // js/findcountry.jsのfinalizeAnswer()から回答確定ごとに呼ばれる)からのみ
  // 判定される。既存#159〜194(36種類)の判定タイミング・通知経路には
  // 一切影響しない
  const STAGE_HIDDEN61_DEFINITIONS = {
    // ---- #195〜228: 最終得点系(34件)。正式なクリアまたはゲームオーバー
    // 時のみ判定する(途中中断では判定しない、isFindCountryPlayConcluded参照) ----
    195: {
      name: "運命の数字", condition: "合計得点が7777点になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && sumPoints(ctx.results) === 7777,
    },
    196: {
      name: "神のいたずら", condition: "合計得点が12345点になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && sumPoints(ctx.results) === 12345,
    },
    197: {
      name: "悪魔の契約", condition: "合計得点の下3桁が666になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && sumPoints(ctx.results) % 1000 === 666,
    },
    198: {
      name: "天使の祝福", condition: "合計得点の下3桁が777になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && sumPoints(ctx.results) % 1000 === 777,
    },
    199: {
      name: "黄金比の軌跡", condition: "合計得点の下5桁が11618になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && sumPoints(ctx.results) % 100000 === 11618,
    },
    200: {
      name: "円周率の神秘", condition: "合計得点の下5桁が31415になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && sumPoints(ctx.results) % 100000 === 31415,
    },
    201: {
      name: "素数の孤独", condition: "合計得点が素数になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && isPrimeNumber(sumPoints(ctx.results)),
    },
    202: {
      name: "フィボナッチの導き", condition: "合計得点の下5桁が11235になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && sumPoints(ctx.results) % 100000 === 11235,
    },
    203: {
      name: "時を刻む数字", condition: "合計得点の下4桁が2359になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && sumPoints(ctx.results) % 10000 === 2359,
    },
    204: {
      name: "奇跡の一致", condition: "合計得点の下4桁がプレイ日の月日(MMDD)と一致する", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && sumPoints(ctx.results) % 10000 === localTodayMMDDNumber(),
    },
    205: {
      name: "運命", condition: "合計得点の下4桁が1808になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && sumPoints(ctx.results) % 10000 === 1808,
    },
    206: {
      name: "ニンニク入れますか？", condition: "合計得点の下4桁が2291になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && sumPoints(ctx.results) % 10000 === 2291,
    },
    207: {
      name: "マラソンマン", condition: "合計得点の下5桁が42195、または下4桁が4219になる", mode: "findcountry",
      check: (ctx) => {
        if (!isFindCountryPlayConcluded(ctx)) return false;
        const total = sumPoints(ctx.results);
        return total % 100000 === 42195 || total % 10000 === 4219;
      },
    },
    208: {
      name: "ラマヌジャンの奇跡", condition: "合計得点の下4桁が1729になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && sumPoints(ctx.results) % 10000 === 1729,
    },
    209: {
      name: "カプレカ数の魔法", condition: "合計得点の下4桁が6174になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && sumPoints(ctx.results) % 10000 === 6174,
    },
    210: {
      name: "一瞬の永遠", condition: "合計得点の下4桁が8640になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && sumPoints(ctx.results) % 10000 === 8640,
    },
    211: {
      name: "製作者の誕生日", condition: "合計得点の下4桁が0129になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && sumPoints(ctx.results) % 10000 === 129,
    },
    212: {
      name: "ハッピーニューイヤー", condition: "合計得点の下4桁が0101になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && sumPoints(ctx.results) % 10000 === 101,
    },
    213: {
      name: "良いお年を", condition: "合計得点の下4桁が1231になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && sumPoints(ctx.results) % 10000 === 1231,
    },
    214: {
      name: "ファイナルヘブン", condition: "合計得点の下4桁が9999になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && sumPoints(ctx.results) % 10000 === 9999,
    },
    215: {
      name: "May the Force Be With You", condition: "合計得点の下4桁が1977になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && sumPoints(ctx.results) % 10000 === 1977,
    },
    216: {
      name: "E = mc²", condition: "合計得点の下4桁が1905になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && sumPoints(ctx.results) % 10000 === 1905,
    },
    217: {
      name: "404 Not Found", condition: "合計得点の下3桁が404になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && sumPoints(ctx.results) % 1000 === 404,
    },
    218: {
      name: "エベレスト", condition: "合計得点の下4桁が8848になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && sumPoints(ctx.results) % 10000 === 8848,
    },
    219: {
      name: "マウント富士", condition: "合計得点の下4桁が3776になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && sumPoints(ctx.results) % 10000 === 3776,
    },
    220: {
      name: "東京スカイツリー", condition: "合計得点の下3桁が634になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && sumPoints(ctx.results) % 1000 === 634,
    },
    221: {
      name: "東京タワー", condition: "合計得点の下3桁が333になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && sumPoints(ctx.results) % 1000 === 333,
    },
    222: {
      name: "ドラえもん誕生", condition: "合計得点の下4桁が2112になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && sumPoints(ctx.results) % 10000 === 2112,
    },
    223: {
      name: "ポケモンマスター", condition: "合計得点の下3桁が151になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && sumPoints(ctx.results) % 1000 === 151,
    },
    224: {
      name: "令和元年", condition: "合計得点の下4桁が2019になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && sumPoints(ctx.results) % 10000 === 2019,
    },
    225: {
      name: "煩悩の数", condition: "合計得点の下3桁が108になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && sumPoints(ctx.results) % 1000 === 108,
    },
    226: {
      name: "真ポケモンマスター", condition: "合計得点の下4桁が1025になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && sumPoints(ctx.results) % 10000 === 1025,
    },
    227: {
      name: "アラビアンナイト", condition: "合計得点の下4桁が1001になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && sumPoints(ctx.results) % 10000 === 1001,
    },
    228: {
      name: "拍手喝采", condition: "合計得点の下4桁が8888になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayConcluded(ctx) && sumPoints(ctx.results) % 10000 === 8888,
    },

    // ---- #229〜249: プレイ中の正解・時間・連続記録系(21件) ----
    229: {
      name: "エンペラータイム", condition: "1プレイ中に3問連続で1,000点を獲得する", mode: "findcountry",
      check: (ctx) => isFindCountryPlayResult(ctx) && hasConsecutiveRun(ctx.results, 3, (r) => r.points === 1000),
    },
    230: {
      name: "閃光のように", condition: "残り時間が0秒より大きく0.5秒以下で正解する", mode: "findcountry",
      check: (ctx) => isFindCountryPlayResult(ctx)
        && ctx.results.some((r) => r.result === "correct" && r.secondsLeft > 0 && r.secondsLeft <= 0.5),
    },
    231: {
      name: "最速最強", condition: "5問連続、各問初回正解かつ5秒以内に正解する", mode: "findcountry",
      check: (ctx) => isFindCountryPlayResult(ctx)
        && hasConsecutiveRun(ctx.results, 5, (r) => r.result === "correct" && r.firstTryCorrect && r.elapsedSeconds <= 5),
    },
    232: {
      name: "WWL（ワールド・ワイド・ラブ）", condition: "1プレイ中にノーミスで異なる20の国・地域を正解する", mode: "findcountry",
      check: (ctx) => isFindCountryPlayResult(ctx) && ctx.noMistakes === true
        && correctlyAnsweredCountryIdSet(ctx.results).size >= 20,
    },
    233: {
      name: "そして伝説へ…", condition: "通常30問コースを全30問ノーミスで正解してクリアする", mode: "findcountry",
      check: (ctx) => isFindCountryPlayResult(ctx) && ctx.difficultyId !== "pro" && ctx.target === 30
        && ctx.isNormalClear === true && ctx.noMistakes === true,
    },
    234: {
      name: "遥かなる時の彼方へ", condition: "PROモードで100問連続正解する", mode: "findcountry",
      check: (ctx) => isFindCountryPlayResult(ctx) && ctx.difficultyId === "pro" && Number.isFinite(ctx.maxStreak) && ctx.maxStreak >= 100,
    },
    235: {
      name: "やきとり", condition: "1問も正解しないままライフが0になりゲームオーバーになる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayResult(ctx) && ctx.gameOver === true && ctx.correctCount === 0,
    },
    236: {
      name: "ハットトリック", condition: "1プレイ中に3問連続で900〜999点を獲得する", mode: "findcountry",
      check: (ctx) => isFindCountryPlayResult(ctx) && hasConsecutiveRun(ctx.results, 3, (r) => r.points >= 900 && r.points <= 999),
    },
    237: {
      name: "ロスタイムの奇跡", condition: "1プレイで残り2秒以下での正解を3回経験する", mode: "findcountry",
      check: (ctx) => isFindCountryPlayResult(ctx)
        && ctx.results.filter((r) => r.result === "correct" && r.secondsLeft <= 2).length >= 3,
    },
    238: {
      name: "サイクルヒット", condition: "1プレイで1,000点台・900点台・800点台・700点台をそれぞれ1回以上獲得する(1,000点台は1,000点を指す)", mode: "findcountry",
      check: (ctx) => isFindCountryPlayResult(ctx)
        && ctx.results.some((r) => r.points === 1000)
        && ctx.results.some((r) => r.points >= 900 && r.points <= 999)
        && ctx.results.some((r) => r.points >= 800 && r.points <= 899)
        && ctx.results.some((r) => r.points >= 700 && r.points <= 799),
    },
    239: {
      name: "ボレロ", condition: "5問連続で得点が厳密に上昇し、5問目が940点以上になる", mode: "findcountry",
      check: (ctx) => isFindCountryPlayResult(ctx) && hasStrictlyIncreasingRun(ctx.results, 5, 940),
    },
    240: {
      name: "ロット乱し", condition: "5問連続、各問残り3秒以下で正解する", mode: "findcountry",
      check: (ctx) => isFindCountryPlayResult(ctx)
        && hasConsecutiveRun(ctx.results, 5, (r) => r.result === "correct" && r.secondsLeft <= 3),
    },
    241: {
      name: "罪と罰", condition: "1プレイで誤答・パス・時間切れをそれぞれ1回以上経験し、3種類目のミスでライフが0になりゲームオーバーになる", mode: "findcountry",
      check: sinAndPunishmentAchieved,
    },
    242: {
      name: "ギルティ", condition: "4問連続で、各問の初回回答が誤答になる(再挑戦後の正解は許容する)", mode: "findcountry",
      check: (ctx) => isFindCountryPlayResult(ctx) && hasConsecutiveRun(ctx.results, 4, (r) => r.wrongAttempts >= 1),
    },
    243: {
      name: "サバイバー", condition: "ライフが1になった後、5問連続で初回正解する", mode: "findcountry",
      check: (ctx) => isFindCountryPlayResult(ctx)
        && hasConsecutiveRunAfterLifeOne(ctx, 5, (r) => r.result === "correct" && r.firstTryCorrect),
    },
    244: {
      name: "神々のトライフォース", condition: "初級・中級・上級の各30問コースをすべてノーミスでクリアする(別プレイ可)", mode: "findcountry",
      check: (ctx) => ctx && ctx.source === "findcountry"
        && Storage.isFindCountryCourseNoMissCleared("beginner_30")
        && Storage.isFindCountryCourseNoMissCleared("intermediate_30")
        && Storage.isFindCountryCourseNoMissCleared("advanced_30"),
    },
    245: {
      name: "ナイツオブラウンド", condition: "13問連続、各問初回正解かつ8秒以内に正解する", mode: "findcountry",
      check: (ctx) => isFindCountryPlayResult(ctx)
        && hasConsecutiveRun(ctx.results, 13, (r) => r.result === "correct" && r.firstTryCorrect && r.elapsedSeconds <= 8),
    },
    246: {
      name: "光と闇", condition: "1プレイ中に1,000点と、200点未満の正解をそれぞれ1回以上獲得する", mode: "findcountry",
      check: (ctx) => isFindCountryPlayResult(ctx)
        && ctx.results.some((r) => r.points === 1000)
        && ctx.results.some((r) => r.result === "correct" && r.points < 200),
    },
    247: {
      name: "ミッション・インポッシブル", condition: "ライフが1になった後、10問連続で初回正解する", mode: "findcountry",
      check: (ctx) => isFindCountryPlayResult(ctx)
        && hasConsecutiveRunAfterLifeOne(ctx, 10, (r) => r.result === "correct" && r.firstTryCorrect),
    },
    248: {
      name: "伝説の始まり", condition: "PROモードで50問連続正解する", mode: "findcountry",
      check: (ctx) => isFindCountryPlayResult(ctx) && ctx.difficultyId === "pro" && Number.isFinite(ctx.maxStreak) && ctx.maxStreak >= 50,
    },
    249: {
      name: "チート疑惑", condition: "コースをノーミスでクリアし、全問1,000点を獲得する(PRO完全クリアも対象)", mode: "findcountry",
      check: (ctx) => isFindCountryPlayResult(ctx) && ctx.perfectClear === true,
    },

    // ---- #250〜255: 国の組み合わせ系(6件)。順序は問わず、途中のミスも
    // 許容する(正解した国・地域idの集合だけを見る) ----
    250: {
      name: "グランドスラム", condition: "1プレイ中にオーストラリア・フランス・イギリス・アメリカをすべて正解する", mode: "findcountry",
      check: (ctx) => isFindCountryPlayResult(ctx) && hasAllCountries(ctx.results, ["au", "fr", "gb", "us"]),
    },
    251: {
      name: "大航海時代", condition: "1プレイ中にポルトガル・スペイン・オランダ・イギリスをすべて正解する", mode: "findcountry",
      check: (ctx) => isFindCountryPlayResult(ctx) && hasAllCountries(ctx.results, ["pt", "es", "nl", "gb"]),
    },
    252: {
      name: "冷戦の記憶", condition: "1プレイ中にアメリカ・ロシアをすべて正解する", mode: "findcountry",
      check: (ctx) => isFindCountryPlayResult(ctx) && hasAllCountries(ctx.results, ["us", "ru"]),
    },
    253: {
      name: "東西文明の交差点", condition: "1プレイ中にトルコ・ギリシャ・イラン・エジプトをすべて正解する", mode: "findcountry",
      check: (ctx) => isFindCountryPlayResult(ctx) && hasAllCountries(ctx.results, ["tr", "gr", "ir", "eg"]),
    },
    254: {
      name: "太陽の沈まぬ帝国", condition: "1プレイ中にスペイン・メキシコ・ペルー・フィリピンをすべて正解する", mode: "findcountry",
      check: (ctx) => isFindCountryPlayResult(ctx) && hasAllCountries(ctx.results, ["es", "mx", "pe", "ph"]),
    },
    255: {
      name: "古代文明の目覚め", condition: "1プレイ中にエジプト・イラク・インド・中国をすべて正解する", mode: "findcountry",
      check: (ctx) => isFindCountryPlayResult(ctx) && hasAllCountries(ctx.results, ["eg", "iq", "in", "cn"]),
    },
  };

  // ========================================================
  // 謎解きトロフィー(第3段階、#256〜)。js/puzzle-questions.jsの
  // PUZZLE_QUESTIONSから、問題が何件あっても自動的にトロフィー定義を
  // 組み立てる。既存のSTAGE_X_DEFINITIONSと同じ(番号→定義)の辞書形式で
  // 作るため、下のapplyStageBDefinitions()をそのまま再利用できる(この
  // バッチ専用のコードを増やさない)。
  //
  // 【PR #81追加修正】番号は各問題のq.trophyNumber(問題データ側に明示的に
  // 固定した恒久的な番号)をそのまま辞書のキーにする。配列のindexからは
  // 計算しない(上のPUZZLE_TROPHY_NUMBERSのコメント参照)。
  //
  // name: 正式名称(未獲得時は一覧・獲得演出のどちらでも「？？？？？」に
  //   伏せる。表示側(js/app.js)の責務)
  // condition: 問題文(PUZZLE_QUESTIONS[].questionText)。既存の隠し
  //   トロフィー(def.hidden)とは異なり、未獲得でも常に表示してよい内容
  //   のため、hiddenはtrueにしない(buildTrophyDefinitions()の既定値
  //   falseのまま)
  // description: 獲得後の解説文(PUZZLE_QUESTIONS[].explanationText)
  // descriptionNote: 獲得後の出典・注釈(PUZZLE_QUESTIONS[].explanationNote、
  //   省略可)。指定が無い問題はnullのまま(表示側(js/app.js)で何も描画しない)
  // puzzleQuestionId: 「この謎に挑む」ボタンがPuzzleModule.open()に渡す
  //   問題id。一覧カードの描画(js/app.js)が参照する
  // check: 挑戦中の問題(ctx.questionId)がこの問題と完全一致し、かつ
  //   正解だった場合だけtrueを返す。他の問題の正解条件と混ざることは
  //   構造上発生しない(js/puzzle-judge.jsの判定自体もquestionIdごとに
  //   独立しているため、ここでの追加チェックは二重の安全策)
  // ========================================================
  const STAGE_PUZZLE_DEFINITIONS = PUZZLE_QUESTION_LIST.reduce((defs, q) => {
    const number = q.trophyNumber;
    defs[number] = {
      name: q.title,
      condition: q.questionText,
      mode: "puzzle",
      description: typeof q.explanationText === "string" ? q.explanationText : null,
      descriptionNote: typeof q.explanationNote === "string" ? q.explanationNote : null,
      puzzleQuestionId: q.id,
      check: (ctx) => !!ctx && ctx.source === "puzzle" && ctx.questionId === q.id && ctx.correct === true,
    };
    return defs;
  }, {});

  // ========================================================
  // 世界7不思議(#386〜392、7問)。js/puzzle.jsのhandleSubmit()が、謎解きと
  // 区別するために ctx.source === "sevenWonder"(通常謎解きは"puzzle") で
  // 呼び分けるため、checkがそれを要求する。これにより、通常謎解きの正解
  // 判定(evaluatePuzzleAnswer)がこの7問を誤って獲得させることは構造上
  // 発生しない(逆方向も同様)。
  // mode: "sevenWonder"(既存のどのmode文字列とも重複しない専用の値)
  // puzzleQuestionId: SEVEN_WONDERS_QUESTIONS[].id(js/app.jsの専用カードが
  // SEVEN_WONDERS_QUESTIONS_BY_IDから問題文を参照する)
  // ========================================================
  const STAGE_SEVEN_WONDERS_DEFINITIONS = SEVEN_WONDERS_QUESTION_LIST.reduce((defs, q) => {
    const number = q.trophyNumber;
    defs[number] = {
      name: q.title,
      condition: q.questionText,
      mode: "sevenWonder",
      description: typeof q.explanationText === "string" ? q.explanationText : null,
      puzzleQuestionId: q.id,
      check: (ctx) => !!ctx && ctx.source === "sevenWonder" && ctx.questionId === q.id && ctx.correct === true,
    };
    return defs;
  }, {});

  // 通常謎解き126問(PUZZLE_TROPHY_NUMBERS、世界7不思議自身は含まない)を
  // すべて獲得しているか。この関数自身は世界7不思議・隠し特別トロフィー2種を
  // 一切参照しないため、循環参照・無限ループは構造上発生しない
  function isAllNormalPuzzlesEarned() {
    if (!PUZZLE_TROPHY_NUMBERS.length) return false;
    return PUZZLE_TROPHY_NUMBERS.every((n) => isEarned(`trophy_${n}`));
  }
  // 世界7不思議7問(SEVEN_WONDERS_TROPHY_NUMBERS、全知全能の神#394自身は
  // 含まない)をすべて獲得しているか。解いた順序は問わない
  function isAllSevenWondersEarned() {
    if (!SEVEN_WONDERS_TROPHY_NUMBERS.length) return false;
    return SEVEN_WONDERS_TROPHY_NUMBERS.every((n) => isEarned(`trophy_${n}`));
  }

  // ========================================================
  // 世界7不思議 隠し特別トロフィー2種(#393「ミステリーハンター」・
  // #394「全知全能の神」)。どちらもstageを一切指定しない(既定のnull)ため、
  // evaluate()が呼ばれるたびに(クイズ終了・謎解き正解・世界図鑑閲覧・
  // 世界7不思議の回答確定など、どの呼び出し経路からでも)自動的に判定される。
  // これにより、
  //   - 通常謎解きの126問目をちょうど正解した瞬間に#393が即座に獲得される
  //     (js/puzzle.jsのawardTrophyIfNew()が、この回のawardedIdsの中から
  //     #393のidも見つけて解放演出につなげる)。
  //   - 本更新より前からすでに126問全問を獲得済みだった利用者も、次回
  //     起動時にTrophyModule.evaluateSevenWondersCatchUp()(新規、
  //     app.js起動処理から1回だけ呼ぶ)経由で静かに解放される。
  // のどちらも、追加の専用コードを増やさずに同じcheck関数1つで両立できる。
  // #393自身・世界7不思議7問・#394は、isAllNormalPuzzlesEarned()の対象
  // (PUZZLE_TROPHY_NUMBERS)に含まれないため、循環参照は発生しない
  // ========================================================
  // js/seven-wonders-questions.jsが読み込まれていない(SEVEN_WONDERS_QUESTION_LIST
  // が空)場合は、この2件自体を定義しない。MAX_TROPHY_NUMBERも#393・#394を
  // 含まなくなるため、TROPHIESにそもそもこの2件のスロットが作られない
  // (既存のPUZZLE_QUESTIONSが空の場合と同じ、完全な後方互換)
  const STAGE_SEVEN_WONDERS_SPECIAL_DEFINITIONS = SEVEN_WONDERS_QUESTION_LIST.length ? {
    [MYSTERY_HUNTER_NUMBER]: {
      name: "ミステリーハンター",
      condition: "世界7不思議を除く、謎解きトロフィーをすべて獲得",
      mode: "sevenWonder",
      check: () => isAllNormalPuzzlesEarned(),
      description:
        "数え切れぬ謎を解き明かし、ついに最後の欠片を手にした者。その先には、まだ誰も踏み込んだことのない七つの封印が待っている。",
    },
    [OMNISCIENT_GOD_NUMBER]: {
      name: "全知全能の神",
      condition: "世界7不思議を全7問獲得",
      mode: "sevenWonder",
      check: () => isAllSevenWondersEarned(),
      description:
        "暗号機、古地図、歴史の年表、歌と星、密書、そして旗。世界に散らばる七つの不思議をすべて解き明かした者だけが到達する、知の頂。",
    },
  } : {};

  // ========================================================
  // 世界図鑑トロフィー追加分(No.259〜262、計4件)。既存の世界図鑑トロフィー
  // 16種類(No.143〜158)と合わせて合計20種類になる。既存16種類の名称・
  // 番号・獲得条件は一切変更しない。
  //
  // 259「未知なる領域の探究者」: 地図専用18地域(MAP_ONLY_REGIONS)の
  //   図鑑詳細をすべて閲覧。js/storage.jsの新規キー(COUNTRIES専用の
  //   既存閲覧記録とは別、MAP_ONLY_REGIONS専用)を読むだけ。
  // 260「世界を結ぶ地図師」: 図鑑→地図連携(既存のNo.154・155と同じ
  //   Storage.getEncyclopediaMapCheckedCount())で異なる30件を確認。
  //   既存のNo.154(1件)・No.155(50件)としきい値が違うだけで、記録自体は
  //   完全に共有する(新しい保存領域を追加しない)。
  // 261「知識の道しるべ」: 図鑑の検索結果から異なる30件の詳細画面を開く。
  //   js/encyclopedia.jsのopenDetail()が検索語の有無を見て記録する新規
  //   データ(COUNTRIES+MAP_ONLY_REGIONS、216件対象)を参照する。
  // 262「世界の大賢者」: 自分自身を除く世界図鑑トロフィー19種類
  //   (No.143〜158+259〜261)をすべて獲得。#142「都の神話」・#158
  //   「世界の叡智」と同じく、対象番号を明示的に列挙するだけの純粋関数で
  //   判定し、自分自身(262)は対象に含めない(循環参照を避ける)。
  // ========================================================
  const ENCYCLOPEDIA_EXISTING_16_NUMBERS = Array.from({ length: 16 }, (_, i) => 143 + i); // #143〜158
  const ENCYCLOPEDIA_19_NUMBERS = ENCYCLOPEDIA_EXISTING_16_NUMBERS.concat([259, 260, 261]); // #262自身は含めない
  function allEncyclopedia19Earned() {
    return ENCYCLOPEDIA_19_NUMBERS.every((n) => isEarned(`trophy_${n}`));
  }
  const STAGE_ENCYCLOPEDIA4_DEFINITIONS = {
    259: {
      name: "未知なる領域の探究者",
      condition: "世界図鑑で地図専用18地域をすべて閲覧",
      mode: "encyclopedia",
      check: (ctx) => ctx && ctx.source === "encyclopedia" && Storage.getEncyclopediaRegionVisitedCount() >= 18,
      description: "世界には、国旗クイズに登場しない地域もある。知られざる18の地域を巡り、世界の奥深さを知った探究者。",
      countries: null,
    },
    260: {
      name: "世界を結ぶ地図師",
      condition: "世界図鑑の詳細画面から「地図で場所を見る」で異なる国・地域を30件確認",
      mode: "encyclopedia",
      check: (ctx) => ctx && ctx.source === "encyclopedia" && Storage.getEncyclopediaMapCheckedCount() >= 30,
      description: "国の知識と地理を結びつけ、30の国と地域の位置を確かめた地図の達人。",
      countries: null,
    },
    261: {
      name: "知識の道しるべ",
      condition: "世界図鑑の検索結果から異なる国・地域を30件、詳細画面で開く",
      mode: "encyclopedia",
      check: (ctx) => ctx && ctx.source === "encyclopedia" && Storage.getEncyclopediaSearchOpenedCount() >= 30,
      description: "知りたい国を自ら探し、30の国と地域の知識にたどり着いた。好奇心こそが、世界を知る道しるべ。",
      countries: null,
    },
    262: {
      name: "世界の大賢者",
      condition: "世界図鑑トロフィー19種類(No.143〜158・259〜261)をすべて獲得",
      mode: "encyclopedia",
      check: (ctx) => ctx && ctx.source === "encyclopedia" && allEncyclopedia19Earned(),
      description: "世界を知り、地理を学び、あらゆる探究を成し遂げた者。その知識と好奇心は、世界の叡智を極めた証である。",
      countries: null,
    },
  };

  // ========================================================
  // Stage E: トロフィー一覧画面(新規)向けのカテゴリ分類。
  // docs/trophy-spec-final.md 2章の照合テーブルが採用している番号区分
  // (#1〜19・20〜29・30〜39・40〜59・60〜70・71〜100・101〜112)をそのまま
  // カテゴリ境界として使う(名称・獲得条件・check関数は一切変更しない。
  // 表示用の分類ラベルを追加するだけ)。#142「都の神話」は首都トリビアの
  // 完全制覇という「特別チャレンジ」寄りのメタ達成のため、既存の
  // category境界(#60〜70)を変更せず、番号142だけを明示的にspecialへ
  // 振り分ける例外を追加した(#113〜141のcapital_trivia範囲や他の境界には
  // 一切影響しない)。
  // ========================================================
  const TROPHY_CATEGORIES = [
    { id: "progress", label: "挑戦の記録", range: "#1〜19" },
    { id: "speed", label: "スピードチャレンジ", range: "#20〜29" },
    { id: "region", label: "地域制覇", range: "#30〜39" },
    { id: "double", label: "国旗・首都制覇", range: "#40〜59" },
    { id: "special", label: "特別チャレンジ", range: "#60〜70,142,158" },
    { id: "trivia", label: "国旗トリビア", range: "#71〜100" },
    { id: "legacy", label: "称号コレクション", range: "#101〜112" },
    { id: "capital_trivia", label: "首都トリビア", range: "#113〜141" },
    { id: "encyclopedia", label: "世界図鑑", range: "#143〜157" },
    { id: "findcountry", label: "世界の国どこかな？", range: "#159〜194" },
    { id: "findcountry_hidden", label: "世界の国どこかな？ 隠しトロフィー", range: "#195〜255" },
    // 謎解きトロフィー(第3段階)。件数がPUZZLE_QUESTIONSの増減に応じて
    // 変わるため、range表記は固定の終端を書かない。【トロフィーカテゴリー
    // 修正】#393「ミステリーハンター」もこのカテゴリーに含まれる(番号順の
    // 範囲表記とは一致しないが、#256〜の開区間表記に含まれるものとして扱う)
    { id: "puzzle", label: "謎解きトロフィー", range: "#256〜(#393含む)" },
    // 世界7不思議(7問+隠し特別1種(#394)、#386〜392,394。【トロフィー
    // カテゴリー修正】#393「ミステリーハンター」は表示用カテゴリーを
    // 謎解きトロフィーへ移動したため、ここには含まれない)
    { id: "sevenWonders", label: "世界7不思議", range: "#386〜392,394" },
    // 共通トロフィー31種類(#395〜425)。すべて通常の公開トロフィーで、
    // 未獲得状態でも名称・獲得条件を表示する(hidden:falseのまま)
    { id: "common", label: "共通トロフィー", range: "#395〜425" },
  ];
  // #142「都の神話」・#158「世界の叡智」は、既存の番号区分(#60〜70の
  // 特別チャレンジ、#143〜157の世界図鑑)とは別に、両方とも「特別チャレンジ」
  // カテゴリへ明示的に振り分ける例外として扱う(#113〜141の首都トリビア・
  // #143〜157の世界図鑑カテゴリ本体には一切影響しない)
  function categoryForNumber(number) {
    if (number <= 19) return "progress";
    if (number <= 29) return "speed";
    if (number <= 39) return "region";
    if (number <= 59) return "double";
    if (number <= 70) return "special";
    if (number <= 100) return "trivia";
    if (number <= 112) return "legacy";
    if (number <= 141) return "capital_trivia";
    if (number === 142) return "special"; // #142「都の神話」のみ例外的にspecialへ
    if (number <= 157) return "encyclopedia";
    if (number === 158) return "special"; // #158「世界の叡智」のみ例外的にspecialへ
    if (number <= 194) return "findcountry"; // #159〜194
    if (number <= 255) return "findcountry_hidden"; // #195〜255(隠しトロフィー61種類、第2段階)
    // 世界図鑑トロフィー追加分(#259〜262)は、謎解きトロフィー(#256〜)の
    // 番号範囲と入り交じる位置にあるため、単純なしきい値ではなく
    // ENCYCLOPEDIA4_NUMBERSへの実在チェックで判定する(将来、謎解き
    // トロフィーの番号がこの範囲まで増えても誤判定しない)
    if (ENCYCLOPEDIA4_NUMBERS.includes(number)) return "encyclopedia";
    // 【トロフィーカテゴリー修正】#393「ミステリーハンター」のみ、一覧画面の
    // 表示用タブ分類を「世界7不思議」から「謎解きトロフィー」に変更する
    // (ユーザー指示: 獲得条件が「世界7不思議を除く、謎解きトロフィーを
    // すべて獲得」であり、世界7不思議そのものの獲得とは無関係のため)。
    // これはcategoryForNumber()が返す表示用ラベルのみの変更であり、
    // 以下は一切変更しない(categoryは表示用ラベルのみに使われ、判定・
    // 保存・解放ロジックのどこからも参照されないため、安全に変更できる):
    //   - id/number/name/condition/check/mode/hidden/stage/confirmed
    //   - isAllNormalPuzzlesEarned()の判定対象(PUZZLE_TROPHY_NUMBERS、
    //     categoryではなくjs/puzzle-questions.jsのq.trophyNumberから
    //     機械的に作られる固定配列。#393自身はこの配列に含まれない)
    //   - isSevenWondersUnlocked()(= isEarned('trophy_393')自体を見るだけで、
    //     category文字列を一切参照しない)
    // #394「全知全能の神」(獲得条件「世界7不思議を全7問獲得」)は対象外。
    // 条件は今回の指示と無関係なため、「世界7不思議」カテゴリーのまま変更しない
    if (number === MYSTERY_HUNTER_NUMBER) return "puzzle";
    // 世界7不思議(7問+隠し特別1種(#394)、#386〜392+394)は、謎解きトロフィーの
    // 番号範囲(#256〜)と入り交じる位置にあるため、ENCYCLOPEDIA4_NUMBERSと
    // 同様に実在チェックで判定する
    if (SEVEN_WONDERS_ALL_NUMBERS.includes(number)) return "sevenWonders";
    // 共通トロフィー31種類(#395〜425)
    if (COMMON_TROPHY_NUMBERS.includes(number)) return "common";
    return "puzzle"; // #256〜(謎解きトロフィー、第3段階。上記以外)
  }
  function getCategories() {
    return TROPHY_CATEGORIES.slice();
  }

  // TROPHIESの該当スロットにSTAGE_B_DEFINITIONS/STAGE_D_DEFINITIONS/
  // STAGE_CAPITAL_TRIVIA_DEFINITIONS等の内容を反映する。定義に無い番号は
  // null/未確定のまま変更しない。description/countriesは首都トリビア
  // (#113〜141)用の追加フィールドで、定義に含まれない場合はnullのまま
  function applyStageBDefinitions(trophies, definitions) {
    const byNumber = new Map(trophies.map((t) => [t.number, t]));
    Object.keys(definitions).forEach((key) => {
      const number = Number(key);
      const t = byNumber.get(number);
      if (!t) return; // 欠番等で実在しない番号は無視(自己検証側で別途不整合を検出する)
      const def = definitions[key];
      t.name = def.name;
      t.condition = def.condition;
      t.mode = def.mode;
      t.check = typeof def.check === "function" ? def.check : null; // #101〜112は参照型のためcheckを持たない
      t.description = typeof def.description === "string" ? def.description : null;
      t.countries = Array.isArray(def.countries) ? def.countries.slice() : null;
      // 謎解きトロフィー(第3段階)用: 挑戦先の問題id(js/puzzle-questions.js
      // のPUZZLE_QUESTIONS[].id)。該当しないトロフィーはnullのまま
      t.puzzleQuestionId = typeof def.puzzleQuestionId === "string" ? def.puzzleQuestionId : null;
      // 【PR #81最終調整】謎解きトロフィー用: 解説文(description)とは別の
      // 出典・注釈テキスト(js/puzzle-questions.jsのPUZZLE_QUESTIONS[].
      // explanationNote)。指定が無い問題はnullのまま(表示側(js/app.js)は
      // nullなら何も描画しない)
      t.descriptionNote = typeof def.descriptionNote === "string" ? def.descriptionNote : null;
      // 「世界の国どこかな？」専用36種(#159〜194)用のレア度表示。
      // 既存の#1〜158にはrarityフィールドを持つ定義が無いため、常にnullのまま
      t.rarity = (def.rarity === "normal" || def.rarity === "rare" || def.rarity === "super_rare") ? def.rarity : null;
      t.confirmed = true;
    });
  }

  // 1〜112の通し番号から欠番を除いた107個のスロットを作る。
  // id は "trophy_<number>" で固定する(番号自体が企画側の一意な識別子の
  // ため、番号から機械的に作れるidにしておけば、後で正式な名称を
  // 当てはめる際にもidを振り直す必要がない)。
  function buildTrophyDefinitions() {
    const skipped = new Set(SKIPPED_NUMBERS.concat(UNCLAIMED_GAP_NUMBERS));
    const list = [];
    for (let number = 1; number <= MAX_TROPHY_NUMBER; number++) {
      if (skipped.has(number)) continue;
      list.push({
        number,
        id: `trophy_${number}`,
        // 正式な獲得条件が確認できていないため、推測で埋めずすべてnullのまま
        // にしておく(確定ではない名前・条件文を書かないため)。
        name: null,
        condition: null,
        category: null,
        hidden: null, // 隠しトロフィーかどうかも未確定
        // 隠しトロフィー61種類(第2段階)用: evaluate()の絞り込み専用マーカー
        // ("hidden61"|null)。表示には使わない。TROPHIES組み立て後に補完する
        stage: null,
        // 首都トリビア(#113〜141)用: 長文の解説文(獲得後に表示)と、
        // 対象2か国のid配列(表示時にjs/countries.jsから国名・首都名を
        // 導出するための参照)。該当しないトロフィーはnullのまま
        description: null,
        countries: null,
        // 謎解きトロフィー(第3段階、#256〜)用: 挑戦先の問題id。
        // 該当しないトロフィーはnullのまま
        puzzleQuestionId: null,
        // 【PR #81最終調整】謎解きトロフィー用: 解説文(description)とは
        // 別の出典・注釈テキスト。該当しないトロフィーはnullのまま
        descriptionNote: null,
        // 「世界の国どこかな？」専用36種(#159〜194)用: 表示用のレア度
        // ("normal"|"rare"|"super_rare")。該当しないトロフィーはnullのまま
        rarity: null,
        // 第2段階で追加: どのモードの記録かを区別するためのフィールド。
        // "flag" | "capital" | "both"(国旗・首都両方の組合せ) |
        // "flag_only" | "capital_only" | null(未確定)。
        // 値自体はまだ1件も確定していない
        mode: null,
        // 第2段階で追加: 実際の判定関数(confirmed:trueになって初めて
        // 設定される想定)。シグネチャは check(context) => boolean。
        // context の形は evaluate() 内のコメントを参照
        check: null,
        confirmed: false, // 正式な定義が確認できたらtrueにする
      });
    }
    return list;
  }

  // #142「都の神話」用: 首都トリビア(#113〜141)29件すべてがisEarned()かどうかを
  // 確認するだけの純粋関数。このプレイの結果(context)には一切依存せず、常に
  // 保存済みの獲得状態だけを見るため、evaluate()がどの呼び出し元(クイズ/
  // 「世界の国どこかな？」/起動時の救済処理)から呼ばれても安全に同じ結果を返す。
  // (下の自己検証・過去データ救済処理の両方が参照するため、それらより前の
  // ここで定義する。isEarned()自体はfunction宣言のためホイスティングされ、
  // このファイル後方で定義されていても問題なく呼び出せる)
  const CAPITAL_TRIVIA_NUMBERS = Array.from({ length: 29 }, (_, i) => 113 + i);
  function allCapitalTriviaEarned() {
    return CAPITAL_TRIVIA_NUMBERS.every((n) => isEarned(`trophy_${n}`));
  }

  // Stage E追加検討(隠しトロフィー調査)を経て、ユーザー指示により正式確定した
  // 隠しトロフィー12件(以前検討した36件案は不採用)。名称・条件・modeの値
  // そのものは一切変更せず、表示用のhiddenフラグのみをここで真にする。
  // #53奇跡の一問・#61ラストワンの魔法・#62虹の架け橋・#64真夜中の探検家・
  // #65奇跡の数字・#67世界の反対側・#70早朝の探検家・#75型破りな国旗たち・
  // #86国旗の中に武器!?・#87国旗の動物園・#88国旗の中の地図・
  // #89国旗が語りかける(docs/trophy-spec-final.md「7. 隠しトロフィー仕様」参照)。
  // #142「都の神話」は後続のユーザー指示により、既存の隠しトロフィー12件と
  // 同じ表示仕様(未獲得時は名称・条件・解説文を伏せ「？？？？？？」と表示)を
  // 再利用するため、ここに追加した(表示処理自体はjs/app.js側の既存の
  // secretLocked分岐をそのまま使う。新しい表示コードは追加していない)
  // #158「世界の叡智」も、既存の隠しトロフィー13件(#142含む)と同じ表示仕様
  // (未獲得時は名称・条件・解説文を伏せ「？？？？？？」と表示)を再利用するため
  // ここに追加した(表示処理自体はjs/app.js側の既存のsecretLocked分岐を
  // そのまま使う。新しい表示コードは追加していない)
  const HIDDEN_TROPHY_NUMBERS = new Set([53, 61, 62, 64, 65, 67, 70, 75, 86, 87, 88, 89, 142, 158]);
  // 隠しトロフィー61種類(#195〜255、第2段階)。企画の性質上すべて隠し
  // トロフィーとして扱う(表示自体は今回実装しないが、将来の一覧画面で
  // 既存のsecretLocked分岐をそのまま使えるようにhiddenフラグだけ先に立てる)
  const HIDDEN61_NUMBERS = Array.from({ length: 61 }, (_, i) => 195 + i);
  // 世界7不思議: No.220「東京スカイツリー」のみ、隠しトロフィー61種類の
  // 表示仕様(未獲得時は名称・条件を伏せる)から例外的に除外する。世界7
  // 不思議Ⅰ「暗号作戦634」の鍵が、この獲得条件(「合計得点の下3桁が634に
  // なる」)を読むことで手に入るため、No.220自身を獲得しなくても条件文を
  // 読めるようにする必要がある。獲得条件・保存キー・判定ロジック(check・
  // stage==="hidden61")自体は一切変更しない。他の60種類の表示・件数には
  // 影響しない
  const HIDDEN61_NOW_VISIBLE_NUMBER = 220;
  // 世界7不思議 隠し特別トロフィー2種(#393・#394)は、既存のHIDDEN_TROPHY_
  // NUMBERS/隠しトロフィー61種類と同じ「未獲得時は？？？？？？で伏せる」
  // 表示仕様の対象に加える(js/app.jsの専用カードが、def.hiddenをこの2件にも
  // 適用する)
  const SEVEN_WONDERS_HIDDEN_SPECIAL_NUMBERS = new Set([MYSTERY_HUNTER_NUMBER, OMNISCIENT_GOD_NUMBER]);

  // トロフィー一覧の集計方式A案: 国旗・首都を独立管理するデュアル状態の
  // トロフィーは、国旗・首都を完全に独立した2枠として数える。
  // 第1弾でNo.1〜19(STAGE_B_DEFINITIONSの「既存データ デュアル状態」
  // コメント参照)、第2弾(追加修正)で#21「ロケット回答」・#26「瞬間判断の
  // 達人」・#27「反射神経の鬼」・#30〜39「国別生涯正解履歴」の13種類を
  // 追加し、合計32種類(19+13)が対象。それ以外のmode==="both"ではない
  // トロフィー・参照型(#101〜112)等は従来どおり1枠(id単位)のまま変更しない
  const DUAL_SPLIT_CARD_NUMBERS = new Set([
    ...Array.from({ length: 19 }, (_, i) => i + 1), // No.1〜19
    21, 26, 27, // ロケット回答・瞬間判断の達人・反射神経の鬼
    ...Array.from({ length: 10 }, (_, i) => 30 + i), // No.30〜39(国別生涯正解履歴)
  ]);
  function isDualSplitCardNumber(number) {
    return DUAL_SPLIT_CARD_NUMBERS.has(number);
  }

  // ========================================================
  // 共通トロフィー31種類(#395〜425)。共通トロフィー最終確定版企画書
  // (2026年11月25日、PR #87マージ後・実装指示対応版)に基づく。
  //
  // 保存領域: 既存のwfq_v1_trophy_earned(獲得フラグ・日時)とは別に、
  // 新規キーwfq_v1_common_progress(COMMON_PROGRESS_KEY)に、累計プレイ・
  // 累計正解・累計誤答・日付別の記録・利用経験フラグだけを保存する
  // (既存キーには一切書き込まない・既存キーの形を変えない)。
  //
  // 判定方式: 以下のヘルパー関数群は、TrophyModule.getEarned()と同じ形の
  // 「獲得状況スナップショット」(idをキーに{earnedAt}または
  // {flag:{earnedAt},capital:{earnedAt}}を値とするオブジェクト)を受け取り、
  // 指定した番号集合が実際に何件獲得済みかを数える。国旗・首都の分割
  // カード(DUAL_SPLIT_CARD_NUMBERS)は、既存の一覧画面・getProgressSummary()
  // と同じ基準で、flag側・capital側をそれぞれ独立した1獲得単位として扱う
  // (「国旗・首都で独立して獲得する分割カードは、それぞれ1件として扱う」
  // という企画書の指示どおり)。
  // ========================================================

  const COMMON_PROGRESS_KEY = STORAGE_PREFIX + "common_progress";
  const COMMON_PROGRESS_VERSION = 1;
  const COMMON_TARGET_MODES = ["flag", "capital", "findcountry"]; // 累積努力系12種類の対象は3クイズのみ(謎解き・世界7不思議は含めない)

  function emptyCommonProgress() {
    return {
      version: COMMON_PROGRESS_VERSION,
      playCompletedCount: { flag: 0, capital: 0, findcountry: 0 }, // 正式な終了処理を経て結果画面に到達したプレイの累計回数
      correctCount: { flag: 0, capital: 0, findcountry: 0 }, // 回答確定時に記録する累計正解数(中断しても保持する)
      wrongCount: { flag: 0, capital: 0, findcountry: 0 }, // 同上。パス・時間切れ・無効なタップは含まない
      perfect30Achieved: { flag: false, capital: false, findcountry: false }, // トリプルスリー用。1度でも達成すれば以後も保持(剥奪しない)
      clear198Achieved: { flag: false, capital: false }, // 三冠王用(国旗・首都198問コース)
      clearAdvanced30Achieved: false, // 三冠王用(どこかな？上級30問コース)
      playedDates: {}, // プレイを完了した日(端末ローカル日付、YYYY-MM-DD)の集合。同じ日を何度記録しても1件のまま
      lastPlayedDate: null, // 連続日数判定用。playedDatesに新規追加した日付のうち最も新しいものだけを進める
      currentStreakDays: 0,
      maxStreakDays: 0,
      dailyClear: { date: null, flag: false, capital: false, findcountry: false }, // 三位一体用。直近の「今日」1日分だけを保持する(無制限に増えない)
      usedFlag: false, usedCapital: false, usedFindCountry: false, usedMap: false, usedEncyclopedia: false, // 四つの扉用
    };
  }

  function isValidModeCountTriple(v) {
    return isPlainObject(v) && COMMON_TARGET_MODES.every((m) => isNonNegativeInteger(v[m]));
  }
  function isValidCommonProgress(data) {
    return isPlainObject(data)
      && data.version === COMMON_PROGRESS_VERSION
      && isValidModeCountTriple(data.playCompletedCount)
      && isValidModeCountTriple(data.correctCount)
      && isValidModeCountTriple(data.wrongCount)
      && isPlainObject(data.perfect30Achieved) && COMMON_TARGET_MODES.every((m) => typeof data.perfect30Achieved[m] === "boolean")
      && isPlainObject(data.clear198Achieved) && typeof data.clear198Achieved.flag === "boolean" && typeof data.clear198Achieved.capital === "boolean"
      && typeof data.clearAdvanced30Achieved === "boolean"
      && isPlainObject(data.playedDates)
      && (data.lastPlayedDate === null || typeof data.lastPlayedDate === "string")
      && isNonNegativeInteger(data.currentStreakDays)
      && isNonNegativeInteger(data.maxStreakDays)
      && isPlainObject(data.dailyClear)
      && typeof data.usedFlag === "boolean" && typeof data.usedCapital === "boolean" && typeof data.usedFindCountry === "boolean"
      && typeof data.usedMap === "boolean" && typeof data.usedEncyclopedia === "boolean";
  }
  function loadCommonProgress() {
    const raw = safeGet(COMMON_PROGRESS_KEY);
    if (!raw) return emptyCommonProgress();
    try {
      const parsed = JSON.parse(raw);
      if (!isValidCommonProgress(parsed)) return emptyCommonProgress();
      return parsed;
    } catch (e) {
      console.warn("共通トロフィーの進捗データの読み込みに失敗しました。初期化します", e);
      return emptyCommonProgress();
    }
  }
  function saveCommonProgress(data) {
    return safeSet(COMMON_PROGRESS_KEY, JSON.stringify(data));
  }
  function sumCommonModeValues(obj) {
    return COMMON_TARGET_MODES.reduce((sum, m) => sum + (obj[m] || 0), 0);
  }

  // 端末ローカル日付をYYYY-MM-DD形式で返す(UTCへの変換を行わない)
  function getLocalDateString(d) {
    const date = d || new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  // "YYYY-MM-DD"形式の2つの日付の差(日数、b-a)。文字列の辞書順比較は
  // この形式では日付の前後関係と完全に一致するため、lastPlayedDateの
  // 「進める方向にのみ更新する」判定にも文字列比較のまま使える
  function dateStringDiffDays(a, b) {
    const da = new Date(`${a}T00:00:00`);
    const db = new Date(`${b}T00:00:00`);
    return Math.round((db.getTime() - da.getTime()) / 86400000);
  }
  // プレイ完了のたびに呼ぶ。同じ日に何度呼んでも(同日重複なし)、連続日数・
  // 累計日数は1回しか増えない。端末時刻が逆行して過去の(未記録の)日付に
  // なった場合でも、その日をplayedDatesへ1回だけ追加するが、
  // currentStreakDays/lastPlayedDateは「より新しい日付」方向にしか進めない
  // ため、将来(時刻が正しく戻った後)の連続記録を壊さない
  function recordCommonDatePlayed(data) {
    const today = getLocalDateString();
    if (data.playedDates[today]) return;
    data.playedDates[today] = true;
    if (data.lastPlayedDate) {
      const diff = dateStringDiffDays(data.lastPlayedDate, today);
      data.currentStreakDays = diff === 1 ? data.currentStreakDays + 1 : 1;
    } else {
      data.currentStreakDays = 1;
    }
    if (data.currentStreakDays > data.maxStreakDays) data.maxStreakDays = data.currentStreakDays;
    if (!data.lastPlayedDate || today > data.lastPlayedDate) data.lastPlayedDate = today;
  }
  // 三位一体用。「今日」のクリア記録だけを保持する(日付が変わったら
  // その日の記録だけを新しく作り直すため、無制限にデータが増えない)
  function recordCommonDailyClear(data, mode) {
    const today = getLocalDateString();
    if (data.dailyClear.date !== today) {
      data.dailyClear = { date: today, flag: false, capital: false, findcountry: false };
    }
    data.dailyClear[mode] = true;
  }

  // 回答確定のたびに呼ぶ(中断しても、既に確定した正解・誤答は保持する)。
  // パス・時間切れは誤答に数えない(result引数に"wrong"/"correct"以外を
  // 渡された場合は何もしない)
  function recordCommonTally(mode, result) {
    if (mode !== "flag" && mode !== "capital" && mode !== "findcountry") return;
    if (result !== "correct" && result !== "wrong") return;
    try {
      const data = loadCommonProgress();
      if (result === "correct") data.correctCount[mode] = (data.correctCount[mode] || 0) + 1;
      else data.wrongCount[mode] = (data.wrongCount[mode] || 0) + 1;
      saveCommonProgress(data);
    } catch (e) {
      console.warn("共通トロフィーの正解・誤答集計に失敗しました", e);
    }
  }
  // 四つの扉用。実際に問題を開始した(設定画面を開くだけでは呼ばれない)・
  // 地図画面を実際に表示した・図鑑の詳細ページを実際に開いた、の
  // いずれかが起きた時点で呼ぶ
  function recordCommonModeUsed(kind) {
    try {
      const data = loadCommonProgress();
      if (kind === "flag") data.usedFlag = true;
      else if (kind === "capital") data.usedCapital = true;
      else if (kind === "findcountry") data.usedFindCountry = true;
      else if (kind === "map") data.usedMap = true;
      else if (kind === "encyclopedia") data.usedEncyclopedia = true;
      else return;
      saveCommonProgress(data);
    } catch (e) {
      console.warn("共通トロフィーの利用記録に失敗しました", e);
    }
  }
  // 1プレイが「正式な終了処理を経て結果画面に到達」した時点(戻る操作・
  // 再読み込みによる中断では呼ばれない経路)で、呼び出し元(evaluateQuizFinish/
  // evaluateFindCountryResult)から1回だけ呼ぶ。プレイ完了回数・30問
  // パーフェクト・198問クリア・どこかな？上級30問クリア・プレイ日・
  // 三位一体用の当日クリア記録を、この1回でまとめて更新する
  function recordCommonPlayCompletion(mode, opts) {
    try {
      const data = loadCommonProgress();
      data.playCompletedCount[mode] = (data.playCompletedCount[mode] || 0) + 1;
      if (opts && opts.perfect30) data.perfect30Achieved[mode] = true;
      if (opts && opts.clear198 && (mode === "flag" || mode === "capital")) data.clear198Achieved[mode] = true;
      if (opts && opts.clearAdvanced30) data.clearAdvanced30Achieved = true;
      recordCommonDatePlayed(data);
      recordCommonDailyClear(data, mode);
      saveCommonProgress(data);
    } catch (e) {
      console.warn("共通トロフィーのプレイ完了記録に失敗しました", e);
    }
  }

  // ---------- 獲得単位(スナップショット)の集計ヘルパー ----------
  // 指定した番号集合を、集計単位(国旗・首都分割カードはflag/capitalの
  // 2単位、それ以外は1単位)の配列に展開する
  function expandNumbersToUnits(numbers) {
    const units = [];
    numbers.forEach((n) => {
      if (isDualSplitCardNumber(n)) {
        units.push({ id: `trophy_${n}`, sub: "flag" });
        units.push({ id: `trophy_${n}`, sub: "capital" });
      } else {
        units.push({ id: `trophy_${n}`, sub: null });
      }
    });
    return units;
  }
  function isUnitEarnedInSnapshot(unit, snapshot) {
    const entry = snapshot[unit.id];
    if (!entry) return false;
    if (unit.sub) return !!(entry[unit.sub] && entry[unit.sub].earnedAt);
    return !!entry.earnedAt;
  }
  function countEarnedUnitsInSnapshot(units, snapshot) {
    let n = 0;
    units.forEach((u) => { if (isUnitEarnedInSnapshot(u, snapshot)) n += 1; });
    return n;
  }
  // 現在、正式に定義されている(confirmed:true)トロフィーの番号一覧。
  // 共通トロフィー31種類自身も含む(「全トロフィーの90%/95%」「自身を除く
  // すべて」の分母は、共通トロフィー自身を含めた最終的な総数から動的に
  // 算出する。固定値をハードコードしない)
  function getAllValidTrophyNumbers() {
    return TROPHIES.filter((t) => t.confirmed).map((t) => t.number);
  }
  function getAllValidUnits() {
    return expandNumbersToUnits(getAllValidTrophyNumbers());
  }
  // 指定した番号(通常は判定対象トロフィー自身の番号)を除いた、全有効
  // 獲得単位。累計獲得数8種・世界の真理(自身を除くすべて)が、自分自身を
  // 判定対象に含めてしまう循環参照を避けるために使う
  function getValidUnitsExcludingNumbers(excludeNumbers) {
    const excludeSet = new Set(excludeNumbers);
    return expandNumbersToUnits(getAllValidTrophyNumbers().filter((n) => !excludeSet.has(n)));
  }
  // 国旗クイズ単独で獲得可能なトロフィー(mode:"flag"の称号参照型6件+
  // mode:"flag_only"の国旗トリビア29件の単一枠)+国旗・首都分割カード
  // (mode:"both")の国旗側半分(32単位)。国旗・首都両方が必須の共通報酬
  // (mode:"common")は対象外。67単位になる想定(実測値は実装報告書に記載)
  function getFlagOnlyUnits() {
    const singleNumbers = TROPHIES.filter((t) => t.mode === "flag" || t.mode === "flag_only").map((t) => t.number);
    const dualNumbers = TROPHIES.filter((t) => t.mode === "both").map((t) => t.number);
    const units = singleNumbers.map((n) => ({ id: `trophy_${n}`, sub: null }));
    dualNumbers.forEach((n) => units.push({ id: `trophy_${n}`, sub: "flag" }));
    return units;
  }
  // 首都クイズ単独で獲得可能なトロフィー。mode:"capital"(6件)・
  // mode:"capital_only"(首都トリビア29件)の単一枠+首都・国旗分割カードの
  // 首都側半分(32単位)+No.142「都の神話」(首都トリビア29種類の制覇報酬、
  // 首都クイズ単独で獲得できる既存の特別チャレンジ)。68単位になる想定
  function getCapitalOnlyUnits() {
    const singleNumbers = TROPHIES.filter((t) => t.mode === "capital" || t.mode === "capital_only").map((t) => t.number).concat([142]);
    const dualNumbers = TROPHIES.filter((t) => t.mode === "both").map((t) => t.number);
    const units = singleNumbers.map((n) => ({ id: `trophy_${n}`, sub: null }));
    dualNumbers.forEach((n) => units.push({ id: `trophy_${n}`, sub: "capital" }));
    return units;
  }
  // 「世界の国どこかな？」に属するすべてのトロフィー(通常36+隠し61、
  // PRO関連を含む)。97単位になる想定
  function getFindCountryUnits() {
    return TROPHIES.filter((t) => t.mode === "findcountry").map((t) => ({ id: `trophy_${t.number}`, sub: null }));
  }
  // 世界図鑑専用トロフィー(所属モードがencyclopediaの20件。表示カテゴリー
  // ではなくmodeで判定するため、特別チャレンジに表示される世界の叡智・
  // 世界の大賢者も漏れなく含む)
  function getEncyclopediaUnits() {
    return TROPHIES.filter((t) => t.mode === "encyclopedia").map((t) => ({ id: `trophy_${t.number}`, sub: null }));
  }
  // 全知の探究者用。世界図鑑20+通常謎解き126(mode:"puzzle"。ミステリー
  // ハンター自身はmode:"sevenWonder"のため含まれない)+世界7不思議7問・
  // ミステリーハンター・全知全能の神(mode:"sevenWonder"、9件)=155単位
  function getOmniscientSeekerUnits() {
    const encyclopedia = getEncyclopediaUnits();
    const puzzle = TROPHIES.filter((t) => t.mode === "puzzle").map((t) => ({ id: `trophy_${t.number}`, sub: null }));
    const sevenWonder = TROPHIES.filter((t) => t.mode === "sevenWonder").map((t) => ({ id: `trophy_${t.number}`, sub: null }));
    return encyclopedia.concat(puzzle, sevenWonder);
  }

  // ---------- 累計獲得数8種類のしきい値 ----------
  const CUMULATIVE_HUNTER_THRESHOLDS = { 395: 10, 396: 50, 397: 100, 398: 200, 399: 300, 400: 350, 401: 400, 402: 420 };

  // ========================================================
  // 共通トロフィー31種類の定義本体。name/condition/descriptionは企画書の
  // 文言のまま変更しない。check関数は、通常のevaluate()が渡すcontext
  // ではなく、共通トロフィー専用の連鎖判定(evaluateCommonTrophiesChain、
  // 下記)が渡す「獲得状況スナップショット」(getEarned()と同じ形)を
  // 受け取る(定義時点ではまだ存在しない関数・配列を参照しているが、
  // check自体はこのファイルの読み込みが完了した後にしか呼ばれないため、
  // 問題なく解決できる。既存のSTAGE_*定義もすべて同じ前提に拠っている)
  // ========================================================
  const STAGE_COMMON_DEFINITIONS = {
    395: { name: "チュートリアルは終わりだ", condition: "トロフィーを累計10個獲得する。", mode: "commonTrophy",
      description: "世界を巡る冒険は始まったばかり。ここからが本当の挑戦だ。",
      check: (s) => countEarnedUnitsInSnapshot(getValidUnitsExcludingNumbers([395]), s) >= CUMULATIVE_HUNTER_THRESHOLDS[395] },
    396: { name: "駆け出しハンター", condition: "トロフィーを累計50個獲得する。", mode: "commonTrophy",
      description: "数々の挑戦を乗り越え、トロフィーハンターとしての第一歩を刻んだ。",
      check: (s) => countEarnedUnitsInSnapshot(getValidUnitsExcludingNumbers([396]), s) >= CUMULATIVE_HUNTER_THRESHOLDS[396] },
    397: { name: "シングルハンター", condition: "トロフィーを累計100個獲得する。", mode: "commonTrophy",
      description: "積み重ねた知識と経験が、確かな実力の証となった。",
      check: (s) => countEarnedUnitsInSnapshot(getValidUnitsExcludingNumbers([397]), s) >= CUMULATIVE_HUNTER_THRESHOLDS[397] },
    398: { name: "ダブルハンター", condition: "トロフィーを累計200個獲得する。", mode: "commonTrophy",
      description: "幾多の試練を乗り越え、その実力はさらなる高みへと到達した。",
      check: (s) => countEarnedUnitsInSnapshot(getValidUnitsExcludingNumbers([398]), s) >= CUMULATIVE_HUNTER_THRESHOLDS[398] },
    399: { name: "トリプルハンター", condition: "トロフィーを累計300個獲得する。", mode: "commonTrophy",
      description: "世界を巡る壮大な冒険。その功績は、もはや並外れたものとなった。",
      check: (s) => countEarnedUnitsInSnapshot(getValidUnitsExcludingNumbers([399]), s) >= CUMULATIVE_HUNTER_THRESHOLDS[399] },
    400: { name: "エピックハンター", condition: "トロフィーを累計350個獲得する。", mode: "commonTrophy",
      description: "壮大な物語に刻まれるほどの偉業を成し遂げた。",
      check: (s) => countEarnedUnitsInSnapshot(getValidUnitsExcludingNumbers([400]), s) >= CUMULATIVE_HUNTER_THRESHOLDS[400] },
    401: { name: "レジェンドハンター", condition: "トロフィーを累計400個獲得する。", mode: "commonTrophy",
      description: "数え切れない試練を制し、伝説と呼ばれる領域へと到達した。",
      check: (s) => countEarnedUnitsInSnapshot(getValidUnitsExcludingNumbers([401]), s) >= CUMULATIVE_HUNTER_THRESHOLDS[401] },
    402: { name: "ミシックハンター", condition: "トロフィーを累計420個獲得する。", mode: "commonTrophy",
      description: "伝説を超え、神話に語り継がれるほどの偉業を成し遂げた。",
      check: (s) => countEarnedUnitsInSnapshot(getValidUnitsExcludingNumbers([402]), s) >= CUMULATIVE_HUNTER_THRESHOLDS[402] },

    403: { name: "四つの扉", condition: "国旗・首都・どこかな？を各1回プレイし、世界地図・世界図鑑を使用。", mode: "commonTrophy",
      description: "世界へ続く扉は開かれた。新たな冒険と発見があなたを待っている。",
      check: () => { const p = loadCommonProgress(); return p.usedFlag && p.usedCapital && p.usedFindCountry && p.usedMap && p.usedEncyclopedia; } },
    404: { name: "トリプルスリー", condition: "3クイズの30問コースをそれぞれパーフェクトクリア。", mode: "commonTrophy",
      description: "旗、都、そして世界の地理。三つの分野で完全なる実力を証明した。",
      check: () => { const p = loadCommonProgress(); return p.perfect30Achieved.flag && p.perfect30Achieved.capital && p.perfect30Achieved.findcountry; } },
    405: { name: "三冠王", condition: "国旗198問・首都198問・どこかな？上級30問をそれぞれクリア。", mode: "commonTrophy",
      description: "三つのクイズの最高峰に挑み、三冠の栄光を手にした。",
      check: () => { const p = loadCommonProgress(); return p.clear198Achieved.flag && p.clear198Achieved.capital && p.clearAdvanced30Achieved; } },
    406: { name: "四天王", condition: "国旗・首都・どこかな？各20個以上、世界図鑑専用20個すべてを獲得。", mode: "commonTrophy",
      description: "四つの分野を極めし者。その知識と実力は、世界に君臨する四天王の証となる。",
      check: (s) => countEarnedUnitsInSnapshot(getFlagOnlyUnits(), s) >= 20
        && countEarnedUnitsInSnapshot(getCapitalOnlyUnits(), s) >= 20
        && countEarnedUnitsInSnapshot(getFindCountryUnits(), s) >= 20
        && countEarnedUnitsInSnapshot(getEncyclopediaUnits(), s) >= 20 },

    407: { name: "世界への挑戦", condition: "累計100回プレイ完了。", mode: "commonTrophy",
      description: "百回の挑戦。その一歩一歩が、世界を知る力となった。",
      check: () => sumCommonModeValues(loadCommonProgress().playCompletedCount) >= 100 },
    408: { name: "飽くなき探究心", condition: "累計500回プレイ完了。", mode: "commonTrophy",
      description: "何度挑戦しても尽きることのない探究心が、新たな知識への道を切り開いた。",
      check: () => sumCommonModeValues(loadCommonProgress().playCompletedCount) >= 500 },
    409: { name: "終わらない旅", condition: "累計1,000回プレイ完了。", mode: "commonTrophy",
      description: "千回の冒険を経ても、世界を巡るあなたの旅は終わらない。",
      check: () => sumCommonModeValues(loadCommonProgress().playCompletedCount) >= 1000 },
    410: { name: "知識の積み重ね", condition: "累計10,000問正解。", mode: "commonTrophy",
      description: "一つひとつの正解が積み重なり、揺るぎない知識となった。",
      check: () => sumCommonModeValues(loadCommonProgress().correctCount) >= 10000 },
    411: { name: "知識の大海原", condition: "累計50,000問正解。", mode: "commonTrophy",
      description: "広大な知識の海を渡り、五万の正解という偉業を達成した。",
      check: () => sumCommonModeValues(loadCommonProgress().correctCount) >= 50000 },
    412: { name: "十万の軌跡", condition: "累計100,000問正解。", mode: "commonTrophy",
      description: "十万の正解。それは、長きにわたる挑戦と努力の軌跡である。",
      check: () => sumCommonModeValues(loadCommonProgress().correctCount) >= 100000 },
    413: { name: "七日間の旅人", condition: "7日間連続でいずれかのクイズを1回以上完了。", mode: "commonTrophy",
      description: "七日間、絶えることなく世界を巡る旅を続けた。",
      check: () => loadCommonProgress().currentStreakDays >= 7 },
    414: { name: "継続は力なり", condition: "30日間連続でいずれかのクイズを1回以上完了。", mode: "commonTrophy",
      description: "日々の小さな努力が、大きな力となることを証明した。",
      check: () => loadCommonProgress().currentStreakDays >= 30 },
    415: { name: "百日の冒険", condition: "クイズを完了した日が累計100日。", mode: "commonTrophy",
      description: "百日分の冒険と発見。そのすべてが、あなたの財産となった。",
      check: () => Object.keys(loadCommonProgress().playedDates).length >= 100 },
    416: { name: "世界一周の旅", condition: "正式対象198国・地域すべてで国旗・首都両方の正解経験。", mode: "commonTrophy",
      description: "すべての国と地域を巡り、旗と都を知る世界一周の旅を成し遂げた。",
      check: () => {
        if (typeof COUNTRIES === "undefined") return false;
        const stats = loadTrophyStats();
        return COUNTRIES.every((c) => stats.countryCorrectEver.flag[c.id] && stats.countryCorrectEver.capital[c.id]);
      } },
    417: { name: "三位一体", condition: "同じ日に3クイズをそれぞれ1回以上クリア。", mode: "commonTrophy",
      description: "三つの分野を一日のうちに制し、その実力を一つに結集させた。",
      check: () => {
        const p = loadCommonProgress();
        return p.dailyClear.date === getLocalDateString() && p.dailyClear.flag && p.dailyClear.capital && p.dailyClear.findcountry;
      } },
    418: { name: "七転び八起き", condition: "3クイズで累計1,000回誤答。", mode: "commonTrophy",
      description: "何度間違えても、立ち上がり続けた。その挑戦の積み重ねが、確かな力となる。",
      check: () => sumCommonModeValues(loadCommonProgress().wrongCount) >= 1000 },

    419: { name: "万国の覇者", condition: "国旗専用・国旗トリビア・国旗側分割カード・国旗単独で獲得可能な報酬すべて。", mode: "commonTrophy",
      description: "世界中にはためく旗のすべてを知り、国旗の頂点に立った者。",
      check: (s) => { const u = getFlagOnlyUnits(); return countEarnedUnitsInSnapshot(u, s) === u.length; } },
    420: { name: "万都の支配者", condition: "首都専用・首都トリビア・首都側分割カード・都の神話・首都単独で獲得可能な報酬すべて。", mode: "commonTrophy",
      description: "世界の都を知り尽くし、その知識を極限まで高めた者。",
      check: (s) => { const u = getCapitalOnlyUnits(); return countEarnedUnitsInSnapshot(u, s) === u.length; } },
    421: { name: "世界を統べる者", condition: "どこかな？通常36＋隠し61（PRO含む）＝97件予定。", mode: "commonTrophy",
      description: "地球上に、もはや知らぬ場所はない。",
      check: (s) => { const u = getFindCountryUnits(); return countEarnedUnitsInSnapshot(u, s) === u.length; } },
    422: { name: "全知の探究者", condition: "図鑑20＋通常謎解き126＋No.393＋七不思議7＋No.394＝155件予定。", mode: "commonTrophy",
      description: "世界の知識を集め、隠されたすべての謎を解き明かした者。",
      check: (s) => { const u = getOmniscientSeekerUnits(); return countEarnedUnitsInSnapshot(u, s) === u.length; } },

    423: { name: "世界の果てまで", condition: "全トロフィーの90％以上を獲得。", mode: "commonTrophy",
      description: "果てしない旅の先に、あなたは世界の果てへとたどり着いた。",
      check: (s) => { const u = getAllValidUnits(); return countEarnedUnitsInSnapshot(u, s) >= Math.ceil(u.length * 0.9); } },
    424: { name: "殿堂入り", condition: "全トロフィーの95％以上を獲得。", mode: "commonTrophy",
      description: "あなたの偉業は永遠に刻まれ、世界の歴史にその名を残す。",
      check: (s) => { const u = getAllValidUnits(); return countEarnedUnitsInSnapshot(u, s) >= Math.ceil(u.length * 0.95); } },
    425: { name: "世界の真理 ～アカシック・レコード～", condition: "自身を除くすべての獲得単位を獲得。", mode: "commonTrophy",
      description: "すべての知識、すべての記憶、すべての謎。その先にある世界の真理へ、あなたはたどり着いた。",
      check: (s) => { const u = getValidUnitsExcludingNumbers([425]); return countEarnedUnitsInSnapshot(u, s) === u.length; } },
  };

  // 共通トロフィー31種類専用の連鎖判定。1件の獲得が別の共通トロフィーの
  // 条件を満たす可能性があるため、新規獲得が無くなるまで繰り返し判定する
  // (「連鎖解放」企画書 第11章)。反復回数には安全な上限を設け、万一
  // 循環参照があっても無限ループにはならない(到達した場合は異常として
  // コンソールに警告するだけで、既存の処理には影響しない)
  function evaluateCommonTrophiesChain() {
    const newlyAwarded = [];
    const maxIterations = COMMON_TROPHY_NUMBERS.length + 5;
    let changed = true;
    let iterations = 0;
    while (changed && iterations < maxIterations) {
      changed = false;
      iterations += 1;
      const snapshot = getEarned();
      COMMON_TROPHY_NUMBERS.forEach((n) => {
        const id = `trophy_${n}`;
        if (snapshot[id]) return;
        const def = TROPHY_BY_ID.get(id);
        if (!def || !def.confirmed || typeof def.check !== "function") return;
        let qualifies = false;
        try {
          qualifies = !!def.check(snapshot);
        } catch (e) {
          console.warn(`共通トロフィーの判定関数でエラーが発生しました(number=${n})`, e);
        }
        if (qualifies && awardIfNew(id)) {
          newlyAwarded.push(id);
          changed = true;
        }
      });
    }
    if (iterations >= maxIterations) {
      console.warn("共通トロフィーの連鎖判定が反復上限に達しました。獲得条件に循環参照がある可能性があります");
    }
    return newlyAwarded;
  }
  // 既存ユーザーへの遡及付与用。アプリ起動時に1回呼ぶ想定(js/app.js)。
  // 既存の獲得済みトロフィー・国別正解履歴など、今回新設した保存領域
  // (COMMON_PROGRESS_KEY)に依存しない共通トロフィー(累計獲得数8種・
  // 各モード完全制覇4種・四天王・世界一周の旅・最終到達3種)は、この
  // 呼び出しだけで正しく評価・付与される。四つの扉・トリプルスリー・
  // 三冠王・累積がんばり系11種(世界一周の旅を除く)は、新規保存領域に
  // 履歴が無いため、このタイミングでは付与されない(今回の更新以降の
  // 実績から記録を開始する、という既存仕様どおりの正しい挙動であり、
  // 「過去の実績を正確に復元できない場合は推測で補完しない」という
  // 指示に従っている)
  function evaluateCommonTrophiesCatchUp() {
    // 四つの扉の「usedFlag/usedCapital/usedFindCountry/usedEncyclopedia」の
    // うち、既存データから過去の利用が確実に証明できるものだけを、推測せず
    // 復元する(「正確に復元できない実績は推測で補完しない」指示のため、
    // 証拠の無いusedMapは復元しない。今後、実際に世界地図を開いた時点から
    // 記録を開始する)。
    //   - usedFlag/usedCapital: 挑戦回数(StorageKeys/CapitalStorageKeys.
    //     ATTEMPTS)が1回以上あれば、過去に必ず国旗/首都クイズを開始している
    //   - usedFindCountry: 「世界の国どこかな？」専用のトロフィーを1件でも
    //     獲得していれば、過去に必ずプレイを完了している
    //   - usedEncyclopedia: 世界図鑑の閲覧記録(ENCYCLOPEDIA_VISITED_KEY)が
    //     1件以上あれば、過去に必ず詳細ページを開いている
    try {
      if (typeof Storage !== "undefined") {
        const data = loadCommonProgress();
        let changed = false;
        if (!data.usedFlag && Storage.getAttempts("flag") > 0) { data.usedFlag = true; changed = true; }
        if (!data.usedCapital && Storage.getAttempts("capital") > 0) { data.usedCapital = true; changed = true; }
        if (!data.usedFindCountry) {
          const snapshot = getEarned();
          const everFindCountryEarned = TROPHIES.some((t) => t.mode === "findcountry" && snapshot[t.id]);
          if (everFindCountryEarned) { data.usedFindCountry = true; changed = true; }
        }
        if (!data.usedEncyclopedia && typeof Storage.getEncyclopediaVisitedCount === "function" && Storage.getEncyclopediaVisitedCount() > 0) {
          data.usedEncyclopedia = true;
          changed = true;
        }
        if (changed) saveCommonProgress(data);
      }
    } catch (e) {
      console.warn("共通トロフィー(四つの扉)の遡及復元に失敗しました", e);
    }
    return evaluateCommonTrophiesChain();
  }
  // トロフィー一覧画面の進捗表示用。番号を指定すると、その共通トロフィーの
  // 現在の達成状況(現在値/必要値、複数条件があればその一覧)を返す。
  // 隠しトロフィーの正式名称・獲得条件を漏らさないよう、この関数自体は
  // 常にtrophy_<number>自身の進捗だけを返す(他のトロフィーの内部情報は
  // 一切含めない)
  function getCommonTrophyProgress(number) {
    if (!COMMON_TROPHY_NUMBERS.includes(number)) return null;
    const snapshot = getEarned();
    const progress = loadCommonProgress();
    if (CUMULATIVE_HUNTER_THRESHOLDS[number]) {
      const units = getValidUnitsExcludingNumbers([number]);
      return { current: countEarnedUnitsInSnapshot(units, snapshot), total: CUMULATIVE_HUNTER_THRESHOLDS[number], unit: "個" };
    }
    switch (number) {
      case 403: {
        const parts = [
          { label: "国旗クイズ", done: progress.usedFlag },
          { label: "首都クイズ", done: progress.usedCapital },
          { label: "どこかな？", done: progress.usedFindCountry },
          { label: "世界地図", done: progress.usedMap },
          { label: "世界図鑑", done: progress.usedEncyclopedia },
        ];
        return { parts, current: parts.filter((p) => p.done).length, total: parts.length, unit: "項目" };
      }
      case 404: {
        const parts = [
          { label: "国旗クイズ30問パーフェクト", done: progress.perfect30Achieved.flag },
          { label: "首都クイズ30問パーフェクト", done: progress.perfect30Achieved.capital },
          { label: "どこかな？30問パーフェクト", done: progress.perfect30Achieved.findcountry },
        ];
        return { parts, current: parts.filter((p) => p.done).length, total: parts.length, unit: "項目" };
      }
      case 405: {
        const parts = [
          { label: "国旗クイズ198問クリア", done: progress.clear198Achieved.flag },
          { label: "首都クイズ198問クリア", done: progress.clear198Achieved.capital },
          { label: "どこかな？上級30問クリア", done: progress.clearAdvanced30Achieved },
        ];
        return { parts, current: parts.filter((p) => p.done).length, total: parts.length, unit: "項目" };
      }
      case 406: {
        const parts = [
          { label: "国旗クイズ", current: countEarnedUnitsInSnapshot(getFlagOnlyUnits(), snapshot), total: 20 },
          { label: "首都クイズ", current: countEarnedUnitsInSnapshot(getCapitalOnlyUnits(), snapshot), total: 20 },
          { label: "どこかな？", current: countEarnedUnitsInSnapshot(getFindCountryUnits(), snapshot), total: 20 },
          { label: "世界図鑑", current: countEarnedUnitsInSnapshot(getEncyclopediaUnits(), snapshot), total: 20 },
        ];
        return { parts };
      }
      case 407: return { current: sumCommonModeValues(progress.playCompletedCount), total: 100, unit: "回" };
      case 408: return { current: sumCommonModeValues(progress.playCompletedCount), total: 500, unit: "回" };
      case 409: return { current: sumCommonModeValues(progress.playCompletedCount), total: 1000, unit: "回" };
      case 410: return { current: sumCommonModeValues(progress.correctCount), total: 10000, unit: "問" };
      case 411: return { current: sumCommonModeValues(progress.correctCount), total: 50000, unit: "問" };
      case 412: return { current: sumCommonModeValues(progress.correctCount), total: 100000, unit: "問" };
      case 413: return { current: Math.min(progress.currentStreakDays, 7), total: 7, unit: "日" };
      case 414: return { current: Math.min(progress.currentStreakDays, 30), total: 30, unit: "日" };
      case 415: return { current: Object.keys(progress.playedDates).length, total: 100, unit: "日" };
      case 416: {
        if (typeof COUNTRIES === "undefined") return { current: 0, total: 198, unit: "か国" };
        const stats = loadTrophyStats();
        const current = COUNTRIES.filter((c) => stats.countryCorrectEver.flag[c.id] && stats.countryCorrectEver.capital[c.id]).length;
        return { current, total: 198, unit: "か国" };
      }
      case 417: {
        const today = getLocalDateString();
        const match = progress.dailyClear.date === today;
        const parts = [
          { label: "国旗クイズ", done: match && progress.dailyClear.flag },
          { label: "首都クイズ", done: match && progress.dailyClear.capital },
          { label: "どこかな？", done: match && progress.dailyClear.findcountry },
        ];
        return { parts, current: parts.filter((p) => p.done).length, total: 3, unit: "項目" };
      }
      case 418: return { current: sumCommonModeValues(progress.wrongCount), total: 1000, unit: "回" };
      case 419: { const u = getFlagOnlyUnits(); return { current: countEarnedUnitsInSnapshot(u, snapshot), total: u.length, unit: "件" }; }
      case 420: { const u = getCapitalOnlyUnits(); return { current: countEarnedUnitsInSnapshot(u, snapshot), total: u.length, unit: "件" }; }
      case 421: { const u = getFindCountryUnits(); return { current: countEarnedUnitsInSnapshot(u, snapshot), total: u.length, unit: "件" }; }
      case 422: { const u = getOmniscientSeekerUnits(); return { current: countEarnedUnitsInSnapshot(u, snapshot), total: u.length, unit: "件" }; }
      case 423:
      case 424: {
        const u = getAllValidUnits();
        const current = countEarnedUnitsInSnapshot(u, snapshot);
        const percent = u.length ? Math.floor((current / u.length) * 1000) / 10 : 0;
        return { current, total: u.length, percent, unit: "件" };
      }
      case 425: {
        const u = getValidUnitsExcludingNumbers([425]);
        return { current: countEarnedUnitsInSnapshot(u, snapshot), total: u.length, unit: "件" };
      }
      default:
        return null;
    }
  }

  const TROPHIES = buildTrophyDefinitions();
  applyStageBDefinitions(TROPHIES, STAGE_B_DEFINITIONS);
  applyStageBDefinitions(TROPHIES, STAGE_D_DEFINITIONS);
  applyStageBDefinitions(TROPHIES, STAGE_CAPITAL_TRIVIA_DEFINITIONS);
  applyStageBDefinitions(TROPHIES, STAGE_LEGEND_DEFINITIONS);
  applyStageBDefinitions(TROPHIES, STAGE_ENCYCLOPEDIA_DEFINITIONS);
  applyStageBDefinitions(TROPHIES, STAGE_FINDCOUNTRY_DEFINITIONS);
  applyStageBDefinitions(TROPHIES, STAGE_HIDDEN61_DEFINITIONS);
  applyStageBDefinitions(TROPHIES, STAGE_PUZZLE_DEFINITIONS);
  applyStageBDefinitions(TROPHIES, STAGE_ENCYCLOPEDIA4_DEFINITIONS);
  applyStageBDefinitions(TROPHIES, STAGE_SEVEN_WONDERS_DEFINITIONS);
  applyStageBDefinitions(TROPHIES, STAGE_SEVEN_WONDERS_SPECIAL_DEFINITIONS);
  applyStageBDefinitions(TROPHIES, STAGE_COMMON_DEFINITIONS);
  // category/hidden/stageのみをここで補完する(name/condition/mode/checkは
  // applyStageBDefinitions()が設定した値から一切変更しない)。
  // - category: 上記categoryForNumber()による分類(表示用ラベルのみ)
  // - hidden: 既存のHIDDEN_TROPHY_NUMBERS(14件)+隠しトロフィー61種類の
  //   うちNo.220を除く60件+世界7不思議隠し特別2種(#393・#394)がtrue。
  //   世界7不思議7問自身(#386〜392)はhidden:trueにしない(未獲得でも
  //   ロック解除後は通常の謎解きカードと同じく問題文を常に見せるため。
  //   ロック中の専用マスキングはjs/app.js側の専用カード描画が、この
  //   hiddenフラグとは別の「世界7不思議の解放状態」を見て行う)
  // - stage: 隠しトロフィー61種類だけ"hidden61"を持つ(evaluate()が既定では
  //   この61件を一切判定しないようにするための絞り込み専用マーカー。
  //   表示には使わない。No.220もこのstageのまま変更しない)
  TROPHIES.forEach((t) => {
    t.category = categoryForNumber(t.number);
    t.hidden = HIDDEN_TROPHY_NUMBERS.has(t.number)
      || (HIDDEN61_NUMBERS.includes(t.number) && t.number !== HIDDEN61_NOW_VISIBLE_NUMBER)
      || SEVEN_WONDERS_HIDDEN_SPECIAL_NUMBERS.has(t.number);
    t.stage = (t.number >= 195 && t.number <= 255)
      ? "hidden61"
      : (SEVEN_WONDERS_HIDDEN_SPECIAL_NUMBERS.has(t.number)
        ? "sevenWondersSpecial"
        : (COMMON_TROPHY_NUMBERS.includes(t.number) ? "commonChain" : null));
  });
  const TROPHY_BY_ID = new Map(TROPHIES.map((t) => [t.id, t]));

  // ---------- 自己検証(既存のjs/app.js冒頭・js/findcountry.jsのvalidatePools()
  // と同じ、console.assertベースの開発時チェック。問題が無ければ何も出力しない) ----------
  (function validateTrophyDefinitions() {
    // 謎解きトロフィー(第3段階)はPUZZLE_QUESTION_LIST.length件だけ250に
    // 加算される(件数が増減しても自動的に追従する)。世界図鑑トロフィー
    // 追加分(#259〜262、固定4件)は別途254への加算として扱う。世界7不思議
    // (7問+隠し特別2種、固定9件)もSEVEN_WONDERS_ALL_NUMBERS.lengthとして
    // 同様に加算する。共通トロフィー31種類(COMMON_TROPHY_NUMBERS、固定31件)
    // も同様に加算する
    console.assert(
      TROPHIES.length === 254 + PUZZLE_QUESTION_LIST.length + SEVEN_WONDERS_ALL_NUMBERS.length + COMMON_TROPHY_NUMBERS.length,
      `トロフィー定義が254+謎解き件数+世界7不思議件数+共通トロフィー件数ではありません(実際: ${TROPHIES.length}件、期待値: ${254 + PUZZLE_QUESTION_LIST.length + SEVEN_WONDERS_ALL_NUMBERS.length + COMMON_TROPHY_NUMBERS.length}件)`
    );
    const numbers = new Set(TROPHIES.map((t) => t.number));
    console.assert(numbers.size === TROPHIES.length, "トロフィー定義のnumberに重複があります");
    const ids = new Set(TROPHIES.map((t) => t.id));
    console.assert(ids.size === TROPHIES.length, "トロフィー定義のidに重複があります");
    SKIPPED_NUMBERS.forEach((n) => {
      console.assert(!numbers.has(n), `欠番(${n})がトロフィー定義に含まれています`);
    });
    // Stage B・D・首都トリビア・#142「都の神話」・世界図鑑(#143〜158)で
    // 列挙した件数の合計だけがconfirmed:trueになっていることを確認する
    // (STAGE_B_DEFINITIONS 79件+STAGE_D_DEFINITIONS 28件+
    // STAGE_CAPITAL_TRIVIA_DEFINITIONS 29件+STAGE_LEGEND_DEFINITIONS 1件+
    // STAGE_ENCYCLOPEDIA_DEFINITIONS 16件=153件全てが確定するはず。反映漏れ・
    // 重複登録が無いかの自己チェック)
    const confirmedCount = TROPHIES.filter((t) => t.confirmed).length;
    const stageBNumbers = Object.keys(STAGE_B_DEFINITIONS).map(Number);
    const stageDNumbers = Object.keys(STAGE_D_DEFINITIONS).map(Number);
    const capitalTriviaNumbers = Object.keys(STAGE_CAPITAL_TRIVIA_DEFINITIONS).map(Number);
    const legendNumbers = Object.keys(STAGE_LEGEND_DEFINITIONS).map(Number);
    const encyclopediaNumbers = Object.keys(STAGE_ENCYCLOPEDIA_DEFINITIONS).map(Number);
    const findCountryNumbers = Object.keys(STAGE_FINDCOUNTRY_DEFINITIONS).map(Number);
    const hidden61Numbers = Object.keys(STAGE_HIDDEN61_DEFINITIONS).map(Number);
    const puzzleNumbers = Object.keys(STAGE_PUZZLE_DEFINITIONS).map(Number);
    const encyclopedia4Numbers = Object.keys(STAGE_ENCYCLOPEDIA4_DEFINITIONS).map(Number);
    const sevenWondersNumbers = Object.keys(STAGE_SEVEN_WONDERS_DEFINITIONS).map(Number);
    const sevenWondersSpecialNumbers = Object.keys(STAGE_SEVEN_WONDERS_SPECIAL_DEFINITIONS).map(Number);
    console.assert(
      stageBNumbers.every((n) => !stageDNumbers.includes(n)),
      "STAGE_B_DEFINITIONSとSTAGE_D_DEFINITIONSで番号が重複しています"
    );
    console.assert(
      capitalTriviaNumbers.every((n) => !stageBNumbers.includes(n) && !stageDNumbers.includes(n)),
      "STAGE_CAPITAL_TRIVIA_DEFINITIONSが既存のSTAGE_B_DEFINITIONS/STAGE_D_DEFINITIONSと番号が重複しています"
    );
    console.assert(
      legendNumbers.every((n) => !stageBNumbers.includes(n) && !stageDNumbers.includes(n) && !capitalTriviaNumbers.includes(n)),
      "STAGE_LEGEND_DEFINITIONSが既存の定義(Stage B/D/首都トリビア)と番号が重複しています"
    );
    console.assert(
      encyclopediaNumbers.every((n) => !stageBNumbers.includes(n) && !stageDNumbers.includes(n) && !capitalTriviaNumbers.includes(n) && !legendNumbers.includes(n)),
      "STAGE_ENCYCLOPEDIA_DEFINITIONSが既存の定義(Stage B/D/首都トリビア/#142)と番号が重複しています"
    );
    console.assert(
      findCountryNumbers.every((n) => !stageBNumbers.includes(n) && !stageDNumbers.includes(n) && !capitalTriviaNumbers.includes(n) && !legendNumbers.includes(n) && !encyclopediaNumbers.includes(n)),
      "STAGE_FINDCOUNTRY_DEFINITIONSが既存の定義(Stage B/D/首都トリビア/#142/世界図鑑)と番号が重複しています"
    );
    console.assert(
      hidden61Numbers.every((n) => !stageBNumbers.includes(n) && !stageDNumbers.includes(n) && !capitalTriviaNumbers.includes(n) && !legendNumbers.includes(n) && !encyclopediaNumbers.includes(n) && !findCountryNumbers.includes(n)),
      "STAGE_HIDDEN61_DEFINITIONSが既存の定義(Stage B/D/首都トリビア/#142/世界図鑑/findcountry36)と番号が重複しています"
    );
    console.assert(
      puzzleNumbers.every((n) => !stageBNumbers.includes(n) && !stageDNumbers.includes(n) && !capitalTriviaNumbers.includes(n) && !legendNumbers.includes(n) && !encyclopediaNumbers.includes(n) && !findCountryNumbers.includes(n) && !hidden61Numbers.includes(n) && !encyclopedia4Numbers.includes(n)),
      "STAGE_PUZZLE_DEFINITIONSが既存の定義(Stage B/D/首都トリビア/#142/世界図鑑/findcountry36/隠しトロフィー61/世界図鑑追加分)と番号が重複しています"
    );
    console.assert(
      puzzleNumbers.length === PUZZLE_QUESTION_LIST.length,
      `STAGE_PUZZLE_DEFINITIONSの件数がPUZZLE_QUESTIONSの件数と一致しません(実際: ${puzzleNumbers.length}件、期待値: ${PUZZLE_QUESTION_LIST.length}件)`
    );
    // 世界図鑑トロフィー追加分(#259〜262)が、既存の全定義(Stage B/D/首都
    // トリビア/#142/世界図鑑16件/findcountry36/隠しトロフィー61/謎解き)と
    // 番号が重複していないことを確認する
    console.assert(
      encyclopedia4Numbers.every((n) => !stageBNumbers.includes(n) && !stageDNumbers.includes(n) && !capitalTriviaNumbers.includes(n) && !legendNumbers.includes(n) && !encyclopediaNumbers.includes(n) && !findCountryNumbers.includes(n) && !hidden61Numbers.includes(n) && !puzzleNumbers.includes(n)),
      "STAGE_ENCYCLOPEDIA4_DEFINITIONSが既存の定義(Stage B/D/首都トリビア/#142/世界図鑑/findcountry36/隠しトロフィー61/謎解き)と番号が重複しています"
    );
    console.assert(
      encyclopedia4Numbers.length === 4,
      `STAGE_ENCYCLOPEDIA4_DEFINITIONSの件数が4件ではありません(実際: ${encyclopedia4Numbers.length}件)`
    );
    console.assert(
      new Set(encyclopedia4Numbers).size === 4 && [259, 260, 261, 262].every((n) => encyclopedia4Numbers.includes(n)),
      "STAGE_ENCYCLOPEDIA4_DEFINITIONSの番号が#259〜262ちょうどになっていません"
    );
    // 世界7不思議(7問+隠し特別2種)が、既存の全定義と番号が重複していない
    // ことを確認する
    console.assert(
      sevenWondersNumbers.every((n) => !stageBNumbers.includes(n) && !stageDNumbers.includes(n) && !capitalTriviaNumbers.includes(n) && !legendNumbers.includes(n) && !encyclopediaNumbers.includes(n) && !findCountryNumbers.includes(n) && !hidden61Numbers.includes(n) && !puzzleNumbers.includes(n) && !encyclopedia4Numbers.includes(n)),
      "STAGE_SEVEN_WONDERS_DEFINITIONSが既存の定義と番号が重複しています"
    );
    console.assert(
      sevenWondersSpecialNumbers.every((n) => !stageBNumbers.includes(n) && !stageDNumbers.includes(n) && !capitalTriviaNumbers.includes(n) && !legendNumbers.includes(n) && !encyclopediaNumbers.includes(n) && !findCountryNumbers.includes(n) && !hidden61Numbers.includes(n) && !puzzleNumbers.includes(n) && !encyclopedia4Numbers.includes(n) && !sevenWondersNumbers.includes(n)),
      "STAGE_SEVEN_WONDERS_SPECIAL_DEFINITIONSが既存の定義(世界7不思議7問含む)と番号が重複しています"
    );
    // js/seven-wonders-questions.jsが読み込まれていない(SEVEN_WONDERS_QUESTION_LIST
    // が空)場合は、謎解き(PUZZLE_QUESTION_LIST)が空の場合と同じく0件が正しい
    // ため、件数はハードコードせずSEVEN_WONDERS_QUESTION_LIST.lengthに対して
    // 相対的に検証する(未更新の既存テストファイルを後方互換に保つ)
    console.assert(
      sevenWondersNumbers.length === SEVEN_WONDERS_QUESTION_LIST.length && new Set(sevenWondersNumbers).size === sevenWondersNumbers.length,
      `STAGE_SEVEN_WONDERS_DEFINITIONSの件数がSEVEN_WONDERS_QUESTIONSの件数と一致しません(実際: ${JSON.stringify(sevenWondersNumbers)})`
    );
    if (SEVEN_WONDERS_QUESTION_LIST.length === 7) {
      console.assert(
        [386, 387, 388, 389, 390, 391, 392].every((n) => sevenWondersNumbers.includes(n)),
        `STAGE_SEVEN_WONDERS_DEFINITIONSの番号が#386〜392ちょうど7件になっていません(実際: ${JSON.stringify(sevenWondersNumbers)})`
      );
    }
    console.assert(
      sevenWondersSpecialNumbers.length === (SEVEN_WONDERS_QUESTION_LIST.length ? 2 : 0)
        && new Set(sevenWondersSpecialNumbers).size === sevenWondersSpecialNumbers.length,
      `STAGE_SEVEN_WONDERS_SPECIAL_DEFINITIONSの件数が想定と一致しません(実際: ${JSON.stringify(sevenWondersSpecialNumbers)})`
    );
    if (SEVEN_WONDERS_QUESTION_LIST.length) {
      console.assert(
        [MYSTERY_HUNTER_NUMBER, OMNISCIENT_GOD_NUMBER].every((n) => sevenWondersSpecialNumbers.includes(n)),
        `STAGE_SEVEN_WONDERS_SPECIAL_DEFINITIONSの番号が#393・#394ちょうど2件になっていません(実際: ${JSON.stringify(sevenWondersSpecialNumbers)})`
      );
    }
    // 循環参照防止の自己検証: 「通常謎解きを全問獲得」の判定対象
    // (PUZZLE_TROPHY_NUMBERS)に世界7不思議・隠し特別2種が含まれないこと、
    // 「世界7不思議を全7問獲得」の判定対象(SEVEN_WONDERS_TROPHY_NUMBERS)に
    // 全知全能の神(#394)自身が含まれないことを確認する
    console.assert(
      PUZZLE_TROPHY_NUMBERS.every((n) => !sevenWondersNumbers.includes(n) && !sevenWondersSpecialNumbers.includes(n)),
      "PUZZLE_TROPHY_NUMBERS(通常謎解き全問判定の対象)に世界7不思議の番号が混入しています(循環参照の危険)"
    );
    console.assert(
      !SEVEN_WONDERS_TROPHY_NUMBERS.includes(OMNISCIENT_GOD_NUMBER),
      "SEVEN_WONDERS_TROPHY_NUMBERS(世界7不思議全問判定の対象)に全知全能の神自身が混入しています(循環参照の危険)"
    );
    // 「世界の大賢者」(#262)の判定対象(ENCYCLOPEDIA_19_NUMBERS)が、自分
    // 自身(262)を含まずちょうど19件(既存16件+259〜261の3件)であることを
    // 確認する(循環参照・無限ループの防止)
    console.assert(
      ENCYCLOPEDIA_19_NUMBERS.length === 19 && !ENCYCLOPEDIA_19_NUMBERS.includes(262),
      `ENCYCLOPEDIA_19_NUMBERSが19件・#262自身を含まない、の条件を満たしていません(実際: ${ENCYCLOPEDIA_19_NUMBERS.length}件)`
    );
    // 【PR #81追加修正】各問題のtrophyNumberが不正な値(整数でない、
    // PUZZLE_TROPHY_NUMBER_BASE(255)以下)を持っていないかを確認する。
    // この境界により、謎解きトロフィーの番号は既存の#1〜255のどの範囲とも
    // 構造上重複しえない(上の重複チェックと合わせた二重の安全策)
    console.assert(
      PUZZLE_TROPHY_NUMBERS.every((n) => Number.isInteger(n) && n > PUZZLE_TROPHY_NUMBER_BASE),
      `PUZZLE_QUESTIONSのtrophyNumberが不正です(${PUZZLE_TROPHY_NUMBER_BASE}より大きい整数を指定してください。実際の値: ${JSON.stringify(PUZZLE_TROPHY_NUMBERS)})`
    );
    // 【PR #81追加修正】問題ごとのtrophyNumberに重複がないことを確認する
    // (重複があると、後に定義した問題が先の問題のトロフィーを辞書キーの
    // 衝突で上書きし、先の問題の獲得条件が消えてしまう)
    console.assert(
      new Set(PUZZLE_TROPHY_NUMBERS).size === PUZZLE_TROPHY_NUMBERS.length,
      `PUZZLE_QUESTIONSのtrophyNumberに重複があります(問題ごとに一意の番号を指定してください。実際の値: ${JSON.stringify(PUZZLE_TROPHY_NUMBERS)})`
    );
    // 【PR #81追加修正】謎解きトロフィーの番号範囲(256〜MAX_TROPHY_NUMBER)に
    // 「SKIPPED_NUMBERSにも登録されておらず、どの問題のtrophyNumberでもない
    // 番号」(= 未定義のまま枠だけ作られてしまっている欠番)が無いことを
    // 確認する。将来、問題の追加で番号が連続しなくなったり、問題の削除で
    // 欠番が生じたりした場合は、その番号を明示的にSKIPPED_NUMBERSへ
    // 追加すること(既存の欠番50・55・56・57・90と同じ扱い)
    for (let n = PUZZLE_TROPHY_NUMBER_BASE + 1; n <= PUZZLE_OWN_MAX_NUMBER; n++) {
      if (SKIPPED_NUMBERS.includes(n) || ENCYCLOPEDIA4_NUMBERS.includes(n)) continue;
      console.assert(
        PUZZLE_TROPHY_NUMBERS.includes(n),
        `謎解きトロフィーの番号#${n}が、どの問題のtrophyNumberでもなく、SKIPPED_NUMBERSにも登録されていません(未定義のまま枠だけ作られています。欠番として扱う場合はSKIPPED_NUMBERSに追加してください)`
      );
    }
    const existingConfirmedCount = stageBNumbers.length + stageDNumbers.length;
    console.assert(existingConfirmedCount === 107, `既存のStage B・Dで107件全てが確定するはずが、合計が107件になっていません(実際: ${existingConfirmedCount}件)`);
    console.assert(capitalTriviaNumbers.length === 29, `首都トリビアの定義が29件ではありません(実際: ${capitalTriviaNumbers.length}件)`);
    console.assert(legendNumbers.length === 1, `#142「都の神話」の定義が1件ではありません(実際: ${legendNumbers.length}件)`);
    console.assert(encyclopediaNumbers.length === 16, `世界図鑑トロフィー(#143〜158)の定義が16件ではありません(実際: ${encyclopediaNumbers.length}件)`);
    console.assert(findCountryNumbers.length === 36, `「世界の国どこかな？」専用トロフィー(#159〜194)の定義が36件ではありません(実際: ${findCountryNumbers.length}件)`);
    console.assert(hidden61Numbers.length === 61, `隠しトロフィー61種類(#195〜255)の定義が61件ではありません(実際: ${hidden61Numbers.length}件)`);
    const expectedConfirmedCountBeforePuzzle = existingConfirmedCount + capitalTriviaNumbers.length + legendNumbers.length + encyclopediaNumbers.length + findCountryNumbers.length + hidden61Numbers.length + encyclopedia4Numbers.length;
    console.assert(expectedConfirmedCountBeforePuzzle === 254, `254件全てが確定するはずが、合計が254件になっていません(実際: ${expectedConfirmedCountBeforePuzzle}件)`);
    // 謎解きトロフィー(第3段階)はPUZZLE_QUESTIONSの件数分だけ254に加算され、
    // 世界7不思議(7問+隠し特別2種、固定9件)・共通トロフィー31種類
    // (COMMON_TROPHY_NUMBERS)もさらに加算される
    const expectedConfirmedCount = expectedConfirmedCountBeforePuzzle + puzzleNumbers.length + sevenWondersNumbers.length + sevenWondersSpecialNumbers.length + COMMON_TROPHY_NUMBERS.length;
    console.assert(confirmedCount === expectedConfirmedCount, `Stage B・D・首都トリビア・#142・世界図鑑・findcountry36・隠しトロフィー61・謎解き・世界7不思議・共通トロフィーで確定したはずのトロフィー件数が一致しません(期待値: ${expectedConfirmedCount}件、実際: ${confirmedCount}件)`);
    // findcountry36のrarity構成が、仕様どおり普通14・レア12・スーパーレア10であること
    const findCountryDefs = TROPHIES.filter((t) => findCountryNumbers.includes(t.number));
    console.assert(findCountryDefs.every((t) => t.rarity === "normal" || t.rarity === "rare" || t.rarity === "super_rare"), "findcountry36のいずれかにrarityが設定されていません");
    console.assert(findCountryDefs.filter((t) => t.rarity === "normal").length === 14, "findcountry36の普通トロフィーが14件ではありません");
    console.assert(findCountryDefs.filter((t) => t.rarity === "rare").length === 12, "findcountry36のレアトロフィーが12件ではありません");
    console.assert(findCountryDefs.filter((t) => t.rarity === "super_rare").length === 10, "findcountry36のスーパーレアトロフィーが10件ではありません");
    console.assert(TROPHIES.filter((t) => !findCountryNumbers.includes(t.number)).every((t) => t.rarity === null), "findcountry36以外のトロフィーにrarityが設定されています");
    // #142は首都トリビア29件を集計するだけの判定のため、自分自身を条件判定に
    // 含めないこと(CAPITAL_TRIVIA_NUMBERSに142が含まれないこと)を確認する
    console.assert(!CAPITAL_TRIVIA_NUMBERS.includes(142), "CAPITAL_TRIVIA_NUMBERSに#142自身が含まれています");
    console.assert(CAPITAL_TRIVIA_NUMBERS.length === 29, `CAPITAL_TRIVIA_NUMBERSが29件ではありません(実際: ${CAPITAL_TRIVIA_NUMBERS.length}件)`);
    // confirmed:trueのトロフィーは、参照型(#101〜112、checkを持たない)を
    // 除き、必ずcheck関数を持つこと(新規仕様書どおりに実装できていることの確認)
    console.assert(
      TROPHIES.every((t) => !t.confirmed || referenceTitleFor(t.number) || typeof t.check === "function"),
      "confirmed:trueなのにcheck関数が設定されていないトロフィーがあります"
    );
    // confirmed:trueのトロフィーは、必ずname/condition/modeの3項目とも
    // 設定されていること(推測で埋めていない・反映漏れが無いことの確認)
    console.assert(
      TROPHIES.every((t) => !t.confirmed || (typeof t.name === "string" && typeof t.condition === "string" && typeof t.mode === "string")),
      "confirmed:trueなのにname/condition/modeが未設定のトロフィーがあります"
    );
    // Stage A: #101〜112の参照型マップが、欠番を含まずちょうど12件で
    // TROPHIESに実在する番号だけを指していることを確認する
    const refNumbers = Object.keys(REFERENCE_TITLE_MAP).map(Number);
    console.assert(refNumbers.length === 12, `参照型トロフィーの件数が12件ではありません(実際: ${refNumbers.length}件)`);
    refNumbers.forEach((n) => {
      console.assert(numbers.has(n), `参照型トロフィー#${n}がTROPHIESに存在しません`);
    });
    // Stage A: 統計データの初期値が、自分自身のバリデータを通ることを確認する
    // (生成関数と検証関数の定義ミスによる食い違いを早期に検出するため)
    console.assert(isValidTrophyStats(emptyTrophyStats()), "emptyTrophyStats()の初期値がisValidTrophyStats()を通りません");
    // Stage E+首都トリビア追加+#142追加+世界図鑑追加: 153件全てに有効な
    // categoryが設定されていること、カテゴリの合計件数が153件と一致すること
    // (分類漏れ・重複分類が無いことの確認)
    const categoryIds = new Set(TROPHY_CATEGORIES.map((c) => c.id));
    console.assert(categoryIds.size === TROPHY_CATEGORIES.length, "TROPHY_CATEGORIESのidに重複があります");
    console.assert(
      TROPHIES.every((t) => typeof t.category === "string" && categoryIds.has(t.category)),
      "カテゴリが未設定、または未知のカテゴリのトロフィーがあります"
    );
    const categoryTotal = TROPHY_CATEGORIES.reduce((sum, c) => sum + TROPHIES.filter((t) => t.category === c.id).length, 0);
    console.assert(
      categoryTotal === 254 + PUZZLE_QUESTION_LIST.length + SEVEN_WONDERS_ALL_NUMBERS.length + COMMON_TROPHY_NUMBERS.length,
      `カテゴリ別件数の合計が254+謎解き件数+世界7不思議件数+共通トロフィー件数になっていません(実際: ${categoryTotal}件)`
    );
    // 共通トロフィー31種類(#395〜425)。すべてconfirmed:true・hidden:false
    // (未獲得でも名称・条件を表示する通常の公開トロフィー)であること
    const commonCategoryCount = TROPHIES.filter((t) => t.category === "common").length;
    console.assert(
      commonCategoryCount === COMMON_TROPHY_NUMBERS.length,
      `commonカテゴリの件数がCOMMON_TROPHY_NUMBERSの件数(31件)と一致しません(実際: ${commonCategoryCount}件)`
    );
    console.assert(
      TROPHIES.filter((t) => t.category === "common").every((t) => t.hidden === false && t.confirmed === true && typeof t.check === "function"),
      "共通トロフィーにhidden:true、confirmed:false、またはcheck未設定のものがあります"
    );
    // 【トロフィーカテゴリー修正】#393「ミステリーハンター」の表示用カテゴリーを
    // 「謎解きトロフィー」に変更したため、puzzleカテゴリーの件数はPUZZLE_
    // QUESTIONSの件数より1件多く、sevenWondersカテゴリーの件数は従来の
    // 7問+隠し特別2種(9件)より1件少ない8件になる(世界7不思議の機能自体が
    // 読み込まれていない場合は、#393自身のスロットが存在しないため、どちらの
    // 調整も加えない)
    const mysteryHunterMovedToPuzzle = SEVEN_WONDERS_QUESTION_LIST.length ? 1 : 0;
    const puzzleCategoryCount = TROPHIES.filter((t) => t.category === "puzzle").length;
    console.assert(
      puzzleCategoryCount === PUZZLE_QUESTION_LIST.length + mysteryHunterMovedToPuzzle,
      `puzzleカテゴリの件数がPUZZLE_QUESTIONSの件数(+ミステリーハンター1件)と一致しません(実際: ${puzzleCategoryCount}件)`
    );
    const sevenWondersCategoryCount = TROPHIES.filter((t) => t.category === "sevenWonders").length;
    console.assert(
      sevenWondersCategoryCount === SEVEN_WONDERS_ALL_NUMBERS.length - mysteryHunterMovedToPuzzle,
      `sevenWondersカテゴリの件数が世界7不思議の件数(7問+隠し特別1種(#394)、ミステリーハンター移動後)と一致しません(実際: ${sevenWondersCategoryCount}件)`
    );
    const mysteryHunterCategoryDef = TROPHIES.find((t) => t.number === MYSTERY_HUNTER_NUMBER);
    console.assert(
      !mysteryHunterCategoryDef || mysteryHunterCategoryDef.category === "puzzle",
      "#393「ミステリーハンター」のカテゴリーが謎解きトロフィーになっていません"
    );
    const omniscientGodCategoryDef = TROPHIES.find((t) => t.number === OMNISCIENT_GOD_NUMBER);
    console.assert(
      !omniscientGodCategoryDef || omniscientGodCategoryDef.category === "sevenWonders",
      "#394「全知全能の神」のカテゴリーが世界7不思議のまま保たれていません"
    );
    const findCountryCategoryCount = TROPHIES.filter((t) => t.category === "findcountry").length;
    console.assert(findCountryCategoryCount === 36, `findcountryカテゴリの件数が36件(#159〜194)ではありません(実際: ${findCountryCategoryCount}件)`);
    const findCountryHiddenCategoryCount = TROPHIES.filter((t) => t.category === "findcountry_hidden").length;
    console.assert(findCountryHiddenCategoryCount === 61, `findcountry_hiddenカテゴリの件数が61件(#195〜255)ではありません(実際: ${findCountryHiddenCategoryCount}件)`);
    const capitalTriviaCategoryCount = TROPHIES.filter((t) => t.category === "capital_trivia").length;
    console.assert(capitalTriviaCategoryCount === 29, `首都トリビアカテゴリの件数が29件ではありません(実際: ${capitalTriviaCategoryCount}件)`);
    // 世界図鑑カテゴリーは、既存の15件(#143〜157、#158は「世界の叡智」として
    // 既存どおりspecialカテゴリーのまま据え置き)に、今回追加した4件
    // (#259〜262)を加えた19件になる(#158を含めた「世界図鑑トロフィー20種類」
    // という企画上の総数は、modeフィールド(ENCYCLOPEDIA_19_NUMBERS+262で
    // 20件)で別途確認できる。categoryはあくまで一覧画面の表示用タブ分類)
    const encyclopediaCategoryCount = TROPHIES.filter((t) => t.category === "encyclopedia").length;
    console.assert(encyclopediaCategoryCount === 19, `世界図鑑カテゴリの件数が19件(#143〜157+#259〜262)ではありません(実際: ${encyclopediaCategoryCount}件)`);
    const encyclopediaThemedCount = TROPHIES.filter((t) => t.mode === "encyclopedia").length;
    console.assert(encyclopediaThemedCount === 20, `世界図鑑トロフィー(mode==="encyclopedia")の総数が20件ではありません(実際: ${encyclopediaThemedCount}件)`);
    const specialCategoryCount = TROPHIES.filter((t) => t.category === "special").length;
    console.assert(specialCategoryCount === 13, `特別チャレンジカテゴリの件数が13件(既存11件+#142+#158)ではありません(実際: ${specialCategoryCount}件)`);
    const legendDef = TROPHIES.find((t) => t.number === 142);
    console.assert(!!legendDef && legendDef.category === "special", "#142「都の神話」のカテゴリがspecialになっていません");
    const greatLegendDef = TROPHIES.find((t) => t.number === 158);
    console.assert(!!greatLegendDef && greatLegendDef.category === "special", "#158「世界の叡智」のカテゴリがspecialになっていません");
    // 隠しトロフィーは正式確定した74件(HIDDEN_TROPHY_NUMBERSの既存14件+
    // 隠しトロフィー61種類のうちNo.220を除く60件)+世界7不思議隠し特別2種
    // (js/seven-wonders-questions.jsが読み込まれていない場合は0件)のみ。
    // No.220は世界7不思議Ⅰの手がかりとして条件文を常時公開するため、
    // この件数から明示的に除外した(判定ロジック・保存キー自体は無変更)
    const expectedHiddenCount = 74 + (SEVEN_WONDERS_QUESTION_LIST.length ? 2 : 0);
    const hiddenDefs = TROPHIES.filter((t) => t.hidden === true);
    console.assert(hiddenDefs.length === expectedHiddenCount, `隠しトロフィーが${expectedHiddenCount}件ではありません(実際: ${hiddenDefs.length}件)`);
    console.assert(
      hiddenDefs.every((t) =>
        HIDDEN_TROPHY_NUMBERS.has(t.number)
        || (HIDDEN61_NUMBERS.includes(t.number) && t.number !== HIDDEN61_NOW_VISIBLE_NUMBER)
        || SEVEN_WONDERS_HIDDEN_SPECIAL_NUMBERS.has(t.number))
        && TROPHIES.filter((t) => !t.hidden).every((t) =>
          !HIDDEN_TROPHY_NUMBERS.has(t.number)
          && (t.number === HIDDEN61_NOW_VISIBLE_NUMBER || !HIDDEN61_NUMBERS.includes(t.number))
          && !SEVEN_WONDERS_HIDDEN_SPECIAL_NUMBERS.has(t.number)),
      "hiddenフラグが正式確定した76件(HIDDEN_TROPHY_NUMBERS+隠しトロフィー61種類のうちNo.220を除く60件+世界7不思議隠し特別2種)と一致していません"
    );
    // No.220自身はhidden61のstageのまま(判定ロジック不変)だが、表示上は
    // 例外的にhidden:falseになっていることを確認する
    const no220Def = TROPHIES.find((t) => t.number === HIDDEN61_NOW_VISIBLE_NUMBER);
    console.assert(
      !!no220Def && no220Def.hidden === false && no220Def.stage === "hidden61",
      "No.220「東京スカイツリー」がhidden:false・stage:\"hidden61\"のまま保たれていません"
    );
    console.assert(TROPHIES.every((t) => typeof t.hidden === "boolean"), "hiddenがboolean以外のトロフィーがあります");
    // 隠しトロフィー61種類実装(第2段階)で追加したstage("hidden61"|null)の
    // 自己検証。evaluate()の絞り込みが正しく機能する前提(stage==="hidden61"が
    // ちょうど61件)を確認する
    const stage61Defs = TROPHIES.filter((t) => t.stage === "hidden61");
    console.assert(stage61Defs.length === 61, `stage==="hidden61"のトロフィーが61件ではありません(実際: ${stage61Defs.length}件)`);
    console.assert(
      stage61Defs.every((t) => HIDDEN61_NUMBERS.includes(t.number)),
      "stageフラグがHIDDEN61_NUMBERSと一致していません"
    );
    // 世界7不思議 隠し特別2種(#393・#394)だけがstage==="sevenWondersSpecial"を
    // 持つ(evaluate()の絞り込みにより、通常のクイズ終了・世界図鑑閲覧等の
    // 既存の呼び出し経路からは一切判定されない。js/trophy.js内の
    // evaluatePuzzleAnswer・evaluateSevenWonderAnswer・
    // evaluateSevenWondersCatchUpの3箇所だけが、この2件を明示的に判定する)。
    // 残り(254+PUZZLE_QUESTION_LIST.length+7)件はstage===null(hidden61を除く)
    const stageSevenWondersSpecialDefs = TROPHIES.filter((t) => t.stage === "sevenWondersSpecial");
    console.assert(
      stageSevenWondersSpecialDefs.length === (SEVEN_WONDERS_QUESTION_LIST.length ? 2 : 0)
        && stageSevenWondersSpecialDefs.every((t) => SEVEN_WONDERS_HIDDEN_SPECIAL_NUMBERS.has(t.number)),
      `stage==="sevenWondersSpecial"のトロフィーが想定件数になっていません(実際: ${stageSevenWondersSpecialDefs.length}件)`
    );
    console.assert(
      TROPHIES.filter((t) => t.stage !== "hidden61" && t.stage !== "sevenWondersSpecial" && t.stage !== "commonChain").every((t) => t.stage === null),
      "stageが想定外の値(hidden61/sevenWondersSpecial/commonChain/null以外)のトロフィーがあります"
    );
    // 共通トロフィー31種類はすべてstage==="commonChain"(evaluate()の通常
    // ループでは判定せず、専用の連鎖判定だけが判定する内部マーカー)
    const stageCommonChainDefs = TROPHIES.filter((t) => t.stage === "commonChain");
    console.assert(
      stageCommonChainDefs.length === COMMON_TROPHY_NUMBERS.length
        && stageCommonChainDefs.every((t) => COMMON_TROPHY_NUMBERS.includes(t.number)),
      `stage==="commonChain"のトロフィーが想定件数(31件)になっていません(実際: ${stageCommonChainDefs.length}件)`
    );
    // 世界図鑑の地域制覇6件(#148〜153)の対象国数合計が、COUNTRIES全件数と
    // 一致すること(ハードコードした想定件数ではなく、countryIdsInRegion()が
    // 実際に返す値で確認する。198件目の閲覧で6地域とも同時に制覇済みになる
    // という#158の前提が、データの変化によって崩れていないかの確認)
    const regionTotal = ["asia", "europe", "africa", "namerica", "samerica", "oceania"]
      .reduce((sum, r) => sum + countryIdsInRegion(r).length, 0);
    console.assert(regionTotal === ALL_COUNTRY_IDS.length, `世界図鑑の地域別対象国数の合計(${regionTotal})がCOUNTRIES件数(${ALL_COUNTRY_IDS.length})と一致していません`);
  })();

  // ==========================================================
  // #142「都の神話」過去データ救済処理。
  // アップデート前に既に首都トリビア29種類すべてを獲得していたプレイヤーにも
  // 対応するため、このモジュールの読み込み時(=アプリ起動時・トロフィー
  // 情報の初期化時)に1度だけ、「29種類すべて獲得済みだが#142はまだ未獲得」
  // という状態を確認し、該当する場合はここでawardIfNew()するだけで静かに
  // 登録する。evaluate()を経由しないため、この登録はstate.lastResult.
  // newTrophyIdsには一切含まれず、js/app.js側の獲得通知・専用演出画面は
  // 呼ばれない(アプリ起動のたびに演出を繰り返さないための設計)。
  // すでに登録済みなら即座にreturnするだけの安価な処理のため、毎回の
  // ページ読み込みで実行しても問題ない。保存データの削除・初期化は一切
  // 行わず、既存トロフィーのearnedAtにも触れない。新規登録される場合の
  // #142のearnedAtは、実際にこの処理が実行された時刻になる
  // (awardIfNew()が内部でnew Date().toISOString()を使うのを再利用するだけ)
  // ==========================================================
  (function reconcileLegendTrophy() {
    try {
      if (isEarned("trophy_142")) return; // 既に獲得済みなら何もしない(再獲得・再登録はしない)
      if (!allCapitalTriviaEarned()) return; // 首都トリビア29種類に未獲得が残っていれば対象外
      awardIfNew("trophy_142");
    } catch (e) {
      console.warn("「都の神話」の過去データ救済処理に失敗しました", e);
    }
  })();

  function isValidTrophyId(id) {
    return typeof id === "string" && TROPHY_BY_ID.has(id);
  }

  function emptyTrophyData() {
    return { version: TROPHY_VERSION, earned: {} };
  }

  // バージョン不一致(将来の形式変更・壊れたデータ等)の場合は安全側に倒し、
  // 空データとして扱う(既存のfindcountry系ストレージ関数と同じ考え方。
  // js/storage.jsのloadFindCountryRankingData()等を参照)。
  function loadTrophyData() {
    const raw = safeGet(TROPHY_KEY);
    if (!raw) return emptyTrophyData();
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || parsed.version !== TROPHY_VERSION
        || !parsed.earned || typeof parsed.earned !== "object") {
        return emptyTrophyData();
      }
      return parsed;
    } catch (e) {
      console.warn("トロフィー獲得データの読み込みに失敗しました。保存データを初期化します", e);
      return emptyTrophyData();
    }
  }

  function saveTrophyData(data) {
    return safeSet(TROPHY_KEY, JSON.stringify(data));
  }

  // ========================================================
  // Stage A: 新しい累計カウンタ・履歴の保存領域(wfq_v1_trophy_stats)。
  // ここでは「保存・読み込み・初期化」の骨組みだけを用意し、実際に値を
  // 書き込む判定ロジック(#58の満点回数カウント等)はStage C以降で実装する。
  // 形はdocs/trophy-spec-final.md 3章の設計案に合わせてある。
  // ========================================================
  function emptyTrophyStats() {
    return {
      version: TROPHY_STATS_VERSION,
      perfectCounts: { flag: 0, capital: 0 }, // #58用
      fastAnswerCounts: { flag: {}, capital: {} }, // #21・#26・#27用
      partialStreakCounts: { flag: 0, capital: 0 }, // #60用(合算して使う想定)
      countryCorrectEver: { flag: {}, capital: {} }, // #30〜38用
      countryCorrectCount: { flag: {}, capital: {} }, // #39用
      countryWrongEver: { flag: {}, capital: {} }, // #63・#68用
      lastCourseResult: { flag: {}, capital: {} }, // #66用
    };
  }

  function isPlainObject(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }

  function isNonNegativeInteger(v) {
    return Number.isInteger(v) && v >= 0;
  }

  // 国idがjs/countries.jsのCOUNTRIES(198件)に実在するかどうか。
  // countryRegionById()が既に持つキャッシュをそのまま再利用し(#62用に
  // Stage Bで追加済み)、同じ探索をもう一つ作らない
  function isKnownCountryId(id) {
    return typeof id === "string" && countryRegionById(id) !== null;
  }

  // {flag: n, capital: n} の形(nは0以上の整数)かどうか(#58・60用)
  function isValidModeCountPair(v) {
    return isPlainObject(v) && isNonNegativeInteger(v.flag) && isNonNegativeInteger(v.capital);
  }

  // {countryId: true, ...} の形かどうか(未知のidや値がtrue以外のものは
  // 許容しない。#30〜38・63・68用)
  function isBooleanTrueMap(v) {
    if (!isPlainObject(v)) return false;
    return Object.keys(v).every((id) => isKnownCountryId(id) && v[id] === true);
  }

  // {countryId: n, ...} の形かどうか(nは0以上の整数。#39用)
  function isCountMap(v) {
    if (!isPlainObject(v)) return false;
    return Object.keys(v).every((id) => isKnownCountryId(id) && isNonNegativeInteger(v[id]));
  }

  // fastAnswerCountsのモード別バケット({within2s?, within3s?}。#21・26・27用)
  function isFastAnswerModeBucket(v) {
    if (!isPlainObject(v)) return false;
    return Object.keys(v).every((k) => (k === "within2s" || k === "within3s") && isNonNegativeInteger(v[k]));
  }

  // lastCourseResultのモード別マップ({"10":{correct,total}, ...}。#66用。
  // コースのキーは既存6コース(ALL_COURSE_COUNTS)のいずれかの文字列のみ許容する
  function isCourseResultMap(v) {
    if (!isPlainObject(v)) return false;
    const validKeys = ALL_COURSE_COUNTS.map(String);
    return Object.keys(v).every((k) => {
      if (!validKeys.includes(k)) return false;
      const rec = v[k];
      return isPlainObject(rec) && isNonNegativeInteger(rec.correct) && isNonNegativeInteger(rec.total) && rec.correct <= rec.total;
    });
  }

  // バージョン不一致・壊れたデータ・旧形式のいずれでも安全側に倒し、
  // 空の初期データとして扱う(既存のloadTrophyData()と同じ考え方)。
  // Stage Aでは骨組みのみで実際に書き込まれることが無かったため、各
  // フィールドの最上位がplain objectであることだけを確認していたが、
  // Stage Cから実際にrecordQuizStats()が書き込むようになったため、国idごとの
  // 値・モード別の数値まで形を確認し、1つでも想定と違えば丸ごと初期化する
  // (部分的に壊れたデータを中途半端に信用しない)
  function isValidTrophyStats(data) {
    return isPlainObject(data)
      && data.version === TROPHY_STATS_VERSION
      && isValidModeCountPair(data.perfectCounts)
      && isPlainObject(data.fastAnswerCounts) && isFastAnswerModeBucket(data.fastAnswerCounts.flag) && isFastAnswerModeBucket(data.fastAnswerCounts.capital)
      && isValidModeCountPair(data.partialStreakCounts)
      && isPlainObject(data.countryCorrectEver) && isBooleanTrueMap(data.countryCorrectEver.flag) && isBooleanTrueMap(data.countryCorrectEver.capital)
      && isPlainObject(data.countryCorrectCount) && isCountMap(data.countryCorrectCount.flag) && isCountMap(data.countryCorrectCount.capital)
      && isPlainObject(data.countryWrongEver) && isBooleanTrueMap(data.countryWrongEver.flag) && isBooleanTrueMap(data.countryWrongEver.capital)
      && isPlainObject(data.lastCourseResult) && isCourseResultMap(data.lastCourseResult.flag) && isCourseResultMap(data.lastCourseResult.capital);
  }

  function loadTrophyStats() {
    const raw = safeGet(TROPHY_STATS_KEY);
    if (!raw) return emptyTrophyStats();
    try {
      const parsed = JSON.parse(raw);
      if (!isValidTrophyStats(parsed)) return emptyTrophyStats();
      return parsed;
    } catch (e) {
      console.warn("トロフィー統計データの読み込みに失敗しました。保存データを初期化します", e);
      return emptyTrophyStats();
    }
  }

  function saveTrophyStats(data) {
    return safeSet(TROPHY_STATS_KEY, JSON.stringify(data));
  }

  // 読み取り専用のコピーを返す(呼び出し元が直接書き換えても内部状態や
  // localStorageには影響しない)。
  function getStats() {
    return JSON.parse(JSON.stringify(loadTrophyStats()));
  }

  // ========================================================
  // Stage C: 統計・履歴の記録(判定は一切行わない)。
  // js/app.jsのfinishQuiz()から、evaluateQuizFinish()(判定エンジン)の直後に
  // 1回だけ呼ばれる想定。完了していないプレイ(「終了する」での中断)では
  // finishQuiz()自体が呼ばれないため、ここに到達することもなく、既存の
  // 「プレイ回数は完了時のみ加算」という原則と自動的に揃う。
  //
  // context: evaluateQuizFinish()と同じ形に、Stage Cで追加した
  // startedAt(プレイ開始時刻のISO文字列)・answerTimings(各問題の
  // { countryId, correct, elapsedSeconds } 配列)を加えたもの。
  //
  // 重要: lastCourseResult(#66用)はこの関数が「直前の値を上書きする」。
  // 将来Stage C以降で#66の判定ロジックを実装する際は、そのロジックを
  // 必ずrecordQuizStats()より前(evaluateQuizFinish()の中、またはそれより
  // 前)に置き、上書き前の値を読むこと。呼び出し順を変えると「直前の
  // プレイ」の比較対象が自分自身になってしまう。
  // ========================================================
  function recordQuizStats(context) {
    try {
      if (!context || (context.mode !== "flag" && context.mode !== "capital")) return false;
      const mode = context.mode;
      const total = context.total;
      const correct = context.correct;
      if (!Number.isFinite(total) || !Number.isFinite(correct)) return false;
      const stats = loadTrophyStats();

      // #58用: 198問コースでの満点回数(モード別)
      if (total === 198 && correct === total) {
        stats.perfectCounts[mode] = stats.perfectCounts[mode] + 1;
      }

      // #60用: 10問コースで9問正解だった回数(モード別。判定時に合算する想定)
      if (total === 10 && correct === 9) {
        stats.partialStreakCounts[mode] = stats.partialStreakCounts[mode] + 1;
      }

      // #21・26・27用: 正解かつ2秒/3秒以内だった回答の累計回数(モード別)。
      // 2秒以内の正解は3秒以内の条件も満たすため、両方のカウンタに加算する
      if (Array.isArray(context.answerTimings)) {
        context.answerTimings.forEach((t) => {
          if (!t || !t.correct || !Number.isFinite(t.elapsedSeconds)) return;
          if (t.elapsedSeconds <= 3) stats.fastAnswerCounts[mode].within3s = (stats.fastAnswerCounts[mode].within3s || 0) + 1;
          if (t.elapsedSeconds <= 2) stats.fastAnswerCounts[mode].within2s = (stats.fastAnswerCounts[mode].within2s || 0) + 1;
        });
      }

      // #30〜39用: 国別の生涯正解履歴(真偽値+回数、モード別)
      if (Array.isArray(context.correctIds)) {
        context.correctIds.forEach((id) => {
          if (!isKnownCountryId(id)) return;
          stats.countryCorrectEver[mode][id] = true;
          stats.countryCorrectCount[mode][id] = (stats.countryCorrectCount[mode][id] || 0) + 1;
        });
      }

      // #63・68用: 国別の誤答履歴(モード別、真偽値のみ)。#63は同じモードの
      // 履歴を、#68は国旗側の履歴を首都プレイ側の判定が参照する想定のため、
      // モードをまたいで混ぜずそれぞれ別に保持する
      if (Array.isArray(context.wrongIds)) {
        context.wrongIds.forEach((id) => {
          if (!isKnownCountryId(id)) return;
          stats.countryWrongEver[mode][id] = true;
        });
      }

      // #66用: 同一モード・同一コースの「直前の完了プレイ」の結果を、
      // 今回の結果で上書きする(関数コメント参照。将来の判定はこの行より
      // 前で旧い値を読む必要がある)
      stats.lastCourseResult[mode][String(total)] = { correct, total };

      return saveTrophyStats(stats);
    } catch (e) {
      console.warn("トロフィー統計の記録に失敗しました", e);
      return false;
    }
  }

  // ---------- 公開API ----------
  // 137件すべての定義を返す(読み取り専用の用途を想定。一覧画面・
  // 判定処理の両方がここを参照する)
  function getAllDefinitions() {
    return TROPHIES.slice();
  }

  function getDefinition(id) {
    return TROPHY_BY_ID.get(id) || null;
  }

  function getDefinitionByNumber(number) {
    return TROPHIES.find((t) => t.number === number) || null;
  }

  function isValidEarnedAtValue(v) {
    return isPlainObject(v) && typeof v.earnedAt === "string" && !Number.isNaN(Date.parse(v.earnedAt));
  }

  // 1件分の獲得データを安全な形に正規化する。common型(mode省略で獲得した
  // もの)は { earnedAt }、デュアル型(mode指定で獲得したもの)は
  // { flag: {earnedAt} } / { capital: {earnedAt} } / 両方、のいずれかの形を
  // 許容する。どちらの形としても解釈できない壊れたデータはnullを返す
  function sanitizeEarnedEntry(entry) {
    if (isValidEarnedAtValue(entry)) return { earnedAt: entry.earnedAt };
    if (isPlainObject(entry)) {
      const out = {};
      if (isValidEarnedAtValue(entry.flag)) out.flag = { earnedAt: entry.flag.earnedAt };
      if (isValidEarnedAtValue(entry.capital)) out.capital = { earnedAt: entry.capital.earnedAt };
      if (Object.keys(out).length > 0) return out;
    }
    return null;
  }

  // 獲得済みトロフィーを { [id]: { earnedAt } | { flag?, capital? } } の形で
  // 読み取り専用に返す。#101〜112(参照型)は新規保存領域を見ず、既存の
  // Storage.hasTitle()/getEarnedTitles()から都度合成する(二重保存しない)。
  // それ以外のidは、不正なエントリー(壊れたデータ・定義に無いid)をここで
  // 除外する(js/storage.jsのgetFindCountryCollection()と同じ防御的な考え方)
  function getEarned() {
    const data = loadTrophyData();
    const sanitized = {};
    TROPHIES.forEach((t) => {
      const ref = referenceTitleFor(t.number);
      if (ref) {
        if (typeof Storage === "undefined") return;
        try {
          const titles = Storage.getEarnedTitles(ref.mode);
          const rec = titles && titles[ref.id];
          if (rec && typeof rec.earnedAt === "string") {
            sanitized[t.id] = { earnedAt: rec.earnedAt };
          }
        } catch (e) {
          // 既存称号の読み込みに失敗しても、この番号を未獲得扱いにするだけで
          // 他のトロフィーの判定・画面表示は止めない
        }
        return;
      }
      const entry = sanitizeEarnedEntry(data.earned[t.id]);
      if (entry) sanitized[t.id] = entry;
    });
    return sanitized;
  }

  // mode省略時: common型の獲得状態を返す。mode指定時: そのモード(flag/
  // capital)だけの獲得状態を返す(デュアル型トロフィー用)。#101〜112は
  // referenceTitleForの時点でmode引数を無視し、常にその番号固有の既存称号
  // モードを参照する(getEarned()が既に正しいモードで合成しているため)
  function isEarned(id, mode) {
    const entry = getEarned()[id];
    if (!entry) return false;
    if (mode === "flag" || mode === "capital") return !!entry[mode];
    return !!entry.earnedAt;
  }

  // 新規獲得として記録する。戻り値: 実際に新規記録できればtrue。
  // 不正なid・参照型id(#101〜112、二重保存を防ぐため常に拒否)・
  // 既に獲得済み・保存失敗のいずれでもfalseを返し、何も変えない
  // (同じidで何度呼んでも安全。js/storage.jsのawardTitleIfNew()・
  // captureFindCountryEntry()と同じ重複防止の考え方)。
  // mode省略時はcommon型(単一の共通状態)、"flag"/"capital"指定時は
  // そのモードだけの状態をデュアル型として記録する
  function awardIfNew(id, mode) {
    try {
      if (!isValidTrophyId(id)) return false;
      const def = getDefinition(id);
      if (referenceTitleFor(def.number)) return false; // 参照型は新規書き込みしない
      if (mode !== undefined && mode !== null && mode !== "flag" && mode !== "capital") return false;
      const data = loadTrophyData();
      const existing = sanitizeEarnedEntry(data.earned[id]);
      if (mode === "flag" || mode === "capital") {
        if (existing && existing[mode]) return false; // そのモードは既に獲得済み
        const merged = (existing && !existing.earnedAt) ? Object.assign({}, existing) : {};
        merged[mode] = { earnedAt: new Date().toISOString() };
        data.earned[id] = merged;
      } else {
        if (existing) return false; // 既にcommon型として獲得済み
        data.earned[id] = { earnedAt: new Date().toISOString() };
      }
      return saveTrophyData(data);
    } catch (e) {
      console.warn("トロフィーの獲得記録に失敗しました", e);
      return false;
    }
  }

  // 獲得数の概要(一覧画面上部の「n / m 件 獲得」表示用)。
  // 集計方式A案: DUAL_SPLIT_CARD_NUMBERS(No.1〜19・#21・26・27・30〜39、
  // 合計32種類)は国旗・首都を独立した2枠として数え、それぞれ達成して
  // いれば1、両方達成していれば2として加算する(一覧画面でもこの32種類
  // だけを国旗用/首都用の2枚の独立カードに分割表示するため、カード単位の
  // 枚数と集計を一致させる)。それ以外は従来どおりid単位で1枚=1個として
  // 数える(218件+32種類の2枠=282件、ただし282を直接埋め込まず
  // TROPHIES・DUAL_SPLIT_CARD_NUMBERSから算出する)
  function getProgressSummary() {
    const earned = getEarned();
    let earnedCount = 0;
    let totalCount = 0;
    TROPHIES.forEach((t) => {
      if (isDualSplitCardNumber(t.number)) {
        totalCount += 2;
        const entry = earned[t.id];
        if (entry && entry.flag) earnedCount += 1;
        if (entry && entry.capital) earnedCount += 1;
      } else {
        totalCount += 1;
        if (earned[t.id]) earnedCount += 1;
      }
    });
    return { earnedCount, totalCount };
  }

  // ========================================================
  // 第2段階: 既存データだけから導出できる判定ヘルパー(読み取り専用の
  // 純粋関数)。どれも新しい保存領域を追加しない。将来、正式な107項目の
  // 内容が確定した際に、各トロフィーのcheck関数の中からこれらを呼び出す
  // ことを想定している(現時点ではどの番号にも割り当てていない)。
  // ========================================================

  // 国旗/首都いずれか一方の「指定した問題数での全問正解」称号(既存の
  // js/quiz.jsのTITLES/CAPITAL_TITLES、js/storage.jsのawardTitleIfNew()で
  // 既に記録されているもの)が獲得済みかどうかを調べる。
  // getTitleByCount()はjs/quiz.jsのグローバル関数をそのまま利用する
  // (複製しない)。count は10/20/30/50/100/198のいずれか
  function isModeTitlePerfectEarned(count, mode) {
    if (typeof getTitleByCount !== "function" || typeof Storage === "undefined") return false;
    const titleObj = getTitleByCount(count, mode);
    if (!titleObj) return false;
    return Storage.hasTitle(titleObj.id, mode);
  }

  // 「国旗クイズと首都クイズの両方」で、同じ問題数の称号(全問正解)が
  // 揃って獲得済みかどうか。「国旗と首都の両方での達成」系の将来の
  // トロフィーが、既存データだけで判定できることを示す例
  function isBothModesTitlePerfectEarned(count) {
    return isModeTitlePerfectEarned(count, "flag") && isModeTitlePerfectEarned(count, "capital");
  }

  // 「世界の国どこかな？」のコレクション(Storage.getFindCountryCollection()、
  // 正解した国・地域の記録)を、指定した地域(region、例: "asia")だけに
  // 絞って集計する。「地域別の全問正解」系の将来のトロフィーが、既存の
  // コレクション機能だけで判定できることを示す例。対象はCOUNTRIES(198件)+
  // MAP_ONLY_REGIONS(18件、定義されていれば)の計216件のうち、該当地域の件数
  function getFindCountryRegionProgress(region) {
    const all = (typeof COUNTRIES !== "undefined" ? COUNTRIES : [])
      .concat(typeof MAP_ONLY_REGIONS !== "undefined" ? MAP_ONLY_REGIONS : []);
    const regionEntries = all.filter((c) => c.region === region);
    const totalCount = regionEntries.length;
    if (totalCount === 0 || typeof Storage === "undefined") {
      return { region, capturedCount: 0, totalCount, allCaptured: false };
    }
    const collection = Storage.getFindCountryCollection();
    const capturedCount = regionEntries.filter((c) => Object.prototype.hasOwnProperty.call(collection, c.id)).length;
    return { region, capturedCount, totalCount, allCaptured: capturedCount === totalCount };
  }

  // 「指定された2か国を同じプレイで正解」系の判定補助。呼び出し側
  // (evaluateQuizFinish/evaluateFindCountryResult)が、そのプレイで実際に
  // 正解した国・地域idの集合(Set)を組み立てて渡す。この関数自体は
  // 「2つのidが両方ともその集合に含まれているか」を調べるだけの汎用的な
  // 純粋関数で、どの2か国を対象にするかは将来の正式な条件が決まってから
  // 各トロフィーのcheck関数側で指定する
  function arePairCorrect(idA, idB, correctIdSet) {
    if (!correctIdSet || typeof correctIdSet.has !== "function") return false;
    return correctIdSet.has(idA) && correctIdSet.has(idB);
  }

  // ========================================================
  // 第2段階: 判定エンジン(クイズ結果確定後に1回だけ呼ばれる想定)。
  // confirmed:trueかつcheck関数が設定されているスロットだけを対象にする。
  // 現時点ではconfirmed:trueのスロットが1件も無いため、このevaluate()は
  // 必ず{ awardedIds: [] }を返す「安全な空振り」になる(自己検証
  // validateTrophyDefinitions()のconfirmedCount===0のチェックと対応)。
  // 正式な107項目の内容が決まり、各トロフィーにcheck関数を設定した段階で、
  // 呼び出し元(js/app.js・js/findcountry.js)のコードを変更せずに機能し出す
  // 設計にしてある。
  // ========================================================
  // Stage A: t.mode==="both"のトロフィーはデュアル型として扱い、
  // context.mode("flag"|"capital")に対応する側だけを判定・記録する。
  // それ以外(mode未設定のcommon型・Stage A時点では存在しない)は従来どおり
  // 単一の共通状態として扱う。今回はconfirmed:trueのスロットが1件も無い
  // ため、この分岐が実際に通ることはない(安全な空振りのまま)
  // options.onlyStage: 隠しトロフィー61種類実装(第2段階)で追加。指定時は
  // t.stageが一致するトロフィーだけを判定する(他は一切チェックしない)。
  // 省略時(既存の全呼び出し元)は、t.stage==="hidden61"の61件と
  // t.stage==="sevenWondersSpecial"の2件(ミステリーハンター・全知全能の神)を
  // 常にスキップする(evaluateFindCountryHiddenProgress・
  // evaluatePuzzleAnswer・evaluateSevenWonderAnswer・
  // evaluateSevenWondersCatchUpの専用呼び出し経路からしか判定されないように
  // するための隔離。既存#1〜385・世界図鑑追加分の判定タイミング・通知経路
  // には一切影響しない。特にsevenWondersSpecialは、context無しで常にtrueに
  // なりうる判定(Storage/既存獲得記録だけを見る)のため、クイズ終了・
  // 世界図鑑閲覧等の既存呼び出し経路に紛れ込むと、本来の獲得通知演出を
  // 経由せず静かに獲得記録だけが書き込まれてしまう。これを避けるため
  // 常に明示的な呼び出し経路からしか判定しない)。
  // 戻り値のhiddenAwardedIdsには、今回新たに獲得が確定したstage==="hidden61"の
  // idだけが入る(awardedIdsには入らないため、既存の呼び出し元(js/app.js・
  // js/findcountry.js)が行う獲得通知・専用演出のトリガーには一切混入しない。
  // 保存(awardIfNew)自体はawardedIds/hiddenAwardedIdsのどちらに入るかに
  // 関わらず、条件を満たした瞬間に必ず行われる)
  function evaluate(context, options) {
    const onlyStage = options && options.onlyStage;
    const awardedIds = [];
    const hiddenAwardedIds = [];
    TROPHIES.forEach((t) => {
      if (!t.confirmed || typeof t.check !== "function") return;
      // 共通トロフィー31種類(stage==="commonChain")は、このループでは一切
      // 判定しない。専用の連鎖判定(evaluateCommonTrophiesChain、下記)だけが
      // 判定・付与する(通常のcontext依存の判定とは異なり、保存済みの
      // 進捗・獲得状況だけを見るため、1回のevaluate()呼び出しの中で複数回
      // 判定し直す必要があり、このforEachの1パスだけでは不十分なため)
      if (t.stage === "commonChain") return;
      if (onlyStage) {
        if (t.stage !== onlyStage) return;
      } else if (t.stage === "hidden61" || t.stage === "sevenWondersSpecial") {
        return;
      }
      const isDual = t.mode === "both";
      const subMode = isDual ? (context && context.mode) : undefined;
      if (isDual && subMode !== "flag" && subMode !== "capital") return; // デュアル型は対象モードのcontextでしか判定しない
      if (isEarned(t.id, subMode)) return; // 既に獲得済みなら判定自体を省略する
      let qualifies = false;
      try {
        qualifies = !!t.check(context);
      } catch (e) {
        console.warn(`トロフィー判定関数でエラーが発生しました(number=${t.number})`, e);
        qualifies = false;
      }
      if (qualifies && awardIfNew(t.id, subMode)) {
        if (t.stage === "hidden61") hiddenAwardedIds.push(t.id); else awardedIds.push(t.id);
      }
    });
    // 共通トロフィー31種類の連鎖判定は、既存トロフィーの獲得判定が確定した
    // 直後に実行する。1件の既存トロフィー獲得(このevaluate()呼び出し自身
    // によるもの、または以前の獲得)が、累計獲得数・各モード完全制覇等の
    // 共通トロフィーの条件を新たに満たす可能性があるため。共通トロフィーは
    // すべて通常の公開トロフィーのため、hiddenAwardedIdsではなくawardedIds
    // に積む。
    // 【性能対策】onlyStage指定時(js/findcountry.jsのevaluateFindCountry
    // HiddenProgress()、1プレイ中の全タップで呼ばれる高頻度の「途中経過」
    // 専用呼び出し)は、ここでは連鎖判定を行わない。この呼び出し経路は
    // 1プレイの最終結果が確定する前の中間状態を見るためだけのもので、
    // 同じプレイが最終的にevaluateFindCountryResult()(onlyStage省略)を
    // 必ず経由するため、そこで改めて判定すれば正しさは変わらない。
    // タップごとにgetEarned()(localStorageの読み込み・JSON解析・TROPHIES
    // 420件分の走査を伴う)を呼ぶコストを避けるための最適化で、共通
    // トロフィーの判定結果・タイミングには影響しない
    if (!onlyStage) {
      evaluateCommonTrophiesChain().forEach((id) => awardedIds.push(id));
    }
    return { awardedIds, hiddenAwardedIds };
  }

  // 国旗クイズ・首都クイズ(js/app.jsのfinishQuiz())からの呼び出し専用。
  // context: { mode("flag"|"capital"), total, correct, rate, perfect,
  //            wrongIds(配列), correctIds(配列), questionIds(配列) }
  function evaluateQuizFinish(context) {
    // 共通トロフィー: finishQuiz()は「戻る」等による途中中断では呼ばれず、
    // 常に正式な終了処理を経て結果画面に到達した場合だけ呼ばれるため、
    // ここが「プレイ完了」の正しい記録タイミングになる。30問パーフェクト
    // (トリプルスリー用)・198問クリア(三冠王用。国旗・首都には明確な
    // クリア/失敗の判定が無いため、198問を完了したこと自体をクリアとみなす)
    try {
      if (context && (context.mode === "flag" || context.mode === "capital")) {
        recordCommonPlayCompletion(context.mode, {
          perfect30: context.total === 30 && context.correct === context.total,
          clear198: context.total === 198,
        });
      }
    } catch (e) {
      console.warn("共通トロフィーの進捗記録に失敗しました(クイズ結果には影響しません)", e);
    }
    return evaluate(Object.assign({ source: "quiz" }, context));
  }

  // 「世界の国どこかな？」(js/findcountry.jsのshowResult())からの呼び出し
  // 専用。context: { difficultyId, correctCount, answered, target, maxLives,
  //                   maxStreak, isNormalClear, isProComplete, noMistakes,
  //                   noMissClear, perfectClear, endReason, lifeAtOneMoment,
  //                   mistakeEvents(配列、{order, questionNumber, countryId,
  //                   kind("wrong"|"pass"|"timeout"), livesAfter}。ライフが
  //                   減った出来事を起きた順序どおりに1件ずつ積んだもので、
  //                   同じ問題で複数回誤答した場合もそれぞれ独立した要素に
  //                   なる。再挑戦の末に正解した問題の誤答も削除されない)、
  //                   gameOver, results(配列、各要素はfirstTryCorrect・
  //                   wrongAttempts・zoomUsedを含む。No.190はzoomUsedを
  //                   問題単位で参照する) }。noMissClear/perfectClear/
  //                   endReason/lifeAtOneMoment/mistakeEventsは隠しトロフィー
  //                   61種類実装(第1段階)で追加した判定基盤で、現時点では
  //                   どのcheck()もまだ参照しない(将来の追加分がここから使う)
  function evaluateFindCountryResult(context) {
    // 共通トロフィー: showResult()は「戻る」等による途中中断(abandoned)では
    // 呼ばれず、通常クリア・規定ミス数到達によるゲームオーバー・出題対象を
    // 使い切った場合にだけ呼ばれるため、ここが「プレイ完了」の正しい記録
    // タイミングになる。30問パーフェクト(トリプルスリー用、PROは対象外)・
    // 上級30問クリア(三冠王用)
    try {
      if (context) {
        recordCommonPlayCompletion("findcountry", {
          perfect30: context.target === 30 && context.difficultyId !== "pro" && !!context.isNormalClear && !!context.noMistakes,
          clearAdvanced30: context.difficultyId === "advanced" && context.target === 30 && !!context.isNormalClear,
        });
      }
    } catch (e) {
      console.warn("共通トロフィーの進捗記録に失敗しました(結果には影響しません)", e);
    }
    return evaluate(Object.assign({ source: "findcountry", event: "result" }, context));
  }

  // 「世界の国どこかな？」専用トロフィーNo.159「地図への第一歩」・No.172
  // 「秘境への扉」用: 1プレイの終了を待たず、正解したその瞬間
  // (js/findcountry.jsのfinalizeAnswer())に1回だけ呼ばれる。resultsのような
  // 1プレイ単位の集計を持たないため、isFindCountryPlayResult()のガードに
  // よってそれ以外のfindcountry34種はここでは判定されない(安全な空振り)。
  // 判定ロジック自体はevaluate()に一本化されており、ここで複製していない。
  // context.mistakeEventsには、この正解タップより前のミス履歴(上記と同じ形)
  // が渡される(隠しトロフィー61種類実装(第1段階)で追加。今後の即時獲得
  // 判定がプレイ終了を待たずミス履歴を参照できるようにするための基盤)
  function evaluateFindCountryAnswer(context) {
    return evaluate(Object.assign({ source: "findcountry", event: "answer" }, context));
  }

  // 隠しトロフィー61種類(#195〜255、第2段階)専用の呼び出し経路。
  // js/findcountry.jsのfinalizeAnswer()から、正解・不正解・パス・時間切れの
  // 全パターンで(1問の最終結果が確定するたびに)呼ばれる。contextは
  // evaluateFindCountryResultと同じ形だが、プレイ終了を待たず「今の時点
  // までの状態」として都度計算した値を渡す想定(詳細はjs/findcountry.jsの
  // computeFindCountryLiveState()参照)。onlyStage:"hidden61"を指定することで
  // evaluate()はこの61件だけを判定し、既存#1〜194を一切再評価しない
  // (評価タイミングを増やしても既存トロフィーの獲得条件・通知タイミングに
  // 影響を与えないための隔離)。戻り値のhiddenAwardedIdsだけを使うこと
  // (awardedIdsは常に空になる)
  function evaluateFindCountryHiddenProgress(context) {
    return evaluate(Object.assign({ source: "findcountry", event: "progress" }, context), { onlyStage: "hidden61" });
  }

  // 世界図鑑(js/encyclopedia.js)からの呼び出し専用。クイズのような
  // state.lastResult相当の結果情報を一切前提にしない(context自体は
  // 使わず、常にStorageの現在の集計値を見て判定する)。詳細ページを開いた
  // 瞬間・地図連携から確認した瞬間・復習画面から開いた瞬間など、図鑑に
  // 関する新しい事実がjs/storage.jsに記録された直後に呼ぶ想定
  function evaluateEncyclopediaVisit(context) {
    // 共通トロフィー(四つの扉): この呼び出し自体が「世界図鑑に関する新しい
    // 事実が記録された直後」に限って呼ばれるため、詳細ページを実際に
    // 開いたことの記録として扱って良い
    try {
      recordCommonModeUsed("encyclopedia");
    } catch (e) {
      console.warn("共通トロフィーの利用記録に失敗しました(図鑑には影響しません)", e);
    }
    return evaluate(Object.assign({ source: "encyclopedia" }, context));
  }

  // 謎解き(js/puzzle.jsのhandleSubmit())からの呼び出し専用。
  // context: { questionId(挑戦中の問題id), correct(真偽値) }。
  // STAGE_PUZZLE_DEFINITIONSのcheck関数がctx.questionIdの完全一致を
  // 要求するため、挑戦中の問題以外のトロフィーが誤って獲得されることは
  // 構造上発生しない。correct:falseで呼んでも(呼ばれない想定だが)、
  // check関数がctx.correct===trueを要求するため何も獲得しない
  // 通常謎解き(#256〜385、世界7不思議は含まない)の正解判定に加え、同じ
  // 呼び出しの中で、stage==="sevenWondersSpecial"(ミステリーハンターのみ。
  // 全知全能の神はここでは絶対にtrueにならない)も明示的に判定する。これに
  // より、通常謎解きの最後の1問に正解した「その瞬間」にミステリーハンターも
  // 即座に獲得される(js/puzzle.js側が、戻り値のawardedIds配列に両方のidが
  // 入っている場合があることを前提に演出をつなげる)
  function evaluatePuzzleAnswer(context) {
    const normal = evaluate(Object.assign({ source: "puzzle" }, context));
    const special = evaluate(Object.assign({ source: "puzzle" }, context), { onlyStage: "sevenWondersSpecial" });
    return {
      awardedIds: normal.awardedIds.concat(special.awardedIds),
      hiddenAwardedIds: normal.hiddenAwardedIds.concat(special.hiddenAwardedIds),
    };
  }

  // 世界7不思議(js/puzzle.jsのhandleSubmit())からの呼び出し専用。
  // context: { questionId(挑戦中の問題id、SEVEN_WONDERS_QUESTIONS[].id)、
  // correct(真偽値) }。STAGE_SEVEN_WONDERS_DEFINITIONSのcheck関数が
  // ctx.source==="sevenWonder"かつctx.questionIdの完全一致を要求するため、
  // 通常謎解き(evaluatePuzzleAnswer、source:"puzzle")側のトロフィーが
  // 誤って獲得されることは構造上発生しない。このevaluate()呼び出しは
  // stage指定なし(onlyStage省略)のため、同じ一回の呼び出しの中で、
  // ミステリーハンター(#393、常にチェック対象)・全知全能の神(#394、同)も
  // 併せて判定される。これにより、世界7不思議の7問目を正解した瞬間に
  // 「その問題のトロフィー」と「全知全能の神」が同じawardedIds配列に
  // 両方入ることがある(js/puzzle.js側がその両方を見て、専用演出を
  // 正しい順序でつなげる)
  function evaluateSevenWonderAnswer(context) {
    const normal = evaluate(Object.assign({ source: "sevenWonder" }, context));
    const special = evaluate(Object.assign({ source: "sevenWonder" }, context), { onlyStage: "sevenWondersSpecial" });
    return {
      awardedIds: normal.awardedIds.concat(special.awardedIds),
      hiddenAwardedIds: normal.hiddenAwardedIds.concat(special.hiddenAwardedIds),
    };
  }

  // 世界7不思議: アプリ起動時に1回だけ呼ぶ、追いつき判定専用の呼び出し経路。
  // 本更新より前からすでに通常謎解き126問を全問獲得済みだった利用者を、
  // 新しい謎解きへの回答を待たずに静かに解放する(「次回起動時に解放」の
  // 要求)。contextに特別な情報は不要(ミステリーハンター・全知全能の神の
  // check関数はisEarned()の現在値だけを見るため)。stage指定なし
  // (onlyStage省略)のevaluate()を呼ぶだけなので、他のどのトロフィーの
  // 判定・保存・通知経路にも影響を与えない(他の256件は、呼ばれるたびの
  // 判定自体は行われるが、この呼び出しのcontextには他のcheck関数が要求する
  // フィールド(例: source:"quiz"、ctx.correct等)が無いため、実質的に
  // 何も新規獲得しない安全な空振りになる)
  // onlyStage:"sevenWondersSpecial"を明示するため、通常のクイズ・世界図鑑・
  // 「世界の国どこかな？」の既存254件・謎解き126件には一切触れない
  // (空のcontextで他のトロフィーが誤って静かに獲得されることを構造上防ぐ)
  function evaluateSevenWondersCatchUp() {
    return evaluate({ source: "sevenWondersCatchUp" }, { onlyStage: "sevenWondersSpecial" });
  }

  // 世界7不思議が解放済みかどうか。ミステリーハンター(#393)の獲得有無を
  // そのまま解放フラグとして再利用する(awardIfNew()による獲得記録は
  // 一度確定すれば永久に残るため、「一度解放されたら二度とロックしない」
  // という要求を、新しい保存キーを追加せずに満たせる。将来PUZZLE_QUESTIONSが
  // 増えてisAllNormalPuzzlesEarned()が再びfalseになっても、すでに
  // awardIfNew()で保存済みのミステリーハンターの獲得記録自体は消えない
  // ため、解放状態は再ロックされない)
  function isSevenWondersUnlocked() {
    return isEarned(`trophy_${MYSTERY_HUNTER_NUMBER}`);
  }

  // 世界7不思議: 1問ごとの現在の状態を返す単一の判定経路
  // ("locked"|"available"|"cooldown"|"completed")。js/puzzle.js(入室時の
  // 多重アクセス防止)・js/app.js(一覧カードの表示)の両方がこの関数だけを
  // 使う(ロック状態の判定ロジックを複製しない)。
  //   - completed: この問題のトロフィーを獲得済み(再ロックは絶対に発生しない)
  //   - locked: 世界7不思議が未解放(通常謎解き全問未達成)
  //   - cooldown: 解放済みだが、直近の確定済み不正解から168時間以内
  //   - available: 解放済み・未獲得・ロック無し(挑戦できる)
  function getSevenWonderState(questionId) {
    const q = SEVEN_WONDERS_QUESTION_LIST.find((item) => item.id === questionId);
    if (!q) return "locked";
    if (isEarned(`trophy_${q.trophyNumber}`)) return "completed";
    if (!isSevenWondersUnlocked()) return "locked";
    if (typeof Storage !== "undefined" && typeof Storage.getSevenWonderLock === "function") {
      const lock = Storage.getSevenWonderLock(questionId);
      if (lock && Date.now() < lock.unlockAt) return "cooldown";
    }
    return "available";
  }
  // cooldown状態の問題が再挑戦可能になる時刻(ミリ秒epoch)。cooldown以外の
  // 状態、または記録が無い場合はnullを返す
  function getSevenWonderUnlockAt(questionId) {
    if (typeof Storage === "undefined" || typeof Storage.getSevenWonderLock !== "function") return null;
    const lock = Storage.getSevenWonderLock(questionId);
    return lock ? lock.unlockAt : null;
  }

  // Stage A: 「全データリセット」から呼ばれる。新トロフィーの獲得記録
  // (wfq_v1_trophy_earned)・統計(wfq_v1_trophy_stats)の両方を削除する。
  // #101〜112は参照型のためこのキーには元々含まれておらず、既存の称号
  // データ(js/storage.jsのStorage.resetAll()が別途削除する)が消えれば
  // 連動して未獲得表示に戻る。呼び出し元のjs/storage.jsはこの関数の存在を
  // 確認してから呼ぶため、ここでは単純にキーを消すだけでよい
  function resetAll() {
    try { localStorage.removeItem(TROPHY_KEY); } catch (e) { /* noop */ }
    try { localStorage.removeItem(TROPHY_STATS_KEY); } catch (e) { /* noop */ }
    try { localStorage.removeItem(COMMON_PROGRESS_KEY); } catch (e) { /* noop */ }
  }

  // 世界7不思議テストラボ(dev/seven-wonders-lab.html)専用。通常謎解き126問
  // (#1〜385)の獲得記録や称号・ランキング等は一切変更せず、世界7不思議
  // 7問(#386〜392)・全知全能の神(#394)の獲得記録と、7日間ロックの保存
  // 領域(js/storage.jsのSEVEN_WONDERS_LOCK_KEY)だけを削除する。これにより
  // 「通常126問は獲得済みのまま、世界7不思議だけを繰り返しテストする」こと
  // ができる。
  // ミステリーハンター(#393)はあえて対象に含めない: この番号は
  // isSevenWondersUnlocked()が「解放済みフラグ」としてそのまま再利用して
  // おり(「一度解放されたら二度とロックしない」という本番の設計そのもの)、
  // ここで一緒に消すと世界7不思議全体が再び未解放状態に戻ってしまい、
  // 「7問だけを繰り返しテストする」という目的と矛盾する。本番でこの関数を
  // 呼ぶ入口は存在しない(一般利用者向けの「全データリセット」はresetAll()
  // のみを使う)
  function resetSevenWondersProgress() {
    try {
      const data = loadTrophyData();
      const idsToClear = SEVEN_WONDERS_TROPHY_NUMBERS
        .concat([OMNISCIENT_GOD_NUMBER])
        .map((n) => `trophy_${n}`);
      idsToClear.forEach((id) => { delete data.earned[id]; });
      saveTrophyData(data);
    } catch (e) { /* noop */ }
    try {
      if (typeof Storage !== "undefined" && typeof Storage.resetSevenWondersLocks === "function") {
        Storage.resetSevenWondersLocks();
      }
    } catch (e) { /* noop */ }
  }

  return {
    getAllDefinitions,
    getDefinition,
    getDefinitionByNumber,
    getCategories,
    getEarned,
    isEarned,
    awardIfNew,
    getProgressSummary,
    isDualSplitCardNumber,
    getStats,
    recordQuizStats,
    resetAll,
    isModeTitlePerfectEarned,
    isBothModesTitlePerfectEarned,
    getFindCountryRegionProgress,
    arePairCorrect,
    evaluate,
    evaluateQuizFinish,
    evaluateFindCountryResult,
    evaluateFindCountryAnswer,
    evaluateFindCountryHiddenProgress,
    evaluateEncyclopediaVisit,
    evaluatePuzzleAnswer,
    evaluateSevenWonderAnswer,
    evaluateSevenWondersCatchUp,
    isSevenWondersUnlocked,
    getSevenWonderState,
    getSevenWonderUnlockAt,
    isAllNormalPuzzlesEarned,
    isAllSevenWondersEarned,
    resetSevenWondersProgress,
    SEVEN_WONDERS_TROPHY_NUMBERS,
    MYSTERY_HUNTER_NUMBER,
    OMNISCIENT_GOD_NUMBER,
    COMMON_TROPHY_NUMBERS,
    recordCommonTally,
    recordCommonModeUsed,
    evaluateCommonTrophiesCatchUp,
    getCommonTrophyProgress,
  };
})();
