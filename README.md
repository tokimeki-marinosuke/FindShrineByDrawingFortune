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

`omikuji.html` が抽選画面です。`js/omikuji-engine.js` が運勢（各20%）と神社、演出計画を抽選開始時に確定し、`js/index.js` が計画を再生します。先バレ・激熱などの確率は運勢別に設定され、演出設定は運勢の抽選に影響しません。大吉〜末吉は図柄が揃う「当たり」、凶は揃わない「ハズレ」です。保留は序盤では緑までしか変化せず、虹保留（大吉確定）はリーチ後の当該保留変化でのみ出ます。復活・昇格前の表示は演出であり再抽選ではありません。

演出は運勢ごとの台本から抽選されます。凶は即ハズレ・リーチハズレ・ガセSP・擬似連ハズレ、末吉〜中吉は通常リーチ・予告あり・SPリーチ・ケツ上がり・復活・昇格、大吉はぷちゅん（フリーズ）→全回転・一発告知・王道・ケツ上がり・復活・昇格です。予告（先バレ・保留変化・ステップアップ・セリフ・福群・擬似連）、SPリーチ（千本鳥居／天の扉／桜吹雪）、激熱、最終決戦（PUSH ボタン）は台本内でさらに抽選され、標準設定で約2〜37秒です。画面上部の札に現在の演出名を表示します。PUSH ボタンは待ち時間を短縮するだけで結果には影響しません。結果後は神社カードを表示し、6秒後に `shrine/*.html` の神社紹介へ移動します。

演出カスタムは端末の localStorage に保存されます。読み書きできない環境でも抽選できます。OS の動きを減らす設定も尊重し、軽減時は振動・連続アニメーション・粒子を停止します。音声機能はありません。途中で再読み込みした場合は待機画面へ戻ります。

```sh
node --test tests/omikuji-engine.test.js
# サーバー起動後。Playwright と Chromium が利用可能な開発環境で実行
node tests/browser-smoke.cjs
```

ブラウザーテストは `/usr/bin/chromium` を使い、390px／1440px の画面、通常・特殊演出、全運勢のスキップ、設定保存、軽減、連打防止、再読み込みを検証します。スクリーンショットは `/tmp/fever-*.png` に出力します。外部フォントを遮断しても基本機能が動作することを確認します。
