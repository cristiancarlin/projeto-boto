/**
 * Silencia e pausa mídias (video/audio) do documento atual.
 *
 * Ajustes de implementação:
 * 1) MutationObserver — mídias criadas depois do clique na opção.
 * 2) Listener em `play` — site tenta tocar de novo.
 * 3) Restauração do estado anterior ao desligar.
 * 4) all_frames — cada iframe trata a própria mídia.
 * 5) Evitar loop play→pause→play (página “piscando”) — não reprocessar
 *    mídia já silenciada e só chamar pause() se ainda estiver tocando.
 */

const MEDIA_STATE = new WeakMap();
const silencingNow = new WeakSet();
let mediaObserver = null;
let featureEnabled = false;

function isMediaElement(node) {
  return node && (node.tagName === 'VIDEO' || node.tagName === 'AUDIO');
}

function collectMediaElements(root = document) {
  const list = [];
  if (!root || !root.querySelectorAll) return list;

  root.querySelectorAll('video, audio').forEach((el) => list.push(el));

  root.querySelectorAll('*').forEach((el) => {
    if (el.shadowRoot) {
      el.shadowRoot.querySelectorAll('video, audio').forEach((media) => list.push(media));
    }
  });

  return list;
}

function rememberState(media) {
  if (MEDIA_STATE.has(media)) return;
  MEDIA_STATE.set(media, {
    muted: media.muted,
    volume: media.volume,
    paused: media.paused
  });
}

function silenceAndPause(media) {
  if (!isMediaElement(media)) return;

  // Já sob controle do Boto e parado: não repetir (evita piscar)
  if (media.getAttribute('data-boto-media-silenced') === 'true' && media.paused && media.muted) {
    return;
  }

  if (silencingNow.has(media)) return;
  silencingNow.add(media);

  try {
    rememberState(media);
    if (!media.paused) {
      media.pause();
    }
    if (!media.muted) {
      media.muted = true;
    }
    media.setAttribute('data-boto-media-silenced', 'true');
  } catch (error) {
    // Elemento ainda não pronto; ignorar.
  } finally {
    // Libera no próximo tick para cobrir o evento `play` que nós mesmos disparamos indiretamente
    setTimeout(() => silencingNow.delete(media), 0);
  }
}

function restoreMedia(media) {
  if (!isMediaElement(media)) return;
  const previous = MEDIA_STATE.get(media);
  media.removeAttribute('data-boto-media-silenced');

  if (!previous) {
    media.muted = false;
    return;
  }

  media.muted = previous.muted;
  if (typeof previous.volume === 'number') {
    media.volume = previous.volume;
  }
  if (!previous.paused) {
    const playPromise = media.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
  }
  MEDIA_STATE.delete(media);
}

function silenceAllCurrentMedia() {
  collectMediaElements().forEach(silenceAndPause);
}

function onPlayWhileEnabled(event) {
  if (!featureEnabled) return;
  const media = event.target;
  if (!isMediaElement(media)) return;
  if (silencingNow.has(media)) return;

  // Impede a reprodução e mantém silenciado sem reentrada em loop
  silenceAndPause(media);
}

function onMutations(mutations) {
  if (!featureEnabled) return;

  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (isMediaElement(node)) {
        silenceAndPause(node);
        return;
      }
      if (!node || node.nodeType !== 1 || !node.querySelectorAll) return;

      node.querySelectorAll('video, audio').forEach(silenceAndPause);
      if (node.shadowRoot) {
        node.shadowRoot.querySelectorAll('video, audio').forEach(silenceAndPause);
      }
    });
  });
}

function startObserver() {
  if (mediaObserver || !document.documentElement) return;
  mediaObserver = new MutationObserver(onMutations);
  mediaObserver.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

function stopObserver() {
  if (!mediaObserver) return;
  mediaObserver.disconnect();
  mediaObserver = null;
}

export function enableMutePauseMedia() {
  featureEnabled = true;
  silenceAllCurrentMedia();
  document.addEventListener('play', onPlayWhileEnabled, true);
  startObserver();
}

export function disableMutePauseMedia() {
  featureEnabled = false;
  document.removeEventListener('play', onPlayWhileEnabled, true);
  stopObserver();

  document.querySelectorAll('[data-boto-media-silenced="true"]').forEach((media) => {
    restoreMedia(media);
  });

  collectMediaElements().forEach((media) => {
    if (MEDIA_STATE.has(media)) restoreMedia(media);
  });
}
