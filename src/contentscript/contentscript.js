import RemoveCookieBanners from './functions/cookiebanner-go-away';
import { enableReadingMask, disableReadingMask } from './functions/reading-mask';
import { enableMutePauseMedia, disableMutePauseMedia } from './functions/mute-pause-media';
import { enableBionicReading, disableBionicReading } from './functions/bionic-reading';
import { enableNavigationTimer, disableNavigationTimer } from './functions/navigation-timer';
import * as constants from '../shared/constants';
import { sendMessageToBackground } from './utils/messageManager';
import {
  createStylesheet,
  addStyleRule,
  removeStyleRuleNode,
  hideClickedElement,
  hideAllImageElements,
  showAllElements,
  domContrastFix,
  processColorLegend,
  processDaltonismType,
  onTypeChange
} from './utils/domUtils';
import {
  removeElementCursorRule,
  fontSizeRule,
  zoomRule,
  contrastBrightnessRule
} from './utils/cssRules';

function isTopFrame() {
  try {
    return window.top === window;
  } catch (error) {
    return false;
  }
}

console.log('contentscript: loaded');

var prevSettingsData = constants.defaultSettingsData;
var prevExtensionData = {};
var botoStylesheet;

var fixedElements = [];
var hiddenElements = [];
var hiddenImageElements = [];

// Observer to automatically hide new added images
var hideImagesObserver = new MutationObserver(function (mutations, observer) {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.tagName === 'img') {
        node.style.visibility = 'hidden';
        hiddenImageElements.push(node);
      } else if (node.getElementsByTagName) {
        let imagesInsideNewNode = node.getElementsByTagName('img');
        for (var x = 0; x < imagesInsideNewNode.length; x++) {
          let imageNode = imagesInsideNewNode[x];
          imageNode.style.visibility = 'hidden';
          hiddenImageElements.push(imageNode);
        }
      }
    });
  });
});

// CSS rule nodes
var removeElementCursorRuleNode = {};
var fontSizeRuleNode = {};
var zoomRuleNode = {};
var contrastBrightnessRuleNode = {};

// Event to automatically click on the element after 3s of hover
var timeoutForMouseStop = 0;
function autoClickOnHoverEvent(e) {
  clearTimeout(timeoutForMouseStop);
  timeoutForMouseStop = setTimeout(() => {
    document
      .elementFromPoint(e.clientX, e.clientY)
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancellable: true }));
  }, 3000);
}

// Event to hide the next clicked element
function hideNextClickedElementEvent(e) {
  e.stopImmediatePropagation();
  e.preventDefault();

  let element = hideClickedElement(e);
  if (element) hiddenElements.push(element);

  removeStyleRuleNode(botoStylesheet, removeElementCursorRuleNode);
  document.removeEventListener('click', hideNextClickedElementEvent);
  return null;
}

// Update DOM based on settingsData argument
function settingsDataUpdate(newSettingsData) {
  if (
    prevSettingsData.options.contrast !== newSettingsData.options.contrast ||
    prevSettingsData.options.brightness !== newSettingsData.options.brightness
  ) {
    if (newSettingsData.options.contrast === 0 && newSettingsData.options.brightness === 0)
      removeStyleRuleNode(botoStylesheet, contrastBrightnessRuleNode);
    else {
      let newContrast =
        newSettingsData.options.contrast * (newSettingsData.options.contrast > 0 ? 0.02 : 0.01) + 1;
      let newBrightness =
        newSettingsData.options.brightness *
          (newSettingsData.options.brightness > 0 ? 0.02 : 0.01) +
        1;
      contrastBrightnessRuleNode = addStyleRule(
        botoStylesheet,
        contrastBrightnessRule(newContrast, newBrightness),
        contrastBrightnessRuleNode
      );
    }
  }

  if (prevSettingsData.options.fontSize !== newSettingsData.options.fontSize) {
    if (newSettingsData.options.fontSize === 0)
      removeStyleRuleNode(botoStylesheet, fontSizeRuleNode);
    else {
      let newFontSize = newSettingsData.options.fontSize + 100;
      let newLetterSpacing =
        newSettingsData.options.fontSize < 1 ? 0 : newSettingsData.options.fontSize / 300;
      let newLineHeight =
        (newSettingsData.options.fontSize * 3) / 10 < 1.5
          ? 1.5
          : newSettingsData.options.fontSize / 10;
      fontSizeRuleNode = addStyleRule(
        botoStylesheet,
        fontSizeRule(newFontSize, newLetterSpacing, newLineHeight),
        fontSizeRuleNode
      );
    }
  }

  if (prevSettingsData.options.daltonism !== newSettingsData.options.daltonism) {
    const type = newSettingsData.options.daltonism;
    document.addEventListener('change', processDaltonismType(type));
  }

  if (prevSettingsData.options.colorLegend !== newSettingsData.options.colorLegend) {
    if (newSettingsData.options.colorLegend == true) {
      document.addEventListener('mousemove', processColorLegend);
      document.addEventListener('mouseout', function () {
        const div = document.getElementById('colorLegend');
        div.style.display = 'none';
      });
    }
    if (newSettingsData.options.colorLegend == false) {
      document.removeEventListener('mousemove', processColorLegend);
    }
  }

  if (prevSettingsData.options.zoom !== newSettingsData.options.zoom) {
    if (newSettingsData.options.zoom === 0) removeStyleRuleNode(botoStylesheet, zoomRuleNode);
    else {
      let newZoom = newSettingsData.options.zoom * 2 + 100 || 1;
      zoomRuleNode = addStyleRule(botoStylesheet, zoomRule(newZoom), zoomRuleNode);
    }
    window.dispatchEvent(new Event('resize'));
  }

  if (
    newSettingsData.options.noise.includes(constants.noiseTypes.IMAGES) &&
    !prevSettingsData.options.noise.includes(constants.noiseTypes.IMAGES)
  ) {
    hiddenImageElements = hideAllImageElements();
    hideImagesObserver.observe(document, { childList: true, subtree: true });
  } else if (
    !newSettingsData.options.noise.includes(constants.noiseTypes.IMAGES) &&
    prevSettingsData.options.noise.includes(constants.noiseTypes.IMAGES)
  ) {
    showAllElements(hiddenImageElements);
    hideImagesObserver.disconnect();
    hiddenImageElements = [];
  }

  if (newSettingsData.options.autoClickOnHover && !prevSettingsData.options.autoClickOnHover) {
    document.addEventListener('mousemove', autoClickOnHoverEvent);
    document.addEventListener('wheel', autoClickOnHoverEvent);
  } else if (
    !newSettingsData.options.autoClickOnHover &&
    prevSettingsData.options.autoClickOnHover
  ) {
    document.removeEventListener('mousemove', autoClickOnHoverEvent);
    document.removeEventListener('wheel', autoClickOnHoverEvent);
  }

  if (newSettingsData.options.readingMask && !prevSettingsData.options.readingMask) {
    enableReadingMask();
  } else if (!newSettingsData.options.readingMask && prevSettingsData.options.readingMask) {
    disableReadingMask();
  }

  if (newSettingsData.options.mutePauseMedia && !prevSettingsData.options.mutePauseMedia) {
    enableMutePauseMedia();
  } else if (!newSettingsData.options.mutePauseMedia && prevSettingsData.options.mutePauseMedia) {
    disableMutePauseMedia();
  }

  if (newSettingsData.options.bionicReading && !prevSettingsData.options.bionicReading) {
    enableBionicReading();
  } else if (!newSettingsData.options.bionicReading && prevSettingsData.options.bionicReading) {
    disableBionicReading();
  }

  if (newSettingsData.options.navigationTimer && !prevSettingsData.options.navigationTimer) {
    enableNavigationTimer();
  } else if (!newSettingsData.options.navigationTimer && prevSettingsData.options.navigationTimer) {
    disableNavigationTimer();
  }

  prevSettingsData = newSettingsData;
}
// Update DOM based on extensionData argument
function extensionDataUpdate(newExtensionData) {
  // Operações pesadas só na página principal.
  // Em sites como o G1, dezenas de iframes de anúncio carregam o content script
  // (all_frames). Rodar domContrastFix em cada um travava/piscava a tela até o
  // modal de "bloqueador" aparecer e parar novos iframes.
  if (isTopFrame()) {
    if (
      newExtensionData.autoFixElements &&
      (!prevExtensionData || !prevExtensionData.autoFixElements)
    ) {
      fixedElements = domContrastFix();
    } else if (
      !newExtensionData.autoFixElements &&
      (!prevExtensionData || prevExtensionData.autoFixElements)
    ) {
      fixedElements.forEach(
        (fixedElement) => (fixedElement.elem.style.color = fixedElement.originalColor)
      );
      fixedElements = [];
    }

    if (newExtensionData.acceptCookies && (!prevExtensionData || !prevExtensionData.acceptCookies)) {
      RemoveCookieBanners();
    }
  }

  prevExtensionData = newExtensionData;
}

// Messages listener
chrome.runtime.onMessage.addListener((msg, sender, response) => {
  if (msg.from === constants.commAgents.POPUP || msg.from === constants.commAgents.BACKGROUND) {
    switch (msg.subject) {
      case constants.commSubjects.UPDATE.SETTINGS_DATA:
        settingsDataUpdate(msg.payload);
        break;

      case constants.commSubjects.UPDATE.EXTENSION_DATA:
        extensionDataUpdate(msg.payload);
        break;

      case constants.commSubjects.HIDDEN_ELEMENTS.HIDE_NEXT:
        removeElementCursorRuleNode = addStyleRule(
          botoStylesheet,
          removeElementCursorRule(),
          removeElementCursorRuleNode
        );
        document.addEventListener('click', hideNextClickedElementEvent);
        break;

      case constants.commSubjects.HIDDEN_ELEMENTS.RESET:
        showAllElements(hiddenElements);
        hiddenElements = [];
        break;

      case constants.commSubjects.HIDDEN_ELEMENTS.STOP_HIDE_NEXT:
        removeStyleRuleNode(botoStylesheet, removeElementCursorRuleNode);
        document.removeEventListener('click', hideNextClickedElementEvent);
        break;

      default:
        response('unknown message subject');
    }
  }
});

// DOM load
document.addEventListener('DOMContentLoaded', () => {
  botoStylesheet = createStylesheet();

  // Get updated settingsData
  sendMessageToBackground(constants.commSubjects.REQUEST.ALL_DATA, null, (response) => {
    if (!response) return;
    settingsDataUpdate(response.settingsData);
    extensionDataUpdate(response.extensionData);
  });
});

// Garante que iframes também recebam mudanças feitas no popup
// (chrome.tabs.sendMessage só entrega no frame principal por padrão)
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  if (changes.settingsData && changes.settingsData.newValue) {
    settingsDataUpdate(changes.settingsData.newValue);
  }
  if (changes.extensionData && changes.extensionData.newValue) {
    extensionDataUpdate(changes.extensionData.newValue);
  }
});
