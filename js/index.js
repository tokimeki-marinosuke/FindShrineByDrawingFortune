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
  const stepup = document.querySelector(".stepup");
  const stepupNumber = document.querySelector(".stepup-n");
  const bubble = document.querySelector(".bubble");
  const pushButton = document.querySelector(".push");
  const reels = [...document.querySelectorAll(".reel")];
  const info = document.querySelector(".shrine-info");
  const countdown = document.querySelector(".countdown");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const REDIRECT_MS = 6000;
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
  // Fixed pools: no per-frame DOM allocation, fewer pieces on mobile via CSS.
  function fill(selector, count, make) {
    const container = document.querySelector(selector);
    for (let i = 0; i < count; i++) container.append(make(i));
  }
  fill(".particles", 24, (i) => {
    const particle = document.createElement("i");
    particle.style.setProperty("--x", ((i * 37) % 100) + "%");
    particle.style.setProperty("--delay", -(i % 8) * 0.3 + "s");
    particle.style.setProperty("--rotation", i * 47 + "deg");
    return particle;
  });
  fill(".swarm", 16, (i) => {
    const charm = document.createElement("i");
    charm.textContent = i % 3 ? "福" : "⛩";
    charm.style.setProperty("--y", ((i * 29) % 90) + 3 + "%");
    charm.style.setProperty("--delay", ((i * 0.13) % 1.6).toFixed(2) + "s");
    charm.style.setProperty("--size", 1 + (i % 4) * 0.35 + "rem");
    return charm;
  });
  fill(".sp-sakura", 26, (i) => {
    const petal = document.createElement("i");
    petal.style.setProperty("--x", ((i * 41) % 120) - 10 + "%");
    petal.style.setProperty("--delay", -((i * 0.17) % 2.2).toFixed(2) + "s");
    petal.style.setProperty("--rotation", i * 53 + "deg");
    return petal;
  });
  let current = null;
  let timer = null;
  let ticker = null;
  let subTimers = [];
  let running = false;
  let finished = false;
  let stepIndex = 0;
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
  function showShrine() {
    const shrine = current.shrine;
    info.dataset.fortune = current.fortune;
    info.querySelector(".shrine-photo").style.backgroundImage =
      `url("${shrine.image}")`;
    info.querySelector(".shrine-fortune").textContent = current.fortune;
    info.querySelector(".shrine-name").textContent = shrine.name;
    info.querySelector(".shrine-area").textContent = shrine.area;
    info.querySelector(".shrine-blessings").replaceChildren(
      ...shrine.blessings.map((blessing) => {
        const item = document.createElement("li");
        item.textContent = blessing;
        return item;
      }),
    );
    info.querySelector(".shrine-description").textContent = shrine.desc;
    const link = info.querySelector(".shrine-link");
    link.href = destination();
    link.textContent = shrine.name + "の詳細を見る →";
    document.querySelector(".background-image").style.backgroundImage =
      `url("${shrine.image}")`;
    info.hidden = false;
  }
  // Stops the given reels in order (pachinko order is left, right, center).
  function stopReels(targets, gap) {
    [0, 2, 1].forEach((i, n) => {
      const reel = reels[i];
      if (
        reel.dataset.mode === "stop" &&
        reel.style.getPropertyValue("--pos") === String(targets[i])
      )
        return;
      later(() => setReel(i, "stop", targets[i]), reduced() ? 0 : n * gap);
    });
  }
  function reveal() {
    if (!running || finished) return;
    finished = true;
    clearTimers();
    const fever = current.fortune === "大吉";
    stage.dataset.state = fever ? "fever" : current.hit ? "result" : "miss";
    stage.dataset.tier = current.tier;
    stage.setAttribute("aria-busy", "false");
    label.textContent = fever ? "大当り" : current.hit ? "神託確定" : "ハズレ";
    caption.textContent = fever
      ? "祝・大吉フィーバー"
      : current.hit
        ? "あなたに届いた神託"
        : "凶…ここから運気を上げよう";
    restart(caption, "pop");
    // A miss stops a little slower, like the reels running out of steam.
    stopReels(current.reels, current.hit ? 220 : 380);
    result.textContent = "あなたの運勢は… " + current.fortune + "！";
    showShrine();
    skipButton.hidden = true;
    drawButton.textContent = "神託が下りました";
    later(
      () => info.scrollIntoView({ behavior: "smooth", block: "nearest" }),
      reduced() ? 0 : 1600,
    );
    const leaveAt = Date.now() + REDIRECT_MS;
    const tick = () => {
      countdown.textContent = Math.max(
        0,
        Math.ceil((leaveAt - Date.now()) / 1000),
      );
    };
    tick();
    ticker = setInterval(tick, 250);
    timer = setTimeout(() => {
      window.location.href = destination();
    }, REDIRECT_MS);
  }
  function play(index) {
    if (!running || finished) return;
    stepIndex = index;
    if (index === current.steps.length) {
      reveal();
      return;
    }
    const step = current.steps[index];
    stage.dataset.state = step.state;
    stage.style.setProperty("--ms", step.ms + "ms");
    if (step.tier !== undefined) stage.dataset.tier = step.tier;
    stage.dataset.repeat = step.repeat || 0;
    if (step.variant) stage.dataset.sp = step.variant;
    label.textContent = step.label;
    caption.textContent = step.text;
    restart(caption, "pop");
    // Cut-ins come with the plan; reaches show theirs once the reach is formed.
    let cutinDelay = 0;
    const fortune = fortuneIndex();
    switch (step.state) {
      case "spin":
        spinAll();
        break;
      case "hold":
        restart(hold, "pop");
        break;
      case "stepup":
        stage.dataset.step = step.step;
        stepupNumber.textContent = step.step;
        restart(stepup, "pop");
        break;
      case "serif":
        stage.dataset.serif = step.color;
        bubble.textContent = step.text;
        restart(bubble, "pop");
        break;
      case "pause":
        // Pseudo-continuation: the reels stop out of line, then spin again.
        reels.forEach((_, i) => setReel(i, "stop", (cursor + i * 2) % 5));
        break;
      case "repeat":
        spinAll();
        break;
      case "reach":
        cutinDelay = reduced() ? 0 : Math.min(800, step.ms / 4);
        setReel(1, "spin");
        setReel(0, "stop", step.symbol);
        later(() => {
          setReel(2, "stop", step.symbol);
          setReel(1, "slow");
        }, cutinDelay);
        break;
      case "strong-reach":
        cutinDelay = reduced() ? 0 : 400;
        setReel(1, "slow-strong");
        break;
      case "push":
        pushButton.focus({ preventScroll: true });
        break;
      case "provisional":
        // Looks exactly like a miss before the revival.
        setReel(1, "stop", step.symbol);
        break;
      case "revival":
        setReel(1, "spin");
        break;
      case "settle":
        setReel(1, "stop", step.symbol);
        break;
      case "promote":
        // The lined-up symbols flip in place to the higher fortune.
        reels.forEach((_, i) => setReel(i, "spin"));
        later(
          () => reels.forEach((_, i) => setReel(i, "stop", step.symbol)),
          reduced() ? 0 : 450,
        );
        break;
      case "zenkaiten":
        reels.forEach((reel) => {
          reel.style.setProperty("--pos", fortune);
          reel.dataset.mode = "zen";
        });
        break;
      case "kokuchi":
        reels.forEach((_, i) => setReel(i, "stop", fortune));
        break;
      case "fever":
        // After a full rotation all three land together.
        stopReels(
          [fortune, fortune, fortune],
          reels[0].dataset.mode === "zen" ? 0 : 220,
        );
        break;
    }
    if (step.cutin) later(() => showCutin(step.cutin), cutinDelay);
    // Only meaningful milestones are announced, never the rapidly changing reels.
    if (
      [
        "early",
        "serif",
        "swarm",
        "reach",
        "strong-reach",
        "hot",
        "push",
        "provisional",
        "blackout",
        "revival",
        "settle",
        "promote-chance",
        "promote",
        "promote-fail",
        "zenkaiten",
        "kokuchi",
        "fever",
      ].includes(step.state)
    )
      result.textContent = step.label + "：" + step.text;
    timer = setTimeout(() => play(index + 1), step.ms);
  }
  // Pressing PUSH only ends the wait early; the outcome was fixed at the start.
  pushButton.addEventListener("click", () => {
    if (!running || finished || stage.dataset.state !== "push") return;
    clearTimeout(timer);
    stage.dataset.state = "pushed";
    showCutin(current.steps[stepIndex].press);
    timer = setTimeout(() => play(stepIndex + 1), reduced() ? 0 : 900);
  });
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
