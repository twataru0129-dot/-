// 世界198の国・地域データ
// このファイルを編集すると出題対象の国を追加・修正できます
const COUNTRIES = [
  {
    "id": "af",
    "name": "アフガニスタン",
    "englishName": "Afghanistan",
    "capital": "カブール",
    "code": "AF",
    "mapCode": "AFG",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/af.svg",
    "aliases": [
      "アフガニスタン"
    ],
    "lat": 34.5,
    "lng": 69.2,
    "description": "アフガニスタンは中央アジアの内陸国で、山岳地帯が国土の大半を占めます。古くから東西交易路の要衝として栄えました。"
  },
  {
    "id": "am",
    "name": "アルメニア",
    "englishName": "Armenia",
    "capital": "エレバン",
    "code": "AM",
    "mapCode": "ARM",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/am.svg",
    "aliases": [
      "アルメニア"
    ],
    "lat": 40.2,
    "lng": 44.5,
    "description": "アルメニアはコーカサス地方の内陸国で、アララト山を望む高原に位置します。世界最古のキリスト教国の一つです。"
  },
  {
    "id": "az",
    "name": "アゼルバイジャン",
    "englishName": "Azerbaijan",
    "capital": "バクー",
    "code": "AZ",
    "mapCode": "AZE",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/az.svg",
    "aliases": [
      "アゼルバイジャン"
    ],
    "lat": 40.4,
    "lng": 49.9,
    "description": "アゼルバイジャンはカスピ海西岸に位置し、石油資源が豊富な国です。首都バクーは近代的な高層ビルが並びます。"
  },
  {
    "id": "bh",
    "name": "バーレーン",
    "englishName": "Bahrain",
    "capital": "マナーマ",
    "code": "BH",
    "mapCode": null,
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/bh.svg",
    "aliases": [
      "バーレーン"
    ],
    "similarCountries": [
      "qa"
    ],
    "lat": 26.2,
    "lng": 50.6,
    "description": "バーレーンはペルシャ湾に浮かぶ島国で、橋でサウジアラビアと結ばれています。かつては真珠採取で栄えました。"
  },
  {
    "id": "bd",
    "name": "バングラデシュ",
    "englishName": "Bangladesh",
    "capital": "ダッカ",
    "code": "BD",
    "mapCode": "BGD",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/bd.svg",
    "aliases": [
      "バングラデシュ"
    ],
    "similarCountries": [
      "jp"
    ],
    "lat": 23.8,
    "lng": 90.4,
    "description": "バングラデシュはガンジス川のデルタ地帯に位置し、世界有数の人口密度を誇ります。豊かな水郷地帯が広がります。"
  },
  {
    "id": "bt",
    "name": "ブータン",
    "englishName": "Bhutan",
    "capital": "ティンプー",
    "code": "BT",
    "mapCode": "BTN",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/bt.svg",
    "aliases": [
      "ブータン"
    ],
    "lat": 27.5,
    "lng": 89.6,
    "description": "ブータンはヒマラヤ山脈に抱かれた小さな王国です。国民総幸福量という独自の指標を重視することで知られます。"
  },
  {
    "id": "bn",
    "name": "ブルネイ",
    "englishName": "Brunei",
    "capital": "バンダルスリブガワン",
    "code": "BN",
    "mapCode": "BRN",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/bn.svg",
    "aliases": [
      "ブルネイ"
    ],
    "lat": 4.9,
    "lng": 114.9,
    "description": "ブルネイはボルネオ島北部にある小国で、石油と天然ガスによって豊かな国として知られています。"
  },
  {
    "id": "kh",
    "name": "カンボジア",
    "englishName": "Cambodia",
    "capital": "プノンペン",
    "code": "KH",
    "mapCode": "KHM",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/kh.svg",
    "aliases": [
      "カンボジア"
    ],
    "lat": 11.6,
    "lng": 104.9,
    "description": "カンボジアは東南アジアの国で、世界遺産アンコールワットをはじめとする古代クメール文明の遺跡が有名です。"
  },
  {
    "id": "cn",
    "name": "中国",
    "englishName": "China",
    "capital": "北京",
    "code": "CN",
    "mapCode": "CHN",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/cn.svg",
    "aliases": [
      "中国",
      "中華人民共和国",
      "ちゅうごく"
    ],
    "officialName": "中華人民共和国",
    "similarCountries": [
      "tw",
      "vn"
    ],
    "lat": 39.9,
    "lng": 116.4,
    "description": "中国はアジア東部に位置する広大な国で、長い歴史を持つ文明国です。万里の長城など多くの文化遺産があります。"
  },
  {
    "id": "ge",
    "name": "ジョージア",
    "englishName": "Georgia",
    "capital": "トビリシ",
    "code": "GE",
    "mapCode": "GEO",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/ge.svg",
    "aliases": [
      "ジョージア"
    ],
    "lat": 41.7,
    "lng": 44.8,
    "description": "ジョージアはコーカサス山脈のふもとに位置し、黒海に面しています。ワイン発祥の地の一つとされています。"
  },
  {
    "id": "in",
    "name": "インド",
    "englishName": "India",
    "capital": "ニューデリー",
    "code": "IN",
    "mapCode": "IND",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/in.svg",
    "aliases": [
      "インド"
    ],
    "lat": 28.6,
    "lng": 77.2,
    "description": "インドは南アジアの大国で、多様な言語・宗教・文化が共存します。タージ・マハルなど壮麗な建築物で有名です。"
  },
  {
    "id": "id",
    "name": "インドネシア",
    "englishName": "Indonesia",
    "capital": "ジャカルタ",
    "capitalNote": "将来的に首都をヌサンタラへ移転する計画が進められています。",
    "code": "ID",
    "mapCode": "IDN",
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
    ],
    "lat": -6.2,
    "lng": 106.8,
    "description": "インドネシアは1万を超える島々からなる東南アジアの国です。赤道直下に広がり、多様な民族と文化を持ちます。"
  },
  {
    "id": "ir",
    "name": "イラン",
    "englishName": "Iran",
    "capital": "テヘラン",
    "code": "IR",
    "mapCode": "IRN",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/ir.svg",
    "aliases": [
      "イラン"
    ],
    "lat": 35.7,
    "lng": 51.4,
    "description": "イランは中東の高原国で、古代ペルシャ文明の中心地でした。イスファハンなど歴史的な都市が残っています。"
  },
  {
    "id": "iq",
    "name": "イラク",
    "englishName": "Iraq",
    "capital": "バグダッド",
    "code": "IQ",
    "mapCode": "IRQ",
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
    ],
    "lat": 33.3,
    "lng": 44.4,
    "description": "イラクはチグリス川とユーフラテス川に挟まれた地域にあり、古代メソポタミア文明発祥の地とされています。"
  },
  {
    "id": "il",
    "name": "イスラエル",
    "englishName": "Israel",
    "capital": "エルサレム",
    "capitalNote": "多くの国の大使館はテルアビブに置かれています。",
    "code": "IL",
    "mapCode": "ISR",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/il.svg",
    "aliases": [
      "イスラエル"
    ],
    "lat": 31.8,
    "lng": 35.2,
    "description": "イスラエルは地中海東岸に位置し、古くからの歴史的な聖地が数多くあります。乾燥地の農業技術でも知られます。"
  },
  {
    "id": "jp",
    "name": "日本",
    "englishName": "Japan",
    "capital": "東京",
    "code": "JP",
    "mapCode": "JPN",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/jp.svg",
    "aliases": [
      "日本",
      "にほん"
    ],
    "similarCountries": [
      "bd",
      "pw"
    ],
    "lat": 35.7,
    "lng": 139.7,
    "description": "日本は東アジアに位置する島国です。北海道、本州、四国、九州などの島々から構成されています。"
  },
  {
    "id": "jo",
    "name": "ヨルダン",
    "englishName": "Jordan",
    "capital": "アンマン",
    "code": "JO",
    "mapCode": "JOR",
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
    ],
    "lat": 31.9,
    "lng": 35.9,
    "description": "ヨルダンは中東の内陸国で、古代遺跡ペトラなど岩を彫った建造物が有名です。砂漠地帯が国土の大部分を占めます。"
  },
  {
    "id": "kz",
    "name": "カザフスタン",
    "englishName": "Kazakhstan",
    "capital": "アスタナ",
    "capitalNote": "旧名ヌルスルタンから2022年に改称されました。",
    "code": "KZ",
    "mapCode": "KAZ",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/kz.svg",
    "aliases": [
      "カザフスタン"
    ],
    "lat": 51.2,
    "lng": 71.4,
    "description": "カザフスタンは中央アジア最大の面積を持つ内陸国です。広大なステップ(草原)地帯が広がっています。"
  },
  {
    "id": "kp",
    "name": "北朝鮮",
    "englishName": "North Korea",
    "capital": "ピョンヤン",
    "code": "KP",
    "mapCode": "PRK",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/kp.svg",
    "aliases": [
      "北朝鮮",
      "朝鮮民主主義人民共和国",
      "きたちょうせん"
    ],
    "officialName": "朝鮮民主主義人民共和国",
    "similarCountries": [
      "kr",
      "vn"
    ],
    "lat": 39,
    "lng": 125.8,
    "description": "北朝鮮は朝鮮半島北部に位置する国です。山がちな地形が多く、独自の体制のもとで発展してきました。"
  },
  {
    "id": "kr",
    "name": "韓国",
    "englishName": "South Korea",
    "capital": "ソウル",
    "code": "KR",
    "mapCode": "KOR",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/kr.svg",
    "aliases": [
      "韓国",
      "大韓民国",
      "かんこく"
    ],
    "officialName": "大韓民国",
    "similarCountries": [
      "kp",
      "jp"
    ],
    "lat": 37.6,
    "lng": 127,
    "description": "韓国は朝鮮半島南部に位置し、急速な経済発展を遂げました。伝統文化と最新技術が共存する国です。"
  },
  {
    "id": "kw",
    "name": "クウェート",
    "englishName": "Kuwait",
    "capital": "クウェート",
    "code": "KW",
    "mapCode": "KWT",
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
    ],
    "lat": 29.4,
    "lng": 47.9,
    "description": "クウェートはペルシャ湾に面した小国で、豊富な石油資源によって発展しました。近代的な首都が特徴です。"
  },
  {
    "id": "kg",
    "name": "キルギス",
    "englishName": "Kyrgyzstan",
    "capital": "ビシュケク",
    "code": "KG",
    "mapCode": "KGZ",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/kg.svg",
    "aliases": [
      "キルギス"
    ],
    "lat": 42.9,
    "lng": 74.6,
    "description": "キルギスは中央アジアの内陸国で、国土の大半が山岳地帯です。美しい高山湖イシク・クルで知られます。"
  },
  {
    "id": "la",
    "name": "ラオス",
    "englishName": "Laos",
    "capital": "ビエンチャン",
    "code": "LA",
    "mapCode": "LAO",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/la.svg",
    "aliases": [
      "ラオス"
    ],
    "lat": 18,
    "lng": 102.6,
    "description": "ラオスは東南アジアの内陸国で、メコン川が国土を貫いています。緑豊かな山々と穏やかな暮らしが特徴です。"
  },
  {
    "id": "lb",
    "name": "レバノン",
    "englishName": "Lebanon",
    "capital": "ベイルート",
    "code": "LB",
    "mapCode": "LBN",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/lb.svg",
    "aliases": [
      "レバノン"
    ],
    "lat": 33.9,
    "lng": 35.5,
    "description": "レバノンは地中海東岸の小国で、古代フェニキア文明の中心地でした。首都ベイルートは港湾都市として栄えました。"
  },
  {
    "id": "my",
    "name": "マレーシア",
    "englishName": "Malaysia",
    "capital": "クアラルンプール",
    "code": "MY",
    "mapCode": "MYS",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/my.svg",
    "aliases": [
      "マレーシア"
    ],
    "lat": 3.1,
    "lng": 101.7,
    "description": "マレーシアはマレー半島とボルネオ島の一部からなる国です。多民族国家として多様な文化が共存しています。",
    "capitals": [
      {
        "name": "クアラルンプール",
        "type": "首都"
      },
      {
        "name": "プトラジャヤ",
        "type": "行政の中心地"
      }
    ]
  },
  {
    "id": "mv",
    "name": "モルディブ",
    "englishName": "Maldives",
    "capital": "マレ",
    "code": "MV",
    "mapCode": null,
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/mv.svg",
    "aliases": [
      "モルディブ"
    ],
    "lat": 4.2,
    "lng": 73.5,
    "description": "モルディブはインド洋に浮かぶサンゴ礁の島国で、1000以上の島々からなります。美しいビーチリゾートで有名です。"
  },
  {
    "id": "mn",
    "name": "モンゴル",
    "englishName": "Mongolia",
    "capital": "ウランバートル",
    "code": "MN",
    "mapCode": "MNG",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/mn.svg",
    "aliases": [
      "モンゴル"
    ],
    "lat": 47.9,
    "lng": 106.9,
    "description": "モンゴルは東アジアの内陸国で、広大な草原地帯が広がります。遊牧の伝統文化が今も受け継がれています。"
  },
  {
    "id": "mm",
    "name": "ミャンマー",
    "englishName": "Myanmar",
    "capital": "ネピドー",
    "capitalNote": "2005年にヤンゴンから首都が移転しました。",
    "code": "MM",
    "mapCode": "MMR",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/mm.svg",
    "aliases": [
      "ミャンマー"
    ],
    "lat": 19.7,
    "lng": 96.1,
    "description": "ミャンマーは東南アジアの国で、多くの仏教寺院が点在します。イラワジ川が国土を南北に流れています。"
  },
  {
    "id": "np",
    "name": "ネパール",
    "englishName": "Nepal",
    "capital": "カトマンズ",
    "code": "NP",
    "mapCode": "NPL",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/np.svg",
    "aliases": [
      "ネパール"
    ],
    "lat": 27.7,
    "lng": 85.3,
    "description": "ネパールはヒマラヤ山脈に位置し、世界最高峰エベレストがあります。仏教とヒンドゥー教の文化が根付いています。"
  },
  {
    "id": "om",
    "name": "オマーン",
    "englishName": "Oman",
    "capital": "マスカット",
    "code": "OM",
    "mapCode": "OMN",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/om.svg",
    "aliases": [
      "オマーン"
    ],
    "lat": 23.6,
    "lng": 58.6,
    "description": "オマーンはアラビア半島南東部に位置し、山と砂漠が織りなす景観を持ちます。海洋交易で栄えた歴史があります。"
  },
  {
    "id": "pk",
    "name": "パキスタン",
    "englishName": "Pakistan",
    "capital": "イスラマバード",
    "code": "PK",
    "mapCode": "PAK",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/pk.svg",
    "aliases": [
      "パキスタン"
    ],
    "lat": 33.7,
    "lng": 73.1,
    "description": "パキスタンは南アジアの国で、インダス文明発祥の地です。高峰カラコルム山脈が北部にそびえています。"
  },
  {
    "id": "ps",
    "name": "パレスチナ",
    "englishName": "Palestine",
    "capital": "東エルサレム",
    "code": "PS",
    "mapCode": "PSE",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/ps.svg",
    "aliases": [
      "パレスチナ"
    ],
    "similarCountries": [
      "jo",
      "sd"
    ],
    "lat": 31.8,
    "lng": 35.2,
    "description": "パレスチナは中東に位置し、歴史的な聖地エルサレムを含む地域です。オリーブ栽培などの農業が営まれています。"
  },
  {
    "id": "ph",
    "name": "フィリピン",
    "englishName": "Philippines",
    "capital": "マニラ",
    "code": "PH",
    "mapCode": "PHL",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/ph.svg",
    "aliases": [
      "フィリピン"
    ],
    "similarCountries": [
      "cz",
      "cu"
    ],
    "lat": 14.6,
    "lng": 121,
    "description": "フィリピンは7000以上の島々からなる東南アジアの島国です。美しい海と多様な文化が魅力です。"
  },
  {
    "id": "qa",
    "name": "カタール",
    "englishName": "Qatar",
    "capital": "ドーハ",
    "code": "QA",
    "mapCode": "QAT",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/qa.svg",
    "aliases": [
      "カタール"
    ],
    "similarCountries": [
      "bh"
    ],
    "lat": 25.3,
    "lng": 51.5,
    "description": "カタールはペルシャ湾に突き出た半島国で、天然ガス資源によって急速に発展しました。近代的な高層都市が特徴です。"
  },
  {
    "id": "sa",
    "name": "サウジアラビア",
    "englishName": "Saudi Arabia",
    "capital": "リヤド",
    "code": "SA",
    "mapCode": "SAU",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/sa.svg",
    "aliases": [
      "サウジアラビア"
    ],
    "lat": 24.7,
    "lng": 46.7,
    "description": "サウジアラビアはアラビア半島の大部分を占める国で、イスラム教の聖地メッカとメディナがあります。"
  },
  {
    "id": "sg",
    "name": "シンガポール",
    "englishName": "Singapore",
    "capital": "シンガポール",
    "code": "SG",
    "mapCode": null,
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
    ],
    "lat": 1.35,
    "lng": 103.8,
    "description": "シンガポールはマレー半島南端の都市国家です。世界有数の貿易港として、多民族が共存する国際都市です。"
  },
  {
    "id": "lk",
    "name": "スリランカ",
    "englishName": "Sri Lanka",
    "capital": "スリジャヤワルダナプラコッテ",
    "capitalNote": "商業の中心地はコロンボです。",
    "code": "LK",
    "mapCode": "LKA",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/lk.svg",
    "aliases": [
      "スリランカ"
    ],
    "lat": 6.9,
    "lng": 79.9,
    "description": "スリランカはインド洋に浮かぶ島国で、紅茶の産地として知られます。古代からの仏教遺跡も数多く残ります。",
    "capitals": [
      {
        "name": "スリジャヤワルダナプラコッテ",
        "type": "公式の首都"
      },
      {
        "name": "コロンボ",
        "type": "商業の中心地"
      }
    ]
  },
  {
    "id": "sy",
    "name": "シリア",
    "englishName": "Syria",
    "capital": "ダマスカス",
    "code": "SY",
    "mapCode": "SYR",
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
    ],
    "lat": 33.5,
    "lng": 36.3,
    "description": "シリアは地中海東岸に位置し、古代文明の交差点として栄えました。首都ダマスカスは世界最古の都市の一つです。"
  },
  {
    "id": "tw",
    "name": "台湾",
    "englishName": "Taiwan",
    "capital": "台北",
    "code": "TW",
    "mapCode": "TWN",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/tw.svg",
    "aliases": [
      "台湾",
      "たいわん"
    ],
    "similarCountries": [
      "cn"
    ],
    "lat": 25,
    "lng": 121.5,
    "description": "台湾は東アジアの島で、中央に高い山脈が連なります。夜市など活気ある食文化でも知られています。"
  },
  {
    "id": "tj",
    "name": "タジキスタン",
    "englishName": "Tajikistan",
    "capital": "ドゥシャンベ",
    "code": "TJ",
    "mapCode": "TJK",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/tj.svg",
    "aliases": [
      "タジキスタン"
    ],
    "lat": 38.6,
    "lng": 68.8,
    "description": "タジキスタンは中央アジアの内陸国で、国土の9割以上が山岳地帯です。パミール高原が広がります。"
  },
  {
    "id": "th",
    "name": "タイ",
    "englishName": "Thailand",
    "capital": "バンコク",
    "code": "TH",
    "mapCode": "THA",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/th.svg",
    "aliases": [
      "タイ"
    ],
    "lat": 13.8,
    "lng": 100.5,
    "description": "タイは東南アジアの国で、黄金の仏教寺院が数多く点在します。豊かな稲作文化が根付いています。"
  },
  {
    "id": "tl",
    "name": "東ティモール",
    "englishName": "Timor-Leste",
    "capital": "ディリ",
    "code": "TL",
    "mapCode": "TLS",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/tl.svg",
    "aliases": [
      "東ティモール",
      "ひがしてぃもーる"
    ],
    "lat": -8.6,
    "lng": 125.6,
    "description": "東ティモールはティモール島東部に位置する島国です。21世紀に独立した比較的新しい国の一つです。"
  },
  {
    "id": "tm",
    "name": "トルクメニスタン",
    "englishName": "Turkmenistan",
    "capital": "アシガバット",
    "code": "TM",
    "mapCode": "TKM",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/tm.svg",
    "aliases": [
      "トルクメニスタン"
    ],
    "lat": 37.9,
    "lng": 58.4,
    "description": "トルクメニスタンは中央アジアの内陸国で、国土の大半をカラクム砂漠が占めます。天然ガス資源が豊富です。"
  },
  {
    "id": "tr",
    "name": "トルコ",
    "englishName": "Turkey",
    "capital": "アンカラ",
    "code": "TR",
    "mapCode": "TUR",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/tr.svg",
    "aliases": [
      "トルコ"
    ],
    "lat": 39.9,
    "lng": 32.9,
    "description": "トルコはヨーロッパとアジアにまたがる国です。イスタンブールは2つの大陸を結ぶ歴史的な都市です。"
  },
  {
    "id": "ae",
    "name": "アラブ首長国連邦",
    "englishName": "United Arab Emirates",
    "capital": "アブダビ",
    "code": "AE",
    "mapCode": "ARE",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/ae.svg",
    "aliases": [
      "アラブ首長国連邦",
      "あらぶしゅちょうこくれんぽう"
    ],
    "similarCountries": [
      "kw"
    ],
    "lat": 24.5,
    "lng": 54.4,
    "description": "アラブ首長国連邦はアラビア半島の首長国連邦国家です。ドバイなど近代的な都市が急速に発展しました。"
  },
  {
    "id": "uz",
    "name": "ウズベキスタン",
    "englishName": "Uzbekistan",
    "capital": "タシケント",
    "code": "UZ",
    "mapCode": "UZB",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/uz.svg",
    "aliases": [
      "ウズベキスタン"
    ],
    "lat": 41.3,
    "lng": 69.3,
    "description": "ウズベキスタンは中央アジアの内陸国で、シルクロードの要衝として栄えたサマルカンドなどの古都があります。"
  },
  {
    "id": "vn",
    "name": "ベトナム",
    "englishName": "Vietnam",
    "capital": "ハノイ",
    "code": "VN",
    "mapCode": "VNM",
    "region": "asia",
    "regionJa": "アジア",
    "flag": "./assets/flags/vn.svg",
    "aliases": [
      "ベトナム"
    ],
    "similarCountries": [
      "cn"
    ],
    "lat": 21,
    "lng": 105.8,
    "description": "ベトナムは東南アジアの細長い国で、南北にホン川とメコン川のデルタが広がります。稲作文化が盛んです。"
  },
  {
    "id": "ye",
    "name": "イエメン",
    "englishName": "Yemen",
    "capital": "サナア",
    "capitalNote": "内戦の影響で、暫定的な政府機能の一部はアデンに置かれています。",
    "code": "YE",
    "mapCode": "YEM",
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
    ],
    "lat": 15.4,
    "lng": 44.2,
    "description": "イエメンはアラビア半島南端に位置し、山岳地帯と海岸平野が広がります。古代からコーヒー交易で知られました。"
  },
  {
    "id": "al",
    "name": "アルバニア",
    "englishName": "Albania",
    "capital": "ティラナ",
    "code": "AL",
    "mapCode": "ALB",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/al.svg",
    "aliases": [
      "アルバニア"
    ],
    "lat": 41.3,
    "lng": 19.8,
    "description": "アルバニアはバルカン半島南西部に位置し、アドリア海に面しています。山がちな地形と美しい海岸線が特徴です。"
  },
  {
    "id": "ad",
    "name": "アンドラ",
    "englishName": "Andorra",
    "capital": "アンドラ・ラ・ベリャ",
    "code": "AD",
    "mapCode": null,
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
    ],
    "lat": 42.5,
    "lng": 1.5,
    "description": "アンドラはピレネー山脈に位置する小さな内陸国です。フランスとスペインに挟まれ、スキーリゾートで有名です。"
  },
  {
    "id": "at",
    "name": "オーストリア",
    "englishName": "Austria",
    "capital": "ウィーン",
    "code": "AT",
    "mapCode": "AUT",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/at.svg",
    "aliases": [
      "オーストリア"
    ],
    "similarCountries": [
      "lv"
    ],
    "lat": 48.2,
    "lng": 16.4,
    "description": "オーストリアは中央ヨーロッパの内陸国で、アルプス山脈が国土の多くを占めます。音楽の都ウィーンが有名です。"
  },
  {
    "id": "by",
    "name": "ベラルーシ",
    "englishName": "Belarus",
    "capital": "ミンスク",
    "code": "BY",
    "mapCode": "BLR",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/by.svg",
    "aliases": [
      "ベラルーシ"
    ],
    "similarCountries": [
      "bg"
    ],
    "lat": 53.9,
    "lng": 27.6,
    "description": "ベラルーシは東ヨーロッパの内陸国で、広大な森林と湿地が広がります。伝統的な木造建築も残ります。"
  },
  {
    "id": "be",
    "name": "ベルギー",
    "englishName": "Belgium",
    "capital": "ブリュッセル",
    "code": "BE",
    "mapCode": "BEL",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/be.svg",
    "aliases": [
      "ベルギー"
    ],
    "lat": 50.8,
    "lng": 4.3,
    "description": "ベルギーは西ヨーロッパの小国で、中世の街並みが残る美しい都市が点在します。チョコレートが有名です。"
  },
  {
    "id": "ba",
    "name": "ボスニア・ヘルツェゴビナ",
    "englishName": "Bosnia and Herzegovina",
    "capital": "サラエボ",
    "code": "BA",
    "mapCode": "BIH",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/ba.svg",
    "aliases": [
      "ボスニア・ヘルツェゴビナ"
    ],
    "lat": 43.9,
    "lng": 18.4,
    "description": "ボスニア・ヘルツェゴビナはバルカン半島に位置し、山岳地帯が広がります。多様な文化が交わる歴史を持ちます。"
  },
  {
    "id": "bg",
    "name": "ブルガリア",
    "englishName": "Bulgaria",
    "capital": "ソフィア",
    "code": "BG",
    "mapCode": "BGR",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/bg.svg",
    "aliases": [
      "ブルガリア"
    ],
    "similarCountries": [
      "by"
    ],
    "lat": 42.7,
    "lng": 23.3,
    "description": "ブルガリアはバルカン半島東部に位置し、黒海に面しています。バラの生産地としても知られています。"
  },
  {
    "id": "hr",
    "name": "クロアチア",
    "englishName": "Croatia",
    "capital": "ザグレブ",
    "code": "HR",
    "mapCode": "HRV",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/hr.svg",
    "aliases": [
      "クロアチア"
    ],
    "lat": 45.8,
    "lng": 16,
    "description": "クロアチアはアドリア海に面した国で、美しい海岸線と1000以上の島々があります。中世の街並みも魅力です。"
  },
  {
    "id": "cy",
    "name": "キプロス",
    "englishName": "Cyprus",
    "capital": "ニコシア",
    "code": "CY",
    "mapCode": "CYP",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/cy.svg",
    "aliases": [
      "キプロス"
    ],
    "lat": 35.2,
    "lng": 33.4,
    "description": "キプロスは地中海東部に浮かぶ島国です。温暖な気候と古代からの遺跡が観光客を惹きつけています。"
  },
  {
    "id": "cz",
    "name": "チェコ",
    "englishName": "Czechia",
    "capital": "プラハ",
    "code": "CZ",
    "mapCode": "CZE",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/cz.svg",
    "aliases": [
      "チェコ"
    ],
    "similarCountries": [
      "ph",
      "cu"
    ],
    "lat": 50.1,
    "lng": 14.4,
    "description": "チェコは中央ヨーロッパの内陸国で、首都プラハは「百塔の街」と呼ばれる美しい古都です。"
  },
  {
    "id": "dk",
    "name": "デンマーク",
    "englishName": "Denmark",
    "capital": "コペンハーゲン",
    "code": "DK",
    "mapCode": "DNK",
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
    ],
    "lat": 55.7,
    "lng": 12.6,
    "description": "デンマークは北ヨーロッパの国で、多くの島々とユトランド半島からなります。童話作家アンデルセンの故郷です。"
  },
  {
    "id": "ee",
    "name": "エストニア",
    "englishName": "Estonia",
    "capital": "タリン",
    "code": "EE",
    "mapCode": "EST",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/ee.svg",
    "aliases": [
      "エストニア"
    ],
    "lat": 59.4,
    "lng": 24.8,
    "description": "エストニアはバルト海に面した北ヨーロッパの国です。中世の面影を残す首都タリンの旧市街が有名です。"
  },
  {
    "id": "fi",
    "name": "フィンランド",
    "englishName": "Finland",
    "capital": "ヘルシンキ",
    "code": "FI",
    "mapCode": "FIN",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/fi.svg",
    "aliases": [
      "フィンランド"
    ],
    "similarCountries": [
      "se",
      "no"
    ],
    "lat": 60.2,
    "lng": 24.9,
    "description": "フィンランドは北ヨーロッパの国で、数万の湖と広大な森林が広がります。サンタクロースの故郷とも言われます。"
  },
  {
    "id": "fr",
    "name": "フランス",
    "englishName": "France",
    "capital": "パリ",
    "code": "FR",
    "mapCode": "FRA",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/fr.svg",
    "aliases": [
      "フランス"
    ],
    "lat": 48.9,
    "lng": 2.4,
    "description": "フランスは西ヨーロッパの国で、アルプスから地中海沿岸まで多様な地形を持ちます。芸術と美食の国として有名です。"
  },
  {
    "id": "de",
    "name": "ドイツ",
    "englishName": "Germany",
    "capital": "ベルリン",
    "code": "DE",
    "mapCode": "DEU",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/de.svg",
    "aliases": [
      "ドイツ"
    ],
    "lat": 52.5,
    "lng": 13.4,
    "description": "ドイツは中央ヨーロッパの国で、古城や森が点在する美しい景観を持ちます。ものづくりの国としても知られます。"
  },
  {
    "id": "gr",
    "name": "ギリシャ",
    "englishName": "Greece",
    "capital": "アテネ",
    "code": "GR",
    "mapCode": "GRC",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/gr.svg",
    "aliases": [
      "ギリシャ"
    ],
    "lat": 38,
    "lng": 23.7,
    "description": "ギリシャはバルカン半島南端と多くの島々からなる国です。古代ギリシャ文明発祥の地として知られています。"
  },
  {
    "id": "va",
    "name": "バチカン",
    "englishName": "Vatican City",
    "capital": "バチカン市国",
    "code": "VA",
    "mapCode": null,
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/va.svg",
    "aliases": [
      "バチカン",
      "バチカン市国"
    ],
    "officialName": "バチカン市国",
    "lat": 41.9,
    "lng": 12.45,
    "description": "バチカン市国はローマ市内にある世界最小の国家です。カトリック教会の総本山として世界中から巡礼者が訪れます。"
  },
  {
    "id": "hu",
    "name": "ハンガリー",
    "englishName": "Hungary",
    "capital": "ブダペスト",
    "code": "HU",
    "mapCode": "HUN",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/hu.svg",
    "aliases": [
      "ハンガリー"
    ],
    "lat": 47.5,
    "lng": 19,
    "description": "ハンガリーは中央ヨーロッパの内陸国で、ドナウ川が首都ブダペストを貫いています。温泉が豊富な国です。"
  },
  {
    "id": "is",
    "name": "アイスランド",
    "englishName": "Iceland",
    "capital": "レイキャビク",
    "code": "IS",
    "mapCode": "ISL",
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
    ],
    "lat": 64.1,
    "lng": -21.9,
    "description": "アイスランドは北大西洋に浮かぶ火山島で、氷河と温泉が同居する独特の自然景観を持ちます。"
  },
  {
    "id": "ie",
    "name": "アイルランド",
    "englishName": "Ireland",
    "capital": "ダブリン",
    "code": "IE",
    "mapCode": "IRL",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/ie.svg",
    "aliases": [
      "アイルランド"
    ],
    "similarCountries": [
      "ci",
      "it"
    ],
    "lat": 53.3,
    "lng": -6.3,
    "description": "アイルランドは大西洋に浮かぶ島国で、緑豊かな丘陵地帯から「エメラルド島」とも呼ばれています。"
  },
  {
    "id": "it",
    "name": "イタリア",
    "englishName": "Italy",
    "capital": "ローマ",
    "code": "IT",
    "mapCode": "ITA",
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
    ],
    "lat": 41.9,
    "lng": 12.5,
    "description": "イタリアは南ヨーロッパに位置する国で、地中海に突き出した長靴のような形が特徴です。"
  },
  {
    "id": "xk",
    "name": "コソボ",
    "englishName": "Kosovo",
    "capital": "プリシュティナ",
    "code": "XK",
    "mapCode": "KOS",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/xk.svg",
    "aliases": [
      "コソボ"
    ],
    "lat": 42.7,
    "lng": 21.2,
    "description": "コソボはバルカン半島に位置する内陸の国です。21世紀に独立を宣言した、比較的新しい国の一つです。"
  },
  {
    "id": "lv",
    "name": "ラトビア",
    "englishName": "Latvia",
    "capital": "リガ",
    "code": "LV",
    "mapCode": "LVA",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/lv.svg",
    "aliases": [
      "ラトビア"
    ],
    "similarCountries": [
      "at"
    ],
    "lat": 56.9,
    "lng": 24.1,
    "description": "ラトビアはバルト海に面した北ヨーロッパの国です。首都リガは中世からの美しい街並みで知られます。"
  },
  {
    "id": "li",
    "name": "リヒテンシュタイン",
    "englishName": "Liechtenstein",
    "capital": "ファドゥーツ",
    "code": "LI",
    "mapCode": null,
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/li.svg",
    "aliases": [
      "リヒテンシュタイン"
    ],
    "similarCountries": [
      "ht"
    ],
    "lat": 47.1,
    "lng": 9.5,
    "description": "リヒテンシュタインはアルプス山脈に位置する小さな内陸国です。スイスとオーストリアに挟まれています。"
  },
  {
    "id": "lt",
    "name": "リトアニア",
    "englishName": "Lithuania",
    "capital": "ビリニュス",
    "code": "LT",
    "mapCode": "LTU",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/lt.svg",
    "aliases": [
      "リトアニア"
    ],
    "similarCountries": [
      "bo",
      "gh"
    ],
    "lat": 54.7,
    "lng": 25.3,
    "description": "リトアニアはバルト海に面した国で、バルト三国の中で最も南に位置します。中世の城や教会が残ります。"
  },
  {
    "id": "lu",
    "name": "ルクセンブルク",
    "englishName": "Luxembourg",
    "capital": "ルクセンブルク",
    "code": "LU",
    "mapCode": "LUX",
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
    ],
    "lat": 49.6,
    "lng": 6.1,
    "description": "ルクセンブルクは西ヨーロッパの小さな内陸国です。金融業が盛んで、緑豊かな丘陵地帯が広がります。"
  },
  {
    "id": "mt",
    "name": "マルタ",
    "englishName": "Malta",
    "capital": "バレッタ",
    "code": "MT",
    "mapCode": null,
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/mt.svg",
    "aliases": [
      "マルタ"
    ],
    "lat": 35.9,
    "lng": 14.5,
    "description": "マルタは地中海に浮かぶ小さな島国です。古代からの要塞都市や騎士団の歴史的建造物が残っています。"
  },
  {
    "id": "md",
    "name": "モルドバ",
    "englishName": "Moldova",
    "capital": "キシナウ",
    "code": "MD",
    "mapCode": "MDA",
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
    ],
    "lat": 47,
    "lng": 28.9,
    "description": "モルドバは東ヨーロッパの内陸国で、肥沃な農地とぶどう畑が広がります。ワイン造りが盛んな国です。"
  },
  {
    "id": "mc",
    "name": "モナコ",
    "englishName": "Monaco",
    "capital": "モナコ",
    "code": "MC",
    "mapCode": null,
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/mc.svg",
    "aliases": [
      "モナコ"
    ],
    "similarCountries": [
      "id",
      "pl"
    ],
    "lat": 43.7,
    "lng": 7.4,
    "description": "モナコは地中海に面した世界で2番目に小さな国です。高級リゾートとカジノで知られる公国です。"
  },
  {
    "id": "me",
    "name": "モンテネグロ",
    "englishName": "Montenegro",
    "capital": "ポドゴリツァ",
    "code": "ME",
    "mapCode": "MNE",
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
    ],
    "lat": 42.4,
    "lng": 19.3,
    "description": "モンテネグロはバルカン半島に位置し、アドリア海沿岸に切り立った山々が迫る景観が特徴です。"
  },
  {
    "id": "nl",
    "name": "オランダ",
    "englishName": "Netherlands",
    "capital": "アムステルダム",
    "code": "NL",
    "mapCode": "NLD",
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
    ],
    "lat": 52.4,
    "lng": 4.9,
    "description": "オランダは北海に面した国で、国土の多くが海面より低い干拓地です。風車とチューリップ畑で知られます。",
    "capitals": [
      {
        "name": "アムステルダム",
        "type": "憲法上の首都"
      },
      {
        "name": "ハーグ",
        "type": "政府所在地"
      }
    ]
  },
  {
    "id": "mk",
    "name": "北マケドニア",
    "englishName": "North Macedonia",
    "capital": "スコピエ",
    "code": "MK",
    "mapCode": "MKD",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/mk.svg",
    "aliases": [
      "北マケドニア",
      "きたまけどにあ"
    ],
    "lat": 42,
    "lng": 21.4,
    "description": "北マケドニアはバルカン半島の内陸国です。オフリド湖など美しい自然と古代からの歴史遺産があります。"
  },
  {
    "id": "no",
    "name": "ノルウェー",
    "englishName": "Norway",
    "capital": "オスロ",
    "code": "NO",
    "mapCode": "NOR",
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
    ],
    "lat": 59.9,
    "lng": 10.7,
    "description": "ノルウェーは北ヨーロッパの国で、複雑に入り組んだフィヨルドの海岸線が特徴的な景観を作っています。"
  },
  {
    "id": "pl",
    "name": "ポーランド",
    "englishName": "Poland",
    "capital": "ワルシャワ",
    "code": "PL",
    "mapCode": "POL",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/pl.svg",
    "aliases": [
      "ポーランド"
    ],
    "similarCountries": [
      "id",
      "mc"
    ],
    "lat": 52.2,
    "lng": 21,
    "description": "ポーランドは中央ヨーロッパの平原国です。古都クラクフなど中世の面影を残す街並みが残っています。"
  },
  {
    "id": "pt",
    "name": "ポルトガル",
    "englishName": "Portugal",
    "capital": "リスボン",
    "code": "PT",
    "mapCode": "PRT",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/pt.svg",
    "aliases": [
      "ポルトガル"
    ],
    "lat": 38.7,
    "lng": -9.1,
    "description": "ポルトガルはイベリア半島西端に位置し、大西洋に面しています。大航海時代に活躍した海洋国家です。"
  },
  {
    "id": "ro",
    "name": "ルーマニア",
    "englishName": "Romania",
    "capital": "ブカレスト",
    "code": "RO",
    "mapCode": "ROU",
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
    ],
    "lat": 44.4,
    "lng": 26.1,
    "description": "ルーマニアはバルカン半島北部に位置し、カルパティア山脈が国土を囲みます。ドラキュラ伝説の舞台としても有名です。"
  },
  {
    "id": "ru",
    "name": "ロシア",
    "englishName": "Russia",
    "capital": "モスクワ",
    "code": "RU",
    "mapCode": "RUS",
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
    ],
    "lat": 55.75,
    "lng": 37.6,
    "description": "ロシアは世界最大の面積を持つ国で、ヨーロッパからアジアにまたがります。広大なシベリアの大地が広がります。"
  },
  {
    "id": "sm",
    "name": "サンマリノ",
    "englishName": "San Marino",
    "capital": "サンマリノ",
    "code": "SM",
    "mapCode": null,
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/sm.svg",
    "aliases": [
      "サンマリノ"
    ],
    "similarCountries": [
      "it"
    ],
    "lat": 43.9,
    "lng": 12.45,
    "description": "サンマリノはイタリア半島内にある世界最古の共和国とされる小国です。山頂の要塞都市が特徴です。"
  },
  {
    "id": "rs",
    "name": "セルビア",
    "englishName": "Serbia",
    "capital": "ベオグラード",
    "code": "RS",
    "mapCode": "SRB",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/rs.svg",
    "aliases": [
      "セルビア"
    ],
    "lat": 44.8,
    "lng": 20.5,
    "description": "セルビアはバルカン半島中央部の内陸国です。ドナウ川が流れ、東西文化の交差点として発展しました。"
  },
  {
    "id": "sk",
    "name": "スロバキア",
    "englishName": "Slovakia",
    "capital": "ブラチスラバ",
    "code": "SK",
    "mapCode": "SVK",
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
    ],
    "lat": 48.1,
    "lng": 17.1,
    "description": "スロバキアは中央ヨーロッパの内陸国で、タトラ山脈がそびえます。中世の古城が数多く残っています。"
  },
  {
    "id": "si",
    "name": "スロベニア",
    "englishName": "Slovenia",
    "capital": "リュブリャナ",
    "code": "SI",
    "mapCode": "SVN",
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
    ],
    "lat": 46.05,
    "lng": 14.5,
    "description": "スロベニアはアルプス山脈とアドリア海に挟まれた小国です。美しい湖ブレッド湖が観光名所として有名です。"
  },
  {
    "id": "es",
    "name": "スペイン",
    "englishName": "Spain",
    "capital": "マドリード",
    "code": "ES",
    "mapCode": "ESP",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/es.svg",
    "aliases": [
      "スペイン"
    ],
    "lat": 40.4,
    "lng": -3.7,
    "description": "スペインはイベリア半島の大部分を占める国です。情熱的な文化と多様な地方色豊かな伝統を持ちます。"
  },
  {
    "id": "se",
    "name": "スウェーデン",
    "englishName": "Sweden",
    "capital": "ストックホルム",
    "code": "SE",
    "mapCode": "SWE",
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
    ],
    "lat": 59.3,
    "lng": 18.1,
    "description": "スウェーデンは北ヨーロッパの国で、多数の湖と森林、島々からなります。福祉先進国として知られます。"
  },
  {
    "id": "ch",
    "name": "スイス",
    "englishName": "Switzerland",
    "capital": "ベルン",
    "capitalNote": "スイスには憲法上の首都の規定がなく、ベルンが事実上の首都とされています。",
    "code": "CH",
    "mapCode": "CHE",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/ch.svg",
    "aliases": [
      "スイス"
    ],
    "lat": 46.95,
    "lng": 7.45,
    "description": "スイスは中央ヨーロッパの内陸国で、アルプス山脈にそびえる山々と美しい湖が特徴です。時計産業でも有名です。",
    "capitals": [
      {
        "name": "ベルン",
        "type": "事実上の首都(連邦都市)"
      }
    ]
  },
  {
    "id": "ua",
    "name": "ウクライナ",
    "englishName": "Ukraine",
    "capital": "キーウ",
    "code": "UA",
    "mapCode": "UKR",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/ua.svg",
    "aliases": [
      "ウクライナ"
    ],
    "lat": 50.45,
    "lng": 30.5,
    "description": "ウクライナは東ヨーロッパの国で、肥沃な黒土地帯が広がる農業大国です。豊かな穀倉地帯として知られます。"
  },
  {
    "id": "gb",
    "name": "イギリス",
    "englishName": "United Kingdom",
    "capital": "ロンドン",
    "code": "GB",
    "mapCode": "GBR",
    "region": "europe",
    "regionJa": "ヨーロッパ",
    "flag": "./assets/flags/gb.svg",
    "aliases": [
      "イギリス"
    ],
    "similarCountries": [
      "au",
      "nz"
    ],
    "lat": 51.5,
    "lng": -0.1,
    "description": "イギリスは大西洋に浮かぶ島国で、グレートブリテン島とアイルランド島北部からなります。伝統と近代が共存します。"
  },
  {
    "id": "dz",
    "name": "アルジェリア",
    "englishName": "Algeria",
    "capital": "アルジェ",
    "code": "DZ",
    "mapCode": "DZA",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/dz.svg",
    "aliases": [
      "アルジェリア"
    ],
    "lat": 36.75,
    "lng": 3.06,
    "description": "アルジェリアはアフリカ最大の面積を持つ国です。国土の大部分をサハラ砂漠が占めています。"
  },
  {
    "id": "ao",
    "name": "アンゴラ",
    "englishName": "Angola",
    "capital": "ルアンダ",
    "code": "AO",
    "mapCode": "AGO",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/ao.svg",
    "aliases": [
      "アンゴラ"
    ],
    "lat": -8.8,
    "lng": 13.2,
    "description": "アンゴラはアフリカ南西部の大西洋岸に位置する国です。豊富な石油資源と多様な野生動物で知られます。"
  },
  {
    "id": "bj",
    "name": "ベナン",
    "englishName": "Benin",
    "capital": "ポルトノボ",
    "code": "BJ",
    "mapCode": "BEN",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/bj.svg",
    "aliases": [
      "ベナン"
    ],
    "lat": 6.5,
    "lng": 2.6,
    "description": "ベナンは西アフリカのギニア湾に面した国です。奴隷貿易時代の歴史的な港町が残っています。",
    "capitals": [
      {
        "name": "ポルトノボ",
        "type": "憲法上の首都"
      },
      {
        "name": "コトヌー",
        "type": "事実上の中心都市"
      }
    ]
  },
  {
    "id": "bw",
    "name": "ボツワナ",
    "englishName": "Botswana",
    "capital": "ハボローネ",
    "code": "BW",
    "mapCode": "BWA",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/bw.svg",
    "aliases": [
      "ボツワナ"
    ],
    "lat": -24.65,
    "lng": 25.9,
    "description": "ボツワナは南部アフリカの内陸国で、国土の多くをカラハリ砂漠が占めます。野生動物保護区で知られます。"
  },
  {
    "id": "bf",
    "name": "ブルキナファソ",
    "englishName": "Burkina Faso",
    "capital": "ワガドゥグー",
    "code": "BF",
    "mapCode": "BFA",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/bf.svg",
    "aliases": [
      "ブルキナファソ"
    ],
    "lat": 12.4,
    "lng": -1.5,
    "description": "ブルキナファソは西アフリカの内陸国です。サバンナが広がり、伝統的な仮面文化が受け継がれています。"
  },
  {
    "id": "bi",
    "name": "ブルンジ",
    "englishName": "Burundi",
    "capital": "ギテガ",
    "capitalNote": "2019年にブジュンブラから首都が移転しました。",
    "code": "BI",
    "mapCode": "BDI",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/bi.svg",
    "aliases": [
      "ブルンジ"
    ],
    "lat": -3.4,
    "lng": 29.9,
    "description": "ブルンジは中央アフリカの内陸国で、タンガニーカ湖に面しています。緑豊かな丘陵地帯が広がります。"
  },
  {
    "id": "cv",
    "name": "カーボベルデ",
    "englishName": "Cabo Verde",
    "capital": "プライア",
    "code": "CV",
    "mapCode": null,
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/cv.svg",
    "aliases": [
      "カーボベルデ"
    ],
    "lat": 14.9,
    "lng": -23.5,
    "description": "カーボベルデは大西洋に浮かぶ火山島群からなる国です。独特の音楽文化モルナで知られています。"
  },
  {
    "id": "cm",
    "name": "カメルーン",
    "englishName": "Cameroon",
    "capital": "ヤウンデ",
    "code": "CM",
    "mapCode": "CMR",
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
    ],
    "lat": 3.85,
    "lng": 11.5,
    "description": "カメルーンは中部アフリカに位置し、砂漠から熱帯雨林まで多様な自然環境を持つことから「アフリカの縮図」と呼ばれます。"
  },
  {
    "id": "cf",
    "name": "中央アフリカ",
    "englishName": "Central African Republic",
    "capital": "バンギ",
    "code": "CF",
    "mapCode": "CAF",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/cf.svg",
    "aliases": [
      "中央アフリカ",
      "ちゅうおうあふりか"
    ],
    "lat": 4.4,
    "lng": 18.6,
    "description": "中央アフリカはアフリカ大陸の中央に位置する内陸国です。熱帯雨林とサバンナが広がっています。"
  },
  {
    "id": "td",
    "name": "チャド",
    "englishName": "Chad",
    "capital": "ンジャメナ",
    "code": "TD",
    "mapCode": "TCD",
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
    ],
    "lat": 12.1,
    "lng": 15.05,
    "description": "チャドは中部アフリカの内陸国で、国土北部はサハラ砂漠、南部はサバンナが広がります。"
  },
  {
    "id": "km",
    "name": "コモロ",
    "englishName": "Comoros",
    "capital": "モロニ",
    "code": "KM",
    "mapCode": null,
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/km.svg",
    "aliases": [
      "コモロ"
    ],
    "lat": -11.7,
    "lng": 43.25,
    "description": "コモロはアフリカ東岸沖のインド洋に浮かぶ火山島国です。イランガイランなど香料の生産で知られます。"
  },
  {
    "id": "cg",
    "name": "コンゴ共和国",
    "englishName": "Republic of the Congo",
    "capital": "ブラザビル",
    "code": "CG",
    "mapCode": "COG",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/cg.svg",
    "aliases": [
      "コンゴ共和国",
      "こんごきょうわこく"
    ],
    "lat": -4.3,
    "lng": 15.25,
    "description": "コンゴ共和国は中部アフリカに位置し、コンゴ川流域の熱帯雨林が広がる自然豊かな国です。"
  },
  {
    "id": "cd",
    "name": "コンゴ民主共和国",
    "englishName": "DR Congo",
    "capital": "キンシャサ",
    "code": "CD",
    "mapCode": "COD",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/cd.svg",
    "aliases": [
      "コンゴ民主共和国",
      "こんごみんしゅきょうわこく"
    ],
    "lat": -4.3,
    "lng": 15.3,
    "description": "コンゴ民主共和国はアフリカ中央部の広大な国で、コンゴ川流域に世界屈指の熱帯雨林が広がります。"
  },
  {
    "id": "ci",
    "name": "コートジボワール",
    "englishName": "Côte d'Ivoire",
    "capital": "ヤムスクロ",
    "code": "CI",
    "mapCode": "CIV",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/ci.svg",
    "aliases": [
      "コートジボワール"
    ],
    "similarCountries": [
      "ie",
      "it"
    ],
    "lat": 6.8,
    "lng": -5.3,
    "description": "コートジボワールは西アフリカのギニア湾に面した国です。カカオの世界的な生産国として知られます。",
    "capitals": [
      {
        "name": "ヤムスクロ",
        "type": "政治上の首都"
      },
      {
        "name": "アビジャン",
        "type": "経済の中心地"
      }
    ]
  },
  {
    "id": "dj",
    "name": "ジブチ",
    "englishName": "Djibouti",
    "capital": "ジブチ",
    "code": "DJ",
    "mapCode": "DJI",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/dj.svg",
    "aliases": [
      "ジブチ"
    ],
    "lat": 11.6,
    "lng": 43.15,
    "description": "ジブチはアフリカの角に位置する小国で、紅海とアデン湾を結ぶ海上交通の要衝として発展してきました。"
  },
  {
    "id": "eg",
    "name": "エジプト",
    "englishName": "Egypt",
    "capital": "カイロ",
    "code": "EG",
    "mapCode": "EGY",
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
    ],
    "lat": 30.05,
    "lng": 31.25,
    "description": "エジプトはアフリカ北東部に位置し、ナイル川が国土を流れます。ピラミッドなど古代文明の遺産で有名です。"
  },
  {
    "id": "gq",
    "name": "赤道ギニア",
    "englishName": "Equatorial Guinea",
    "capital": "マラボ",
    "code": "GQ",
    "mapCode": "GNQ",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/gq.svg",
    "aliases": [
      "赤道ギニア",
      "せきどうぎにあ"
    ],
    "lat": 3.75,
    "lng": 8.8,
    "description": "赤道ギニアは中部アフリカの国で、大陸部と島々からなります。石油資源によって発展しました。"
  },
  {
    "id": "er",
    "name": "エリトリア",
    "englishName": "Eritrea",
    "capital": "アスマラ",
    "code": "ER",
    "mapCode": "ERI",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/er.svg",
    "aliases": [
      "エリトリア"
    ],
    "lat": 15.3,
    "lng": 38.9,
    "description": "エリトリアはアフリカの角に位置し、紅海に面しています。イタリア統治時代の建築が首都に残ります。"
  },
  {
    "id": "sz",
    "name": "エスワティニ",
    "englishName": "Eswatini",
    "capital": "ムババーネ",
    "capitalNote": "王室・立法の首都はロバンバです。",
    "code": "SZ",
    "mapCode": "SWZ",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/sz.svg",
    "aliases": [
      "エスワティニ"
    ],
    "lat": -26.3,
    "lng": 31.1,
    "description": "エスワティニは南部アフリカの内陸小国です。伝統的な王室文化が今も色濃く残っています。",
    "capitals": [
      {
        "name": "ムババーネ",
        "type": "行政"
      },
      {
        "name": "ロバンバ",
        "type": "王室・立法"
      }
    ]
  },
  {
    "id": "et",
    "name": "エチオピア",
    "englishName": "Ethiopia",
    "capital": "アディスアベバ",
    "code": "ET",
    "mapCode": "ETH",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/et.svg",
    "aliases": [
      "エチオピア"
    ],
    "similarCountries": [
      "gh",
      "bo"
    ],
    "lat": 9,
    "lng": 38.75,
    "description": "エチオピアはアフリカの角に位置する高原国です。独自の暦や文字を持ち、コーヒー発祥の地とされます。"
  },
  {
    "id": "ga",
    "name": "ガボン",
    "englishName": "Gabon",
    "capital": "リーブルビル",
    "code": "GA",
    "mapCode": "GAB",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/ga.svg",
    "aliases": [
      "ガボン"
    ],
    "lat": 0.4,
    "lng": 9.45,
    "description": "ガボンは中部アフリカの大西洋岸に位置し、国土の大部分を手つかずの熱帯雨林が覆う自然豊かな国です。"
  },
  {
    "id": "gm",
    "name": "ガンビア",
    "englishName": "Gambia",
    "capital": "バンジュール",
    "code": "GM",
    "mapCode": "GMB",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/gm.svg",
    "aliases": [
      "ガンビア"
    ],
    "lat": 13.45,
    "lng": -16.6,
    "description": "ガンビアは西アフリカの細長い国で、国土の中央をガンビア川が貫き、周囲をセネガルに囲まれています。"
  },
  {
    "id": "gh",
    "name": "ガーナ",
    "englishName": "Ghana",
    "capital": "アクラ",
    "code": "GH",
    "mapCode": "GHA",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/gh.svg",
    "aliases": [
      "ガーナ"
    ],
    "similarCountries": [
      "et",
      "bo"
    ],
    "lat": 5.6,
    "lng": -0.2,
    "description": "ガーナは西アフリカのギニア湾に面した国です。カカオ生産とかつての金の交易で知られています。"
  },
  {
    "id": "gn",
    "name": "ギニア",
    "englishName": "Guinea",
    "capital": "コナクリ",
    "code": "GN",
    "mapCode": "GIN",
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
    ],
    "lat": 9.5,
    "lng": -13.7,
    "description": "ギニアは西アフリカの国で、山岳地帯から海岸まで変化に富んだ地形を持ちます。ボーキサイト資源が豊富です。"
  },
  {
    "id": "gw",
    "name": "ギニアビサウ",
    "englishName": "Guinea-Bissau",
    "capital": "ビサウ",
    "code": "GW",
    "mapCode": "GNB",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/gw.svg",
    "aliases": [
      "ギニアビサウ"
    ],
    "lat": 11.85,
    "lng": -15.6,
    "description": "ギニアビサウは西アフリカの大西洋岸に位置し、多くの島々からなるビジャゴ諸島を含みます。"
  },
  {
    "id": "ke",
    "name": "ケニア",
    "englishName": "Kenya",
    "capital": "ナイロビ",
    "code": "KE",
    "mapCode": "KEN",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/ke.svg",
    "aliases": [
      "ケニア"
    ],
    "lat": -1.3,
    "lng": 36.8,
    "description": "ケニアは東アフリカに位置し、赤道が国土を横断します。サバンナに生息する野生動物で世界的に有名です。"
  },
  {
    "id": "ls",
    "name": "レソト",
    "englishName": "Lesotho",
    "capital": "マセル",
    "code": "LS",
    "mapCode": "LSO",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/ls.svg",
    "aliases": [
      "レソト"
    ],
    "lat": -29.3,
    "lng": 27.5,
    "description": "レソトは南アフリカに完全に囲まれた内陸国です。国土の大部分が高地にあり「天空の王国」とも呼ばれます。"
  },
  {
    "id": "lr",
    "name": "リベリア",
    "englishName": "Liberia",
    "capital": "モンロビア",
    "code": "LR",
    "mapCode": "LBR",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/lr.svg",
    "aliases": [
      "リベリア"
    ],
    "lat": 6.3,
    "lng": -10.8,
    "description": "リベリアは西アフリカの大西洋岸に位置し、アメリカで解放された人々によって建国された歴史を持ちます。"
  },
  {
    "id": "ly",
    "name": "リビア",
    "englishName": "Libya",
    "capital": "トリポリ",
    "code": "LY",
    "mapCode": "LBY",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/ly.svg",
    "aliases": [
      "リビア"
    ],
    "lat": 32.9,
    "lng": 13.2,
    "description": "リビアは北アフリカの地中海沿岸国です。国土の大部分をサハラ砂漠が占め、古代ローマの遺跡も残ります。"
  },
  {
    "id": "mg",
    "name": "マダガスカル",
    "englishName": "Madagascar",
    "capital": "アンタナナリボ",
    "code": "MG",
    "mapCode": "MDG",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/mg.svg",
    "aliases": [
      "マダガスカル"
    ],
    "lat": -18.9,
    "lng": 47.5,
    "description": "マダガスカルはインド洋に浮かぶ世界第4位の面積を持つ島国です。独自の進化を遂げた固有種の宝庫です。"
  },
  {
    "id": "mw",
    "name": "マラウイ",
    "englishName": "Malawi",
    "capital": "リロングウェ",
    "code": "MW",
    "mapCode": "MWI",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/mw.svg",
    "aliases": [
      "マラウイ"
    ],
    "lat": -13.95,
    "lng": 33.8,
    "description": "マラウイは東アフリカの内陸国で、国土の南北に細長いマラウイ湖が広がる緑豊かな高原の国です。"
  },
  {
    "id": "ml",
    "name": "マリ",
    "englishName": "Mali",
    "capital": "バマコ",
    "code": "ML",
    "mapCode": "MLI",
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
    ],
    "lat": 12.65,
    "lng": -8,
    "description": "マリは西アフリカの内陸国で、国土北部をサハラ砂漠が占めます。かつて交易都市トンブクトゥが栄えました。"
  },
  {
    "id": "mr",
    "name": "モーリタニア",
    "englishName": "Mauritania",
    "capital": "ヌアクショット",
    "code": "MR",
    "mapCode": "MRT",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/mr.svg",
    "aliases": [
      "モーリタニア"
    ],
    "lat": 18.1,
    "lng": -15.95,
    "description": "モーリタニアは西アフリカの国で、国土の大部分がサハラ砂漠に覆われています。大西洋沿岸の漁業も盛んです。"
  },
  {
    "id": "mu",
    "name": "モーリシャス",
    "englishName": "Mauritius",
    "capital": "ポートルイス",
    "code": "MU",
    "mapCode": null,
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/mu.svg",
    "aliases": [
      "モーリシャス"
    ],
    "similarCountries": [
      "za"
    ],
    "lat": -20.15,
    "lng": 57.5,
    "description": "モーリシャスはインド洋に浮かぶ火山島国です。美しいサンゴ礁のビーチリゾートとして知られています。"
  },
  {
    "id": "ma",
    "name": "モロッコ",
    "englishName": "Morocco",
    "capital": "ラバト",
    "code": "MA",
    "mapCode": "MAR",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/ma.svg",
    "aliases": [
      "モロッコ"
    ],
    "lat": 34,
    "lng": -6.85,
    "description": "モロッコは北アフリカの国で、地中海と大西洋の両方に面しています。迷路のような旧市街で知られます。"
  },
  {
    "id": "mz",
    "name": "モザンビーク",
    "englishName": "Mozambique",
    "capital": "マプト",
    "code": "MZ",
    "mapCode": "MOZ",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/mz.svg",
    "aliases": [
      "モザンビーク"
    ],
    "lat": -25.95,
    "lng": 32.6,
    "description": "モザンビークは南部アフリカのインド洋沿岸国です。長い海岸線と美しいビーチが広がっています。"
  },
  {
    "id": "na",
    "name": "ナミビア",
    "englishName": "Namibia",
    "capital": "ウィントフック",
    "code": "NA",
    "mapCode": "NAM",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/na.svg",
    "aliases": [
      "ナミビア"
    ],
    "lat": -22.55,
    "lng": 17.05,
    "description": "ナミビアは南部アフリカの大西洋岸に位置し、世界最古の砂漠とされるナミブ砂漠が広がります。"
  },
  {
    "id": "ne",
    "name": "ニジェール",
    "englishName": "Niger",
    "capital": "ニアメ",
    "code": "NE",
    "mapCode": "NER",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/ne.svg",
    "aliases": [
      "ニジェール"
    ],
    "lat": 13.5,
    "lng": 2.1,
    "description": "ニジェールは西アフリカの内陸国で、国土の大部分をサハラ砂漠が占める、乾燥した気候の国です。"
  },
  {
    "id": "ng",
    "name": "ナイジェリア",
    "englishName": "Nigeria",
    "capital": "アブジャ",
    "code": "NG",
    "mapCode": "NGA",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/ng.svg",
    "aliases": [
      "ナイジェリア"
    ],
    "lat": 9.1,
    "lng": 7.5,
    "description": "ナイジェリアは西アフリカの大国で、アフリカ最多の人口を抱えます。多様な民族と文化が共存します。"
  },
  {
    "id": "rw",
    "name": "ルワンダ",
    "englishName": "Rwanda",
    "capital": "キガリ",
    "code": "RW",
    "mapCode": "RWA",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/rw.svg",
    "aliases": [
      "ルワンダ"
    ],
    "lat": -1.95,
    "lng": 30.05,
    "description": "ルワンダは中央アフリカの内陸国で、「千の丘の国」と呼ばれる緑豊かな丘陵地帯が広がります。"
  },
  {
    "id": "st",
    "name": "サントメ・プリンシペ",
    "englishName": "Sao Tome and Principe",
    "capital": "サントメ",
    "code": "ST",
    "mapCode": null,
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/st.svg",
    "aliases": [
      "サントメ・プリンシペ"
    ],
    "similarCountries": [
      "sc",
      "gn"
    ],
    "lat": 0.35,
    "lng": 6.7,
    "description": "サントメ・プリンシペはギニア湾に浮かぶ火山島国です。カカオとコーヒーの生産で知られています。"
  },
  {
    "id": "sn",
    "name": "セネガル",
    "englishName": "Senegal",
    "capital": "ダカール",
    "code": "SN",
    "mapCode": "SEN",
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
    ],
    "lat": 14.7,
    "lng": -17.45,
    "description": "セネガルは西アフリカ最西端に位置する国です。かつての交易拠点ゴレ島など歴史的な場所が残ります。"
  },
  {
    "id": "sc",
    "name": "セーシェル",
    "englishName": "Seychelles",
    "capital": "ビクトリア",
    "code": "SC",
    "mapCode": null,
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/sc.svg",
    "aliases": [
      "セーシェル"
    ],
    "similarCountries": [
      "st"
    ],
    "lat": -4.6,
    "lng": 55.45,
    "description": "セーシェルはインド洋に浮かぶ100以上の島々からなる国です。透明度の高い海が広がるリゾート地です。"
  },
  {
    "id": "sl",
    "name": "シエラレオネ",
    "englishName": "Sierra Leone",
    "capital": "フリータウン",
    "code": "SL",
    "mapCode": "SLE",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/sl.svg",
    "aliases": [
      "シエラレオネ"
    ],
    "similarCountries": [
      "sn"
    ],
    "lat": 8.5,
    "lng": -13.25,
    "description": "シエラレオネは西アフリカの大西洋岸国です。豊かなダイヤモンド資源と美しい海岸線を持ちます。"
  },
  {
    "id": "so",
    "name": "ソマリア",
    "englishName": "Somalia",
    "capital": "モガディシュ",
    "code": "SO",
    "mapCode": "SOM",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/so.svg",
    "aliases": [
      "ソマリア"
    ],
    "lat": 2.05,
    "lng": 45.3,
    "description": "ソマリアはアフリカの角と呼ばれる地域に位置し、アフリカ大陸最長の海岸線を持つ国です。"
  },
  {
    "id": "za",
    "name": "南アフリカ",
    "englishName": "South Africa",
    "capital": "プレトリア",
    "capitalNote": "南アフリカは首都機能が複数の都市に分かれています。",
    "code": "ZA",
    "mapCode": "ZAF",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/za.svg",
    "aliases": [
      "南アフリカ",
      "みなみあふりか"
    ],
    "similarCountries": [
      "mu"
    ],
    "lat": -25.75,
    "lng": 28.2,
    "description": "南アフリカはアフリカ大陸最南端に位置する国です。豊かな鉱物資源と多様な自然、文化を持ちます。",
    "capitals": [
      {
        "name": "プレトリア",
        "type": "行政"
      },
      {
        "name": "ケープタウン",
        "type": "立法"
      },
      {
        "name": "ブルームフォンテーン",
        "type": "司法"
      }
    ]
  },
  {
    "id": "ss",
    "name": "南スーダン",
    "englishName": "South Sudan",
    "capital": "ジュバ",
    "code": "SS",
    "mapCode": "SSD",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/ss.svg",
    "aliases": [
      "南スーダン",
      "みなみすーだん"
    ],
    "lat": 4.85,
    "lng": 31.6,
    "description": "南スーダンは東アフリカの内陸国で、2011年に独立した世界で最も新しい国の一つです。"
  },
  {
    "id": "sd",
    "name": "スーダン",
    "englishName": "Sudan",
    "capital": "ハルツーム",
    "code": "SD",
    "mapCode": "SDN",
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
    ],
    "lat": 15.55,
    "lng": 32.5,
    "description": "スーダンは北東アフリカの国で、ナイル川が国土を貫きます。古代ヌビア文明のピラミッドも残ります。"
  },
  {
    "id": "tz",
    "name": "タンザニア",
    "englishName": "Tanzania",
    "capital": "ドドマ",
    "capitalNote": "商業の中心地はダルエスサラームです。",
    "code": "TZ",
    "mapCode": "TZA",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/tz.svg",
    "aliases": [
      "タンザニア"
    ],
    "lat": -6.2,
    "lng": 35.75,
    "description": "タンザニアは東アフリカの国で、アフリカ最高峰キリマンジャロと野生動物の楽園セレンゲティ平原があります。"
  },
  {
    "id": "tg",
    "name": "トーゴ",
    "englishName": "Togo",
    "capital": "ロメ",
    "code": "TG",
    "mapCode": "TGO",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/tg.svg",
    "aliases": [
      "トーゴ"
    ],
    "similarCountries": [
      "gh",
      "sn"
    ],
    "lat": 6.15,
    "lng": 1.2,
    "description": "トーゴは西アフリカのギニア湾に面した細長い国です。伝統的な信仰と文化が根強く残っています。"
  },
  {
    "id": "tn",
    "name": "チュニジア",
    "englishName": "Tunisia",
    "capital": "チュニス",
    "code": "TN",
    "mapCode": "TUN",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/tn.svg",
    "aliases": [
      "チュニジア"
    ],
    "lat": 36.8,
    "lng": 10.2,
    "description": "チュニジアは北アフリカの地中海沿岸国です。古代カルタゴの遺跡やサハラ砂漠への玄関口として知られます。"
  },
  {
    "id": "ug",
    "name": "ウガンダ",
    "englishName": "Uganda",
    "capital": "カンパラ",
    "code": "UG",
    "mapCode": "UGA",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/ug.svg",
    "aliases": [
      "ウガンダ"
    ],
    "lat": 0.35,
    "lng": 32.6,
    "description": "ウガンダは東アフリカの内陸国で、ビクトリア湖に面しています。緑豊かな高原気候から「アフリカの真珠」と呼ばれます。"
  },
  {
    "id": "zm",
    "name": "ザンビア",
    "englishName": "Zambia",
    "capital": "ルサカ",
    "code": "ZM",
    "mapCode": "ZMB",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/zm.svg",
    "aliases": [
      "ザンビア"
    ],
    "lat": -15.4,
    "lng": 28.3,
    "description": "ザンビアは南部アフリカの内陸国で、世界三大瀑布の一つビクトリアの滝の一部があります。"
  },
  {
    "id": "zw",
    "name": "ジンバブエ",
    "englishName": "Zimbabwe",
    "capital": "ハラレ",
    "code": "ZW",
    "mapCode": "ZWE",
    "region": "africa",
    "regionJa": "アフリカ",
    "flag": "./assets/flags/zw.svg",
    "aliases": [
      "ジンバブエ"
    ],
    "lat": -17.85,
    "lng": 31.05,
    "description": "ジンバブエは南部アフリカの内陸国です。ビクトリアの滝や古代の石造遺跡グレート・ジンバブエで知られます。"
  },
  {
    "id": "ag",
    "name": "アンティグア・バーブーダ",
    "englishName": "Antigua and Barbuda",
    "capital": "セントジョンズ",
    "code": "AG",
    "mapCode": null,
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/ag.svg",
    "aliases": [
      "アンティグア・バーブーダ"
    ],
    "lat": 17.1,
    "lng": -61.85,
    "description": "アンティグア・バーブーダはカリブ海に浮かぶ島国です。数多くの美しいビーチを持つリゾート地です。"
  },
  {
    "id": "bs",
    "name": "バハマ",
    "englishName": "Bahamas",
    "capital": "ナッソー",
    "code": "BS",
    "mapCode": "BHS",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/bs.svg",
    "aliases": [
      "バハマ"
    ],
    "lat": 25.05,
    "lng": -77.35,
    "description": "バハマはカリブ海の北、大西洋に浮かぶ700以上の島々からなる国です。透明度の高い海で知られます。"
  },
  {
    "id": "bb",
    "name": "バルバドス",
    "englishName": "Barbados",
    "capital": "ブリッジタウン",
    "code": "BB",
    "mapCode": null,
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/bb.svg",
    "aliases": [
      "バルバドス"
    ],
    "lat": 13.1,
    "lng": -59.6,
    "description": "バルバドスはカリブ海東端に位置する島国です。サトウキビ栽培とラム酒の生産で知られています。"
  },
  {
    "id": "bz",
    "name": "ベリーズ",
    "englishName": "Belize",
    "capital": "ベルモパン",
    "code": "BZ",
    "mapCode": "BLZ",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/bz.svg",
    "aliases": [
      "ベリーズ"
    ],
    "lat": 17.25,
    "lng": -88.75,
    "description": "ベリーズは中央アメリカの国で、世界第2位の規模を誇るサンゴ礁が海岸沿いに広がっています。"
  },
  {
    "id": "ca",
    "name": "カナダ",
    "englishName": "Canada",
    "capital": "オタワ",
    "code": "CA",
    "mapCode": "CAN",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/ca.svg",
    "aliases": [
      "カナダ"
    ],
    "lat": 45.4,
    "lng": -75.7,
    "description": "カナダは北アメリカ北部に位置する世界第2位の面積を持つ国です。広大な森林や湖が広がります。"
  },
  {
    "id": "cr",
    "name": "コスタリカ",
    "englishName": "Costa Rica",
    "capital": "サンホセ",
    "code": "CR",
    "mapCode": "CRI",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/cr.svg",
    "aliases": [
      "コスタリカ"
    ],
    "lat": 9.95,
    "lng": -84.1,
    "description": "コスタリカは中央アメリカの国で、豊かな熱帯雨林と生物多様性を誇るエコツーリズムの先進国です。"
  },
  {
    "id": "cu",
    "name": "キューバ",
    "englishName": "Cuba",
    "capital": "ハバナ",
    "code": "CU",
    "mapCode": "CUB",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/cu.svg",
    "aliases": [
      "キューバ"
    ],
    "similarCountries": [
      "pr",
      "ph"
    ],
    "lat": 23.1,
    "lng": -82.35,
    "description": "キューバはカリブ海最大の島国です。色鮮やかなクラシックカーと音楽文化で世界的に知られています。"
  },
  {
    "id": "dm",
    "name": "ドミニカ国",
    "englishName": "Dominica",
    "capital": "ロゾー",
    "code": "DM",
    "mapCode": null,
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/dm.svg",
    "aliases": [
      "ドミニカ国",
      "どみにかこく"
    ],
    "lat": 15.3,
    "lng": -61.4,
    "description": "ドミニカ国はカリブ海の火山島国です。「自然の島」と呼ばれるほど豊かな熱帯雨林が広がります。"
  },
  {
    "id": "do",
    "name": "ドミニカ共和国",
    "englishName": "Dominican Republic",
    "capital": "サントドミンゴ",
    "code": "DO",
    "mapCode": "DOM",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/do.svg",
    "aliases": [
      "ドミニカ共和国",
      "どみにかきょうわこく"
    ],
    "lat": 18.5,
    "lng": -69.95,
    "description": "ドミニカ共和国はカリブ海のイスパニョーラ島東部に位置します。美しいビーチリゾートで知られます。"
  },
  {
    "id": "sv",
    "name": "エルサルバドル",
    "englishName": "El Salvador",
    "capital": "サンサルバドル",
    "code": "SV",
    "mapCode": "SLV",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/sv.svg",
    "aliases": [
      "エルサルバドル"
    ],
    "lat": 13.7,
    "lng": -89.2,
    "description": "エルサルバドルは中央アメリカ最小の国です。太平洋に面し、火山が連なる地形が特徴です。"
  },
  {
    "id": "gd",
    "name": "グレナダ",
    "englishName": "Grenada",
    "capital": "セントジョージズ",
    "code": "GD",
    "mapCode": null,
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/gd.svg",
    "aliases": [
      "グレナダ"
    ],
    "lat": 12.05,
    "lng": -61.75,
    "description": "グレナダはカリブ海の島国で、「スパイスの島」と呼ばれるほどナツメグなどの香辛料生産が盛んです。"
  },
  {
    "id": "gt",
    "name": "グアテマラ",
    "englishName": "Guatemala",
    "capital": "グアテマラシティ",
    "code": "GT",
    "mapCode": "GTM",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/gt.svg",
    "aliases": [
      "グアテマラ"
    ],
    "lat": 14.6,
    "lng": -90.5,
    "description": "グアテマラは中央アメリカの国で、古代マヤ文明の遺跡ティカルなど歴史的な遺産が数多く残ります。"
  },
  {
    "id": "ht",
    "name": "ハイチ",
    "englishName": "Haiti",
    "capital": "ポルトープランス",
    "code": "HT",
    "mapCode": "HTI",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/ht.svg",
    "aliases": [
      "ハイチ"
    ],
    "similarCountries": [
      "li",
      "nl"
    ],
    "lat": 18.55,
    "lng": -72.3,
    "description": "ハイチはカリブ海のイスパニョーラ島西部に位置し、世界初の黒人共和国として独立した歴史を持ちます。"
  },
  {
    "id": "hn",
    "name": "ホンジュラス",
    "englishName": "Honduras",
    "capital": "テグシガルパ",
    "code": "HN",
    "mapCode": "HND",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/hn.svg",
    "aliases": [
      "ホンジュラス"
    ],
    "lat": 14.1,
    "lng": -87.2,
    "description": "ホンジュラスは中央アメリカの国で、カリブ海と太平洋の両方に面しています。マヤ遺跡コパンで有名です。"
  },
  {
    "id": "jm",
    "name": "ジャマイカ",
    "englishName": "Jamaica",
    "capital": "キングストン",
    "code": "JM",
    "mapCode": "JAM",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/jm.svg",
    "aliases": [
      "ジャマイカ"
    ],
    "lat": 18,
    "lng": -76.8,
    "description": "ジャマイカはカリブ海に浮かぶ島国です。レゲエ音楽の発祥地として世界的に知られています。"
  },
  {
    "id": "mx",
    "name": "メキシコ",
    "englishName": "Mexico",
    "capital": "メキシコシティ",
    "code": "MX",
    "mapCode": "MEX",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/mx.svg",
    "aliases": [
      "メキシコ"
    ],
    "similarCountries": [
      "it",
      "ie"
    ],
    "lat": 19.4,
    "lng": -99.1,
    "description": "メキシコは北アメリカ南部の国で、古代アステカ・マヤ文明の遺跡が数多く残っています。"
  },
  {
    "id": "ni",
    "name": "ニカラグア",
    "englishName": "Nicaragua",
    "capital": "マナグア",
    "code": "NI",
    "mapCode": "NIC",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/ni.svg",
    "aliases": [
      "ニカラグア"
    ],
    "lat": 12.1,
    "lng": -86.25,
    "description": "ニカラグアは中央アメリカ最大の面積を持つ国です。多くの火山と中央アメリカ最大の湖ニカラグア湖があります。"
  },
  {
    "id": "pa",
    "name": "パナマ",
    "englishName": "Panama",
    "capital": "パナマシティ",
    "code": "PA",
    "mapCode": "PAN",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/pa.svg",
    "aliases": [
      "パナマ"
    ],
    "lat": 9,
    "lng": -79.5,
    "description": "パナマは中央アメリカ最南端の国で、太平洋と大西洋を結ぶパナマ運河があることで知られます。"
  },
  {
    "id": "pr",
    "name": "プエルトリコ",
    "englishName": "Puerto Rico",
    "capital": "サンフアン",
    "code": "PR",
    "mapCode": "PRI",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/pr.svg",
    "aliases": [
      "プエルトリコ"
    ],
    "similarCountries": [
      "cu"
    ],
    "lat": 18.45,
    "lng": -66.05,
    "description": "プエルトリコはカリブ海に浮かぶ島で、スペイン統治時代の歴史的な街並みが残っています。"
  },
  {
    "id": "kn",
    "name": "セントクリストファー・ネービス",
    "englishName": "Saint Kitts and Nevis",
    "capital": "バセテール",
    "code": "KN",
    "mapCode": null,
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/kn.svg",
    "aliases": [
      "セントクリストファー・ネービス"
    ],
    "lat": 17.3,
    "lng": -62.7,
    "description": "セントクリストファー・ネービスはカリブ海の小さな島国です。火山地形と美しいビーチが広がります。"
  },
  {
    "id": "lc",
    "name": "セントルシア",
    "englishName": "Saint Lucia",
    "capital": "カストリーズ",
    "code": "LC",
    "mapCode": null,
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/lc.svg",
    "aliases": [
      "セントルシア"
    ],
    "lat": 14,
    "lng": -61,
    "description": "セントルシアはカリブ海に浮かぶ火山島国です。双子の尖った山ピトンズが象徴的な景観を作っています。"
  },
  {
    "id": "vc",
    "name": "セントビンセント・グレナディーン",
    "englishName": "Saint Vincent and the Grenadines",
    "capital": "キングスタウン",
    "code": "VC",
    "mapCode": null,
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/vc.svg",
    "aliases": [
      "セントビンセント・グレナディーン"
    ],
    "lat": 13.15,
    "lng": -61.2,
    "description": "セントビンセント・グレナディーンはカリブ海に浮かぶ火山島と多数の小島々からなる国です。"
  },
  {
    "id": "tt",
    "name": "トリニダード・トバゴ",
    "englishName": "Trinidad and Tobago",
    "capital": "ポートオブスペイン",
    "code": "TT",
    "mapCode": "TTO",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/tt.svg",
    "aliases": [
      "トリニダード・トバゴ"
    ],
    "lat": 10.65,
    "lng": -61.5,
    "description": "トリニダード・トバゴはカリブ海南端の島国です。カーニバルとカリプソ音楽で有名です。"
  },
  {
    "id": "us",
    "name": "アメリカ",
    "englishName": "United States",
    "capital": "ワシントンD.C.",
    "code": "US",
    "mapCode": "USA",
    "region": "namerica",
    "regionJa": "北アメリカ・中央アメリカ・カリブ",
    "flag": "./assets/flags/us.svg",
    "aliases": [
      "アメリカ",
      "アメリカ合衆国"
    ],
    "officialName": "アメリカ合衆国",
    "lat": 38.9,
    "lng": -77,
    "description": "アメリカはロッキー山脈から大西洋岸まで広がる北アメリカの大国です。多様な自然と文化が共存します。"
  },
  {
    "id": "ar",
    "name": "アルゼンチン",
    "englishName": "Argentina",
    "capital": "ブエノスアイレス",
    "code": "AR",
    "mapCode": "ARG",
    "region": "samerica",
    "regionJa": "南アメリカ",
    "flag": "./assets/flags/ar.svg",
    "aliases": [
      "アルゼンチン"
    ],
    "similarCountries": [
      "uy"
    ],
    "lat": -34.6,
    "lng": -58.4,
    "description": "アルゼンチンは南アメリカ南部の国で、パンパと呼ばれる大草原とパタゴニアの雄大な自然が広がります。"
  },
  {
    "id": "bo",
    "name": "ボリビア",
    "englishName": "Bolivia",
    "capital": "スクレ",
    "code": "BO",
    "mapCode": "BOL",
    "region": "samerica",
    "regionJa": "南アメリカ",
    "flag": "./assets/flags/bo.svg",
    "aliases": [
      "ボリビア"
    ],
    "similarCountries": [
      "gh",
      "et"
    ],
    "lat": -19.05,
    "lng": -65.25,
    "description": "ボリビアは南アメリカの内陸国で、アンデス山脈の高地に位置します。世界最大の塩湖ウユニ塩原があります。",
    "capitals": [
      {
        "name": "スクレ",
        "type": "憲法上の首都"
      },
      {
        "name": "ラパス",
        "type": "政府所在地"
      }
    ]
  },
  {
    "id": "br",
    "name": "ブラジル",
    "englishName": "Brazil",
    "capital": "ブラジリア",
    "code": "BR",
    "mapCode": "BRA",
    "region": "samerica",
    "regionJa": "南アメリカ",
    "flag": "./assets/flags/br.svg",
    "aliases": [
      "ブラジル"
    ],
    "lat": -15.8,
    "lng": -47.9,
    "description": "ブラジルは南アメリカ最大の面積を持つ国です。アマゾンの熱帯雨林が国土の大部分を占めています。"
  },
  {
    "id": "cl",
    "name": "チリ",
    "englishName": "Chile",
    "capital": "サンティアゴ",
    "code": "CL",
    "mapCode": "CHL",
    "region": "samerica",
    "regionJa": "南アメリカ",
    "flag": "./assets/flags/cl.svg",
    "aliases": [
      "チリ"
    ],
    "lat": -33.45,
    "lng": -70.65,
    "description": "チリは南アメリカ西岸に沿って南北に細長く伸びる国です。アタカマ砂漠から氷河地帯まで多様な気候を持ちます。"
  },
  {
    "id": "co",
    "name": "コロンビア",
    "englishName": "Colombia",
    "capital": "ボゴタ",
    "code": "CO",
    "mapCode": "COL",
    "region": "samerica",
    "regionJa": "南アメリカ",
    "flag": "./assets/flags/co.svg",
    "aliases": [
      "コロンビア"
    ],
    "similarCountries": [
      "ec",
      "ve"
    ],
    "lat": 4.7,
    "lng": -74.1,
    "description": "コロンビアは南アメリカ北西部の国で、太平洋とカリブ海の両方に面しています。コーヒーの名産地です。"
  },
  {
    "id": "ec",
    "name": "エクアドル",
    "englishName": "Ecuador",
    "capital": "キト",
    "code": "EC",
    "mapCode": "ECU",
    "region": "samerica",
    "regionJa": "南アメリカ",
    "flag": "./assets/flags/ec.svg",
    "aliases": [
      "エクアドル"
    ],
    "similarCountries": [
      "co",
      "ve"
    ],
    "lat": -0.2,
    "lng": -78.5,
    "description": "エクアドルは南アメリカの国で、赤道が国名の由来です。ガラパゴス諸島の独自の生態系で有名です。"
  },
  {
    "id": "gy",
    "name": "ガイアナ",
    "englishName": "Guyana",
    "capital": "ジョージタウン",
    "code": "GY",
    "mapCode": "GUY",
    "region": "samerica",
    "regionJa": "南アメリカ",
    "flag": "./assets/flags/gy.svg",
    "aliases": [
      "ガイアナ"
    ],
    "similarCountries": [
      "sr"
    ],
    "lat": 6.8,
    "lng": -58.15,
    "description": "ガイアナは南アメリカ北部の国で、国土の大部分を手つかずの熱帯雨林が覆う自然豊かな国です。"
  },
  {
    "id": "py",
    "name": "パラグアイ",
    "englishName": "Paraguay",
    "capital": "アスンシオン",
    "code": "PY",
    "mapCode": "PRY",
    "region": "samerica",
    "regionJa": "南アメリカ",
    "flag": "./assets/flags/py.svg",
    "aliases": [
      "パラグアイ"
    ],
    "similarCountries": [
      "nl"
    ],
    "lat": -25.3,
    "lng": -57.6,
    "description": "パラグアイは南アメリカの内陸国で、パラグアイ川が国土を東西に分け、豊かな農牧地帯が広がります。"
  },
  {
    "id": "pe",
    "name": "ペルー",
    "englishName": "Peru",
    "capital": "リマ",
    "code": "PE",
    "mapCode": "PER",
    "region": "samerica",
    "regionJa": "南アメリカ",
    "flag": "./assets/flags/pe.svg",
    "aliases": [
      "ペルー"
    ],
    "lat": -12.05,
    "lng": -77.05,
    "description": "ペルーは南アメリカ西部の国で、アンデス山脈に古代インカ文明の遺跡マチュピチュがあります。"
  },
  {
    "id": "sr",
    "name": "スリナム",
    "englishName": "Suriname",
    "capital": "パラマリボ",
    "code": "SR",
    "mapCode": "SUR",
    "region": "samerica",
    "regionJa": "南アメリカ",
    "flag": "./assets/flags/sr.svg",
    "aliases": [
      "スリナム"
    ],
    "similarCountries": [
      "gy"
    ],
    "lat": 5.85,
    "lng": -55.15,
    "description": "スリナムは南アメリカ北部の国で、国土の大部分を熱帯雨林が占め、多様な民族が共存しています。"
  },
  {
    "id": "uy",
    "name": "ウルグアイ",
    "englishName": "Uruguay",
    "capital": "モンテビデオ",
    "code": "UY",
    "mapCode": "URY",
    "region": "samerica",
    "regionJa": "南アメリカ",
    "flag": "./assets/flags/uy.svg",
    "aliases": [
      "ウルグアイ"
    ],
    "similarCountries": [
      "ar"
    ],
    "lat": -34.9,
    "lng": -56.2,
    "description": "ウルグアイは南アメリカ南東部の国で、なだらかな草原地帯が広がる牧畜が盛んな国です。"
  },
  {
    "id": "ve",
    "name": "ベネズエラ",
    "englishName": "Venezuela",
    "capital": "カラカス",
    "code": "VE",
    "mapCode": "VEN",
    "region": "samerica",
    "regionJa": "南アメリカ",
    "flag": "./assets/flags/ve.svg",
    "aliases": [
      "ベネズエラ"
    ],
    "similarCountries": [
      "co",
      "ec"
    ],
    "lat": 10.5,
    "lng": -66.9,
    "description": "ベネズエラは南アメリカ北部の国で、世界最大の落差を誇るエンジェルフォールがあります。"
  },
  {
    "id": "au",
    "name": "オーストラリア",
    "englishName": "Australia",
    "capital": "キャンベラ",
    "code": "AU",
    "mapCode": "AUS",
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
    ],
    "lat": -35.3,
    "lng": 149.1,
    "description": "オーストラリアは南半球最大の島大陸です。広大な砂漠地帯と独自の生態系を持つ野生動物で知られます。"
  },
  {
    "id": "fj",
    "name": "フィジー",
    "englishName": "Fiji",
    "capital": "スバ",
    "code": "FJ",
    "mapCode": "FJI",
    "region": "oceania",
    "regionJa": "オセアニア",
    "flag": "./assets/flags/fj.svg",
    "aliases": [
      "フィジー"
    ],
    "lat": -18.15,
    "lng": 178.45,
    "description": "フィジーは南太平洋に浮かぶ島国です。美しいサンゴ礁の海と友好的な文化で知られるリゾート地です。"
  },
  {
    "id": "ki",
    "name": "キリバス",
    "englishName": "Kiribati",
    "capital": "タラワ",
    "code": "KI",
    "mapCode": null,
    "region": "oceania",
    "regionJa": "オセアニア",
    "flag": "./assets/flags/ki.svg",
    "aliases": [
      "キリバス"
    ],
    "lat": 1.35,
    "lng": 173,
    "description": "キリバスは太平洋中央部に浮かぶ島国で、多数のサンゴ礁の環礁が赤道をまたいで点在しています。"
  },
  {
    "id": "mh",
    "name": "マーシャル諸島",
    "englishName": "Marshall Islands",
    "capital": "マジュロ",
    "code": "MH",
    "mapCode": null,
    "region": "oceania",
    "regionJa": "オセアニア",
    "flag": "./assets/flags/mh.svg",
    "aliases": [
      "マーシャル諸島",
      "まーしゃるしょとう"
    ],
    "similarCountries": [
      "pw",
      "mc"
    ],
    "lat": 7.1,
    "lng": 171.4,
    "description": "マーシャル諸島は太平洋に浮かぶサンゴ礁の島国です。多くの環礁からなる平坦な地形が特徴です。"
  },
  {
    "id": "fm",
    "name": "ミクロネシア連邦",
    "englishName": "Micronesia",
    "capital": "パリキール",
    "code": "FM",
    "mapCode": null,
    "region": "oceania",
    "regionJa": "オセアニア",
    "flag": "./assets/flags/fm.svg",
    "aliases": [
      "ミクロネシア連邦",
      "みくろねしられんぽう"
    ],
    "similarCountries": [
      "pw"
    ],
    "lat": 6.9,
    "lng": 158.2,
    "description": "ミクロネシア連邦は太平洋に浮かぶ島々からなる国です。古代の石造遺跡ナン・マドールが残ります。"
  },
  {
    "id": "nr",
    "name": "ナウル",
    "englishName": "Nauru",
    "capital": "ヤレン",
    "capitalNote": "ナウルには法律上の首都はなく、ヤレン地区が政府機能の中心です。",
    "code": "NR",
    "mapCode": null,
    "region": "oceania",
    "regionJa": "オセアニア",
    "flag": "./assets/flags/nr.svg",
    "aliases": [
      "ナウル"
    ],
    "lat": -0.55,
    "lng": 166.9,
    "description": "ナウルは太平洋に浮かぶ世界で最も小さな島国の一つです。かつてリン鉱石の採掘で栄えました。"
  },
  {
    "id": "nz",
    "name": "ニュージーランド",
    "englishName": "New Zealand",
    "capital": "ウェリントン",
    "code": "NZ",
    "mapCode": "NZL",
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
    ],
    "lat": -41.3,
    "lng": 174.8,
    "description": "ニュージーランドは南太平洋に浮かぶ2つの主要な島からなる国です。雄大な山々とフィヨルドの景観が魅力です。"
  },
  {
    "id": "pw",
    "name": "パラオ",
    "englishName": "Palau",
    "capital": "マルキョク",
    "code": "PW",
    "mapCode": null,
    "region": "oceania",
    "regionJa": "オセアニア",
    "flag": "./assets/flags/pw.svg",
    "aliases": [
      "パラオ"
    ],
    "similarCountries": [
      "jp",
      "mh"
    ],
    "lat": 7.5,
    "lng": 134.6,
    "description": "パラオは太平洋に浮かぶ島国で、透明度の高い海と豊かなサンゴ礁が広がるダイビングの聖地です。"
  },
  {
    "id": "pg",
    "name": "パプアニューギニア",
    "englishName": "Papua New Guinea",
    "capital": "ポートモレスビー",
    "code": "PG",
    "mapCode": "PNG",
    "region": "oceania",
    "regionJa": "オセアニア",
    "flag": "./assets/flags/pg.svg",
    "aliases": [
      "パプアニューギニア"
    ],
    "lat": -9.45,
    "lng": 147.2,
    "description": "パプアニューギニアはニューギニア島東部に位置する国です。多様な言語と文化を持つことで知られます。"
  },
  {
    "id": "ws",
    "name": "サモア",
    "englishName": "Samoa",
    "capital": "アピア",
    "code": "WS",
    "mapCode": null,
    "region": "oceania",
    "regionJa": "オセアニア",
    "flag": "./assets/flags/ws.svg",
    "aliases": [
      "サモア"
    ],
    "lat": -13.85,
    "lng": -171.75,
    "description": "サモアは南太平洋に浮かぶ島国です。ポリネシアの伝統文化が今も色濃く残っています。"
  },
  {
    "id": "sb",
    "name": "ソロモン諸島",
    "englishName": "Solomon Islands",
    "capital": "ホニアラ",
    "code": "SB",
    "mapCode": "SLB",
    "region": "oceania",
    "regionJa": "オセアニア",
    "flag": "./assets/flags/sb.svg",
    "aliases": [
      "ソロモン諸島",
      "そろもんしょとう"
    ],
    "lat": -9.45,
    "lng": 159.95,
    "description": "ソロモン諸島は南太平洋に浮かぶ多くの島々からなる国です。豊かなサンゴ礁と熱帯雨林が広がります。"
  },
  {
    "id": "to",
    "name": "トンガ",
    "englishName": "Tonga",
    "capital": "ヌクアロファ",
    "code": "TO",
    "mapCode": null,
    "region": "oceania",
    "regionJa": "オセアニア",
    "flag": "./assets/flags/to.svg",
    "aliases": [
      "トンガ"
    ],
    "lat": -21.15,
    "lng": -175.2,
    "description": "トンガは南太平洋に浮かぶ島国で、太平洋の島国の中で唯一王国の伝統を保ち続けている国です。"
  },
  {
    "id": "tv",
    "name": "ツバル",
    "englishName": "Tuvalu",
    "capital": "フナフティ",
    "code": "TV",
    "mapCode": null,
    "region": "oceania",
    "regionJa": "オセアニア",
    "flag": "./assets/flags/tv.svg",
    "aliases": [
      "ツバル"
    ],
    "lat": -8.5,
    "lng": 179.2,
    "description": "ツバルは太平洋に浮かぶ世界でも有数の小さな島国です。海抜の低い環礁からなり、平坦な地形が特徴です。"
  },
  {
    "id": "vu",
    "name": "バヌアツ",
    "englishName": "Vanuatu",
    "capital": "ポートビラ",
    "code": "VU",
    "mapCode": "VUT",
    "region": "oceania",
    "regionJa": "オセアニア",
    "flag": "./assets/flags/vu.svg",
    "aliases": [
      "バヌアツ"
    ],
    "lat": -17.75,
    "lng": 168.3,
    "description": "バヌアツは南太平洋に浮かぶ火山島群からなる国です。活火山や独自の伝統文化が残っています。"
  }
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = COUNTRIES;
}
