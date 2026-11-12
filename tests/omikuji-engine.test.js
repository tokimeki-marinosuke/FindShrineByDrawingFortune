const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  createDraw,
  normalizeSettings,
  scenarios,
} = require("../js/omikuji-engine");
const fortunes = ["大吉", "中吉", "吉", "末吉", "凶"];
const pages = ["meiji", "fushimi", "sumiyoshi", "kawagoe", "washi"];
function sequence(values, fallback = 0.99) {
  let n = 0;
  return () => values[n++] ?? fallback;
}
function lcg(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
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
// Fortune and scenario are fixed; everything after comes from a seeded RNG.
function forced(index, name, seed) {
  const head = [(index + 0.5) / 5, scenarioValue(index, name)];
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
      for (let seed = 1; seed <= 40; seed++) {
        const draw = createDraw({}, forced(i, name, seed));
        const label = `${fortunes[i]} ${name} ${seed}`;
        assert.equal(draw.scenario, name, label);
        assert.equal(draw.hit, i < 4, label);
        const aligned = draw.reels.every((r) => r === draw.reels[0]);
        if (draw.hit) assert.deepEqual([...draw.reels], [i, i, i], label);
        else assert.equal(aligned, false, label);
        const states = draw.steps.map((s) => s.state);
        // Hits other than the premium ones always pass through a reach.
        if (draw.hit && !["puchun", "kokuchi"].includes(name))
          assert.ok(states.includes("reach"), label);
        const rainbow = draw.steps.findIndex((s) => s.tier === 5);
        if (rainbow >= 0) {
          assert.equal(i, 0, label);
          assert.ok(rainbow > states.indexOf("reach"), label);
        }
        const firstReach = states.indexOf("reach");
        draw.steps
          .slice(0, firstReach < 0 ? undefined : firstReach)
          .forEach((s) => assert.ok(!(s.tier > 2), label));
        if (states.includes("revival")) assert.ok(i <= 2, label);
        if (["puchun", "zenkaiten", "kokuchi"].some((s) => states.includes(s)))
          assert.equal(i, 0, label);
        for (const s of draw.steps.filter((s) => s.state === "provisional"))
          assert.notEqual(s.symbol, i, label);
        const total = draw.steps.reduce((sum, s) => sum + s.ms, 0);
        assert.ok(total >= 2000 && total <= 50000, `${label} ${total}`);
      }
});
test("premium and quick paths look the way they are named", () => {
  const puchun = createDraw({}, forced(0, "puchun", 7));
  assert.deepEqual(
    puchun.steps.map((s) => s.state),
    ["spin", "puchun", "zenkaiten", "fever"],
  );
  assert.equal(puchun.tier, 5);
  const quick = createDraw({}, forced(4, "quick", 7));
  assert.ok(!quick.steps.some((s) => s.state === "reach"));
  // 擬似連 and 保留変化 are not part of every draw.
  const plain = createDraw({}, sequence([0.7, scenarioValue(3, "normal")]));
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
    withHold = 0;
  for (let n = 0; n < 25000; n++) {
    const d = createDraw({}, random),
      i = fortunes.indexOf(d.fortune);
    counts[i]++;
    signals[i] += d.early;
    const states = d.steps.map((s) => s.state);
    kinds.add(
      d.scenario + "/" + (d.steps.find((s) => s.variant)?.variant ?? "-"),
    );
    if (i === 4 && !states.includes("reach")) quickMisses++;
    if (states.includes("repeat")) withRepeat++;
    if (states.includes("hold")) withHold++;
  }
  counts.forEach((n) => assert.ok(n > 4700 && n < 5300));
  for (let i = 0; i < 4; i++)
    assert.ok(signals[i] / counts[i] > signals[i + 1] / counts[i + 1]);
  assert.ok(quickMisses / counts[4] > 0.35);
  assert.ok(withRepeat / 25000 < 0.4);
  assert.ok(withHold / 25000 < 0.8);
  assert.ok(kinds.size >= 30, String(kinds.size));
});
test("invalid stored settings safely fall back", () => {
  assert.equal(
    normalizeSettings({ duration: "bogus", skip: "false" }).duration,
    "standard",
  );
  assert.equal(normalizeSettings({ skip: "false" }).skip, true);
  assert.equal(normalizeSettings(null).duration, "standard");
});
