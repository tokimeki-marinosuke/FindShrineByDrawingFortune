const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  createDraw,
  normalizeSettings,
  scenarios,
  promotions,
} = require("../js/omikuji-engine");
const fortunes = ["大吉", "中吉", "吉", "末吉", "凶"];
const pages = ["meiji", "fushimi", "sumiyoshi", "kawagoe", "washi"];
function sequence(values, fallback = 0.99) {
  let n = 0;
  return () => values[n++] ?? fallback;
}
function lcg(seed) {
  // Spread small seeds apart; neighbouring LCG seeds start almost identically.
  let state = Math.imul(seed, 2654435761) >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}
// The RNG value that selects a scenario: the middle of its weight band.
function scenarioValue(index, name) {
  let start = 0;
  for (const [entry, weight] of scenarios[index]) {
    if (entry === name) return start + weight / 2;
    start += weight;
  }
  throw new Error(name);
}
// The third RNG value picks the promotion layer: climb, fail or none.
function promotionValue(index, kind) {
  const [climb, fail] = promotions[index];
  return { climb: climb / 2, fail: climb + fail / 2, none: 0.999 }[kind];
}
const promotionKinds = (index) =>
  ["none", "climb", "fail"].filter(
    (kind, n) => n === 0 || promotions[index][n - 1] > 0,
  );
// Fortune, scenario and promotion are fixed; everything after comes from a seeded RNG.
function forced(index, name, seed, kind = "none") {
  const head = [
    (index + 0.5) / 5,
    scenarioValue(index, name),
    promotionValue(index, kind),
  ];
  const rest = lcg(seed);
  let n = 0;
  return () => (n < head.length ? head[n++] : rest());
}
test("each fifth of the RNG maps to the unchanged fortune and shrine, independent of settings", () => {
  for (let i = 0; i < 5; i++)
    for (const early of ["off", "standard", "often"])
      for (const duration of ["short", "standard", "long"]) {
        const draw = createDraw(
          { early, duration, reduced: true, skip: false },
          sequence([(i + 0.5) / 5]),
        );
        assert.equal(draw.fortune, fortunes[i]);
        assert.equal(draw.shrine.page, `shrine/${pages[i]}.html`);
        assert.equal(
          draw.steps.some((s) => s.state === "fever"),
          i === 0,
        );
        assert.ok(
          Object.isFrozen(draw) &&
            Object.isFrozen(draw.steps) &&
            Object.isFrozen(draw.shrine) &&
            Object.isFrozen(draw.reels),
        );
      }
});
test("every scenario keeps its promises: hits line up, 凶 misses, rainbow only late for 大吉", () => {
  for (let i = 0; i < 5; i++)
    for (const [name] of scenarios[i])
      for (const kind of promotionKinds(i))
        for (let seed = 1; seed <= 30; seed++) {
          const draw = createDraw({}, forced(i, name, seed, kind));
          const label = `${fortunes[i]} ${name} ${kind} ${seed}`;
          assert.equal(draw.scenario, name, label);
          const premium = ["puchun", "kokuchi"].includes(name);
          assert.equal(draw.promotion, premium ? "none" : kind, label);
          assert.equal(draw.hit, i < 4, label);
          const aligned = draw.reels.every((r) => r === draw.reels[0]);
          if (draw.hit) assert.deepEqual([...draw.reels], [i, i, i], label);
          else assert.equal(aligned, false, label);
          const states = draw.steps.map((s) => s.state);
          // Hits other than the premium ones always pass through a reach.
          if (draw.hit && !premium) assert.ok(states.includes("reach"), label);
          const reach = draw.steps.find((s) => s.state === "reach");
          // A 凶 reach never dangles 大吉.
          if (!draw.hit && reach) assert.notEqual(reach.symbol, 0, label);
          const rainbow = draw.steps.findIndex((s) => s.tier === 5);
          if (rainbow >= 0) {
            assert.equal(i, 0, label);
            assert.ok(rainbow > states.indexOf("reach"), label);
            assert.ok(rainbow > states.lastIndexOf("promote"), label);
          }
          const firstReach = states.indexOf("reach");
          draw.steps
            .slice(0, firstReach < 0 ? undefined : firstReach)
            .forEach((s) => assert.ok(!(s.tier > 2), label));
          if (states.includes("revival")) assert.ok(i <= 2, label);
          if (
            ["freeze", "puchun", "zenkaiten", "kokuchi"].some((s) =>
              states.includes(s),
            )
          )
            assert.equal(i, 0, label);
          for (const s of draw.steps.filter((s) => s.state === "provisional"))
            assert.notEqual(s.symbol, reach.symbol, label);
          const settle = draw.steps.find((s) => s.state === "settle");
          const climbs = draw.steps
            .filter((s) => s.state === "promote")
            .map((s) => s.symbol);
          if (draw.promotion === "climb") {
            // Reaches and lines up lower, then climbs strictly upward to the real fortune.
            assert.equal(reach.symbol, settle.symbol, label);
            assert.ok(settle.symbol > i, label);
            assert.ok(climbs.length >= 1 && climbs.length <= 2, label);
            assert.equal(climbs.at(-1), i, label);
            climbs.reduce((previous, symbol) => {
              assert.ok(symbol < previous, label);
              return symbol;
            }, settle.symbol);
          } else if (draw.promotion === "fail") {
            assert.equal(settle.symbol, i, label);
            assert.equal(climbs.length, 0, label);
            assert.ok(states.includes("promote-fail"), label);
          } else {
            assert.equal(settle, undefined, label);
            assert.equal(climbs.length, 0, label);
          }
          // A promotion chance is PUSH, then the trembling wait, then the outcome.
          states.forEach((s, n) => {
            if (s === "promote-chance") {
              assert.equal(states[n + 1], "push", label);
              assert.equal(states[n + 2], "promote-roll", label);
            }
          });
          // With a promotion coming, the final-battle PUSH steps aside for it.
          if (draw.promotion !== "none")
            assert.ok(
              !draw.steps.some((s) => s.state === "push" && s.press === "決"),
              label,
            );
          const total = draw.steps.reduce((sum, s) => sum + s.ms, 0);
          assert.ok(total >= 2000 && total <= 50000, `${label} ${total}`);
        }
});
test("premium and quick paths look the way they are named", () => {
  // Freeze → ぷちゅん → reboot → full rotation, sometimes from inside a STEP 1 notice.
  const flows = new Set();
  for (let seed = 1; seed <= 40; seed++)
    flows.add(
      createDraw({}, forced(0, "puchun", seed))
        .steps.map((s) => s.state)
        .join(">"),
    );
  assert.deepEqual([...flows].sort(), [
    "spin>freeze>puchun>reboot>zenkaiten>fever",
    "spin>stepup>freeze>puchun>reboot>zenkaiten>fever",
  ]);
  const freeze = createDraw({}, forced(0, "puchun", 1)).steps.find(
    (s) => s.state === "freeze",
  );
  assert.equal(freeze.label, null);
  assert.equal(freeze.text, null);
  const quick = createDraw({}, forced(4, "quick", 7));
  assert.ok(!quick.steps.some((s) => s.state === "reach"));
  // A 中吉 line can be promoted to 大吉, and 末吉 can climb in two steps.
  const paths = new Set();
  for (const [name] of scenarios[0])
    for (let seed = 1; seed <= 60; seed++) {
      const d = createDraw({}, forced(0, name, seed, "climb"));
      paths.add(
        d.steps
          .filter((s) => ["settle", "promote"].includes(s.state))
          .map((s) => fortunes[s.symbol])
          .join(">"),
      );
    }
  assert.ok(paths.has("中吉>大吉"), [...paths].join(" "));
  assert.ok(paths.has("末吉>中吉>大吉"), [...paths].join(" "));
  // The example flow: a real 中吉 that reaches on 末吉, goes SP, and is promoted.
  const spClimb = createDraw({}, forced(1, "sp", 3, "climb"));
  const order = spClimb.steps.map((s) => s.state);
  assert.ok(
    order.indexOf("strong-reach") < order.indexOf("settle") &&
      order.indexOf("settle") < order.indexOf("promote"),
  );
  // 擬似連 and 保留変化 are not part of every draw.
  const plain = createDraw(
    {},
    sequence([0.7, scenarioValue(3, "normal"), promotionValue(3, "none")]),
  );
  assert.ok(!plain.steps.some((s) => ["repeat", "hold"].includes(s.state)));
});
test("early OFF does not affect fortune; daikichi can occur with no early signal", () => {
  for (let seed = 1; seed < 200; seed++)
    assert.equal(createDraw({ early: "off" }, lcg(seed)).early, false);
  const draw = createDraw({}, sequence([0]));
  assert.equal(draw.fortune, "大吉");
  assert.equal(draw.early, false);
});
test("seeded distribution remains uniform, signals favour higher fortunes and shows vary", () => {
  const random = lcg(1234);
  const counts = [0, 0, 0, 0, 0],
    signals = [0, 0, 0, 0, 0];
  const kinds = new Set();
  let quickMisses = 0,
    withRepeat = 0,
    withHold = 0,
    promoted = 0;
  for (let n = 0; n < 25000; n++) {
    const d = createDraw({}, random),
      i = fortunes.indexOf(d.fortune);
    counts[i]++;
    signals[i] += d.early;
    const states = d.steps.map((s) => s.state);
    kinds.add(
      d.scenario +
        "/" +
        (d.steps.find((s) => s.variant)?.variant ?? "-") +
        "/" +
        d.promotion,
    );
    if (i === 4 && !states.includes("reach")) quickMisses++;
    if (states.includes("repeat")) withRepeat++;
    if (states.includes("hold")) withHold++;
    if (d.promotion !== "none") promoted++;
  }
  counts.forEach((n) => assert.ok(n > 4700 && n < 5300));
  for (let i = 0; i < 4; i++)
    assert.ok(signals[i] / counts[i] > signals[i + 1] / counts[i + 1]);
  assert.ok(quickMisses / counts[4] > 0.35);
  assert.ok(withRepeat / 25000 < 0.4);
  assert.ok(withHold / 25000 < 0.8);
  // Promotion is an occasional extra, not the norm.
  assert.ok(promoted / 25000 > 0.08 && promoted / 25000 < 0.3);
  assert.ok(kinds.size >= 40, String(kinds.size));
});
test("invalid stored settings safely fall back", () => {
  assert.equal(
    normalizeSettings({ duration: "bogus", skip: "false" }).duration,
    "standard",
  );
  assert.equal(normalizeSettings({ skip: "false" }).skip, true);
  assert.equal(normalizeSettings(null).duration, "standard");
});
