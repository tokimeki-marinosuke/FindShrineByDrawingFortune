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
      ["puchun", 0.14],
      ["kokuchi", 0.12],
      ["royal", 0.28],
      ["kecchi", 0.24],
      ["revival", 0.22],
    ]),
    Object.freeze([
      ["normal", 0.15],
      ["notice", 0.2],
      ["sp", 0.3],
      ["kecchi", 0.17],
      ["revival", 0.18],
    ]),
    Object.freeze([
      ["normal", 0.25],
      ["notice", 0.25],
      ["sp", 0.22],
      ["kecchi", 0.16],
      ["revival", 0.12],
    ]),
    Object.freeze([
      ["normal", 0.45],
      ["notice", 0.28],
      ["sp", 0.14],
      ["kecchi", 0.13],
    ]),
    Object.freeze([
      ["quick", 0.4],
      ["reach-miss", 0.25],
      ["sp-miss", 0.27],
      ["pseudo-miss", 0.08],
    ]),
  ]);
  // 図柄昇格 is a layer on top of any hit script (not 一発告知 / ぷちゅん):
  // [climb, fail] rates per fortune. climb reaches on a lower fortune and is
  // promoted to the real one; fail offers a chance that does not come off.
  const promotions = Object.freeze([
    Object.freeze([0.3, 0]),
    Object.freeze([0.28, 0.12]),
    Object.freeze([0.2, 0.12]),
    Object.freeze([0, 0.15]),
    Object.freeze([0, 0]),
  ]);
  const premiums = ["puchun", "kokuchi"];
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
  // Each SP reach states its mission up front; the mission's outcome is the reach's outcome.
  const spReaches = {
    senbon: {
      label: "千本鳥居リーチ",
      mission: "千本鳥居を最後まで駆け抜けろ！",
      cutin: "千本鳥居",
      tease: "鳥居の先に、光が……",
      brink: "出口の光が、目の前に……！",
      win: ["突破", "出口の光を抜けた！"],
      lose: "鳥居の途中で力尽きた……",
    },
    tobira: {
      label: "天の扉リーチ",
      mission: "天の扉をこじ開けろ！",
      cutin: "天の扉",
      tease: "扉がきしんでいる……",
      brink: "扉が……少しだけ……！",
      win: ["開門", "天の扉、開門！"],
      lose: "扉は固く閉ざされた……",
    },
    sakura: {
      label: "桜吹雪リーチ",
      mission: "桜を満開に咲かせろ！",
      cutin: "桜吹雪",
      tease: "つぼみが色づいてきた……",
      brink: "つぼみが……ほころぶ……！",
      win: ["満開", "桜、満開！"],
      lose: "花は散ってしまった……",
    },
  };
  // 期待度★ shown at the start of an SP reach, per fortune: chances of ★1〜★5.
  // ★5 never appears on 凶, so it is a sure hit; ★1 is almost always a miss.
  const starOdds = [
    [0, 0, 0.1, 0.3, 0.6],
    [0, 0.05, 0.3, 0.45, 0.2],
    [0, 0.1, 0.4, 0.4, 0.1],
    [0.05, 0.25, 0.45, 0.25, 0],
    [0.3, 0.3, 0.28, 0.12, 0],
  ];
  // How hot notices may get, per fortune.
  const heats = [0.9, 0.7, 0.5, 0.35, 0.25];
  function createDraw(settings = defaults, random = Math.random) {
    settings = normalizeSettings(settings);
    const index = Math.floor(random() * omikuji.length);
    const fortune = omikuji[index];
    const scenario = pickScenario(random(), scenarios[index]);
    // The third value always decides the promotion layer, so tools can force it.
    const promoRoll = random();
    const [climbRate, failRate] = promotions[index];
    const promotion = premiums.includes(scenario)
      ? "none"
      : promoRoll < climbRate
        ? "climb"
        : promoRoll < climbRate + failRate
          ? "fail"
          : "none";
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
    // While an SP reach runs, every step carries its current 期待度★.
    let stars = 0;
    let spPhase = null;
    const add = (state, label, text, ms, extra) =>
      steps.push({
        state,
        label,
        text,
        ms,
        ...(stars ? { stars, spPhase } : {}),
        ...extra,
      });
    let early = false;
    let tier = 0;
    // A neighbouring symbol: what the center reel shows when a reach misses.
    const beside = (symbol) =>
      symbol === 0 ? 1 : symbol === 4 || chance(0.5) ? symbol - 1 : symbol + 1;

    function opening(ms = 2200) {
      add("spin", "変動開始", "運命が、動き出す", ms);
      if (chance(earlyRate)) {
        early = true;
        add("early", "先バレ", "開運接近", 2000, { cutin: "先バレ" });
      }
    }
    function hold(next, late) {
      if (next <= tier) return;
      tier = next;
      add(
        "hold",
        late ? "当該保留変化" : "保留変化",
        next === 5 ? "虹保留・確定！" : holdNames[next] + "保留",
        next >= 4 ? 2000 : 1500,
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
      // A rainbow before a 中吉 line would spoil the promotion that follows.
      hold(promotion === "climb" ? Math.min(next, 4) : next, true);
    }
    const level = (warmth) =>
      Math.min(4, Math.floor(random() * (1 + 4 * warmth)));
    function notice(warmth) {
      const kind = random();
      if (kind < 0.45) {
        const color = level(warmth);
        add("serif", "セリフ予告", serifLines[color], 3000, {
          color,
          outro: true,
        });
      } else if (kind < 0.8 || warmth < 0.6) {
        const top = 1 + level(warmth);
        for (let n = 1; n <= top; n++)
          add(
            "stepup",
            "ステップアップ予告",
            n === 5 ? "STEP 5・最終段階" : "STEP " + n,
            n === top ? 2000 : 1100,
            // Only the final panel bows out; the earlier ones hand over to the next STEP.
            { step: n, ...(n === top ? { outro: true } : {}) },
          );
      } else {
        add("swarm", "福群予告", "福が押し寄せる！", 3600, {
          cutin: "福群",
          outro: true,
        });
      }
    }
    function pseudo(count) {
      for (let n = 1; n <= count; n++) {
        add("pause", "擬似連続予告", "……", 800);
        add(
          "repeat",
          "擬似連続予告",
          n === 3 ? "三連・神域突入" : "継続 × " + n,
          1900,
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
    let spVariant = null;
    function spReach() {
      const variant = ["senbon", "tobira", "sakura"][between(0, 2)];
      const sp = spReaches[variant];
      add("develop", "SPリーチ発展", "発展！", 2000, { cutin: "発展" });
      const odds = starOdds[index];
      const r = random();
      let sum = 0;
      const picked = odds.findIndex((odd) => r < (sum += odd));
      // Rounding can leave r just past the total: fall back to the top possible ★.
      stars = 1 + (picked >= 0 ? picked : odds.findLastIndex((odd) => odd > 0));
      spVariant = variant;
      spPhase = "intro";
      add("strong-reach", sp.label, sp.mission, 4800, {
        variant,
        cutin: sp.cutin,
      });
      spPhase = "tease";
      add("sp-tease", sp.label, sp.tease, 3400);
    }
    // The moment before the outcome: the door opens a crack, the light is right there.
    function spBrink() {
      if (spPhase !== "tease") return;
      spPhase = "brink";
      add("sp-brink", "運命の分かれ目", spReaches[spVariant].brink, 2600);
    }
    // ため: a slow-motion beat right before any outcome is shown.
    const decide = (ms = 1500) => add("decide", null, "……", ms);
    // Settles the SP mission; a hit wins it, a miss (or a revival-to-be) loses it.
    function spOutcome(win) {
      if (!spVariant) return;
      spBrink();
      decide();
      const sp = spReaches[spVariant];
      spPhase = "result";
      add(
        "sp-result",
        win ? "ミッション成功" : "ミッション失敗",
        win ? sp.win[1] : sp.lose,
        2400,
        { success: win, cutin: win ? sp.win[0] : null },
      );
      stars = 0;
      spPhase = null;
      spVariant = null;
    }
    // 激熱 during an SP raises the 期待度 by one; ★5 stays reserved for hits.
    const hot = () => {
      if (stars) stars = Math.min(stars + 1, hit ? 5 : 4);
      add("hot", "チャンスアップ", "神託発動・激熱", 2200, { cutin: "激熱" });
    };
    const push = () => {
      if (promotion !== "none") return;
      spBrink();
      add("push", "最終決戦", "ボタンを押せ！", 3200, { press: "決" });
    };
    // 図柄昇格: line up on a lower fortune, then climb one PUSH chance at a time.
    // With from === to the single chance fails, so a chance is never a sure thing.
    // At most two climbs, e.g. 末吉→中吉→大吉.
    function promote(from, to) {
      add("settle", "当たり", omikuji[from] + "で当たり！", 2000, {
        symbol: from,
      });
      let at = from;
      do {
        const next =
          at === to ? at : at - between(Math.max(1, at - to - 1), at - to);
        add(
          "promote-chance",
          "図柄昇格チャンス",
          omikuji[at] + "から昇格なるか！？",
          1800,
          { cutin: "昇格？" },
        );
        add("push", "図柄昇格チャンス", "PUSHで昇格！", 3000, { press: "昇" });
        add("promote-roll", "図柄昇格チャンス", "……！", 2200);
        decide(1300);
        if (next === at)
          add("promote-fail", "昇格ならず", omikuji[at] + "で決着", 2000);
        else
          add("promote", "図柄昇格", omikuji[next] + "に昇格！", 2000, {
            symbol: next,
            cutin: "昇格",
          });
        at = next;
      } while (at !== to);
    }

    let reels = [index, index, index];
    // Hits finish on their own symbol, but a climbing hit reaches on a lower one first.
    const line =
      promotion === "climb" ? index + between(1, 3 - index) : index;
    // 凶 never reaches on 大吉: that would promise more than a miss can keep.
    const missSymbol = () => between(1, 3);
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
        reach(line, 4600);
        if (chance(0.3)) lateHold();
        break;
      case "notice":
        opening();
        earlyHold();
        notice(heat);
        if (chance(0.35)) pseudo(1);
        reach(line, 4200);
        if (chance(0.4)) lateHold();
        break;
      case "sp":
        opening();
        earlyHold();
        if (chance(0.6)) notice(heat);
        if (chance(0.4)) pseudo(between(1, 3));
        reach(line, 3000);
        spReach();
        if (chance(heat * 0.8)) hot();
        lateHold();
        if (chance(0.5)) push();
        break;
      case "kecchi":
        // Plain start, then it keeps climbing after the reach.
        opening(2600);
        if (chance(0.6)) notice(0.1);
        reach(line, 4600);
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
        // Revival plus a promotion is long enough without a notice up front.
        if (promotion === "none" && chance(0.6)) notice(heat * 0.7);
        reach(line, 3200);
        if (chance(0.6)) spReach();
        // The fake miss is an outcome too: hold the beat even without an SP.
        if (!spVariant) decide();
        spOutcome(false);
        add("provisional", "……", "ハズレ……？", 2000, { symbol: beside(line) });
        add("blackout", "……", "まだ終わらない……", 2000);
        add("revival", "復活", "運命開花", 2000, { cutin: "復活" });
        if (index === 0) lateHold();
        break;
      case "royal":
        opening();
        earlyHold();
        notice(0.9);
        // Leave room for a promotion when one is coming.
        pseudo(between(1, promotion === "none" ? 3 : 1));
        reach(line, 3000);
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
        // Freeze: the show stops dead mid-frame (labels too), the screen dies like a
        // CRT, a fake reboot runs, and all three reels come back rolling as 大吉.
        add("spin", "変動開始", "運命が、動き出す", between(1600, 2600));
        if (chance(0.5))
          add("stepup", "ステップアップ予告", "STEP 1", 900, { step: 1 });
        add("freeze", null, null, 2800);
        add("puchun", "", "", 1800);
        add("reboot", "", "", 3200);
        add("zenkaiten", "全回転", "大吉全回転", 4400, { cutin: "全回転" });
        tier = 5;
        break;
    }
    // A reach always ends on a ため; after an SP it comes with the mission's result.
    if (spVariant) spOutcome(hit);
    else if (scenario !== "revival" && steps.some((s) => s.state === "reach"))
      decide();
    if (promotion === "climb") promote(line, index);
    else if (promotion === "fail") promote(index, index);
    if (fortune === "大吉")
      add("fever", "大当り", "大吉フィーバー", 3800, { cutin: "大当り" });
    const scale = { short: 0.5, standard: 1, long: 1.35 }[settings.duration];
    return Object.freeze({
      fortune,
      shrine: Object.freeze({ ...shrineData[fortune] }),
      scenario,
      promotion,
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
    promotions,
    starOdds,
    defaults,
    normalizeSettings,
    createDraw,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = engine;
  else root.OmikujiEngine = engine;
})(typeof window !== "undefined" ? window : globalThis);
