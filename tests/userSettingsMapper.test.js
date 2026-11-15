import { map } from '../src/background/utils/userSettingsMapper';
import * as constants from '../src/shared/constants';

function baseSettings() {
  return JSON.parse(JSON.stringify(constants.defaultSettingsData));
}

function baseUser(overrides = {}) {
  return {
    ...constants.defaultUserData,
    ...overrides
  };
}

describe('userSettingsMapper.map (perfil → settings)', () => {
  test('perfil padrão não força zoom nem clique automático', () => {
    const result = map(baseSettings(), baseUser({ age: 25 }));
    expect(result.options.zoom).toBe(0);
    expect(result.options.autoClickOnHover).toBe(false);
    expect(result.options.brightness).toBe(0);
  });

  test('idade >= 70 aumenta zoom e ativa clique automático', () => {
    const result = map(baseSettings(), baseUser({ age: 72 }));
    expect(result.options.zoom).toBe(20);
    expect(result.options.turnExtensionBigger).toBe(true);
    expect(result.options.autoClickOnHover).toBe(true);
    expect(result.options.fontSize).toBe(20);
  });

  test('deficiência cognitiva severa ajusta contraste, zoom e propaganda', () => {
    const result = map(
      baseSettings(),
      baseUser({
        age: 30,
        cognitiveDeficiency: constants.cognitiveDeficiencyTypes.SEVERE
      })
    );
    expect(result.options.contrast).toBe(-10);
    expect(result.options.zoom).toBe(20);
    expect(result.options.fontSize).toBe(40);
    expect(result.options.noise).toEqual([constants.noiseTypes.ADS]);
  });

  test('mapeia daltonismo protanopia para código 2', () => {
    const result = map(
      baseSettings(),
      baseUser({ daltonism: constants.daltonismTypes.PROTANOPIA })
    );
    expect(result.options.daltonism).toBe(2);
  });

  test('sem daltonismo grava 0', () => {
    const result = map(
      baseSettings(),
      baseUser({ daltonism: constants.daltonismTypes.NO })
    );
    expect(result.options.daltonism).toBe(0);
  });

  test('restaurar perfil desliga extras manuais mesmo se estavam ativos', () => {
    const settings = baseSettings();
    settings.options.readingMask = true;
    settings.options.mutePauseMedia = true;
    settings.options.bionicReading = true;
    settings.options.navigationTimer = true;
    settings.options.navigationTimerAutoHide = true;
    settings.options.colorLegend = true;

    const result = map(settings, baseUser({ age: 25 }));

    expect(result.options.readingMask).toBe(false);
    expect(result.options.mutePauseMedia).toBe(false);
    expect(result.options.bionicReading).toBe(false);
    expect(result.options.navigationTimer).toBe(false);
    expect(result.options.navigationTimerAutoHide).toBe(false);
    expect(result.options.colorLegend).toBe(false);
  });

  test('map não muta o options original', () => {
    const settings = baseSettings();
    settings.options.bionicReading = true;

    map(settings, baseUser({ age: 25 }));

    expect(settings.options.bionicReading).toBe(true);
  });
});
