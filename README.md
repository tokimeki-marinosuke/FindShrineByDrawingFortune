# FindShrineByDrawingFortune
- 1 You can find recommended shrines by drawing omikuji.
- 2 You can also find recomemended shrines by list organized by us.
- 3 Enjoy picture and omikuji, to find the best of trip.
[web-site](https://tokimeki-marinosuke.github.io/FindShrineByDrawingFortune/)
[omikuji](https://tokimeki-marinosuke.github.io/FindShrineByDrawingFortune/omikuji.html)

## 開運フィーバーの開発・確認

フレームワークや追加の実行時ライブラリは不要です。

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

`omikuji.html` が抽選画面です。`js/omikuji-engine.js` が運勢（各20%）と神社、演出計画を抽選開始時に確定し、`js/index.js` が計画を再生します。先バレ・激熱などの確率は運勢別に設定され、演出設定は運勢の抽選に影響しません。保留の最終色は、凶＝青、末吉＝緑、吉＝赤、中吉＝金、大吉＝金または虹です。復活前の運勢は仮表示であり再抽選ではありません。

演出カスタムは端末の localStorage に保存されます。読み書きできない環境でも抽選できます。OS の動きを減らす設定も尊重し、軽減時は振動・連続アニメーション・粒子を停止します。音声機能はありません。途中で再読み込みした場合は待機画面へ戻ります。

```sh
node --test tests/omikuji-engine.test.js
# サーバー起動後。Playwright と Chromium が利用可能な開発環境で実行
node tests/browser-smoke.cjs
```

ブラウザーテストは `/usr/bin/chromium` を使い、390px／1440px の画面、通常・特殊演出、全運勢のスキップ、設定保存、軽減、連打防止、再読み込みを検証します。スクリーンショットは `/tmp/fever-*.png` に出力します。外部フォントを遮断しても基本機能が動作することを確認します。
