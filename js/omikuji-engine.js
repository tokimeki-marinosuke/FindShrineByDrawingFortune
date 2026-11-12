/* Final outcome is drawn once. Presentation never redraws it. */
(function (root) {
  "use strict";
  const omikuji = ["大吉", "中吉", "吉", "末吉", "凶"];

  const shrineData = {
    大吉: {
      name: "明治神宮",
      page: "shrine/meiji.html",
      detail: "introduction-shrines/meiji2.html",
      area: "東京・原宿",
      blessings: Object.freeze(["家内安全", "学業成就", "心願成就"]),
      image: "img/meiji.jpg",
      desc: "東京・原宿にある格式高い神社。初詣参拝者数日本一！",
    },
    中吉: {
      name: "伏見稲荷大社",
      page: "shrine/fushimi.html",
      detail: "introduction-shrines/fushimi2.html",
      area: "京都・伏見",
      blessings: Object.freeze(["商売繁盛", "五穀豊穣", "家内安全"]),
      image: "img/fushimi.jpg",
      desc: "京都の千本鳥居で有名な神社。商売繁盛の神様！",
    },
    吉: {
      name: "住吉大社",
      page: "shrine/sumiyoshi.html",
      detail: "introduction-shrines/sumiyoshi2.html",
      area: "大阪・住吉",
      blessings: Object.freeze(["航海安全", "交通安全", "厄除け"]),
      image: "img/sumiyoshi.jpg",
      desc: "大阪にある住吉大社。海上守護・厄除けで有名。",
    },
    末吉: {
      name: "川越氷川神社",
      page: "shrine/kawagoe.html",
      detail: "introduction-shrines/kawagoe2.html",
      area: "埼玉・川越",
      blessings: Object.freeze(["縁結び", "家内安全", "安産祈願"]),
      image: "img/kawagoe.jpg",
      desc: "埼玉・川越の縁結び神社。風鈴イベントも人気！",
    },
    凶: {
      name: "鷲神社",
      page: "shrine/washi.html",
      detail: "introduction-shrines/washi2.html",
      area: "東京・浅草",
      blessings: Object.freeze(["開運招福", "商売繁盛", "家内安全"]),
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
  // Notice weights per fortune: swarm, stepup, serif; the remainder is no notice.
  const noticeWeights = [
    [0.35, 0.3, 0.25],
    [0.2, 0.3, 0.3],
    [0.08, 0.3, 0.3],
    [0.03, 0.25, 0.3],
    [0.01, 0.2, 0.3],
  ];
  function pickWeighted(value, weights) {
    let total = 0;
    for (const [i, weight] of weights.entries()) {
      total += weight;
      if (value < total) return ["swarm", "stepup", "serif"][i];
    }
    return "none";
  }
  // White, blue, green, red, gold: hotter colours lean towards better fortunes.
  const serifLines = [
    "なにか起きそう…？",
    "チャンスかも！",
    "これは来てるぞ！",
    "激アツじゃ！！",
    "神様が微笑んでおる…！",
  ];
  const spReaches = {
    senbon: { label: "千本鳥居リーチ", text: "千本鳥居を駆け抜けろ" },
    tobira: { label: "天の扉リーチ", text: "天の扉、開くか" },
    sakura: { label: "桜吹雪リーチ", text: "桜吹雪の奇跡" },
  };
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
    // Pattern choices draw after the original ones so seeded plans stay stable.
    const notice = pickWeighted(random(), noticeWeights[index]);
    const stepLevel =
      notice === "stepup"
        ? 1 + Math.floor(random() * [5, 4.4, 3.6, 3, 2.5][index])
        : 0;
    const serifColor =
      notice === "serif"
        ? Math.floor(random() * [5, 4.5, 3.5, 2.6, 2][index])
        : 0;
    // Low fortunes can still develop into an SP reach now and then.
    const sp = strong || random() < [0, 0, 0.3, 0.15, 0.08][index];
    const variant = sp
      ? ["senbon", "tobira", "sakura"][Math.floor(random() * 3)]
      : null;
    const push = sp && random() < [0.85, 0.6, 0.35, 0.25, 0.2][index];
    const steps = [
      { state: "spin", label: "変動開始", text: "運命が、動き出す", ms: 2200 },
    ];
    if (early)
      steps.push({
        state: "early",
        label: "先バレ",
        text: "開運接近",
        ms: 1700,
      });
    for (let n = 1; n <= tier; n++)
      steps.push({
        state: "charge",
        label: "保留変化",
        text: ["白", "青", "緑", "赤", "金", "虹"][n] + "の神気",
        tier: n,
        ms: 700,
      });
    for (let n = 1; n <= stepLevel; n++)
      steps.push({
        state: "stepup",
        label: "ステップアップ予告",
        text: n === 5 ? "STEP 5・最終段階" : "STEP " + n,
        step: n,
        ms: n === stepLevel ? 1400 : 750,
      });
    if (notice === "serif")
      steps.push({
        state: "serif",
        label: "セリフ予告",
        text: serifLines[serifColor],
        color: serifColor,
        ms: 2400,
      });
    if (notice === "swarm")
      steps.push({
        state: "swarm",
        label: "福群予告",
        text: "福が押し寄せる！",
        ms: 2400,
      });
    for (let n = 1; n <= repeats; n++) {
      steps.push({
        state: "pause",
        label: "擬似連続予告",
        text: "……",
        ms: 600,
      });
      steps.push({
        state: "repeat",
        label: "擬似連続予告",
        text: n === 3 ? "三連・神域突入" : "継続 × " + n,
        repeat: n,
        ms: 1500,
      });
    }
    steps.push({
      state: "reach",
      label: "リーチ",
      text: "リーチ・祈りの刻",
      ms: sp ? 3000 : 4200,
    });
    if (sp) {
      steps.push({
        state: "develop",
        label: "SPリーチ発展",
        text: "発展！",
        ms: 1500,
      });
      steps.push({
        state: "strong-reach",
        label: spReaches[variant].label,
        text: spReaches[variant].text,
        variant,
        ms: 5600,
      });
    }
    if (hot)
      steps.push({
        state: "hot",
        label: "チャンスアップ",
        text: "神託発動・激熱",
        ms: 2200,
      });
    if (push)
      steps.push({
        state: "push",
        label: "最終決戦",
        text: "ボタンを押せ！",
        ms: 3200,
      });
    if (revival) {
      steps.push({
        state: "provisional",
        label: "演出中・まだ確定ではありません",
        text: "仮の運勢：末吉……？",
        ms: 2000,
      });
      steps.push({
        state: "blackout",
        label: "……",
        text: "まだ終わらない……",
        ms: 2000,
      });
      steps.push({
        state: "revival",
        label: "復活",
        text: "運命開花",
        ms: 2000,
      });
    }
    if (fortune === "大吉")
      steps.push({
        state: "fever",
        label: "大当り",
        text: "大吉フィーバー",
        ms: 3800,
      });
    const scale = { short: 0.5, standard: 1, long: 1.35 }[settings.duration];
    return Object.freeze({
      fortune,
      shrine: Object.freeze({ ...shrineData[fortune] }),
      tier,
      early,
      hot,
      revival,
      repeats,
      notice,
      sp,
      variant,
      push,
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
