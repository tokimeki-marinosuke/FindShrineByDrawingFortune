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
  const card = document.querySelector(".fortune-card strong");
  const reels = [...document.querySelectorAll(".reels span")];
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
  function applyPreferences() {
    const reduced = settings.reduced || motion.matches;
    stage.classList.toggle("reduced", reduced);
    stage.classList.toggle("can-shake", settings.shake && !reduced);
  }
  motion.addEventListener("change", applyPreferences);
  applyPreferences();
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
  let running = false;
  let finished = false;
  let cursor = 0;
  let frame = 0;
  function clearTimers() {
    clearTimeout(timer);
    clearInterval(ticker);
    timer = ticker = null;
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
    stage.dataset.state = current.fortune === "大吉" ? "fever" : "result";
    stage.dataset.tier = current.tier;
    stage.setAttribute("aria-busy", "false");
    label.textContent = "神託確定";
    caption.textContent =
      current.fortune === "大吉" ? "祝・大吉フィーバー" : "あなたに届いた神託";
    card.textContent = current.fortune;
    reels.forEach((reel) => {
      reel.textContent = current.fortune;
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
      settings.reduced || motion.matches ? 4500 : 3200,
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
    if (["reach", "strong-reach"].includes(step.state)) {
      reels[0].textContent = reels[1].textContent = current.fortune;
    }
    if (step.state === "provisional") card.textContent = "末吉？";
    if (step.state === "blackout") card.textContent = "……";
    if (step.state === "revival" || step.state === "fever")
      card.textContent = current.fortune;
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
    ticker = setInterval(() => {
      const state = stage.dataset.state;
      if (
        ![
          "spin",
          "charge",
          "repeat",
          "early",
          "reach",
          "strong-reach",
          "hot",
        ].includes(state)
      )
        return;
      cursor++;
      // Visual cycling is deterministic and independent of the outcome RNG.
      if ((!settings.reduced && !motion.matches) || ++frame % 4 === 0) {
        card.textContent = engine.omikuji[cursor % 5];
        reels.forEach((reel, i) => {
          if (["reach", "strong-reach"].includes(state) && i < 2) return;
          reel.textContent = engine.omikuji[(cursor + i) % 5];
        });
      }
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
