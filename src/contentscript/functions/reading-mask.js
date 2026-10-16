const MASK_ID = 'boto-reading-mask';
const MESSAGE_TYPE = 'boto-reading-mask-move';
const BAND_HEIGHT = 96;

function isTopFrame() {
  try {
    return window.top === window;
  } catch (error) {
    return false;
  }
}

function applyMaskStyles(el, top) {
  const styles = {
    position: 'fixed',
    left: '0',
    top: `${top}px`,
    width: '100vw',
    height: `${BAND_HEIGHT}px`,
    'pointer-events': 'none',
    'z-index': '2147483646',
    background: 'transparent',
    'box-shadow': '0 0 0 100vmax rgba(0, 0, 0, 0.72)',
    'border-top': '1px solid rgba(255, 255, 255, 0.45)',
    'border-bottom': '1px solid rgba(255, 255, 255, 0.45)',
    margin: '0',
    padding: '0',
    display: 'block',
    visibility: 'visible',
    opacity: '1'
  };

  Object.entries(styles).forEach(([property, value]) => {
    el.style.setProperty(property, value, 'important');
  });
}

function ensureReadingMask() {
  let el = document.getElementById(MASK_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = MASK_ID;
    el.setAttribute('data-boto', 'reading-mask');
    el.setAttribute('aria-hidden', 'true');
  }

  const root = document.documentElement || document.body;
  if (root && !el.isConnected) {
    applyMaskStyles(el, -BAND_HEIGHT);
    el.style.setProperty('display', 'none', 'important');
    root.appendChild(el);
  }
  return el;
}

function moveMask(clientY) {
  if (!Number.isFinite(clientY)) return;
  const el = ensureReadingMask();
  applyMaskStyles(el, clientY - BAND_HEIGHT / 2);
}

function findFrameElement(sourceWindow) {
  const frames = document.querySelectorAll('iframe, frame');
  for (const frame of frames) {
    if (frame.contentWindow === sourceWindow) return frame;
  }
  return null;
}

function onReadingMaskMove(event) {
  if (isTopFrame()) {
    moveMask(event.clientY);
    return;
  }

  window.parent.postMessage(
    {
      type: MESSAGE_TYPE,
      x: event.clientX,
      y: event.clientY
    },
    '*'
  );
}

function onReadingMaskMessage(event) {
  const data = event.data;
  if (!data || data.type !== MESSAGE_TYPE) return;
  if (!Number.isFinite(data.x) || !Number.isFinite(data.y)) return;

  const frame = findFrameElement(event.source);
  if (!frame) return;

  const rect = frame.getBoundingClientRect();
  const x = data.x + rect.left;
  const y = data.y + rect.top;

  if (isTopFrame()) {
    moveMask(y);
    return;
  }

  window.parent.postMessage({ type: MESSAGE_TYPE, x, y }, '*');
}

export function enableReadingMask() {
  document.addEventListener('mousemove', onReadingMaskMove, true);
  window.addEventListener('message', onReadingMaskMessage);

  if (isTopFrame()) ensureReadingMask();
}

export function disableReadingMask() {
  document.removeEventListener('mousemove', onReadingMaskMove, true);
  window.removeEventListener('message', onReadingMaskMessage);

  if (!isTopFrame()) return;
  const el = document.getElementById(MASK_ID);
  if (el) el.remove();
}
