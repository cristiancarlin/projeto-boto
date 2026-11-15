import { formatElapsed } from '../src/contentscript/functions/navigation-timer';

describe('formatElapsed (cronômetro hh:mm:ss)', () => {
  test('retorna 00:00:00 para zero', () => {
    expect(formatElapsed(0)).toBe('00:00:00');
  });

  test('formata segundos', () => {
    expect(formatElapsed(1000)).toBe('00:00:01');
    expect(formatElapsed(59000)).toBe('00:00:59');
  });

  test('formata minutos e segundos', () => {
    expect(formatElapsed(61000)).toBe('00:01:01');
    expect(formatElapsed(125000)).toBe('00:02:05');
  });

  test('formata horas', () => {
    expect(formatElapsed(3661000)).toBe('01:01:01');
    expect(formatElapsed(3600000)).toBe('01:00:00');
  });

  test('não retorna valor negativo', () => {
    expect(formatElapsed(-5000)).toBe('00:00:00');
  });

  test('arredonda para baixo frações de segundo', () => {
    expect(formatElapsed(1999)).toBe('00:00:01');
  });
});
