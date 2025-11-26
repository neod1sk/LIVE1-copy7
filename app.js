import { createClient } from "@supabase/supabase-js";
import { PENLIGHT_COLORS } from "./src/constants/colors.js";
import { LEVEL_TABLE } from "./src/constants/levels.js";
import { MODE_SCORE } from "./src/constants/modeScore.js";
import { createI18n } from "./src/i18n/index.js";
import { GameStore } from "./src/state/gameStore.js";
import {
  initAudio,
  unlockBgm,
  isBgmUnlocked,
  playMenuBgm,
  playGameBgm,
  pauseCurrentBgm,
  resumeCurrentBgm,
  attemptAutoPlayMenuBgm,
  playButtonSfx,
  playStartSfx,
  playArrowSfx,
  playEndSfx,
  playPauseSfx,
  playMainSfx,
  playLightstickSfx,
  playArigatoSfx,
  playHakushuSfx,
  playAppealTimeSfx,
  playLvupSfx,
  playCountdownBeep,
  playFeverCountdownChime,
  resumeAudioContext,
} from "./src/audio/audioManager.js";
import { flashTargetCard, flashHudValues } from "./src/ui/effects.js";
import { bindTapSafeActivation } from "./src/input/touch.js";

const colors = PENLIGHT_COLORS;
const levelTable = LEVEL_TABLE;
const modeScore = MODE_SCORE;

const fallbackSupabaseConfig = {
  url: "https://cznwtorlerzmstnohzpq.supabase.co",
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6bnd0b3JsZXJ6bXN0bm9oenBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NDE2NTQsImV4cCI6MjA3OTIxNzY1NH0.Uc8GakAYzlqZCV-LstJl_Xx7Kj3j_CXj7Z3GHsvqvlc",
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || fallbackSupabaseConfig.url;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || fallbackSupabaseConfig.anonKey;

const supabase =
  typeof supabaseUrl === "string" &&
  supabaseUrl &&
  typeof supabaseAnonKey === "string" &&
  supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

const RANKING_TABLE = "rankings";
const PLAYER_ID_STORAGE_KEY = "oshi-player-id";

const getOrCreatePlayerId = () => {
  try {
    const stored = localStorage.getItem(PLAYER_ID_STORAGE_KEY);
    if (stored) {
      return stored;
    }
    const generated =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(PLAYER_ID_STORAGE_KEY, generated);
    return generated;
  } catch (error) {
    console.warn("Failed to access localStorage for player id:", error);
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
};

const playerId = getOrCreatePlayerId();
const isRankingEnabled = Boolean(supabase);

const { t, setLanguage, getLanguage, supportedLanguages } = createI18n();
let langButtons = [];

const hexToRgb = (hex) => {
  if (!hex) return { r: 0, g: 0, b: 0 };
  let sanitized = hex.replace("#", "");
  if (sanitized.length === 3) {
    sanitized = sanitized
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  const intVal = parseInt(sanitized, 16);
  const r = (intVal >> 16) & 255;
  const g = (intVal >> 8) & 255;
  const b = intVal & 255;
  return { r, g, b };
};

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeHandle = (value = "") =>
  String(value)
    .replace(/\s+/g, "")
    .replace(/^@+/, "")
    .replace(/[^0-9A-Za-z_]/g, "");

const hexToRgba = (hex, alpha = 1) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const applyPenlightAppearance = (element, colorCode) => {
  if (!element) return;
  const tube = element.querySelector(".penlight__tube");
  if (!tube) return;
  if (!colorCode) {
    element.classList.add("penlight--off");
    element.style.setProperty("--tube-color", "#dbe1f2");
    tube.style.backgroundColor = "";
    tube.style.boxShadow =
      "inset 0 0 18px rgba(255,255,255,0.65), 0 12px 22px rgba(0,0,0,0.22)";
    return;
  }
  element.classList.remove("penlight--off");
  element.style.setProperty("--tube-color", colorCode);
  tube.style.backgroundColor = colorCode;
  tube.style.boxShadow = `0 18px 40px rgba(0,0,0,0.35), 0 0 32px ${hexToRgba(
    colorCode,
    0.55
  )}`;
};

const randomBetween = (min, max) => Math.random() * (max - min) + min;

const setFeverPenlightMotion = (direction = null) => {
  if (!feverPenlight) return;
  if (!direction) {
    feverPenlight.style.setProperty("--fever-penlight-translate", "0px");
    feverPenlight.style.setProperty("--fever-penlight-rotate", "0deg");
    if (feverParticles) {
      feverParticles.querySelectorAll(".fever__particle").forEach((node) => {
        if (!node.dataset.persist) {
          node.remove();
        }
      });
    }
    return;
  }
  const translate = direction === "left" ? "-16px" : "16px";
  const rotate = direction === "left" ? "-12deg" : "12deg";
  feverPenlight.style.setProperty("--fever-penlight-translate", translate);
  feverPenlight.style.setProperty("--fever-penlight-rotate", rotate);
  spawnFeverParticles(direction);
};

const spawnFeverParticles = (direction) => {
  if (!feverParticles) return;
  const count = Math.floor(randomBetween(4, 6));
  const baseAngle = direction === "left" ? Math.PI - Math.PI / 8 : Math.PI / 8;
  const spread = Math.PI / 5;
  for (let i = 0; i < count; i += 1) {
    const particle = document.createElement("span");
    const variantRand = Math.random();
    let variantClass = "fever__particle";
    if (variantRand < 0.25) {
      variantClass += " fever__particle--star";
    } else if (variantRand < 0.65) {
      variantClass += " fever__particle--spark";
    }
    particle.className = variantClass;
    const angle = baseAngle + randomBetween(-spread, spread);
    const distance = randomBetween(32, 56);
    const tx = Math.cos(angle) * distance;
    const ty = -Math.abs(Math.sin(angle) * distance * 0.75) - randomBetween(6, 18);
    const duration = randomBetween(0.5, 0.7);
    const scale = randomBetween(0.5, 0.9);
    particle.style.setProperty("--particle-tx", `${tx.toFixed(2)}px`);
    particle.style.setProperty("--particle-ty", `${ty.toFixed(2)}px`);
    particle.style.setProperty("--particle-duration", `${duration.toFixed(2)}s`);
    particle.style.setProperty("--particle-scale", scale.toFixed(2));
    feverParticles.appendChild(particle);
    particle.addEventListener(
      "animationend",
      () => {
        particle.remove();
      },
      { once: true }
    );
  }
};

const getLuminance = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  const srgb = [r, g, b].map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
};

const getLevelInfoByScore = (score) =>
  levelTable.find((entry) => score <= entry.max) || levelTable[levelTable.length - 1];

const getLevelName = (levelInfo, lang = getLanguage()) => {
  if (!levelInfo) return "";
  if (levelInfo.names && levelInfo.names[lang]) return levelInfo.names[lang];
  if (levelInfo.names && levelInfo.names.ja) return levelInfo.names.ja;
  return levelInfo.name || "";
};

const getLevelNameByKey = (key, lang = getLanguage()) => {
  const info = levelTable.find((entry) => entry.key === key);
  return getLevelName(info, lang);
};

const screens = {
  top: document.getElementById("screen-top"),
  play: document.getElementById("screen-play"),
  result: document.getElementById("screen-result"),
  langSwitcher: document.getElementById("lang-switcher"),
  hero: document.querySelector(".hero"),
  transition: document.getElementById("transition-result"),
  lockScroll() {
    document.body.classList.add("scroll-lock");
  },
  unlockScroll() {
    document.body.classList.remove("scroll-lock");
  },
  showTop() {
    setHeroInteractive(false);
    this.unlockScroll();
    this.top.hidden = false;
    this.play.hidden = true;
    this.result.hidden = true;
    if (this.langSwitcher) {
      this.langSwitcher.hidden = false;
    }
    if (this.hero) {
      this.hero.hidden = false;
    }
    this.hideTransition();
    if (isBgmUnlocked()) {
      playMenuBgm(); // メニュー画面表示時のBGM（ユーザー操作後のみ）
    }
    if (bgmToggleButton) {
      bgmToggleButton.hidden = false;
    }
  },
  showPlay() {
    resetViewportScroll(this.play);
    this.lockScroll();
    this.top.hidden = true;
    this.play.hidden = false;
    this.result.hidden = true;
    if (this.langSwitcher) {
      this.langSwitcher.hidden = true;
    }
    if (this.hero) {
      this.hero.hidden = true;
    }
    this.hideTransition();
    if (isBgmUnlocked()) {
      playGameBgm(); // プレイ画面表示時のBGM（ユーザー操作後のみ）
    }
    if (bgmToggleButton) {
      bgmToggleButton.hidden = false;
    }
  },
  showResult(state) {
    setHeroInteractive(true);
    this.unlockScroll();
    this.top.hidden = true;
    this.play.hidden = true;
    this.result.hidden = false;
    if (this.langSwitcher) {
      this.langSwitcher.hidden = false;
    }
    if (this.hero) {
      this.hero.hidden = false;
    }
    this.hideTransition();
    populateResult(state);
    if (isBgmUnlocked()) {
      playMenuBgm(); // 結果画面表示時のBGM（メニューと同じ曲）
    }
    if (bgmToggleButton) {
      bgmToggleButton.hidden = false;
    }
  },
  showTransition() {
    this.lockScroll();
    this.top.hidden = true;
    this.play.hidden = true;
    this.result.hidden = true;
    if (this.transition) {
      this.transition.hidden = false;
    }
  },
  hideTransition() {
    if (this.transition) {
      this.transition.hidden = true;
    }
  },
};

const game = new GameStore({
  colors,
  modeScore,
  t,
  effects: {
    onPause: () => {
      pauseCurrentBgm();
    },
    onResume: () => {
      if (isBgmUnlocked()) {
        resumeCurrentBgm();
      }
    },
    onHudFlash: () => {
      flashHudValues(hudFlashTargets);
    },
    onTargetFlash: () => {
      flashTargetCard(targetColor);
    },
    onMatchToast: ({ message, variant, options }) => {
      showToast(message, variant, options);
    },
    onGlitchToast: ({ message, variant }) => {
      showToast(message, variant);
    },
    onFeverStart: ({ message }) => {
      showToast(message, "success");
      playAppealTimeSfx();
    },
    onFeverLevelUp: ({ message, level }) => {
      showToast(message, "success");
      playLvupSfx(level);
    },
    onFeverEnd: ({ message }) => {
      showToast(message, "success");
    },
    onFeverSwing: () => {
      playLightstickSfx();
    },
    onTransitionStart: () => {
      screens.showTransition();
    },
    onTransitionComplete: (state) => {
      screens.showResult(state);
      playHakushuSfx();
      saveHistory(state);
    },
  },
});

const hudScore = document.getElementById("hud-score");
const hudSuccess = document.getElementById("hud-success");
const hudTime = document.getElementById("hud-time");
const hudTimerItem = document.getElementById("hud-timer-item");
const targetColor = document.getElementById("target-color");
const penlight = document.getElementById("penlight");
const feverPenlight = document.getElementById("fever-penlight");
const feverParticles = document.getElementById("fever-particles");
const feverTimer = document.querySelector(".fever__timer");
const penlightLabel = document.getElementById("penlight-label");
const feverLayer = document.getElementById("fever");
const feverTime = document.getElementById("fever-time");
const feverCount = document.getElementById("fever-count");
const feverStage = document.getElementById("fever-stage");
const easyGuide = document.getElementById("easy-guide");
const previewBar = document.getElementById("preview-bar");
const historyList = document.getElementById("history-list");
const resultCard = document.getElementById("result-card");
const resultScore = document.getElementById("result-score");
const resultLevel = document.getElementById("result-level");
const resultSuccess = document.getElementById("result-success");
const resultResponses = document.getElementById("result-responses");
const pauseButton = document.getElementById("btn-pause");
const stageToastLayer = document.getElementById("stage-toast-layer");
const hero = document.querySelector(".hero");
const heroTitle = document.querySelector(".hero__title");
const heroSubtitle = document.querySelector(".hero__subtitle");
const heroInteractiveElements = [heroTitle, heroSubtitle];
const appealImageArea = document.getElementById("appeal-image-area");
const appealImage = document.getElementById("appeal-image");
const appealImageSources = [
  "./images/reactionaa.jpg",
  "./images/reactionbb.jpg",
  "./images/reactioncc.jpg",
  "./images/reactiondd.jpg",
];
const rankingModal = document.getElementById("ranking-modal");
const rankingBackdrop = rankingModal
  ? rankingModal.querySelector(".ranking-modal__backdrop")
  : null;
const rankingCloseButton = document.getElementById("btn-close-ranking");
const rankingForm = document.getElementById("ranking-form");
const rankingSubmitButton = document.getElementById("ranking-submit");
const rankingStatus = document.getElementById("ranking-status");
const rankingListElement = document.getElementById("ranking-list");
const rankingUsernameInput = document.getElementById("ranking-username");
const rankingHandleInput = document.getElementById("ranking-handle");
const rankingCurrentScoreValue = document.getElementById("ranking-current-score");
const rankingCurrentLevelValue = document.getElementById("ranking-current-level");
const rankingNote = document.getElementById("ranking-note");
const rankingPersonalContainer = document.getElementById("ranking-personal");

function resetViewportScroll(target) {
  if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } catch (error) {
      window.scrollTo(0, 0);
    }
  }

  if (!target) return;
  try {
    if (typeof target.scrollTo === "function") {
      target.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }
  } catch (error) {
    // ignore and fall through
  }
  target.scrollTop = 0;
  target.scrollLeft = 0;
}

let lastSwingDirection = null;
let previewItems = [];
let lastCountdownTime = null;
let lastFeverCountdownTime = null;
let lastAppealLevel = null;
let latestResultState = null;
let rankingEntriesCache = [];
let rankingStatusKey = "";
let rankingStatusState = "idle";
let isRankingRefreshing = false;
let latestPersonalEntry = null;
let personalEntriesCache = [];

const renderCache = {
  score: undefined,
  success: undefined,
  timeLeft: undefined,
  countdownActive: undefined,
  lowTimeActive: undefined,
  pausedLabel: undefined,
  pauseAria: undefined,
  pauseDataState: undefined,
  currentIndex: undefined,
  penlightColor: undefined,
  targetIndex: undefined,
  targetColorCode: undefined,
  targetName: undefined,
  targetHidden: undefined,
  mode: undefined,
  feverActive: undefined,
  feverTimeLeft: undefined,
  feverLowTimeActive: undefined,
  swingRoundTrips: undefined,
  responseStage: undefined,
  appealVisible: undefined,
};

let pendingRenderState = null;
let pendingRenderForce = false;
let renderFrameHandle = null;

const rotationQueue = [];
let rotationFrameHandle = null;
const MAX_ROTATIONS_PER_FRAME = 24;

const processRotationQueue = () => {
  rotationFrameHandle = null;
  if (!rotationQueue.length) return;
  const rotationsThisFrame = rotationQueue.splice(0, MAX_ROTATIONS_PER_FRAME);
  rotationsThisFrame.forEach((direction) => {
    game.rotate(direction);
  });
  if (rotationQueue.length) {
    rotationFrameHandle = requestAnimationFrame(processRotationQueue);
  }
};

const queueRotation = (direction) => {
  if (direction === 0) return;
  if (rotationQueue.length < 120) {
    rotationQueue.push(direction);
  }
  if (!rotationFrameHandle) {
    rotationFrameHandle = requestAnimationFrame(processRotationQueue);
  }
};

const resetRotationQueue = () => {
  rotationQueue.splice(0, rotationQueue.length);
  if (rotationFrameHandle) {
    cancelAnimationFrame(rotationFrameHandle);
    rotationFrameHandle = null;
  }
};

const resetRenderCache = () => {
  Object.keys(renderCache).forEach((key) => {
    renderCache[key] = undefined;
  });
  lastCountdownTime = null;
  lastFeverCountdownTime = null;
  lastAppealLevel = null;
};

const enqueueRender = (state, { force = false } = {}) => {
  pendingRenderState = state;
  pendingRenderForce = pendingRenderForce || force;
  if (!renderFrameHandle) {
    renderFrameHandle = requestAnimationFrame(() => {
      renderFrameHandle = null;
      if (pendingRenderState) {
        updateUI(pendingRenderState, { force: pendingRenderForce });
      }
      pendingRenderState = null;
      pendingRenderForce = false;
    });
  }
};

const bgmToggleButton = document.getElementById("toggleBgmBtn");

const isResultScreenActive = () => screens && screens.result && !screens.result.hidden;

const handleHeroClick = () => {
  if (!isResultScreenActive()) return;
  playButtonSfx();
  screens.showTop();
};

const handleHeroKeydown = (event) => {
  if (!isResultScreenActive()) return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    playButtonSfx();
    screens.showTop();
  }
};

heroInteractiveElements.forEach((element) => {
  if (!element) return;
  element.addEventListener("click", handleHeroClick);
  element.addEventListener("keydown", handleHeroKeydown);
});

function setHeroInteractive(enabled) {
  if (!hero) return;
  hero.classList.toggle("hero--interactive", enabled);
  heroInteractiveElements.forEach((element) => {
    if (!element) return;
    if (enabled) {
      element.setAttribute("role", "button");
      element.setAttribute("tabindex", "0");
    } else {
      element.removeAttribute("role");
      element.removeAttribute("tabindex");
      if (document.activeElement === element) {
        element.blur();
      }
    }
  });
}

if (targetColor) {
  targetColor.addEventListener(
    "animationend",
    (event) => {
      if (event.animationName === "targetCardFlash") {
        targetColor.classList.remove("color-card--flash");
      }
    },
    { passive: true }
  );
}

const hudFlashTargets = [
  { element: hudScore, className: "hud__value--flash-score", animation: "hudValueFlashScore" },
  {
    element: hudSuccess,
    className: "hud__value--flash-success",
    animation: "hudValueFlashSuccess",
  },
];

hudFlashTargets.forEach(({ element, className, animation }) => {
  if (!element) return;
  element.addEventListener(
    "animationend",
    (event) => {
      if (event.animationName === animation) {
        element.classList.remove(className);
      }
    },
    { passive: true }
  );
});

function initUI() {
  const reversedColors = [...colors].reverse();
  previewBar.innerHTML = reversedColors
    .map((color, idx) => {
      const originalIndex = colors.length - 1 - idx;
      return `<div class="preview-bar__item" data-color-index="${originalIndex}" data-name="${color.name}" style="--preview-color:${color.code}"></div>`;
    })
    .join("");
  previewItems = Array.from(previewBar.querySelectorAll(".preview-bar__item"));
  restoreHistory();
}

function updateUI(state, { force = false } = {}) {
  if (!state) return;
  if (force) {
    resetRenderCache();
  }

  const { score, successCount, timeLeft, currentIndex, targetIndex, mode, fever } = state;

  if (renderCache.score !== score && hudScore) {
    hudScore.textContent = score.toString().padStart(4, "0");
    renderCache.score = score;
  }

  if (renderCache.success !== successCount && hudSuccess) {
    hudSuccess.textContent = successCount;
    renderCache.success = successCount;
  }

  const timeChanged = renderCache.timeLeft !== timeLeft;
  if (timeChanged && hudTime) {
    hudTime.textContent = timeLeft;
    if (
      Number.isFinite(timeLeft) &&
      timeLeft <= 10 &&
      timeLeft >= 0 &&
      lastCountdownTime !== timeLeft
    ) {
      playCountdownBeep(timeLeft);
    }
    lastCountdownTime = timeLeft;
    renderCache.timeLeft = timeLeft;
  }

  const isCountdown = Number.isFinite(timeLeft) && timeLeft <= 10 && timeLeft >= 0;
  if (renderCache.countdownActive !== isCountdown) {
    if (hudTimerItem) {
      hudTimerItem.classList.toggle("is-countdown", isCountdown);
    }
    if (hudTime) {
      hudTime.classList.toggle("is-countdown", isCountdown);
    }
    renderCache.countdownActive = isCountdown;
  }

  const isLowTime = Number.isFinite(timeLeft) && timeLeft <= 3 && timeLeft >= 0;
  if (renderCache.lowTimeActive !== isLowTime && hudTimerItem) {
    hudTimerItem.classList.toggle("fever__timer--glow", isLowTime);
    if (!isLowTime) {
      hudTimerItem.style.removeProperty("--fever-glow-speed");
    }
    renderCache.lowTimeActive = isLowTime;
  }
  if (isLowTime && timeChanged && hudTimerItem) {
    const glowSpeed = Math.max(0.4, Math.min(0.6, 0.4 + (timeLeft / 10) * 0.2));
    hudTimerItem.style.setProperty("--fever-glow-speed", `${glowSpeed.toFixed(2)}s`);
  }

  if (pauseButton) {
    const pauseText = t(state.paused ? "play.resume" : "play.pause");
    if (renderCache.pausedLabel !== pauseText) {
      pauseButton.textContent = pauseText;
      renderCache.pausedLabel = pauseText;
    }
    const pauseAria = state.paused ? "true" : "false";
    if (renderCache.pauseAria !== pauseAria) {
      pauseButton.setAttribute("aria-pressed", pauseAria);
      renderCache.pauseAria = pauseAria;
    }
    const pauseState = state.paused ? "resume" : "pause";
    if (renderCache.pauseDataState !== pauseState) {
      pauseButton.dataset.state = pauseState;
      renderCache.pauseDataState = pauseState;
    }
  }

  const isPenlightOff = currentIndex === null || currentIndex === undefined;
  const currentColor = isPenlightOff ? null : colors[currentIndex];
  const currentColorCode = currentColor ? currentColor.code : null;
  if (
    renderCache.currentIndex !== currentIndex ||
    renderCache.penlightColor !== currentColorCode
  ) {
    const tube = penlight.querySelector(".penlight__tube");
    if (isPenlightOff) {
      penlight.classList.add("penlight--off");
      penlight.style.setProperty("--tube-color", "#dbe1f2");
      if (tube) {
        tube.style.backgroundColor = "";
        tube.style.boxShadow =
          "inset 0 0 18px rgba(255,255,255,0.65), 0 12px 22px rgba(0,0,0,0.22)";
      }
      penlightLabel.textContent = t("penlight.off");
      penlightLabel.style.color = "rgba(255,255,255,0.65)";
      penlightLabel.style.textShadow = "none";
      if (previewItems.length) {
        previewItems.forEach((item) =>
          item.classList.remove("preview-bar__item--active")
        );
      }
    } else if (currentColor) {
      penlight.classList.remove("penlight--off");
      penlight.style.setProperty("--tube-color", currentColor.code);
      if (tube) {
        tube.style.backgroundColor = currentColor.code;
        tube.style.boxShadow = `0 18px 40px rgba(0,0,0,0.35), 0 0 32px ${hexToRgba(
          currentColor.code,
          0.55
        )}`;
      }
      penlightLabel.textContent = currentColor.name;
      penlightLabel.style.color = "#ffffff";
      penlightLabel.style.textShadow = "0 0 6px rgba(0,0,0,0.45)";
      if (previewItems.length) {
        previewItems.forEach((item) =>
          item.classList.toggle(
            "preview-bar__item--active",
            Number(item.dataset.colorIndex) === currentIndex
          )
        );
      }
    }
    applyPenlightAppearance(feverPenlight, currentColorCode);
    renderCache.currentIndex = currentIndex;
    renderCache.penlightColor = currentColorCode;
  }

  if (renderCache.mode !== mode) {
    if (easyGuide) {
      easyGuide.hidden = mode !== "easy";
    }
    renderCache.mode = mode;
  }

  const targetHidden = !!(fever && fever.active);
  if (renderCache.targetHidden !== targetHidden && targetColor) {
    targetColor.hidden = targetHidden;
    renderCache.targetHidden = targetHidden;
  }

  if (!targetHidden && targetColor && colors[targetIndex]) {
    const targetColorData = colors[targetIndex];
    if (
      renderCache.targetIndex !== targetIndex ||
      renderCache.targetColorCode !== targetColorData.code ||
      renderCache.targetName !== targetColorData.name
    ) {
      const swatch = targetColor.querySelector(".color-card__swatch");
      const label = targetColor.querySelector(".color-card__name");
      if (swatch) {
        swatch.style.background = targetColorData.code;
      }
      if (label) {
        label.textContent = targetColorData.name;
      }
      renderCache.targetIndex = targetIndex;
      renderCache.targetColorCode = targetColorData.code;
      renderCache.targetName = targetColorData.name;
    }
  }

  const feverState = fever || {
    active: false,
    timeLeft: 10,
    swingCount: 0,
    responseStage: 0,
  };
  const feverActive = !!feverState.active;
  if (renderCache.feverActive !== feverActive) {
    if (feverLayer) {
      feverLayer.hidden = !feverActive;
    }
    if (!feverActive) {
      setFeverPenlightMotion(null);
    }
    renderCache.feverActive = feverActive;
  }

  const prevFeverTimeLeft = renderCache.feverTimeLeft;
  const feverTimeLeft = feverActive ? feverState.timeLeft : null;
  if (feverActive && feverTimeLeft != null && feverTime) {
    if (prevFeverTimeLeft !== feverTimeLeft) {
      feverTime.textContent = feverTimeLeft;
      if (
        Number.isFinite(feverTimeLeft) &&
        feverTimeLeft <= 3 &&
        feverTimeLeft >= 0 &&
        lastFeverCountdownTime !== feverTimeLeft
      ) {
        playFeverCountdownChime(feverTimeLeft);
      }
      lastFeverCountdownTime = feverTimeLeft;
    }
  } else if (!feverActive) {
    lastFeverCountdownTime = null;
  }
  renderCache.feverTimeLeft = feverActive ? feverTimeLeft : null;

  const feverLowTime =
    feverActive &&
    Number.isFinite(feverTimeLeft) &&
    feverTimeLeft <= 3 &&
    feverTimeLeft >= 0;
  if (renderCache.feverLowTimeActive !== feverLowTime && feverTimer) {
    feverTimer.classList.toggle("fever__timer--glow", feverLowTime);
    if (!feverLowTime) {
      feverTimer.style.removeProperty("--fever-glow-speed");
    }
    renderCache.feverLowTimeActive = feverLowTime;
  }
  if (
    feverLowTime &&
    feverTimer &&
    prevFeverTimeLeft !== feverTimeLeft &&
    feverTimeLeft != null
  ) {
    const feverGlowSpeed = Math.max(
      0.4,
      Math.min(0.6, 0.4 + (feverTimeLeft / 10) * 0.2)
    );
    feverTimer.style.setProperty("--fever-glow-speed", `${feverGlowSpeed.toFixed(2)}s`);
  }

  const swingRoundTrips = Math.floor((feverState.swingCount || 0) / 2);
  if (
    renderCache.swingRoundTrips !== swingRoundTrips &&
    feverCount
  ) {
    feverCount.textContent = `${swingRoundTrips} ${t("fever.countUnit")}`;
    renderCache.swingRoundTrips = swingRoundTrips;
  }

  const stageLevel =
    feverState && feverState.responseStage != null ? Math.max(0, feverState.responseStage) : 0;
  if (renderCache.responseStage !== stageLevel && feverStage) {
    feverStage.textContent = t("fever.stage", { level: stageLevel });
    renderCache.responseStage = stageLevel;
  }

  if (appealImageArea && appealImage) {
    const shouldShowAppeal = feverActive && stageLevel >= 1;
    if (renderCache.appealVisible !== shouldShowAppeal || lastAppealLevel !== stageLevel) {
      if (shouldShowAppeal) {
        const imageIndex = Math.min(stageLevel - 1, appealImageSources.length - 1);
        const nextSrc = appealImageSources[imageIndex];
        if (appealImage.getAttribute("src") !== nextSrc) {
          appealImage.setAttribute("src", nextSrc);
        }
        appealImage.alt = t("fever.stage", { level: stageLevel });
        appealImageArea.hidden = false;
      appealImageArea.classList.add("is-visible");
      appealImageArea.classList.remove("is-flash");
      requestAnimationFrame(() => {
        appealImageArea.classList.add("is-flash");
      });
        const stars = appealImageArea.querySelector(".appeal-stars");
        if (stageLevel >= 4) {
          appealImageArea.classList.add("is-epic");
          if (stars) {
            stars.classList.remove("is-bursting");
          requestAnimationFrame(() => {
            stars.classList.add("is-bursting");
          });
          }
        } else {
          appealImageArea.classList.remove("is-epic");
          if (stars) {
            stars.classList.remove("is-bursting");
          }
        }
        setTimeout(() => {
          appealImageArea.classList.remove("is-flash");
        }, 700);
        lastAppealLevel = stageLevel;
      } else {
        appealImageArea.hidden = true;
        appealImageArea.classList.remove("is-visible", "is-flash", "is-epic");
        const stars = appealImageArea.querySelector(".appeal-stars");
        if (stars) {
          stars.classList.remove("is-bursting");
        }
        appealImage.removeAttribute("src");
        appealImage.alt = "";
        lastAppealLevel = null;
      }
      renderCache.appealVisible = shouldShowAppeal;
    }
  }
}

function populateResult(state) {
  const levelNames = getLevelNamesForScore(state.score);
  latestResultState = {
    score: state.score,
    responses: state.responses,
    mode: state.mode,
    otaLevel: levelNames,
  };
  updateRankingScoreState();
  resultScore.textContent = state.score;
  const levelInfo = getLevelInfoByScore(state.score);
  const levelName = getLevelName(levelInfo);
  resultLevel.textContent = levelName;
  resultCard.classList.remove("level-1", "level-2", "level-3");
  if (levelInfo && levelInfo.levelClass) {
    resultCard.classList.add(levelInfo.levelClass);
  }
  resultSuccess.textContent = state.successCount;
  resultResponses.textContent = state.responses;
}

function handleFeverSwing(e) {
  if (!game.state.fever.active || game.state.paused) return;
  if (e.type === "pointerdown") {
    if (e.currentTarget.setPointerCapture) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    lastSwingDirection = null;
    setFeverPenlightMotion(null);
  } else if (e.type === "pointermove") {
    const rect = e.currentTarget.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    const direction = e.clientX < center ? "left" : "right";
    if (lastSwingDirection !== direction) {
      setFeverPenlightMotion(direction);
      if (lastSwingDirection) {
        game.swing(direction);
      }
    } else if (!lastSwingDirection) {
      setFeverPenlightMotion(direction);
    }
    lastSwingDirection = direction;
  } else if (e.type === "pointerup" || e.type === "pointercancel") {
    lastSwingDirection = null;
    setFeverPenlightMotion(null);
  }
}

function showScreenPlay() {
  closeRankingModal();
  resumeAudioContext();
  if (!isBgmUnlocked()) {
    unlockBgm(); // 初回のユーザー操作でBGM再生を解禁
  }
  resetRenderCache();
  resetRotationQueue();
  if (hudTimerItem) {
    hudTimerItem.classList.remove("is-countdown");
  }
  if (hudTime) {
    hudTime.classList.remove("is-countdown");
  }
  lastCountdownTime = null;
  screens.lockScroll();
  screens.showPlay();
  const selectedMode = document.querySelector('input[name="mode"]:checked').value;
  game.start(selectedMode);
}

function endGame() {
  game.finish();
}

function saveHistory(state) {
  const levelInfo = getLevelInfoByScore(state.score);
  const entry = {
    score: state.score,
    success: state.successCount,
    responses: state.responses,
    levelKey: levelInfo && levelInfo.key != null ? levelInfo.key : null,
    date: new Date().toLocaleString(),
  };
  const history = JSON.parse(localStorage.getItem("oshiHistory") || "[]");
  history.unshift(entry);
  localStorage.setItem("oshiHistory", JSON.stringify(history.slice(0, 5)));
  restoreHistory();
}

function restoreHistory() {
  const history = JSON.parse(localStorage.getItem("oshiHistory") || "[]");
  if (!history.length) {
    historyList.innerHTML = `<li>${t("history.empty")}</li>`;
    return;
  }
  const pointsUnit = t("history.pointsUnit");
  historyList.innerHTML = history
    .map((item) => {
      const levelName =
        item.levelKey !== undefined && item.levelKey !== null
          ? getLevelNameByKey(item.levelKey)
          : item.level || getLevelName(getLevelInfoByScore(item.score));
      const dateLabel = item.date || "";
      return `<li><strong>${item.score}</strong> ${pointsUnit} / ${levelName}<br><small>${dateLabel}</small></li>`;
    })
    .join("");
}

function getLevelNamesForScore(score) {
  const levelInfo = getLevelInfoByScore(score);
  return {
    ja: getLevelName(levelInfo, "ja"),
    en: getLevelName(levelInfo, "en"),
    ko: getLevelName(levelInfo, "ko"),
  };
}

function updateRankingScoreState() {
  if (!rankingCurrentScoreValue || !rankingCurrentLevelValue || !rankingNote || !rankingSubmitButton) {
    return;
  }
  const hasResult =
    latestResultState &&
    Number.isFinite(Number(latestResultState.score)) &&
    typeof latestResultState.otaLevel === "object";
  if (hasResult) {
    rankingCurrentScoreValue.textContent = Number(latestResultState.score).toLocaleString();
    const activeLang = getLanguage();
    const levelLabel =
      latestResultState.otaLevel?.[activeLang] ||
      latestResultState.otaLevel?.ja ||
      "-";
    rankingCurrentLevelValue.textContent = levelLabel;
    rankingNote.textContent = t("ranking.ready");
  } else {
    rankingCurrentScoreValue.textContent = "-";
    rankingCurrentLevelValue.textContent = "-";
    rankingNote.textContent = t("ranking.noScore");
  }
  rankingSubmitButton.disabled = !hasResult || !isRankingEnabled;
}

function applyRankingStatus() {
  if (!rankingStatus) return;
  rankingStatus.dataset.state = rankingStatusState;
  if (!rankingStatusKey) {
    rankingStatus.textContent = "";
    rankingStatus.hidden = true;
    return;
  }
  rankingStatus.hidden = false;
  rankingStatus.textContent = t(rankingStatusKey);
}

function setRankingStatus({ key = "", state = "idle" } = {}) {
  rankingStatusKey = key;
  rankingStatusState = state;
  applyRankingStatus();
}

function updateRankingFormPlaceholders() {
  const lang = getLanguage();
  if (rankingUsernameInput) {
    const usernamePlaceholders = {
      ja: "例：ペンライト太郎",
      en: "e.g. John Doe",
      ko: "예시: 홍길동",
    };
    rankingUsernameInput.placeholder =
      usernamePlaceholders[lang] || usernamePlaceholders.en;
  }
  if (rankingHandleInput) {
    const handlePlaceholders = {
      ja: "例：oshi_light（@は自動で付きます）",
      en: "e.g. oshi_light (@ is added automatically)",
      ko: "예시: oshi_light（@는 자동으로 붙어요）",
    };
    rankingHandleInput.placeholder =
      handlePlaceholders[lang] || handlePlaceholders.en;
  }
  const handleLabelSpan = document.querySelector('[data-i18n="ranking.form.handleLabel"]');
  if (handleLabelSpan) {
    if (!handleLabelSpan.dataset.defaultLabel) {
      handleLabelSpan.dataset.defaultLabel = handleLabelSpan.textContent;
    }
    handleLabelSpan.textContent =
      lang === "ja"
        ? "Xアカウント"
        : lang === "en"
        ? "X Account"
        : handleLabelSpan.dataset.defaultLabel;
  }
}

const resolveLevelLabel = (entry, lang) =>
  entry[`ota_level_${lang}`] || entry.ota_level_ja || entry.ota_level_en || entry.ota_level_ko || "-";

function formatRankLabel(rank) {
  if (!Number.isFinite(rank)) return "";
  return t("ranking.list.position", { rank: rank.toLocaleString() });
}

function renderRankingList(entries = []) {
  if (!rankingListElement) return;
  if (!entries.length) {
    rankingListElement.innerHTML = `<li class="ranking-list__empty">${t("ranking.list.empty")}</li>`;
    return;
  }
  const pointsUnit = t("history.pointsUnit");
  const activeLang = getLanguage();
  rankingListElement.innerHTML = entries
    .map((entry, index) => {
      const rank = index + 1;
      const username = entry.username ? escapeHtml(entry.username) : t("ranking.anonymous");
      const handle = normalizeHandle(entry.handle || "");
      const handleHtml = handle
        ? `<a class="ranking-list__handle" href="https://x.com/${encodeURIComponent(
            handle
          )}" target="_blank" rel="noopener noreferrer">${escapeHtml(`@${handle}`)}</a>`
        : `<span class="ranking-list__handle ranking-list__handle--empty">-</span>`;
      const score = Number(entry.score);
      const scoreText = Number.isFinite(score) ? score.toLocaleString() : "0";
      const levelLabel = escapeHtml(resolveLevelLabel(entry, activeLang));
      const rankLabel = formatRankLabel(rank);
      const createdAt = entry.created_at ? new Date(entry.created_at).toLocaleString() : "";
      return `
        <li class="ranking-list__item" data-ranking-id="${entry.id || ""}">
          <span class="ranking-list__rank">${rankLabel}</span>
          <div class="ranking-list__info">
            <span class="ranking-list__name">${username}</span>
            ${handleHtml}
            <div class="ranking-list__meta">${levelLabel}</div>
            <div class="ranking-list__meta ranking-list__timestamp">${escapeHtml(createdAt)}</div>
          </div>
          <div class="ranking-list__score">
            <span class="ranking-list__score-value">${scoreText}</span>
            <span class="ranking-list__score-unit">${pointsUnit}</span>
          </div>
        </li>
      `;
    })
    .join("");
}

function renderRankingPersonal(entry, { insideTop = false } = {}) {
  if (!rankingPersonalContainer) return;
  rankingPersonalContainer.innerHTML = "";
  if (!entry) {
    rankingPersonalContainer.innerHTML = `<p class="ranking-personal__empty">${t(
      "ranking.personal.unavailable"
    )}</p>`;
    return;
  }
  const activeLang = getLanguage();
  const rankValue = Number(entry.rank);
  const hasRank = Number.isFinite(rankValue) && rankValue > 0;
  const rankText = hasRank ? formatRankLabel(rankValue) : "-";
  const extraMessage =
    insideTop || !hasRank
      ? ""
      : `<p class="ranking-personal__empty">${t("ranking.personal.outside", {
          rank: rankValue.toLocaleString(),
        })}</p>`;
  const scoreText = Number(entry.score).toLocaleString();
  const levelLabel = escapeHtml(
    entry[`ota_level_${activeLang}`] ||
      entry.ota_level_ja ||
      entry.ota_level_en ||
      entry.ota_level_ko ||
      "-"
  );
  const latestCard = document.createElement("div");
  latestCard.className = "ranking-personal__card";
  latestCard.innerHTML = `
    <div>
      <span class="ranking-personal__label">${t("ranking.personal.title")}</span>
      <div class="ranking-personal__rank">${rankText}</div>
    </div>
    <div>
      <span class="ranking-personal__label">${t("ranking.personal.latestScore")}</span>
      <div class="ranking-personal__value">${scoreText}</div>
    </div>
    <div>
      <span class="ranking-personal__label">${t("ranking.personal.latestLevel")}</span>
      <div class="ranking-personal__value">${levelLabel}</div>
    </div>
    <button class="ranking-personal__delete-btn" type="button">
      ${t("ranking.personal.deleteLatest")}
    </button>
  `;
  const deleteButton = latestCard.querySelector(".ranking-personal__delete-btn");
  deleteButton?.addEventListener("click", () => {
    const confirmed = window.confirm(t("ranking.personal.deleteConfirm"));
    if (!confirmed) return;
    deleteRankingEntry(entry.id, { isLatest: true });
  });
  rankingPersonalContainer.appendChild(latestCard);
  rankingPersonalContainer.insertAdjacentHTML("beforeend", extraMessage);

  if (personalEntriesCache.length > 1) {
    const historyTitle = document.createElement("h4");
    historyTitle.className = "ranking-personal__history-title";
    historyTitle.textContent = t("ranking.personal.allEntries");
    rankingPersonalContainer.appendChild(historyTitle);
    const historyList = document.createElement("ul");
    historyList.className = "ranking-personal__history-list";
    personalEntriesCache.forEach((item) => {
      const li = document.createElement("li");
      li.className = "ranking-personal__history-item";
      const itemScore = Number(item.score).toLocaleString();
      const itemLevel =
        item[`ota_level_${activeLang}`] ||
        item.ota_level_ja ||
        item.ota_level_en ||
        item.ota_level_ko ||
        "-";
      const itemCreatedAt = item.created_at
        ? new Date(item.created_at).toLocaleString()
        : "";
      li.innerHTML = `
        <div class="ranking-personal__history-main">
          <strong>${itemScore}</strong> / ${escapeHtml(itemLevel)}
          <small>${escapeHtml(itemCreatedAt)}</small>
        </div>
        <button class="ranking-personal__history-delete" type="button" data-entry-id="${item.id}">
          ×
        </button>
      `;
      historyList.appendChild(li);
    });
    rankingPersonalContainer.appendChild(historyList);
  }

  rankingPersonalContainer
    .querySelectorAll(".ranking-personal__history-delete")
    .forEach((btn) => {
      btn.addEventListener("click", (event) => {
        const entryId = event.currentTarget.dataset.entryId;
        if (!entryId) return;
        const confirmed = window.confirm(t("ranking.personal.deleteEntryConfirm"));
        if (!confirmed) return;
        deleteRankingEntry(entryId, { isLatest: entryId === entry.id });
      });
    });
}

async function calculateRankForEntry(entry) {
  if (!supabase || !entry) return null;
  const entryScore = Number(entry.score) || 0;
  const entryCreatedAt = entry.created_at ? new Date(entry.created_at).toISOString() : null;
  if (!entryCreatedAt) return null;
  try {
    const filter = [
      `score.gt.${entryScore}`,
      `and(score.eq.${entryScore},created_at.lt.${entryCreatedAt})`,
    ].join(",");
    const { count, error } = await supabase
      .from(RANKING_TABLE)
      .select("id", { head: true, count: "exact" })
      .or(filter);
    if (error) throw error;
    const rank = Number(count || 0) + 1;
    return rank;
  } catch (error) {
    console.error("Failed to calculate rank:", error);
    return null;
  }
}

async function fetchPersonalLatestEntry({ force = false } = {}) {
  if (!supabase) {
    personalEntriesCache = [];
    latestPersonalEntry = null;
    return null;
  }
  if (!force && latestPersonalEntry) {
    return latestPersonalEntry;
  }
  try {
    const { data, error } = await supabase
      .from(RANKING_TABLE)
      .select("*")
      .eq("player_id", playerId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    personalEntriesCache = Array.isArray(data) ? data : [];
    latestPersonalEntry = personalEntriesCache.length ? personalEntriesCache[0] : null;
    return latestPersonalEntry;
  } catch (error) {
    console.error("Failed to fetch personal entry:", error);
    return latestPersonalEntry;
  }
}

async function updatePersonalRanking() {
  if (!supabase) {
    personalEntriesCache = [];
    latestPersonalEntry = null;
    renderRankingPersonal(null);
    return;
  }
  const entry = await fetchPersonalLatestEntry({ force: true });
  if (!entry) {
    renderRankingPersonal(null);
    return;
  }
  const insideTop = rankingEntriesCache.some((topEntry) => topEntry.id === entry.id);
  const rank = insideTop
    ? rankingEntriesCache.findIndex((topEntry) => topEntry.id === entry.id) + 1
    : await calculateRankForEntry(entry);
  latestPersonalEntry =
    entry && Number.isFinite(rank) ? { ...entry, rank } : { ...entry, rank: null };
  renderRankingPersonal(latestPersonalEntry, { insideTop });
}

async function refreshRankingList({ force = false } = {}) {
  if (!rankingListElement) return;
  if (!supabase) {
    rankingEntriesCache = [];
    rankingListElement.innerHTML = `<li class="ranking-list__empty">${t("ranking.list.empty")}</li>`;
    setRankingStatus({ key: "ranking.disabled", state: "disabled" });
    personalEntriesCache = [];
    latestPersonalEntry = null;
    renderRankingPersonal(null);
    return;
  }
  if (isRankingRefreshing && !force) {
    return;
  }
  isRankingRefreshing = true;
  setRankingStatus({ key: "ranking.loading", state: "loading" });
  try {
    const { data, error } = await supabase
      .from(RANKING_TABLE)
      .select("*")
      .order("score", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) {
      throw error;
    }
    rankingEntriesCache = Array.isArray(data) ? data : [];
    renderRankingList(rankingEntriesCache);
    setRankingStatus({ key: "", state: "idle" });
    await updatePersonalRanking();
  } catch (error) {
    console.error("Failed to fetch ranking:", error);
    if (!rankingEntriesCache.length) {
      rankingListElement.innerHTML = `<li class="ranking-list__empty">${t(
        "ranking.list.empty"
      )}</li>`;
    }
    setRankingStatus({ key: "ranking.form.error", state: "error" });
  } finally {
    isRankingRefreshing = false;
  }
}

const isRankingModalVisible = () => rankingModal && !rankingModal.hidden;

function closeRankingModal() {
  if (!rankingModal || rankingModal.hidden) return;
  rankingModal.hidden = true;
  document.body.classList.remove("modal-open");
}

function openRankingModal({ focusForm = false } = {}) {
  if (!rankingModal) return;
  if (!rankingModal.hidden) {
    updateRankingScoreState();
    applyRankingStatus();
    renderRankingList(rankingEntriesCache);
    renderRankingPersonal(latestPersonalEntry, {
      insideTop:
        latestPersonalEntry &&
        rankingEntriesCache.some((entry) => entry.id === latestPersonalEntry.id),
    });
    if (isRankingEnabled) {
      refreshRankingList({ force: true });
    }
    return;
  }
  rankingModal.hidden = false;
  document.body.classList.add("modal-open");
  updateRankingScoreState();
  renderRankingList(rankingEntriesCache);
  applyRankingStatus();
  renderRankingPersonal(latestPersonalEntry, {
    insideTop:
      latestPersonalEntry &&
      rankingEntriesCache.some((entry) => entry.id === latestPersonalEntry.id),
  });
  if (focusForm && rankingUsernameInput) {
    requestAnimationFrame(() => {
      rankingUsernameInput.focus();
    });
  }
  refreshRankingList({ force: true });
}

async function handleRankingSubmit(event) {
  event.preventDefault();
  if (!rankingForm || !rankingSubmitButton) return;
  if (!isRankingEnabled) {
    showToast(t("ranking.disabled"), "danger");
    return;
  }
  const hasResult =
    latestResultState &&
    Number.isFinite(Number(latestResultState.score)) &&
    typeof latestResultState.otaLevel === "object";
  if (!hasResult) {
    showToast(t("ranking.form.validationMissingScore"), "danger");
    return;
  }
  const usernameRaw = rankingUsernameInput ? rankingUsernameInput.value.trim() : "";
  const handleRaw = rankingHandleInput ? rankingHandleInput.value.trim() : "";
  const hasHandle = !!handleRaw;
  if (!usernameRaw) {
    rankingUsernameInput?.focus();
    return;
  }
  let normalizedHandle = "";
  if (hasHandle) {
    const trimmedHandle = handleRaw.replace(/\s+/g, "").replace(/^@+/, "");
    normalizedHandle = normalizeHandle(handleRaw);
    if (!normalizedHandle || normalizedHandle !== trimmedHandle) {
      if (rankingHandleInput) {
        rankingHandleInput.setCustomValidity(t("ranking.form.validationHandle"));
        rankingHandleInput.reportValidity();
        rankingHandleInput.focus();
      }
      return;
    }
    if (rankingHandleInput) {
      rankingHandleInput.setCustomValidity("");
      rankingHandleInput.value = `@${normalizedHandle}`;
    }
  } else if (rankingHandleInput) {
    rankingHandleInput.setCustomValidity("");
    rankingHandleInput.value = "";
  }
  const defaultSubmitLabel = t("ranking.form.submit");
  rankingSubmitButton.disabled = true;
  rankingSubmitButton.textContent = t("ranking.submit.inProgress");
  try {
    const payload = {
      player_id: playerId,
      username: usernameRaw.slice(0, 32),
      handle: normalizedHandle || null,
      score: Number(latestResultState.score) || 0,
      ota_level_ja: latestResultState.otaLevel?.ja || "",
      ota_level_en: latestResultState.otaLevel?.en || "",
      ota_level_ko: latestResultState.otaLevel?.ko || "",
      language: getLanguage(),
    };
    const { data, error } = await supabase
      .from(RANKING_TABLE)
      .insert(payload)
      .select("*")
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (data) {
      latestPersonalEntry = { ...data };
    }
    showToast(t("ranking.form.success"), "success");
    await refreshRankingList({ force: true });
  } catch (error) {
    console.error("Failed to submit ranking:", error);
    showToast(t("ranking.form.error"), "danger");
  } finally {
    rankingSubmitButton.textContent = defaultSubmitLabel;
    updateRankingScoreState();
  }
}

async function deleteRankingEntry(entryId, { isLatest = false } = {}) {
  if (!supabase || !entryId) return;
  try {
    const { error } = await supabase
      .from(RANKING_TABLE)
      .delete()
      .eq("id", entryId)
      .eq("player_id", playerId);
    if (error) {
      throw error;
    }
    showToast(t("ranking.personal.deleteSuccess"), "success");
    personalEntriesCache = personalEntriesCache.filter((entry) => entry.id !== entryId);
    if (latestPersonalEntry && latestPersonalEntry.id === entryId) {
      latestPersonalEntry = null;
    }
    await refreshRankingList({ force: true });
  } catch (error) {
    console.error("Failed to delete ranking entry:", error);
    showToast(t("ranking.personal.deleteError"), "danger");
  }
}

function handleRankingKeydown(event) {
  if (event.key === "Escape" && isRankingModalVisible()) {
    event.preventDefault();
    closeRankingModal();
  }
}

function updateLangButtons() {
  if (!langButtons || !langButtons.length) return;
  const activeLang = getLanguage();
  langButtons.forEach((btn) => {
    const isActive = btn.dataset.lang === activeLang;
    btn.classList.toggle("lang-switcher__btn--active", isActive);
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    const text =
      btn.dataset.lang === "ja"
        ? "日"
        : btn.dataset.lang === "en"
        ? "EN"
        : btn.dataset.lang === "ko"
        ? "한"
        : btn.textContent;
    btn.textContent = text;
  });
}

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.dataset.i18n;
    if (!key) return;
    if (
      key === "penlight.off" &&
      game &&
      game.state &&
      game.state.currentIndex !== null
    ) {
      return;
    }
    const translation = t(key);
    if (translation !== undefined) {
      node.textContent = translation;
    }
  });
}

function changeLanguage(lang) {
  const nextLang = supportedLanguages.includes(lang) ? lang : "ja";
  setLanguage(nextLang);
  applyTranslations();
  updateLangButtons();
  updateRankingFormPlaceholders();
  restoreHistory();
  renderRankingList(rankingEntriesCache);
  renderRankingPersonal(latestPersonalEntry, {
    insideTop:
      latestPersonalEntry &&
      rankingEntriesCache.some((entry) => entry.id === latestPersonalEntry.id),
  });
  updateRankingScoreState();
  applyRankingStatus();
  if (game && game.state) {
    enqueueRender(game.state, { force: true });
  }
}

function shareOnX() {
  const score = game.state.score;
  const responses = game.state.responses;
  const levelName = getLevelName(getLevelInfoByScore(score));
  const text = encodeURIComponent(t("share.template", { levelName, score, responses }));
  const url = encodeURIComponent(window.location.href);
  window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank");
}

let stageToastElement = null;
let stageToastHideTimeout = null;

function showToast(message, variant = "success", options = {}) {
  const { placement = "global", duration = 1800 } = options;

  if (placement === "stage" && stageToastLayer) {
    if (!stageToastElement) {
      stageToastElement = document.createElement("div");
      stageToastLayer.appendChild(stageToastElement);
    }
    const classes = ["toast", `toast--${variant}`, "toast--stage"];
    if (variant === "success") {
      const isPink =
        message === t("toast.feverStart") || message === t("toast.feverEnd");
      classes.push(isPink ? "toast--stage-success-pink" : "toast--stage-success");
    }
    stageToastElement.className = classes.join(" ");
    stageToastElement.textContent = message;
    stageToastElement.classList.remove("is-visible");
    void stageToastElement.offsetWidth;
    stageToastElement.classList.add("is-visible");
    if (stageToastHideTimeout) {
      clearTimeout(stageToastHideTimeout);
    }
    stageToastHideTimeout = setTimeout(() => {
      if (stageToastElement) {
        stageToastElement.classList.remove("is-visible");
      }
    }, duration);
    return;
  }

  const container = document.body;
  const toast = document.createElement("div");
  toast.className = `toast toast--${variant}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  setTimeout(() => {
    toast.classList.remove("is-visible");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, duration);
}

function attachEventListeners() {
  const btnStart = document.getElementById("btn-start");
  if (btnStart) {
    btnStart.addEventListener("click", () => {
      playStartSfx();
      showScreenPlay();
    });
  }
  const btnEnd = document.getElementById("btn-end");
  if (btnEnd) {
    btnEnd.addEventListener("click", () => {
      playEndSfx();
      endGame();
    });
  }
  const btnRetry = document.getElementById("btn-retry");
  if (btnRetry) {
    btnRetry.addEventListener("click", () => {
      playStartSfx();
      showScreenPlay();
    });
  }
  const btnTop = document.getElementById("btn-top");
  if (btnTop) {
    btnTop.addEventListener("click", () => {
      playMainSfx();
      screens.showTop();
    });
  }
  const btnShare = document.getElementById("btn-share");
  if (btnShare) {
    btnShare.addEventListener("click", () => {
      playArigatoSfx();
      shareOnX();
    });
  }
  const btnRanking = document.getElementById("btn-ranking");
  if (btnRanking) {
    btnRanking.addEventListener("click", () => {
      playMainSfx();
      openRankingModal({ focusForm: !!latestResultState });
    });
  }
  const btnRankingResult = document.getElementById("btn-ranking-result");
  if (btnRankingResult) {
    btnRankingResult.addEventListener("click", () => {
      playMainSfx();
      screens.showTop();
      openRankingModal({ focusForm: !!latestResultState });
    });
  }
  const modeRadios = document.querySelectorAll('input[name="mode"]');
  modeRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      playMainSfx();
    });
  });
  bindTapSafeActivation(
    document.getElementById("btn-left"),
    () => {
      playArrowSfx();
      queueRotation(-1);
    },
    { resumeAudio: resumeAudioContext }
  );
  bindTapSafeActivation(
    document.getElementById("btn-right"),
    () => {
      playArrowSfx();
      queueRotation(1);
    },
    { resumeAudio: resumeAudioContext }
  );
  if (pauseButton) {
    bindTapSafeActivation(
      pauseButton,
      () => {
      playPauseSfx();
      game.togglePause();
      },
      { resumeAudio: resumeAudioContext }
    );
  }

  document.addEventListener("keydown", (e) => {
    if (screens.play.hidden) return;
    if (e.key === "Escape") {
      game.togglePause();
      return;
    }
    if (game.state.paused) return;
    if (e.key === "ArrowLeft") queueRotation(-1);
    if (e.key === "ArrowRight") queueRotation(1);
  });

  const feverZone = document.getElementById("fever-zone");
  ["pointerdown", "pointermove", "pointerup", "pointercancel"].forEach((type) => {
    feverZone.addEventListener(type, handleFeverSwing);
  });

  const howtoModal = document.getElementById("howto-modal");
  const btnHowto = document.getElementById("btn-howto");
  if (btnHowto) {
    btnHowto.addEventListener("click", () => {
      playMainSfx();
      howtoModal.hidden = false;
    });
  }
  const btnCloseHowto = document.getElementById("btn-close-howto");
  if (btnCloseHowto) {
    btnCloseHowto.addEventListener("click", () => {
      playMainSfx();
      howtoModal.hidden = true;
    });
  }
  howtoModal.addEventListener("click", (e) => {
    if (e.target === howtoModal || e.target.classList.contains("howto-modal__backdrop")) {
      playMainSfx();
      howtoModal.hidden = true;
    }
  });

  if (rankingCloseButton) {
    rankingCloseButton.addEventListener("click", () => {
      playMainSfx();
      closeRankingModal();
    });
  }
  if (rankingBackdrop) {
    rankingBackdrop.addEventListener("click", () => {
      closeRankingModal();
    });
  }
  if (rankingForm) {
    rankingForm.addEventListener("submit", handleRankingSubmit);
  }
  if (rankingHandleInput) {
    rankingHandleInput.addEventListener("input", () => {
      rankingHandleInput.setCustomValidity("");
    });
    rankingHandleInput.addEventListener("blur", () => {
      const normalized = normalizeHandle(rankingHandleInput.value);
      rankingHandleInput.value = normalized ? `@${normalized}` : "";
    });
  }
  document.addEventListener("keydown", handleRankingKeydown);

  if (langButtons.length) {
    langButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        playMainSfx();
        changeLanguage(btn.dataset.lang);
      });
    });
  }
}

function mountStore() {
  game.subscribe((state) => {
    enqueueRender(state);
  });
}

function init() {
  initUI();
  langButtons = Array.from(document.querySelectorAll("[data-lang]"));
  initAudio({ toggleButton: bgmToggleButton });
  changeLanguage(getLanguage());
  updateRankingFormPlaceholders();
  attachEventListeners();
  mountStore();
  screens.showTop();
  if (!isBgmUnlocked()) {
    attemptAutoPlayMenuBgm();
  }
}

document.addEventListener("DOMContentLoaded", init);

const toastStyle = document.createElement("style");
toastStyle.innerHTML = `
.toast {
  position: fixed;
  bottom: 36px;
  left: 50%;
  transform: translateX(-50%) translateY(20px);
  padding: 12px 18px;
  border-radius: 999px;
  background: rgba(20, 12, 35, 0.94);
  color: white;
  box-shadow: 0 12px 30px rgba(0,0,0,0.35);
  opacity: 0;
  transition: opacity 0.25s ease, transform 0.25s ease;
  z-index: 50;
  font-size: 0.9rem;
}
.toast--success {
  border: 1px solid rgba(87, 242, 135, 0.65);
}
.toast--danger {
  border: 1px solid rgba(255, 59, 107, 0.65);
  color: #ffb3c7;
}
.toast.is-visible {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
.toast--stage {
  position: relative;
  left: auto;
  bottom: auto;
  transform: translateY(12px);
  padding: 8px 12px;
  border-radius: 14px;
  background: rgba(20, 9, 45, 0.92);
  box-shadow: 0 12px 24px rgba(13, 5, 32, 0.4);
  font-size: 0.8rem;
  min-width: 120px;
  opacity: 0;
  white-space: nowrap;
}
.toast--stage-success {
  border: 1px solid rgba(87, 242, 135, 0.65);
  color: #d4ffe5;
  text-shadow: 0 0 8px rgba(87, 242, 135, 0.4);
  box-shadow: 0 14px 28px rgba(20, 60, 40, 0.45), 0 0 20px rgba(87, 242, 135, 0.35);
  background: linear-gradient(140deg, rgba(30, 80, 50, 0.4), rgba(20, 9, 45, 0.92));
}

.toast--stage-success-pink {
  border: 1px solid rgba(255, 110, 210, 0.7);
  color: #ffd8ff;
  text-shadow: 0 0 8px rgba(255, 120, 220, 0.6);
  box-shadow: 0 14px 28px rgba(120, 20, 90, 0.35), 0 0 20px rgba(255, 110, 210, 0.3);
  background: linear-gradient(140deg, rgba(255, 120, 230, 0.18), rgba(40, 0, 70, 0.9));
}
.toast--stage.is-visible {
  transform: translateY(0);
  opacity: 1;
}
`;
document.head.appendChild(toastStyle);

document.addEventListener(
  "gesturestart",
  (event) => {
    event.preventDefault();
  },
  { passive: false }
);

document.addEventListener(
  "gesturechange",
  (event) => {
    event.preventDefault();
  },
  { passive: false }
);

document.addEventListener(
  "gestureend",
  (event) => {
    event.preventDefault();
  },
  { passive: false }
);

function allowsDoubleTap() {
  return false;
}

let lastTouchTime = 0;

document.addEventListener(
  "touchstart",
  (event) => {
    if (allowsDoubleTap(event.target)) return;
    if (event.touches.length > 1) {
      event.preventDefault();
      return;
    }
    const now = Date.now();
    if (now - lastTouchTime <= 350) {
      event.preventDefault();
      return;
    }
    lastTouchTime = now;
  },
  { passive: false }
);

["touchmove", "touchend"].forEach((type) => {
  document.addEventListener(
    type,
    (event) => {
      if (allowsDoubleTap(event.target)) return;
      if (event.touches && event.touches.length > 1) {
        event.preventDefault();
      }
    },
    { passive: false }
  );
});

document.addEventListener(
  "dblclick",
  (event) => {
    if (allowsDoubleTap(event.target)) return;
    event.preventDefault();
  },
  { passive: false }
);

