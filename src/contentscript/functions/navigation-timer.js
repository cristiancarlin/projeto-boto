/**
 * Cronômetro de navegação (hh:mm:ss).
 *
 * Ajustes extra:
 * 1) O popup fecha ao clicar na página — o relógio também aparece no site.
 * 2) Só no frame principal (iframes de anúncio não devem ter outro relógio).
 * 3) Início gravado no chrome.storage — recarregar a aba não zera o tempo.
 * 4) Sem auto-hide: pointer-events none — o relógio não come cliques.
 * 5) Com auto-hide: colapsa em círculo e expande ao passar o mouse.
 */

const TIMER_ID = 'boto-navigation-timer';
const STORAGE_KEY = 'navigationTimerStartedAt';
const TICK_MS = 250;
const AUTO_HIDE_DELAY_MS = 3000;
const COLLAPSE_AFTER_LEAVE_MS = 1200;
const CIRCLE_SIZE = '36px';

let tickId = 0;
let hideTimeoutId = 0;
let startedAt = 0;
let featureEnabled = false;
let autoHideEnabled = false;
let isCollapsed = false;

function isTopFrame() {
  try {
    return window.top === window;
  } catch (error) {
    return false;
  }
}

export function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = String(Math.floor(total / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const seconds = String(total % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function clearHideTimeout() {
  if (hideTimeoutId) {
    clearTimeout(hideTimeoutId);
    hideTimeoutId = 0;
  }
}

function baseStyles() {
  return {
    position: 'fixed',
    top: '12px',
    right: '12px',
    'z-index': '2147483645',
    'font-family': '"IBM Plex Sans", Oxygen, sans-serif',
    'font-weight': '700',
    'font-variant-numeric': 'tabular-nums',
    color: '#ffffff',
    background: '#C8206F',
    'box-shadow': '0 2px 8px rgba(0, 0, 0, 0.35)',
    margin: '0',
    border: '2px solid #ffffff',
    display: 'block',
    visibility: 'visible',
    opacity: '1',
    overflow: 'hidden',
    'white-space': 'nowrap',
    'box-sizing': 'border-box',
    transition: 'width 0.2s ease, height 0.2s ease, padding 0.2s ease, border-radius 0.2s ease, font-size 0.2s ease'
  };
}

function applyExpandedStyles(el) {
  const styles = {
    ...baseStyles(),
    'pointer-events': autoHideEnabled ? 'auto' : 'none',
    'font-size': '28px',
    'letter-spacing': '0.06em',
    padding: '8px 14px',
    'border-radius': '8px',
    'line-height': '1.1',
    width: 'auto',
    height: 'auto',
    'min-width': '0',
    'min-height': '0',
    cursor: autoHideEnabled ? 'default' : 'default'
  };

  Object.entries(styles).forEach(([property, value]) => {
    el.style.setProperty(property, value, 'important');
  });
}

function applyCollapsedStyles(el) {
  const styles = {
    ...baseStyles(),
    'pointer-events': 'auto',
    'font-size': '0',
    'letter-spacing': '0',
    padding: '0',
    'border-radius': '999px',
    'line-height': CIRCLE_SIZE,
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    'min-width': CIRCLE_SIZE,
    'min-height': CIRCLE_SIZE,
    cursor: 'pointer'
  };

  Object.entries(styles).forEach(([property, value]) => {
    el.style.setProperty(property, value, 'important');
  });
}

function applyVisualState(el) {
  if (!el) return;
  if (autoHideEnabled && isCollapsed) {
    applyCollapsedStyles(el);
    el.textContent = '';
    el.setAttribute('title', 'Passe o mouse para ver o cronômetro');
  } else {
    applyExpandedStyles(el);
    el.removeAttribute('title');
    if (startedAt) {
      el.textContent = formatElapsed(Date.now() - startedAt);
    }
  }
}

function collapseTimer() {
  if (!featureEnabled || !autoHideEnabled || isCollapsed) return;
  isCollapsed = true;
  applyVisualState(document.getElementById(TIMER_ID));
}

function expandTimer() {
  if (!featureEnabled) return;
  isCollapsed = false;
  applyVisualState(document.getElementById(TIMER_ID));
}

function scheduleCollapse(delayMs) {
  clearHideTimeout();
  if (!autoHideEnabled) return;
  hideTimeoutId = setTimeout(collapseTimer, delayMs);
}

function onTimerEnter() {
  if (!autoHideEnabled) return;
  clearHideTimeout();
  expandTimer();
}

function onTimerLeave() {
  if (!autoHideEnabled) return;
  scheduleCollapse(COLLAPSE_AFTER_LEAVE_MS);
}

function bindHoverHandlers(el) {
  el.removeEventListener('mouseenter', onTimerEnter);
  el.removeEventListener('mouseleave', onTimerLeave);
  if (!autoHideEnabled) return;
  el.addEventListener('mouseenter', onTimerEnter);
  el.addEventListener('mouseleave', onTimerLeave);
}

function ensureTimerEl() {
  let el = document.getElementById(TIMER_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = TIMER_ID;
    el.setAttribute('data-boto', 'navigation-timer');
    el.setAttribute('role', 'timer');
    el.setAttribute('aria-label', 'Cronômetro de navegação');
    el.setAttribute('aria-live', 'off');
  }

  applyVisualState(el);
  bindHoverHandlers(el);

  const root = document.documentElement || document.body;
  if (root && !el.isConnected) {
    root.appendChild(el);
  }
  return el;
}

function paint() {
  const el = document.getElementById(TIMER_ID);
  if (!el || !startedAt) return;

  const label = formatElapsed(Date.now() - startedAt);
  el.setAttribute('aria-label', `Cronômetro de navegação: ${label}`);

  if (!(autoHideEnabled && isCollapsed)) {
    el.textContent = label;
  }
}

function stopTicking() {
  if (tickId) {
    clearInterval(tickId);
    tickId = 0;
  }
}

function startTicking() {
  stopTicking();
  paint();
  tickId = setInterval(paint, TICK_MS);
}

async function readStartedAt() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return stored[STORAGE_KEY] || 0;
}

async function writeStartedAt(value) {
  await chrome.storage.local.set({ [STORAGE_KEY]: value });
}

async function clearStartedAt() {
  await chrome.storage.local.remove(STORAGE_KEY);
}

function onStorageChanged(changes, areaName) {
  if (areaName !== 'local' || !changes[STORAGE_KEY]) return;
  const next = changes[STORAGE_KEY].newValue || 0;
  if (!featureEnabled) return;
  startedAt = next;
  paint();
}

export function setNavigationTimerAutoHide(enabled) {
  autoHideEnabled = !!enabled;
  if (!featureEnabled || !isTopFrame()) return;

  const el = document.getElementById(TIMER_ID) || ensureTimerEl();
  bindHoverHandlers(el);

  if (autoHideEnabled) {
    isCollapsed = false;
    applyVisualState(el);
    scheduleCollapse(AUTO_HIDE_DELAY_MS);
  } else {
    clearHideTimeout();
    isCollapsed = false;
    applyVisualState(el);
  }
}

export async function enableNavigationTimer() {
  featureEnabled = true;
  if (!isTopFrame()) return;

  chrome.storage.onChanged.removeListener(onStorageChanged);
  chrome.storage.onChanged.addListener(onStorageChanged);

  let value = await readStartedAt();
  if (!featureEnabled) return;
  if (!value) {
    value = Date.now();
    await writeStartedAt(value);
    if (!featureEnabled) return;
  }
  startedAt = value;
  isCollapsed = false;
  ensureTimerEl();
  startTicking();
  if (autoHideEnabled) {
    scheduleCollapse(AUTO_HIDE_DELAY_MS);
  }
}

export function disableNavigationTimer() {
  featureEnabled = false;
  autoHideEnabled = false;
  isCollapsed = false;
  clearHideTimeout();
  chrome.storage.onChanged.removeListener(onStorageChanged);
  stopTicking();
  startedAt = 0;

  if (!isTopFrame()) return;
  const el = document.getElementById(TIMER_ID);
  if (el) {
    el.removeEventListener('mouseenter', onTimerEnter);
    el.removeEventListener('mouseleave', onTimerLeave);
    el.remove();
  }
  clearStartedAt();
}
