/**
 * Temporizador de navegação (hh:mm:ss).
 *
 * Ajustes extra:
 * 1) O popup fecha ao clicar na página — o relógio também aparece no site.
 * 2) Só no frame principal (iframes de anúncio não devem ter outro relógio).
 * 3) Início gravado no chrome.storage — recarregar a aba não zera o tempo.
 * 4) pointer-events: none — o relógio não come cliques.
 * 5) aria-live desligado — anunciar cada segundo no leitor de tela atrapalha.
 */

const TIMER_ID = 'boto-navigation-timer';
const STORAGE_KEY = 'navigationTimerStartedAt';
const TICK_MS = 250;

let tickId = 0;
let startedAt = 0;
let featureEnabled = false;

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

function applyTimerStyles(el) {
  const styles = {
    position: 'fixed',
    top: '12px',
    right: '12px',
    'z-index': '2147483645',
    'pointer-events': 'none',
    'font-family': '"IBM Plex Sans", Oxygen, sans-serif',
    'font-size': '28px',
    'font-weight': '700',
    'font-variant-numeric': 'tabular-nums',
    'letter-spacing': '0.06em',
    color: '#ffffff',
    background: '#C8206F',
    padding: '8px 14px',
    'border-radius': '8px',
    'box-shadow': '0 2px 8px rgba(0, 0, 0, 0.35)',
    'line-height': '1.1',
    margin: '0',
    border: '2px solid #ffffff',
    display: 'block',
    visibility: 'visible',
    opacity: '1'
  };

  Object.entries(styles).forEach(([property, value]) => {
    el.style.setProperty(property, value, 'important');
  });
}

function ensureTimerEl() {
  let el = document.getElementById(TIMER_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = TIMER_ID;
    el.setAttribute('data-boto', 'navigation-timer');
    el.setAttribute('role', 'timer');
    el.setAttribute('aria-label', 'Tempo de navegação');
    el.setAttribute('aria-live', 'off');
  }

  applyTimerStyles(el);

  const root = document.documentElement || document.body;
  if (root && !el.isConnected) {
    root.appendChild(el);
  }
  return el;
}

function paint() {
  const el = document.getElementById(TIMER_ID);
  if (!el || !startedAt) return;
  el.textContent = formatElapsed(Date.now() - startedAt);
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
  ensureTimerEl();
  startTicking();
}

export function disableNavigationTimer() {
  featureEnabled = false;
  chrome.storage.onChanged.removeListener(onStorageChanged);
  stopTicking();
  startedAt = 0;

  if (!isTopFrame()) return;
  const el = document.getElementById(TIMER_ID);
  if (el) el.remove();
  clearStartedAt();
}
