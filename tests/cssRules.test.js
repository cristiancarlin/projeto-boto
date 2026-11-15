import {
  zoomRule,
  contrastBrightnessRule,
  fontSizeRule,
  removeElementCursorRule
} from '../src/contentscript/utils/cssRules';

describe('cssRules (regras CSS geradas)', () => {
  test('zoomRule inclui o percentual', () => {
    const css = zoomRule(120);
    expect(css).toContain('zoom: 120%');
    expect(css).toContain('!important');
  });

  test('contrastBrightnessRule inclui contraste e brilho', () => {
    const css = contrastBrightnessRule(1.2, 0.9);
    expect(css).toContain('contrast(1.2)');
    expect(css).toContain('brightness(0.9)');
  });

  test('fontSizeRule inclui letter-spacing', () => {
    const css = fontSizeRule(110, 0.05, 1.5);
    expect(css).toContain('letter-spacing: 0.05rem');
  });

  test('removeElementCursorRule usa crosshair', () => {
    expect(removeElementCursorRule()).toContain('crosshair');
  });
});
