// ==========================================================
// 謎解き問題データ(第2段階: 試験実装3問)
//
// ここに置くのは「問題そのもの」(ID・正式名称・判定方式・正解条件・
// 問題文・解説文)だけで、以下はこのファイルの責務に含めない。
//   - 正解判定の実行ロジック(js/puzzle-judge.js)
//   - 国旗選択の画面操作(js/puzzle.js)
//   - トロフィーの獲得・保存・解放処理(将来、別のファイルで実装する)
//
// 企画書「謎解きトロフィー32.docx」のNo.01・02・04を、問題文・解説文とも
// 忠実に移した試験実装。将来、この配列に要素を追加するだけで40問・50問・
// 100問以上に増やせるように、js/puzzle.js・js/puzzle-judge.jsのどちらも
// この配列の件数や内容に応じたswitch文・専用if文を持たない設計にしている。
//
// answerIdsは、js/countries.js(COUNTRIES)の安定したid(フランス=fr、
// 中国=cn、トルコ=tr、インド=in、インドネシア=id、モナコ=mc)を使う。
// 198か国・地域のデータ自体(js/countries.js)には一切手を加えていない。
//
// number と trophyNumber は別の概念(謎解きトロフィー第3段階以降の修正)。
//   number: プレイヤー向けの問題番号(「No.01」等)。開発用問題選択一覧
//     (js/puzzle.js)の表示にのみ使う。
//   trophyNumber: js/trophy.jsがトロフィー一覧の通し番号(#256〜)として
//     使う、恒久的に固定したトロフィー管理番号。一度割り振った後は、
//     この配列の並び順を変更しても、この配列に新しい問題を追加しても、
//     この問題を削除しても絶対に変更・再利用しない(既存の獲得記録が
//     trophy_<trophyNumber>というidで保存されているため、番号が変わると
//     その記録を読み込めなくなる)。新しい問題を追加するときは、既存の
//     どのtrophyNumberとも重複しない未使用の番号を新しく割り振ること
//     (js/trophy.js側の自己検証がtrophyNumberの重複・範囲外・欠番を
//     検出する)。
//
// explanationNote(省略可): 解説文(explanationText)とは別の、出典・
//   注釈用の短い補足テキスト。獲得後にトロフィー一覧で解説文より小さい
//   文字・別要素として表示される(js/app.js・css/style.cssの共通デザイン。
//   問題ごとの個別CSSは書かない)。指定しない問題では何も表示されない
//   (空白やラベルも出さない)。
//
// judgeMode:
//   "unordered" (順不同) - 選択順を問わず、正解の国・地域がすべて選ばれ、
//     余分がなく、選択回数(重複選択も含む)も一致した場合のみ正解。
//   "ordered" (順番指定) - 将来の問題用。現時点の3問では使用しない。
// ==========================================================

const PUZZLE_QUESTIONS = [
  {
    id: "puzzle-01",
    number: 1,
    trophyNumber: 256, // 固定・恒久。変更・再利用禁止(上記コメント参照)
    title: "世界三大料理",
    genre: "世界◯大",
    judgeMode: "unordered",
    answerIds: ["fr", "cn", "tr"], // フランス・中国・トルコ
    questionText:
      "三つの食卓が、世界の味覚を魅了する。西の美食、東の技、東西を結ぶ香り。三つの国を巡り、食の王冠をそろえよ。",
    explanationText:
      "フランス料理・中国料理・トルコ料理は、日本で「世界三大料理」と呼ばれることがあります。これは公的な世界ランキングではなく、広く知られる慣用的な呼称です。",
  },
  {
    id: "puzzle-02",
    number: 2,
    trophyNumber: 257, // 固定・恒久。変更・再利用禁止(上記コメント参照)
    title: "人口の双璧",
    genre: "国旗・地理・文化",
    judgeMode: "unordered",
    answerIds: ["in", "cn"], // インド・中国
    questionText: "数え切れぬ命が暮らす二つの大地。世界で最も多くの人が暮らす二つの国を探せ。",
    explanationText:
      "インドと中国は、世界で最も人口が多い2つの国です。2026年の推計では、インドが世界第1位、中国が第2位となっています。",
    explanationNote:
      "※2026年の推計人口に基づく順位（出典：国連『世界人口推計2024年版』）",
  },
  {
    id: "puzzle-04",
    number: 4,
    trophyNumber: 258, // 固定・恒久。変更・再利用禁止(上記コメント参照)
    title: "双子の旗",
    genre: "国旗・地理・文化",
    judgeMode: "unordered",
    answerIds: ["id", "mc"], // インドネシア・モナコ
    questionText: "上に赤、下に白。遠く離れた二つの国は、まるで鏡の双子。二つの旗の持ち主を探せ。",
    explanationText:
      "インドネシアとモナコの国旗はどちらも上が赤、下が白の横二色旗です。縦横比などに違いがあります。",
  },
  {
    id: "puzzle-002",
    number: 5,
    trophyNumber: 263, // 固定・恒久。変更・再利用禁止
    title: "初代世界王者",
    genre: "国旗・地理・文化",
    judgeMode: "ordered",
    answerIds: ["uy","it"],
    questionText:
      "世界を賭けた球の祭典。最初に王冠を戴いた国と、その次に戴いた国。誕生の順に二つの国を巡れ。",
    explanationText:
      "男子サッカーW杯の初代優勝国は1930年のウルグアイ、次の1934年大会優勝国はイタリアです。",
  },
  {
    id: "puzzle-004",
    number: 6,
    trophyNumber: 264, // 固定・恒久。変更・再利用禁止
    title: "音楽の神々",
    genre: "国旗・地理・文化",
    judgeMode: "unordered",
    answerIds: ["de","at"],
    questionText:
      "運命を打ち鳴らす巨匠と、天才と呼ばれた若き作曲家。二つの音楽の故郷を訪ねよ。",
    explanationText:
      "ベートーヴェンは現在のドイツにあたるボン生まれ、モーツァルトは現在のオーストリアにあたるザルツブルク生まれです。両者ともウィーンで活躍しました。",
  },
  {
    id: "puzzle-006",
    number: 7,
    trophyNumber: 265, // 固定・恒久。変更・再利用禁止
    title: "赤い葉の国旗",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["ca"],
    questionText:
      "カエデの葉が使われている国旗。どこの国？",
    explanationText:
      "カナダの国旗には、国の象徴であるサトウカエデの葉が中央に描かれています。",
  },
  {
    id: "puzzle-007",
    number: 8,
    trophyNumber: 266, // 固定・恒久。変更・再利用禁止
    title: "杉の木を探せ",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["lb"],
    questionText:
      "杉の木が使われている国旗。どこの国？",
    explanationText:
      "レバノンの国旗には、国の象徴であるレバノン杉が中央に描かれています。",
  },
  {
    id: "puzzle-008",
    number: 9,
    trophyNumber: 267, // 固定・恒久。変更・再利用禁止
    title: "太鼓と山の国",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["tz"],
    questionText:
      "キリマンジャロ山がそびえ、スワヒリ語が広く使われる国は？",
    explanationText:
      "タンザニアにはアフリカ最高峰のキリマンジャロ山があり、スワヒリ語が広く使われています。",
  },
  {
    id: "puzzle-009",
    number: 10,
    trophyNumber: 268, // 固定・恒久。変更・再利用禁止
    title: "カカオの国",
    genre: "国旗・地理・文化",
    judgeMode: "unordered",
    answerIds: ["ci","gh"],
    questionText:
      "チョコレートの原料カカオの生産で知られる、西アフリカの国を２つ選べ。",
    explanationText:
      "コートジボワールとガーナは、世界有数のカカオ生産国として知られる西アフリカの国です。",
  },
  {
    id: "puzzle-010",
    number: 11,
    trophyNumber: 269, // 固定・恒久。変更・再利用禁止
    title: "砂漠の王国",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["ma"],
    questionText:
      "北アフリカ。青い町シャウエンやフェズなどの迷宮都市で知られる国は？",
    explanationText:
      "モロッコには青い町として知られるシャウエンや、迷宮都市フェズなどの歴史的な街があります。",
  },
  {
    id: "puzzle-011",
    number: 12,
    trophyNumber: 270, // 固定・恒久。変更・再利用禁止
    title: "海のない草原",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["mn"],
    questionText:
      "遊牧民はゲルという組み立てや移動が出来る円形の住居を使う。広い草原の国は？",
    explanationText:
      "モンゴルは広大な草原が広がる内陸国で、遊牧民は組み立て式の住居ゲルで暮らしています。",
  },
  {
    id: "puzzle-012",
    number: 13,
    trophyNumber: 271, // 固定・恒久。変更・再利用禁止
    title: "南の細長い国",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["cl"],
    questionText:
      "南北に非常に長く延びる南米の国で、モアイ像で有名なイースター島も領土に含まれる国は？",
    explanationText:
      "チリは南北に非常に長く延びる南米の国で、モアイ像で知られるイースター島も領土に含まれます。",
  },
  {
    id: "puzzle-013",
    number: 14,
    trophyNumber: 272, // 固定・恒久。変更・再利用禁止
    title: "鳥の名を持つ国",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["nz"],
    questionText:
      "キーウィという飛べない鳥で有名な国は？",
    explanationText:
      "ニュージーランドには、キーウィという飛べない固有の鳥が生息しています。",
  },
  {
    id: "puzzle-014",
    number: 15,
    trophyNumber: 273, // 固定・恒久。変更・再利用禁止
    title: "二つの島の国",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["mt"],
    questionText:
      "地中海にある島国。マルタ島やゴゾ島などからなる国は？透明度の高いエメラルドブルーの海「ブルーラグーン」が有名。",
    explanationText:
      "マルタは地中海に浮かぶ島国で、マルタ島やゴゾ島などからなり、ブルーラグーンと呼ばれる透明度の高い海で知られます。",
  },
  {
    id: "puzzle-015",
    number: 16,
    trophyNumber: 274, // 固定・恒久。変更・再利用禁止
    title: "雷龍の王国",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["bt"],
    questionText:
      "国旗に白い龍が描かれ、ヒマラヤ山脈の東部に位置する王国は？",
    explanationText:
      "ブータンの国旗には白い龍が描かれており、ヒマラヤ東部の山岳王国です。龍は国の文化と伝統を象徴しています。",
  },
  {
    id: "puzzle-016",
    number: 17,
    trophyNumber: 275, // 固定・恒久。変更・再利用禁止
    title: "歌がつなぐ国",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["lv"],
    questionText:
      "バルト三国の一つ。大規模な歌と踊りの祭典が受け継がれ、ユネスコ無形文化遺産の「歌と踊りの祭典」などの伝統文化がある。",
    explanationText:
      "ラトビアはバルト海沿岸のヨーロッパの国です。バルト三国の歌と踊りの祭典は無形文化遺産として受け継がれています。",
  },
  {
    id: "puzzle-017",
    number: 18,
    trophyNumber: 276, // 固定・恒久。変更・再利用禁止
    title: "砂漠の半島",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["qa"],
    questionText:
      "ペルシャ湾に突き出す小さな半島。天然ガスの産出で知られ、2022年に男子サッカーW杯を開催した国は？",
    explanationText:
      "カタールはペルシャ湾に突き出す半島国家で、天然ガスが主要産業の一つです。2022年男子サッカーW杯を開催しました。",
  },
  {
    id: "puzzle-018",
    number: 19,
    trophyNumber: 277, // 固定・恒久。変更・再利用禁止
    title: "森と海の国",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["ga"],
    questionText:
      "赤道近くの大西洋岸にあり、熱帯雨林が広がる自然あふれる国。ロアンゴ国立公園でも知られる国は？",
    explanationText:
      "ガボンは中央アフリカの大西洋沿岸に位置します。ロアンゴ国立公園など、熱帯雨林と海岸の自然環境が知られます。",
  },
  {
    id: "puzzle-019",
    number: 20,
    trophyNumber: 278, // 固定・恒久。変更・再利用禁止
    title: "大西洋の火山群島",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["cv"],
    questionText:
      "アフリカ大陸の西の大西洋に浮かぶ島国。フォゴ島の火山と音楽「モルナ」で知られる国は？",
    explanationText:
      "カーボベルデは大西洋上の島国です。フォゴ島には火山があり、音楽モルナは同国を代表する文化の一つです。",
  },
  {
    id: "puzzle-020",
    number: 21,
    trophyNumber: 279, // 固定・恒久。変更・再利用禁止
    title: "消えた巨鳥の島",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["mu"],
    questionText:
      "インド洋の島国。かつて飛べない鳥ドードーが暮らし、現在は多様な文化が共存する国は？",
    explanationText:
      "モーリシャスには飛べない鳥ドードーが生息していました。ドードーは絶滅し、現在は自然保護の象徴にもなっています。",
  },
  {
    id: "puzzle-021",
    number: 22,
    trophyNumber: 280, // 固定・恒久。変更・再利用禁止
    title: "火山と砂絵の島々",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["vu"],
    questionText:
      "南太平洋の島国。活火山ヤスール山と、伝統的な砂絵で知られる国は？",
    explanationText:
      "バヌアツは南太平洋の島国です。ヤスール山の火山活動や伝統的な砂絵文化で知られています。",
  },
  {
    id: "puzzle-022",
    number: 23,
    trophyNumber: 281, // 固定・恒久。変更・再利用禁止
    title: "七人の戦士たち",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["fj"],
    questionText:
      "南太平洋の島国。7人制ラグビーが盛んで、2016年のリオ五輪で同競技の男子金メダルを獲得した国は？",
    explanationText:
      "フィジーは7人制ラグビーが盛んで、2016年リオ五輪の男子大会で金メダルを獲得しました。",
  },
  {
    id: "puzzle-023",
    number: 24,
    trophyNumber: 282, // 固定・恒久。変更・再利用禁止
    title: "100年の恩義",
    genre: "国旗・地理・文化",
    judgeMode: "unordered",
    answerIds: ["jp","tr"],
    questionText:
      "一八九〇年、荒れ狂う海に沈みし異国の船。見知らぬ命を救いし人々の善意は、海を越え、時を越え、語り継がれた。九十五年の時を経て、今度は戦火の空から、かつての恩人たちが救い出された。海で手を差し伸べた国と、空でその恩に応えた国。二つの国を巡り、時を越えた絆を証明せよ。",
    explanationText:
      "1890年、和歌山県沖で遭難したオスマン帝国の軍艦エルトゥールル号の乗組員を日本の人々が救助しました。95年後の1985年、イラン・イラク戦争中のテヘランから日本人を退避させるため、トルコ航空の航空機が派遣されました。二つの出来事は日ト友好の象徴として語り継がれています。",
  },
  {
    id: "puzzle-024",
    number: 25,
    trophyNumber: 283, // 固定・恒久。変更・再利用禁止
    title: "ラグビーの聖地",
    genre: "国旗・地理・文化",
    judgeMode: "unordered",
    answerIds: ["gb","nz"],
    questionText:
      "楕円の球が生まれた地と、黒き戦士たちが伝説となった島国。二つの国を訪ねよ。",
    explanationText:
      "ラグビーはイングランドで発展した競技です。ニュージーランド代表「オールブラックス」は世界的に知られています。図鑑ではイングランドを含むイギリスを選びます。",
  },
  {
    id: "puzzle-025",
    number: 26,
    trophyNumber: 284, // 固定・恒久。変更・再利用禁止
    title: "自由の女神の約束",
    genre: "国旗・地理・文化",
    judgeMode: "unordered",
    answerIds: ["fr","us"],
    questionText:
      "大海原を越え、自由を照らす女神が立つ。その手には炎を、その足元には断ち切られた鎖を。されど、女神が立つ大地と、女神を生み出した大地は異なる。自由を祝して贈られし、海を越えた友情の証。女神を贈りし国と、女神を迎えし国。二つの国を巡り、自由の誓いを完成させよ。",
    explanationText:
      "ニューヨークの自由の女神像は、アメリカ独立100周年を記念する友好の証としてフランスから贈られ、1886年に除幕されました。たいまつは自由を照らす光を、足元の断ち切られた鎖は抑圧からの解放を象徴しています。",
  },
  {
    id: "puzzle-026",
    number: 27,
    trophyNumber: 285, // 固定・恒久。変更・再利用禁止
    title: "五輪の創始者",
    genre: "国旗・地理・文化",
    judgeMode: "unordered",
    answerIds: ["gr","fr"],
    questionText:
      "古代の祭典が眠る大地と、その火を近代に呼び戻した者の祖国。二つの国を巡れ。",
    explanationText:
      "古代オリンピックはギリシャのオリンピアで行われました。近代オリンピック復興を推進したピエール・ド・クーベルタンはフランス出身です。",
  },
  {
    id: "puzzle-027",
    number: 28,
    trophyNumber: 286, // 固定・恒久。変更・再利用禁止
    title: "悲劇の恋人たち",
    genre: "国旗・地理・文化",
    judgeMode: "unordered",
    answerIds: ["gb","it"],
    questionText:
      "恋は二人を結び、家の争いが二人を裂いた。物語を記した者の国と、悲劇が演じられる街の国を巡れ。",
    explanationText:
      "『ロミオとジュリエット』を書いたシェイクスピアはイングランド出身。物語の主な舞台はイタリアのヴェローナです。",
  },
  {
    id: "puzzle-028",
    number: 29,
    trophyNumber: 287, // 固定・恒久。変更・再利用禁止
    title: "新たなる王者",
    genre: "国旗・地理・文化",
    judgeMode: "ordered",
    answerIds: ["fr","es"],
    questionText:
      "長き戦いの果て、初めて世界の頂に立った二つの国。二十世紀の終わりと二十一世紀の始まりをつなげ。",
    explanationText:
      "フランスは1998年、スペインは2010年に男子サッカーW杯で初優勝しました。",
  },
  {
    id: "puzzle-029",
    number: 30,
    trophyNumber: 288, // 固定・恒久。変更・再利用禁止
    title: "神の手",
    genre: "国旗・地理・文化",
    judgeMode: "unordered",
    answerIds: ["ar","gb"],
    questionText:
      "一九八六年、神の手が世界を揺らした。伝説の十番が生まれた国と、あの日の相手の故郷を巡れ。",
    explanationText:
      "1986年男子サッカーW杯準々決勝で、アルゼンチンのマラドーナがイングランド戦で手を使って得点しました。対戦したのは「イギリス代表」ではなくイングランド代表です。本問では図鑑のイギリスを選びます。",
  },
  {
    id: "puzzle-030",
    number: 31,
    trophyNumber: 289, // 固定・恒久。変更・再利用禁止
    title: "緑の島と氷の島",
    genre: "国旗・地理・文化",
    judgeMode: "unordered",
    answerIds: ["gl","is"],
    questionText:
      "緑を名乗る氷の大地。氷を名乗る緑の大地。名と姿がすれ違う二つの島を巡れ。",
    explanationText:
      "グリーンランドは巨大な氷床に覆われ、アイスランドには緑の草地も広がります。ただしアイスランドにも氷河があり、両者の景観を完全に逆とするのは比喩です。グリーンランドはデンマーク王国の自治地域です。",
  },
  {
    id: "puzzle-031",
    number: 32,
    trophyNumber: 290, // 固定・恒久。変更・再利用禁止
    title: "リズムの故郷",
    genre: "国旗・地理・文化",
    judgeMode: "unordered",
    answerIds: ["jm","br","ar"],
    questionText:
      "島のレゲエ、ブラジルのサンバ、ブエノスアイレスのタンゴ。三つの音楽が生まれた国を巡れ。",
    explanationText:
      "レゲエはジャマイカ、サンバはブラジル、タンゴはアルゼンチンとウルグアイのラプラタ川流域で発展しました。本問はタンゴの代表国としてアルゼンチンを指定しています。",
  },
  {
    id: "puzzle-032",
    number: 33,
    trophyNumber: 291, // 固定・恒久。変更・再利用禁止
    title: "三つの王冠",
    genre: "国旗・地理・文化",
    judgeMode: "ordered",
    answerIds: ["uy","it","de"],
    questionText:
      "世界の王座を初めて得た国々。その第一、第二、第三の名を、歴史の順に刻め。",
    explanationText:
      "男子サッカーW杯で初めて優勝した国を初優勝の早い順に並べると、ウルグアイ（1930）、イタリア（1934）、ドイツ（西ドイツとして1954）です。",
  },
  {
    id: "puzzle-033",
    number: 34,
    trophyNumber: 292, // 固定・恒久。変更・再利用禁止
    title: "国の中の国",
    genre: "国旗・地理・文化",
    judgeMode: "unordered",
    answerIds: ["va","sm","ls"],
    questionText:
      "一つの国境を越えても、なお別の国の中。三つの小さな主権を探し出せ。",
    explanationText:
      "バチカン市国とサンマリノはイタリアに、レソトは南アフリカに完全に囲まれた独立国です。",
  },
  {
    id: "puzzle-034",
    number: 35,
    trophyNumber: 293, // 固定・恒久。変更・再利用禁止
    title: "大地を切り開く三本の道",
    genre: "国旗・地理・文化",
    judgeMode: "unordered",
    answerIds: ["eg","pa","de"],
    questionText:
      "砂漠を貫き、二つの海を結び、北の航路を短くする。人が築いた三本の水の道を探し出せ。",
    explanationText:
      "スエズ運河はエジプト、パナマ運河はパナマ、キール運河はドイツにあります。いずれも船の移動を大きく変えた人工水路です。",
  },
  {
    id: "puzzle-035",
    number: 36,
    trophyNumber: 294, // 固定・恒久。変更・再利用禁止
    title: "大河の三つの魂",
    genre: "国旗・地理・文化",
    judgeMode: "unordered",
    answerIds: ["eg","br","cn"],
    questionText:
      "エジプトを潤すナイル、ブラジルを貫くアマゾン、中国の大地を育む長江。三つの大河をたどり、その国を開け。",
    explanationText:
      "ナイル川、アマゾン川、長江を題材にしています。川はいずれも広い流域を持ち、国境を越えるものもあります。本問では代表的な国を指定しています。",
  },
  {
    id: "puzzle-036",
    number: 37,
    trophyNumber: 295, // 固定・恒久。変更・再利用禁止
    title: "三つの円の秘密",
    genre: "国旗・地理・文化",
    judgeMode: "unordered",
    answerIds: ["jp","bd","pw"],
    questionText:
      "三つの旗に浮かぶ大きな円。白地の赤、緑地の赤、青地の黄。三つの国を探せ。",
    explanationText:
      "日本、バングラデシュ、パラオの国旗には大きな円形の意匠があります。ただしパラオの円は月を表すとされるため、三つすべてを「太陽」と断定するのは正確ではありません。",
  },
  {
    id: "puzzle-037",
    number: 38,
    trophyNumber: 296, // 固定・恒久。変更・再利用禁止
    title: "新世界の継承者",
    genre: "国旗・地理・文化",
    judgeMode: "unordered",
    answerIds: ["nz","pg","nc"],
    questionText:
      "名に「新しき」を宿す三つの大地。遠き海の向こうに散らばった、その名を集めよ。",
    explanationText:
      "ニュージーランド、パプアニューギニア、ニューカレドニアには英語・フランス語由来の「New／Nouvelle（新しい）」が含まれています。ニューカレドニアはフランスの特別な地位を持つ地域です。",
  },
  {
    id: "puzzle-038",
    number: 39,
    trophyNumber: 297, // 固定・恒久。変更・再利用禁止
    title: "海を越えた言葉",
    genre: "国旗・地理・文化",
    judgeMode: "unordered",
    answerIds: ["pt","br","ao"],
    questionText:
      "一つの言葉が海を渡り、三つの大陸で息づく。欧州、南米、アフリカに広がる声の故郷を探せ。",
    explanationText:
      "ポルトガル、ブラジル、アンゴラではポルトガル語が公用語です。言語の広がりには航海と植民地支配の歴史も関わっています。",
  },
  {
    id: "puzzle-039",
    number: 40,
    trophyNumber: 298, // 固定・恒久。変更・再利用禁止
    title: "テニス四大聖地",
    genre: "国旗・地理・文化",
    judgeMode: "unordered",
    answerIds: ["au","fr","gb","us"],
    questionText:
      "真夏の熱気、赤き土、緑の芝、夜を照らす大舞台。四つの頂点が待つ国を巡れ。",
    explanationText:
      "テニスの四大大会は全豪オープン、全仏オープン、ウィンブルドン選手権、全米オープンです。開催国はオーストラリア、フランス、イギリス、アメリカです。",
  },
  {
    id: "puzzle-040",
    number: 41,
    trophyNumber: 299, // 固定・恒久。変更・再利用禁止
    title: "コーヒーの道",
    genre: "国旗・地理・文化",
    judgeMode: "unordered",
    answerIds: ["et","br"],
    questionText:
      "コーヒー発祥の地として語られるアフリカの国と、コーヒー輸出大国として知られる南米の国を選べ。",
    explanationText:
      "エチオピアはコーヒー発祥の地として語られ、ブラジルは世界有数のコーヒー輸出国として知られています。",
  },
  {
    id: "puzzle-041",
    number: 42,
    trophyNumber: 300, // 固定・恒久。変更・再利用禁止
    title: "赤道の名",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["ec"],
    questionText:
      "スペイン語で「赤道」を意味する名を持つ南米の国は？",
    explanationText:
      "エクアドルの国名は、スペイン語で「赤道」を意味する言葉に由来します。",
  },
  {
    id: "puzzle-042",
    number: 43,
    trophyNumber: 301, // 固定・恒久。変更・再利用禁止
    title: "青い都と古代都市",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["uz"],
    questionText:
      "サマルカンドとブハラ。シルクロードの二都市がある国は？",
    explanationText:
      "ウズベキスタンには、シルクロードの要衝として栄えたサマルカンドとブハラという二つの古都があります。",
  },
  {
    id: "puzzle-043",
    number: 44,
    trophyNumber: 302, // 固定・恒久。変更・再利用禁止
    title: "チョコの山",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["ch"],
    questionText:
      "アルプス山脈、チーズフォンデュ、精密時計、チョコレートで知られる国は？",
    explanationText:
      "スイスはアルプス山脈にある国で、チーズフォンデュや精密時計、チョコレートなどで知られています。",
  },
  {
    id: "puzzle-044",
    number: 45,
    trophyNumber: 303, // 固定・恒久。変更・再利用禁止
    title: "二つの海の門",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["dj"],
    questionText:
      "紅海とアデン湾をつなぐバブ・エル・マンデブ海峡のアフリカ側にある小国は？",
    explanationText:
      "ジブチは紅海とアデン湾を結ぶバブ・エル・マンデブ海峡のアフリカ側に位置する小国です。",
  },
  {
    id: "puzzle-045",
    number: 46,
    trophyNumber: 304, // 固定・恒久。変更・再利用禁止
    title: "青い街と石の教会",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["ir"],
    questionText:
      "青いタイルのモスクで知られるイスファハーン。どこの国？",
    explanationText:
      "イランのイスファハーンは、青いタイルで装飾されたモスクで知られる都市です。",
  },
  {
    id: "puzzle-046",
    number: 47,
    trophyNumber: 305, // 固定・恒久。変更・再利用禁止
    title: "コンドルの空",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["bo"],
    questionText:
      "アンデスの高地、チチカカ湖、アンデス山脈の高原に広がるウユニ塩湖で知られる国は？",
    explanationText:
      "ボリビアにはアンデスの高地にチチカカ湖や、世界最大級の塩湖であるウユニ塩湖があります。",
  },
  {
    id: "puzzle-047",
    number: 48,
    trophyNumber: 306, // 固定・恒久。変更・再利用禁止
    title: "南太平洋の王国",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["to"],
    questionText:
      "太平洋の島国で、今も王制を維持し、ラグビーでも知られる国は？",
    explanationText:
      "トンガは太平洋の島国で、現在も王制を維持しており、ラグビーでも知られています。",
  },
  {
    id: "puzzle-048",
    number: 49,
    trophyNumber: 307, // 固定・恒久。変更・再利用禁止
    title: "湖に浮かぶ島々",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["ug"],
    questionText:
      "東アフリカの大湖ビクトリア湖に面している。赤道直下にありながら高地のため比較的過ごしやすい気候と豊かな自然を持ち、「アフリカの真珠」とも呼ばれる国はどこか？",
    explanationText:
      "ウガンダは東アフリカのビクトリア湖に面し、赤道直下ながら高地のため過ごしやすい気候から「アフリカの真珠」とも呼ばれます。",
  },
  {
    id: "puzzle-049",
    number: 50,
    trophyNumber: 308, // 固定・恒久。変更・再利用禁止
    title: "白い寺院の国",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["kh"],
    questionText:
      "人口の９割がクメール人であり、公用語はクメール語。世界遺産アンコールワットが有名。",
    explanationText:
      "カンボジアは人口の9割をクメール人が占め、公用語はクメール語です。世界遺産アンコールワットで知られています。",
  },
  {
    id: "puzzle-050",
    number: 51,
    trophyNumber: 309, // 固定・恒久。変更・再利用禁止
    title: "二色の大地",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["ua"],
    questionText:
      "1986年にチェルノブイリ原子力発電所（当時はソビエト連邦）で深刻な事故が起きた。広大なひまわり畑でも知られる東ヨーロッパの国は？",
    explanationText:
      "チェルノブイリ原発事故は1986年に当時のソ連、現在のウクライナ領で起きました。ウクライナはヒマワリ栽培でも知られます。",
  },
  {
    id: "puzzle-051",
    number: 52,
    trophyNumber: 310, // 固定・恒久。変更・再利用禁止
    title: "琥珀の海岸",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["lt"],
    questionText:
      "バルト三国の南端に位置し、琥珀の産地として知られる。かつて杉原千畝が多くのユダヤ人にビザを発給したことでも知られている（命のビザ）。この国は？",
    explanationText:
      "リトアニアはバルト三国の南端に位置します。杉原千畝がカウナスで発給した通過ビザは「命のビザ」として知られています。",
  },
  {
    id: "puzzle-052",
    number: 53,
    trophyNumber: 311, // 固定・恒久。変更・再利用禁止
    title: "黒い双頭の鷲",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["al"],
    questionText:
      "「千の窓の街」として知られるベラトやジロカストラ、古代遺跡のブトリントが有名。バルカン半島にある国は？",
    explanationText:
      "アルバニアの国旗は赤地に黒い双頭の鷲を描きます。ベラト、ジロカストラ、ブトリントなど歴史文化遺産があります。",
  },
  {
    id: "puzzle-053",
    number: 54,
    trophyNumber: 312, // 固定・恒久。変更・再利用禁止
    title: "デジタルの森",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["ee"],
    questionText:
      "バルト三国の北端。デジタル先進国として電子行政が発達し、世界遺産の中世の旧市街でも知られる国は？",
    explanationText:
      "エストニアはバルト三国の北端に位置し、電子行政が発達しています。首都タリンの旧市街は中世の街並みで知られます。",
  },
  {
    id: "puzzle-054",
    number: 55,
    trophyNumber: 313, // 固定・恒久。変更・再利用禁止
    title: "氷河とフィヨルド",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["no"],
    questionText:
      "西海岸に深いフィヨルドが続き、北部ではオーロラが見られる北欧の国は？",
    explanationText:
      "ノルウェーの西海岸には氷河の侵食で形成されたフィヨルドがあります。北部では季節や条件によってオーロラが見られます。",
  },
  {
    id: "puzzle-055",
    number: 56,
    trophyNumber: 314, // 固定・恒久。変更・再利用禁止
    title: "天使の滝",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["ve"],
    questionText:
      "南米北部にあり、世界最大級の落差を持つエンジェルフォールと、広大なオリノコ川流域で知られる国は？",
    explanationText:
      "エンジェルフォール（アンヘル滝）はベネズエラのギアナ高地にあります。オリノコ川は同国の重要な大河です。",
  },
  {
    id: "puzzle-056",
    number: 57,
    trophyNumber: 315, // 固定・恒久。変更・再利用禁止
    title: "湖の中の火山島",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["ni"],
    questionText:
      "中央アメリカの国。巨大な湖の中に二つの火山がそびえるオメテペ島がある国は？",
    explanationText:
      "ニカラグア湖のオメテペ島には二つの火山があります。ニカラグアは中央アメリカに位置する国です。",
  },
  {
    id: "puzzle-057",
    number: 58,
    trophyNumber: 316, // 固定・恒久。変更・再利用禁止
    title: "火山の国の波",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["sv"],
    questionText:
      "中央アメリカの太平洋側にあり、火山が多く、サーフィンの国際大会も開催される国は？",
    explanationText:
      "エルサルバドルは中央アメリカの太平洋側に位置する火山の多い国で、サーフィン文化でも知られています。",
  },
  {
    id: "puzzle-058",
    number: 59,
    trophyNumber: 317, // 固定・恒久。変更・再利用禁止
    title: "五つ星の青白青",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["hn"],
    questionText:
      "中央アメリカの国。国旗は青・白・青の横三色で、中央に5つの青い星が描かれている。どこの国？",
    explanationText:
      "ホンジュラスの国旗は青・白・青の横三色旗で、中央に5つの星が並びます。星は歴史上の中米連邦の構成国を象徴します。",
  },
  {
    id: "puzzle-059",
    number: 60,
    trophyNumber: 318, // 固定・恒久。変更・再利用禁止
    title: "アフリカの縮図",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["cm"],
    questionText:
      "アフリカ中部の大西洋岸にあり、熱帯雨林からサバンナまで多様な自然が広がる。「アフリカの縮図」とも呼ばれる国は？",
    explanationText:
      "カメルーンには熱帯雨林、山地、サバンナなど多彩な自然環境が広がり、「アフリカの縮図」とも呼ばれます。",
  },
  {
    id: "puzzle-060",
    number: 61,
    trophyNumber: 319, // 固定・恒久。変更・再利用禁止
    title: "サヘルの大地",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["ne"],
    questionText:
      "サハラ砂漠の南縁に広がる内陸国。国名と同じ名の大河が南西部を流れる国は？",
    explanationText:
      "ニジェールはサヘルに位置する内陸国です。国名と同じ名のニジェール川が国土の南西部を流れます。",
  },
  {
    id: "puzzle-061",
    number: 62,
    trophyNumber: 320, // 固定・恒久。変更・再利用禁止
    title: "川に沿う細長い国",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["gm"],
    questionText:
      "西アフリカの大西洋岸。大きな川に沿って東西に細長く伸び、周囲の大部分をセネガルに囲まれる国は？",
    explanationText:
      "ガンビアはガンビア川に沿って東西に延びる国で、陸上ではセネガルにほぼ囲まれています。",
  },
  {
    id: "puzzle-062",
    number: 63,
    trophyNumber: 321, // 固定・恒久。変更・再利用禁止
    title: "二重の牢獄",
    genre: "国旗・地理・文化",
    judgeMode: "unordered",
    answerIds: ["li","uz"],
    questionText:
      "海へ出るには、必ず二つの国境を越えねばならぬ。世界に二つだけの、二重に閉ざされた国を探せ。",
    explanationText:
      "リヒテンシュタインとウズベキスタンは二重内陸国です。周囲の国も海に面しておらず、海へ行くには少なくとも二つの国境を越える必要があります。",
  },
  {
    id: "puzzle-063",
    number: 64,
    trophyNumber: 322, // 固定・恒久。変更・再利用禁止
    title: "怪物を生みし者",
    genre: "国旗・地理・文化",
    judgeMode: "unordered",
    answerIds: ["gb","ro"],
    questionText:
      "怪物を生み出した小説の作者の祖国と、吸血鬼伯爵が住むとされるトランシルヴァニアの国。二つを巡れ。",
    explanationText:
      "『フランケンシュタイン』の作者メアリー・シェリーはイギリス出身。『ドラキュラ』の作者ブラム・ストーカーもアイルランド生まれですが、作中の伯爵はルーマニアのトランシルヴァニアと結びついています。",
  },
  {
    id: "puzzle-064",
    number: 65,
    trophyNumber: 323, // 固定・恒久。変更・再利用禁止
    title: "革命の旋律",
    genre: "国旗・地理・文化",
    judgeMode: "unordered",
    answerIds: ["fr","pl"],
    questionText:
      "革命の嵐が欧州を揺らした時代。激しき鍵盤の響きを残した作曲家の祖国と、彼が暮らした国を巡れ。",
    explanationText:
      "ショパンはポーランド生まれで、フランスのパリを拠点に活動しました。練習曲作品10第12番は「革命」の通称で知られますが、標題は作曲者自身によるものではありません。",
  },
  {
    id: "puzzle-065",
    number: 66,
    trophyNumber: 324, // 固定・恒久。変更・再利用禁止
    title: "ベルリンの壁",
    genre: "国旗・地理・文化",
    judgeMode: "unordered",
    answerIds: ["de","us","ru"],
    questionText:
      "かつて、一つの国が二つに引き裂かれた。その都には壁が築かれ、人々の自由な行き来は奪われた。西には星条旗を掲げし大国。東には赤き星を掲げし超大国。やがて壁は崩れ、分断の時代は終わりを告げた。壁に隔てられし国と、東西で対峙した二つの大国。三つの国を巡り、歴史の封印を解き放て。",
    explanationText:
      "第二次世界大戦後、ドイツは東西に分断され、1961年に東ドイツがベルリンの壁を建設しました。西側を支えたアメリカと、東側を支えたソビエト連邦（ソ連）は冷戦の中で対立しました。この謎では現在の図鑑項目「ロシア」を選びますが、当時のソ連と現在のロシアは異なる国家です。1989年に壁が開放され、1990年にドイツは再統一されました。",
  },
  {
    id: "puzzle-066",
    number: 67,
    trophyNumber: 325, // 固定・恒久。変更・再利用禁止
    title: "F1の伝説",
    genre: "国旗・地理・文化",
    judgeMode: "unordered",
    answerIds: ["mc","gb","it"],
    questionText:
      "街路を駆ける伝説、歴史を刻む発祥の地、赤き熱狂の神殿。三つのサーキットの国を探せ。",
    explanationText:
      "モナコGP、イギリスGP、イタリアGPはF1の歴史を語るうえで重要なレースです。ここではモナコ、イギリス、イタリアを指定します。",
  },
  {
    id: "puzzle-067",
    number: 68,
    trophyNumber: 326, // 固定・恒久。変更・再利用禁止
    title: "三つの信仰の源流",
    genre: "国旗・地理・文化",
    judgeMode: "unordered",
    answerIds: ["np","il","sa"],
    questionText:
      "悟りを求めた者、愛を説いた者、啓示を受けた者。その人物たちが生まれ、または教えを説いた歴史的な土地に対応する、現在の3か国を巡れ。",
    explanationText:
      "仏教の開祖ブッダの生誕地ルンビニは現在のネパール。キリスト教の起源は古代ユダヤ地方（現在のイスラエル・パレスチナにまたがる地域）。イスラム教は現在のサウジアラビアのメッカで始まりました。",
  },
  {
    id: "puzzle-068",
    number: 69,
    trophyNumber: 327, // 固定・恒久。変更・再利用禁止
    title: "世界を走る三大レース",
    genre: "国旗・地理・文化",
    judgeMode: "unordered",
    answerIds: ["fr","it","es"],
    questionText:
      "黄、桃、赤。三色の栄光を追い、山と谷を越えて走る。三つの大地を巡れ。",
    explanationText:
      "自転車ロードレースの三大ツール（グランツール）はツール・ド・フランス、ジロ・デ・イタリア、ブエルタ・ア・エスパーニャ。総合首位の象徴的なジャージは順に黄色、ピンク、赤色です。",
  },
  {
    id: "puzzle-069",
    number: 70,
    trophyNumber: 328, // 固定・恒久。変更・再利用禁止
    title: "鍵盤に刻まれた三つの栄冠",
    genre: "国旗・地理・文化",
    judgeMode: "unordered",
    answerIds: ["pl","ru","be"],
    questionText:
      "詩人の名を継ぐ競演、巨匠の名を冠する競演、女王の名を戴く競演。三つの音楽の祭典が開かれる国へ。",
    explanationText:
      "ショパン国際ピアノコンクールはポーランド、チャイコフスキー国際コンクールはロシア、エリザベート王妃国際音楽コンクールはベルギーで開催されます。",
  },
  {
    id: "puzzle-070",
    number: 71,
    trophyNumber: 329, // 固定・恒久。変更・再利用禁止
    title: "文明の四つの夜明け",
    genre: "国旗・地理・文化",
    judgeMode: "unordered",
    answerIds: ["eg","iq","pk","cn"],
    questionText:
      "大河のほとりに都市が生まれ、文字と法と祈りが芽吹いた。四つの文明のゆりかごを巡れ。",
    explanationText:
      "古代エジプト文明、メソポタミア文明、インダス文明、黄河流域の文明を題材にしています。メソポタミアは現在のイラク周辺、インダス文明の主要遺跡は現在のパキスタンに多くあります。",
  },
  {
    id: "puzzle-071",
    number: 72,
    trophyNumber: 330, // 固定・恒久。変更・再利用禁止
    title: "方角の支配者",
    genre: "国旗・地理・文化",
    judgeMode: "ordered",
    answerIds: ["mk","tl","ss","eh"],
    questionText:
      "北に目覚め、東へ進み、南に降り、西の果てへ。名に刻まれた四つの方角を、示された順に巡れ。",
    explanationText:
      "北マケドニア、東ティモール、南スーダン、西サハラは日本語名に北・東・南・西を含みます。西サハラは独立をめぐる紛争が続く地域で、一般に承認された独立国家として一律に扱えるものではありません。",
  },
  {
    id: "puzzle-072",
    number: 73,
    trophyNumber: 331, // 固定・恒久。変更・再利用禁止
    title: "三つの海峡",
    genre: "国旗・地理・文化",
    judgeMode: "ordered",
    answerIds: ["ma","my","tr"],
    questionText:
      "ジブラルタル海峡の南岸、マラッカ海峡沿岸、ボスポラス海峡の両岸。代表する国を順に選べ。",
    explanationText:
      "ジブラルタル海峡の南岸はモロッコ、マラッカ海峡はマレーシア沿岸、ボスポラス海峡はトルコの両岸に接しています。",
  },
  {
    id: "puzzle-073",
    number: 74,
    trophyNumber: 332, // 固定・恒久。変更・再利用禁止
    title: "香辛料の航路",
    genre: "国旗・地理・文化",
    judgeMode: "ordered",
    answerIds: ["in","lk","id"],
    questionText:
      "カレーで知られる南アジアの国、セイロンティーの島国、ナシゴレンの島国を順に選べ。",
    explanationText:
      "インドはカレーで知られる南アジアの国、スリランカはセイロンティーの産地、インドネシアはナシゴレンなどの料理で知られる島国です。",
  },
  {
    id: "puzzle-074",
    number: 75,
    trophyNumber: 333, // 固定・恒久。変更・再利用禁止
    title: "南半球の三つの大地",
    genre: "国旗・地理・文化",
    judgeMode: "ordered",
    answerIds: ["pe","ke","zw"],
    questionText:
      "マチュ・ピチュを擁するアンデスの国、サファリで知られる東アフリカの国、ヴィクトリアの滝に接する南部アフリカの国。順に選べ。",
    explanationText:
      "ペルーには古代遺跡マチュ・ピチュが、ケニアにはサファリで知られる自然が、ジンバブエにはヴィクトリアの滝があります。",
  },
  {
    id: "puzzle-075",
    number: 76,
    trophyNumber: 334, // 固定・恒久。変更・再利用禁止
    title: "砂漠と湿地",
    genre: "国旗・地理・文化",
    judgeMode: "ordered",
    answerIds: ["na","bw"],
    questionText:
      "アフリカ南部。ナミブ砂漠が広がる国と、世界最大級の湿地帯、オカバンゴ・デルタが広がる国を順に選べ。",
    explanationText:
      "ナミビアにはナミブ砂漠が、隣国ボツワナには世界最大級の湿地帯オカバンゴ・デルタが広がっています。",
  },
  {
    id: "puzzle-076",
    number: 77,
    trophyNumber: 335, // 固定・恒久。変更・再利用禁止
    title: "海の大航海",
    genre: "国旗・地理・文化",
    judgeMode: "ordered",
    answerIds: ["pt","es"],
    questionText:
      "バスコ・ダ・ガマの出身国と、マゼランが航海を始めた際に仕えた国を順に選べ。",
    explanationText:
      "バスコ・ダ・ガマはポルトガル出身の航海者で、マゼランはスペイン王に仕えて世界周航の航海を始めました。",
  },
  {
    id: "puzzle-077",
    number: 78,
    trophyNumber: 336, // 固定・恒久。変更・再利用禁止
    title: "王冠と象",
    genre: "国旗・地理・文化",
    judgeMode: "unordered",
    answerIds: ["th","la"],
    questionText:
      "過去に国旗に白い象を描いていた歴史を持つ東南アジアの国を2つ選べ。",
    explanationText:
      "タイとラオスは、かつて国旗に白い象を描いていた歴史を持つ東南アジアの国です。",
  },
  {
    id: "puzzle-078",
    number: 79,
    trophyNumber: 337, // 固定・恒久。変更・再利用禁止
    title: "アフリカ三地域の道",
    genre: "国旗・地理・文化",
    judgeMode: "ordered",
    answerIds: ["sn","rw","mz"],
    questionText:
      "西アフリカのダカール半島を擁する国、東アフリカの千の丘で知られる国、インド洋に長い海岸線を持つモザンビーク海峡沿岸の国。この順に選べ。",
    explanationText:
      "セネガルの首都ダカールは西アフリカの半島にあり、ルワンダは「千の丘の国」、モザンビークはインド洋に長い海岸線を持つ国です。",
  },
  {
    id: "puzzle-079",
    number: 80,
    trophyNumber: 338, // 固定・恒久。変更・再利用禁止
    title: "大洋を渡る鳥",
    genre: "国旗・地理・文化",
    judgeMode: "ordered",
    answerIds: ["ec","mg"],
    questionText:
      "ガラパゴス諸島が属する国と、マダガスカル島が属する国を順に選べ。",
    explanationText:
      "ガラパゴス諸島はエクアドル領、マダガスカル島はマダガスカルという一つの国からなる島です。",
  },
  {
    id: "puzzle-080",
    number: 81,
    trophyNumber: 339, // 固定・恒久。変更・再利用禁止
    title: "三つの伝統衣装",
    genre: "国旗・地理・文化",
    judgeMode: "ordered",
    answerIds: ["gb","in","kr"],
    questionText:
      "キルト、サリー、ハンボク。代表的に結びつく国を順に選べ。",
    explanationText:
      "キルトはスコットランド(図鑑のイギリス)、サリーはインド、ハンボクは韓国の伝統衣装として知られています。",
  },
  {
    id: "puzzle-081",
    number: 82,
    trophyNumber: 340, // 固定・恒久。変更・再利用禁止
    title: "草原と宇宙基地",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["kz"],
    questionText:
      "中央アジアの広大な内陸国。草原が広がり、バイコヌール宇宙基地がある国は？",
    explanationText:
      "カザフスタンは中央アジアの広い内陸国で、バイコヌール宇宙基地があります。宇宙基地はロケット打上げに利用されています。",
  },
  {
    id: "puzzle-082",
    number: 83,
    trophyNumber: 341, // 固定・恒久。変更・再利用禁止
    title: "石の十字架",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["am"],
    questionText:
      "コーカサス地方の内陸国。古くからキリスト教文化が根づき、石に彫られた十字架「ハチュカル」で知られる国は？",
    explanationText:
      "アルメニアの「ハチュカル」は石に十字架などを刻んだ伝統的な記念碑で、キリスト教文化と深く関わっています。",
  },
  {
    id: "puzzle-083",
    number: 84,
    trophyNumber: 342, // 固定・恒久。変更・再利用禁止
    title: "山国の白い帽子",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["kg"],
    questionText:
      "中央アジアで伝統的な白いフェルト帽「カルパック」が知られる国は？",
    explanationText:
      "キルギスの伝統的な白いフェルト帽「アク・カルパック」は、民族文化を象徴する衣装の一つです。",
  },
  {
    id: "puzzle-084",
    number: 85,
    trophyNumber: 343, // 固定・恒久。変更・再利用禁止
    title: "燃える砂漠の穴",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["tm"],
    questionText:
      "中央アジアの国。カラクム砂漠にある「地獄の門」と呼ばれてきた巨大なガスクレーターで知られる国は？",
    explanationText:
      "トルクメニスタンのカラクム砂漠にはダルヴァザ・ガスクレーターがあります。「地獄の門」と呼ばれ、燃焼状況は時期によって変化します。",
  },
  {
    id: "puzzle-085",
    number: 86,
    trophyNumber: 344, // 固定・恒久。変更・再利用禁止
    title: "世界の屋根の東",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["tj"],
    questionText:
      "中央アジアの山岳国。国土の大部分が山地で、パミール高原とワハーン回廊の北側で知られる国は？",
    explanationText:
      "タジキスタンの東部にはパミール高原が広がります。中央アジアの山地が国土の大半を占める国です。",
  },
  {
    id: "puzzle-086",
    number: 87,
    trophyNumber: 345, // 固定・恒久。変更・再利用禁止
    title: "古代都市の回廊",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["sy"],
    questionText:
      "西アジアにあり、古代都市パルミラの遺跡や、長い歴史を持つ市場で知られる国は？",
    explanationText:
      "シリアには古代都市パルミラなどの遺跡があり、長い交易と文明の歴史を持ちます。",
  },
  {
    id: "puzzle-087",
    number: 88,
    trophyNumber: 346, // 固定・恒久。変更・再利用禁止
    title: "二つの海の岸",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["ye"],
    questionText:
      "紅海とアデン湾をつなぐバブ・エル・マンデブ海峡のアジア側にある国は？",
    explanationText:
      "イエメンはアラビア半島南西部に位置し、バブ・エル・マンデブ海峡のアジア側に面しています。",
  },
  {
    id: "puzzle-088",
    number: 89,
    trophyNumber: 347, // 固定・恒久。変更・再利用禁止
    title: "島と大陸の国",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["gq"],
    questionText:
      "アフリカ中部の国。大陸部とギニア湾の島々からなり、公用語にスペイン語を含む国は？",
    explanationText:
      "赤道ギニアはアフリカ大陸部とギニア湾の島々に領土を持つ国です。スペイン語は公用語の一つです。",
  },
  {
    id: "puzzle-089",
    number: 90,
    trophyNumber: 348, // 固定・恒久。変更・再利用禁止
    title: "双子のヤシの実",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["sc"],
    questionText:
      "インド洋の島国。世界最大級の種子をつける「ココ・デ・メール」というヤシで知られる国は？",
    explanationText:
      "セーシェルに自生するココ・デ・メールは大きな種子をつけるヤシの一種で、島々の自然の特色となっています。",
  },
  {
    id: "puzzle-090",
    number: 91,
    trophyNumber: 349, // 固定・恒久。変更・再利用禁止
    title: "カルタゴの記憶",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["tn"],
    questionText:
      "北アフリカの地中海沿岸にあり、古代フェニキア人の都市カルタゴの遺跡が残る国は？",
    explanationText:
      "チュニジアには古代カルタゴの遺跡があります。カルタゴは地中海交易で栄えたフェニキア人の都市でした。",
  },
  {
    id: "puzzle-091",
    number: 92,
    trophyNumber: 350, // 固定・恒久。変更・再利用禁止
    title: "時の果てに立つ者",
    genre: "国旗・地理・文化",
    judgeMode: "ordered",
    answerIds: ["ki","nu"],
    questionText:
      "日付変更線の西側で最も早く新しい日を迎えるライン諸島から、まだ昨日に生きる島へ。二十五時間の隔たりを越え、時の境界を渡れ。",
    explanationText:
      "キリバスのライン諸島はUTC+14、ニウエはUTC−11で、時計上は25時間の差があります。同じ瞬間でも暦の日付が異なる場合があります。キリバス全土がUTC+14ではありません。",
  },
  {
    id: "puzzle-092",
    number: 93,
    trophyNumber: 351, // 固定・恒久。変更・再利用禁止
    title: "世界を解く暗号",
    genre: "暗号",
    judgeMode: "initial-letter-ordered",
    requiredInitials: ["J","A","P","A","N"],
    questionText:
      "五つの国に眠る言霊を解き放ち、封印されし真の名を現世に顕現させよ。",
    explanationText:
      "「JAPAN」の5文字を英語国名の頭文字で表現する暗号です。各文字に該当する国を順番に選ぶことで封印が解けます。同じ国を複数回選んでも構いません。",
  },
  {
    id: "puzzle-093",
    number: 94,
    trophyNumber: 352, // 固定・恒久。変更・再利用禁止
    title: "数字に囚われし世界",
    genre: "国旗・地理・文化",
    judgeMode: "ordered",
    answerIds: ["cu","gr","tr","de","ci"],
    questionText:
      "世界の真名は、数字の牢獄に封じられた。二十六の理に背きし数字たちは、真の姿より一歩先の虚像を纏う。五つの封印に刻まれた数列を解読し、失われし国家の名を、示されし順に捧げよ。Ⅰ 4・22・3・2　Ⅱ 8・19・6・6・4・6　Ⅲ 21・22・19・12・6・26　Ⅳ 8・6・19・14・2・15・26　Ⅴ 10・23・16・19・26／4・16・2・20・21",
    explanationText:
      "アルファベットに対応する数字から1を引くと、CUBA、GREECE、TURKEY、GERMANY、IVORY COASTが現れます。IVORY COASTはコートジボワールの英語での呼び方です。",
  },
  {
    id: "puzzle-094",
    number: 95,
    trophyNumber: 353, // 固定・恒久。変更・再利用禁止
    title: "鏡の世界の住人",
    genre: "国旗・地理・文化",
    judgeMode: "ordered",
    answerIds: ["nz","th","cl","ke","pt"],
    questionText:
      "鏡の向こうに眠る、五つの失われし王国。そこでは名は裏返り、道さえも逆さまに映し出される。偽りの姿を暴き、鏡が示す道を逆に辿れ。五つの王国を巡り、真実の世界へと帰還せよ。Ⅰ LAGUTROP　Ⅱ AYNEK　Ⅲ ELIHC　Ⅳ DNALIAHT　Ⅴ DNALAEZ WEN",
    explanationText:
      "文字を逆に読むとPORTUGAL、KENYA、CHILE、THAILAND、NEW ZEALANDになります。道も逆さまという手掛かりどおり、訪れる順番も逆転させて完成する二重の鏡の暗号です。",
  },
  {
    id: "puzzle-095",
    number: 96,
    trophyNumber: 354, // 固定・恒久。変更・再利用禁止
    title: "三つの大瀑布",
    genre: "国旗・地理・文化",
    judgeMode: "unordered",
    answerIds: ["ca","us","zm","zw","ar","br"],
    questionText:
      "轟音は国境を知らない。北の大瀑布、アフリカの水煙、南米の深緑。三つの滝を抱く六つの国を巡れ。",
    explanationText:
      "ナイアガラ滝は米加国境、ヴィクトリア滝はザンビアとジンバブエの国境、イグアス滝はアルゼンチンとブラジルの国境にあります。「世界三大瀑布」は慣用的な呼称です。",
  },
  {
    id: "puzzle-096",
    number: 97,
    trophyNumber: 355, // 固定・恒久。変更・再利用禁止
    title: "南米三つの足跡",
    genre: "国旗・地理・文化",
    judgeMode: "ordered",
    answerIds: ["co","py","uy"],
    questionText:
      "黄金郷エルドラドの伝説が残るアンデス北部の国、南米の内陸にあるグアラニー文化の国、タンゴとマテ茶の文化を持つラプラタ川東岸の国。この順に選べ。",
    explanationText:
      "コロンビアには黄金郷エルドラドの伝説が、パラグアイにはグアラニー文化が、ウルグアイにはタンゴとマテ茶の文化が残ります。",
  },
  {
    id: "puzzle-097",
    number: 98,
    trophyNumber: 356, // 固定・恒久。変更・再利用禁止
    title: "島国の文字",
    genre: "国旗・地理・文化",
    judgeMode: "ordered",
    answerIds: ["lk","mv","tl"],
    questionText:
      "シンハラ語、ディベヒ語、テトゥン語。それぞれが公用語の島国を順に選べ。",
    explanationText:
      "シンハラ語はスリランカ、ディベヒ語はモルディブ、テトゥン語は東ティモールの公用語です。",
  },
  {
    id: "puzzle-098",
    number: 99,
    trophyNumber: 357, // 固定・恒久。変更・再利用禁止
    title: "世界の屋根",
    genre: "国旗・地理・文化",
    judgeMode: "ordered",
    answerIds: ["ar","tz","tr"],
    questionText:
      "アコンカグア、キリマンジャロ、アララト山。山がある国を順に選べ。",
    explanationText:
      "アコンカグアはアルゼンチン、キリマンジャロはタンザニア、アララト山はトルコにある山です。",
  },
  {
    id: "puzzle-099",
    number: 100,
    trophyNumber: 358, // 固定・恒久。変更・再利用禁止
    title: "海を渡る年号",
    genre: "国旗・地理・文化",
    judgeMode: "ordered",
    answerIds: ["ng","bh","zw"],
    questionText:
      "1960年に独立した西アフリカの人口大国、1971年に独立したペルシャ湾の島国、1980年にローデシアから独立したアフリカ南部の国。示された順に選べ。",
    explanationText:
      "ナイジェリアは1960年、バーレーンは1971年、ジンバブエは1980年に独立しました。",
  },
  {
    id: "puzzle-100",
    number: 101,
    trophyNumber: 359, // 固定・恒久。変更・再利用禁止
    title: "四大陸の頂",
    genre: "国旗・地理・文化",
    judgeMode: "ordered",
    answerIds: ["tz","ar","ru","id"],
    questionText:
      "アフリカ（キリマンジャロ）、南米（アコンカグア）、欧州（コーカサスを含めたエルブルス）、オセアニア（ニューギニア島を含めたプンチャック・ジャヤ）。4つの最高峰がある国を順に選べ。",
    explanationText:
      "キリマンジャロはタンザニア、アコンカグアはアルゼンチン、エルブルスはロシアのコーカサス地方、プンチャック・ジャヤはインドネシア領ニューギニアにあります。本問ではコーカサスを欧州、ニューギニア島をオセアニアに含める区分を採用しています。",
  },
  {
    id: "puzzle-101",
    number: 102,
    trophyNumber: 360, // 固定・恒久。変更・再利用禁止
    title: "国名の中の色",
    genre: "国旗・地理・文化",
    judgeMode: "ordered",
    answerIds: ["gl","me"],
    questionText:
      "英語で「緑の土地」を意味するグリーンランド、現地語で「黒い山」を意味するモンテネグロ。2つの国・地域を示された順に選べ。",
    explanationText:
      "グリーンランドは英語由来で「緑の土地」を意味します。モンテネグロは現地語（モンテネグロ語の祖となるイタリア語由来）で「黒い山」を意味します。",
  },
  {
    id: "puzzle-102",
    number: 103,
    trophyNumber: 361, // 固定・恒久。変更・再利用禁止
    title: "映画の祭典",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["bf"],
    questionText:
      "西アフリカの内陸国。アフリカ映画の大規模な祭典「FESPACO」が開催される国は？",
    explanationText:
      "ブルキナファソのワガドゥグでは、アフリカ映画の祭典FESPACOが開催されてきました。",
  },
  {
    id: "puzzle-103",
    number: 104,
    trophyNumber: 362, // 固定・恒久。変更・再利用禁止
    title: "二つの隣国に囲まれた王国",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["sz"],
    questionText:
      "南部アフリカの王国。南アフリカとモザンビークに接し、伝統行事「ウムランガ」で知られる国は？",
    explanationText:
      "エスワティニは南部アフリカの王国で、南アフリカとモザンビークに接します。ウムランガは伝統的な文化行事です。",
  },
  {
    id: "puzzle-104",
    number: 105,
    trophyNumber: 363, // 固定・恒久。変更・再利用禁止
    title: "赤道のカカオ諸島",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["st"],
    questionText:
      "アフリカ西方のギニア湾に浮かぶ島国。カカオ栽培が盛んで、赤道付近の火山島からなり、豊かな熱帯雨林や固有種が多く見られる国は？",
    explanationText:
      "サントメ・プリンシペはギニア湾の島国です。火山島に熱帯林が広がり、カカオ栽培の歴史があります。",
  },
  {
    id: "puzzle-105",
    number: 106,
    trophyNumber: 364, // 固定・恒久。変更・再利用禁止
    title: "細長い西アフリカ",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["tg"],
    questionText:
      "西アフリカの大西洋沿岸にある南北に細長い国。約４５の民族が暮らしている国は？",
    explanationText:
      "トーゴは西アフリカのギニア湾沿岸に位置し、南北に長い国土と多様な民族文化を持っています。",
  },
  {
    id: "puzzle-106",
    number: 107,
    trophyNumber: 365, // 固定・恒久。変更・再利用禁止
    title: "水上の村",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["bj"],
    questionText:
      "西アフリカの国。ノクエ湖にある水上集落ガンビエと、かつてのダホメ王国の歴史で知られる国は？",
    explanationText:
      "ベナンのノクエ湖には水上集落ガンビエがあります。かつてこの地域にはダホメ王国が栄えました。",
  },
  {
    id: "puzzle-107",
    number: 108,
    trophyNumber: 366, // 固定・恒久。変更・再利用禁止
    title: "川の名を持つ国",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["cg"],
    questionText:
      "アフリカ中部で大河コンゴ川の北岸に広がる国。隣のコンゴ民主共和国とは別の国として知られるのは？",
    explanationText:
      "コンゴ共和国とコンゴ民主共和国は別の国です。コンゴ川を挟んで向かい合う地域があり、植民地時代の歴史も異なります。",
  },
  {
    id: "puzzle-108",
    number: 109,
    trophyNumber: 367, // 固定・恒久。変更・再利用禁止
    title: "星界への扉を開きし者",
    genre: "国旗・地理・文化",
    judgeMode: "ordered",
    answerIds: ["ru","us","fr","jp","cn"],
    questionText:
      "人類はかつて、地上の理に抗い、天を永遠に彷徨う鋼鉄の使徒を創り出した。重力の鎖を断ち切り、星々の海にその使徒を解き放ちし五つの国家。天界の禁忌を破りし順に、その名を刻め。",
    explanationText:
      "1957年にソ連がスプートニク1号、1958年にアメリカがエクスプローラー1号、1965年にフランスがアステリックス、1970年に日本がおおすみ、中国が東方紅1号を打ち上げました。本問では当時のソ連を現在の図鑑項目「ロシア」として扱います。",
  },
  {
    id: "puzzle-109",
    number: 110,
    trophyNumber: 368, // 固定・恒久。変更・再利用禁止
    title: "禁断の交信者",
    genre: "国旗・地理・文化",
    judgeMode: "ordered",
    answerIds: ["jp","de","fi","br","cu"],
    questionText:
      "世界を隔てし国境を越え、五つの声が闇を駆ける。されど、その声は時の理に背き、終わりから始まりへと還り、一つの鎖に封じられた。鎖を断ち切り、五つの声が生まれし地を、正しき順に巡礼せよ。35558539418",
    explanationText:
      "暗号の数字を逆から読むと「81493585553」。これを国際電話の国番号に区切ると、日本（+81）、ドイツ（+49）、フィンランド（+358）、ブラジル（+55）、キューバ（+53）を示します。",
  },
  {
    id: "puzzle-110",
    number: 111,
    trophyNumber: 369, // 固定・恒久。変更・再利用禁止
    title: "七つの驚異を巡りし者",
    genre: "国旗・地理・文化",
    judgeMode: "unordered",
    answerIds: ["cn","in","jo","it","br","pe","mx"],
    questionText:
      "石の長城、白き霊廟、岩の都、円形の闘技場、天空の救世主、雲上の古都、密林の神殿。七つの驚異を宿す国をすべて巡れ。",
    explanationText:
      "2007年の民間投票企画「新・世界七不思議」に選ばれた万里の長城、タージ・マハル、ペトラ、コロッセオ、コルコバードのキリスト像、マチュ・ピチュ、チチェン・イッツァを題材にしています。ユネスコの公式選定ではありません。",
  },
  {
    id: "puzzle-111",
    number: 112,
    trophyNumber: 370, // 固定・恒久。変更・再利用禁止
    title: "星の階段",
    genre: "国旗・地理・文化",
    judgeMode: "ordered",
    answerIds: ["vn","fm","cn","au"],
    questionText:
      "星の数が1個、4個、5個、6個の順になるように国旗を選べ。",
    explanationText:
      "ベトナムの国旗には星が1個、ミクロネシア連邦には4個、中国には5個、オーストラリアには6個描かれています。",
  },
  {
    id: "puzzle-112",
    number: 113,
    trophyNumber: 371, // 固定・恒久。変更・再利用禁止
    title: "消えた母音",
    genre: "国旗・地理・文化",
    judgeMode: "ordered",
    answerIds: ["np","rw","py"],
    questionText:
      "母音を消した英語国名。NPL、RWND、PRGY。元の国名を順に選べ。",
    explanationText:
      "母音を取り除いた英語国名NPL・RWND・PRGYは、それぞれNEPAL・RWANDA・PARAGUAYを表しています。",
  },
  {
    id: "puzzle-113",
    number: 114,
    trophyNumber: 372, // 固定・恒久。変更・再利用禁止
    title: "海峡の鎖",
    genre: "国旗・地理・文化",
    judgeMode: "ordered",
    answerIds: ["om","id","fr"],
    questionText:
      "ホルムズ海峡の南岸、スンダ海峡の両岸、ドーバー海峡の東岸。国を順に選べ。",
    explanationText:
      "ホルムズ海峡の南岸はオマーンのムサンダム半島、スンダ海峡の両岸はインドネシア、ドーバー海峡の東岸はフランスです。",
  },
  {
    id: "puzzle-114",
    number: 115,
    trophyNumber: 373, // 固定・恒久。変更・再利用禁止
    title: "砂漠の四つの顔",
    genre: "自然・地理",
    judgeMode: "grouped",
    answerGroups: [["mn","cn"],["cl"],["na"],["in","pk"]],
    questionText:
      "ゴビ（２カ国）、アタカマ、ナミブ、タール（２カ国）。ゴビに接する2か国（順不同）→アタカマの国→ナミブの国→タールに接する2か国（順不同）の順で、計6枚の国旗を選べ。",
    explanationText:
      "ゴビ砂漠はモンゴルと中国に、タール砂漠はインドとパキスタンにまたがります。アタカマ砂漠はチリ、ナミブ砂漠はナミビアにあります。グループの順番は固定ですが、同じグループ内の2か国はどちらを先に選んでも正解です。",
  },
  {
    id: "puzzle-115",
    number: 116,
    trophyNumber: 374, // 固定・恒久。変更・再利用禁止
    title: "独立の日を追え",
    genre: "国旗・地理・文化",
    judgeMode: "ordered",
    answerIds: ["dz","sg","ao","er"],
    questionText:
      "1962年にフランスから独立した北アフリカの国、1965年にマレーシアから分離独立した都市国家、1975年にポルトガルから独立したアフリカ南西部の国、1993年にエチオピアから独立した紅海沿岸の国。この順に選べ。",
    explanationText:
      "アルジェリアは1962年にフランスから、シンガポールは1965年にマレーシアから、アンゴラは1975年にポルトガルから、エリトリアは1993年にエチオピアから、それぞれ独立しました。",
  },
  {
    id: "puzzle-116",
    number: 117,
    trophyNumber: 375, // 固定・恒久。変更・再利用禁止
    title: "四文字の道標",
    genre: "暗号",
    judgeMode: "initial-letter-ordered",
    requiredInitials: ["P","E","R","U"],
    questionText:
      "英語国名の頭文字を使い、P → E → R → Uの順で4枚の国旗を選び、「PERU」を完成させよ。",
    explanationText:
      "「PERU」の4文字を英語国名の頭文字で表現する暗号です。No.092と同じ考え方で、各文字に該当する国を順番に選ぶことで完成します。同じ国を複数回選んでも構いません。",
  },
  {
    id: "puzzle-117",
    number: 118,
    trophyNumber: 376, // 固定・恒久。変更・再利用禁止
    title: "五つの国境を越えて",
    genre: "国旗・地理・文化",
    judgeMode: "ordered",
    answerIds: ["pt","es","fr","de","pl"],
    questionText:
      "陸続きの国をたどれ。スタートはポルトガル、ゴールはポーランド。最短の指定ルートを順に選べ。",
    explanationText:
      "ポルトガルからスペイン、フランス、ドイツを経てポーランドへ至るルートは、陸続きの国境をたどって移動することができます。",
  },
  {
    id: "puzzle-118",
    number: 119,
    trophyNumber: 377, // 固定・恒久。変更・再利用禁止
    title: "沈みゆく環礁",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["tv"],
    questionText:
      "南太平洋に点在する低い環礁からなる国。海面上昇への対応が国際的な課題になっている国は？",
    explanationText:
      "ツバルは太平洋の低い環礁などからなる国です。海面上昇や気候変動への対応は重要な課題です。",
  },
  {
    id: "puzzle-119",
    number: 120,
    trophyNumber: 378, // 固定・恒久。変更・再利用禁止
    title: "リン鉱石の島",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["nr"],
    questionText:
      "太平洋の小さな島国。かつて海鳥のふんなどに由来するリン鉱石の採掘で栄えた国は？",
    explanationText:
      "ナウルは太平洋の島国で、リン鉱石の採掘によって栄えた時期がありました。採掘は島の環境にも大きな影響を残しました。",
  },
  {
    id: "puzzle-120",
    number: 121,
    trophyNumber: 379, // 固定・恒久。変更・再利用禁止
    title: "星を刻む南の旗",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["ws"],
    questionText:
      "ポリネシアにある独立国。国旗の赤い地に青い四角と南十字星が描かれる国は？",
    explanationText:
      "サモアの国旗は赤地の左上に青い四角があり、その中に南十字星を表す白い星が描かれています。",
  },
  {
    id: "puzzle-121",
    number: 122,
    trophyNumber: 380, // 固定・恒久。変更・再利用禁止
    title: "環礁と核実験の記憶",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["mh"],
    questionText:
      "太平洋の環礁からなる島国。ビキニ環礁で行われた核実験の歴史を持つ国は？",
    explanationText:
      "マーシャル諸島のビキニ環礁は、第二次世界大戦後に行われた核実験の舞台となりました。今もその歴史が伝えられています。",
  },
  // ==========================================================
  // 通常の高難度謎解き5問(trophyNumber 381〜385)。企画資料・リポジトリ内に
  // 正式な原文は見つからなかったため、ユーザーから提示された確定仕様
  // (正解国・仕掛けの内容)に基づき、問題文・解説文を新たに作成した
  // (原文の忠実な転記ではない)。「世界7不思議」7問・7日ロックは今回の
  // 対象外で、既存のjudgeMode("unordered")のみで実装している
  // ==========================================================
  {
    id: "puzzle-hard-01",
    number: 123,
    trophyNumber: 381, // 固定・恒久。変更・再利用禁止
    title: "国境の無限迷宮",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["om", "ae"],
    questionText:
      "半島の奥深く、国境線は迷路のように折り重なる。一つの国境を越えたはずが、気づけば元いた国に戻っていた。そのさらに内側には、もう一つの国旗が小さく翻る飛び地が隠されていた。入れ子のように重なる二つの国を、旅の記憶から解き明かせ。",
    explanationText:
      "アラビア半島のオマーン領マダは、周囲をアラブ首長国連邦(UAE)の領土に完全に囲まれた飛び地です。さらにそのマダの内部には、UAE領のナハワという小さな飛び地が存在し、二重の入れ子構造になっています。",
  },
  {
    id: "puzzle-hard-02",
    number: 124,
    trophyNumber: 382, // 固定・恒久。変更・再利用禁止
    title: "三つの鍵と小さな王国",
    genre: "暗号",
    judgeMode: "unordered",
    answerIds: ["mc"],
    questionText:
      "かつてポルトガルの拠点として栄え、今はカジノと高層ビルが立ち並ぶ港町。世界最大級の塩湖と砂丘を抱くアフリカ南西部の国。エルドラドの伝説が語られる南米北西部の国。三つの地の頭文字(アルファベット2文字)を、挙げた順に□□＋□□＋□□とつなげたとき、地中海沿いに浮かぶ小さな国が見えてくる。その国を選べ。",
    explanationText:
      "マカオ(MO)・ナミビア(NA)・コロンビア(CO)の頭2文字を順につなげるとMONACOとなり、モナコを指します。マカオ・ナミビア・コロンビアは解読に用いる国・地域で、正解として選ぶのはモナコ1か国だけです。",
  },
  {
    id: "puzzle-hard-03",
    number: 125,
    trophyNumber: 383, // 固定・恒久。変更・再利用禁止
    title: "時の消失点",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["ws"],
    questionText:
      "【ある旅人の日記】\n木曜の夜、眠りについた。\n目覚めると、暦はすでに土曜日。一日分の記憶は、どこにも残っていない。\n後に知った。この島国が、より多くの隣人と同じ明日を生きるために、日付の境界線を自ら飛び越えたのだと。\n消えた金曜日を抱く国を選べ。",
    explanationText:
      "サモアは2011年12月30日、日付変更線を越える形でUTC-11からUTC+13へ移行し、暦から金曜日が一日分消えました。これはオーストラリア・ニュージーランドなど主要な貿易相手国と同じ日付で暮らすための変更でした。",
  },
  {
    id: "puzzle-hard-04",
    number: 126,
    trophyNumber: 384, // 固定・恒久。変更・再利用禁止
    title: "三旗が支配する島",
    genre: "地理・文化",
    judgeMode: "unordered",
    answerIds: ["id", "my", "bn"],
    questionText:
      "ある島の三人の王が、それぞれの領土を語る。一人目「わたしの国は、数え切れぬ島々からなる群島国家。この島もまた、その一部に過ぎぬ」。二人目「わたしの国は、遠い半島と、この島の一部とに領土がまたがる」。三人目「わたしは小さき王。されど地の底に眠る恵みゆえ、豊かさにおいて他国に劣らぬ」。一つの島を分け合う三つの国を選べ。",
    explanationText:
      "ボルネオ島(インドネシアではカリマンタン島と呼ばれます)は、インドネシア・マレーシア・ブルネイの3か国が領有する島です。インドネシア領はカリマンタン、マレーシア領はサバ州・サラワク州、ブルネイは島の北岸に位置する豊かな産油国です。",
  },
  {
    id: "puzzle-hard-05",
    number: 127,
    trophyNumber: 385, // 固定・恒久。変更・再利用禁止
    title: "歴史の分岐点",
    genre: "暗号",
    judgeMode: "unordered",
    answerIds: ["de", "cz", "sk"],
    // 特別仕様: 説明文・ヒント文を表示せず、年号・数字・矢印の図だけを
    // 問題として示す(js/puzzle.js・js/app.js側でwhite-space: pre-lineを
    // 適用し、改行をそのまま図として表示する)
    questionText:
      "1949　1 → 2\n1990　2 → 1\n1918　0 → 1\n1993　1 → 2",
    explanationText:
      "図の数字は、国家の分裂・統一の歴史を表します。1949年にドイツは東西2か国に分裂し、1990年に再び1つに統一されました(2→1)。1918年にチェコスロバキアという1つの国が成立し(0→1)、1993年にチェコとスロバキアの2か国に分離しました(1→2)。正解はドイツ・チェコ・スロバキアの3か国です。",
  },
];

// id -> 問題データのMap。js/puzzle-judge.js・js/puzzle.jsの両方から、
// 「挑戦中の問題IDに対応する1件だけ」を取り出すために使う
const PUZZLE_QUESTIONS_BY_ID = PUZZLE_QUESTIONS.reduce((map, q) => {
  map[q.id] = q;
  return map;
}, {});
