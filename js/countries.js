// 世界198の国・地域データ
// このファイルを編集すると出題対象の国を追加・修正できます
const COUNTRIES = [
  {
    "id": "af",
    "name": "アフガニスタン",
    "englishName": "Afghanistan",
    "capital": "カブール",
    "code": "AF",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/af.svg",
    "aliases": [
      "アフガニスタン"
    ]
  },
  {
    "id": "am",
    "name": "アルメニア",
    "englishName": "Armenia",
    "capital": "エレバン",
    "code": "AM",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/am.svg",
    "aliases": [
      "アルメニア"
    ]
  },
  {
    "id": "az",
    "name": "アゼルバイジャン",
    "englishName": "Azerbaijan",
    "capital": "バクー",
    "code": "AZ",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/az.svg",
    "aliases": [
      "アゼルバイジャン"
    ]
  },
  {
    "id": "bh",
    "name": "バーレーン",
    "englishName": "Bahrain",
    "capital": "マナーマ",
    "code": "BH",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/bh.svg",
    "aliases": [
      "バーレーン"
    ],
    "similarCountries": [
      "qa"
    ]
  },
  {
    "id": "bd",
    "name": "バングラデシュ",
    "englishName": "Bangladesh",
    "capital": "ダッカ",
    "code": "BD",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/bd.svg",
    "aliases": [
      "バングラデシュ"
    ],
    "similarCountries": [
      "jp"
    ]
  },
  {
    "id": "bt",
    "name": "ブータン",
    "englishName": "Bhutan",
    "capital": "ティンプー",
    "code": "BT",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/bt.svg",
    "aliases": [
      "ブータン"
    ]
  },
  {
    "id": "bn",
    "name": "ブルネイ",
    "englishName": "Brunei",
    "capital": "バンダルスリブガワン",
    "code": "BN",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/bn.svg",
    "aliases": [
      "ブルネイ"
    ]
  },
  {
    "id": "kh",
    "name": "カンボジア",
    "englishName": "Cambodia",
    "capital": "プノンペン",
    "code": "KH",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/kh.svg",
    "aliases": [
      "カンボジア"
    ]
  },
  {
    "id": "cn",
    "name": "中国",
    "englishName": "China",
    "capital": "北京",
    "code": "CN",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/cn.svg",
    "aliases": [
      "中国",
      "中華人民共和国"
    ],
    "officialName": "中華人民共和国",
    "similarCountries": [
      "tw",
      "vn"
    ]
  },
  {
    "id": "ge",
    "name": "ジョージア",
    "englishName": "Georgia",
    "capital": "トビリシ",
    "code": "GE",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/ge.svg",
    "aliases": [
      "ジョージア"
    ]
  },
  {
    "id": "in",
    "name": "インド",
    "englishName": "India",
    "capital": "ニューデリー",
    "code": "IN",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/in.svg",
    "aliases": [
      "インド"
    ]
  },
  {
    "id": "id",
    "name": "インドネシア",
    "englishName": "Indonesia",
    "capital": "ジャカルタ",
    "capitalNote": "将来的に首都をヌサンタラへ移転する計画が進められています。",
    "code": "ID",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/id.svg",
    "aliases": [
      "インドネシア"
    ],
    "similarCountries": [
      "mc",
      "pl",
      "sg"
    ]
  },
  {
    "id": "ir",
    "name": "イラン",
    "englishName": "Iran",
    "capital": "テヘラン",
    "code": "IR",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/ir.svg",
    "aliases": [
      "イラン"
    ]
  },
  {
    "id": "iq",
    "name": "イラク",
    "englishName": "Iraq",
    "capital": "バグダッド",
    "code": "IQ",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/iq.svg",
    "aliases": [
      "イラク"
    ],
    "similarCountries": [
      "eg",
      "sy",
      "ye",
      "sd"
    ]
  },
  {
    "id": "il",
    "name": "イスラエル",
    "englishName": "Israel",
    "capital": "エルサレム",
    "capitalNote": "多くの国の大使館はテルアビブに置かれています。",
    "code": "IL",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/il.svg",
    "aliases": [
      "イスラエル"
    ]
  },
  {
    "id": "jp",
    "name": "日本",
    "englishName": "Japan",
    "capital": "東京",
    "code": "JP",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/jp.svg",
    "aliases": [
      "日本"
    ],
    "similarCountries": [
      "bd",
      "pw"
    ]
  },
  {
    "id": "jo",
    "name": "ヨルダン",
    "englishName": "Jordan",
    "capital": "アンマン",
    "code": "JO",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/jo.svg",
    "aliases": [
      "ヨルダン"
    ],
    "similarCountries": [
      "ps",
      "sd",
      "kw"
    ]
  },
  {
    "id": "kz",
    "name": "カザフスタン",
    "englishName": "Kazakhstan",
    "capital": "アスタナ",
    "capitalNote": "旧名ヌルスルタンから2022年に改称されました。",
    "code": "KZ",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/kz.svg",
    "aliases": [
      "カザフスタン"
    ]
  },
  {
    "id": "kp",
    "name": "北朝鮮",
    "englishName": "North Korea",
    "capital": "ピョンヤン",
    "code": "KP",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/kp.svg",
    "aliases": [
      "北朝鮮",
      "朝鮮民主主義人民共和国"
    ],
    "officialName": "朝鮮民主主義人民共和国",
    "similarCountries": [
      "kr",
      "vn"
    ]
  },
  {
    "id": "kr",
    "name": "韓国",
    "englishName": "South Korea",
    "capital": "ソウル",
    "code": "KR",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/kr.svg",
    "aliases": [
      "韓国",
      "大韓民国"
    ],
    "officialName": "大韓民国",
    "similarCountries": [
      "kp",
      "jp"
    ]
  },
  {
    "id": "kw",
    "name": "クウェート",
    "englishName": "Kuwait",
    "capital": "クウェート",
    "code": "KW",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/kw.svg",
    "aliases": [
      "クウェート"
    ],
    "similarCountries": [
      "jo",
      "sd",
      "ae"
    ]
  },
  {
    "id": "kg",
    "name": "キルギス",
    "englishName": "Kyrgyzstan",
    "capital": "ビシュケク",
    "code": "KG",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/kg.svg",
    "aliases": [
      "キルギス"
    ]
  },
  {
    "id": "la",
    "name": "ラオス",
    "englishName": "Laos",
    "capital": "ビエンチャン",
    "code": "LA",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/la.svg",
    "aliases": [
      "ラオス"
    ]
  },
  {
    "id": "lb",
    "name": "レバノン",
    "englishName": "Lebanon",
    "capital": "ベイルート",
    "code": "LB",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/lb.svg",
    "aliases": [
      "レバノン"
    ]
  },
  {
    "id": "my",
    "name": "マレーシア",
    "englishName": "Malaysia",
    "capital": "クアラルンプール",
    "code": "MY",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/my.svg",
    "aliases": [
      "マレーシア"
    ]
  },
  {
    "id": "mv",
    "name": "モルディブ",
    "englishName": "Maldives",
    "capital": "マレ",
    "code": "MV",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/mv.svg",
    "aliases": [
      "モルディブ"
    ]
  },
  {
    "id": "mn",
    "name": "モンゴル",
    "englishName": "Mongolia",
    "capital": "ウランバートル",
    "code": "MN",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/mn.svg",
    "aliases": [
      "モンゴル"
    ]
  },
  {
    "id": "mm",
    "name": "ミャンマー",
    "englishName": "Myanmar",
    "capital": "ネピドー",
    "capitalNote": "2005年にヤンゴンから首都が移転しました。",
    "code": "MM",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/mm.svg",
    "aliases": [
      "ミャンマー"
    ]
  },
  {
    "id": "np",
    "name": "ネパール",
    "englishName": "Nepal",
    "capital": "カトマンズ",
    "code": "NP",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/np.svg",
    "aliases": [
      "ネパール"
    ]
  },
  {
    "id": "om",
    "name": "オマーン",
    "englishName": "Oman",
    "capital": "マスカット",
    "code": "OM",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/om.svg",
    "aliases": [
      "オマーン"
    ]
  },
  {
    "id": "pk",
    "name": "パキスタン",
    "englishName": "Pakistan",
    "capital": "イスラマバード",
    "code": "PK",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/pk.svg",
    "aliases": [
      "パキスタン"
    ]
  },
  {
    "id": "ps",
    "name": "パレスチナ",
    "englishName": "Palestine",
    "capital": "東エルサレム",
    "code": "PS",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/ps.svg",
    "aliases": [
      "パレスチナ"
    ],
    "similarCountries": [
      "jo",
      "sd"
    ]
  },
  {
    "id": "ph",
    "name": "フィリピン",
    "englishName": "Philippines",
    "capital": "マニラ",
    "code": "PH",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/ph.svg",
    "aliases": [
      "フィリピン"
    ],
    "similarCountries": [
      "cz",
      "cu"
    ]
  },
  {
    "id": "qa",
    "name": "カタール",
    "englishName": "Qatar",
    "capital": "ドーハ",
    "code": "QA",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/qa.svg",
    "aliases": [
      "カタール"
    ],
    "similarCountries": [
      "bh"
    ]
  },
  {
    "id": "sa",
    "name": "サウジアラビア",
    "englishName": "Saudi Arabia",
    "capital": "リヤド",
    "code": "SA",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/sa.svg",
    "aliases": [
      "サウジアラビア"
    ]
  },
  {
    "id": "sg",
    "name": "シンガポール",
    "englishName": "Singapore",
    "capital": "シンガポール",
    "code": "SG",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/sg.svg",
    "aliases": [
      "シンガポール"
    ],
    "similarCountries": [
      "mc",
      "pl",
      "id"
    ]
  },
  {
    "id": "lk",
    "name": "スリランカ",
    "englishName": "Sri Lanka",
    "capital": "スリジャヤワルダナプラコッテ",
    "capitalNote": "商業の中心地はコロンボです。",
    "code": "LK",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/lk.svg",
    "aliases": [
      "スリランカ"
    ]
  },
  {
    "id": "sy",
    "name": "シリア",
    "englishName": "Syria",
    "capital": "ダマスカス",
    "code": "SY",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/sy.svg",
    "aliases": [
      "シリア"
    ],
    "similarCountries": [
      "iq",
      "eg",
      "ye",
      "sd"
    ]
  },
  {
    "id": "tw",
    "name": "台湾",
    "englishName": "Taiwan",
    "capital": "台北",
    "code": "TW",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/tw.svg",
    "aliases": [
      "台湾"
    ],
    "similarCountries": [
      "cn"
    ]
  },
  {
    "id": "tj",
    "name": "タジキスタン",
    "englishName": "Tajikistan",
    "capital": "ドゥシャンベ",
    "code": "TJ",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/tj.svg",
    "aliases": [
      "タジキスタン"
    ]
  },
  {
    "id": "th",
    "name": "タイ",
    "englishName": "Thailand",
    "capital": "バンコク",
    "code": "TH",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/th.svg",
    "aliases": [
      "タイ"
    ]
  },
  {
    "id": "tl",
    "name": "東ティモール",
    "englishName": "Timor-Leste",
    "capital": "ディリ",
    "code": "TL",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/tl.svg",
    "aliases": [
      "東ティモール"
    ]
  },
  {
    "id": "tm",
    "name": "トルクメニスタン",
    "englishName": "Turkmenistan",
    "capital": "アシガバット",
    "code": "TM",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/tm.svg",
    "aliases": [
      "トルクメニスタン"
    ]
  },
  {
    "id": "tr",
    "name": "トルコ",
    "englishName": "Turkey",
    "capital": "アンカラ",
    "code": "TR",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/tr.svg",
    "aliases": [
      "トルコ"
    ]
  },
  {
    "id": "ae",
    "name": "アラブ首長国連邦",
    "englishName": "United Arab Emirates",
    "capital": "アブダビ",
    "code": "AE",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/ae.svg",
    "aliases": [
      "アラブ首長国連邦"
    ],
    "similarCountries": [
      "kw"
    ]
  },
  {
    "id": "uz",
    "name": "ウズベキスタン",
    "englishName": "Uzbekistan",
    "capital": "タシケント",
    "code": "UZ",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/uz.svg",
    "aliases": [
      "ウズベキスタン"
    ]
  },
  {
    "id": "vn",
    "name": "ベトナム",
    "englishName": "Vietnam",
    "capital": "ハノイ",
    "code": "VN",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/vn.svg",
    "aliases": [
      "ベトナム"
    ],
    "similarCountries": [
      "cn"
    ]
  },
  {
    "id": "ye",
    "name": "イエメン",
    "englishName": "Yemen",
    "capital": "サナア",
    "capitalNote": "内戦の影響で、暫定的な政府機能の一部はアデンに置かれています。",
    "code": "YE",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/ye.svg",
    "aliases": [
      "イエメン"
    ],
    "similarCountries": [
      "iq",
      "eg",
      "sy",
      "sd"
    ]
  },
  {
    "id": "al",
    "name": "アルバニア",
    "englishName": "Albania",
    "capital": "ティラナ",
    "code": "AL",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/al.svg",
    "aliases": [
      "アルバニア"
    ]
  },
  {
    "id": "ad",
    "name": "アンドラ",
    "englishName": "Andorra",
    "capital": "アンドラ・ラ・ベリャ",
    "code": "AD",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/ad.svg",
    "aliases": [
      "アンドラ"
    ],
    "similarCountries": [
      "ro",
      "td",
      "md"
    ]
  },
  {
    "id": "at",
    "name": "オーストリア",
    "englishName": "Austria",
    "capital": "ウィーン",
    "code": "AT",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/at.svg",
    "aliases": [
      "オーストリア"
    ],
    "similarCountries": [
      "lv"
    ]
  },
  {
    "id": "by",
    "name": "ベラルーシ",
    "englishName": "Belarus",
    "capital": "ミンスク",
    "code": "BY",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/by.svg",
    "aliases": [
      "ベラルーシ"
    ],
    "similarCountries": [
      "bg"
    ]
  },
  {
    "id": "be",
    "name": "ベルギー",
    "englishName": "Belgium",
    "capital": "ブリュッセル",
    "code": "BE",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/be.svg",
    "aliases": [
      "ベルギー"
    ]
  },
  {
    "id": "ba",
    "name": "ボスニア・ヘルツェゴビナ",
    "englishName": "Bosnia and Herzegovina",
    "capital": "サラエボ",
    "code": "BA",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/ba.svg",
    "aliases": [
      "ボスニア・ヘルツェゴビナ"
    ]
  },
  {
    "id": "bg",
    "name": "ブルガリア",
    "englishName": "Bulgaria",
    "capital": "ソフィア",
    "code": "BG",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/bg.svg",
    "aliases": [
      "ブルガリア"
    ],
    "similarCountries": [
      "by"
    ]
  },
  {
    "id": "hr",
    "name": "クロアチア",
    "englishName": "Croatia",
    "capital": "ザグレブ",
    "code": "HR",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/hr.svg",
    "aliases": [
      "クロアチア"
    ]
  },
  {
    "id": "cy",
    "name": "キプロス",
    "englishName": "Cyprus",
    "capital": "ニコシア",
    "code": "CY",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/cy.svg",
    "aliases": [
      "キプロス"
    ]
  },
  {
    "id": "cz",
    "name": "チェコ",
    "englishName": "Czechia",
    "capital": "プラハ",
    "code": "CZ",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/cz.svg",
    "aliases": [
      "チェコ"
    ],
    "similarCountries": [
      "ph",
      "cu"
    ]
  },
  {
    "id": "dk",
    "name": "デンマーク",
    "englishName": "Denmark",
    "capital": "コペンハーゲン",
    "code": "DK",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/dk.svg",
    "aliases": [
      "デンマーク"
    ],
    "similarCountries": [
      "no",
      "is",
      "se"
    ]
  },
  {
    "id": "ee",
    "name": "エストニア",
    "englishName": "Estonia",
    "capital": "タリン",
    "code": "EE",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/ee.svg",
    "aliases": [
      "エストニア"
    ]
  },
  {
    "id": "fi",
    "name": "フィンランド",
    "englishName": "Finland",
    "capital": "ヘルシンキ",
    "code": "FI",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/fi.svg",
    "aliases": [
      "フィンランド"
    ],
    "similarCountries": [
      "se",
      "no"
    ]
  },
  {
    "id": "fr",
    "name": "フランス",
    "englishName": "France",
    "capital": "パリ",
    "code": "FR",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/fr.svg",
    "aliases": [
      "フランス"
    ]
  },
  {
    "id": "de",
    "name": "ドイツ",
    "englishName": "Germany",
    "capital": "ベルリン",
    "code": "DE",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/de.svg",
    "aliases": [
      "ドイツ"
    ]
  },
  {
    "id": "gr",
    "name": "ギリシャ",
    "englishName": "Greece",
    "capital": "アテネ",
    "code": "GR",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/gr.svg",
    "aliases": [
      "ギリシャ"
    ]
  },
  {
    "id": "va",
    "name": "バチカン",
    "englishName": "Vatican City",
    "capital": "バチカン市国",
    "code": "VA",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/va.svg",
    "aliases": [
      "バチカン",
      "バチカン市国"
    ],
    "officialName": "バチカン市国"
  },
  {
    "id": "hu",
    "name": "ハンガリー",
    "englishName": "Hungary",
    "capital": "ブダペスト",
    "code": "HU",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/hu.svg",
    "aliases": [
      "ハンガリー"
    ]
  },
  {
    "id": "is",
    "name": "アイスランド",
    "englishName": "Iceland",
    "capital": "レイキャビク",
    "code": "IS",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/is.svg",
    "aliases": [
      "アイスランド"
    ],
    "similarCountries": [
      "no",
      "dk",
      "se"
    ]
  },
  {
    "id": "ie",
    "name": "アイルランド",
    "englishName": "Ireland",
    "capital": "ダブリン",
    "code": "IE",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/ie.svg",
    "aliases": [
      "アイルランド"
    ],
    "similarCountries": [
      "ci",
      "it"
    ]
  },
  {
    "id": "it",
    "name": "イタリア",
    "englishName": "Italy",
    "capital": "ローマ",
    "code": "IT",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/it.svg",
    "aliases": [
      "イタリア"
    ],
    "similarCountries": [
      "ie",
      "mx",
      "hu"
    ]
  },
  {
    "id": "xk",
    "name": "コソボ",
    "englishName": "Kosovo",
    "capital": "プリシュティナ",
    "code": "XK",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/xk.svg",
    "aliases": [
      "コソボ"
    ]
  },
  {
    "id": "lv",
    "name": "ラトビア",
    "englishName": "Latvia",
    "capital": "リガ",
    "code": "LV",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/lv.svg",
    "aliases": [
      "ラトビア"
    ],
    "similarCountries": [
      "at"
    ]
  },
  {
    "id": "li",
    "name": "リヒテンシュタイン",
    "englishName": "Liechtenstein",
    "capital": "ファドゥーツ",
    "code": "LI",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/li.svg",
    "aliases": [
      "リヒテンシュタイン"
    ],
    "similarCountries": [
      "ht"
    ]
  },
  {
    "id": "lt",
    "name": "リトアニア",
    "englishName": "Lithuania",
    "capital": "ビリニュス",
    "code": "LT",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/lt.svg",
    "aliases": [
      "リトアニア"
    ],
    "similarCountries": [
      "bo",
      "gh"
    ]
  },
  {
    "id": "lu",
    "name": "ルクセンブルク",
    "englishName": "Luxembourg",
    "capital": "ルクセンブルク",
    "code": "LU",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/lu.svg",
    "aliases": [
      "ルクセンブルク"
    ],
    "similarCountries": [
      "nl",
      "ru",
      "fr"
    ]
  },
  {
    "id": "mt",
    "name": "マルタ",
    "englishName": "Malta",
    "capital": "バレッタ",
    "code": "MT",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/mt.svg",
    "aliases": [
      "マルタ"
    ]
  },
  {
    "id": "md",
    "name": "モルドバ",
    "englishName": "Moldova",
    "capital": "キシナウ",
    "code": "MD",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/md.svg",
    "aliases": [
      "モルドバ"
    ],
    "similarCountries": [
      "ro",
      "td",
      "ad"
    ]
  },
  {
    "id": "mc",
    "name": "モナコ",
    "englishName": "Monaco",
    "capital": "モナコ",
    "code": "MC",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/mc.svg",
    "aliases": [
      "モナコ"
    ],
    "similarCountries": [
      "id",
      "pl"
    ]
  },
  {
    "id": "me",
    "name": "モンテネグロ",
    "englishName": "Montenegro",
    "capital": "ポドゴリツァ",
    "code": "ME",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/me.svg",
    "aliases": [
      "モンテネグロ"
    ],
    "similarCountries": [
      "rs",
      "hr",
      "al",
      "mk",
      "ba"
    ]
  },
  {
    "id": "nl",
    "name": "オランダ",
    "englishName": "Netherlands",
    "capital": "アムステルダム",
    "code": "NL",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/nl.svg",
    "aliases": [
      "オランダ"
    ],
    "similarCountries": [
      "lu",
      "ru",
      "fr"
    ]
  },
  {
    "id": "mk",
    "name": "北マケドニア",
    "englishName": "North Macedonia",
    "capital": "スコピエ",
    "code": "MK",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/mk.svg",
    "aliases": [
      "北マケドニア"
    ]
  },
  {
    "id": "no",
    "name": "ノルウェー",
    "englishName": "Norway",
    "capital": "オスロ",
    "code": "NO",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/no.svg",
    "aliases": [
      "ノルウェー"
    ],
    "similarCountries": [
      "is",
      "dk",
      "se",
      "fi"
    ]
  },
  {
    "id": "pl",
    "name": "ポーランド",
    "englishName": "Poland",
    "capital": "ワルシャワ",
    "code": "PL",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/pl.svg",
    "aliases": [
      "ポーランド"
    ],
    "similarCountries": [
      "id",
      "mc"
    ]
  },
  {
    "id": "pt",
    "name": "ポルトガル",
    "englishName": "Portugal",
    "capital": "リスボン",
    "code": "PT",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/pt.svg",
    "aliases": [
      "ポルトガル"
    ]
  },
  {
    "id": "ro",
    "name": "ルーマニア",
    "englishName": "Romania",
    "capital": "ブカレスト",
    "code": "RO",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/ro.svg",
    "aliases": [
      "ルーマニア"
    ],
    "similarCountries": [
      "td",
      "ad",
      "md"
    ]
  },
  {
    "id": "ru",
    "name": "ロシア",
    "englishName": "Russia",
    "capital": "モスクワ",
    "code": "RU",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/ru.svg",
    "aliases": [
      "ロシア"
    ],
    "similarCountries": [
      "sk",
      "si",
      "nl",
      "lu"
    ]
  },
  {
    "id": "sm",
    "name": "サンマリノ",
    "englishName": "San Marino",
    "capital": "サンマリノ",
    "code": "SM",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/sm.svg",
    "aliases": [
      "サンマリノ"
    ],
    "similarCountries": [
      "it"
    ]
  },
  {
    "id": "rs",
    "name": "セルビア",
    "englishName": "Serbia",
    "capital": "ベオグラード",
    "code": "RS",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/rs.svg",
    "aliases": [
      "セルビア"
    ]
  },
  {
    "id": "sk",
    "name": "スロバキア",
    "englishName": "Slovakia",
    "capital": "ブラチスラバ",
    "code": "SK",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/sk.svg",
    "aliases": [
      "スロバキア"
    ],
    "similarCountries": [
      "si",
      "ru",
      "rs",
      "hr"
    ]
  },
  {
    "id": "si",
    "name": "スロベニア",
    "englishName": "Slovenia",
    "capital": "リュブリャナ",
    "code": "SI",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/si.svg",
    "aliases": [
      "スロベニア"
    ],
    "similarCountries": [
      "sk",
      "ru",
      "rs",
      "hr"
    ]
  },
  {
    "id": "es",
    "name": "スペイン",
    "englishName": "Spain",
    "capital": "マドリード",
    "code": "ES",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/es.svg",
    "aliases": [
      "スペイン"
    ]
  },
  {
    "id": "se",
    "name": "スウェーデン",
    "englishName": "Sweden",
    "capital": "ストックホルム",
    "code": "SE",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/se.svg",
    "aliases": [
      "スウェーデン"
    ],
    "similarCountries": [
      "no",
      "is",
      "dk",
      "fi"
    ]
  },
  {
    "id": "ch",
    "name": "スイス",
    "englishName": "Switzerland",
    "capital": "ベルン",
    "capitalNote": "スイスには憲法上の首都の規定がなく、ベルンが事実上の首都とされています。",
    "code": "CH",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/ch.svg",
    "aliases": [
      "スイス"
    ]
  },
  {
    "id": "ua",
    "name": "ウクライナ",
    "englishName": "Ukraine",
    "capital": "キーウ",
    "code": "UA",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/ua.svg",
    "aliases": [
      "ウクライナ"
    ]
  },
  {
    "id": "gb",
    "name": "イギリス",
    "englishName": "United Kingdom",
    "capital": "ロンドン",
    "code": "GB",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/gb.svg",
    "aliases": [
      "イギリス"
    ],
    "similarCountries": [
      "au",
      "nz"
    ]
  },
  {
    "id": "dz",
    "name": "アルジェリア",
    "englishName": "Algeria",
    "capital": "アルジェ",
    "code": "DZ",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/dz.svg",
    "aliases": [
      "アルジェリア"
    ]
  },
  {
    "id": "ao",
    "name": "アンゴラ",
    "englishName": "Angola",
    "capital": "ルアンダ",
    "code": "AO",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/ao.svg",
    "aliases": [
      "アンゴラ"
    ]
  },
  {
    "id": "bj",
    "name": "ベナン",
    "englishName": "Benin",
    "capital": "ポルトノボ",
    "code": "BJ",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/bj.svg",
    "aliases": [
      "ベナン"
    ]
  },
  {
    "id": "bw",
    "name": "ボツワナ",
    "englishName": "Botswana",
    "capital": "ハボローネ",
    "code": "BW",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/bw.svg",
    "aliases": [
      "ボツワナ"
    ]
  },
  {
    "id": "bf",
    "name": "ブルキナファソ",
    "englishName": "Burkina Faso",
    "capital": "ワガドゥグー",
    "code": "BF",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/bf.svg",
    "aliases": [
      "ブルキナファソ"
    ]
  },
  {
    "id": "bi",
    "name": "ブルンジ",
    "englishName": "Burundi",
    "capital": "ギテガ",
    "capitalNote": "2019年にブジュンブラから首都が移転しました。",
    "code": "BI",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/bi.svg",
    "aliases": [
      "ブルンジ"
    ]
  },
  {
    "id": "cv",
    "name": "カーボベルデ",
    "englishName": "Cabo Verde",
    "capital": "プライア",
    "code": "CV",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/cv.svg",
    "aliases": [
      "カーボベルデ"
    ]
  },
  {
    "id": "cm",
    "name": "カメルーン",
    "englishName": "Cameroon",
    "capital": "ヤウンデ",
    "code": "CM",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/cm.svg",
    "aliases": [
      "カメルーン"
    ],
    "similarCountries": [
      "ml",
      "sn",
      "gn"
    ]
  },
  {
    "id": "cf",
    "name": "中央アフリカ",
    "englishName": "Central African Republic",
    "capital": "バンギ",
    "code": "CF",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/cf.svg",
    "aliases": [
      "中央アフリカ"
    ]
  },
  {
    "id": "td",
    "name": "チャド",
    "englishName": "Chad",
    "capital": "ンジャメナ",
    "code": "TD",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/td.svg",
    "aliases": [
      "チャド"
    ],
    "similarCountries": [
      "ro",
      "ad",
      "md"
    ]
  },
  {
    "id": "km",
    "name": "コモロ",
    "englishName": "Comoros",
    "capital": "モロニ",
    "code": "KM",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/km.svg",
    "aliases": [
      "コモロ"
    ]
  },
  {
    "id": "cg",
    "name": "コンゴ共和国",
    "englishName": "Republic of the Congo",
    "capital": "ブラザビル",
    "code": "CG",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/cg.svg",
    "aliases": [
      "コンゴ共和国"
    ]
  },
  {
    "id": "cd",
    "name": "コンゴ民主共和国",
    "englishName": "DR Congo",
    "capital": "キンシャサ",
    "code": "CD",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/cd.svg",
    "aliases": [
      "コンゴ民主共和国"
    ]
  },
  {
    "id": "ci",
    "name": "コートジボワール",
    "englishName": "Côte d'Ivoire",
    "capital": "ヤムスクロ",
    "code": "CI",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/ci.svg",
    "aliases": [
      "コートジボワール"
    ],
    "similarCountries": [
      "ie",
      "it"
    ]
  },
  {
    "id": "dj",
    "name": "ジブチ",
    "englishName": "Djibouti",
    "capital": "ジブチ",
    "code": "DJ",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/dj.svg",
    "aliases": [
      "ジブチ"
    ]
  },
  {
    "id": "eg",
    "name": "エジプト",
    "englishName": "Egypt",
    "capital": "カイロ",
    "code": "EG",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/eg.svg",
    "aliases": [
      "エジプト"
    ],
    "similarCountries": [
      "iq",
      "sy",
      "ye",
      "sd"
    ]
  },
  {
    "id": "gq",
    "name": "赤道ギニア",
    "englishName": "Equatorial Guinea",
    "capital": "マラボ",
    "code": "GQ",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/gq.svg",
    "aliases": [
      "赤道ギニア"
    ]
  },
  {
    "id": "er",
    "name": "エリトリア",
    "englishName": "Eritrea",
    "capital": "アスマラ",
    "code": "ER",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/er.svg",
    "aliases": [
      "エリトリア"
    ]
  },
  {
    "id": "sz",
    "name": "エスワティニ",
    "englishName": "Eswatini",
    "capital": "ムババーネ",
    "capitalNote": "王室・立法の首都はロバンバです。",
    "code": "SZ",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/sz.svg",
    "aliases": [
      "エスワティニ"
    ]
  },
  {
    "id": "et",
    "name": "エチオピア",
    "englishName": "Ethiopia",
    "capital": "アディスアベバ",
    "code": "ET",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/et.svg",
    "aliases": [
      "エチオピア"
    ],
    "similarCountries": [
      "gh",
      "bo"
    ]
  },
  {
    "id": "ga",
    "name": "ガボン",
    "englishName": "Gabon",
    "capital": "リーブルビル",
    "code": "GA",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/ga.svg",
    "aliases": [
      "ガボン"
    ]
  },
  {
    "id": "gm",
    "name": "ガンビア",
    "englishName": "Gambia",
    "capital": "バンジュール",
    "code": "GM",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/gm.svg",
    "aliases": [
      "ガンビア"
    ]
  },
  {
    "id": "gh",
    "name": "ガーナ",
    "englishName": "Ghana",
    "capital": "アクラ",
    "code": "GH",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/gh.svg",
    "aliases": [
      "ガーナ"
    ],
    "similarCountries": [
      "et",
      "bo"
    ]
  },
  {
    "id": "gn",
    "name": "ギニア",
    "englishName": "Guinea",
    "capital": "コナクリ",
    "code": "GN",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/gn.svg",
    "aliases": [
      "ギニア"
    ],
    "similarCountries": [
      "ml",
      "sn",
      "cm"
    ]
  },
  {
    "id": "gw",
    "name": "ギニアビサウ",
    "englishName": "Guinea-Bissau",
    "capital": "ビサウ",
    "code": "GW",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/gw.svg",
    "aliases": [
      "ギニアビサウ"
    ]
  },
  {
    "id": "ke",
    "name": "ケニア",
    "englishName": "Kenya",
    "capital": "ナイロビ",
    "code": "KE",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/ke.svg",
    "aliases": [
      "ケニア"
    ]
  },
  {
    "id": "ls",
    "name": "レソト",
    "englishName": "Lesotho",
    "capital": "マセル",
    "code": "LS",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/ls.svg",
    "aliases": [
      "レソト"
    ]
  },
  {
    "id": "lr",
    "name": "リベリア",
    "englishName": "Liberia",
    "capital": "モンロビア",
    "code": "LR",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/lr.svg",
    "aliases": [
      "リベリア"
    ]
  },
  {
    "id": "ly",
    "name": "リビア",
    "englishName": "Libya",
    "capital": "トリポリ",
    "code": "LY",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/ly.svg",
    "aliases": [
      "リビア"
    ]
  },
  {
    "id": "mg",
    "name": "マダガスカル",
    "englishName": "Madagascar",
    "capital": "アンタナナリボ",
    "code": "MG",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/mg.svg",
    "aliases": [
      "マダガスカル"
    ]
  },
  {
    "id": "mw",
    "name": "マラウイ",
    "englishName": "Malawi",
    "capital": "リロングウェ",
    "code": "MW",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/mw.svg",
    "aliases": [
      "マラウイ"
    ]
  },
  {
    "id": "ml",
    "name": "マリ",
    "englishName": "Mali",
    "capital": "バマコ",
    "code": "ML",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/ml.svg",
    "aliases": [
      "マリ"
    ],
    "similarCountries": [
      "sn",
      "gn",
      "cm"
    ]
  },
  {
    "id": "mr",
    "name": "モーリタニア",
    "englishName": "Mauritania",
    "capital": "ヌアクショット",
    "code": "MR",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/mr.svg",
    "aliases": [
      "モーリタニア"
    ]
  },
  {
    "id": "mu",
    "name": "モーリシャス",
    "englishName": "Mauritius",
    "capital": "ポートルイス",
    "code": "MU",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/mu.svg",
    "aliases": [
      "モーリシャス"
    ],
    "similarCountries": [
      "za"
    ]
  },
  {
    "id": "ma",
    "name": "モロッコ",
    "englishName": "Morocco",
    "capital": "ラバト",
    "code": "MA",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/ma.svg",
    "aliases": [
      "モロッコ"
    ]
  },
  {
    "id": "mz",
    "name": "モザンビーク",
    "englishName": "Mozambique",
    "capital": "マプト",
    "code": "MZ",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/mz.svg",
    "aliases": [
      "モザンビーク"
    ]
  },
  {
    "id": "na",
    "name": "ナミビア",
    "englishName": "Namibia",
    "capital": "ウィントフック",
    "code": "NA",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/na.svg",
    "aliases": [
      "ナミビア"
    ]
  },
  {
    "id": "ne",
    "name": "ニジェール",
    "englishName": "Niger",
    "capital": "ニアメ",
    "code": "NE",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/ne.svg",
    "aliases": [
      "ニジェール"
    ]
  },
  {
    "id": "ng",
    "name": "ナイジェリア",
    "englishName": "Nigeria",
    "capital": "アブジャ",
    "code": "NG",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/ng.svg",
    "aliases": [
      "ナイジェリア"
    ]
  },
  {
    "id": "rw",
    "name": "ルワンダ",
    "englishName": "Rwanda",
    "capital": "キガリ",
    "code": "RW",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/rw.svg",
    "aliases": [
      "ルワンダ"
    ]
  },
  {
    "id": "st",
    "name": "サントメ・プリンシペ",
    "englishName": "Sao Tome and Principe",
    "capital": "サントメ",
    "code": "ST",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/st.svg",
    "aliases": [
      "サントメ・プリンシペ"
    ],
    "similarCountries": [
      "sc",
      "gn"
    ]
  },
  {
    "id": "sn",
    "name": "セネガル",
    "englishName": "Senegal",
    "capital": "ダカール",
    "code": "SN",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/sn.svg",
    "aliases": [
      "セネガル"
    ],
    "similarCountries": [
      "ml",
      "gn",
      "cm"
    ]
  },
  {
    "id": "sc",
    "name": "セーシェル",
    "englishName": "Seychelles",
    "capital": "ビクトリア",
    "code": "SC",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/sc.svg",
    "aliases": [
      "セーシェル"
    ],
    "similarCountries": [
      "st"
    ]
  },
  {
    "id": "sl",
    "name": "シエラレオネ",
    "englishName": "Sierra Leone",
    "capital": "フリータウン",
    "code": "SL",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/sl.svg",
    "aliases": [
      "シエラレオネ"
    ],
    "similarCountries": [
      "sn"
    ]
  },
  {
    "id": "so",
    "name": "ソマリア",
    "englishName": "Somalia",
    "capital": "モガディシュ",
    "code": "SO",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/so.svg",
    "aliases": [
      "ソマリア"
    ]
  },
  {
    "id": "za",
    "name": "南アフリカ",
    "englishName": "South Africa",
    "capital": "プレトリア",
    "capitalNote": "南アフリカは首都機能が複数の都市に分かれています。",
    "code": "ZA",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/za.svg",
    "aliases": [
      "南アフリカ"
    ],
    "similarCountries": [
      "mu"
    ]
  },
  {
    "id": "ss",
    "name": "南スーダン",
    "englishName": "South Sudan",
    "capital": "ジュバ",
    "code": "SS",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/ss.svg",
    "aliases": [
      "南スーダン"
    ]
  },
  {
    "id": "sd",
    "name": "スーダン",
    "englishName": "Sudan",
    "capital": "ハルツーム",
    "code": "SD",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/sd.svg",
    "aliases": [
      "スーダン"
    ],
    "similarCountries": [
      "iq",
      "eg",
      "sy",
      "ye"
    ]
  },
  {
    "id": "tz",
    "name": "タンザニア",
    "englishName": "Tanzania",
    "capital": "ドドマ",
    "capitalNote": "商業の中心地はダルエスサラームです。",
    "code": "TZ",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/tz.svg",
    "aliases": [
      "タンザニア"
    ]
  },
  {
    "id": "tg",
    "name": "トーゴ",
    "englishName": "Togo",
    "capital": "ロメ",
    "code": "TG",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/tg.svg",
    "aliases": [
      "トーゴ"
    ],
    "similarCountries": [
      "gh",
      "sn"
    ]
  },
  {
    "id": "tn",
    "name": "チュニジア",
    "englishName": "Tunisia",
    "capital": "チュニス",
    "code": "TN",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/tn.svg",
    "aliases": [
      "チュニジア"
    ]
  },
  {
    "id": "ug",
    "name": "ウガンダ",
    "englishName": "Uganda",
    "capital": "カンパラ",
    "code": "UG",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/ug.svg",
    "aliases": [
      "ウガンダ"
    ]
  },
  {
    "id": "zm",
    "name": "ザンビア",
    "englishName": "Zambia",
    "capital": "ルサカ",
    "code": "ZM",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/zm.svg",
    "aliases": [
      "ザンビア"
    ]
  },
  {
    "id": "zw",
    "name": "ジンバブエ",
    "englishName": "Zimbabwe",
    "capital": "ハラレ",
    "code": "ZW",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/zw.svg",
    "aliases": [
      "ジンバブエ"
    ]
  },
  {
    "id": "ag",
    "name": "アンティグア・バーブーダ",
    "englishName": "Antigua and Barbuda",
    "capital": "セントジョンズ",
    "code": "AG",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/ag.svg",
    "aliases": [
      "アンティグア・バーブーダ"
    ]
  },
  {
    "id": "bs",
    "name": "バハマ",
    "englishName": "Bahamas",
    "capital": "ナッソー",
    "code": "BS",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/bs.svg",
    "aliases": [
      "バハマ"
    ]
  },
  {
    "id": "bb",
    "name": "バルバドス",
    "englishName": "Barbados",
    "capital": "ブリッジタウン",
    "code": "BB",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/bb.svg",
    "aliases": [
      "バルバドス"
    ]
  },
  {
    "id": "bz",
    "name": "ベリーズ",
    "englishName": "Belize",
    "capital": "ベルモパン",
    "code": "BZ",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/bz.svg",
    "aliases": [
      "ベリーズ"
    ]
  },
  {
    "id": "ca",
    "name": "カナダ",
    "englishName": "Canada",
    "capital": "オタワ",
    "code": "CA",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/ca.svg",
    "aliases": [
      "カナダ"
    ]
  },
  {
    "id": "cr",
    "name": "コスタリカ",
    "englishName": "Costa Rica",
    "capital": "サンホセ",
    "code": "CR",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/cr.svg",
    "aliases": [
      "コスタリカ"
    ]
  },
  {
    "id": "cu",
    "name": "キューバ",
    "englishName": "Cuba",
    "capital": "ハバナ",
    "code": "CU",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/cu.svg",
    "aliases": [
      "キューバ"
    ],
    "similarCountries": [
      "pr",
      "ph"
    ]
  },
  {
    "id": "dm",
    "name": "ドミニカ国",
    "englishName": "Dominica",
    "capital": "ロゾー",
    "code": "DM",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/dm.svg",
    "aliases": [
      "ドミニカ国"
    ]
  },
  {
    "id": "do",
    "name": "ドミニカ共和国",
    "englishName": "Dominican Republic",
    "capital": "サントドミンゴ",
    "code": "DO",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/do.svg",
    "aliases": [
      "ドミニカ共和国"
    ]
  },
  {
    "id": "sv",
    "name": "エルサルバドル",
    "englishName": "El Salvador",
    "capital": "サンサルバドル",
    "code": "SV",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/sv.svg",
    "aliases": [
      "エルサルバドル"
    ]
  },
  {
    "id": "gd",
    "name": "グレナダ",
    "englishName": "Grenada",
    "capital": "セントジョージズ",
    "code": "GD",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/gd.svg",
    "aliases": [
      "グレナダ"
    ]
  },
  {
    "id": "gt",
    "name": "グアテマラ",
    "englishName": "Guatemala",
    "capital": "グアテマラシティ",
    "code": "GT",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/gt.svg",
    "aliases": [
      "グアテマラ"
    ]
  },
  {
    "id": "ht",
    "name": "ハイチ",
    "englishName": "Haiti",
    "capital": "ポルトープランス",
    "code": "HT",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/ht.svg",
    "aliases": [
      "ハイチ"
    ],
    "similarCountries": [
      "li",
      "nl"
    ]
  },
  {
    "id": "hn",
    "name": "ホンジュラス",
    "englishName": "Honduras",
    "capital": "テグシガルパ",
    "code": "HN",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/hn.svg",
    "aliases": [
      "ホンジュラス"
    ]
  },
  {
    "id": "jm",
    "name": "ジャマイカ",
    "englishName": "Jamaica",
    "capital": "キングストン",
    "code": "JM",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/jm.svg",
    "aliases": [
      "ジャマイカ"
    ]
  },
  {
    "id": "mx",
    "name": "メキシコ",
    "englishName": "Mexico",
    "capital": "メキシコシティ",
    "code": "MX",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/mx.svg",
    "aliases": [
      "メキシコ"
    ],
    "similarCountries": [
      "it",
      "ie"
    ]
  },
  {
    "id": "ni",
    "name": "ニカラグア",
    "englishName": "Nicaragua",
    "capital": "マナグア",
    "code": "NI",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/ni.svg",
    "aliases": [
      "ニカラグア"
    ]
  },
  {
    "id": "pa",
    "name": "パナマ",
    "englishName": "Panama",
    "capital": "パナマシティ",
    "code": "PA",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/pa.svg",
    "aliases": [
      "パナマ"
    ]
  },
  {
    "id": "pr",
    "name": "プエルトリコ",
    "englishName": "Puerto Rico",
    "capital": "サンフアン",
    "code": "PR",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/pr.svg",
    "aliases": [
      "プエルトリコ"
    ],
    "similarCountries": [
      "cu"
    ]
  },
  {
    "id": "kn",
    "name": "セントクリストファー・ネービス",
    "englishName": "Saint Kitts and Nevis",
    "capital": "バセテール",
    "code": "KN",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/kn.svg",
    "aliases": [
      "セントクリストファー・ネービス"
    ]
  },
  {
    "id": "lc",
    "name": "セントルシア",
    "englishName": "Saint Lucia",
    "capital": "カストリーズ",
    "code": "LC",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/lc.svg",
    "aliases": [
      "セントルシア"
    ]
  },
  {
    "id": "vc",
    "name": "セントビンセント・グレナディーン",
    "englishName": "Saint Vincent and the Grenadines",
    "capital": "キングスタウン",
    "code": "VC",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/vc.svg",
    "aliases": [
      "セントビンセント・グレナディーン"
    ]
  },
  {
    "id": "tt",
    "name": "トリニダード・トバゴ",
    "englishName": "Trinidad and Tobago",
    "capital": "ポートオブスペイン",
    "code": "TT",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/tt.svg",
    "aliases": [
      "トリニダード・トバゴ"
    ]
  },
  {
    "id": "us",
    "name": "アメリカ",
    "englishName": "United States",
    "capital": "ワシントンD.C.",
    "code": "US",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/us.svg",
    "aliases": [
      "アメリカ",
      "アメリカ合衆国"
    ],
    "officialName": "アメリカ合衆国"
  },
  {
    "id": "ar",
    "name": "アルゼンチン",
    "englishName": "Argentina",
    "capital": "ブエノスアイレス",
    "code": "AR",
    "region": "samerica",
    "regionJa": "南アメリカ",
    "flag": "./assets/flags/ar.svg",
    "aliases": [
      "アルゼンチン"
    ],
    "similarCountries": [
      "uy"
    ]
  },
  {
    "id": "bo",
    "name": "ボリビア",
    "englishName": "Bolivia",
    "capital": "スクレ",
    "code": "BO",
    "region": "samerica",
    "regionJa": "南アメリカ",
    "flag": "./assets/flags/bo.svg",
    "aliases": [
      "ボリビア"
    ],
    "similarCountries": [
      "gh",
      "et"
    ]
  },
  {
    "id": "br",
    "name": "ブラジル",
    "englishName": "Brazil",
    "capital": "ブラジリア",
    "code": "BR",
    "region": "samerica",
    "regionJa": "南アメリカ",
    "flag": "./assets/flags/br.svg",
    "aliases": [
      "ブラジル"
    ]
  },
  {
    "id": "cl",
    "name": "チリ",
    "englishName": "Chile",
    "capital": "サンティアゴ",
    "code": "CL",
    "region": "samerica",
    "regionJa": "南アメリカ",
    "flag": "./assets/flags/cl.svg",
    "aliases": [
      "チリ"
    ]
  },
  {
    "id": "co",
    "name": "コロンビア",
    "englishName": "Colombia",
    "capital": "ボゴタ",
    "code": "CO",
    "region": "samerica",
    "regionJa": "南アメリカ",
    "flag": "./assets/flags/co.svg",
    "aliases": [
      "コロンビア"
    ],
    "similarCountries": [
      "ec",
      "ve"
    ]
  },
  {
    "id": "ec",
    "name": "エクアドル",
    "englishName": "Ecuador",
    "capital": "キト",
    "code": "EC",
    "region": "samerica",
    "regionJa": "南アメリカ",
    "flag": "./assets/flags/ec.svg",
    "aliases": [
      "エクアドル"
    ],
    "similarCountries": [
      "co",
      "ve"
    ]
  },
  {
    "id": "gy",
    "name": "ガイアナ",
    "englishName": "Guyana",
    "capital": "ジョージタウン",
    "code": "GY",
    "region": "samerica",
    "regionJa": "南アメリカ",
    "flag": "./assets/flags/gy.svg",
    "aliases": [
      "ガイアナ"
    ],
    "similarCountries": [
      "sr"
    ]
  },
  {
    "id": "py",
    "name": "パラグアイ",
    "englishName": "Paraguay",
    "capital": "アスンシオン",
    "code": "PY",
    "region": "samerica",
    "regionJa": "南アメリカ",
    "flag": "./assets/flags/py.svg",
    "aliases": [
      "パラグアイ"
    ],
    "similarCountries": [
      "nl"
    ]
  },
  {
    "id": "pe",
    "name": "ペルー",
    "englishName": "Peru",
    "capital": "リマ",
    "code": "PE",
    "region": "samerica",
    "regionJa": "南アメリカ",
    "flag": "./assets/flags/pe.svg",
    "aliases": [
      "ペルー"
    ]
  },
  {
    "id": "sr",
    "name": "スリナム",
    "englishName": "Suriname",
    "capital": "パラマリボ",
    "code": "SR",
    "region": "samerica",
    "regionJa": "南アメリカ",
    "flag": "./assets/flags/sr.svg",
    "aliases": [
      "スリナム"
    ],
    "similarCountries": [
      "gy"
    ]
  },
  {
    "id": "uy",
    "name": "ウルグアイ",
    "englishName": "Uruguay",
    "capital": "モンテビデオ",
    "code": "UY",
    "region": "samerica",
    "regionJa": "南アメリカ",
    "flag": "./assets/flags/uy.svg",
    "aliases": [
      "ウルグアイ"
    ],
    "similarCountries": [
      "ar"
    ]
  },
  {
    "id": "ve",
    "name": "ベネズエラ",
    "englishName": "Venezuela",
    "capital": "カラカス",
    "code": "VE",
    "region": "samerica",
    "regionJa": "南アメリカ",
    "flag": "./assets/flags/ve.svg",
    "aliases": [
      "ベネズエラ"
    ],
    "similarCountries": [
      "co",
      "ec"
    ]
  },
  {
    "id": "au",
    "name": "オーストラリア",
    "englishName": "Australia",
    "capital": "キャンベラ",
    "code": "AU",
    "region": "oceania",
    "regionJa": "オセアニア",
    "flag": "./assets/flags/au.svg",
    "aliases": [
      "オーストラリア"
    ],
    "similarCountries": [
      "nz",
      "fj",
      "tv"
    ]
  },
  {
    "id": "fj",
    "name": "フィジー",
    "englishName": "Fiji",
    "capital": "スバ",
    "code": "FJ",
    "region": "oceania",
    "regionJa": "オセアニア",
    "flag": "./assets/flags/fj.svg",
    "aliases": [
      "フィジー"
    ]
  },
  {
    "id": "ki",
    "name": "キリバス",
    "englishName": "Kiribati",
    "capital": "タラワ",
    "code": "KI",
    "region": "oceania",
    "regionJa": "オセアニア",
    "flag": "./assets/flags/ki.svg",
    "aliases": [
      "キリバス"
    ]
  },
  {
    "id": "mh",
    "name": "マーシャル諸島",
    "englishName": "Marshall Islands",
    "capital": "マジュロ",
    "code": "MH",
    "region": "oceania",
    "regionJa": "オセアニア",
    "flag": "./assets/flags/mh.svg",
    "aliases": [
      "マーシャル諸島"
    ],
    "similarCountries": [
      "pw",
      "mc"
    ]
  },
  {
    "id": "fm",
    "name": "ミクロネシア連邦",
    "englishName": "Micronesia",
    "capital": "パリキール",
    "code": "FM",
    "region": "oceania",
    "regionJa": "オセアニア",
    "flag": "./assets/flags/fm.svg",
    "aliases": [
      "ミクロネシア連邦"
    ],
    "similarCountries": [
      "pw"
    ]
  },
  {
    "id": "nr",
    "name": "ナウル",
    "englishName": "Nauru",
    "capital": "ヤレン",
    "capitalNote": "ナウルには法律上の首都はなく、ヤレン地区が政府機能の中心です。",
    "code": "NR",
    "region": "oceania",
    "regionJa": "オセアニア",
    "flag": "./assets/flags/nr.svg",
    "aliases": [
      "ナウル"
    ]
  },
  {
    "id": "nz",
    "name": "ニュージーランド",
    "englishName": "New Zealand",
    "capital": "ウェリントン",
    "code": "NZ",
    "region": "oceania",
    "regionJa": "オセアニア",
    "flag": "./assets/flags/nz.svg",
    "aliases": [
      "ニュージーランド"
    ],
    "similarCountries": [
      "au",
      "fj",
      "tv"
    ]
  },
  {
    "id": "pw",
    "name": "パラオ",
    "englishName": "Palau",
    "capital": "マルキョク",
    "code": "PW",
    "region": "oceania",
    "regionJa": "オセアニア",
    "flag": "./assets/flags/pw.svg",
    "aliases": [
      "パラオ"
    ],
    "similarCountries": [
      "jp",
      "mh"
    ]
  },
  {
    "id": "pg",
    "name": "パプアニューギニア",
    "englishName": "Papua New Guinea",
    "capital": "ポートモレスビー",
    "code": "PG",
    "region": "oceania",
    "regionJa": "オセアニア",
    "flag": "./assets/flags/pg.svg",
    "aliases": [
      "パプアニューギニア"
    ]
  },
  {
    "id": "ws",
    "name": "サモア",
    "englishName": "Samoa",
    "capital": "アピア",
    "code": "WS",
    "region": "oceania",
    "regionJa": "オセアニア",
    "flag": "./assets/flags/ws.svg",
    "aliases": [
      "サモア"
    ]
  },
  {
    "id": "sb",
    "name": "ソロモン諸島",
    "englishName": "Solomon Islands",
    "capital": "ホニアラ",
    "code": "SB",
    "region": "oceania",
    "regionJa": "オセアニア",
    "flag": "./assets/flags/sb.svg",
    "aliases": [
      "ソロモン諸島"
    ]
  },
  {
    "id": "to",
    "name": "トンガ",
    "englishName": "Tonga",
    "capital": "ヌクアロファ",
    "code": "TO",
    "region": "oceania",
    "regionJa": "オセアニア",
    "flag": "./assets/flags/to.svg",
    "aliases": [
      "トンガ"
    ]
  },
  {
    "id": "tv",
    "name": "ツバル",
    "englishName": "Tuvalu",
    "capital": "フナフティ",
    "code": "TV",
    "region": "oceania",
    "regionJa": "オセアニア",
    "flag": "./assets/flags/tv.svg",
    "aliases": [
      "ツバル"
    ]
  },
  {
    "id": "vu",
    "name": "バヌアツ",
    "englishName": "Vanuatu",
    "capital": "ポートビラ",
    "code": "VU",
    "region": "oceania",
    "regionJa": "オセアニア",
    "flag": "./assets/flags/vu.svg",
    "aliases": [
      "バヌアツ"
    ]
  }
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = COUNTRIES;
}
