const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { scenarios } = require("../js/omikuji-engine.js");
// Math.random values that pick a fortune and a named presentation script.
function script(index, name) {
  let start = 0;
  for (const [entry, weight] of scenarios[index]) {
    if (entry === name) return [(index + 0.5) / 5, start + weight / 2];
    start += weight;
  }
  throw new Error(name);
}
(async () => {
  const b = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    for (const width of [390, 1440]) {
      const p = await b.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.route("https://**/*", (r) => r.abort());
      await p.addInitScript((values) => {
        let n = 0;
        Math.random = () => values[n++] ?? 0.5;
      }, script(0, "revival"));
      await p.clock.install();
      await p.goto("http://127.0.0.1:8000/omikuji.html");
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await p.screenshot({
        path: `/tmp/fever-idle-${width}.png`,
        fullPage: true,
      });
      await p.locator("#draw-button").click();
      await p.locator("#draw-button").dispatchEvent("click");
      assert.equal(await p.locator("#draw-button").isDisabled(), true);
      const seen = [];
      for (let n = 0; n < 600; n++) {
        await p.clock.runFor(100);
        const state = await p.locator(".stage").getAttribute("data-state");
        if (!seen.includes(state)) seen.push(state);
        if (await p.locator(".shrine-info").isVisible()) break;
      }
      for (const state of [
        "early",
        "stepup",
        "reach",
        "strong-reach",
        "provisional",
        "blackout",
        "revival",
        "hold",
        "fever",
      ])
        assert.ok(seen.includes(state), state);
      assert.match(await p.locator(".result").innerText(), /大吉/);
      assert.match(
        await p.locator(".shrine-link").getAttribute("href"),
        /meiji.html/,
      );
      await p.screenshot({
        path: `/tmp/fever-result-${width}.png`,
        fullPage: true,
      });
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await p.clock.runFor(6200);
      await p.waitForURL("**/shrine/meiji.html?result=*");
      assert.match(await p.locator("#omikuji-result").innerText(), /大吉/);
      assert.deepEqual(errors, []);
      console.log(
        "PASS revival flow, double click, navigation, layout",
        width,
        seen.join(","),
      );
      await p.close();
    }
    {
      const p = await b.newPage();
      await p.route("https://**/*", (r) => r.abort());
      await p.clock.install();
      await p.addInitScript((v) => {
        let n = 0;
        Math.random = () => v[n++] ?? 0.99;
      }, script(4, "quick"));
      await p.goto("http://127.0.0.1:8000/omikuji.html");
      await p.locator("#draw-button").click();
      const seen = [];
      for (let n = 0; n < 200; n++) {
        await p.clock.runFor(100);
        const s = await p.locator(".stage").getAttribute("data-state");
        if (!seen.includes(s)) seen.push(s);
        if (await p.locator(".shrine-info").isVisible()) break;
      }
      for (const s of ["reach", "hold", "revival", "fever", "repeat"])
        assert.ok(!seen.includes(s), s);
      assert.equal(await p.locator(".stage").getAttribute("data-state"), "miss");
      assert.match(await p.locator(".result").innerText(), /凶/);
      console.log("PASS quick miss for 凶");
      await p.close();
    }
    {
      const p = await b.newPage();
      await p.route("https://**/*", (r) => r.abort());
      await p.clock.install();
      await p.addInitScript((v) => {
        let n = 0;
        Math.random = () => v[n++] ?? 0.5;
      }, script(0, "puchun"));
      await p.goto("http://127.0.0.1:8000/omikuji.html");
      await p.locator("#draw-button").click();
      const seen = [];
      for (let n = 0; n < 200; n++) {
        await p.clock.runFor(100);
        const s = await p.locator(".stage").getAttribute("data-state");
        if (!seen.includes(s)) seen.push(s);
        if (await p.locator(".shrine-info").isVisible()) break;
      }
      assert.deepEqual(seen.slice(0, 4), ["spin", "puchun", "zenkaiten", "fever"]);
      assert.match(await p.locator(".result").innerText(), /大吉/);
      console.log("PASS puchun freeze into full rotation");
      await p.close();
    }
    for (let i = 0; i < 5; i++) {
      const p = await b.newPage();
      await p.route("https://**/*", (r) => r.abort());
      await p.clock.install();
      await p.addInitScript(
        (value) => {
          let n = 0;
          Math.random = () => (n++ === 0 ? value : 0.99);
        },
        (i + 0.1) / 5,
      );
      await p.goto("http://127.0.0.1:8000/omikuji.html");
      await p.locator("#draw-button").click();
      await p.locator("#skip-button").click();
      assert.match(
        await p.locator(".result").innerText(),
        new RegExp(["大吉", "中吉", "吉", "末吉", "凶"][i]),
      );
      await p.clock.runFor(6200);
      await p.waitForURL(
        "**/shrine/" +
          ["meiji", "fushimi", "sumiyoshi", "kawagoe", "washi"][i] +
          ".html?result=*",
      );
      console.log("PASS skip preserves outcome", i);
      await p.close();
    }
    const p = await b.newPage({ reducedMotion: "reduce" });
    await p.route("https://**/*", (r) => r.abort());
    await p.goto("http://127.0.0.1:8000/omikuji.html");
    assert.equal(
      await p
        .locator(".stage")
        .evaluate((e) => e.classList.contains("reduced")),
      true,
    );
    await p.locator("summary").click();
    await p.locator("#setting-skip").uncheck();
    await p.locator("#setting-duration").selectOption("short");
    await p.reload();
    assert.equal(await p.locator("#setting-skip").isChecked(), false);
    await p.locator("#draw-button").click();
    assert.equal(await p.locator("#skip-button").isVisible(), false);
    await p.reload();
    assert.equal(await p.locator("#draw-button").isEnabled(), true);
    assert.equal(await p.locator(".stage").getAttribute("data-state"), "idle");
    await p.evaluate(() =>
      localStorage.setItem("shrine-fever-settings", "null"),
    );
    await p.reload();
    assert.equal(await p.locator("#draw-button").isEnabled(), true);
    assert.equal(await p.locator("audio,video").count(), 0);
    console.log(
      "PASS reduced motion, settings persistence, skip OFF, reload, invalid storage, no audio",
    );
    await p.close();
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
