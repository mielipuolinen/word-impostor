"use strict";

const BOOT_SPLASH_MIN_MS = 2000;
const BOOT_SPLASH_START_MS = (globalThis.performance && typeof performance.now === "function") ? performance.now() : Date.now();

let bootProgressRaf = 0;

function stopBootProgress(){
  if(bootProgressRaf){
    cancelAnimationFrame(bootProgressRaf);
    bootProgressRaf = 0;
  }
}

function initBootProgress(){
  const ring = el.bootRingFill;
  if(ring){
    // r=28 => circumference
    const r = 28;
    const c = 2 * Math.PI * r;
    ring.style.strokeDasharray = String(c);
    ring.style.strokeDashoffset = String(c);
  }
  if(el.bootPercent) el.bootPercent.textContent = "0%";

  stopBootProgress();
  const tick = () => {
    const t = Math.min(1, Math.max(0, bootElapsedMs() / BOOT_SPLASH_MIN_MS));
    const pct = Math.round(t * 100);

    if(el.bootPercent) el.bootPercent.textContent = pct + "%";
    if(el.bootRingFill){
      const r = 28;
      const c = 2 * Math.PI * r;
      el.bootRingFill.style.strokeDashoffset = String(c * (1 - t));
    }

    if(document.body?.classList.contains("booting")){
      bootProgressRaf = requestAnimationFrame(tick);
    }else{
      stopBootProgress();
    }
  };

  bootProgressRaf = requestAnimationFrame(tick);
}

// ---- Snowfall (canvas particle system) ----
const snow = {
  canvas: null,
  ctx: null,
  flakes: [],
  running: false,
  rafId: 0,
  lastTs: 0,
  w: 0,
  h: 0,
  dpr: 1,
};

function _snowRand(min, max){
  return min + Math.random() * (max - min);
}

function _snowClamp(v, a, b){
  return Math.min(b, Math.max(a, v));
}

function _snowShouldRun(){
  const forced = document.body?.classList.contains("force-motion");
  const reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  return forced || !reduce;
}

function _snowResize(){
  if(!snow.canvas) return;
  const w = Math.max(1, Math.floor(window.innerWidth || document.documentElement.clientWidth || 1));
  const h = Math.max(1, Math.floor(window.innerHeight || document.documentElement.clientHeight || 1));
  const dpr = _snowClamp((window.devicePixelRatio || 1), 1, 2);

  snow.w = w;
  snow.h = h;
  snow.dpr = dpr;

  snow.canvas.width = Math.floor(w * dpr);
  snow.canvas.height = Math.floor(h * dpr);
  // Keep CSS size responsive.
  snow.canvas.style.width = "100%";
  snow.canvas.style.height = "100%";

  if(snow.ctx){
    // Draw in CSS pixels; scale internally.
    snow.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

function _snowMakeFlake(depth, booting){
  // depth: 0 = far, 1 = mid, 2 = near
  const z = depth;
  const r = (z === 0)
    ? _snowRand(0.6, booting ? 1.6 : 1.3)
    : (z === 1)
      ? _snowRand(1.2, booting ? 3.0 : 2.4)
      : _snowRand(2.0, booting ? 4.6 : 3.9);

  // Speed in px/s (CSS pixels). Closer flakes fall faster.
  const vy = (z === 0)
    ? _snowRand(14, 28)
    : (z === 1)
      ? _snowRand(22, 46)
      : _snowRand(34, 72);

  // Constant horizontal drift (wind push). Closer flakes drift more.
  const vx = (z === 0)
    ? _snowRand(-6, 6)
    : (z === 1)
      ? _snowRand(-10, 10)
      : _snowRand(-18, 18);

  // Side-to-side sway (not synced: random phase + freq).
  const amp = (z === 0)
    ? _snowRand(2, 6)
    : (z === 1)
      ? _snowRand(5, 14)
      : _snowRand(10, 26);
  const freq = (z === 0)
    ? _snowRand(0.35, 0.75)
    : (z === 1)
      ? _snowRand(0.45, 0.95)
      : _snowRand(0.55, 1.15);
  const phase = _snowRand(0, Math.PI * 2);

  const aBoost = booting ? 0.22 : 0;
  const a = (z === 0)
    ? _snowClamp(_snowRand(0.10, 0.22) + aBoost * 0.6, 0.06, 0.34)
    : (z === 1)
      ? _snowClamp(_snowRand(0.14, 0.28) + aBoost * 0.8, 0.08, 0.42)
      : _snowClamp(_snowRand(0.16, 0.34) + aBoost, 0.10, 0.52);

  return {
    z,
    xBase: _snowRand(0, snow.w),
    y: _snowRand(-snow.h, snow.h),
    r,
    vy,
    vx,
    amp,
    freq,
    phase,
    a,
  };
}

function _snowSeedFlakes(){
  if(!snow.w || !snow.h) return;
  // Density scales with viewport area, capped for performance.
  const area = snow.w * snow.h;
  const booting = document.body?.classList.contains("booting");
  const mult = booting ? 3.4 : 1;
  const total = Math.round(_snowClamp((area / 9000) * mult, 120, booting ? 560 : 190));

  // During boot: more near flakes for a more impressive look.
  const farCount = Math.round(total * (booting ? 0.34 : 0.45));
  const midCount = Math.round(total * (booting ? 0.36 : 0.35));
  const nearCount = Math.max(0, total - farCount - midCount);

  const flakes = [];
  for(let i = 0; i < farCount; i++) flakes.push(_snowMakeFlake(0, booting));
  for(let i = 0; i < midCount; i++) flakes.push(_snowMakeFlake(1, booting));
  for(let i = 0; i < nearCount; i++) flakes.push(_snowMakeFlake(2, booting));
  snow.flakes = flakes;
}

function _snowStop(){
  snow.running = false;
  snow.lastTs = 0;
  if(snow.rafId){
    cancelAnimationFrame(snow.rafId);
    snow.rafId = 0;
  }
  if(snow.ctx && snow.w && snow.h){
    snow.ctx.clearRect(0, 0, snow.w, snow.h);
  }
}

function _snowTick(ts){
  if(!snow.running || !snow.ctx) return;
  if(document.visibilityState === "hidden"){
    _snowStop();
    return;
  }

  const dt = snow.lastTs ? Math.min(0.05, (ts - snow.lastTs) / 1000) : 0;
  snow.lastTs = ts;

  const ctx = snow.ctx;
  ctx.clearRect(0, 0, snow.w, snow.h);

  // Slow-varying global wind adds realism without syncing flakes.
  const booting = document.body?.classList.contains("booting");
  const windMult = booting ? 1.75 : 1;
  const wind = (Math.sin(ts * 0.00008) * 8 + Math.sin(ts * 0.00023) * 3) * windMult;

  // Draw far -> near for depth cue.
  for(const f of snow.flakes){
    if(dt){
      f.y += f.vy * dt;
      f.xBase += (f.vx + wind * (0.08 + f.z * 0.06)) * dt;

      // Wrap X softly.
      if(f.xBase < -40) f.xBase += snow.w + 80;
      if(f.xBase > snow.w + 40) f.xBase -= snow.w + 80;

      // Respawn above when passing bottom.
      if(f.y > snow.h + 20){
        f.y = _snowRand(-60, -10);
        f.xBase = _snowRand(0, snow.w);
        // Small random drift change to avoid patterns.
        f.vx = _snowClamp(f.vx + _snowRand(-3, 3), -22, 22);
        f.phase = _snowRand(0, Math.PI * 2);
      }
    }

    const x = f.xBase + Math.sin(f.phase + ts * 0.001 * f.freq) * f.amp;

    ctx.globalAlpha = f.a;
    ctx.beginPath();
    ctx.arc(x, f.y, f.r, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  snow.rafId = requestAnimationFrame(_snowTick);
}

function initSnowfall(){
  if(!snow.canvas) snow.canvas = document.getElementById("snowCanvas");
  if(!snow.canvas) return;
  if(!_snowShouldRun()) return;

  const ctx = snow.canvas.getContext("2d", { alpha: true, desynchronized: true });
  if(!ctx) return;
  snow.ctx = ctx;

  _snowResize();
  _snowSeedFlakes();

  // Keep it responsive.
  window.addEventListener("resize", () => {
    _snowResize();
    _snowSeedFlakes();
  }, { passive: true });

  document.addEventListener("visibilitychange", () => {
    if(document.visibilityState === "visible" && _snowShouldRun()){
      if(!snow.running){
        snow.running = true;
        snow.lastTs = 0;
        snow.rafId = requestAnimationFrame(_snowTick);
      }
    }
  });

  snow.running = true;
  snow.lastTs = 0;
  snow.rafId = requestAnimationFrame(_snowTick);
}

function bootElapsedMs(){
  const now = (globalThis.performance && typeof performance.now === "function") ? performance.now() : Date.now();
  return now - BOOT_SPLASH_START_MS;
}

async function finishBootSplash(){
  const remaining = Math.max(0, BOOT_SPLASH_MIN_MS - bootElapsedMs());
  if(remaining > 0){
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
  document.body?.classList.remove("booting");

  // Ensure the progress UI ends at 100%.
  if(el.bootPercent) el.bootPercent.textContent = "100%";
  if(el.bootRingFill){
    el.bootRingFill.style.strokeDashoffset = "0";
  }
  stopBootProgress();

  // Drop snowfall intensity back to normal after boot.
  try{ _snowSeedFlakes(); }catch(_e){}
}

// ---- Storage keys (localStorage) ----
const LS = {
  lang: "wi_lang",
  selftest: "wi_selftest",
  players: "wi_players",
  playersMode: "wi_players_mode", // "preset" | "custom"
  hint: "wi_hint",
  hidden: "wi_hidden",
  difficulty: "wi_difficulty", // all|easy|medium|hard
  categories: "wi_categories", // comma-separated keys; empty = all
  lastSecret: "wi_last_secret", // last picked secret (to reduce immediate repeats)
  twoImpostors: "wi_two_impostors", // 20% (1:5) chance for two impostors
  detectiveHint: "wi_detective_hint", // detectives see category
  impostorKnows: "wi_impostor_knows", // impostor knows they are impostor
  showImpostorCount: "wi_show_impostor_count" // impostor sees how many impostors
};

const storage = {
  get(key, fallback=null){
    try{
      const v = localStorage.getItem(key);
      return v === null ? fallback : v;
    }catch(_e){
      return fallback;
    }
  },
  set(key, value){
    try{ localStorage.setItem(key, String(value)); }catch(_e){}
  },
  getBool(key, fallback=false){
    const v = this.get(key, null);
    if(v === null) return fallback;
    return v === "1" || v === "true";
  },
  setBool(key, value){
    this.set(key, value ? "1" : "0");
  }
};

const $ = (id) => document.getElementById(id);

const CATEGORY_KEYS = ["space","food","animal","person","vehicle","place","nature","activity","thing","movies","music","kinojuha","intti","suomi"]; // keep in sync with i18n
const DIFF_KEYS = ["all","easy","medium","hard"];

const DEFAULT_SETTINGS = Object.freeze({
  players: 3,
  playersMode: "preset", // "preset" | "custom"
  difficulty: "all",
  categories: [], // empty = all

  detectiveHint: false,
  impostorHint: true,
  impostorKnows: true,
  hiddenImpostor: false,
  showImpostorCount: false,
  twoImpostors: true,
});

let WORD_BANK = [];

// Loaded from i18n.json
let I18N = { en: {}, fi: {} };

const state = {
  lang: "fi",
  totalPlayers: 0,
  currentPlayer: 1,
  impostorPlayers: [],
  secret: null,
  decoy: null,
  pool: [],
  dealing: false,
  impostorHintEnabled: true,
  hiddenImpostorEnabled: false,
  twoImpostorsEnabled: true,
  detectiveHintEnabled: false,
  impostorKnowsEnabled: true,
  showImpostorCountEnabled: false,
  difficulty: "all",
  selectedCats: [], // empty = all
  deckKey: "",
  deck: [],
  revealCountdown: 0,
  revealTimer: null,
  resultsVisible: false,
};

// Cache DOM references (filled in bootstrap)
let el = {};
function cacheDom(){
  el = {
    html: document.documentElement,

    bootSplash: $("bootSplash"),
    appRoot: $("appRoot"),
    bootPercent: $("bootPercent"),
    bootRingFill: $("bootRingFill"),

    snowCanvas: $("snowCanvas"),

    titleText: $("titleText"),
    taglineText: $("taglineText"),

    playersLabel: $("playersLabel"),
    customBtn: $("customBtn"),
    difficultyLabel: $("difficultyLabel"),
    categoriesLabel: $("categoriesLabel"),
    difficultySeg: $("difficultySeg"),
    categoryChips: $("categoryChips"),

    impostorHintName: $("impostorHintName"),
    hiddenImpostorName: $("hiddenImpostorName"),
    twoImpostorsName: $("twoImpostorsName"),
    doneText: $("doneText"),
    doneSub: $("doneSub"),

    langEn: $("langEn"),
    langFi: $("langFi"),

    setupPanel: $("setupPanel"),
    dealPanel: $("dealPanel"),
    donePanel: $("donePanel"),

    playerQuick: $("playerQuick"),
    playersInput: $("playersInput"),
    impostorHintToggle: $("impostorHintToggle"),
    hiddenImpostorToggle: $("hiddenImpostorToggle"),
    twoImpostorsToggle: $("twoImpostorsToggle"),
    detectiveHintToggle: $("detectiveHintToggle"),
    impostorKnowsToggle: $("impostorKnowsToggle"),
    showImpostorCountToggle: $("showImpostorCountToggle"),
    impostorHintState: $("impostorHintState"),
    hiddenImpostorState: $("hiddenImpostorState"),
    twoImpostorsState: $("twoImpostorsState"),
    detectiveHintState: $("detectiveHintState"),
    impostorKnowsState: $("impostorKnowsState"),
    showImpostorCountState: $("showImpostorCountState"),
    detectiveHintName: $("detectiveHintName"),
    impostorKnowsName: $("impostorKnowsName"),
    showImpostorCountName: $("showImpostorCountName"),

    startBtn: $("startBtn"),

    playerHeading: $("playerHeading"),
    progressText: $("progressText"),

    faceDown: $("faceDown"),
    faceUp: $("faceUp"),
    revealBtn: $("revealBtn"),
    closeCardBtn: $("closeCardBtn"),

    exitGameBtn: $("exitGameBtn"),

    cardLabel: $("cardLabel"),
    cardMain: $("cardMain"),

    impostorHintBox: $("impostorHintBox"),
    impostorHintLabel: $("impostorHintLabel"),
    impostorHintText: $("impostorHintText"),

    impostorCountBox: $("impostorCountBox"),
    impostorCountLabel: $("impostorCountLabel"),
    impostorCountText: $("impostorCountText"),

    newGameBtn: $("newGameBtn"),
    revealResultsBtn: $("revealResultsBtn"),
    resultsBox: $("resultsBox"),
    resultWordLabel: $("resultWordLabel"),
    resultWord: $("resultWord"),
    resultImpostorLabel: $("resultImpostorLabel"),
    resultImpostor: $("resultImpostor"),
    resultDetectiveLabel: $("resultDetectiveLabel"),
    resultDetective: $("resultDetective"),

    diffAll: $("diffAll"),
    diffEasy: $("diffEasy"),
    diffMedium: $("diffMedium"),
    diffHard: $("diffHard"),

    footerTop: $("footerTop"),
    footerBottom: $("footerBottom"),
    selfTestBtn: $("selfTestBtn"),
    repoBtn: $("repoBtn"),
    rulesBtn: $("rulesBtn"),
    resetSettingsBtn: $("resetSettingsBtn"),
    rulesModal: $("rulesModal"),
    rulesBackdrop: $("rulesBackdrop"),
    rulesTitle: $("rulesTitle"),
    rulesBody: $("rulesBody"),
    rulesCloseBtn: $("rulesCloseBtn"),
    toast: $("toast"),
  };
}

let _rulesLastFocus = null;

// ---- Hold-to-reveal countdown (tenths) ----
const HOLD_REVEAL_MS = 1000;
const HOLD_STEP_MS = 100;
let holdTimer = null;
let holdRemainingMs = 0;

// ---- Exit game (hold-to-exit, like card reveal) ----
const EXIT_HOLD_MS = 3000;
let exitHoldTimer = null;
let exitRemainingMs = 0;

// ---- Wake lock (best effort) ----
let wakeLock = null;

// ---- Repo ----
const REPO_URL = "https://github.com/mielipuolinen/word-impostor/";

function inferDifficultyFromText(en, fi){
  const a = String(en || "").trim();
  const b = String(fi || "").trim();
  const maxLen = Math.max(a.length, b.length);
  const hasSpace = a.includes(" ") || b.includes(" ");
  if(maxLen >= 13) return "hard";
  if(hasSpace || maxLen >= 8) return "medium";
  return "easy";
}

function normalizeWord(raw){
  if(!raw) return null;
  const en = String(raw.en || "").trim();
  const fi = String(raw.fi || "").trim();
  if(!en || !fi) return null;

  const cats = Array.isArray(raw.cats) ? raw.cats.map(String).map(s => s.trim()).filter(Boolean) : [];
  const safeCats = cats.length ? cats : ["thing"];
  const diff = DIFF_KEYS.includes(raw.diff) ? raw.diff : inferDifficultyFromText(en, fi);

  return { en, fi, cats: safeCats, diff };
}

function normalizeWordList(parsed){
  const words = Array.isArray(parsed?.words) ? parsed.words : [];
  const out = [];
  for(const w of words){
    const n = normalizeWord(w);
    if(n) out.push(n);
  }
  return out;
}

async function loadWordBankFromFile(url){
  try{
    const res = await fetch(url, { cache: "no-cache" });
    if(!res.ok) throw new Error("HTTP " + res.status);
    const parsed = await res.json();
    return normalizeWordList(parsed);
  }catch(e){
    console.warn("Failed to load word bank from " + url, e);
    return [];
  }
}

async function loadWordBank(){
  return await loadWordBankFromFile("./words.json");
}

async function loadI18n(){
  try{
    const res = await fetch("./i18n.json", { cache: "no-cache" });
    if(!res.ok) throw new Error("HTTP " + res.status);
    const parsed = await res.json();
    if(parsed && typeof parsed === "object") I18N = parsed;
  }catch(e){
    console.warn("Failed to load i18n.json", e);
  }
}

function escapeHtml(s){
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInlineMd(text){
  const esc = escapeHtml(text);
  // Bold/italic (simple, non-nested)
  return esc
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function renderSimpleMarkdown(md){
  const lines = String(md || "").split(/\r?\n/);
  const out = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if(inUl){ out.push("</ul>"); inUl = false; }
    if(inOl){ out.push("</ol>"); inOl = false; }
  };

  for(const rawLine of lines){
    const line = rawLine.trim();
    if(!line){
      closeLists();
      continue;
    }

    const h3 = line.match(/^###\s+(.+)$/);
    if(h3){
      closeLists();
      out.push(`<h3>${renderInlineMd(h3[1].trim())}</h3>`);
      continue;
    }

    const ol = line.match(/^\d+\.\s+(.+)$/);
    if(ol){
      if(inUl){ out.push("</ul>"); inUl = false; }
      if(!inOl){ out.push("<ol>"); inOl = true; }
      out.push(`<li>${renderInlineMd(ol[1].trim())}</li>`);
      continue;
    }

    const ul = line.match(/^[-*]\s+(.+)$/);
    if(ul){
      if(inOl){ out.push("</ol>"); inOl = false; }
      if(!inUl){ out.push("<ul>"); inUl = true; }
      out.push(`<li>${renderInlineMd(ul[1].trim())}</li>`);
      continue;
    }

    closeLists();
    out.push(`<p>${renderInlineMd(line.trim())}</p>`);
  }

  closeLists();
  return out.join("\n");
}

function extractRulesSectionFromMd(md){
  const lines = String(md || "").split(/\r?\n/);
  let start = -1;
  for(let i = 0; i < lines.length; i++){
    if(/^##\s+Pelisäännöt\b/i.test(lines[i].trim())){
      start = i + 1;
      break;
    }
  }
  if(start === -1) return null;

  let end = lines.length;
  for(let i = start; i < lines.length; i++){
    if(/^##\s+/.test(lines[i].trim())){ end = i; break; }
  }
  const section = lines.slice(start, end).join("\n").trim();
  return section || null;
}

async function loadRulesHtml(){
  // Finnish rules live in Sanahuijari.md; English uses in-app text.
  if(state.lang !== "fi") return t("rulesFallbackHtml");

  try{
    const res = await fetch("./Sanahuijari.md", { cache: "no-cache" });
    if(!res.ok) throw new Error("HTTP " + res.status);
    const md = await res.text();
    const section = extractRulesSectionFromMd(md);
    if(!section) return t("rulesFallbackHtml");
    return renderSimpleMarkdown(section);
  }catch(e){
    console.warn("Failed to load Sanahuijari.md rules", e);
    return null;
  }
}

async function openRules(){
  if(!el.rulesModal || !el.rulesBody) return;
  _rulesLastFocus = document.activeElement;
  document.body.classList.add("modal-open");
  el.rulesModal.classList.remove("hidden");

  if(el.rulesTitle) el.rulesTitle.textContent = t("rulesTitle");
  if(el.rulesCloseBtn){
    el.rulesCloseBtn.setAttribute("aria-label", t("rulesClose"));
    el.rulesCloseBtn.title = t("rulesClose");
  }
  el.rulesBody.innerHTML = `<p>${escapeHtml(t("rulesLoading"))}</p>`;

  const html = await loadRulesHtml();
  if(html){
    el.rulesBody.innerHTML = html;
  }else{
    el.rulesBody.innerHTML = `<p>${escapeHtml(t("rulesError"))}</p>` + (t("rulesFallbackHtml") || "");
  }

  // Focus close button for accessibility.
  setTimeout(() => el.rulesCloseBtn?.focus(), 0);
}

function closeRules(){
  if(!el.rulesModal) return;
  el.rulesModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
  const target = _rulesLastFocus;
  _rulesLastFocus = null;
  if(target && typeof target.focus === "function"){
    setTimeout(() => target.focus(), 0);
  }
}

function ensureArrays(){
  if(!Array.isArray(state.selectedCats)) state.selectedCats = [];
  if(!Array.isArray(state.pool)) state.pool = [];
  if(!Array.isArray(state.deck)) state.deck = [];
  if(!Array.isArray(state.impostorPlayers)) state.impostorPlayers = [];
}

function t(key, ...args){
  const current = I18N[state.lang] || null;
  const primary = I18N.fi || null;
  const fallback = I18N.en || null;

  const v = (current && current[key] != null) ? current[key]
    : (primary && primary[key] != null) ? primary[key]
    : (fallback && fallback[key] != null) ? fallback[key]
    : null;

  if(v == null) return key;
  if(typeof v === "function") return v(...args);
  if(typeof v === "string") return formatI18nTemplate(v, args);
  return String(v);
}

function formatI18nTemplate(template, args){
  const str = String(template);
  if(!args || args.length === 0) return str;

  // Named placeholders: t(key, {name: value}) => "Hello {name}".
  const first = args[0];
  if(args.length === 1 && first && typeof first === "object" && !Array.isArray(first)){
    return str.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (m, name) => {
      const v = first[name];
      return (v === undefined || v === null) ? m : String(v);
    });
  }

  // Positional placeholders: {0}, {1} …
  // Back-compat: also supports {n} / {s} as alias for the first argument.
  return str
    .replace(/\{(\d+)\}/g, (m, idxStr) => {
      const idx = Number(idxStr);
      const v = args[idx];
      return (v === undefined || v === null) ? m : String(v);
    })
    .replace(/\{[ns]\}/g, (m) => {
      const v = args[0];
      return (v === undefined || v === null) ? m : String(v);
    });
}

function iconSvg(){
  // Icon is now PNG-based, this function kept for compatibility but returns empty.
  return '';
}

function dataUriSvg(svg){
  return "data:image/svg+xml," + encodeURIComponent(svg)
    .replace(/%0A/g, "")
    .replace(/%20/g, " ");
}

function applyAppMetaAndManifest(){
  // Meta only. Manifest + icons are static files for better PWA compatibility.
  const desc = t("meta_desc");
  const title = t("title");

  const descMeta = document.getElementById("descMeta");
  if(descMeta) descMeta.setAttribute("content", desc);

  const appNameMeta = document.getElementById("appNameMeta");
  if(appNameMeta) appNameMeta.setAttribute("content", title);

  const appleTitleMeta = document.getElementById("appleTitleMeta");
  if(appleTitleMeta) appleTitleMeta.setAttribute("content", title);

  const ogTitleMeta = document.getElementById("ogTitleMeta");
  if(ogTitleMeta) ogTitleMeta.setAttribute("content", title);

  const ogDescMeta = document.getElementById("ogDescMeta");
  if(ogDescMeta) ogDescMeta.setAttribute("content", desc);
}

function detectInitialLanguage(){
  const saved = storage.get(LS.lang, null);
  if(saved === "fi" || saved === "en") return saved;
  // Default to Finnish (device/browser language is ignored unless user explicitly switches).
  return "fi";
}

function updateToggleStateLabels(){
  const onText = t("toggle_on");
  const offText = t("toggle_off");
  if(el.impostorHintState && el.impostorHintToggle){
    el.impostorHintState.textContent = el.impostorHintToggle.checked ? onText : offText;
  }
  if(el.hiddenImpostorState && el.hiddenImpostorToggle){
    el.hiddenImpostorState.textContent = el.hiddenImpostorToggle.checked ? onText : offText;
  }
  if(el.twoImpostorsState && el.twoImpostorsToggle){
    el.twoImpostorsState.textContent = el.twoImpostorsToggle.checked ? onText : offText;
  }
  if(el.detectiveHintState && el.detectiveHintToggle){
    el.detectiveHintState.textContent = el.detectiveHintToggle.checked ? onText : offText;
  }
  if(el.impostorKnowsState && el.impostorKnowsToggle){
    el.impostorKnowsState.textContent = el.impostorKnowsToggle.checked ? onText : offText;
  }
  if(el.showImpostorCountState && el.showImpostorCountToggle){
    el.showImpostorCountState.textContent = el.showImpostorCountToggle.checked ? onText : offText;
  }
}

function hydrateI18nAttributePlaceholders(root = document){
  const attrs = ["aria-label", "title"]; // keep scope tight; visible texts are handled elsewhere
  for(const attr of attrs){
    const nodes = root.querySelectorAll(`[${attr}^="i18n:"]`);
    for(const node of nodes){
      const raw = node.getAttribute(attr) || "";
      const key = raw.startsWith("i18n:") ? raw.slice(5).trim() : "";
      if(!key) continue;
      const val = t(key);
      if(val && typeof val === "string") node.setAttribute(attr, val);
    }
  }
}

function setLanguage(lang){
  state.lang = (lang === "fi") ? "fi" : "en";
  storage.set(LS.lang, state.lang);

  // Defensive: el.html should always exist, but guard anyway.
  if(el.html) el.html.lang = state.lang;

  el.langEn?.classList.toggle("active", state.lang === "en");
  el.langFi?.classList.toggle("active", state.lang === "fi");

  if(el.titleText) el.titleText.textContent = t("title");
  if(el.taglineText) el.taglineText.textContent = t("tagline");
  // Keep <head> metadata authored in Finnish and static; UI language changes should not rewrite SEO/social metadata.

  if(el.playersLabel) el.playersLabel.textContent = t("players");
  if(el.customBtn) el.customBtn.textContent = t("custom");

  if(el.difficultyLabel) el.difficultyLabel.textContent = t("difficulty");
  if(el.categoriesLabel) el.categoriesLabel.textContent = t("categories");

  if(el.diffAll) el.diffAll.textContent = t("all");
  if(el.diffEasy) el.diffEasy.textContent = t("diff_easy");
  if(el.diffMedium) el.diffMedium.textContent = t("diff_medium");
  if(el.diffHard) el.diffHard.textContent = t("diff_hard");

  if(el.impostorHintName) el.impostorHintName.textContent = t("impostorHint");
  if(el.hiddenImpostorName) el.hiddenImpostorName.textContent = t("hiddenImpostor");
  if(el.twoImpostorsName) el.twoImpostorsName.textContent = t("twoImpostors");
  if(el.detectiveHintName) el.detectiveHintName.textContent = t("detectiveHint");
  if(el.impostorKnowsName) el.impostorKnowsName.textContent = t("impostorKnows");
  if(el.showImpostorCountName) el.showImpostorCountName.textContent = t("showImpostorCount");
  if(el.startBtn) el.startBtn.textContent = t("start");
  if(el.revealBtn && !state.revealCountdown) el.revealBtn.textContent = t("holdToReveal");
  if(el.closeCardBtn) el.closeCardBtn.textContent = t("close");
  if(el.cardLabel) el.cardLabel.textContent = t("card_word");
  if(el.doneText) el.doneText.textContent = t("doneTitle");
  if(el.doneSub) el.doneSub.textContent = t("doneBody");
  if(el.newGameBtn) el.newGameBtn.textContent = t("newGame");
  if(el.revealResultsBtn) el.revealResultsBtn.textContent = state.resultsVisible ? t("hideResults") : t("revealResults");
  if(el.resultWordLabel) el.resultWordLabel.textContent = t("secretWordWas");
  if(el.resultImpostorLabel) el.resultImpostorLabel.textContent = state.impostorPlayers.length > 1 ? t("impostorsWere") : t("impostorWas");
  if(el.resultDetectiveLabel){
    const detectives = [];
    for(let n = 1; n <= state.totalPlayers; n++){
      if(!state.impostorPlayers.includes(n)) detectives.push(n);
    }
    el.resultDetectiveLabel.textContent = detectives.length > 1 ? t("detectivesWere") : t("detectiveWas");
  }
  if(el.footerTop) el.footerTop.textContent = t("footerTop");
  if(el.footerBottom) el.footerBottom.textContent = t("footerBottom");
  if(el.selfTestBtn){
    el.selfTestBtn.setAttribute("aria-label", t("selfTest"));
    el.selfTestBtn.title = t("selfTest");
  }
  if(el.repoBtn){
    el.repoBtn.setAttribute("aria-label", t("repo"));
    el.repoBtn.title = t("repo");
  }
  if(el.rulesBtn){
    el.rulesBtn.textContent = t("rulesBtn");
    el.rulesBtn.setAttribute("aria-label", t("rulesBtn"));
    el.rulesBtn.title = t("rulesBtn");
  }

  if(el.resetSettingsBtn){
    el.resetSettingsBtn.textContent = t("resetSettingsBtn");
    el.resetSettingsBtn.setAttribute("aria-label", t("resetSettingsBtn"));
    el.resetSettingsBtn.title = t("resetSettingsBtn");
  }

  if(el.exitGameBtn){
    el.exitGameBtn.textContent = t("exitGameBtn");
    el.exitGameBtn.setAttribute("aria-label", t("exitGameBtn"));
    el.exitGameBtn.title = t("exitGameBtn");
  }

  hydrateI18nAttributePlaceholders();

  updateToggleStateLabels();
  renderCategoryChips();

  if(el.dealPanel && !el.dealPanel.classList.contains("hidden")){
    updateDealUI();
    if(el.faceUp && !el.faceUp.classList.contains("hidden")) revealCard(true);
  }

  if(el.donePanel && !el.donePanel.classList.contains("hidden")){
    updateDonePanel();
  }
}

function randInt(min, maxInclusive){
  const range = (maxInclusive - min + 1);
  if(range <= 1) return min;

  const c = (globalThis.crypto && globalThis.crypto.getRandomValues) ? globalThis.crypto : null;
  if(c){
    const max = 0xFFFFFFFF;
    const limit = max - ((max + 1) % range);
    const buf = new Uint32Array(1);
    let x = 0;
    do{
      c.getRandomValues(buf);
      x = buf[0];
    }while(x > limit);
    return min + (x % range);
  }
  return min + Math.floor(Math.random() * range);
}

// 20% (1:5) chance for TWO impostors instead of one.
// For 3 players we keep it to 1 impostor (two impostors with 3 players tends to be too skewed).
// 20% (1:5) chance for TWO impostors instead of one (optional toggle).
// For 3 players we keep it to 1 impostor (two impostors with 3 players tends to be too skewed).
function pickImpostorPlayers(total, opts = {}){
  const rngInt = opts.rngInt || randInt;
  const allowTwo = !!opts.allowTwo;
  const chance = typeof opts.chance === "number" ? opts.chance : 0.20;

  const wantTwo = allowTwo && (total >= 4) && (rngInt(1, 100) <= Math.round(chance * 100));
  if(!wantTwo) return [rngInt(1, total)];

  const a = rngInt(1, total);
  let b = rngInt(1, total - 1);
  if(b >= a) b += 1; // ensure b != a
  return [a, b].sort((x,y) => x - y);
}

function shuffleInPlace(arr){
  for(let i = arr.length - 1; i > 0; i--){
    const j = randInt(0, i);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function currentPoolKey(){
  ensureArrays();
  const cats = state.selectedCats.length ? state.selectedCats.slice().sort().join(".") : "__all__";
  return `${state.difficulty}|${cats}`;
}

function ensureDeckForPool(pool){
  ensureArrays();
  const key = currentPoolKey();
  if(state.deckKey !== key || state.deck.length === 0){
    state.deckKey = key;
    state.deck = pool.slice();
    shuffleInPlace(state.deck);
  }
}

function showPanel(which){
  el.setupPanel?.classList.toggle("hidden", which !== "setup");
  el.dealPanel?.classList.toggle("hidden", which !== "deal");
  el.donePanel?.classList.toggle("hidden", which !== "done");
}

function updateDealUI(){
  el.playerHeading && (el.playerHeading.textContent = t("player", state.currentPlayer));
  el.progressText && (el.progressText.textContent = `${state.currentPlayer} / ${state.totalPlayers}`);
  el.faceDown?.classList.remove("hidden");
  el.faceUp?.classList.add("hidden");
  if(el.cardLabel) el.cardLabel.textContent = t("card_word");
}

function normalizeCats(entry){
  const cats = entry?.cats;
  return Array.isArray(cats) && cats.length ? cats : ["thing"];
}

function getHintCategories(word){
  const cats = normalizeCats(word);
  const uniq = Array.from(new Set(cats));
  uniq.sort((a,b) => {
    const ia = CATEGORY_KEYS.indexOf(a);
    const ib = CATEGORY_KEYS.indexOf(b);
    if(ia === -1 && ib === -1) return String(a).localeCompare(String(b));
    if(ia === -1) return 1;
    if(ib === -1) return -1;
    return ia - ib;
  });
  return uniq;
}

function categoryText(keys){
  return keys
    .map(k => (I18N[state.lang][`cat_${k}`] ?? I18N.en[`cat_${k}`] ?? k))
    .join(" / ");
}

function intersectsCats(a=[], b=[]){
  for(const x of a){
    if(b.includes(x)) return true;
  }
  return false;
}

function buildPool(){
  ensureArrays();
  let pool = WORD_BANK.slice();
  if(state.difficulty !== "all"){
    pool = pool.filter(w => w.diff === state.difficulty);
  }
  if(state.selectedCats.length){
    const set = new Set(state.selectedCats);
    pool = pool.filter(w => normalizeCats(w).some(c => set.has(c)));
  }
  return pool;
}

function chooseSecret(){
  ensureArrays();
  const pool = (state.pool && state.pool.length) ? state.pool : WORD_BANK;
  if(!pool.length){
    state.secret = null;
    return;
  }

  ensureDeckForPool(pool);

  let pick = state.deck.pop() || null;

  const last = storage.get(LS.lastSecret, "");
  if(pick && last && pick.en === last && state.deck.length){
    state.deck.unshift(pick);
    pick = state.deck.pop() || pick;
  }

  state.secret = pick;
  storage.set(LS.lastSecret, state.secret?.en || "");
}

function chooseDecoyForSecret(secret){
  if(!secret) return null;
  const cats = getHintCategories(secret);
  const basePool = state.pool && state.pool.length ? state.pool : WORD_BANK;
  const withoutSecret = basePool.filter(w => w !== secret);

  const sameDiff = withoutSecret.filter(w => w.diff === secret.diff);
  const strong = sameDiff.filter(w => intersectsCats(normalizeCats(w), cats));
  const weak = withoutSecret.filter(w => intersectsCats(normalizeCats(w), cats));

  const pool = strong.length ? strong : (weak.length ? weak : withoutSecret);
  return pool.length ? pool[randInt(0, pool.length - 1)] : null;
}

function clampPlayers(v){
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.max(3, n) : 3;
}

function setActiveQuick(value){
  const btns = el.playerQuick?.querySelectorAll(".quickbtn") || [];
  btns.forEach(b => b.classList.toggle("active", b.dataset.count === String(value)));
}

function usePresetCount(n){
  if(!el.playersInput) return;
  el.playersInput.value = String(n);
  el.playersInput.classList.add("hidden");
  setActiveQuick(String(n));
  storage.set(LS.playersMode, "preset");
  storage.set(LS.players, n);
}

function useCustomCount(){
  if(!el.playersInput) return;
  setActiveQuick("custom");
  el.playersInput.classList.remove("hidden");
  if(Number(el.playersInput.value) < 3) el.playersInput.value = "3";
  el.playersInput.focus();
  el.playersInput.select();
  storage.set(LS.playersMode, "custom");
  storage.set(LS.players, el.playersInput.value);
}

function setDifficulty(diff){
  state.difficulty = DIFF_KEYS.includes(diff) ? diff : "all";
  storage.set(LS.difficulty, state.difficulty);
  const btns = el.difficultySeg?.querySelectorAll(".segbtn") || [];
  btns.forEach(b => b.classList.toggle("active", b.dataset.diff === state.difficulty));
  state.deck = [];
  state.deckKey = "";
}

function setSelectedCats(keys){
  const normalized = (Array.isArray(keys) ? keys : [])
    .map(String)
    .map(s => s.trim())
    .filter(k => CATEGORY_KEYS.includes(k));

  state.selectedCats = Array.from(new Set(normalized));
  storage.set(LS.categories, state.selectedCats.join(","));
  state.deck = [];
  state.deckKey = "";
  renderCategoryChips();
}

function renderCategoryChips(){
  if(!el.categoryChips) return;
  ensureArrays();
  const selected = new Set(state.selectedCats);

  if(!el.categoryChips.dataset.ready){
    el.categoryChips.innerHTML = "";

    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = "chip";
    allBtn.dataset.cat = "__all__";
    allBtn.addEventListener("click", () => setSelectedCats([]));
    el.categoryChips.appendChild(allBtn);

    for(const key of CATEGORY_KEYS){
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.dataset.cat = key;
      btn.addEventListener("click", () => {
        ensureArrays();
        const next = new Set(state.selectedCats);
        if(next.has(key)) next.delete(key);
        else next.add(key);
        setSelectedCats(Array.from(next));
      });
      el.categoryChips.appendChild(btn);
    }

    el.categoryChips.dataset.ready = "1";
  }

  const children = Array.from(el.categoryChips.children);
  for(const btn of children){
    const key = btn.dataset.cat;
    if(key === "__all__"){
      btn.classList.remove("logo");
      btn.textContent = t("all");
      btn.classList.toggle("active", state.selectedCats.length === 0);
      continue;
    }

    // Special: Kinojuha uses a logo instead of text
    if(key === "kinojuha"){
      btn.classList.add("logo");
      btn.classList.toggle("active", selected.has(key));
      const label = t("cat_kinojuha");
      btn.setAttribute("aria-label", label);
      btn.setAttribute("title", label);

      if(!btn.dataset.logoReady){
        btn.textContent = "";
        const img = document.createElement("img");
        img.src = "https://www.kinojuha.fi/hosting/kinojuha.fi/graphics/logo.png";
        img.alt = label;
        img.decoding = "async";
        img.loading = "lazy";
        img.addEventListener("error", () => {
          // Fallback to text if the logo can't be loaded
          btn.classList.remove("logo");
          btn.textContent = label;
        }, { once: true });
        btn.appendChild(img);
        btn.dataset.logoReady = "1";
      }else{
        const img = btn.querySelector("img");
        if(img) img.alt = label;
      }
      continue;
    }

    btn.classList.remove("logo");
    btn.textContent = t(`cat_${key}`);
    btn.classList.toggle("active", selected.has(key));
  }
}

function setHintBoxVisible(visible){
  if(!el.impostorHintBox) return;
  el.impostorHintBox.classList.toggle("hidden", !visible);
}

function setImpostorCountBoxVisible(visible){
  if(!el.impostorCountBox) return;
  el.impostorCountBox.classList.toggle("hidden", !visible);
}

function revealCard(isRefresh=false){
  const isImpostor = Array.isArray(state.impostorPlayers) && state.impostorPlayers.includes(state.currentPlayer);
  const secret = state.secret;
  if(!el.cardMain || !el.cardLabel) return;

  // Determine what to show based on settings
  const showImpostorHint = isImpostor && state.impostorHintEnabled && !!secret;
  const showDetectiveHint = !isImpostor && state.detectiveHintEnabled && !!secret;
  const showImpostorCount = isImpostor && state.showImpostorCountEnabled && state.impostorPlayers.length > 0;

  if(isImpostor && !state.hiddenImpostorEnabled){
    // Impostor without decoy word
    if(state.impostorKnowsEnabled){
      el.cardLabel.classList.add("hidden");
      el.cardMain.textContent = t("youAreImpostor");
      el.cardMain.classList.add("imposter");
    }else{
      // Stealth mode: impostor doesn't know they're the impostor
      el.cardLabel.classList.add("hidden");
      el.cardMain.textContent = t("youAreImpostorHidden");
      el.cardMain.classList.add("imposter");
    }

    if(showImpostorHint){
      const cats = getHintCategories(secret);
      if(el.impostorHintText) el.impostorHintText.textContent = categoryText(cats);
      if(el.impostorHintLabel) el.impostorHintLabel.textContent = (cats.length > 1) ? t("categoriesLabel") : t("category");
      setHintBoxVisible(true);
    }else{
      setHintBoxVisible(false);
    }
  }else{
    // Detective or impostor with decoy word
    el.cardLabel.classList.remove("hidden");
    el.cardLabel.textContent = t("card_word");
    const entry = (isImpostor && state.hiddenImpostorEnabled) ? state.decoy : secret;
    el.cardMain.textContent = entry ? (entry[state.lang] || entry.en) : "";
    el.cardMain.classList.remove("imposter");

    // Show hint for detective or impostor with decoy
    if(showDetectiveHint || showImpostorHint){
      const cats = getHintCategories(secret);
      if(el.impostorHintText) el.impostorHintText.textContent = categoryText(cats);
      if(el.impostorHintLabel) el.impostorHintLabel.textContent = (cats.length > 1) ? t("categoriesLabel") : t("category");
      setHintBoxVisible(true);
    }else{
      setHintBoxVisible(false);
    }
  }

  // Show impostor count to impostors if enabled
  if(showImpostorCount){
    if(el.impostorCountText) el.impostorCountText.textContent = t("impostorCountHint", state.impostorPlayers.length);
    if(el.impostorCountLabel) el.impostorCountLabel.textContent = state.lang === "fi" ? "SANAHUIJARIT" : "IMPOSTORS";
    setImpostorCountBoxVisible(true);
  }else{
    setImpostorCountBoxVisible(false);
  }

  if(!isRefresh){
    el.faceDown?.classList.add("hidden");
    el.faceUp?.classList.remove("hidden");
  }
}

function hideCard(){
  el.faceUp?.classList.add("hidden");
  el.faceDown?.classList.remove("hidden");
  // Reset reveal button text
  if(el.revealBtn) el.revealBtn.textContent = t("holdToReveal");
}

function formatTenthsSeconds(ms){
  const s = Math.max(0, ms) / 1000;
  let out = s.toFixed(1);
  if(state.lang === "fi") out = out.replace(".", ",");
  return out;
}

function stopHoldTimer(){
  if(holdTimer){
    clearInterval(holdTimer);
    holdTimer = null;
  }
}

function cancelHoldCountdown(){
  stopHoldTimer();
  holdRemainingMs = 0;
  if(el.revealBtn) el.revealBtn.textContent = t("holdToReveal");
}

function startHoldCountdown(){
  stopHoldTimer();
  holdRemainingMs = HOLD_REVEAL_MS;
  if(el.revealBtn) el.revealBtn.textContent = t("revealing", formatTenthsSeconds(holdRemainingMs));

  holdTimer = setInterval(() => {
    holdRemainingMs -= HOLD_STEP_MS;
    if(holdRemainingMs <= 0){
      stopHoldTimer();
      revealCard(false);
      return;
    }
    if(el.revealBtn) el.revealBtn.textContent = t("revealing", formatTenthsSeconds(holdRemainingMs));
  }, HOLD_STEP_MS);
}

function stopExitHoldTimer(){
  if(exitHoldTimer){
    clearInterval(exitHoldTimer);
    exitHoldTimer = null;
  }
}

function cancelExitHold(){
  stopExitHoldTimer();
  exitRemainingMs = 0;
  if(el.exitGameBtn) el.exitGameBtn.textContent = t("exitGameBtn");
}

function exitToSetup(){
  cancelHoldCountdown();
  cancelExitHold();
  hideCard();
  newGame();
}

function startExitHold(){
  if(!el.exitGameBtn) return;
  if(exitHoldTimer) return;

  exitRemainingMs = EXIT_HOLD_MS;
  el.exitGameBtn.textContent = t("exitingIn", formatTenthsSeconds(exitRemainingMs));

  exitHoldTimer = setInterval(() => {
    exitRemainingMs -= HOLD_STEP_MS;
    if(exitRemainingMs <= 0){
      stopExitHoldTimer();
      exitToSetup();
      return;
    }
    el.exitGameBtn.textContent = t("exitingIn", formatTenthsSeconds(exitRemainingMs));
  }, HOLD_STEP_MS);
}

function nextPlayer(){
  if(state.currentPlayer >= state.totalPlayers){
    finishDealing();
    return;
  }
  state.currentPlayer += 1;
  updateDealUI();
}

function startGame(){
  if(!el.playersInput) return;
  ensureArrays();

  const total = clampPlayers(el.playersInput.value);
  el.playersInput.value = String(total);
  storage.set(LS.players, total);

  state.impostorHintEnabled = !!el.impostorHintToggle?.checked;
  state.hiddenImpostorEnabled = !!el.hiddenImpostorToggle?.checked;
  state.twoImpostorsEnabled = !!el.twoImpostorsToggle?.checked;
  state.detectiveHintEnabled = !!el.detectiveHintToggle?.checked;
  state.impostorKnowsEnabled = !!el.impostorKnowsToggle?.checked;
  state.showImpostorCountEnabled = !!el.showImpostorCountToggle?.checked;
  storage.setBool(LS.hint, state.impostorHintEnabled);
  storage.setBool(LS.hidden, state.hiddenImpostorEnabled);
  storage.setBool(LS.twoImpostors, state.twoImpostorsEnabled);
  storage.setBool(LS.detectiveHint, state.detectiveHintEnabled);
  storage.setBool(LS.impostorKnows, state.impostorKnowsEnabled);
  storage.setBool(LS.showImpostorCount, state.showImpostorCountEnabled);

  state.pool = buildPool();
  if(!state.pool.length){
    alert(t("alertNoWords"));
    return;
  }

  state.totalPlayers = total;
  state.currentPlayer = 1;
  state.impostorPlayers = pickImpostorPlayers(total, { allowTwo: state.twoImpostorsEnabled });
  chooseSecret();
  state.decoy = state.hiddenImpostorEnabled ? chooseDecoyForSecret(state.secret) : null;
  state.dealing = true;
  state.resultsVisible = false;

  showPanel("deal");
  updateDealUI();
  requestWakeLock();
}

function finishDealing(){
  cancelExitHold();
  state.dealing = false;
  hideCard();
  showPanel("done");
  updateDonePanel();
}

function updateDonePanel(){
  // Update labels for current language
  if(el.doneText) el.doneText.textContent = t("doneTitle");
  if(el.doneSub) el.doneSub.textContent = t("doneBody");
  if(el.revealResultsBtn) el.revealResultsBtn.textContent = state.resultsVisible ? t("hideResults") : t("revealResults");
  if(el.resultWordLabel) el.resultWordLabel.textContent = t("secretWordWas");
  if(el.resultImpostorLabel) el.resultImpostorLabel.textContent = state.impostorPlayers.length > 1 ? t("impostorsWere") : t("impostorWas");
  if(el.resultDetectiveLabel){
    const detectives = [];
    for(let n = 1; n <= state.totalPlayers; n++){
      if(!state.impostorPlayers.includes(n)) detectives.push(n);
    }
    el.resultDetectiveLabel.textContent = detectives.length > 1 ? t("detectivesWere") : t("detectiveWas");
  }

  // Populate results
  if(el.resultWord && state.secret){
    el.resultWord.textContent = state.secret[state.lang] || state.secret.en;
  }
  if(el.resultImpostor && state.impostorPlayers.length){
    const impostorText = state.impostorPlayers.map(n => t("player", n)).join(", ");
    el.resultImpostor.textContent = impostorText;
  }

  if(el.resultDetective){
    const detectives = [];
    for(let n = 1; n <= state.totalPlayers; n++){
      if(!state.impostorPlayers.includes(n)) detectives.push(n);
    }
    el.resultDetective.textContent = detectives.length ? detectives.map(n => t("player", n)).join(", ") : "";
  }

  // Show/hide results box
  if(el.resultsBox){
    el.resultsBox.classList.toggle("hidden", !state.resultsVisible);
  }
}

function toggleResults(){
  state.resultsVisible = !state.resultsVisible;
  updateDonePanel();
}

function newGame(){
  cancelExitHold();
  cancelHoldCountdown();
  state.totalPlayers = 0;
  state.currentPlayer = 1;
  state.impostorPlayers = [];
  state.secret = null;
  state.decoy = null;
  state.pool = [];
  state.resultsVisible = false;
  state.dealing = false;

  showPanel("setup");
  releaseWakeLock();
}

async function requestWakeLock(){
  try{
    if("wakeLock" in navigator){
      wakeLock = await navigator.wakeLock.request("screen");
    }
  }catch(_e){}
}

async function releaseWakeLock(){
  try{
    if(wakeLock){
      await wakeLock.release();
      wakeLock = null;
    }
  }catch(_e){}
}

function shouldRunTests(){
  const query = /(?:\?|&)test=1(?:&|$)/.test(location.search);
  return query || storage.getBool(LS.selftest, false);
}

function showToast(msg){
  if(!el.toast) return;
  el.toast.textContent = msg;
  el.toast.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.toast?.classList.add("hidden"), 2400);
}

function runSelfTests(){
  const snap = {
    lang: state.lang,
    difficulty: state.difficulty,
    selectedCats: Array.isArray(state.selectedCats) ? state.selectedCats.slice() : [],
    pool: state.pool,
    deck: Array.isArray(state.deck) ? state.deck.slice() : [],
    deckKey: state.deckKey,
    secret: state.secret,
    decoy: state.decoy,
    dealing: state.dealing,
  };

  try{
    console.assert(WORD_BANK.length > 0, "WORD_BANK should not be empty");

    // Snowfall sanity checks (skip on reduced motion unless force-motion)
    try{
      const forced = document.body?.classList.contains("force-motion");
      const reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      const canvas = document.getElementById("snowCanvas");
      console.assert(!!canvas, "Snow canvas element should exist");

      if((!reduceMotion || forced) && canvas){
        console.assert(canvas.width > 0 && canvas.height > 0, "Snow canvas should have a backing buffer");
        console.assert(!!snow && !!snow.running, "Snowfall renderer should be running");
      }
    }catch(e){
      console.warn("Snowfall self-test skipped:", e);
    }

    if(el.categoryChips){
      renderCategoryChips();
      console.assert(el.categoryChips.children.length >= 2, "Category chips should render (All + at least one category)");
    }

    const pineapple = WORD_BANK.find(w => w.en === "Pineapple");
    console.assert(!!pineapple, "Test word missing: Pineapple");
    console.assert(pineapple?.fi === "Ananas", "Finnish translation should be Ananas");

    {
      const prev = state.lang;
      state.lang = "en";
      console.assert(categoryText(getHintCategories(pineapple)) === "Food / Nature", "Hint should include all categories (EN)");
      state.lang = "fi";
      console.assert(categoryText(getHintCategories(pineapple)) === "Ruoka / Luonto", "Hint should include all categories (FI)");
      state.lang = prev;
    }

    {
      const prevLang = state.lang;
      state.lang = "en";
      console.assert(categoryText(["space","vehicle","suomi"]) === "Space / Vehicle / Finland", "EN categoryText failed");
      console.assert(categoryText(["kinojuha","movies"]) === "Kinojuha / Movies", "EN categoryText Kinojuha failed");
      console.assert(categoryText(["intti","suomi"]) === "Military service / Finland", "EN categoryText Intti failed");
      state.lang = "fi";
      console.assert(categoryText(["space","vehicle","suomi"]) === "Avaruus / Ajoneuvo / Suomi", "FI categoryText failed");
      console.assert(categoryText(["kinojuha","movies"]) === "Kinojuha / Elokuvat", "FI categoryText Kinojuha failed");
      console.assert(categoryText(["intti","suomi"]) === "Intti / Suomi", "FI categoryText Intti failed");
      state.lang = prevLang;
    }

    {
      const prevDiff = state.difficulty;
      const prevCats = Array.isArray(state.selectedCats) ? state.selectedCats.slice() : [];
      state.difficulty = "hard";
      state.selectedCats = ["space"];
      const pool = buildPool();
      console.assert(pool.every(w => w.diff === "hard"), "Pool should be hard only");
      console.assert(pool.every(w => w.cats.includes("space")), "Pool should be space category");
      state.difficulty = prevDiff;
      state.selectedCats = prevCats;
    }

    {
      const prevPool = state.pool;
      const rocket = WORD_BANK.find(w => w.en === "Rocket");
      console.assert(!!rocket, "Test word missing: Rocket");
      state.pool = WORD_BANK.filter(w => w.cats.includes("space"));
      const decoy = chooseDecoyForSecret(rocket);
      console.assert(decoy && decoy !== rocket, "Decoy should exist and differ from secret");
      console.assert(intersectsCats(normalizeCats(decoy), normalizeCats(rocket)), "Decoy should share a category");
      state.pool = prevPool;
    }

    if(el.impostorHintToggle && el.impostorHintState){
      const prevLang = state.lang;
      const prev = el.impostorHintToggle.checked;
      el.impostorHintToggle.checked = false;
      updateToggleStateLabels();
      console.assert(el.impostorHintState.textContent === I18N[prevLang].toggle_off, "Toggle OFF label should match language");
      el.impostorHintToggle.checked = prev;
      updateToggleStateLabels();
    }

    {
      const prevDiff = state.difficulty;
      const prevCats = Array.isArray(state.selectedCats) ? state.selectedCats.slice() : [];
      state.difficulty = "all";
      state.selectedCats = ["suomi"];
      const p = buildPool();
      console.assert(p.length > 0, "Suomi pool should not be empty");
      console.assert(p.every(w => w.cats.includes("suomi")), "Suomi pool words should include 'suomi' category");
      console.assert(p.some(w => w.fi === "Helsinki"), "Suomi pool should include Helsinki");
      state.selectedCats = ["intti"]; // Intti category should be selectable and have words
      const ip = buildPool();
      console.assert(ip.length > 0, "Intti pool should not be empty");
      console.assert(ip.every(w => w.cats.includes("intti")), "Intti pool words should include 'intti' category");
      console.assert(ip.some(w => w.fi === "Varusmies"), "Intti pool should include Varusmies");
      state.difficulty = prevDiff;
      state.selectedCats = prevCats;
    }

    {
      const prevPool = state.pool;
      const prevDeck = Array.isArray(state.deck) ? state.deck.slice() : [];
      const prevKey = state.deckKey;
      const prevDiff = state.difficulty;
      const prevCats = Array.isArray(state.selectedCats) ? state.selectedCats.slice() : [];
      const prevLast = storage.get(LS.lastSecret, "");

      const fake = [
        { en:"A", fi:"A", cats:["thing"], diff:"easy" },
        { en:"B", fi:"B", cats:["thing"], diff:"easy" },
        { en:"C", fi:"C", cats:["thing"], diff:"easy" }
      ];

      state.pool = fake;
      state.difficulty = "all";
      state.selectedCats = [];
      state.deck = [];
      state.deckKey = "";
      storage.set(LS.lastSecret, "");

      const picks = [];
      chooseSecret(); picks.push(state.secret?.en);
      chooseSecret(); picks.push(state.secret?.en);
      chooseSecret(); picks.push(state.secret?.en);
      const uniq = new Set(picks.filter(Boolean));
      console.assert(uniq.size === 3, "Deck should yield 3 unique picks before repeating");

      state.pool = prevPool;
      state.deck = prevDeck;
      state.deckKey = prevKey;
      state.difficulty = prevDiff;
      state.selectedCats = prevCats;
      storage.set(LS.lastSecret, prevLast);
    }

    {
      const makeSeqRng = (seq) => {
        let i = 0;
        return (_min, _max) => seq[Math.min(i++, seq.length - 1)];
      };

      const a = pickImpostorPlayers(5, { allowTwo: true, rngInt: makeSeqRng([1, 2, 2]) });
      console.assert(a.length === 2, "Should pick 2 impostors when chance triggers");
      console.assert(a[0] !== a[1], "Two impostors must be distinct");
      console.assert(a.every(n => n >= 1 && n <= 5), "Impostors must be within player range");

      const b = pickImpostorPlayers(5, { allowTwo: true, rngInt: makeSeqRng([100, 4]) });
      console.assert(b.length === 1, "Should pick 1 impostor when chance does not trigger");

      const d = pickImpostorPlayers(5, { allowTwo: false, rngInt: makeSeqRng([1, 2, 2]) });
      console.assert(d.length === 1, "When toggle is off, should always pick 1 impostor");

      const c = pickImpostorPlayers(3, { allowTwo: true, rngInt: makeSeqRng([1, 1]) });
      console.assert(c.length === 1, "For 3 players, should keep 1 impostor");
    }

  } finally {
    state.lang = snap.lang;
    state.difficulty = snap.difficulty;
    state.selectedCats = snap.selectedCats.slice();
    state.pool = snap.pool;
    state.deck = snap.deck.slice();
    state.deckKey = snap.deckKey;
    state.secret = snap.secret;
    state.decoy = snap.decoy;
    state.dealing = snap.dealing;

    console.assert(state.difficulty === snap.difficulty, "Self-tests must not change difficulty");
    console.assert(Array.isArray(state.selectedCats) && state.selectedCats.join(",") === snap.selectedCats.join(","), "Self-tests must not change categories");

    const btns = el.difficultySeg?.querySelectorAll(".segbtn") || [];
    btns.forEach(b => b.classList.toggle("active", b.dataset.diff === state.difficulty));
    renderCategoryChips();
    updateToggleStateLabels();
  }
}

function runSelfTestsWithReport(){
  const origAssert = console.assert;
  let fails = 0;
  console.assert = function(cond, ...args){
    if(!cond) fails += 1;
    origAssert.call(console, cond, ...args);
  };
  try{
    runSelfTests();
  }catch(e){
    fails += 1;
    console.error("Self-test threw:", e);
  }finally{
    console.assert = origAssert;
  }
  return { fails };
}

function setSelfTestEnabled(enabled, opts={runNow:false}){
  storage.setBool(LS.selftest, !!enabled);
  if(el.selfTestBtn){
    el.selfTestBtn.classList.toggle("active", !!enabled);
    el.selfTestBtn.setAttribute("aria-label", t("selfTest"));
    el.selfTestBtn.title = t("selfTest");
  }
  if(opts.runNow){
    const report = runSelfTestsWithReport();
    if(report.fails === 0) showToast(t("testsPassed"));
    else showToast(t("testsFailed", report.fails));
  }else{
    showToast(!!enabled ? t("testsOn") : t("testsOff"));
  }
}

function openRepo(e){
  e.preventDefault();
  window.open(REPO_URL, "_blank", "noopener,noreferrer");
}

function init(){
  ensureArrays();

  // Language
  setLanguage(detectInitialLanguage());

  // Restore toggles
  if(el.impostorHintToggle) el.impostorHintToggle.checked = storage.getBool(LS.hint, DEFAULT_SETTINGS.impostorHint);
  if(el.hiddenImpostorToggle) el.hiddenImpostorToggle.checked = storage.getBool(LS.hidden, DEFAULT_SETTINGS.hiddenImpostor);
  if(el.twoImpostorsToggle) el.twoImpostorsToggle.checked = storage.getBool(LS.twoImpostors, DEFAULT_SETTINGS.twoImpostors);
  if(el.detectiveHintToggle) el.detectiveHintToggle.checked = storage.getBool(LS.detectiveHint, DEFAULT_SETTINGS.detectiveHint);
  if(el.impostorKnowsToggle) el.impostorKnowsToggle.checked = storage.getBool(LS.impostorKnows, DEFAULT_SETTINGS.impostorKnows);
  if(el.showImpostorCountToggle) el.showImpostorCountToggle.checked = storage.getBool(LS.showImpostorCount, DEFAULT_SETTINGS.showImpostorCount);
  updateToggleStateLabels();

  // Restore difficulty
  const savedDiff = storage.get(LS.difficulty, DEFAULT_SETTINGS.difficulty);
  state.difficulty = DIFF_KEYS.includes(savedDiff) ? savedDiff : DEFAULT_SETTINGS.difficulty;
  const btns = el.difficultySeg?.querySelectorAll(".segbtn") || [];
  btns.forEach(b => b.classList.toggle("active", b.dataset.diff === state.difficulty));

  // Restore categories
  const savedCats = (storage.get(LS.categories, "") || "").split(",").map(s => s.trim()).filter(Boolean);
  setSelectedCats(savedCats);

  const resetSettingsToDefault = () => {
    usePresetCount(DEFAULT_SETTINGS.players);
    setDifficulty(DEFAULT_SETTINGS.difficulty);
    setSelectedCats(DEFAULT_SETTINGS.categories);

    if(el.detectiveHintToggle){
      el.detectiveHintToggle.checked = DEFAULT_SETTINGS.detectiveHint;
      storage.setBool(LS.detectiveHint, DEFAULT_SETTINGS.detectiveHint);
    }
    if(el.impostorHintToggle){
      el.impostorHintToggle.checked = DEFAULT_SETTINGS.impostorHint;
      storage.setBool(LS.hint, DEFAULT_SETTINGS.impostorHint);
    }
    if(el.impostorKnowsToggle){
      el.impostorKnowsToggle.checked = DEFAULT_SETTINGS.impostorKnows;
      storage.setBool(LS.impostorKnows, DEFAULT_SETTINGS.impostorKnows);
    }
    if(el.hiddenImpostorToggle){
      el.hiddenImpostorToggle.checked = DEFAULT_SETTINGS.hiddenImpostor;
      storage.setBool(LS.hidden, DEFAULT_SETTINGS.hiddenImpostor);
    }
    if(el.showImpostorCountToggle){
      el.showImpostorCountToggle.checked = DEFAULT_SETTINGS.showImpostorCount;
      storage.setBool(LS.showImpostorCount, DEFAULT_SETTINGS.showImpostorCount);
    }
    if(el.twoImpostorsToggle){
      el.twoImpostorsToggle.checked = DEFAULT_SETTINGS.twoImpostors;
      storage.setBool(LS.twoImpostors, DEFAULT_SETTINGS.twoImpostors);
    }
    updateToggleStateLabels();
  };

  el.resetSettingsBtn?.addEventListener("click", resetSettingsToDefault);

  // Persist on change
  el.impostorHintToggle?.addEventListener("change", () => {
    storage.setBool(LS.hint, !!el.impostorHintToggle.checked);
    updateToggleStateLabels();
  });
  el.hiddenImpostorToggle?.addEventListener("change", () => {
    storage.setBool(LS.hidden, !!el.hiddenImpostorToggle.checked);
    updateToggleStateLabels();
  });
  el.twoImpostorsToggle?.addEventListener("change", () => {
    storage.setBool(LS.twoImpostors, !!el.twoImpostorsToggle.checked);
    updateToggleStateLabels();
  });
  el.detectiveHintToggle?.addEventListener("change", () => {
    storage.setBool(LS.detectiveHint, !!el.detectiveHintToggle.checked);
    updateToggleStateLabels();
  });
  el.impostorKnowsToggle?.addEventListener("change", () => {
    storage.setBool(LS.impostorKnows, !!el.impostorKnowsToggle.checked);
    updateToggleStateLabels();
  });
  el.showImpostorCountToggle?.addEventListener("change", () => {
    storage.setBool(LS.showImpostorCount, !!el.showImpostorCountToggle.checked);
    updateToggleStateLabels();
  });

  // Difficulty clicks
  el.difficultySeg?.addEventListener("click", (e) => {
    const btn = e.target.closest("button.segbtn");
    if(!btn) return;
    setDifficulty(btn.dataset.diff);
  });

  // Player count restore
  const savedPlayers = clampPlayers(storage.get(LS.players, DEFAULT_SETTINGS.players));
  const mode = storage.get(LS.playersMode, "preset");
  if([3,4,5,6].includes(savedPlayers) && mode !== "custom") usePresetCount(savedPlayers);
  else{
    if(el.playersInput) el.playersInput.value = String(savedPlayers);
    useCustomCount();
  }

  // Quick buttons
  el.playerQuick?.addEventListener("click", (e) => {
    const btn = e.target.closest("button.quickbtn");
    if(!btn) return;
    const v = btn.dataset.count;
    if(v === "custom") useCustomCount();
    else usePresetCount(clampPlayers(v));
  });

  // Custom input changes -> keep storage updated
  el.playersInput?.addEventListener("input", () => {
    if(el.playersInput.classList.contains("hidden")) return;
    storage.set(LS.players, clampPlayers(el.playersInput.value));
  });

  // Enter key starts
  el.playersInput?.addEventListener("keydown", (e) => {
    if(e.key === "Enter") startGame();
  });

  // Language buttons
  el.langEn?.addEventListener("click", () => setLanguage("en"));
  el.langFi?.addEventListener("click", () => setLanguage("fi"));

  // Main actions
  el.startBtn?.addEventListener("click", startGame);

  // Reveal button with hold-to-reveal timer (1.0 second, tenths)
  if(el.revealBtn){
    el.revealBtn.addEventListener("mousedown", startHoldCountdown);
    el.revealBtn.addEventListener("touchstart", (e) => { e.preventDefault(); startHoldCountdown(); }, { passive: false });
    el.revealBtn.addEventListener("mouseup", cancelHoldCountdown);
    el.revealBtn.addEventListener("mouseleave", cancelHoldCountdown);
    el.revealBtn.addEventListener("touchend", cancelHoldCountdown);
    el.revealBtn.addEventListener("touchcancel", cancelHoldCountdown);
  }

  el.closeCardBtn?.addEventListener("click", () => { hideCard(); nextPlayer(); });

  // Exit game (hold to exit, release to cancel)
  if(el.exitGameBtn){
    el.exitGameBtn.addEventListener("mousedown", startExitHold);
    el.exitGameBtn.addEventListener("touchstart", (e) => { e.preventDefault(); startExitHold(); }, { passive: false });
    el.exitGameBtn.addEventListener("mouseup", cancelExitHold);
    el.exitGameBtn.addEventListener("mouseleave", cancelExitHold);
    el.exitGameBtn.addEventListener("touchend", cancelExitHold);
    el.exitGameBtn.addEventListener("touchcancel", cancelExitHold);
  }
  el.newGameBtn?.addEventListener("click", newGame);
  el.revealResultsBtn?.addEventListener("click", toggleResults);

  document.addEventListener("visibilitychange", () => {
    if(state.dealing && document.visibilityState === "visible") requestWakeLock();
  });

  // Repo button (subtle)
  if(el.repoBtn){
    el.repoBtn.setAttribute("aria-label", t("repo"));
    el.repoBtn.title = t("repo");
    el.repoBtn.addEventListener("click", openRepo);
  }

  // Rules button + modal
  if(el.rulesBtn){
    el.rulesBtn.setAttribute("aria-label", t("rulesBtn"));
    el.rulesBtn.title = t("rulesBtn");
    el.rulesBtn.addEventListener("click", openRules);
  }
  el.rulesCloseBtn?.addEventListener("click", closeRules);
  el.rulesBackdrop?.addEventListener("click", closeRules);
  document.addEventListener("keydown", (e) => {
    if(e.key === "Escape" && el.rulesModal && !el.rulesModal.classList.contains("hidden")) closeRules();
  });

  // Self-test toggle button (subtle)
  if(el.selfTestBtn){
    const enabled = storage.getBool(LS.selftest, false);
    el.selfTestBtn.classList.toggle("active", enabled);
    el.selfTestBtn.setAttribute("aria-label", t("selfTest"));
    el.selfTestBtn.title = t("selfTest");
    el.selfTestBtn.addEventListener("click", () => {
      const now = !storage.getBool(LS.selftest, false);
      setSelfTestEnabled(now, { runNow: now });
    });
  }

  showPanel("setup");

  if(shouldRunTests()){
    const report = runSelfTestsWithReport();
    if(storage.getBool(LS.selftest, false)){
      if(report.fails === 0) showToast(t("testsPassed"));
      else showToast(t("testsFailed", report.fails));
    }
  }

  if(!WORD_BANK.length){
    console.warn("No words loaded. Add words to words.json.");
  }

  // Register service worker for offline-capable PWA (best effort).
  if("serviceWorker" in navigator){
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
}

async function bootstrap(){
  cacheDom();
  // Start background snowfall ASAP.
  initSnowfall();
  initBootProgress();
  await loadI18n();
  // Hydrate UI texts ASAP (before fetching words.json) so placeholders don't linger.
  setLanguage(detectInitialLanguage());
  WORD_BANK = await loadWordBank();
  init();
  await finishBootSplash();
}

// Script is loaded at end of <body>; DOM is ready enough for caching.
bootstrap();
