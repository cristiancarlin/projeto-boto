/**
 * Bionic Reading: primeira letra de cada palavra em negrito.
 *
 * Ajustes extra (textos que “não mudavam”):
 * 7–12) feed atrasado, SPA, Shadow DOM, fonte variável, CSS !important,
 *     contenteditable.
 * 13) Reapply agressivo (intervalo/scroll) + reagir a remoção dos spans
 *     gerava loop com React: a página “ficava carregando” como F5.
 *     Agora: cooldown entre applies, não reaplica só porque o site
 *     removeu nossos spans, retries curtos no início e observer
 *     desligado só durante o apply.
 */

const WORD_CLASS = 'boto-bionic-word';
const LETTER_CLASS = 'boto-bionic-letter';
const REST_CLASS = 'boto-bionic-rest';
const STYLE_ID = 'boto-bionic-style';
const WORD_RE = /(\p{L}+|\p{N}+)/gu;
const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEXTAREA',
  'INPUT',
  'SELECT',
  'OPTION',
  'CODE',
  'PRE',
  'KBD',
  'SAMP',
  'SVG',
  'CANVAS',
  'MATH',
  'IFRAME',
  'VIDEO',
  'AUDIO',
  'TEMPLATE'
]);
// Só no carregamento inicial — evita brigar com o site para sempre
const RETRY_MS = [300, 1200, 3000, 7000];
const MIN_APPLY_GAP_MS = 1800;
const MUTATION_DEBOUNCE_MS = 500;

let featureEnabled = false;
let observer = null;
let debounceId = 0;
let applying = false;
let pendingReapply = false;
let retryTimers = [];
let lastApplyAt = 0;
let mutationsPausedUntil = 0;

const RESET = `
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  background: transparent !important;
  color: inherit !important;
  font-family: inherit !important;
  font-size: inherit !important;
  font-style: inherit !important;
  line-height: inherit !important;
  letter-spacing: inherit !important;
  text-transform: inherit !important;
  vertical-align: baseline !important;
  float: none !important;
  position: static !important;
  display: inline !important;
  width: auto !important;
  height: auto !important;
  pointer-events: none !important;
  font-synthesis: weight !important;
`;

const STYLE_TEXT = `
  html body span.${WORD_CLASS} { ${RESET} white-space: nowrap !important; }
  html body span.${WORD_CLASS} span.${LETTER_CLASS} {
    ${RESET}
    font-weight: 800 !important;
    font-variation-settings: "wght" 800 !important;
  }
  html body span.${WORD_CLASS} span.${REST_CLASS} {
    ${RESET}
    font-weight: 400 !important;
    font-variation-settings: "wght" 400 !important;
  }
`;

const INLINE_BASE =
  'margin:0!important;padding:0!important;border:0!important;background:transparent!important;color:inherit!important;font-family:inherit!important;font-size:inherit!important;font-style:inherit!important;line-height:inherit!important;letter-spacing:inherit!important;text-transform:inherit!important;vertical-align:baseline!important;float:none!important;position:static!important;display:inline!important;width:auto!important;height:auto!important;pointer-events:none!important;font-synthesis:weight!important;';

function applyInline(el, extra) {
  el.setAttribute('style', INLINE_BASE + extra);
}

function injectStyleInto(root) {
  if (!root) return;
  const existing =
    (root.getElementById && root.getElementById(STYLE_ID)) ||
    (root.querySelector && root.querySelector(`#${STYLE_ID}`));
  if (existing) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE_TEXT;

  if (root.nodeType === 11) {
    root.appendChild(style);
    return;
  }
  (root.head || root.documentElement || root).appendChild(style);
}

function isBionicElement(el) {
  if (!el || !el.classList) return false;
  return (
    el.classList.contains(WORD_CLASS) ||
    el.classList.contains(LETTER_CLASS) ||
    el.classList.contains(REST_CLASS)
  );
}

function shouldSkipElement(el) {
  if (!el || el.nodeType !== 1) return false;
  if (SKIP_TAGS.has(el.tagName)) return true;
  if (
    el.id === 'boto-reading-mask' ||
    el.id === 'colorLegend' ||
    el.id === 'boto_styles' ||
    el.id === 'boto-navigation-timer'
  ) {
    return true;
  }
  if (el.getAttribute && el.getAttribute('data-boto')) return true;
  if (isBionicElement(el)) return true;
  return false;
}

function isInsideSkip(node) {
  let current = node.nodeType === 1 ? node : node.parentElement;
  while (current) {
    if (shouldSkipElement(current)) return true;
    current = current.parentElement;
  }
  return false;
}

function buildWord(word) {
  const wrap = document.createElement('span');
  wrap.className = WORD_CLASS;
  applyInline(wrap, 'white-space:nowrap!important;');

  const letter = document.createElement('span');
  letter.className = LETTER_CLASS;
  letter.textContent = word.charAt(0);
  applyInline(letter, 'font-weight:800!important;font-variation-settings:"wght" 800!important;');
  wrap.appendChild(letter);

  if (word.length > 1) {
    const rest = document.createElement('span');
    rest.className = REST_CLASS;
    rest.textContent = word.slice(1);
    applyInline(rest, 'font-weight:400!important;font-variation-settings:"wght" 400!important;');
    wrap.appendChild(rest);
  }

  return wrap;
}

function transformTextNode(textNode) {
  if (!textNode || textNode.nodeType !== 3) return;
  if (isInsideSkip(textNode)) return;

  const value = textNode.nodeValue;
  if (!value) return;
  WORD_RE.lastIndex = 0;
  if (!WORD_RE.test(value)) return;
  WORD_RE.lastIndex = 0;

  const parent = textNode.parentNode;
  if (!parent) return;

  const frag = document.createDocumentFragment();
  let lastIndex = 0;
  let match;

  while ((match = WORD_RE.exec(value)) !== null) {
    if (match.index > lastIndex) {
      frag.appendChild(document.createTextNode(value.slice(lastIndex, match.index)));
    }
    frag.appendChild(buildWord(match[0]));
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < value.length) {
    frag.appendChild(document.createTextNode(value.slice(lastIndex)));
  }

  parent.replaceChild(frag, textNode);
}

function collectTextNodes(root) {
  const nodes = [];
  if (!root) return nodes;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      if (isInsideSkip(node)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  let current = walker.nextNode();
  while (current) {
    nodes.push(current);
    current = walker.nextNode();
  }
  return nodes;
}

function visitRoot(root) {
  if (!root) return;
  injectStyleInto(root.nodeType === 9 ? root : root);
  if (root.nodeType === 9) {
    injectStyleInto(root);
    collectTextNodes(root.body || root.documentElement).forEach(transformTextNode);
  } else {
    collectTextNodes(root).forEach(transformTextNode);
  }

  const scope = root.body || root;
  if (!scope || !scope.querySelectorAll) return;
  scope.querySelectorAll('*').forEach((el) => {
    if (el.shadowRoot) visitRoot(el.shadowRoot);
  });
}

function scheduleApply() {
  if (!featureEnabled) return;
  clearTimeout(debounceId);

  const elapsed = Date.now() - lastApplyAt;
  const wait = Math.max(MUTATION_DEBOUNCE_MS, MIN_APPLY_GAP_MS - elapsed);
  debounceId = setTimeout(applyBionicEverywhere, wait);
}

function applyBionicEverywhere() {
  if (!featureEnabled) return;
  if (applying) {
    pendingReapply = true;
    return;
  }

  applying = true;
  pendingReapply = false;
  if (observer) observer.disconnect();

  try {
    injectStyleInto(document);
    visitRoot(document);
  } finally {
    lastApplyAt = Date.now();
    // Ignora a onda de mutações do próprio apply / hidratação imediata
    mutationsPausedUntil = lastApplyAt + 800;
    applying = false;
    if (featureEnabled) startObserver();
    if (featureEnabled && pendingReapply) {
      pendingReapply = false;
      scheduleApply();
    }
  }
}

function restoreRoot(root) {
  if (!root || !root.querySelectorAll) return;
  const scope = root.body || root;
  if (!scope.querySelectorAll) return;

  scope.querySelectorAll(`span.${WORD_CLASS}`).forEach((span) => {
    const text = document.createTextNode(span.textContent || '');
    if (span.parentNode) span.parentNode.replaceChild(text, span);
  });
  if (scope.normalize) scope.normalize();

  const style =
    (root.getElementById && root.getElementById(STYLE_ID)) ||
    (scope.querySelector && scope.querySelector(`#${STYLE_ID}`));
  if (style) style.remove();

  scope.querySelectorAll('*').forEach((el) => {
    if (el.shadowRoot) restoreRoot(el.shadowRoot);
  });
}

function restoreBionic() {
  applying = true;
  if (observer) observer.disconnect();
  try {
    restoreRoot(document);
  } finally {
    applying = false;
    pendingReapply = false;
  }
}

function addedNodeNeedsBionic(node) {
  if (!node) return false;
  if (node.nodeType === 3) {
    return !!(node.nodeValue && node.nodeValue.trim()) && !isInsideSkip(node);
  }
  if (node.nodeType !== 1) return false;
  if (isBionicElement(node) || shouldSkipElement(node)) return false;
  // Só reagimos a conteúdo novo de verdade, não a qualquer nó do site
  if (node.matches && node.matches('script, style, link, meta, noscript, svg, path, img, source')) {
    return false;
  }
  return true;
}

function onMutations(mutations) {
  if (!featureEnabled || applying) return;
  if (Date.now() < mutationsPausedUntil) return;

  for (const mutation of mutations) {
    if (mutation.type === 'characterData') {
      if (!isInsideSkip(mutation.target)) {
        scheduleApply();
        return;
      }
      continue;
    }

    // Não reagimos a remoção dos nossos spans: o site (React) costuma
    // desfazer o DOM; reaplicar na hora gera loop tipo F5.
    for (const node of mutation.addedNodes) {
      if (addedNodeNeedsBionic(node)) {
        scheduleApply();
        return;
      }
    }
  }
}

function startObserver() {
  if (observer || !document.documentElement) return;
  observer = new MutationObserver(onMutations);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });
}

function stopObserver() {
  clearTimeout(debounceId);
  retryTimers.forEach((id) => clearTimeout(id));
  retryTimers = [];
  if (!observer) return;
  observer.disconnect();
  observer = null;
}

function scheduleRetries() {
  retryTimers.forEach((id) => clearTimeout(id));
  retryTimers = RETRY_MS.map((ms) => setTimeout(applyBionicEverywhere, ms));
  window.addEventListener('load', applyBionicEverywhere, { once: true });
}

export function enableBionicReading() {
  featureEnabled = true;
  injectStyleInto(document);
  applyBionicEverywhere();
  startObserver();
  scheduleRetries();
}

export function disableBionicReading() {
  featureEnabled = false;
  stopObserver();
  restoreBionic();
}
