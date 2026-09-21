# サードパーティ ライセンス

## assets/flags/ の国旗SVG

`assets/flags/` 内の国旗SVGは [flag-icons](https://github.com/lipis/flag-icons)
(作者: Panayiotis Lipiridis)を利用しています。MITライセンスに基づき配布しています。
ただし `hi.svg`(ハワイ)はflag-icons非対応(国単位のみでアメリカ合衆国の州は
対象外)のため、公有のハワイ州旗デザイン(8本のストライプ+カントンの
ユニオンジャック)を参考に独自にSVGを作成したものです。

The MIT License (MIT)

Copyright (c) 2013 Panayiotis Lipiridis

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## assets/vendor/globe.gl.min.js (世界地図モードの3D地球儀ライブラリ)

`assets/vendor/globe.gl.min.js` は [globe.gl](https://github.com/vasturiano/globe.gl)
(作者: Vasco Asturiano)を利用しています。MITライセンスに基づき配布しています。

MIT License

Copyright (c) 2019 Vasco Asturiano

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## assets/map/world-countries.geojson (世界地図の国境データ)

`assets/map/world-countries.geojson` は [Natural Earth](https://www.naturalearthdata.com/)
の1:50,000,000(1:50m)国境データを加工して使用しています。Natural Earthの公式サイトが明言している
とおり、このデータはパブリックドメインであり、著作権表示なしに自由に利用・改変できます。
(出典: https://www.naturalearthdata.com/about/terms-of-use/ )

加工内容: 不要な属性(NAME・ISO_A3・ADM0_A3以外)の削除、座標の間引きによる軽量化、
南極大陸(Antarctica)の除外を行っています。
