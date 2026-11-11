/* Final outcome is drawn once. Presentation never redraws it. */
(function (root) {
  "use strict";
  const omikuji = ["大吉", "中吉", "吉", "末吉", "凶"];

  const shrineData = {
    大吉: {
      name: "明治神宮",
      page: "shrine/meiji.html",
      image: "img/meiji.jpg",
      desc: "東京・原宿にある格式高い神社。初詣参拝者数日本一！",
    },
    中吉: {
      name: "伏見稲荷大社",
      page: "shrine/fushimi.html",
      image: "img/fushimi.jpg",
      desc: "京都の千本鳥居で有名な神社。商売繁盛の神様！",
    },
    吉: {
      name: "住吉大社",
      page: "shrine/sumiyoshi.html",
      image: "img/sumiyoshi.jpg",
      desc: "大阪にある住吉大社。海上守護・厄除けで有名。",
    },
    末吉: {
      name: "川越氷川神社",
      page: "shrine/kawagoe.html",
      image: "img/kawagoe.jpg",
      desc: "埼玉・川越の縁結び神社。風鈴イベントも人気！",
    },
    凶: {
      name: "鷲神社",
      page: "shrine/washi.html",
      image: "img/washi.jpg",
      desc: "東京・浅草の開運神社。酉の市で熊手が有名。",
    },
  };

  const defaults = Object.freeze({
    early: "standard",
    duration: "standard",
    shake: true,
    reduced: false,
    skip: true,
  });
  function normalizeSettings(value = {}) {
    if (!value || typeof value !== "object") value = {};
    return {
      early: ["off", "standard", "often"].includes(value.early)
        ? value.early
        : defaults.early,
      duration: ["short", "standard", "long"].includes(value.duration)
        ? value.duration
        : defaults.duration,
      shake: typeof value.shake === "boolean" ? value.shake : defaults.shake,
      reduced:
        typeof value.reduced === "boolean" ? value.reduced : defaults.reduced,
      skip: typeof value.skip === "boolean" ? value.skip : defaults.skip,
    };
  }
  function createDraw(settings = defaults, random = Math.random) {
    settings = normalizeSettings(settings);
    const index = Math.floor(random() * omikuji.length);
    const fortune = omikuji[index];
    // These probabilities affect only presentation. Each fortune remains 20%.
    const earlyRate =
      settings.early === "off"
        ? 0
        : (settings.early === "often"
            ? [0.9, 0.7, 0.35, 0.15, 0.08]
            : [0.65, 0.4, 0.15, 0.05, 0.02])[index];
    const early = random() < earlyRate;
    const hot = random() < [0.8, 0.5, 0.2, 0.06, 0.02][index];
    const revival = index < 2 && random() < 0.25;
    const repeats = Math.floor(random() * (index < 2 ? 4 : 3));
    // Monotonic tiers: white/blue/green/red/gold/rainbow. Rainbow is exclusive to daikichi.
    const tier =
      index === 0 ? (random() < 0.5 ? 5 : 4) : [0, 4, 3, 2, 1][index];
    const strong = index < 2 || hot || repeats === 3;
    const steps = [{ state: "spin", text: "運命が、動き出す", ms: 1100 }];
    if (early) steps.push({ state: "early", text: "開運接近", ms: 1000 });
    for (let n = 1; n <= tier; n++)
      steps.push({
        state: "charge",
        text: ["白", "青", "緑", "赤", "金", "虹"][n] + "の神気",
        tier: n,
        ms: 420,
      });
    for (let n = 1; n <= repeats; n++) {
      steps.push({ state: "pause", text: "……", ms: 300 });
      steps.push({
        state: "repeat",
        text: n === 3 ? "三連・神域突入" : "継続 × " + n,
        repeat: n,
        ms: 850,
      });
    }
    steps.push({
      state: strong ? "strong-reach" : "reach",
      text: strong ? "強リーチ・天の扉" : "リーチ・祈りの刻",
      ms: 1500,
    });
    if (hot) steps.push({ state: "hot", text: "神託発動・激熱", ms: 1200 });
    if (revival) {
      steps.push({ state: "provisional", text: "仮の運勢：末吉……？", ms: 900 });
      steps.push({ state: "blackout", text: "まだ終わらない……", ms: 1100 });
      steps.push({ state: "revival", text: "運命開花", ms: 900 });
    }
    if (fortune === "大吉")
      steps.push({ state: "fever", text: "大吉フィーバー", ms: 2000 });
    const scale = { short: 0.55, standard: 1, long: 1.6 }[settings.duration];
    return Object.freeze({
      fortune,
      shrine: Object.freeze({ ...shrineData[fortune] }),
      tier,
      early,
      hot,
      revival,
      repeats,
      steps: Object.freeze(
        steps.map((step) =>
          Object.freeze({ ...step, ms: Math.round(step.ms * scale) }),
        ),
      ),
    });
  }
  const engine = {
    omikuji: Object.freeze(omikuji),
    defaults,
    normalizeSettings,
    createDraw,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = engine;
  else root.OmikujiEngine = engine;
})(typeof window !== "undefined" ? window : globalThis);
