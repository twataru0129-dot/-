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
