/* Shows the drawn fortune passed as ?result=… on a shrine page. */
(() => {
  "use strict";
  const messages = {
    大吉: "最高の運気！感謝を伝えに参拝しよう",
    中吉: "良い流れが来ています。勢いに乗って出かけよう",
    吉: "穏やかな幸運が続きそう。ゆっくりお参りを",
    末吉: "これから運気上昇の兆し。ご縁を結びに行こう",
    凶: "厄を払って運気を呼び込むチャンス",
  };
  const result = new URLSearchParams(window.location.search).get("result");
  // Only known fortunes are shown; anything else keeps the plain shrine page.
  if (!Object.hasOwn(messages, result)) return;
  const slip = document.getElementById("omikuji-result");
  slip.querySelector("strong").textContent = result;
  slip.dataset.fortune = result;
  slip.hidden = false;
  document.querySelector(".message").textContent = messages[result];
})();
