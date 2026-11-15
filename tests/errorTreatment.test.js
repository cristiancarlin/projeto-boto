import { errorTreatment } from '../src/popup/src/utils/errorTreatment';

describe('errorTreatment (erros do microfone/voz)', () => {
  test('mapeia no-speech', () => {
    expect(errorTreatment('no-speech')).toBe('Nenhuma fala detectada.');
  });

  test('mapeia not-allowed', () => {
    expect(errorTreatment('not-allowed')).toMatch(/microfone/i);
  });

  test('mapeia network', () => {
    expect(errorTreatment('network')).toBe('Conexão falhou.');
  });

  test('retorna erro desconhecido para código inválido', () => {
    expect(errorTreatment('xyz')).toBe('Erro desconhecido');
  });
});
