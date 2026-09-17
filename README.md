# 世界の国旗クイズ

世界198の国・地域の国旗を当てる、学校でも家庭でも遊べるクイズWebアプリです。
ビルド不要のHTML / CSS / JavaScriptだけで作られており、GitHub Pagesでそのまま公開できます。

## このアプリについて

- 国連加盟193か国 + バチカン市国・パレスチナ・台湾・コソボ・プエルトリコの、合計198の国・地域を収録
- 北朝鮮も収録(表示名は「北朝鮮」、別名として正式名称「朝鮮民主主義人民共和国」も保持)
- 国旗は絵文字ではなく実際のSVG画像([flag-icons](https://github.com/lipis/flag-icons) by lipis, MITライセンス)を使用
- 1問6択・8秒の時間制限(考える3秒＋カウントダウン5秒)つきクイズ
- 全問正解でのみもらえる6段階の称号(国旗ビギナー〜国旗レジェンド)
- 称号取得時は名前を入力してメダル画像・認定証画像をPNGで保存可能
- 効果音・称号・記録はすべて端末内(localStorage)に保存され、外部には送信されません

## 遊び方

1. トップ画面で「クイズをはじめる」を押す
2. 問題数(10 / 20 / 30 / 50 / 100 / 198問)を選ぶ
3. 表示された国旗を見て、6つの国名から正しいものを選ぶ
   - 最初の3秒は「よく見て考えよう！」の考える時間(この間も回答可能)
   - その後5秒のカウントダウン。0になると自動的に不正解になる
4. 全問終了すると結果画面が表示される
5. 選んだ問題数を全問正解すると称号を獲得できる。称号を獲得すると「記念画像を作る」から名前を入力し、メダル画像または認定証画像をPNGで保存できる
6. トップ画面の「称号コレクション」から、獲得済み・未獲得の称号と挑戦記録を確認できる

## フォルダ構成

```
/
├─ index.html              … アプリ本体(この1ファイルを開けば動作確認できる)
├─ css/
│  └─ style.css            … スタイル(色などはCSS変数でまとめて管理)
├─ js/
│  ├─ countries.js         … 198の国・地域データ
│  ├─ storage.js           … localStorageまわりの管理
│  ├─ sound.js             … Web Audio APIによる効果音
│  ├─ quiz.js              … 出題・選択肢生成・タイマーのロジック
│  ├─ certificate.js       … メダル/認定証画像の生成(Canvas API)
│  └─ app.js               … 画面遷移・状態管理などアプリ全体の制御
├─ assets/
│  ├─ flags/                … 198か国分の国旗SVG(flag-icons由来)
│  └─ sounds/                … (任意)効果音ファイルを置く場合はここに配置
├─ README.md
└─ THIRD_PARTY_LICENSES.md … 国旗SVG(flag-icons)のライセンス表記
```

## ローカルで動かす方法

`index.html` をブラウザで直接開くだけでも見た目は確認できますが、ブラウザのセキュリティ制限により
`fetch`や画像読み込みが一部制限される場合があります。その場合は簡単なローカルサーバーを使ってください。

```bash
# このフォルダ(リポジトリのルート)で実行
python3 -m http.server 8000
# その後ブラウザで http://localhost:8000 を開く
```

Node.jsがある場合は以下でも同様に動作します。

```bash
npx serve .
```

## GitHubへのアップロード方法

```bash
git init   # まだリポジトリでない場合のみ
git add .
git commit -m "世界の国旗クイズを追加"
git remote add origin <あなたのリポジトリのURL>
git push -u origin main
```

すでにこのリポジトリで作業している場合は、`git add` → `git commit` → `git push` のみで構いません。

## GitHub Pages公開方法

1. GitHubのリポジトリページで **Settings → Pages** を開く
2. 「Build and deployment」の **Source** を `Deploy from a branch` にする
3. Branch を公開したいブランチ(例: `main`)、フォルダを `/ (root)` にして **Save**
4. しばらくすると `https://<ユーザー名>.github.io/<リポジトリ名>/` で公開される

国旗画像やCSS/JSはすべて `./assets/...` のような相対パスで参照しているため、
リポジトリ名がURLの一部になるGitHub Pagesでもパスが壊れず正しく表示されます。

## 国旗を追加・修正する方法

1. 国旗画像(SVG推奨)を `assets/flags/` に `xx.svg`(小文字の国コード)という名前で追加する
2. `js/countries.js` の配列に、以下の形式でオブジェクトを追加・修正する

```js
{
  id: "xx",                      // 一意のID(flagファイル名と合わせる)
  name: "国名",                   // クイズに表示される日本語名
  englishName: "Country Name",
  code: "XX",
  region: "asia",                // asia / europe / africa / namerica / samerica / oceania
  regionJa: "アジア",
  flag: "./assets/flags/xx.svg",
  aliases: ["国名"],
  similarCountries: ["yy", "zz"] // 任意: 選択肢に出しやすい紛らわしい国
}
```

3. 追加・削除した場合は合計件数がずれるため、`js/app.js` 冒頭の
   `console.assert(COUNTRIES.length === 198, ...)` のメッセージがブラウザのコンソールに出ていないか確認してください。

## 称号名を変更する方法

`js/quiz.js` の `TITLES` 配列を編集してください。称号名・条件・メダルの色(`medalClass`)を変更できます。

```js
const TITLES = [
  { count: 10, id: "beginner", name: "国旗ビギナー", medalClass: "medal-bronze", condition: "10問全問正解" },
  // ...
];
```

メダルの色を変えたい場合は `css/style.css` の `.medal-bronze` 等のクラスと、
`js/certificate.js` の `MEDAL_COLORS` の両方を合わせて編集してください(画面表示用CSSと保存画像用Canvasが別々に色を持っています)。

## 効果音を変更する方法

現在は外部ファイルを使わず、`js/sound.js`内でWeb Audio APIを使って電子音を自作しています。
音の高さや長さは `playCorrect` / `playWrong` / `playFanfare` 関数内の周波数(Hz)や再生時間を変更することで調整できます。

mp3などの音声ファイルを使いたい場合は、`assets/sounds/` にファイルを置き、`sound.js` の該当関数を
`new Audio("./assets/sounds/correct.mp3").play()` のような実装に差し替えてください。

## 開発用の称号テストについて

`js/app.js` の先頭にある `DEBUG_MODE` を `true` にすると、称号コレクション画面に各称号を
強制的に確認できるテスト用ボタンが表示されます。**本番公開時は必ず `false` のままにしてください。**

## 注意点

- 効果音はiPhoneなどの自動再生制限に対応するため、「クイズをはじめる」を押した瞬間に音声を有効化しています
- 画像保存はPNG形式です。iPhone Safariでは新しいタブに画像を表示するので、長押しして「写真に追加」を選んで保存してください
- 名前やスコアなどの個人情報はブラウザ内(localStorage)にのみ保存され、外部サーバーには送信されません
