# トロフィー一覧・詳細画面 UI刷新 実装報告書

## 概要

既存のトロフィー機能(獲得条件・判定ロジック・保存データ・カテゴリー分類・
隠しトロフィーの非公開仕様・謎解き/世界7不思議の既存演出)を一切変更せず、
トロフィー一覧画面と新規の詳細モーダル画面のデザイン・操作性のみを刷新した。

ベースは共通トロフィー31種類実装(PR #88)マージ後の最新main。新規ブランチ
`claude/trophy-collection-ui-revamp` で作業した。

## 1. 変更内容

### 1-1. 一覧画面上部(新規: ヒーローカード)

- 獲得数/総数・達成率(%)・円形プログレスリング・線形プログレスバーを表示。
- 数値はすべて`TrophyModule.getProgressSummary()`(既存の集計方式。国旗/首都
  分割カードを2枠として正しく数える、二重計上防止済みのロジック)から算出し、
  固定値は一切書いていない。
- 「次の目標」: 共通トロフィー31種類(#395〜425)のうち、
  `TrophyModule.getCommonTrophyProgress()`が返す数値進捗を持つ未獲得トロフィー
  から、最も達成率が高い1件を実データから選んで表示する(対象が無ければ
  欄自体を表示しない。推測で埋めることはしない)。「目標の詳細」ボタンから、
  そのトロフィーの詳細モーダルを直接開ける。

### 1-2. カテゴリー別の獲得数・進捗(新規・折りたたみ)

- 既存の`TrophyModule.getCategories()`(15カテゴリー、分類・ラベルは無変更)
  ごとに、国旗/首都分割カードを2枠として数える同じロジックで獲得数/総数・
  進捗バーを算出し、カード形式で表示する。
- カードをクリックすると、既存の`state.trophyListFilter.category`による
  絞り込み(ロジック自体は無変更)が働く。
- 既定では8枚まで表示し、「すべて表示」で残りを展開できる(折りたたみ機能)。

### 1-3. トロフィー一覧: 絞り込み・検索・表示切替

- 獲得状況フィルター: すべて/獲得済み/未獲得(既存)に加え、「隠し」を追加
  (`def.hidden`が立っているカードを表示するだけの追加フィルターで、絞り込み
  結果自体は元から閲覧可能だった情報の範囲内。新しい情報は一切開示しない)。
- 名称・番号検索: カードに**実際に描画された**`.trophy-name`/`.trophy-number`
  のテキストだけを対象に照合する。隠しトロフィー・未正解の謎解きカードは
  「？？？？？？」のまま描画されているため、本物の名称で検索しても一致せず、
  検索機能を経由した情報漏れは起きない。
- グリッド/一覧(リスト)表示切替: カードのDOM構造・判定・絞り込みロジックは
  変えず、`#trophy-grid`にCSSクラスを1つ付け外しして見た目だけを切り替える。

### 1-4. トロフィーカード(既存カード生成関数は維持、CSSのみ刷新)

- 標準カード・国旗/首都分割カード・謎解きカード・世界7不思議専用カードの
  **生成ロジック(どの情報を表示してよいか)は一切変更していない**。
  `buildTrophyCardElement`/`buildDualSplitCardPair`/`buildPuzzleTrophyCardElement`/
  `buildSevenWonderCardElement`の呼び出し構造・分岐条件はPR #88時点のまま。
- 変更したのは、既存クラス(`.trophy-card`/`.trophy-mark`/`.trophy-name`等、
  いずれもこのトロフィー一覧画面専用で、他画面では使われていないことを確認済み)
  に対するCSSの配色・レイアウトのみ。
- 獲得済みは金のグラデーション、未獲得は落ち着いたグレー、隠しトロフィー
  未発見時は従来どおり「？？？？？？」+🔒表示を維持。

### 1-5. トロフィー詳細モーダル(新規)

- カードをクリックすると、そのカードの**既に描画済みのDOM**(名称・条件・
  アイコン・獲得日・解説文など、既存のカード生成関数が計算した「今表示して
  よい情報」そのもの)を複製して、大きなモーダルで表示する。新たに情報を
  復元・推測する経路は無いため、未獲得・隠しトロフィーの非公開情報が新たに
  漏れることはない。
- 謎解きトロフィーの「この謎に挑む」ボタンは、複製後に同じ処理
  (`PuzzleModule.open()`→`screen-puzzle-flag-select`)を付け直し、モーダルを
  閉じてから画面遷移する。
- **世界7不思議(`.trophy-card-sevenwonder`、隠し特別2種を含む)はこのモーダルの
  対象外とした。** ロック中タップの案内モーダル・7日間クールダウン表示・
  正式な挑戦フローという既存の専用インタラクションをそのまま維持するため、
  新しいクリック層を重ねていない(これらのカードは詳細モーダルを持たないが、
  カード自体に既に十分な情報が表示されている)。
- モーダルは`showScreen()`を呼ばない通常のオーバーレイ(既存の確認ダイアログ
  等と同じ`.modal`パターン)のため、開閉しても一覧画面のスクロール位置・
  絞り込み状態(カテゴリー・獲得状況・検索語・グリッド/一覧)は維持される。

### 1-6. 将来のトロフィー固有画像への対応

- `js/app.js`に`TROPHY_ICON_IMAGE_URLS`(番号→画像URLの対応表。現時点では
  空)と、それを参照する`trophyIconGlyphHtml()`を追加した。
- 標準カード・国旗/首都分割カードの丸アイコン部分は、対応表に画像が登録
  されていればその画像を、無ければ既存の絵文字アイコンをそのまま表示する
  (現時点では対応表が空のため、見た目は一切変わらない)。
- 隠しトロフィーが未発見の間は、将来画像が登録されても番号を渡さず常に🔒を
  表示するようにし、画像経由で正体が早期に漏れることを防いでいる。
- 既存のトロフィー定義・保存形式には一切手を加えておらず、表示専用の
  追加マッピングのみで実現している。
- 今回は謎解き・世界7不思議の専用カードには適用していない(既存の複雑な
  状態別デザインを変更するリスクを避けるため)。将来これらにも広げる場合は、
  各カードの`buildTrophyMarkHtml(...)`呼び出しに`def.number`を追加で渡すだけでよい。

## 2. デザイン上の工夫

- ダークネイビー(`--tl-bg`等、新規追加のCSS変数)×ゴールドを基調とし、
  既存の世界7不思議専用カード(黒曜石・金基調)・#142/#158専用デザイン
  (深い紺紫・金基調)と視覚的に統一感を持たせた。
- 新しいCSS変数はすべて`:root`に追加するにとどめ、既存の`--color-*`は一切
  変更していないため、他の画面の配色には影響しない。
- `.trophy-card`等の関連クラスは、このトロフィー一覧画面でしか使われて
  いないことを事前に確認したうえで配色を刷新した。
- レスポンシブは、国旗/首都分割カードが1マスの中でさらに2枚に割れる構造を
  踏まえ、極端に列数を増やすと分割後の1枚あたりの幅が文字より狭くなって
  しまうため、560px未満は1列・900px未満は2列・900px以上は3列という
  (分割カードの可読性を検証済みの)段階は維持し、より広いPC領域だけ追加の
  段階(1100px以上4列・1320px以上5列・1600px以上6列)を設けた。

## 3. 実施したテスト

### 3-1. 構文チェック

- `node --check js/app.js` / `node --check js/trophy.js`: 正常終了。

### 3-2. 既存Node単体テスト(ロジック層、12ファイル)

すべて成功(判定ロジックには一切触れていないため、当然の結果として全件成功):

```
trophy_common_full_conquest.test.js      37/37
trophy_common_logic.test.js              56/56
trophy_dual_split_aggregation_logic.test.js 81/81
trophy_encyclopedia4_logic.test.js       49/49
trophy_encyclopedia_logic.test.js        46/46
trophy_findcountry_logic.test.js         56/56
trophy_hidden61_logic.test.js            173/173
trophy_puzzle118_doc_mapping.test.js     621/621
trophy_puzzle118_full_judge_verification.test.js 388/388
trophy_puzzle118_logic.test.js           55/55
trophy_puzzle_hard5_logic.test.js        68/68
trophy_puzzle_numbering_logic.test.js    19/19
```

### 3-3. 既存Playwright UIテスト(トロフィー一覧画面に関係するもの)

新しいDOM構造(`#trophy-category-tabs`→`#trophy-category-grid`、
`.trophy-tab`→`.trophy-category-chip`、`#trophy-progress-summary`→
`#trophy-hero-earned`/`#trophy-hero-total`)に合わせてセレクターを更新し、
カテゴリー別進捗カードの折りたたみ(既定8枚)により一部のカテゴリーが
非表示になる場合は「すべて表示」を開くテスト手順を追加したうえで、
すべて成功を確認した:

```
playwright_findcountry_hidden_trophy_display.test.js  29/29
playwright_trophy_dual_split_cards.test.js            183/183
playwright_title_collection_removed.test.js           49/49
playwright_findcountry_trophies.test.js                19/19
playwright_encyclopedia4_trophies_ui.test.js           50/50
playwright_seven_wonders.test.js                       36/36
playwright_encyclopedia_smoke.test.js                  18/18
playwright_puzzle_trophy_award.test.js                 44/44
playwright_trophy_sticky_header.test.js                42/42
playwright_common_trophy_lab.test.js                   22/22
playwright_puzzle118_new_modes.test.js                 33/33
playwright_puzzle_flag_select.test.js                  85/85
playwright_puzzle_hard5.test.js                        49/49
playwright_puzzle_trophy_layout.test.js                29/29
playwright_puzzle_trophy_sound.test.js                 10/10
playwright_seven_wonders_lab.test.js                   21/21
playwright_common_trophy_double_count.test.js          7/7
playwright_trophy_award_queue.test.js                  23/23
playwright_hidden61_integration.test.js                12/12
playwright_findcountry_gameplay_integration.test.js    17/17
playwright_findcountry_mistake_events.test.js          16/16
```

`playwright_puzzle_trophy_award.test.js`は、獲得済みの謎解きカードを
クリックすると新しい詳細モーダルが開くようになった(従来は「何も起きない」
前提だった)ため、モーダルを閉じる手順を1箇所追加した。これは新機能による
意図した挙動変化であり、既存の「初回獲得演出は再実行されない」等の判定
ロジック自体は変更していない。

`playwright_trophy_sticky_header.test.js`は、横スクロールするカテゴリー
タブという前提が無くなったため、「カテゴリー別進捗カードの折りたたみが
既定で機能しており、「すべて表示」で全展開できる」ことを確認するテストに
置き換えた(固定ヘッダー自体の確認項目は無変更)。

### 3-4. レスポンシブ・横スクロール確認

375px/390px幅で、国旗/首都分割カードのバッジが画面右端からわずかに
はみ出す回帰を発見し、`.trophy-grid`の列数ブレークポイントを調整して解消
(詳細は上記「デザイン上の工夫」参照)。修正後、320〜1280px幅で横スクロール
が発生しないことを`playwright_trophy_dual_split_cards.test.js`・
`playwright_trophy_sticky_header.test.js`・`playwright_encyclopedia4_trophies_ui.test.js`
で確認済み。

iPhone(390px)・iPad(768px)・PC(1280px)でスクリーンショットを取得し、
一覧画面・詳細モーダルの見た目を目視確認した。

### 3-5. 回帰確認した既存機能

- 既存の獲得済みトロフィーは全て維持される(保存データ・判定ロジック自体
  を変更していないため)。
- 一覧表示総数452件・各カテゴリー件数は変更前と一致(既存のテストで確認)。
- 獲得数・達成率(ヒーローカード)は`getProgressSummary()`をそのまま使って
  いるため正確。
- 国旗・首都それぞれの獲得状態(分割カード)は従来どおり独立して表示される。
- 隠しトロフィーの情報が漏れていないこと(正式名称がページ内のどこにも
  出現しないことを含む)を確認済み。
- 謎解きの挑戦・正誤判定、世界7不思議の解放条件・7日間ロック・演出は
  いずれのロジックにも触れていない(関連テストすべて成功)。
- テストモード(`dev/common-trophy-lab.html`・世界7不思議テストラボ)は
  いずれもトロフィー一覧画面を開くため動作確認済み。

## 4. 未検証事項

- `playwright_findcountry_hidden61_end_of_play_notify.test.js`・
  `playwright_findcountry_nomiss_record_logic.test.js`・
  `playwright_map_uk_constituents.test.js`系・
  `playwright_namibia_caprivi_gap_fix.test.js`は、トロフィー一覧画面のDOM
  (`trophy-grid`等)を一切参照しない(grep で確認済み)ため、今回のUI変更の
  影響範囲外と判断し、個別の再実行は行っていない。
- `playwright_afghanistan_wakhan_gap_fix.test.js`の既存の失敗
  (「修正対象領域付近をタップするとアフガニスタンとして判定される」)は、
  今回のUI変更前から存在する既知の不具合(map.js側、過去のラウンドで
  main上でも再現確認済み)であり、今回のタスク範囲外のため手を加えていない。
- カテゴリー別進捗カードの列数(既定2〜4列)は実機ではなくPlaywrightの
  エミュレーションで確認した。実機での最終確認は推奨するが、既存の
  レスポンシブパターン(CSS Grid)を踏襲しているため大きな崩れは想定していない。

## 5. 既存機能への影響

影響なし。判定ロジック(`js/trophy.js`)は一切変更していない。`js/app.js`の
変更は、トロフィー一覧画面専用の表示関数の追加・置き換えと、既存カード
生成関数への`data-trophy-id`属性追加(既存の判定・保存には使われない、
表示専用の追加属性)のみ。

## 6. 今後の固有画像追加方法

1. `js/app.js`の`TROPHY_ICON_IMAGE_URLS`に`{ 番号: "画像URLまたはパス" }`を
   追加する。
2. (任意)謎解き・世界7不思議の専用カードにも広げる場合は、各カードの
   `buildTrophyMarkHtml(...)`呼び出しに`def.number`を渡すよう1行追加する。
3. 既存の判定ロジック・保存データには一切変更不要。

## 7. 変更したファイル

- `index.html`: `screen-trophy-list`の再構成、`trophy-detail-modal`の新規追加
- `js/app.js`: ヒーロー/カテゴリーグリッド/検索/表示切替/詳細モーダルの
  実装、既存カード生成関数への`data-trophy-id`追加、画像共通化ヘルパー追加
- `css/style.css`: 新規`--tl-*`変数、トロフィー一覧・詳細画面のダーク
  ネイビー×ゴールドへの再配色、レスポンシブ列数調整
- `tests/playwright_*.test.js`(9ファイル): セレクター更新・折りたたみ展開
  手順の追加(既存の判定内容は変更していない)

---

## 8. PR #89フォロー(第2ラウンド)での追加修正

ユーザーからの詳細なレビューを受け、同じブランチ・PR #89に対して以下6点を
追加修正した(新規PRは作成していない)。

### 8-1. ① 配色の全面修正(白系+ネイビー/ゴールド)

- 第1ラウンドでは画面全体がダークネイビーだったが、添付画像の指定どおり
  「白または淡いブルーグレーの全体背景」+「ネイビー・ゴールドを使うパーツ」
  の組み合わせに修正した。
- 新規CSS変数(`--tl-page-bg`/`--tl-surface`/`--tl-surface-border`/`--tl-ink`/
  `--tl-ink-sub`/`--tl-surface-shadow`/`--tl-gold-pale`/`--tl-gold-on-light`)を
  `:root`に追加し、既存のダークネイビー系変数(`--tl-bg`/`--tl-card-bg`/
  `--tl-gold`等)は一切変更していない。
- `#screen-trophy-list`の背景を`--tl-page-bg`(淡いブルーグレー)に変更。
- ヘッダー(`.trophy-list-header`)・ヒーローカード(`.trophy-hero-card`)・
  トロフィーカード(`.trophy-card`)・詳細モーダル(`#trophy-detail-modal
  .trophy-detail-box`)は指定どおりネイビー+ゴールドのまま維持。
- カテゴリーカード・下位カテゴリーチップ・一覧の見出し/表示切替/絞り込み/
  検索欄は白系背景+ネイビー文字に変更し、選択中カテゴリーは淡いゴールド
  (`--tl-gold-pale`)の背景+ゴールドの枠線で強調した。

### 8-2. ② ヘッダー・ヒーローカードの改善(地球・月桂樹モチーフ)

- ヒーローカードに、円+子午線(縦長の楕円2本)で構成した簡易的な地球儀の
  透かし模様(`.trophy-hero-globe-watermark`、`currentColor`・低不透明度の
  装飾SVG)を右上に配置。
- 獲得数の大きな数字(`0 / 452`)の両脇に、月桂樹の枝を模した装飾SVG
  (`.trophy-hero-laurel`、左右対称にCSSで反転)を配置し、トロフィー然とした
  上品な見た目にした。
- いずれも`aria-hidden="true"`の純粋な装飾で、情報・判定には一切関与しない。
- 獲得数・円形達成率・進捗バー・次の目標の配置自体は第1ラウンドのレイアウト
  を維持し、視認性を変えていない。

### 8-3. ③ カテゴリー表示を8分類+下位カテゴリーに再構成

既存の15カテゴリー(`TrophyModule.getCategories()`、内部的なカテゴリーID・
分類・獲得条件は一切変更していない)は維持したまま、**表示専用**の上位8分類
(すべて/国旗/首都/どこかな？/世界図鑑/謎解き/世界7不思議/共通)を新設した。

- `classifyTopBucket(mode, category)`: 各トロフィー定義の`mode`/`category`から
  上位分類を1つだけ決める純粋関数。findcountry/puzzle/sevenWondersは
  `category`で直接判定し、それ以外は`mode`(flag/capital/encyclopedia等)で
  判定、残りはすべて「共通」に含める。
- 国旗・首都で2枚に分割されるカード(32種類)は、分割後のカード単位
  (`isDualSplitCardNumber()`で判定)でそれぞれ「国旗」「首都」のどちらか
  一方にだけ計上し、二重計上は発生しない。
- 投稿いただいた仕様どおり、「共通」は下位に2グループを持つ:
  - 国旗・首都共通: 34種類(速度・連続・特殊チャレンジ等のうち、国旗/首都
    どちらのモードでも達成しうる、モード横断的な34種類。既存のcategory値は
    変更せず、表示上だけ「共通」の下位グループとして扱う)
  - 全体共通: 31種類(#395〜425、既存の`category === "common"`のまま)
  - 合計65種類(34+31)。
- 全体の集計(`computeBucketProgress()`)はトロフィー定義を1回だけ走査する
  単一ロジックで、上位8分類・下位カテゴリーの両方の獲得数/総数を同時に算出
  する。実データで検証した内訳は 国旗67/首都68/どこかな？97/世界図鑑20/
  謎解き127/世界7不思議8/共通65 で、合計452件と一致し、カテゴリー間の重複・
  漏れがないことをPlaywrightで実データに対して直接検証した。
- **判断が必要だった点(ユーザーへの報告)**: #142「都の神話」(内部category
  は「special」、modeは「legend」)と#158「世界の叡智」(内部categoryは
  「special」、modeは「encyclopedia」)の2件は、ユーザー指定の「34種類」
  (国旗・首都共通)には含まれていなかったため、それぞれのmodeに従って
  #142は「首都」、#158は「世界図鑑」に分類した。これにより合計は
  34(国旗・首都共通)+31(全体共通)=65件のまま変わらず、全体452件とも整合
  している。既存のトロフィーID・内部カテゴリー・獲得条件・判定ロジック・
  保存データは一切変更していない。

UIとしては、上位8分類のチップは常時表示(折りたたみ廃止)。いずれかを選ぶと
`state.trophyListFilter.category`は一旦「すべて」にリセットされ、その分類に
含まれる下位カテゴリーのチップ行が表示される(「共通」だけは上記の2グループ
を表示)。既存の絞り込みロジック(`applyTrophyFilters()`、獲得状況・検索との
AND条件)自体は変更していない。

### 8-4. ④ トロフィーカードの獲得済み/未獲得メリハリ強化

- 獲得済みカード: ゴールドの枠線+内側のゴールドの光彩(box-shadow)+カード
  左上にかけての薄い斜めのハイライト(光沢、疑似要素`::before`、情報は含まない
  純粋な装飾)を追加。
- 未獲得カード: 背景をより暗く、`grayscale(0.5) brightness(0.92)`で彩度を
  落とし、既存の不透明度低下と合わせて「くすんだ」見た目を強調。
- 世界7不思議専用カード(`.trophy-card-sevenwonder`)・図鑑特別演出
  (`.trophy-card-legend`、#142/#158)・隠しトロフィー未発見時
  (`.trophy-card-secret`)は、この新しい光沢・枠線装飾の対象から明示的に
  除外し、既存の専用デザインをそのまま維持した。
- 固有画像は今回作成せず、既存のアイコン(絵文字)とCSSの装飾だけで
  獲得済み/未獲得の差を表現した。

### 8-5. ⑤ レスポンシブ対応の調整

- 上位8分類のカテゴリーカードグリッドを、スマートフォン基本幅では3列
  (縦に3+3+2の3行で収まる)、480px以上で4列、900px以上で8列(PCでは
  1行に収まる)に調整。文字切れが起きないよう、ラベルは
  `overflow-wrap: anywhere`のまま維持。
- PCでは`.trophy-panel`の最大幅(1320px)+中央寄せ(margin: auto)は維持しつつ、
  8分類が1行に収まることでカテゴリーセクション全体の縦の占有量を削減し、
  カード間の余白とのバランスを改善した。
- トロフィーカード本体のグリッド列数(560px未満1列・900px未満2列・
  900px以上3列、PCは1100px以上4列・1320px以上5列・1600px以上6列)は
  第1ラウンドで分割カードの可読性を検証済みの値のため変更していない。
- 320〜1920px幅でPlaywrightによる要素位置の走査を行い、実際にページの
  横スクロールを引き起こす要素がないことを確認した(装飾用の地球儀透かし
  模様がヒーローカードの`overflow: hidden`で意図的にクリップされている
  部分のみ、ビューポート外に座標を持つが、見た目には現れない)。

### 8-6. ⑥ 安全性の再確認

- 検索・絞り込み・表示切替(グリッド/一覧)・詳細モーダル・固有画像用
  マッピングの機能はすべてそのまま維持されている(回帰テストで確認)。
- 既存トロフィーの獲得条件・判定ロジック(`js/trophy.js`)・保存データ・
  謎解き・世界7不思議・テストモードには一切変更を加えていない。
- カテゴリー別の件数(8分類+下位カテゴリー)・検索機能のいずれも、
  表示済みDOMの`.trophy-name`/`.trophy-number`等の既存テキストしか参照
  しておらず、隠しトロフィーの正式名称・謎解きの正解等、未公開情報が
  新たに漏れる経路は追加していない。
- 第1ラウンドで更新した9ファイルのうち、上位分類グリッドのID変更
  (`#trophy-category-grid`→`#trophy-bucket-grid`)・折りたたみ機能廃止に
  伴い影響を受けた10ファイルのセレクターを再度更新し、全件成功を確認した
  (詳細は下記3-6節)。

### 8-7. 第2ラウンドで再実行・再修正したテスト

折りたたみ機能廃止・カテゴリーグリッドのID変更・8分類+下位カテゴリーへの
再構成に伴い、以下10ファイルのセレクターを更新し、全件成功を確認した:

```
playwright_encyclopedia4_trophies_ui.test.js    50/50
playwright_encyclopedia_smoke.test.js           17/17
playwright_findcountry_hidden_trophy_display.test.js  29/29
playwright_findcountry_trophies.test.js         19/19
playwright_puzzle_trophy_award.test.js          44/44
playwright_title_collection_removed.test.js     46/46
playwright_trophy_dual_split_cards.test.js      183/183
playwright_seven_wonders.test.js                36/36
playwright_trophy_sticky_header.test.js         36/36
playwright_puzzle_trophy_layout.test.js         29/29
```

主な変更点:
- 「折りたたみを開く」手順はすべて削除(機能自体を廃止したため)。
- 上位分類に直接対応するカテゴリー(`encyclopedia`/`puzzle`/`sevenWonders`/
  `findcountry`/`all`)は`#trophy-bucket-grid [data-bucket="..."]`へ変更。
- 上位分類の配下にある下位カテゴリー(`findcountry_hidden`等)は、まず
  上位チップを選んでから`#trophy-subcategory-row [data-category="..."]`を
  選ぶ2段階のクリックに変更。
- 「legacy」(称号コレクション、#101〜112)は国旗側6件・首都側6件に分かれて
  表示されるようになったため、単一のチップでは選べない。件数確認は
  カードの`data-category`属性を直接参照する方式に変更した(内部データは
  無変更)。
- `playwright_trophy_dual_split_cards.test.js`の`progress`/`region`/`speed`/
  `double`カテゴリー(国旗・首都の分割カードを含む)は、新しい上位分類では
  「国旗」「首都」の2つに意図的に分かれて表示されるため、UIのチップ
  クリックだけでは両面を同時に表示する絞り込みを再現できなくなった。
  絞り込みロジック自体(`state.trophyListFilter.category`+
  `applyTrophyFilters()`)は変更していないため、テストはUIのクリックを
  経由せず同じ内部状態を直接設定する方式に変更し、従来どおり両面同時
  表示の検証を維持した。

### 8-8. 第2ラウンドで再確認した既存の回帰テスト(無関係ファイルへの影響なし)

トロフィー一覧画面のDOMを参照しない他の既存テスト(地図・首都トリビア・
「世界の国どこかな？」本体ロジック等、全30ファイル)を全件再実行し、
すべて成功することを確認した(`playwright_afghanistan_wakhan_gap_fix.test.js`
の既知の失敗1件を除く。これは第1ラウンド報告書「4. 未検証事項」に記載の
とおり、今回のUI変更より前から存在する既知の不具合で、トロフィー画面とは
無関係)。
