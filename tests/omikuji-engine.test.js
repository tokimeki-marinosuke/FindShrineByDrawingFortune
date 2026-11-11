const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createDraw, normalizeSettings } = require("../js/omikuji-engine");
const fortunes = ["大吉", "中吉", "吉", "末吉", "凶"];
const pages = ["meiji", "fushimi", "sumiyoshi", "kawagoe", "washi"];
function sequence(values, fallback = 0.99) {
  let n = 0;
  return () => values[n++] ?? fallback;
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
            Object.isFrozen(draw.shrine),
        );
      }
});
test("special paths are preplanned and revival cannot end in a low fortune", () => {
  const draw = createDraw({}, sequence([0.01, 0, 0, 0, 0.99, 0]));
  assert.equal(draw.fortune, "大吉");
  assert.equal(draw.repeats, 3);
  assert.equal(draw.tier, 5);
  for (const state of [
    "early",
    "charge",
    "repeat",
    "strong-reach",
    "hot",
    "provisional",
    "blackout",
    "revival",
    "fever",
  ])
    assert.ok(
      draw.steps.some((s) => s.state === state),
      state,
    );
  const middle = createDraw({}, sequence([0.25, 0, 0, 0.99, 0]));
  assert.equal(middle.fortune, "中吉");
  assert.equal(middle.hot, true);
  for (const value of [0.45, 0.65, 0.85])
    assert.equal(createDraw({}, sequence([value], 0)).revival, false);
});
test("early OFF does not affect fortune; daikichi can occur with no early signal", () => {
  assert.equal(createDraw({ early: "off" }, () => 0).early, false);
  const draw = createDraw({}, sequence([0]));
  assert.equal(draw.fortune, "大吉");
  assert.equal(draw.early, false);
});
test("seeded distribution remains uniform, signal favors higher fortunes and colors are consistent", () => {
  let seed = 1234;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const counts = [0, 0, 0, 0, 0],
    signals = [0, 0, 0, 0, 0];
  for (let n = 0; n < 25000; n++) {
    const d = createDraw({}, random),
      i = fortunes.indexOf(d.fortune);
    counts[i]++;
    signals[i] += d.early;
    assert.ok(d.repeats <= 3);
    assert.ok(i === 0 ? d.tier >= 4 : d.tier === 5 - i);
  }
  counts.forEach((n) => assert.ok(n > 4700 && n < 5300));
  for (let i = 0; i < 4; i++)
    assert.ok(signals[i] / counts[i] > signals[i + 1] / counts[i + 1]);
});
test("invalid stored settings safely fall back", () => {
  assert.equal(
    normalizeSettings({ duration: "bogus", skip: "false" }).duration,
    "standard",
  );
  assert.equal(normalizeSettings({ skip: "false" }).skip, true);
  assert.equal(normalizeSettings(null).duration, "standard");
});
