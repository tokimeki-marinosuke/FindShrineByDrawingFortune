/* Playback consumes an immutable draw plan; it never draws another fortune. */
(() => {
  "use strict";
  const engine = window.OmikujiEngine;
  const stage = document.querySelector(".stage");
  const drawButton = document.getElementById("draw-button");
  const skipButton = document.getElementById("skip-button");
  const fields = document.getElementById("settings-fields");
  const result = document.querySelector(".result");
  const label = document.querySelector(".stage-label");
  const caption = document.querySelector(".effect-caption");
  const cutin = document.querySelector(".cutin");
  const hold = document.querySelector(".hold-active");
  const reels = [...document.querySelectorAll(".reel")];
  const info = document.querySelector(".shrine-info");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let settings;
  try {
    settings = JSON.parse(
      localStorage.getItem("shrine-fever-settings") || "{}",
    );
  } catch {
    settings = {};
  }
  settings = engine.normalizeSettings(settings);
  const controls = Object.fromEntries(
    Object.keys(engine.defaults).map((key) => [
      key,
      document.getElementById("setting-" + key),
    ]),
  );
  if (motion.matches) settings.reduced = true;
  for (const [key, control] of Object.entries(controls)) {
    if (control.type === "checkbox") control.checked = settings[key];
    else control.value = settings[key];
    control.addEventListener("change", () => {
      settings[key] =
        control.type === "checkbox" ? control.checked : control.value;
      applyPreferences();
      try {
        localStorage.setItem("shrine-fever-settings", JSON.stringify(settings));
      } catch {
        /* Private browsing still works. */
      }
    });
  }
  function reduced() {
    return settings.reduced || motion.matches;
  }
  function applyPreferences() {
    stage.classList.toggle("reduced", reduced());
    stage.classList.toggle("can-shake", settings.shake && !reduced());
  }
  motion.addEventListener("change", applyPreferences);
  applyPreferences();
  // Each strip holds three copies of the five fortunes so the CSS spin loops seamlessly.
  reels.forEach((reel, i) => {
    const strip = reel.querySelector(".strip");
    for (let n = 0; n < 15; n++) {
      const symbol = document.createElement("span");
      symbol.textContent = engine.omikuji[n % 5];
      symbol.dataset.f = n % 5;
      strip.append(symbol);
    }
    reel.style.setProperty("--pos", [0, 2, 4][i]);
    reel.dataset.mode = "idle";
  });
  // Fixed particle pool: no per-frame DOM allocation, fewer particles on mobile via CSS.
  const particles = document.querySelector(".particles");
  for (let i = 0; i < 24; i++) {
    const particle = document.createElement("i");
    particle.style.setProperty("--x", ((i * 37) % 100) + "%");
    particle.style.setProperty("--delay", -(i % 8) * 0.3 + "s");
    particle.style.setProperty("--rotation", i * 47 + "deg");
    particles.append(particle);
  }
  let current = null;
  let timer = null;
  let ticker = null;
  let subTimers = [];
  let running = false;
  let finished = false;
  let cursor = 0;
  let frame = 0;
  function clearTimers() {
    clearTimeout(timer);
    clearInterval(ticker);
    subTimers.forEach(clearTimeout);
    timer = ticker = null;
    subTimers = [];
  }
  function later(fn, ms) {
    subTimers.push(setTimeout(fn, ms));
  }
  // Re-adding a class restarts its CSS animation.
  function restart(element, className) {
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
  }
  function setReel(i, mode, symbol) {
    const reel = reels[i];
    if (symbol !== undefined) reel.style.setProperty("--pos", symbol);
    if (mode === "stop" && reel.dataset.mode === "stop") {
      reel.dataset.mode = "idle";
      void reel.offsetWidth;
    }
    reel.dataset.mode = mode;
  }
  function spinAll() {
    reels.forEach((_, i) => setReel(i, "spin"));
  }
  function fortuneIndex() {
    return engine.omikuji.indexOf(current.fortune);
  }
  function showCutin(text) {
    cutin.textContent = text;
    restart(cutin, "show");
  }
  function destination() {
    return (
      current.shrine.page + "?result=" + encodeURIComponent(current.fortune)
    );
  }
  function reveal() {
    if (!running || finished) return;
    finished = true;
    clearTimers();
    const fever = current.fortune === "大吉";
    stage.dataset.state = fever ? "fever" : "result";
    stage.dataset.tier = current.tier;
    stage.setAttribute("aria-busy", "false");
    label.textContent = "神託確定";
    caption.textContent = fever ? "祝・大吉フィーバー" : "あなたに届いた神託";
    restart(caption, "pop");
    // Left, right, then center: the pachinko stop order.
    const index = fortuneIndex();
    [0, 2, 1].forEach((i, n) => {
      const reel = reels[i];
      if (
        reel.dataset.mode === "stop" &&
        reel.style.getPropertyValue("--pos") === String(index)
      )
        return;
      later(() => setReel(i, "stop", index), reduced() ? 0 : n * 160);
    });
    result.textContent = "あなたの運勢は… " + current.fortune + "！";
    document.querySelector(".shrine-name").textContent = current.shrine.name;
    document.querySelector(".shrine-description").textContent =
      current.shrine.desc;
    const link = document.querySelector(".shrine-link");
    link.href = destination();
    link.textContent = current.shrine.name + "の詳細を見る →";
    document.querySelector(".background-image").style.backgroundImage =
      `url("${current.shrine.image}")`;
    info.hidden = false;
    skipButton.hidden = true;
    timer = setTimeout(
      () => {
        window.location.href = destination();
      },
      reduced() ? 4500 : 3200,
    );
  }
  function play(index) {
    if (!running || finished) return;
    if (index === current.steps.length) {
      reveal();
      return;
    }
    const step = current.steps[index];
    stage.dataset.state = step.state;
    if (step.tier !== undefined) stage.dataset.tier = step.tier;
    stage.dataset.repeat = step.repeat || 0;
    label.textContent =
      step.state === "provisional"
        ? "演出中・まだ確定ではありません"
        : "神託演出中";
    caption.textContent = step.text;
    restart(caption, "pop");
    const fortune = fortuneIndex();
    switch (step.state) {
      case "spin":
        spinAll();
        break;
      case "early":
        showCutin("先バレ");
        break;
      case "charge":
        restart(hold, "pop");
        break;
      case "pause":
        // Pseudo-continuation: the reels stop out of line, then spin again.
        reels.forEach((_, i) => setReel(i, "stop", (cursor + i * 2) % 5));
        break;
      case "repeat":
        spinAll();
        showCutin("擬似 " + (step.repeat + 1));
        break;
      case "reach":
      case "strong-reach":
        setReel(1, step.state === "reach" ? "slow" : "slow-strong");
        setReel(0, "stop", fortune);
        later(
          () => {
            setReel(2, "stop", fortune);
            showCutin(step.state === "reach" ? "リーチ" : "強リーチ");
          },
          reduced() ? 0 : Math.min(380, step.ms / 3),
        );
        break;
      case "hot":
        showCutin("激熱");
        break;
      case "provisional":
        setReel(1, "stop", engine.omikuji.indexOf("末吉"));
        break;
      case "revival":
        setReel(1, "spin");
        showCutin("復活");
        break;
      case "fever":
        setReel(1, "stop", fortune);
        showCutin("大当り");
        break;
    }
    // Only meaningful milestones are announced, never the rapidly changing reels.
    if (
      [
        "early",
        "reach",
        "strong-reach",
        "hot",
        "blackout",
        "revival",
        "fever",
      ].includes(step.state)
    )
      result.textContent = step.text;
    timer = setTimeout(() => play(index + 1), step.ms);
  }
  drawButton.addEventListener("click", () => {
    if (running) return;
    running = true;
    finished = false;
    current = engine.createDraw(settings);
    fields.disabled = true;
    drawButton.disabled = true;
    drawButton.textContent = "神託を受け取っています…";
    skipButton.hidden = !settings.skip;
    stage.setAttribute("aria-busy", "true");
    result.textContent = "抽選を開始しました";
    // CSS animates spinning reels; reduced mode steps them slowly from here instead.
    ticker = setInterval(() => {
      cursor++;
      if (!reduced() || ++frame % 4 !== 0) return;
      reels.forEach((reel, i) => {
        if (["spin", "slow", "slow-strong"].includes(reel.dataset.mode))
          reel.style.setProperty("--pos", (cursor + i) % 5);
      });
    }, 110);
    play(0);
  });
  skipButton.addEventListener("click", reveal);
  window.addEventListener("pagehide", () => {
    clearTimers();
    running = false;
  });
  // A BFCache restore returns to a safe idle state, not a frozen half-playback.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) window.location.reload();
  });
})();
