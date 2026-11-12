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
  // Presentation scripts per fortune. Weights shape only the show; the fortune is already fixed.
  // 大吉〜末吉 end with the reels lined up (当たり); 凶 is the ハズレ and never lines up.
  const scenarios = Object.freeze([
    Object.freeze([
      ["puchun", 0.12],
      ["kokuchi", 0.1],
      ["royal", 0.26],
      ["kecchi", 0.2],
      ["revival", 0.17],
      ["upgrade", 0.15],
    ]),
    Object.freeze([
      ["normal", 0.1],
      ["notice", 0.15],
      ["sp", 0.3],
      ["kecchi", 0.15],
      ["revival", 0.15],
      ["upgrade", 0.15],
    ]),
    Object.freeze([
      ["normal", 0.25],
      ["notice", 0.25],
      ["sp", 0.2],
      ["kecchi", 0.15],
      ["revival", 0.1],
      ["upgrade", 0.05],
    ]),
    Object.freeze([
      ["normal", 0.45],
      ["notice", 0.25],
      ["sp", 0.15],
      ["kecchi", 0.15],
    ]),
    Object.freeze([
      ["quick", 0.45],
      ["reach-miss", 0.3],
      ["sp-miss", 0.17],
      ["pseudo-miss", 0.08],
    ]),
  ]);
  function pickScenario(value, table) {
    let total = 0;
    for (const [name, weight] of table) {
      total += weight;
      if (value < total) return name;
    }
    return table[table.length - 1][0];
  }
  // White, blue, green, red, gold: hotter colours lean towards better fortunes.
  const serifLines = [
    "なにか起きそう…？",
    "チャンスかも！",
    "これは来てるぞ！",
    "激アツじゃ！！",
    "神様が微笑んでおる…！",
  ];
  const holdNames = ["白", "青", "緑", "赤", "金", "虹"];
  const spReaches = {
    senbon: { label: "千本鳥居リーチ", text: "千本鳥居を駆け抜けろ", cutin: "千本鳥居" },
    tobira: { label: "天の扉リーチ", text: "天の扉、開くか", cutin: "天の扉" },
    sakura: { label: "桜吹雪リーチ", text: "桜吹雪の奇跡", cutin: "桜吹雪" },
  };
  // How hot notices may get, per fortune.
  const heats = [0.9, 0.7, 0.5, 0.35, 0.25];
  function createDraw(settings = defaults, random = Math.random) {
    settings = normalizeSettings(settings);
    const index = Math.floor(random() * omikuji.length);
    const fortune = omikuji[index];
    const scenario = pickScenario(random(), scenarios[index]);
    const hit = index < 4;
    const heat = heats[index];
    // These probabilities affect only presentation. Each fortune remains 20%.
    const earlyRate =
      settings.early === "off"
        ? 0
        : (settings.early === "often"
            ? [0.9, 0.7, 0.35, 0.15, 0.08]
            : [0.65, 0.4, 0.15, 0.05, 0.02])[index];
    const chance = (p) => random() < p;
    const between = (low, high) =>
      low + Math.floor(random() * (high - low + 1));
    const steps = [];
    const add = (state, label, text, ms, extra) =>
      steps.push({ state, label, text, ms, ...extra });
    let early = false;
    let tier = 0;
    // A neighbouring symbol: what the center reel shows when a reach misses.
    const beside = (symbol) =>
      symbol === 0 ? 1 : symbol === 4 || chance(0.5) ? symbol - 1 : symbol + 1;

    function opening(ms = 2200) {
      add("spin", "変動開始", "運命が、動き出す", ms);
      if (chance(earlyRate)) {
        early = true;
        add("early", "先バレ", "開運接近", 1700, { cutin: "先バレ" });
      }
    }
    function hold(next, late) {
      if (next <= tier) return;
      tier = next;
      add(
        "hold",
        late ? "当該保留変化" : "保留変化",
        next === 5 ? "虹保留・確定！" : holdNames[next] + "保留",
        next >= 4 ? 1700 : 1100,
        { tier: next, cutin: next === 5 ? "確定" : null },
      );
    }
    // Opening hold changes stop at green, so the first seconds never give the fortune away.
    function earlyHold() {
      if (chance([0.35, 0.3, 0.25, 0.2, 0.15][index]))
        hold(chance(0.4) ? 2 : 1, false);
    }
    // Rainbow exists only for 大吉 and only here, after the reach has started.
    function lateHold() {
      const r = random();
      const next = [
        r < 0.55 ? 5 : 4,
        r < 0.5 ? 4 : 3,
        r < 0.15 ? 4 : r < 0.65 ? 3 : 2,
        r < 0.3 ? 3 : 2,
        r < 0.04 ? 4 : r < 0.3 ? 3 : r < 0.7 ? 2 : 1,
      ][index];
      hold(next, true);
    }
    const level = (warmth) =>
      Math.min(4, Math.floor(random() * (1 + 4 * warmth)));
    function notice(warmth) {
      const kind = random();
      if (kind < 0.45) {
        const color = level(warmth);
        add("serif", "セリフ予告", serifLines[color], 2400, { color });
      } else if (kind < 0.8 || warmth < 0.6) {
        const top = 1 + level(warmth);
        for (let n = 1; n <= top; n++)
          add(
            "stepup",
            "ステップアップ予告",
            n === 5 ? "STEP 5・最終段階" : "STEP " + n,
            n === top ? 1400 : 750,
            { step: n },
          );
      } else {
        add("swarm", "福群予告", "福が押し寄せる！", 2400, { cutin: "福群" });
      }
    }
    function pseudo(count) {
      for (let n = 1; n <= count; n++) {
        add("pause", "擬似連続予告", "……", 600);
        add(
          "repeat",
          "擬似連続予告",
          n === 3 ? "三連・神域突入" : "継続 × " + n,
          1500,
          { repeat: n, cutin: "擬似 " + (n + 1) },
        );
      }
    }
    function reach(symbol, ms) {
      add("reach", "リーチ", omikuji[symbol] + "リーチ！", ms, {
        symbol,
        cutin: "リーチ",
      });
    }
    function spReach() {
      const variant = ["senbon", "tobira", "sakura"][between(0, 2)];
      const sp = spReaches[variant];
      add("develop", "SPリーチ発展", "発展！", 1500, { cutin: "発展" });
      add("strong-reach", sp.label, sp.text, 5600, {
        variant,
        cutin: sp.cutin,
      });
    }
    const hot = () =>
      add("hot", "チャンスアップ", "神託発動・激熱", 2200, { cutin: "激熱" });
    const push = () => add("push", "最終決戦", "ボタンを押せ！", 3200);

    let reels = [index, index, index];
    // Every hit lines up on its own symbol; misses reach on any hit symbol.
    const missSymbol = () => between(0, 3);
    switch (scenario) {
      case "quick": {
        opening(2400);
        if (chance(0.3)) notice(0.1);
        const left = between(0, 4);
        reels = [left, between(0, 4), (left + between(1, 4)) % 5];
        break;
      }
      case "reach-miss": {
        opening();
        earlyHold();
        if (chance(0.4)) notice(0.3);
        const symbol = missSymbol();
        reach(symbol, 4600);
        reels = [symbol, beside(symbol), symbol];
        break;
      }
      case "sp-miss": {
        opening();
        earlyHold();
        notice(0.5);
        if (chance(0.3)) pseudo(1);
        const symbol = missSymbol();
        reach(symbol, 3000);
        spReach();
        if (chance(0.15)) hot();
        if (chance(0.5)) lateHold();
        if (chance(0.4)) push();
        reels = [symbol, beside(symbol), symbol];
        break;
      }
      case "pseudo-miss": {
        opening();
        pseudo(between(1, 2));
        const symbol = missSymbol();
        reach(symbol, 3200);
        if (chance(0.5)) spReach();
        reels = [symbol, beside(symbol), symbol];
        break;
      }
      case "normal":
        opening();
        earlyHold();
        reach(index, 4600);
        if (chance(0.3)) lateHold();
        break;
      case "notice":
        opening();
        earlyHold();
        notice(heat);
        if (chance(0.35)) pseudo(1);
        reach(index, 4200);
        if (chance(0.4)) lateHold();
        break;
      case "sp":
        opening();
        earlyHold();
        if (chance(0.6)) notice(heat);
        if (chance(0.4)) pseudo(between(1, 3));
        reach(index, 3000);
        spReach();
        if (chance(heat * 0.8)) hot();
        lateHold();
        if (chance(0.5)) push();
        break;
      case "kecchi":
        // Plain start, then it keeps climbing after the reach.
        opening(2600);
        if (chance(0.6)) notice(0.1);
        reach(index, 4600);
        add("chance", "チャンスアップ", "まだ終わらない！", 1600, {
          cutin: "まだだ",
        });
        spReach();
        hold(index === 3 ? 2 : 3, true);
        lateHold();
        if (index <= 1) hot();
        if (chance(0.7)) push();
        break;
      case "revival":
        opening();
        earlyHold();
        if (chance(0.6)) notice(heat * 0.7);
        reach(index, 3200);
        if (chance(0.6)) spReach();
        add("provisional", "……", "ハズレ……？", 2000, { symbol: beside(index) });
        add("blackout", "……", "まだ終わらない……", 2000);
        add("revival", "復活", "運命開花", 2000, { cutin: "復活" });
        if (index === 0) lateHold();
        break;
      case "upgrade": {
        const base = index + between(1, Math.min(2, 3 - index));
        opening();
        earlyHold();
        if (chance(0.5)) notice(heat * 0.6);
        reach(base, 3600);
        if (chance(0.3)) spReach();
        add("settle", "当たり", omikuji[base] + "で決着……？", 2200, {
          symbol: base,
        });
        add("upgrade", "昇格チャンス", "まだ上がある！", 2400, {
          cutin: "昇格",
        });
        if (index === 0) lateHold();
        if (chance(0.4)) push();
        break;
      }
      case "royal":
        opening();
        earlyHold();
        notice(0.9);
        pseudo(between(1, 3));
        reach(0, 3000);
        spReach();
        hot();
        lateHold();
        push();
        break;
      case "kokuchi":
        // Sudden notification: no reach, the reels just snap to 大吉.
        opening(between(1800, 3000));
        add("kokuchi", "一発告知", "神託、降臨", 1800, { cutin: "神" });
        tier = 5;
        break;
      case "puchun":
        // Power-cut freeze in the first second, then all three reels roll as 大吉.
        add("spin", "変動開始", "運命が、動き出す", 700);
        add("puchun", "", "", 2600);
        add("zenkaiten", "全回転", "大吉全回転", 4400, { cutin: "全回転" });
        tier = 5;
        break;
    }
    if (fortune === "大吉")
      add("fever", "大当り", "大吉フィーバー", 3800, { cutin: "大当り" });
    const scale = { short: 0.5, standard: 1, long: 1.35 }[settings.duration];
    return Object.freeze({
      fortune,
      shrine: Object.freeze({ ...shrineData[fortune] }),
      scenario,
      hit,
      reels: Object.freeze(reels),
      tier,
      early,
      steps: Object.freeze(
        steps.map((step) =>
          Object.freeze({ ...step, ms: Math.round(step.ms * scale) }),
        ),
      ),
    });
  }
  const engine = {
    omikuji: Object.freeze(omikuji),
    scenarios,
    defaults,
    normalizeSettings,
    createDraw,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = engine;
  else root.OmikujiEngine = engine;
})(typeof window !== "undefined" ? window : globalThis);
